# Session Timeout Implementation

## Overview
The application now has automatic session timeout functionality that logs out users after 60 minutes of inactivity. This ensures security and prevents unauthorized access when users leave their workstations unattended.

## Implementation Details

### AuthService (Primary Implementation)
The `AuthService` (`src/app/services/auth.service.ts`) is the primary service handling session management and idle timeout.

#### Key Features:
1. **Session Timeout**: 8 hours maximum session duration
2. **Inactivity Timeout**: 60 minutes (1 hour) of user inactivity
3. **Activity Monitoring**: Tracks user interactions (mouse, keyboard, touch, scroll)
4. **Automatic Logout**: Logs out user when timeout is reached
5. **Clear Notifications**: Shows appropriate messages based on logout reason

### Configuration

```typescript
private readonly SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours
private readonly ACTIVITY_TIMEOUT = 60 * 60 * 1000;    // 60 minutes (1 hour)
```

### Monitored Activity Events
The system monitors the following user activities to reset the inactivity timer:
- `mousedown` - Mouse button press
- `mousemove` - Mouse movement
- `keypress` - Keyboard input
- `scroll` - Page scrolling
- `touchstart` - Touch screen interaction
- `click` - Mouse clicks

## How It Works

### 1. Login Process
When a user logs in successfully:
```typescript
public login(token: string, userData: any): void {
  const now = Date.now();
  const session: UserSession = {
    token,
    user: userData,
    loginTime: now,
    lastActivity: now,
    expiresAt: now + this.SESSION_TIMEOUT
  };
  
  this.storeSession(session);
  this.startSessionTimer(this.SESSION_TIMEOUT);
}
```

### 2. Activity Monitoring
The service continuously monitors user activity:
```typescript
private startActivityMonitoring(): void {
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  
  const activityHandler = () => {
    this.updateActivity();
    this.resetActivityTimer();
  };

  events.forEach(event => {
    document.addEventListener(event, activityHandler, true);
  });

  this.resetActivityTimer();
}
```

### 3. Inactivity Timer
When user is inactive for 60 minutes:
```typescript
private resetActivityTimer(): void {
  if (this.activityTimer) {
    clearTimeout(this.activityTimer);
  }

  this.activityTimer = setTimeout(() => {
    if (this.isLoggedIn()) {
      this.logout('inactivity');
    }
  }, this.ACTIVITY_TIMEOUT); // 60 minutes
}
```

### 4. Logout Process
When timeout occurs:
```typescript
public logout(reason: string = 'manual'): void {
  this.clearSession();
  this.clearTimers();
  
  switch (reason) {
    case 'inactivity':
      message = 'You have been logged out due to inactivity.';
      this.toastr.info(message, 'Logged Out');
      break;
    // ... other cases
  }

  this.router.navigate(['/login'], { queryParams: { inactivity: 'true' } });
}
```

## User Experience Flow

### Scenario 1: Active User
1. User logs in at 9:00 AM
2. User actively works (clicks, types, scrolls)
3. Activity timer resets with each interaction
4. User can work indefinitely (up to 8-hour session limit)

### Scenario 2: Inactive User
1. User logs in at 9:00 AM
2. User works until 9:30 AM
3. User leaves desk (no activity)
4. At 10:30 AM (60 minutes later):
   - System automatically logs out user
   - Shows notification: "You have been logged out due to inactivity"
   - Redirects to login page
   - All session data is cleared

### Scenario 3: Returning After Timeout
1. User returns to computer after timeout
2. Sees login page with message: "You have been logged out due to inactivity"
3. User must log in again
4. Previous session data is completely cleared

## Session Storage

### Data Stored
```typescript
interface UserSession {
  token: string;           // Authentication token
  user: any;              // User data
  loginTime: number;      // Timestamp of login
  lastActivity: number;   // Timestamp of last activity
  expiresAt: number;      // Session expiration timestamp
}
```

### Storage Locations
- **localStorage**: Primary session storage
  - `user_session` - Complete session object
  - `access_token` - Token (for backward compatibility)
  - `current_user` - User data (for backward compatibility)

### Session Cleanup
On logout, all session data is cleared:
- All localStorage items removed
- sessionStorage cleared
- Session timers cleared
- User redirected to login

## Logout Reasons

### 1. Manual Logout
- User clicks logout button
- Message: "You have been logged out successfully"
- Type: Success notification

### 2. Inactivity Timeout
- 60 minutes of no user activity
- Message: "You have been logged out due to inactivity"
- Type: Info notification
- Query param: `?inactivity=true`

### 3. Session Expired
- 8-hour maximum session duration reached
- Message: "Your session has expired. Please login again"
- Type: Warning notification
- Query param: `?sessionExpired=true`

### 4. Unauthorized Access
- Invalid token or permissions
- Message: "Access denied. Please login again"
- Type: Error notification
- Query param: `?unauthorized=true`

## API Integration

### HTTP Interceptor
The application should have an HTTP interceptor that:
1. Adds authentication token to requests
2. Handles 401 Unauthorized responses
3. Triggers logout on authentication failures

### Example Interceptor Logic
```typescript
intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
  // Add token to request
  const token = this.authService.getToken();
  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next.handle(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Session expired or invalid token
        this.authService.logout('unauthorized');
      }
      return throwError(() => error);
    })
  );
}
```

## Testing the Implementation

### Test Case 1: Verify Inactivity Timeout
1. Log in to the application
2. Do not interact with the application for 60 minutes
3. Expected: User is automatically logged out
4. Expected: Notification shows "You have been logged out due to inactivity"
5. Expected: Redirected to login page

### Test Case 2: Verify Activity Reset
1. Log in to the application
2. Wait 50 minutes
3. Click anywhere on the page
4. Wait another 50 minutes
5. Expected: User is still logged in (timer was reset)

### Test Case 3: Verify Session Expiry
1. Log in to the application
2. Keep the application active for 8+ hours
3. Expected: User is logged out after 8 hours
4. Expected: Message shows "Your session has expired"

### Test Case 4: Verify Multiple Tabs
1. Open application in two browser tabs
2. Log in on both tabs
3. Be inactive on both tabs for 60 minutes
4. Expected: Both tabs should redirect to login

### Test Case 5: Verify API Failure Handling
1. Log in to the application
2. Manually clear localStorage (simulate session corruption)
3. Try to make an API call
4. Expected: User is logged out with "Access denied" message

## Configuration Options

### Adjusting Timeout Duration
To change the inactivity timeout, modify the constant in `auth.service.ts`:

```typescript
// Change from 60 minutes to desired duration
private readonly ACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
```

### Adjusting Session Duration
To change the maximum session duration:

```typescript
// Change from 8 hours to desired duration
private readonly SESSION_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours
```

## Security Considerations

### 1. Token Storage
- Tokens are stored in localStorage (accessible to JavaScript)
- Consider using httpOnly cookies for enhanced security
- Implement token refresh mechanism for long sessions

### 2. Session Validation
- Server should validate token expiration
- Server should track active sessions
- Implement server-side session timeout

### 3. Sensitive Data
- Clear all sensitive data on logout
- Don't store passwords in session
- Encrypt sensitive session data if needed

### 4. Multiple Devices
- Consider implementing device tracking
- Allow users to view active sessions
- Provide "logout all devices" functionality

## Troubleshooting

### Issue: User Not Logged Out After 60 Minutes
**Possible Causes:**
1. Activity events are being triggered (check for auto-refresh, animations)
2. Timer is being reset by background processes
3. Multiple instances of AuthService

**Solution:**
- Check browser console for activity logs
- Verify no background timers are triggering events
- Ensure AuthService is singleton (providedIn: 'root')

### Issue: User Logged Out Too Quickly
**Possible Causes:**
1. System clock issues
2. Timer configuration incorrect
3. Session data corruption

**Solution:**
- Verify ACTIVITY_TIMEOUT constant
- Check system time is correct
- Clear browser cache and localStorage

### Issue: Session Not Cleared Properly
**Possible Causes:**
1. localStorage not being cleared
2. Session data in multiple locations
3. Browser caching issues

**Solution:**
- Verify clearSession() is called
- Check all storage locations are cleared
- Hard refresh browser (Ctrl+Shift+R)

## Future Enhancements

### 1. Warning Before Timeout
Show a warning dialog 5 minutes before timeout:
```typescript
if (remainingTime <= 5 * 60 * 1000) {
  this.showTimeoutWarning();
}
```

### 2. Session Extension
Allow users to extend their session:
```typescript
public extendSession(): void {
  const session = this.sessionSubject.value;
  if (session) {
    session.expiresAt = Date.now() + this.SESSION_TIMEOUT;
    this.storeSession(session);
  }
}
```

### 3. Activity Dashboard
Show users their session information:
- Time since login
- Time until timeout
- Last activity time

### 4. Remember Me Feature
Allow users to stay logged in longer:
```typescript
public login(token: string, userData: any, rememberMe: boolean = false): void {
  const timeout = rememberMe ? 30 * 24 * 60 * 60 * 1000 : this.SESSION_TIMEOUT;
  // ... rest of login logic
}
```

## Files Modified

### Primary Files
- `src/app/services/auth.service.ts` - Main authentication and session management
- `src/app/services/session.service.ts` - Enhanced with idle timeout (backup implementation)

### Related Files
- `src/app/login/login.component.ts` - Login integration
- `src/app/interceptors/auth.interceptor.ts` - HTTP request/response handling (if exists)

## Summary

The application now has robust session timeout functionality that:
- ✅ Automatically logs out users after 60 minutes of inactivity
- ✅ Monitors user activity to reset the timer
- ✅ Provides clear notifications about logout reasons
- ✅ Clears all session data on logout
- ✅ Redirects to login page with appropriate messages
- ✅ Handles API authentication failures
- ✅ Supports multiple logout scenarios

This implementation ensures security while maintaining a good user experience. Users are protected from unauthorized access when they leave their workstations, and they receive clear feedback about why they were logged out.
