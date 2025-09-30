# Extract-Security ScannerInstructionLinks-MCP.ps1
[CmdletBinding()]
param(
    [Parameter(Mandatory)][int]$WorkItemId,
    [Parameter(Mandatory=$true)][string]$Organization,
    [Parameter(Mandatory=$true)][string]$Project,
    [ValidateSet("BinSkim", "CodeQL", "CredScan", "General", "All")][string]$ScanType = "All",
    [switch]$IncludeWorkItemDetails,
    [switch]$ExtractFromComments,
    [switch]$DryRun
)

. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) "modules\AzureDevOpsHelper-MCP.ps1")

function Extract-InstructionLinks {
    param([string]$Content, [string]$ScanType = "All")
    
    if ([string]::IsNullOrWhiteSpace($Content)) { return @() }
    
    $links = @()
    
    # Extract URLs
    $urlPattern = '(?i)https?://[^\s<>"]+'
    $matches = [regex]::Matches($Content, $urlPattern)
    foreach ($match in $matches) {
        $url = $match.Value.Trim() -replace '[,.;:)]$', ''
        if ($url -and $url -notlike "*example.com*") {
            $type = switch -Regex ($url) {
                'docs\.microsoft\.com|learn\.microsoft\.com' { "Microsoft Docs" }
                'aka\.ms' { "Microsoft Link" }
                'github\.com.*security' { "GitHub Security" }
                'security|remediation|mitigation' { "Security Guide" }
                'binskim|codeql|credscan' { "Scanner Docs" }
                default { "General Link" }
            }
            $links += @{ Url = $url; Type = $type }
        }
    }
    
    return $links | Sort-Object Type -Unique
}

Invoke-MCPScript {
    $workItem = Get-WorkItemDetails -WorkItemId $WorkItemId -Organization $Organization -Project $Project
    if (-not $workItem) { throw "Work item $WorkItemId not found" }
    
    $allLinks = @()
    $fields = @('System.Description', 'Microsoft.VSTS.TCM.ReproSteps', 'Microsoft.VSTS.Common.AcceptanceCriteria')
    
    foreach ($field in $fields) {
        if ($workItem.fields.PSObject.Properties[$field] -and $workItem.fields.$field) {
            $links = Extract-InstructionLinks -Content $workItem.fields.$field -ScanType $ScanType
            $allLinks += $links
        }
    }
    
    $uniqueLinks = $allLinks | Sort-Object Url -Unique
    
    $result = @{
        work_item_id = $WorkItemId
        title = $workItem.fields.'System.Title'
        instruction_links = $uniqueLinks
        links_found = $uniqueLinks.Count
        work_item_url = "https://dev.azure.com/$Organization/$Project/_workitems/edit/$WorkItemId"
    }
    
    if ($IncludeWorkItemDetails) {
        $result.work_item_details = @{
            assigned_to = $workItem.fields.'System.AssignedTo'.displayName
            state = $workItem.fields.'System.State'
            type = $workItem.fields.'System.WorkItemType'
        }
    }
    
    New-MCPResponse -Success $true -Data $result
}

# (Main execution already handled by Invoke-MCPScript above)
