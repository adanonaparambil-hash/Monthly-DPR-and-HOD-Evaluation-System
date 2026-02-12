# Task Modal Pause/Resume Buttons Implementation

## Issue Description
In the task details modal header, when the user clicks the pause button, the timer should show a "Resume" button instead of the "Pause" button. Previously, only the "Stop" button was visible in pause mode, and there was no way to resume the task from the modal.

## Solution
Implemented conditional button display based on task status:
- When task is RUNNING → Show Pause button
- When task is PAUSED → Show Resume button (with play icon)
- Stop button is always visible

## Implementation Details

### HTML Template
**File:** `src/app/my-task/my-task.component.html`

```html
<div class="timer-buttons">
  <!-- Show Pause button when task is RUNNING -->
  <button class="timer-btn pause-btn" 
          *ngIf="selectedTaskDetailStatus === 'running'"
          (click)="pauseTaskFromModal()">
    <i class="fas fa-pause"></i>
  </button>
  
  <!-- Show Resume button when task is PAUSED -->
  <button class="timer-btn resume-btn" 
          *ngIf="selectedTaskDetailStatus === 'pause'"
          (click)="resumeTaskFromModal()">
    <i class="fas fa-play"></i>
  </button>
  
  <!-- Always show Stop button -->
  <button class="timer-btn stop-btn"
          (click)="stopTaskFromModal()">
    <i class="fas fa-stop"></i>
  </button>
</div>
```

### TypeScript Methods
**File:** `src/app/my-task/my-task.component.ts`

#### 1. Pause Task from Modal
```typescript
pauseTaskFromModal() {
  if (!this.selectedTask) {
    this.toasterService.showError('Error', 'No task selected');
    return;
  }

  console.log('Pausing task from modal:', this.selectedTask.id);
  
  // Update local status immediately for UI feedback
  this.selectedTaskDetailStatus = 'pause';
  
  // Call the existing pauseTask method
  this.pauseTask(this.selectedTask.id);
}
```

#### 2. Resume Task from Modal
```typescript
resumeTaskFromModal() {
  if (!this.selectedTask) {
    this.toasterService.showError('Error', 'No task selected');
    return;
  }

  console.log('Resuming task from modal:', this.selectedTask.id);
  
  // Update local status immediately for UI feedback
  this.selectedTaskDetailStatus = 'running';
  
  // Call the existing startTask method (which resumes paused tasks)
  this.startTask(this.selectedTask.id);
}
```

#### 3. Stop Task from Modal
```typescript
stopTaskFromModal() {
  if (!this.selectedTask) {
    this.toasterService.showError('Error', 'No task selected');
    return;
  }

  console.log('Stopping task from modal:', this.selectedTask.id);
  
  // Call the existing stopTask method
  this.stopTask(this.selectedTask.id);
  
  // Close the modal after stopping
  setTimeout(() => {
    this.closeTaskDetailsModal();
  }, 1000);
}
```

### CSS Styling
**File:** `src/app/my-task/task-modal-glassmorphism.css`

```css
.timer-btn.resume-btn {
  color: #10b981;
}

.timer-btn.resume-btn:hover {
  background: #ecfdf5;
}
```

## Status Tracking
The task status is tracked using the `selectedTaskDetailStatus` property which can have the following values:
- `'running'` - Task is currently running
- `'pause'` - Task is paused
- `'not-started'` - Task hasn't been started yet
- `'completed'` - Task is completed
- `'not-closed'` - Task is not closed

The status is set when the task details are loaded from the API:
```typescript
const apiStatus = taskDetails.status?.toUpperCase() || '';
if (apiStatus === 'RUNNING') {
  this.selectedTaskDetailStatus = 'running';
} else if (apiStatus === 'PAUSED') {
  this.selectedTaskDetailStatus = 'pause';
}
// ... other status mappings
```

## User Flow

### Scenario 1: Running Task
1. User opens task details modal
2. Task status is 'RUNNING'
3. Modal header shows:
   - Running Timer display
   - Pause button (pause icon)
   - Stop button (stop icon)

### Scenario 2: Pausing Task
1. User clicks Pause button
2. `pauseTaskFromModal()` is called
3. Status immediately updates to 'pause' for UI feedback
4. API call is made to pause the task
5. Modal header now shows:
   - Running Timer display (frozen)
   - Resume button (play icon)
   - Stop button (stop icon)

### Scenario 3: Resuming Task
1. User clicks Resume button
2. `resumeTaskFromModal()` is called
3. Status immediately updates to 'running' for UI feedback
4. API call is made to start/resume the task
5. Modal header now shows:
   - Running Timer display (continues)
   - Pause button (pause icon)
   - Stop button (stop icon)

### Scenario 4: Stopping Task
1. User clicks Stop button
2. `stopTaskFromModal()` is called
3. API call is made to stop the task
4. Modal closes after 1 second

## API Integration
The methods use the existing `executeTimer` API endpoint:

**Endpoint:** `POST /api/DailyTimeSheet/ExecuteTimer`

**Request Body:**
```json
{
  "taskId": 26,
  "userId": "ITS48",
  "action": "PAUSE" // or "START" for resume
}
```

## Benefits
1. Users can pause and resume tasks directly from the modal
2. Clear visual feedback with appropriate icons (pause vs play)
3. Immediate UI updates for better user experience
4. Consistent with the main task board timer controls
5. Prevents confusion by showing only relevant buttons based on status

## Testing Checklist
- [x] HTML template has conditional button display
- [x] TypeScript methods implemented
- [x] CSS styling for resume button exists
- [x] Status tracking works correctly
- [x] Pause button shows when task is running
- [x] Resume button shows when task is paused
- [x] Stop button always visible
- [x] Methods call existing API functions
- [x] UI updates immediately on button click
- [ ] Test pause functionality in browser
- [ ] Test resume functionality in browser
- [ ] Test stop functionality in browser
- [ ] Verify button visibility changes correctly

## Status
✅ COMPLETED - Pause/Resume buttons implemented with conditional display based on task status
