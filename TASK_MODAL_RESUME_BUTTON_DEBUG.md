# Task Modal Resume Button Debug Fix

## Issue
In the task modal header, when the task is paused, the Resume button is not visible. Only the Stop button shows in pause mode.

## Root Cause Analysis
The Resume button visibility is controlled by the condition:
```html
*ngIf="selectedTaskDetailStatus === 'pause'"
```

Possible issues:
1. The `selectedTaskDetailStatus` might not be set to 'pause' after pausing
2. The API might return 'PAUSED' (uppercase) which gets converted to 'paused' (lowercase) instead of 'pause'
3. The status update might be happening but Angular change detection isn't triggering

## Changes Made

### 1. Updated HTML Condition
**File:** `src/app/my-task/my-task.component.html`

Added support for both 'pause' and 'paused' status values:

```html
<div class="timer-buttons">
  <!-- Show Pause button when task is RUNNING -->
  <button class="timer-btn pause-btn" 
          *ngIf="selectedTaskDetailStatus === 'running'"
          (click)="pauseTaskFromModal()"
          title="Pause Task">
    <i class="fas fa-pause"></i>
  </button>
  
  <!-- Show Resume button when task is PAUSED -->
  <button class="timer-btn resume-btn" 
          *ngIf="selectedTaskDetailStatus === 'pause' || selectedTaskDetailStatus === 'paused'"
          (click)="resumeTaskFromModal()"
          title="Resume Task">
    <i class="fas fa-play"></i>
  </button>
  
  <!-- Always show Stop button -->
  <button class="timer-btn stop-btn"
          (click)="stopTaskFromModal()"
          title="Stop Task">
    <i class="fas fa-stop"></i>
  </button>
</div>
```

### 2. Added Debug Logging
**File:** `src/app/my-task/my-task.component.ts`

Added console log to track status changes:

```typescript
// Update local status immediately for UI feedback
this.selectedTaskDetailStatus = 'pause';
console.log('Status updated to pause, current value:', this.selectedTaskDetailStatus);
```

### 3. Status Mapping in getTaskById
The status mapping in `openTaskDetailsModal` method:

```typescript
const apiStatus = taskDetails.status?.toUpperCase() || '';
if (apiStatus === 'NOT STARTED' || apiStatus === 'NOTSTARTED') {
  this.selectedTaskDetailStatus = 'not-started';
} else if (apiStatus === 'CLOSED' || apiStatus === 'NOT CLOSED') {
  this.selectedTaskDetailStatus = 'not-closed';
} else if (apiStatus === 'RUNNING') {
  this.selectedTaskDetailStatus = 'running';
} else if (apiStatus === 'PAUSED') {
  this.selectedTaskDetailStatus = 'pause';  // Maps to 'pause'
} else if (apiStatus === 'COMPLETED') {
  this.selectedTaskDetailStatus = 'completed';
} else {
  this.selectedTaskDetailStatus = taskDetails.status?.toLowerCase() || 'not-started';
}
```

## Testing Steps

1. Open task details modal for a running task
2. Click the Pause button
3. Check browser console for logs:
   - "Pausing task from modal: [taskId]"
   - "Pausing task with request: {...}"
   - "Pause task API response: {...}"
   - "Task paused successfully"
   - "Status updated to pause, current value: pause"
4. Verify Resume button appears (play icon)
5. Click Resume button
6. Verify Pause button reappears

## Expected Behavior

### When Task is RUNNING
- ✅ Pause button visible (pause icon)
- ❌ Resume button hidden
- ✅ Stop button visible

### When Task is PAUSED
- ❌ Pause button hidden
- ✅ Resume button visible (play icon)
- ✅ Stop button visible

## Debugging Tips

If Resume button still doesn't show:

1. **Check Console Logs:**
   - Look for "Status updated to pause, current value: [value]"
   - Verify the value is 'pause' or 'paused'

2. **Check API Response:**
   - Look for "Pause task API response"
   - Check if response.success is true
   - Check what status value is returned

3. **Check Status Mapping:**
   - Look for "Task details reloaded, status: [value]"
   - Verify the status is being set correctly

4. **Uncomment Debug Line in HTML:**
   ```html
   <!-- Status: {{ selectedTaskDetailStatus }} -->
   ```
   This will show the current status value in the UI

5. **Check Angular Change Detection:**
   - If status is correct but button doesn't show, might be change detection issue
   - Try adding `ChangeDetectorRef` and calling `this.cdr.detectChanges()` after status update

## Alternative Solutions

If the issue persists, consider:

1. **Use a getter method:**
   ```typescript
   get showResumeButton(): boolean {
     return this.selectedTaskDetailStatus === 'pause' || 
            this.selectedTaskDetailStatus === 'paused';
   }
   ```

2. **Force change detection:**
   ```typescript
   import { ChangeDetectorRef } from '@angular/core';
   
   constructor(private cdr: ChangeDetectorRef) {}
   
   // After setting status
   this.selectedTaskDetailStatus = 'pause';
   this.cdr.detectChanges();
   ```

3. **Use NgZone:**
   ```typescript
   import { NgZone } from '@angular/core';
   
   constructor(private ngZone: NgZone) {}
   
   // Wrap status update
   this.ngZone.run(() => {
     this.selectedTaskDetailStatus = 'pause';
   });
   ```

## Status
🔧 IN PROGRESS - Debugging with enhanced logging and dual status support

## Next Steps
1. Test in browser with console open
2. Verify status value after pausing
3. Check if Resume button appears
4. If not, implement one of the alternative solutions
