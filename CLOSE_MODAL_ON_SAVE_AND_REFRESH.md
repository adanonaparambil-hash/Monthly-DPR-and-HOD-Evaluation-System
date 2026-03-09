# Task Modal - Close on Save and Refresh Listing

## Changes Made

### Modified: `src/app/components/task-details-modal/task-details-modal.component.ts`

Changed the `saveTaskChanges()` method to always close the modal after successful save, not just on first save.

**Previous Behavior:**
- Modal only closed when saving a new task (taskId === 0)
- Modal remained open when updating existing tasks
- Task listing was not refreshed after save
- AUTO CLOSED count was not rechecked in parent component

**New Behavior:**
- Modal always closes after successful save (both new and existing tasks)
- `taskUpdated` event is emitted to parent component
- Parent component's `onTaskUpdatedFromModal()` handler calls:
  - `loadActiveTasks()` to refresh the listing
  - `checkAutoClosedTasksCount()` to update AUTO CLOSED count
- User sees updated task data immediately after save

### Modified: `src/app/my-task/my-task.component.ts`

Updated the `onTaskUpdatedFromModal()` method to also call `checkAutoClosedTasksCount()` after refreshing the task listing.

## Key Changes

1. **Removed conditional close**: Changed from `if (isNewTask) { this.close(); }` to always calling `this.close()`
2. **Updated console log**: Changed message to "Closing modal after save" to reflect new behavior
3. **Event emission**: Ensured `taskUpdated.emit()` is called before closing to trigger listing refresh
4. **AUTO CLOSED count refresh**: Added `checkAutoClosedTasksCount()` call in parent component handler

## Flow After Save

1. User clicks Save button in task modal
2. API call `saveTaskBulk()` is made
3. On success:
   - Success toaster is shown
   - AUTO CLOSED count is rechecked (in modal component)
   - Field mapping is saved (if needed for new tasks)
   - Daily remarks are saved as comment (if status is CLOSED)
   - `taskUpdated` event is emitted to parent
   - Modal closes automatically
4. Parent component receives `taskUpdated` event
5. Parent calls:
   - `loadActiveTasks()` to refresh the task listing
   - `checkAutoClosedTasksCount()` to update AUTO CLOSED count and blocking status
6. User sees updated task list with latest data and correct AUTO CLOSED alert

## Testing Checklist

- [x] Save new task - modal closes and listing refreshes
- [x] Save existing task - modal closes and listing refreshes
- [x] Task changes are reflected in the listing immediately
- [x] AUTO CLOSED count is updated after save
- [x] AUTO CLOSED alert shows/hides correctly based on count
- [x] No duplicate tasks are created
- [x] Active task header updates if needed

## Files Modified

- `src/app/components/task-details-modal/task-details-modal.component.ts`
- `src/app/my-task/my-task.component.ts`

## Related Components

- Parent component: `src/app/my-task/my-task.component.ts`
- Event handler: `onTaskUpdatedFromModal()` - calls `loadActiveTasks()` and `checkAutoClosedTasksCount()`
- AUTO CLOSED check: `checkAutoClosedTasksCount()` - calls `GetAutoClosedTaskCount` API
