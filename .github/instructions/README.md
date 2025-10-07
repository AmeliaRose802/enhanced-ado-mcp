# Custom Copilot Instructions

This directory contains directory-specific custom instructions for GitHub Copilot coding agent.

## How It Works

GitHub Copilot automatically applies these instructions when you work in specific areas of the repository. The instructions provide context-aware guidance, coding standards, and best practices for each directory.

## Available Instructions

### [`prompts.instructions.md`](./prompts.instructions.md)
**Applies to:** `mcp_server/prompts/**`

Guidelines for creating and modifying AI prompt templates:
- Prompt structure and format standards
- Output format specifications
- Efficiency guidelines for AI responses
- Testing and validation procedures

### [`services.instructions.md`](./services.instructions.md)
**Applies to:** `mcp_server/src/services/**` and `mcp_server/src/config/**`

Service layer implementation patterns:
- Service architecture and separation of concerns
- Handler implementation guidelines
- Configuration management
- Azure DevOps API integration patterns

### [`tests.instructions.md`](./tests.instructions.md)
**Applies to:** `mcp_server/test/**`

Testing standards and practices:
- Unit test structure and patterns
- Integration test guidelines
- Mocking strategies
- Test coverage goals

### [`documentation.instructions.md`](./documentation.instructions.md)
**Applies to:** `docs/**`

Documentation requirements and style guide:
- Feature specification requirements
- Documentation structure and formatting
- Style guide and conventions
- When to create/update documentation

### [`typescript.instructions.md`](./typescript.instructions.md)
**Applies to:** `mcp_server/src/**`

TypeScript coding standards:
- Type safety and Zod schema patterns
- Code organization and naming conventions
- Common design patterns
- Performance considerations

## Root-Level Instructions

### [`AGENTS.md`](../../AGENTS.md)
General project overview, build commands, and development workflow. Applies to all files when no more specific instruction exists.

### [`.github/copilot-instructions.md`](../copilot-instructions.md)
Main Copilot instructions including feature specification requirements and documentation policies.

## YAML Frontmatter

Each instruction file uses YAML frontmatter to specify which files it applies to:

```yaml
---
applyTo: "mcp_server/prompts/**"
description: "Optional description of these instructions"
---
```

The `applyTo` field uses glob patterns to match file paths.

## Instruction Priority

When multiple instructions could apply to a file, Copilot uses this priority order:

1. **Most specific path match** (deepest directory)
2. **`.instructions.md` files** in `.github/instructions/`
3. **`AGENTS.md`** in repository root
4. **`.github/copilot-instructions.md`** general instructions

## Adding New Instructions

To add instructions for a new area:

1. Create `<area>.instructions.md` in this directory
2. Add YAML frontmatter with `applyTo` glob pattern
3. Write comprehensive guidelines for that area
4. Test by working in the target directory
5. Update this README with the new instructions

## Feature Specification Requirement

**CRITICAL:** All instructions emphasize that when adding or modifying features, you MUST:

1. **Create/update feature spec** in `docs/feature_specs/<feature-name>.md`
2. **Update table of contents** in `docs/feature_specs/toc.yml`
3. **Document changes** including inputs, outputs, and behavior

This ensures all features are properly documented for users and other developers.

## References

- [GitHub Copilot Custom Instructions Documentation](https://docs.github.com/enterprise-cloud@latest/copilot/how-tos/custom-instructions/adding-repository-custom-instructions-for-github-copilot)
- [GitHub Blog: .instructions.md Support](https://github.blog/changelog/2025-07-23-github-copilot-coding-agent-now-supports-instructions-md-custom-instructions/)
- [GitHub Blog: AGENTS.md Support](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions/)

---

**Last Updated:** 2025-10-07
