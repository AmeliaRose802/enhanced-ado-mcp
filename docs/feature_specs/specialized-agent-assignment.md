# Specialized Agent Assignment Feature

## Overview

The Specialized Agent Assignment feature allows users to assign work items to specific specialized GitHub Copilot agents by adding a special tag in the format `copilot:agent=<AgentName>`. This enables routing work items to agents with specific capabilities (e.g., ComponentGovernanceAgent for compliance work, SecurityScanAgent for security issues).

## Feature Details

### Affected Tools

1. **`wit-assign-to-copilot`** - Assign existing work items to GitHub Copilot
2. **`wit-new-copilot-item`** - Create new work items and assign to GitHub Copilot

Both tools now support an optional `specializedAgent` parameter.

### How It Works

When a `specializedAgent` parameter is provided:

1. The work item is assigned to GitHub Copilot (using the configured GUID)
2. A tag in the format `copilot:agent=<AgentName>` is added to the work item
3. The specialized agent can use this tag to identify work items assigned to it
4. If a work item already has a `copilot:agent=*` tag, it will be replaced with the new agent name

## Input Parameters

### wit-assign-to-copilot

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| workItemId | number | Yes | Existing work item ID to assign |
| repository | string | Yes | Git repository name |
| branch | string | No | Branch name (defaults to config) |
| gitHubCopilotGuid | string | No | GitHub Copilot GUID (defaults to config) |
| specializedAgent | string | No | Name of specialized agent (e.g., 'ComponentGovernanceAgent') |
| organization | string | No | Azure DevOps organization (defaults to config) |
| project | string | No | Azure DevOps project (defaults to config) |

### wit-new-copilot-item

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| title | string | Yes | Title of the work item |
| parentWorkItemId | number | Yes | Parent work item ID |
| repository | string | Yes | Git repository name |
| description | string | No | Markdown description |
| tags | string | No | Semicolon or comma separated tags |
| workItemType | string | No | Work item type (defaults to config) |
| branch | string | No | Branch name (defaults to config) |
| gitHubCopilotGuid | string | No | GitHub Copilot GUID (defaults to config) |
| specializedAgent | string | No | Name of specialized agent (e.g., 'ComponentGovernanceAgent') |
| areaPath | string | No | Area path (defaults to config) |
| iterationPath | string | No | Iteration path (defaults to config) |
| priority | number | No | Priority (defaults to config) |
| inheritParentPaths | boolean | No | Inherit parent paths (defaults to true) |
| organization | string | No | Azure DevOps organization (defaults to config) |
| project | string | No | Azure DevOps project (defaults to config) |

## Output Format

Both tools return their standard output with no changes to the response structure. The specialized agent tag is added transparently.

### Example Response (wit-assign-to-copilot)

```json
{
  "success": true,
  "data": {
    "work_item_id": 12345,
    "assigned_to": "GitHub Copilot",
    "repository_linked": true,
    "human_friendly_url": "https://dev.azure.com/myorg/myproject/_workitems/edit/12345"
  },
  "errors": [],
  "warnings": []
}
```

The work item will have the tag `copilot:agent=ComponentGovernanceAgent` visible in Azure DevOps.

## Examples

### Example 1: Assign Existing Work Item to ComponentGovernanceAgent

```json
{
  "workItemId": 12345,
  "repository": "my-repo",
  "specializedAgent": "ComponentGovernanceAgent"
}
```

This assigns work item 12345 to GitHub Copilot and adds the tag `copilot:agent=ComponentGovernanceAgent`.

### Example 2: Create New Work Item for SecurityScanAgent

```json
{
  "title": "Fix critical security vulnerability in authentication",
  "parentWorkItemId": 67890,
  "repository": "security-repo",
  "description": "CVE-2024-1234 requires immediate remediation",
  "specializedAgent": "SecurityScanAgent"
}
```

This creates a new work item, assigns it to GitHub Copilot, and adds the tag `copilot:agent=SecurityScanAgent`.

### Example 3: Assign Without Specialized Agent (Default Behavior)

```json
{
  "workItemId": 12345,
  "repository": "my-repo"
}
```

This assigns work item 12345 to GitHub Copilot without adding any specialized agent tag (backward compatible).

## Error Handling

### Common Errors

1. **Work item not found**: If the work item ID doesn't exist
   ```json
   {
     "success": false,
     "errors": ["Work item 12345 not found"],
     "data": null
   }
   ```

2. **Repository not found**: If the repository name is invalid
   ```json
   {
     "success": false,
     "errors": ["Failed to retrieve repository: Repository 'invalid-repo' not found"],
     "data": null
   }
   ```

3. **GitHub Copilot GUID not configured**: If GUID is missing from config and not provided
   ```json
   {
     "success": false,
     "errors": ["GitHub Copilot GUID not configured and not provided in arguments"],
     "data": null
   }
   ```

### Tag Replacement Behavior

If a work item already has a `copilot:agent=*` tag:
- The existing tag will be **replaced** with the new specialized agent tag
- Other tags remain unchanged
- A debug log message is generated: `Replaced existing specialized agent tag with: copilot:agent=<NewAgent>`

If a work item doesn't have a `copilot:agent=*` tag:
- The new tag is **appended** to existing tags
- A debug log message is generated: `Added specialized agent tag: copilot:agent=<Agent>`

## Implementation Details

### Tag Format

The tag format is: `copilot:agent=<AgentName>`

Example agent names:
- `ComponentGovernanceAgent`
- `SecurityScanAgent`
- `CodeReviewAgent`
- `TestAutomationAgent`

The agent name should:
- Use PascalCase convention
- Be descriptive of the agent's purpose
- Match the agent name configured in your repository

### Tag Management

The implementation:
1. Reads current work item tags
2. Parses tags into an array (semicolon-separated)
3. Removes any existing `copilot:agent=*` tag
4. Appends the new specialized agent tag
5. Updates the work item with the merged tag list

This ensures:
- No duplicate agent tags
- Other tags are preserved
- Tag list remains clean and organized

### Service Layer Changes

Modified functions in `ado-work-item-service.ts`:

1. **`assignWorkItemToCopilot`**
   - Added `specializedAgent?: string` parameter
   - Handles tag merging and replacement logic
   - Updates work item with agent tag if provided

2. **`createWorkItemAndAssignToCopilot`**
   - Added `specializedAgent?: string` parameter
   - Passes specializedAgent to `assignWorkItemToCopilot`

### Schema Changes

Modified schemas in `config/schemas.ts`:

1. **`assignToCopilotSchema`**
   ```typescript
   specializedAgent: optionalString().describe(
     "Optional specialized Copilot agent name (e.g., 'ComponentGovernanceAgent'). " +
     "Will be added as tag 'copilot:agent=<name>'"
   )
   ```

2. **`newCopilotItemSchema`**
   ```typescript
   specializedAgent: optionalString().describe(
     "Optional specialized Copilot agent name (e.g., 'ComponentGovernanceAgent'). " +
     "Will be added as tag 'copilot:agent=<name>'"
   )
   ```

## Testing

### Unit Tests

Test file: `test/unit/specialized-agent.test.ts`

Covers:
- Schema validation with and without `specializedAgent`
- Multiple agent name formats
- Required field validation
- Backward compatibility (works without specializedAgent)

Run tests:
```bash
npm test -- specialized-agent.test.ts
```

### Integration Testing

To manually test:

1. **Assign existing work item to specialized agent:**
   ```bash
   # Via MCP tool
   wit-assign-to-copilot {
     "workItemId": 12345,
     "repository": "my-repo",
     "specializedAgent": "ComponentGovernanceAgent"
   }
   ```

2. **Create new work item with specialized agent:**
   ```bash
   # Via MCP tool
   wit-new-copilot-item {
     "title": "Test Item",
     "parentWorkItemId": 67890,
     "repository": "my-repo",
     "specializedAgent": "SecurityScanAgent"
   }
   ```

3. **Verify in Azure DevOps:**
   - Navigate to the work item
   - Check the Tags field contains `copilot:agent=<AgentName>`
   - Verify work item is assigned to GitHub Copilot

## Backward Compatibility

This feature is **fully backward compatible**:

- Existing tools work without modification
- `specializedAgent` parameter is **optional**
- If not provided, behavior is identical to previous versions
- No breaking changes to existing workflows

## Use Cases

### Component Governance
```json
{
  "workItemId": 12345,
  "repository": "compliance-repo",
  "specializedAgent": "ComponentGovernanceAgent"
}
```

### Security Vulnerability Remediation
```json
{
  "title": "Fix SQL Injection vulnerability",
  "parentWorkItemId": 67890,
  "repository": "security-repo",
  "specializedAgent": "SecurityScanAgent"
}
```

### Code Review Automation
```json
{
  "title": "Review authentication module changes",
  "parentWorkItemId": 11111,
  "repository": "auth-service",
  "specializedAgent": "CodeReviewAgent"
}
```

### Test Automation
```json
{
  "title": "Generate unit tests for new API endpoints",
  "parentWorkItemId": 22222,
  "repository": "api-service",
  "specializedAgent": "TestAutomationAgent"
}
```

## Related Features

- **Work Item Creation** (`wit-create-new-item`) - Create work items without Copilot assignment
- **Bulk Operations** - Use query handles to assign multiple items to specialized agents
- **AI Analysis** (`wit-ai-assignment-analyzer`) - Analyze work item suitability for AI assignment

## Changelog

### Version 1.10.1
- Added `specializedAgent` optional parameter to `wit-assign-to-copilot`
- Added `specializedAgent` optional parameter to `wit-new-copilot-item`
- Implemented automatic tag management (add/replace `copilot:agent=*` tags)
- Added comprehensive unit tests
- Fully backward compatible with existing workflows

## Future Enhancements

Potential future improvements:

1. **Agent Discovery**: Add tool to list available specialized agents in repository
2. **Agent Validation**: Validate agent names against configured agents
3. **Bulk Agent Assignment**: Add bulk operation to assign multiple items to specialized agents
4. **Agent Metrics**: Track work items assigned to each specialized agent
5. **Agent Routing Rules**: Auto-assign work items to agents based on work item type/tags
