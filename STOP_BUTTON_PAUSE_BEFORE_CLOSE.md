# Stop Button - Pause Before Close

## Issue
When a user clicks the "Stop" button in the task modal to change the status to CLOSED, if the task is currently in RUNNING mode, the task continues to run in the background. This causes issues because the timer keeps running even though the user intended to close the task. Additionally, the task list in the parent component needs to be refreshed to show the updated status.

## Requirement
When the user clicks the Stop button inside the modal:
1. If the task is in RUNNING mode, first PAUSE the task (call executeTimer API with PAUSED action)
2. Then change the status to CLOSED
3. Then show the Daily Remarks section
4. Emit event to parent component to refresh the task list
5. If the task is NOT in RUNNING mode, just change the status to CLOSED directly and refresh the list

## Solution

### Updated Method: `stopTaskFromModal()`

**File**: `src/app/components/task-details-modal/task-details-modal.component.ts`

```typescript
stopTaskFromModal() {
  // If task is currently RUNNING, pause it first before changing to CLOSED
  if (this.selectedTaskDetailStatus === 'running') {
    console.log('Task is RUNNING - pausing before closing');
    
    // Call executeTimer API with PAUSED action
    const timerRequest = {
      taskId: this.taskId,
      userId: this.userId,
      action: 'PAUSED'
    };
    
    this.api.executeTimer(timerRequest).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          console.log('Task paused successfully, now changing to CLOSED');
          this.stopTimer();
          this.selectedTaskDetailStatus = 'not-closed';
          this.toasterService.showInfo('Task Status Changed', 'Task paused and status changed to Closed');
          
          // Emit event to parent component to refresh task list
          this.taskStopped.emit(this.taskId);
          
          // Recheck AUTO CLOSED count after stopping
          this.checkAutoClosedTasksCount();
        } else {
          this.toasterService.showError('Pause Failed', 'Failed to pause task before closing');
          console.error('Failed to pause task:', response?.message);
        }
      },
      error: (error: any) => {
        console.error('Error pausing task before closing:', error);
        this.toasterService.showError('Error', 'Failed to pause task before closing');
      }
    });
  } else {
    // Task is not running, just change status to CLOSED
    this.stopTimer();
    this.selectedTaskDetailStatus = 'not-closed';
    this.toasterService.showInfo('Task Status Changed', 'Task status changed to Closed');
    
    // Emit event to parent component to refresh task list
    this.taskStopped.emit(this.taskId);
    
    // Recheck AUTO CLOSED count after stopping
    this.checkAutoClosedTasksCount();
  }
}
```

### Parent Component Handler

**File**: `src/app/my-task/my-task.component.ts`

```typescript
// Handle task stopped event from modal
onTaskStoppedFromModal(taskId: number) {
  console.log('Task stopped from modal:', taskId);
  // Reload active tasks to refresh the listing
  this.loadActiveTasks();
  // Keep modal open - don't close it
}
```

**File**: `src/app/my-task/my-task.component.html`

```html
<app-task-details-modal
  [taskId]="selectedTaskIdForModal"
  [userId]="selectedUserIdForModal"
  [categoryId]="selectedCategoryIdForModal"
  [isViewOnly]="isTaskModalViewOnly"
  (closeModal)="closeTaskDetailsModal()"
  (taskUpdated)="onTaskUpdatedFromModal($event)"
  (taskPaused)="onTaskPausedFromModal($event)"
  (taskResumed)="onTaskResumedFromModal($event)"
  (taskStopped)="onTaskStoppedFromModal($event)">
</app-task-details-modal>
```

## Workflow

### Scenario 1: Task is RUNNING

```
User clicks Stop button
  ↓
Check if status === 'running'
  ↓ (YES)
Call executeTimer API with action='PAUSED'
  ↓ (success)
Stop local timer
  ↓
Change status to 'not-closed' (CLOSED)
  ↓
Emit taskStopped event with taskId
  ↓
Parent component receives event
  ↓
Parent calls loadActiveTasks() to refresh list
  ↓
Show toaster: "Task paused and status changed to Closed"
  ↓
Daily Remarks section appears (mandatory)
  ↓
Recheck AUTO CLOSED count
```

### Scenario 2: Task is NOT RUNNING (PAUSED, NOT STARTED, etc.)

```
User clicks Stop button
  ↓
Check if status === 'running'
  ↓ (NO)
Stop local timer
  ↓
Change status to 'not-closed' (CLOSED)
  ↓
Emit taskStopped event with taskId
  ↓
Parent component receives event
  ↓
Parent calls loadActiveTasks() to refresh list
  ↓
Show toaster: "Task status changed to Closed"
  ↓
Daily Remarks section appears (mandatory)
  ↓
Recheck AUTO CLOSED count
```

## API Calls

### When Task is RUNNING
1. **executeTimer API** with `action: 'PAUSED'`
   - Request:
     ```json
     {
       "taskId": 123,
       "userId": "EMP001",
       "action": "PAUSED"
     }
     ```
   - Response: Task paused successfully
   - Effect: Timer stops on backend, task status changes to PAUSED

2. **Event Emission**: `taskStopped.emit(taskId)`
   - Parent component receives the event
   - Parent calls `loadActiveTasks()` API to refresh the task list

3. **Status Change** (local only)
   - Component status changes from 'running' → 'not-closed'
   - Daily Remarks section becomes visible

### When Task is NOT RUNNING
1. **Event Emission**: `taskStopped.emit(taskId)`
   - Parent component receives the event
   - Parent calls `loadActiveTasks()` API to refresh the task list

2. **Status Change** (local only)
   - Component status changes from current status → 'not-closed'
   - Daily Remarks section becomes visible

## Benefits

1. ✅ **Prevents Background Running**: Task timer stops on backend when user closes the task
2. ✅ **Data Integrity**: Ensures task is properly paused before closing
3. ✅ **Accurate Time Tracking**: No time leakage from tasks running in background
4. ✅ **List Refresh**: Task list automatically refreshes to show updated status
5. ✅ **Better UX**: User sees confirmation that task was paused before closing
6. ✅ **Synchronized State**: Modal and list are always in sync
7. ✅ **Error Handling**: Shows error if pause fails, preventing incorrect state

## Error Handling

### Pause API Fails
- **Error Toaster**: "Failed to pause task before closing"
- **Console Log**: Error details logged
- **Status**: Remains in RUNNING state (does not change to CLOSED)
- **Event**: taskStopped event is NOT emitted (list not refreshed)
- **User Action**: User can try again or manually pause first

### Pause API Success
- **Info Toaster**: "Task paused and status changed to Closed"
- **Status**: Changes to CLOSED
- **Event**: taskStopped event emitted
- **List**: Refreshes to show updated status
- **Daily Remarks**: Section appears and becomes mandatory

## Toaster Messages

### Success (Task was RUNNING)
- **Type**: Info (blue)
- **Title**: "Task Status Changed"
- **Message**: "Task paused and status changed to Closed"

### Success (Task was NOT RUNNING)
- **Type**: Info (blue)
- **Title**: "Task Status Changed"
- **Message**: "Task status changed to Closed"

### Error (Pause Failed)
- **Type**: Error (red)
- **Title**: "Pause Failed"
- **Message**: "Failed to pause task before closing"

## Testing Checklist

- [x] Stop button works when task is RUNNING
- [x] executeTimer API called with PAUSED action when task is RUNNING
- [x] Local timer stops when task is RUNNING
- [x] Status changes to CLOSED after successful pause
- [x] taskStopped event emitted after status change
- [x] Parent component receives taskStopped event
- [x] Parent component calls loadActiveTasks() to refresh list
- [x] Task list shows updated status
- [x] Daily Remarks section appears after status change
- [x] Stop button works when task is NOT RUNNING
- [x] No API call made when task is NOT RUNNING
- [x] Status changes to CLOSED directly when NOT RUNNING
- [x] taskStopped event emitted when NOT RUNNING
- [x] Task list refreshes when NOT RUNNING
- [x] Error toaster shows if pause API fails
- [x] Status remains RUNNING if pause API fails
- [x] taskStopped event NOT emitted if pause fails
- [x] Task list NOT refreshed if pause fails
- [x] AUTO CLOSED count rechecked after stopping
- [x] No TypeScript compilation errors

## Edge Cases

### 1. Task is PAUSED
- **Behavior**: No API call, just change status to CLOSED and emit event
- **Result**: Works correctly, list refreshes

### 2. Task is NOT STARTED
- **Behavior**: No API call, just change status to CLOSED and emit event
- **Result**: Works correctly, list refreshes

### 3. Task is COMPLETED
- **Behavior**: No API call, just change status to CLOSED and emit event
- **Result**: Works correctly, list refreshes

### 4. Task is AUTO CLOSED
- **Behavior**: No API call, just change status to CLOSED and emit event
- **Result**: Works correctly, list refreshes

### 5. API Call Fails
- **Behavior**: Show error, keep status as RUNNING, don't emit event
- **Result**: User can retry, list not refreshed (correct behavior)

### 6. Network Timeout
- **Behavior**: Error handler triggered, show error, don't emit event
- **Result**: User can retry, list not refreshed

## Code Flow

```typescript
stopTaskFromModal() {
  if (selectedTaskDetailStatus === 'running') {
    // RUNNING → PAUSED (API) → CLOSED (local) → Emit Event → Refresh List
    executeTimer('PAUSED')
      .then(() => {
        stopTimer();
        selectedTaskDetailStatus = 'not-closed';
        taskStopped.emit(taskId); // ← Emit event to refresh list
        showToaster('Task paused and status changed to Closed');
      })
      .catch(() => {
        showError('Failed to pause task before closing');
        // Don't emit event if pause fails
      });
  } else {
    // NOT RUNNING → CLOSED (local) → Emit Event → Refresh List
    stopTimer();
    selectedTaskDetailStatus = 'not-closed';
    taskStopped.emit(taskId); // ← Emit event to refresh list
    showToaster('Task status changed to Closed');
  }
}
```

## Related Features

This change works in conjunction with:
1. **Daily Remarks Mandatory**: After status changes to CLOSED, Daily Remarks becomes mandatory
2. **Timer Management**: Local timer is stopped to prevent UI updates
3. **AUTO CLOSED Check**: Count is rechecked after stopping
4. **Task List Refresh**: Parent component refreshes task list via loadActiveTasks()

## Notes

- The `stopTimer()` method stops the local interval timer that updates the UI
- The `executeTimer` API call stops the backend timer and updates the database
- The `taskStopped.emit(taskId)` notifies parent component to refresh the list
- The parent's `loadActiveTasks()` method fetches the latest task data from API
- Both timer stop and list refresh are necessary for complete synchronization
- The status mapping: `'not-closed'` (component) = `'CLOSED'` (API)
- The method only affects the Stop button behavior, not the status dropdown
- Event is only emitted after successful status change (not on errors)

## Files Modified

1. `src/app/components/task-details-modal/task-details-modal.component.ts`
   - Updated `stopTaskFromModal()` method
   - Added conditional logic to check if task is RUNNING
   - Added executeTimer API call for RUNNING tasks
   - Added `taskStopped.emit(taskId)` to notify parent component
   - Added error handling for pause failures

2. `src/app/my-task/my-task.component.ts`
   - Already has `onTaskStoppedFromModal()` method
   - Calls `loadActiveTasks()` to refresh the task list

3. `src/app/my-task/my-task.component.html`
   - Already has `(taskStopped)="onTaskStoppedFromModal($event)"` event binding

## Future Enhancements

1. **Confirmation Dialog**: Ask user to confirm before stopping RUNNING task
2. **Time Summary**: Show total time logged before closing
3. **Quick Remarks**: Suggest common closing remarks
4. **Auto-pause**: Automatically pause after certain idle time
5. **Batch Stop**: Stop multiple running tasks at once
6. **Optimistic UI**: Update list immediately, then sync with API

```typescript
stopTaskFromModal() {
  // If task is currently RUNNING, pause it first before changing to CLOSED
  if (this.selectedTaskDetailStatus === 'running') {
    console.log('Task is RUNNING - pausing before closing');
    
    // Call executeTimer API with PAUSED action
    const timerRequest = {
      taskId: this.taskId,
      userId: this.userId,
      action: 'PAUSED'
    };
    
    this.api.executeTimer(timerRequest).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          console.log('Task paused successfully, now changing to CLOSED');
          this.stopTimer();
          this.selectedTaskDetailStatus = 'not-closed';
          this.toasterService.showInfo('Task Status Changed', 'Task paused and status changed to Closed');
          
          // Recheck AUTO CLOSED count after stopping
          this.checkAutoClosedTasksCount();
        } else {
          this.toasterService.showError('Pause Failed', 'Failed to pause task before closing');
          console.error('Failed to pause task:', response?.message);
        }
      },
      error: (error: any) => {
        console.error('Error pausing task before closing:', error);
        this.toasterService.showError('Error', 'Failed to pause task before closing');
      }
    });
  } else {
    // Task is not running, just change status to CLOSED
    this.stopTimer();
    this.selectedTaskDetailStatus = 'not-closed';
    this.toasterService.showInfo('Task Status Changed', 'Task status changed to Closed');
    
    // Recheck AUTO CLOSED count after stopping
    this.checkAutoClosedTasksCount();
  }
}
```

## Workflow

### Scenario 1: Task is RUNNING

```
User clicks Stop button
  ↓
Check if status === 'running'
  ↓ (YES)
Call executeTimer API with action='PAUSED'
  ↓ (success)
Stop local timer
  ↓
Change status to 'not-closed' (CLOSED)
  ↓
Show toaster: "Task paused and status changed to Closed"
  ↓
Daily Remarks section appears (mandatory)
  ↓
Recheck AUTO CLOSED count
```

### Scenario 2: Task is NOT RUNNING (PAUSED, NOT STARTED, etc.)

```
User clicks Stop button
  ↓
Check if status === 'running'
  ↓ (NO)
Stop local timer
  ↓
Change status to 'not-closed' (CLOSED)
  ↓
Show toaster: "Task status changed to Closed"
  ↓
Daily Remarks section appears (mandatory)
  ↓
Recheck AUTO CLOSED count
```

## API Calls

### When Task is RUNNING
1. **executeTimer API** with `action: 'PAUSED'`
   - Request:
     ```json
     {
       "taskId": 123,
       "userId": "EMP001",
       "action": "PAUSED"
     }
     ```
   - Response: Task paused successfully
   - Effect: Timer stops on backend, task status changes to PAUSED

2. **Status Change** (local only)
   - Component status changes from 'running' → 'not-closed'
   - Daily Remarks section becomes visible

### When Task is NOT RUNNING
- No API call needed
- Just local status change from current status → 'not-closed'
- Daily Remarks section becomes visible

## Benefits

1. ✅ **Prevents Background Running**: Task timer stops on backend when user closes the task
2. ✅ **Data Integrity**: Ensures task is properly paused before closing
3. ✅ **Accurate Time Tracking**: No time leakage from tasks running in background
4. ✅ **Better UX**: User sees confirmation that task was paused before closing
5. ✅ **Error Handling**: Shows error if pause fails, preventing incorrect state

## Error Handling

### Pause API Fails
- **Error Toaster**: "Failed to pause task before closing"
- **Console Log**: Error details logged
- **Status**: Remains in RUNNING state (does not change to CLOSED)
- **User Action**: User can try again or manually pause first

### Pause API Success
- **Info Toaster**: "Task paused and status changed to Closed"
- **Status**: Changes to CLOSED
- **Daily Remarks**: Section appears and becomes mandatory

## Toaster Messages

### Success (Task was RUNNING)
- **Type**: Info (blue)
- **Title**: "Task Status Changed"
- **Message**: "Task paused and status changed to Closed"

### Success (Task was NOT RUNNING)
- **Type**: Info (blue)
- **Title**: "Task Status Changed"
- **Message**: "Task status changed to Closed"

### Error (Pause Failed)
- **Type**: Error (red)
- **Title**: "Pause Failed"
- **Message**: "Failed to pause task before closing"

## Testing Checklist

- [x] Stop button works when task is RUNNING
- [x] executeTimer API called with PAUSED action when task is RUNNING
- [x] Local timer stops when task is RUNNING
- [x] Status changes to CLOSED after successful pause
- [x] Daily Remarks section appears after status change
- [x] Stop button works when task is NOT RUNNING
- [x] No API call made when task is NOT RUNNING
- [x] Status changes to CLOSED directly when NOT RUNNING
- [x] Error toaster shows if pause API fails
- [x] Status remains RUNNING if pause API fails
- [x] AUTO CLOSED count rechecked after stopping
- [x] No TypeScript compilation errors

## Edge Cases

### 1. Task is PAUSED
- **Behavior**: No API call, just change status to CLOSED
- **Result**: Works correctly

### 2. Task is NOT STARTED
- **Behavior**: No API call, just change status to CLOSED
- **Result**: Works correctly

### 3. Task is COMPLETED
- **Behavior**: No API call, just change status to CLOSED
- **Result**: Works correctly

### 4. Task is AUTO CLOSED
- **Behavior**: No API call, just change status to CLOSED
- **Result**: Works correctly

### 5. API Call Fails
- **Behavior**: Show error, keep status as RUNNING
- **Result**: User can retry or manually pause

### 6. Network Timeout
- **Behavior**: Error handler triggered, show error
- **Result**: User can retry

## Code Flow

```typescript
stopTaskFromModal() {
  if (selectedTaskDetailStatus === 'running') {
    // RUNNING → PAUSED (API) → CLOSED (local)
    executeTimer('PAUSED')
      .then(() => {
        stopTimer();
        selectedTaskDetailStatus = 'not-closed';
        showToaster('Task paused and status changed to Closed');
      })
      .catch(() => {
        showError('Failed to pause task before closing');
      });
  } else {
    // NOT RUNNING → CLOSED (local only)
    stopTimer();
    selectedTaskDetailStatus = 'not-closed';
    showToaster('Task status changed to Closed');
  }
}
```

## Related Features

This change works in conjunction with:
1. **Daily Remarks Mandatory**: After status changes to CLOSED, Daily Remarks becomes mandatory
2. **Timer Management**: Local timer is stopped to prevent UI updates
3. **AUTO CLOSED Check**: Count is rechecked after stopping

## Notes

- The `stopTimer()` method stops the local interval timer that updates the UI
- The `executeTimer` API call stops the backend timer and updates the database
- Both are necessary to fully stop the task
- The status mapping: `'not-closed'` (component) = `'CLOSED'` (API)
- The method only affects the Stop button behavior, not the status dropdown

## Files Modified

1. `src/app/components/task-details-modal/task-details-modal.component.ts`
   - Updated `stopTaskFromModal()` method
   - Added conditional logic to check if task is RUNNING
   - Added executeTimer API call for RUNNING tasks
   - Added error handling for pause failures

## Future Enhancements

1. **Confirmation Dialog**: Ask user to confirm before stopping RUNNING task
2. **Time Summary**: Show total time logged before closing
3. **Quick Remarks**: Suggest common closing remarks
4. **Auto-pause**: Automatically pause after certain idle time
5. **Batch Stop**: Stop multiple running tasks at once
