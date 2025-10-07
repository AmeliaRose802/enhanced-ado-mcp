# 🤖 GitHub Copilot Assignment & Merge Guide

**Complete workflow for assigning work to GitHub Copilot agents and merging results**

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Assigning Work to Copilot](#assigning-work-to-copilot)
3. [Monitoring Progress](#monitoring-progress)
4. [Merging Completed PRs](#merging-completed-prs)
5. [Complete Workflow Examples](#complete-workflow-examples)
6. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Prerequisites
- GitHub CLI (`gh`) installed and authenticated
- PowerShell 7+ (pwsh)
- Repository cloned locally
- Scripts in workspace root:
  - `Assign-To-Copilot.ps1`
  - `Watch-Copilot-PRs.ps1`
  - `Merge-And-Push.ps1`

### Minimal Example
```powershell
# 1. Assign work to Copilot
.\Assign-To-Copilot.ps1 `
    -Title "feat: Add new feature" `
    -ProblemStatement "Implement XYZ in file ABC..."

# 2. Monitor PR (script outputs PR number)
.\Watch-Copilot-PRs.ps1 -PRNumbers 123

# 3. Merge when ready
.\Merge-And-Push.ps1 -PRNumbers 123 -ValidateLocally -PushUpstream
```

---

## 🎯 Assigning Work to Copilot

### Using the PowerShell Script (Recommended)

The `Assign-To-Copilot.ps1` script simplifies the assignment process:

```powershell
.\Assign-To-Copilot.ps1 `
    -Title "feat: Add item selection to query handle service" `
    -ProblemStatement "Enhance src/services/query-handle-service.ts to support item selection. Changes: (1) Update QueryHandleData interface to add itemContext... (2) Add new methods: getItemsByIndices()... (3) Update storage to include rich context..."
```

#### Parameters

- **`-Title`** (Required): PR title that describes the work
- **`-ProblemStatement`** (Required): Detailed description of what to implement
- **`-Owner`**: Repository owner (default: "AmeliaRose802")
- **`-Repo`**: Repository name (default: "enhanced-ado-mcp")
- **`-BaseRef`**: Branch to start from (default: "master")
- **`-WaitForCompletion`**: Block until Copilot finishes (uses Watch-Copilot-PRs.ps1)
- **`-PollIntervalSeconds`**: How often to check status when waiting (default: 30)

#### Writing Effective Problem Statements

A good problem statement should include:

1. **Specific files to modify**
   ```
   "Enhance src/services/query-handle-service.ts..."
   ```

2. **Exact changes needed** (numbered list)
   ```
   "(1) Update QueryHandleData interface to add: itemContext...
    (2) Add new methods: getItemsByIndices()...
    (3) Import types from src/types/work-items.ts"
   ```

3. **Validation steps**
   ```
   "Ensure all tests pass: npm test
    Ensure TypeScript compiles: npm run build"
   ```

4. **Success criteria**
   ```
   "All specified changes implemented, tests passing, no regressions"
   ```

#### Example: Assign Single Task
```powershell
.\Assign-To-Copilot.ps1 `
    -Title "test: Add unit tests for selection mechanisms" `
    -ProblemStatement "Add comprehensive unit tests for selection logic in src/services/query-handle-service.ts. Tests needed: (1) Test getItemsByIndices with valid/invalid indices. (2) Test getItemsByCriteria with various criteria. (3) Test edge cases: empty arrays, out of bounds, null values. (4) Ensure >95% coverage for selection code. All tests must pass."
```

#### Example: Assign and Wait
```powershell
# This will block until Copilot finishes, then prompt to merge
.\Assign-To-Copilot.ps1 `
    -Title "fix: Resolve merge conflict in schemas.ts" `
    -ProblemStatement "Resolve merge conflict in src/config/schemas.ts between feature/query-handles and master branches. Keep both sets of changes where possible." `
    -BaseRef "feature/query-handles" `
    -WaitForCompletion
```

### Using MCP Tool Directly (Alternative)

If you prefer using the MCP tool through GitHub Copilot chat:

```
Use tool: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "feat: Add new feature"
- base_ref: "master"
- problem_statement: "Detailed description..."
```

**When to use MCP tool directly:**
- You're already in a GitHub Copilot chat session
- You want to delegate to Copilot without leaving chat
- You need to use tool features not exposed in script

**When to use script:**
- You want a simple command-line workflow
- You want to wait for completion automatically
- You prefer PowerShell automation

---

## 👀 Monitoring Progress

### Using the Watch Script

The `Watch-Copilot-PRs.ps1` script continuously monitors PR status:

```powershell
.\Watch-Copilot-PRs.ps1 -PRNumbers 1,2,3,4
```

#### What It Shows

```
[14:23:15] Poll #12 (Monitor Running: 00:06:00)
═══════════════════════════════════════════════

  📋 PR #1 - tech-debt: Type analysis functions
     URL: https://github.com/AmeliaRose802/enhanced-ado-mcp/pull/1
     🤖 Copilot: Finished ✅
     ✓ Checks: Passed (3/3 passed)
     ✅ Mergeable
     👍 Approved
     🎉 READY FOR MERGE!

  📋 PR #2 - tech-debt: Type WIQL query handler
     URL: https://github.com/AmeliaRose802/enhanced-ado-mcp/pull/2
     🤖 Copilot: Working... ⏳
     ✓ Checks: Running (2/3 passed)
     ✅ Mergeable
     👀 Review required

═══════════════════════════════════════════════
  📊 Summary: 1/4 PRs ready
```

#### Script Behavior

- **Polls every 30 seconds** (configurable with `-PollIntervalSeconds`)
- **Exits when all PRs ready** (exit code 0)
- **Plays sound notification** when complete
- **Tracks state changes** (highlights when status updates)
- **Shows detailed CI status** (passed/failed/running)

#### Parameters

- **`-PRNumbers`** (Required): Array of PR numbers to monitor
- **`-Owner`**: Repository owner (default: "AmeliaRose802")
- **`-Repo`**: Repository name (default: "enhanced-ado-mcp")
- **`-PollIntervalSeconds`**: Polling frequency (default: 30)
- **`-MaxPolls`**: Maximum polls before timeout (default: 480 = ~4 hours)

#### Example: Monitor Multiple PRs
```powershell
# Monitor 4 PRs with 60-second intervals
.\Watch-Copilot-PRs.ps1 -PRNumbers 1,2,3,4 -PollIntervalSeconds 60
```

#### Example: Long-Running Monitor
```powershell
# Monitor with 8-hour timeout
.\Watch-Copilot-PRs.ps1 -PRNumbers 5,6,7 -MaxPolls 960
```

### Manual Monitoring

If you prefer manual checks:

```powershell
# Check specific PR
gh pr view 123 --repo AmeliaRose802/enhanced-ado-mcp

# List all open PRs
gh pr list --repo AmeliaRose802/enhanced-ado-mcp

# Check CI status
gh pr checks 123 --repo AmeliaRose802/enhanced-ado-mcp
```

---

## ✅ Merging Completed PRs

### Using the Merge Script (Recommended)

The `Merge-And-Push.ps1` script handles the complete merge workflow:

```powershell
.\Merge-And-Push.ps1 -PRNumbers 1,2,3,4 -ValidateLocally -PushUpstream
```

#### What It Does

1. **Validates each PR** is ready for merge:
   - State is OPEN
   - No merge conflicts
   - CI checks passed
   - Not blocked by reviews

2. **Optionally validates locally** (with `-ValidateLocally`):
   - Checks out PR branch
   - Runs `npm test`
   - Runs `npm run build`
   - Returns to master

3. **Merges PRs** in the order specified:
   - Uses specified merge method (squash/merge/rebase)
   - Optionally deletes branches
   - Reports success/failure

4. **Syncs repository** (with `-PushUpstream`):
   - Fetches all branches
   - Pulls latest master
   - Pushes any local commits

5. **Final validation**:
   - Runs tests on merged code
   - Verifies build succeeds

#### Parameters

- **`-PRNumbers`** (Required): Array of PR numbers to merge (in order)
- **`-Owner`**: Repository owner (default: "AmeliaRose802")
- **`-Repo`**: Repository name (default: "enhanced-ado-mcp")
- **`-MergeMethod`**: "squash" (default), "merge", or "rebase"
- **`-ValidateLocally`**: Run tests/build locally before merging
- **`-SkipValidation`**: Skip all validation (dangerous!)
- **`-DeleteBranch`**: Delete PR branch after merge (default: true)
- **`-PushUpstream`**: Sync local repo with remote after merge

#### Example: Basic Merge
```powershell
# Merge 4 PRs in order
.\Merge-And-Push.ps1 -PRNumbers 1,2,3,4
```

#### Example: Merge with Full Validation
```powershell
# Validate locally, merge, and sync
.\Merge-And-Push.ps1 -PRNumbers 5,6,7 -ValidateLocally -PushUpstream
```

#### Example: Merge with Dependency Order
```powershell
# Block 2: Agent 5 → Agent 7 → Agent 6 (dependency order)
.\Merge-And-Push.ps1 -PRNumbers 5,7,6 -ValidateLocally -PushUpstream
```

#### Example: Merge Using Rebase
```powershell
# Merge with rebase instead of squash
.\Merge-And-Push.ps1 -PRNumbers 8,9,10 -MergeMethod rebase
```

### Manual Merging

If you prefer manual control:

```powershell
# Merge single PR
gh pr merge 123 --repo AmeliaRose802/enhanced-ado-mcp --squash --delete-branch

# Merge with specific commit message
gh pr merge 123 --repo AmeliaRose802/enhanced-ado-mcp --squash --subject "feat: Add new feature" --delete-branch

# Merge and keep branch
gh pr merge 123 --repo AmeliaRose802/enhanced-ado-mcp --squash
```

---

## 🔄 Complete Workflow Examples

### Example 1: Single PR Workflow

**Scenario:** Implement a single feature

```powershell
# Step 1: Assign to Copilot
.\Assign-To-Copilot.ps1 `
    -Title "feat: Add query handle inspector enhancements" `
    -ProblemStatement "Enhance src/services/handlers/query-handles/inspect-query-handle.handler.ts to show indexed preview with selection hints..."

# Output: PR #12 created: https://github.com/AmeliaRose802/enhanced-ado-mcp/pull/12

# Step 2: Monitor progress
.\Watch-Copilot-PRs.ps1 -PRNumbers 12

# Wait for completion... (script exits when ready)

# Step 3: Merge with validation
.\Merge-And-Push.ps1 -PRNumbers 12 -ValidateLocally -PushUpstream

# ✅ Done! Feature is merged and tested
```

### Example 2: Parallel PRs with Dependencies

**Scenario:** Block 2 from orchestrator (3 agents with dependencies)

```powershell
# Step 1: Assign all 3 agents in parallel
.\Assign-To-Copilot.ps1 `
    -Title "feat: Add item selection to query handle service" `
    -ProblemStatement "Enhance query handle service..."

.\Assign-To-Copilot.ps1 `
    -Title "feat: Add itemSelector to bulk operation schemas" `
    -ProblemStatement "Add itemSelector parameter..."

.\Assign-To-Copilot.ps1 `
    -Title "feat: Store rich item context in query handles" `
    -ProblemStatement "Update WIQL query handler..."

# Output: PR #5, #6, #7 created

# Step 2: Monitor all PRs together
.\Watch-Copilot-PRs.ps1 -PRNumbers 5,6,7

# Wait for all to complete...

# Step 3: Merge in dependency order (Agent 5 → 7 → 6)
.\Merge-And-Push.ps1 -PRNumbers 5,7,6 -ValidateLocally -PushUpstream

# ✅ Done! Block 2 complete
```

### Example 3: Block Execution with Wait

**Scenario:** Execute entire block and wait for completion

```powershell
# Step 1: Assign Block 1 (4 agents)
$prNumbers = @()

$prNumbers += (.\Assign-To-Copilot.ps1 `
    -Title "tech-debt: Type analysis functions" `
    -ProblemStatement "..." | Select-String -Pattern "pull/(\d+)" | ForEach-Object { $_.Matches[0].Groups[1].Value })

$prNumbers += (.\Assign-To-Copilot.ps1 `
    -Title "tech-debt: Type WIQL query handler" `
    -ProblemStatement "..." | Select-String -Pattern "pull/(\d+)" | ForEach-Object { $_.Matches[0].Groups[1].Value })

$prNumbers += (.\Assign-To-Copilot.ps1 `
    -Title "tech-debt: Type AI-powered handlers" `
    -ProblemStatement "..." | Select-String -Pattern "pull/(\d+)" | ForEach-Object { $_.Matches[0].Groups[1].Value })

$prNumbers += (.\Assign-To-Copilot.ps1 `
    -Title "tech-debt: Type sampling client" `
    -ProblemStatement "..." | Select-String -Pattern "pull/(\d+)" | ForEach-Object { $_.Matches[0].Groups[1].Value })

# Step 2: Monitor all PRs (blocks until complete)
.\Watch-Copilot-PRs.ps1 -PRNumbers $prNumbers

# Step 3: Merge all (no dependencies in Block 1)
.\Merge-And-Push.ps1 -PRNumbers $prNumbers -ValidateLocally -PushUpstream

# ✅ Done! Block 1 complete
```

### Example 4: Autonomous Orchestrator Usage

**Scenario:** Orchestrator agent managing entire workflow

```powershell
# Orchestrator executes this for each block:

# 1. Create all PRs for the block
$block1PRs = @(1, 2, 3, 4)  # Created via Assign-To-Copilot.ps1 or MCP tool

# 2. Start blocking monitor (keeps orchestrator alive)
.\Watch-Copilot-PRs.ps1 -PRNumbers $block1PRs

# 3. When script exits, all PRs are ready - merge them
.\Merge-And-Push.ps1 -PRNumbers $block1PRs -ValidateLocally -PushUpstream

# 4. Proceed to next block immediately
$block2PRs = @(5, 6, 7)  # Next block...
.\Watch-Copilot-PRs.ps1 -PRNumbers $block2PRs
# ... and so on
```

---

## 🔧 Troubleshooting

### Script Not Found

**Problem:** `.\Assign-To-Copilot.ps1 : The term '.\Assign-To-Copilot.ps1' is not recognized...`

**Solution:**
```powershell
# Make sure you're in the workspace root
cd c:\Users\ameliapayne\ADO-Work-Item-MSP

# List scripts
ls *.ps1
```

### PR Creation Fails

**Problem:** `Failed to create PR: GraphQL: Resource not accessible by integration`

**Solution:**
```powershell
# Re-authenticate with GitHub CLI
gh auth login

# Ensure you have permissions
gh auth status
```

### Copilot Assignment Not Working

**Problem:** PR created but Copilot doesn't start working

**Solution:**
1. Open the PR in browser (script outputs URL)
2. Look for "Copilot" button or reviewer section
3. Manually assign GitHub Copilot as reviewer
4. Or use GitHub Copilot chat: `@github assign copilot to pull AmeliaRose802/enhanced-ado-mcp#123`

### CI Checks Failing

**Problem:** Watch script shows CI failures

**Solution:**
```powershell
# View CI logs
gh pr checks 123 --repo AmeliaRose802/enhanced-ado-mcp

# Or visit PR URL to see detailed errors
# Fix issues and push to PR branch, or close and recreate
```

### Merge Conflicts

**Problem:** Merge script reports conflicts

**Solution:**
```powershell
# Option 1: Update PR branch with latest master
gh pr checkout 123 --repo AmeliaRose802/enhanced-ado-mcp
git pull origin master
# Resolve conflicts manually
git push

# Option 2: Close PR and recreate with updated base
gh pr close 123 --repo AmeliaRose802/enhanced-ado-mcp
.\Assign-To-Copilot.ps1 -Title "..." -ProblemStatement "..."
```

### Tests Failing After Merge

**Problem:** Merge script shows tests failing

**Solution:**
```powershell
# Run tests locally to debug
cd mcp_server
npm test

# Check specific test output
npm test -- --verbose

# Fix issues and commit
git add .
git commit -m "fix: Resolve test failures"
git push origin master
```

### Script Hangs

**Problem:** Watch script seems stuck

**Solution:**
- Press `Ctrl+C` to cancel
- Check GitHub directly for PR status
- Restart with longer poll interval: `-PollIntervalSeconds 60`
- Check MaxPolls hasn't been reached

---

## 📚 Additional Resources

### Script Locations
- `Assign-To-Copilot.ps1` - Workspace root
- `Watch-Copilot-PRs.ps1` - Workspace root  
- `Merge-And-Push.ps1` - Workspace root

### Documentation
- **Orchestrator Chat Mode**: `ORCHESTRATOR_CHAT_MODE.md`
- **Orchestrator Script**: `orchestrator-script.md`
- **Quick Start Guide**: `QUICK_START_GUIDE.md`
- **Execution Plan**: `tasklist/orchestration-execution-plan.md`

### GitHub CLI Reference
```powershell
# View all gh pr commands
gh pr --help

# Check authentication
gh auth status

# View repository info
gh repo view AmeliaRose802/enhanced-ado-mcp
```

---

## 💡 Best Practices

### For Problem Statements
1. ✅ Be specific about files and changes
2. ✅ Include validation steps (tests, build)
3. ✅ Number the changes for clarity
4. ✅ Mention existing patterns to follow
5. ❌ Don't be vague or high-level
6. ❌ Don't assume Copilot knows project conventions

### For Monitoring
1. ✅ Use Watch script for multiple PRs
2. ✅ Set reasonable poll intervals (30-60s)
3. ✅ Do productive work while waiting
4. ❌ Don't poll too frequently (<10s)
5. ❌ Don't wait indefinitely (use MaxPolls)

### For Merging
1. ✅ Always use ValidateLocally for safety
2. ✅ Merge in dependency order when needed
3. ✅ Use PushUpstream to keep in sync
4. ✅ Squash commits for clean history
5. ❌ Don't skip validation unless certain
6. ❌ Don't merge conflicts without testing

---

**Status:** ✅ Ready for use  
**Last Updated:** October 6, 2025  
**Maintained by:** Orchestrator Agent

---

## 🎯 Quick Command Reference

```powershell
# Assign work
.\Assign-To-Copilot.ps1 -Title "..." -ProblemStatement "..."

# Monitor progress
.\Watch-Copilot-PRs.ps1 -PRNumbers 1,2,3

# Merge when ready
.\Merge-And-Push.ps1 -PRNumbers 1,2,3 -ValidateLocally -PushUpstream

# All-in-one (assign and wait)
.\Assign-To-Copilot.ps1 -Title "..." -ProblemStatement "..." -WaitForCompletion
```

**That's it! You're ready to delegate work to GitHub Copilot agents! 🚀**
