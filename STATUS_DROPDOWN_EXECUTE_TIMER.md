# Status Dropdown - Execute Timer on Status Change

## Issue
When a user changed the status dropdown to "RUNNING" or "PAUSE" in the task details modal, the system was not calling the `executeTimer` API to actually start or pause the timer. The status would change visually but the timer wouldn't be affected.

## Expected Behavior
- When status is changed to "RUNNING" → Call `executeTimer` API with action "START"
- When status is changed to "PAUSE" → Call `executeTimer` API with action "PAUSED"
- For other status changes (NOT STARTED, COMPLETED, CLOSED) → Just update the status without calling executeTimer
- Show success/error toaster notifications
- Reload task details after successful timer action

## Solution

### File: `src/app/components/task-details-modal/task-details-modal.component.html`

Added `(ngModelChange)` event handler to the status dropdown:

```html
<select class="modal-status-select" 
        [(ngModel)]="selectedTaskDetailStatus" 
        (ngModelChange)="onStatusChange($event)" 
        [disabled]="isViewOnly || taskId === 0">
  <option value="not-started">Not Started</option>
  <option value="not-closed">Closed</option>
  <option value="running">Running</option>
  <option value="completed">Completed</option>
  <option value="pause">Pause</option>
</select>
```

### File: `src/app/components/task-details-modal/task-details-modal.component.ts`

Added `onStatusChange()` method to handle status dropdown changes:

```typescript
// Handle status dropdown change
onStatusChange(newStatus: string) {
  console.log('Status changed to:', newStatus);
  
  // Only call executeTimer for RUNNING and PAUSE status changes
  if (newStatus === 'running') {
    // Call executeTimer with START action
    const timerRequest = {
      taskId: this.taskId,
      userId: this.userId,
      action: 'START'
    };
    
    this.api.executeTimer(timerRequest).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          this.toasterService.showSuccess('Task Started', 'Task timer has been started successfully!');
          
          // Reload task details to get updated data
          this.loadTaskDetails();
          
          // Emit event to parent component
          this.taskResumed.emit(this.taskId);
        } else {
          this.toasterService.showError('Start Failed', response?.message || 'Failed to start task');
          // Revert status on failure
          this.loadTaskDetails();
        }
      },
      error: (error: any) => {
        console.error('Error starting task:', error);
        this.toasterService.showError('Error', 'Failed to start task');
        // Revert status on failure
        this.loadTaskDetails();
      }
    });
  } else if (newStatus === 'pause' || newStatus === 'paused') {
    // Call executeTimer with PAUSED action
    const timerRequest = {
      taskId: this.taskId,
      userId: this.userId,
      action: 'PAUSED'
    };
    
    this.api.executeTimer(timerRequest).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          this.stopTimer();
          this.toasterService.showSuccess('Task Paused', 'Task timer has been paused successfully!');
          
          // Reload task details to get updated data
          this.loadTaskDetails();
          
          // Emit event to parent component
          this.taskPaused.emit(this.taskId);
        } else {
          this.toasterService.showError('Pause Failed', response?.message || 'Failed to pause task');
          // Revert status on failure
          this.loadTaskDetails();
        }
      },
      error: (error: any) => {
        console.error('Error pausing task:', error);
        this.toasterService.showError('Error', 'Failed to pause task');
        // Revert status on failure
        this.loadTaskDetails();
      }
    });
  }
  // For other status changes (not-started, completed, closed), just update the status without calling executeTimer
}
```

## Changes Made
1. Added `(ngModelChange)="onStatusChange($event)"` to the status dropdown
2. Created `onStatusChange()` method that:
   - Detects when status is changed to "running" or "pause"
   - Calls `executeTimer` API with appropriate action (START or PAUSED)
   - Shows success/error toaster notifications
   - Reloads task details on success to get updated timer data
   - Reverts status on failure by reloading task details
   - Emits events to parent component (taskResumed/taskPaused)
3. For other status changes, the status updates without calling executeTimer

## API Integration
- **Action: START** - Used when status changes to "running"
- **Action: PAUSED** - Used when status changes to "pause"
- **API Endpoint**: `DailyTimeSheet/ExecuteTimer`
- **Request**: `{ taskId, userId, action }`

## Result
- Changing status to "RUNNING" starts the timer via API
- Changing status to "PAUSE" pauses the timer via API
- Timer state is synchronized with status changes
- Users get immediate feedback via toaster notifications
- Task details are refreshed to show updated timer values
- Error handling reverts status if API call fails

## User Experience
- Seamless timer control via status dropdown
- Clear feedback with success/error messages
- Status and timer stay synchronized
- Automatic data refresh after timer actions
- Graceful error handling with status reversion
