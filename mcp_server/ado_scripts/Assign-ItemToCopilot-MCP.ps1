# Assign-ItemToCopilot-MCP.ps1
param(
    [Parameter(Mandatory=$true, Position=0)][int]$WorkItemId,
    [Parameter(Mandatory=$true)][string]$Organization,
    [Parameter(Mandatory=$true)][string]$Project,
    [Parameter(Mandatory=$true)][string]$Repository,
    [string]$Branch = "main",
    [Parameter(Mandatory=$true)][string]$GitHubCopilotGuid
)

. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) "modules\AzureDevOpsHelper-MCP.ps1")

Invoke-MCPScript {
    # Get repository information - try by name first, then list all if that fails
    # Note: We redirect stderr to $null to avoid contaminating JSON output
    $repoInfo = az repos show --repository $Repository --org "https://dev.azure.com/$Organization" --project $Project --output json 2>$null
    
    if ($LASTEXITCODE -ne 0) {
        # Repository not found by exact name - try to find it in the list
        $allRepos = az repos list --org "https://dev.azure.com/$Organization" --project $Project --output json 2>$null
        if ($LASTEXITCODE -eq 0 -and $allRepos) {
            try {
                $reposList = $allRepos | ConvertFrom-Json
                $repo = $reposList | Where-Object { $_.name -eq $Repository -or $_.id -eq $Repository }
                
                if (-not $repo) {
                    # Try case-insensitive match
                    $repo = $reposList | Where-Object { $_.name -ieq $Repository }
                }
                
                if ($repo) {
                    $repositoryId = $repo.id
                    $projectId = $repo.project.id
                } else {
                    $availableRepos = ($reposList | Select-Object -ExpandProperty name) -join ", "
                    throw "Repository '$Repository' not found. Available repositories: $availableRepos"
                }
            } catch {
                throw "Failed to parse repository list: $($_.Exception.Message)"
            }
        } else {
            throw "Failed to retrieve repository list"
        }
    } else {
        try {
            $repo = $repoInfo | ConvertFrom-Json
            $repositoryId = $repo.id
            $projectId = $repo.project.id
        } catch {
            throw "Failed to parse repository information: $($_.Exception.Message). Raw output: $repoInfo"
        }
    }
    
    # Create branch artifact link (Code - Branch type)
    $vstfsUrl = "vstfs:///Git/Ref/$projectId%2F$repositoryId%2FGB$Branch"
    $patchJson = @"
[
  {
    "op": "add",
    "path": "/relations/-",
    "value": {
      "rel": "ArtifactLink",
      "url": "$vstfsUrl",
      "attributes": {
        "name": "Branch",
        "comment": "GitHub Copilot branch link: $Repository/$Branch"
      }
    }
  }
]
"@
    
    $warnings = @()
    $branchLinkCreated = $false
    
    try {
        # Use REST API to add the branch artifact link
        $apiUrl = "https://dev.azure.com/$Organization/$Project/_apis/wit/workitems/$WorkItemId" + "?api-version=7.0"
        $tempFile = [System.IO.Path]::GetTempFileName()
        $patchJson | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline
        
        $patchResult = az rest --method PATCH --url $apiUrl --headers "Content-Type=application/json-patch+json" --body "@$tempFile" --resource "499b84ac-1321-427f-aa17-267ca6975798" --output json 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $branchLinkCreated = $true
        } else {
            if ($patchResult -like "*RelationAlreadyExistsException*" -or $patchResult -like "*already exists*") {
                $warnings += "Branch artifact link already exists"
                $branchLinkCreated = $true
            } else {
                $warnings += "Could not create branch artifact link: $patchResult"
            }
        }
        
        # Clean up temp file
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        }
    } catch {
        $warnings += "Could not create branch artifact link: $($_.Exception.Message)"
    }
    
    # Assign to GitHub Copilot
    $assignResult = az boards work-item update --id $WorkItemId --assigned-to $GitHubCopilotGuid --org "https://dev.azure.com/$Organization" --output json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Failed to assign work item: $assignResult" }
    
    New-MCPResponse -Success $true -Warnings $warnings -Data @{
        work_item_id = $WorkItemId
        assigned_to = "GitHub Copilot"
        repository_linked = $branchLinkCreated
        human_friendly_url = "https://dev.azure.com/$Organization/$Project/_workitems/edit/$WorkItemId"
    }
}