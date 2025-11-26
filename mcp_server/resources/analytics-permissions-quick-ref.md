# Analytics API Permissions Quick Reference

**For AI Agents:** Quick guide to diagnosing and resolving Analytics API 401 errors.

---

## TL;DR

**Error:** `TF400813: The user is not authorized to access this resource` (401)

**Quick Fix:**
1. Run `az login` to authenticate
2. Check if user has "View analytics" permission at project level
3. If missing permission, use WIQL queries as fallback

---

## Permission Comparison

| API Type | Permission Required | Tools That Use It |
|----------|---------------------|-------------------|
| **Work Items API** (WIQL) | View work items | `query-wiql`, `get-context`, all bulk operations |
| **Analytics API** (OData) | **View analytics** | `query-odata` with any queryType |

**Key Point:** "View analytics" is a SEPARATE permission from "View work items"

---

## Diagnosis Flow

```
401 Error on OData query
    │
    ├─► Check: Is Azure CLI logged in?
    │   │
    │   ├─► NO  → Run `az login`
    │   └─► YES → Continue
    │
    └─► Check: Does user have "View analytics" permission?
        │
        ├─► NO  → Option 1: Request permission from admin
        │         Option 2: Use WIQL as fallback
        │
        └─► YES → Check other issues (network, API limits, etc.)
```

---

## Quick Checks

### 1. Verify Azure CLI Login
```powershell
az account show
```
If this fails, user needs to run `az login`

### 2. Check Permission URL
```
https://dev.azure.com/{org}/{project}/_settings/security
```
Search for user → Look for "View analytics" permission

### 3. Test Analytics Access
```json
{
  "tool": "query-odata",
  "arguments": {
    "queryType": "workItemCount"
  }
}
```
Success = Has permission  
401 = Missing permission or not authenticated

---

## Migration Patterns: OData → WIQL

When users can't get Analytics permission, help them migrate to WIQL:

### Pattern 1: Count Items
```javascript
// ❌ OData (requires "View analytics")
{
  tool: "query-odata",
  arguments: { queryType: "workItemCount", filters: { State: "Active" } }
}

// ✅ WIQL (uses "View work items")
{
  tool: "query-wiql",
  arguments: {
    wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
    returnQueryHandle: true
  }
}
// Count is in response: totalCount field
```

### Pattern 2: Group By State
```javascript
// ❌ OData (requires "View analytics")
{
  tool: "query-odata",
  arguments: { queryType: "groupByState" }
}

// ✅ WIQL + Manual Grouping (uses "View work items")
{
  tool: "query-wiql",
  arguments: {
    wiqlQuery: "SELECT [System.Id] FROM WorkItems",
    returnQueryHandle: true,
    maxResults: 1000
  }
}
// Then use analyze-bulk with analysisType: ["completion"] to get state distribution
```

### Pattern 3: Velocity Metrics
```javascript
// ❌ OData (requires "View analytics")
{
  tool: "query-odata",
  arguments: {
    queryType: "velocityMetrics",
    dateRangeField: "CompletedDate",
    dateRangeStart: "2024-11-01"
  }
}

// ✅ WIQL + Manual Analysis (uses "View work items")
{
  tool: "query-wiql",
  arguments: {
    wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] IN ('Done', 'Closed') AND [Microsoft.VSTS.Common.ClosedDate] >= '2024-11-01'",
    returnQueryHandle: true,
    includeFields: ["Microsoft.VSTS.Common.ClosedDate", "Microsoft.VSTS.Scheduling.StoryPoints"]
  }
}
// Then use analyze-bulk with analysisType: ["velocity"] for completion trends
```

---

## Agent Guidance

### When User Gets 401 Error

**DO:**
1. Explain the error is likely missing "View analytics" permission
2. Provide the permission check URL
3. Offer WIQL as immediate fallback
4. Show equivalent WIQL query for their use case

**DON'T:**
1. Assume it's an authentication bug
2. Keep retrying OData queries
3. Suggest complex workarounds before trying simple permission check

### Sample Agent Response

```
I see you're getting a 401 error when using OData Analytics queries. 
This typically means you need the "View analytics" permission in Azure DevOps.

Quick checks:
1. Are you logged into Azure CLI? Run: az login
2. Do you have "View analytics" permission?
   Check: https://dev.azure.com/{org}/{project}/_settings/security

While you verify permissions, I can help you get the same data using 
WIQL queries, which work with standard "View work items" permission.

Would you like me to:
A) Show you the WIQL equivalent for your query
B) Wait while you check/request permissions
C) Use WIQL for now and revisit OData later
```

---

## Permission Request Template

When user needs to request permission, suggest this email:

```
Subject: Request "View analytics" Permission for [Project Name]

Hi [Admin Name],

I need access to Azure DevOps Analytics API for [Project Name] to use 
analytics queries and metrics tools.

Could you please grant me the "View analytics" permission at the project level?

My email: [user-email@domain.com]
Project: [project-name]

Instructions:
1. Go to https://dev.azure.com/{org}/{project}/_settings/security
2. Find my user or add me to a group with analytics access
3. Enable "View analytics" permission

Thank you!
```

---

## Why Two Separate Permissions?

**"View work items"** → Individual work item access
- Query specific items
- View details, history, comments
- Standard team member permission

**"View analytics"** → Aggregated metrics access
- Analytics API (OData)
- Dashboards and reports
- Trend analysis, velocity tracking
- Typically for admins/analysts

**Technical:** Analytics API uses different authentication tokens and requires Azure CLI credentials

---

## Related Documentation

- [Full Troubleshooting Guide](../../docs/TROUBLESHOOTING.md)
- [Query Tools Spec](../../docs/feature_specs/QUERY_TOOLS.md)
- [OData Optimization](../../docs/feature_specs/ODATA_QUERY_OPTIMIZATION.md)
- [WIQL Best Practices](../../docs/guides/WIQL_BEST_PRACTICES.md)

---

**Last Updated:** 2025-11-18  
**Target Audience:** AI Agents  
**Version:** 1.0.0
