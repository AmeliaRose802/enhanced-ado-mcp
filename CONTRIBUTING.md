# Contributing Guidelines

## Code Organization

```
ADO-Work-Item-MSP/
├── docs/              # Essential documentation only
├── mcp_server/        # Server implementation
│   ├── src/           # TypeScript source
│   ├── prompts/       # AI prompt templates
│   └── resources/     # Quick reference guides
├── tasklist/          # Development notes (don't touch unless asked)
└── README.md          # Main documentation
```

## Documentation Rules

### ❌ DO NOT CREATE:
- `*_SUMMARY.md` files
- `*_COMPLETE.md` files
- `*_REPORT.md` files
- `IMPLEMENTATION_STATUS.md`
- Changelog files (use git commits)
- Verbose architecture docs
- Duplicate guides

### ✅ INSTEAD:
- Update existing documentation
- Use clear git commit messages
- Keep docs concise and actionable
- Put details in code comments
- Focus on HOW to use, not implementation history

## File Placement

- **User documentation** → `/docs`
- **Code** → `/mcp_server/src`
- **Tests** → `/mcp_server/src/test`
- **Prompts** → `/mcp_server/prompts`
- **Quick references** → `/mcp_server/resources`
- **Task tracking** → `/tasklist` (rarely modified)

## Documentation Standards

1. **Be concise** - Get to the point quickly
2. **Show examples** - Code speaks louder than words
3. **No redundancy** - One source of truth
4. **Maintainable** - Update existing docs, don't create new ones
5. **Git history** - Implementation details belong in commits

## Before Creating New Docs

1. Can this update an existing doc?
2. Is this essential for users?
3. Will this stay relevant?
4. Does it have clear examples?

If you answered "no" to any, reconsider creating it.

## Code Standards

- Use TypeScript, not PowerShell
- Follow existing patterns
- Write tests for new features
- Keep functions focused and small
- Use meaningful variable names

## Commit Messages

Good:
```
feat: Add bulk comment tool for work items
fix: Handle escaped area paths correctly
docs: Update WIQL best practices
```

Bad:
```
Updated files
Made some changes
Fixed stuff
```

## Questions?

See `.github/copilot-instructions.md` for AI assistant guidelines.
