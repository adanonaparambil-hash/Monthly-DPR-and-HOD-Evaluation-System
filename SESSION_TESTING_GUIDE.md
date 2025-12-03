# Session Security Testing Guide

## Quick Test Steps

### Test 1: Basic Logout
1. Login to the application
2. Navigate to any dashboard page
3. Click the logout button
4. **Expected**: Redirected to login page with success message
5. Copy the URL of a protected page (e.g., `/employee-dashboard`)
6. Paste it in the browser address bar
7. **Expected**: Immediately redirected to login page (session cleared)

### Test 2: Direct URL Access After Logout
1. Login to the application
2. Copy this URL: `http://localhost:4200/employee-dashboard`
3. Logout
4. Paste the URL in the same browser tab
5. **Expected**: Redirected to login with "Access denied" message
6. **Verify**: Cannot see any user data

### Test 3: New Tab After Logout
1. Login to the application
2. Open a new tab
3. Go to the first tab and logout
4. In the second tab, try to navigate to any page
5. **Expected**: Redirected to login (session cleared globally)

### Test 4: Browser Refresh After Logout
1. Login to the application
2. Logout
3. Press F5 (refresh)
4. **Expected**: Stay on login page, no access to protected routes

### Test 5: Idle Timeout (1 Hour)
**Note**: For quick testing, you can temporarily change the timeout in `auth.service.ts`:

```typescript
// Change from 60 minutes to 2 minutes for testing
private readonly ACTIVITY_TIMEOUT = 2 * 60 * 1000; // 2 minutes
```

1. Login to the application
2. Don't touch mouse/keyboard for 2 minutes
3. **Expected**: Automatically logged out with "inactivity" message
4. **Verify**: Redirected to login page

### Test 6: Session Expiry (8 Hours)
**Note**: For quick testing, you can temporarily change the timeout:

```typescript
// Change from 8 hours to 5 minutes for testing
private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
```

1. Login to the application
2. Keep using the app (to avoid inactivity timeout)
3. Wait 5 minutes
4. **Expected**: Automatically logged out with "session expired" message

### Test 7: Activity Extension
1. Login to the application
2. Use the app normally (click, type, scroll)
3. **Expected**: Session stays active
4. **Verify**: No automatic logout while actively using

### Test 8: Session Warning
1. Login to the application
2. Wait until 5 minutes before session expiry
3. **Expected**: Warning banner appears at top-right
4. Click "Extend Session"
5. **Expected**: Warning disappears, session extended

### Test 9: Multiple Tabs
1. Login in Tab 1
2. Open Tab 2 with a protected route
3. **Expected**: Tab 2 shows content (session shared)
4. Logout in Tab 1
5. Try to navigate in Tab 2
6. **Expected**: Tab 2 redirected to login (session cleared globally)

### Test 10: Browser DevTools Check
1. Login to the application
2. Open DevTools (F12) → Application → Local Storage
3. **Verify**: See `user_session`, `access_token`, `current_user`
4. Logout
5. **Verify**: All session keys removed from Local Storage
6. **Verify**: Session Storage is also cleared

## Expected Behavior Summary

| Scenario | Expected Result |
|----------|----------------|
| After logout | All session data cleared |
| Direct URL access after logout | Redirect to login |
| New tab after logout | Redirect to login |
| 1 hour of inactivity | Auto logout with message |
| 8 hours since login | Auto logout with message |
| Active usage | Session stays alive |
| 5 min before expiry | Warning banner shown |
| Multiple tabs | Session shared, logout affects all |

## Troubleshooting

### If session persists after logout:
1. Check browser console for errors
2. Verify `AuthService.clearSession()` is called
3. Check Local Storage is actually cleared
4. Clear browser cache and try again

### If auto-logout doesn't work:
1. Check browser console for timer errors
2. Verify activity monitoring is working
3. Check timeout values in `auth.service.ts`

### If routes are not protected:
1. Verify `AuthGuard` is imported in `app.routes.ts`
2. Check `canActivate: [AuthGuard]` is applied to routes
3. Verify `AuthGuard` is using `AuthService.isLoggedIn()`

## Quick Timeout Adjustment for Testing

Edit `src/app/services/auth.service.ts`:

```typescript
// Original values (production)
private readonly SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours
private readonly ACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour

// Test values (for quick testing)
private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
private readonly ACTIVITY_TIMEOUT = 2 * 60 * 1000; // 2 minutes
```

**Remember to change back to production values after testing!**
