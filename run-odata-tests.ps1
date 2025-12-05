# Run OData Query Handler Tests with Coverage
# This script runs the comprehensive OData query handler tests and reports coverage

Write-Host "Running OData Query Handler Tests..." -ForegroundColor Cyan
Write-Host ""

# Change to mcp_server directory
Set-Location -Path "$PSScriptRoot\mcp_server"

# Run tests for the specific handler file with coverage
$env:NODE_OPTIONS = "--max-old-space-size=4096"

Write-Host "Executing Jest for odata-query.handler.test.ts..." -ForegroundColor Yellow
npm test -- --coverage --collectCoverageFrom='src/services/handlers/query/odata-query.handler.ts' --testPathPattern='odata-query.handler.test.ts' --verbose

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Tests passed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Coverage report generated in mcp_server/coverage/" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Tests failed with exit code $LASTEXITCODE" -ForegroundColor Red
    Write-Host ""
}

# Return to original directory
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
