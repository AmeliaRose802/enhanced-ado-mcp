---
name: intelligent_work_item_analyzer  
description: AI-powered work item analysis with enhanced query handle integration for completeness, AI-readiness, and enhancement suggestions.
version: 6
arguments:
  work_item_id: { type: string, required: true, description: "Work item ID to analyze" }
  analysis_focus: { type: string, required: false, enum: ["completeness", "ai-readiness", "enhancement", "categorization", "full"], default: "full" }
  enhance_and_create: { type: boolean, required: false, default: false, description: "Generate enhanced version and create in ADO" }
---

Analyze Azure DevOps work item `{{work_item_id}}` for completeness, AI-readiness, and improvement opportunities. **Exclude Done/Completed/Closed/Resolved items.**

## Tools

**Analysis & Context:**
- `wit-intelligence-analyzer` - AI-powered analysis
- `wit-get-work-item-context-package` - Get full work item context
- `wit-get-work-items-by-query-wiql` - Find related/duplicate items with staleness data
- `wit-inspect-query-handle` - ⭐ **NEW** Verify query handle contents and staleness statistics

**Work Item Management:**
- `wit-create-new-item` - Create enhanced work items
- `wit-assign-to-copilot` - Assign to GitHub Copilot
- `wit-new-copilot-item` - Create and assign to Copilot

**Bulk Operations:**
- `wit-bulk-comment-by-query-handle` - Add templated comments to related items
- `wit-bulk-update-by-query-handle` - Update multiple related items

## Workflow

1. **Fetch work item** using `wit-get-work-item-context-package` with `{{work_item_id}}`
2. **Run analysis** using `wit-intelligence-analyzer`:
   ```
   Parameters:
   - Title: {{work_item_title}}
   - Description: {{work_item_description}}
   - WorkItemType: {{work_item_type}}
   - AcceptanceCriteria: {{acceptance_criteria}}
   - AnalysisType: {{analysis_focus}}
   - EnhanceDescription: {{enhance_and_create}}
   - CreateInADO: {{enhance_and_create}}
   ```
3. **Optional: Find duplicates with staleness context** if unclear:
   ```
   Tool: wit-get-work-items-by-query-wiql
   Arguments: {
     wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.Title] CONTAINS 'key terms' AND [System.Id] <> {{work_item_id}} AND [System.State] NOT IN ('Done', 'Completed', 'Closed', 'Resolved', 'Removed') ORDER BY [System.ChangedDate] DESC",
     includeFields: ["System.Title", "System.State", "System.WorkItemType"],
     includeSubstantiveChange: true,
     returnQueryHandle: true,
     maxResults: 10
   }
   ```
4. **Present results** in format below

---

## Output Format

### 🤖 Analysis: {{work_item_id}}

**Work Item:** {{work_item_title}} ({{work_item_type}})
**Analysis Focus:** {{analysis_focus}}

#### Scoring
- **Completeness:** [X/10] - [Brief assessment]
- **AI Readiness:** [X/10] - [AI/Human/Hybrid]
- **Priority:** [Critical/High/Medium/Low]
- **Complexity:** [Simple/Medium/Complex/Expert]

#### Classification
- **Category:** [Feature/Bug/Tech Debt/Security/Research]
- **Effort:** [Hours/Story Points]

#### Strengths
- [What works well]

#### Improvements Needed
- [Missing elements]
- [Clarity issues]
- [Acceptance criteria gaps]

#### Recommendations
1. **Immediate:** [Critical improvements]
2. **Enhancement:** [Clarity/completeness improvements]
3. **Assignment:** [AI vs Human guidance]

#### Enhanced Version (if requested)
**Enhanced Title:** [Improved title]

**Enhanced Description:**
[Clear description with implementation steps]

**Enhanced Acceptance Criteria:**
- [ ] [Testable criteria]
- [ ] [Verification methods]

#### Next Steps
1. [Priority 1 action]
2. [Priority 2 action]

**Tool Usage:**
- AI-ready: Use `wit-assign-to-copilot` or `wit-new-copilot-item`
- Needs enhancement: Use `wit-create-new-item` with improved content