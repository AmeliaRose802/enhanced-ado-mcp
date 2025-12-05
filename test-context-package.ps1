#!/usr/bin/env pwsh
# Test script for get-work-item-context-package handler tests

Write-Host "Running get-work-item-context-package handler tests..." -ForegroundColor Cyan

Set-Location "$PSScriptRoot\mcp_server"

# Run the specific test file
npm test -- test/unit/handlers/get-work-item-context-package.handler.test.ts

$exitCode = $LASTEXITCODE
Set-Location $PSScriptRoot

if ($exitCode -ne 0) {
    Write-Host "`nTests failed with exit code $exitCode" -ForegroundColor Red
    exit $exitCode
} else {
    Write-Host "`nAll tests passed!" -ForegroundColor Green
    exit 0
}
