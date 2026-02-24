# Correct Deployment Guide - Understanding Your Setup

## Your Current Deployment Structure

Based on the URL `https://adraklive.com/my-task?dprMode=true`, your application appears to be deployed in one of these ways:

### Option A: Subdirectory with URL Rewrite
- Physical location: `C:\inetpub\wwwroot\AdrakMPRUI\`
- IIS has URL rewrite rules to make `https://adraklive.com/my-task` work
- Base href should be: `/AdrakMPRUI/`

### Option B: Root with Reverse Proxy
- Physical location: `C:\inetpub\wwwroot\`
- Base href should be: `/`

## IMPORTANT: Configuration Reverted

I've reverted the configuration back to `/AdrakMPRUI/` which is the original setup.

## To Fix the 404 Error - Follow These Steps

### Step 1: Determine Your Actual Deployment Path

On your server, check where the files are actually located:

```powershell
# Check if files are in subdirectory
Test-Path "C:\inetpub\wwwroot\AdrakMPRUI\index.html"

# OR check if files are in root
Test-Path "C:\inetpub\wwwroot\index.html"
```

### Step 2: Build with Correct Configuration

The configuration is now set for `/AdrakMPRUI/` deployment.

```powershell
# Clean build
Remove-Item -Path "dist" -Recurse -Force

# Build for production
ng build --configuration production
```

### Step 3: Deploy Files

Copy ALL files from `dist\TimeSheet-UI\browser\` to your IIS folder:

**If deployed in subdirectory:**
```powershell
Copy-Item -Path "dist\TimeSheet-UI\browser\*" -Destination "C:\inetpub\wwwroot\AdrakMPRUI\" -Recurse -Force
```

**If deployed in root:**
You need to change the configuration first (see below).

### Step 4: Verify web.config

The web.config should be in the SAME folder as index.html.

Check it contains:
```xml
<action type="Rewrite" url="/AdrakMPRUI/index.html" />
```

### Step 5: Restart IIS

```powershell
iisreset
```

### Step 6: Test

Try accessing:
- `https://adraklive.com/AdrakMPRUI/`
- `https://adraklive.com/AdrakMPRUI/my-task`
- `https://adraklive.com/AdrakMPRUI/dpr-approval`

## If You Need Root Deployment (/)

If your URL should be `https://adraklive.com/my-task` (without /AdrakMPRUI/), then:

1. **Update angular.json:**
   Change `"baseHref": "/AdrakMPRUI/"` to `"baseHref": "/"`

2. **Update public/web.config:**
   Change `url="/AdrakMPRUI/index.html"` to `url="/index.html"`

3. **Rebuild and deploy to root folder**

## Troubleshooting White Screen

If you're seeing a white screen:

### 1. Check Browser Console (F12)
Look for errors like:
- `Failed to load resource: 404` - Files not found
- `Unexpected token '<'` - Wrong base href
- CORS errors - API configuration issue

### 2. Check Network Tab (F12)
See which files are being requested and which are failing.

### 3. Verify Base Href Matches Deployment

Open the deployed index.html and check:
```html
<base href="/AdrakMPRUI/">
```

This MUST match where the files are deployed.

### 4. Check File Paths

If base href is `/AdrakMPRUI/`, the browser will request:
- `https://adraklive.com/AdrakMPRUI/main-ABC123.js`
- `https://adraklive.com/AdrakMPRUI/styles-XYZ789.css`

These files must exist at those paths.

### 5. Clear Browser Cache

```
Ctrl + Shift + Delete
Clear cached images and files
```

Or use Incognito/Private mode.

## Quick Recovery Steps

If everything is broken:

1. **Rebuild with current configuration:**
   ```powershell
   ng build --configuration production
   ```

2. **Deploy to the CORRECT location:**
   - If URL is `https://adraklive.com/AdrakMPRUI/...` → Deploy to `C:\inetpub\wwwroot\AdrakMPRUI\`
   - If URL is `https://adraklive.com/...` → Deploy to `C:\inetpub\wwwroot\`

3. **Ensure web.config is deployed**

4. **Restart IIS:**
   ```powershell
   iisreset
   ```

5. **Clear browser cache and test**

## Need to Determine Your Setup?

Ask your server administrator:
1. Where are the files physically located?
2. What is the IIS application path?
3. Are there any URL rewrite rules at the site level?

## Current Configuration

- **Base Href:** `/AdrakMPRUI/`
- **Web Config Rewrite:** `/AdrakMPRUI/index.html`
- **Expected URL:** `https://adraklive.com/AdrakMPRUI/my-task`

If your actual URL is different, the configuration needs to be adjusted.
