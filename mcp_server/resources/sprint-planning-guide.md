# Sprint Planning Analyzer - Quick Reference Guide

## Overview

The **Sprint Planning Analyzer** (`wit-sprint-planning-analyzer`) is an AI-powered tool that helps create optimal sprint plans by analyzing team capacity, historical velocity, and proposing balanced work assignments across all team members.

## When to Use This Tool

- **Sprint Planning Meetings** - Generate a data-driven sprint plan before the meeting
- **Capacity Planning** - Understand team capacity and historical velocity
- **Work Balancing** - Ensure fair distribution of work across team members
- **Risk Assessment** - Identify over-allocations, dependencies, and bottlenecks
- **Velocity Tracking** - Analyze historical team performance trends

## How It Works

The tool performs comprehensive analysis in 5 phases:

1. **Historical Velocity Analysis** - Calculates per-person and team velocity from recent sprints
2. **Capacity Assessment** - Determines available capacity accounting for active work and buffers
3. **Backlog Analysis** - Evaluates and estimates top backlog items
4. **Optimal Assignment** - Proposes balanced work assignments using AI
5. **Risk Assessment** - Identifies risks, dependencies, and provides mitigation strategies

## Required Information

### Minimum Required
- **Iteration Path** - Target sprint (e.g., "Project\\Sprint 10")
- **Team Members** - List of team members with:
  - Email address
  - Display name
  - (Optional) Capacity hours, skills, preferred work types

### Optional Parameters
- **Sprint Capacity Hours** - Total team capacity (overrides individual capacities)
- **Historical Sprints to Analyze** - Number of previous sprints to analyze (default: 3, max: 10)
- **Candidate Work Item IDs** - Specific items to consider (otherwise queries backlog)
- **Consider Dependencies** - Factor in work item dependencies (default: true)
- **Consider Skills** - Match work to team member skills (default: true)
- **Additional Constraints** - Custom planning constraints (e.g., "prioritize bugs")

## Example Usage

### Basic Sprint Planning
```json
{
  "iterationPath": "MyProject\\Sprint 10",
  "teamMembers": [
    {
      "email": "alice@company.com",
      "name": "Alice Johnson",
      "capacityHours": 60,
      "skills": ["frontend", "react", "typescript"]
    },
    {
      "email": "bob@company.com",
      "name": "Bob Martinez",
      "capacityHours": 50,
      "skills": ["backend", "api", "database"]
    },
    {
      "email": "carol@company.com",
      "name": "Carol Chen",
      "capacityHours": 40,
      "skills": ["frontend", "design", "ux"]
    }
  ]
}
```

### Sprint Planning with Specific Work Items
```json
{
  "iterationPath": "MyProject\\Sprint 10",
  "teamMembers": [
    { "email": "alice@company.com", "name": "Alice" },
    { "email": "bob@company.com", "name": "Bob" }
  ],
  "candidateWorkItemIds": [12345, 12346, 12347, 12348, 12349],
  "historicalSprintsToAnalyze": 3
}
```

### Sprint Planning with Constraints
```json
{
  "iterationPath": "MyProject\\Sprint 10",
  "teamMembers": [
    { "email": "alice@company.com", "name": "Alice", "capacityHours": 60 },
    { "email": "bob@company.com", "name": "Bob", "capacityHours": 60 }
  ],
  "sprintCapacityHours": 120,
  "additionalConstraints": "Prioritize security fixes and balance frontend/backend work equally",
  "considerDependencies": true,
  "considerSkills": true
}
```

## Output Structure

The tool returns a comprehensive sprint plan including:

### Sprint Summary
- Iteration path, team size, capacity
- Overall health score (0-100)
- Confidence level (High/Medium/Low)

### Velocity Analysis
- **Historical Velocity**: Average points per sprint, trend, consistency
- **Predicted Velocity**: Estimated points for this sprint with confidence range
- **Last Sprint Performance**: Detailed breakdown of recent sprints

### Team Assignments
For each team member:
- Allocated capacity hours
- Assigned work items with rationale
- Total story points and estimated hours
- Capacity utilization percentage
- Workload balance status (Under/Optimal/Over)
- Skill match rating (Poor/Good/Excellent)

### Unassigned Items
- Work items that don't fit in the sprint
- Reason for not assigning (capacity, complexity, etc.)
- Recommendations for handling

### Risk Assessment
- **Critical Risks**: High-impact issues requiring immediate attention
- **Warnings**: Moderate concerns to monitor
- **Recommendations**: Actionable suggestions for improvement

### Balance Metrics
- Workload balance score and assessment
- Skill coverage score and assessment
- Dependency risk score and assessment
- Overall balance score and assessment

### Alternative Plans (Optional)
- Different assignment strategies
- Tradeoffs and key differences

### Actionable Steps
- Specific next steps to finalize the sprint plan

## Best Practices

### 1. Run Analysis Before Planning Meeting
- Generate the sprint plan 1-2 days before the planning meeting
- Give team time to review and provide feedback
- Come to the meeting with data-driven proposals

### 2. Provide Accurate Team Information
- Include actual available hours (account for PTO, meetings, etc.)
- Add skills to improve work matching
- Update team member info regularly

### 3. Review Historical Data
- Look at velocity trends over 3-6 sprints
- Identify outliers (vacation weeks, incidents)
- Adjust capacity expectations accordingly

### 4. Consider Current Workload
- The tool automatically accounts for active work
- Review carryover items carefully
- Don't overcommit if there's significant carryover

### 5. Use the Analysis as a Starting Point
- Treat the output as a proposal, not a mandate
- Discuss with the team and adjust
- Allow for team member preferences and autonomy

### 6. Monitor During Sprint
- Track progress against plan
- Adjust assignments if needed
- Use learnings for next sprint

## Integration with Other Tools

### Before Sprint Planning
1. **Query Backlog**: Use `wit-get-work-items-by-query-wiql` to identify candidate items
2. **Estimate Items**: Use `wit-bulk-assign-story-points-by-query-handle` to ensure all items have estimates
3. **Analyze Velocity**: Use `wit-query-analytics-odata` to get historical completion data

### After Sprint Planning
1. **Assign Work**: Use `wit-bulk-assign-by-query-handle` to assign items to team members
2. **Update Iterations**: Move items to the sprint iteration
3. **Track Progress**: Use `wit-personal-workload-analyzer` to monitor individual workload

### During Sprint
1. **Monitor Progress**: Use `wit-get-work-items-context-batch` to check sprint items
2. **Adjust Assignments**: Use `wit-bulk-update-by-query-handle` to rebalance if needed

## Common Use Cases

### Use Case 1: Standard Sprint Planning
**Goal**: Create a balanced sprint plan for a 2-week sprint

**Steps**:
1. Identify team members and their capacity
2. Run sprint planning analyzer
3. Review proposed assignments
4. Discuss with team and adjust
5. Assign work items in Azure DevOps

### Use Case 2: Emergency Sprint Rebalancing
**Goal**: Rebalance work mid-sprint due to team member unavailability

**Steps**:
1. Update team member list (remove unavailable person)
2. Run sprint planning analyzer with current sprint items
3. Review rebalancing proposals
4. Reassign work items

### Use Case 3: Velocity Trend Analysis
**Goal**: Understand team velocity trends over time

**Steps**:
1. Run sprint planning analyzer
2. Focus on velocity analysis section
3. Compare predicted vs. actual velocity
4. Identify improvement opportunities

### Use Case 4: Skill Gap Identification
**Goal**: Identify skills needed for backlog items

**Steps**:
1. Include team member skills in input
2. Run sprint planning analyzer
3. Review skill match ratings
4. Identify items requiring skills not on team

## Troubleshooting

### "No Capacity Available"
- Team is over-allocated with active work
- Consider moving some active items to next sprint
- Reduce sprint commitment
- Add team members if possible

### "Low Confidence Level"
- Not enough historical data (< 2 sprints)
- High variance in past velocity
- Team composition changed recently
- Solution: Use conservative estimates, monitor closely

### "Poor Skill Match"
- Work items require skills not on team
- Consider training or bringing in specialists
- Break down items into smaller pieces
- Pair programming opportunities

### "Dependencies Blocking Work"
- Some items depend on incomplete work
- Sequence work appropriately
- Consider splitting into multiple sprints
- Identify critical path

## Related Tools

- `wit-personal-workload-analyzer` - Analyze individual team member workload
- `wit-get-work-items-by-query-wiql` - Query backlog items
- `wit-bulk-assign-story-points-by-query-handle` - Estimate work items
- `wit-query-analytics-odata` - Historical velocity data
- `wit-bulk-assign-by-query-handle` - Batch assign work items
- `wit-get-work-items-context-batch` - Get detailed work item context

## Tips for Success

1. **Run Regularly**: Use for every sprint planning session
2. **Track Accuracy**: Compare planned vs. actual to improve estimates
3. **Involve the Team**: Discuss proposals collaboratively
4. **Adjust Over Time**: Refine capacity and velocity estimates based on results
5. **Consider Context**: Factor in holidays, team changes, and special circumstances
6. **Balance Short and Long Term**: Include mix of features, bugs, and tech debt
7. **Allow Buffer**: Don't commit to 100% capacity - leave room for unknowns
8. **Monitor Health**: Watch for burnout indicators and rebalance proactively

## Example Workflows

### Workflow 1: New Team Sprint Planning
```
1. Gather team member info (emails, capacity, skills)
2. Run sprint planning analyzer with historicalSprintsToAnalyze: 3
3. Review velocity analysis (may be low confidence initially)
4. Use conservative estimates for first few sprints
5. Refine based on actual performance
```

### Workflow 2: Established Team Sprint Planning
```
1. Run sprint planning analyzer with default settings
2. Review velocity trends and capacity
3. Check for over/under-allocations
4. Review proposed assignments with team
5. Make adjustments based on feedback
6. Finalize and assign work items
```

### Workflow 3: Sprint Planning with Focus Areas
```
1. Identify sprint focus (e.g., "security", "performance")
2. Query backlog for focus area items
3. Run sprint planning analyzer with additionalConstraints
4. Ensure focus items are prioritized in assignments
5. Balance focus work with regular sprint work
```

## Performance Considerations

- **Analysis Time**: Typically 30-90 seconds depending on team size and backlog
- **Timeout**: 3 minutes maximum
- **Team Size**: Optimized for 3-10 team members
- **Backlog Items**: Best with 20-100 candidate items
- **Historical Data**: Analyzes last 3 sprints by default (configurable 1-10)

## Security and Privacy

- Only accesses work items within configured area path
- Requires Azure DevOps authentication
- Does not store historical data
- All analysis is performed in real-time
- Results are ephemeral (not persisted)

## Support and Feedback

For issues or questions:
1. Check this guide for common solutions
2. Review the sprint planning prompt for detailed algorithm
3. Use `wit-discover-tools` to find related tools
4. Contact your MCP server administrator
