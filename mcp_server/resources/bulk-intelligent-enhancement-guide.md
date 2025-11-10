# Bulk Intelligent Enhancement Tools - Quick Reference

## Overview

⚠️ **DEPRECATED**: Individual AI-powered enhancement tools have been consolidated into `execute-bulk-operations`.

Use `execute-bulk-operations` with the following action types for AI-powered enhancements:
- `enhance-description` - Generate AI-enhanced descriptions for work items
- `estimate-story-points` - AI-powered story point estimation
- `add-acceptance-criteria` - Generate testable acceptance criteria

## Using execute-bulk-operations for AI Enhancements

### 1. Enhance Descriptions
**Purpose**: Generate AI-enhanced descriptions for work items

**Using execute-bulk-operations**:
```json
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "enhance-description",
    "enhancementStyle": "detailed",
    "preserveExisting": true
  }],
  "itemSelector": "all",
  "dryRun": true
}
```

**Enhancement Parameters**:
- `enhancementStyle`: 'detailed' | 'concise' | 'technical' | 'business'
- `preserveExisting`: Append vs replace (default true)

**Enhancement Styles**:
- **detailed**: Comprehensive explanation with context and implementation notes
- **concise**: Brief, focused description hitting key points
- **technical**: Developer-focused with APIs and technical details
- **business**: Stakeholder-focused with business value and outcomes

**Example**:
```json
// First, get items with missing descriptions
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Description] = ''",
  "returnQueryHandle": true
}

// Enhance descriptions (dry run first)
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "enhance-description",
    "enhancementStyle": "technical",
    "preserveExisting": false
  }],
  "itemSelector": "all",
  "dryRun": true
}

// Apply changes
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "enhance-description",
    "enhancementStyle": "technical",
    "preserveExisting": false
  }],
  "itemSelector": "all",
  "dryRun": false
}
```

---

### 2. Estimate Story Points
**Purpose**: AI-powered story point estimation for work items

**Using execute-bulk-operations**:
```json
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "estimate-story-points",
    "pointScale": "fibonacci",
    "onlyUnestimated": true
  }],
  "itemSelector": "all",
  "dryRun": true
}
```

**Estimation Parameters**:
- `pointScale`: 'fibonacci' | 'linear' | 't-shirt'
- `onlyUnestimated`: Only estimate items without effort (default true)

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
```json
// Get unestimated Product Backlog Items
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Product Backlog Item' AND [Microsoft.VSTS.Scheduling.Effort] = ''",
  "returnQueryHandle": true
}

// Estimate using fibonacci scale (dry run)
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "estimate-story-points",
    "pointScale": "fibonacci",
    "onlyUnestimated": true
  }],
  "itemSelector": "all",
  "dryRun": true
}

// Review results, then apply
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "estimate-story-points",
    "pointScale": "fibonacci",
    "onlyUnestimated": true
  }],
  "itemSelector": "all",
  "dryRun": false
}
```

---

### 3. Add Acceptance Criteria
**Purpose**: Generate testable acceptance criteria for work items

**Using execute-bulk-operations**:
```json
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "add-acceptance-criteria",
    "criteriaFormat": "gherkin",
    "minCriteria": 3,
    "maxCriteria": 7,
    "preserveExisting": true
  }],
  "itemSelector": "all",
  "dryRun": true
}
```

**Criteria Parameters**:
- `criteriaFormat`: 'gherkin' | 'checklist' | 'user-story'
- `minCriteria`: Minimum criteria to generate (default 3)
- `maxCriteria`: Maximum criteria to generate (default 7)
- `preserveExisting`: Append vs replace (default true)

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
```json
// Find items missing acceptance criteria
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'User Story' AND [Microsoft.VSTS.Common.AcceptanceCriteria] = ''",
  "returnQueryHandle": true
}

// Generate criteria (dry run)
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "add-acceptance-criteria",
    "criteriaFormat": "gherkin",
    "minCriteria": 3,
    "maxCriteria": 7,
    "preserveExisting": false
  }],
  "itemSelector": "all",
  "dryRun": true
}

// Apply criteria
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "add-acceptance-criteria",
    "criteriaFormat": "gherkin",
    "minCriteria": 3,
    "maxCriteria": 7,
    "preserveExisting": false
  }],
  "itemSelector": "all",
  "dryRun": false
}
```

---

## Common Patterns

### Pattern 1: Progressive Enhancement
Enhance work items in stages with validation at each step:

```json
// 1. Get items needing enhancement
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'",
  "returnQueryHandle": true
}

// 2. Enhance descriptions, add criteria, and estimate points in one call
{
  "queryHandle": "qh_abc123...",
  "actions": [
    {
      "type": "enhance-description",
      "enhancementStyle": "detailed"
    },
    {
      "type": "add-acceptance-criteria",
      "criteriaFormat": "gherkin"
    },
    {
      "type": "estimate-story-points",
      "pointScale": "fibonacci"
    }
  ],
  "itemSelector": "all",
  "dryRun": false
}
```

### Pattern 2: Selective Enhancement
Use itemSelector to target specific items:

```json
// Get items
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] = 'MyProject\\Backend'",
  "returnQueryHandle": true
}

// Only enhance high-priority incomplete items
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "enhance-description",
    "enhancementStyle": "technical"
  }],
  "itemSelector": {
    "states": ["New", "Active"],
    "tags": ["High-Priority"]
  },
  "dryRun": false
}
```

### Pattern 3: Dry Run → Review → Apply
Always use dry run first to preview AI-generated content:

```json
// Step 1: Dry run
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "enhance-description",
    "enhancementStyle": "detailed"
  }],
  "dryRun": true
}

// Step 2: Review results

// Step 3: Apply if satisfied
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "enhance-description",
    "enhancementStyle": "detailed"
  }],
  "dryRun": false
}
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
- Query handles expire after 24 hours
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




