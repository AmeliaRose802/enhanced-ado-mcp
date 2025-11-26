# Pull Request Diff Analysis Guide

## Quick Start

```typescript
// Get latest PR diff
{
  "repository": "my-repo",
  "pullRequestId": 42
}

// Get specific iteration
{
  "repository": "my-repo",
  "pullRequestId": 42,
  "iterationId": 2
}
```

## When to Use

- **Code Review:** Analyze what changed in a PR
- **Impact Assessment:** Identify affected components
- **Iteration Tracking:** Compare changes between iterations
- **Risk Analysis:** Flag high-risk changes

## Key Features

✅ Automatic latest iteration detection  
✅ Pagination for large PRs (up to 1000 files)  
✅ Change type categorization (add, edit, delete, rename)  
✅ Commit metadata included  
✅ Clear error messages

## Response Structure

```json
{
  "pullRequestId": 42,
  "iterationId": 3,
  "summary": {
    "totalChanges": 15,
    "changesByType": {
      "edit": 10,
      "add": 3,
      "delete": 2
    }
  },
  "changes": [
    {
      "changeType": "edit",
      "path": "/src/service.ts",
      "objectId": "abc123...",
      "url": "https://..."
    }
  ],
  "pagination": {
    "hasMore": false,
    "nextSkip": null
  }
}
```

## Common Patterns

### Code Review Workflow
1. Get PR diff to see all changes
2. Group by directory/module
3. Identify critical changes
4. Provide targeted feedback

### Impact Analysis
1. Fetch PR changes
2. Map files to components
3. Check test coverage for affected areas
4. Flag potential breaking changes

### Iteration Comparison
1. Get iteration 1 diff
2. Get iteration 2 diff
3. Compare to see what changed
4. Track how feedback was addressed

## Pagination

For PRs with many files:
```typescript
// First batch (default: 100 files)
{ "repository": "repo", "pullRequestId": 42 }

// Next batch
{ "repository": "repo", "pullRequestId": 42, "skip": 100 }
```

Check `pagination.hasMore` to see if more files exist.

## Change Types

- **edit** - Modified file
- **add** - New file
- **delete** - Removed file
- **rename** - File moved/renamed
- **sourceRename** - Original renamed file

## Error Handling

**PR Not Found:**
- Verify PR ID and repository name
- Check you have access to the repository

**Iteration Not Found:**
- Omit `iterationId` to get latest
- Check iteration exists with PR details

**Authentication Failed:**
- Run `az login`
- Verify repository access

## Tips

💡 **Omit iterationId** for latest changes  
💡 **Use pagination** for large PRs (>100 files)  
💡 **Check changesByType** for quick summary  
💡 **Use path patterns** to filter client vs server changes  
💡 **Look for test files** to assess test coverage

## Related Tools

- `list-agents` - Find specialized code review agents
- `get-config` - Check current org/project settings
