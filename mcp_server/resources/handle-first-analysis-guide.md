# Handle-First Analysis Workflows - Beta Tester Guide

## 🎯 Purpose

This guide addresses the **beta tester feedback** that the handle mechanism wasn't obvious for analysis workflows. It provides **explicit handle-first patterns** for common analysis scenarios to prevent ID hallucination.

---

## ⚠️ CRITICAL: Handle-First Mental Model

### ❌ OLD DANGEROUS PATTERN (ID Hallucination Risk)

```
1. Query for items → get IDs [12345, 12346, 12347]
2. Analyze in narrative: "Found items #12345, #12346, #12347"
3. Later operations: "Update item #12348" ← HALLUCINATED ID!
```

### ✅ NEW SAFE PATTERN (Handle-Based)

```
1. Query with returnQueryHandle: true → get handle "qh_abc123"
2. Analyze via handle: "Found 53 items (handle: qh_abc123)"
3. Later operations: Use handle with bulk tools → NO ID HALLUCINATION
```

---

## 🔧 New Handle-Based Analysis Tools

### 1. analyze-query-handle

**Purpose:** Analyze work items without ever seeing individual IDs.

**Example - Project Backlog Analysis:**

```json
// Step 1: Query with handle (NEW DEFAULT: returnQueryHandle=true)
{
  "tool": "query-wiql",
  "args": {
    "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject' AND [System.State] <> 'Removed'",
    "includeFields": ["System.Title", "System.State", "System.WorkItemType", "Microsoft.VSTS.Scheduling.StoryPoints"],
    "returnQueryHandle": true  // Default is now TRUE
  }
}

// Response includes BOTH handle AND details:
{
  "query_handle": "qh_project_backlog_abc123",
  "work_items": [...],  // For display to user
  "work_item_count": 147
}

// Step 2: Analyze using handle (NO IDs in analysis)
{
  "tool": "analyze-query-handle",
  "args": {
    "queryHandle": "qh_project_backlog_abc123",
    "analysisType": ["effort", "risks", "assignments", "completion"]
  }
}

// Analysis response (NO IDs exposed):
{
  "results": {
    "effort": {
      "total_story_points": 385,
      "items_without_story_points": 23,
      "estimation_coverage": 84
    },
    "risks": {
      "risk_level": "Medium",
      "identified_risks": ["High unestimated work: 23/147 items (16%) lack Story Points"],
      "blocked_count": 3
    },
    "assignments": {
      "unassigned_items": 12,
      "unique_assignees": 8,
      "assignment_coverage": 92
    },
    "completion": {
      "completion_percentage": 34,
      "health_indicator": "Making Progress"
    }
  }
}
```

### 2. list-handles

**Purpose:** Track active handles like persistent resources.

```json
{
  "tool": "list-handles",
  "args": {}
}

// Response:
{
  "active_handles": 3,
  "expired_handles": 1,
  "guidance": {
    "handle_lifetime": "1 hour (default)",
    "usage_tip": "Use inspect-handle to check specific handle status"
  }
}
```

---

## 📋 Complete Analysis Workflows

### Workflow 1: Project Health Assessment

```markdown
## Handle-First Project Analysis

### Step 1: Get Project Data with Handle
```json
{
  "tool": "query-wiql",
  "args": {
    "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\FeatureTeam' AND [System.State] <> 'Removed'",
    "includeFields": ["System.Title", "System.State", "System.WorkItemType", "System.AssignedTo", "Microsoft.VSTS.Scheduling.StoryPoints"],
    "returnQueryHandle": true,
    "includeSubstantiveChange": true,
    "maxResults": 500
  }
}
```

**✅ Correct Narrative:**
"Found 147 work items in the project backlog (handle: qh_project_backlog_abc123). The query returned both the handle for safe operations and the full item details for review."

**❌ Wrong Narrative:**
"Found work items #12345, #12346, #12347... [long list of IDs]"

### Step 2: Comprehensive Analysis
```json
{
  "tool": "analyze-query-handle",
  "args": {
    "queryHandle": "qh_project_backlog_abc123",
    "analysisType": ["effort", "velocity", "assignments", "risks", "completion", "priorities"]
  }
}
```

### Step 3: If Bulk Actions Needed
```json
// Example: Remove stale items based on substantive change analysis
{
  "tool": "wit-bulk-remove-by-query-handle",
  "args": {
    "queryHandle": "qh_project_backlog_abc123",
    "removeReason": "Project cleanup: Items with no substantive activity >180 days",
    "dryRun": true  // Always preview first
  }
}
```

---

### Workflow 2: Team Capacity Analysis

```markdown
## Handle-First Team Analysis

### Step 1: Get Active Work by Team
```json
{
  "tool": "query-wiql",
  "args": {
    "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\TeamAlpha' AND [System.State] IN ('Active', 'Committed')",
    "includeFields": ["System.AssignedTo", "System.WorkItemType", "Microsoft.VSTS.Scheduling.StoryPoints"],
    "returnQueryHandle": true
  }
}
```

**Response:** `query_handle: "qh_team_active_work_def456"`

### Step 2: Analyze Team Distribution
```json
{
  "tool": "analyze-query-handle",
  "args": {
    "queryHandle": "qh_team_active_work_def456",
    "analysisType": ["assignments", "effort"]
  }
}
```

**Analysis Result (No IDs):**
- "Team has 23 active items across 6 engineers"
- "3 engineers are overloaded (>5 items each)"
- "Total active work: 87 Story Points"
- "Assignment coverage: 91%"

### Step 3: Rebalance if Needed
```json
{
  "tool": "wit-bulk-assign-by-query-handle",
  "args": {
    "queryHandle": "qh_team_active_work_def456",
    "assignTo": "available.engineer@company.com",
    "dryRun": true
  }
}
```

---

### Workflow 3: Security/Compliance Review

```markdown
## Handle-First Security Analysis

### Step 1: Find High-Priority Items
```json
{
  "tool": "query-wiql",
  "args": {
    "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [Microsoft.VSTS.Common.Priority] <= 1 AND [System.Tags] CONTAINS 'Security'",
    "includeFields": ["System.Title", "System.State", "System.AssignedTo", "Microsoft.VSTS.Common.Priority"],
    "returnQueryHandle": true
  }
}
```

**Response:** `query_handle: "qh_security_high_priority_ghi789"`

### Step 2: Risk Assessment
```json
{
  "tool": "analyze-query-handle",
  "args": {
    "queryHandle": "qh_security_high_priority_ghi789",
    "analysisType": ["risks", "assignments", "priorities"]
  }
}
```

### Step 3: Bulk Actions for Compliance
```json
{
  "tool": "wit-bulk-comment-by-query-handle",
  "args": {
    "queryHandle": "qh_security_high_priority_ghi789",
    "comment": "🔒 Security Review Required: Please verify compliance with latest security guidelines before proceeding.",
    "dryRun": false
  }
}
```

---

## 🚫 Anti-Patterns to Avoid

### Anti-Pattern 1: Listing IDs in Narrative

```markdown
❌ WRONG:
"Found 147 work items including #12345 (Implement login), #12346 (Fix validation), 
#12347 (Update docs)... The team should focus on #12345 first."

✅ CORRECT:
"Found 147 work items in project backlog (handle: qh_project_abc123). Analysis shows 
34% completion rate with 23 items lacking Story Points. The handle contains full 
details for review and safe bulk operations."
```

### Anti-Pattern 2: Manual ID Collection

```markdown
❌ WRONG:
Let me collect the IDs: [12345, 12346, 12347] and then update them...

✅ CORRECT:
Using the query handle qh_abc123 for safe bulk operations...
```

### Anti-Pattern 3: Bypassing Handles for "Simple" Operations

```markdown
❌ WRONG:
"It's just one item, let me update #12345 directly"

✅ CORRECT:
"Even for single items, I'll query with a handle to ensure accuracy"
```

### Anti-Pattern 4: Not Using New Defaults

```markdown
❌ WRONG:
{
  "returnQueryHandle": false  // Explicitly disabling safety
}

✅ CORRECT:
{
  // returnQueryHandle defaults to true now - use the default!
}
```

---

## 🔧 Configuration Changes Made

### 1. Default Behavior Changed

**OLD:** `returnQueryHandle: false` (opt-in)  
**NEW:** `returnQueryHandle: true` (opt-out)

**Impact:** Every query now returns a handle by default, making safe patterns the default path.

### 2. Strong Visual Warnings

**Tool descriptions now include:**
- 🔐 ANTI-HALLUCINATION icons
- ⚠️ CRITICAL warnings about ID usage
- Clear guidance on when to use handles

### 3. New Analysis Tools

**analyze-query-handle:** Forces handle-based analysis workflows  
**list-handles:** Makes handles feel like managed resources  
**Enhanced inspect-handle:** Better sample data without encouraging ID listing

---

## 🎯 Success Metrics

After implementing these changes, successful handle adoption will show:

### ✅ Good Indicators

1. **Narrative uses handles:** "Found X items (handle: qh_abc123)"
2. **No ID lists in text:** No sequences like "#12345, #12346, #12347"
3. **Handle validation checks:** Using inspect-handle before operations
4. **Handle-based analysis:** Using analyze-query-handle instead of manual analysis
5. **Bulk operations via handles:** All bulk operations use query handles

### ❌ Warning Signs

1. **ID enumeration:** Listing specific work item IDs in responses
2. **Direct ID operations:** Trying to use explicit IDs in bulk operations
3. **Handle bypass:** Setting `returnQueryHandle: false` without clear reason
4. **Stale handle usage:** Using handles >1 hour old without validation

---

## 💡 Tips for Beta Testers

### For Analysis Workflows

1. **Always start with `query-wiql`** (with default returnQueryHandle=true)
2. **Use the work_items array for user display,** use the handle for operations
3. **Reference work by count/summary,** not individual IDs
4. **Use `analyze-query-handle`** for comprehensive analysis without ID exposure

### For Bulk Operations

1. **Never collect IDs manually** - always use handles
2. **Always dry-run first** with `dryRun: true`
3. **Validate handles** before long-running operations
4. **Add audit comments** before destructive operations

### For Troubleshooting

1. **Use `list-handles`** to see active handles
2. **Use `inspect-handle`** to check specific handle status
3. **Re-query if handle expires** (>1 hour old)
4. **Check warnings in responses** for handle-related issues

---

## 🚀 Next Steps for Beta Testers

1. **Test the new defaults:** Query without specifying `returnQueryHandle` and verify you get handles
2. **Try handle-based analysis:** Use `analyze-query-handle` for project analysis
3. **Test handle management:** Use `list-handles` and `inspect-handle`
4. **Verify anti-patterns are blocked:** Try to use explicit IDs and confirm warnings/errors
5. **Provide feedback:** Report if handle patterns still feel unnatural or if additional guardrails are needed

The goal is to make handle-based workflows feel **more natural than ID-based workflows**, so the safe pattern becomes the obvious pattern.



