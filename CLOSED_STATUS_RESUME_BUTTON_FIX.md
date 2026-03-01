# CLOSED Status Resume Button Fix

## Issue
When a task's status was "CLOSED", the Start/Resume button was hidden in the task details modal. This prevented users from resuming closed tasks.

## Root Cause
The Resume button visibility condition only checked for "PAUSED" status:
```typescript
*ngIf="selectedTaskDetailStatus === 'pause' || selectedTaskDetailStatus === 'paused'"
```

This meant that when status was "CLOSED" (`not-closed`), the Resume button was not displayed.

## Solution
Updated the button visibility conditions to:
1. Show Resume button for PAUSED **and** CLOSED statuses
2. Hide Resume button only for AUTO CLOSED status
3. Hide Stop button for AUTO CLOSED status

## Changes Made

### File: `src/app/components/task-details-modal/task-details-modal.component.html`

**Resume Button - Before:**
```html
<button class="timer-btn resume-btn" 
        *ngIf="selectedTaskDetailStatus === 'pause' || selectedTaskDetailStatus === 'paused'"
        (click)="resumeTaskFromModal()"
        title="Resume Task">
  <i class="fas fa-play"></i>
</button>
```

**Resume Button - After:**
```html
<button class="timer-btn resume-btn" 
        *ngIf="selectedTaskDetailStatus === 'pause' || selectedTaskDetailStatus === 'paused' || selectedTaskDetailStatus === 'not-closed'"
        (click)="resumeTaskFromModal()"
        title="Resume Task">
  <i class="fas fa-play"></i>
</button>
```

**Stop Button - Before:**
```html
<button class="timer-btn stop-btn"
        (click)="stopTaskFromModal()"
        title="Stop Task">
  <i class="fas fa-stop"></i>
</button>
```

**Stop Button - After:**
```html
<button class="timer-btn stop-btn"
        *ngIf="selectedTaskDetailStatus !== 'auto-closed'"
        (click)="stopTaskFromModal()"
        title="Stop Task">
  <i class="fas fa-stop"></i>
</button>
```

## Button Visibility Matrix

| Status | Start Button | Pause Button | Resume Button | Stop Button |
|--------|-------------|--------------|---------------|-------------|
| NOT STARTED | ✅ Show | ❌ Hide | ❌ Hide | ✅ Show |
| RUNNING | ❌ Hide | ✅ Show | ❌ Hide | ✅ Show |
| PAUSED | ❌ Hide | ❌ Hide | ✅ Show | ✅ Show |
| CLOSED | ❌ Hide | ❌ Hide | ✅ Show | ✅ Show |
| AUTO CLOSED | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide |
| COMPLETED | ❌ Hide | ❌ Hide | ❌ Hide | ✅ Show |

## Behavior After Fix

### CLOSED Status
- ✅ Resume button is now visible
- ✅ Stop button is visible
- ✅ User can resume a closed task
- ✅ User can stop a closed task

### AUTO CLOSED Status
- ❌ Resume button is hidden
- ❌ Stop button is hidden
- ❌ User cannot resume an auto-closed task
- ❌ User cannot stop an auto-closed task
- ✅ User must change status to CLOSED first to resume

## User Workflow

### Resuming a CLOSED Task
1. User opens task details modal
2. Task status shows "CLOSED"
3. Resume button (▶️) is visible
4. User clicks Resume button
5. Task status changes to RUNNING
6. Timer starts

### AUTO CLOSED Task (No Resume)
1. User opens task details modal
2. Task status shows "AUTO CLOSED"
3. Resume button is hidden
4. Stop button is hidden
5. User must change status dropdown to "CLOSED" first
6. Then Resume button appears

## Business Logic

### Why Show Resume for CLOSED?
- CLOSED tasks can be reopened and resumed
- Users may need to add more time to a closed task
- CLOSED is a manual status, not system-enforced

### Why Hide Resume for AUTO CLOSED?
- AUTO CLOSED is a system status
- Indicates task was automatically closed by the system
- Requires manual intervention (change to CLOSED) before resuming
- Prevents accidental resumption of system-closed tasks

## Testing Checklist

- [x] Resume button shows for PAUSED status
- [x] Resume button shows for CLOSED status
- [x] Resume button hides for AUTO CLOSED status
- [x] Stop button shows for all statuses except AUTO CLOSED
- [x] Start button shows only for NOT STARTED status
- [x] Pause button shows only for RUNNING status
- [x] No TypeScript errors
- [x] No build errors

## Related Files
- `src/app/components/task-details-modal/task-details-modal.component.html`

## Notes
- The status value `not-closed` represents "CLOSED" status in the system
- The status value `auto-closed` represents "AUTO CLOSED" status
- This fix aligns with the business requirement that CLOSED tasks can be resumed
- AUTO CLOSED tasks require manual status change before resuming
