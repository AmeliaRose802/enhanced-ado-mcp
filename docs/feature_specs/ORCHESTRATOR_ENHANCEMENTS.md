# Orchestrator Enhancements

**Feature Type:** DevOps Automation Enhancement  
**Status:** ✅ Implemented  
**Version:** 1.0.0  
**Last Updated:** October 8, 2025

---

## Overview

This document describes enhancements to the GitHub Copilot orchestrator scripts to address three critical operational issues:

1. **Automatic Workflow Approval** - Copilot PRs are automatically authorized to run test pipelines
2. **Quota Error Handling** - Intelligent detection and retry scheduling for rate limit errors
3. **Test Failure Management** - Proper handling of test failures with fix requests instead of bypassing tests

These enhancements improve the reliability and automation of the orchestrator workflow, reducing manual intervention and ensuring code quality standards are maintained.

---

## Problems Addressed

### Problem 1: Manual Workflow Approval Required

**Issue:** GitHub Actions workflows on Copilot-created PRs require manual approval before running, blocking automation.

**Impact:**
- Orchestrator must wait for manual approval
- CI feedback is delayed
- Automation workflow is interrupted

**Root Cause:** GitHub's security model requires approval for workflows triggered by first-time contributors or bot accounts.

### Problem 2: Quota Error Handling

**Issue:** When Copilot encounters quota/rate limit errors, the orchestrator doesn't detect or handle them appropriately.

**Impact:**
- PRs appear stuck with no progress
- No automatic retry mechanism
- Manual intervention required to identify and resolve

**Root Cause:** No detection logic for quota error messages from Copilot, and no retry scheduling mechanism.

### Problem 3: Test Failure Bypass

**Issue:** When test pipelines fail, the orchestrator doesn't guide Copilot to fix the tests, potentially leading to test bypassing.

**Impact:**
- Code quality issues may be merged
- Test suite integrity compromised
- Technical debt accumulates

**Root Cause:** No automated feedback loop to request test fixes from Copilot.

---

## Solution Design

### Enhancement 1: Automatic Workflow Approval

**Implementation Location:** 
- `dev/dev_scripts/Watch-Copilot-PRs.ps1`
- `dev/dev_scripts/Assign-To-Copilot.ps1`

**Approach:**
1. After PR creation, check for workflow runs needing approval
2. Automatically approve workflows using GitHub API
3. Track approval attempts (max 3 per PR)
4. Monitor during polling cycle

**Key Components:**

```powershell
function Approve-WorkflowRuns {
    param([int]$PRNumber)
    
    # Get workflow runs for PR head commit
    # Check if status is 'action_required' or 'waiting'
    # Call GitHub API to approve: POST /repos/{owner}/{repo}/actions/runs/{run_id}/approve
    # Track approval attempts
}
```

**Behavior:**
- Attempts approval immediately after PR creation (5s delay for workflow creation)
- Re-attempts during monitoring (up to 3 times per PR)
- Logs all approval attempts
- Gracefully handles approval failures

### Enhancement 2: Quota Error Detection & Retry

**Implementation Location:** `dev/dev_scripts/Watch-Copilot-PRs.ps1`

**Approach:**
1. Monitor PR timeline for Copilot bot comments indicating quota errors
2. Track error detection time
3. Wait 15 minutes for quota reset
4. Post retry comment to Copilot
5. Remove from quota tracking and resume normal monitoring

**Key Components:**

```powershell
function Test-QuotaError {
    param([int]$PRNumber, [array]$Timeline)
    
    # Check recent timeline events for quota error indicators
    # Patterns: "quota", "rate limit", "429", "too many requests", etc.
}

function Add-RetryComment {
    param([int]$PRNumber, [datetime]$QuotaDetectedTime)
    
    # Calculate wait time
    # Post comment asking Copilot to retry
    # Include troubleshooting suggestions
}
```

**State Tracking:**
```powershell
$script:quotaErrorPRs = @{}  # PR# => detection time
```

**Detection Patterns:**
- "quota"
- "rate limit"
- "429"
- "too many requests"
- "capacity"
- "limit exceeded"

**Wait Period:** 15 minutes (configurable)

**Retry Message:**
```
@github-copilot The previous attempt encountered a quota/rate limit error.

It has been 15.3 minutes since the error was detected. Please retry implementing this task.

If you continue to encounter quota errors, consider:
1. Breaking the task into smaller pieces
2. Retrying after a longer wait period
3. Checking GitHub Copilot quota limits
```

### Enhancement 3: Test Failure Fix Requests

**Implementation Location:** `dev/dev_scripts/Watch-Copilot-PRs.ps1`

**Approach:**
1. Monitor CI check status in each poll
2. Detect failed checks
3. Post comment requesting fixes (not bypasses)
4. Track notification to avoid spam
5. Continue monitoring for fixes

**Key Components:**

```powershell
function Test-AndReportFailures {
    param([int]$PRNumber, [object]$StatusCheckRollup)
    
    # Identify failed checks
    # Check if already notified
    # Post fix request comment
    # Track notification state
}
```

**State Tracking:**
```powershell
$script:testFailureNotified = @{}  # PR# => true/false
```

**Fix Request Message:**
```
@github-copilot Test failures detected:

- **Test**: failure
- **Lint**: failure

Please fix the failing tests. **Do not bypass or skip failing tests.**

Steps to resolve:
1. Review the test failure logs above
2. Identify the root cause of the failures
3. Fix the code to make the tests pass
4. Ensure all tests pass locally: `npm test`
5. Push the fixes to this PR

If you need help understanding the test failures, ask for clarification.
```

**Notification Policy:**
- Post once per PR per failure detection
- Reset if tests pass then fail again
- Never suggest bypassing or skipping tests

---

## Implementation Details

### Script Modifications

#### Watch-Copilot-PRs.ps1

**New State Variables:**
```powershell
$script:quotaErrorPRs = @{}
$script:workflowApprovalAttempts = @{}
$script:testFailureNotified = @{}
```

**New Functions:**
- `Test-QuotaError` - Detect quota errors from timeline
- `Add-RetryComment` - Post retry request after wait period
- `Approve-WorkflowRuns` - Auto-approve pending workflows
- `Test-AndReportFailures` - Detect and report test failures

**Modified Poll Logic:**
1. Check for quota errors → track or retry
2. Check for workflow approvals → approve if needed (max 3 attempts)
3. Check CI status → report failures to Copilot
4. Continue normal monitoring

#### Assign-To-Copilot.ps1

**New Behavior After PR Creation:**
1. Wait 5 seconds for workflow creation
2. Get PR head commit SHA
3. Query workflow runs for that commit
4. Approve any workflows with `action_required` or `waiting` status
5. Log approval results

**Error Handling:**
- Graceful failure if API calls fail
- Verbose logging for debugging
- Continue with assignment even if approval fails

#### GitHub Actions Workflow

**File:** `.github/workflows/test.yml`

**Change:**
```yaml
on:
  pull_request:
    branches: [ master, main ]
  workflow_dispatch:  # Allow manual triggering
```

**Purpose:** Enables manual workflow triggering and potentially reduces approval friction.

---

## User-Facing Behavior

### Scenario 1: Normal PR Flow

**Before:**
1. Create PR → workflow stuck "Waiting for approval"
2. Manual approval required
3. Tests run
4. Monitor for completion

**After:**
1. Create PR → automatic approval attempted
2. Tests run automatically
3. Monitor for completion
4. ✅ No manual intervention

**User Experience:**
```
✅ Pull request created successfully!
PR #123 : https://github.com/...
🔍 Checking for workflow runs needing approval...
  🔓 Approving workflow run #456...
  ✅ Workflow run approved
```

### Scenario 2: Quota Error

**Before:**
1. Copilot encounters quota error
2. PR appears stuck
3. No notification or guidance
4. Manual investigation required

**After:**
1. Copilot encounters quota error
2. Monitor detects error message in timeline
3. Wait 15 minutes
4. Automatic retry comment posted
5. Copilot resumes work

**User Experience:**
```
⚠️  Quota/rate limit error detected
⏳ Waiting for quota reset... (7.3/15 min)
⏳ Waiting for quota reset... (11.8/15 min)
🔄 Quota wait time elapsed (15+ min), posting retry comment
✅ Posted retry comment to PR #123
```

### Scenario 3: Test Failures

**Before:**
1. Tests fail
2. Monitor shows failure
3. No automatic guidance
4. Risk of test bypassing

**After:**
1. Tests fail
2. Monitor detects failure
3. Automatic fix request posted to Copilot
4. Copilot addresses test failures
5. Tests pass

**User Experience:**
```
✓ Checks: Failed (2/3 passed)
⚠️  Detected 2 failed check(s)
⚠️  CI checks failed - requesting fix from Copilot
✅ Posted test failure fix request to PR #123
```

---

## Configuration

### Watch-Copilot-PRs.ps1 Parameters

**Existing:**
- `-PRNumbers` - Array of PR numbers to monitor
- `-PollIntervalSeconds` - Polling frequency (default: 30)
- `-MaxPolls` - Maximum polls before timeout (default: 480)

**New Behavior (no new parameters needed):**
- Automatic workflow approval (max 3 attempts per PR)
- Quota error detection and retry (15-minute wait)
- Test failure notification (once per failure)

### Constants (Internal)

```powershell
# Quota retry wait time
$QUOTA_WAIT_MINUTES = 15

# Maximum workflow approval attempts per PR
$MAX_APPROVAL_ATTEMPTS = 3

# Quota error detection patterns
$QUOTA_ERROR_PATTERNS = @(
    "quota",
    "rate limit",
    "429",
    "too many requests",
    "capacity",
    "limit exceeded"
)
```

---

## Error Handling

### Workflow Approval Failures

**Possible Errors:**
- API rate limit exceeded
- Insufficient permissions
- Workflow run not found

**Handling:**
```powershell
# Graceful failure with verbose logging
# Continue monitoring - approval will be retried in next poll
# Maximum 3 attempts per PR to avoid spam
```

### Quota Error Detection Failures

**Possible Errors:**
- Timeline API unavailable
- Comment posting fails

**Handling:**
```powershell
# Timeline check failure: continue with normal monitoring
# Comment posting failure: retain quota tracking, retry next poll
# Verbose logging for debugging
```

### Test Failure Notification Failures

**Possible Errors:**
- Comment posting fails
- PR API unavailable

**Handling:**
```powershell
# Mark as notified anyway to avoid retry spam
# Log error for manual intervention
# Continue monitoring
```

---

## Testing Considerations

### Unit Tests

**Test Cases:**
1. `Test-QuotaError` correctly identifies quota error messages
2. `Test-QuotaError` ignores non-quota messages
3. `Add-RetryComment` calculates wait time correctly
4. `Add-RetryComment` formats message properly
5. `Approve-WorkflowRuns` finds workflows needing approval
6. `Approve-WorkflowRuns` respects max attempt limit
7. `Test-AndReportFailures` identifies failed checks
8. `Test-AndReportFailures` avoids duplicate notifications

### Integration Tests

**Test Scenarios:**
1. Create PR → verify workflow auto-approval
2. Simulate quota error → verify detection and retry
3. Simulate test failure → verify fix request comment
4. Multiple PRs with mixed states
5. Quota error with retry → verify tracking reset

### Manual Testing

**Validation Steps:**
1. Create test PR from Copilot
2. Verify workflow approval occurs automatically
3. Simulate quota error (manual comment)
4. Verify 15-minute wait and retry comment
5. Fail a test intentionally
6. Verify fix request comment posted
7. Fix test and verify normal flow resumes

---

## Monitoring & Observability

### Log Output

**Workflow Approval:**
```
🔓 Approving workflow run #456...
✅ Workflow run approved
```

**Quota Detection:**
```
⚠️  Quota/rate limit error detected
⏳ Waiting for quota reset... (X.X/15 min)
🔄 Quota wait time elapsed (15+ min), posting retry comment
✅ Posted retry comment to PR #123
```

**Test Failure:**
```
⚠️  Detected 2 failed check(s)
⚠️  CI checks failed - requesting fix from Copilot
✅ Posted test failure fix request to PR #123
```

### State Tracking

**In-Memory State (per monitoring session):**
- `$script:quotaErrorPRs` - Tracks quota errors and detection times
- `$script:workflowApprovalAttempts` - Tracks approval attempts per PR
- `$script:testFailureNotified` - Tracks whether failure notification sent

**Persistence:** None (state resets between monitoring sessions)

---

## Security Considerations

### Permissions Required

**GitHub API Permissions:**
- `actions:write` - Approve workflow runs
- `pull_requests:write` - Post comments to PRs
- `contents:read` - Read PR details and timeline

**Authentication:**
- Uses GitHub CLI authentication (`gh auth status`)
- Inherits user permissions
- No additional credentials stored

### Risk Assessment

**Workflow Auto-Approval:**
- **Risk:** Approving malicious workflows
- **Mitigation:** Only approves for Copilot-created PRs in trusted repository
- **Impact:** Low (same permissions as manual approval)

**Quota Error Comments:**
- **Risk:** Comment spam if detection logic fails
- **Mitigation:** Single retry comment per quota error detection
- **Impact:** Low (informational comments only)

**Test Failure Comments:**
- **Risk:** Comment spam on flaky tests
- **Mitigation:** One notification per PR per failure
- **Impact:** Low (beneficial guidance to Copilot)

---

## Performance Impact

### Workflow Approval

**Overhead:**
- 1-2 API calls per PR per poll (if workflows exist)
- 5-second delay after PR creation

**Impact:** Negligible (~100ms per API call)

### Quota Error Detection

**Overhead:**
- Timeline API call already made for Copilot status
- Pattern matching on recent events (10 events)

**Impact:** Negligible (~50ms regex matching)

### Test Failure Notification

**Overhead:**
- Status check analysis already performed
- 1 API call to post comment (once per failure)

**Impact:** Negligible (~100ms per comment)

**Total Impact:** <500ms per poll cycle per PR

---

## Dependencies

### External APIs

**GitHub REST API:**
- `/repos/{owner}/{repo}/pulls/{pull_number}/commits`
- `/repos/{owner}/{repo}/actions/runs?head_sha={sha}`
- `/repos/{owner}/{repo}/actions/runs/{run_id}/approve`
- `/repos/{owner}/{repo}/pulls/{pull_number}/timeline`
- `/repos/{owner}/{repo}/issues/{issue_number}/comments` (PR comments)

**GitHub CLI:**
- `gh pr view` - Get PR details
- `gh pr comment` - Post comments
- `gh api` - Make API calls

### Script Dependencies

**PowerShell Modules:**
- None (uses built-in cmdlets)

**External Tools:**
- GitHub CLI (`gh`) - Required

---

## Rollback Plan

### If Issues Occur

**Workflow Approval Problems:**
```powershell
# Disable auto-approval by commenting out function call
# Line in Watch-Copilot-PRs.ps1:
# if (Approve-WorkflowRuns -PRNumber $prNum) { ... }
```

**Quota Error Problems:**
```powershell
# Disable quota detection
# Line in Watch-Copilot-PRs.ps1:
# $hasQuotaError = Test-QuotaError -PRNumber $prNum -Timeline $timeline
# Set to: $hasQuotaError = $false
```

**Test Failure Problems:**
```powershell
# Disable test failure notifications
# Line in Watch-Copilot-PRs.ps1:
# Test-AndReportFailures -PRNumber $prNum -StatusCheckRollup $prInfo.statusCheckRollup
# Comment out this line
```

### Full Rollback

Use version control to restore previous script versions:
```powershell
git checkout HEAD~1 -- dev/dev_scripts/Watch-Copilot-PRs.ps1
git checkout HEAD~1 -- dev/dev_scripts/Assign-To-Copilot.ps1
```

---

## Future Enhancements

### Potential Improvements

1. **Configurable Wait Times**
   - Make quota wait time a parameter
   - Different wait times for different error types

2. **Advanced Quota Detection**
   - Parse actual quota limits from API headers
   - Predict quota availability

3. **Test Failure Analysis**
   - Include failed test logs in comment
   - Suggest specific fixes based on error patterns

4. **Workflow Approval Policies**
   - Configure which workflows to auto-approve
   - Allowlist/denylist for workflow names

5. **Metrics & Analytics**
   - Track approval success rate
   - Measure quota error frequency
   - Analyze test failure patterns

---

## Related Documentation

- **User Guide:** `dev/dev_docs/COPILOT-ASSIGNMENT-GUIDE.md`
- **Orchestrator Cheat Sheet:** `dev/dev_docs/ORCHESTRATOR-CHEAT-SHEET.md`
- **Watch Script:** `dev/dev_scripts/Watch-Copilot-PRs.ps1`
- **Assign Script:** `dev/dev_scripts/Assign-To-Copilot.ps1`
- **GitHub Actions Workflow:** `.github/workflows/test.yml`

---

## Changelog

### Version 1.0.0 (October 8, 2025)
- Initial implementation
- Automatic workflow approval
- Quota error detection and retry scheduling
- Test failure fix requests
- Documentation updates

---

**Maintained by:** Principal Software Engineer  
**Review Status:** Approved  
**Implementation Status:** ✅ Complete