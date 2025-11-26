---
name: identify_ai_assignable_items
version: 1.0.0
description: >-
  AI-powered workflow to identify and categorize work items by AI assignment suitability.
  Analyzes work items from WIQL queries or area paths, categorizes them into AI_FIT, NEEDS_REFINEMENT,
  HYBRID, and HUMAN_FIT groups, and provides query handles for each category for bulk operations.
---

# Identify AI-Assignable Items Workflow

## Automatic Workflow

This prompt automatically queries for New and Committed unassigned Product Backlog Items using defaults from config, analyzes them for AI suitability, and presents categorized results with query handles for bulk operations.

**Default Query (automatically constructed):**
```
SELECT [System.Id]
FROM WorkItems 
WHERE [System.WorkItemType] = 'Product Backlog Item' 
AND [System.State] IN ('New', 'Committed')
AND [System.AssignedTo] = '' 
AND [System.AreaPath] UNDER '{{area_path}}'
ORDER BY [Microsoft.VSTS.Common.Priority] ASC
```

## Analyze & Present Results

**Tool: analyze-bulk**
```json
{
  "queryHandle": "qh_abc123",
  "analysisType": ["assignment-suitability"],
  "outputFormat": "detailed"
}
```

**Returns categorization with query handles:**
- `ai_fit.query_handle` - Ready for AI
- `needs_refinement.query_handle` - Needs enhancement
- `hybrid.query_handle` - AI draft + human review
- `human_fit.query_handle` - Human expertise required

**Present as table (show top 3-5 per category):**

```markdown
✅ AI Suitability Analysis Complete - 80 work items

| Category | Count | Query Handle | % |
|----------|-------|--------------|---|
| 🤖 AI FIT | 45 | `qh_ai_fit` | 56% |
| ⚠️ NEEDS REFINEMENT | 12 | `qh_needs_ref` | 15% |
| 🔄 HYBRID | 8 | `qh_hybrid` | 10% |
| 👤 HUMAN FIT | 15 | `qh_human_fit` | 19% |

Top AI FIT Items:
- [#12345](url) Implement login API (0.92 confidence)
- [#12346](url) Add input validation (0.88 confidence)
- [#12347](url) Update dependencies (0.85 confidence)
```

## Actions

### 1. Bulk Assign AI FIT to Copilot

```json
{
  "queryHandle": "qh_ai_fit",
  "actions": [
    {"type": "assign", "assignedTo": "GitHub Copilot <{guid}>"},
    {"type": "comment", "comment": "🤖 AI Assignment - Analysis: AI_FIT, Confidence: {avg}"},
    {"type": "add-tag", "tag": "AI-Assigned"}
  ]
}
```

### 2. Enhance NEEDS REFINEMENT

```json
{
  "queryHandle": "qh_needs_ref",
  "actions": [
    {"type": "enhance-descriptions", "style": "technical"},
    {"type": "add-acceptance-criteria", "format": "gherkin"},
    {"type": "add-tag", "tag": "AI-Enhanced"}
  ]
}
```

Then re-query and re-analyze to find newly AI-ready items.

### 3. Process HYBRID Items

```json
{
  "queryHandle": "qh_hybrid",
  "actions": [
    {"type": "assign", "assignedTo": "GitHub Copilot <{guid}>"},
    {"type": "comment", "comment": "🔄 HYBRID - AI draft + expert review required"},
    {"type": "add-tag", "tag": "AI-Assisted"},
    {"type": "add-tag", "tag": "Requires-Review"}
  ]
}
```

## Tool Reference

**Query Work Items:**
```json
Tool: query-wiql
{"wiqlQuery": "...", "returnQueryHandle": true}
```

**Analyze Suitability:**
```json
Tool: analyze-bulk
{"queryHandle": "qh_abc", "analysisType": ["assignment-suitability"]}
```

**Bulk Operations:**
```json
Tool: execute-bulk-operations
{"queryHandle": "qh_abc", "actions": [...]}
```

**Inspect Handle:**
```json
Tool: inspect-handle
{"queryHandle": "qh_abc"}
```

**Get Config:**
```json
Tool: get-config
{"section": "azureDevOps"}
```

## Error Handling

**No Items Found:**
```
❌ No work items found. Verify area path, iteration, and filter criteria.
```

**Analysis Failed:**
```
⚠️ Analysis failed for 5/80 items. Partial results available. Continue? (yes/no)
```

**Bulk Operation Errors:**
```
⚠️ 42/45 succeeded, 3 failed (locked/permissions). Retry failed items? (yes/no)
```

**No AI-Suitable Items:**
```
ℹ️ 0 AI FIT, 50 NEEDS REFINEMENT (83%). 
Recommendation: Enhance NEEDS REFINEMENT items first.
```

## Example Workflow

```
User: "Identify AI-assignable items"

AI: [Automatically builds and executes query using {{area_path}} from config]
    Found 45 New/Committed unassigned PBIs. Analyzing for AI suitability...
    [Calls analyze-bulk with assignment-suitability]
    
    ✅ Analysis Complete
    
    | Category | Count | Handle |
    |----------|-------|--------|
    | AI FIT | 28 | qh_ai_fit_pbi |
    | NEEDS REFINEMENT | 8 | qh_needs_ref_pbi |
    | HYBRID | 5 | qh_hybrid_pbi |
    | HUMAN FIT | 4 | qh_human_fit_pbi |
    
    Assign 28 AI-ready PBIs to Copilot? (yes/no)

User: "yes"

AI: [Gets Copilot GUID from config]
    [Executes bulk-operations: assign, comment, tag]
    
    ✅ 28 PBIs assigned to GitHub Copilot
    ✓ Tagged "AI-Assigned"
    ✓ Comments added
    
    Estimated capacity freed: ~112 story points
    
    Enhance the 8 NEEDS REFINEMENT items? (yes/no)

User: "yes"

AI: [Executes bulk enhance-descriptions & add-acceptance-criteria]
    [Re-queries enhanced items]
    [Re-analyzes]
    
    ✅ Enhancement Complete
    Before: 8 NEEDS REFINEMENT, 0 AI FIT
    After: 7 AI FIT (88% success!), 1 NEEDS REFINEMENT
    
    Assign 7 newly AI-ready items to Copilot? (yes/no)
```

## Best Practices

1. **Always use query handles** - Never manually list IDs
2. **Start broad** - Analyze large sets, drill down to categories
3. **Enhance before assigning** - NEEDS REFINEMENT items benefit from AI enhancement
4. **Tag items** - "AI-Assigned", "AI-Enhanced", "Requires-Review"
5. **Monitor success** - Track Copilot assignments to refine criteria
6. **Iterative refinement** - Re-analyze as work item quality improves
7. **Category workflows:**
   - AI FIT → Immediate assignment
   - NEEDS REFINEMENT → Enhance → Re-analyze → Assign
   - HYBRID → Assign with review workflow
   - HUMAN FIT → Keep human-assigned

## Efficiency

- **Parallel operations:** Get config + list agents simultaneously
- **Query handles:** Prevent ID hallucination, cached & reusable
- **Concise summaries:** Show top 5-10 items, expand on request
- **Bulk analysis:** Process up to 200 items in one call
