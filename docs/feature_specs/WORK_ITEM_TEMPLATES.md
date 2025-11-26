# Work Item Templates

**Feature Category:** Core Work Item Operations  
**Status:** ✅ Implemented  
**Version:** 1.0.0  
**Last Updated:** 2025-11-18

## Overview

The work item template system allows users to define reusable templates for common work item patterns. Templates are stored in the `.ado/templates/` directory and can pre-fill fields, descriptions, acceptance criteria, tags, and other work item properties.

## Purpose

Simplify work item creation by:
- Providing consistent structure for common work item types
- Reducing repetitive data entry
- Enforcing team standards and best practices
- Supporting variable substitution for dynamic content
- Enabling rapid work item creation with sensible defaults

## Template Format

Templates are defined in YAML format with the following structure:

```yaml
name: template-name
title: "[Type] {title}"
type: Bug  # Work item type
priority: 1  # Default priority (1-4)
tags:
  - tag1
  - tag2
description: |
  Multi-line description
  with {variable} substitution
  
fields:
  Microsoft.VSTS.Common.AcceptanceCriteria: |
    - [ ] Criteria 1
    - [ ] Criteria 2
  System.Description: "Additional description"
  
variables:
  variable_name: "default_value"
  
metadata:
  category: "Bug Reporting"
  description: "Template description"
  author: "Team Name"
  version: "1.0.0"
```

## Template Tools

### 1. list-templates

List all available work item templates.

#### Input Parameters

No parameters required.

#### Output Format

```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "name": "bug-template",
        "type": "Bug",
        "title": "[Bug] {title}",
        "description": "Standard template for bug reports",
        "category": "Bug Reporting",
        "tags": ["bug", "needs-triage"],
        "priority": 1,
        "variables": ["title", "os", "version", "browser"]
      }
    ],
    "count": 4
  }
}
```

#### Examples

**List all templates:**
```json
{}
```

### 2. get-template

Get detailed information about a specific template.

#### Input Parameters

**Required:**
- `templateName` (string) - Name of the template to retrieve

#### Output Format

```json
{
  "success": true,
  "data": {
    "name": "bug-template",
    "title": "[Bug] {title}",
    "type": "Bug",
    "priority": 1,
    "tags": ["bug", "needs-triage"],
    "description": "Bug description template...",
    "fields": {
      "Microsoft.VSTS.Common.AcceptanceCriteria": "- [ ] Bug is reproducible..."
    },
    "variables": {
      "os": "Windows 11",
      "version": "1.0.0"
    },
    "metadata": {
      "category": "Bug Reporting",
      "description": "Standard template for bug reports"
    }
  }
}
```

#### Examples

**Get bug template:**
```json
{
  "templateName": "bug-template"
}
```

### 3. validate-template

Validate a template to ensure it has all required fields.

#### Input Parameters

**Required:**
- `templateName` (string) - Name of the template to validate

#### Output Format

```json
{
  "success": true,
  "data": {
    "template": "bug-template",
    "valid": true,
    "errors": []
  }
}
```

#### Examples

**Validate template:**
```json
{
  "templateName": "bug-template"
}
```

## Using Templates with create-workitem

Templates integrate seamlessly with the `create-workitem` tool:

### Basic Template Usage

```json
{
  "template": "bug-template",
  "parentWorkItemId": 12345
}
```

Uses bug template with all defaults, only requiring parent work item ID.

### Template with Variable Substitution

```json
{
  "template": "bug-template",
  "variables": {
    "title": "Login fails on Chrome",
    "os": "Windows 11",
    "version": "2.3.4",
    "browser": "Chrome 120"
  },
  "parentWorkItemId": 12345
}
```

Variables replace `{variable}` placeholders in template content.

### Template with Overrides

```json
{
  "template": "feature-request-template",
  "title": "Custom Feature Title",
  "priority": 1,
  "tags": "feature; high-priority",
  "parentWorkItemId": 12345
}
```

User-provided parameters override template defaults.

## Built-in Templates

The system includes four example templates:

### 1. bug-template

- **Type:** Bug
- **Priority:** 1
- **Tags:** bug, needs-triage
- **Variables:** title, os, version, browser
- **Includes:** Steps to reproduce, expected/actual behavior, environment details

### 2. feature-request-template

- **Type:** Product Backlog Item
- **Priority:** 2
- **Tags:** feature, needs-refinement
- **Variables:** user_role, action, benefit, business_value, complexity
- **Includes:** User story format, business value, technical considerations

### 3. tech-debt-template

- **Type:** Task
- **Priority:** 3
- **Tags:** tech-debt, refactoring, code-quality
- **Variables:** current_state, desired_state, impact metrics, approach
- **Includes:** Current/desired state, impact analysis, refactoring approach

### 4. user-story-template

- **Type:** User Story
- **Priority:** 2
- **Tags:** user-story
- **Variables:** user_role, capability, benefit, scenario details
- **Includes:** As a/I want/So that format, functional/non-functional requirements

## Variable Substitution

### Custom Variables

Defined in template `variables` section or passed via `variables` parameter:

```yaml
variables:
  user_role: "developer"
  action: "deploy code"
```

### Built-in Variables

Automatically available in all templates:

- `{date}` - Current date (YYYY-MM-DD)
- `{datetime}` - Current date and time (ISO 8601)
- `{year}` - Current year
- `{month}` - Current month (01-12)
- `{day}` - Current day (01-31)

### Usage in Templates

```yaml
title: "[Bug] {title} - {date}"
description: |
  Reported on {datetime}
  OS: {os}
  Version: {version}
```

## Creating Custom Templates

### Step 1: Create Template Directory

```bash
mkdir -p .ado/templates
```

### Step 2: Create Template File

Create a `.yaml` or `.yml` file in `.ado/templates/`:

```yaml
name: custom-template
title: "[Custom] {title}"
type: Task
priority: 2
tags:
  - custom
  - team-name
description: |
  Your custom description with {variables}
  
fields:
  Microsoft.VSTS.Common.AcceptanceCriteria: |
    - [ ] Custom criteria
    
variables:
  variable_name: "default_value"
  
metadata:
  category: "Custom"
  description: "Your custom template"
  version: "1.0.0"
```

### Step 3: Validate Template

```json
{
  "templateName": "custom-template"
}
```

### Step 4: Use Template

```json
{
  "template": "custom-template",
  "variables": {
    "title": "My custom work item"
  },
  "parentWorkItemId": 12345
}
```

## Template Fields

### Standard Fields

- `name` - Unique template identifier (required)
- `title` - Work item title template (required)
- `type` - Work item type (required): Bug, Task, User Story, Product Backlog Item, Feature, Epic, etc.
- `priority` - Default priority (1-4)
- `tags` - Array of default tags
- `description` - Multi-line description template

### Custom Fields

The `fields` object can include any Azure DevOps field path:

Common fields:
- `Microsoft.VSTS.Common.AcceptanceCriteria` - Acceptance criteria
- `Microsoft.VSTS.Scheduling.Effort` - Effort (story points)
- `Microsoft.VSTS.Scheduling.RemainingWork` - Remaining work hours
- `System.AreaPath` - Area path
- `System.IterationPath` - Iteration path

### Variables Section

Default values for template variables. Can be overridden when using template.

### Metadata Section

Optional metadata for documentation:
- `category` - Template category
- `description` - Template description
- `author` - Template author
- `version` - Template version

## Error Handling

### Template Not Found

```json
{
  "success": false,
  "errors": ["Template 'unknown-template' not found"]
}
```

### Missing Template Directory

If `.ado/templates/` doesn't exist, `list-templates` returns empty list with message.

### Invalid Template Format

```json
{
  "success": false,
  "errors": ["Template validation failed: Work item type is required"]
}
```

### Missing Required Fields

When using template without required parameters:

```json
{
  "success": false,
  "errors": ["Either 'title' or 'template' parameter is required"]
}
```

## Implementation Details

### Key Components

- **Service:** `src/services/template-service.ts` - Template loading and management
- **Handlers:**
  - `src/services/handlers/core/list-templates.handler.ts`
  - `src/services/handlers/core/get-template.handler.ts`
  - `src/services/handlers/core/validate-template.handler.ts`
- **Schema:** `src/config/schemas.ts` - Template parameter validation
- **Tool Config:** `src/config/tool-configs/templates.ts`

### Integration Points

- **create-workitem tool** - Applies templates before validation
- **Configuration System** - Templates use same defaults as manual creation
- **Query Handle System** - Returns query handle for template-created items

### Template Loading

1. Scans `.ado/templates/` directory on first use
2. Parses YAML files
3. Validates template structure with Zod schema
4. Caches parsed templates for performance
5. Applies variable substitution on use

### Variable Substitution Algorithm

1. Apply template-defined variables
2. Apply user-provided variables (override template defaults)
3. Apply built-in date/time variables
4. Replace all `{variable}` placeholders in strings
5. Merge with user-provided parameters (user params override template)

## Testing

### Unit Tests

Test template service, validation, and variable substitution:

```typescript
// Template loading
await templateService.loadTemplates();
expect(templates.length).toBeGreaterThan(0);

// Template validation
const result = await templateService.validateTemplate('bug-template');
expect(result.valid).toBe(true);

// Variable substitution
const content = templateService.applyVariableSubstitution(
  'Title: {title} on {date}',
  { title: 'Test' }
);
expect(content).toContain('Test');
expect(content).toContain(new Date().toISOString().split('T')[0]);
```

### Integration Tests

Test end-to-end template usage with create-workitem tool.

## Best Practices

### Template Design

1. **Keep templates simple** - Don't over-complicate with too many variables
2. **Provide sensible defaults** - Variables should have useful default values
3. **Document variables** - Include description of what each variable does
4. **Use consistent naming** - Follow team conventions for template names
5. **Version templates** - Use metadata.version to track changes

### Variable Naming

1. **Use descriptive names** - `user_role` not `ur`
2. **Use snake_case** - Consistent with common conventions
3. **Avoid special characters** - Only use letters, numbers, underscores
4. **Group related variables** - Use prefixes like `env_`, `config_`

### Template Organization

1. **One template per file** - Don't combine multiple templates
2. **Descriptive filenames** - Match template name: `bug-template.yaml`
3. **Categorize with metadata** - Use metadata.category for grouping
4. **Version control** - Commit templates to repository

### Usage Patterns

1. **Start with list-templates** - Discover available templates first
2. **Validate before deploying** - Use validate-template in CI/CD
3. **Override when needed** - Templates are defaults, not constraints
4. **Provide context via variables** - Better than hardcoded values

## Performance

- **Template loading:** ~50ms for 10 templates
- **Template caching:** First load only, subsequent calls use cache
- **Variable substitution:** <1ms per template
- **Validation:** <5ms per template

## Limitations

1. **Static templates only** - No dynamic template generation
2. **YAML format only** - JSON not currently supported
3. **Local templates only** - No remote template repositories
4. **Single template per creation** - Can't compose multiple templates
5. **No template inheritance** - Each template is self-contained

## Related Features

- **Work Item Creation** - create-workitem tool uses templates
- **Configuration System** - Templates respect configuration defaults
- **Query Handle Pattern** - Template-created items return query handles
- **Bulk Operations** - Can create multiple items from template pattern

## Changelog

### Version 1.0.0 (2025-11-18)
- Initial implementation of template system
- Support for YAML template format
- Variable substitution with custom and built-in variables
- Four example templates (bug, feature, tech-debt, user-story)
- Template validation
- Integration with create-workitem tool
- Template management tools (list, get, validate)

## References

- [Work Item Creation Tools](./WORK_ITEM_CREATION.md)
- [Azure DevOps Work Item Fields](https://learn.microsoft.com/en-us/azure/devops/boards/work-items/work-item-fields)
- [YAML Specification](https://yaml.org/spec/)
