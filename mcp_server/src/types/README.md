# Type Definitions

This directory contains all TypeScript type definitions for the Enhanced ADO MCP Server, organized by domain for maintainability and ease of use.

## Directory Structure

```
types/
├── index.ts              # Barrel export - import all types from here
├── ado.ts                # Azure DevOps REST API types
├── work-items.ts         # Work item operations and context types
├── analysis.ts           # AI-powered analysis types
├── queries.ts            # WIQL and OData query types
├── mcp.ts                # MCP protocol types
├── error-categories.ts   # Error handling types
└── README.md            # This file
```

## Type Organization by Domain

### 1. Core MCP Protocol Types (`mcp.ts`)
Types related to the Model Context Protocol server implementation:
- `Tool` - MCP tool definitions
- `Prompt` - MCP prompt definitions
- `ToolExecutionResult` - Standardized tool execution response
- `ToolExecutionData` - JSON-serializable tool data
- `ToolExecutionMetadata` - Tool execution metadata
- `JSONSchema` - JSON Schema definitions for input validation

### 2. Azure DevOps API Types (`ado.ts`)
Types matching Azure DevOps REST API responses:
- `ADOWorkItem` - Full work item structure from ADO API
- `ADOWorkItemFields` - System and custom field definitions
- `ADOIdentity` - User/group identity reference
- `ADORelation` - Work item relation/link
- `ADOWiqlResult` - WIQL query result structure
- `ADOWorkItemsBatch` - Batch work item response
- `ADORepository` - Git repository information
- `ADOComment` - Work item comment
- `ADOWorkItemRevision` - Historical work item revision
- `ADOErrorResponse` - API error response

### 3. Work Item Types and Operations (`work-items.ts`)
Enhanced work item types with computed context and analysis:
- `WorkItem` - Re-export of `ADOWorkItem` for convenience
- `WorkItemContext` - Lightweight context data for query handles
- `WorkItemContextPackage` - Comprehensive work item with relations and history
- `WorkItemWithContext` - Work item with computed metrics
- `ComputedMetrics` - Calculated fields (staleness, completeness, etc.)
- `SubstantiveChangeResult` - True activity analysis
- `QueryHandleData` - Cached query results
- `BulkOperationResult` - Standardized bulk operation response
- `WorkItemAnalysis` - Comprehensive AI-powered analysis results
- Type guards: `isWorkItem()`, `isWorkItemContext()`, `isWorkItemArray()`

**Analysis Sub-types:**
- `EffortAnalysis` - Story points and complexity
- `VelocityAnalysis` - Team throughput metrics
- `AssignmentAnalysis` - Work distribution and capacity
- `RiskAnalysis` - Blockers and issues
- `CompletionAnalysis` - Progress and forecasting
- `PriorityAnalysis` - Priority distribution
- `WorkloadAnalysis` - Current active work
- `AISuitabilityAnalysis` - AI assignment evaluation
- `PatternDetectionResult` - Common work item issues
- `SimpleHierarchyValidationResult` - Basic parent-child checks (deprecated)

### 4. AI-Powered Analysis Types (`analysis.ts`)
Types for AI-powered analysis features (formerly in `sampling-types.ts`):

**Work Item Intelligence:**
- `WorkItemIntelligenceArgs` - Input for work item analysis
- `AnalysisResult` - Completeness and AI readiness analysis
- `RawAIAnalysisData` / `RawAnalysisData` - Unstructured AI responses

**AI Assignment Analysis:**
- `AIAssignmentAnalyzerArgs` - Input for AI assignment evaluation
- `AIAssignmentResult` - AI suitability decision and recommendations

**Feature Decomposition:**
- `FeatureDecomposerArgs` - Input for feature breakdown
- `DecomposedWorkItem` - Individual decomposed item
- `FeatureDecompositionResult` - Complete decomposition with strategy

**Hierarchy Validation:**
- `HierarchyValidatorArgs` - Input for hierarchy analysis
- `WorkItemHierarchyInfo` - Work item hierarchy metadata
- `ParentingSuggestion` - Suggested parent-child relationships
- `HierarchyValidationIssue` - Detected hierarchy problems
- `HierarchyValidationResult` - Complete validation analysis

**Personal Workload Analysis:**
- `PersonalWorkloadAnalyzerArgs` - Input for individual workload analysis
- `PersonalWorkloadAnalysisResult` - Comprehensive workload health report

**Sprint Planning:**
- `SprintPlanningAnalyzerArgs` - Input for sprint planning
- `TeamMemberAssignment` - Individual team member assignments
- `SprintPlanningResult` - Complete sprint plan with recommendations

### 5. Query and Analytics Types (`queries.ts`)
Types for WIQL queries and OData analytics:
- `ODataAnalyticsArgs` - OData query parameters
- `ODataResponse` / `ODataResponseValue` - OData result structure
- `GenerateWiqlQueryArgs` - WIQL query generation input
- `GenerateODataQueryArgs` - OData query generation input
- `MCPServerInstance` - Server instance for sampling operations

### 6. Error Handling Types (`error-categories.ts`)
Types for error categorization and handling:
- `ErrorCategory` - Categorized error types
- Error-specific types for different failure scenarios

## Usage

### ✅ Recommended: Use Barrel Exports

Import all types from the barrel export for consistency:

```typescript
import type { 
  ADOWorkItem, 
  WorkItemContext, 
  AnalysisResult,
  ODataAnalyticsArgs 
} from '../types/index.js';
```

### ❌ Avoid: Direct Sub-module Imports

Don't import directly from sub-modules (unless within the `types/` directory itself):

```typescript
// ❌ Avoid this
import type { ADOWorkItem } from '../types/ado.js';
import type { WorkItemContext } from '../types/work-items.js';

// ✅ Use this instead
import type { ADOWorkItem, WorkItemContext } from '../types/index.js';
```

### Exception: Internal Type Module Imports

Within the `types/` directory, modules can import from each other:

```typescript
// In work-items.ts - this is fine
import type { ADOWorkItem, ADOWorkItemFields } from './ado.js';
```

## Type Consolidation

### Removed Duplicates

The following types were previously duplicated between `src/services/sampling-types.ts` and `src/types/analysis.ts`. They are now defined only in `analysis.ts`:

- `WorkItemIntelligenceArgs`
- `AnalysisResult`
- `RawAnalysisData` / `RawAIAnalysisData`
- `AIAssignmentAnalyzerArgs`
- `AIAssignmentResult`
- `FeatureDecomposerArgs`
- `DecomposedWorkItem`
- `FeatureDecompositionResult`
- `HierarchyValidatorArgs`
- `WorkItemHierarchyInfo`
- `ParentingSuggestion`
- `HierarchyValidationIssue`
- `HierarchyValidationResult`
- `PersonalWorkloadAnalyzerArgs`
- `PersonalWorkloadAnalysisResult`
- `SprintPlanningAnalyzerArgs`
- `TeamMemberAssignment`
- `SprintPlanningResult`

The file `src/services/sampling-types.ts` now re-exports these types from `analysis.ts` for backward compatibility.

## Migration Guide

If you need to update code that used the old import paths:

### For AI Analysis Types

**Before:**
```typescript
import type { WorkItemIntelligenceArgs } from '../services/sampling-types.js';
import type { AIAssignmentResult } from '../types/analysis.js';
```

**After:**
```typescript
import type { WorkItemIntelligenceArgs, AIAssignmentResult } from '../types/index.js';
```

### For ADO Types

**Before:**
```typescript
import type { ADOWorkItem, ADOWiqlResult } from '../types/ado.js';
```

**After:**
```typescript
import type { ADOWorkItem, ADOWiqlResult } from '../types/index.js';
```

### For Work Item Types

**Before:**
```typescript
import type { WorkItemContext, BulkOperationResult } from '../types/work-items.js';
```

**After:**
```typescript
import type { WorkItemContext, BulkOperationResult } from '../types/index.js';
```

## Type Hierarchy Diagram

```
types/index.ts (Barrel Export)
    ├── mcp.ts (Core MCP Protocol)
    │   ├── Tool
    │   ├── ToolExecutionResult
    │   └── JSONSchema
    │
    ├── ado.ts (Azure DevOps API)
    │   ├── ADOWorkItem
    │   ├── ADOWorkItemFields
    │   ├── ADOIdentity
    │   ├── ADORelation
    │   └── ADOWiqlResult
    │
    ├── work-items.ts (Work Item Operations)
    │   ├── WorkItem (re-exports ADOWorkItem)
    │   ├── WorkItemContext
    │   ├── WorkItemContextPackage
    │   ├── QueryHandleData
    │   └── WorkItemAnalysis
    │
    ├── analysis.ts (AI-Powered Analysis)
    │   ├── WorkItemIntelligenceArgs
    │   ├── AIAssignmentResult
    │   ├── FeatureDecompositionResult
    │   ├── HierarchyValidationResult
    │   ├── PersonalWorkloadAnalysisResult
    │   └── SprintPlanningResult
    │
    ├── queries.ts (Query Types)
    │   ├── ODataAnalyticsArgs
    │   ├── GenerateWiqlQueryArgs
    │   └── ODataResponse
    │
    └── error-categories.ts (Error Handling)
        └── ErrorCategory
```

## Best Practices

1. **Always use type imports**: Use `import type` for type-only imports to ensure they're stripped during compilation
2. **Use barrel exports**: Import from `types/index.js` for consistency
3. **Avoid circular dependencies**: Keep type modules focused and independent
4. **Document complex types**: Add JSDoc comments for non-obvious type definitions
5. **Use type guards**: Leverage provided type guards (`isWorkItem`, etc.) for runtime validation

---

**Last Updated:** 2025-01-08  
**Maintained by:** Enhanced ADO MCP Team
