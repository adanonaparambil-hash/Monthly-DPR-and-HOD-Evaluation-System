# Production Deployment Script for TimeSheet-UI (Root Deployment)
# This script builds and prepares the application for IIS deployment at domain root

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TimeSheet-UI Production Deployment (Root)" -ForegroundColor Cyan
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
Write-Host "Step 2: Building for production (Root deployment)..." -ForegroundColor Yellow
ng build --configuration production
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
    
    # Verify it's configured for root deployment
    $webConfigContent = Get-Content $webConfigPath -Raw
    if ($webConfigContent -match 'url="/index\.html"') {
        Write-Host "✓ web.config configured for root deployment" -ForegroundColor Green
    } else {
        Write-Host "⚠ web.config may not be configured correctly" -ForegroundColor Yellow
    }
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
        $fileSize = (Get-Item $filePath).Length
        Write-Host "✓ $file found ($fileSize bytes)" -ForegroundColor Green
    } else {
        Write-Host "✗ $file NOT found!" -ForegroundColor Red
        $allFilesPresent = $false
    }
}
Write-Host ""

# Step 5: Check base href in index.html
Write-Host "Step 5: Verifying base href..." -ForegroundColor Yellow
$indexPath = Join-Path $buildPath "index.html"
$indexContent = Get-Content $indexPath -Raw
if ($indexContent -match '<base href="/"') {
    Write-Host "✓ Base href is set to root (/)" -ForegroundColor Green
} else {
    Write-Host "⚠ Base href may not be set correctly" -ForegroundColor Yellow
}
Write-Host ""

# Step 6: Display deployment information
Write-Host "Step 6: Deployment Information" -ForegroundColor Yellow
Write-Host "Build output location: $buildPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "Key files:" -ForegroundColor Cyan
Get-ChildItem $buildPath -File | Where-Object { $_.Name -match '\.(html|config)$' } | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
Write-Host ""

# Step 7: Create deployment package
Write-Host "Step 7: Creating deployment package..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$zipFileName = "TimeSheet-UI_Root_$timestamp.zip"
$zipPath = "dist\$zipFileName"

try {
    Compress-Archive -Path "$buildPath\*" -DestinationPath $zipPath -Force
    $zipSize = (Get-Item $zipPath).Length / 1MB
    Write-Host "✓ Deployment package created: $zipPath ($([math]::Round($zipSize, 2)) MB)" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to create deployment package: $_" -ForegroundColor Red
}
Write-Host ""

# Step 8: Deployment instructions
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Instructions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: This build is for ROOT deployment" -ForegroundColor Red
Write-Host "URL will be: https://adraklive.com/my-task" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Copy all files from:" -ForegroundColor Yellow
Write-Host "   $buildPath" -ForegroundColor White
Write-Host ""
Write-Host "2. To your IIS root folder:" -ForegroundColor Yellow
Write-Host "   C:\inetpub\wwwroot\" -ForegroundColor White
Write-Host "   OR" -ForegroundColor Gray
Write-Host "   Your domain root folder" -ForegroundColor White
Write-Host ""
Write-Host "3. Ensure URL Rewrite Module is installed on IIS" -ForegroundColor Yellow
Write-Host "   Download: https://www.iis.net/downloads/microsoft/url-rewrite" -ForegroundColor White
Write-Host ""
Write-Host "4. Verify Application Pool settings:" -ForegroundColor Yellow
Write-Host "   - .NET CLR Version: No Managed Code" -ForegroundColor White
Write-Host "   - Managed Pipeline Mode: Integrated" -ForegroundColor White
Write-Host ""
Write-Host "5. Test the deployment:" -ForegroundColor Yellow
Write-Host "   - Navigate to: https://adraklive.com/" -ForegroundColor White
Write-Host "   - Test route: https://adraklive.com/my-task" -ForegroundColor White
Write-Host "   - Test route: https://adraklive.com/dpr-approval" -ForegroundColor White
Write-Host "   - Test with query: https://adraklive.com/my-task?dprMode=true" -ForegroundColor White
Write-Host ""
Write-Host "6. Verify web.config is working:" -ForegroundColor Yellow
Write-Host "   - Refresh browser on any route (should not 404)" -ForegroundColor White
Write-Host "   - Direct navigation to routes should work" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment preparation complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Package ready: $zipPath" -ForegroundColor Cyan
