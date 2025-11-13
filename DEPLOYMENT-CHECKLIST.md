# Deployment Checklist for AdrakMPRUI

## Your Deployment Configuration

- **Production URL:** `https://adraklive.com/AdrakMPRUI/`
- **API URL:** `https://adraklive.com/AdrakMPRAPI/api`
- **Base Href:** `/AdrakMPRUI/`
- **Server:** IIS

---

## Pre-Deployment Steps

### 1. Build the Application

```powershell
# Option 1: Use the build script (Recommended)
.\build-production.ps1

# Option 2: Manual build
ng build --configuration production
```

### 2. Verify the Build

```powershell
# Run verification script
.\verify-environment.ps1

# Check that these files exist:
dir dist\TimeSheet-UI\browser\
```

You should see:
- ✅ `index.html`
- ✅ `web.config`
- ✅ `assets\` folder
- ✅ `assets\images\AlAdrakBgImage.jpg`
- ✅ JavaScript bundles (main*.js, polyfills*.js, etc.)

### 3. Verify web.config

Check that `dist\TimeSheet-UI\browser\web.config` contains:
```xml
<action type="Rewrite" url="/AdrakMPRUI/index.html" />
```

---

## Deployment Steps

### 1. Backup Current Production (if exists)

On your server, rename the current `/AdrakMPRUI/` folder to `/AdrakMPRUI_backup/`

### 2. Upload Files

Upload **ALL contents** of `dist\TimeSheet-UI\browser\` to `/AdrakMPRUI/` on your server.

**Important:** Upload the entire folder structure, including:
- All files in the root (index.html, web.config, *.js, *.css)
- The `assets` folder with all subfolders
- All other files and folders

### 3. Verify File Structure on Server

Your server should have this structure:
```
/AdrakMPRUI/
├── index.html
├── web.config
├── favicon.ico
├── main.[hash].js
├── polyfills.[hash].js
├── styles.[hash].css
└── assets/
    └── images/
        ├── AlAdrakBgImage.jpg
        ├── logo.jpg
        └── company-logo.svg
```

### 4. Set IIS Permissions

Ensure IIS has read permissions on the `/AdrakMPRUI/` folder:
- Right-click folder → Properties → Security
- Add `IIS_IUSRS` with Read & Execute permissions

---

## Post-Deployment Testing

### 1. Test Direct File Access

Open browser and test these URLs:

✅ **App URL:**
```
https://adraklive.com/AdrakMPRUI/
```
Should load the login page

✅ **Background Image:**
```
https://adraklive.com/AdrakMPRUI/assets/images/AlAdrakBgImage.jpg
```
Should display the image

✅ **Logo:**
```
https://adraklive.com/AdrakMPRUI/assets/images/logo.jpg
```
Should display the logo

✅ **API Endpoint:**
```
https://adraklive.com/AdrakMPRAPI/api/Login/UserLogin
```
Should return API response (may be 405 Method Not Allowed for GET, which is OK)

### 2. Test Application Features

- [ ] Login page loads with background image
- [ ] Can login successfully
- [ ] Dashboard loads after login
- [ ] Navigation works (no 404 errors)
- [ ] Images load correctly
- [ ] API calls work (check browser console for errors)
- [ ] Logout works

### 3. Check Browser Console

Press F12 → Console tab
- [ ] No 404 errors for assets
- [ ] No CORS errors
- [ ] No JavaScript errors

### 4. Check Network Tab

Press F12 → Network tab → Reload page
- [ ] All assets load with 200 status
- [ ] API calls return 200 (or expected status)
- [ ] No failed requests

---

## Troubleshooting

### Issue: 404 Error on Page Refresh

**Cause:** web.config not working or missing

**Fix:**
1. Verify web.config exists in `/AdrakMPRUI/` folder
2. Check IIS has URL Rewrite module installed
3. Verify web.config contains correct rewrite rule

### Issue: Background Image Not Loading

**Cause:** Incorrect path or file not uploaded

**Fix:**
1. Test direct URL: `https://adraklive.com/AdrakMPRUI/assets/images/AlAdrakBgImage.jpg`
2. If 404: File not uploaded or wrong location
3. If 403: Permission issue
4. Check browser DevTools → Network tab for actual request URL

### Issue: CORS Error

**Cause:** API not allowing requests from Angular app

**Fix:**
Add CORS headers to API server (see DEPLOYMENT_GUIDE.md)

### Issue: Blank Page

**Cause:** JavaScript errors or wrong base href

**Fix:**
1. Check browser console for errors
2. Verify base href in index.html: `<base href="/AdrakMPRUI/">`
3. Rebuild with correct configuration

---

## Rollback Procedure

If deployment fails:

1. Stop IIS or the application pool
2. Delete `/AdrakMPRUI/` folder
3. Rename `/AdrakMPRUI_backup/` to `/AdrakMPRUI/`
4. Start IIS or the application pool
5. Test the old version works

---

## Build Information

**Last Updated:** $(Get-Date)
**Angular Version:** Check package.json
**Node Version:** Run `node --version`
**Build Configuration:** production
**Base Href:** /AdrakMPRUI/

---

## Support Contacts

- **Developer:** [Your Name]
- **Server Admin:** [Server Admin Name]
- **Documentation:** See DEPLOYMENT_GUIDE.md

---

## Notes

- Always test in a staging environment first if available
- Keep backups of previous deployments
- Document any custom changes or configurations
- Update this checklist if deployment process changes
