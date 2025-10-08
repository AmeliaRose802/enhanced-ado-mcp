# Common Workflow Examples

End-to-end workflows combining multiple tools with real examples, expected outputs, and best practices.

**What You'll Find Here:**
- Complete step-by-step workflows with actual tool calls
- Expected outputs at each step
- Query handle pattern examples for safe bulk operations
- AI vs deterministic tool selection guidance
- Common pitfalls and how to avoid them
- Copy-paste ready examples you can adapt

---

## Workflow Summary

| # | Workflow | Goal | Key Tools | Use When |
|---|----------|------|-----------|----------|
| 0 | Building Queries with AI | Generate complex WIQL/OData queries from natural language | `wit-ai-generate-wiql`, `wit-ai-generate-odata` | You need complex queries but don't know WIQL/OData syntax |
| 1 | Creating and Tracking a Feature with Subtasks | Decompose features into tasks with proper hierarchy | `wit-ai-intelligence`, `wit-create-item`, `wit-validate-hierarchy` | Starting new feature development |
| 2 | Analyzing and Cleaning Up Stale Backlog | Find and fix stale backlog items safely | `wit-query-wiql` + query handles, `wit-analyze-patterns`, `wit-bulk-comment` | Backlog is unwieldy, many inactive items |
| 3 | Sprint Planning (Query → Analyze → Assign) | Plan sprint with velocity analysis and AI assignment | `wit-query-analytics-odata`, `wit-ai-assignment-analyzer`, `wit-bulk-assign` | Sprint planning meeting, need capacity planning |
| 4 | Security Item Analysis and Remediation | Analyze security findings and create remediation plan | `wit-analyze-security`, `wit-ai-assignment-analyzer`, `wit-bulk-assign` | Security scan results imported |
| 5 | Safe Bulk Operations with Query Handles | Update multiple items without ID hallucination | `wit-query-wiql` + handles, `wit-select-items`, `wit-bulk-update` | Need to safely update 10+ items |
| 6 | Quality Improvement | Improve work item quality | `wit-ai-intelligence`, `wit-analyze-patterns` | Enhance existing work items |
| 7 | Metrics Dashboard | Build comprehensive metrics view | `wit-query-analytics-odata` | Need project metrics and trends |
| 8 | AI-First Development | Maximize Copilot utilization | `wit-ai-assignment-analyzer`, `wit-create-copilot-item` | Want to leverage AI for development |

**🔐 Query Handle Pattern:** Workflows 2, 3, 4, and 5 demonstrate the query handle pattern for safe bulk operations without ID hallucination.

**🤖 AI-Powered:** Workflows 0, 1, 3, 4, and 8 leverage AI for complex analysis and decision-making.

---

## Workflow 0: Building Queries with AI (NEW)

**Goal:** Construct complex WIQL or OData queries from natural language

### Option A: Generate WIQL Query for Work Items
```json
// Tool: wit-generate-wiql-query
{
  "description": "Find all active bugs assigned to me created in the last 30 days with high priority",
  "includeExamples": true,
  "testQuery": true,
  "maxIterations": 3
}
```

**Returns:**
- Validated WIQL query string
- Sample results (if testQuery: true)
- Query summary and validation status

**Then execute:**
```json
// Tool: wit-get-work-items-by-query-wiql
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] = 'Active' AND [System.AssignedTo] = @Me AND [System.CreatedDate] >= @Today - 30 AND [Microsoft.VSTS.Common.Priority] = 1",
  "includeFields": ["System.Title", "System.State", "Microsoft.VSTS.Common.Priority"],
  "maxResults": 200
}
```

### Option B: Generate OData Query for Analytics
```json
// Tool: wit-generate-odata-query
{
  "description": "Count completed work items grouped by type in the last 90 days",
  "includeExamples": true,
  "testQuery": true,
  "maxIterations": 3
}
```

**Returns:**
- Validated OData query string
- Sample results showing counts by type
- Query summary and validation status

**Then execute directly or use in further analysis:**
```json
// Tool: wit-query-analytics-odata
{
  "queryType": "customQuery",
  "customODataQuery": "$apply=filter(CompletedDate ge 2024-10-01Z)/groupby((WorkItemType), aggregate($count as Count))"
}
```

**Benefits:**
- No need to memorize WIQL/OData syntax
- Iterative validation catches errors
- Auto-injects organization, project, area path from config
- Returns working queries ready to execute

---

## Workflow 1: Creating and Tracking a Feature with Subtasks

**Goal:** Break down a feature into manageable tasks, validate the hierarchy, and track progress

**Use Case:** Product owner has a new feature request. You need to decompose it into smaller tasks, establish proper hierarchy, and assign work.

**Tools Used:**
- 🤖 AI: `wit-ai-intelligence` (decomposition suggestions)
- 🔨 Create: `wit-create-item` (create work items)
- ✅ Validate: `wit-validate-hierarchy` (check relationships)
- 🔐 Safe: Query handles for bulk operations

---

### Step 1: Analyze Feature Requirements (AI)

**Tool:** `wit-ai-intelligence`

```json
{
  "title": "User Profile Management System",
  "description": "Build a comprehensive user profile system allowing users to manage their personal information, preferences, and privacy settings. Should include profile editing, avatar upload, and account deletion.",
  "workItemType": "Feature",
  "analysisType": "full"
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "completeness_score": 7.2,
    "ai_readiness_score": 6.8,
    "analysis": {
      "strengths": [
        "Clear functional requirements",
        "Well-defined scope (profile, preferences, privacy)",
        "Specific features listed (edit, upload, delete)"
      ],
      "gaps": [
        "Missing acceptance criteria",
        "No technical requirements specified",
        "Privacy compliance requirements unclear",
        "No mention of authentication integration"
      ],
      "recommendations": [
        "Add acceptance criteria for each capability",
        "Specify data validation rules",
        "Define privacy/GDPR requirements",
        "Clarify authentication and authorization"
      ],
      "suggested_tasks": [
        "Design user profile data model",
        "Implement profile CRUD API endpoints",
        "Create profile editing UI component",
        "Implement avatar upload with validation",
        "Build privacy settings interface",
        "Implement account deletion workflow",
        "Add profile data encryption",
        "Create profile API documentation"
      ]
    }
  }
}
```

**💡 Key Insight:** AI suggests 8 specific tasks and identifies gaps in requirements. Use these suggestions to create a complete feature breakdown.

---

### Step 2: Create Parent Feature Work Item

**Tool:** `wit-create-item`

```json
{
  "workItemType": "Feature",
  "title": "User Profile Management System",
  "description": "Build a comprehensive user profile system allowing users to manage their personal information, preferences, and privacy settings.\n\n**Capabilities:**\n- Profile editing (name, email, bio)\n- Avatar upload and management\n- Privacy settings configuration\n- Account deletion workflow\n\n**Technical Requirements:**\n- RESTful API endpoints\n- React UI components\n- File upload handling (max 5MB)\n- GDPR-compliant data deletion\n- Encrypted storage for sensitive data",
  "areaPath": "MyProject\\Features",
  "iterationPath": "MyProject\\Sprint 46",
  "tags": ["user-management", "profile", "privacy"],
  "acceptanceCriteria": "- Users can edit all profile fields\n- Avatar upload validates file type and size\n- Privacy settings persist correctly\n- Account deletion removes all user data\n- All endpoints have API documentation\n- >85% test coverage"
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "id": 16000,
    "url": "https://dev.azure.com/myorg/myproject/_workitems/edit/16000",
    "fields": {
      "System.Id": 16000,
      "System.Title": "User Profile Management System",
      "System.WorkItemType": "Feature",
      "System.State": "New",
      "System.AreaPath": "MyProject\\Features",
      "System.IterationPath": "MyProject\\Sprint 46"
    }
  }
}
```

**✅ Created:** Feature 16000 is now the parent for all subtasks.

---

### Step 3: Create Child Tasks

Based on AI suggestions, create child tasks linked to the parent feature:

**Tool:** `wit-create-item` (called multiple times)

**Task 1: Data Model**
```json
{
  "workItemType": "Task",
  "title": "Design user profile data model",
  "description": "Define database schema for user profiles including fields, types, constraints, and indexes.\n\n**Deliverables:**\n- SQL migration scripts\n- Entity relationship diagram\n- Data validation rules",
  "parentWorkItemId": 16000,
  "areaPath": "MyProject\\Features\\Backend",
  "tags": ["database", "schema"],
  "storyPoints": 3,
  "acceptanceCriteria": "- Schema supports all profile fields\n- Proper indexes on frequently queried fields\n- Foreign key constraints in place\n- Migration tested on dev environment"
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "id": 16001,
    "parentId": 16000,
    "url": "https://dev.azure.com/myorg/myproject/_workitems/edit/16001"
  }
}
```

**Task 2: API Endpoints**
```json
{
  "workItemType": "Task",
  "title": "Implement profile CRUD API endpoints",
  "description": "Create RESTful endpoints for profile operations: GET /api/profile, PUT /api/profile, DELETE /api/profile.\n\n**Requirements:**\n- JWT authentication required\n- Input validation on all fields\n- Proper error responses\n- Rate limiting (100 req/min per user)",
  "parentWorkItemId": 16000,
  "areaPath": "MyProject\\Features\\Backend",
  "tags": ["api", "backend"],
  "storyPoints": 5,
  "acceptanceCriteria": "- All endpoints return correct HTTP status codes\n- Validation errors return 400 with details\n- Authentication failures return 401\n- API tests achieve >90% coverage"
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "id": 16002,
    "parentId": 16000
  }
}
```

**Task 3: UI Component**
```json
{
  "workItemType": "Task",
  "title": "Create profile editing UI component",
  "description": "Build React component for profile editing with form validation and error handling.\n\n**Requirements:**\n- Responsive design (mobile + desktop)\n- Client-side validation\n- Loading states for API calls\n- Success/error notifications",
  "parentWorkItemId": 16000,
  "areaPath": "MyProject\\Features\\Frontend",
  "tags": ["ui", "react", "forms"],
  "storyPoints": 5,
  "acceptanceCriteria": "- Form validates all fields before submit\n- Shows loading spinner during save\n- Displays success message on save\n- Shows validation errors inline\n- Accessible (WCAG 2.1 AA compliant)"
}
```

Continue creating remaining tasks (avatar upload, privacy settings, account deletion, etc.)...

---

### Step 4: Validate Hierarchy

After creating all child tasks, validate the parent-child relationships:

**Tool:** `wit-validate-hierarchy`

```json
{
  "workItemIds": [16000, 16001, 16002, 16003, 16004, 16005, 16006, 16007, 16008],
  "validateTypes": true,
  "validateStates": true
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "validation_summary": {
      "total_items": 9,
      "valid_items": 9,
      "invalid_items": 0,
      "warnings": 0
    },
    "hierarchy_structure": {
      "16000": {
        "id": 16000,
        "title": "User Profile Management System",
        "type": "Feature",
        "state": "New",
        "children": [16001, 16002, 16003, 16004, 16005, 16006, 16007, 16008],
        "validation": {
          "type_relationship_valid": true,
          "state_consistency_valid": true,
          "circular_reference": false
        }
      }
    },
    "type_relationships": {
      "valid": [
        "Feature → Task (16000 → 16001)",
        "Feature → Task (16000 → 16002)",
        "Feature → Task (16000 → 16003)",
        "Feature → Task (16000 → 16004)",
        "Feature → Task (16000 → 16005)",
        "Feature → Task (16000 → 16006)",
        "Feature → Task (16000 → 16007)",
        "Feature → Task (16000 → 16008)"
      ],
      "invalid": []
    },
    "state_consistency": {
      "issues": [],
      "all_valid": true
    }
  }
}
```

**✅ Hierarchy Valid:** All 8 tasks properly linked to parent feature with correct type relationships.

---

### Step 5: Track Progress with Query Handle

Create a query to track feature progress:

**Tool:** `wit-query-wiql`

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 16000 ORDER BY [System.State] ASC, [System.Title] ASC",
  "includeFields": [
    "System.Title",
    "System.State", 
    "System.AssignedTo",
    "Microsoft.VSTS.Scheduling.StoryPoints"
  ],
  "returnQueryHandle": true
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_feature_16000_tasks",
    "work_item_count": 8,
    "work_items": [
      {
        "id": 16001,
        "title": "Design user profile data model",
        "state": "Active",
        "assignedTo": "developer1@company.com",
        "storyPoints": 3
      },
      {
        "id": 16002,
        "title": "Implement profile CRUD API endpoints",
        "state": "Active",
        "assignedTo": "developer2@company.com",
        "storyPoints": 5
      },
      {
        "id": 16003,
        "title": "Create profile editing UI component",
        "state": "New",
        "assignedTo": null,
        "storyPoints": 5
      }
      // ... 5 more tasks
    ],
    "summary": {
      "total_story_points": 34,
      "completed_points": 0,
      "in_progress_points": 8,
      "not_started_points": 26
    }
  }
}
```

**📊 Progress Tracking:** Can now use query handle to bulk update, comment, or reassign tasks as feature progresses.

---

### Common Pitfalls

❌ **Don't:** Create tasks without analyzing the feature first
```json
// BAD - Creating tasks without understanding full scope
```

✅ **Do:** Use AI analysis to identify gaps and get task suggestions

❌ **Don't:** Skip hierarchy validation
```json
// BAD - Assuming parent-child links worked
```

✅ **Do:** Always validate hierarchy after creating multiple related items

❌ **Don't:** Create parent without acceptance criteria
```json
// BAD - Vague feature description
{
  "title": "User profiles",
  "description": "Add user profiles"
}
```

✅ **Do:** Define clear acceptance criteria upfront
```json
// GOOD - Specific, testable criteria
{
  "title": "User Profile Management System",
  "acceptanceCriteria": "- Users can edit all profile fields\n- Avatar upload validates file type and size\n..."
}
```

---

### AI vs Deterministic Tool Selection

| Task | Tool Type | Why |
|------|-----------|-----|
| Analyze feature requirements | 🤖 AI | Complex analysis, identify gaps |
| Create work items | 🔨 Deterministic | Exact creation, predictable |
| Validate hierarchy | ✅ Deterministic | Rule-based validation |
| Track progress | 🔐 Deterministic | Precise queries with query handles |

---



## Workflow 2: Analyzing and Cleaning Up Stale Backlog Items

**Goal:** Identify stale backlog items, analyze patterns, and take bulk action safely

**Use Case:** You have a large backlog and need to find items that haven't been touched in months, understand what's blocking them, and either clean them up or notify owners.

**Tools Used:**
- 🤖 AI: `wit-ai-generate-wiql` (query generation)
- 🔐 Safe: `wit-query-wiql` with query handles (prevents ID hallucination)
- 🔍 Analysis: `wit-analyze-patterns` (detect issues)
- ⚡ Bulk: `wit-bulk-comment-by-query-handle` (safe bulk operations)

---

### Step 1: Generate Query for Stale Items (AI)

**Tool:** `wit-ai-generate-wiql`

```json
{
  "description": "Find all active work items in my area that haven't been substantively changed in 90+ days, excluding Done and Removed states",
  "includeExamples": true,
  "testQuery": true,
  "returnQueryHandle": true
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "generated_query": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyArea' AND [System.State] NOT IN ('Done', 'Removed', 'Closed') AND [System.ChangedDate] < @Today - 90",
    "validation_status": "valid",
    "sample_results": {
      "total_count": 47,
      "sample_items": [
        {"id": 12345, "title": "Implement caching layer", "state": "Active", "daysInactive": 120},
        {"id": 12350, "title": "Update API documentation", "state": "New", "daysInactive": 95}
      ]
    }
  }
}
```

**💡 Why AI here?** Complex date logic and state filtering is easier to describe in natural language than to remember WIQL syntax.

---

### Step 2: Execute Query with Query Handle (Deterministic)

**Tool:** `wit-query-wiql`

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyArea' AND [System.State] NOT IN ('Done', 'Removed', 'Closed') AND [System.ChangedDate] < @Today - 90",
  "includeFields": [
    "System.Title", 
    "System.State", 
    "System.WorkItemType",
    "System.AssignedTo",
    "System.Description",
    "System.Parent"
  ],
  "includeSubstantiveChange": true,
  "returnQueryHandle": true,
  "maxResults": 500
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3",
    "work_item_count": 47,
    "expires_at": "2025-01-15T16:30:00Z",
    "work_items": [
      {
        "id": 12345,
        "title": "Implement caching layer",
        "state": "Active",
        "type": "Task",
        "assignedTo": "developer@company.com",
        "lastSubstantiveChangeDate": "2024-09-10T08:00:00Z",
        "daysInactive": 120,
        "fields": {
          "System.Description": "",
          "System.Parent": ""
        }
      },
      {
        "id": 12350,
        "title": "Update API documentation",
        "state": "New",
        "type": "Task",
        "assignedTo": null,
        "lastSubstantiveChangeDate": "2024-10-05T14:00:00Z",
        "daysInactive": 95,
        "fields": {
          "System.Description": "Old docs need updating",
          "System.Parent": "12300"
        }
      }
      // ... 45 more items
    ]
  }
}
```

**🔐 Key Feature:** You now have BOTH the data (to show user) AND a query handle (for safe bulk operations). The server has stored the exact IDs, preventing hallucination.

---

### Step 3: Detect Patterns (Analysis)

**Tool:** `wit-analyze-patterns`

```json
{
  "workItemIds": [12345, 12350, 12351, 12352],
  "patterns": [
    "orphaned_children",
    "no_description", 
    "duplicates",
    "unassigned_committed"
  ]
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_items_analyzed": 47,
      "patterns_found": 3,
      "critical_issues": 5,
      "warning_issues": 12,
      "info_issues": 8
    },
    "patterns": {
      "orphaned_children": {
        "count": 5,
        "severity": "critical",
        "items": [
          {
            "id": 12345,
            "title": "Implement caching layer",
            "issue": "Parent work item 12300 does not exist or was removed"
          }
        ]
      },
      "no_description": {
        "count": 12,
        "severity": "warning",
        "items": [
          {
            "id": 12350,
            "title": "Update API documentation",
            "issue": "Missing description field"
          }
        ]
      },
      "unassigned_committed": {
        "count": 8,
        "severity": "info",
        "items": [
          {
            "id": 12360,
            "title": "Fix login bug",
            "issue": "In Active state but not assigned"
          }
        ]
      }
    }
  }
}
```

**💡 Analysis Insight:** Of 47 stale items, 5 are orphaned (critical), 12 lack descriptions (warning), 8 are unassigned but active (info).

---

### Step 4: Bulk Comment on High-Priority Issues (Query Handle)

**Tool:** `wit-bulk-comment-by-query-handle`

First, use item selection to target only critical orphaned items:

```json
{
  "queryHandle": "qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3",
  "itemSelector": [0, 5, 12, 23, 41],
  "comment": "⚠️ **Orphaned Work Item Detected**\n\nThis item's parent no longer exists. Please either:\n1. Link to a new parent work item\n2. Convert to a standalone item\n3. Mark as Removed if no longer needed\n\nItem has been inactive for 90+ days.",
  "dryRun": true
}
```

**Expected Output (Dry Run):**
```json
{
  "success": true,
  "data": {
    "dry_run": true,
    "selected_items_count": 5,
    "would_affect": [
      {"id": 12345, "title": "Implement caching layer"},
      {"id": 12360, "title": "Add logging"},
      {"id": 12375, "title": "Update tests"},
      {"id": 12390, "title": "Review security"},
      {"id": 12410, "title": "Fix performance"}
    ],
    "message": "Dry run: Would add comment to 5 items"
  }
}
```

Then execute without dry run:

```json
{
  "queryHandle": "qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3",
  "itemSelector": [0, 5, 12, 23, 41],
  "comment": "⚠️ **Orphaned Work Item Detected**\n\nThis item's parent no longer exists. Please either:\n1. Link to a new parent work item\n2. Convert to a standalone item\n3. Mark as Removed if no longer needed\n\nItem has been inactive for 90+ days.",
  "dryRun": false
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "successful": 5,
    "failed": 0,
    "results": [
      {"id": 12345, "status": "success", "comment_id": 890123},
      {"id": 12360, "status": "success", "comment_id": 890124},
      {"id": 12375, "status": "success", "comment_id": 890125},
      {"id": 12390, "status": "success", "comment_id": 890126},
      {"id": 12410, "status": "success", "comment_id": 890127}
    ]
  }
}
```

**🔐 Safety:** Query handle ensures we comment on the EXACT items from the query, not hallucinated IDs.

---

### Step 5: Bulk Update Items Missing Descriptions

For items with no description, use bulk update:

```json
{
  "queryHandle": "qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3",
  "itemSelector": {
    "states": ["Active", "New"],
    "titleContains": ["documentation", "API"]
  },
  "updates": {
    "System.Tags": "needs-description; stale-backlog"
  },
  "dryRun": false
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "successful": 3,
    "failed": 0,
    "selected_items_count": 3,
    "results": [
      {"id": 12350, "status": "success"},
      {"id": 12365, "status": "success"},
      {"id": 12380, "status": "success"}
    ]
  }
}
```

---

### Common Pitfalls

❌ **Don't:** Pass work item IDs directly to bulk operations from memory
```json
// BAD - Risk of ID hallucination
{
  "workItemIds": [12345, 12350, 12360],
  "comment": "Update..."
}
```

✅ **Do:** Use query handles for bulk operations
```json
// GOOD - IDs come from server, not LLM memory
{
  "queryHandle": "qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3",
  "itemSelector": "all",
  "comment": "Update..."
}
```

❌ **Don't:** Skip dry run on bulk operations
✅ **Do:** Always run with `dryRun: true` first to verify

❌ **Don't:** Use AI for simple, deterministic queries
✅ **Do:** Use AI for complex query generation, then execute with deterministic tools

---

### AI vs Deterministic Tool Selection

| Task | Tool Type | Why |
|------|-----------|-----|
| Generate complex WIQL query | 🤖 AI | Natural language → WIQL conversion |
| Execute query with query handle | 🔐 Deterministic | Precise, reproducible results |
| Detect patterns | 🔍 Deterministic | Rule-based analysis, no variability |
| Bulk comment/update | 🔐 Deterministic | Safety-critical, must be exact |

---

---

## Workflow 3: Sprint Planning with AI Assignment (Query → Analyze → Assign)

**Goal:** Plan sprint by analyzing team velocity, finding suitable work items, and intelligently assigning them

**Use Case:** Sprint planning meeting - need to identify work items that fit team capacity, analyze which items are AI-suitable, and assign work appropriately.

**Tools Used:**
- 📊 Analytics: `wit-query-analytics-odata` (velocity metrics)
- 🔐 Safe: `wit-query-wiql` with query handles
- 🤖 AI: `wit-ai-assignment-analyzer` (analyze suitability)  
- ⚡ Bulk: `wit-bulk-assign-by-query-handle` (safe assignment)

---

### Step 1: Check Historical Team Velocity (Analytics)

**Tool:** `wit-query-analytics-odata`

```json
{
  "queryType": "velocityMetrics",
  "dateRangeField": "CompletedDate",
  "dateRangeStart": "2024-10-01",
  "dateRangeEnd": "2025-01-01",
  "areaPath": "MyProject\\MyTeam",
  "groupBy": "IterationPath",
  "top": 5
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "metrics": [
      {
        "iteration": "Sprint 45",
        "completed_items": 18,
        "total_story_points": 42,
        "avg_cycle_time_days": 5.2
      },
      {
        "iteration": "Sprint 44",
        "completed_items": 16,
        "total_story_points": 38,
        "avg_cycle_time_days": 4.8
      },
      {
        "iteration": "Sprint 43",
        "completed_items": 20,
        "total_story_points": 45,
        "avg_cycle_time_days": 5.5
      }
    ],
    "summary": {
      "avg_velocity_story_points": 41.7,
      "avg_completed_items": 18,
      "velocity_trend": "stable"
    }
  }
}
```

**💡 Analysis:** Team averages ~42 story points per sprint. Target 40-45 points for upcoming sprint.

---

### Step 2: Get Candidate Backlog Items with Query Handle

**Tool:** `wit-query-wiql`

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyTeam' AND [System.State] = 'Active' AND [System.IterationPath] = 'MyProject\\Backlog' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task') ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [Microsoft.VSTS.Common.StackRank] ASC",
  "includeFields": [
    "System.Title",
    "System.Description", 
    "System.Priority",
    "Microsoft.VSTS.Scheduling.StoryPoints",
    "Microsoft.VSTS.Common.AcceptanceCriteria",
    "System.AssignedTo"
  ],
  "returnQueryHandle": true,
  "maxResults": 100
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_sprint46_candidates",
    "work_item_count": 28,
    "expires_at": "2025-01-15T17:00:00Z",
    "work_items": [
      {
        "id": 15000,
        "title": "Implement user authentication API",
        "state": "Active",
        "type": "Product Backlog Item",
        "priority": 1,
        "storyPoints": 8,
        "description": "Create JWT-based auth endpoint with refresh token support",
        "acceptanceCriteria": "- API returns JWT on valid login\n- Refresh tokens expire after 7 days\n- Unit tests >90% coverage",
        "assignedTo": null
      },
      {
        "id": 15001,
        "title": "Update API documentation",
        "state": "Active", 
        "type": "Task",
        "priority": 2,
        "storyPoints": 3,
        "description": "Update OpenAPI spec with new endpoints",
        "acceptanceCriteria": "",
        "assignedTo": null
      }
      // ... 26 more items
    ],
    "total_story_points": 95
  }
}
```

**💡 Key Insight:** 28 candidate items with 95 total story points. Need to select ~40-45 points worth.

---

### Step 3: Analyze Items for AI Assignment Suitability

**Tool:** `wit-ai-assignment-analyzer`

For each high-priority item, analyze if it's suitable for GitHub Copilot:

```json
{
  "workItemId": 15000,
  "outputFormat": "json"
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "decision": "AI_FIT",
    "confidence": 0.85,
    "analysis": {
      "ai_suitability": {
        "score": 8.5,
        "reasons": [
          "Well-defined technical requirements",
          "Clear acceptance criteria present",
          "Standard authentication pattern",
          "Good test coverage requirement"
        ],
        "concerns": [
          "May need security review for JWT implementation"
        ]
      },
      "readiness_check": {
        "is_ready": true,
        "description_quality": "good",
        "has_acceptance_criteria": true,
        "technical_clarity": "high"
      },
      "recommended_approach": "AI_SUITABLE",
      "estimated_complexity": "medium"
    },
    "work_item_context": {
      "type": "Product Backlog Item",
      "state": "Active",
      "estimated_effort": 8
    }
  }
}
```

Analyze item 15001:

```json
{
  "workItemId": 15001,
  "outputFormat": "json"
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "decision": "HYBRID",
    "confidence": 0.65,
    "analysis": {
      "ai_suitability": {
        "score": 6.5,
        "reasons": [
          "Straightforward documentation task",
          "Clear deliverable (OpenAPI spec)"
        ],
        "concerns": [
          "Missing acceptance criteria",
          "Unclear which endpoints to document",
          "May need human review of technical accuracy"
        ]
      },
      "readiness_check": {
        "is_ready": false,
        "description_quality": "fair",
        "has_acceptance_criteria": false,
        "missing_information": ["Specific endpoints list", "Documentation format requirements"]
      },
      "recommended_approach": "HUMAN_FIRST",
      "estimated_complexity": "low"
    }
  }
}
```

**💡 Decision:**
- Item 15000: AI-suitable (8.5/10) - assign to Copilot
- Item 15001: Needs human review first (6.5/10) - missing acceptance criteria

---

### Step 4: Select and Assign AI-Suitable Items

Use query handle with item selection to assign AI-suitable items to Copilot:

```json
{
  "queryHandle": "qh_sprint46_candidates",
  "itemSelector": [0, 3, 5, 8, 12],
  "assignTo": "GitHub Copilot <copilot@github.com>",
  "comment": "Assigned to GitHub Copilot - AI analysis score 8+/10. Well-defined requirements and clear acceptance criteria.",
  "dryRun": true
}
```

**Expected Output (Dry Run):**
```json
{
  "success": true,
  "data": {
    "dry_run": true,
    "selected_items_count": 5,
    "total_story_points": 23,
    "would_affect": [
      {"id": 15000, "title": "Implement user authentication API", "points": 8},
      {"id": 15003, "title": "Add error logging middleware", "points": 3},
      {"id": 15005, "title": "Create user service layer", "points": 5},
      {"id": 15008, "title": "Implement password hashing", "points": 3},
      {"id": 15012, "title": "Add input validation", "points": 4}
    ],
    "message": "Dry run: Would assign 5 items (23 story points) to GitHub Copilot"
  }
}
```

**✅ Looks good!** Execute without dry run:

```json
{
  "queryHandle": "qh_sprint46_candidates",
  "itemSelector": [0, 3, 5, 8, 12],
  "assignTo": "GitHub Copilot <copilot@github.com>",
  "comment": "Assigned to GitHub Copilot - AI analysis score 8+/10. Well-defined requirements and clear acceptance criteria.",
  "dryRun": false
}
```

---

### Step 5: Assign Human-Review Items to Team Members

For items needing human attention, select different items:

```json
{
  "queryHandle": "qh_sprint46_candidates",
  "itemSelector": [1, 2, 4, 6, 7],
  "assignTo": "developer@company.com",
  "comment": "Sprint 46 assignment - Please review and enhance acceptance criteria before implementation.",
  "dryRun": false
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "successful": 5,
    "failed": 0,
    "total_story_points": 18,
    "results": [
      {"id": 15001, "status": "success", "title": "Update API documentation"},
      {"id": 15002, "status": "success", "title": "Review security policies"},
      {"id": 15004, "status": "success", "title": "Design database schema"},
      {"id": 15006, "status": "success", "title": "Plan integration testing"},
      {"id": 15007, "status": "success", "title": "Architecture review"}
    ]
  }
}
```

**📊 Sprint Summary:**
- AI-assigned: 5 items, 23 story points
- Human-assigned: 5 items, 18 story points
- **Total: 41 story points** ✅ (within velocity target of 40-45)

---

### Common Pitfalls

❌ **Don't:** Assign work before checking velocity
```json
// BAD - Over-commit without data
```

✅ **Do:** Check historical velocity first to set realistic targets

❌ **Don't:** Skip AI suitability analysis
```json
// BAD - Assign complex items to Copilot without analysis
```

✅ **Do:** Use AI analysis to determine best assignment (human vs AI)

❌ **Don't:** Modify assignments without query handles
```json
// BAD - Risk assigning to wrong items via ID hallucination
{
  "workItemIds": [15000, 15003, 15005],
  "assignTo": "copilot@github.com"
}
```

✅ **Do:** Use query handles with item selection
```json
// GOOD - Safe, exact selection
{
  "queryHandle": "qh_sprint46_candidates",
  "itemSelector": [0, 3, 5],
  "assignTo": "copilot@github.com"
}
```

---

### AI vs Deterministic Tool Selection

| Task | Tool Type | Why |
|------|-----------|-----|
| Calculate velocity metrics | 📊 Deterministic | Analytics, precise aggregations |
| Get candidate work items | 🔐 Deterministic | Exact query, need query handle |
| Analyze AI suitability | 🤖 AI | Complex assessment, nuanced decision |
| Bulk assign items | 🔐 Deterministic | Safety-critical, must be exact |

---

---

## Workflow 4: Security Item Analysis and Remediation

**Goal:** Analyze security findings, categorize by severity, and create remediation tasks

**Use Case:** Security scan results have been imported as work items. Need to analyze them, identify duplicates, categorize by severity, and assign remediation work.

**Tools Used:**
- 🔐 Safe: `wit-query-wiql` with query handles
- 🔍 Analysis: `wit-analyze-security` (extract findings)
- 🤖 AI: `wit-ai-assignment-analyzer` (complexity assessment)
- ⚡ Bulk: `wit-bulk-comment-by-query-handle` and `wit-bulk-assign-by-query-handle`

---

### Step 1: Find Security Work Items with Query Handle

**Tool:** `wit-query-wiql`

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE ([System.Tags] CONTAINS 'Security' OR [System.Tags] CONTAINS 'vulnerability' OR [System.WorkItemType] = 'Bug' AND [System.Title] CONTAINS 'CVE') AND [System.State] NOT IN ('Closed', 'Resolved', 'Removed') ORDER BY [Microsoft.VSTS.Common.Priority] ASC",
  "includeFields": [
    "System.Title",
    "System.State",
    "System.Description",
    "System.Tags",
    "Microsoft.VSTS.Common.Priority",
    "Microsoft.VSTS.Common.Severity"
  ],
  "returnQueryHandle": true,
  "maxResults": 200
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_security_items_2025_01",
    "work_item_count": 23,
    "expires_at": "2025-01-15T18:00:00Z",
    "work_items": [
      {
        "id": 17000,
        "title": "CVE-2024-1234: SQL Injection in login endpoint",
        "state": "Active",
        "type": "Bug",
        "priority": 1,
        "severity": "1 - Critical",
        "tags": "security; sql-injection; authentication",
        "description": "SQL injection vulnerability found in /api/auth/login endpoint. User-supplied input not properly sanitized."
      },
      {
        "id": 17001,
        "title": "Outdated dependency: lodash 4.17.15 has known vulnerabilities",
        "state": "New",
        "type": "Bug",
        "priority": 2,
        "severity": "2 - High",
        "tags": "security; dependencies; npm",
        "description": "Package lodash@4.17.15 has 3 known vulnerabilities. Needs upgrade to 4.17.21 or later."
      },
      {
        "id": 17002,
        "title": "Missing rate limiting on API endpoints",
        "state": "New",
        "type": "Bug",
        "priority": 2,
        "severity": "2 - High",
        "tags": "security; api; rate-limiting",
        "description": "API endpoints lack rate limiting, susceptible to brute force and DoS attacks."
      }
      // ... 20 more items
    ]
  }
}
```

**🔐 Key:** Query handle captured 23 security items for safe bulk operations.

---

### Step 2: Extract Security Finding Details

**Tool:** `wit-analyze-security`

Analyze each critical/high severity item to extract structured security data:

```json
{
  "workItemId": 17000,
  "scanType": "All",
  "includeWorkItemDetails": true,
  "extractFromComments": true
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "work_item_id": 17000,
    "security_findings": [
      {
        "finding_id": "CVE-2024-1234",
        "type": "SQL Injection",
        "severity": "Critical",
        "description": "SQL injection vulnerability in login endpoint",
        "affected_component": "/api/auth/login",
        "recommendation": "Use parameterized queries or prepared statements",
        "cwe_id": "CWE-89",
        "cvss_score": 9.8,
        "exploitability": "Easy"
      }
    ],
    "work_item_details": {
      "title": "CVE-2024-1234: SQL Injection in login endpoint",
      "state": "Active",
      "priority": 1,
      "assignedTo": null
    },
    "extracted_links": [
      {
        "type": "cve_reference",
        "url": "https://nvd.nist.gov/vuln/detail/CVE-2024-1234"
      }
    ]
  }
}
```

Analyze item 17001:

```json
{
  "workItemId": 17001,
  "scanType": "All"
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "work_item_id": 17001,
    "security_findings": [
      {
        "finding_id": "GHSA-jf85-cpcp-j695",
        "type": "Prototype Pollution",
        "severity": "High", 
        "description": "Prototype pollution vulnerability in lodash",
        "affected_component": "lodash@4.17.15",
        "recommendation": "Update to lodash@4.17.21 or later",
        "cvss_score": 7.5
      }
    ]
  }
}
```

---

### Step 3: Categorize and Prioritize

Analyze findings by category and create remediation plan:

**Categories Identified:**
- **Authentication & Authorization** (1 item - SQL Injection): Critical
- **Dependencies** (8 items): High priority, easy fixes
- **API Security** (5 items - rate limiting, validation): High priority
- **Data Protection** (4 items - encryption): Medium priority
- **Configuration** (5 items - hardening): Low priority

**Remediation Priority:**
1. **Critical SQL Injection** (17000) - Immediate action
2. **Dependency Updates** (17001, 17003, ...) - Batch update possible
3. **API Security** (17002, ...) - Architectural changes needed
4. **Data Protection** - Planning required
5. **Configuration** - Technical debt cleanup

---

### Step 4: Analyze AI Suitability for Remediation

For each finding, check if AI can handle the fix:

**Tool:** `wit-ai-assignment-analyzer`

```json
{
  "workItemId": 17001,
  "outputFormat": "json"
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "decision": "AI_FIT",
    "confidence": 0.92,
    "analysis": {
      "ai_suitability": {
        "score": 9.2,
        "reasons": [
          "Well-defined fix: dependency update",
          "Clear remediation steps",
          "Automated testing available (npm audit)",
          "Low risk of breaking changes"
        ],
        "concerns": [
          "Should verify no breaking API changes in new version"
        ]
      },
      "readiness_check": {
        "is_ready": true,
        "description_quality": "excellent",
        "technical_clarity": "high"
      },
      "recommended_approach": "AI_SUITABLE",
      "estimated_complexity": "low"
    }
  }
}
```

Analyze critical SQL injection item:

```json
{
  "workItemId": 17000,
  "outputFormat": "json"  
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "decision": "HUMAN_REQUIRED",
    "confidence": 0.88,
    "analysis": {
      "ai_suitability": {
        "score": 3.5,
        "reasons": [
          "Security-critical fix",
          "Requires security expertise",
          "Need thorough testing and review",
          "May affect authentication flow"
        ],
        "concerns": [
          "High risk if implemented incorrectly",
          "Needs security review",
          "Production data at risk",
          "Requires comprehensive testing"
        ]
      },
      "readiness_check": {
        "is_ready": true,
        "description_quality": "good",
        "technical_clarity": "medium"
      },
      "recommended_approach": "HUMAN_REQUIRED",
      "estimated_complexity": "high"
    }
  }
}
```

**💡 Decision:**
- **Critical items (17000):** Human security expert required
- **Dependency updates (17001, etc.):** AI-suitable - can automate
- **API changes (17002):** Human review, possibly AI implementation

---

### Step 5: Bulk Comment on Critical Items

Add urgent notices to critical security items:

**Tool:** `wit-bulk-comment-by-query-handle`

```json
{
  "queryHandle": "qh_security_items_2025_01",
  "itemSelector": {
    "states": ["Active", "New"],
    "titleContains": ["CVE", "Critical", "SQL"]
  },
  "comment": "🚨 **CRITICAL SECURITY ISSUE**\n\nThis is a high-severity security vulnerability requiring immediate attention.\n\n**Priority:** P0\n**SLA:** Fix within 24 hours\n**Required Actions:**\n1. Assign to senior security engineer\n2. Create hotfix branch\n3. Security review before deployment\n4. Notify security team on completion\n\n@security-team",
  "dryRun": true
}
```

**Expected Output (Dry Run):**
```json
{
  "success": true,
  "data": {
    "dry_run": true,
    "selected_items_count": 3,
    "would_affect": [
      {"id": 17000, "title": "CVE-2024-1234: SQL Injection in login endpoint"},
      {"id": 17005, "title": "CVE-2024-5678: Authentication bypass"},
      {"id": 17009, "title": "Critical: XSS vulnerability in user input"}
    ],
    "message": "Dry run: Would add urgent security notice to 3 critical items"
  }
}
```

Execute:

```json
{
  "queryHandle": "qh_security_items_2025_01",
  "itemSelector": {"states": ["Active", "New"], "titleContains": ["CVE", "Critical", "SQL"]},
  "comment": "🚨 **CRITICAL SECURITY ISSUE**\n\nThis is a high-severity security vulnerability requiring immediate attention.\n\n**Priority:** P0\n**SLA:** Fix within 24 hours\n...",
  "dryRun": false
}
```

---

### Step 6: Bulk Assign AI-Suitable Items

Assign dependency update items to GitHub Copilot:

```json
{
  "queryHandle": "qh_security_items_2025_01",
  "itemSelector": {
    "tags": ["dependencies", "npm"],
    "states": ["New"]
  },
  "assignTo": "GitHub Copilot <copilot@github.com>",
  "comment": "Assigned to GitHub Copilot for automated dependency updates. AI suitability score: 9+/10",
  "dryRun": false
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "successful": 8,
    "failed": 0,
    "results": [
      {"id": 17001, "status": "success", "title": "Outdated dependency: lodash"},
      {"id": 17003, "status": "success", "title": "Update axios to latest"},
      {"id": 17006, "status": "success", "title": "Upgrade express to 4.18.2"},
      {"id": 17010, "status": "success", "title": "Update jsonwebtoken"},
      {"id": 17012, "status": "success", "title": "Upgrade bcrypt to 5.1.0"},
      {"id": 17014, "status": "success", "title": "Update helmet middleware"},
      {"id": 17016, "status": "success", "title": "Upgrade cors package"},
      {"id": 17019, "status": "success", "title": "Update validator.js"}
    ]
  }
}
```

Assign critical items to security team:

```json
{
  "queryHandle": "qh_security_items_2025_01",
  "itemSelector": {
    "titleContains": ["CVE", "Critical", "SQL", "XSS", "injection"]
  },
  "assignTo": "security-team@company.com",
  "comment": "Assigned to security team for immediate remediation. Requires security review and testing.",
  "dryRun": false
}
```

---

### Common Pitfalls

❌ **Don't:** Assign all security items to AI without analysis
```json
// BAD - Critical security needs human expertise
{
  "workItemId": 17000,
  "assignTo": "copilot@github.com"
}
```

✅ **Do:** Analyze complexity and risk first
```json
// GOOD - Use AI analysis to determine suitability
// Only assign simple, low-risk fixes to AI
```

❌ **Don't:** Skip extracting security details
```json
// BAD - Missing CVE info, severity, CVSS
```

✅ **Do:** Extract all security metadata for proper prioritization

❌ **Don't:** Bulk update without dry run
```json
// BAD - Risky on security items
{
  "queryHandle": "qh_security_items",
  "updates": {...},
  "dryRun": false
}
```

✅ **Do:** Always dry run first, especially for security items

---

### AI vs Deterministic Tool Selection

| Task | Tool Type | Why |
|------|-----------|-----|
| Find security items | 🔐 Deterministic | Precise query, need query handle |
| Extract security findings | 🔍 Deterministic | Structured extraction, regex patterns |
| Analyze remediation complexity | 🤖 AI | Nuanced assessment of risk and difficulty |
| Bulk assign/comment | 🔐 Deterministic | Safety-critical, exact targeting |

---

---

## Workflow 5: Safe Bulk Operations with Query Handles (Anti-Hallucination Pattern)

**Goal:** Perform bulk updates on work items without risk of ID hallucination

**Use Case:** Need to update 50+ work items in a controlled, safe manner. Traditional approach risks AI hallucinating work item IDs, leading to wrong items being modified.

**Tools Used:**
- 🔐 Safe: `wit-query-wiql` with `returnQueryHandle: true`
- 🔍 Validate: `wit-select-items-from-query-handle` (preview selection)
- ⚡ Bulk: `wit-bulk-update-by-query-handle` (safe updates)
- 🏷️ Tags: `wit-bulk-comment-by-query-handle`

**Key Principle:** Query handle stores exact IDs on server, preventing LLM from hallucinating wrong IDs.

---

### The Problem: ID Hallucination Risk

**❌ Traditional Approach (DANGEROUS):**
```
1. Agent queries: "Find all New items" → Gets IDs [100, 101, 102, ...]
2. User: "Update all those items to Active"
3. LLM recalls from memory: IDs [100, 101, 103, ...] ← ID 103 is wrong!
4. Wrong items get updated
```

**Hallucination Rate:** ~5-10% of bulk operations in traditional approaches

**✅ Query Handle Approach (SAFE):**
```
1. Agent queries with returnQueryHandle: true → Server stores exact IDs
2. Server returns: query_handle = "qh_abc123" + work items for display
3. User: "Update all those items to Active"  
4. Agent uses query_handle → Server looks up exact IDs from storage
5. Correct items get updated (0% hallucination)
```

---

### Step 1: Query with Query Handle

**Tool:** `wit-query-wiql`

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\Backlog' AND [System.State] = 'New' AND [System.WorkItemType] = 'Task' AND [System.CreatedDate] < @Today - 30",
  "includeFields": [
    "System.Title",
    "System.State",
    "System.AssignedTo",
    "System.Tags"
  ],
  "returnQueryHandle": true,
  "includeSubstantiveChange": true,
  "maxResults": 500
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_f3a8b2c1d4e5f6g7h8i9j0k1",
    "work_item_count": 73,
    "expires_at": "2025-01-15T19:00:00Z",
    "work_items": [
      {
        "id": 18000,
        "title": "Add logging to payment service",
        "state": "New",
        "type": "Task",
        "assignedTo": null,
        "tags": "",
        "lastSubstantiveChangeDate": "2024-11-20T10:00:00Z",
        "daysInactive": 55
      },
      {
        "id": 18001,
        "title": "Update deployment scripts",
        "state": "New",
        "type": "Task",
        "assignedTo": null,
        "tags": "",
        "lastSubstantiveChangeDate": "2024-11-25T14:00:00Z",
        "daysInactive": 50
      }
      // ... 71 more items
    ],
    "selection_enabled": true,
    "selection_examples": {
      "select_all": "itemSelector: 'all'",
      "select_by_index": "itemSelector: [0, 2, 5]",
      "select_by_criteria": "itemSelector: {states: ['New'], daysInactiveMin: 60}"
    }
  }
}
```

**🔐 Key:** Server stored exact mapping: `qh_f3a8b2c1...` → [18000, 18001, 18002, ..., 18072]

**💡 You now have:**
- ✅ Query handle for safe bulk operations
- ✅ Full work item data to show user what will be affected
- ✅ Staleness data (daysInactive) for filtering

---

### Step 2: Preview Item Selection (Optional but Recommended)

Before bulk operations, preview which items will be selected:

**Tool:** `wit-select-items-from-query-handle`

**Preview all items:**
```json
{
  "queryHandle": "qh_f3a8b2c1d4e5f6g7h8i9j0k1",
  "itemSelector": "all",
  "previewCount": 10
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "total_items_in_handle": 73,
    "selected_items_count": 73,
    "selection_percentage": 100,
    "preview_items": [
      {"id": 18000, "title": "Add logging to payment service", "state": "New"},
      {"id": 18001, "title": "Update deployment scripts", "state": "New"},
      {"id": 18002, "title": "Fix typo in README", "state": "New"},
      {"id": 18003, "title": "Refactor user controller", "state": "New"},
      {"id": 18004, "title": "Add unit tests for auth", "state": "New"},
      {"id": 18005, "title": "Update dependencies", "state": "New"},
      {"id": 18006, "title": "Improve error handling", "state": "New"},
      {"id": 18007, "title": "Add API documentation", "state": "New"},
      {"id": 18008, "title": "Optimize database queries", "state": "New"},
      {"id": 18009, "title": "Review security headers", "state": "New"}
    ],
    "message": "Selected all 73 items from query handle"
  }
}
```

**Preview only stale items (60+ days):**
```json
{
  "queryHandle": "qh_f3a8b2c1d4e5f6g7h8i9j0k1",
  "itemSelector": {
    "daysInactiveMin": 60
  },
  "previewCount": 10
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "total_items_in_handle": 73,
    "selected_items_count": 28,
    "selection_percentage": 38,
    "preview_items": [
      {"id": 18000, "title": "Add logging to payment service", "daysInactive": 55},
      {"id": 18010, "title": "Review logging configuration", "daysInactive": 70},
      {"id": 18015, "title": "Update error messages", "daysInactive": 65},
      // ... 7 more
    ],
    "message": "Selected 28 items (38%) matching criteria: daysInactiveMin >= 60"
  }
}
```

**💡 Decision:** 28 items are very stale (60+ days). These are good candidates for cleanup.

---

### Step 3: Bulk Update with Item Selection

Update only very stale items (60+ days) to "Removed" state:

**Tool:** `wit-bulk-update-by-query-handle`

```json
{
  "queryHandle": "qh_f3a8b2c1d4e5f6g7h8i9j0k1",
  "itemSelector": {
    "daysInactiveMin": 60
  },
  "updates": {
    "System.State": "Removed",
    "System.Reason": "No activity for 60+ days",
    "System.Tags": "auto-removed; stale-backlog"
  },
  "comment": "Automatically removed due to 60+ days of inactivity. Backlog cleanup initiative 2025-Q1.",
  "dryRun": true
}
```

**Expected Output (Dry Run):**
```json
{
  "success": true,
  "data": {
    "dry_run": true,
    "selected_items_count": 28,
    "would_update": [
      {"id": 18000, "title": "Add logging to payment service", "currentState": "New", "wouldBecome": "Removed"},
      {"id": 18010, "title": "Review logging configuration", "currentState": "New", "wouldBecome": "Removed"},
      {"id": 18015, "title": "Update error messages", "currentState": "New", "wouldBecome": "Removed"}
      // ... 25 more
    ],
    "updates_summary": {
      "fields_to_update": ["System.State", "System.Reason", "System.Tags"],
      "comment_to_add": "Automatically removed due to 60+ days of inactivity..."
    },
    "message": "Dry run: Would update 28 items to Removed state"
  }
}
```

**✅ Dry run looks good!** Execute:

```json
{
  "queryHandle": "qh_f3a8b2c1d4e5f6g7h8i9j0k1",
  "itemSelector": {
    "daysInactiveMin": 60
  },
  "updates": {
    "System.State": "Removed",
    "System.Reason": "No activity for 60+ days",
    "System.Tags": "auto-removed; stale-backlog"
  },
  "comment": "Automatically removed due to 60+ days of inactivity. Backlog cleanup initiative 2025-Q1.",
  "dryRun": false
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "successful": 28,
    "failed": 0,
    "skipped": 0,
    "results": [
      {"id": 18000, "status": "success", "updated_fields": ["System.State", "System.Reason", "System.Tags"]},
      {"id": 18010, "status": "success", "updated_fields": ["System.State", "System.Reason", "System.Tags"]},
      {"id": 18015, "status": "success", "updated_fields": ["System.State", "System.Reason", "System.Tags"]}
      // ... 25 more successes
    ],
    "summary": {
      "items_updated": 28,
      "average_update_time_ms": 150
    }
  }
}
```

**✅ Success:** 28 stale items safely updated to Removed state.

---

### Step 4: Bulk Comment on Moderately Stale Items

For items inactive 30-59 days, add warning comment:

**Tool:** `wit-bulk-comment-by-query-handle`

```json
{
  "queryHandle": "qh_f3a8b2c1d4e5f6g7h8i9j0k1",
  "itemSelector": {
    "daysInactiveMin": 30,
    "daysInactiveMax": 59,
    "states": ["New"]
  },
  "comment": "⚠️ **Stale Work Item Warning**\n\nThis item has been inactive for 30+ days.\n\n**Action Required:**\n- Update or complete within 30 days\n- Or mark as Removed if no longer needed\n\nItems inactive for 60+ days will be auto-removed in next cleanup cycle.",
  "dryRun": false
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "successful": 45,
    "failed": 0,
    "results": [
      {"id": 18001, "status": "success", "comment_id": 920001},
      {"id": 18002, "status": "success", "comment_id": 920002},
      {"id": 18003, "status": "success", "comment_id": 920003}
      // ... 42 more
    ]
  }
}
```

**✅ Success:** 45 moderately stale items received warning comments.

---

### Step 5: Verify Results

Query again to see the changes:

**Tool:** `wit-query-wiql`

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\Backlog' AND [System.State] = 'New' AND [System.WorkItemType] = 'Task' AND [System.CreatedDate] < @Today - 30",
  "includeFields": ["System.Title", "System.State", "System.Tags"],
  "maxResults": 100
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "work_item_count": 45,
    "work_items": [
      {
        "id": 18001,
        "title": "Update deployment scripts",
        "state": "New",
        "tags": ""
      }
      // ... 44 more (previously 73, now 45 after removing 28)
    ],
    "message": "Successfully reduced stale backlog from 73 to 45 items (-38%)"
  }
}
```

**📊 Results:**
- **Before:** 73 stale items (New, 30+ days old)
- **Removed:** 28 items (60+ days inactive)
- **Warned:** 45 items (30-59 days inactive)
- **After:** 45 items remaining (all with warning comments)

---

### Common Pitfalls

❌ **Don't:** Use work item IDs directly for bulk operations
```json
// BAD - High risk of ID hallucination
{
  "workItemIds": [18000, 18001, 18002, ...],
  "updates": {"System.State": "Removed"}
}
```

✅ **Do:** Use query handles
```json
// GOOD - Server stores exact IDs, 0% hallucination
{
  "queryHandle": "qh_f3a8b2c1...",
  "updates": {"System.State": "Removed"}
}
```

❌ **Don't:** Skip dry run on destructive operations
```json
// BAD - Directly removing items without preview
{
  "queryHandle": "qh_abc",
  "updates": {"System.State": "Removed"},
  "dryRun": false  // ← RISKY!
}
```

✅ **Do:** Always dry run first
```json
// GOOD - Preview before execute
{
  "queryHandle": "qh_abc",
  "updates": {"System.State": "Removed"},
  "dryRun": true  // ← SAFE!
}
```

❌ **Don't:** Use expired query handles
```json
// BAD - Query handle expired (>1 hour old)
// Will fail with "Query handle not found or expired"
```

✅ **Do:** Check expiration and re-query if needed
```json
// GOOD - Check expires_at in response
// Re-run query if handle expired
```

---

### Query Handle Best Practices

1. **Always use `returnQueryHandle: true`** when planning bulk operations
2. **Show user the work_items array** before bulk operations (transparency)
3. **Use itemSelector** to target specific subsets (by index, state, criteria)
4. **Always dry run first** on destructive operations (state changes, removals)
5. **Check expiration** - query handles expire after 1 hour (default)
6. **Preview selection** with `wit-select-items-from-query-handle` before bulk ops

---

### AI vs Deterministic Tool Selection

| Task | Tool Type | Why |
|------|-----------|-----|
| Query for items | 🔐 Deterministic | Need exact query handle for safety |
| Preview selection | 🔍 Deterministic | Verify targeting before action |
| Bulk update | 🔐 Deterministic | Safety-critical, zero tolerance for errors |
| Bulk comment | 🔐 Deterministic | Must be exact, reproducible |

**💡 Key Insight:** Bulk operations should NEVER use AI - they must be deterministic and use query handles to eliminate hallucination risk.

---

**Goal:** Build or rebuild work item hierarchy

### Step 1: Get Root Items
```json
// Tool: wit-get-work-items-by-query-wiql
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject' AND ([System.Parent] = '' OR [System.Parent] IS NULL) AND [System.State] NOT IN ('Removed', 'Done')",
  "includeFields": ["System.Title", "System.WorkItemType"],
  "maxResults": 100
}
```

### Step 2: For Each Root, Get Children
```json
// Tool: wit-get-work-items-by-query-wiql (repeat per root)
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 12345",
  "includeFields": ["System.Title", "System.WorkItemType", "System.Parent"],
  "maxResults": 200
}
```

### Step 3: Recursively Build Tree
Repeat Step 2 for each child until complete tree is built.

### Step 4: Validate Complete Hierarchy
```json
// Tool: wit-validate-hierarchy
{
  "workItemIds": [12345, 12346, ...] // all items in tree
}
```

---

## Workflow 6: Quality Improvement

**Goal:** Improve quality of existing work items

### Step 1: Get Recent Items
```json
// Tool: wit-get-work-items-by-query-wiql
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject' AND [System.ChangedDate] >= @Today - 14 AND [System.State] = 'Active'",
  "includeFields": ["System.Title", "System.Description"],
  "maxResults": 100
}
```

### Step 2: Analyze Each Item
```json
// Tool: wit-intelligence-analyzer
{
  "title": "Feature title",
  "description": "Feature description",
  "workItemType": "Feature",
  "analysisType": "full"
}
```

**Gets recommendations for:**
- Better descriptions
- Missing acceptance criteria
- Clearer titles
- Technical considerations

### Step 3: Detect Common Issues
```json
// Tool: wit-detect-patterns
{
  "workItemIds": [12345, 12346, ...],
  "patterns": ["no_description"]
}
```

### Step 4: Notify Team
```json
// Tool: wit-bulk-comment-by-query-handle
{
  "queryHandle": "qh_analyzed_items",
  "comment": "AI analysis suggests improvements. Please review attached recommendations."
}
```

---

## Workflow 7: Metrics Dashboard

**Goal:** Build comprehensive metrics view

### Step 1: Overall Counts
```json
// Tool: wit-query-analytics-odata
{
  "queryType": "groupByState",
  "areaPath": "MyProject\\MyTeam"
}
```

### Step 2: Type Distribution
```json
// Tool: wit-query-analytics-odata
{
  "queryType": "groupByType",
  "filters": {"State": "Active"}
}
```

### Step 3: Team Velocity
```json
// Tool: wit-query-analytics-odata
{
  "queryType": "velocityMetrics",
  "dateRangeField": "CompletedDate",
  "dateRangeStart": "2024-09-01",
  "top": 30
}
```

### Step 4: Cycle Time
```json
// Tool: wit-query-analytics-odata
{
  "queryType": "cycleTimeMetrics",
  "computeCycleTime": true,
  "filters": {"State": "Done"}
}
```

### Step 5: Work Distribution
```json
// Tool: wit-query-analytics-odata
{
  "queryType": "groupByAssignee",
  "filters": {"State": "Active"},
  "orderBy": "Count desc",
  "top": 10
}
```

---

## Workflow 8: AI-First Development

**Goal:** Maximize Copilot utilization

### Step 1: Get Backlog Items
```json
// Tool: wit-get-work-items-by-query-wiql
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task')",
  "includeFields": ["System.Title", "System.Description"],
  "maxResults": 100
}
```

### Step 2: Analyze Each for AI Suitability
```json
// Tool: wit-ai-assignment-analyzer
{
  "workItemId": 12345,
  "outputFormat": "json"
}
```

### Step 3: Create AI-Ready Tasks
```json
// Tool: wit-new-copilot-item
{
  "title": "Well-defined task from analysis",
  "workItemType": "Task",
  "description": "Clear requirements based on AI analysis",
  "repository": "repo-abc-123",
  "parentWorkItemId": 12300
}
```

### Step 4: Monitor Progress
```json
// Tool: wit-get-work-items-by-query-wiql
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = 'GitHub Copilot' AND [System.State] = 'Active'"
}
```

---

---

## Common Pitfalls Across All Workflows

### 1. ID Hallucination in Bulk Operations
**Problem:** LLM recalls work item IDs from memory incorrectly  
**Solution:** Always use query handles for bulk operations  
**Example:**
```json
// ❌ BAD
{"workItemIds": [100, 101, 102], "updates": {...}}

// ✅ GOOD  
{"queryHandle": "qh_abc123", "itemSelector": "all", "updates": {...}}
```

### 2. Skipping Dry Run on Destructive Operations
**Problem:** Accidentally update/remove wrong items  
**Solution:** Always use `dryRun: true` first  
**Example:**
```json
// Step 1: Dry run
{"queryHandle": "qh_abc", "updates": {...}, "dryRun": true}

// Step 2: Review output, then execute
{"queryHandle": "qh_abc", "updates": {...}, "dryRun": false}
```

### 3. Using AI for Deterministic Tasks
**Problem:** Unnecessary variability and cost  
**Solution:** Use AI for complex analysis, deterministic tools for exact operations  
**Example:**
```json
// ❌ BAD - Using AI to fetch work item by ID
{"tool": "ai-analyze", "workItemId": 12345}

// ✅ GOOD - Direct deterministic fetch
{"tool": "wit-get-work-item", "workItemId": 12345}
```

### 4. Not Validating Hierarchies After Creation
**Problem:** Broken parent-child relationships go unnoticed  
**Solution:** Always validate after creating related items  
**Example:**
```json
// After creating parent + children
{"tool": "wit-validate-hierarchy", "workItemIds": [parent, ...children]}
```

### 5. Ignoring Staleness Data
**Problem:** Operating on items without checking last activity  
**Solution:** Use `includeSubstantiveChange: true` in queries  
**Example:**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE ...",
  "includeSubstantiveChange": true,  // ← Get daysInactive
  "returnQueryHandle": true
}
```

### 6. Not Using Item Selection for Targeted Bulk Ops
**Problem:** Operating on all items when only subset needed  
**Solution:** Use itemSelector to target specific items  
**Example:**
```json
// ❌ BAD - Updates all 100 items
{"queryHandle": "qh_abc", "updates": {...}}

// ✅ GOOD - Updates only stale items
{"queryHandle": "qh_abc", "itemSelector": {"daysInactiveMin": 90}, "updates": {...}}
```

### 7. Creating Work Items Without Acceptance Criteria
**Problem:** Unclear requirements lead to rework  
**Solution:** Always include acceptance criteria in work items  
**Example:**
```json
{
  "title": "Implement authentication",
  "description": "...",
  "acceptanceCriteria": "- API returns JWT on valid login\n- Refresh tokens expire after 7 days\n- Unit tests >90% coverage"
}
```

---

## Tips for Combining Tools

### 1. Start with Discovery, End with Action
**Pattern:** Query → Analyze → Validate → Act

```
1. wit-query-wiql (with returnQueryHandle: true)
2. wit-analyze-patterns or wit-ai-assignment-analyzer  
3. wit-validate-hierarchy (if structural changes)
4. wit-bulk-*-by-query-handle (safe bulk action)
```

### 2. Use AI for Complexity, Deterministic for Precision
**AI Tools (🤖):**
- `wit-ai-generate-wiql` - Complex query generation
- `wit-ai-intelligence` - Feature analysis and decomposition
- `wit-ai-assignment-analyzer` - Complexity assessment
- `wit-ai-workload` - Capacity planning

**Deterministic Tools (🔐):**
- `wit-query-wiql` - Execute queries, get query handles
- `wit-validate-hierarchy` - Rule-based validation
- `wit-bulk-*-by-query-handle` - Safe bulk operations
- `wit-analyze-patterns` - Pattern detection

### 3. Always Preview Before Bulk Operations
**Steps:**
```
1. Get query handle: wit-query-wiql with returnQueryHandle: true
2. Preview selection: wit-select-items-from-query-handle with previewCount
3. Dry run: wit-bulk-*-by-query-handle with dryRun: true
4. Review output carefully
5. Execute: Same call with dryRun: false
```

### 4. Leverage Staleness Filtering
**When to use:**
- Backlog cleanup
- Finding abandoned work
- Prioritizing active items

**How:**
```json
{
  "wiqlQuery": "...",
  "includeSubstantiveChange": true,
  "filterByDaysInactiveMin": 90
}
```

### 5. Chain Tools for Complete Workflows
**Example: Feature Implementation Flow**
```
1. wit-ai-intelligence (analyze feature)
   ↓
2. wit-create-item (create parent feature)
   ↓
3. wit-create-item × N (create child tasks)
   ↓
4. wit-validate-hierarchy (verify structure)
   ↓
5. wit-ai-assignment-analyzer (check AI suitability)
   ↓
6. wit-bulk-assign-by-query-handle (assign work)
```

### 6. Use Configuration Wisely
Check and use configuration defaults:
```json
// Tools automatically use config defaults
{
  "organization": "...",  // From config
  "project": "...",       // From config
  "areaPath": "..."      // From config
}
```

---

## Common Patterns

### Pattern 1: Query → Analyze → Act (Most Common)
**Use for:** Data-driven decisions
```
1. wit-query-wiql (with returnQueryHandle)
2. wit-analyze-* or wit-ai-*
3. wit-bulk-*-by-query-handle
```

### Pattern 2: Create → Validate → Assign (New Work)
**Use for:** Adding structured work
```
1. wit-create-item (parent)
2. wit-create-item × N (children)
3. wit-validate-hierarchy
4. wit-ai-assignment-analyzer
5. wit-bulk-assign-by-query-handle
```

### Pattern 3: Detect → Notify → Fix (Issue Resolution)
**Use for:** Problem remediation
```
1. wit-analyze-patterns or wit-analyze-security
2. wit-bulk-comment-by-query-handle (notify)
3. wit-bulk-update-by-query-handle (fix)
```

### Pattern 4: Aggregate → Report → Plan (Metrics & Planning)
**Use for:** Sprint planning, capacity planning
```
1. wit-query-analytics-odata (metrics)
2. wit-query-wiql (candidates)
3. wit-ai-assignment-analyzer (suitability)
4. wit-bulk-assign-by-query-handle (assign)
```

### Pattern 5: Generate → Execute → Refine (AI-Assisted Queries)
**Use for:** Complex query construction
```
1. wit-ai-generate-wiql (natural language → WIQL)
2. wit-query-wiql (execute with returnQueryHandle)
3. Review results
4. Refine query if needed
5. wit-bulk-*-by-query-handle (act on results)
```

---

## AI vs Deterministic Decision Matrix

| Task Type | Use AI (🤖) | Use Deterministic (🔐) |
|-----------|-------------|------------------------|
| Generate complex queries | ✅ Yes | ❌ No |
| Execute queries | ❌ No | ✅ Yes (with query handles) |
| Analyze complexity/suitability | ✅ Yes | ❌ No |
| Detect patterns | ❌ No | ✅ Yes (rule-based) |
| Bulk operations | ❌ Never | ✅ Always (query handles) |
| Create work items | ❌ No | ✅ Yes (exact fields) |
| Validate hierarchies | ❌ No | ✅ Yes (rules) |
| Feature decomposition | ✅ Yes | ❌ No |
| Extract security findings | ❌ No | ✅ Yes (structured) |
| Capacity planning | ✅ Yes | ❌ No |

**Golden Rule:** If it needs to be exact and reproducible, use deterministic tools. If it needs intelligence and nuance, use AI.

---

## Workflow Selection Guide

**Choose Workflow 1 (Feature Decomposition)** when:
- Starting new feature development
- Need to break down large work items
- Want AI suggestions for tasks

**Choose Workflow 2 (Backlog Cleanup)** when:
- Backlog has grown unwieldy
- Many stale/inactive items
- Need to identify problematic patterns

**Choose Workflow 3 (Sprint Planning)** when:
- Planning upcoming sprint
- Need to assess team velocity
- Want to optimize AI vs human assignment

**Choose Workflow 4 (Security Analysis)** when:
- Security scan results imported
- Need to categorize and prioritize vulnerabilities
- Want to assign remediation work

**Choose Workflow 5 (Bulk Operations)** when:
- Need to update many items safely
- Risk of ID hallucination with traditional approaches
- Require audit trail and dry run capability

---

## Quick Reference: Essential Tool Combinations

### For Backlog Management
```
wit-ai-generate-wiql → wit-query-wiql → wit-analyze-patterns → wit-bulk-comment-by-query-handle
```

### For Sprint Planning  
```
wit-query-analytics-odata → wit-query-wiql → wit-ai-assignment-analyzer → wit-bulk-assign-by-query-handle
```

### For Feature Development
```
wit-ai-intelligence → wit-create-item → wit-validate-hierarchy → wit-bulk-assign-by-query-handle
```

### For Security Remediation
```
wit-query-wiql → wit-analyze-security → wit-ai-assignment-analyzer → wit-bulk-assign-by-query-handle
```

### For Safe Bulk Updates
```
wit-query-wiql (returnQueryHandle) → wit-select-items-from-query-handle → wit-bulk-update-by-query-handle (dryRun: true) → wit-bulk-update-by-query-handle (dryRun: false)
```

---

**Remember:** The query handle pattern is your safety net for bulk operations. Always use it to prevent ID hallucination and ensure exactly the right items are affected.
