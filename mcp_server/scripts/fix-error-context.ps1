#!/usr/bin/env pwsh

# Fix TypeScript errors where unknown error is passed to logger
# This script adds 'errorToContext(error)' wrapper around error arguments

$srcDir = Join-Path $PSScriptRoot ".." "src"

Write-Host "Fixing TypeScript error context issues in $srcDir..." -ForegroundColor Cyan

# Get all TypeScript files in src directory
$files = Get-ChildItem -Path $srcDir -Filter "*.ts" -Recurse

$filesModified = 0
$totalReplacements = 0

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $originalContent = $content
    
    # Skip if file already imports errorToContext
    $hasImport = $content -match 'import\s+\{[^}]*errorToContext[^}]*\}\s+from\s+[''"].*logger'
    
    # Pattern 1: logger.error('message', error)
    # Pattern 2: logger.warn('message', error)
    # Pattern 3: logger.error(`message`, error)
    # Pattern 4: logger.warn(`message`, error)
    
    $patterns = @(
        @{
            Regex = 'logger\.(error|warn)\(([^,]+),\s*error\s*\)'
            Replacement = 'logger.$1($2, errorToContext(error))'
        }
    )
    
    $fileModified = $false
    $replacements = 0
    
    foreach ($pattern in $patterns) {
        $matches = [regex]::Matches($content, $pattern.Regex)
        if ($matches.Count -gt 0) {
            Write-Host "  Found $($matches.Count) matches in $($file.Name)" -ForegroundColor Yellow
            $content = $content -replace $pattern.Regex, $pattern.Replacement
            $replacements += $matches.Count
            $fileModified = $true
        }
    }
    
    # If we made changes and don't have the import, add it
    if ($fileModified -and -not $hasImport) {
        # Find existing logger import
        if ($content -match 'import\s+\{\s*logger\s*\}\s+from\s+([''"])(.+?logger\.js)\1') {
            $quote = $matches[1]
            $importPath = $matches[2]
            $oldImport = "import { logger } from $quote$importPath$quote"
            $newImport = "import { logger, errorToContext } from $quote$importPath$quote"
            $content = $content -replace [regex]::Escape($oldImport), $newImport
            Write-Host "  Added errorToContext import to $($file.Name)" -ForegroundColor Green
        }
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $filesModified++
        $totalReplacements += $replacements
        Write-Host "  Modified $($file.Name) ($replacements replacements)" -ForegroundColor Green
    }
}

Write-Host "`nSummary:" -ForegroundColor Cyan
Write-Host "  Files modified: $filesModified" -ForegroundColor Green
Write-Host "  Total replacements: $totalReplacements" -ForegroundColor Green
Write-Host "`nDone! Run 'npm run build' to verify the fixes." -ForegroundColor Cyan
