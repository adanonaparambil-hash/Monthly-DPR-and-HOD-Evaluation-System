# New Task - Status Dropdown Locked to "NOT STARTED"

## Issue
When a user assigns a new task from the "Select Task" modal (taskId = 0), the status dropdown was enabled, allowing users to change the status before saving the task. This was incorrect - new tasks should always be "NOT STARTED" until they are saved.

## Expected Behavior
- When taskId = 0 (new task), the status dropdown should be disabled
- Status should be locked to "NOT STARTED" 
- Users can only change the status AFTER saving the task
- Once saved, the task gets a taskId and the status dropdown becomes enabled

## Solution

### File: `src/app/components/task-details-modal/task-details-modal.component.html`

Added condition to disable the status dropdown when `taskId === 0`:

**Before:**
```html
<select class="modal-status-select" 
        [(ngModel)]="selectedTaskDetailStatus" 
        [disabled]="isViewOnly">
```

**After:**
```html
<select class="modal-status-select" 
        [(ngModel)]="selectedTaskDetailStatus" 
        [disabled]="isViewOnly || taskId === 0">
```

### File: `src/app/components/task-details-modal/task-details-modal.component.ts`

The TypeScript already correctly initializes new tasks with "not-started" status:

```typescript
ngOnInit() {
  // ...
  
  if (this.taskId && this.taskId > 0 && this.userId && this.categoryId) {
    // Load existing task details
    this.loadTaskDetails();
  } else if (this.categoryId && this.userId) {
    // New task - set default status
    this.selectedTaskDetailStatus = 'not-started';
    this.editableTaskTitle = '';
    this.editableTaskDescription = '';
    this.dailyRemarks = '';
    this.selectedTaskProgress = 0;
    this.taskProgress = 0;
  }
}
```

## Changes Made
1. Added `taskId === 0` condition to the `[disabled]` attribute of the status dropdown
2. Status dropdown is now disabled when:
   - `isViewOnly` is true (view-only mode)
   - `taskId === 0` (new task that hasn't been saved yet)

## Result
- New tasks (taskId = 0) have status dropdown disabled
- Status is locked to "NOT STARTED" for new tasks
- Users cannot change status until after saving the task
- After saving, the task gets a taskId and status dropdown becomes enabled
- Prevents invalid status changes on unsaved tasks

## User Experience
- Clear indication that new tasks must be saved before status can be changed
- Prevents confusion about task state
- Enforces proper workflow: Create → Save → Then manage status
- Status dropdown appears grayed out/disabled for new tasks
