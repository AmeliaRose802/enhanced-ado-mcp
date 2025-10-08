# AI Intelligence & Planning Tools

**Feature Category:** AI-Powered Intelligence  
**Status:** ✅ Implemented  
**Version:** 1.5.0  
**Last Updated:** 2025-10-07
**Requires:** VS Code Language Model API

## Overview

The Enhanced ADO MCP Server provides sophisticated AI-powered intelligence and planning tools:

1. **wit-ai-intelligence** - Comprehensive work item quality analysis
2. **wit-ai-assignment** - AI suitability assessment for work items
3. **wit-ai-workload** - Burnout and workload analysis
4. **wit-ai-sprint-planning** - AI-assisted sprint planning
5. **wit-ai-discover-tools** - Natural language tool discovery

These tools leverage AI to provide insights, recommendations, and intelligent automation for work item management.

## Purpose

Enable intelligent work item management with:
- Quality and completeness analysis
- AI assignment suitability scoring
- Personal workload and burnout risk assessment
- Optimized sprint planning with capacity balancing
- Natural language tool discovery

## Tools

### 1. wit-ai-intelligence

AI-powered work item analysis for completeness, AI-readiness, and enhancement suggestions.

#### Input Parameters

**Required:**
- `title` (string) - Work item title to analyze

**Optional:**
- `description` (string) - Work item description/content
- `workItemType` (string) - Type (Task, Bug, PBI, etc.)
- `acceptanceCriteria` (string) - Current acceptance criteria
- `analysisType` (string) - Type of analysis:
  - `"completeness"` - Check if item is complete
  - `"ai-readiness"` - Check if ready for AI assignment
  - `"enhancement"` - Suggest improvements
  - `"categorization"` - Smart categorization
  - `"full"` - All analysis types (default)
- `contextInfo` (string) - Additional project/team context
- `enhanceDescription` (boolean) - Generate enhanced description
- `createInADO` (boolean) - Auto-create enhanced item in ADO
- `parentWorkItemId` (number) - Parent ID if creating in ADO
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project

#### Output Format

**Success Response (Full Analysis):**
```json
{
  "success": true,
  "data": {
    "analysis_type": "full",
    "completeness": {
      "score": 0.75,
      "level": "good",
      "missing_elements": ["acceptance_criteria"],
      "recommendations": [
        "Add testable acceptance criteria",
        "Specify technical constraints"
      ]
    },
    "ai_readiness": {
      "suitable_for_ai": true,
      "confidence": 0.88,
      "reasons": [
        "Well-defined scope",
        "Clear requirements",
        "Standard implementation pattern"
      ],
      "concerns": [
        "May require domain knowledge"
      ]
    },
    "enhancements": {
      "title_suggestions": [
        "Implement OAuth 2.0 user authentication with token refresh"
      ],
      "description_improvements": [
        "Add technical approach section",
        "Specify security requirements",
        "Define error handling strategy"
      ],
      "missing_fields": [
        "priority",
        "story_points"
      ]
    },
    "categorization": {
      "suggested_type": "Product Backlog Item",
      "suggested_tags": ["Security", "Backend", "API"],
      "complexity": "medium",
      "estimated_effort": "5-8 story points"
    }
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example 1: Completeness Check**
```json
{
  "title": "Implement user authentication",
  "description": "Add login functionality",
  "analysisType": "completeness"
}
```

**Example 2: AI Readiness Assessment**
```json
{
  "title": "Implement OAuth 2.0 authentication",
  "description": "Integrate with Azure AD using OAuth 2.0 flow",
  "workItemType": "Task",
  "analysisType": "ai-readiness"
}
```

**Example 3: Full Analysis with Enhancement**
```json
{
  "title": "Add user login",
  "description": "Users need to login",
  "workItemType": "Product Backlog Item",
  "analysisType": "full",
  "enhanceDescription": true,
  "contextInfo": "Banking application with strict security requirements"
}
```

### 2. wit-ai-assignment

Enhanced AI assignment suitability analysis with detailed reasoning.

#### Input Parameters

**Required:**
- `workItemId` (number) - Azure DevOps work item ID

**Optional:**
- `outputFormat` (string) - Output format:
  - `"detailed"` - Comprehensive analysis (default)
  - `"json"` - Structured JSON for programmatic use

#### Output Format

**Success Response (Detailed):**
```json
{
  "success": true,
  "data": {
    "work_item_id": 12345,
    "title": "Implement user authentication",
    "decision": "AI_FIT",
    "confidence": 0.92,
    "ai_suitability_analysis": {
      "suitable_for_ai": true,
      "confidence_score": 0.92,
      "reasons_for_suitability": [
        "Well-defined scope: OAuth 2.0 implementation with clear requirements",
        "Standard pattern: Common authentication pattern with extensive documentation",
        "Technical completeness: Includes acceptance criteria and technical constraints",
        "Low ambiguity: Requirements are specific and measurable"
      ],
      "concerns": [
        "Security sensitivity requires review of AI-generated code",
        "Integration testing needed with existing auth system"
      ],
      "complexity_assessment": {
        "technical_complexity": "medium",
        "business_complexity": "low",
        "uncertainty_level": "low"
      },
      "recommended_review_points": [
        "Security best practices for token storage",
        "Error handling for authentication failures",
        "Integration with existing session management"
      ]
    },
    "work_item_context": {
      "type": "Product Backlog Item",
      "state": "New",
      "description_length": 450,
      "has_acceptance_criteria": true,
      "has_parent": true,
      "estimated_effort": 8
    }
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: Analyze Work Item for AI Assignment**
```json
{
  "workItemId": 12345,
  "outputFormat": "detailed"
}
```

### 3. wit-ai-workload

AI-powered personal workload analysis for burnout risk assessment.

#### Input Parameters

**Required:**
- `assignedToEmail` (string) - Email address of person to analyze

**Optional:**
- `analysisPeriodDays` (number) - Days to analyze (default 90, min 7, max 365)
- `additionalIntent` (string) - Custom analysis intent (e.g., "assess readiness for promotion", "check career growth")
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project
- `areaPath` (string) - Area path to filter work items

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "assigned_to": "developer@company.com",
    "analysis_period": {
      "days": 90,
      "start_date": "2023-10-20",
      "end_date": "2024-01-20"
    },
    "workload_metrics": {
      "total_items_completed": 45,
      "total_items_active": 12,
      "completion_rate": 0.78,
      "average_items_per_week": 5.2,
      "story_points_completed": 156,
      "average_points_per_week": 18.1
    },
    "burnout_risk_assessment": {
      "risk_level": "medium",
      "risk_score": 0.58,
      "factors": {
        "workload_intensity": "high",
        "work_variety": "low",
        "overspecialization_risk": "medium",
        "sustained_pace": "concerning"
      },
      "indicators": [
        "Working on 12 concurrent active items (high)",
        "Limited work type diversity (85% bugs, 15% features)",
        "Consistent high velocity for 90 days without breaks"
      ]
    },
    "recommendations": [
      "Consider redistributing some active items to balance load",
      "Introduce more variety in work types to prevent overspecialization",
      "Schedule time for innovation or learning activities",
      "Monitor for signs of diminished productivity or quality"
    ],
    "career_insights": {
      "strengths": [
        "Consistently high velocity",
        "Strong focus on bug fixes and quality"
      ],
      "growth_opportunities": [
        "Increase exposure to feature development",
        "Lead technical design discussions",
        "Mentor team members on debugging techniques"
      ]
    }
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example 1: Basic Workload Analysis**
```json
{
  "assignedToEmail": "developer@company.com",
  "analysisPeriodDays": 90
}
```

**Example 2: Promotion Readiness Assessment**
```json
{
  "assignedToEmail": "developer@company.com",
  "analysisPeriodDays": 180,
  "additionalIntent": "assess readiness for senior developer promotion"
}
```

### 4. wit-ai-sprint-planning

AI-powered sprint planning with capacity balancing and skill matching.

#### Input Parameters

**Required:**
- `iterationPath` (string) - Target iteration/sprint path
- `teamMembers` (array) - Team members with capacity:
  ```typescript
  {
    email: string,
    name: string,
    capacityHours?: number,  // default 60
    skills?: string[],
    preferredWorkTypes?: string[]
  }
  ```

**Optional:**
- `sprintCapacityHours` (number) - Total team capacity (overrides individual)
- `historicalSprintsToAnalyze` (number) - Previous sprints for velocity (default 3, max 10)
- `candidateWorkItemIds` (array of numbers) - Items to consider for sprint
- `considerDependencies` (boolean) - Consider work item dependencies (default true)
- `considerSkills` (boolean) - Match items to member skills (default true)
- `additionalConstraints` (string) - Additional planning constraints
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project
- `areaPath` (string) - Area path to filter work items

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "sprint": {
      "iteration_path": "Project\\Sprint 10",
      "team_capacity_hours": 240,
      "target_velocity": 45
    },
    "historical_velocity": {
      "sprints_analyzed": 3,
      "average_velocity": 42,
      "velocity_trend": "stable",
      "completion_rate": 0.87
    },
    "proposed_assignments": [
      {
        "work_item_id": 12345,
        "title": "Implement OAuth authentication",
        "assigned_to": "developer1@company.com",
        "estimated_hours": 16,
        "story_points": 8,
        "confidence": 0.91,
        "rationale": "Developer has OAuth experience, available capacity, matches required skills"
      },
      {
        "work_item_id": 12346,
        "title": "Design login UI",
        "assigned_to": "designer@company.com",
        "estimated_hours": 12,
        "story_points": 5,
        "confidence": 0.88,
        "rationale": "Designer specialization, good capacity fit"
      }
    ],
    "capacity_analysis": {
      "total_assigned_hours": 220,
      "remaining_capacity": 20,
      "utilization_rate": 0.92,
      "balance_score": 0.85,
      "member_utilization": [
        {
          "name": "Developer 1",
          "capacity": 60,
          "assigned": 56,
          "utilization": 0.93
        }
      ]
    },
    "risk_assessment": {
      "dependencies_count": 2,
      "blocking_items": 0,
      "skill_gaps": [],
      "capacity_concerns": [
        "Team near full capacity - limited buffer for unplanned work"
      ]
    },
    "recommendations": [
      "Consider adding 5-10% buffer for unplanned work",
      "Prioritize dependency resolution early in sprint",
      "Balance frontend/backend work distribution"
    ]
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: Plan Sprint with Team**
```json
{
  "iterationPath": "Project\\Sprint 10",
  "teamMembers": [
    {
      "email": "dev1@company.com",
      "name": "Developer 1",
      "capacityHours": 60,
      "skills": ["C#", "Azure", "OAuth"]
    },
    {
      "email": "dev2@company.com",
      "name": "Developer 2",
      "capacityHours": 60,
      "skills": ["React", "TypeScript", "UI"]
    }
  ],
  "historicalSprintsToAnalyze": 3,
  "considerSkills": true,
  "additionalConstraints": "Prioritize security work items"
}
```

### 5. wit-ai-discover-tools

AI-powered tool discovery from natural language intent.

#### Input Parameters

**Required:**
- `intent` (string) - Natural language description of what to accomplish

**Optional:**
- `context` (string) - Additional project/team context
- `maxRecommendations` (number) - Max tools to recommend (1-10, default 3)
- `includeExamples` (boolean) - Include usage examples (default false, saves ~100-300 tokens per tool)
- `filterCategory` (string) - Filter by category:
  - `"creation"` - Create/new items
  - `"analysis"` - Analyze/detect/validate
  - `"bulk-operations"` - Bulk updates
  - `"query"` - WIQL/OData
  - `"ai-powered"` - AI tools
  - `"all"` - No filter (default)

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "intent": "I want to find all stale bugs and update their priority",
    "recommendations": [
      {
        "tool_name": "wit-query-wiql",
        "confidence": 0.95,
        "rationale": "Best for finding stale bugs using WIQL query with staleness filtering",
        "usage_summary": "Query for bugs, filter by daysInactive, get query handle",
        "example": {
          "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] = 'Active'",
          "includeSubstantiveChange": true,
          "filterByDaysInactiveMin": 180
        }
      },
      {
        "tool_name": "wit-bulk-update",
        "confidence": 0.93,
        "rationale": "Use query handle from first tool to safely update priority",
        "usage_summary": "Update priority field using JSON Patch operations",
        "example": {
          "queryHandle": "qh_...",
          "updates": [
            {
              "op": "replace",
              "path": "/fields/System.Priority",
              "value": 3
            }
          ]
        }
      }
    ],
    "workflow_suggestion": "1. Query for stale bugs → 2. Inspect query handle → 3. Update priorities in bulk",
    "related_tools": [
      "wit-query-handle-inspect",
      "wit-analyze-patterns"
    ]
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: Discover Tools for Task**
```json
{
  "intent": "I need to find all work items assigned to me that haven't been updated in 30 days and add a comment to them",
  "maxRecommendations": 3,
  "includeExamples": true
}
```

## AI Model Selection

All intelligence tools use free models by default (GPT-4o mini, GPT-4.1). See [Model Selection](./MODEL_SELECTION.md).

## Configuration

Requires VS Code Language Model API access. Uses defaults from `.ado-mcp-config.json`.

## Error Handling

### Common Errors

| Error Message | Cause | Resolution |
|--------------|-------|------------|
| "Sampling not available" | VS Code LLM API not accessible | Ensure VS Code with Copilot |
| "Work item not found" | Invalid ID | Verify work item exists |
| "Insufficient data" | Work item lacks context | Add more detail to work item |
| "Analysis failed" | AI generation error | Retry or check model availability |

## Performance Considerations

- **intelligence-analyzer**: 3-8 seconds (depends on analysis type)
- **ai-assignment-analyzer**: 2-4 seconds
- **personal-workload-analyzer**: 5-10 seconds (fetches historical data)
- **sprint-planning-analyzer**: 10-20 seconds (complex analysis)
- **discover-tools**: 2-3 seconds

## Implementation Details

### Key Components

- **Handlers:** `src/services/handlers/ai-powered/*.handler.ts`
- **Schema:** `src/config/schemas.ts`
- **Service:** `src/services/sampling-service.ts`
- **Analyzers:** `src/services/analyzers/*.ts`
- **Prompts:** `mcp_server/prompts/system/*.md`

## Testing

### Test Files

- `test/unit/ai-powered/*.test.ts`
- `test/integration/ai-intelligence-tools.test.ts`

### Manual Testing

Requires VS Code with GitHub Copilot extension.

```bash
{
  "tool": "wit-ai-intelligence",
  "arguments": {
    "title": "Implement user authentication",
    "description": "Add OAuth 2.0 login",
    "analysisType": "full"
  }
}
```

## Related Features

- [AI-Powered Features](./AI_POWERED_FEATURES.md) - Overview
- [Model Selection](./MODEL_SELECTION.md) - AI model configuration
- [Bulk AI Enhancement](./BULK_AI_ENHANCEMENT.md) - Bulk AI operations

## References

- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
- [MCP Sampling](https://modelcontextprotocol.io/docs/concepts/sampling)
- [Sprint Planning Best Practices](https://www.scrum.org/resources/blog/sprint-planning)

---

**Last Updated:** 2025-10-07  
**Author:** Enhanced ADO MCP Team
