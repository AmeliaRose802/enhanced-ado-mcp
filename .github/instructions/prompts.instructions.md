---
applyTo: "mcp_server/prompts/**"
---

# Prompt Engineering Instructions

This directory contains prompt templates used by the MCP server's AI-powered features.

## Prompt Template Structure

### System Prompts (`prompts/system/`)

**Purpose:** Define AI behavior, response format, and analysis criteria

**Standard Format:**
```markdown
You are a [role] analyzing [subject].

**IMPORTANT:** [Critical constraints or warnings]

**EFFICIENCY GUIDELINES:**
- Be concise: [guideline]
- Focus on essentials: [guideline]
- Avoid repetition: [guideline]

Return ONLY a JSON object (no markdown, no additional text) with this structure:
{
  "field1": "value",
  "field2": <number>,
  "field3": ["array", "items"]
}

Guidelines:
[Detailed analysis guidelines]
```

**Key Sections:**
1. **Role Definition** - Who the AI is
2. **Important Constraints** - Critical rules (e.g., ignore completed items)
3. **Efficiency Guidelines** - Keep responses concise
4. **Output Format** - Exact JSON structure expected
5. **Analysis Guidelines** - How to perform the analysis

### User Prompts (`prompts/` root)

**Purpose:** Multi-turn agent prompts for complex workflows

**Standard Format:**
```markdown
# [Feature Name]

## Purpose
[What this prompt helps accomplish]

## Usage
[When and how to use this]

## Workflow
1. [Step one]
2. [Step two]
...

## Example Commands
[Concrete examples of usage]
```

## Prompt Engineering Best Practices

### 1. Output Format Specification

✅ **Always specify exact JSON structure:**
```markdown
Return ONLY a JSON object with this structure:
{
  "decision": "AI_FIT|HUMAN_FIT|HYBRID",
  "confidence": <0.0-1.0>,
  "reasons": ["brief", "points"]
}
```

❌ **Avoid vague instructions:**
```markdown
Analyze the work item and return your findings.
```

### 2. Efficiency Guidelines

Include these in every system prompt:
- **Be concise** - Limit response length (1-2 sentences per point)
- **Focus on essentials** - Only critical information
- **Avoid repetition** - Each point adds unique value

### 3. Constraint Handling

**Important constraints go at the top:**
```markdown
**IMPORTANT: Only analyze active work items. Ignore Done/Closed/Completed items.**
```

### 4. Variable Substitution

Use `{{variableName}}` for dynamic content:
```markdown
Analyzing work item {{workItemId}}:

Title: {{title}}
Description: {{description}}
```

### 5. Response Format Enforcement

**Always specify "no markdown, no additional text":**
```markdown
Return ONLY a JSON object (no markdown, no additional text)
```

This prevents the AI from wrapping responses in code blocks.

## Prompt Categories

### Analysis Prompts
- `ai-assignment-analyzer.md` - Evaluate AI suitability
- `ai-readiness-analyzer.md` - Check if item is ready for AI
- `completeness-analyzer.md` - Assess item completeness
- `enhancement-analyzer.md` - Suggest improvements

### Generation Prompts
- `acceptance-criteria-generator.md` - Create testable criteria
- `description-enhancer.md` - Improve descriptions
- `story-point-estimator.md` - Estimate effort

### Workflow Prompts
- `unified_work_item_analyzer.md` - Comprehensive analysis
- `sprint_planning_analyzer.md` - Plan sprint contents

## Creating New Prompts

### For System Prompts

1. **Copy Template** from existing system prompt
2. **Define Role** - Be specific about AI's expertise
3. **Specify Output** - Exact JSON structure with types
4. **Add Guidelines** - Clear analysis criteria
5. **Test Output** - Verify JSON parsability
6. **Create Feature Spec** - Document in `docs/feature_specs/`

### For User Prompts

1. **Define Purpose** - What problem does this solve?
2. **Document Workflow** - Step-by-step process
3. **Provide Examples** - Concrete usage scenarios
4. **Reference Tools** - Which MCP tools to use
5. **Create Feature Spec** - Document in `docs/feature_specs/`

## Modifying Existing Prompts

**REQUIRED Steps:**
1. Update the prompt file
2. Update corresponding feature spec in `docs/feature_specs/`
3. Test with actual tool invocations
4. Verify JSON output is still parsable
5. Update related documentation if behavior changes

## Testing Prompts

### Manual Testing
```bash
# Build server
cd mcp_server && npm run build

# Run tool that uses the prompt
# Use MCP inspector or direct tool invocation
```

### Validation Checklist
- [ ] JSON output is parsable
- [ ] All required fields are present
- [ ] Field types match schema expectations
- [ ] Efficiency guidelines reduce verbosity
- [ ] Constraints are respected
- [ ] Variable substitution works correctly

## Common Issues & Solutions

### Issue: AI Returns Markdown-Wrapped JSON
**Solution:** Add explicit instruction:
```markdown
Return ONLY a JSON object (no markdown, no additional text)
```

### Issue: Verbose Responses
**Solution:** Add efficiency guidelines section:
```markdown
**EFFICIENCY GUIDELINES:**
- Be concise: Keep reasons to 1-2 sentences
- Focus on essentials: Only critical information
- Avoid repetition: Each point adds unique value
```

### Issue: Ignoring Constraints
**Solution:** Use bold IMPORTANT at top:
```markdown
**IMPORTANT: [Critical constraint in prominent location]**
```

### Issue: Inconsistent Output Format
**Solution:** Show example with type annotations:
```markdown
{
  "field": "value",           // string
  "score": <0-100>,          // number
  "items": ["a", "b"]        // array of strings
}
```

## Prompt Versioning

When making breaking changes to prompt output:
1. Consider backward compatibility
2. Update dependent analyzers/handlers
3. Update tests that parse output
4. Update feature spec with new format
5. Note version in git commit message

## File Naming Conventions

- System prompts: `kebab-case.md` (e.g., `ai-assignment-analyzer.md`)
- User prompts: `snake_case.md` (e.g., `sprint_planning_analyzer.md`)
- Keep names descriptive and specific
- Avoid generic names like `prompt1.md`

## Integration with Code

Prompts are loaded by `prompt-service.ts`:
```typescript
const prompt = await promptService.loadPrompt('ai-assignment-analyzer');
const rendered = await promptService.renderPrompt(prompt, variables);
```

When creating a new prompt:
1. Add prompt file to `prompts/` directory
2. Reference by filename (without `.md`)
3. Provide variables for substitution
4. Parse JSON response in handler

## Documentation Requirements

### Feature Specs
Every prompt that powers an MCP tool MUST have a feature spec at:
`docs/feature_specs/<tool-name>.md`

Include:
- Prompt purpose and use case
- Input variables required
- Output format with field descriptions
- Example request/response
- Error handling scenarios
- Integration with tool handler

### Resource Guides
Complex prompts should have quick reference in:
`mcp_server/resources/<prompt-topic>-guide.md`

Include:
- When to use this prompt
- How to invoke the tool
- Common usage patterns
- Troubleshooting tips

---

**Last Updated:** 2025-10-07
