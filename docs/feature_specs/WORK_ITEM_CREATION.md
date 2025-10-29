# Work Item Creation Tools

**Feature Category:** Core Work Item Operations  
**Status:** ✅ Implemented  
**Version:** 1.6.0  
**Last Updated:** 2025-10-15

## Overview

The Enhanced ADO MCP Server provides three specialized tools for creating work items in Azure DevOps, each optimized for different workflows:

1. **wit-create-item** - General-purpose work item creation
2. **wit-assign-copilot** - Assign existing items to GitHub Copilot
3. **wit-create-copilot-item** - Create and immediately assign to GitHub Copilot

These tools leverage configuration defaults to minimize required parameters and streamline the creation process.

## Purpose

Simplify work item creation by:
- Auto-filling organization, project, area path, iteration path from configuration
- Supporting parent-child relationships for hierarchical work items
- Enabling GitHub Copilot integration with branch linking
- Providing consistent validation and error handling

## Tools

### 1. wit-create-item

Create a new Azure DevOps work item with optional parent relationship.

#### Input Parameters

**Required:**
- `title` (string) - Title of the work item

**Optional:**
- `parentWorkItemId` (number) - Parent work item ID for hierarchical relationship
- `description` (string) - Markdown description / repro steps
- `tags` (string) - Semicolon or comma separated tags

**Configuration Overrides (auto-filled from config):**
- `workItemType` (string) - Override default work item type
- `areaPath` (string) - Override default area path
- `iterationPath` (string) - Override default iteration path
- `assignedTo` (string) - Override default assignee
- `priority` (number) - Override default priority

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "id": 12345,
    "url": "https://dev.azure.com/org/project/_workitems/edit/12345",
    "fields": {
      "System.Title": "New work item title",
      "System.WorkItemType": "Task",
      "System.State": "New",
      "System.AreaPath": "Project\\Team",
      "System.AssignedTo": "user@domain.com"
    }
  },
  "errors": [],
  "warnings": []
}
```

**Error Response:**
```json
{
  "success": false,
  "data": null,
  "errors": ["Failed to create work item: Invalid area path"],
  "warnings": []
}
```

#### Examples

**Example 1: Simple Task Creation**
```json
{
  "title": "Implement user authentication"
}
```
Creates a task with title, using all defaults from configuration.

**Example 2: Child Work Item**
```json
{
  "title": "Design login UI",
  "parentWorkItemId": 12345,
  "description": "Create mockups for login screen with password reset flow",
  "tags": "UI, Design, Sprint-5"
}
```
Creates child work item linked to parent 12345.

**Example 3: Configuration Override**
```json
{
  "title": "Critical security fix",
  "workItemType": "Bug",
  "priority": 1,
  "assignedTo": "security-team@company.com",
  "tags": "Security, Critical"
}
```
Overrides default work item type and priority.

### 2. wit-assign-copilot

Assign an existing Azure DevOps work item to GitHub Copilot and add branch link.

#### Input Parameters

**Required:**
- `workItemId` (number) - Existing work item ID to assign
- `repository` (string) - Git repository name

**Configuration Overrides:**
- `branch` (string) - Override default branch
- `gitHubCopilotGuid` (string) - Override default GitHub Copilot GUID

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "workItemId": 12345,
    "assignedTo": "GitHub Copilot",
    "gitHubCopilotGuid": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
    "branchLink": {
      "repository": "my-repo",
      "branch": "users/copilot/work-12345",
      "url": "https://dev.azure.com/org/project/_git/my-repo?version=GBusers/copilot/work-12345"
    }
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: Assign Existing Bug**
```json
{
  "workItemId": 12345,
  "repository": "frontend-app"
}
```
Assigns work item 12345 to GitHub Copilot with branch link to frontend-app repository.

### 3. wit-create-copilot-item

Create a new work item under a parent and immediately assign to GitHub Copilot.

#### Input Parameters

**Required:**
- `title` (string) - Title of the work item
- `parentWorkItemId` (number) - Parent work item ID
- `repository` (string) - Git repository name

**Optional:**
- `description` (string) - Markdown description
- `tags` (string) - Semicolon or comma separated tags

**Configuration Overrides:**
- `workItemType`, `branch`, `gitHubCopilotGuid`, `areaPath`, `iterationPath`, `priority`

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "workItem": {
      "id": 12346,
      "title": "Implement OAuth flow",
      "parent": 12345,
      "state": "New"
    },
    "copilotAssignment": {
      "assignedTo": "GitHub Copilot",
      "branchLink": "https://dev.azure.com/org/project/_git/auth-service?version=GBusers/copilot/work-12346"
    }
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: Create Copilot Task**
```json
{
  "title": "Add JWT token validation",
  "parentWorkItemId": 12345,
  "repository": "auth-service",
  "description": "Validate JWT tokens on all protected endpoints",
  "tags": "Security, Backend"
}
```
Creates child task under 12345, assigns to Copilot, and links branch in auth-service repo.

## Configuration

These tools auto-fill parameters from CLI arguments and built-in defaults:

**CLI Arguments:**
```bash
enhanced-ado-mcp <organization> <project> [--area-path "Project\\Team"]
```

**Built-in Defaults:**
- `defaultWorkItemType`: "Product Backlog Item"
- `defaultPriority`: 2
- `defaultAssignedTo`: "@me"
- `defaultBranch`: "main"
- `gitHubCopilot.guid`: **Auto-discovered** from Azure DevOps Identity API

**GitHub Copilot Auto-Discovery:**

The server automatically discovers the GitHub Copilot user GUID on startup using the Azure DevOps Identity Picker API. No manual configuration required!

- Searches for identities matching "github copilot", "github", or "bot"
- Validates correct identity format (`userId@directoryGuid`)
- Caches discovered GUID for the session
- Falls back to manual specification if auto-discovery fails

**Manual Override (if needed):**

If auto-discovery fails, you can manually specify the GUID in your arguments:
```json
{
  "gitHubCopilotGuid": "66dda6c5-...-116241219397@72f988bf-...-2d7cd011db47"
}
```

## Error Handling

### Common Errors

| Error Message | Cause | Resolution |
|--------------|-------|------------|
| "Parent work item not found" | Invalid parentWorkItemId | Verify parent exists and is not removed |
| "Invalid area path" | Area path doesn't exist | Use `wit-get-config` to see valid paths |
| "Invalid work item type" | Type not valid for project | Check project settings for allowed types |
| "Unauthorized" | Azure CLI not authenticated | Run `az login` |
| "Repository not found" | Invalid repository name | Verify repository exists in project |

### Error Recovery

- Tool validates configuration defaults before making API calls
- Provides detailed error messages with context
- Suggests corrective actions in error responses

## Implementation Details

### Key Components

- **Handler:** `src/services/handlers/core/create-new-item.handler.ts`
- **Handler:** `src/services/handlers/integration/assign-to-copilot.handler.ts`
- **Handler:** `src/services/handlers/integration/new-copilot-item.handler.ts`
- **Schema:** `src/config/schemas.ts` (createNewItemSchema, assignToCopilotSchema, newCopilotItemSchema)
- **Service:** `src/services/ado-work-item-service.ts`

### Integration Points

- **Azure DevOps REST API** - Work Items API v7.1
- **Configuration System** - Auto-fills defaults from config
- **Authentication** - Uses Azure CLI authentication (`az account get-access-token`)

### API Calls

Each tool makes 1-2 API calls:
1. POST to create work item (wit-create-item, wit-create-copilot-item)
2. PATCH to update assignment/links (wit-assign-copilot, wit-create-copilot-item)

## Testing

### Test Files

- `test/unit/core/create-new-item.test.ts`
- `test/unit/integration/assign-to-copilot.test.ts`
- `test/integration/work-item-creation.test.ts`

### Test Coverage

- [x] Valid input handling
- [x] Parent-child relationship creation
- [x] Configuration defaults merging
- [x] Invalid input rejection
- [x] Error handling (auth, invalid paths, missing parents)
- [x] GitHub Copilot GUID assignment
- [x] Branch link creation

### Manual Testing

```bash
# Build server
cd mcp_server && npm run build

# Test create-new-item
# Use MCP inspector or VS Code to call:
{
  "tool": "wit-create-item",
  "arguments": {
    "title": "Test work item"
  }
}

# Verify work item created in Azure DevOps
```

## Related Features

- [Work Item Context](./WORK_ITEM_CONTEXT.md) - Retrieving work item details
- [Query Handle Pattern](./ENHANCED_QUERY_HANDLE_PATTERN.md) - Safe bulk operations
- [Configuration](../README.md#configuration) - Setting up defaults

## References

- [Azure DevOps Work Items REST API](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items)
- [Azure DevOps Relations](https://learn.microsoft.com/en-us/azure/devops/boards/queries/link-work-items-support-traceability)

---

**Last Updated:** 2025-10-15  
**Author:** Enhanced ADO MCP Team
