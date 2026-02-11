# File Corruption Issue - my-task.component.ts

## Problem
The file `src/app/my-task/my-task.component.ts` is severely corrupted with over 1,178 TypeScript syntax errors. The file appears to have duplicate code, missing method definitions, and broken class structure.

## Root Cause
The file was corrupted during previous edits and the corruption was committed to git. Even restoring from previous commits shows the same corruption pattern.

## Errors Found
- Missing method definitions (formatHours, startActiveTaskTimer, pauseActiveTaskTimer, etc.)
- Duplicate code blocks
- Broken class structure
- Missing closing braces
- Invalid syntax throughout the file

## Recommended Solutions

### Option 1: Restore from a Known Working Backup (RECOMMENDED)
If you have a backup of the file from before the corruption, restore it and then apply the simplified API changes manually.

### Option 2: Manual Fix
The file needs extensive manual fixing:
1. Remove all duplicate code
2. Ensure all methods are properly defined within the class
3. Add missing method implementations
4. Fix all syntax errors

### Option 3: Rebuild from Scratch
Given the extent of corruption, it may be faster to rebuild the component from scratch using the working parts as reference.

## What Was Attempted
1. Restored file from previous git commit (HEAD~1) - still corrupted
2. Attempted to remove duplicate code - file too damaged
3. Checked multiple git history points - corruption exists in all recent commits

## Next Steps
1. Locate a working backup of the file (before corruption)
2. If no backup exists, manually fix the file structure
3. Once file is working, apply the simplified API changes:
   - `startTask()` should make single API call to `executeTimer`
   - `startBreak()` should make single API call to `userBreak`
   - Remove helper methods `proceedWithTaskStart()` and `proceedWithBreakStart()`
   - Backend handles mutual exclusion automatically

## Simplified API Implementation (To Apply After Fix)

### startTask() - Simplified Version
```typescript
startTask(taskId: number) {
  const currentUser = this.sessionService.getCurrentUser();
  const userId = currentUser?.empId || currentUser?.employeeId || '';
  
  if (!userId) {
    this.toasterService.showError('Error', 'Unable to identify current user.');
    return;
  }

  const timerRequest = {
    taskId: taskId,
    userId: userId,
    action: 'START'
  };
  
  // Single API call - backend handles stopping break
  this.api.executeTimer(timerRequest).subscribe({
    next: (response: any) => {
      if (response && response.success) {
        // Clear local break timer if running
        if (this.breakTimerInterval) {
          clearInterval(this.breakTimerInterval);
          this.breakTimerInterval = null;
        }
        
        // Reset break state
        this.isBreakRunning = false;
        this.isBreakPaused = false;
        this.breakElapsedSeconds = 0;
        this.breakTimerDisplay = '00:00:00';
        this.selectedBreakType = null;
        this.breakRemarks = '';
        this.updateBreakCaption();
        
        this.toasterService.showSuccess('Task Started', 'Task timer started!');
        this.loadActiveTasks();
        this.startActiveTaskTimer();
      }
    },
    error: (error: any) => {
      this.toasterService.showError('Error', error?.error?.message || 'Failed to start task.');
    }
  });
}
```

### startBreak() - Simplified Version
```typescript
startBreak() {
  if (!this.selectedBreakType) return;

  const currentUser = this.sessionService.getCurrentUser();
  const userId = currentUser?.empId || currentUser?.employeeId || '';
  
  if (!userId) {
    this.toasterService.showError('Error', 'Unable to identify current user.');
    return;
  }

  const reasonMap = {
    lunch: 'Lunch Break',
    coffee: 'Coffee Break',
    quick: 'Quick Break'
  };
  
  const reason = reasonMap[this.selectedBreakType];
  
  const breakRequest = {
    userId: userId,
    action: 'START',
    reason: reason,
    remarks: this.breakRemarks || ''
  };

  // Single API call - backend handles pausing tasks
  this.api.userBreak(breakRequest).subscribe({
    next: (response: any) => {
      if (response && response.success) {
        // Clear local task timer if running
        if (this.activeTaskTimerInterval) {
          clearInterval(this.activeTaskTimerInterval);
          this.activeTaskTimerInterval = null;
        }
        
        // Start break timer
        this.isBreakRunning = true;
        this.isBreakPaused = false;
        this.breakStartTime = new Date();
        this.breakElapsedSeconds = 0;
        this.updateBreakCaption();

        this.breakTimerInterval = setInterval(() => {
          if (!this.isBreakPaused) {
            this.breakElapsedSeconds++;
            this.updateBreakTimerDisplay();
          }
        }, 1000);
        
        this.toasterService.showSuccess('Break Started', `${reason} started!`);
        this.loadActiveTasks();
      }
    },
    error: (error: any) => {
      this.toasterService.showError('Error', error?.error?.message || 'Failed to start break.');
    }
  });
}
```

## Status
❌ **BLOCKED** - File corruption prevents implementation of simplified API calls.

## Action Required
User must restore or manually fix the corrupted TypeScript file before proceeding with the simplification.

