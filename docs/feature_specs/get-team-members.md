# Get Team Members Tool

## Overview

The `get-team-members` tool discovers team members by analyzing work item assignments through Azure DevOps Analytics. It returns a clean array of email addresses, automatically filtering out GitHub Copilot accounts and null values.

**Tool Name:** `get-team-members`  
**Category:** Discovery & Configuration  
**Purpose:** Discover team composition for batch analysis, sprint planning, and workload distribution

## Use Cases

- **Team Health Analysis**: Get team roster before running batch workload analysis
- **Sprint Planning**: Discover active contributors for capacity planning
- **Workload Distribution**: Identify team members for assignment analysis
- **Onboarding Analysis**: Find team members who have been active in recent sprints

## Input Parameters

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `areaPath` | string | Config default | Area path to filter team members |
| `dateRangeStart` | string | 90 days ago | Start date for activity filter (ISO format YYYY-MM-DD) |
| `dateRangeEnd` | string | Today | End date for activity filter (ISO format YYYY-MM-DD) |
| `activeOnly` | boolean | `true` | Only include members with assigned work items in date range |
| `organization` | string | Config default | Azure DevOps organization name |
| `project` | string | Config default | Azure DevOps project name |

### Parameter Details

**Date Range Filtering:**
- Filters based on `ChangedDate` field (last time work item was updated)
- Default: Last 90 days of activity
- Use ISO date format: `YYYY-MM-DD` (e.g., `2024-01-15`)

**Active Only:**
- When `true` (default): Only returns team members with work items that were active during the date range
- When `false`: Returns all team members who have ever been assigned work in the area path
- Recommended: Keep as `true` to get current team composition

**Area Path:**
- Uses configured default area path if not provided
- Filters team members to those working in the specified area
- Uses OData `startswith()` filtering (includes sub-areas)

## Output Format

### Success Response

```json
{
  "success": true,
  "data": {
    "teamMembers": [
      "alice.johnson@company.com",
      "bob.smith@company.com",
      "charlie.davis@company.com"
    ],
    "count": 3,
    "dateRange": {
      "start": "2024-08-13",
      "end": "2024-11-11"
    },
    "areaPath": "MyProject\\MyTeam",
    "activeOnly": true
  },
  "metadata": {
    "source": "odata-analytics",
    "organization": "myorg",
    "project": "myproject",
    "totalResults": 5,
    "filteredCount": 3
  },
  "errors": [],
  "warnings": []
}
```

### Key Fields

- **`teamMembers`**: Array of email addresses (string[])
- **`count`**: Number of unique team members found
- **`dateRange`**: Date range used for filtering
- **`areaPath`**: Area path filter applied (or "all" if none)
- **`activeOnly`**: Whether active-only filter was applied

### Metadata

- **`totalResults`**: Total assignees found before filtering
- **`filteredCount`**: Number after filtering out GitHub Copilot and duplicates
- **`source`**: Always "odata-analytics"
- **`organization`**: Organization used for the query
- **`project`**: Project used for the query

## Filtering Behavior

### Automatic Filters

The tool automatically filters out:

1. **GitHub Copilot Accounts**:
   - Any email containing: `github-copilot`, `copilot@github.com`, `copilot-`, `@copilot`
   - Case-insensitive matching
   - Logged for debugging purposes

2. **Null/Undefined Values**:
   - Empty email fields
   - Null assignee values

3. **Duplicates**:
   - Only unique email addresses returned
   - First occurrence preserved

### Filter Examples

**Filtered Out:**
- `github-copilot[bot]@users.noreply.github.com`
- `GitHub-Copilot-Agent@microsoft.com`
- `copilot-test@example.com`
- `null`
- `undefined`

**Kept:**
- `alice.johnson@company.com`
- `bob.smith@company.com`
- All valid user email addresses

## Examples

### Example 1: Get Current Team Members (Default)

**Request:**
```json
{
  "tool": "get-team-members"
}
```

**Behavior:**
- Uses configured area path
- Last 90 days of activity
- Active members only
- Auto-filters GitHub Copilot

**Use Case:** Quick team roster for batch workload analysis

---

### Example 2: Get Team Members for Specific Area

**Request:**
```json
{
  "tool": "get-team-members",
  "areaPath": "MyProject\\Backend\\API"
}
```

**Use Case:** Get team composition for a specific sub-area

---

### Example 3: Get Team Members Active in Last 30 Days

**Request:**
```json
{
  "tool": "get-team-members",
  "dateRangeStart": "2024-10-12",
  "dateRangeEnd": "2024-11-11",
  "activeOnly": true
}
```

**Use Case:** Recent sprint team composition

---

### Example 4: Get All Team Members (Historical)

**Request:**
```json
{
  "tool": "get-team-members",
  "activeOnly": false
}
```

**Behavior:**
- Returns all team members who have ever been assigned work
- No date range filtering
- Still filters out GitHub Copilot and nulls

**Use Case:** Historical team analysis or alumni tracking

---

### Example 5: Multi-Area Team Discovery

**Request:**
```json
{
  "tool": "get-team-members",
  "areaPath": "MyProject",
  "dateRangeStart": "2024-09-01"
}
```

**Behavior:**
- Broad area path includes all sub-areas (Frontend, Backend, QA, etc.)
- Gets entire project team

**Use Case:** Organization-wide health analysis

## Integration with Other Tools

### 1. Batch Workload Analysis

```json
// Step 1: Get team members
{ "tool": "get-team-members" }

// Response: { teamMembers: ["alice@...", "bob@..."] }

// Step 2: Analyze workload for all members
{
  "tool": "analyze-workload",
  "assignedToEmail": ["alice@...", "bob@..."],
  "analysisPeriodDays": 90,
  "maxConcurrency": 5
}
```

**Benefits:**
- Automatic team discovery (no manual roster)
- Filters out GitHub Copilot assignments automatically
- Single batch call for all team members

### 2. Sprint Planning

```json
// Get current sprint team members
{
  "tool": "get-team-members",
  "dateRangeStart": "2024-11-01"
}

// Use emails for capacity planning and assignment recommendations
```

### 3. Team Health Dashboard

```json
// Discover team
{ "tool": "get-team-members" }

// For each member, run personal workload analysis
// Aggregate results into team health metrics
```

## Implementation Details

### OData Query Structure

The tool uses Azure DevOps Analytics OData API:

```
$apply=filter(
  AssignedTo/UserEmail ne null
  and ChangedDate ge {startDate}Z
  and ChangedDate le {endDate}Z
  and startswith(Area/AreaPath, '{areaPath}')
)/groupby(
  (AssignedTo/UserEmail, AssignedTo/UserName),
  aggregate($count as Count)
)
&$orderby=Count desc
&$top=1000
```

### Key Components

- **Filter Clause**: Excludes nulls, applies date range and area path
- **Group By**: Groups by email and name (aggregates duplicates)
- **Order By**: Sorts by assignment count (most active first)
- **Top**: Limits to 1000 members (configurable)

### Performance

- **Query Execution**: ~200-500ms for typical teams
- **Network Latency**: Depends on Analytics API response time
- **Caching**: Not cached (team composition can change daily)
- **Rate Limiting**: Respects Azure DevOps Analytics API limits

## Error Handling

### Common Errors

1. **Missing Organization/Project**:
   ```json
   {
     "success": false,
     "errors": ["Missing required parameters: organization project"]
   }
   ```
   **Fix**: Ensure MCP server is configured with org/project defaults

2. **Analytics API Unauthorized (401)**:
   ```json
   {
     "success": false,
     "errors": ["OData query failed: 401 Unauthorized"]
   }
   ```
   **Fix**: User needs "View analytics" permission in Azure DevOps project

3. **Invalid Date Format**:
   ```json
   {
     "success": false,
     "errors": ["OData query failed: 400 Bad Request - Invalid date format"]
   }
   ```
   **Fix**: Use ISO format `YYYY-MM-DD` (not `YYYY-MM-DDTHH:MM:SSZ`)

4. **Area Path Not Found**:
   - Tool will still execute but may return 0 results
   - Check that area path exists and uses correct backslash escaping

## Troubleshooting

### Problem: Returns 0 Team Members

**Possible Causes:**
1. Date range too narrow (no activity in that period)
2. Area path doesn't match any work items
3. All team members are bots/GitHub Copilot
4. Wrong organization or project

**Solution:**
```json
{
  "tool": "get-team-members",
  "activeOnly": false,
  "dateRangeStart": "2023-01-01"
}
```

### Problem: Missing Expected Team Members

**Causes:**
1. Date range excludes their activity
2. They're not assigned to any work items
3. Area path filter excludes their work

**Solution:**
- Expand date range: `"dateRangeStart": "2024-01-01"`
- Broaden area path: `"areaPath": "MyProject"` (remove sub-areas)
- Disable active filter: `"activeOnly": false`

### Problem: Includes GitHub Copilot

**This should not happen** - GitHub Copilot is automatically filtered. If you see Copilot in results:
1. Check email format for new Copilot patterns
2. Report as a bug with the exact email address

## Best Practices

### 1. Use Before Batch Operations

Always discover team members first:
```json
// ✅ Good: Discover team automatically
{ "tool": "get-team-members" }
// Then use returned emails for batch analysis

// ❌ Bad: Hardcode team member list
{ "tool": "analyze-workload", "assignedToEmail": ["alice@...", "bob@..."] }
```

### 2. Match Date Ranges

Keep date ranges consistent:
```json
// Get team members active in last 90 days
{ "tool": "get-team-members", "dateRangeStart": "2024-08-13" }

// Analyze same 90-day period
{ "tool": "analyze-workload", "analysisPeriodDays": 90 }
```

### 3. Area Path Scoping

Use area paths to focus on specific teams:
```json
// Project-wide team
{ "tool": "get-team-members", "areaPath": "MyProject" }

// Sub-team only
{ "tool": "get-team-members", "areaPath": "MyProject\\Backend\\API" }
```

### 4. Active vs Historical

Choose the right filter for your use case:
- **Active Only (`true`)**: Current sprint/team health
- **Historical (`false`)**: Alumni analysis, long-term trends

## Version History

### v1.0.0 (2024-11-11)
- Initial implementation
- OData Analytics integration
- Automatic GitHub Copilot filtering
- Date range and area path filtering
- Active-only mode

## Related Tools

- **`analyze-workload`**: Batch personal workload analysis (uses team member emails)
- **`query-odata`**: Advanced OData Analytics queries (underlying mechanism)
- **`get-config`**: View configured area paths and defaults

## See Also

- [Query Tools Documentation](./QUERY_TOOLS.md)
- [Batch Workload Analysis Guide](../../mcp_server/resources/batch-workload-analysis-guide.md)
- [Team Health Analyzer Prompt](../../mcp_server/prompts/team_health_analyzer.md)
