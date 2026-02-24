# Quick Fix for 404 Error - adraklive.com

## Problem
`https://adraklive.com/my-task?dprMode=true` returns 404 error

## Quick Solution

### Step 1: Rebuild
```powershell
.\deploy-to-root.ps1
```

OR manually:
```powershell
ng build --configuration production
```

### Step 2: Deploy
Copy everything from `dist\TimeSheet-UI\browser\` to your IIS root folder

### Step 3: Verify web.config
Ensure this file exists in IIS root with this content:
```xml
<action type="Rewrite" url="/index.html" />
```

### Step 4: Install URL Rewrite (if not installed)
https://www.iis.net/downloads/microsoft/url-rewrite

### Step 5: Restart IIS
```powershell
iisreset
```

### Step 6: Test
Open: `https://adraklive.com/my-task?dprMode=true`

## What Changed
- `angular.json`: baseHref changed from `/AdrakMPRUI/` to `/`
- `web.config`: Rewrite URL changed from `/AdrakMPRUI/index.html` to `/index.html`

## Still Not Working?

1. Check URL Rewrite Module is installed
2. Verify Application Pool is set to "No Managed Code"
3. Check IIS logs: `C:\inetpub\logs\LogFiles\`
4. Verify web.config is in the deployed folder
5. Check file permissions (IIS_IUSRS needs Read access)

## Need Help?
See detailed guide: `ROOT_DEPLOYMENT_404_FIX.md`
