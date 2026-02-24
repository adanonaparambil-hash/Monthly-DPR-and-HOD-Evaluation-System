# Quick Rebuild and Verification Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Quick Rebuild and Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Clean
Write-Host "Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
}
Write-Host "✓ Cleaned" -ForegroundColor Green
Write-Host ""

# Build
Write-Host "Building for production..." -ForegroundColor Yellow
ng build --configuration production

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Build successful" -ForegroundColor Green
Write-Host ""

# Check files
$buildPath = "dist\TimeSheet-UI\browser"
Write-Host "Checking build output..." -ForegroundColor Yellow

# Check index.html
$indexPath = Join-Path $buildPath "index.html"
if (Test-Path $indexPath) {
    $indexContent = Get-Content $indexPath -Raw
    if ($indexContent -match '<base href="([^"]+)"') {
        $baseHref = $matches[1]
        Write-Host "✓ index.html found" -ForegroundColor Green
        Write-Host "  Base href: $baseHref" -ForegroundColor Cyan
    }
} else {
    Write-Host "✗ index.html NOT found!" -ForegroundColor Red
}

# Check web.config
$webConfigPath = Join-Path $buildPath "web.config"
if (Test-Path $webConfigPath) {
    $webConfigContent = Get-Content $webConfigPath -Raw
    if ($webConfigContent -match 'url="([^"]+)"') {
        $rewriteUrl = $matches[1]
        Write-Host "✓ web.config found" -ForegroundColor Green
        Write-Host "  Rewrite URL: $rewriteUrl" -ForegroundColor Cyan
    }
} else {
    Write-Host "✗ web.config NOT found!" -ForegroundColor Red
}

# Check main JS files
$jsFiles = Get-ChildItem $buildPath -Filter "main*.js"
if ($jsFiles.Count -gt 0) {
    Write-Host "✓ JavaScript files found ($($jsFiles.Count) files)" -ForegroundColor Green
} else {
    Write-Host "✗ No JavaScript files found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Build output ready at:" -ForegroundColor Yellow
Write-Host $buildPath -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Copy all files from above path to your IIS folder" -ForegroundColor White
Write-Host "2. Run: iisreset" -ForegroundColor White
Write-Host "3. Clear browser cache (Ctrl+Shift+Delete)" -ForegroundColor White
Write-Host "4. Test your application" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
