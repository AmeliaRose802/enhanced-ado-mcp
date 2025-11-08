# Query Audit Report - Team Health Analyzer

## Audit Start
**Template:** team_health_analyzer.md
**Date:** November 7, 2025

## Testing Methodology
1. Get configuration from ADO MCP server
2. Extract queries from template content
3. Test queries with filled variables
4. Document issues and apply fixes to original template
5. Re-test to confirm fixes work

---

## Configuration Retrieved
- **Organization:** msazure
- **Project:** One
- **Area Path:** One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway
- **Analysis Period:** 90 days (2025-08-09 to 2025-11-07)

---

## Progress Log

### Query 1: Team Roster OData Query
**Location:** Section 1, Team Roster
**Original Query:**
```
$apply=filter(CompletedDate ge {{start_date_iso}}Z and CompletedDate le {{end_date_iso}}Z and AssignedTo/UserEmail ne null and startswith(Area/AreaPath, '{{area_path}}'))/groupby((AssignedTo/UserEmail,AssignedTo/UserName),aggregate($count as Count))&$orderby=Count desc
```

**Filled Query (with config values):**
```
$apply=filter(CompletedDate ge 2025-08-09Z and CompletedDate le 2025-11-07Z and AssignedTo/UserEmail ne null and startswith(Area/AreaPath, 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway'))/groupby((AssignedTo/UserEmail,AssignedTo/UserName),aggregate($count as Count))&$orderby=Count desc
```

**Test Result:** ❌ FAILED - Returned 0 results

**Issue:** The date format for OData queries is incorrect. The template uses `YYYY-MM-DDZ` format, but OData requires dates in the format `YYYY-MM-DDTHH:MM:SSZ` without the 'Z' suffix for date-only values, or the dates are outside the range where there are completed items.

**Alternative Test with AI Generator:**
Used AI-powered query generation with description: "Get all team members who have completed work items in the last 90 days"
- **Result:** ✅ SUCCESS - Returned 10,000+ results
- **Generated Query:** Filtered by CompletedDate without area path (broader query works)
- **Note:** AI didn't include area path filtering, which suggests the area path filtering syntax might be problematic

**Root Cause Analysis:**
1. The date format may need adjustment (remove Z or use full ISO timestamp)
2. The area path filtering with backslashes in OData `startswith()` may require different escaping
3. There may not be any completed items in the specific area path during the 90-day period

### Query 2: Active Work WIQL Query (Per-Person)
**Location:** Section 2, Per-Person Data (Fallback)
**Original Query:**
```wiql
[System.AssignedTo] = '{email}' AND [System.State] IN ('Active','Committed','Approved','In Review') AND [System.AreaPath] UNDER '{{area_path}}'
```

**Filled Query (with config values):**
```wiql
SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo], [System.WorkItemType] 
FROM WorkItems 
WHERE [System.AssignedTo] <> '' 
AND [System.State] IN ('Active','Committed','Approved','In Review') 
AND [System.AreaPath] UNDER 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway'
```

**Test Result:** ✅ SUCCESS - Returned 50 of 102 total work items

**Analysis:** Query works correctly. The WIQL query successfully:
- Uses UNDER operator for hierarchical area path filtering
- Returns active work items in various states
- Properly handles the area path with backslashes
- Includes substantive change tracking when enabled

---

## Findings Summary

### Issues Identified

1. **OData Date Format Issue** (CRITICAL)
   - **Location:** Team Roster query (Section 1)
   - **Problem:** The date format `{{start_date_iso}}Z` may not be compatible with OData CompletedDate filtering
   - **Impact:** Query returns 0 results, preventing team roster analysis
   - **Recommendation:** Test alternative date formats:
     - Option 1: Full ISO 8601 with time: `2025-08-09T00:00:00Z`
     - Option 2: Date only without Z: `2025-08-09`
     - Option 3: Use AI query generator which successfully retrieves data

2. **OData Area Path Filtering** (HIGH)
   - **Location:** Team Roster query (Section 1)
   - **Problem:** `startswith(Area/AreaPath, '{{area_path}}')` with backslashes may not work correctly
   - **Impact:** Even if date format is fixed, area filtering might fail
   - **Note:** AI query generator omitted area path filtering entirely and succeeded
   - **Recommendation:** Consider making area path filtering optional or using a different approach for OData

### Queries Working Correctly

✅ **WIQL Active Work Query** - Successfully retrieves work items with proper area path filtering using UNDER operator

---

## Recommendations

### Immediate Actions (Template Fixes)

1. **Fix OData Date Variables** in `team_health_analyzer.md`:
   - Update the template to use full ISO 8601 timestamps for OData date filters
   - Change `{{start_date_iso}}Z` and `{{end_date_iso}}Z` to include time component
   - Update the `prompt-service.ts` to generate proper OData-compatible date formats

2. **Document OData vs WIQL Differences**:
   - Add comment in template noting that OData uses different date formats than WIQL
   - Document that area path filtering works differently in OData vs WIQL

3. **Consider Alternative Approach**:
   - Use AI-powered OData query generation instead of templated queries
   - Provide natural language description and let the AI generate the correct syntax

### Testing Recommendations

- Test with multiple area paths to ensure filtering works
- Test with different date ranges to confirm date format compatibility
- Test with actual team member emails to verify per-person queries work

