# Web.config Troubleshooting Guide

## Current Working Configuration

The minimal web.config that should work:

```xml
<?xml version="1.0" encoding="utf-8"?>
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
          <action type="Rewrite" url="/AdrakMPRUI/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

This is saved in `public/web.config` and will be copied to your build output.

---

## Common 500 Internal Server Errors

### Error 1: MIME Type Conflicts

**Symptom:** 500 error when accessing the site

**Cause:** Trying to add MIME types that already exist at server level

**Solution:** Use the minimal web.config (above) without MIME type definitions

### Error 2: URL Rewrite Module Not Installed

**Symptom:** 500 error with message about "rewrite" module

**Cause:** IIS URL Rewrite module not installed

**Solution:**
1. Download and install: [IIS URL Rewrite Module](https://www.iis.net/downloads/microsoft/url-rewrite)
2. Or use Web Platform Installer to install it
3. Restart IIS after installation

### Error 3: Invalid XML

**Symptom:** 500 error immediately

**Cause:** Malformed XML in web.config

**Solution:**
1. Validate XML syntax
2. Ensure proper encoding: `<?xml version="1.0" encoding="utf-8"?>`
3. Check all tags are properly closed

---

## Testing Steps

### Step 1: Test Without web.config

1. Remove web.config from `/AdrakMPRUI/` folder
2. Try accessing: `https://adraklive.com/AdrakMPRUI/index.html`
3. If this works, the issue is with web.config

### Step 2: Test Minimal web.config

1. Use the minimal web.config (shown above)
2. Upload to `/AdrakMPRUI/` folder
3. Try accessing: `https://adraklive.com/AdrakMPRUI/`

### Step 3: Check IIS Error Logs

Location: `C:\inetpub\logs\LogFiles\W3SVC1\`

Look for:
- 500 errors
- Module errors
- Configuration errors

### Step 4: Enable Detailed Errors

Temporarily enable detailed errors in IIS:
1. Open IIS Manager
2. Select your site
3. Double-click "Error Pages"
4. Click "Edit Feature Settings"
5. Select "Detailed errors"
6. Try accessing the site again to see detailed error message

**Important:** Disable detailed errors after troubleshooting (security risk)

---

## Image Loading Issues

If images don't load even with working web.config:

### Check 1: File Exists

Test direct URL:
```
https://adraklive.com/AdrakMPRUI/assets/images/AlAdrakBgImage.jpg
```

**If 404:** File not uploaded or wrong location
**If 403:** Permission issue
**If 500:** web.config issue

### Check 2: File Permissions

On the server:
1. Right-click `/AdrakMPRUI/` folder
2. Properties → Security
3. Ensure `IIS_IUSRS` has Read & Execute permissions
4. Apply to all subfolders and files

### Check 3: MIME Types at Server Level

In IIS Manager:
1. Select your server (root level)
2. Double-click "MIME Types"
3. Verify these exist:
   - `.jpg` → `image/jpeg`
   - `.png` → `image/png`
   - `.svg` → `image/svg+xml`

If missing, add them at server level (not in web.config)

---

## Alternative Configurations

### Option 1: No Subdirectory (Root Deployment)

If you can deploy to root instead of `/AdrakMPRUI/`:

```xml
<action type="Rewrite" url="/index.html" />
```

And update angular.json:
```json
"baseHref": "/"
```

### Option 2: Different Subdirectory

If deploying to different path (e.g., `/app/`):

```xml
<action type="Rewrite" url="/app/index.html" />
```

And update angular.json:
```json
"baseHref": "/app/"
```

---

## Quick Fixes

### Fix 1: Use Your Working web.config

You mentioned this works:
```xml
<?xml version="1.0" encoding="utf-8"?>
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
          <action type="Rewrite" url="/AdrakMPRUI/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

**Use this!** It's now in `public/web.config`

### Fix 2: Check Base Href in index.html

After building, check `dist/TimeSheet-UI/browser/index.html`:

Should contain:
```html
<base href="/AdrakMPRUI/">
```

If it shows `<base href="/">`, rebuild with:
```bash
ng build --configuration production
```

### Fix 3: Verify Build Output

Check these files exist in `dist/TimeSheet-UI/browser/`:
- ✅ index.html
- ✅ web.config
- ✅ assets/images/AlAdrakBgImage.jpg

---

## Server-Level Configuration

If web.config keeps causing issues, configure at IIS site level:

### Add URL Rewrite Rule in IIS Manager:

1. Open IIS Manager
2. Select `/AdrakMPRUI/` application/folder
3. Double-click "URL Rewrite"
4. Add Rule → Blank Rule
5. Configure:
   - Name: `Angular Routes`
   - Match URL: `.*`
   - Conditions: Add two conditions
     - `{REQUEST_FILENAME}` is not a file
     - `{REQUEST_FILENAME}` is not a directory
   - Action: Rewrite
   - Rewrite URL: `/AdrakMPRUI/index.html`
   - Stop processing: Yes

Then you can remove web.config entirely!

---

## Contact Support

If issues persist:

1. **Check IIS logs** for specific error codes
2. **Enable detailed errors** temporarily
3. **Test direct file access** (index.html, images)
4. **Verify URL Rewrite module** is installed
5. **Check file permissions** on server

Provide this information when seeking help:
- Exact error message
- IIS version
- URL Rewrite module version
- Contents of web.config
- IIS error log entries
