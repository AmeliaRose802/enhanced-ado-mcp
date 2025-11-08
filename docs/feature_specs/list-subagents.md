# List Subagents Feature Specification

## Overview

The `wit-list-subagents` tool discovers available specialized Copilot agents in Azure DevOps repositories by scanning the `/.azuredevops/policies` directory for YAML configuration files containing agent metadata.

## Purpose

Enable users to discover what specialized Copilot agents are available in a repository before assigning work items, facilitating better agent selection and work distribution.

## User-Facing Behavior

### Tool Name
`wit-list-subagents`

### Description
Scans a specified repository for specialized Copilot agent definitions and returns a list of available agents with their names and descriptions.

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `repository` | string | Yes | - | Repository name or ID to scan for specialized agents |
| `organization` | string | No | Config default | Azure DevOps organization |
| `project` | string | No | Config default | Azure DevOps project |

### Validation

- **repository**: Must be a non-empty string representing a valid repository name or ID
- **organization**: Optional, falls back to server configuration
- **project**: Optional, falls back to server configuration

## Output Format

### Success Response

```json
{
  "success": true,
  "data": {
    "repository": "MyRepo",
    "subagents": [
      {
        "name": "Copilot pair programmer, specialized agents",
        "description": "A component governance agent that adds CG specific tools and instructions",
        "filePath": ".azuredevops/policies/component-governance-agent.yml"
      }
    ],
    "scannedFiles": 3,
    "foundAgents": 1
  },
  "metadata": {
    "source": "list-subagents",
    "organization": "myorg",
    "project": "MyProject"
  },
  "errors": [],
  "warnings": []
}
```

### Empty Results Response

When no agents are found:

```json
{
  "success": true,
  "data": {
    "repository": "MyRepo",
    "subagents": [],
    "message": "No /.azuredevops/policies directory found in repository 'MyRepo'"
  },
  "metadata": {
    "source": "list-subagents",
    "organization": "myorg",
    "project": "MyProject"
  },
  "errors": [],
  "warnings": []
}
```

### Error Response

```json
{
  "success": false,
  "data": null,
  "metadata": {
    "source": "list-subagents",
    "organization": "myorg",
    "project": "MyProject"
  },
  "errors": [
    "Repository 'InvalidRepo' not found in project 'MyProject'"
  ],
  "warnings": []
}
```

## Agent Metadata Format

Subagent YAML files must contain metadata in the following format:

```yaml
# metadata
name: Copilot pair programmer, specialized agents
description: A component governance agent that adds CG specific tools and instructions

# ... rest of the agent configuration
```

### Required Fields
- `name`: The display name of the specialized agent
- `description`: A brief description of the agent's purpose and capabilities

## Examples

### Example 1: Basic Usage

**Input:**
```json
{
  "repository": "MyApp"
}
```

**Output:**
```json
{
  "success": true,
  "data": {
    "repository": "MyApp",
    "subagents": [
      {
        "name": "Security Scanner Agent",
        "description": "Analyzes code for security vulnerabilities",
        "filePath": ".azuredevops/policies/security-agent.yml"
      },
      {
        "name": "Code Quality Agent",
        "description": "Enforces coding standards and best practices",
        "filePath": ".azuredevops/policies/quality-agent.yml"
      }
    ],
    "scannedFiles": 2,
    "foundAgents": 2
  }
}
```

### Example 2: With Explicit Organization and Project

**Input:**
```json
{
  "repository": "backend-api",
  "organization": "mycompany",
  "project": "Platform"
}
```

**Output:**
```json
{
  "success": true,
  "data": {
    "repository": "backend-api",
    "subagents": [
      {
        "name": "API Documentation Agent",
        "description": "Generates and maintains API documentation",
        "filePath": ".azuredevops/policies/api-docs-agent.yml"
      }
    ],
    "scannedFiles": 1,
    "foundAgents": 1
  }
}
```

## Error Handling

### Repository Not Found

**Scenario:** Repository does not exist in the specified project

**Error:**
```
Repository 'non-existent-repo' not found in project 'MyProject'
```

### No Policies Directory

**Scenario:** Repository exists but has no `/.azuredevops/policies` directory

**Response:** Success with empty subagents array and informational message

### Invalid YAML Files

**Scenario:** YAML files exist but cannot be parsed or don't contain required metadata

**Behavior:** Tool continues scanning other files and adds warnings for unparseable files

**Warnings Example:**
```json
{
  "warnings": [
    "Failed to read .azuredevops/policies/broken-agent.yml: Invalid YAML syntax"
  ]
}
```

### Permission Issues

**Scenario:** User lacks permission to read repository files

**Error:**
```
Failed to access repository 'MyRepo': Insufficient permissions
```

## Implementation Details

### Key Components

1. **Schema Definition** (`schemas.ts`):
   - `listSubagentsSchema` - Validates input parameters

2. **Tool Configuration** (`tool-configs/discovery.ts`):
   - Registers tool with MCP server
   - Defines tool metadata and schema

3. **Handler** (`handlers/core/list-subagents.handler.ts`):
   - Validates repository exists
   - Lists files in `/.azuredevops/policies`
   - Filters for YAML files
   - Fetches and parses file contents
   - Extracts agent metadata

### Azure DevOps REST API Endpoints Used

- **Verify Repository**: `GET git/repositories/{repository}`
- **List Directory Items**: `GET git/repositories/{repository}/items?scopePath=/.azuredevops/policies&recursionLevel=OneLevel`
- **Get File Content**: `GET git/repositories/{repository}/items?path={filePath}`

### File Processing Flow

1. Verify repository exists
2. List items in `/.azuredevops/policies` directory
3. Filter for `.yml` and `.yaml` files
4. Fetch each file's content (base64 encoded)
5. Decode and parse YAML
6. Extract `name` and `description` fields
7. Return aggregated results

## Integration Points

### Used By
- `wit-assign-copilot` - Could use this to validate specialized agent names
- `wit-assign-to-copilot` - Could use this to suggest available agents when assigning work

### Dependencies
- Azure DevOps REST API (Git Items API)
- `yaml` package for parsing YAML metadata
- Azure CLI authentication via token provider

## Testing

### Unit Test Coverage
- Schema validation
- YAML parsing logic
- Error handling scenarios

### Integration Test Coverage
- Real repository scanning
- Directory not found handling
- Permission errors
- Invalid YAML handling

### Manual Testing Steps

1. **Test with valid repository:**
   ```bash
   # Call tool with repository containing specialized agents
   wit-list-subagents --repository="MyRepo"
   ```

2. **Test with empty repository:**
   ```bash
   # Call tool with repository without policies directory
   wit-list-subagents --repository="EmptyRepo"
   ```

3. **Test with invalid repository:**
   ```bash
   # Call tool with non-existent repository
   wit-list-subagents --repository="DoesNotExist"
   ```

4. **Test with explicit org/project:**
   ```bash
   # Call tool with full parameters
   wit-list-subagents --repository="MyRepo" --organization="myorg" --project="MyProject"
   ```

## Performance Considerations

- **File Reading**: Files are fetched sequentially to avoid overwhelming the API
- **Directory Scanning**: Only scans one level deep (OneLevel recursion)
- **YAML Parsing**: Lightweight parsing, extracts only required metadata fields
- **Error Tolerance**: Continues processing if individual files fail to parse

## Future Enhancements

- **Caching**: Cache discovered agents to reduce API calls
- **Deep Scanning**: Support for nested policy directories
- **Validation**: Validate agent configuration completeness
- **Auto-Assignment**: Suggest best agent for work item based on description
- **Agent Metadata**: Support additional metadata fields (version, capabilities, etc.)

## Changelog

### Version 1.0.1 (2025-11-07)
- **Fixed**: YAML parsing now handles metadata in comments correctly
- **Fixed**: File content fetching now uses `includeContent=true` parameter
- **Improved**: Added support for metadata in YAML comments (e.g., `# metadata`, `# name:`, `# description:`)
- **Improved**: Enhanced logging for debugging content structure

### Version 1.0.0 (2025-11-07)
- Initial implementation
- Basic repository scanning
- YAML metadata parsing
- Error handling and warnings
