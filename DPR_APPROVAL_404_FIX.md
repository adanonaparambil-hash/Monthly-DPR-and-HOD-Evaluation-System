# DPR Approval 404 Error - Production Fix

## Problem
When users click on the DPR module in production, they get:
```
404 - File or directory not found.
The resource you are looking for might have been removed, had its name changed, or is temporarily unavailable.
```

Works fine in local development but fails in production.

## Root Cause
IIS server is looking for a physical file at `/AdrakMPRUI/dpr-approval` but Angular uses client-side routing. The server needs to be configured to redirect all requests to `index.html` so Angular can handle the routing.

## Solution

### Files Modified
1. **public/web.config** - Enhanced with comprehensive IIS configuration

### What Was Changed

#### Enhanced web.config with:
- URL rewriting rules for Angular routes
- MIME type mappings for static files
- HTTP error handling (404 → index.html)
- Cache control headers
- Default document configuration
- API route exclusion from rewriting

### Deployment Steps

#### Quick Fix (Recommended)
1. Run the deployment script:
   ```powershell
   .\deploy-to-production.ps1
   ```

2. Copy all files from `dist\TimeSheet-UI\browser\` to your IIS folder:
   ```
   C:\inetpub\wwwroot\AdrakMPRUI\
   ```

3. Ensure URL Rewrite Module is installed on IIS:
   - Download: https://www.iis.net/downloads/microsoft/url-rewrite
   - Install and restart IIS

4. Test:
   - Navigate to: `http://yourserver/AdrakMPRUI/dpr-approval`
   - Should load without 404 error

#### Manual Steps
1. Build for production:
   ```powershell
   npm run build
   ```

2. Verify `web.config` exists in `dist\TimeSheet-UI\browser\`

3. Deploy all files to IIS application folder

4. Configure IIS Application Pool:
   - .NET CLR Version: **No Managed Code**
   - Managed Pipeline Mode: **Integrated**

5. Restart IIS or Application Pool

## Verification

### Test These URLs:
- ✓ `http://yourserver/AdrakMPRUI/` (home)
- ✓ `http://yourserver/AdrakMPRUI/dpr-approval` (direct navigation)
- ✓ `http://yourserver/AdrakMPRUI/my-task` (direct navigation)
- ✓ Refresh browser on any route (should not 404)

### Check IIS Configuration:
1. Open IIS Manager
2. Select AdrakMPRUI application
3. Double-click "URL Rewrite"
4. Verify "Angular Routes" rule exists and is enabled

## Troubleshooting

### If 404 Still Occurs:

1. **URL Rewrite Module Not Installed**
   - Install from: https://www.iis.net/downloads/microsoft/url-rewrite
   - Restart IIS after installation

2. **web.config Not Being Read**
   - Check IIS logs: `C:\inetpub\logs\LogFiles\`
   - Check Event Viewer: Windows Logs > Application
   - Verify file permissions (IIS_IUSRS needs Read access)

3. **Wrong Application Pool Settings**
   - Must be "No Managed Code" for Angular apps
   - Change and restart Application Pool

4. **Base Href Mismatch**
   - Verify production build has `baseHref: "/AdrakMPRUI/"`
   - Check `angular.json` production configuration

### Alternative Solution: Hash Location Strategy

If URL rewriting continues to cause issues, use hash-based routing:

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

URLs will change to: `http://yourserver/AdrakMPRUI/#/dpr-approval`

## Files Created
- `PRODUCTION_DEPLOYMENT_FIX.md` - Detailed deployment guide
- `deploy-to-production.ps1` - Automated deployment script
- `DPR_APPROVAL_404_FIX.md` - This file

## Summary
The enhanced `web.config` file now properly handles Angular routing in IIS by redirecting all non-file requests to `index.html`, allowing Angular to handle client-side routing. This fixes the 404 error when navigating directly to routes like `/dpr-approval`.
