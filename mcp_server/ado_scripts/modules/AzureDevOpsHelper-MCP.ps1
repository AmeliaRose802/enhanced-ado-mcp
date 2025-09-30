# AzureDevOpsHelper-MCP.ps1
# MCP-ready module for Azure DevOps CLI interactions

function New-MCPResponse {
    param(
        [bool]$Success,
        [object]$Data = $null,
        [string[]]$Errors = @(),
        [string[]]$Warnings = @(),
        [hashtable]$Metadata = @{}
    )
    
    @{
        success = $Success
        data = $Data
        errors = $Errors
        warnings = $Warnings
        metadata = @{
            timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        } + $Metadata
    }
}

function Invoke-MCPScript {
    param([scriptblock]$ScriptBlock)
    
    try {
        $result = & $ScriptBlock
        ($result | ConvertTo-Json -Depth 10)
        # Handle both hashtable and object access patterns
        $success = if ($result -is [hashtable]) { $result['success'] } else { $result.success }
        if ($success) { exit 0 } else { exit 1 }
    } catch {
        $errorResponse = New-MCPResponse -Success $false -Errors @($_.Exception.Message)
        ($errorResponse | ConvertTo-Json -Depth 10)
        exit 1
    }
}

function Test-AzureCLI {
    try {
        $result = az account show 2>$null
        if ($LASTEXITCODE -ne 0) {
            return $false
        }
        return $true
    }
    catch {
        return $false
    }
}

function Get-AzureDevOpsAccessToken {
    try {
        $token = az account get-access-token --resource "https://app.vssps.visualstudio.com/" --query "accessToken" --output tsv 2>$null
        if ($LASTEXITCODE -eq 0 -and $token) {
            return $token.Trim()
        }
        return $null
    }
    catch {
        return $null
    }
}

function Ensure-AzureDevOpsExtension {
    try {
        $extList = az extension list --output json 2>$null | ConvertFrom-Json
        if (-not ($extList | Where-Object { $_.name -eq 'azure-devops' })) {
            $job = Start-Job -ScriptBlock { az extension add --name azure-devops 2>$null }
            $completed = Wait-Job $job -Timeout 30
            if ($completed) {
                Receive-Job $job | Out-Null
                Remove-Job $job
                return $true
            } else {
                Stop-Job $job; Remove-Job $job
                return $false
            }
        } else {
            return $true
        }
    }
    catch {
        return $false
    }
}

function Invoke-AzureDevOpsRestAPI {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [string]$Body = $null,
        [hashtable]$Headers = @{}
    )
    
    $accessToken = Get-AzureDevOpsAccessToken
    if (-not $accessToken) {
        throw "Unable to get Azure DevOps access token. Please ensure you're logged in with 'az login'"
    }
    
    $authHeaders = @{
        'Authorization' = "Bearer $accessToken"
        'Accept' = 'application/json'
    }
    
    if ($Body) {
        $authHeaders['Content-Type'] = 'application/json'
    }
    
    # Merge additional headers
    foreach ($key in $Headers.Keys) {
        $authHeaders[$key] = $Headers[$key]
    }
    
    try {
        if ($Body) {
            $response = Invoke-RestMethod -Uri $Url -Method $Method -Body $Body -Headers $authHeaders -TimeoutSec 30
        } else {
            $response = Invoke-RestMethod -Uri $Url -Method $Method -Headers $authHeaders -TimeoutSec 30
        }
        return $response
    }
    catch {
        Write-Warning "REST API call failed: $($_.Exception.Message)"
        return $null
    }
}

function Search-SecurityWorkItems {
    param(
        [string]$SearchPattern,
        [string]$AreaPath,
        [string]$Organization,
        [string]$Project,
        [int]$TimeoutSeconds = 30
    )
    
    try {
        $query = "SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State] FROM WorkItems WHERE [System.Title] CONTAINS '$SearchPattern' AND [System.AreaPath] UNDER '$AreaPath' AND [System.State] <> 'Closed' ORDER BY [System.Id]"
        
        $wiqlBody = @{ query = $query } | ConvertTo-Json -Compress
        $url = "https://dev.azure.com/$Organization/$Project/_apis/wit/wiql?api-version=7.0"
        
        $wiqlResponse = Invoke-AzureDevOpsRestAPI -Url $url -Method "POST" -Body $wiqlBody
        
        if ($wiqlResponse -and $wiqlResponse.workItems) {
            # Get work item details
            $workItems = @()
            $ids = ($wiqlResponse.workItems.id -join ',')
            if ($ids) {
                $workItemsUrl = "https://dev.azure.com/$Organization/$Project/_apis/wit/workitems?ids=$ids&fields=System.Id,System.Title,System.State,System.AssignedTo,System.CreatedDate,System.ChangedDate,System.WorkItemType&api-version=7.0"
                $workItemsResponse = Invoke-AzureDevOpsRestAPI -Url $workItemsUrl
                if ($workItemsResponse -and $workItemsResponse.value) {
                    $workItems = $workItemsResponse.value
                }
            }
            return $workItems
        }
        
        return @()
        
    } catch {
    Write-Warning "Search-SecurityWorkItems failed: $($_.Exception.Message)"
        return @()
    }
}

function Get-WorkItemDetails {
    param(
        [int]$WorkItemId,
        [string]$Organization,
        [string]$Project,
        [switch]$ExpandRelations
    )
    
    try {
        $url = "https://dev.azure.com/$Organization/$Project/_apis/wit/workitems/$WorkItemId"
        $params = @('api-version=7.0')
        
        if ($ExpandRelations) {
            $params += '$expand=relations'
        }
        
        $url += "?" + ($params -join '&')
        
        $result = Invoke-AzureDevOpsRestAPI -Url $url
        return $result
        
    } catch {
        Write-Warning "Get-WorkItemDetails failed for ID $WorkItemId`: $($_.Exception.Message)"
        return $null
    }
}

function Test-WorkItemExists {
    param(
        [int]$WorkItemId,
        [string]$Organization,
        [string]$Project
    )
    
    $workItem = Get-WorkItemDetails -WorkItemId $WorkItemId -Organization $Organization -Project $Project
    return $workItem -ne $null
}

function Get-WorkItemType {
    param([object]$WorkItem)
    
    if (-not $WorkItem -or -not $WorkItem.fields) {
        return $null
    }
    
    return $WorkItem.fields.'System.WorkItemType'
}

function Format-WorkItemForResponse {
    param([object]$WorkItem)
    
    if (-not $WorkItem) {
        return $null
    }
    
    return @{
        id = $WorkItem.id
        title = $WorkItem.fields.'System.Title'
        type = $WorkItem.fields.'System.WorkItemType'
        state = $WorkItem.fields.'System.State'
        area_path = $WorkItem.fields.'System.AreaPath'
        iteration_path = $WorkItem.fields.'System.IterationPath'
        assigned_to = if ($WorkItem.fields.'System.AssignedTo') { $WorkItem.fields.'System.AssignedTo'.displayName } else { $null }
        url = "https://dev.azure.com/$($WorkItem.project.name)/_workitems/edit/$($WorkItem.id)"
        human_friendly_url = "https://dev.azure.com/$($WorkItem.project.name)/_workitems/edit/$($WorkItem.id)"
        created_date = $WorkItem.fields.'System.CreatedDate'
        changed_date = $WorkItem.fields.'System.ChangedDate'
    }
}

function Invoke-AzureCLIWithTimeout {
    param(
        [string[]]$Arguments,
        [int]$TimeoutSeconds = 30
    )
    
    try {
        $job = Start-Job -ScriptBlock {
            param($args)
            & az @args 2>&1
        } -ArgumentList (,$Arguments)
        
        $completed = Wait-Job $job -Timeout $TimeoutSeconds
        
        if ($completed) {
            $result = Receive-Job $job
            $exitCode = if ($job.State -eq 'Completed') { 0 } else { 1 }
            Remove-Job $job
            return @{ Success = $exitCode -eq 0; Output = $result; ExitCode = $exitCode }
        } else {
            Stop-Job $job
            Remove-Job $job
            return @{ Success = $false; Output = "Command timed out after $TimeoutSeconds seconds"; ExitCode = -1 }
        }
        
    } catch {
        return @{ Success = $false; Output = "Exception: $($_.Exception.Message)"; ExitCode = -1 }
    }
}

# Export functions for module usage (only when loaded as module)
if ($MyInvocation.MyCommand.CommandType -eq 'ExternalScript') {
    # Functions are automatically available when dot-sourced
} else {
    Export-ModuleMember -Function @(
        'Test-AzureCLI',
        'Ensure-AzureDevOpsExtension', 
    'Search-SecurityWorkItems',
        'Get-WorkItemDetails',
        'Test-WorkItemExists',
        'Get-WorkItemType',
        'Format-WorkItemForResponse',
        'Invoke-AzureCLIWithTimeout'
    )
}