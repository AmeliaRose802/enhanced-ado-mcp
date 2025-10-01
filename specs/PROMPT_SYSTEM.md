# Prompt Template System

**Status:** ✅ Implemented  
**Version:** 1.0  
**Last Updated:** 2025-10-01

## Overview

The Enhanced ADO MCP Server includes a sophisticated prompt template system that enables AI-powered features through structured, reusable prompt templates.

## Architecture

### Components

```
┌─────────────────────────────────────────────┐
│         Prompt Service                       │
│  ┌────────────────────────────────────────┐ │
│  │  Prompt Loader                          │ │
│  │  - File system scanning                 │ │
│  │  - Metadata parsing                     │ │
│  │  - Template caching                     │ │
│  └────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────┐ │
│  │  Template Renderer                      │ │
│  │  - Variable substitution                │ │
│  │  - Conditional sections                 │ │
│  │  - Format validation                    │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│      Prompt Templates (Markdown)             │
│  /mcp_server/prompts/                        │
│  ├── system/            (internal use)       │
│  └── *.md               (user-facing)        │
└─────────────────────────────────────────────┘
```

## Prompt Template Format

### File Structure

Every prompt template is a Markdown file with YAML frontmatter:

```markdown
---
name: work_item_enhancer
description: Improve work item descriptions for AI readiness
version: 1
arguments:
  Title:
    type: string
    required: true
    description: Work item title
  Description:
    type: string
    required: false
    description: Current description
  WorkItemType:
    type: string
    required: false
    default: Task
    description: Type of work item
---

# Your Role

You are an expert at writing clear, actionable work item descriptions...

## Input

Title: {{Title}}
Type: {{WorkItemType}}
Current Description: {{Description}}

## Task

Enhance this work item to make it clear and actionable...
```

### Metadata Schema

```yaml
name: string            # Unique identifier (required)
description: string     # Human-readable description (required)
version: number         # Template version (required)
arguments:              # Input parameters (required)
  <param_name>:
    type: string | number | boolean
    required: boolean
    description: string
    default: any (optional)
```

### Variable Substitution

Variables are enclosed in double curly braces: `{{VariableName}}`

**Supported Syntax:**
- `{{Variable}}` - Simple substitution
- `{{Variable|default:value}}` - With default value
- `{{#if Variable}}...{{/if}}` - Conditional sections

**Example:**
```markdown
## Analysis for {{Title}}

{{#if Description}}
Current description: {{Description}}
{{else}}
No description provided.
{{/if}}

Type: {{WorkItemType|default:Task}}
```

## Prompt Categories

### 1. User-Facing Prompts

**Location:** `/mcp_server/prompts/*.md`

**Exposed via:** MCP Prompts API

**Purpose:** Direct user interaction

**Examples:**
- `work_item_enhancer.md` - Enhance work item descriptions
- `ai_suitability_analyzer.md` - Analyze AI assignment fit
- `security_items_analyzer.md` - Security item analysis

**Usage:**
```typescript
// Client requests prompt
const prompt = await getPrompt('work_item_enhancer', {
  Title: 'Fix login bug',
  Description: 'Button not working'
});

// Client sends to LLM
const response = await llm.complete(prompt.content);
```

### 2. System Prompts

**Location:** `/mcp_server/prompts/system/*.md`

**Not exposed to users**

**Purpose:** Internal AI features

**Examples:**
- `ai-assignment-analyzer.md` - Assignment suitability
- `completeness-analyzer.md` - Work item completeness
- `feature-decomposer.md` - Feature breakdown
- `hierarchy-validator.md` - Hierarchy validation

**Usage:**
```typescript
// Internal use by sampling service
const systemPrompt = await loadSystemPrompt('ai-assignment-analyzer');
const result = await samplingService.analyzWithPrompt(systemPrompt, data);
```

## Prompt Service API

### Load Prompt

```typescript
async function getPrompt(
  name: string, 
  variables: Record<string, any>
): Promise<ParsedPrompt>
```

**Returns:**
```typescript
{
  name: string;
  description: string;
  version: number;
  arguments: Record<string, PromptArgument>;
  content: string;  // Rendered with variables
}
```

### List Available Prompts

```typescript
function listPrompts(): Promise<string[]>
```

Returns array of prompt names.

### Validate Arguments

```typescript
function validateArguments(
  name: string,
  args: Record<string, any>
): ValidationResult
```

Checks required arguments and types.

## Prompt Design Guidelines

### 1. Structure

Every prompt should have:
- **Role Definition**: Who the AI is
- **Context**: Background information
- **Input**: Data to analyze
- **Task**: What to do
- **Output Format**: Expected structure
- **Examples**: 1-2 examples (optional)
- **Constraints**: Limitations

### 2. Clarity

- Use clear, direct language
- Avoid ambiguity
- Define technical terms
- Provide context

### 3. Output Format

Specify structured output:
```markdown
## Output Format

Provide your analysis as JSON:

```json
{
  "suitable": boolean,
  "score": number,
  "reasoning": string,
  "recommendations": string[]
}
```
```

### 4. Examples

Include 1-2 examples:
```markdown
## Example

Input:
- Title: "Fix login button"
- Type: Bug

Output:
```json
{
  "suitable": true,
  "score": 85,
  "reasoning": "Well-defined bug with clear scope"
}
```
```

## Available Prompts

### User-Facing

| Prompt | Purpose | Key Parameters |
|--------|---------|----------------|
| `work_item_enhancer` | Enhance work item descriptions | Title, Description, WorkItemType |
| `ai_suitability_analyzer` | Determine AI suitability | Title, Description, Complexity |
| `security_items_analyzer` | Analyze security items | AreaPath, ScanType |

### System

| Prompt | Purpose | Used By |
|--------|---------|---------|
| `ai-assignment-analyzer` | Detailed AI suitability | `wit-ai-assignment-analyzer` |
| `completeness-analyzer` | Work item completeness | `wit-intelligence-analyzer` |
| `ai-readiness-analyzer` | AI readiness scoring | `wit-intelligence-analyzer` |
| `enhancement-analyzer` | Enhancement suggestions | `wit-intelligence-analyzer` |
| `categorization-analyzer` | Smart categorization | `wit-intelligence-analyzer` |
| `full-analyzer` | Complete analysis | `wit-intelligence-analyzer` |
| `feature-decomposer` | Feature breakdown | `wit-feature-decomposer` |
| `hierarchy-validator` | Hierarchy validation | `wit-hierarchy-validator` |

## Implementation Details

### File Loading

```typescript
// Sync loading at startup for better performance
const promptFiles = fs.readdirSync(promptsDir)
  .filter(f => f.endsWith('.md'));

for (const file of promptFiles) {
  const content = fs.readFileSync(path.join(promptsDir, file), 'utf8');
  const parsed = parsePromptFile(content);
  promptCache.set(parsed.name, parsed);
}
```

### Parsing

```typescript
function parsePromptFile(content: string): ParsedPrompt {
  // Extract YAML frontmatter
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  if (!match) {
    throw new Error('Invalid prompt format: missing frontmatter');
  }
  
  const metadata = yaml.parse(match[1]);
  const template = match[2];
  
  return {
    name: metadata.name,
    description: metadata.description,
    version: metadata.version,
    arguments: metadata.arguments,
    content: template
  };
}
```

### Variable Substitution

```typescript
function renderTemplate(
  template: string, 
  variables: Record<string, any>
): string {
  let rendered = template;
  
  // Simple substitution: {{Variable}}
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(regex, String(value));
  }
  
  // Handle defaults: {{Variable|default:value}}
  rendered = rendered.replace(
    /\{\{(\w+)\|default:([^}]+)\}\}/g,
    (_, varName, defaultValue) => {
      return variables[varName] !== undefined 
        ? String(variables[varName])
        : defaultValue;
    }
  );
  
  return rendered;
}
```

## Caching Strategy

### In-Memory Cache

```typescript
const promptCache = new Map<string, ParsedPrompt>();

// Load all prompts at startup
function loadAllPrompts() {
  const files = fs.readdirSync(promptsDir);
  for (const file of files) {
    const prompt = parsePromptFile(file);
    promptCache.set(prompt.name, prompt);
  }
}

// Get from cache
function getPrompt(name: string): ParsedPrompt {
  if (!promptCache.has(name)) {
    throw new Error(`Prompt not found: ${name}`);
  }
  return promptCache.get(name)!;
}
```

### Cache Invalidation

- **Development**: Reload on file change
- **Production**: Load once at startup
- **Manual**: `reloadPrompts()` function

## Error Handling

### Missing Prompt

```typescript
if (!promptCache.has(name)) {
  return {
    success: false,
    errors: [`Prompt template '${name}' not found`],
    data: null
  };
}
```

### Missing Variables

```typescript
const required = Object.entries(prompt.arguments)
  .filter(([_, arg]) => arg.required)
  .map(([name]) => name);

const missing = required.filter(name => !(name in variables));

if (missing.length > 0) {
  return {
    success: false,
    errors: [`Missing required arguments: ${missing.join(', ')}`],
    data: null
  };
}
```

### Invalid Metadata

```typescript
try {
  const metadata = yaml.parse(frontmatter);
  validateMetadata(metadata);
} catch (error) {
  throw new Error(`Invalid prompt metadata: ${error.message}`);
}
```

## Testing

### Unit Tests

```typescript
describe('Prompt Service', () => {
  it('should load prompt from file', () => {
    const prompt = loadPrompt('work_item_enhancer');
    expect(prompt.name).toBe('work_item_enhancer');
  });
  
  it('should substitute variables', () => {
    const rendered = renderTemplate(
      '{{Title}} - {{Type}}',
      { Title: 'Test', Type: 'Bug' }
    );
    expect(rendered).toBe('Test - Bug');
  });
  
  it('should validate required arguments', () => {
    expect(() => {
      validateArguments('work_item_enhancer', {});
    }).toThrow('Missing required arguments: Title');
  });
});
```

### Integration Tests

```typescript
describe('Prompt Integration', () => {
  it('should render full prompt with sampling', async () => {
    const result = await samplingService.analyzeWorkItem({
      Title: 'Test Item',
      Description: 'Test description'
    });
    expect(result.success).toBe(true);
  });
});
```

## Best Practices

### Creating New Prompts

1. **Start with metadata**: Define clear arguments
2. **Write role definition**: Set context for AI
3. **Be specific**: Clear tasks and output format
4. **Include examples**: Show expected results
5. **Test thoroughly**: Verify with real data
6. **Version control**: Increment version on changes

### Maintaining Prompts

1. **Track changes**: Document modifications
2. **Test regressions**: Ensure backwards compatibility
3. **Monitor quality**: Check LLM output quality
4. **Gather feedback**: Learn from usage patterns
5. **Iterate**: Continuously improve

### Performance Optimization

1. **Keep prompts concise**: Faster LLM processing
2. **Cache parsed templates**: Avoid repeated parsing
3. **Lazy load**: Only load when needed
4. **Batch operations**: Combine related prompts

## Future Enhancements

1. **Prompt Versioning**: Support multiple versions
2. **A/B Testing**: Compare prompt variations
3. **Analytics**: Track prompt effectiveness
4. **Dynamic Prompts**: Generate from code
5. **Prompt Chaining**: Compose complex workflows
6. **User Custom Prompts**: Allow user-defined templates

## Related Documentation

- [AI-Powered Features](./AI_POWERED_FEATURES.md)
- [Sampling Service](../docs/SAMPLING_SERVICE.md)
- [VS Code LLM API](https://code.visualstudio.com/api/extension-guides/language-model)

---

**Maintained by:** Enhanced ADO MCP Server Team  
**Last Review:** 2025-10-01
