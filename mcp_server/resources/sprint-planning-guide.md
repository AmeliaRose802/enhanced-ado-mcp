# Sprint Planning Guide - Detailed Examples & Troubleshooting

This guide provides detailed tool examples and troubleshooting for the sprint planning prompt.

## Detailed Tool Examples

### Phase 1: Team Discovery

#### Example 1: Query Current Active Work
```json
Tool: query-wiql
{
  "description": "Get all active work items (Committed, Active, In Progress, In Review states) in current area path",
  "returnQueryHandle": true
}
```

**Returns**: Validated WIQL query like:
```sql
SELECT [System.Id] FROM WorkItems 
WHERE [System.AreaPath] UNDER 'Project\Team' 
AND [System.State] IN ('Committed', 'Active', 'In Progress', 'In Review')
```

#### Example 2: Execute Query Efficiently
```json
Tool: query-wiql
{
  "wiqlQuery": "[query from step 1]",
  "returnQueryHandle": true,
  "handleOnly": true
}
```

**Returns**: Query handle like `qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3` (no work item data fetched = token savings!)

#### Example 3: Extract Team Members & Current Workload
```json
Tool: analyze-bulk
{
  "queryHandle": "qh_c1b1b9a3...",
  "analysisType": ["effort", "workload", "assignments"]
}
```

**Returns**:
```json
{
  "effort": {
    "total_story_points": 65,
    "estimated_items": 42,
    "unestimated_items": 3
  },
  "assignments": {
    "total_items": 45,
    "unique_assignees": 5,
    "assignment_distribution": {
      "alice.johnson@company.com": 12,
      "bob.smith@company.com": 10,
      "charlie.davis@company.com": 8,
      "diana.lee@company.com": 7,
      "ethan.martinez@company.com": 8
    }
  }
}
```

**Key Insight**: You now have the team roster automatically! No need to ask user.

#### Example 4: Analyze Each Team Member's Skills
```json
Tool: analyze-workload
{
  "assignedToEmail": "alice.johnson@company.com",
  "analysisPeriodDays": 90
}
```

**Returns**:
```json
{
  "workSummary": {
    "completed": {
      "totalItems": 50,
      "workTypes": {
        "Bug": { "count": 28, "percentage": 56 },
        "Product Backlog Item": { "count": 18, "percentage": 36 },
        "Task": { "count": 4, "percentage": 8 }
      },
      "velocityPerWeek": 5.2
    }
  },
  "detailedAnalysis": {
    "workVariety": {
      "workTypeDistribution": { /* same as above */ },
      "specializationRisk": "Low"
    }
  }
}
```

**Interpretation**:
- **Primary Skill**: Bug fixing (56% of work history)
- **Secondary Skill**: Feature development (36%)
- **Velocity**: 5.2 items/week suggests experienced contributor
- **Assignment Strategy**: Assign bugs first, features second, avoid tasks unless needed

Repeat for all 5 team members to build complete skill profiles!

### Phase 2: Sprint Candidate Analysis

#### Example 5: Query Sprint-Ready Backlog
```json
Tool: query-wiql
{
  "description": "Get all Product Backlog Items and Bugs in Approved state, ordered by priority descending, stack rank ascending",
  "returnQueryHandle": true
}
```

**Returns**: WIQL query for sprint candidates (items ready to be committed).

#### Example 6: Execute Backlog Query
```json
Tool: query-wiql
{
  "wiqlQuery": "[query from step 5]",
  "returnQueryHandle": true,
  "handleOnly": true
}
```

**Returns**: Query handle for backlog items.

#### Example 7: Analyze Backlog Effort
```json
Tool: analyze-bulk
{
  "queryHandle": "qh_def456...",
  "analysisType": ["effort", "aging"]
}
```

**Returns**:
```json
{
  "effort": {
    "total_story_points": 87,
    "estimated_items": 15,
    "unestimated_items": 8,
    "estimation_coverage": 65
  },
  "aging": {
    "age_distribution": {
      "0-3_days": 12,
      "4-7_days": 8,
      "8-14_days": 3,
      "15_plus_days": 0
    }
  }
}
```

**Problem Identified**: 35% of backlog lacks story point estimates!

#### Example 8: Fill Estimate Gaps with AI
```json
Tool: execute-bulk-operations
{
  "queryHandle": "qh_def456...",
  "actions": [{
    "type": "assign-story-points",
    "estimationScale": "fibonacci",
    "overwriteExisting": false
  }],
  "dryRun": true
}
```

**Returns**:
```json
{
  "summary": {
    "total_items": 8,
    "successful": 8,
    "failed": 0
  },
  "results": [
    {
      "workItemId": 12345,
      "storyPoints": 5,
      "confidence": 0.92,
      "reasoning": "Medium complexity OAuth integration with existing patterns"
    },
    {
      "workItemId": 12346,
      "storyPoints": 3,
      "confidence": 0.78,
      "reasoning": "UI changes following established design system"
    }
  ]
}
```

**Now**: 100% estimation coverage (15 manual + 8 AI = 23 items). Ready for accurate sprint planning!

#### Example 9: Identify AI-Assignable Work
```json
Tool: analyze-workload
{
  "assignedToEmail": "alice.johnson@company.com",
  "includeAiAssignment": true,
  "analysisPeriodDays": 90
}
```

**Returns**:
```json
{
  "aiAssignmentOpportunities": [
    {
      "workItemId": 12350,
      "title": "Fix null reference exception in login flow",
      "aiSuitabilityScore": 0.91,
      "confidence": "High",
      "recommendedAgentType": "bug-analyzer",
      "reasoning": "Well-defined bug with clear repro steps"
    }
  ]
}
```

**Action**: Assign item #12350 to `bug-analyzer` agent for Alice (velocity boost without overload).

#### Example 10: List Available Agents
```json
Tool: list-subagents
{}
```

**Returns**:
```json
{
  "agents": [
    {
      "name": "bug-analyzer",
      "capabilities": ["Root cause analysis", "Fix generation", "Test case creation"],
      "specializations": ["C#", "JavaScript", "SQL"]
    },
    {
      "name": "feature-implementer",
      "capabilities": ["Feature implementation", "API design", "Documentation"],
      "specializations": ["React", "Node.js", "REST APIs"]
    }
  ]
}
```

**Matching Logic**: 
- Bug #12350 → `bug-analyzer` (matches "bug" + "C#" specialization)
- Feature #12355 → `feature-implementer` (matches "feature" + "React" specialization)

### Phase 3: Create Balanced Plan

#### Capacity Calculation Example

**User Input**:
- Base capacity: 40h/week per person
- On-call: Bob Smith
- PTO: Alice Johnson (2 days)
- Managers: Diana Lee (Engineering Manager)

**Calculations**:

| Team Member | Base | Adjustment | Available |
|-------------|------|------------|-----------|
| Alice Johnson | 40h | -8h (2 days PTO) | 32h |
| Bob Smith | 40h | ×0.5 (on-call) | 20h |
| Charlie Davis | 40h | None | 40h |
| Diana Lee | 40h | Manager (0%) | 0h |
| Ethan Martinez | 40h | None | 40h |
| **TOTAL** | **200h** | - | **132h** |

**Current Work** (from Phase 1 Example 3):
- Alice: 12 items × 4h avg = 48h (32h available → OVERLOADED! 🚨)
- Bob: 10 items × 4h avg = 40h (20h available → OVERLOADED! 🚨)
- Charlie: 8 items × 4h avg = 32h (40h available → 8h free)
- Diana: 7 items assigned (ERROR: Manager should have 0) 
- Ethan: 8 items × 4h avg = 32h (40h available → 8h free)

**Issues to Address**:
1. Alice & Bob are over-capacity (need to redistribute their work)
2. Diana (manager) shouldn't be assigned work items
3. Only Charlie and Ethan have capacity for new sprint work (16h total)

**Sprint Planning Recommendation**:
- Move some of Alice's current work to Charlie/Ethan
- Move some of Bob's current work to Charlie/Ethan
- Reassign Diana's 7 items to other team members
- Only then assign new sprint work to team

### Phase 4: Output Example

```markdown
# Sprint Plan: Sprint 23 (Nov 11 - Nov 22, 2025)

## Sprint Goal
Improve authentication stability and implement OAuth 2.0 foundation for enterprise SSO.

## Sprint Summary
- **Total Items**: 18 (15 human + 3 AI-assigned)
- **Team Capacity**: 132h (adjusted: on-call Bob, PTO Alice 2d, manager Diana)
- **Utilization**: 82%
- **AI Velocity Boost**: +3 items (17% increase)

## Team Assignments

### Alice Johnson - 28h / 32h (88%) 🏖️ PTO: 2 days

#### Committed Work
1. **[#12345](https://dev.azure.com/...)** - OAuth 2.0 Integration `Feature` • P1 • 13h
   - *Why*: Bug fixing specialist (56%) with authentication domain knowledge

2. **[#12347](https://dev.azure.com/...)** - Fix session timeout bug `Bug` • P2 • 8h
   - *Why*: Aligns with bug specialization and current auth work

#### AI-Assigned Work 🤖
1. **[#12350](https://dev.azure.com/...)** - Fix null ref in login `Bug` • 5h • **Agent: `bug-analyzer`**
   - *AI Suitability*: 0.91 (High confidence)
   - *Why this agent*: Well-defined bug with clear repro steps, C# specialization match

### Bob Smith - 18h / 20h (90%) 🚨 ON-CALL

#### Committed Work
1. **[#12348](https://dev.azure.com/...)** - Update password policy UI `Task` • P2 • 8h
   - *Why*: Lighter load due to on-call (feature dev experience 40%)

#### AI-Assigned Work 🤖
1. **[#12351](https://dev.azure.com/...)** - Add password strength meter `Feature` • 8h • **Agent: `feature-implementer`**
   - *AI Suitability*: 0.85 (High confidence)
   - *Why this agent*: UI component with clear requirements, React specialization match

[... continue for Charlie, Ethan (Diana excluded as manager) ...]

## Stretch Goals

If capacity allows:
- **[#12360](https://dev.azure.com/...)** - Add biometric auth support (Charlie) - Low priority, can defer to next sprint

## Risks & Concerns

- ⚠️ **Critical**: Alice & Bob currently over-capacity (need to redistribute existing work before sprint start)
- ⚠️ **Medium**: OAuth integration (#12345) has external dependency on Identity team (need to confirm availability)
- ⚠️ **Low**: Bob's on-call assignment may limit progress if incidents spike

## Recommendations

- ✅ **Before sprint start**: Redistribute 3-4 items from Alice/Bob to Charlie/Ethan to clear capacity
- ✅ **Sprint Day 1**: Confirm Identity team availability for OAuth pairing session
- ✅ **Assign AI work early**: Get agents started on items #12350, #12351, #12355 on Monday
```

## Troubleshooting

### Issue: "Query handle expired"
**Cause**: Handles expire after 24 hours.  
**Solution**: Re-run the WIQL query to get a fresh handle.

### Issue: "Team has no capacity"
**Cause**: Current work exceeds available hours.  
**Solution**: 
1. Analyze current work with `analyze-bulk`
2. Identify items that can be deferred or reassigned
3. Use `execute-bulk-operations` to update state/assignment
4. Re-run capacity calculation

### Issue: "Too many unestimated items"
**Cause**: Backlog lacks story point coverage.  
**Solution**: Use `execute-bulk-operations` with `action: "assign-story-points"` and `dryRun: true` for AI estimates.

### Issue: "Don't know who is on-call or on PTO"
**Cause**: ADO doesn't store this in work item fields.  
**Solution**: Ask user directly. This information lives in team calendars/scheduling tools.

### Issue: "Manager has work items assigned"
**Cause**: Historical assignments before promotion or misconfiguration.  
**Solution**: Flag in "Risks & Concerns" section, recommend reassignment before sprint.

### Issue: "Can't find suitable AI work"
**Cause**: Team member's work history doesn't match available AI-suitable items.  
**Solution**: 
1. Check if `analyze-workload` with `includeAiAssignment: true` returns empty array
2. Consider cross-training opportunity (assign AI work outside normal specialization)
3. Document in "Recommendations" section

### Issue: "Backlog items lack descriptions"
**Cause**: Items were created quickly without full details.  
**Solution**: 
```json
Tool: execute-bulk-operations
{
  "queryHandle": "qh_abc...",
  "actions": [{
    "type": "enhance-descriptions",
    "enhancementStyle": "detailed",
    "returnFormat": "summary"
  }],
  "dryRun": true
}
```
Preview AI-generated descriptions, then execute if quality is good.

## Advanced Scenarios

### Multi-Team Sprint Planning

When planning for multiple teams in the same project:

1. Create separate query handles per team (by area path)
2. Run analysis in parallel for all teams
3. Identify cross-team dependencies with hierarchy analysis
4. Output separate sprint plans per team with dependency callouts

### Historical Velocity Analysis

To understand team's typical velocity:

```json
Tool: query-odata
{
  "customQuery": "$apply=filter(contains(Area/AreaPath, 'MyTeam') and CompletedDate ge 2024-08-01Z and CompletedDate le 2024-11-01Z)/groupby((CompletedDate), aggregate(StoryPoints with sum as TotalPoints))"
}
```

Returns completed story points per week over last 3 months. Use for realistic capacity planning.

### Dependency Chain Analysis

For complex features with dependencies:

```json
Tool: analyze-bulk
{
  "queryHandle": "qh_features...",
  "analysisType": ["hierarchy"],
  "validateTypes": true,
  "validateStates": true
}
```

Returns parent-child relationships, blocked items, circular dependencies. Helps sequence sprint work correctly.

## Best Practices Summary

1. **Always auto-discover team**: Use `analyze-bulk` → `assignment_distribution` before asking user
2. **Use skills data**: Match work to `workTypeDistribution` from `analyze-workload`
3. **Apply capacity adjustments**: On-call (50%), PTO (0% for those days), Managers (0%)
4. **Validate before planning**: Check current work first, identify overload situations
5. **Target 80-85% utilization**: Leave buffer for unplanned work
6. **Include AI work**: 1+ item per person using real agents from `list-subagents`
7. **Use query handles everywhere**: Prevents ID hallucination, enables efficient analysis
8. **Keep rationales brief**: 1-2 sentences max per assignment
9. **Flag risks early**: Call out over-capacity, dependencies, skill gaps immediately
10. **Provide implementation tools**: Include exact tool calls for user to execute plan
