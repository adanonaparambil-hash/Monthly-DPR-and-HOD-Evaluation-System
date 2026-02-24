# Production Deployment - 404 Error Fix

## Issue
Getting "404 - File or directory not found" error when navigating to routes like `/dpr-approval` in production, but works fine in local development.

## Root Cause
IIS (or web server) is looking for physical files at the route paths, but Angular uses client-side routing. The server needs to redirect all requests to `index.html`.

## Solution Applied

### 1. Enhanced web.config
Updated `public/web.config` with comprehensive configuration including:
- URL rewriting for Angular routes
- MIME type mappings
- HTTP error handling (404 redirects to index.html)
- Cache control headers
- Default document configuration

### 2. Deployment Steps

#### Step 1: Build for Production
```powershell
npm run build
```
or
```powershell
ng build --configuration production
```

This will create files in `dist/TimeSheet-UI/browser/`

#### Step 2: Verify web.config
Ensure `dist/TimeSheet-UI/browser/web.config` exists and contains the correct configuration.

#### Step 3: Deploy to IIS

1. Copy all files from `dist/TimeSheet-UI/browser/` to your IIS application folder (e.g., `C:\inetpub\wwwroot\AdrakMPRUI\`)

2. Ensure the following files are present:
   - index.html
   - web.config
   - All .js files
   - All .css files
   - assets folder

#### Step 4: IIS Configuration

1. Open IIS Manager
2. Select your application (AdrakMPRUI)
3. Verify Application Pool settings:
   - .NET CLR Version: No Managed Code (for Angular apps)
   - Managed Pipeline Mode: Integrated

4. Install URL Rewrite Module (if not already installed):
   - Download from: https://www.iis.net/downloads/microsoft/url-rewrite
   - Install and restart IIS

5. Verify Handler Mappings:
   - Ensure StaticFile handler is enabled

#### Step 5: Test

1. Navigate to: `http://yourserver/AdrakMPRUI/`
2. Test direct navigation to: `http://yourserver/AdrakMPRUI/dpr-approval`
3. Test browser refresh on any route

## Troubleshooting

### If 404 Still Occurs:

1. **Check URL Rewrite Module**
   ```powershell
   # Run in PowerShell as Administrator
   Get-WindowsFeature -Name Web-Server | Select-Object -ExpandProperty InstallState
   ```

2. **Check web.config is being read**
   - Look for errors in IIS logs
   - Check Event Viewer > Windows Logs > Application

3. **Verify file permissions**
   - IIS_IUSRS should have Read & Execute permissions on the application folder

4. **Check Application Pool Identity**
   - Should have access to the application folder

5. **Test with simplified web.config**
   - Use the `web.config.alternative` if the main one causes issues

### Alternative: Use Hash Location Strategy

If URL rewriting continues to cause issues, you can use hash-based routing:

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

URLs will look like: `http://yourserver/AdrakMPRUI/#/dpr-approval`

## Verification Checklist

- [ ] URL Rewrite Module installed on IIS
- [ ] web.config present in deployment folder
- [ ] Application Pool set to "No Managed Code"
- [ ] Base href in production build is `/AdrakMPRUI/`
- [ ] All static files (JS, CSS, assets) deployed
- [ ] IIS_IUSRS has Read permissions
- [ ] Can access index.html directly
- [ ] Can navigate to routes without 404
- [ ] Browser refresh works on any route

## Files Modified
- `public/web.config` - Enhanced with comprehensive IIS configuration

## Build Configuration
- Production base href: `/AdrakMPRUI/`
- Output directory: `dist/TimeSheet-UI/browser/`
