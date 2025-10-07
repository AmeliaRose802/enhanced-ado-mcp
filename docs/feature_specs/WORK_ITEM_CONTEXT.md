# Work Item Context Retrieval

**Feature Category:** Context & Information Gathering  
**Status:** ✅ Implemented  
**Version:** 1.5.0  
**Last Updated:** 2025-10-07

## Overview

The Enhanced ADO MCP Server provides two complementary tools for retrieving comprehensive work item context:

1. **wit-get-work-item-context-package** - Deep context for a single work item
2. **wit-get-work-items-context-batch** - Batch retrieval with relationship analysis

These tools enable AI agents to gather all necessary information about work items in one or two API calls, avoiding the N+1 query problem.

## Purpose

Efficiently retrieve work item information with:
- Comprehensive single-item context (description, history, relations, comments)
- Batch retrieval with relationship graph analysis
- Configurable depth and detail level
- Aggregate metrics and heuristic scoring
- Minimal API calls for maximum context

## Tools

### 1. wit-get-work-item-context-package

Retrieve a comprehensive context package for a single work item in one call.

#### Input Parameters

**Required:**
- `workItemId` (number) - Primary work item ID

**Optional Inclusions (all default to false unless specified):**
- `includeHistory` (boolean) - Include recent change history (~40KB overhead)
- `maxHistoryRevisions` (number) - Max history revisions when history enabled
- `includeComments` (boolean) - Include work item comments/discussion
- `includeRelations` (boolean) - Include related links (parent, children, related, attachments, commits, PRs)
- `includeChildren` (boolean) - Include all child hierarchy (one level) for Features/Epics
- `includeParent` (boolean) - Include parent work item details
- `includeLinkedPRsAndCommits` (boolean) - Include linked Git PRs and commits
- `includeExtendedFields` (boolean) - Include extended field set beyond defaults
- `includeHtml` (boolean) - Return original HTML field values
- `maxChildDepth` (number) - Depth of child hierarchy to traverse (default 1)
- `maxRelatedItems` (number) - Max number of related items to expand
- `includeAttachments` (boolean) - Include attachment metadata
- `includeTags` (boolean) - Include tags list

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "workItem": {
      "id": 12345,
      "title": "Implement user authentication",
      "type": "Product Backlog Item",
      "state": "Active",
      "priority": 2,
      "assignedTo": "developer@company.com",
      "areaPath": "Project\\Team",
      "iterationPath": "Project\\Sprint 10",
      "description": "As a user, I want to...",
      "acceptanceCriteria": "- Login succeeds\n- Sessions persist",
      "tags": ["Security", "Sprint-5"],
      "createdDate": "2024-01-15T10:00:00Z",
      "changedDate": "2024-01-20T14:30:00Z"
    },
    "parent": {
      "id": 12340,
      "title": "User Management Feature",
      "type": "Feature",
      "state": "In Progress"
    },
    "children": [
      {
        "id": 12346,
        "title": "Design login UI",
        "type": "Task",
        "state": "New"
      },
      {
        "id": 12347,
        "title": "Implement OAuth flow",
        "type": "Task",
        "state": "Active"
      }
    ],
    "comments": [
      {
        "id": 1,
        "text": "Started design phase",
        "createdBy": "designer@company.com",
        "createdDate": "2024-01-16T09:00:00Z"
      }
    ],
    "history": [
      {
        "rev": 5,
        "changedDate": "2024-01-20T14:30:00Z",
        "changedBy": "developer@company.com",
        "changes": {
          "System.State": { "oldValue": "New", "newValue": "Active" }
        }
      }
    ],
    "linkedPRs": [
      {
        "pullRequestId": 123,
        "repository": "frontend-app",
        "title": "Add login component",
        "status": "completed",
        "url": "https://dev.azure.com/org/project/_git/frontend-app/pullrequest/123"
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example 1: Basic Context**
```json
{
  "workItemId": 12345
}
```
Returns core fields only (title, state, type, assignee, description).

**Example 2: Full Context for Analysis**
```json
{
  "workItemId": 12345,
  "includeHistory": true,
  "maxHistoryRevisions": 10,
  "includeComments": true,
  "includeRelations": true,
  "includeChildren": true,
  "includeParent": true
}
```
Returns comprehensive context including history, comments, parent, and children.

**Example 3: Development Context**
```json
{
  "workItemId": 12345,
  "includeLinkedPRsAndCommits": true,
  "includeRelations": true,
  "includeAttachments": true
}
```
Returns work item with PR/commit links and attachments for development analysis.

### 2. wit-get-work-items-context-batch

Retrieve multiple work items (10-50) with relationship graph and aggregate metrics.

#### Input Parameters

**Required:**
- `workItemIds` (array of numbers) - List of work item IDs (max 50)

**Optional Inclusions:**
- `includeRelations` (boolean) - Include relationship edges between items
- `includeFields` (array of strings) - Additional fields to include
- `includeExtendedFields` (boolean) - Include extended field set
- `includeTags` (boolean) - Include tags list
- `includeStateCounts` (boolean) - Return aggregate counts by state and type
- `includeStoryPointAggregation` (boolean) - Aggregate story points/effort
- `includeRiskScoring` (boolean) - Include heuristic risk/staleness scoring
- `includeAIAssignmentHeuristic` (boolean) - Include AI suitability heuristic
- `includeParentOutsideSet` (boolean) - Include parents outside requested set
- `includeChildrenOutsideSet` (boolean) - Include children outside requested set
- `maxOutsideReferences` (number) - Cap number of outside references
- `returnFormat` (string: "graph" | "array") - Return format (default: "graph")

#### Output Format

**Success Response (Graph Format):**
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": 12345,
        "title": "Implement authentication",
        "type": "Product Backlog Item",
        "state": "Active",
        "storyPoints": 8,
        "riskScore": 0.3,
        "aiSuitabilityScore": 0.85
      },
      {
        "id": 12346,
        "title": "Design login UI",
        "type": "Task",
        "state": "New",
        "storyPoints": 3,
        "riskScore": 0.1,
        "aiSuitabilityScore": 0.92
      }
    ],
    "edges": [
      {
        "source": 12345,
        "target": 12346,
        "type": "Parent-Child"
      }
    ],
    "aggregates": {
      "totalItems": 2,
      "stateCounts": {
        "Active": 1,
        "New": 1
      },
      "typeCounts": {
        "Product Backlog Item": 1,
        "Task": 1
      },
      "totalStoryPoints": 11,
      "averageRiskScore": 0.2,
      "highRiskCount": 0
    }
  },
  "errors": [],
  "warnings": []
}
```

**Success Response (Array Format):**
```json
{
  "success": true,
  "data": {
    "items": [
      { "id": 12345, "title": "...", "..." },
      { "id": 12346, "title": "...", "..." }
    ],
    "aggregates": { "..." }
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example 1: Simple Batch**
```json
{
  "workItemIds": [12345, 12346, 12347]
}
```
Returns basic fields for 3 work items in array format.

**Example 2: Relationship Graph**
```json
{
  "workItemIds": [12345, 12346, 12347, 12348],
  "includeRelations": true,
  "returnFormat": "graph"
}
```
Returns work items as nodes with parent-child edges, enabling graph visualization.

**Example 3: Sprint Analysis**
```json
{
  "workItemIds": [12345, 12346, 12347, 12348, 12349],
  "includeStateCounts": true,
  "includeStoryPointAggregation": true,
  "includeRiskScoring": true,
  "includeAIAssignmentHeuristic": true
}
```
Returns work items with sprint planning metrics: state distribution, total effort, risk assessment, AI suitability.

## Configuration

No special configuration required. Uses organization and project from `.ado-mcp-config.json`.

## Error Handling

### Common Errors

| Error Message | Cause | Resolution |
|--------------|-------|------------|
| "Work item not found" | Invalid ID or removed item | Verify ID exists |
| "Too many items requested" | More than 50 IDs | Reduce batch size to ≤50 |
| "Unauthorized" | Not authenticated | Run `az login` |
| "History too large" | History exceeds 100KB | Reduce maxHistoryRevisions |

### Error Recovery

- Tools return partial results when some items fail
- Invalid IDs skipped with warnings
- Timeout protection for large batches

## Performance Considerations

### API Call Optimization

**wit-get-work-item-context-package:**
- Base call: 1 API request
- With history: +1 API request
- With comments: +1 API request
- With relations: +1 API request per related item
- **Total:** 1-10 API calls depending on options

**wit-get-work-items-context-batch:**
- Batch retrieval: 1 API request for all items
- With relations: +1 API request for edges
- **Total:** 1-2 API calls regardless of item count (up to 50)

### Response Size

- Basic context: ~2KB per item
- With history: ~40KB per item
- With comments: ~5-20KB per item
- Batch (50 items, basic): ~100KB

## Implementation Details

### Key Components

- **Handler:** `src/services/handlers/context/get-work-item-context-package.handler.ts`
- **Handler:** `src/services/handlers/core/get-work-items-context-batch.handler.ts`
- **Schema:** `src/config/schemas.ts` (workItemContextPackageSchema, workItemsBatchContextSchema)
- **Service:** `src/services/ado-work-item-service.ts`

### Integration Points

- **Azure DevOps Work Items API** - Core work item data
- **Azure DevOps Relations API** - Parent/child/related links
- **Azure DevOps Comments API** - Discussion threads
- **Azure DevOps Revisions API** - Change history
- **Azure DevOps Git API** - PR and commit links

## Testing

### Test Files

- `test/unit/context/work-item-context-package.test.ts`
- `test/unit/core/work-items-batch-context.test.ts`
- `test/integration/context-retrieval.test.ts`

### Test Coverage

- [x] Single work item basic context
- [x] Single work item with all inclusions
- [x] Batch retrieval (array format)
- [x] Batch retrieval (graph format)
- [x] Relationship graph generation
- [x] Aggregate metrics calculation
- [x] Risk and AI heuristic scoring
- [x] Error handling (missing items, auth)
- [x] Performance with large batches

### Manual Testing

```bash
# Test single item context
{
  "tool": "wit-get-work-item-context-package",
  "arguments": {
    "workItemId": 12345,
    "includeChildren": true,
    "includeComments": true
  }
}

# Test batch context
{
  "tool": "wit-get-work-items-context-batch",
  "arguments": {
    "workItemIds": [12345, 12346, 12347],
    "includeRelations": true,
    "returnFormat": "graph"
  }
}
```

## Related Features

- [Work Item Creation](./WORK_ITEM_CREATION.md) - Creating new work items
- [Query Handle Pattern](./ENHANCED_QUERY_HANDLE_PATTERN.md) - Safe bulk operations
- [WIQL Queries](./WIQL_HIERARCHICAL_QUERIES.md) - Finding work items

## References

- [Azure DevOps Work Items API](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items)
- [Azure DevOps Relations](https://learn.microsoft.com/en-us/azure/devops/boards/queries/link-work-items-support-traceability)
- [Azure DevOps Comments](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments)

---

**Last Updated:** 2025-10-07  
**Author:** Enhanced ADO MCP Team
