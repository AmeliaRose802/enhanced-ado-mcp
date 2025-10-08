# AI-Powered Work Item Analysis Features

**Feature Category:** AI-Powered Analysis  
**Status:** ✅ Implemented  
**Version:** 1.5  
**Last Updated:** 2025-10-07

> **Note:** This document provides an overview of AI-powered features. For detailed specifications:
> - **Individual tool specs:** [AI Intelligence Tools](./AI_INTELLIGENCE_TOOLS.md), [Bulk AI Enhancement](./BULK_AI_ENHANCEMENT.md)
> - **Model configuration:** [Model Selection](./MODEL_SELECTION.md)
> - **Query generation:** [Query Tools](./QUERY_TOOLS.md)

## Overview

This specification describes the AI-powered work item analysis features that leverage VS Code's language model sampling capability to provide intelligent analysis, recommendations, and automation for Azure DevOps work items.

## Features

### 1. Work Item Intelligence Analyzer (`wit-ai-intelligence`)

**Purpose:** Comprehensive AI-powered analysis of work item quality and completeness

#### Capabilities

- **Completeness Analysis**: Evaluate if work item has sufficient information
- **AI-Readiness Analysis**: Determine if suitable for AI automation
- **Enhancement Suggestions**: Provide specific recommendations
- **Smart Categorization**: Automatically categorize work items
- **Full Analysis**: Combined analysis with all insights

#### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `Title` | string | ✅ | Work item title to analyze |
| `Description` | string | ❌ | Work item description/content |
| `WorkItemType` | string | ❌ | Type (Task, Bug, PBI, etc.) |
| `AcceptanceCriteria` | string | ❌ | Current acceptance criteria |
| `AnalysisType` | enum | ❌ | `completeness`, `ai-readiness`, `enhancement`, `categorization`, `full` |
| `ContextInfo` | string | ❌ | Additional project/team context |
| `EnhanceDescription` | boolean | ❌ | Generate enhanced description |
| `CreateInADO` | boolean | ❌ | Auto-create enhanced work item |
| `ParentWorkItemId` | number | ❌ | Parent ID if creating in ADO |

#### Output Structure

```typescript
{
  success: boolean;
  data: {
    analysis: {
      completeness: {
        score: number;           // 0-100
        missing_elements: string[];
        recommendations: string[];
      };
      ai_readiness: {
        suitable: boolean;
        confidence: number;      // 0-100
        reasoning: string;
        blocking_factors: string[];
      };
      enhancements: {
        suggested_title: string;
        suggested_description: string;
        suggested_acceptance_criteria: string[];
        additional_fields: Record<string, any>;
      };
      categorization: {
        primary_category: string;
        secondary_categories: string[];
        tags: string[];
        estimated_effort: string;
      };
    };
    metadata: {
      analysis_type: string;
      llm_model: string;
      confidence: number;
    };
  };
}
```

#### Use Cases

1. **Quality Gate**: Validate work items before assignment
2. **Automated Enhancement**: Improve work item descriptions
3. **Triage Automation**: Categorize and route work items
4. **AI Assignment Screening**: Pre-screen for AI suitability

#### System Prompt

Located in: `mcp_server/prompts/system/full-analyzer.md`

Key sections:
- Completeness evaluation criteria
- AI-readiness scoring rubric
- Enhancement guidelines
- Categorization taxonomy

---

### 2. AI Assignment Analyzer (`wit-ai-assignment`)

**Purpose:** Detailed analysis of work item suitability for AI agent assignment

#### Capabilities

- **Suitability Scoring**: 0-100 confidence score
- **Detailed Reasoning**: Explain why suitable/unsuitable
- **Risk Assessment**: Identify potential issues
- **Recommendation**: Clear yes/no with conditions
- **Alternative Suggestions**: What needs to change

#### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `Title` | string | ✅ | Work item title |
| `Description` | string | ❌ | Work item description |
| `WorkItemType` | string | ❌ | Type of work item |
| `AcceptanceCriteria` | string | ❌ | Acceptance criteria |
| `Priority` | string | ❌ | Priority level |
| `Labels` | string | ❌ | Comma-separated labels |
| `EstimatedFiles` | string | ❌ | Estimated files affected |
| `TechnicalContext` | string | ❌ | Tech stack, frameworks |
| `ExternalDependencies` | string | ❌ | Dependencies/approvals |
| `TimeConstraints` | string | ❌ | Deadlines |
| `RiskFactors` | string | ❌ | Known risks |
| `TestingRequirements` | string | ❌ | Testing needs |

#### Output Structure

```typescript
{
  success: boolean;
  data: {
    suitable_for_ai: boolean;
    confidence_score: number;     // 0-100
    recommendation: "assign" | "do-not-assign" | "assign-with-conditions";
    reasoning: {
      strengths: string[];
      weaknesses: string[];
      risk_factors: string[];
      mitigation_strategies: string[];
    };
    analysis: {
      scope_clarity: number;      // 0-100
      technical_complexity: number;
      required_context: number;
      independence: number;
      testability: number;
    };
    suggestions: {
      before_assignment: string[];
      monitoring_points: string[];
      fallback_plan: string;
    };
  };
}
```

#### Suitability Criteria

**Good Candidates (High Score):**
- Clear, well-defined scope
- Minimal external dependencies
- Good acceptance criteria
- Adequate test coverage
- Low risk/non-critical

**Poor Candidates (Low Score):**
- Vague requirements
- High business risk
- Complex cross-team dependencies
- Security-sensitive
- Requires human judgment

#### System Prompt

Located in: `mcp_server/prompts/system/ai-assignment-analyzer.md`

Scoring rubric:
- Scope Clarity: 25%
- Technical Complexity: 20%
- Independence: 20%
- Testability: 20%
- Risk Level: 15%

---

### 3. Feature Decomposer (`wit-feature-decomposer`)

**Purpose:** Intelligently break down large features into smaller, actionable work items

#### Capabilities

- **Smart Decomposition**: Break features into logical tasks
- **Dependency Analysis**: Identify task dependencies
- **AI Suitability**: Score each decomposed item
- **Acceptance Criteria**: Generate criteria per item
- **Auto-Creation**: Optionally create in ADO
- **Auto-Assignment**: Assign AI-suitable items to Copilot

#### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `Title` | string | ✅ | Feature title |
| `Description` | string | ❌ | Feature description |
| `ParentWorkItemId` | number | ❌ | Parent work item ID |
| `WorkItemType` | string | ❌ | Type for created items |
| `TargetComplexity` | enum | ❌ | `simple`, `medium` |
| `MaxItems` | number | ❌ | Max work items to generate |
| `TechnicalContext` | string | ❌ | Tech stack/architecture |
| `BusinessContext` | string | ❌ | User needs/goals |
| `ExistingComponents` | string | ❌ | Existing systems |
| `Dependencies` | string | ❌ | Known dependencies |
| `GenerateAcceptanceCriteria` | boolean | ❌ | Generate AC for each |
| `AnalyzeAISuitability` | boolean | ❌ | Score AI suitability |
| `AutoCreateWorkItems` | boolean | ❌ | Create in ADO |
| `AutoAssignAISuitable` | boolean | ❌ | Auto-assign to AI |

#### Output Structure

```typescript
{
  success: boolean;
  data: {
    decomposition: {
      work_items: [
        {
          title: string;
          description: string;
          work_item_type: string;
          acceptance_criteria: string[];
          estimated_effort: string;
          dependencies: number[];    // Indices of dependent items
          ai_suitability: {
            suitable: boolean;
            score: number;
            reasoning: string;
          };
          technical_notes: string;
          ado_work_item_id?: number;  // If created
          assigned_to?: string;        // If auto-assigned
        }
      ];
      execution_order: number[];     // Suggested execution order
      parallel_groups: number[][];   // Items that can be done in parallel
    };
    summary: {
      total_items: number;
      ai_suitable_count: number;
      estimated_total_effort: string;
      risk_level: string;
    };
  };
}
```

#### Decomposition Strategy

1. **Identify Logical Phases**: Setup, Core, Testing, etc.
2. **Extract Vertical Slices**: End-to-end features
3. **Separate Infrastructure**: Config, deployment
4. **Isolate Dependencies**: External integrations
5. **Add Quality Tasks**: Testing, documentation

#### System Prompt

Located in: `mcp_server/prompts/system/feature-decomposer.md`

Decomposition principles:
- Each item should be completable in 1-3 days
- Minimize inter-task dependencies
- Prefer vertical slices over layers
- Include testing in each item
- Make acceptance criteria verifiable

---

## Technical Implementation

### Architecture

```
Client Request
    ↓
Tool Handler (validation)
    ↓
Sampling Service
    ↓
Prompt Service (load template)
    ↓
VS Code LLM Sampling API
    ↓
Parse LLM Response
    ↓
Format Result
    ↓
Return to Client
```

### Dependencies

- **VS Code**: Required for sampling
- **GitHub Copilot**: Must be active
- **Language Model Access**: User must grant permission

### Error Handling

All AI features gracefully degrade when sampling unavailable:

```typescript
if (!serverInstance) {
  return {
    success: false,
    errors: ["Sampling not available. Requires VS Code with GitHub Copilot."],
    data: null
  };
}
```

## Usage Examples

### Example 1: Analyze Work Item Quality

```typescript
await executeTool('wit-ai-intelligence', {
  Title: "Implement user authentication",
  Description: "Add login functionality",
  AnalysisType: "full"
});
```

### Example 2: Check AI Assignment Suitability

```typescript
await executeTool('wit-ai-assignment', {
  Title: "Fix login button styling",
  Description: "Button is misaligned on mobile",
  WorkItemType: "Bug",
  TechnicalContext: "React, CSS"
});
```

### Example 3: Decompose Large Feature

```typescript
await executeTool('wit-feature-decomposer', {
  Title: "Multi-factor authentication",
  Description: "Implement MFA with SMS and authenticator app support",
  ParentWorkItemId: 12345,
  GenerateAcceptanceCriteria: true,
  AnalyzeAISuitability: true,
  AutoCreateWorkItems: true
});
```

## Performance Considerations

- **Sampling Latency**: 2-10 seconds per LLM call
- **Token Limits**: Prompts stay under 4K tokens
- **Rate Limiting**: Respect VS Code LLM rate limits
- **Caching**: Prompt templates cached

## Future Enhancements

1. **Batch Analysis**: Analyze multiple items in parallel
2. **Historical Learning**: Learn from past assignments
3. **Custom Rubrics**: User-defined scoring criteria
4. **Integration Testing**: Verify suggestions work
5. **Feedback Loop**: Learn from outcomes

## Testing

### Unit Tests
- Prompt loading and rendering
- Response parsing
- Error handling

### Integration Tests
- Full sampling flow (requires VS Code)
- Real work item analysis
- Multi-tool workflows

### Test Files
- `ai-assignment-analyzer.test.ts`
- `feature-decomposer-integration.test.ts`
- `hierarchy-validator-integration.test.ts`
- `sampling-feature.test.ts`

---

**Related Specifications:**
- [WIQL Implementation](./WIQL_IMPLEMENTATION.md)
- [REST API Migration](./REST_API_MIGRATION.md)
- [Prompt System](./PROMPT_SYSTEM.md)
