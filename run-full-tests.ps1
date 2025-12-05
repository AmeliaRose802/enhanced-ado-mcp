# Run full test suite and capture detailed output
$ErrorActionPreference = "Continue"
Set-Location -Path "$PSScriptRoot\mcp_server"

Write-Host "===== Running Full Test Suite =====" -ForegroundColor Cyan
Write-Host "Working Directory: $(Get-Location)" -ForegroundColor Yellow
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
Write-Host ""

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "WARNING: node_modules not found. Running npm install..." -ForegroundColor Yellow
    npm install
}

# Check if OpenAPI spec exists (pretest requirement)
$openapiPath = "../docs/api/openapi.json"
if (-not (Test-Path $openapiPath)) {
    Write-Host "WARNING: OpenAPI spec not found. Running generate-openapi..." -ForegroundColor Yellow
    npm run generate-openapi
}

Write-Host ""
Write-Host "Starting test execution..." -ForegroundColor Green
Write-Host ""

# Run npm test and capture all output
$output = npm test --verbose 2>&1 | Tee-Object -FilePath "../test-output.log"

Write-Host ""
Write-Host "===== Test run complete. Output saved to test-output.log =====" -ForegroundColor Cyan
Write-Host ""

# Try to extract summary information
$outputText = Get-Content "../test-output.log" -Raw
if ($outputText -match "Test Suites:.*?(\d+) passed.*?(\d+) total") {
    Write-Host "Quick Summary:" -ForegroundColor Green
    Write-Host $Matches[0]
}
if ($outputText -match "Tests:.*") {
    Write-Host $Matches[0]
}

Write-Host ""
Write-Host "For detailed analysis, check test-output.log" -ForegroundColor Cyan
