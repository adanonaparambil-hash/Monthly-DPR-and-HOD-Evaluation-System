# Build Verification Script
# Verifies that the build is correct before deployment

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Build Verification                    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$buildPath = "dist\TimeSheet-UI\browser"
$allGood = $true

# Check 1: Build folder exists
Write-Host "Check 1: Build folder exists..." -ForegroundColor Yellow
if (Test-Path $buildPath) {
    Write-Host "✓ Build folder found" -ForegroundColor Green
} else {
    Write-Host "✗ Build folder not found" -ForegroundColor Red
    Write-Host "  Run: ng build --configuration production" -ForegroundColor Yellow
    $allGood = $false
}
Write-Host ""

# Check 2: index.html exists
Write-Host "Check 2: index.html exists..." -ForegroundColor Yellow
if (Test-Path "$buildPath\index.html") {
    Write-Host "✓ index.html found" -ForegroundColor Green
    
    # Check base href
    $indexContent = Get-Content "$buildPath\index.html" -Raw
    if ($indexContent -match '<base href="/AdrakMPRUI/">') {
        Write-Host "✓ Base href is correct: /AdrakMPRUI/" -ForegroundColor Green
    } else {
        Write-Host "✗ Base href is incorrect or missing" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host "✗ index.html not found" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# Check 3: web.config exists
Write-Host "Check 3: web.config exists..." -ForegroundColor Yellow
if (Test-Path "$buildPath\web.config") {
    Write-Host "✓ web.config found" -ForegroundColor Green
    
    # Check rewrite rule
    $webConfigContent = Get-Content "$buildPath\web.config" -Raw
    if ($webConfigContent -match '/AdrakMPRUI/index.html') {
        Write-Host "✓ Rewrite rule is correct" -ForegroundColor Green
    } else {
        Write-Host "✗ Rewrite rule is incorrect" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host "✗ web.config not found" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# Check 4: Background image exists
Write-Host "Check 4: Background image exists..." -ForegroundColor Yellow
if (Test-Path "$buildPath\assets\images\AlAdrakBgImage.jpg") {
    Write-Host "✓ Background image found" -ForegroundColor Green
    $imageSize = (Get-Item "$buildPath\assets\images\AlAdrakBgImage.jpg").Length / 1KB
    Write-Host "  Size: $([math]::Round($imageSize, 2)) KB" -ForegroundColor Gray
} else {
    Write-Host "✗ Background image not found" -ForegroundColor Red
    Write-Host "  Expected: $buildPath\assets\images\AlAdrakBgImage.jpg" -ForegroundColor Yellow
    $allGood = $false
}
Write-Host ""

# Check 5: Other assets
Write-Host "Check 5: Other assets..." -ForegroundColor Yellow
if (Test-Path "$buildPath\assets\images\logo.jpg") {
    Write-Host "✓ Logo image found" -ForegroundColor Green
} else {
    Write-Host "⚠ Logo image not found (may not be critical)" -ForegroundColor Yellow
}
Write-Host ""

# Check 6: JavaScript bundles
Write-Host "Check 6: JavaScript bundles..." -ForegroundColor Yellow
$mainJs = Get-ChildItem "$buildPath" -Filter "main*.js" -ErrorAction SilentlyContinue
if ($mainJs) {
    Write-Host "✓ Main bundle found: $($mainJs.Name)" -ForegroundColor Green
} else {
    Write-Host "✗ Main bundle not found" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# Check 7: Environment check
Write-Host "Check 7: Environment configuration..." -ForegroundColor Yellow
if ($mainJs) {
    $jsContent = Get-Content $mainJs.FullName -Raw
    if ($jsContent -match "adraklive\.com") {
        Write-Host "✓ Production API URL detected" -ForegroundColor Green
    } elseif ($jsContent -match "172\.16\.1\.53") {
        Write-Host "✗ Development API URL detected!" -ForegroundColor Red
        Write-Host "  Build is using DEVELOPMENT environment" -ForegroundColor Red
        $allGood = $false
    } else {
        Write-Host "? Could not detect API URL" -ForegroundColor Yellow
    }
}
Write-Host ""

# Final result
Write-Host "========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "  ✓ All Checks Passed!                 " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Build is ready for deployment!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Upload contents of '$buildPath\' to /AdrakMPRUI/ on server" -ForegroundColor White
    Write-Host "  2. Test: https://adraklive.com/AdrakMPRUI/" -ForegroundColor White
    Write-Host "  3. Test image: https://adraklive.com/AdrakMPRUI/assets/images/AlAdrakBgImage.jpg" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "  ✗ Some Checks Failed                 " -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Please fix the issues above and rebuild:" -ForegroundColor Yellow
    Write-Host "  .\build-production.ps1" -ForegroundColor White
    Write-Host ""
    exit 1
}
