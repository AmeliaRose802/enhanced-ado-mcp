# Pre-commit Hooks with Husky

This repository uses [Husky](https://typicode.github.io/husky/) to enforce code quality standards before commits are made.

## What Gets Checked

When you commit TypeScript files in the `mcp_server/` directory, the pre-commit hook automatically:

1. **Formatting Check** - Verifies code follows Prettier formatting rules
2. **Linting** - Runs ESLint to catch code quality issues

## How It Works

- Only **staged TypeScript files** (`.ts`, `.tsx`) are checked
- Checks are **fast** - only your changed files are validated
- Commits are **blocked** if formatting issues are found
- Commits **proceed** with linting warnings (only errors block)

## Fixing Issues

If your commit is blocked, you'll see helpful error messages:

### Fixing Formatting Issues

```bash
cd mcp_server

# Fix a specific file
npx prettier --write src/path/to/file.ts

# Or fix all files
npm run format
```

### Fixing Linting Issues

```bash
cd mcp_server

# Fix a specific file
npx eslint --fix src/path/to/file.ts

# Or attempt to fix all files
npm run lint:fix
```

## Configuration Files

- **`.husky/pre-commit`** - The pre-commit hook script
- **`package.json`** - Root workspace configuration with Husky
- **`mcp_server/.prettierrc`** - Prettier formatting rules
- **`mcp_server/.eslintrc.json`** - ESLint linting rules

## Available Commands

From the **root directory**:
```bash
npm run lint          # Run linter on mcp_server
npm run format        # Auto-format code in mcp_server
npm run format:check  # Check formatting without changing files
npm run build         # Build the project
npm run test          # Run tests
```

From **mcp_server directory**:
```bash
npm run lint          # Run ESLint
npm run lint:fix      # Auto-fix linting issues
npm run format        # Auto-format all TypeScript files
npm run format:check  # Check formatting without changes
npm run build         # Build the project
npm test              # Run tests
```

## Skipping Hooks (Not Recommended)

In rare cases where you need to bypass the pre-commit checks:

```bash
git commit --no-verify -m "Your commit message"
```

⚠️ **Warning**: Only use `--no-verify` when absolutely necessary. Code quality checks exist to maintain consistency and catch issues early.

## Installation

The hooks are automatically installed when you run `npm install` in the root directory (via the `prepare` script).

If you need to reinstall hooks manually:
```bash
npx husky install
```

## Benefits

✅ **Consistent Code Style** - All code follows the same formatting rules  
✅ **Catch Issues Early** - Find problems before they reach the repository  
✅ **Automated Enforcement** - No manual checking needed  
✅ **Fast Feedback** - Know immediately if something needs fixing  
✅ **Better Reviews** - Focus on logic, not style in code reviews

## Troubleshooting

### Hook Not Running

If the pre-commit hook doesn't run:
1. Check `.husky/pre-commit` exists and is executable
2. Run `npx husky install` to reinstall hooks
3. Verify you're in a git repository

### Permission Issues

If you get permission errors:
```bash
chmod +x .husky/pre-commit
```

### Node Modules Not Found

Make sure dependencies are installed:
```bash
npm install  # in root directory
cd mcp_server && npm install  # in mcp_server directory
```
