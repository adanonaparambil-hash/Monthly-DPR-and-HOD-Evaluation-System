# Session Management & 431 Error Fixes

## Issues Addressed

### 1. **431 Request Header Fields Too Large Error**
- **Cause**: Accumulating large headers, cookies, and URL parameters over time
- **Solution**: Implemented comprehensive header and URL cleanup mechanisms

### 2. **Missing Automatic Session Expiry**
- **Cause**: No proper session timeout handling
- **Solution**: Added automatic session monitoring with configurable timeouts

### 3. **No Inactivity Logout**
- **Cause**: Users staying logged in indefinitely without activity
- **Solution**: Implemented activity-based session management

## New Components & Services

### 1. **Enhanced AuthService** (`src/app/services/auth.service.ts`)
- **Session Management**: Proper session storage with expiration times
- **Activity Monitoring**: Tracks user activity and auto-logout on inactivity
- **URL Cleanup**: Prevents URL parameters from growing too large
- **Storage Management**: Intelligent cleanup of localStorage and sessionStorage

**Key Features:**
- 8-hour session timeout (configurable)
- 30-minute inactivity timeout (configurable)
- Automatic storage cleanup
- URL parameter optimization

### 2. **Updated AuthInterceptor** (`src/app/interceptors/auth.interceptor.ts`)
- **431 Error Handling**: Specific handling for "Request Header Fields Too Large"
- **Header Optimization**: Removes unnecessary headers to prevent 431 errors
- **Storage Cleanup**: Clears large cookies and storage on 431 errors
- **Better Error Messages**: User-friendly error notifications

**Key Features:**
- Automatic header size optimization
- Large cookie cleanup
- Comprehensive error handling
- Storage size management

### 3. **SessionMonitorComponent** (`src/app/components/session-monitor.component.ts`)
- **Visual Warnings**: Shows session expiry warnings to users
- **Session Extension**: Allows users to extend their session
- **Real-time Monitoring**: Updates every 30 seconds
- **Mobile Responsive**: Works on all screen sizes

**Key Features:**
- 5-minute warning before session expiry
- One-click session extension
- Dismissible warnings
- Countdown timer display

### 4. **URL Cleanup Utility** (`src/app/utils/url-cleanup.util.ts`)
- **URL Length Management**: Prevents URLs from becoming too long
- **Parameter Cleanup**: Removes unnecessary tracking parameters
- **Safe Navigation**: Ensures URLs stay within server limits
- **Memory Management**: Prevents navigation state memory leaks

**Key Features:**
- 2000 character URL limit
- 500 character parameter limit
- Automatic parameter truncation
- Sensitive data removal

## Implementation Details

### Session Timeouts
```typescript
SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours
ACTIVITY_TIMEOUT = 30 * 60 * 1000;    // 30 minutes
WARNING_THRESHOLD = 5 * 60 * 1000;    // 5 minutes warning
```

### Automatic Cleanup Triggers
1. **Every HTTP Request**: Headers and URL cleanup
2. **User Activity**: Session extension and activity tracking
3. **431 Error**: Complete storage and cookie cleanup
4. **Session Expiry**: Full logout with reason tracking

### Error Handling Matrix
| Error Code | Action | User Message |
|------------|--------|--------------|
| 401 | Auto logout | "Session expired" |
| 403 | Show error | "Access denied" |
| 431 | Clear storage + logout | "Session reset required" |
| 500 | Show error | "Server error" |
| 0 | Show error | "Connection error" |

## Usage Instructions

### 1. **Login Process**
```typescript
// Old way
localStorage.setItem('access_token', token);

// New way
this.authService.login(token, userData);
```

### 2. **Logout Process**
```typescript
// Manual logout
this.authService.logout('manual');

// Automatic logout (handled by service)
// - Session expiry: logout('session_expired')
// - Inactivity: logout('inactivity') 
// - Unauthorized: logout('unauthorized')
```

### 3. **Session Monitoring**
```html
<!-- Add to layout -->
<app-session-monitor></app-session-monitor>
```

### 4. **Activity Tracking**
```typescript
// Automatic tracking on:
// - Mouse movements
// - Keyboard input
// - Scrolling
// - Touch events
// - HTTP requests
```

## Configuration Options

### AuthService Configuration
```typescript
// Modify these constants in auth.service.ts
SESSION_TIMEOUT = 8 * 60 * 60 * 1000;  // Session duration
ACTIVITY_TIMEOUT = 30 * 60 * 1000;     // Inactivity timeout
```

### URL Cleanup Configuration
```typescript
// Modify these constants in url-cleanup.util.ts
MAX_URL_LENGTH = 2000;      // Maximum URL length
MAX_PARAM_LENGTH = 500;     // Maximum parameter length
```

### Session Monitor Configuration
```typescript
// Modify these constants in session-monitor.component.ts
WARNING_THRESHOLD = 5 * 60 * 1000;  // Warning time before expiry
```

## Benefits

### 1. **Prevents 431 Errors**
- Automatic header size management
- URL parameter cleanup
- Storage size optimization
- Cookie management

### 2. **Enhanced Security**
- Automatic session expiry
- Inactivity-based logout
- Proper session cleanup
- Sensitive data removal

### 3. **Better User Experience**
- Visual session warnings
- One-click session extension
- Clear logout reasons
- Responsive design

### 4. **Improved Performance**
- Reduced header sizes
- Optimized storage usage
- Efficient memory management
- Faster API calls

## Testing Scenarios

### 1. **431 Error Testing**
- Create large localStorage data
- Add many URL parameters
- Verify automatic cleanup

### 2. **Session Expiry Testing**
- Wait for session timeout
- Verify automatic logout
- Check warning display

### 3. **Inactivity Testing**
- Leave browser idle for 30+ minutes
- Verify inactivity logout
- Test activity detection

### 4. **Error Handling Testing**
- Simulate various HTTP errors
- Verify appropriate responses
- Check user notifications

## Migration Notes

### Existing Code Updates Required
1. Replace direct localStorage usage with AuthService
2. Update login components to use new AuthService
3. Add SessionMonitorComponent to layouts
4. Update error handling in components

### Backward Compatibility
- Old token storage methods still work
- Gradual migration possible
- No breaking changes to existing APIs

## Monitoring & Debugging

### Console Logs
- Session creation/destruction
- Activity tracking
- Error handling
- Storage cleanup

### User Notifications
- Session warnings
- Logout reasons
- Error messages
- Success confirmations

This implementation provides a robust solution for session management and prevents 431 errors while maintaining excellent user experience.