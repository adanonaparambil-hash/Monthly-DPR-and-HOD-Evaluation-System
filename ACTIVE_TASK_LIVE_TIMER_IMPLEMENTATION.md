# Active Task Live Timer Implementation

## Summary
Implemented a live, running timer in the header that continuously updates every second when a task is running. The timer syncs with task actions (start, pause, stop) and calls the backend API when pause/stop buttons are clicked in the header.

## Changes Made

### 1. Added Timer Properties
**File**: `src/app/my-task/my-task.component.ts`

Added new properties for managing the live timer:
```typescript
// Active task timer management
activeTaskTimerInterval: any = null;
activeTaskElapsedSeconds = 0;
activeTaskStartTime: Date | null = null;
```

### 2. Timer Management Methods

#### `startActiveTaskTimer()`
- Clears any existing timer interval
- Gets current logged time from the active task (from API)
- Converts minutes to seconds for the elapsed counter
- Starts a setInterval that increments every second
- Updates the timer display every second

#### `pauseActiveTaskTimer()`
- Clears the timer interval
- Keeps the elapsed time (doesn't reset)
- Stops the timer from incrementing

#### `stopActiveTaskTimer()`
- Clears the timer interval
- Resets elapsed seconds to 0
- Resets start time to null
- Updates display to show 00:00:00

#### `updateActiveTaskTimerDisplay()`
- Converts elapsed seconds to HH:MM:SS format
- Updates the `activeTaskTimer` property for display

### 3. Header Action Methods

#### `pauseActiveTask()`
- Validates active task exists
- Pauses the live timer (stops incrementing)
- Calls `pauseTask()` to make API call
- Shows success/error toasters

#### `stopActiveTask()`
- Validates active task exists
- Stops and resets the live timer
- Calls `stopTask()` to make API call
- Shows success/error toasters

### 4. Updated `getActiveTaskTimer()`
Changed from calculating time from API data to returning the live timer display:
```typescript
getActiveTaskTimer(): string {
  return this.activeTaskTimer;
}
```

### 5. Updated `loadActiveTasks()`
Added timer logic based on task status:

**RUNNING task found:**
- Sets as active task
- Starts the live timer with `startActiveTaskTimer()`

**PAUSED task found:**
- Sets as active task
- Pauses the timer (doesn't run)
- Updates display with current logged time from API

**No task found:**
- Clears active task
- Stops and resets the timer

### 6. Updated `proceedWithTaskStart()`
Added call to `startActiveTaskTimer()` after successful API response:
```typescript
if (response && response.success) {
  this.toasterService.showSuccess('Task Started', 'Task timer has been started successfully!');
  this.loadActiveTasks();
  
  // Start the live timer for the active task
  this.startActiveTaskTimer();
}
```

### 7. Updated HTML Template
**File**: `src/app/my-task/my-task.component.html`

Wired up the pause and stop buttons in the header:
```html
<button class="modern-control-btn pause-btn" 
        *ngIf="activeTask?.status === 'RUNNING'" 
        (click)="pauseActiveTask()">
  <div class="btn-glow"></div>
  <i class="fas fa-pause"></i>
  <span class="btn-label">Pause</span>
</button>

<button class="modern-control-btn stop-btn" 
        (click)="stopActiveTask()">
  <div class="btn-glow"></div>
  <i class="fas fa-stop"></i>
  <span class="btn-label">Stop</span>
</button>
```

**Note:** Pause button only shows when task status is 'RUNNING'

### 8. Updated `ngOnDestroy()`
Added cleanup for the active task timer:
```typescript
ngOnDestroy() {
  // Clean up break timer interval
  if (this.breakTimerInterval) {
    clearInterval(this.breakTimerInterval);
    this.breakTimerInterval = null;
  }
  
  // Clean up active task timer interval
  if (this.activeTaskTimerInterval) {
    clearInterval(this.activeTaskTimerInterval);
    this.activeTaskTimerInterval = null;
  }
}
```

## How It Works

### Flow: Starting a Task from List
```
User clicks "Start" on task in list
  ↓
startTask() called
  ↓
API call: executeTimer(action: 'START')
  ↓
On success:
  ↓
  loadActiveTasks() - refreshes task list
  ↓
  Task found with status = 'RUNNING'
  ↓
  startActiveTaskTimer() called
  ↓
  Timer starts incrementing every second
  ↓
  Display updates: 00:00:01, 00:00:02, 00:00:03...
```

### Flow: Pausing from Header
```
User clicks "Pause" button in header
  ↓
pauseActiveTask() called
  ↓
pauseActiveTaskTimer() - stops timer increment
  ↓
pauseTask() - API call: executeTimer(action: 'PAUSE')
  ↓
On success:
  ↓
  loadActiveTasks() - refreshes task list
  ↓
  Task found with status = 'PAUSED'
  ↓
  Timer stays paused at current time
  ↓
  Display shows: 00:15:42 (frozen)
```

### Flow: Stopping from Header
```
User clicks "Stop" button in header
  ↓
stopActiveTask() called
  ↓
stopActiveTaskTimer() - stops and resets timer
  ↓
stopTask() - API call: executeTimer(action: 'STOP')
  ↓
On success:
  ↓
  loadActiveTasks() - refreshes task list
  ↓
  No RUNNING or PAUSED task found
  ↓
  Timer resets to 00:00:00
```

## Timer Behavior

### RUNNING Status
- Timer increments every second
- Display updates continuously
- Shows elapsed time since task started
- Includes previously logged time from API

### PAUSED Status
- Timer stops incrementing
- Display shows frozen time
- Preserves elapsed seconds
- Can be resumed by starting the task again

### STOPPED/NO TASK
- Timer resets to 00:00:00
- No active task in header
- Empty state shows

## API Integration

All timer actions call the backend API:

**Start Task:**
```typescript
executeTimer({
  taskId: number,
  userId: string,
  action: 'START'
})
```

**Pause Task:**
```typescript
executeTimer({
  taskId: number,
  userId: string,
  action: 'PAUSE'
})
```

**Stop Task:**
```typescript
executeTimer({
  taskId: number,
  userId: string,
  action: 'STOP'
})
```

## User Experience

1. **Live Timer**: Timer updates every second when task is running
2. **Accurate Time**: Starts from previously logged time (from API)
3. **Responsive Buttons**: Pause button only shows when task is running
4. **Instant Feedback**: Toaster notifications for all actions
5. **Synchronized State**: Timer state matches task status from API

## Testing Checklist
- [x] Timer starts when task is started from list
- [x] Timer increments every second (00:00:01, 00:00:02, etc.)
- [x] Timer includes previously logged time from API
- [x] Pause button in header pauses timer and calls API
- [x] Stop button in header stops timer and calls API
- [x] Timer resets when task is stopped
- [x] Timer stays paused when task status is PAUSED
- [x] Timer resumes from paused time when task is restarted
- [x] Timer cleanup on component destroy
- [x] Pause button only shows when task is RUNNING

## Files Modified
- `src/app/my-task/my-task.component.ts` - Added timer management logic
- `src/app/my-task/my-task.component.html` - Wired up pause/stop buttons

## Status
✅ Complete - Live timer now works in the header with full API integration for pause and stop actions.
