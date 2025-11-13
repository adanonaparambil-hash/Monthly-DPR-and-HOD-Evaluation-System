# Production Build Script for Angular App
# This script builds the Angular app for production deployment

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Building Angular App for Production  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Clean previous build
Write-Host "Step 1: Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "✓ Previous build cleaned" -ForegroundColor Green
} else {
    Write-Host "✓ No previous build found" -ForegroundColor Green
}
Write-Host ""

# Build for production
Write-Host "Step 2: Building for production..." -ForegroundColor Yellow
Write-Host "Using configuration: production" -ForegroundColor Gray
Write-Host "Base href: /AdrakMPRUI/" -ForegroundColor Gray
Write-Host "API URL: https://adraklive.com/AdrakMPRAPI" -ForegroundColor Gray
Write-Host ""

ng build --configuration production

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✓ Build Successful!                  " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Build output location:" -ForegroundColor Cyan
    Write-Host "  dist\TimeSheet-UI\browser\" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Upload contents of 'dist\TimeSheet-UI\browser\' to your web server" -ForegroundColor White
    Write-Host "  2. Ensure web.config is included (for IIS)" -ForegroundColor White
    Write-Host "  3. Test the deployment at: https://adraklive.com" -ForegroundColor White
    Write-Host ""
    Write-Host "Important:" -ForegroundColor Yellow
    Write-Host "  - Production API: https://adraklive.com/AdrakMPRAPI/api" -ForegroundColor White
    Write-Host "  - Make sure CORS is enabled on the API server" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ✗ Build Failed!                      " -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check the error messages above and fix any issues." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
