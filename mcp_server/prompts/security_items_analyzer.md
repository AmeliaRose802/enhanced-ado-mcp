---
name: security_items_analyzer
description: Analyze security and compliance work items in configured area path. Exclude Done/Completed/Closed/Resolved states.
arguments:
  - name: area_path
    description: "Area path to analyze (auto-filled from configuration)"
    required: false
  - name: max_items
    description: "Maximum number of security items to analyze"
    required: false
    default: 50
---

# Security Items Analyzer

Analyze security and compliance work items in area path `{{area_path}}`. **Exclude Done/Completed/Closed/Resolved states.**

## Tools

**Discovery & Analysis:**

- `query-wiql` - ⭐ **ENHANCED** Query security items with staleness data and query handles
- `inspect-handle` - ⭐ **NEW** Verify query handle contents and staleness statistics
- `analyze-query-handle` - ⭐ **NEW** AI analysis with specialized agent recommendations
- `get-context-bulk` - Batch details (max 20-25 items)
- `extract-security-links` - Extract documentation links

**Work Item Management:**

- `create-workitem` - Create work items
- `assign-copilot` - Assign to GitHub Copilot (general or specialized agent)
- `create-and-assign-copilot` - Create and assign to Copilot

**Bulk Operations:**

- `execute-bulk-operations` - Unified bulk operations tool
  - `action: "comment"` - Add templated comments to security items
  - `action: "update"` - Update multiple security items (can add agent tags)
  - `action: "assign"` - Assign multiple security items

## Workflow

### 1. Enhanced Discovery with Query Handle

Find security items using WIQL with staleness data and query handle.

**IMPORTANT:** Use ONLY the fields specified below. Do NOT add additional fields like System.AssignedTo, System.CreatedDate, or System.ChangedDate - these cause query failures.

```text
Tool: query-wiql
Arguments: {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND ([System.Tags] CONTAINS 'security' OR [System.Title] CONTAINS 'security' OR [System.Description] CONTAINS 'vulnerability') AND [System.State] NOT IN ('Closed', 'Done', 'Completed', 'Resolved', 'Removed') ORDER BY [System.ChangedDate] DESC",
  includeSubstantiveChange: true,
  returnQueryHandle: true,
  maxResults: {{max_items}}
}
```

This returns BOTH security items with staleness data AND a query handle for bulk operations.

### 1a. Verify Query Handle Contents

```text
Tool: inspect-handle
Arguments: {
  queryHandle: "qh_from_previous_response",
  includePreview: true,
  includeStats: true
}
```

Use `extract-security-links` to get documentation URLs from items.

### 2. Categorization

Group by security domain:

- **Authentication & Authorization** - Identity, RBAC, permissions
- **Data Protection** - Encryption, data handling, privacy
- **Network Security** - Firewall, TLS, network policies
- **Code Security** - Static analysis, dependency vulnerabilities
- **Infrastructure** - Configuration, hardening, patches
- **Compliance** - Regulatory, audit findings
- **Monitoring & Logging** - Security events, audit trails

Rate each: Severity (Critical/High/Medium/Low), Exposure, Impact, Effort.

### 3. AI Suitability & Agent Matching

**For AI-suitable items**, use `analyze-bulk` to get specialized agent recommendations:

```text
Tool: analyze-bulk
Arguments: {
  queryHandle: "qh_from_step_1",
  analysisType: ["assignment-suitability"],
  repository: "[repo-name]",  // If available
  outputFormat: "detailed"
}
```

Response includes recommended agent with tag (e.g., `copilot:agent=backend-api`).

**AI_SUITABLE:** Well-defined changes, template-based, clear criteria, limited scope.

**HUMAN_REQUIRED:** Architecture decisions, complex integrations, stakeholder coordination, policy interpretation.

Score AI-suitable items 1-10 for: Clarity, Scope, Testability, Documentation.

### 4. Duplicate Detection

Identify items addressing same control/component/vulnerability. Note consolidation opportunities.

---

## Output Format

**IMPORTANT:** Be concise. Do NOT include enhanced descriptions unless explicitly requested. Focus on actionable summaries.

### Executive Summary

- **Total:** [count] security items ([X] active, [X] stale >30 days)
- **AI-suitable:** [count] ([percentage]%)
- **High-priority:** [count] (Critical/High severity)
- **Domains:** [list top 3-5]

### Category Breakdown

| Domain | Total | AI | Human | High Priority | Stale |
|--------|-------|-----|-------|---------------|-------|
| [Name] | [N]   | [N] | [N]   | [N]           | [N]   |

### AI-Ready Items

**Compact format per item:**

- **[#ID](work-item-url)** [Title] - Priority: [H/M/L] | AI Score: [N/10] | Agent: [name] | Effort: [S/M/L] | [Domain]

Example: **[#12345](https://dev.azure.com/org/project/_workitems/edit/12345)** Implement TLS 1.3 - Priority: H | AI Score: 8/10 | Agent: Backend API Specialist | Effort: M | Network Security

**Note:** Agent recommendations include specialized agent names and tags (e.g., `copilot:agent=backend-api`) for precise assignment.

### Human-Required Items

**Compact format per item:**

- **[#ID](work-item-url)** [Title] - Reason: [brief] | Assignee Type: [role] | Priority: [H/M/L]

Example: **[#12346](https://dev.azure.com/org/project/_workitems/edit/12346)** SSO Architecture - Reason: Complex integration | Assignee Type: Security Architect | Priority: H

### Duplicates (if found)

- **Consolidate:** [list of ID pairs/groups with brief reason]

### Next Steps

**Prioritized actions (be specific):**

1. **Immediate:** [X] critical items need attention - [brief action]
2. **AI Queue:** [X] items ready for Copilot assignment
3. **Human Review:** [X] items need expert evaluation
4. **Cleanup:** [X] stale items require status update
