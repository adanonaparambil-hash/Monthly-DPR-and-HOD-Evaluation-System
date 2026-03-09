# Daily Remarks - Show for Completed Status and Save Comment First

## Changes Made

### Modified: `src/app/components/task-details-modal/task-details-modal.component.html`
### Modified: `src/app/components/task-details-modal/task-details-modal.component.ts`

Updated the Daily Remarks functionality to:
1. Show Daily Remarks section for both "Closed" and "Completed" statuses
2. Call `saveComment` API first before `saveTaskBulk` when saving with Closed or Completed status

**Previous Behavior:**
- Daily Remarks section only showed when status was "Closed"
- Daily remarks were saved AFTER task save (via `saveDailyRemarksAsComment()`)
- Completed status didn't show Daily Remarks section

**New Behavior:**
- Daily Remarks section shows for both "Closed" AND "Completed" statuses
- Daily remarks are saved BEFORE task save (via `saveComment` API)
- Sequential API calls: saveComment → saveTaskBulk
- Mandatory validation for both Closed and Completed statuses

## Implementation Details

### 1. HTML Changes - Show Daily Remarks for Completed

**Before:**
```html
@if (!isViewOnly && selectedTaskDetailStatus === 'not-closed') {
  <div class="daily-remarks-compact">
```

**After:**
```html
@if (!isViewOnly && (selectedTaskDetailStatus === 'not-closed' || selectedTaskDetailStatus === 'completed')) {
  <div class="daily-remarks-compact">
```

### 2. TypeScript Changes - Save Comment First

**New Flow:**
```typescript
saveTaskChanges() {
  // Validation...
  
  // If status is CLOSED or COMPLETED with daily remarks
  if ((status === 'not-closed' || status === 'completed') && dailyRemarks) {
    saveCommentThenTask(userId);  // Call comment API first
  } else {
    proceedWithTaskSave(userId);  // Skip to task save
  }
}

saveCommentThenTask(userId) {
  // 1. Call saveComment API
  api.saveComment({ taskId, userId, comment }).subscribe({
    success: () => {
      // 2. Then call saveTaskBulk
      proceedWithTaskSave(userId);
    }
  });
}

proceedWithTaskSave(userId) {
  // Call saveTaskBulk API
  api.saveTaskBulk(taskSaveRequest).subscribe(...);
}
```

## API Call Sequence

### When Status is Closed or Completed with Daily Remarks:
```
1. saveComment API
   ├─ Request: { taskId, userId, comment: dailyRemarks }
   └─ On Success:
      └─ 2. saveTaskBulk API
         ├─ Request: { taskId, status, ...taskData }
         └─ On Success:
            ├─ Close modal
            ├─ Refresh task list
            └─ Update AUTO CLOSED count
```

### When Status is Other (Running, Paused, Not Started):
```
1. saveTaskBulk API (directly)
   ├─ Request: { taskId, status, ...taskData }
   └─ On Success:
      ├─ Close modal
      ├─ Refresh task list
      └─ Update AUTO CLOSED count
```

## Validation Updates

**Daily Remarks Validation:**
```typescript
// Before: Only for Closed
if (status === 'not-closed' && !dailyRemarks.trim()) {
  showError('Daily Remarks is mandatory when closing a task');
}

// After: For both Closed and Completed
if ((status === 'not-closed' || status === 'completed') && !dailyRemarks.trim()) {
  showError('Daily Remarks is mandatory when closing or completing a task');
}
```

## Benefits

1. **Consistent UX**: Both Closed and Completed statuses require daily remarks
2. **Data Integrity**: Comment is saved before task status changes
3. **Better Tracking**: Daily remarks are properly logged as comments
4. **Sequential Processing**: Comment saved first ensures it's associated with correct task state
5. **Error Handling**: If comment save fails, task save doesn't proceed

## User Experience

### When Selecting "Closed" Status:
1. Daily Remarks section appears
2. User enters remarks (mandatory)
3. User clicks Save
4. System saves comment first
5. Then saves task with Closed status
6. Modal closes, list refreshes

### When Selecting "Completed" Status:
1. Daily Remarks section appears (NEW)
2. User enters remarks (mandatory)
3. User clicks Save
4. System saves comment first
5. Then saves task with Completed status
6. Modal closes, list refreshes

## Files Modified

- `src/app/components/task-details-modal/task-details-modal.component.html`
- `src/app/components/task-details-modal/task-details-modal.component.ts`

## Testing Checklist

- [x] Daily Remarks section shows when status is Closed
- [x] Daily Remarks section shows when status is Completed (NEW)
- [x] Daily Remarks is mandatory for Closed status
- [x] Daily Remarks is mandatory for Completed status (NEW)
- [x] saveComment API called before saveTaskBulk for Closed
- [x] saveComment API called before saveTaskBulk for Completed (NEW)
- [x] Task save proceeds after comment save success
- [x] Task save doesn't proceed if comment save fails
- [x] Modal closes after successful save
- [x] Task list refreshes after save
- [x] Other statuses (Running, Paused) don't show Daily Remarks
- [x] Other statuses save directly without comment API call

## Related Components

- Daily Remarks section: Shows for Closed and Completed
- saveComment API: Called first when status is Closed or Completed
- saveTaskBulk API: Called after comment save (or directly for other statuses)
- Validation: Checks for daily remarks when status is Closed or Completed
