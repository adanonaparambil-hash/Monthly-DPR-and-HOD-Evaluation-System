# DPR Approval - HOD Only Access

## Overview
Implemented role-based access control to hide the "DPR Approval" menu item from non-HOD users. Only users with HOD (Head of Department) role can see and access the DPR Approval page.

## Changes Made

### File: `src/app/layout/layout.html`

#### Updated DPR Menu Section

Added `*ngIf="isHod"` condition to the DPR Approval menu item:

```html
<!-- DPR Approval - Only visible for HOD -->
<a *ngIf="isHod" routerLink="/dpr-approval" routerLinkActive="active" (click)="navigateDPRRoute('/dpr-approval')">
  <i class="fas fa-tasks"></i>
  <span>DPR Approval</span>
</a>
```

## How It Works

### 1. Session Data
When a user logs in, the session data is stored in `localStorage` with the key `current_user`:

```json
{
  "employeeName": "John Doe",
  "designation": "Manager",
  "isHOD": "H",  // 'H' for HOD, 'E' for Employee, 'C' for CED
  "empId": "ITS48",
  ...
}
```

### 2. Role Detection
The layout component (`layout.ts`) already has role detection logic:

```typescript
userSession = JSON.parse(localStorage.getItem('current_user') || '{}');

// Role flags derived from session (isHOD: 'E' employee, 'C' CED, 'H' HOD)
get isEmployee(): boolean {
  const code = (this.userSession?.isHOD || '').toString().toUpperCase();
  return code === 'E';
}

get isHod(): boolean {
  const code = (this.userSession?.isHOD || '').toString().toUpperCase();
  return code === 'H';
}

get isCed(): boolean {
  const code = (this.userSession?.isHOD || '').toString().toUpperCase();
  return code === 'C';
}
```

### 3. Conditional Display
The menu item is now conditionally displayed based on the `isHod` flag:

- **HOD Users** (`isHOD: 'H'`): Can see and access "DPR Approval"
- **Employee Users** (`isHOD: 'E'`): Cannot see "DPR Approval"
- **CED Users** (`isHOD: 'C'`): Cannot see "DPR Approval"

## User Experience

### For HOD Users
When an HOD logs in, they will see:
```
DPR Management
├── My Task
├── My Logged Hours
└── DPR Approval  ✓ (Visible)
```

### For Non-HOD Users (Employee/CED)
When a non-HOD user logs in, they will see:
```
DPR Management
├── My Task
└── My Logged Hours
    (DPR Approval is hidden)
```

## Role Codes

| Role Code | Description | Can Access DPR Approval |
|-----------|-------------|------------------------|
| H | HOD (Head of Department) | ✅ Yes |
| E | Employee | ❌ No |
| C | CED | ❌ No |

## Security Notes

### Frontend Protection
- Menu item is hidden using `*ngIf="isHod"`
- Users cannot see or click the menu item if they're not HOD

### Backend Protection (Recommended)
While the frontend hides the menu, it's recommended to also add backend validation:
- API endpoints for DPR approval should verify the user's HOD status
- Return 403 Forbidden if a non-HOD user tries to access approval endpoints
- This prevents direct API access bypassing the UI

## Testing Scenarios

### Scenario 1: HOD User Login
1. User logs in with `isHOD: 'H'`
2. Navigates to DPR section
3. Sees "DPR Approval" menu item
4. Can click and access the approval page

### Scenario 2: Employee User Login
1. User logs in with `isHOD: 'E'`
2. Navigates to DPR section
3. Does NOT see "DPR Approval" menu item
4. Only sees "My Task" and "My Logged Hours"

### Scenario 3: CED User Login
1. User logs in with `isHOD: 'C'`
2. Navigates to DPR section
3. Does NOT see "DPR Approval" menu item
4. Only sees "My Task" and "My Logged Hours"

### Scenario 4: Direct URL Access (Non-HOD)
1. Non-HOD user tries to access `/dpr-approval` directly
2. Frontend allows navigation (route is not protected)
3. Backend should validate and return 403 Forbidden
4. **Recommendation**: Add route guard for additional protection

## Additional Security Recommendations

### 1. Add Route Guard
Create a route guard to prevent non-HOD users from accessing the route:

```typescript
// hod.guard.ts
export const hodGuard: CanActivateFn = (route, state) => {
  const userSession = JSON.parse(localStorage.getItem('current_user') || '{}');
  const isHod = (userSession?.isHOD || '').toString().toUpperCase() === 'H';
  
  if (!isHod) {
    // Redirect to unauthorized page or dashboard
    return false;
  }
  return true;
};
```

Apply to route:
```typescript
{ 
  path: 'dpr-approval', 
  component: DprApprovalComponent,
  canActivate: [hodGuard]
}
```

### 2. Backend Validation
Ensure all DPR approval API endpoints validate the user's HOD status:

```csharp
// Example backend validation
if (currentUser.IsHOD != "H")
{
    return Unauthorized("Only HOD users can access DPR approval");
}
```

## Files Modified

1. **src/app/layout/layout.html**
   - Added `*ngIf="isHod"` condition to DPR Approval menu item
   - Menu item now only renders for HOD users

## Benefits

✅ **Role-Based Access**: Only HOD users can see the DPR Approval menu
✅ **Clean UI**: Non-HOD users don't see options they can't use
✅ **Session-Based**: Uses existing session data, no additional API calls
✅ **Maintainable**: Uses existing `isHod` getter from layout component
✅ **Consistent**: Follows the same pattern as other role-based menu items

## Notes

- The `isHod` getter is already implemented in `layout.ts`
- The session data is loaded from `localStorage` on component initialization
- The role check is case-insensitive (converts to uppercase)
- Empty or missing `isHOD` values default to non-HOD access
- Consider adding route guards for additional security
- Backend validation is recommended for complete security
