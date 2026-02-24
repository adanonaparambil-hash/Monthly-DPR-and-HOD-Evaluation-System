# Root Deployment 404 Fix - adraklive.com

## Issue
Getting 404 error when accessing routes like:
- `https://adraklive.com/my-task?dprMode=true`
- `https://adraklive.com/dpr-approval`

## Root Cause
The application was configured for subdirectory deployment (`/AdrakMPRUI/`) but is actually deployed at the domain root (`/`). This mismatch causes:
1. Incorrect base href in index.html
2. Wrong rewrite URL in web.config

## Solution Applied

### 1. Updated angular.json
Changed production baseHref from `/AdrakMPRUI/` to `/`

**Before:**
```json
"baseHref": "/AdrakMPRUI/"
```

**After:**
```json
"baseHref": "/"
```

### 2. Updated web.config
Changed rewrite URL from `/AdrakMPRUI/index.html` to `/index.html`

**Before:**
```xml
<action type="Rewrite" url="/AdrakMPRUI/index.html" />
```

**After:**
```xml
<action type="Rewrite" url="/index.html" />
```

## Deployment Steps

### Option 1: Using PowerShell Script (Recommended)

```powershell
.\deploy-to-root.ps1
```

This will:
1. Clean previous build
2. Build for production with root configuration
3. Verify web.config
4. Create deployment package
5. Show deployment instructions

### Option 2: Manual Deployment

1. **Clean and Build:**
   ```powershell
   # Clean
   Remove-Item -Path "dist" -Recurse -Force
   
   # Build
   ng build --configuration production
   ```

2. **Verify Files:**
   Check `dist\TimeSheet-UI\browser\` contains:
   - index.html (with `<base href="/">`)
   - web.config (with `url="/index.html"`)
   - All .js and .css files
   - assets folder

3. **Deploy to IIS:**
   - Copy ALL files from `dist\TimeSheet-UI\browser\` to your IIS root folder
   - Typically: `C:\inetpub\wwwroot\`
   - Or your domain's root folder

4. **Verify IIS Configuration:**
   
   **Application Pool:**
   - .NET CLR Version: **No Managed Code**
   - Managed Pipeline Mode: **Integrated**
   
   **URL Rewrite Module:**
   - Must be installed: https://www.iis.net/downloads/microsoft/url-rewrite
   - Verify in IIS Manager > URL Rewrite > "Angular Routes" rule exists

5. **Restart IIS:**
   ```powershell
   iisreset
   ```

## Testing

### Test These URLs:
```
✓ https://adraklive.com/
✓ https://adraklive.com/login
✓ https://adraklive.com/my-task
✓ https://adraklive.com/my-task?dprMode=true
✓ https://adraklive.com/dpr-approval
✓ https://adraklive.com/my-logged-hours
```

### Test Browser Refresh:
1. Navigate to any route
2. Press F5 (refresh)
3. Should NOT get 404 error

### Test Direct Navigation:
1. Copy any route URL
2. Paste in new browser tab
3. Should load correctly

## Troubleshooting

### Still Getting 404?

#### 1. Check URL Rewrite Module
```powershell
# In IIS Manager
# Select your site > URL Rewrite
# Should see "Angular Routes" rule
```

If not installed:
- Download: https://www.iis.net/downloads/microsoft/url-rewrite
- Install and restart IIS

#### 2. Verify web.config is Deployed
Check if `web.config` exists in your IIS root folder:
```powershell
Test-Path "C:\inetpub\wwwroot\web.config"
```

View content:
```powershell
Get-Content "C:\inetpub\wwwroot\web.config"
```

Should contain:
```xml
<action type="Rewrite" url="/index.html" />
```

#### 3. Check IIS Error Logs
```
C:\inetpub\logs\LogFiles\W3SVC1\
```

Look for 404 errors and the requested URLs.

#### 4. Verify Base Href in index.html
```powershell
Get-Content "C:\inetpub\wwwroot\index.html" | Select-String "base href"
```

Should show:
```html
<base href="/">
```

#### 5. Check File Permissions
IIS_IUSRS must have Read & Execute permissions:
```powershell
icacls "C:\inetpub\wwwroot" /grant "IIS_IUSRS:(OI)(CI)RX"
```

#### 6. Application Pool Identity
Ensure the Application Pool identity has access to the folder.

### Alternative: Test with Hash Location Strategy

If URL rewriting continues to fail, temporarily use hash routing:

1. Update `src/app/app.config.ts`:
```typescript
import { provideRouter, withHashLocation } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation()),
    // ... other providers
  ],
};
```

2. Rebuild and deploy

URLs will be: `https://adraklive.com/#/my-task`

## Verification Checklist

- [ ] Built with `ng build --configuration production`
- [ ] web.config contains `url="/index.html"`
- [ ] index.html contains `<base href="/">`
- [ ] All files deployed to IIS root folder
- [ ] URL Rewrite Module installed on IIS
- [ ] Application Pool set to "No Managed Code"
- [ ] IIS restarted after deployment
- [ ] Can access https://adraklive.com/
- [ ] Can access https://adraklive.com/my-task
- [ ] Can access https://adraklive.com/my-task?dprMode=true
- [ ] Browser refresh works on any route
- [ ] Direct URL navigation works

## Files Modified
- `angular.json` - Changed baseHref from `/AdrakMPRUI/` to `/`
- `public/web.config` - Changed rewrite URL from `/AdrakMPRUI/index.html` to `/index.html`

## Files Created
- `deploy-to-root.ps1` - Automated deployment script for root deployment
- `ROOT_DEPLOYMENT_404_FIX.md` - This file

## Quick Command Reference

```powershell
# Build for production
ng build --configuration production

# Deploy (copy to IIS)
Copy-Item -Path "dist\TimeSheet-UI\browser\*" -Destination "C:\inetpub\wwwroot\" -Recurse -Force

# Restart IIS
iisreset

# Test
Start-Process "https://adraklive.com/my-task?dprMode=true"
```

## Summary
The application is now configured for root deployment at `https://adraklive.com/`. All routes including `/my-task?dprMode=true` and `/dpr-approval` should work correctly after rebuilding and redeploying with the updated configuration.
