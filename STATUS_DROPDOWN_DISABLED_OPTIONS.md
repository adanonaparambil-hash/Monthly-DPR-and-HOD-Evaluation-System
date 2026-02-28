# Status Dropdown - Disabled System-Only Options

## Overview
Disabled "NOT STARTED" and "AUTO CLOSED" options in the status dropdown to prevent users from manually selecting these system-controlled statuses.

## Changes Made

### Task Details Modal - Status Dropdown
**File**: `src/app/components/task-details-modal/task-details-modal.component.html`

**Before**:
```html
<select class="modal-status-select" [(ngModel)]="selectedTaskDetailStatus" (ngModelChange)="onStatusChange($event)">
  <option value="not-started">Not Started</option>
  <option value="not-closed">Closed</option>
  <option value="running">Running</option>
  <option value="completed">Completed</option>
  <option value="pause">Pause</option>
  <option value="auto-closed">Auto Closed</option>
</select>
```

**After**:
```html
<select class="modal-status-select" [(ngModel)]="selectedTaskDetailStatus" (ngModelChange)="onStatusChange($event)">
  <option value="not-started" disabled>Not Started</option>
  <option value="not-closed">Closed</option>
  <option value="running">Running</option>
  <option value="completed">Completed</option>
  <option value="pause">Pause</option>
  <option value="auto-closed" disabled>Auto Closed</option>
</select>
```

---

## Status Options

### User-Selectable Statuses ✅
Users can manually select these statuses from the dropdown:

1. ✅ **Closed** - User can close a task
2. ✅ **Running** - User can start/resume a task (if not blocked by AUTO CLOSED)
3. ✅ **Completed** - User can mark a task as completed
4. ✅ **Pause** - User can pause a task (if not blocked by AUTO CLOSED)

### System-Only Statuses ❌
Users CANNOT manually select these statuses (disabled in dropdown):

1. ❌ **NOT STARTED** - Only set by system when task is created
2. ❌ **AUTO CLOSED** - Only set by system automatically

---

## User Experience

### Scenario 1: User opens task with "NOT STARTED" status
1. Task modal opens
2. Status dropdown shows "Not Started" (grayed out/disabled)
3. User clicks dropdown
4. "Not Started" option is disabled and cannot be selected
5. User can select: Closed, Running, Completed, or Pause
6. User cannot change back to "Not Started"

### Scenario 2: User opens task with "AUTO CLOSED" status
1. Task modal opens
2. Status dropdown shows "Auto Closed" (grayed out/disabled)
3. User clicks dropdown
4. "Auto Closed" option is disabled and cannot be selected
5. User can select: Closed, Running, Completed, or Pause
6. User cannot change back to "Auto Closed"

### Scenario 3: User tries to select disabled option
1. User clicks status dropdown
2. User sees "Not Started" and "Auto Closed" options grayed out
3. User clicks on disabled option
4. Nothing happens - option cannot be selected
5. Dropdown remains open
6. User must select an enabled option

---

## Visual Appearance

### Enabled Options:
- Normal text color
- Clickable cursor
- Can be selected

### Disabled Options:
- Grayed out text (browser default styling)
- Not clickable
- Cannot be selected
- Still visible in dropdown for reference

---

## Why These Statuses Are Disabled

### NOT STARTED
- **Purpose**: Initial status when a task is created
- **System Control**: Only the system should set this status during task creation
- **User Action**: Users should use the Start button or change to Running status instead
- **Reason**: Prevents users from reverting a task back to NOT STARTED after work has begun

### AUTO CLOSED
- **Purpose**: System automatically sets this when certain conditions are met (e.g., end of day with running tasks)
- **System Control**: Only the system should set this status automatically
- **User Action**: Users should change to Closed status to resolve AUTO CLOSED tasks
- **Reason**: Prevents users from manually marking tasks as AUTO CLOSED, which would bypass the system's automatic tracking

---

## Status Flow

### Normal Task Lifecycle:
```
NOT STARTED (system) 
    ↓
RUNNING (user selects or clicks Start)
    ↓
PAUSED (user selects or clicks Pause)
    ↓
RUNNING (user selects or clicks Resume)
    ↓
COMPLETED (user selects)
    ↓
CLOSED (user selects)
```

### System-Triggered Flow:
```
RUNNING (at end of day)
    ↓
AUTO CLOSED (system automatically)
    ↓
CLOSED (user must manually close)
```

---

## Blocking Rules Still Apply

Even though users can see these options in the dropdown, the blocking rules still apply:

### When AUTO CLOSED count > 0:
- ❌ Cannot select "Running" (blocked with warning)
- ❌ Cannot select "Pause" (blocked with warning)
- ✅ Can select "Closed" (allowed)
- ✅ Can select "Completed" (allowed)

### Disabled Options:
- ❌ Cannot select "Not Started" (disabled)
- ❌ Cannot select "Auto Closed" (disabled)

---

## Browser Behavior

The `disabled` attribute on `<option>` elements is supported by all modern browsers:

- **Chrome/Edge**: Grayed out, not selectable
- **Firefox**: Grayed out, not selectable
- **Safari**: Grayed out, not selectable

Users will see these options in the dropdown but cannot click or select them.

---

## Testing Checklist

- [x] "Not Started" option is disabled in dropdown
- [x] "Auto Closed" option is disabled in dropdown
- [x] Other options remain enabled
- [x] Disabled options are visually grayed out
- [x] Clicking disabled options does nothing
- [x] Users can still select enabled options
- [x] Current status displays correctly even if disabled
- [x] Blocking rules still apply to enabled options
- [x] No HTML diagnostics errors

---

## Files Modified

1. **src/app/components/task-details-modal/task-details-modal.component.html**
   - Added `disabled` attribute to "not-started" option
   - Added `disabled` attribute to "auto-closed" option

---

## Summary

The status dropdown now prevents users from manually selecting "NOT STARTED" and "AUTO CLOSED" statuses. These system-controlled statuses are still visible in the dropdown (for reference when they are the current status) but are grayed out and cannot be selected. Users can only select: Closed, Running, Completed, or Pause (subject to AUTO CLOSED blocking rules).

This ensures proper status flow and prevents users from bypassing system logic by manually setting system-only statuses.
