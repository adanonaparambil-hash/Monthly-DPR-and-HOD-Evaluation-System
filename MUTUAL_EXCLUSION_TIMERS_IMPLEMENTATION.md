# Mutual Exclusion Between Task Timer and Break Timer

## Summary
Implemented mutual exclusion to ensure only ONE timer runs at a time - either the task timer OR the break timer, never both simultaneously. When one timer starts, the other automatically stops.

## Problem
Previously, both the task timer and break timer could run simultaneously, which would result in:
- Incorrect time tracking
- Confusing user experience
- Data inconsistency

## Solution
Added safety checks and timer stopping logic to ensure mutual exclusion between the two timers.

## Changes Made

### 1. Task Timer Starts → Break Timer Stops

#### In `startActiveTaskTimer()` method:
Added safety check to stop break timer when task timer starts:

```typescript
private startActiveTaskTimer() {
  // Safety check: Stop break timer if it's running
  if (this.breakTimerInterval) {
    clearInterval(this.breakTimerInterval);
    this.breakTimerInterval = null;
    console.log('Break timer stopped because task timer is starting');
  }
  
  // ... rest of the method
}
```

#### In `startTask()` method:
Already implemented - stops break via API and clears break timer:

```typescript
if (this.isBreakRunning) {
  // Stop break via API
  this.api.userBreak({ action: 'STOP' }).subscribe({
    next: (response) => {
      // Clear break timer
      if (this.breakTimerInterval) {
        clearInterval(this.breakTimerInterval);
        this.breakTimerInterval = null;
      }
      
      // Reset break state
      this.isBreakRunning = false;
      this.isBreakPaused = false;
      this.breakElapsedSeconds = 0;
      this.breakTimerDisplay = '00:00:00';
      
      // Then start task
      this.proceedWithTaskStart(taskId, userId);
    }
  });
}
```

### 2. Break Timer Starts → Task Timer Stops

#### In `proceedWithBreakStart()` method:
Added safety check to stop task timer when break timer starts:

```typescript
if (response && response.success) {
  // Safety check: Stop active task timer if it's running
  if (this.activeTaskTimerInterval) {
    clearInterval(this.activeTaskTimerInterval);
    this.activeTaskTimerInterval = null;
    console.log('Active task timer stopped because break timer is starting');
  }
  
  // Start break timer
  this.breakTimerInterval = setInterval(() => {
    // ...
  }, 1000);
}
```

#### In `startBreak()` method:
Already implemented - pauses all running tasks via API and pauses task timer:

```typescript
if (runningTasks.length > 0) {
  // Pause all running tasks via API
  Promise.all(pauseRequests).then(() => {
    // Pause the active task timer (local display)
    this.pauseActiveTaskTimer();
    
    // Then start break
    this.proceedWithBreakStart(userId);
  });
}
```

## Flow Diagrams

### Flow 1: Task Timer Starts While Break is Running
```
User clicks "Start" on task
  ↓
Check if break is running
  ↓
If YES:
  ↓
  Call userBreak API (action: 'STOP')
  ↓
  Clear break timer interval
  ↓
  Reset break state
  ↓
Call executeTimer API (action: 'START')
  ↓
startActiveTaskTimer() called
  ↓
Safety check: Stop break timer if running
  ↓
Start task timer interval
  ↓
Result: Only TASK TIMER is running
```

### Flow 2: Break Timer Starts While Task is Running
```
User clicks "Start Break"
  ↓
Find all RUNNING tasks
  ↓
If found:
  ↓
  Call executeTimer API (action: 'PAUSE') for each
  ↓
  Pause active task timer (local)
  ↓
Call userBreak API (action: 'START')
  ↓
proceedWithBreakStart() called
  ↓
Safety check: Stop task timer if running
  ↓
Start break timer interval
  ↓
Result: Only BREAK TIMER is running
```

## Timer States

### Only Task Timer Running
- `activeTaskTimerInterval` is active (not null)
- `breakTimerInterval` is null
- Task timer increments every second
- Break timer display shows 00:00:00

### Only Break Timer Running
- `breakTimerInterval` is active (not null)
- `activeTaskTimerInterval` is null
- Break timer increments every second
- Task timer display shows paused time

### No Timer Running
- Both `activeTaskTimerInterval` and `breakTimerInterval` are null
- Both displays show static values

### NEVER Both Running
- The safety checks ensure this state is impossible
- If one timer starts, the other is immediately stopped

## Safety Mechanisms

### 1. API-Level Mutual Exclusion
- Starting a task stops the break via API
- Starting a break pauses all running tasks via API

### 2. Local Timer Mutual Exclusion
- `startActiveTaskTimer()` clears break timer interval
- `proceedWithBreakStart()` clears task timer interval

### 3. State Synchronization
- Break state is reset when task starts
- Task timer is paused when break starts
- `loadActiveTasks()` syncs state from API

## Console Logging

Added console logs for debugging:
- "Break timer stopped because task timer is starting"
- "Active task timer stopped because break timer is starting"
- "All running tasks paused successfully"
- "Break stopped successfully"

## Testing Checklist
- [x] Starting task while break is running stops break timer
- [x] Starting break while task is running stops task timer
- [x] Only one timer increments at a time
- [x] Timer displays are mutually exclusive
- [x] API calls are made for both scenarios
- [x] State is properly synchronized
- [x] No memory leaks (intervals are cleared)
- [x] Console logs show correct flow

## User Experience

### Before (Problem)
- User starts task → task timer runs
- User starts break → break timer also runs
- Both timers increment simultaneously ❌
- Confusing and incorrect time tracking

### After (Solution)
- User starts task → task timer runs
- User starts break → task timer stops, break timer runs ✅
- Only one timer increments at a time
- Clear and accurate time tracking

## Files Modified
- `src/app/my-task/my-task.component.ts` - Added mutual exclusion logic

## Status
✅ Complete - Only one timer (task OR break) can run at a time. Mutual exclusion is enforced at both API and local timer levels.
