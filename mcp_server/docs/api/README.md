# API Documentation

This directory contains auto-generated OpenAPI and JSON Schema documentation for the Enhanced ADO MCP Server.

## Files

### `openapi.json`

OpenAPI 3.0 specification containing:
- Complete API documentation for all 31 MCP tools
- Request/response schemas
- Tool descriptions and categories
- Authentication requirements
- Error response formats

**Use cases:**
- Import into API documentation tools (Swagger UI, Redoc, etc.)
- Generate API clients in various languages
- Validate API requests and responses
- Share API contracts with consumers

**View online:**
You can view this spec using online tools like:
- [Swagger Editor](https://editor.swagger.io/) - Paste the JSON to view
- [Redoc](https://redocly.github.io/redoc/) - Beautiful API documentation

### `schemas/` Directory

Individual JSON schemas for each tool's input parameters:
- One file per tool (e.g., `wit-create-new-item.json`)
- Includes parameter types, descriptions, and validation rules
- Contains metadata: category, AI-powered status, etc.
- `index.json` - Index of all schemas with generation metadata

**Use cases:**
- Form validation in UI applications
- API client code generation
- Documentation generation
- Schema evolution tracking

## Regenerating Documentation

The documentation is automatically generated from the Zod schemas in the source code. To regenerate:

```bash
cd mcp_server
npm run generate-openapi
# or
npm run generate-docs
```

This will:
1. Read all tool configurations from `src/config/tool-configs/index.ts`
2. Extract schemas and descriptions
3. Generate OpenAPI 3.0 specification
4. Generate individual JSON schemas
5. Output to `docs/api/`

## Keeping Documentation Synchronized

⚠️ **Important:** These files are auto-generated. Do not edit manually.

To keep documentation in sync with code:

1. **After schema changes:** Run `npm run generate-openapi`
2. **Before releases:** Include regenerated docs in commits
3. **In CI/CD:** Consider adding generation to your build pipeline

## Tool Categories

The generated documentation organizes tools into these categories:

- **Work Item Operations** - Basic CRUD operations
- **AI-Powered Analysis** - Intelligent analysis using LLM sampling
- **AI-Powered Query Generation** - Natural language to query conversion
- **Bulk Operations** - Safe bulk updates using query handles
- **Query Handles** - Query handle management
- **Context Retrieval** - Comprehensive work item context
- **Copilot Integration** - GitHub Copilot integration
- **Security Analysis** - Security findings extraction
- **Configuration** - Server configuration
- **Discovery** - Tool and resource discovery
- **Validation** - Data validation tools
- **Queries** - WIQL and OData queries

## OpenAPI Features

The generated OpenAPI spec includes:

### Server Information
- Title: Enhanced ADO MCP Server API
- Version: 1.5.0
- Protocol: MCP (Model Context Protocol)

### Authentication
Uses Azure CLI authentication (`az login`)

### Request Format
All tools accept POST requests with JSON payloads:
```json
{
  "title": "Example work item",
  "workItemType": "Task",
  "description": "Optional description"
}
```

### Response Format
Consistent response structure across all tools:
```json
{
  "success": true,
  "data": { /* tool-specific result */ },
  "metadata": { /* operation metadata */ },
  "errors": [],
  "warnings": []
}
```

### Configuration Defaults
Many parameters are automatically filled from `.ado-mcp-config.json`:
- `organization`
- `project`
- `areaPath`
- `iterationPath`
- `defaultWorkItemType`
- `defaultAssignedTo`
- `defaultPriority`

Only provide these parameters to override the defaults.

## Using the OpenAPI Spec

### Generate API Clients

**TypeScript/JavaScript:**
```bash
npx openapi-typescript docs/api/openapi.json --output types/api.ts
```

**Python:**
```bash
openapi-generator-cli generate -i docs/api/openapi.json -g python -o ./python-client
```

**C#:**
```bash
nswag openapi2csclient /input:docs/api/openapi.json /output:Client.cs
```

### Validate Requests

Use the schemas to validate API requests in your application:

```typescript
import Ajv from 'ajv';
import schema from './docs/api/schemas/wit-create-new-item.json';

const ajv = new Ajv();
const validate = ajv.compile(schema);

const data = { title: "New task" };
if (validate(data)) {
  // Valid request
} else {
  console.error(validate.errors);
}
```

### API Documentation Site

Create a documentation site using Redoc:

```bash
npx @redocly/cli build-docs docs/api/openapi.json -o docs/api-docs.html
```

Or use Swagger UI:
```bash
npx swagger-ui-dist
# Then open the UI and point it to your openapi.json
```

## Examples

### Creating a Work Item

**Request:**
```json
POST /tools/wit-create-new-item
{
  "title": "Implement login feature",
  "workItemType": "Task",
  "description": "Add OAuth authentication support",
  "tags": "auth,security"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 12345,
    "url": "https://dev.azure.com/org/project/_workitems/edit/12345",
    "fields": {
      "System.Title": "Implement login feature",
      "System.WorkItemType": "Task",
      "System.State": "New"
    }
  },
  "metadata": {
    "timestamp": "2025-10-07T23:00:00Z"
  },
  "errors": [],
  "warnings": []
}
```

### AI-Powered Query Generation

**Request:**
```json
POST /tools/wit-generate-wiql-query
{
  "description": "Find all high priority bugs assigned to me that are active"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.AssignedTo] = @Me AND [System.State] = 'Active' AND [System.Priority] = 1",
    "queryHandle": "qh_abc123...",
    "itemCount": 5
  },
  "errors": [],
  "warnings": []
}
```

## Version History

This documentation is automatically versioned to match the package version (currently 1.5.0).

## Support

For issues or questions:
- GitHub: https://github.com/AmeliaRose802/enhanced-ado-mcp
- Issues: https://github.com/AmeliaRose802/enhanced-ado-mcp/issues

---

**Generated:** Automatically from Zod schemas  
**Last Updated:** When `npm run generate-openapi` is executed  
**License:** MIT
