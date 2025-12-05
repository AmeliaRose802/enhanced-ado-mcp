#!/usr/bin/env pwsh
# Test script for export-work-items handler tests

Write-Host "Running Export Work Items Handler Tests..." -ForegroundColor Cyan
Write-Host ""

Set-Location "mcp_server"

# Run the specific test file
npm test -- export-work-items.handler.test.ts

Set-Location ".."

Write-Host ""
Write-Host "Test run complete!" -ForegroundColor Green
