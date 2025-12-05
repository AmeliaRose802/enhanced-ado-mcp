#!/usr/bin/env pwsh
# Run hybridTransport tests specifically

Set-Location -Path "c:\Users\ameliapayne\ADO-Work-Item-MSP\mcp_server"

Write-Host "Running hybridTransport.test.ts..." -ForegroundColor Cyan
npm test -- hybridTransport.test.ts --verbose

Write-Host "`nTest run complete." -ForegroundColor Green
