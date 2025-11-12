# Remove includeFields from all resource files
Get-ChildItem -Path 'mcp_server/resources/*.md' -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'includeFields') {
        # Remove lines with includeFields (including the line itself)
        $newContent = $content -replace '(?m)^\s*[""'']?includeFields[""'']?\s*:\s*\[.*?\],?\s*$\r?\n', ''
        # Clean up double commas that may result
        $newContent = $newContent -replace ',\s*,', ','
        # Clean up trailing commas before closing braces
        $newContent = $newContent -replace ',(\s*[\]}])', '$1'
        Set-Content -Path $_.FullName -Value $newContent -NoNewline
        Write-Host "Updated: $($_.Name)"
    }
}
