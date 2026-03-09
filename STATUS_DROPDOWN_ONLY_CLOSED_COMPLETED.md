# Status Dropdown - Show Only Closed and Completed Options

## Changes Made

### Modified: `src/app/components/task-details-modal/task-details-modal.component.html`

Updated the status dropdown to only show "Closed" and "Completed" as selectable options. Other statuses (Running, Paused, Not Started, Auto Closed) are hidden from the dropdown list but still display when they are the current status.

**Previous Behavior:**
- Dropdown showed all status options: Not Started, Closed, Running, Completed, Pause, Auto Closed
- Users could manually select Running, Pause, etc. from dropdown
- This was confusing and not the intended workflow

**New Behavior:**
- Dropdown only shows "Closed" and "Completed" as selectable options
- Other statuses (Running, Paused, Not Started, Auto Closed) are hidden from dropdown
- Current status still displays correctly (e.g., if task is Running, it shows "Running")
- Users use buttons (Start, Pause, Resume, Stop) to control Running/Paused states
- Users use dropdown only to mark task as Closed or Completed

## Implementation Details

### Hidden Options (only show when current status)
```html
<option value="not-started" [hidden]="selectedTaskDetailStatus !== 'not-started'" disabled>Not Started</option>
<option value="running" [hidden]="selectedTaskDetailStatus !== 'running'" disabled>Running</option>
<option value="pause" [hidden]="selectedTaskDetailStatus !== 'pause' && selectedTaskDetailStatus !== 'paused'" disabled>Pause</option>
<option value="auto-closed" [hidden]="selectedTaskDetailStatus !== 'auto-closed'" disabled>Auto Closed</option>
```

### User Selectable Options
```html
<option value="not-closed">Closed</option>
<option value="completed">Completed</option>
```

## User Workflow

### To Start/Pause/Resume Task:
- Use the timer control buttons (Start, Pause, Resume, Stop)
- These buttons call ExecuteTimer API and update status automatically

### To Close or Complete Task:
- Use the status dropdown
- Select "Closed" or "Completed"
- If task is running, it will automatically pause first (via ExecuteTimer)

## Visual Impact

**Before (Dropdown Options):**
```
- Not Started (disabled)
- Closed
- Running
- Completed
- Pause
- Auto Closed (disabled)
```

**After (Dropdown Options):**
```
- Closed
- Completed
```

**Current Status Display:**
- If task is Running → Dropdown shows "Running" (but option is hidden from list)
- If task is Paused → Dropdown shows "Pause" (but option is hidden from list)
- If task is Not Started → Dropdown shows "Not Started" (but option is hidden from list)
- If task is Auto Closed → Dropdown shows "Auto Closed" (but option is hidden from list)

## Benefits

1. **Clearer UX**: Users only see options they should manually select
2. **Prevents Confusion**: Can't manually select "Running" or "Pause" from dropdown
3. **Proper Workflow**: Forces users to use buttons for timer control
4. **Simplified**: Only 2 options in dropdown instead of 6
5. **Still Shows Status**: Current status displays correctly even if hidden from list

## Files Modified

- `src/app/components/task-details-modal/task-details-modal.component.html`

## Testing Checklist

- [x] Dropdown only shows "Closed" and "Completed" options
- [x] When task is Running, dropdown displays "Running" correctly
- [x] When task is Paused, dropdown displays "Pause" correctly
- [x] When task is Not Started, dropdown displays "Not Started" correctly
- [x] When task is Auto Closed, dropdown displays "Auto Closed" correctly
- [x] User can select "Closed" from dropdown
- [x] User can select "Completed" from dropdown
- [x] Selecting "Closed" calls ExecuteTimer if task was running
- [x] Timer control buttons still work correctly
- [x] Status changes work as expected

## Related Components

- Timer control buttons: Start, Pause, Resume, Stop - control Running/Paused states
- Status dropdown: Now only for Closed/Completed selection
- ExecuteTimer API: Called automatically when needed
