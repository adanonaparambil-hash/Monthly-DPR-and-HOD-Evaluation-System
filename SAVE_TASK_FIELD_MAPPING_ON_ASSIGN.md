# Save Task Field Mapping When Assigning to Different User

## Issue
When creating a new task and assigning it to a different user (not the logged-in user), the custom field mappings were not being saved for the assigned user. This meant the assigned user wouldn't see the custom fields properly mapped to their account.

## Expected Behavior
- When creating a NEW task (taskId = 0)
- AND assigning it to a DIFFERENT user (not the session user)
- AND there are custom fields present
- THEN call `saveTaskFieldMapping` API to map the fields to the assigned user
- This should only happen ONCE during initial task creation

## Solution

### File: `src/app/components/task-details-modal/task-details-modal.component.ts`

Modified the `saveTaskChanges()` method to call `saveTaskFieldMapping` after successful task save:

```typescript
this.api.saveTaskBulk(taskSaveRequest).subscribe({
  next: (response: any) => {
    console.log('=== saveTaskBulk API Response ===');
    console.log('Response:', response);
    
    if (response && response.success) {
      this.toasterService.showSuccess('Success', 'Task updated successfully');
      
      // Check if we need to call saveTaskFieldMapping
      // Only for new tasks (taskId === 0) when assigning to a different user
      const isNewTask = this.taskId === 0;
      const assignedUserId = this.selectedAssigneeId;
      const sessionUserId = userId;
      const isDifferentUser = assignedUserId && assignedUserId !== sessionUserId;
      
      if (isNewTask && isDifferentUser && this.selectedCustomFields.length > 0) {
        console.log('New task assigned to different user - calling saveTaskFieldMapping');
        
        // Extract field IDs from custom fields
        const fieldIds = this.selectedCustomFields
          .filter(field => field.fieldId && field.fieldId > 0)
          .map(field => field.fieldId!);
        
        if (fieldIds.length > 0) {
          const fieldMappingRequest: any = {
            categoryId: this.categoryId,
            fieldIds: fieldIds,
            userId: assignedUserId
          };
          
          console.log('Field mapping request:', fieldMappingRequest);
          
          this.api.saveTaskFieldMapping(fieldMappingRequest).subscribe({
            next: (mappingResponse: any) => {
              if (mappingResponse && mappingResponse.success) {
                console.log('Field mapping saved successfully');
              } else {
                console.warn('Field mapping failed:', mappingResponse?.message);
              }
            },
            error: (mappingError: any) => {
              console.error('Error saving field mapping:', mappingError);
            }
          });
        }
      }
      
      this.taskUpdated.emit(taskSaveRequest);
      console.log('Task saved successfully');
    } else {
      const errorMessage = response?.message || 'Failed to update task';
      this.toasterService.showError('Error', errorMessage);
      console.error('Save failed:', errorMessage);
    }
  },
  error: (error: any) => {
    // ... error handling ...
  }
});
```

## Logic Flow

1. **Save Task** - Call `saveTaskBulk` API first
2. **Check Conditions** - After successful save, check if:
   - `isNewTask` - taskId === 0 (new task, not editing existing)
   - `isDifferentUser` - assignedUserId !== sessionUserId (assigning to someone else)
   - `hasCustomFields` - selectedCustomFields.length > 0 (there are fields to map)
3. **Extract Field IDs** - Get all fieldIds from selectedCustomFields (filter out invalid ones)
4. **Call saveTaskFieldMapping** - If all conditions met and fieldIds exist:
   - categoryId: The task category ID
   - fieldIds: Array of custom field IDs
   - userId: The assigned user's ID (not the session user)
5. **Silent Execution** - Field mapping happens in background, doesn't block main flow

## API Details

### saveTaskFieldMapping API
- **Endpoint**: `DailyTimeSheet/SaveMapping`
- **Method**: POST
- **Request**:
  ```typescript
  {
    categoryId: number,
    fieldIds: number[],
    userId: string
  }
  ```

## Conditions for Calling saveTaskFieldMapping

| Condition | Check | Required |
|-----------|-------|----------|
| New Task | `taskId === 0` | ✅ Yes |
| Different User | `assignedUserId !== sessionUserId` | ✅ Yes |
| Has Custom Fields | `selectedCustomFields.length > 0` | ✅ Yes |
| Valid Field IDs | `fieldIds.length > 0` | ✅ Yes |

## When saveTaskFieldMapping is NOT Called

- Editing existing task (taskId > 0)
- Assigning to self (assignedUserId === sessionUserId)
- No custom fields present
- No valid field IDs

## Result
- Custom fields are properly mapped to the assigned user
- Assigned user can see and use the custom fields
- Field mapping happens automatically during task creation
- Only happens once during initial assignment
- Silent operation - doesn't interrupt user flow
- Error handling logs issues without blocking task save

## User Experience
- Seamless field mapping when assigning tasks to others
- No additional steps required from user
- Custom fields work correctly for assigned users
- Transparent background operation
