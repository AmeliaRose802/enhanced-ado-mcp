# New-WorkItemAndAssignToCopilot-MCP.ps1
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true, Position=0)][string]$Title,
    [Parameter(Mandatory=$true, Position=1)][int]$ParentWorkItemId,
    [string]$WorkItemType = "Product Backlog Item",
    [string]$Description = "",
    [Parameter(Mandatory=$true)][string]$Organization,
    [Parameter(Mandatory=$true)][string]$Project,
    [Parameter(Mandatory=$true)][string]$Repository,
    [string]$Branch = "main",
    [Parameter(Mandatory=$true)][string]$GitHubCopilotGuid,
    [string]$AreaPath = "",
    [string]$IterationPath = "",
    [int]$Priority = 2,
    [string]$Tags = "",
    [switch]$InheritParentPaths = $true,
    [switch]$DryRun
)

. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) "modules\AzureDevOpsHelper-MCP.ps1")

Invoke-MCPScript {
    $ScriptPath = Split-Path -Parent $PSCommandPath
    $NewWorkItemScript = Join-Path $ScriptPath "New-WorkItemWithParent-MCP.ps1"
    $AssignToCopilotScript = Join-Path $ScriptPath "Assign-ItemToCopilot-MCP.ps1"
    
    if (-not (Test-Path $NewWorkItemScript)) { throw "New-WorkItemWithParent-MCP.ps1 not found" }
    if (-not (Test-Path $AssignToCopilotScript)) { throw "Assign-ItemToCopilot-MCP.ps1 not found" }
    
    # Create work item
    $createArgs = @{
        'Title' = $Title
        'ParentWorkItemId' = $ParentWorkItemId
        'WorkItemType' = $WorkItemType
        'Organization' = $Organization
        'Project' = $Project
        'AssignedTo' = ''  # Create unassigned
    }
    
    if ($Description) { $createArgs['Description'] = $Description }
    if ($AreaPath) { $createArgs['AreaPath'] = $AreaPath }
    if ($IterationPath) { $createArgs['IterationPath'] = $IterationPath }
    if ($Priority -ne 2) { $createArgs['Priority'] = $Priority }
    if ($Tags) { $createArgs['Tags'] = $Tags }
    # Don't pass InheritParentPaths since it defaults to $true in the target script
    # Note: New-WorkItemWithParent-MCP.ps1 doesn't support -DryRun parameter
    
    $createArgs | ConvertTo-Json | Write-Host -ForegroundColor Magenta
    $createResult = & $NewWorkItemScript @createArgs
    
    # Handle case where output might be an array of JSON objects or a single JSON string
    $createResponse = $null
    
    if ($createResult -is [array] -and $createResult.Count -gt 0) {
        # Find the MCP response (should have success property and be a proper JSON string)
        # The first item is usually the Azure CLI output (array of strings), the second is the MCP response
        for ($i = $createResult.Count - 1; $i -ge 0; $i--) {
            $item = $createResult[$i]
            Write-Host "DEBUG: Checking item[$i]: $($item.GetType().Name)" -ForegroundColor Magenta
            if ($item -is [hashtable] -and $item.ContainsKey('success')) {
                $createResponse = $item
                Write-Host "DEBUG: Found hashtable MCP response" -ForegroundColor Magenta
                break
            } elseif ($item -is [string] -and $item -match '^\s*\{[\s\S]*"success"\s*:[\s\S]*\}\s*$') {
                $createResponse = $item | ConvertFrom-Json
                Write-Host "DEBUG: Found JSON string MCP response" -ForegroundColor Magenta
                break
            }
        }
        if (-not $createResponse) {
            throw "No MCP response found in output array"
        }
    } elseif ($createResult -is [string] -and $createResult.Trim().StartsWith('{')) {
        # Single JSON string
        $createResponse = $createResult | ConvertFrom-Json
        Write-Host "DEBUG: Parsed single JSON string" -ForegroundColor Magenta
    } elseif ($createResult -is [hashtable]) {
        # Already a hashtable object
        $createResponse = $createResult
        Write-Host "DEBUG: Used hashtable directly" -ForegroundColor Magenta
    } else {
        throw "Unexpected output format from New-WorkItemWithParent-MCP.ps1: $($createResult.GetType().Name)"
    }
    
    if (-not $createResponse.success) { 
        throw "Failed to create work item: $($createResponse.errors -join '; ')" 
    }
    
    # Handle both hashtable and PSCustomObject access patterns
    Write-Host "DEBUG: createResponse.data type: $($createResponse.data.GetType().Name)" -ForegroundColor Magenta
    Write-Host "DEBUG: createResponse.data: $($createResponse.data)" -ForegroundColor Magenta
    
    $workItemData = if ($createResponse.data -is [hashtable]) { 
        Write-Host "DEBUG: Data is hashtable" -ForegroundColor Magenta
        $createResponse.data['work_item'] 
    } else { 
        Write-Host "DEBUG: Data is PSCustomObject" -ForegroundColor Magenta
        $createResponse.data.work_item 
    }
    
    Write-Host "DEBUG: workItemData type: $($workItemData.GetType().Name)" -ForegroundColor Magenta
    Write-Host "DEBUG: workItemData: $workItemData" -ForegroundColor Magenta
    
    $newWorkItemId = if ($workItemData -is [hashtable]) { 
        Write-Host "DEBUG: WorkItem data is hashtable" -ForegroundColor Magenta
        $workItemData['id'] 
    } elseif ($workItemData -is [PSCustomObject]) {
        Write-Host "DEBUG: WorkItem data is PSCustomObject" -ForegroundColor Magenta
        $workItemData.id
    } else { 
        Write-Host "DEBUG: WorkItem data is other type: $($workItemData.GetType().Name)" -ForegroundColor Magenta
        $workItemData.id 
    }
    
    Write-Host "DEBUG: New work item ID: $newWorkItemId" -ForegroundColor Magenta
    Start-Sleep -Seconds 2  # Let work item initialize
    
    # Assign to Copilot
    Write-Host "DEBUG: About to assign work item $newWorkItemId to Copilot" -ForegroundColor Magenta
    $assignArgs = @{
        'WorkItemId' = $newWorkItemId
        'Organization' = $Organization
        'Project' = $Project
        'Repository' = $Repository
        'Branch' = $Branch
        'GitHubCopilotGuid' = $GitHubCopilotGuid
    }
    
    try {
        $assignResult = & $AssignToCopilotScript @assignArgs
        Write-Host "DEBUG: Assignment result type: $($assignResult.GetType().Name)" -ForegroundColor Magenta
        Write-Host "DEBUG: Assignment result: $assignResult" -ForegroundColor Magenta
        
        # The script returns JSON string output from Invoke-MCPScript
        # Need to handle both single string and array of strings (stdout lines)
        $jsonString = if ($assignResult -is [array]) {
            # Join array lines and find the JSON object
            $joined = $assignResult -join "`n"
            # Extract just the JSON object (should be the last complete { } block)
            if ($joined -match '(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})\s*$') {
                $matches[1]
            } else {
                $joined
            }
        } else {
            $assignResult
        }
        
        Write-Host "DEBUG: Parsing JSON: $jsonString" -ForegroundColor Magenta
        $assignResponse = $jsonString | ConvertFrom-Json
        Write-Host "DEBUG: Assignment response success: $($assignResponse.success)" -ForegroundColor Magenta
        
        if (-not $assignResponse.success) {
            throw "Work item created but assignment failed: $($assignResponse.errors -join '; ')"
        }
    } catch {
        Write-Host "DEBUG: Assignment failed with exception: $($_.Exception.Message)" -ForegroundColor Red
        throw "Work item created but assignment failed: $($_.Exception.Message)"
    }
    
    New-MCPResponse -Success $true -Data @{
        work_item_id = $newWorkItemId
        work_item_title = $createResponse.data.work_item.title
        work_item_type = $createResponse.data.work_item.type
        assigned_to = "GitHub Copilot"
        repository_linked = $true
        human_friendly_url = "https://msazure.visualstudio.com/One/_workitems/edit/$newWorkItemId"
    }
}