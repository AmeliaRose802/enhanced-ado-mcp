# Last Substantive Change Tool

## Overview
A new MCP tool (`wit-get-last-substantive-change`) that efficiently determines when a work item was last meaningfully changed by analyzing revision history server-side and filtering out automated changes.

## Problem Statement
When analyzing work item staleness for backlog hygiene, bringing full revision history into the AI's context causes severe issues:

**Before (with full history in context):**
- Each work item's history: ~2-5KB of JSON
- 69 work items = 138-345KB consumed in context
- Token limit: ~200K tokens ≈ 800KB
- Result: **43% of context budget consumed by raw history data!** 😱
- Slower processing, risk of truncation, repeated API calls

## Solution

### New Tool: `wit-get-last-substantive-change`

**Server-side processing** that returns only the essential result:

```typescript
{
  workItemId: 12476027,
  lastSubstantiveChange: "2021-05-15T10:30:00Z",    // When real work last happened
  daysInactive: 1234,                                 // Calculated days
  lastChangeType: "Description, Priority",            // What changed
  automatedChangesSkipped: 8,                        // How many automated revisions ignored
  allChangesWereAutomated: false,                    // Flag if no real changes ever
  createdDate: "2020-01-01T08:00:00Z",
  daysSinceCreation: 1735
}
```

**Size:** ~300 bytes per item vs. 2-5KB with full history = **90% reduction!**

## How It Works

### Algorithm

1. **Fetch Revisions:** Get up to 50 revisions from Azure DevOps API
2. **Sort by Date:** Newest first
3. **Analyze Each Revision:** Compare with previous revision to detect what changed
4. **Classify Changes:**
   - **Substantive:** Description, Title, State, AssignedTo, Priority, AcceptanceCriteria, Tags
   - **Automated:** IterationPath, AreaPath (especially when changed by known automation accounts)
5. **Return First Substantive:** The most recent meaningful change
6. **Fallback:** If no substantive changes found, use creation date

### Automation Detection

Filters out changes by known automation patterns:
- (Removed specific individual account examples; iteration/area path only changes ignored regardless of actor.)
- "Project Collection Build Service"
- "Azure DevOps"
- "System Account"
- Custom patterns can be provided via `AutomatedPatterns` parameter

### Field Change Detection

Compares revision N with revision N-1 to detect which fields changed:
```typescript
// If only IterationPath changed AND changed by automation account → Non-substantive
// If Description changed → Substantive
// If Title changed → Substantive
// If State changed → Substantive (unless automated bulk transition)
```

## Usage

### Basic Usage
```javascript
wit-get-last-substantive-change({
  WorkItemId: 12476027
})
```

### With Custom Automation Patterns
```javascript
wit-get-last-substantive-change({
  WorkItemId: 12476027,
  AutomatedPatterns: ["Bot User", "Migration Script"],
  HistoryCount: 100  // Analyze more revisions if needed
})
```

### In Backlog Hygiene Workflow
```javascript
// Step 1: Query for candidates
const candidates = await wit-get-work-items-by-query-wiql({
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'..."
});

// Step 2: Batch get basic info
const items = await wit-get-work-items-context-batch({
  WorkItemIds: candidates.ids.slice(0, 50)
});

// Step 3: Analyze staleness efficiently
for (const item of items) {
  const staleness = await wit-get-last-substantive-change({
    WorkItemId: item.id
  });
  
  if (staleness.daysInactive > 180) {
    // Mark as dead candidate
  }
}
```

## Benefits

### Context Window Savings
- **Before:** 69 items × 3KB each = 207KB context consumed
- **After:** 69 items × 0.3KB each = 21KB context consumed
- **Savings:** 90% reduction, freeing up space for analysis and reasoning

### Performance
- Server-side processing: Fast C# code vs. AI token processing
- Parallelizable: Can analyze multiple items without context bloat
- Consistent: Same algorithm applied to all items

### Accuracy
- Reliable field change detection
- Configurable automation patterns
- Handles edge cases (no history, all automated, etc.)

### Scalability
- Can analyze 100+ item backlogs without timeout
- No context window limits
- Suitable for large-scale hygiene operations

## Return Value Fields

| Field | Type | Description |
|-------|------|-------------|
| `workItemId` | number | The work item ID analyzed |
| `lastSubstantiveChange` | string \| null | ISO date of last meaningful change (null if no history) |
| `daysInactive` | number \| null | Days since last substantive change |
| `lastChangeType` | string | Description of what changed (e.g., "Description, Priority") |
| `automatedChangesSkipped` | number | Count of automated revisions ignored |
| `allChangesWereAutomated` | boolean | True if NO substantive changes found (item untouched since creation) |
| `createdDate` | string | ISO date when work item was created |
| `daysSinceCreation` | number | Days since creation |

## Edge Cases Handled

### All Changes Were Automated
```json
{
  "workItemId": 12476027,
  "lastSubstantiveChange": "2020-01-01T08:00:00Z",  // Falls back to creation date
  "daysInactive": 1735,
  "lastChangeType": "No substantive changes since creation",
  "automatedChangesSkipped": 47,
  "allChangesWereAutomated": true,
  "createdDate": "2020-01-01T08:00:00Z",
  "daysSinceCreation": 1735
}
```

### No Revision History
```json
{
  "workItemId": 999,
  "lastSubstantiveChange": null,
  "daysInactive": null,
  "lastChangeType": "No history",
  "automatedChangesSkipped": 0,
  "allChangesWereAutomated": false,
  "createdDate": "2025-09-01T10:00:00Z",
  "daysSinceCreation": 30
}
```

### Mixed Automated and Substantive
```json
{
  "workItemId": 5816697,
  "lastSubstantiveChange": "2021-05-20T14:30:00Z",
  "daysInactive": 1230,
  "lastChangeType": "AssignedTo",
  "automatedChangesSkipped": 12,  // 12 iteration path updates after last real change
  "allChangesWereAutomated": false,
  "createdDate": "2019-08-15T09:00:00Z",
  "daysSinceCreation": 2238
}
```

## Integration with find_dead_items Prompt

The prompt now instructs the AI to:
1. Use WIQL query to get candidate IDs
2. Use batch context retrieval for initial triage
3. **Use `wit-get-last-substantive-change` for items needing staleness analysis**
4. Generate report with accurate "DaysInactive" based on substantive changes

## Future Enhancements

1. **Batch Mode:** Analyze multiple work items in one call
2. **Caching:** Cache results for frequently analyzed items
3. **Custom Field Rules:** Allow configuration of which fields are considered substantive
4. **Change Patterns:** Detect and report common patterns (e.g., "all changes were iteration path updates")
5. **Comparison Mode:** Compare staleness across area paths or teams

## Technical Details

### Implementation
- **File:** `mcp_server/src/services/handlers/get-last-substantive-change.handler.ts`
- **Schema:** `mcp_server/src/config/schemas.ts` (`getLastSubstantiveChangeSchema`)
- **Tool Config:** `mcp_server/src/config/tool-configs.ts`
- **Integration:** `mcp_server/src/services/tool-service.ts`

### Dependencies
- Azure DevOps REST API (revisions endpoint)
- Field comparison logic
- Date calculation utilities

### Error Handling
- Graceful fallback to creation date if history unavailable
- Logs warnings for API failures
- Returns partial results when possible

## Version History
- **v1.0 (Oct 2025):** Initial implementation with automated change filtering
