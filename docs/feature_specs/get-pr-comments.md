# Pull Request Comments Retrieval Feature

## Overview

The `get-pr-comments` tool provides AI-powered retrieval and filtering of pull request discussion threads and comments from Azure DevOps. It supports three operational modes: natural language queries, specific PR lookups, and explicit filter-based searches.

**Version:** 1.0.0  
**Category:** Repository Tools  
**AI-Powered:** Yes (requires VS Code Language Model API)

## Key Features

- **Natural Language Queries**: Describe what you want in plain English (e.g., "show active threads from PRs targeting main this week")
- **Intelligent Filtering**: Filter by PR status, thread status, branches, dates, creators, and reviewers
- **Thread Status Support**: Focus on unresolved discussions (active/pending) or track resolved issues (fixed/closed)
- **Bulk PR Search**: Search across multiple PRs and aggregate comments
- **System Comment Filtering**: Exclude noise from automated systems
- **Pagination Support**: Handle large result sets efficiently

## Use Cases

### 1. Finding Unresolved Feedback
```typescript
{
  "description": "Show me all active unresolved threads from PRs in the last 2 weeks"
}
```

### 2. Review Tracking
```typescript
{
  "description": "Get comments from completed PRs targeting main branch this month"
}
```

### 3. Specific PR Analysis
```typescript
{
  "repository": "MyService",
  "pullRequestId": 456
}
```

### 4. Branch-Specific Discussions
```typescript
{
  "description": "Find all comments from feature branches merged to release/v2.0",
  "repository": "CoreAPI"
}
```

## Operational Modes

### Mode 1: Natural Language (AI-Powered)

**Trigger:** Provide `description` parameter without `pullRequestId`

**How It Works:**
1. User provides natural language query
2. AI generates search criteria from description
3. System searches PRs matching criteria
4. Fetches and filters comments based on inferred intent

**Example:**
```typescript
{
  "description": "Show active threads from PRs targeting main in the last week",
  "repository": "MyRepo"
}
```

**AI Capabilities:**
- Interprets relative dates ("last week", "this month")
- Understands branch intent ("targeting main", "from feature branches")
- Infers thread status filters ("unresolved", "active feedback")
- Maps status terms ("completed PRs", "abandoned changes")

### Mode 2: Specific PR

**Trigger:** Provide `pullRequestId` and `repository`

**How It Works:**
1. Directly fetches comments from specified PR
2. Applies thread status filters if provided
3. Returns all matching threads and comments

**Example:**
```typescript
{
  "repository": "CoreAPI",
  "pullRequestId": 789,
  "threadStatusFilter": ["active", "pending"]
}
```

### Mode 3: Explicit Search

**Trigger:** Provide explicit filter parameters without `description` or `pullRequestId`

**How It Works:**
1. Searches PRs using provided criteria
2. Fetches comments from matching PRs
3. Applies thread and comment filters

**Example:**
```typescript
{
  "repository": "MyService",
  "status": "active",
  "targetRefName": "refs/heads/main",
  "minTime": "2025-11-01T00:00:00Z",
  "threadStatusFilter": ["active"]
}
```

## Input Parameters

### Natural Language
- **description** (string, optional): Natural language query describing what PRs/comments to find

### PR Identification
- **repository** (string, optional): Repository name or ID
  - Required for specific PR mode
  - Optional for search mode (searches all repos if omitted)
- **pullRequestId** (number, optional): Specific PR ID to fetch

### Search Filters
- **status** (enum, optional): `active` | `completed` | `abandoned` | `notSet` | `all`
  - Default: `active`
- **creatorId** (string, optional): Filter by PR creator's GUID
- **reviewerId** (string, optional): Filter by reviewer's GUID
- **sourceRefName** (string, optional): Source branch (e.g., `refs/heads/feature/my-branch`)
- **targetRefName** (string, optional): Target branch (e.g., `refs/heads/main`)
- **minTime** (string, optional): PRs created after (ISO format)
- **maxTime** (string, optional): PRs created before (ISO format)

### Thread/Comment Filters
- **threadStatusFilter** (array, optional): Filter by thread status
  - Values: `unknown`, `active`, `fixed`, `wontFix`, `closed`, `byDesign`, `pending`
  - Example: `["active", "pending"]` for unresolved threads
- **includeSystemComments** (boolean, optional): Include system-generated comments
  - Default: `false`
- **includeDeleted** (boolean, optional): Include deleted threads
  - Default: `false`

### Pagination
- **maxPRsToFetch** (number, optional): Max PRs in search mode (1-100)
  - Default: `10`
- **top** (number, optional): PRs per page (1-100)
  - Default: `50`
- **skip** (number, optional): PRs to skip for pagination
  - Default: `0`

### Configuration Overrides
- **organization** (string, optional): Override default organization
- **project** (string, optional): Override default project

## Output Format

### Specific PR Mode Response
```typescript
{
  "success": true,
  "data": {
    "mode": "specific",
    "pullRequestId": 456,
    "repository": "MyRepo",
    "summary": {
      "totalThreads": 5,
      "totalComments": 12,
      "commentsByStatus": {
        "active": 3,
        "fixed": 7,
        "closed": 2
      }
    },
    "threads": [
      {
        "threadId": 123,
        "status": "active",
        "publishedDate": "2025-11-10T14:30:00Z",
        "lastUpdatedDate": "2025-11-12T09:15:00Z",
        "commentCount": 3,
        "filePath": "src/services/auth.ts",
        "comments": [
          {
            "id": 1,
            "author": "John Doe",
            "authorEmail": "john@example.com",
            "content": "Should we add error handling here?",
            "publishedDate": "2025-11-10T14:30:00Z",
            "commentType": "text"
          }
        ]
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

### Search Mode Response
```typescript
{
  "success": true,
  "data": {
    "mode": "search",
    "summary": {
      "totalPRs": 3,
      "totalThreads": 8,
      "totalComments": 24
    },
    "pullRequests": [
      {
        "pullRequestId": 456,
        "title": "Add authentication middleware",
        "status": "active",
        "repository": "CoreAPI",
        "createdBy": "Jane Smith",
        "creationDate": "2025-11-08T10:00:00Z",
        "sourceRefName": "refs/heads/feature/auth",
        "targetRefName": "refs/heads/main",
        "summary": {
          "totalThreads": 3,
          "totalComments": 8,
          "commentsByStatus": {
            "active": 5,
            "fixed": 3
          }
        },
        "threads": [...]
      }
    ],
    "searchCriteria": {...},
    "aiGenerated": true,
    "explanation": "Searching for active PRs targeting main branch..."
  },
  "errors": [],
  "warnings": []
}
```

## Thread Status Reference

| Status | Meaning | Common Use |
|--------|---------|------------|
| `active` | Discussion ongoing, needs attention | Unresolved feedback |
| `pending` | Waiting for response | Review in progress |
| `fixed` | Issue addressed and resolved | Completed action items |
| `closed` | Thread closed without resolution | No action needed |
| `wontFix` | Acknowledged but won't be changed | Accepted limitation |
| `byDesign` | Behavior is intentional | Not a bug |
| `unknown` | Status not set | Default state |

## Error Handling

### Common Errors

**Missing Repository:**
```typescript
{
  "success": false,
  "errors": ["Repository is required when fetching comments for a specific PR."]
}
```

**AI Generation Failure:**
```typescript
{
  "success": false,
  "errors": ["AI generated invalid JSON response. Please try rephrasing your query or use direct parameters."]
}
```

**No Results:**
```typescript
{
  "success": true,
  "data": {...},
  "warnings": ["No pull requests found matching the search criteria."]
}
```

**PR Not Found:**
```typescript
{
  "success": false,
  "errors": ["Pull request 456 not found in repository MyRepo. Verify the PR ID and repository name are correct."]
}
```

## Best Practices

### 1. Use Thread Status Filters
Focus on relevant discussions:
```typescript
{
  "threadStatusFilter": ["active", "pending"]  // Only unresolved
}
```

### 2. Exclude System Comments
Reduce noise:
```typescript
{
  "includeSystemComments": false  // Default behavior
}
```

### 3. Specify Repository for Performance
Avoid cross-repo searches when possible:
```typescript
{
  "repository": "MyRepo",  // Faster than searching all repos
  "description": "active threads this week"
}
```

### 4. Limit PR Fetch Count
Manage large result sets:
```typescript
{
  "maxPRsToFetch": 5  // Process fewer PRs for faster response
}
```

### 5. Use Natural Language for Complex Queries
Let AI handle the complexity:
```typescript
{
  "description": "show unresolved feedback from feature branches merged to main this sprint"
}
```

## Integration with Existing Tools

### Combine with PR Diff
1. Use `get-pr-comments` to find PRs with active discussions
2. Use `get-pr-diff` to analyze code changes
3. Correlate comments with specific file changes

### Workflow Example
```typescript
// Step 1: Find PRs with unresolved feedback
const comments = await executeTool('get-pr-comments', {
  description: "active threads in PRs targeting main",
  repository: "CoreAPI"
});

// Step 2: For each PR, get the diff
for (const pr of comments.data.pullRequests) {
  const diff = await executeTool('get-pr-diff', {
    repository: pr.repository,
    pullRequestId: pr.pullRequestId
  });
  
  // Analyze comments in context of code changes
}
```

## Performance Considerations

### Query Optimization
- **Specific PR mode**: Fastest, single API call per PR
- **Search with repository**: Fast, scoped search
- **Search without repository**: Slower, project-wide search

### Pagination Strategy
```typescript
{
  "maxPRsToFetch": 10,  // Limit initial fetch
  "top": 50,            // Control page size
  "skip": 0             // Fetch next page with skip=50
}
```

### Rate Limiting
- Azure DevOps API has rate limits
- Fetching comments from many PRs can hit limits
- Use `maxPRsToFetch` to control load

## Testing Recommendations

### Unit Tests
- Schema validation for all parameter combinations
- AI response parsing with malformed JSON
- Thread status filtering logic
- Comment type filtering

### Integration Tests
- Real Azure DevOps API calls (requires auth)
- Natural language query generation
- Multi-PR search and aggregation
- Pagination across large result sets

## Version History

### 1.0.0 (2025-11-14)
- Initial implementation
- Natural language query support via AI
- Three operational modes (NL, specific, explicit)
- Thread status filtering
- System comment exclusion
- Pagination support

## Related Features

- **get-pr-diff**: Analyze code changes in pull requests
- **query-wiql**: Query work items (similar AI-powered pattern)
- **query-odata**: Analytics queries with AI generation

---

**Last Updated:** 2025-11-14  
**Tool Name:** `get-pr-comments`  
**Handler:** `src/services/handlers/repos/get-pr-comments.handler.ts`  
**Schema:** `getPullRequestCommentsSchema` in `src/config/schemas.ts`
