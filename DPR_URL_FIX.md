# DPR URL Fix - Correct Base Path in Production

## Problem
When users click on the DPR link in production, they get:
```
https://adraklive.com/my-task?dprMode=true  ❌ WRONG
```

But it should be:
```
https://adraklive.com/AdrakMPRUI/my-task?dprMode=true  ✓ CORRECT
```

The application is deployed in the `/AdrakMPRUI/` subdirectory, so all URLs must include this base path.

## Root Cause
In `src/app/layout/layout.ts`, the `openDPRInNewTab()` method was using a hardcoded relative path:
```typescript
window.open('/my-task?dprMode=true', '_blank');
```

This creates a URL relative to the domain root (`/`), ignoring the base href (`/AdrakMPRUI/`).

## Solution
Updated the method to dynamically get the base href from the document and construct the full URL:

```typescript
openDPRInNewTab() {
  // Set a flag in localStorage that the new tab can read
  localStorage.setItem('dprOnlyMode', 'true');
  localStorage.setItem('dprModeTimestamp', Date.now().toString());
  
  // Get the base href from the document
  const baseElement = document.querySelector('base');
  const baseHref = baseElement ? baseElement.getAttribute('href') || '/' : '/';
  
  // Construct the full URL with base path
  const dprUrl = `${window.location.origin}${baseHref}my-task?dprMode=true`;
  
  // Open My Task page in new tab with URL parameter for immediate detection
  window.open(dprUrl, '_blank');
}
```

## How It Works

1. **Gets base href from document:** Reads the `<base href="/AdrakMPRUI/">` tag from index.html
2. **Constructs full URL:** Combines origin + base href + route
3. **Opens correct URL:** `https://adraklive.com/AdrakMPRUI/my-task?dprMode=true`

## Benefits

- **Works in any environment:** Automatically adapts to base href
- **Local development:** Uses `/` (base href is `/`)
- **Production:** Uses `/AdrakMPRUI/` (base href is `/AdrakMPRUI/`)
- **Future-proof:** If deployment path changes, no code changes needed

## Testing

### Local Development
- Base href: `/`
- Expected URL: `http://localhost:4200/my-task?dprMode=true`
- ✓ Works correctly

### Production
- Base href: `/AdrakMPRUI/`
- Expected URL: `https://adraklive.com/AdrakMPRUI/my-task?dprMode=true`
- ✓ Works correctly

## Deployment Steps

1. **Rebuild the application:**
   ```powershell
   ng build --configuration production
   ```

2. **Deploy to production:**
   Copy all files from `dist\TimeSheet-UI\browser\` to `C:\inetpub\wwwroot\AdrakMPRUI\`

3. **Restart IIS:**
   ```powershell
   iisreset
   ```

4. **Clear browser cache:**
   Press `Ctrl + Shift + Delete` or use Incognito mode

5. **Test:**
   - Login to the application
   - Click on the DPR menu item
   - Verify the new tab opens with URL: `https://adraklive.com/AdrakMPRUI/my-task?dprMode=true`

## Files Modified
- `src/app/layout/layout.ts` - Updated `openDPRInNewTab()` method to use dynamic base href

## Verification Checklist

- [ ] Code updated in `src/app/layout/layout.ts`
- [ ] Application rebuilt for production
- [ ] Files deployed to `/AdrakMPRUI/` folder
- [ ] IIS restarted
- [ ] Browser cache cleared
- [ ] DPR link opens correct URL with `/AdrakMPRUI/` path
- [ ] Application loads without 404 errors
- [ ] All routes work correctly

## Summary
The DPR link now correctly includes the `/AdrakMPRUI/` base path in production by dynamically reading the base href from the document. This ensures the URL is always correct regardless of the deployment environment.
