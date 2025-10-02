## Missing tools
### 1. **Bulk Work Item State Transitions**
**Current limitation:** I can only update items one at a time with `mcp_ado_wit_update_work_item`

**Need:** `mcp_ado_wit_bulk_state_transition`
```json
{
  "workItemIds": [16871980, 16872036, 16872037],
  "targetState": "Removed",
  "reason": "Abandoned",
  "addComment": true,
  "commentTemplate": "Automated removal - {reason}",
  "auditMetadata": {
    "automatedBy": "Backlog Hygiene Assistant",
    "analysisDate": "2025-10-01",
    "daysInactive": "{{daysInactive}}"
  }
}
```
**Impact:** Would allow me to process 19 dead items in 1-2 calls instead of 38 calls (comment + state change per item)

### 2. **Enhanced WIQL with Filtering Metadata**
**Current limitation:** WIQL returns all fields but I need to filter/categorize in my own logic

**Need:** Add optional categorization parameters to WIQL:
```json
{
  "WiqlQuery": "...",
  "CategorizeBy": {
    "deadThreshold": 180,
    "atRiskThreshold": 90,
    "excludePatterns": ["^\\[S360\\]", "^Test"],
    "flagPlaceholders": true
  },
  "ReturnCategorized": true
}
```
**Response would include:**
```json
{
  "categorized": {
    "dead": [...],
    "atRisk": [...],
    "healthy": [...]
  },
  "summary": {...}
}
```

### 3. **Pattern Detection Tool**
**Need:** `mcp_ado_wit_detect_patterns`
```json
{
  "workItemIds": [1,2,3,...],
  "detectPatterns": [
    "duplicates",
    "placeholder_titles",
    "stale_automation",
    "orphaned_children",
    "unassigned_committed"
  ]
}
```
**Use case:** Would have immediately identified the 3 duplicate S360 Cognitive Services items

## Critical Missing Inputs to Existing Tools

### 4. **Substantive Change Analysis Needs More Control**
**Current:** `SubstantiveChangeHistoryCount: 50` is good, but needs:

**Add:**
- `ExcludeChangedByPatterns`: `["S360 Azure DevOps Integration", "%Bot%", "System"]`
- `ExcludeFieldChanges`: `["System.IterationPath", "System.AreaPath"]` (bulk sweeps)
- `IncludeChangeTypeBreakdown`: Return what types of changes occurred (state, assignment, description, etc.)

**Example response enhancement:**
```json
{
  "lastSubstantiveChangeDate": "2023-06-20",
  "daysInactive": 469,
  "changeBreakdown": {
    "stateChanges": 2,
    "assignmentChanges": 0,
    "descriptionUpdates": 1,
    "commentCount": 3
  },
  "automatedChangeCount": 15
}
```

### 5. **WIQL Needs Richer Field Selection**
**Current:** `IncludeFields` requires knowing exact field names

**Add:**
- `IncludeFieldSets`: `["core", "assignment", "dates", "custom"]` - predefined useful sets
- `ExcludeHTMLDescriptions`: `true` - for items with massive 1CS descriptions, I don't need the full HTML

### 6. **Context Package Needs "Lite" Mode**
**Current:** `wit-get-work-item-context-package` returns MASSIVE payloads

**Add:** `ResponseMode: "summary" | "full"`
Summary mode would return:
- Title, ID, State, Type, Assignee
- Character count of description (not full text)
- Relationship counts (not full child trees)
- Last 3 comments only

## Workflow Enhancements

### 7. **Pre-flight Validation Tool**
**Need:** `mcp_ado_wit_validate_bulk_action`
```json
{
  "action": "remove",
  "workItemIds": [...],
  "dryRun": true
}
```
**Returns:**
- Which items are already in terminal states (would fail)
- Which items have children that would become orphaned
- Which items have active PRs/commits linked
- Estimated impact

### 8. **Smart Query Builder**
**Need:** `mcp_ado_wit_build_hygiene_query`
```json
{
  "scenario": "find_dead_items",
  "areaPath": "...",
  "options": {
    "minInactiveDays": 180,
    "workItemTypes": ["Task", "Product Backlog Item"],
    "excludeStates": ["Done", "Removed"],
    "includeSubstantiveAnalysis": true
  }
}
```
**Returns:** Optimized WIQL query + recommended field set

This would eliminate the manual WIQL construction I had to do.

## Critical for User Experience

### 9. **Progress Reporting for Bulk Operations**
When I process 19 items, the user has no visibility into progress. Need:
- Streaming responses for bulk operations
- Progress callbacks: "Processing item 5 of 19..."
- Partial success reporting if some items fail

### 10. **Undo/Audit Trail Query**
**Need:** `mcp_ado_wit_get_recent_automated_changes`
```json
{
  "automatedBy": "Backlog Hygiene Assistant",
  "since": "2025-10-01",
  "action": "state_change"
}
```
**Use case:** If user says "undo everything you just did," I need to know what I did

## Data Quality Enhancements

### 11. **Relationship Graph Analyzer**
**Need:** `mcp_ado_wit_analyze_relationships`
```json
{
  "workItemIds": [...],
  "findIssues": [
    "circular_dependencies",
    "orphaned_children",
    "invalid_parent_types",
    "broken_links"
  ]
}
```

### 12. **Assignment History**
**Current:** I see current assignee but not history

**Add to substantive change:** 
- `assignmentHistory`: Who owned this and for how long
- **Use case:** Item assigned 500 days ago to someone who left the team = strong dead signal

## Priority Ranking

**Must Have (would 3x my effectiveness):**
1. Bulk state transitions (#1)
2. Pre-flight validation (#7)
3. Enhanced substantive change with exclusion patterns (#4)

**High Value (would 2x my effectiveness):**
4. Pattern detection (#3)
5. Smart query builder (#8)
6. Lite mode for context package (#6)

**Nice to Have (polish):**
7. All others

## Real-World Example Impact

**This Analysis:**
- Took ~2 API calls to gather data ✅ (excellent!)
- Would take **38+ API calls** to action the 19 dead items ❌
- No validation that I won't accidentally remove items with active dependencies ❌
- No way to undo if user says "wait, not those!" ❌

**With Enhancements:**
- 2 calls to gather ✅
- 1 call to validate (#7)
- 1-2 calls to bulk remove with audit (#1)
- 1 call to undo if needed (#10)

**Total: 5-6 calls instead of 40+**

Would you like me to elaborate on any of these enhancements or provide more specific API schemas?