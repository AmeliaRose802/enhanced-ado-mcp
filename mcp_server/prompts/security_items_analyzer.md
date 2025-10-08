---
name: security_items_analyzer
description: Analyze security and compliance items with enhanced staleness analysis, categorize them, identify AI-suitable work, and create remediation plans.
version: 6
arguments: {}
---

Analyze security and compliance work items in area path `{{area_path}}`. **Exclude Done/Completed/Closed/Resolved states.**

## Tools

**Discovery & Analysis:**
- `wit-query-wiql` - Query security items with staleness data and query handles
- `wit-query-handle-inspect` - Verify query handle contents and staleness statistics
- `wit-get-context-batch` - Batch details (max 20-25 items)
- `wit-analyze-security` - Extract documentation links

**Work Item Management:**
- `wit-create-new-item` - Create work items
- `wit-assign-to-copilot` - Assign to GitHub Copilot
- `wit-new-copilot-item` - Create and assign to Copilot

**Bulk Operations:**
- `wit-bulk-comment` - Add templated comments to security items
- `wit-bulk-update` - Update multiple security items
- `wit-bulk-assign` - Assign multiple security items

## Workflow

### 1. Discovery with Query Handle
Find security items using WIQL with staleness data and query handle:
```
Tool: wit-query-wiql
Arguments: {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND ([System.Tags] CONTAINS 'security' OR [System.Title] CONTAINS 'security' OR [System.Description] CONTAINS 'vulnerability') AND [System.State] NOT IN ('Closed', 'Done', 'Completed', 'Resolved', 'Removed') ORDER BY [System.ChangedDate] DESC",
  includeFields: ["System.Title", "System.State", "System.WorkItemType", "System.Tags", "System.Description", "Microsoft.VSTS.Common.Priority"],
  includeSubstantiveChange: true,
  returnQueryHandle: true,
  maxResults: {{max_items}}
}
```

This returns BOTH security items with staleness data AND a query handle for bulk operations.

### 1a. Verify Query Handle Contents
```
Tool: wit-query-handle-inspect
Arguments: {
  queryHandle: "qh_from_previous_response",
  includePreview: true,
  includeStats: true
}
```

Use `wit-analyze-security` to get documentation URLs from items.

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

### 3. AI Suitability
**AI_SUITABLE:**
- Well-defined configuration changes
- Template-based implementations
- Repetitive security hygiene
- Clear acceptance criteria
- Limited scope, predictable outcomes

**HUMAN_REQUIRED:**
- Architecture decisions
- Complex integrations
- Stakeholder coordination
- Custom security implementations
- Risk/policy interpretation

Score AI-suitable items 1-10: Clarity, Scope, Testability, Documentation.

### 4. Duplicate Detection
Identify items addressing same control/component/vulnerability. Keep most comprehensive, link duplicates.

### 5. Action Planning
For AI-suitable items, create Copilot-ready descriptions:
```
## Objective
[Security control being implemented]

## Implementation Steps
1. [Specific action with file paths]
2. [Configuration changes with exact values]
3. [Testing and verification]

## Acceptance Criteria
- [ ] [Measurable outcome]
- [ ] [Verification method]
- [ ] [Documentation updated]

## Resources
- [Documentation links]
- [Examples]
```

---

## Output Format

### Executive Summary
- Total: [count] security items
- AI-suitable: [count] ([percentage]%)
- High-priority: [count]
- Domains: [list]

### Category Breakdown
| Domain | Total | AI | Human | High Priority |
|--------|-------|-----|-------|---------------|
| [Name] | [N]   | [N] | [N]   | [N]           |

### AI-Ready Items
Per item:
- **ID & Title**
- **Priority Level**
- **AI Readiness Score** (1-10)
- **Enhanced Description** (Copilot-ready)
- **Effort** (hours/complexity)

### Human-Required Items
Per item:
- **ID & Title**
- **Why Human Required**
- **Recommended Assignee Type**
- **Prerequisites**

### Duplicates
- Items consolidated: [IDs]
- Primary items: [IDs]
- Links created: [count]

### Next Steps
1. **Immediate** - Critical items
2. **AI Queue** - Ready for automation
3. **Human Review** - Need expert attention
4. **Documentation** - Missing guides 
