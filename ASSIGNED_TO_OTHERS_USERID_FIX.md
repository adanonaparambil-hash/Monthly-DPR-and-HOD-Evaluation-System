# Assigned To Others - UserId Fix

## Issue
When clicking on a task from the "ASSIGNED TO OTHERS" tab, the `getTaskById` API was incorrectly using the current logged-in user's ID from the session instead of the assignee's userId from the selected task record.

## Root Cause
The `openTaskDetailsModal` method was always getting the userId from the session:
```typescript
const currentUser = this.sessionService.getCurrentUser();
const userId = currentUser?.empId || currentUser?.employeeId || '';
```

This was incorrect for "ASSIGNED TO OTHERS" tasks because:
- These tasks are assigned TO other users
- The API needs the assignee's userId (the person the task is assigned to)
- Not the current logged-in user's userId

## Solution
Modified the `openTaskDetailsModal` method to conditionally determine the userId based on which tab is active:

### Logic
1. **If "ASSIGNED TO OTHERS" tab**: Use `task.assigneeId` (the person the task is assigned to)
2. **If "MY TASKS" tab**: Use session userId (current logged-in user)

### Code Changes

**File**: `src/app/my-task/my-task.component.ts`

**Before:**
```typescript
openTaskDetailsModal(task: Task) {
  // Get current user
  const currentUser = this.sessionService.getCurrentUser();
  const userId = currentUser?.empId || currentUser?.employeeId || '';
  
  // ... rest of the code
}
```

**After:**
```typescript
openTaskDetailsModal(task: Task) {
  // For "ASSIGNED TO OTHERS" tab, use the assignee's userId from the task
  // For "MY TASKS" tab, use the current user's userId from session
  let userId: string;
  
  if (this.activeTab === 'ASSIGNED TO OTHERS') {
    // Use the assigneeId from the task (the person the task is assigned to)
    userId = task.assigneeId || '';
    console.log('Opening task from ASSIGNED TO OTHERS - using assigneeId:', userId);
  } else {
    // Use current user's ID from session
    const currentUser = this.sessionService.getCurrentUser();
    userId = currentUser?.empId || currentUser?.employeeId || '';
    console.log('Opening task from MY TASKS - using session userId:', userId);
  }
  
  // ... rest of the code
}
```

## Data Flow

### MY TASKS Tab
1. User clicks on their own task
2. `activeTab` = "MY TASKS"
3. `userId` = Current user's ID from session
4. API called with: `getTaskById(taskId, userId, categoryId)`
5. Returns task details for the current user

### ASSIGNED TO OTHERS Tab
1. User clicks on a task they assigned to someone else
2. `activeTab` = "ASSIGNED TO OTHERS"
3. `userId` = `task.assigneeId` (the person the task is assigned to)
4. API called with: `getTaskById(taskId, assigneeId, categoryId)`
5. Returns task details for the assignee

## API Parameters

### getTaskById API
```typescript
{
  taskId: number,      // From selected task
  userId: string,      // From task.assigneeId (ASSIGNED TO OTHERS) or session (MY TASKS)
  categoryId: number   // From task or lookup
}
```

## Task Interface Fields Used

From `ActiveTaskDto`:
- `assigneeId`: The userId of the person the task is assigned to
- `assigneeName`: The name of the assignee
- `assignedById`: The userId of the person who assigned the task
- `assignedByName`: The name of the person who assigned the task

## Benefits

1. ✅ **Correct Data**: API now receives the correct userId for each scenario
2. ✅ **Proper Task Details**: Task details are fetched for the right user
3. ✅ **View-Only Mode**: Works correctly with view-only mode for "ASSIGNED TO OTHERS"
4. ✅ **Logging**: Added console logs for debugging
5. ✅ **Clear Logic**: Conditional logic makes it clear which userId is used when

## Testing Scenarios

### Scenario 1: Open Task from MY TASKS
1. User is on "MY TASKS" tab
2. User clicks on their own task
3. ✅ userId = Current user's ID from session
4. ✅ API fetches task details for current user
5. ✅ Modal opens with full edit permissions

### Scenario 2: Open Task from ASSIGNED TO OTHERS
1. User is on "ASSIGNED TO OTHERS" tab
2. User clicks on a task they assigned to someone else
3. ✅ userId = Assignee's ID from task record
4. ✅ API fetches task details for the assignee
5. ✅ Modal opens in view-only mode

### Scenario 3: Task with Missing AssigneeId
1. User clicks on task from "ASSIGNED TO OTHERS"
2. Task has no assigneeId
3. ✅ userId = '' (empty string)
4. ✅ API handles gracefully

## Console Logging

Added detailed logging for debugging:
```typescript
console.log('Opening task from ASSIGNED TO OTHERS - using assigneeId:', userId);
console.log('Opening task from MY TASKS - using session userId:', userId);
console.log('Opening task details modal:', {
  taskId: task.id,
  userId: userId,
  categoryId: categoryId,
  activeTab: this.activeTab,
  assigneeId: task.assigneeId
});
```

## Related Features

This fix works in conjunction with:
1. **View-Only Mode**: Tasks from "ASSIGNED TO OTHERS" open in view-only mode
2. **Tab Filtering**: Tasks are filtered based on active tab
3. **Task Lists**: `myTasksList` vs `assignedByMeList`

## Edge Cases Handled

1. ✅ **Missing assigneeId**: Falls back to empty string
2. ✅ **Tab switching**: Correctly determines userId based on current tab
3. ✅ **Session data missing**: Handles gracefully with fallback
4. ✅ **Task conversion**: assigneeId is properly mapped from ActiveTaskDto to Task

## Files Modified

1. `src/app/my-task/my-task.component.ts`
   - Modified `openTaskDetailsModal` method
   - Added conditional logic for userId determination
   - Added console logging for debugging

## Testing Checklist

- [x] Open task from MY TASKS - uses session userId
- [x] Open task from ASSIGNED TO OTHERS - uses task.assigneeId
- [x] API receives correct userId parameter
- [x] Task details load correctly for both scenarios
- [x] View-only mode works for ASSIGNED TO OTHERS
- [x] Console logs show correct userId values
- [x] No TypeScript errors
- [x] No build errors

## Impact

This fix ensures that:
- Task details are fetched for the correct user
- Comments, activity logs, and custom fields are loaded for the right user
- The API receives accurate parameters
- View-only mode works as intended

## Notes

- The `assigneeId` field comes from the `ActiveTaskDto` interface
- The Task interface includes `assigneeId` for this purpose
- The fix maintains backward compatibility with existing code
- Console logs can be removed in production if needed
