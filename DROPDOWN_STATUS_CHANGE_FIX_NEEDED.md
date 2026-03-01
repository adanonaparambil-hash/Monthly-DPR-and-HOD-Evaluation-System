# Dropdown Status Change to CLOSED - Fix Needed

## Problem
When user manually changes the status to CLOSED from the dropdown, the pause API is NOT being called and the page is refreshing incorrectly. The Stop button works fine, but the dropdown doesn't.

## Root Cause
The issue is with Angular's two-way binding `[(ngModel)]`. When the user selects "Closed" from the dropdown:

1. Angular IMMEDIATELY updates `selectedTaskDetailStatus` to 'not-closed'
2. THEN it calls `onStatusChange(newStatus)`
3. By the time we check `if (this.selectedTaskDetailStatus === 'running')`, it's already 'not-closed', not 'running'!
4. So the pause API is never called

## Solution
We need to track the PREVIOUS status before the dropdown changes it.

### Step 1: Add Previous Status Variable

In the component class, add:
```typescript
selectedTaskDetailStatus = 'not-started';
previousTaskStatus = 'not-started'; // Track previous status for dropdown changes
```

### Step 2: Update Previous Status When Loading Task

When loading task details, update both:
```typescript
// Map status
this.selectedTaskDetailStatus = this.mapTaskStatus(taskDetails.status);
this.previousTaskStatus = this.selectedTaskDetailStatus; // Track previous status
```

### Step 3: Update onStatusChange Method

Change the check from:
```typescript
if (this.selectedTaskDetailStatus === 'running') {
```

To:
```typescript
if (this.previousTaskStatus === 'running') {
```

And update `previousTaskStatus` after successful status changes:
```typescript
this.previousTaskStatus = 'not-closed'; // Update previous status
```

### Step 4: Revert Using Previous Status on Failure

Change from:
```typescript
this.loadTaskDetails(); // Revert on failure
```

To:
```typescript
this.selectedTaskDetailStatus = this.previousTaskStatus; // Revert on failure
```

## Complete Fix for onStatusChange Method

```typescript
// Handle CLOSED status change - pause first if task WAS running
if (newStatus === 'not-closed') {
  // Check if previous status was RUNNING (not current status, because ngModel already changed it)
  if (this.previousTaskStatus === 'running') {
    console.log('Task WAS RUNNING - pausing before closing via dropdown');
    
    // Call executeTimer API with PAUSED action
    const timerRequest = {
      taskId: this.taskId,
      userId: this.userId,
      action: 'PAUSED'
    };
    
    this.api.executeTimer(timerRequest).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          console.log('Task paused successfully via dropdown, now changing to CLOSED');
          this.stopTimer();
          this.selectedTaskDetailStatus = 'not-closed';
          this.previousTaskStatus = 'not-closed'; // Update previous status
          this.toasterService.showInfo('Task Status Changed', 'Task paused and status changed to Closed');
          
          // Emit event to parent component to refresh task list
          this.taskStopped.emit(this.taskId);
          
          // Recheck AUTO CLOSED count after stopping
          this.checkAutoClosedTasksCount();
          
          // Trigger change detection to show Daily Remarks section
          this.cdr.detectChanges();
        } else {
          this.toasterService.showError('Pause Failed', 'Failed to pause task before closing');
          console.error('Failed to pause task:', response?.message);
          // Revert status on failure
          this.selectedTaskDetailStatus = this.previousTaskStatus;
        }
      },
      error: (error: any) => {
        console.error('Error pausing task before closing via dropdown:', error);
        this.toasterService.showError('Error', 'Failed to pause task before closing');
        // Revert status on failure
        this.selectedTaskDetailStatus = this.previousTaskStatus;
      }
    });
  } else {
    // Task was not running, just change status to CLOSED
    this.stopTimer();
    this.selectedTaskDetailStatus = 'not-closed';
    this.previousTaskStatus = 'not-closed'; // Update previous status
    this.toasterService.showInfo('Task Status Changed', 'Task status changed to Closed');
    
    // Emit event to parent component to refresh task list
    this.taskStopped.emit(this.taskId);
    
    // Recheck AUTO CLOSED count after stopping
    this.checkAutoClosedTasksCount();
    
    // Trigger change detection to show Daily Remarks section
    this.cdr.detectChanges();
  }
  return;
}
```

## Expected Behavior After Fix

When user changes status to CLOSED via dropdown:

1. ✅ If task WAS RUNNING → Calls pause API first
2. ✅ Then changes status to CLOSED
3. ✅ Shows toaster notification
4. ✅ Daily Remarks section appears immediately
5. ✅ Task list refreshes in parent component
6. ✅ NO page refresh
7. ✅ Behaves exactly like Stop button

## Files to Modify

1. `src/app/components/task-details-modal/task-details-modal.component.ts`
   - Add `previousTaskStatus` variable
   - Update `loadTaskDetails()` to set `previousTaskStatus`
   - Update `onStatusChange()` to use `previousTaskStatus` instead of `selectedTaskDetailStatus`
   - Update `previousTaskStatus` after successful status changes
   - Revert using `previousTaskStatus` on failures

## Testing

1. Open a task that is RUNNING
2. Change dropdown to "Closed"
3. Verify:
   - Console shows "Task WAS RUNNING - pausing before closing via dropdown"
   - Pause API is called
   - Toaster shows "Task paused and status changed to Closed"
   - Daily Remarks section appears
   - Task list refreshes
   - NO page refresh

## Date
March 1, 2026

## Status
⚠️ FIX NEEDED - Code changes required to track previous status
