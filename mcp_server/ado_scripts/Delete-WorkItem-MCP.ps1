# Delete-WorkItem-MCP.ps1
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][int]$WorkItemId,
    [Parameter(Mandatory=$true)][string]$Organization,
    [Parameter(Mandatory=$true)][string]$Project,
    [switch]$HardDelete
)

. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) "modules\AzureDevOpsHelper-MCP.ps1")

Invoke-MCPScript {
    if (-not (Test-AzureCLI)) { throw "Azure CLI authentication required" }
    if (-not (Ensure-AzureDevOpsExtension)) { throw "Azure DevOps CLI extension missing" }

    $args = @('boards','work-item','delete','--id', $WorkItemId,'--org',"https://dev.azure.com/$Organization", '--yes')
    if ($Project) { $args += '--project'; $args += $Project }
    if ($HardDelete) { $args += '--destroy' }
    $args += '--output'; $args += 'json'

    $output = & az @args 2>&1 | Out-String
    $exit = $LASTEXITCODE

    if ($exit -ne 0) {
        return (New-MCPResponse -Success $false -Errors @("Azure CLI delete failed", $output.Trim()))
    }

    $data = [PSCustomObject]@{
        work_item_id = $WorkItemId
        deleted = $true
        hard_delete = [bool]$HardDelete
    }
    return (New-MCPResponse -Success $true -Data $data)
}