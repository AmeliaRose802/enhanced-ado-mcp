# Tool Limitations and Constraints Guide

**URI:** `ado://docs/tool-limitations`

## Overview

This guide documents important limitations, constraints, and restrictions across all Enhanced ADO MCP Server tools to help AI agents understand what operations are possible and when to avoid certain approaches.

## 🔍 Query Limitations

### WIQL (Work Item Query Language)

**What WIQL Can Do:**
- ✅ Real-time work item queries
- ✅ Hierarchical queries with `UNDER` operator
- ✅ Access to StoryPoints and all custom fields
- ✅ Stale work item detection
- ✅ Parent-child relationship queries

**What WIQL Cannot Do:**
- ❌ Historical metrics and trends (use OData instead)
- ❌ Aggregations (COUNT, SUM, AVG) - limited support
- ❌ Cross-project queries (single project only)
- ❌ Date arithmetic beyond simple comparisons
- ❌ Complex joins or subqueries

**Known Limitations:**
- **Max Results:** 1000 items per page (use pagination with `skip` and `top`)
- **Default Results:** 200 items (configure with `maxResults`)
- **ORDER BY with WorkItemLinks:** Not supported - use WorkItems query type instead
- **Complex Queries:** May timeout - add filters to narrow results
- **Field Names:** Must use exact reference names (e.g., `[System.Title]` not `Title`)

**Performance Impact:**
- Simple queries: ~500ms
- Complex hierarchical queries: 2-5 seconds
- Queries with 1000+ results: 5-10 seconds

**Workarounds:**
```json
// ❌ Bad: Large query with ORDER BY on StoryPoints may timeout
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [Microsoft.VSTS.Scheduling.StoryPoints] DESC"
}

// ✅ Good: Sort client-side after fetching
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  "maxResults": 500
}
// Then sort the results in your code
```

### OData Analytics Queries

**What OData Can Do:**
- ✅ Historical metrics and velocity trends
- ✅ Aggregations (COUNT, SUM, AVG)
- ✅ Completion counts and date-based analytics
- ✅ Team velocity over time
- ✅ Work distribution by assignee

**What OData Cannot Do:**
- ❌ StoryPoints aggregation (ADO API limitation)
- ❌ Real-time state queries (5-15 minute data delay)
- ❌ Reliable date arithmetic for cycle time
- ❌ `contains()` operator in custom filter queries (only `eq`, `ne`, `gt`, `lt`)
- ❌ Access to work item descriptions or comments
- ❌ Hierarchical `UNDER` operator

**Known Limitations:**
- **Data Delay:** 5-15 minutes behind real-time
- **Analytics Must Be Enabled:** Project must have Analytics enabled
- **Area Path Filtering:** Use exact match only: `{"Area/AreaPath": "exact\\path"}` (no contains)
- **Field Access:** Limited to Analytics schema fields only

**When to Use OData:**
- Historical analysis and trends
- Counting items by state/type/assignee
- Velocity and completion metrics
- Time-based aggregations

**When NOT to Use OData:**
- Real-time work item state needed
- StoryPoints aggregation required (use WIQL with query handles)
- Cycle time calculations (use WIQL with substantive change data)
- Finding unassigned items (use WIQL)

**Workarounds:**
```json
// ❌ Bad: OData cannot aggregate StoryPoints
{
  "queryType": "storyPointsSum"  // Does not exist
}

// ✅ Good: Use WIQL with query handle for StoryPoints
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  "includeFields": ["Microsoft.VSTS.Scheduling.StoryPoints"],
  "returnQueryHandle": true
}
// Then calculate sum in your code or use wit-analyze-by-query-handle
```

### Query Handle Pattern

**Capabilities:**
- ✅ Eliminates ID hallucination in bulk operations
- ✅ Supports item selection (all, indices, criteria)
- ✅ Safe for bulk updates, assigns, removes, comments
- ✅ Preview operations before execution

**Limitations:**
- **Expiration:** Query handles expire after **1 hour** (not configurable)
- **Scope:** Single query result set per handle
- **Storage:** In-memory only (lost on server restart)
- **No Persistence:** Cannot save handles across sessions
- **Max Items:** Inherits WIQL limit (1000 items per query page)

**Expiration Handling:**
```json
// Query handle created at 14:00, expires at 15:00
// ❌ At 15:01, handle is expired
{
  "queryHandle": "qh_expired123",
  "itemSelector": "all"
}
// Error: "Query handle not found or expired"

// ✅ Re-run the query to get a fresh handle
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE ...",
  "returnQueryHandle": true
}
```

**Best Practices:**
- Complete bulk operations within 1 hour window
- For long-running workflows, re-query to refresh handle
- Don't store handles for later use - they will expire
- Use `dryRun: true` first to preview changes

## 🤖 AI-Powered Tool Limitations

### AI Query Generation (WIQL & OData)

**Capabilities:**
- ✅ Natural language to WIQL/OData conversion
- ✅ Iterative validation and refinement (up to 5 iterations)
- ✅ Automatic field name correction
- ✅ Query testing with sample results

**Limitations:**
- **Max Iterations:** 5 attempts per request (prevents infinite loops)
- **Query Complexity:** Limited by AI model capabilities
- **Custom Fields:** May require explicit reference names
- **Validation Requires Access:** Must have Azure DevOps access to test queries
- **Context Window:** Very complex queries may exceed token limits
- **Accuracy:** ~85-95% success rate for well-described queries

**When AI Generation Fails:**
- Query description is too vague
- Custom field names not recognized
- Complex multi-condition logic
- Unusual or non-standard query patterns

**Workarounds:**
```json
// ❌ Bad: Vague description
{
  "description": "find items"
}

// ✅ Good: Specific description with details
{
  "description": "all active bugs in Engineering area created in the last 7 days, assigned to any user"
}

// ✅ Better: Include custom field reference names
{
  "description": "features with CustomField.[Custom.RiskLevel] = High in current sprint"
}
```

### Bulk AI Enhancement Tools

**Capabilities:**
- ✅ AI-enhanced descriptions (detailed, concise, technical, business styles)
- ✅ Story point estimation (fibonacci, linear, t-shirt scales)
- ✅ Acceptance criteria generation (gherkin, checklist, user-story formats)
- ✅ Confidence scoring for quality assessment

**Limitations:**
- **Max Batch Size:** 100 items per call (prevents timeouts)
- **Recommended Size:** 10-50 items for optimal performance
- **Processing Time:** 2-5 seconds per item (100 items ≈ 5-8 minutes)
- **Auto-Skip Completed:** Items in Done/Completed/Closed/Resolved/Removed states are skipped
- **Context Required:** Low confidence (<0.5) if work item lacks sufficient context
- **VS Code Required:** Requires VS Code Language Model API access
- **Rate Limits:** Subject to VS Code/Azure OpenAI rate limits

**Performance Guidelines:**
- Start with `sampleSize: 10` and increase gradually
- Process large batches in multiple smaller calls
- Query handle TTL (1 hour) limits total processing window
- Use mini models (gpt-4o-mini) for speed and cost

**Context Insufficiency:**
```json
// ❌ Results in low confidence
Work Item: Title only, no description, no comments
AI Response: { "confidence": 0.3, "reason": "Insufficient context" }

// ✅ Better results with context
Work Item: Title + Description + Comments + Related items
AI Response: { "confidence": 0.85, "description": "..." }
```

### AI Analysis Tools (Suitability, Readiness, etc.)

**Capabilities:**
- ✅ AI assignment suitability analysis
- ✅ Work item completeness assessment
- ✅ Enhancement suggestions
- ✅ Hierarchy validation

**Limitations:**
- **Accuracy:** ~80-90% (AI-powered analysis is probabilistic)
- **Context Window:** Very large work items may be truncated
- **Rate Limits:** Subject to VS Code Language Model API rate limits
- **VS Code Required:** Must run in VS Code with language model access
- **No Guarantees:** Recommendations should be reviewed by humans

## 🌐 Azure DevOps API Limitations

### Authentication

**Requirements:**
- ✅ Azure CLI must be installed
- ✅ Must be logged in: `az login`
- ✅ Token refreshed automatically on expiration

**Limitations:**
- **Token Expiration:** Tokens expire periodically (auto-refreshed)
- **No API Key Support:** Only Azure CLI authentication (no PAT tokens in config)
- **Single User:** Authentication is per-user (no service accounts)
- **Network Required:** Requires internet connection to Azure

**Authentication Errors:**
```bash
# ❌ Not logged in
Error: "Authentication failed. Run: az login"

# ✅ Fix
az login
```

### Rate Limits

**Azure DevOps API Rate Limits:**
- **Global Limit:** 200 requests per user per minute per organization
- **Burst Limit:** Short bursts up to 300 requests
- **Throttling:** HTTP 429 responses when exceeded
- **Automatic Retry:** Server automatically retries with exponential backoff

**Impact on Tools:**
- Single work item operations: 1-2 API calls
- Batch operations (50 items): 1-3 API calls
- Query + bulk update: 2-4 API calls
- AI query generation: 2-10 API calls (iterative validation)

**Best Practices:**
- Use batch operations when possible
- Avoid rapid sequential single-item calls
- Query handle pattern reduces API calls for bulk ops
- Server handles retries automatically

### Field Restrictions

**What You Can Update:**
- ✅ Standard fields: Title, Description, State, AssignedTo, Priority, Severity
- ✅ Custom fields (if you have permissions)
- ✅ Tags, AreaPath, IterationPath
- ✅ StoryPoints, Effort fields

**What You Cannot Update:**
- ❌ System.Id (read-only)
- ❌ System.Rev (read-only)
- ❌ System.CreatedDate (read-only)
- ❌ System.CreatedBy (read-only)
- ❌ Calculated fields (read-only)
- ❌ Fields you don't have permission to modify

**Update Restrictions:**
- Some fields may require specific state transitions
- Board column changes require valid state
- Parent-child links have type validation
- Custom field types must match (string, integer, date, etc.)

### Work Item Size Limits

**Azure DevOps Limits:**
- **Description:** 32,000 characters max
- **Comment:** 32,000 characters max
- **Title:** 255 characters max
- **History:** No hard limit but large history (>100 revisions) impacts performance
- **Attachments:** 60 MB per file, 500 MB total per work item
- **Relations:** No hard limit but >100 relations impacts performance

**Server Limits:**
- **Batch Operations:** 50 items recommended max per call
- **Context Package History:** Default 10 revisions, configurable up to 100
- **Query Results:** 1000 items per page (WIQL), paginate for more

## 🚫 When to Avoid Certain Tools

### Avoid AI Query Generation When:
- ❌ You already know the exact WIQL/OData syntax
- ❌ Query is simple (single field filter)
- ❌ Custom fields with unusual names (provide manual query)
- ❌ Need deterministic results (AI may vary)

**Use Manual Queries Instead:**
```json
// Simple query - no need for AI
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'"
}
```

### Avoid Bulk Operations When:
- ❌ Operating on a single work item (use direct update tools)
- ❌ Need real-time confirmation per item (use loop with individual calls)
- ❌ Complex conditional logic per item (better handled in code)
- ❌ Query handle expired (re-run query first)

### Avoid OData When:
- ❌ Need real-time work item state
- ❌ Need StoryPoints aggregation
- ❌ Need cycle time calculations
- ❌ Need work item descriptions or comments
- ❌ Analytics not enabled for project

### Avoid WIQL When:
- ❌ Need historical metrics and trends (use OData)
- ❌ Need aggregation counts (use OData)
- ❌ Need velocity analysis over time (use OData)

## ⚡ Performance Constraints

### Operation Performance Benchmarks

**Single Work Item Operations:**
- Get work item: ~500ms
- Update work item: ~800ms
- Add comment: ~600ms
- Create work item: ~1000ms

**Batch Operations:**
- Query 200 items: ~1-2 seconds
- Bulk update 50 items: ~5-10 seconds
- Bulk comment 50 items: ~5-10 seconds
- Bulk remove 50 items: ~5-10 seconds

**AI-Powered Operations:**
- AI query generation: ~3-5 seconds (with validation)
- AI analysis per item: ~2-5 seconds
- Bulk AI enhancement (50 items): ~3-5 minutes
- Bulk AI estimation (50 items): ~3-5 minutes

**Optimization Tips:**
- Use batch operations for multiple items (reduces round trips)
- Cache query results when possible (query handle pattern)
- Process AI operations in smaller batches (10-20 items)
- Use `dryRun: true` to test before executing expensive operations

### Timeout Constraints

**Default Timeouts:**
- HTTP requests: 30 seconds
- AI sampling: 60 seconds per request
- Bulk operations: 5 minutes total

**When Timeouts Occur:**
- Very large queries (1000+ items)
- Complex AI operations on many items
- Network issues or API throttling

**Mitigation:**
- Reduce batch size
- Add query filters to narrow results
- Break work into smaller chunks
- Use `maxResults` to limit query size

## 🔧 Common Workarounds

### Workaround: StoryPoints Analysis with OData Limitation

**Problem:** OData cannot aggregate StoryPoints

**Solution:** Use WIQL with query handle
```json
// Step 1: Query with WIQL
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] = 'Project\\Sprint 10'",
  "includeFields": ["Microsoft.VSTS.Scheduling.StoryPoints", "System.State"],
  "returnQueryHandle": true
}

// Step 2: Use wit-analyze-by-query-handle to analyze
{
  "queryHandle": "qh_abc123...",
  "analysisType": "storyPointsSummary"
}
```

### Workaround: Cycle Time Calculation

**Problem:** OData doesn't support reliable date arithmetic

**Solution:** Use WIQL with substantive change detection
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Done'",
  "includeSubstantiveChange": true,
  "returnQueryHandle": true
}
// Response includes lastSubstantiveChangeDate and daysInactive
// Calculate cycle time in your code
```

### Workaround: Large Query Timeout

**Problem:** Query with ORDER BY on large result set times out

**Solution:** Remove ORDER BY, sort client-side
```json
// ❌ Times out
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'Project' ORDER BY [Microsoft.VSTS.Scheduling.StoryPoints] DESC"
}

// ✅ Works
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'Project'",
  "includeFields": ["Microsoft.VSTS.Scheduling.StoryPoints"]
}
// Sort the work_items array in your code
```

### Workaround: Query Handle Expiration

**Problem:** Query handle expired during long workflow

**Solution:** Re-run query to get fresh handle
```json
// Query handle expired after 1 hour
// ❌ Error: "Query handle not found or expired"

// ✅ Solution: Re-run the original query
{
  "wiqlQuery": "<same query as before>",
  "returnQueryHandle": true
}
// Get new handle, continue workflow
```

### Workaround: Custom Field Not Recognized by AI

**Problem:** AI query generator doesn't recognize custom field

**Solution:** Provide explicit reference name in description
```json
// ❌ Vague
{
  "description": "items with high risk"
}

// ✅ Explicit
{
  "description": "items where Custom.RiskLevel field equals 'High' - use [Custom.RiskLevel] field reference"
}
```

### Workaround: Low AI Confidence Scores

**Problem:** AI enhancement returns low confidence (<0.5)

**Solution:** Improve work item context first
```json
// Step 1: Check work item context
// If description is empty, add minimal context

// Step 2: Use concise enhancement style
{
  "queryHandle": "qh_abc123...",
  "enhancementStyle": "concise",
  "sampleSize": 10
}

// Step 3: Manual review of results
// Manually improve items with very low confidence
```

## 📋 Quick Reference: What Can/Cannot Do

| Operation | WIQL | OData | Query Handle | Bulk Ops | AI Tools |
|-----------|------|-------|--------------|----------|----------|
| Real-time data | ✅ | ❌ (5-15 min delay) | ✅ | ✅ | ✅ |
| Historical trends | ❌ | ✅ | ❌ | ❌ | ❌ |
| StoryPoints sum | ✅ (manual) | ❌ | ✅ | ✅ | ✅ |
| Aggregations | ❌ | ✅ | ❌ | ❌ | ❌ |
| Hierarchical queries | ✅ (UNDER) | ❌ | ✅ | ✅ | ❌ |
| Bulk updates | ❌ | ❌ | ✅ | ✅ | ❌ |
| ID hallucination-free | N/A | N/A | ✅ | ✅ | N/A |
| 1000+ items | ✅ (paginate) | ✅ | ❌ (1000 max) | ❌ (50 rec.) | ❌ (100 max) |
| Expires | N/A | N/A | ✅ (1 hour) | N/A | N/A |
| Requires VS Code | ❌ | ❌ | ❌ | ❌ | ✅ |

## 🎯 Decision Matrix: Which Tool to Use

### "I need to find work items..."
- **By state/type/area** → WIQL query (`wit-get-work-items-by-query-wiql`)
- **Historical trends** → OData query (`wit-query-analytics-odata`)
- **Natural language** → AI query generation (`wit-generate-wiql-query` or `wit-generate-odata-query`)

### "I need to update multiple work items..."
- **Same change to all** → Query handle + bulk update (`wit-bulk-update-by-query-handle`)
- **Different changes per item** → Query handle + AI enhancement (`wit-bulk-enhance-descriptions-by-query-handle`)
- **Conditional updates** → Use item selector with query handle

### "I need metrics/analytics..."
- **Real-time counts** → WIQL query + count items in code
- **Historical velocity** → OData query (`wit-query-analytics-odata`)
- **StoryPoints sum** → WIQL + manual calculation or wit-analyze-by-query-handle

### "I need to analyze work items..."
- **AI suitability** → `wit-analyze-ai-assignment-suitability`
- **Completeness check** → `wit-analyze-work-item-completeness`
- **Bulk analysis** → Query handle + `wit-analyze-by-query-handle`

## 🚨 Critical Limitations Summary

**Always Remember:**
1. **Query handles expire after 1 hour** - complete operations within this window
2. **OData cannot aggregate StoryPoints** - use WIQL instead
3. **OData has 5-15 minute data delay** - use WIQL for real-time
4. **Bulk AI tools require VS Code** - not available in all environments
5. **Max 100 items for AI enhancement** - process in batches
6. **Max 1000 items per WIQL page** - use pagination
7. **Rate limits: 200 req/min/user/org** - server handles retries
8. **ORDER BY not supported with WorkItemLinks** - use WorkItems query type
9. **AI query generation limited to 5 iterations** - provide clear descriptions
10. **Authentication requires Azure CLI login** - run `az login`

## Related Resources

- [Query Handle Pattern](./query-handle-pattern.md) - Safe bulk operations
- [Tool Selection Guide](./tool-selection-guide.md) - Choosing the right tool
- [WIQL Quick Reference](./wiql-quick-reference.md) - WIQL syntax and patterns
- [OData Quick Reference](./odata-quick-reference.md) - OData query patterns
- [Bulk Enhancement Guide](./bulk-intelligent-enhancement-guide.md) - AI-powered enhancements

---

**Last Updated:** 2025-10-07  
**Version:** 1.0.0
