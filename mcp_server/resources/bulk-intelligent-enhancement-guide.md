# Bulk Intelligent Enhancement Tools - Quick Reference

## Overview

Three AI-powered tools for enhancing work items in bulk using query handles. All tools process items in batches, use AI sampling for intelligent generation, and support dry-run mode for safety.

## Tools

### 1. wit-bulk-enhance-descriptions-by-query-handle
**Purpose**: Generate AI-enhanced descriptions for work items

**Key Parameters**:
- `queryHandle`: Query handle from WIQL query (returnQueryHandle=true)
- `itemSelector`: 'all', indices [0,1,2], or criteria object
- `sampleSize`: Max items to process (default 10, max 100)
- `enhancementStyle`: 'detailed' | 'concise' | 'technical' | 'business'
- `preserveExisting`: Append vs replace (default true)
- `dryRun`: Preview mode (default true)

**Enhancement Styles**:
- **detailed**: Comprehensive explanation with context and implementation notes
- **concise**: Brief, focused description hitting key points
- **technical**: Developer-focused with APIs and technical details
- **business**: Stakeholder-focused with business value and outcomes

**Example**:
```typescript
// First, get items with missing descriptions
const queryResult = await wit-get-work-items-by-query-wiql({
  wiql: "SELECT [System.Id] FROM WorkItems WHERE [System.Description] = ''",
  returnQueryHandle: true
});

// Enhance descriptions (dry run first)
const enhanceResult = await wit-bulk-enhance-descriptions-by-query-handle({
  queryHandle: queryResult.query_handle,
  itemSelector: 'all',
  sampleSize: 20,
  enhancementStyle: 'technical',
  preserveExisting: false,
  dryRun: true  // Review results first
});

// Apply changes
const finalResult = await wit-bulk-enhance-descriptions-by-query-handle({
  queryHandle: queryResult.query_handle,
  // ... same parameters
  dryRun: false  // Actually update
});
```

---

### 2. wit-bulk-assign-story-points-by-query-handle
**Purpose**: AI-powered story point estimation for work items

**Key Parameters**:
- `queryHandle`: Query handle from WIQL query
- `itemSelector`: 'all', indices, or criteria
- `sampleSize`: Max items to process (default 10, max 100)
- `pointScale`: 'fibonacci' | 'linear' | 't-shirt'
- `onlyUnestimated`: Only estimate items without effort (default true)
- `dryRun`: Preview mode (default true)

**Point Scales**:
- **fibonacci**: 1, 2, 3, 5, 8, 13 (recommended for agile teams)
- **linear**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
- **t-shirt**: XS, S, M, L, XL, XXL (stored in tags)

**AI Estimation Factors**:
- Complexity (technical difficulty, unknowns, dependencies)
- Scope (amount of work, files affected)
- Risk (uncertainty, new technology, integration)
- Effort (testing, documentation, review)

**Returns**:
- Story point estimate
- Confidence score (0.0-1.0)
- Complexity assessment
- Reasoning for estimate
- Decomposition suggestion if too large

**Example**:
```typescript
// Get unestimated Product Backlog Items
const queryResult = await wit-get-work-items-by-query-wiql({
  wiql: `SELECT [System.Id] FROM WorkItems 
         WHERE [System.WorkItemType] = 'Product Backlog Item' 
         AND [Microsoft.VSTS.Scheduling.Effort] = ''`,
  returnQueryHandle: true
});

// Estimate using fibonacci scale (dry run)
const estimateResult = await wit-bulk-assign-story-points-by-query-handle({
  queryHandle: queryResult.query_handle,
  itemSelector: 'all',
  pointScale: 'fibonacci',
  onlyUnestimated: true,
  dryRun: true
});

// Review results, then apply
const finalResult = await wit-bulk-assign-story-points-by-query-handle({
  queryHandle: queryResult.query_handle,
  pointScale: 'fibonacci',
  onlyUnestimated: true,
  dryRun: false
});
```

---

### 3. wit-bulk-add-acceptance-criteria-by-query-handle
**Purpose**: Generate testable acceptance criteria for work items

**Key Parameters**:
- `queryHandle`: Query handle from WIQL query
- `itemSelector`: 'all', indices, or criteria
- `sampleSize`: Max items to process (default 10, max 100)
- `criteriaFormat`: 'gherkin' | 'checklist' | 'user-story'
- `minCriteria`: Minimum criteria to generate (default 3)
- `maxCriteria`: Maximum criteria to generate (default 7)
- `preserveExisting`: Append vs replace (default true)
- `dryRun`: Preview mode (default true)

**Criteria Formats**:

**gherkin** (BDD style):
```
Given the user is logged in
When they click the submit button
Then the form should be validated
```

**checklist** (simple bullets):
```
- [ ] Form validates required fields
- [ ] Error messages display correctly
- [ ] Success confirmation appears after submit
```

**user-story** (stakeholder focused):
```
As a customer
I want to see validation errors immediately
So that I can correct my input before submitting
```

**Quality Guidelines**:
- Each criterion is specific and testable
- Covers happy path, edge cases, errors
- Includes performance/security when relevant
- Avoids vague terms like "works well"

**Example**:
```typescript
// Find items missing acceptance criteria
const queryResult = await wit-get-work-items-by-query-wiql({
  wiql: `SELECT [System.Id] FROM WorkItems 
         WHERE [System.WorkItemType] = 'User Story' 
         AND [Microsoft.VSTS.Common.AcceptanceCriteria] = ''`,
  returnQueryHandle: true
});

// Generate criteria (dry run)
const criteriaResult = await wit-bulk-add-acceptance-criteria-by-query-handle({
  queryHandle: queryResult.query_handle,
  itemSelector: 'all',
  criteriaFormat: 'gherkin',
  minCriteria: 3,
  maxCriteria: 7,
  preserveExisting: false,
  dryRun: true
});

// Apply criteria
const finalResult = await wit-bulk-add-acceptance-criteria-by-query-handle({
  queryHandle: queryResult.query_handle,
  criteriaFormat: 'gherkin',
  minCriteria: 3,
  maxCriteria: 7,
  dryRun: false
});
```

---

## Common Patterns

### Pattern 1: Progressive Enhancement
Enhance work items in stages with validation at each step:

```typescript
// 1. Get items needing enhancement
const items = await wit-get-work-items-by-query-wiql({
  wiql: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'",
  returnQueryHandle: true
});

// 2. Enhance descriptions first
await wit-bulk-enhance-descriptions-by-query-handle({
  queryHandle: items.query_handle,
  enhancementStyle: 'detailed',
  dryRun: false
});

// 3. Add acceptance criteria
await wit-bulk-add-acceptance-criteria-by-query-handle({
  queryHandle: items.query_handle,
  criteriaFormat: 'gherkin',
  dryRun: false
});

// 4. Estimate story points
await wit-bulk-assign-story-points-by-query-handle({
  queryHandle: items.query_handle,
  pointScale: 'fibonacci',
  dryRun: false
});
```

### Pattern 2: Selective Enhancement
Use itemSelector to target specific items:

```typescript
const items = await wit-get-work-items-by-query-wiql({
  wiql: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] = 'MyProject\\Backend'",
  returnQueryHandle: true,
  includeSubstantiveChange: true
});

// Only enhance high-priority incomplete items
await wit-bulk-enhance-descriptions-by-query-handle({
  queryHandle: items.query_handle,
  itemSelector: {
    states: ['New', 'Active'],
    tags: ['High-Priority']
  },
  enhancementStyle: 'technical',
  dryRun: false
});
```

### Pattern 3: Dry Run → Review → Apply
Always use dry run first to preview AI-generated content:

```typescript
// Step 1: Dry run
const preview = await wit-bulk-enhance-descriptions-by-query-handle({
  queryHandle: handle,
  dryRun: true
});

// Step 2: Review preview.results
console.log(preview.results);

// Step 3: Apply if satisfied
const final = await wit-bulk-enhance-descriptions-by-query-handle({
  queryHandle: handle,
  dryRun: false
});
```

---

## Safety Features

### Auto-Skip Completed Items
All tools automatically skip items in Done/Completed/Closed/Resolved/Removed states.

### Dry Run Default
All tools default to `dryRun: true` to prevent accidental updates.

### Confidence Scores
AI responses include confidence scores (0.0-1.0) to help assess quality.

### Sample Size Limits
Maximum 100 items per call to prevent timeouts and ensure quality.

### Insufficient Info Detection
Tools detect when work item context is insufficient and report low confidence.

---

## Performance Considerations

- **Batch Size**: Start with sampleSize=10, increase gradually to 50-100
- **Query Handle TTL**: 1 hour expiration - complete processing within this window
- **AI Timeouts**: Each item takes 2-5 seconds; 100 items ≈ 5-8 minutes
- **Rate Limiting**: Tools use mini models (gpt-4o-mini) for speed and cost efficiency

---

## Troubleshooting

**"Query handle not found or expired"**
- Query handles expire after 1 hour
- Re-run the WIQL query to get a fresh handle

**"Server instance not available for sampling"**
- These tools require VS Code with language model access
- Ensure MCP server is running in VS Code context

**Low confidence scores (<0.5)**
- Work item description may be insufficient
- Consider manually improving description first
- Or use `enhancementStyle: 'concise'` for minimal descriptions

**Items skipped**
- Check skip_reason in results
- Completed items are automatically skipped (expected behavior)
- Items with existing estimates skipped if onlyUnestimated=true

**Timeout errors**
- Reduce sampleSize to 10-20
- Process items in smaller batches
- Increase timeout in system if possible
