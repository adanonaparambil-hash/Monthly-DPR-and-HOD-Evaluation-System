# Status Dropdown Save Fix

## Issue
When changing the status dropdown to "Completed" in the task modal, the dropdown shows "Completed", but when clicking Save, the old status is being saved instead of the new status from the dropdown.

## Root Cause
The status dropdown was using one-way binding `[value]="selectedTaskDetailStatus"` with a `(change)` event. This meant:
1. When the dropdown changed, `onStatusChange()` was called
2. `onStatusChange()` updated `selectedTaskDetailStatus` 
3. But the dropdown's displayed value didn't update because `[value]` is one-way
4. When Save was clicked, it used the updated `selectedTaskDetailStatus` value, but the UI showed the old value

The issue was a UI synchronization problem - the internal state was correct, but the dropdown display wasn't updating.

## Solution
Changed the status dropdown from one-way binding to two-way binding using `[(ngModel)]`:

**Before:**
```html
<select class="modal-status-select" 
        [value]="selectedTaskDetailStatus" 
        (change)="onStatusChange($any($event.target).value)" 
        [disabled]="isViewOnly || taskId === 0">
```

**After:**
```html
<select class="modal-status-select" 
        [(ngModel)]="selectedTaskDetailStatus" 
        (ngModelChange)="onStatusChange($event)" 
        [disabled]="isViewOnly || taskId === 0">
```

## Benefits
1. Two-way binding ensures the dropdown value and component state stay synchronized
2. `(ngModelChange)` is cleaner than `(change)` with `$any($event.target).value`
3. The dropdown now correctly displays the selected status
4. Save button uses the correct status value from the dropdown

## Files Modified
- `src/app/components/task-details-modal/task-details-modal.component.html`

## Testing
1. Open task modal
2. Change status dropdown to "Completed"
3. Verify dropdown shows "Completed"
4. Click Save
5. Verify task is saved with "Completed" status

## Status
✅ **FIXED** - Status dropdown now correctly saves the selected status value.
