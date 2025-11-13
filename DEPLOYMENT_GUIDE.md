# Production Deployment Guide - Background Image Fix

## Current Status
✅ Image exists: `public/assets/images/AlAdrakBgImage.jpg`
✅ Angular.json configured correctly
✅ Build output includes image at: `dist/TimeSheet-UI/browser/assets/images/AlAdrakBgImage.jpg`
✅ CSS uses correct path: `url('/assets/images/AlAdrakBgImage.jpg')`

## Issue
Background image works in development but not in production.

## Solutions Based on Your Deployment Type

### Solution 1: If deployed to ROOT domain (e.g., https://adraklive.com/)

**Build Command:**
```bash
ng build --configuration production
```

**Deploy:** Upload contents of `dist/TimeSheet-UI/browser/` to your web root

**Server Configuration (IIS/Apache/Nginx):**
Ensure your server serves static files from the assets folder.

**IIS web.config** (add to dist/TimeSheet-UI/browser/):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="Angular Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <mimeMap fileExtension=".json" mimeType="application/json" />
      <mimeMap fileExtension=".jpg" mimeType="image/jpeg" />
      <mimeMap fileExtension=".png" mimeType="image/png" />
    </staticContent>
  </system.webServer>
</configuration>
```

---

### Solution 2: If deployed to SUBDIRECTORY (YOUR CURRENT SETUP)

**Your app is deployed to:** `https://adraklive.com/AdrakMPRUI/`

**Build Command:**
```bash
ng build --configuration production
```
(The baseHref is already configured in angular.json)

**web.config is configured for subdirectory:**
```xml
<action type="Rewrite" url="/AdrakMPRUI/index.html" />
```

**Deploy:** Upload contents of `dist/TimeSheet-UI/browser/` to `/AdrakMPRUI/` folder on your server

**Important:** All assets (images, CSS, JS) will be served from `/AdrakMPRUI/assets/...`

---

### Solution 3: If using Angular's deployUrl

**angular.json** - Add deployUrl to production configuration:
```json
"production": {
  "deployUrl": "/",
  "budgets": [...]
}
```

**Build Command:**
```bash
ng build --configuration production --deploy-url /
```

---

## Troubleshooting Steps

### 1. Check if image is accessible in production
Open browser and navigate to:
```
https://adraklive.com/assets/images/AlAdrakBgImage.jpg
```
or
```
https://your-domain.com/your-subdirectory/assets/images/AlAdrakBgImage.jpg
```

If you get 404, the issue is with server configuration or deployment path.

### 2. Check browser console
Open DevTools (F12) → Console tab
Look for errors like:
- `Failed to load resource: 404` - Image path is wrong
- `CORS error` - Server configuration issue
- `Mixed content` - HTTP/HTTPS issue

### 3. Check Network tab
Open DevTools (F12) → Network tab → Reload page
Filter by "Img" and check if `AlAdrakBgImage.jpg` is being requested
- If not requested: CSS path issue
- If 404: Deployment path issue
- If 403: Permission issue

### 4. Verify build output
After building, check:
```bash
dir dist\TimeSheet-UI\browser\assets\images
```
Should show `AlAdrakBgImage.jpg`

---

## Quick Fix for Production

If the image still doesn't show, try using an inline base64 image temporarily:

1. Convert image to base64:
```bash
# PowerShell
$bytes = [System.IO.File]::ReadAllBytes("public\assets\images\AlAdrakBgImage.jpg")
$base64 = [System.Convert]::ToBase64String($bytes)
Write-Output "data:image/jpeg;base64,$base64"
```

2. Update CSS:
```css
background-image: url('data:image/jpeg;base64,YOUR_BASE64_STRING_HERE');
```

---

## Recommended Solution

Based on your API URL (`https://adraklive.com/AdrakMPRAPI`), I recommend:

1. **Build with base href:**
```bash
ng build --configuration production --base-href /
```

2. **Ensure your Angular app is deployed to the root** or a known subdirectory

3. **Add web.config** to handle routing (if using IIS)

4. **Test the image URL directly** in browser before testing the app

---

## Contact Information
If issues persist, check:
- Server logs for 404 errors
- File permissions on the server
- MIME types configuration
- CORS headers if serving from different domain


---

## CORS Error Fix

### Error Message:
```
Access to XMLHttpRequest at 'http://172.16.1.53:8137/api/Login/UserLogin' from origin 'https://adraklive.com' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### Root Cause:
The production build was using the **development** API URL instead of the **production** API URL.

### Solution Applied:
✅ Added `fileReplacements` to `angular.json` production configuration
✅ This ensures `environment.prod.ts` is used when building for production

### Build Commands:

**For Production:**
```bash
ng build --configuration production
```
or use the provided script:
```bash
.\build-production.ps1
```

**For Development:**
```bash
ng serve
```

### Verify Environment:
Run the verification script to check which environment is being used:
```bash
.\verify-environment.ps1
```

### Environment URLs:

| Environment | API Base URL |
|------------|--------------|
| Development | `http://172.16.1.53:8137` |
| Production | `https://adraklive.com/AdrakMPRAPI` |

### Important Notes:

1. **Always build with `--configuration production`** for production deployment
2. **Never deploy a development build** to production
3. **Verify the build** using `verify-environment.ps1` before deploying
4. **Ensure your API server** has CORS enabled for `https://adraklive.com`

### API Server CORS Configuration:

Your API server at `https://adraklive.com/AdrakMPRAPI` needs to allow requests from your Angular app.

**For ASP.NET Core API**, add to `Program.cs` or `Startup.cs`:
```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularApp",
        policy =>
        {
            policy.WithOrigins("https://adraklive.com")
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        });
});

// Then use it:
app.UseCors("AllowAngularApp");
```

**For ASP.NET Web API (.NET Framework)**, add to `Web.config`:
```xml
<system.webServer>
  <httpProtocol>
    <customHeaders>
      <add name="Access-Control-Allow-Origin" value="https://adraklive.com" />
      <add name="Access-Control-Allow-Headers" value="Content-Type, Authorization" />
      <add name="Access-Control-Allow-Methods" value="GET, POST, PUT, DELETE, OPTIONS" />
      <add name="Access-Control-Allow-Credentials" value="true" />
    </customHeaders>
  </httpProtocol>
</system.webServer>
```

---

## Quick Checklist Before Deployment

- [ ] Run `ng build --configuration production`
- [ ] Run `.\verify-environment.ps1` to confirm production environment
- [ ] Check that `dist\TimeSheet-UI\browser\` contains the build
- [ ] Verify `web.config` is in the build output
- [ ] Ensure API server has CORS enabled
- [ ] Test API endpoint directly: `https://adraklive.com/AdrakMPRAPI/api/Login/UserLogin`
- [ ] Upload build to web server
- [ ] Test the deployed app

---
