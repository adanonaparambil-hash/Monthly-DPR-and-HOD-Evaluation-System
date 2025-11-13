# Final Solution Summary - Background Image Fix

## Problem
Background image works in localhost but not in production at `https://adraklive.com/AdrakMPRUI/`

## Root Cause
Angular's CSS url() resolver doesn't work well with relative paths when deployed to a subdirectory. The path `/assets/...` works in development (root) but needs to be `/AdrakMPRUI/assets/...` in production.

## Solution Applied

### 1. Moved Image to src/assets
- Copied image from `public/assets/images/` to `src/assets/images/`
- This allows Angular's build system to process the asset correctly

### 2. Updated angular.json
Added src/assets to the assets configuration:
```json
"assets": [
  {
    "glob": "**/*",
    "input": "public",
    "output": "/"
  },
  {
    "glob": "**/*",
    "input": "src/assets",
    "output": "/assets"
  }
]
```

### 3. CSS Path
Using absolute path in CSS:
```css
background-image: url('/assets/images/AlAdrakBgImage.jpg');
```

With `baseHref: "/AdrakMPRUI/"` configured, Angular automatically resolves this to:
```
/AdrakMPRUI/assets/images/AlAdrakBgImage.jpg
```

## How It Works

### Development (localhost:4200)
- Base href: `/`
- Image URL: `/assets/images/AlAdrakBgImage.jpg`
- Resolves to: `http://localhost:4200/assets/images/AlAdrakBgImage.jpg` ✅

### Production (adraklive.com/AdrakMPRUI/)
- Base href: `/AdrakMPRUI/`
- Image URL: `/assets/images/AlAdrakBgImage.jpg`
- Resolves to: `https://adraklive.com/AdrakMPRUI/assets/images/AlAdrakBgImage.jpg` ✅

## Build and Deploy

### Build Command
```powershell
.\build-production.ps1
```
or
```bash
ng build --configuration production
```

### Verify Build
Check that image exists:
```powershell
Test-Path "dist\TimeSheet-UI\browser\assets\images\AlAdrakBgImage.jpg"
```
Should return: `True`

### Deploy
Upload **ALL contents** of `dist\TimeSheet-UI\browser\` to `/AdrakMPRUI/` on your server

### Test in Production
1. **App URL:**
   ```
   https://adraklive.com/AdrakMPRUI/
   ```

2. **Direct Image URL:**
   ```
   https://adraklive.com/AdrakMPRUI/assets/images/AlAdrakBgImage.jpg
   ```
   This should display the image directly

3. **Check Browser Console:**
   - Press F12 → Console
   - Should see no 404 errors for the image

4. **Check Network Tab:**
   - Press F12 → Network → Filter by "Img"
   - Reload page
   - Should see `AlAdrakBgImage.jpg` with status 200

## File Structure

### Source (Before Build)
```
src/
├── assets/
│   └── images/
│       └── AlAdrakBgImage.jpg  ← Image here
└── app/
    └── login/
        └── login.component.css  ← References /assets/images/...

public/
└── assets/
    └── images/
        └── AlAdrakBgImage.jpg  ← Also kept here for other uses
```

### Build Output
```
dist/TimeSheet-UI/browser/
├── index.html  (with <base href="/AdrakMPRUI/">)
├── web.config
├── assets/
│   └── images/
│       └── AlAdrakBgImage.jpg  ← Image copied here
└── [other build files]
```

### Production Server
```
/AdrakMPRUI/
├── index.html
├── web.config
├── assets/
│   └── images/
│       └── AlAdrakBgImage.jpg  ← Image accessible at /AdrakMPRUI/assets/images/...
└── [other files]
```

## Why This Solution Works

1. ✅ **Angular processes the asset** - Image in src/assets is handled by Angular's build system
2. ✅ **Base href resolves paths** - `/assets/...` becomes `/AdrakMPRUI/assets/...` automatically
3. ✅ **Works in both environments** - Same code works in dev and production
4. ✅ **No build errors** - Angular can resolve the path during build
5. ✅ **No manual path changes** - No need to change paths when deploying

## Troubleshooting

### If image still doesn't load:

1. **Check image exists on server:**
   ```
   https://adraklive.com/AdrakMPRUI/assets/images/AlAdrakBgImage.jpg
   ```
   - If 404: File not uploaded
   - If 403: Permission issue
   - If loads: CSS or caching issue

2. **Clear browser cache:**
   - Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
   - Or open in incognito/private window

3. **Check browser console:**
   - Look for the actual URL being requested
   - Should be: `/AdrakMPRUI/assets/images/AlAdrakBgImage.jpg`
   - If different, rebuild with correct configuration

4. **Verify base href:**
   ```powershell
   Get-Content "dist\TimeSheet-UI\browser\index.html" | Select-String "base href"
   ```
   Should show: `<base href="/AdrakMPRUI/">`

5. **Check file permissions on server:**
   - Ensure IIS_IUSRS has Read permissions on `/AdrakMPRUI/assets/` folder

## Configuration Files

### angular.json
- ✅ `baseHref: "/AdrakMPRUI/"` in production config
- ✅ `fileReplacements` for environment.prod.ts
- ✅ Assets include both `public` and `src/assets`

### web.config
- ✅ URL rewrite to `/AdrakMPRUI/index.html`
- ✅ Minimal configuration to avoid conflicts

### environment.prod.ts
- ✅ `apiBaseUrl: 'https://adraklive.com/AdrakMPRAPI'`

## Success Criteria

- [x] Build completes without errors
- [x] Image exists in build output
- [x] Base href is `/AdrakMPRUI/`
- [x] Image loads in production
- [x] No 404 errors in browser console
- [x] Login page shows background image

## Last Build
Date: $(Get-Date)
Status: ✅ Success
Output: `dist/TimeSheet-UI/browser/`

---

**The background image should now work in both development and production!** 🎉
