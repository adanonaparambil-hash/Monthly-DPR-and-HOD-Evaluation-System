# Session Management Setup Guide

## Quick Implementation Steps

To complete the session management implementation, you need to configure the Angular application to use the new services and guards.

### 1. Configure HTTP Interceptor

Add the AuthInterceptor to your app configuration. If using standalone components (Angular 15+), add to `main.ts`:

```typescript
// In main.ts
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './app/interceptors/auth.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    // ... other providers
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ]
});
```

Or if using traditional modules, add to `app.module.ts`:

```typescript
// In app.module.ts
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './interceptors/auth.interceptor';

@NgModule({
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ]
})
export class AppModule { }
```

### 2. Protect Routes with AuthGuard

Update your routing configuration to protect routes:

```typescript
// In app-routing.module.ts or app.routes.ts
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { 
    path: '', 
    component: LayoutComponent,
    canActivate: [AuthGuard], // Protect the entire layout
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'monthly-dpr', component: MonthlyDprComponent },
      { path: 'past-reports', component: PastReportsComponent },
      { path: 'emergency-exit-form', component: EmergencyExitFormComponent },
      // ... other protected routes
    ]
  },
  { path: '**', redirectTo: '/login' }
];
```

### 3. Update Login Success Handler

Modify your login component to use the SessionService:

```typescript
// In login.component.ts
import { SessionService } from '../services/session.service';

constructor(
  private router: Router,
  private api: Api,
  private toastr: ToastrService,
  private route: ActivatedRoute,
  private sessionService: SessionService // Add this
) {}

// Update your login success method
onLoginSuccess(response: any) {
  // Set session using SessionService
  this.sessionService.setSession(response.token, response.user);
  
  // Get return URL from query params
  const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
  
  // Navigate to return URL or default dashboard
  this.router.navigate([returnUrl]);
  
  this.toastr.success('Login successful!', 'Welcome');
}
```

### 4. Test the Implementation

1. **Test Session Expiry**:
   - Login to the application
   - Clear localStorage or modify the token
   - Make any API call or navigate to a protected route
   - Verify redirect to login with session expiry message

2. **Test Route Protection**:
   - Try to access a protected route without logging in
   - Verify redirect to login
   - Login and verify return to intended page

3. **Test Time-Based Expiry**:
   - Modify session duration in `session.service.ts` to 1 minute for testing
   - Login and wait for expiry
   - Verify automatic logout

## Current Implementation Status

✅ **Completed**:
- HTTP Interceptor for global session handling
- Session Service for centralized session management
- Auth Guard for route protection
- Login component session expiry messaging
- Layout component session validation
- API service error handling

⚠️ **Needs Configuration**:
- HTTP Interceptor registration in app module/main.ts
- Route protection with AuthGuard
- Login success handler update

## Benefits You'll Get

1. **Automatic Session Handling**: Users automatically redirected on session expiry
2. **Secure Routes**: Protected routes require valid sessions
3. **Better UX**: Clear messaging and return URL functionality
4. **Centralized Management**: All session logic in one place
5. **Global Coverage**: All API calls protected by interceptor

## Troubleshooting

### Common Issues:

1. **Interceptor Not Working**:
   - Ensure HTTP_INTERCEPTORS is properly registered
   - Check that HttpClientModule is imported

2. **Guard Not Protecting Routes**:
   - Verify AuthGuard is added to route configuration
   - Check that SessionService is properly injected

3. **Session Not Persisting**:
   - Verify localStorage is working
   - Check browser developer tools for session data

4. **Redirect Loop**:
   - Ensure login route is not protected by AuthGuard
   - Check that session validation logic is correct

### Debug Tips:

1. **Enable Console Logging**: All services include console.log statements for debugging
2. **Check Network Tab**: Monitor API calls for 401 responses
3. **Inspect localStorage**: Verify session data is stored correctly
4. **Test in Incognito**: Ensure clean session state for testing