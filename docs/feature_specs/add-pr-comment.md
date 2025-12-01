# Add Pull Request Comment Feature

## Overview

The `add-pr-comment` tool creates new comment threads on Azure DevOps pull requests with optional GitHub Copilot @mention tagging. It supports both general PR-level comments and line-specific code comments, automatically formatting mentions using Azure DevOps HTML syntax to ensure proper notification delivery.

**Version:** 1.0.0  
**Category:** Repository Tools  
**AI-Powered:** No (but integrates with Copilot GUID auto-discovery)

## Key Features

- **Copilot @Mention Support**: Automatically tag GitHub Copilot using proper Azure DevOps mention format
- **Auto-Discovery**: Finds GitHub Copilot GUID automatically if not provided
- **Line-Specific Comments**: Support for commenting on specific lines of code
- **General PR Comments**: Create PR-level discussion threads
- **HTML Mention Format**: Uses correct `data-vss-mention` attribute format for Azure DevOps

## Purpose

Enable AI agents and developers to:
- **Request Copilot reviews** - Tag Copilot in comments to request automated reviews
- **Ask questions** - Direct questions to Copilot on specific code sections
- **Provide feedback** - Add general or line-specific feedback to PRs
- **Ensure notifications** - Properly format mentions so Copilot receives notifications

## Azure DevOps Mention Format

Azure DevOps requires a specific HTML format for @mentions to work correctly:

```html
<a href="#" data-vss-mention="version:2.0,{GUID}">@Display Name</a>
```

**Critical Elements:**
- `data-vss-mention` attribute with `version:2.0,{GUID}` format
- GUID in format `localId@originId` (e.g., `5d6898bb-45ec-419a-ad8a-1234567890ab@2c895908-abcd-efgh-ijkl-mnopqrstuvwx`)
- Display name after `@` in the link text

**Example:**
```html
<a href="#" data-vss-mention="version:2.0,5d6898bb-45ec-419a-ad8a-1234567890ab@2c895908-abcd-efgh-ijkl-mnopqrstuvwx">@GitHub Copilot</a> Please review this code for security issues.
```

## Input Parameters

### Required Parameters
- **repository** (string): Repository name or ID containing the pull request
- **pullRequestId** (number): Pull request ID to add comment to
- **comment** (string): Comment text to add

### Optional Parameters
- **mentionCopilot** (boolean, default: false): Automatically tag GitHub Copilot in the comment using @mention
- **copilotGuid** (string): GitHub Copilot GUID in format `localId@originId` (auto-discovered if not provided and mentionCopilot=true)
- **copilotDisplayName** (string, default: "GitHub Copilot"): Display name for Copilot mention
- **threadContext** (object): Optional context for line-specific comments
  - **filePath** (string): File path to comment on
  - **rightFileStart** (object): Starting line position
    - **line** (number): Line number in new version of file
    - **offset** (number, optional): Character offset within the line
  - **rightFileEnd** (object): Ending line position
    - **line** (number): Line number in new version of file
    - **offset** (number, optional): Character offset within the line
- **organization** (string): Azure DevOps organization name (uses config default if not provided)
- **project** (string): Azure DevOps project name (uses config default if not provided)

## Examples

### Example 1: General PR Comment with Copilot Mention

```typescript
{
  "repository": "Compute-Fabric-HostGateway",
  "pullRequestId": 13997912,
  "comment": "Please review this PR for security vulnerabilities.",
  "mentionCopilot": true
}
```

**Result:**
```json
{
  "success": true,
  "data": {
    "threadId": 1763168101,
    "pullRequestId": 13997912,
    "repository": "Compute-Fabric-HostGateway",
    "commentId": 9876543,
    "publishedDate": "2025-12-01T22:25:00Z",
    "status": "active",
    "threadContext": null,
    "url": "https://msazure.visualstudio.com/One/_git/Compute-Fabric-HostGateway/pullRequest/13997912#1763168101",
    "mentionedCopilot": true
  },
  "errors": [],
  "warnings": ["Auto-discovered GitHub Copilot GUID: 5d6898bb-45ec-419a-ad8a-1234567890ab@2c895908-abcd-efgh-ijkl-mnopqrstuvwx"]
}
```

### Example 2: Line-Specific Comment

```typescript
{
  "repository": "CoreAPI",
  "pullRequestId": 456,
  "comment": "This function needs error handling for null inputs.",
  "threadContext": {
    "filePath": "src/utils/validation.ts",
    "rightFileStart": { "line": 45 },
    "rightFileEnd": { "line": 52 }
  }
}
```

**Result:**
```json
{
  "success": true,
  "data": {
    "threadId": 7890123,
    "pullRequestId": 456,
    "repository": "CoreAPI",
    "commentId": 1234567,
    "publishedDate": "2025-12-01T22:30:00Z",
    "status": "active",
    "threadContext": {
      "filePath": "src/utils/validation.ts",
      "rightFileStart": { "line": 45, "offset": 0 },
      "rightFileEnd": { "line": 52, "offset": 0 }
    },
    "url": "https://dev.azure.com/myorg/myproject/_git/CoreAPI/pullRequest/456#7890123",
    "mentionedCopilot": false
  },
  "errors": [],
  "warnings": []
}
```

### Example 3: Copilot Mention with Explicit GUID

```typescript
{
  "repository": "WebApp",
  "pullRequestId": 789,
  "comment": "Can you analyze the performance impact of this change?",
  "mentionCopilot": true,
  "copilotGuid": "5d6898bb-45ec-419a-ad8a-1234567890ab@2c895908-abcd-efgh-ijkl-mnopqrstuvwx",
  "copilotDisplayName": "AI Reviewer"
}
```

## Output Format

### Success Response

```json
{
  "success": true,
  "data": {
    "threadId": 1763168101,
    "pullRequestId": 13997912,
    "repository": "Compute-Fabric-HostGateway",
    "commentId": 9876543,
    "publishedDate": "2025-12-01T22:25:00Z",
    "status": "active",
    "threadContext": {
      "filePath": "path/to/file.ts",
      "rightFileStart": { "line": 10, "offset": 0 },
      "rightFileEnd": { "line": 15, "offset": 0 }
    },
    "url": "https://msazure.visualstudio.com/One/_git/Compute-Fabric-HostGateway/pullRequest/13997912#1763168101",
    "mentionedCopilot": true
  },
  "errors": [],
  "warnings": ["Auto-discovered GitHub Copilot GUID: abc123@def456"]
}
```

**Response Fields:**
- `threadId` - ID of the created thread
- `pullRequestId` - PR ID the comment was added to
- `repository` - Repository name
- `commentId` - ID of the first comment in the thread
- `publishedDate` - When the comment was published (ISO 8601)
- `status` - Thread status (typically "active")
- `threadContext` - Line context if provided, null for general comments
- `url` - Direct link to the thread
- `mentionedCopilot` - Whether Copilot was mentioned

## Error Handling

### Missing Repository

```json
{
  "success": false,
  "errors": ["Repository name or ID is required"],
  "data": null
}
```

### Missing Copilot GUID

```json
{
  "success": false,
  "errors": [
    "GitHub Copilot GUID not found. Either:",
    "1. Provide copilotGuid parameter explicitly, or",
    "2. Configure with --copilot-guid flag, or",
    "3. Ensure GitHub Copilot user exists in Azure DevOps organization"
  ],
  "data": null
}
```

### PR Not Found

```json
{
  "success": false,
  "errors": [
    "Pull request 456 not found in repository MyRepo. Verify the PR ID and repository name are correct."
  ],
  "data": null
}
```

### Invalid Thread Context

```json
{
  "success": false,
  "errors": [
    "Invalid thread context or comment format: Line number must be positive"
  ],
  "data": null
}
```

## Implementation Details

### Architecture

**Components:**
1. **Schema Validation** (`schemas.ts`) - Validates input parameters
2. **Handler** (`add-pr-comment.handler.ts`) - Orchestrates comment creation
3. **Git Service** (`ado-git-service.ts`) - Calls Azure DevOps REST API
4. **Identity Service** (`ado-identity-service.ts`) - Auto-discovers Copilot GUID
5. **Tool Configuration** (`tool-configs/repos.ts`) - Registers tool

**Flow:**
1. Validate input parameters
2. If `mentionCopilot=true`:
   - Get or discover Copilot GUID
   - Format comment with HTML mention tag
3. Create thread via Azure DevOps REST API
4. Return thread details and metadata

### Azure DevOps REST API

**Endpoint:** `POST https://dev.azure.com/{organization}/{project}/_apis/git/repositories/{repository}/pullRequests/{pullRequestId}/threads?api-version=7.1`

**Request Body:**
```json
{
  "comments": [
    {
      "parentCommentId": 0,
      "content": "<a href=\"#\" data-vss-mention=\"version:2.0,{GUID}\">@GitHub Copilot</a> Comment text",
      "commentType": "text"
    }
  ],
  "status": "active",
  "threadContext": {
    "filePath": "path/to/file.ts",
    "rightFileStart": { "line": 10 },
    "rightFileEnd": { "line": 15 }
  }
}
```

### Mention Format Implementation

```typescript
function formatCommentWithMention(
  comment: string,
  copilotGuid: string,
  displayName: string = 'GitHub Copilot'
): string {
  const mentionTag = `<a href="#" data-vss-mention="version:2.0,${copilotGuid}">@${displayName}</a>`;
  return `${mentionTag} ${comment}`;
}
```

**Key Points:**
- Uses HTML anchor tag with `data-vss-mention` attribute
- Format: `version:2.0,{GUID}` where GUID is `localId@originId`
- Prepends mention to user's comment text
- Display name appears as link text

## Integration with Other Tools

**Workflow:**
1. Use `get-pr-diff` to review PR changes
2. Use `get-pr-comments` to check existing feedback
3. Use `add-pr-comment` to add new feedback with Copilot mention
4. Copilot receives notification and can process the request

**Example Workflow:**
```typescript
// 1. Get PR diff
const diff = await executeTool('get-pr-diff', {
  repository: 'MyRepo',
  pullRequestId: 123
});

// 2. Check existing comments
const comments = await executeTool('get-pr-comments', {
  repository: 'MyRepo',
  pullRequestId: 123,
  threadStatusFilter: ['active']
});

// 3. Add new comment mentioning Copilot
const result = await executeTool('add-pr-comment', {
  repository: 'MyRepo',
  pullRequestId: 123,
  comment: 'Please review the changes in validation.ts for security issues.',
  mentionCopilot: true,
  threadContext: {
    filePath: 'src/validation.ts',
    rightFileStart: { line: 45 },
    rightFileEnd: { line: 52 }
  }
});
```

## Testing Considerations

### Unit Tests
- Schema validation for all parameter combinations
- Mention format generation with various GUIDs
- Error handling for missing parameters
- Thread context validation

### Integration Tests
- Create general PR comment
- Create line-specific comment
- Create comment with Copilot mention
- Auto-discover Copilot GUID
- Handle PR not found errors
- Handle invalid thread context

### Manual Testing
Use test PR: https://msazure.visualstudio.com/One/_git/Compute-Fabric-HostGateway/pullrequest/13997912

```bash
# Test general comment with Copilot mention
enhanced-ado-mcp msazure --area-path "One\\Team" --tool add-pr-comment \
  --repository "Compute-Fabric-HostGateway" \
  --pullRequestId 13997912 \
  --comment "Please review for security issues" \
  --mentionCopilot true

# Verify:
# 1. Comment appears on PR
# 2. Copilot is properly tagged (appears as clickable @mention)
# 3. Copilot receives notification
# 4. Comment format matches UI-created mentions
```

## API Version

Uses Azure DevOps REST API version **7.1**.

## Dependencies

- **@modelcontextprotocol/sdk** - MCP protocol implementation
- **zod** - Runtime validation
- **Azure CLI** - Authentication (via token provider)
- **Identity Service** - Copilot GUID discovery

## Security Considerations

- **Authentication:** Uses Azure CLI token-based authentication (no PATs stored)
- **Authorization:** Respects Azure DevOps repository permissions
- **GUID Validation:** Validates GUID format before use
- **HTML Injection:** Comment text is passed through Azure DevOps API which handles sanitization

## Known Limitations

1. **GUID Format**: Must be `localId@originId` format - other formats will fail
2. **Display Name**: Must match registered identity name for proper linking
3. **Thread Context**: Only supports `rightFile*` positions (new version), not `leftFile*` (old version)
4. **Single Comment**: Creates threads with one initial comment only (additional comments require separate API calls)

## Future Enhancements

**Potential Improvements:**
- Support for editing existing comments
- Support for replying to existing threads
- Support for `leftFile*` context (commenting on old version)
- Batch comment creation across multiple PRs
- Support for multiple mentions in one comment
- Rich text formatting options (markdown to HTML conversion)
- Attachment support

## Changelog

### Version 1.0.0 (2025-12-01)
- Initial implementation
- Copilot @mention support with auto-discovery
- General and line-specific comment support
- HTML mention format with `data-vss-mention` attribute