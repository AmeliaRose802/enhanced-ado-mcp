# Automated Change Filtering for Backlog Hygiene

## Overview
Updated the backlog hygiene prompt (`find_dead_items.md`) to properly filter out automated changes when determining work item staleness.

## Problem Statement
The backlog hygiene report was incorrectly calculating "days inactive" by including automated changes such as:
- Bulk iteration path updates (sprint migrations)
- Automated area path changes
- System-generated field updates

**Example:** Work item 12476027 showed as changed 176 days ago, but the actual last substantive change was in 2021. The recent changes were all iteration path alignment updates (sprint migrations). These are ignored even if performed by a real user account.

## Solution

### 1. Enhanced Revision History Data (Handler Update)
**File:** `mcp_server/src/services/handlers/get-work-item-context-package.handler.ts`

Added additional fields to revision history capture:
```typescript
history = (hRes.value || []).map((r: any) => ({
  id: r.id,
  rev: r.rev,
  changedDate: r.fields?.['System.ChangedDate'],
  changedBy: r.fields?.['System.ChangedBy']?.displayName || r.fields?.['System.ChangedBy'],
  state: r.fields?.['System.State'],
  title: r.fields?.['System.Title'],
  iterationPath: r.fields?.['System.IterationPath'],      // NEW
  areaPath: r.fields?.['System.AreaPath'],                // NEW
  assignedTo: r.fields?.['System.AssignedTo']?.displayName || r.fields?.['System.AssignedTo']?.uniqueName,  // NEW
  description: r.fields?.['System.Description'] ? ... : undefined  // NEW (truncated)
}));
```

**Why:** This allows the AI to compare revisions and detect what fields actually changed.

### 2. Updated Prompt Instructions (find_dead_items.md v3)
**File:** `mcp_server/prompts/find_dead_items.md`

#### Key Changes:

**Added Filtering Guidance:**
```markdown
**Critical: Filter Automated Changes:** When determining the last meaningful change date, 
**ignore automated system changes** such as:
- Iteration Path updates (often bulk automated sprint migrations by specific users)
- Area Path bulk updates
- Automated field updates by system accounts
- Mass state transitions by automation
```

**Optimized Process with Batch Retrieval:**
1. Query for stale candidates using WIQL (returns IDs only)
2. **NEW:** Use `wit-get-work-items-context-batch` to retrieve up to 50 items at once for initial triage
3. **NEW:** Perform initial classification using batch data (age, state, description, assignee)
4. **NEW:** Only fetch detailed history for borderline cases that need deeper analysis
5. Calculate staleness based on substantive changes, not raw `System.ChangedDate`

**Why Batch Mode:**
- **Performance:** Retrieve 50 items in one API call instead of 50 individual calls
- **Efficiency:** Reduces API throttling and execution time
- **Smart:** Only deep-dive into history for items that need it (borderline cases)
- **Scalability:** Can analyze large backlogs (100+ items) without timeout issues

**Substantive vs Non-Substantive Changes:**
- ✅ **Substantive:** Description edits, comments, manual state changes, assignee updates, priority changes, title edits, acceptance criteria
- ❌ **Non-Substantive:** Iteration path changes, area path changes, automated bulk updates

**Added Example:**
```
Revisions for Item 12476027:
- Rev 5 (Apr 8, 2025) - Iteration Path only change - IGNORE
- Rev 4 (Oct 9, 2024) - Iteration Path only change - IGNORE
- Rev 2 (May 15, 2021) - Description updated - USE THIS (last substantive change)
Result: DaysInactive = days since May 15, 2021, not Apr 8, 2025
```

**Updated Output Schema:**
Added `LastSubstantiveChange` and `CreatedBy` columns to report tables to show when real work last occurred and who originally created the item (helpful for understanding item ownership and context).

**Organized by Work Item Type:**
Reports now group items by type (Tasks, Features, Bugs, Epics, etc.) in separate sections with counts, making it easier to:
- Identify patterns by work item type
- Prioritize cleanup by type (e.g., clean up stale Tasks first)
- See type-specific staleness trends
- Get accurate counts per category and type

## Impact

### Before:
- Many items appeared active due to automated sprint migrations
- False negatives: Truly stale items missed in hygiene reports
- Inaccurate days inactive calculations

### After:
- Accurate detection of genuinely abandoned work items
- True staleness measurement based on meaningful changes
- Better signal-to-noise ratio in hygiene reports
- More actionable recommendations for cleanup

## Testing Recommendations

1. **Verify with Known Cases:**
   - Test with item 12476027 (has automated iteration path changes)
   - Confirm it's correctly identified as stale since 2021, not 2025

2. **Edge Cases:**
   - Items with ONLY automated changes (should be flagged)
   - Items with recent manual changes after automated ones (should be healthy)
   - Items with mixed automated/manual changes (should use last manual change)

3. **Performance:**
   - Monitor API call volume (now fetching history for each item)
   - Consider batching or caching if analyzing large backlogs (100+ items)

## Future Enhancements

1. **Configurable Automation Patterns:**
   - Allow configuration of known automation accounts/patterns
   - Team-specific automation detection rules

2. **Field Change Detection:**
   - Implement diff logic to explicitly compare rev N vs rev N-1
   - More precise detection of which fields changed

3. **Optimization:**
   - Only fetch history for items near staleness threshold
   - Cache results for repeated analysis

4. **Audit Trail:**
   - Log which changes were classified as automated vs substantive
   - Help teams validate the filtering logic

5. **Bulk Removal Operations:**
   - Support batch processing of approved removals
   - Parallel execution with rate limiting
   - Rollback capability for accidental removals

## Automated Removal Workflow

When users approve the removal plan, the prompt now includes instructions for:

1. **Adding Audit Comments:** Before any state change, a detailed comment is added explaining:
   - Why the item is being removed
   - Analysis details (days inactive, last change, creator)
   - How to recover if removed in error

2. **State Transition:** Item is moved to "Removed" state (or "Closed" if Removed isn't available)

3. **Safety Checks:**
   - Never remove active items without extra confirmation
   - Never remove recently modified items (< 30 days)
   - Always preserve full audit trail

4. **Tools Used:**
   - `mcp_ado_wit_add_work_item_comment` - Add audit comment
   - `mcp_ado_wit_update_work_item` - Change state to Removed

**Example User Interaction:**
```
User: "Please remove items 5816697, 12476027, and 13438317"

Bot: 
✅ Work Item 5816697: Added audit comment and moved to Removed state
✅ Work Item 12476027: Added audit comment and moved to Removed state  
✅ Work Item 13438317: Added audit comment and moved to Removed state

All items have been removed with full audit trail. View them in ADO for recovery if needed.
```

## Version History
- **v3 (Oct 2025):** Added automated change filtering with revision history analysis, CreatedBy column, and user-approved removal workflow with audit trail
- **v2:** Added WIQL query support and exclude Done/Completed states
- **v1:** Initial implementation using System.ChangedDate only
