# Troubleshooting Guide

**Feature Category:** Operations & Maintenance  
**Status:** ✅ Complete  
**Version:** 1.0.0  
**Last Updated:** 2025-11-18

## Overview

This guide helps you diagnose and resolve common issues when using the Enhanced ADO MCP Server.

---

## Analytics API Permissions (401 Errors)

### Understanding the Error

**Error Message:**
```
TF400813: The user '[user@domain.com]' is not authorized to access this resource.
```

**HTTP Status:** 401 Unauthorized

### Root Causes

The 401 error when using OData Analytics queries can have two main causes:

1. **Not logged into Azure CLI** - Analytics API requires Azure CLI authentication
2. **Missing "View analytics" permission** - Even with valid authentication, you need specific permissions

### Why Analytics API is Different

Azure DevOps has two separate permission systems for accessing work item data:

| Permission | Purpose | API Access | Typical Users |
|------------|---------|------------|---------------|
| **View work items** | Read individual work items | Work Items API (WIQL queries) | All team members |
| **View analytics** | Access aggregated metrics and analytics | Analytics API (OData queries) | Project admins, analysts, stakeholders |

**Key Difference:** The Analytics API requires a **separate permission** at the project level. Having "View work items" permission does NOT automatically grant Analytics API access.

### Step-by-Step Diagnosis

#### Step 1: Verify Azure CLI Login

```powershell
# Check if you're logged in
az account show

# If not logged in, run:
az login
```

**Expected Output:**
```json
{
  "environmentName": "AzureCloud",
  "user": {
    "name": "your-email@domain.com",
    "type": "user"
  }
}
```

If this fails, you need to log in before proceeding.

#### Step 2: Check Your Analytics Permissions

1. **Navigate to project security settings:**
   ```
   https://dev.azure.com/{YOUR_ORG}/{YOUR_PROJECT}/_settings/security
   ```

2. **Find yourself in the Members list:**
   - Search for your email address
   - Click on your user entry

3. **Look for "View analytics" permission:**
   - Scroll through the permissions list
   - Find the "View analytics" row
   - Check if it shows "Allow" (green checkmark) or "Not set" (gray)

4. **Check inherited permissions:**
   - If "Not set", click "Check inheritance"
   - See if you inherit this permission from a group

#### Step 3: Request Permission

**If you don't have "View analytics" permission:**

**Option A: Self-Service (if you're an admin)**
1. Go to project settings → Permissions
2. Find your user or group
3. Enable "View analytics" permission

**Option B: Request from Admin**
Send this email to your Azure DevOps project administrator:

```
Subject: Request "View analytics" Permission for [Project Name]

Hi [Admin Name],

I need access to Azure DevOps Analytics API for [Project Name] to use 
analytics queries and metrics tools.

Could you please grant me the "View analytics" permission at the project level?

My email: [your-email@domain.com]
Project: [project-name]

Instructions for admin:
1. Go to https://dev.azure.com/{org}/{project}/_settings/security
2. Find my user or add me to a group with analytics access
3. Enable "View analytics" permission

Thank you!
```

### Resolution Options

#### Option 1: Get Analytics Permission (Recommended)

**Pros:**
- Access to powerful aggregations and metrics
- Velocity tracking, burndown charts, cycle time analysis
- Better performance for large result sets
- Rich grouping and filtering capabilities

**Cons:**
- Requires admin approval
- May take time to get access

**Use Case:** Best for teams that need metrics, dashboards, and analytics

#### Option 2: Use WIQL as Fallback

**Pros:**
- Works with standard "View work items" permission
- No additional approval needed
- Immediate access

**Cons:**
- Manual aggregations required
- More API calls for large datasets
- Limited grouping capabilities
- No built-in metrics (cycle time, velocity)

**Use Case:** Quick work item queries without analytics needs

**Example Migration:**

```javascript
// ❌ OData (requires "View analytics" permission)
{
  "tool": "query-odata",
  "arguments": {
    "queryType": "groupByState",
    "filters": { "WorkItemType": "Bug" }
  }
}

// ✅ WIQL (works with "View work items" permission)
{
  "tool": "query-wiql",
  "arguments": {
    "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug'",
    "returnQueryHandle": true
  }
}
// Then use analyze-bulk to group by state manually
```

### Testing Your Access

After resolving authentication or permissions:

```json
// Test query - should return results without 401 error
{
  "tool": "query-odata",
  "arguments": {
    "queryType": "workItemCount",
    "filters": {
      "WorkItemType": "Bug"
    }
  }
}
```

**Expected Success Response:**
```json
{
  "success": true,
  "data": {
    "results": [{ "Count": 42 }],
    "totalCount": 42
  }
}
```

---

## Authentication Errors

### "Azure CLI not found"

**Error:** `Azure CLI (az) is not installed or not in PATH`

**Resolution:**
1. **Install Azure CLI:**
   - Windows: [aka.ms/installazurecliwindows](https://aka.ms/installazurecliwindows)
   - macOS: `brew install azure-cli`
   - Linux: [Installation Guide](https://docs.microsoft.com/cli/azure/install-azure-cli-linux)

2. **Verify installation:**
   ```powershell
   az --version
   ```

3. **Add to PATH if needed:**
   - Windows: Check system environment variables
   - macOS/Linux: Check `~/.bashrc` or `~/.zshrc`

### "Token expired" or "Invalid token"

**Error:** Authentication token has expired

**Resolution:**
```powershell
# Re-authenticate
az logout
az login

# Verify new token
az account show
```

### "Wrong tenant" or "Subscription not found"

**Error:** Authenticated to wrong Azure AD tenant

**Resolution:**
```powershell
# List available tenants
az account list --output table

# Switch to correct tenant
az login --tenant <tenant-id>
```

---

## Query Errors

### "Invalid WIQL syntax"

**Error:** Query string contains syntax errors

**Common Causes:**
- Missing quotes around string values
- Invalid field names
- Incorrect comparison operators
- Unclosed brackets

**Resolution:**
```javascript
// ❌ Wrong: Missing quotes
"WHERE [System.State] = Active"

// ✅ Correct: String values need quotes
"WHERE [System.State] = 'Active'"

// ❌ Wrong: Invalid field name
"WHERE [System.InvalidField] = 'Value'"

// ✅ Correct: Use valid field reference names
"WHERE [System.State] = 'Value'"
```

**Use AI generation to avoid syntax errors:**
```json
{
  "tool": "query-wiql",
  "arguments": {
    "description": "all active bugs created this week",
    "testQuery": true
  }
}
```

### "Field not found"

**Error:** Referenced field doesn't exist in your project

**Resolution:**
1. Check field reference name:
   ```
   https://dev.azure.com/{org}/{project}/_settings/process
   ```

2. Common field names:
   - `System.Title` - Work item title
   - `System.State` - Current state
   - `System.AssignedTo` - Assigned user
   - `Microsoft.VSTS.Common.Priority` - Priority (1-4)
   - `Microsoft.VSTS.Common.Severity` - Severity

3. Use `@Me` and `@Today` macros:
   ```sql
   WHERE [System.AssignedTo] = @Me
   WHERE [System.CreatedDate] >= @Today - 7
   ```

### "Query timeout" or "Too many results"

**Error:** Query is too complex or returns too many items

**Resolution:**
1. **Add filters to narrow results:**
   ```sql
   -- Add date range
   AND [System.CreatedDate] >= @Today - 30
   
   -- Add area path filter
   AND [System.AreaPath] UNDER 'Project\Team'
   
   -- Add state filter
   AND [System.State] IN ('Active', 'New')
   ```

2. **Use pagination:**
   ```json
   {
     "maxResults": 200,
     "skip": 0
   }
   ```

3. **Use OData for aggregations:**
   ```json
   // Instead of fetching all items and counting manually
   {
     "tool": "query-odata",
     "arguments": {
       "queryType": "groupByState"
     }
   }
   ```

---

## Configuration Issues

### "Area path not found"

**Error:** Specified area path doesn't exist

**Resolution:**
1. **Check available area paths:**
   ```json
   {
     "tool": "get-config",
     "arguments": {}
   }
   ```

2. **Use correct format:**
   ```
   ✅ Correct: "Project\Team\SubArea"
   ❌ Wrong:   "Project/Team/SubArea"
   ❌ Wrong:   "\Team\SubArea"
   ```

3. **Verify in Azure DevOps:**
   ```
   https://dev.azure.com/{org}/{project}/_settings/work
   → Project configuration → Areas
   ```

### "Organization or project not configured"

**Error:** Missing required configuration

**Resolution:**

**VS Code:** Update `settings.json`:
```json
{
  "github.copilot.chat.mcp.servers": {
    "enhanced-ado-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "enhanced-ado-mcp-server",
        "YOUR_ORG",
        "--area-path",
        "YOUR_PROJECT\\YOUR_TEAM"
      ]
    }
  }
}
```

**Claude Desktop:** Update config file:
```json
{
  "mcpServers": {
    "enhanced-ado-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "enhanced-ado-mcp-server",
        "YOUR_ORG",
        "--area-path",
        "YOUR_PROJECT\\YOUR_TEAM"
      ]
    }
  }
}
```

---

## Query Handle Lifecycle & Cleanup

### Understanding Query Handles

Query handles are temporary references to query results:

**Key Facts:**
- **Storage:** In-memory only (not persistent)
- **Expiration:** 24 hours by default (configurable)
- **Format:** `qh_<32-hex-chars>`
- **Purpose:** Prevent ID hallucination in bulk operations

**What Gets Stored:**
```typescript
queryHandle = {
  workItemIds: [12345, 12346, 12347, ...],
  query: "SELECT [System.Id] FROM WorkItems...",
  createdAt: "2025-11-18T10:00:00Z",
  expiresAt: "2025-11-19T10:00:00Z",  // 24 hours later
  workItemContext?: { /* staleness, titles, etc. */ }
}
```

### Automatic Cleanup

**How It Works:**
- Runs every 5 minutes automatically
- Removes handles where `expiresAt < now`
- Zero performance impact
- Cannot be disabled (prevents memory leaks)

**What Gets Cleaned:**
- Expired query handles
- Operation history (undo tracking)
- Stored work item context

**What's Preserved:**
- Active handles (not yet expired)
- Azure DevOps work items (only reference removed)

**Server Startup:**
```
Query Handle Service initialized at 2025-11-18T12:00:00Z
Query handle expiration: 1440 minutes (max: 2880 minutes)
```

**Cleanup Logs:**
```
[DEBUG] Cleaned up 3 expired query handles
```

### Memory Management

**Per Handle:**
```
Base: ~200 bytes
Work item IDs: ~8 bytes per ID
Context data: ~100-500 bytes per item (if staleness included)

Example:
100 items with staleness = ~51 KB
100 items without = ~1.1 KB
```

**Server Capacity:**
```
Typical: 512 MB - 1 GB available
With context: 1000 handles × 50 KB = 50 MB (10%)
Without: 1000 handles × 1 KB = 1 MB (0.2%)

Conclusion: Memory not a constraint
```

### Handle Not Persistent

**Important:** Handles are lost when server restarts

```
10:00 AM - Create handle: qh_abc123
10:30 AM - Use handle (works)
10:45 AM - Server restarts
10:50 AM - Use qh_abc123 → ERROR: Not found
```

**Recovery:**
Re-run the original query:
```json
{
  "tool": "query-wiql",
  "arguments": {
    "wiqlQuery": "<original query>",
    "returnQueryHandle": true
  }
}
```

**Why No Persistence?**
- Simplicity (no database needed)
- Performance (instant memory access)
- Security (no sensitive data on disk)
- Automatic cleanup on restart
- Handles designed for short workflows

## Bulk Operation Errors

### "Query handle expired"

**Error:** Attempted to use expired query handle

**Details:**
```json
{
  "success": false,
  "errors": ["Query handle expired 15 minutes ago"],
  "data": {
    "valid": false,
    "reason": "Query handle expired 15 minutes ago"
  }
}
```

**Causes:**
1. Handle created >24 hours ago (default TTL)
2. Long-running workflow with delays
3. Forgot about handle between sessions

**Diagnosis:**
```json
// Check handle status
{
  "tool": "inspect-handle",
  "arguments": {
    "queryHandle": "qh_abc123...",
    "detailed": true
  }
}

// Response shows:
{
  "expiration": {
    "created_at": "2025-11-17T10:00:00Z",
    "expires_at": "2025-11-18T10:00:00Z",
    "minutes_remaining": -15  // Negative = expired
  }
}
```

**Resolution:**
Re-run the query to get a fresh handle:
```json
{
  "tool": "query-wiql",
  "arguments": {
    "wiqlQuery": "SELECT [System.Id] FROM WorkItems...",
    "returnQueryHandle": true
  }
}
```

**Prevention:**
- Use handles within same workflow (minutes/hours)
- Check expiration if >1 hour old: `inspect-handle`
- Don't store handles for later use
- Re-query to get fresh data instead of reusing old handles

### "Query handle not found"

**Error:** Handle doesn't exist in server memory

**Details:**
```json
{
  "success": false,
  "errors": ["Query handle 'qh_abc123' not found"]
}
```

**Causes:**
1. **Never existed** - Typo in handle string
2. **Expired and cleaned** - Expired >5 minutes ago
3. **Server restarted** - All handles lost (not persistent)
4. **Wrong server** - Using handle from different MCP instance

**Diagnosis:**
```json
// List all active handles
{
  "tool": "list-handles",
  "arguments": {
    "includeExpired": false
  }
}

// Check if your handle is in the list
// If not, it's expired or never existed
```

**Server Restart Detection:**
Check logs for:
```
Query Handle Service initialized at 2025-11-18T12:00:00Z
```
If this timestamp is recent, server restarted and all handles were lost.

**Resolution:**
Re-run the original query:
```json
{
  "tool": "query-wiql",
  "arguments": {
    "wiqlQuery": "<same query as before>",
    "returnQueryHandle": true
  }
}
// New handle: qh_def456
```

**Prevention:**
- Copy handle string correctly (no typos)
- Use handles within 24 hours of creation
- Re-query after server restarts
- Don't assume handles persist across sessions

### "Handle has no staleness data"

**Error:** Template variables not substituted

**Symptom:**
```
Comment: "Inactive for {daysInactive} days"
Actual result: "Inactive for {daysInactive} days"  // Not substituted
```

**Cause:**
Query created without staleness analysis:
```json
// ❌ WRONG - No staleness data stored
{
  "wiqlQuery": "...",
  "returnQueryHandle": true,
  "includeSubstantiveChange": false  // Or omitted
}
```

**Diagnosis:**
```json
{
  "tool": "inspect-handle",
  "arguments": { "queryHandle": "qh_abc123" }
}

// Shows:
{
  "analysis": {
    "staleness_analysis_included": false,  // ← Problem
    "template_variables_available": ["id", "title", "state"]
    // Missing: daysInactive, lastSubstantiveChangeDate
  }
}
```

**Resolution:**
Re-query with staleness data:
```json
{
  "tool": "query-wiql",
  "arguments": {
    "wiqlQuery": "...",
    "includeSubstantiveChange": true,  // ← Add this
    "returnQueryHandle": true
  }
}
```

**Prevention:**
Always use both flags for staleness workflows:
```json
{
  "includeSubstantiveChange": true,
  "returnQueryHandle": true
}
```

### "Too many handles active"

**Error:** Server using excessive memory

**Symptom:**
Server slow or many handles in `list-handles`

**Diagnosis:**
```json
{
  "tool": "list-handles",
  "arguments": {}
}

// Shows:
{
  "total_active": 500,  // ← Too many
  "total_expired": 50
}
```

**Causes:**
1. Creating handles in loops
2. Not reusing handles for multiple operations
3. Very long workflow

**Example Bad Pattern:**
```javascript
// ❌ WRONG - Creates 100 handles
for (let i = 0; i < 100; i++) {
  const handle = await query();
  await bulkComment(handle);
  // Handle created but never reused
}

// Memory: 100 handles × 50 KB = 5 MB wasted
```

**Resolution:**

**Option 1: Reuse Handles**
```javascript
// ✅ CORRECT - One handle, multiple operations
const handle = await query();
await bulkComment(handle);
await bulkUpdate(handle);
await bulkAssign(handle);

// Memory: 1 handle × 50 KB = 50 KB
```

**Option 2: Wait for Cleanup**
- Automatic cleanup runs every 5 minutes
- Expired handles will be removed
- No action needed

**Option 3: Server Restart (Emergency Only)**
- Clears all handles immediately
- Only for critical memory issues
- All handles lost (not a clean solution)

**Prevention:**
- Reuse handles within workflows
- Don't create handles unnecessarily
- Use single query, multiple operations pattern

### "Item selector matched no items"

**Error:** Selection criteria didn't match any items in query handle

**Resolution:**
1. **Check handle contents:**
   ```json
   {
     "tool": "inspect-handle",
     "arguments": {
       "queryHandle": "qh_abc123...",
       "detailed": true
     }
   }
   ```

2. **Adjust selector criteria:**
   ```json
   {
     "itemSelector": {
       "states": ["Active", "New"],  // Make sure states match items
       "daysInactiveMin": 30         // Check if items meet criteria
     }
   }
   ```

3. **Use "all" selector to test:**
   ```json
   {
     "itemSelector": "all"
   }
   ```

### "Operation failed on some items"

**Error:** Bulk operation partially failed

**Resolution:**
1. **Review error details in response:**
   ```json
   {
     "errors": [
       {
         "workItemId": 12345,
         "error": "Field validation failed"
       }
     ]
   }
   ```

2. **Use `stopOnError: false` to continue:**
   ```json
   {
     "stopOnError": false  // Process remaining items
   }
   ```

3. **Check item states and permissions:**
   - Verify you can edit all items
   - Check if state transitions are valid
   - Ensure field values meet validation rules

---

## AI-Powered Tool Errors

### "Language model access denied"

**Error:** VS Code doesn't have permission to use language models

**Resolution:**
1. Open Command Palette (`F1`)
2. Run: **"MCP: List Servers"**
3. Select **"enhanced-ado-mcp"**
4. Click **"Configure Model Access"**
5. **Check ALL free models** (marked `0x`)

### "Sampling not available"

**Error:** Environment doesn't support AI features

**Context:** AI-powered tools require VS Code with GitHub Copilot

**Resolution:**
- Ensure you're using VS Code (not Claude Desktop)
- Install GitHub Copilot extension
- Grant language model access (see above)
- Some tools work in Claude Desktop (query generation)

### "Query generation failed after max iterations"

**Error:** AI couldn't generate valid query

**Resolution:**
1. **Provide more specific description:**
   ```json
   // ❌ Too vague
   { "description": "find items" }
   
   // ✅ Specific
   { "description": "find all active bugs in Engineering area created last week" }
   ```

2. **Use direct WIQL/OData instead:**
   ```json
   {
     "tool": "query-wiql",
     "arguments": {
       "wiqlQuery": "SELECT [System.Id] FROM WorkItems..."
     }
   }
   ```

3. **Enable examples for better results:**
   ```json
   {
     "includeExamples": true,
     "maxIterations": 5
   }
   ```

---

## Debug Mode

Enable debug logging for detailed troubleshooting:

```powershell
# PowerShell
$env:MCP_DEBUG='1'

# Bash/Zsh
export MCP_DEBUG=1
```

**Debug output includes:**
- API request/response details
- Authentication flow
- Query execution steps
- Error stack traces

**To enable debug tools (e.g., prompt templates):**
```powershell
$env:MCP_ENABLE_DEBUG_TOOLS='1'
```

---

## Getting Help

### Self-Service Resources

1. **Check documentation:**
   - [Feature Specs](./feature_specs/) - Tool documentation
   - [WIQL Best Practices](./guides/WIQL_BEST_PRACTICES.md) - Query patterns
   - [Common Workflows](../mcp_server/resources/common-workflows.md) - Usage examples

2. **Use discovery tools:**
   ```json
   // Find right tool for your task
   {
     "tool": "discover-tools",
     "arguments": {
       "intent": "I want to find stale work items"
     }
   }
   ```

3. **Inspect your configuration:**
   ```json
   {
     "tool": "get-config",
     "arguments": {}
   }
   ```

### Common Solutions Checklist

Before asking for help, verify:

- [ ] Azure CLI is installed and logged in (`az login`)
- [ ] You have required permissions (View work items / View analytics)
- [ ] Configuration is correct (organization, project, area path)
- [ ] Query syntax is valid (test with simple query first)
- [ ] Area paths and iteration paths exist in Azure DevOps
- [ ] You're using the latest version (`npx -y enhanced-ado-mcp-server`)

### Support Channels

1. **GitHub Issues:** [Report bugs or request features](https://github.com/AmeliaRose802/enhanced-ado-mcp)
2. **Documentation:** [Read the docs](https://github.com/AmeliaRose802/enhanced-ado-mcp/tree/master/docs)

---

## Quick Reference

### Permission Requirements by Feature

| Feature | Required Permission | Alternative |
|---------|---------------------|-------------|
| WIQL Queries | View work items | None |
| OData Analytics | **View analytics** | Use WIQL instead |
| Create/Update Items | Edit work items | None |
| View History | View work items | None |
| Bulk Operations | Edit work items | None |
| AI Analysis | View work items + GitHub Copilot | N/A |

### Common Error Codes

| Code | Meaning | Fix |
|------|---------|-----|
| 401 | Unauthorized | Check authentication and permissions |
| 403 | Forbidden | Verify permissions |
| 404 | Not Found | Check organization/project/area path |
| 400 | Bad Request | Verify query syntax |
| 500 | Server Error | Retry or contact Azure DevOps support |

---

**Last Updated:** 2025-11-18  
**Version:** 1.0.0  
**Maintained by:** Enhanced ADO MCP Server Team
