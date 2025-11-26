# Get Pull Request Diff

**Feature Category:** Repository Operations  
**Status:** ✅ Implemented  
**Version:** 1.0.0  
**Last Updated:** 2025-11-14

## Overview

The `get-pr-diff` tool fetches the complete diff for an Azure DevOps pull request, showing all file changes including additions, deletions, modifications, and renames. This tool is essential for AI-powered code review workflows where agents need to understand what changed in a pull request to provide meaningful analysis and feedback.

## Purpose

Enable AI agents to:
- **Analyze code changes** - Review what files were modified and how
- **Code review workflows** - Understand the scope and impact of changes
- **Change tracking** - Track iterations of a pull request over time
- **Impact analysis** - Identify affected components and dependencies

## Key Features

- **Automatic iteration detection** - Fetches latest iteration if not specified
- **Pagination support** - Handle large PRs with many file changes
- **Change type categorization** - Distinguishes between adds, edits, deletes, renames
- **Metadata enrichment** - Includes commit information and author details
- **Error resilience** - Clear error messages for common failure scenarios

## Tool: get-pr-diff

### Input Parameters

**Required:**
- `repository` (string) - Repository name or ID containing the pull request
- `pullRequestId` (number) - Pull request ID to fetch diff for

**Optional:**
- `iterationId` (number) - Specific iteration ID to fetch. If not provided, fetches the latest iteration's diff
- `includeContentMetadata` (boolean) - Include additional file metadata like git object type, commit ID, and folder status (default: false)
- `includeDiffs` (boolean) - Include actual file diffs for each changed file (default: **true**). Set to false for just file list if you only need file names and change types
- `diffFormat` (string) - Diff format: 'unified' for standard unified diff format, 'sideBySide' for side-by-side comparison (default: 'unified')
- `contextLines` (number) - Number of context lines around changes in unified diff (default: 3, max: 20)
- `maxDiffLines` (number) - Maximum total diff lines to include per file (default: 1000, max: 10000). Files exceeding this show truncation warning
- `pathFilter` (string[]) - Only include diffs for files matching these path patterns (glob-style, e.g., ['src/**/*.ts', 'tests/**'])
- `top` (number) - Maximum number of changed files to return (default: 100, max: 1000)
- `skip` (number) - Number of changed files to skip for pagination (default: 0)

**Configuration Overrides (auto-filled from config):**
- `organization` (string) - Azure DevOps organization name
- `project` (string) - Azure DevOps project name

### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "pullRequestId": 42,
    "iterationId": 3,
    "summary": {
      "totalChanges": 15,
      "changesByType": {
        "edit": 10,
        "add": 3,
        "delete": 2
      },
      "changeSummary": "10 edit, 3 add, 2 delete"
    },
    "iteration": {
      "id": 3,
      "author": "Jane Developer",
      "createdDate": "2025-11-14T19:00:00Z",
      "sourceCommit": "abc123def456...",
      "targetCommit": "def456ghi789..."
    },
    "changes": [
      {
        "changeType": "edit",
        "path": "/src/services/user-service.ts",
        "objectId": "e5fa44f...",
        "url": "https://dev.azure.com/org/project/_apis/git/repositories/repo/items?path=/src/services/user-service.ts&versionType=Commit&version=abc123",
        "diff": {
          "format": "unified",
          "content": "--- a/src/services/user-service.ts\n+++ b/src/services/user-service.ts\n@@ -1,10 +1,12 @@\n export class UserService {\n-  getUser(id: string) {\n-    return this.db.findUser(id);\n+  async getUser(id: string) {\n+    const user = await this.db.findUser(id);\n+    return this.enrichUserData(user);\n   }\n }",
          "additions": 3,
          "deletions": 2,
          "isTruncated": false
        }
      },
      {
        "changeType": "add",
        "path": "/src/models/user.model.ts",
        "objectId": "7448d8798...",
        "url": "https://dev.azure.com/org/project/_apis/git/repositories/repo/items?path=/src/models/user.model.ts&versionType=Commit&version=abc123",
        "diff": {
          "format": "unified",
          "content": "--- a/src/models/user.model.ts\n+++ b/src/models/user.model.ts\n@@ -0,0 +1,5 @@\n+export interface User {\n+  id: string;\n+  name: string;\n+  email: string;\n+}",
          "additions": 5,
          "deletions": 0,
          "isTruncated": false
        }
      }
    ],
    "pagination": {
      "showing": "1-15",
      "total": 15,
      "hasMore": false,
      "nextSkip": null
    },
    "diffs": {
      "included": true,
      "totalFilesWithDiffs": 15,
      "totalAdditions": 142,
      "totalDeletions": 89,
      "truncatedFiles": []
    }
  },
  "errors": [],
  "warnings": [
    "Showing latest iteration (3). Specify iterationId to fetch a specific iteration."
  ],
  "metadata": {
    "tool": "get-pr-diff",
    "timestamp": "2025-11-14T19:05:00Z",
    "organization": "my-org",
    "project": "my-project",
    "repository": "my-repo"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "data": null,
  "errors": [
    "Failed to fetch pull request diff:",
    "Pull request 42 not found in repository my-repo. Verify the PR ID and repository name are correct."
  ],
  "warnings": [],
  "metadata": {
    "tool": "get-pr-diff",
    "timestamp": "2025-11-14T19:05:00Z"
  }
}
```

### Examples

**Example 1: Get Latest Iteration Diff (with diffs by default)**
```json
{
  "repository": "my-repo",
  "pullRequestId": 42
}
```

Fetches the diff for the latest iteration of PR #42, showing up to 100 changed files with actual unified diffs included by default.

**Example 2: Get Specific Iteration**
```json
{
  "repository": "my-repo",
  "pullRequestId": 42,
  "iterationId": 2
}
```

Fetches the diff for iteration 2 of PR #42, allowing review of specific iteration changes.

**Example 3: Paginated Results**
```json
{
  "repository": "my-repo",
  "pullRequestId": 42,
  "top": 50,
  "skip": 0
}
```

Fetches the first 50 changed files with diffs. If there are more files, use `skip: 50` to get the next batch.

**Example 4: File List Only (no diffs)**
```json
{
  "repository": "my-repo",
  "pullRequestId": 42,
  "includeDiffs": false
}
```

Returns just the list of changed files without actual diff content. Useful for quickly seeing what files changed.

**Example 5: Custom Diff Settings**
```json
{
  "repository": "my-repo",
  "pullRequestId": 42,
  "diffFormat": "unified",
  "contextLines": 5,
  "maxDiffLines": 2000
}
```

Customize diff output with 5 lines of context and higher line limit for large files.

**Example 6: Filtered Diffs for TypeScript Files Only**
```json
{
  "repository": "my-repo",
  "pullRequestId": 42,
  "pathFilter": ["src/**/*.ts", "tests/**/*.ts"]
}
```

Only includes diffs for TypeScript files matching the specified patterns. Useful for focusing on specific file types or directories.

**Example 7: Side-by-Side Diff Format**
```json
{
  "repository": "my-repo",
  "pullRequestId": 42,
  "diffFormat": "sideBySide",
  "pathFilter": ["src/critical-module.ts"]
}
```

Returns side-by-side comparison format for easier visual inspection of changes in specific files.

## Change Types

The tool categorizes changes into the following types:

- **edit** - File was modified
- **add** - New file was added
- **delete** - File was removed
- **rename** - File was renamed or moved
- **sourceRename** - Original source of a renamed file

## Common Workflows

### Code Review Analysis
```
1. Get PR diff: get-pr-diff with pullRequestId (diffs included by default)
2. Analyze changes: Review actual code changes line by line
3. Identify critical changes: Look for logic errors or potential bugs
4. Provide feedback: Comment on specific files or code patterns
```

### Focused Code Review
```
1. Get diffs for specific files: get-pr-diff with pathFilter
2. Review TypeScript only: Use pathFilter=["src/**/*.ts"]
3. Check test coverage: Use pathFilter=["tests/**"]
4. Verify documentation: Use pathFilter=["docs/**/*.md"]
```

### Change Impact Assessment
```
1. Get PR diff: get-pr-diff with pullRequestId
2. Group by directory: Identify affected components
3. Check dependencies: Analyze what modules are impacted
4. Risk assessment: Flag high-risk changes
```

### Iteration Comparison
```
1. Get iteration 1: get-pr-diff with iterationId=1
2. Get iteration 2: get-pr-diff with iterationId=2
3. Compare: Identify what changed between iterations
4. Track improvements: See how feedback was addressed
```

## Error Handling

### Common Errors

**Pull Request Not Found (404)**
```
Error: Pull request 42 not found in repository my-repo.
       Verify the PR ID and repository name are correct.
```
**Solution:** Check that the PR ID exists and the repository name is spelled correctly.

**Iteration Not Found (404)**
```
Error: Iteration 3 not found for pull request 42.
       Use get-pr-diff without iterationId to fetch the latest iteration.
```
**Solution:** Omit the `iterationId` parameter to get the latest iteration, or verify the iteration exists.

**Authentication Failed (401)**
```
Error: Failed to fetch PR iterations: Authentication failed
```
**Solution:** Ensure you're logged in with `az login` and have access to the repository.

**Invalid Repository**
```
Error: Repository 'wrong-name' not found in project.
```
**Solution:** Verify the repository name matches exactly (case-sensitive) or use the repository ID instead.

**Diff Retrieval Failed (NEW)**
```
Warning: Failed to fetch diff for /src/large-file.ts: File too large
```
**Solution:** The diff field will contain an error message. Large binary files or very large text files may fail. Consider reviewing these files individually or increasing `maxDiffLines`.

**Too Many Diffs**
```
Note: Set includeDiffs=false if you only need to see which files changed
```
**Solution:** For large PRs, disable diffs to get a quick overview of changed files, then fetch specific file diffs using pathFilter.

### Warnings

**Pagination Warning**
```
Warning: More changes available. Use skip=100 to fetch the next batch. Total changes: 250
```
Indicates there are more changed files than returned. Increase `skip` to fetch remaining files.

**Iteration Information**
```
Warning: Showing latest iteration (3). Specify iterationId to fetch a specific iteration.
```
Informs you which iteration was automatically selected when `iterationId` was not provided.

**Truncated Diffs (NEW)**
```
Warning: 3 file(s) had truncated diffs exceeding maxDiffLines (1000).
         Consider increasing maxDiffLines or reviewing these files individually:
         src/components/LargeComponent.tsx, src/utils/generated-code.ts, ...
```
Indicates some files had diffs that exceeded `maxDiffLines` and were truncated. The truncated files are listed.

**Path Filter Applied (NEW)**
```
Warning: Diffs filtered by path patterns: src/**/*.ts, tests/**.
         Remove pathFilter to include all files.
```
Reminds you that only files matching the path filter have diffs included.

**Performance Note**
```
Info: Diffs included by default. For large PRs (50+ files), consider using includeDiffs=false 
      for overview, then pathFilter for targeted review.
```

## Implementation Details

### Architecture

The tool uses three Azure DevOps REST API endpoints:

1. **Get Pull Request Iterations** - `GET /git/repositories/{repositoryId}/pullRequests/{pullRequestId}/iterations`
   - Retrieves all iterations for the PR
   - Used to find the latest iteration ID when not specified

2. **Get Specific Iteration** - `GET /git/repositories/{repositoryId}/pullRequests/{pullRequestId}/iterations/{iterationId}`
   - Fetches detailed metadata for the iteration
   - Provides author, commit IDs, and timestamps

3. **Get Iteration Changes** - `GET /git/repositories/{repositoryId}/pullRequests/{pullRequestId}/iterations/{iterationId}/changes`
   - Retrieves the list of changed files
   - Supports pagination with `$top` and `$skip`

4. **Get File Content (NEW)** - `GET /git/repositories/{repositoryId}/items?path={path}&versionType=commit&version={commitId}&download=true`
   - Fetches actual file content at specific commit
   - Uses `download=true` parameter (not `includeContent=true` which returns metadata)
   - Returns null for files that don't exist (added/deleted files)

### Diff Generation (NEW)

When `includeDiffs=true` (default), the tool:

1. **Fetches file contents** for both source and target commits
2. **Generates diffs** using simple line-by-line comparison algorithm
3. **Supports two formats:**
   - **Unified diff**: Standard diff format with +/- lines (default)
   - **Side-by-side**: Visual comparison format with OLD | NEW columns
4. **Applies limits:**
   - `maxDiffLines` to prevent overwhelming output
   - `pathFilter` to focus on specific files
   - Tracks truncation and provides warnings
5. **Handles edge cases:**
   - New files (null old content)
   - Deleted files (null new content)
   - Binary files (graceful error handling)
   - Large files (truncation with warnings)

### Service Layer

**ADOGitService** (`mcp_server/src/services/ado-git-service.ts`):
- Handles authentication and API calls
- Implements automatic iteration detection
- Fetches file contents at specific commits for diff generation (when includeDiffs is true)
- Generates unified and side-by-side diffs
- Implements glob-style path filtering
- Tracks diff statistics (additions, deletions, truncations)
- Provides structured error messages
- Manages pagination logic

### Handler

**handleGetPullRequestDiff** (`mcp_server/src/services/handlers/repos/get-pr-diff.handler.ts`):
- Validates input parameters with Zod schema (including diff parameters)
- Merges configuration defaults
- Transforms API responses to user-friendly format
- Adds warnings for truncated diffs and path filters
- Adds warnings for pagination and iteration selection

## Testing

### Manual Testing Steps

1. **Basic Fetch:**
   ```typescript
   {
     "repository": "test-repo",
     "pullRequestId": 1
   }
   ```
   Verify: Returns changes for latest iteration with actual diffs included

2. **File List Only:**
   ```typescript
   {
     "repository": "test-repo",
     "pullRequestId": 1,
     "includeDiffs": false
   }
   ```
   Verify: Returns just file names without diff content

3. **Filtered Diffs:**
   ```typescript
   {
     "repository": "test-repo",
     "pullRequestId": 1,
     "pathFilter": ["src/**/*.ts"]
   }
   ```
   Verify: Only TypeScript files have diffs included

4. **Side-by-Side Format:**
   ```typescript
   {
     "repository": "test-repo",
     "pullRequestId": 1,
     "diffFormat": "sideBySide",
     "maxDiffLines": 500
   }
   ```
   Verify: Returns side-by-side diff format with line limit

5. **Pagination:**
   ```typescript
   {
     "repository": "test-repo",
     "pullRequestId": 1,
     "top": 5
   }
   ```
   Verify: Returns at most 5 changes and indicates if more available

6. **Error Cases:**
   - Invalid PR ID: Verify clear error message
   - Invalid repository: Verify helpful error message
   - Invalid iteration: Verify suggestion to omit iterationId

### Unit Test Coverage

**ADOGitService:**
- ✅ Fetch latest iteration ID
- ✅ Fetch specific iteration details
- ✅ Fetch PR changes with pagination
- ✅ Handle 404 errors for PR not found
- ✅ Handle 404 errors for iteration not found
- ✅ Handle authentication errors

**Handler:**
- ✅ Validate required parameters
- ✅ Apply configuration defaults
- ✅ Transform API response
- ✅ Handle pagination warnings
- ✅ Handle validation errors
- ✅ Handle service errors

## API Version

Uses Azure DevOps REST API version **7.1**.

## Dependencies

- **@modelcontextprotocol/sdk** - MCP protocol implementation
- **zod** - Runtime validation
- **Azure CLI** - Authentication (via token provider)

## Security Considerations

- **Authentication:** Uses Azure CLI token-based authentication (no PATs stored)
- **Authorization:** Respects Azure DevOps repository permissions
- **Rate Limiting:** Subject to Azure DevOps API rate limits
- **Data Access:** Returns file metadata and actual file content diffs (when includeDiffs=true)

## Future Enhancements

**Potential Improvements:**
- Support for comparing specific iterations (iteration A vs iteration B)
- Add filtering by file path or change type in the results
- Cache iteration metadata to reduce API calls
- Support for batch PR diff retrieval
- Syntax highlighting for diff output
- Better handling of very large files (streaming)

## Changelog

### Version 1.1.0 (2025-11-25)
- ✅ **BREAKING CHANGE**: Changed `includeDiffs` default from `false` to `true`
- ✅ Tool now returns actual diffs by default for immediate usefulness
- ✅ Set `includeDiffs=false` to get just file list (previous default behavior)
- ✅ Updated documentation to reflect new default behavior

### Version 1.0.0 (2025-11-14)
- ✅ Initial implementation
- ✅ Automatic iteration detection
- ✅ Pagination support
- ✅ Change type categorization
- ✅ Comprehensive error handling
- ✅ Feature specification documentation

---

**Related Tools:**
- `list-agents` - Discover specialized Copilot agents in repository
- `get-config` - View current organization and project configuration

**Related Documentation:**
- [Azure DevOps Git REST API](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/)
- [Pull Request Iterations API](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-iterations)
