# My Task - Manage Tasks Button (HOD Only)

## Overview
Implemented role-based access control in the "My Task" page to hide the "Manage Tasks" button from non-HOD users. Only HOD users can see and access the task category management functionality.

## Changes Made

### File: `src/app/my-task/my-task.component.ts`

#### Added Property
```typescript
// Role flags from session
isHOD = false;  // Flag to check if user is HOD
```

#### Updated ngOnInit Method
Added HOD flag detection from session:

```typescript
ngOnInit() {
  // Subscribe to theme changes
  this.themeService.isDarkMode$.subscribe(isDark => {
    this.isDarkMode = isDark;
  });

  // Get current user data from session and check if HOD
  const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
  const hodFlag = (currentUser.isHOD || '').toString().toUpperCase();
  this.isHOD = hodFlag === 'H';
  console.log('My Task - User is HOD:', this.isHOD, 'HOD Flag:', hodFlag);

  // ... rest of initialization ...
}
```

### File: `src/app/my-task/my-task.component.html`

#### Updated Manage Tasks Button
Added `*ngIf="isHOD"` to restrict access:

```html
<button class="manage-tasks-btn" *ngIf="isHOD" (click)="openManageTasksModal()">
  <i class="fas fa-cog"></i>
  <span>Manage Tasks</span>
</button>
```

## What is "Manage Tasks"?

The "Manage Tasks" button opens a modal that allows users to:
- View all task categories across departments
- Add new task categories
- Edit existing task categories
- Set category sequence numbers
- Mark categories as favorites
- Filter categories by department

This is a management function that should only be accessible to HOD users.

## Location of the Button

The "Manage Tasks" button appears in the "Select Task" modal, which is opened when users click the "New Task" button on the main My Task page.

**Navigation Flow:**
```
My Task Page
  └─> Click "New Task" button
      └─> Select Task Modal opens
          └─> "Manage Tasks" button (HOD only)
```

## User Experience

### For HOD Users
When an HOD clicks "New Task", they see the Select Task modal with:
```
┌─────────────────────────────────────┐
│  Select Task Category               │
│                                     │
│  [Search...]                        │
│                                     │
│  Favorites | My Department | All   │
│                                     │
│  [Task Category 1]                  │
│  [Task Category 2]                  │
│  [Task Category 3]                  │
│                                     │
│  [Manage Tasks] [Close]  ✓ Visible │
└─────────────────────────────────────┘
```

### For Non-HOD Users (Employee/CED)
When a non-HOD user clicks "New Task", they see the Select Task modal with:
```
┌─────────────────────────────────────┐
│  Select Task Category               │
│                                     │
│  [Search...]                        │
│                                     │
│  Favorites | My Department | All   │
│                                     │
│  [Task Category 1]                  │
│  [Task Category 2]                  │
│  [Task Category 3]                  │
│                                     │
│  [Close]                            │
│  (Manage Tasks button is hidden)   │
└─────────────────────────────────────┘
```

## Role Detection

### Session Data
```json
{
  "employeeName": "John Doe",
  "designation": "Manager",
  "isHOD": "H",  // 'H' for HOD, 'E' for Employee, 'C' for CED
  "empId": "ITS48",
  ...
}
```

### Role Check Logic
```typescript
const hodFlag = (currentUser.isHOD || '').toString().toUpperCase();
this.isHOD = hodFlag === 'H';
```

### Role Codes

| Role Code | Description | Can Access Manage Tasks |
|-----------|-------------|------------------------|
| H | HOD (Head of Department) | ✅ Yes |
| E | Employee | ❌ No |
| C | CED | ❌ No |

## Manage Tasks Modal Features (HOD Only)

When HOD clicks "Manage Tasks", they can:

1. **View All Categories**
   - See categories from all departments
   - Filter by specific department
   - View favorite categories

2. **Add New Category**
   - Create new task categories
   - Assign to specific department
   - Set sequence number

3. **Edit Categories**
   - Update category name
   - Change department assignment
   - Modify sequence number

4. **Mark as Favorite**
   - Toggle favorite status for quick access
   - Favorites appear in the "Favorites" tab

## Testing Scenarios

### Scenario 1: HOD User Creates New Task
1. User logs in with `isHOD: 'H'`
2. Navigates to "My Task" page
3. Clicks "New Task" button
4. Select Task modal opens
5. Sees "Manage Tasks" button at the bottom
6. Can click to open task category management modal

### Scenario 2: Employee User Creates New Task
1. User logs in with `isHOD: 'E'`
2. Navigates to "My Task" page
3. Clicks "New Task" button
4. Select Task modal opens
5. Does NOT see "Manage Tasks" button
6. Can only select from existing categories

### Scenario 3: CED User Creates New Task
1. User logs in with `isHOD: 'C'`
2. Navigates to "My Task" page
3. Clicks "New Task" button
4. Select Task modal opens
5. Does NOT see "Manage Tasks" button
6. Can only select from existing categories

## Security Considerations

### Frontend Protection
- Button is hidden using `*ngIf="isHOD"`
- Non-HOD users cannot see or click the button
- Modal cannot be opened by non-HOD users through UI

### Backend Protection (Recommended)
While the frontend hides the button, backend validation is essential:

1. **Task Category APIs**: Verify user is HOD before allowing:
   - Creating new categories
   - Editing existing categories
   - Deleting categories
   - Changing sequence numbers

Example backend validation:
```csharp
if (currentUser.IsHOD != "H")
{
    return Unauthorized("Only HOD users can manage task categories");
}
```

## Benefits

✅ **Role-Based Access**: Only HOD can manage task categories
✅ **Clean UI**: Non-HOD users don't see management options
✅ **Data Integrity**: Prevents unauthorized category modifications
✅ **Consistent**: Follows the same pattern as other HOD-only features
✅ **Session-Based**: Uses existing session data, no additional API calls
✅ **Maintainable**: Simple conditional rendering

## Related Features

This change is part of a broader HOD-only access control implementation:

1. **DPR Approval Menu** - HOD only (in layout)
2. **My Logged Hours Features** - HOD only:
   - Manage Fields button
   - Break History button
   - Employee dropdown filter
3. **My Task Features** - HOD only:
   - Manage Tasks button (this change)

## Files Modified

1. **src/app/my-task/my-task.component.ts**
   - Added `isHOD` property
   - Added HOD flag detection in `ngOnInit()`

2. **src/app/my-task/my-task.component.html**
   - Added `*ngIf="isHOD"` to Manage Tasks button

## Notes

- The button is located in the Select Task modal, not on the main page
- Non-HOD users can still create tasks by selecting from existing categories
- The role check is case-insensitive (converts to uppercase)
- Empty or missing `isHOD` values default to non-HOD access
- Console logging helps debug role detection issues
- Backend validation is strongly recommended for complete security
- Consider adding route guards if there's a direct URL to the manage tasks functionality
