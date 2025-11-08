---
name: security_items_analyzer
description: Analyze security and compliance items using query handle aggregation for efficient context window management. Identifies AI-suitable work without fetching verbose fields.
version: 7
arguments:
  - name: area_path
    description: "Area path to analyze (auto-filled from configuration)"
    required: false
  - name: max_items
    description: "Maximum number of security items to analyze"
    required: false
    default: 50
changelog:
  - version: 7
    date: 2025-11-07
    changes: "MAJOR REFACTOR: Use query handle aggregation instead of verbose field fetching. Reduces token usage by 67% while providing better AI intelligence analysis."
  - version: 6
    changes: "Enhanced staleness analysis and query handle support"
---

Analyze security and compliance work items in area path `{{area_path}}`. **Exclude Done/Completed/Closed/Resolved states.**

**Optimization Strategy**: This prompt uses query handle aggregation to analyze security items efficiently, fetching full details only for high-value items identified through AI intelligence analysis.

## Context Efficiency Guidelines

**🎯 Key Principle: Aggregate First, Fetch Details Selectively**

This prompt is designed to analyze security items **without fetching verbose fields** for every item:

1. **Query Handle Pattern**: Get item IDs and staleness data (~200 tokens)
2. **Aggregation Analysis**: Use `wit-analyze-by-query-handle` to get AI scores and categorization (~500 tokens)
3. **Selective Fetching**: Only get full details for high-value items identified in step 2

**Traditional Approach (INEFFICIENT):**
- Fetch all items with description, tags, state, priority: ~500 tokens × 50 items = **25,000 tokens**
- Manually categorize and score each item
- High context window usage

**Query Handle Approach (EFFICIENT):**
- Query handle + aggregation: ~700 tokens total
- Fetch details for top 10-15 items only: ~500 tokens × 15 = **7,500 tokens**
- **Total: ~8,200 tokens (67% reduction)**

## Efficiency Guidelines

**⚡ Execute operations in parallel whenever possible:**
- Query discovery AND current active work simultaneously
- Run `wit-query-handle-info` and `wit-analyze-by-query-handle` in parallel
- Fetch context packages for different item categories in parallel
- Extract security links concurrently for sampled items

**🤖 Consider sub-agents for heavy operations:**
- When analyzing >50 security items, delegate deep analysis to sub-agent
- For vulnerability remediation planning requiring documentation lookup, use sub-agent
- Sub-agents useful for extracting and processing security links across many items

## Tools

**Discovery & Aggregation (Prefer These):**
- `wit-wiql-query` - ⭐ Query security items with staleness data and query handles
- `wit-query-handle-info` - ⭐ Verify query handle, get statistics and preview (use `includeExamples: false` to save tokens)
- `wit-analyze-by-query-handle` - ⭐ **PRIMARY TOOL** - AI intelligence analysis on entire query handle
- `wit-extract-security-links` - Extract documentation links from sampled items

**Targeted Context Fetching (Use Sparingly):**
- `wit-get-context-packages-by-query-handle` - Batch details for specific items (max 20-25 items)
- `wit-get-context-packages` - Individual item details (use after identifying high-value items)

**Work Item Management:**
- `wit-create-new-item` - Create work items
- `wit-assign-to-copilot` - Assign existing item to Copilot

**Bulk Operations:**
- `wit-unified-bulk-operations-by-query-handle` - Unified bulk operations tool
  - `action: "comment"` - Add templated comments to security items
  - `action: "update"` - Update multiple security items
  - `action: "assign"` - Assign multiple security items
  - `action: "ai-enhance"` - Bulk enhance descriptions (preview with dryRun)

## Workflow

### 1. Enhanced Discovery with Query Handle
Find security items using WIQL with staleness data and query handle:
```
Tool: wit-wiql-query
Arguments: {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND ([System.Tags] CONTAINS 'security' OR [System.Title] CONTAINS 'security' OR [System.Description] CONTAINS 'vulnerability') AND [System.State] NOT IN ('Closed', 'Done', 'Completed', 'Resolved', 'Removed') ORDER BY [System.ChangedDate] DESC",
  includeFields: ["System.Id"],
  includeSubstantiveChange: true,
  returnQueryHandle: true,
  maxResults: {{max_items}}
}
```

**Note**: The `{{area_path}}` variable will be filled with the configured area path at runtime. The prompt service automatically handles backslash escaping for WIQL queries, so you can use `{{area_path}}` directly in WIQL strings.

This returns a query handle for aggregation and bulk operations.

### 2. Analyze Query Handle for Statistics
```
Tool: wit-query-handle-info
Arguments: {
  queryHandle: "qh_from_step_1",
  includePreview: true,
  includeStats: true,
  includeExamples: false
}
```

This provides:
- **Item count** - Total security items found
- **Staleness statistics** - How many items haven't been updated in >30, >90, >180 days
- **Preview** - Sample of 5 items with title/state/tags for quick assessment

**Cost:** ~200 tokens (vs ~5000+ tokens for full item details)

### 3. Strategic Context Fetching (Only When Needed)
**Option A: Small Dataset (<25 items)**
```
Tool: wit-get-context-packages-by-query-handle
Arguments: {
  queryHandle: "qh_from_step_1",
  itemSelector: "all",
  includeFields: ["System.Title", "System.State", "System.Tags", "System.Description", "Microsoft.VSTS.Common.Priority"]
}
```

**Option B: Large Dataset (>25 items) - Use Sampling**
```
Tool: wit-get-context-packages-by-query-handle
Arguments: {
  queryHandle: "qh_from_step_1",
  itemSelector: "sample",
  sampleSize: 20,
  includeFields: ["System.Title", "System.State", "System.Tags", "System.Description", "Microsoft.VSTS.Common.Priority"]
}
```

**Option C: Targeted Analysis - Fetch Specific Categories**
Use `wit-query-handle-info` preview to identify high-value items, then:
```
Tool: wit-get-context-packages
Arguments: {
  workItemIds: [12345, 12346, 12347],
  includeFields: ["System.Title", "System.State", "System.Tags", "System.Description", "Microsoft.VSTS.Common.Priority"]
}
```

Use `wit-extract-security-links` on sampled items to get documentation URLs.

### 4. Categorization & AI Analysis (Using Query Handles)

**Efficient Approach: Let the tools do the heavy lifting**

Instead of manually categorizing every item, use aggregation tools:

```
Tool: wit-analyze-by-query-handle
Arguments: {
  queryHandle: "qh_from_step_1",
  analysisType: ["ai_intelligence"]
}
```

This returns:
- **AI readiness scores** for all items (no manual scoring needed)
- **Quality metrics** (description completeness, clarity, testability)
- **Automatic categorization** based on content analysis
- **Duplicate detection** via similarity analysis

**Cost:** ~500 tokens for full analysis (vs 10,000+ tokens for manual review)

### 5. Targeted Deep Dive (Only for High-Value Items)

Based on AI intelligence analysis, fetch detailed context for:
- **Critical severity** items with high AI readiness
- **Items with missing descriptions** (needs enhancement)
- **Potential duplicates** (needs consolidation)

Use `wit-get-context-packages` for specific IDs identified in Step 4.

### 6. Bulk Enhancement (Optional)

For items flagged as "missing description" or "low quality":

```
Tool: wit-unified-bulk-operations-by-query-handle
Arguments: {
  queryHandle: "qh_from_step_1",
  action: "ai-enhance",
  itemSelector: "filter",
  filterCriteria: {
    aiReadinessScore: { max: 5 }
  },
  dryRun: true
}
```

Preview enhancements before applying.

### 7. Action Planning (Template-Based)

For AI-suitable items, create Copilot-ready descriptions:
```
## Objective
[Security control being implemented]

## Implementation Steps
1. [Specific action with file paths]
2. [Configuration changes with exact values]
3. [Testing and verification]

## Acceptance Criteria
- [ ] [Measurable outcome]
- [ ] [Verification method]
- [ ] [Documentation updated]

## Resources
- [Documentation links]
- [Examples]
```

---

## Output Format

### Executive Summary (From Query Handle Analysis)

Based on `wit-query-handle-info` and `wit-analyze-by-query-handle`:

- **Total Security Items**: [count] from query handle
- **Staleness**:
  - Not updated in 30+ days: [count]
  - Not updated in 90+ days: [count]
  - Not updated in 180+ days: [count]
- **AI Analysis** (from aggregation):
  - AI-suitable: [count] ([percentage]%)
  - High AI readiness (score >7): [count]
  - Needs enhancement (score <5): [count]
- **Duplicate clusters detected**: [count] groups

### Security Domain Breakdown (From AI Intelligence)

Automatic categorization from `wit-analyze-by-query-handle`:

| Category | Count | Avg AI Score | Critical | Stale (90d+) |
|----------|-------|--------------|----------|--------------|
| [Auto-detected] | [N] | [X.X] | [N] | [N] |

### Top Priority Items for Action

**High-Value, AI-Ready Items** (Score >7, Critical/High Priority):

List 5-10 items with:
- **ID & Title** (from context packages)
- **AI Readiness Score** (from aggregation)
- **Staleness** (days since last update)
- **Recommended Action** (assign to Copilot / enhance description / review)

### Items Needing Enhancement

**Low AI Readiness** (Score <5, from aggregation):

- [ID]: [Title] - Missing: [description/acceptance criteria/etc]
- Suggested bulk enhancement query handle available

### Recommended Next Steps

1. **Assign to Copilot** - [count] items ready (use query handle for bulk assignment)
2. **Bulk Enhancement** - [count] items need better descriptions (preview enhancement available)
3. **Manual Review** - [count] items flagged for human attention
4. **Duplicate Resolution** - [count] clusters found (link related items)
5. **Documentation** - Extract security links from [count] items for reference
