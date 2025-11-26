# Script to rename all wit-* tool references to verb-first naming convention
# This script updates code, docs, and tests to use current tool names

$mappings = @{
    "wit-create-item" = "create-workitem"
    "wit-create-new-item" = "create-workitem"
    "wit-assign-copilot" = "assign-copilot"
    "wit-get-context" = "get-context"
    "wit-get-context-batch" = "get-context-bulk"
    "wit-get-context-packages" = "get-context-bulk"
    "wit-get-context-packages-by-query-handle" = "get-context-bulk"
    "wit-extract-security-links" = "extract-security-links"
    "wit-extract" = "extract-security-links"
    "wit-query-wiql" = "query-wiql"
    "wit-wiql-query" = "query-wiql"
    "wit-get-work-items-by-query-wiql" = "query-wiql"
    "wit-generate-wiql-query" = "query-wiql"
    "wit-ai-generate-wiql" = "query-wiql"
    "wit-query-odata" = "query-odata"
    "wit-ai-generate-odata" = "query-odata"
    "wit-generate-odata-query" = "query-odata"
    "wit-unified-bulk-operations" = "execute-bulk-operations"
    "wit-unified-bulk-operations-by-query-handle" = "execute-bulk-operations"
    "wit-bulk-update" = "execute-bulk-operations"
    "wit-bulk-comment-by-query-handle" = "execute-bulk-operations"
    "wit-bulk-update-by-query-handle" = "execute-bulk-operations"
    "wit-bulk-assign-by-query-handle" = "execute-bulk-operations"
    "wit-bulk-remove" = "execute-bulk-operations"
    "wit-bulk-remove-by-query-handle" = "execute-bulk-operations"
    "wit-bulk-transition-state-by-query-handle" = "execute-bulk-operations"
    "wit-bulk-move-to-iteration-by-query-handle" = "execute-bulk-operations"
    "wit-bulk-enhance-descriptions-by-query-handle" = "execute-bulk-operations"
    "wit-link-work-items" = "link-workitems"
    "wit-link-work-items-by-query-handles" = "link-workitems"
    "wit-bulk-undo-by-query-handle" = "undo-bulk"
    "wit-forensic-undo" = "undo-forensic"
    "wit-analyze-workload" = "analyze-workload"
    "wit-discover-tools" = "discover-tools"
    "wit-ai-intelligence" = "analyze-query-handle"
    "wit-analyze-query-handle" = "analyze-query-handle"
    "wit-analyze-by-query-handle" = "analyze-bulk"
    "wit-hierarchy-validator" = "analyze-bulk"
    "wit-ai-assignment" = "analyze-bulk"
    "wit-ai-assignment-analyzer" = "analyze-bulk"
    "wit-find-parent-item-intelligent" = "analyze-bulk"
    "wit-list-handles" = "list-handles"
    "wit-inspect-handle" = "inspect-handle"
    "wit-query-handle-info" = "inspect-handle"
    "wit-get-config" = "get-config"
    "wit-get-configuration" = "get-config"
    "wit-get-team-members" = "get-team-members"
    "wit-get-prompts" = "get-prompts"
    "wit-list-agents" = "list-agents"
    "wit-get-pr-diff" = "get-pr-diff"
    "wit-get-pr-comments" = "get-pr-comments"
}

# Patterns to exclude from replacement
$excludePatterns = @(
    "*.ps1",  # This script itself
    "*.log",
    "*.jsonl",
    ".git/*",
    "node_modules/*",
    "coverage/*",
    "dist/*",
    "build/*"
)

function Update-ToolReferences {
    param (
        [string]$rootPath,
        [hashtable]$toolMappings,
        [string[]]$fileExtensions = @("*.ts", "*.md", "*.json", "*.yaml", "*.yml")
    )
    
    $filesUpdated = 0
    $replacementsMade = 0
    
    Write-Host "Scanning for tool references in: $rootPath" -ForegroundColor Cyan
    
    foreach ($ext in $fileExtensions) {
        $files = Get-ChildItem -Path $rootPath -Filter $ext -Recurse -File | 
            Where-Object { 
                $relativePath = $_.FullName.Replace($rootPath, "")
                $exclude = $false
                foreach ($pattern in $excludePatterns) {
                    if ($relativePath -like "*$pattern*") {
                        $exclude = $true
                        break
                    }
                }
                -not $exclude
            }
        
        foreach ($file in $files) {
            $content = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
            if (-not $content) { continue }
            
            $originalContent = $content
            $fileChanged = $false
            
            foreach ($oldName in $toolMappings.Keys) {
                $newName = $toolMappings[$oldName]
                
                # Skip if new name is same as old name
                if ($oldName -eq $newName) { continue }
                
                # Pattern matching for various contexts
                $patterns = @(
                    "'$oldName'",     # Single quotes
                    """$oldName""",   # Double quotes
                    "``$oldName``",   # Backticks (markdown)
                    "$oldName ",      # Space after
                    "$oldName)",      # Closing paren
                    "$oldName,",      # Comma
                    "$oldName;",      # Semicolon
                    "$oldName\n",     # Newline
                    "$oldName\r",     # Carriage return
                    "($oldName",      # Opening paren
                    " $oldName "      # Surrounded by spaces
                )
                
                foreach ($pattern in $patterns) {
                    $replacementPattern = $pattern -replace [regex]::Escape($oldName), $newName
                    if ($content -like "*$pattern*") {
                        $content = $content -replace [regex]::Escape($pattern), $replacementPattern
                        $fileChanged = $true
                    }
                }
            }
            
            if ($fileChanged -and $content -ne $originalContent) {
                Set-Content -Path $file.FullName -Value $content -NoNewline
                $filesUpdated++
                $replacementsInFile = ($originalContent.Length - $content.Length) / 10  # Rough estimate
                $replacementsMade += [Math]::Max(1, $replacementsInFile)
                Write-Host "  Updated: $($file.FullName.Replace($rootPath, '.'))" -ForegroundColor Green
            }
        }
    }
    
    Write-Host "`nSummary:" -ForegroundColor Yellow
    Write-Host "  Files updated: $filesUpdated" -ForegroundColor White
    Write-Host "  Approximate replacements: $replacementsMade" -ForegroundColor White
}

# Run the update
$rootPath = Split-Path -Parent $PSCommandPath
Update-ToolReferences -rootPath $rootPath -toolMappings $mappings

Write-Host "`nDone! Please review the changes and run tests to verify." -ForegroundColor Cyan
Write-Host "To see changes: git diff" -ForegroundColor Gray
