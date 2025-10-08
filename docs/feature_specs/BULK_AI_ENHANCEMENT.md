# Bulk AI Enhancement Tools

**Feature Category:** AI-Powered Bulk Operations  
**Status:** ✅ Implemented  
**Version:** 1.5.0  
**Last Updated:** 2025-10-07
**Requires:** VS Code Language Model API

## Overview

The Enhanced ADO MCP Server provides AI-powered bulk enhancement tools that use VS Code sampling to intelligently improve work items at scale:

1. **wit-ai-bulk-enhance-descriptions** - Generate improved descriptions
2. **wit-ai-bulk-story-points** - Estimate effort with AI
3. **wit-ai-bulk-acceptance-criteria** - Generate acceptance criteria

These tools combine the safety of the query handle pattern with AI-powered content generation for efficient work item improvement.

## Purpose

Enable intelligent bulk work item enhancement with:
- AI-generated descriptions based on context
- Automated story point estimation
- Acceptance criteria generation in multiple formats
- Confidence scoring for generated content
- Dry-run preview before applying changes
- Token-optimized response formats

## Tools

### 1. wit-ai-bulk-enhance-descriptions

Use AI to generate improved descriptions for multiple work items.

#### Input Parameters

**Required:**
- `queryHandle` (string) - Query handle from wit-query-wiql

**Optional:**
- `itemSelector` - Selection criteria (see Query Handle Operations):
  - `"all"` - All items
  - `[0, 1, 2]` - Array of indices
  - Criteria object (states, titleContains, tags, daysInactive)
- `sampleSize` (number) - Max items to process (default 10, max 100)
- `enhancementStyle` (string) - Style of enhancement:
  - `"detailed"` - Comprehensive description (default)
  - `"concise"` - Brief, focused description
  - `"technical"` - Developer-focused details
  - `"business"` - Stakeholder-friendly language
- `preserveExisting` (boolean) - Append to existing description (default true)
- `dryRun` (boolean) - Preview without updating (default true)
- `returnFormat` (string) - Response detail level:
  - `"summary"` - Counts only (~70% reduction)
  - `"preview"` - 200 char previews (~40% reduction)
  - `"full"` - Complete text

#### Output Format

**Success Response (Dry Run, Summary):**
```json
{
  "success": true,
  "data": {
    "dry_run": true,
    "items_analyzed": 10,
    "enhancement_style": "detailed",
    "preserve_existing": true,
    "estimated_tokens_saved": "~15000 tokens (summary format)",
    "sample_preview": [
      {
        "id": 12345,
        "title": "Implement authentication",
        "current_description_length": 50,
        "enhanced_description_length": 450,
        "confidence_score": 0.92,
        "preview": "This feature implements user authentication using OAuth 2.0. The solution includes: 1. OAuth provider integration..."
      }
    ]
  },
  "errors": [],
  "warnings": ["Dry run mode - no changes made"]
}
```

**Success Response (Execute, Preview):**
```json
{
  "success": true,
  "data": {
    "items_processed": 10,
    "items_succeeded": 9,
    "items_failed": 1,
    "results": [
      {
        "id": 12345,
        "success": true,
        "title": "Implement authentication",
        "enhanced_description": "This feature implements user authentication... (200 chars)",
        "confidence_score": 0.92,
        "full_length": 450
      }
    ],
    "failures": [
      {
        "id": 12346,
        "reason": "Insufficient context to generate description"
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example 1: Preview Enhancement (Summary)**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "itemSelector": "all",
  "sampleSize": 10,
  "enhancementStyle": "detailed",
  "dryRun": true,
  "returnFormat": "summary"
}
```
Generates descriptions for 10 items, shows counts and short previews.

**Example 2: Execute Enhancement (Concise)**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "itemSelector": { "states": ["New", "Active"] },
  "sampleSize": 5,
  "enhancementStyle": "concise",
  "preserveExisting": false,
  "dryRun": false,
  "returnFormat": "preview"
}
```
Replaces descriptions for 5 New/Active items with concise AI-generated content.

**Example 3: Technical Enhancement**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "itemSelector": [0, 1, 2],
  "enhancementStyle": "technical",
  "preserveExisting": true,
  "dryRun": false,
  "returnFormat": "full"
}
```
Appends technical details to first 3 items, returns full generated text.

### 2. wit-ai-bulk-story-points

Use AI to estimate story points based on complexity analysis.

#### Input Parameters

**Required:**
- `queryHandle` (string) - Query handle from wit-query-wiql

**Optional:**
- `itemSelector` - Selection criteria
- `sampleSize` (number) - Max items (default 10, max 100)
- `pointScale` (string) - Story point scale:
  - `"fibonacci"` - 1, 2, 3, 5, 8, 13 (default)
  - `"linear"` - 1-10
  - `"t-shirt"` - XS, S, M, L, XL
- `onlyUnestimated` (boolean) - Only estimate items without effort (default true)
- `includeCompleted` (boolean) - Include done items for historical analysis (default false)
- `dryRun` (boolean) - Preview without updating (default true)

#### Output Format

**Success Response (Dry Run):**
```json
{
  "success": true,
  "data": {
    "dry_run": true,
    "items_analyzed": 10,
    "point_scale": "fibonacci",
    "estimates": [
      {
        "id": 12345,
        "title": "Implement authentication",
        "estimated_points": 5,
        "confidence_score": 0.88,
        "reasoning": "Medium complexity: OAuth integration requires API calls, token management, and error handling. Comparable to similar features.",
        "complexity_factors": {
          "technical_scope": "medium",
          "uncertainty": "low",
          "dependencies": "few"
        }
      }
    ]
  },
  "errors": [],
  "warnings": ["Dry run mode - no changes made"]
}
```

**Success Response (Execute):**
```json
{
  "success": true,
  "data": {
    "items_processed": 10,
    "items_succeeded": 9,
    "items_failed": 1,
    "total_points_assigned": 42,
    "results": [
      {
        "id": 12345,
        "success": true,
        "assigned_points": 5,
        "confidence_score": 0.88
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example 1: Fibonacci Estimation**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "itemSelector": { "states": ["New"] },
  "pointScale": "fibonacci",
  "onlyUnestimated": true,
  "dryRun": true
}
```

**Example 2: T-Shirt Sizing**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "sampleSize": 20,
  "pointScale": "t-shirt",
  "dryRun": false
}
```
Assigns T-shirt sizes (XS-XL) to 20 items.

### 3. wit-ai-bulk-acceptance-criteria

Use AI to generate acceptance criteria in multiple formats.

#### Input Parameters

**Required:**
- `queryHandle` (string) - Query handle from wit-query-wiql

**Optional:**
- `itemSelector` - Selection criteria
- `sampleSize` (number) - Max items (default 10, max 100)
- `criteriaFormat` (string) - Format for criteria:
  - `"gherkin"` - Given/When/Then (default)
  - `"checklist"` - Bullet points
  - `"user-story"` - As a/I want/So that
- `minCriteria` (number) - Min criteria to generate (default 3)
- `maxCriteria` (number) - Max criteria to generate (default 7)
- `preserveExisting` (boolean) - Append to existing criteria (default true)
- `dryRun` (boolean) - Preview without updating (default true)

#### Output Format

**Success Response (Dry Run, Gherkin):**
```json
{
  "success": true,
  "data": {
    "dry_run": true,
    "items_analyzed": 10,
    "criteria_format": "gherkin",
    "criteria": [
      {
        "id": 12345,
        "title": "Implement authentication",
        "generated_criteria": [
          "Given a user on the login page\nWhen they enter valid credentials\nThen they are authenticated and redirected to dashboard",
          "Given a user with invalid credentials\nWhen they attempt to login\nThen they see an error message and remain on login page",
          "Given an authenticated user\nWhen their session expires\nThen they are redirected to login page with session timeout message"
        ],
        "criteria_count": 3,
        "confidence_score": 0.91
      }
    ]
  },
  "errors": [],
  "warnings": ["Dry run mode - no changes made"]
}
```

**Success Response (Execute, Checklist):**
```json
{
  "success": true,
  "data": {
    "items_processed": 10,
    "items_succeeded": 9,
    "items_failed": 1,
    "results": [
      {
        "id": 12345,
        "success": true,
        "criteria_added": 5,
        "confidence_score": 0.89
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example 1: Gherkin Format**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "itemSelector": { "states": ["New"] },
  "criteriaFormat": "gherkin",
  "minCriteria": 3,
  "maxCriteria": 5,
  "dryRun": true
}
```

**Example 2: Checklist Format**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "criteriaFormat": "checklist",
  "minCriteria": 5,
  "maxCriteria": 10,
  "preserveExisting": false,
  "dryRun": false
}
```

## AI Model Selection

All bulk AI enhancement tools use free models by default (GPT-4o mini, GPT-4.1) for speed and cost efficiency. See [Model Selection](./MODEL_SELECTION.md) for details.

## Configuration

Requires VS Code Language Model API access. Uses defaults from `.ado-mcp-config.json`.

## Error Handling

### Common Errors

| Error Message | Cause | Resolution |
|--------------|-------|------------|
| "Sampling not available" | VS Code LLM API not accessible | Ensure VS Code with Copilot extension |
| "Insufficient context" | Work item lacks detail | Add more info to work item |
| "AI generation failed" | Model unavailable | Retry or use different model |
| "Query handle expired" | Handle older than 1 hour | Re-query to get fresh handle |
| "Item update failed" | API error during update | Check item state allows updates |

### Error Recovery

- Partial success: Some items succeed even if others fail
- Failed items reported with specific reasons
- Retry logic for transient AI failures
- Confidence scoring helps identify low-quality generations

## Performance Considerations

- **Processing time:** 2-5 seconds per item (AI generation)
- **Token usage:** ~1000-2000 tokens per item
- **Batch size:** Recommend 10-20 items per batch
- **Return format:** Use "summary" or "preview" to save tokens
- **API rate limiting:** Respects VS Code sampling limits

## Implementation Details

### Key Components

- **Handlers:** `src/services/handlers/ai-powered/bulk-*.handler.ts`
- **Schema:** `src/config/schemas.ts`
- **Service:** `src/services/sampling-service.ts`
- **Prompts:** `mcp_server/prompts/system/*.md`

### Integration Points

- **Query Handle Service** - Safe item selection
- **VS Code Sampling API** - AI content generation
- **Azure DevOps API** - Work item updates
- **Prompt Service** - Template loading and rendering

## Testing

### Test Files

- `test/unit/ai-powered/bulk-enhance-descriptions.test.ts`
- `test/unit/ai-powered/bulk-assign-story-points.test.ts`
- `test/unit/ai-powered/bulk-add-acceptance-criteria.test.ts`
- `test/integration/bulk-ai-enhancement.test.ts`

### Test Coverage

- [x] Description enhancement (all styles)
- [x] Story point estimation (all scales)
- [x] Acceptance criteria (all formats)
- [x] Dry run mode
- [x] Item selection
- [x] Error handling
- [x] Confidence scoring

### Manual Testing

```bash
# Requires VS Code with Copilot extension

# Test description enhancement
{
  "tool": "wit-ai-bulk-enhance-descriptions",
  "arguments": {
    "queryHandle": "qh_test...",
    "sampleSize": 3,
    "enhancementStyle": "detailed",
    "dryRun": true
  }
}
```

## Related Features

- [Query Handle Pattern](./ENHANCED_QUERY_HANDLE_PATTERN.md) - Safe bulk operations
- [Model Selection](./MODEL_SELECTION.md) - AI model configuration
- [AI-Powered Features](./AI_POWERED_FEATURES.md) - Other AI tools
- [Bulk Operations](./BULK_OPERATIONS.md) - Non-AI bulk operations

## References

- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
- [MCP Sampling](https://modelcontextprotocol.io/docs/concepts/sampling)
- [Story Point Estimation](https://www.scrum.org/resources/blog/practical-fibonacci-beginners-guide-relative-sizing)
- [Gherkin Syntax](https://cucumber.io/docs/gherkin/reference/)

---

**Last Updated:** 2025-10-07  
**Author:** Enhanced ADO MCP Team
