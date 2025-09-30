# New-WorkItemWithParent-MCP.ps1
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Title,
    [string]$WorkItemType = "Product Backlog Item",
    [int]$ParentWorkItemId,
    [string]$Description = "",
    [Parameter(Mandatory=$true)][string]$Organization,
    [Parameter(Mandatory=$true)][string]$Project,
    [string]$AreaPath = "",
    [string]$IterationPath = "",
    [string]$AssignedTo = "@me",
    [int]$Priority = 2,
    [string]$Tags = "",
    [switch]$InheritParentPaths = $true
)

. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) "modules\AzureDevOpsHelper-MCP.ps1")

Invoke-MCPScript {
    $ValidTypes = @('Task', 'Product Backlog Item', 'Bug', 'Feature', 'Epic', 'User Story')
    if ($WorkItemType -notin $ValidTypes) {
        throw "Invalid work item type: $WorkItemType"
    }
    
    if (-not (Test-AzureCLI)) { throw "Azure CLI authentication required" }
    
    # Resolve @me assignment
    if ($AssignedTo -eq "@me") {
        $account = az account show --output json 2>$null
        $AssignedTo = if ($LASTEXITCODE -eq 0 -and $account) { ($account | ConvertFrom-Json).user.name } else { "" }
    }
    
    # Get parent paths if inheriting
    if ($ParentWorkItemId -and $InheritParentPaths) {
        $parentItem = az boards work-item show --id $ParentWorkItemId --org "https://dev.azure.com/$Organization" --output json 2>$null
        if ($LASTEXITCODE -eq 0 -and $parentItem) {
            $parent = ($parentItem | Where-Object { $_ -notmatch "^(WARNING|ERROR|WARN)" } | Out-String) | ConvertFrom-Json
            if (-not $AreaPath -and $parent.fields.'System.AreaPath') { $AreaPath = $parent.fields.'System.AreaPath' }
            if (-not $IterationPath -and $parent.fields.'System.IterationPath') { $IterationPath = $parent.fields.'System.IterationPath' }
        }
    }
    
    # Create work item
    $args = @('boards', 'work-item', 'create', '--title', $Title, '--type', $WorkItemType, '--org', "https://dev.azure.com/$Organization", '--project', $Project, '--output', 'json')
    
    if ($Description) {
        $tempFile = [System.IO.Path]::GetTempFileName()
        $Description | Out-File -FilePath $tempFile -Encoding UTF8
        $args += '--description', "@$tempFile"
    }
    
    if ($AreaPath) { $args += '--area', $AreaPath }
    if ($IterationPath) { $args += '--iteration', $IterationPath }
    if ($AssignedTo) { $args += '--assigned-to', $AssignedTo }
    
    try {
        $output = & az @args 2>$null | Out-String
        if ($LASTEXITCODE -ne 0) { throw "Azure CLI failed" }
        
        $workItem = ($output | ConvertFrom-Json)
        
        # Update priority/tags if needed
        if ($Priority -ne 2 -or $Tags) {
            $fields = @()
            if ($Priority -ne 2) { $fields += "Microsoft.VSTS.Common.Priority=$Priority" }
            if ($Tags) { $fields += "System.Tags=$Tags" }
            
            $updateArgs = @('boards', 'work-item', 'update', '--id', $workItem.id, '--org', "https://dev.azure.com/$Organization", '--project', $Project, '--fields', ($fields -join ' '), '--output', 'json')
            $updateOutput = & az @updateArgs 2>$null | Out-String
            if ($LASTEXITCODE -eq 0) {
                $updated = ($updateOutput | ConvertFrom-Json)
                if ($updated) { $workItem = $updated }
            }
        }
    }
    finally {
        if ($tempFile -and (Test-Path $tempFile)) { Remove-Item $tempFile -Force -ErrorAction SilentlyContinue }
    }
    
    # Link to parent if specified
    $parentLinked = $false
    if ($ParentWorkItemId) {
        $null = az boards work-item relation add --id $workItem.id --relation-type parent --target-id $ParentWorkItemId --org "https://dev.azure.com/$Organization" --output json 2>$null
        $parentLinked = $LASTEXITCODE -eq 0
    }
    
    # Create a PSCustomObject instead of hashtables to ensure proper JSON serialization
    $workItemData = [PSCustomObject]@{
        id = $workItem.id
        title = $workItem.fields.'System.Title'
        type = $workItem.fields.'System.WorkItemType'
        state = $workItem.fields.'System.State'
        url = "https://dev.azure.com/$Organization/$Project/_workitems/edit/$($workItem.id)"
        parent_linked = $parentLinked
    }
    
    $responseData = [PSCustomObject]@{
        work_item = $workItemData
    }
    
    # Explicitly return ONLY the MCP response
    $mcpResponse = New-MCPResponse -Success $true -Data $responseData
    return $mcpResponse
}