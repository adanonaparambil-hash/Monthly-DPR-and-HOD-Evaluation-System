# Production Deployment Script for TimeSheet-UI
# This script builds and prepares the application for IIS deployment

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TimeSheet-UI Production Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean previous build
Write-Host "Step 1: Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
    Write-Host "✓ Previous build cleaned" -ForegroundColor Green
} else {
    Write-Host "✓ No previous build found" -ForegroundColor Green
}
Write-Host ""

# Step 2: Build for production
Write-Host "Step 2: Building for production..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Build completed successfully" -ForegroundColor Green
Write-Host ""

# Step 3: Verify web.config
Write-Host "Step 3: Verifying web.config..." -ForegroundColor Yellow
$webConfigPath = "dist\TimeSheet-UI\browser\web.config"
if (Test-Path $webConfigPath) {
    Write-Host "✓ web.config found in build output" -ForegroundColor Green
    
    # Display web.config content
    Write-Host ""
    Write-Host "web.config content:" -ForegroundColor Cyan
    Get-Content $webConfigPath | Select-Object -First 20
    Write-Host "..." -ForegroundColor Gray
} else {
    Write-Host "✗ web.config NOT found in build output!" -ForegroundColor Red
    Write-Host "  Copying from public folder..." -ForegroundColor Yellow
    Copy-Item "public\web.config" -Destination $webConfigPath
    Write-Host "✓ web.config copied" -ForegroundColor Green
}
Write-Host ""

# Step 4: Verify critical files
Write-Host "Step 4: Verifying critical files..." -ForegroundColor Yellow
$buildPath = "dist\TimeSheet-UI\browser"
$criticalFiles = @("index.html", "web.config")
$allFilesPresent = $true

foreach ($file in $criticalFiles) {
    $filePath = Join-Path $buildPath $file
    if (Test-Path $filePath) {
        Write-Host "✓ $file found" -ForegroundColor Green
    } else {
        Write-Host "✗ $file NOT found!" -ForegroundColor Red
        $allFilesPresent = $false
    }
}
Write-Host ""

# Step 5: Display deployment information
Write-Host "Step 5: Deployment Information" -ForegroundColor Yellow
Write-Host "Build output location: $buildPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "Files to deploy:" -ForegroundColor Cyan
Get-ChildItem $buildPath | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
Write-Host ""

# Step 6: Create deployment package (optional)
Write-Host "Step 6: Creating deployment package..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$zipFileName = "TimeSheet-UI_$timestamp.zip"
$zipPath = "dist\$zipFileName"

try {
    Compress-Archive -Path "$buildPath\*" -DestinationPath $zipPath -Force
    Write-Host "✓ Deployment package created: $zipPath" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to create deployment package: $_" -ForegroundColor Red
}
Write-Host ""

# Step 7: Deployment instructions
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Instructions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Copy all files from:" -ForegroundColor Yellow
Write-Host "   $buildPath" -ForegroundColor White
Write-Host ""
Write-Host "2. To your IIS application folder:" -ForegroundColor Yellow
Write-Host "   C:\inetpub\wwwroot\AdrakMPRUI\" -ForegroundColor White
Write-Host ""
Write-Host "3. Ensure URL Rewrite Module is installed on IIS" -ForegroundColor Yellow
Write-Host "   Download: https://www.iis.net/downloads/microsoft/url-rewrite" -ForegroundColor White
Write-Host ""
Write-Host "4. Verify Application Pool settings:" -ForegroundColor Yellow
Write-Host "   - .NET CLR Version: No Managed Code" -ForegroundColor White
Write-Host "   - Managed Pipeline Mode: Integrated" -ForegroundColor White
Write-Host ""
Write-Host "5. Test the deployment:" -ForegroundColor Yellow
Write-Host "   - Navigate to: http://yourserver/AdrakMPRUI/" -ForegroundColor White
Write-Host "   - Test route: http://yourserver/AdrakMPRUI/dpr-approval" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment preparation complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
