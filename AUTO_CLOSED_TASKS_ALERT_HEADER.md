# AUTO CLOSED Tasks Alert in Header

## Overview
Implemented a prominent alert/warning message in the My Task header that appears when there are "AUTO CLOSED" tasks in the "My Tasks" list. This alert replaces the normal active task display and prevents users from starting new tasks until all AUTO CLOSED tasks are handled.

## Features

### 1. Alert Display Conditions
- Shows ONLY when there are AUTO CLOSED tasks in "MY TASKS" list
- Does NOT show for AUTO CLOSED tasks in "Assigned to Others" list
- Replaces both the empty state and active task display
- Disappears automatically once all AUTO CLOSED tasks are cleared

### 2. Alert Content
- **Icon**: Animated warning triangle with pulsing effect
- **Title**: "Action Required: Auto-Closed Tasks"
- **Message**: "You have X auto-closed task(s). Please close these tasks before starting today's work."
- **Action Buttons**:
  - "View Auto-Closed Tasks" - Scrolls to the task listing
  - "Close All" - Closes all AUTO CLOSED tasks at once

### 3. Visual Design
- Red/orange gradient background
- Pulsing border animation
- Animated shine effect
- Bouncing warning icon
- Professional alert styling

## User Workflow

### Scenario 1: User Has AUTO CLOSED Tasks
1. User opens My Task page
2. Header shows AUTO CLOSED alert instead of active task
3. Alert displays count of AUTO CLOSED tasks
4. User has two options:
   - Click "View Auto-Closed Tasks" to see them in the listing
   - Click "Close All" to close all at once

### Scenario 2: Close All AUTO CLOSED Tasks
1. User clicks "Close All" button
2. Confirmation dialog appears
3. Shows count of tasks to be closed
4. User confirms
5. Loading spinner shows progress
6. All tasks are closed via API
7. Success message appears
8. Alert disappears
9. Normal header display returns

### Scenario 3: Manual Closing
1. User clicks "View Auto-Closed Tasks"
2. Page scrolls to task listing
3. MY TASKS tab is activated
4. User manually closes each AUTO CLOSED task
5. When last AUTO CLOSED task is closed
6. Alert disappears automatically
7. Normal header display returns

## Files Modified

### 1. `src/app/my-task/my-task.component.html`

**Added AUTO CLOSED Alert Section:**
```html
<div class="auto-closed-alert" *ngIf="hasAutoClosedTasks()">
  <div class="alert-icon-wrapper">
    <div class="alert-icon-pulse"></div>
    <i class="fas fa-exclamation-triangle alert-icon"></i>
  </div>
  <div class="alert-content">
    <h3 class="alert-title">Action Required: Auto-Closed Tasks</h3>
    <p class="alert-message">
      You have <strong>{{ getAutoClosedTasksCount() }}</strong> auto-closed task(s). 
      Please close these tasks before starting today's work.
    </p>
    <div class="alert-actions">
      <button class="alert-btn primary" (click)="scrollToAutoClosedTasks()">
        <i class="fas fa-tasks"></i>
        <span>View Auto-Closed Tasks</span>
      </button>
      <button class="alert-btn secondary" (click)="closeAllAutoClosedTasks()">
        <i class="fas fa-check-circle"></i>
        <span>Close All</span>
      </button>
    </div>
  </div>
</div>
```

**Modified Display Logic:**
- Empty state: Shows only when `!hasActiveTask && !hasAutoClosedTasks()`
- Active task: Shows only when `hasActiveTask && !hasAutoClosedTasks()`
- Alert: Shows when `hasAutoClosedTasks()` (takes priority)

### 2. `src/app/my-task/my-task.component.ts`

**Added Methods:**

**hasAutoClosedTasks()**
```typescript
hasAutoClosedTasks(): boolean {
  return this.myTasksList.some(task => 
    task.status?.toUpperCase() === 'AUTO CLOSED' || 
    task.status?.toUpperCase() === 'AUTO-CLOSED' ||
    task.status?.toUpperCase() === 'AUTOCLOSED'
  );
}
```

**getAutoClosedTasksCount()**
```typescript
getAutoClosedTasksCount(): number {
  return this.myTasksList.filter(task => 
    task.status?.toUpperCase() === 'AUTO CLOSED' || 
    task.status?.toUpperCase() === 'AUTO-CLOSED' ||
    task.status?.toUpperCase() === 'AUTOCLOSED'
  ).length;
}
```

**scrollToAutoClosedTasks()**
```typescript
scrollToAutoClosedTasks() {
  // Switch to MY TASKS tab
  this.activeTab = 'MY TASKS';
  
  // Scroll to task listing section
  setTimeout(() => {
    const taskListingElement = document.querySelector('.task-listing-section');
    if (taskListingElement) {
      taskListingElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
  
  this.toasterService.showInfo('Auto-Closed Tasks', 'Showing auto-closed tasks in the listing below');
}
```

**closeAllAutoClosedTasks()**
```typescript
closeAllAutoClosedTasks() {
  const autoClosedTasks = this.myTasksList.filter(task => 
    task.status?.toUpperCase() === 'AUTO CLOSED' || 
    task.status?.toUpperCase() === 'AUTO-CLOSED' ||
    task.status?.toUpperCase() === 'AUTOCLOSED'
  );

  // Show confirmation dialog
  Swal.fire({
    title: 'Close All Auto-Closed Tasks?',
    html: `You are about to close ${autoClosedTasks.length} auto-closed task(s).`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Yes, Close All',
    cancelButtonText: 'Cancel'
  }).then((result) => {
    if (result.isConfirmed) {
      this.executeCloseAllAutoClosedTasks(autoClosedTasks);
    }
  });
}
```

**executeCloseAllAutoClosedTasks()**
```typescript
executeCloseAllAutoClosedTasks(tasks: ActiveTaskDto[]) {
  // Show loading
  Swal.fire({
    title: 'Closing Tasks...',
    html: `Processing ${tasks.length} task(s)...`,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  // Process each task with executeTimer API
  const promises = tasks.map(task => {
    const timerRequest = {
      taskId: task.taskId,
      userId: this.sessionService.getCurrentUser()?.empId || '',
      action: 'CLOSED'
    };
    return this.api.executeTimer(timerRequest).toPromise();
  });

  // Wait for all to complete
  Promise.all(promises).then(() => {
    this.loadActiveTasks();
    Swal.fire({
      icon: 'success',
      title: 'All Tasks Closed!',
      text: `Successfully closed ${tasks.length} task(s)`,
      timer: 2000
    });
  });
}
```

### 3. `src/app/my-task/my-task.component.css`

**Added Alert Styles:**
- `.auto-closed-alert` - Main alert container with gradient background
- `.alert-icon-wrapper` - Icon container with pulsing effect
- `.alert-icon-pulse` - Animated pulse circle behind icon
- `.alert-icon` - Warning triangle icon with bounce animation
- `.alert-content` - Content area with title, message, and buttons
- `.alert-title` - Bold red title
- `.alert-message` - Message text with highlighted count
- `.alert-actions` - Button container
- `.alert-btn` - Button base styles with ripple effect
- `.alert-btn.primary` - Red gradient button
- `.alert-btn.secondary` - White outlined button

**Animations:**
- `alertSlideIn` - Slide in from top
- `alertPulse` - Pulsing border effect
- `alertShine` - Shine sweep effect
- `iconPulse` - Icon background pulse
- `iconBounce` - Icon bounce animation

**Dark Mode Support:**
- Adjusted colors for dark theme
- Lighter red tones
- Transparent backgrounds

## API Integration

### Endpoint
`POST /DailyTimeSheet/ExecuteTimer`

### Request Format (for each task)
```typescript
{
  taskId: number,
  userId: string,
  action: 'CLOSED'
}
```

### Bulk Processing
- Processes all AUTO CLOSED tasks in parallel
- Uses Promise.all() for concurrent execution
- Shows loading state during processing
- Displays success/failure count

## Visual Features

### Alert Appearance
1. **Background**: Red gradient with transparency
2. **Border**: Animated pulsing red border
3. **Icon**: Bouncing warning triangle with glow
4. **Shine Effect**: Animated light sweep across alert
5. **Buttons**: Gradient primary, outlined secondary

### Animations
1. **Slide In**: Alert slides down from top
2. **Pulse**: Border pulses continuously
3. **Shine**: Light sweeps across every 3 seconds
4. **Icon Bounce**: Icon bounces up and down
5. **Icon Pulse**: Background circle pulses out
6. **Button Ripple**: Ripple effect on button click

### Responsive Design
- Flexbox layout adapts to content
- Icon and content side-by-side
- Buttons stack on smaller screens
- Smooth animations on all devices

## Priority Logic

The header display follows this priority:
1. **AUTO CLOSED Alert** (highest priority)
2. Active Task Display
3. Empty State (lowest priority)

```
if (hasAutoClosedTasks()) {
  → Show AUTO CLOSED Alert
} else if (hasActiveTask) {
  → Show Active Task
} else {
  → Show Empty State
}
```

## Benefits

1. ✅ **Immediate Visibility**: Users can't miss AUTO CLOSED tasks
2. ✅ **Prevents Confusion**: Clear message about what needs to be done
3. ✅ **Quick Action**: One-click to close all tasks
4. ✅ **Smooth UX**: Automatic disappearance when resolved
5. ✅ **Professional Design**: Eye-catching but not annoying
6. ✅ **Bulk Operation**: Close all tasks at once
7. ✅ **Smart Filtering**: Only checks MY TASKS, not Assigned to Others
8. ✅ **Auto-refresh**: Alert disappears when tasks are cleared

## Testing Checklist

- [x] Alert appears when AUTO CLOSED tasks exist in MY TASKS
- [x] Alert does NOT appear for AUTO CLOSED tasks in Assigned to Others
- [x] Alert shows correct count of AUTO CLOSED tasks
- [x] "View Auto-Closed Tasks" button scrolls to listing
- [x] "View Auto-Closed Tasks" switches to MY TASKS tab
- [x] "Close All" button shows confirmation dialog
- [x] "Close All" processes all tasks correctly
- [x] Loading state shows during bulk close
- [x] Success message appears after closing
- [x] Alert disappears after all tasks are closed
- [x] Normal header returns after alert clears
- [x] Animations work smoothly
- [x] Dark mode styling works
- [x] Responsive layout works

## Notes

- The alert takes priority over both empty state and active task display
- Only MY TASKS list is checked, not Assigned to Others
- The status check is case-insensitive and handles variations (AUTO CLOSED, AUTO-CLOSED, AUTOCLOSED)
- Bulk close uses Promise.all() for parallel execution
- The alert automatically disappears when the last AUTO CLOSED task is cleared
- Users can still manually close tasks one by one if they prefer
