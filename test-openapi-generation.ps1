#!/usr/bin/env pwsh
# Test script to verify OpenAPI generation works

Write-Host "🧪 Testing OpenAPI Generation..." -ForegroundColor Cyan
Write-Host ""

# Change to mcp_server directory
Set-Location "mcp_server"

# Run the generation script
Write-Host "▶️  Running npm run generate-openapi..." -ForegroundColor Yellow
npm run generate-openapi

# Check if files were created
Write-Host ""
Write-Host "🔍 Verifying generated files..." -ForegroundColor Cyan

$openapiPath = "../docs/api/openapi.json"
$indexPath = "../docs/api/schemas/index.json"

if (Test-Path $openapiPath) {
    Write-Host "✅ Found: $openapiPath" -ForegroundColor Green
    $size = (Get-Item $openapiPath).Length
    Write-Host "   Size: $size bytes" -ForegroundColor Gray
} else {
    Write-Host "❌ Missing: $openapiPath" -ForegroundColor Red
    exit 1
}

if (Test-Path $indexPath) {
    Write-Host "✅ Found: $indexPath" -ForegroundColor Green
    $content = Get-Content $indexPath | ConvertFrom-Json
    Write-Host "   Schemas: $($content.schemas.Count)" -ForegroundColor Gray
} else {
    Write-Host "❌ Missing: $indexPath" -ForegroundColor Red
    exit 1
}

# Check schemas directory
$schemasDir = "../docs/api/schemas"
if (Test-Path $schemasDir) {
    $schemaCount = (Get-ChildItem $schemasDir -Filter "*.json").Count
    Write-Host "✅ Found: $schemasDir" -ForegroundColor Green
    Write-Host "   Files: $schemaCount" -ForegroundColor Gray
} else {
    Write-Host "❌ Missing: $schemasDir" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 All checks passed!" -ForegroundColor Green

# Return to project root
Set-Location ..
