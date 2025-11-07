# List Team Members Tool

**Feature Category:** Discovery & Configuration  
**Status:** ✅ Implemented  
**Version:** 1.11.0  
**Last Updated:** 2025-11-07

## Overview

The **List Team Members** tool discovers team members in an Azure DevOps project by analyzing work item assignments. It provides a practical way to find all users with active work assignments, which can then be used for team-wide queries and bulk operations.

## Purpose

Enable AI agents and users to:
- Discover team composition based on actual work assignments
- Get comma-separated email lists for WIQL `IN` queries
- Query work items for entire teams without manually listing each member
- Analyze team workload distribution

## Tool

### wit-list-team-members

Discover team members by analyzing work item assignments using OData Analytics.

#### Input Parameters

**Optional:**
- `managerEmail` (string) - Filter intent (Note: ADO doesn't support manager filtering, but can be used to exclude manager from results)
- `includeManager` (boolean) - Include the manager in results when managerEmail is provided (default: false)
- `outputFormat` (string) - Output format: "detailed" (full user info) or "emails" (comma-separated list for WIQL)
- `organization` (string) - Azure DevOps organization (uses config default)

#### Output Format

**Detailed Format (default):**
```json
{
  "success": true,
  "data": {
    "teamMembers": [
      {
        "displayName": "John Doe",
        "email": "john.doe@company.com",
        "uniqueName": "john.doe@company.com",
        "workItemCount": 15
      },
      {
        "displayName": "Jane Smith", 
        "email": "jane.smith@company.com",
        "uniqueName": "jane.smith@company.com",
        "workItemCount": 12
      }
    ],
    "count": 2,
    "discoveryMethod": "Analyzed work item assignments in project to discover active team members",
    "note": "Azure DevOps Graph API does not expose manager/direct report relationships. This tool discovers team members by finding users with assigned work items."
  }
}
```

**Emails Format:**
```json
{
  "success": true,
  "data": {
    "emailList": "'john.doe@company.com', 'jane.smith@company.com'",
    "count": 2,
    "usage": "Use in WIQL: WHERE [System.AssignedTo] IN ('john.doe@company.com', 'jane.smith@company.com')",
    "note": "Team members discovered by analyzing current work item assignments in the project."
  }
}
```

## Examples

### Example 1: Get Team Members (Detailed)

**Input:**
```json
{}
```

**Output:**
```json
{
  "success": true,
  "data": {
    "teamMembers": [
      {
        "displayName": "Alice Johnson",
        "email": "alice@company.com",
        "uniqueName": "alice@company.com",
        "workItemCount": 23
      },
      {
        "displayName": "Bob Wilson",
        "email": "bob@company.com", 
        "uniqueName": "bob@company.com",
        "workItemCount": 18
      }
    ],
    "count": 2
  }
}
```

### Example 2: Get Email List for WIQL Query

**Input:**
```json
{
  "outputFormat": "emails"
}
```

**Output:**
```json
{
  "success": true,
  "data": {
    "emailList": "'alice@company.com', 'bob@company.com'",
    "count": 2,
    "usage": "Use in WIQL: WHERE [System.AssignedTo] IN ('alice@company.com', 'bob@company.com')"
  }
}
```

**Follow-up WIQL Query:**
```json
{
  "wiqlQuery": "SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.AssignedTo] IN ('alice@company.com', 'bob@company.com') AND [System.State] = 'Active'",
  "returnQueryHandle": true
}
```

### Example 3: Exclude Manager from Results

**Input:**
```json
{
  "managerEmail": "manager@company.com",
  "includeManager": false,
  "outputFormat": "emails"
}
```

**Output:**
Returns all team members except the manager (filtered by email match).

## Use Cases

### 1. Team-Wide Work Item Queries

Discover team members and query all their assigned work:

```typescript
// Step 1: Get team emails
const teamResult = await callTool('wit-list-team-members', {
  outputFormat: 'emails'
});

// Step 2: Query work items for entire team
const workItems = await callTool('wit-wiql-query', {
  wiqlQuery: `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] IN (${teamResult.data.emailList})`,
  returnQueryHandle: true
});

// Step 3: Bulk operations on team's work
await callTool('wit-unified-bulk-operations-by-query-handle', {
  queryHandle: workItems.data.queryHandle,
  actions: [{ action: 'add-tag', tag: 'TeamReview' }]
});
```

### 2. Team Workload Analysis

Analyze team capacity and distribution:

```typescript
// Get team members with work counts
const team = await callTool('wit-list-team-members', {});

// Analyze each member's workload
for (const member of team.data.teamMembers) {
  await callTool('wit-personal-workload-analyzer', {
    assignedToEmail: member.email,
    analysisPeriodDays: 30
  });
}
```

### 3. Sprint Planning for Teams

Plan sprints for entire teams:

```typescript
// Get team members
const team = await callTool('wit-list-team-members', {
  outputFormat: 'detailed'
});

// Use for sprint planning
await callTool('wit-sprint-planning-analyzer', {
  iterationPath: 'Project\\Sprint 5',
  teamMembers: team.data.teamMembers.map(m => ({
    email: m.email,
    displayName: m.displayName
  }))
});
```

## Discovery Method

The tool uses **OData Analytics** to discover team members:

1. Queries work items grouped by assignee
2. Filters out unassigned items
3. Counts work items per user
4. Returns ordered by work item count (most active first)

**OData Query:**
```
$apply=filter(StateCategory ne 'Completed')/groupby((AssignedTo/UserName, AssignedTo/UserEmail), aggregate($count as Count))&$orderby=Count desc
```

This discovers **active team members** based on current work assignments rather than attempting to access organizational hierarchy.

## Limitations

1. **No Manager/Direct Report Relationships**: Azure DevOps Graph API does not expose organizational hierarchy
2. **Project-Scoped**: Discovers users within the configured project only
3. **Active Work Required**: Only finds users with assigned work items
4. **Manager Filtering**: The `managerEmail` parameter can only exclude the manager from results, not discover direct reports

## Workarounds

If you need true manager/direct report relationships:

1. **Microsoft Graph API**: Use with appropriate Azure AD permissions
2. **Manual Team Lists**: Maintain team member lists in configuration
3. **Area Path Filtering**: Use WIQL with area path filters to scope to team areas
4. **OData Analytics**: Query work items by area path to discover team composition

## Error Handling

### No Team Members Found

**Error:**
```json
{
  "success": false,
  "errors": ["No team members found. Ensure the project has work items with assigned users."]
}
```

**Resolution:** Ensure work items exist with assigned users in the project.

## Implementation Details

### Key Components

- **Handler:** `src/services/handlers/discovery/list-team-members.handler.ts`
- **Schema:** `src/config/schemas.ts` (listTeamMembersSchema)
- **Service:** `src/services/ado-identity-service.ts` (fallback search)

### Integration Points

- **OData Analytics API** - Work item assignment discovery
- **Identity Service** - Fallback user search
- **Configuration System** - Auto-fills organization/project

## Testing

### Manual Test

```bash
# Test with default output
node dist/index.js <<EOF
{
  "method": "tools/call",
  "params": {
    "name": "wit-list-team-members",
    "arguments": {}
  }
}
EOF

# Test with email output
node dist/index.js <<EOF
{
  "method": "tools/call",
  "params": {
    "name": "wit-list-team-members",
    "arguments": {
      "outputFormat": "emails"
    }
  }
}
EOF
```

## Related Features

- [Query Tools](./QUERY_TOOLS.md) - Use team email lists in WIQL queries
- [Bulk Operations](./BULK_OPERATIONS.md) - Perform operations on team's work
- [Personal Workload Analyzer](./AI_INTELLIGENCE_TOOLS.md) - Analyze individual team member workload
- [Sprint Planning Analyzer](./AI_INTELLIGENCE_TOOLS.md) - Team-wide sprint planning

## Future Enhancements

1. **Azure AD Integration**: Optional Microsoft Graph API integration for true org hierarchy
2. **Team Scope**: Support Azure DevOps Teams as a discovery scope
3. **Area Path Filtering**: Discover users by area path assignments
4. **Iteration Filtering**: Find team members active in specific sprints
5. **Custom Filters**: Filter by work item type, state, or date range

## References

- [Azure DevOps OData Analytics API](https://learn.microsoft.com/en-us/azure/devops/report/extend-analytics/quick-ref)
- [Azure DevOps Graph API](https://learn.microsoft.com/en-us/rest/api/azure/devops/graph)
- [Microsoft Graph API for Organizational Data](https://learn.microsoft.com/en-us/graph/api/user-list-directreports)