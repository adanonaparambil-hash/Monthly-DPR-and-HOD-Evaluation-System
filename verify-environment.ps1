# Environment Verification Script
# This script helps verify which environment configuration is being used

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Environment Configuration Check      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check environment files
Write-Host "Development Environment (environment.ts):" -ForegroundColor Yellow
Get-Content "src\environments\environment.ts" | Select-String "apiBaseUrl"
Write-Host ""

Write-Host "Production Environment (environment.prod.ts):" -ForegroundColor Yellow
Get-Content "src\environments\environment.prod.ts" | Select-String "apiBaseUrl"
Write-Host ""

# Check if build exists
if (Test-Path "dist\TimeSheet-UI\browser") {
    Write-Host "Build Status:" -ForegroundColor Yellow
    Write-Host "✓ Build folder exists" -ForegroundColor Green
    
    # Check main files
    $mainFiles = Get-ChildItem "dist\TimeSheet-UI\browser" -Filter "main*.js" | Select-Object -First 1
    if ($mainFiles) {
        Write-Host "✓ Main bundle found: $($mainFiles.Name)" -ForegroundColor Green
        
        # Try to detect which API URL is in the bundle
        $content = Get-Content $mainFiles.FullName -Raw
        if ($content -match "172\.16\.1\.53") {
            Write-Host "⚠ WARNING: Development API URL found in build!" -ForegroundColor Red
            Write-Host "  The build is using DEVELOPMENT environment" -ForegroundColor Red
            Write-Host "  Please rebuild with: ng build --configuration production" -ForegroundColor Yellow
        } elseif ($content -match "adraklive\.com") {
            Write-Host "✓ Production API URL found in build" -ForegroundColor Green
            Write-Host "  The build is correctly using PRODUCTION environment" -ForegroundColor Green
        } else {
            Write-Host "? Could not detect API URL in bundle" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "Build Status:" -ForegroundColor Yellow
    Write-Host "✗ No build found" -ForegroundColor Red
    Write-Host "  Run: ng build --configuration production" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
