# 🤖 Orchestrator Script - Self-Sustaining Execution
**For: GitHub Copilot (Amelia's Orchestration Agent)**  
**Purpose:** Run autonomously for 8+ hours coordinating multiple agents  
**Status:** Ready to Execute

---

## ⚡ Quick Start for Orchestrators

**NEW: PowerShell scripts available for easier execution!**

### Essential Commands
```powershell
# 1. Assign work to Copilot agent
.\Assign-To-Copilot.ps1 -Title "feat: ..." -ProblemStatement "..."

# 2. Monitor PR progress (blocks until complete)
.\Watch-Copilot-PRs.ps1 -PRNumbers 1,2,3,4

# 3. Merge completed PRs
.\Merge-And-Push.ps1 -PRNumbers 1,2,3,4 -ValidateLocally -PushUpstream
```

### Important References
- 📖 **Complete guide**: See `COPILOT-ASSIGNMENT-GUIDE.md` for detailed instructions
- 🛠️ **Scripts**: `Assign-To-Copilot.ps1`, `Watch-Copilot-PRs.ps1`, `Merge-And-Push.ps1`
- 📋 **Execution plan**: See BLOCK sections below for all agent assignments

---

## 🎯 Your Mission

You are the **orchestrator agent** responsible for coordinating multiple GitHub Copilot coding agents to complete the technical debt remediation plan. You will:

1. **Create PRs** by delegating to GitHub Copilot agents
2. **Poll for completion** while doing productive work
3. **Merge PRs** when ready and validated
4. **Repeat** for the next block

**Expected Runtime:** 17-22 hours wall time  
**Your Active Time:** ~7-8 hours (rest is waiting/polling)  
**Number of Blocks:** 6 blocks  
**Number of Agents:** 23 total agent tasks

---

## 📋 Quick Reference

### Current Block Status
- **BLOCK 1:** ⏸️ NOT STARTED - Type Safety Foundation (4 agents)
- **BLOCK 2:** ⏸️ WAITING - Query Handle Architecture Phase 1 (3 agents)
- **BLOCK 3:** ⏸️ WAITING - Query Handle Architecture Phase 2 (4 agents)
- **BLOCK 4:** ⏸️ WAITING - Enhanced UX & Documentation (5 agents)
- **BLOCK 5:** ⏸️ WAITING - Comprehensive Testing (3 agents)
- **BLOCK 6:** ⏸️ WAITING - Cleanup & Polish (4 agents)

### Key Files
- **Execution Plan:** `tasklist/orchestration-execution-plan.md`
- **Tech Debt Plan:** `tasklist/tech-debt-remediation-plan.md`
- **Architecture Plan:** `tasklist/architecture-fix-plan.md`
- **This Script:** `orchestrator-script.md`
- **Copilot Assignment Guide:** `COPILOT-ASSIGNMENT-GUIDE.md` ⭐ **ESSENTIAL REFERENCE**

### Helper Scripts
- **`Assign-To-Copilot.ps1`** - Create PRs and assign to GitHub Copilot agents
- **`Watch-Copilot-PRs.ps1`** - Monitor PR progress with detailed status
- **`Merge-And-Push.ps1`** - Merge completed PRs with validation and sync

---

## 🚀 BLOCK 1: Type Safety Foundation

### Status: ⏸️ READY TO START

### Agents to Assign (4 parallel PRs)

#### Agent 1: Type Analysis Functions
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "tech-debt: Type analysis functions with WorkItemAnalysis interfaces"
- base_ref: "master"
- problem_statement: "Replace all 'any' types in src/services/handlers/analysis/analyze-by-query-handle.handler.ts with proper types from src/types/work-items.ts. Specifically: (1) Replace const analysis: any = { ... } with const analysis: WorkItemAnalysis = { ... }. (2) Type all 6 analysis functions: analyzeEffort, analyzeVelocity, analyzeAssignments, analyzeRisks, analyzeCompletion, analyzePriorities. (3) Import WorkItemAnalysis and related types from src/types/work-items.ts. (4) Ensure all tests pass: npm test. (5) Ensure TypeScript compiles: npm run build. The types are already fully defined in src/types/work-items.ts - just need to apply them."
```

#### Agent 2: Type WIQL Query Handler
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "tech-debt: Type WIQL query handler with WorkItemContext types"
- base_ref: "master"
- problem_statement: "Replace 'any' types in src/services/handlers/query/wiql-query.handler.ts. Specifically: (1) Line 38: Change 'let fullPackages: any[] | undefined' to 'let fullPackages: WorkItemContextPackage[] | undefined'. (2) Line 84: Change 'const workItemContext = new Map<number, any>()' to 'const workItemContext = new Map<number, WorkItemContext>()'. (3) Import WorkItemContext and WorkItemContextPackage from src/types/work-items.ts. (4) Ensure all tests pass: npm test. (5) Ensure TypeScript compiles: npm run build."
```

#### Agent 3: Type AI-Powered Bulk Handlers
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "tech-debt: Type AI-powered handler server parameters"
- base_ref: "master"
- problem_statement: "Replace 'server: any' parameters in 3 bulk AI handlers: (1) src/services/handlers/ai-powered/bulk-add-acceptance-criteria.handler.ts, (2) src/services/handlers/ai-powered/bulk-assign-story-points.handler.ts, (3) src/services/handlers/ai-powered/bulk-enhance-descriptions.handler.ts. Changes needed: (1) Check if MCPServer type exists in src/types/mcp.ts (if not, define it). (2) Replace 'export async function handleX(..., server: any)' with 'export async function handleX(..., server: MCPServer)'. (3) Remove 'as any' type assertions for HTTP response data. (4) Use ADOWorkItem type from src/types/ado.ts for response.data where appropriate. (5) Ensure all tests pass: npm test. (6) Ensure TypeScript compiles: npm run build."
```

#### Agent 4: Type Sampling Client
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "tech-debt: Type sampling client with proper server interface"
- base_ref: "master"
- problem_statement: "Replace 'any' types in src/utils/sampling-client.ts. Changes needed: (1) Replace 'constructor(private server: any)' with 'constructor(private server: MCPServer)' using proper type from src/types/mcp.ts. (2) Replace 'async createMessage(request: SamplingRequest): Promise<any>' with proper return type (define SamplingResponse interface if needed). (3) Import MCPServer type from src/types/mcp.ts. (4) Ensure all tests pass: npm test. (5) Ensure TypeScript compiles: npm run build."
```

### Execution Steps for Block 1

1. **Create all 4 PRs** using the assignment script:
   ```powershell
   # Option A: Using PowerShell script (recommended for ease of use)
   .\Assign-To-Copilot.ps1 -Title "..." -ProblemStatement "..."
   
   # Option B: Using MCP tool directly (via GitHub Copilot chat)
   # Use mcp_github_create_pull_request_with_copilot with parameters above
   ```

2. **Save PR numbers** somewhere you can reference (script will output them)

3. **Monitor PR progress** using the watch script:
   ```powershell
   .\Watch-Copilot-PRs.ps1 -PRNumbers 1,2,3,4
   ```
   This script will:
   - Poll every 30 seconds
   - Show detailed status for each PR
   - Exit when all PRs are ready
   - Play a sound notification

4. **Wait for all 4 PRs to complete** (agents will work in parallel)
   - Script blocks until completion
   - Do productive work while waiting
   - Review PRs as they complete

5. **Merge all 4 PRs** using the merge script:
   ```powershell
   # Merge with validation and sync
   .\Merge-And-Push.ps1 -PRNumbers 1,2,3,4 -ValidateLocally -PushUpstream
   ```
   This script will:
   - Validate each PR is ready
   - Optionally run tests locally
   - Merge PRs in order
   - Delete merged branches
   - Pull latest changes
   - Run final validation

6. **Validate integration:**
   ```powershell
   cd mcp_server
   npm test  # Must show 99/99 passing
   npm run build  # Must succeed
   ```
   (Note: Merge script does this automatically with -ValidateLocally flag)

7. **Update status in tech-debt-remediation-plan.md**

8. **Move to BLOCK 2**

### Expected Timeline
- PR creation: 5 minutes
- Agent work: 4-6 hours (parallel)
- Review & merge: 30-60 minutes
- **Total:** ~5-7 hours

---

## 🔄 Polling Loop (While Waiting for PRs)

### Every 5-10 Minutes

1. **Check PR status:**
   ```
   Use: mcp_github_list_notifications
   Look for: Pull request updates, review requests, CI completion
   ```

2. **Check specific PRs:**
   ```
   Use GitHub tools to check PR status
   Look for: CI passing, conflicts, agent completion
   ```

3. **Do productive work while waiting:**
   - Review completed PRs
   - Prepare next block problem statements
   - Update documentation
   - Analyze integration points
   - Read code to understand context

### When PR Completes

1. **Validate CI passed:**
   - Check all GitHub Actions successful
   - No merge conflicts
   - Tests passing

2. **Review PR:**
   - Check code changes make sense
   - Verify types applied correctly
   - Look for any issues

3. **Add review comments if needed:**
   ```
   Use GitHub PR tools to comment
   ```

4. **Approve PR:**
   - If all looks good, approve
   - If issues, request changes

### When All PRs in Block Complete

1. **Merge PRs in dependency order:**
   - Block 1: Any order (no dependencies)
   - Block 2: Agent 5 → Agent 7 → Agent 6
   - Block 3: Any order
   - Block 4: Any order
   - Block 5: Any order
   - Block 6: Any order

2. **Run integration tests:**
   ```powershell
   npm test
   npm run build
   ```

3. **Update status documents**

4. **Move to next block**

---

## 🚀 BLOCK 2: Query Handle Architecture Phase 1

### Status: ⏸️ WAITING FOR BLOCK 1

### Prerequisites
- ✅ Block 1 merged successfully
- ✅ All tests passing (99/99)
- ✅ TypeScript compilation succeeds

### Agents to Assign (3 parallel PRs)

#### Agent 5: Enhanced Query Handle Service
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "feat: Add item selection to query handle service"
- base_ref: "master"
- problem_statement: "Enhance src/services/query-handle-service.ts to support item selection. Changes: (1) Update QueryHandleData interface to add: itemContext: Array<{ index: number, id: number, title: string, state: string, type: string, daysInactive?: number, lastChange?: string, tags?: string[] }>, and selectionMetadata: { totalItems: number, selectableIndices: number[], criteriaTags: string[] }. (2) Add new methods: getItemsByIndices(handle: string, indices: number[]): number[], getItemsByCriteria(handle: string, criteria: SelectionCriteria): number[], getSelectableIndices(handle: string): number[], getItemContext(handle: string, index: number): ItemContext | undefined. (3) Update storage to include rich context when creating handles. See tasklist/architecture-fix-plan.md Phase 1 Task 1.1 for details. Ensure all tests pass and add unit tests for new methods."
```

#### Agent 6: Enhanced Bulk Operation Schemas
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "feat: Add itemSelector to bulk operation schemas"
- base_ref: "master"
- problem_statement: "Add itemSelector parameter to bulk operation schemas in src/config/schemas.ts. Changes: (1) Define ItemSelectorSchema: z.union([z.literal('all'), z.array(z.number()).max(100), z.object({ states: z.array(z.string()).optional(), titleContains: z.array(z.string()).optional(), tags: z.array(z.string()).optional(), daysInactiveMin: z.number().optional(), daysInactiveMax: z.number().optional() })]). (2) Add itemSelector parameter (default 'all') to these schemas: bulkCommentByQueryHandleSchema, bulkRemoveByQueryHandleSchema, bulkUpdateByQueryHandleSchema, bulkAssignByQueryHandleSchema, bulkAddAcceptanceCriteriaSchema, bulkAssignStoryPointsSchema, bulkEnhanceDescriptionsSchema. (3) Add clear descriptions for each selector type. See tasklist/architecture-fix-plan.md Phase 1 Task 1.3. Ensure tests pass and TypeScript compiles."
```

#### Agent 7: Update Query Handle Storage
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "feat: Store rich item context in query handles"
- base_ref: "master"
- problem_statement: "Update src/services/handlers/query/wiql-query.handler.ts to store rich context when creating query handles. Changes: (1) When returnQueryHandle is true, extract and store for each work item: index (0-based array position), id, title, state, type, daysInactive (if includeSubstantiveChange is true), lastChange date, tags (if available). (2) Pass itemContext array to query handle service when creating handle. (3) Store selectionMetadata (totalItems, selectableIndices, criteriaTags). See tasklist/architecture-fix-plan.md Phase 1 Task 1.2. Note: May need to wait for Agent 5's changes to merge first if there are dependency issues. Ensure all tests pass."
```

### Execution Steps for Block 2

1. **Verify Block 1 complete**
2. **Create 3 PRs** (Agent 5, 6, 7)
3. **⚠️ WATCH FOR CONFLICTS:** Agent 6 modifies shared config file
4. **Enter polling mode**
5. **Merge order:** Agent 5 → Agent 7 → Agent 6 (dependency order)
6. **Run integration tests**
7. **Update status**
8. **Move to BLOCK 3**

### Expected Timeline
- PR creation: 5 minutes
- Agent work: 6-8 hours (parallel)
- Review & merge: 1 hour
- **Total:** ~7-9 hours

---

## 🚀 BLOCK 3: Query Handle Architecture Phase 2

### Status: ⏸️ WAITING FOR BLOCK 2

### Prerequisites
- ✅ Block 2 merged successfully
- ✅ All tests passing
- ✅ itemSelector schema exists

### Agents to Assign (4 parallel PRs)

#### Agent 8: Update Bulk Comment Handler
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "feat: Add item selection to bulk comment handler"
- base_ref: "master"
- problem_statement: "Add itemSelector support to src/services/handlers/bulk-operations/bulk-comment-by-query-handle.handler.ts. Changes: (1) Extract itemSelector from params (default 'all'). (2) Call queryHandleService.getItemsByIndices() or getItemsByCriteria() based on selector type. (3) Filter workItemIds to only selected items. (4) Update dry-run preview to show selected items clearly. (5) Add messaging about what will be commented. See tasklist/architecture-fix-plan.md Phase 2 Task 2.1. Add tests for index-based and criteria-based selection. Ensure all tests pass."
```

#### Agent 9: Update Bulk Remove Handler
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "feat: Add item selection to bulk remove handler"
- base_ref: "master"
- problem_statement: "Add itemSelector support to src/services/handlers/bulk-operations/bulk-remove-by-query-handle.handler.ts. Changes: (1) Extract itemSelector from params (default 'all'). (2) Call queryHandleService selection methods. (3) Filter workItemIds to only selected items. (4) Enhanced dry-run preview showing exactly which items will be removed with clear details. (5) Validation to ensure user confirms correct items. See tasklist/architecture-fix-plan.md Phase 2 Task 2.2. Add tests for partial removals and selection validation. Ensure all tests pass."
```

#### Agent 10: Update Bulk Update Handler
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "feat: Add item selection to bulk update handler"
- base_ref: "master"
- problem_statement: "Add itemSelector support to src/services/handlers/bulk-operations/bulk-update-by-query-handle.handler.ts. Changes: (1) Extract itemSelector from params (default 'all'). (2) Call queryHandleService selection methods. (3) Filter workItemIds to only selected items. (4) Validate selections before operations. (5) Clear messaging about which items will be updated. See tasklist/architecture-fix-plan.md Phase 2 Task 2.3. Add tests for selection validation. Ensure all tests pass."
```

#### Agent 11: Update Bulk Assign Handler
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "feat: Add item selection to bulk assign handler"
- base_ref: "master"
- problem_statement: "Add itemSelector support to src/services/handlers/bulk-operations/bulk-assign-by-query-handle.handler.ts. Changes: (1) Extract itemSelector from params (default 'all'). (2) Call queryHandleService selection methods. (3) Filter workItemIds to only selected items. (4) Validate selections before operations. (5) Clear messaging about assignment scope. See tasklist/architecture-fix-plan.md Phase 2 Task 2.3. Add tests for selection edge cases. Ensure all tests pass."
```

### Execution Steps for Block 3

1. **Verify Block 2 complete**
2. **Create 4 PRs** (Agents 8, 9, 10, 11)
3. **Enter polling mode**
4. **Merge order:** Any order (no dependencies)
5. **Run comprehensive integration tests**
6. **Update status**
7. **Move to BLOCK 4**

### Expected Timeline
- PR creation: 5 minutes
- Agent work: 8-10 hours (parallel)
- Review & merge: 1 hour
- **Total:** ~9-11 hours

---

## 🚀 BLOCK 4: Enhanced UX & Documentation

### Status: ⏸️ WAITING FOR BLOCK 3

### Prerequisites
- ✅ Block 3 merged successfully
- ✅ All handlers support itemSelector
- ✅ All tests passing

### Agents to Assign (5 parallel PRs)

#### Agent 12: Enhanced Query Handle Inspector
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "feat: Add indexed preview to query handle inspector"
- base_ref: "master"
- problem_statement: "Enhance src/services/handlers/query-handles/inspect-query-handle.handler.ts to show indexed preview. Changes: (1) Return preview with index numbers for each item. (2) Show selection hints like 'Use index 0 to select this item'. (3) Show available selection criteria (states available, tags available). (4) Add item count by state/type for criteria selection. (5) Clear examples of how to use itemSelector. See tasklist/architecture-fix-plan.md Phase 3 Task 3.1. Add tests for preview formatting. Ensure all tests pass."
```

#### Agent 13: Create Item Selection Helper Tool
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "feat: Add item selection helper tool"
- base_ref: "master"
- problem_statement: "Create new file src/services/handlers/query-handles/select-items-from-query-handle.handler.ts. Purpose: Help users preview what items will be selected before bulk operation. Functionality: (1) Takes queryHandle and itemSelector as parameters. (2) Returns preview of selected items with title, id, state, and index. (3) Clear messaging about selection results. (4) Register tool in src/services/tool-service.ts. See tasklist/architecture-fix-plan.md Phase 3 Task 3.2. Add comprehensive tests for all selector types. Ensure all tests pass."
```

#### Agent 14: Update Query Handle Pattern Documentation
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "docs: Add item selection patterns to query handle guide"
- base_ref: "master"
- problem_statement: "Update mcp_server/resources/query-handle-pattern.md with selection patterns. Changes: (1) Add 'Item Selection' section. (2) Document index-based selection with clear examples. (3) Document criteria-based selection with examples. (4) Show safe user interaction patterns. (5) Document anti-patterns to avoid (e.g., manual ID extraction by agents). See tasklist/architecture-fix-plan.md Phase 5 Task 5.1. Ensure examples are clear and actionable."
```

#### Agent 15: Update Tool Selection Guide
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "docs: Add item selection guidance to tool guide"
- base_ref: "master"
- problem_statement: "Update mcp_server/resources/tool-selection-guide.md with selection guidance. Changes: (1) When to use 'all' vs index selection vs criteria selection. (2) Decision tree for item selection approach. (3) Examples of each selection type with real use cases. (4) Performance considerations for different selection methods. See tasklist/architecture-fix-plan.md Phase 5 Task 5.1. Make guidance practical."
```

#### Agent 16: Create Query Handle Migration Guide
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "docs: Add query handle migration guide"
- base_ref: "master"
- problem_statement: "Create new file docs/QUERY_HANDLE_MIGRATION.md. Purpose: Guide users to new selection patterns. Contents: (1) Before/after examples of old vs new patterns. (2) Common pitfalls and solutions when using item selection. (3) How to migrate existing prompts to use itemSelector. (4) FAQ about item selection including why it prevents hallucination. See tasklist/architecture-fix-plan.md Phase 5 Task 5.3. Make guide practical and actionable with clear examples."
```

### Execution Steps for Block 4

1. **Verify Block 3 complete**
2. **Create 5 PRs** (Agents 12, 13, 14, 15, 16)
3. **Enter polling mode**
4. **Merge order:** Any order (no dependencies)
5. **Review documentation for clarity**
6. **Update status**
7. **Move to BLOCK 5**

### Expected Timeline
- PR creation: 5 minutes
- Agent work: 6-8 hours (parallel)
- Review & merge: 1 hour
- **Total:** ~7-9 hours

---

## 🚀 BLOCK 5: Comprehensive Testing

### Status: ⏸️ WAITING FOR BLOCK 4

### Prerequisites
- ✅ Blocks 1-4 merged successfully
- ✅ All functionality implemented
- ✅ Documentation complete

### Agents to Assign (3 parallel PRs)

#### Agent 17: Unit Tests for Selection Mechanisms
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "test: Add unit tests for item selection mechanisms"
- base_ref: "master"
- problem_statement: "Add comprehensive unit tests for selection logic. Tests needed: (1) Test query-handle-service selection methods (getItemsByIndices, getItemsByCriteria, getSelectableIndices, getItemContext). (2) Test index-based selection edge cases (out of bounds, negative indices, empty arrays). (3) Test criteria-based selection logic (states, tags, titleContains, daysInactive). (4) Test validation and error handling. (5) Ensure >95% coverage for selection code. See tasklist/architecture-fix-plan.md Phase 6 Task 6.1. All tests must pass. Aim for 100% pass rate."
```

#### Agent 18: Integration Tests for Selection Workflows
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "test: Add integration tests for selection workflows"
- base_ref: "master"
- problem_statement: "Create new file src/test/query-handle-selection.test.ts with end-to-end integration tests. Test scenarios: (1) Full workflow: query → select → bulk operation. (2) Single item selection scenario (index-based). (3) Multiple item selection scenario (array of indices). (4) Criteria-based selection scenario (by state, tags, etc.). (5) Error cases and validation (invalid handle, invalid indices, etc.). See tasklist/architecture-fix-plan.md Phase 6 Task 6.2. Ensure tests cover real-world usage patterns. All tests must pass."
```

#### Agent 19: Update Existing Handler Tests
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "test: Update handler tests for itemSelector support"
- base_ref: "master"
- problem_statement: "Update existing handler tests to include itemSelector parameter. Files to update: (1) bulk-comment handler tests - test itemSelector: 'all', index arrays, criteria. (2) bulk-remove handler tests - test selection validation. (3) bulk-update handler tests - test default behavior. (4) bulk-assign handler tests - test edge cases. (5) Ensure all tests pass with new parameter and default value works correctly. All existing tests must continue to pass."
```

### Execution Steps for Block 5

1. **Verify Block 4 complete**
2. **Create 3 PRs** (Agents 17, 18, 19)
3. **Enter polling mode**
4. **Merge order:** Any order
5. **Run full test suite** (target >95% coverage)
6. **Validate no flakiness**
7. **Update status**
8. **Move to BLOCK 6**

### Expected Timeline
- PR creation: 5 minutes
- Agent work: 6-8 hours (parallel)
- Review & merge: 1 hour
- **Total:** ~7-9 hours

---

## 🚀 BLOCK 6: Cleanup & Polish

### Status: ⏸️ WAITING FOR BLOCK 5

### Prerequisites
- ✅ Blocks 1-5 complete
- ✅ All tests passing (>95% coverage)
- ✅ All functionality validated

### Agents to Assign (4 parallel PRs)

#### Agent 20: Remove Dead Code
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "chore: Remove dead code and commented schemas"
- base_ref: "master"
- problem_statement: "Clean up codebase by removing dead code. Tasks: (1) Remove commented bulkAddCommentsSchema from src/config/schemas.ts (line 351 area). (2) Remove any other commented-out code blocks throughout the codebase. (3) Clean up unused imports (TypeScript compiler will help identify these). (4) Verify no dead code remains. See tasklist/tech-debt-remediation-plan.md Phase 6 Task 6.1. Ensure all tests still pass after cleanup. No functional changes."
```

#### Agent 21: Add JSDoc to Analysis Functions
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "docs: Add JSDoc to analysis functions"
- base_ref: "master"
- problem_statement: "Add comprehensive JSDoc comments to analysis functions in src/services/handlers/analysis/analyze-by-query-handle.handler.ts. For each function: (1) analyzeEffort - document parameters, return value, add usage example. (2) analyzeVelocity - document parameters, return value, add example. (3) analyzeAssignments - document parameters, return value, add example. (4) analyzeRisks - document parameters, return value, add example. (5) analyzeCompletion - document parameters, return value, add example. (6) analyzePriorities - document parameters, return value, add example. Use clear examples showing typical usage. See tasklist/tech-debt-remediation-plan.md Phase 5 Task 5.1."
```

#### Agent 22: Add JSDoc to Utility Functions
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "docs: Add JSDoc to utility functions"
- base_ref: "master"
- problem_statement: "Add JSDoc comments to key utility functions in src/utils/*.ts. Focus on: (1) Complex algorithms and non-obvious behavior. (2) Include parameter descriptions with types. (3) Include return value descriptions. (4) Add examples where helpful. (5) Document edge cases and error conditions. Prioritize most-used utilities first. Make code more maintainable with clear documentation."
```

#### Agent 23: Update CONTRIBUTING.md
```
Use: mcp_github_create_pull_request_with_copilot

Parameters:
- owner: "AmeliaRose802"
- repo: "enhanced-ado-mcp"
- title: "docs: Update CONTRIBUTING with selection patterns"
- base_ref: "master"
- problem_statement: "Update docs/CONTRIBUTING.md with new patterns and conventions. Changes: (1) Add section on query handle selection patterns (index-based, criteria-based). (2) Document when to use each selection type. (3) Add coding standards for new handlers (type safety, naming, testing). (4) Document testing requirements (unit tests, integration tests, coverage targets). (5) Add examples of proper PR descriptions. Ensure guide is clear for new contributors."
```

### Execution Steps for Block 6

1. **Verify Block 5 complete**
2. **Create 4 PRs** (Agents 20, 21, 22, 23)
3. **Enter polling mode**
4. **Merge order:** Any order
5. **Final code review**
6. **Run complete test suite one more time**
7. **Update all status documents**
8. **Prepare release notes**
9. **CELEBRATE! 🎉**

### Expected Timeline
- PR creation: 5 minutes
- Agent work: 4-6 hours (parallel)
- Review & merge: 1 hour
- Final validation: 30 minutes
- **Total:** ~5-7 hours

---

## 📊 Overall Progress Tracking

### Completion Checklist

- [ ] **BLOCK 1 COMPLETE** - Type Safety Foundation (4 PRs)
- [ ] **BLOCK 2 COMPLETE** - Query Handle Architecture Phase 1 (3 PRs)
- [ ] **BLOCK 3 COMPLETE** - Query Handle Architecture Phase 2 (4 PRs)
- [ ] **BLOCK 4 COMPLETE** - Enhanced UX & Documentation (5 PRs)
- [ ] **BLOCK 5 COMPLETE** - Comprehensive Testing (3 PRs)
- [ ] **BLOCK 6 COMPLETE** - Cleanup & Polish (4 PRs)

### Success Metrics

Track these after each block:

- [ ] All tests passing (99+ tests)
- [ ] TypeScript compilation succeeds
- [ ] Zero regressions detected
- [ ] Test coverage >95%
- [ ] All PRs merged cleanly
- [ ] Documentation updated

### Final Validation

After Block 6:

- [ ] Run full test suite: `npm test`
- [ ] Check coverage: `npm run test:coverage`
- [ ] Build succeeds: `npm run build`
- [ ] All documentation updated
- [ ] README updated with new features
- [ ] Release notes created
- [ ] Version tagged

---

## 🎯 Your Next Action

**START HERE:**

1. **Read this entire script** to understand the full plan
2. **Verify prerequisites:**
   ```powershell
   cd c:\Users\ameliapayne\ADO-Work-Item-MSP\mcp_server
   npm test  # Should show 99/99 passing
   npm run build  # Should succeed
   ```
3. **Start Block 1** by creating 4 PRs (see BLOCK 1 section above)
4. **Enter polling mode** (check PRs every 5-10 minutes)
5. **Stay alive and productive** while agents work
6. **Merge when ready** and move to Block 2
7. **Repeat** for all 6 blocks

---

## 💡 Tips for Long-Running Execution

### Stay Active
- Check notifications every 5-10 minutes
- Review code while waiting
- Prepare next block while agents work
- Update documentation
- Analyze integration points

### Handle Issues
- If agent fails: Complete task yourself or reassign
- If conflict: Resolve manually or serialize work
- If test fails: Investigate and fix before proceeding
- If uncertain: Ask Amelia for guidance

### Document Everything
- Update status after each block
- Note any issues encountered
- Document deviations from plan
- Track actual vs estimated time

### Celebrate Progress
- Mark blocks complete ✅
- Update progress percentages
- Note achievements
- Stay motivated!

---

**Status:** Ready for execution  
**Next Action:** Start Block 1 by creating 4 PRs  
**Estimated Total Runtime:** 17-22 hours wall time  
**Your Active Time:** ~7-8 hours  
**Last Updated:** October 6, 2025

---

## 🤖 Autonomous Execution Mantra

> "I am the orchestrator. I create PRs, I poll for completion, I merge results, I move forward. I stay alive by doing productive work while agents handle the heavy lifting. I am autonomous. I am efficient. I make progress."

**Let's get started! 🚀**
