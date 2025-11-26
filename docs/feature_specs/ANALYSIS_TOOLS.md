# Analysis & Validation Tools

**Feature Category:** Work Item Analysis  
**Status:** ✅ Implemented  
**Version:** 1.6.0  
**Last Updated:** 2025-11-12

## Overview

The Enhanced ADO MCP Server provides comprehensive analysis and validation tools for work items:

1. **query-wiql with filterByPatterns** - Identify common work item issues using pattern filters
2. **analyze-bulk** - Comprehensive analysis including effort, velocity, assignments, risks, completion, priorities, hierarchy validation, AI intelligence, and assignment suitability
3. **analyze-query-handle** - AI-powered custom analysis using natural language intent
4. **extract-security-links** - Extract security scan instruction links
5. **get-config** - View current MCP server configuration

These tools enable proactive issue detection and work item quality improvement.

## Purpose

Enable work item quality analysis with:
- Pattern detection for common issues
- Hierarchy validation (type and state consistency)
- Staleness analysis (filtering automated changes)
- Security scan link extraction
- Configuration discovery for agents

## Tools

### 1. Pattern Detection via WIQL Queries

Identify common work item issues using WIQL queries with pattern filters.

#### Using Pattern Detection

Use `query-wiql` with the `filterByPatterns` parameter:

**Available Patterns:**
- `"duplicates"` - Duplicate titles (case-insensitive)
- `"placeholder_titles"` - Generic titles (TODO, TBD, test, temp, etc.)
- `"unassigned_committed"` - Unassigned items in Active/Committed/In Progress states
- `"stale_automation"` - Items only modified by automation
- `"missing_description"` - Empty description field
- `"missing_acceptance_criteria"` - Empty acceptance criteria field

**Example Query:**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'Project\\Team' AND [System.State] NOT IN ('Done', 'Closed')",
  "filterByPatterns": ["placeholder_titles", "missing_description"],
  "returnQueryHandle": true
}
```

#### Output Format

When using `filterByPatterns`, the WIQL query returns only matching items:

**Success Response:**
```json
{
  "success": true,
  "data": {
    "workItems": [
      {
        "id": 12347,
        "title": "TODO: Fix bug",
        "state": "New",
        "assignedTo": "user@company.com"
      },
      {
        "id": 12349,
        "title": "Implement feature X",
        "state": "Active",
        "assignedTo": null
      }
    ],
    "queryHandle": "qh_abc123...",
    "totalCount": 2,
    "metadata": {
      "patternsApplied": ["placeholder_titles", "missing_description"],
      "filteredCount": 2
    }
  },
  "errors": [],
  "warnings": []
}
```

Use the query handle with bulk operations to remediate issues.

#### Examples

**Example 1: Find Items with Quality Issues**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'Project\\Team' AND [System.State] NOT IN ('Done', 'Closed')",
  "filterByPatterns": ["placeholder_titles", "missing_description"],
  "returnQueryHandle": true
}
```

**Example 2: Find Duplicates and Stale Items**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'Project\\Team'",
  "filterByPatterns": ["duplicates", "stale_automation"],
  "returnQueryHandle": true
}
```

### 2. analyze-bulk

Comprehensive work item analysis including hierarchy validation as one of multiple analysis types.

#### Input Parameters

**Required:**
- `queryHandle` (string) - Query handle from `query-wiql` with `returnQueryHandle=true`
- `analysisType` (array of strings) - Analysis types to perform:
  - `"effort"` - Story Points breakdown and estimation coverage
  - `"velocity"` - Completion trends over time
  - `"assignments"` - Team workload distribution
  - `"risks"` - Blockers, stale items, and risk assessment
  - `"completion"` - State distribution and progress metrics
  - `"priorities"` - Priority balance analysis
  - `"hierarchy"` - Parent-child type validation and state consistency checks
  - `"work-item-intelligence"` - AI-powered completeness/enhancement analysis
  - `"assignment-suitability"` - AI-powered Copilot assignment readiness with categorization

**Optional (pagination):**
- `maxItemsToAnalyze` (number) - Maximum items to analyze from query handle (default: all items, max: 1000)
- `skip` (number) - Number of items to skip for pagination (default: 0)

**Optional (for hierarchy analysis only):**
- `validateTypes` (boolean) - Validate parent-child type relationships (default true)
- `validateStates` (boolean) - Validate state progression consistency (default true)
- `returnQueryHandles` (boolean) - Create query handles for violation categories (default true)
- `includeViolationDetails` (boolean) - Include full violation details in response (default false)

**Optional (for work-item-intelligence analysis only):**
- `intelligenceAnalysisType` (string) - Type of analysis: "completeness", "ai-readiness", "enhancement", "categorization", "full" (default "full")
- `contextInfo` (string) - Additional context for analysis
- `enhanceDescription` (boolean) - Generate enhanced descriptions (default false)

**Optional (for assignment-suitability analysis only):**
- `outputFormat` (string) - Output format: "detailed" or "json" (default "detailed")
- `repository` (string) - Repository name to discover specialized agents

**Optional (all analysis types):**
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project

#### Output Format

**Success Response (with hierarchy analysis):**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_abc123",
    "item_count": 50,
    "total_items_in_handle": 150,
    "items_skipped": 0,
    "original_query": "SELECT [System.Id] FROM WorkItems WHERE...",
    "analysis_types": ["effort", "risks", "hierarchy"],
    "results": {
      "effort": {
        "total_items": 50,
        "items_with_story_points": 42,
        "total_story_points": 137
      },
      "risks": {
        "risk_score": 35,
        "risk_level": "Medium",
        "identified_risks": ["High unestimated work: 8/50 items"]
      },
      "hierarchy": {
        "summary": {
          "totalItemsAnalyzed": 50,
          "totalViolations": 5,
          "errors": 2,
          "warnings": 3
        },
        "queryHandles": {
          "invalid_parent_task_under_epic": "qh_violations_abc",
          "orphaned_task": "qh_orphaned_def"
        }
      }
    }
  },
  "errors": [],
  "warnings": []
}
```

**Success Response (with assignment-suitability analysis):**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_abc123",
    "item_count": 25,
    "original_query": "SELECT [System.Id] FROM WorkItems WHERE...",
    "analysis_types": ["assignment-suitability"],
    "results": {
      "assignment-suitability": {
        "total_analyzed": 25,
        "results": [
          {
            "workItemId": 12345,
            "title": "Implement login API",
            "analysis": {
              "decision": "AI_FIT",
              "confidence": 0.85,
              "riskScore": 15
            }
          }
        ],
        "categorization": {
          "ai_fit": {
            "count": 10,
            "query_handle": "qh_ai_fit_xyz123",
            "work_item_ids": [12345, 12346, ...]
          },
          "human_fit": {
            "count": 8,
            "query_handle": "qh_human_fit_abc456",
            "work_item_ids": [12350, 12351, ...]
          },
          "hybrid": {
            "count": 5,
            "query_handle": "qh_hybrid_def789",
            "work_item_ids": [12360, 12361, ...]
          },
          "needs_refinement": {
            "count": 2,
            "query_handle": "qh_needs_refinement_ghi012",
            "work_item_ids": [12370, 12371]
          }
        }
      }
    }
  },
  "errors": [],
  "warnings": []
}
```

**Success Response (with work-item-intelligence categorization):**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_abc123",
    "item_count": 30,
    "original_query": "SELECT [System.Id] FROM WorkItems WHERE...",
    "analysis_types": ["work-item-intelligence"],
    "results": {
      "work-item-intelligence": {
        "total_analyzed": 30,
        "results": [
          {
            "workItemId": 12345,
            "title": "Add user authentication",
            "analysis": {
              "category": "Feature",
              "priority": "High",
              "complexity": "Medium"
            }
          }
        ],
        "categorization": {
          "feature": {
            "count": 15,
            "query_handle": "qh_feature_abc123",
            "work_item_ids": [12345, 12346, ...]
          },
          "bug": {
            "count": 8,
            "query_handle": "qh_bug_def456",
            "work_item_ids": [12360, 12361, ...]
          },
          "tech_debt": {
            "count": 4,
            "query_handle": "qh_tech_debt_ghi789",
            "work_item_ids": [12370, 12371, ...]
          },
          "security": {
            "count": 2,
            "query_handle": "qh_security_jkl012",
            "work_item_ids": [12380, 12381]
          },
          "documentation": {
            "count": 1,
            "query_handle": "qh_documentation_mno345",
            "work_item_ids": [12390]
          }
        }
      }
    }
  },
  "errors": [],
  "warnings": []
}
```

**Query Handles for Categorized Work Items:**

When `analysisType` includes `"assignment-suitability"`, the response includes query handles for each AI suitability category:

- **`ai_fit.query_handle`** - Work items suitable for GitHub Copilot assignment (AI_FIT decision)
- **`human_fit.query_handle`** - Work items requiring human expertise (HUMAN_FIT decision)
- **`hybrid.query_handle`** - Work items needing AI draft + human review (HYBRID decision)
- **`needs_refinement.query_handle`** - Work items needing better definition (NEEDS_REFINEMENT decision)

When `analysisType` includes `"work-item-intelligence"` with `intelligenceAnalysisType: "categorization"`, the response includes query handles for each work item category:

- **`feature.query_handle`** - Feature work items
- **`bug.query_handle`** - Bug work items
- **`tech_debt.query_handle`** - Technical debt items
- **`security.query_handle`** - Security-related items
- **`documentation.query_handle`** - Documentation items
- **`research.query_handle`** - Research/spike items
- **`other.query_handle`** - Uncategorized items

Each query handle can be used with bulk operations (e.g., `wit-bulk-operations` to assign category items to specific teams).

#### Examples

**Example 1: Multi-faceted Analysis with Hierarchy**
```json
{
  "queryHandle": "qh_abc123",
  "analysisType": ["effort", "risks", "hierarchy"],
  "validateTypes": true,
  "validateStates": true
}
```

**Example 2: Hierarchy-Only Analysis**
```json
{
  "queryHandle": "qh_abc123",
  "analysisType": ["hierarchy"],
  "returnQueryHandles": true,
  "includeViolationDetails": false
}
```

**Example 5: Paginated Analysis (First 100 Items)**
```json
{
  "queryHandle": "qh_large_query",
  "analysisType": ["effort", "risks"],
  "maxItemsToAnalyze": 100,
  "skip": 0
}
```

**Example 4: Paginated Analysis (Next 100 Items)**
```json
{
  "queryHandle": "qh_large_query",
  "analysisType": ["effort", "risks"],
  "maxItemsToAnalyze": 100,
  "skip": 100
}
```

**Example 5: AI Assignment Suitability with Categorization**
```json
{
  "queryHandle": "qh_abc123",
  "analysisType": ["assignment-suitability"],
  "repository": "frontend-app",
  "outputFormat": "detailed"
}
```

This example analyzes all work items in the query handle and returns:
- Individual AI suitability decisions for each work item
- **New query handles** for each category (AI_FIT, HUMAN_FIT, HYBRID, NEEDS_REFINEMENT)
- These query handles can be used with `wit-bulk-operations` to assign AI-suitable items to GitHub Copilot

**Example 6: Assign AI-Suitable Items to Copilot (Two-Step Workflow)**
```json
// Step 1: Analyze for AI suitability
{
  "queryHandle": "qh_sprint_backlog",
  "analysisType": ["assignment-suitability"],
  "repository": "backend-api"
}

// Response includes: categorization.ai_fit.query_handle = "qh_ai_fit_xyz123"

// Step 2: Bulk assign AI-suitable items to GitHub Copilot
{
  "tool": "execute-bulk-operations",
  "arguments": {
    "queryHandle": "qh_ai_fit_xyz123",
    "actions": [
      {
        "type": "assign",
        "assignTo": "GitHub Copilot <copilot-guid>"
      }
    ],
    "itemSelector": "all"
  }
}
```

**Example 7: Categorize and Route Work Items by Type**
```json
// Step 1: Analyze with intelligence categorization
{
  "queryHandle": "qh_sprint_backlog",
  "analysisType": ["work-item-intelligence"],
  "intelligenceAnalysisType": "categorization",
  "contextInfo": "Categorize work items for team routing"
}

// Response includes categorized query handles:
// - categorization.feature.query_handle = "qh_feature_abc123"
// - categorization.bug.query_handle = "qh_bug_def456"
// - categorization.tech_debt.query_handle = "qh_tech_debt_ghi789"

// Step 2: Assign bugs to bug triage team
{
  "tool": "execute-bulk-operations",
  "arguments": {
    "queryHandle": "qh_bug_def456",
    "actions": [
      {
        "type": "assign",
        "assignTo": "Bug Triage Team"
      }
    ],
    "itemSelector": "all"
  }
}

// Step 3: Tag tech debt items
{
  "tool": "execute-bulk-operations",
  "arguments": {
    "queryHandle": "qh_tech_debt_ghi789",
    "actions": [
      {
        "type": "add-tag",
        "tags": "TechDebt;NeedsRefactoring"
      }
    ],
    "itemSelector": "all"
  }
}
```

**Example 8: Identify Test Items for Cleanup**
```json
{
  "queryHandle": "qh_all_items",
  "analysisType": ["work-item-intelligence"],
  "intelligenceAnalysisType": "categorization",
  "contextInfo": "Identify test/placeholder items created during MCP server testing. Look for items with test markers, temporary content, clone indicators, or validation purposes. Exclude real work items about testing functionality or legitimate S360 items."
}

// Response includes: categorization.other.query_handle with test items
// Use this handle for bulk deletion or archival
```

💡 **Tip:** Use `analyze-bulk` when you want to combine multiple analyses (e.g., effort + hierarchy + risks) in a single call.

### 3. analyze-query-handle

AI-powered custom analysis on work items using natural language intent.

#### Input Parameters

**Required:**
- `queryHandle` (string) - Query handle from `query-wiql` with `returnQueryHandle=true`
- `intent` (string) - Natural language description of analysis to perform

**Optional:**
- `itemSelector` - Item selection: 'all', array of indices, or selection criteria
- `maxItemsToAnalyze` (number) - Max items to analyze (default 50, max 100)
- `skip` (number) - Number of items to skip for pagination (default 0)
- `includeContextPackages` (boolean) - Retrieve full context (default true)
- `contextDepth` (string) - Context detail: 'basic', 'standard', 'deep' (default 'standard')
- `outputFormat` (string) - Output format: 'concise', 'detailed', 'json' (default 'concise')
- `confidenceThreshold` (number) - Minimum confidence for recommendations (0-1, default 0.0)
- `temperature` (number) - AI temperature (0-2, default 0.3)
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "analysis": "Based on the 25 work items analyzed...",
    "insights": [
      "15 items are ready for deployment",
      "8 items need additional testing",
      "2 items are blocked"
    ],
    "recommendations": [
      "Prioritize unblocking items 12345 and 12346"
    ]
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example 1: Find Items Ready for Deployment**
```json
{
  "queryHandle": "qh_abc123",
  "intent": "find work items that are ready for deployment to production",
  "outputFormat": "detailed"
}
```

**Example 2: Assess Technical Debt**
```json
{
  "queryHandle": "qh_abc123",
  "intent": "assess technical debt risk and identify highest priority items to address",
  "maxItemsToAnalyze": 30
}
```

### 4. extract-security-links

Extract instruction links from security scan work items.

#### Input Parameters

**Required:**
- `workItemId` (number) - Work item ID containing security findings

**Optional:**
- `scanType` (string) - Scanner type to filter:
  - `"BinSkim"` - Binary analysis
  - `"CodeQL"` - Code analysis
  - `"CredScan"` - Credential scanning
  - `"General"` - General security
  - `"All"` - All types
- `includeWorkItemDetails` (boolean) - Include work item details in response
- `extractFromComments` (boolean) - Also extract from comments
- `dryRun` (boolean) - Preview without API calls

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "work_item_id": 12345,
    "scan_type": "CodeQL",
    "instruction_links": [
      {
        "title": "SQL Injection Prevention",
        "url": "https://codeql.github.com/codeql-query-help/javascript/js-sql-injection/",
        "source": "description",
        "line_number": 15
      },
      {
        "title": "Cross-Site Scripting",
        "url": "https://codeql.github.com/codeql-query-help/javascript/js-xss/",
        "source": "comment",
        "comment_id": 123
      }
    ],
    "total_links_found": 2,
    "work_item_details": {
      "title": "CodeQL: SQL injection vulnerability",
      "state": "Active",
      "severity": "High"
    }
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: Extract CodeQL Links**
```json
{
  "workItemId": 12345,
  "scanType": "CodeQL",
  "includeWorkItemDetails": true,
  "extractFromComments": true
}
```

### 5. get-config

Get current MCP server configuration for agents.

#### Input Parameters

**Optional:**
- `includeSensitive` (boolean) - Include sensitive config values
- `section` (string) - Specific section:
  - `"all"` - All configuration
  - `"azureDevOps"` - Azure DevOps settings
  - `"gitRepository"` - Git repository settings
  - `"gitHubCopilot"` - GitHub Copilot settings

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "azureDevOps": {
      "organization": "my-org",
      "project": "my-project",
      "defaultAreaPath": "Project\\Team",
      "defaultIterationPath": "Project\\Sprint 10",
      "defaultWorkItemType": "Task",
      "defaultPriority": 2,
      "defaultAssignedTo": "team@company.com"
    },
    "gitRepository": {
      "branch": "main",
      "defaultRepository": "frontend-app"
    },
    "gitHubCopilot": {
      "guid": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
      "enabled": true
    },
    "availableAreaPaths": [
      "Project\\Team",
      "Project\\Team\\Frontend",
      "Project\\Team\\Backend"
    ],
    "availableRepositories": [
      "frontend-app",
      "backend-api",
      "shared-lib"
    ]
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: Get Full Configuration**
```json
{
  "section": "all"
}
```

## Configuration

Uses defaults from `.ado-mcp-config.json`.

## Error Handling

### Common Errors

| Error Message | Cause | Resolution |
|--------------|-------|------------|
| "Work item not found" | Invalid ID | Verify ID exists |
| "Insufficient history" | Less than requested revisions | Reduce historyCount |
| "No links found" | No instruction URLs in item | Check work item has security findings |
| "Pattern not supported" | Invalid pattern name | Use supported pattern names |

### Error Recovery

- Returns partial results when some items fail
- Provides detailed error context
- Suggests corrective actions

## Performance Considerations

- **query-wiql with filterByPatterns**: 1 API call per 200 items (integrated into query)
- **analyze-bulk**: Variable API calls based on analysis types (1-3 calls typically)
  - ✅ **Has pagination**: `maxItemsToAnalyze` and `skip` parameters (default: all items, max: 1000)
  - For large query handles, use pagination to control execution time and API calls
  - Internal batching: 50 items per API call
- **analyze-query-handle**: Variable API calls + LLM sampling (depends on item count and context depth)
  - ✅ **Has pagination**: `maxItemsToAnalyze` parameter (default 50, max 100)
  - Recommended for large query handles requiring AI analysis
- **extract-security-links**: 1-2 API calls (item + comments)
- **get-config**: 0 API calls (reads from memory)

### Pagination Support

| Tool | Pagination | Parameter | Notes |
|------|------------|-----------|-------|
| `query-wiql` | ✅ Yes | `maxResults`, `skip` | Pagination at query level |
| `analyze-bulk` | ✅ Yes | `maxItemsToAnalyze`, `skip` | Max 1000 items per call |
| `analyze-query-handle` | ✅ Yes | `maxItemsToAnalyze`, `skip` | Max 100 items |
| `extract-security-links` | N/A | N/A | Single item analysis |
| `get-config` | N/A | N/A | No work items processed |

## Implementation Details

### Key Components

- **Handlers:** `src/services/handlers/analysis/*.handler.ts`
- **Handler:** `src/services/handlers/core/get-configuration.handler.ts`
- **Schema:** `src/config/schemas.ts`
- **Service:** `src/services/ado-work-item-service.ts`

### Integration Points

- **Azure DevOps Work Items API** - Item retrieval
- **Azure DevOps Revisions API** - History analysis
- **Pattern Detection Logic** - Issue identification
- **Hierarchy Validation Logic** - Type and state rules

## Testing

### Test Files

- `test/unit/analysis/*.test.ts`
- `test/integration/analysis-tools.test.ts`

### Test Coverage

- [x] Pattern detection (all patterns)
- [x] Multi-analysis types (effort, velocity, risks, etc.)
- [x] Hierarchy validation (types and states)
- [x] AI-powered custom analysis
- [x] Security link extraction
- [x] Configuration retrieval

### Manual Testing

```bash
# Test pattern detection
{
  "tool": "query-wiql",
  "arguments": {
    "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'Project\\Team'",
    "filterByPatterns": ["duplicates", "placeholder_titles"],
    "returnQueryHandle": true
  }
}

# Test AI-powered analysis
{
  "tool": "analyze-query-handle",
  "arguments": {
    "queryHandle": "qh_abc123",
    "intent": "find stale work items that need attention"
  }
}
```

## Related Features

- [Query Tools](./QUERY_TOOLS.md) - Finding work items to analyze
- [Bulk Operations](./BULK_OPERATIONS.md) - Fixing detected issues
- [Work Item Context](./WORK_ITEM_CONTEXT.md) - Detailed item info

## References

- [Azure DevOps Work Item Types](https://learn.microsoft.com/en-us/azure/devops/boards/work-items/guidance/)
- [Work Item State Workflow](https://learn.microsoft.com/en-us/azure/devops/boards/work-items/workflow-and-state-categories)

---

**Last Updated:** 2025-11-12  
**Author:** Enhanced ADO MCP Team
