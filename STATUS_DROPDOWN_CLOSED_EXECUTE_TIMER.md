# Status Dropdown - Call ExecuteTimer Only When Running

## Changes Made

### Modified: `src/app/components/task-details-modal/task-details-modal.component.ts`

Updated the `onStatusChange()` method to call `ExecuteTimer` API with "PAUSED" action ONLY when the task is currently RUNNING and user changes to "Closed" status.

**Previous Behavior:**
- Called `ExecuteTimer` with "PAUSED" for all status changes to Closed
- This was unnecessary when task was already paused or not started

**New Behavior:**
- Only calls `ExecuteTimer` API with "PAUSED" when task is currently RUNNING
- If task is already PAUSED, NOT STARTED, or any other status, just changes status to Closed without API call
- More efficient and avoids unnecessary API calls
- Dropdown correctly displays "Closed" after status change

## Implementation Details

When user manually selects "Closed" from dropdown:

### Scenario 1: Task is RUNNING
```typescript
if (this.selectedTaskDetailStatus === 'running') {
  // Call ExecuteTimer with PAUSED to stop the timer
  const timerRequest = {
    taskId: this.taskId,
    userId: this.userId,
    action: 'PAUSED'
  };
  this.api.executeTimer(timerRequest).subscribe(...);
  // Then set status to 'not-closed' (Closed)
}
```

### Scenario 2: Task is NOT RUNNING (Paused, Not Started, etc.)
```typescript
else {
  // Just change status to Closed - no API call needed
  this.selectedTaskDetailStatus = 'not-closed';
  // Show Daily Remarks section
  // Emit taskStopped event
  // Recheck AUTO CLOSED count
}
```

## Flow Diagram

```
User selects "Closed" from dropdown
  ├─ If task is RUNNING
  │   └─ Call ExecuteTimer(PAUSED) → Change to Closed
  └─ If task is NOT RUNNING (Paused, Not Started, etc.)
      └─ Just change to Closed (no API call)
```

## Benefits

1. **Efficiency**: Avoids unnecessary API calls when task is not running
2. **Correct Behavior**: Only pauses timer when there's actually a timer running
3. **Data Integrity**: Still ensures running timers are properly stopped
4. **User Experience**: Faster status change when no timer is running
5. **Correct Display**: Dropdown shows "Closed" in all cases

## Status Change Behavior

| Current Status | User Selects "Closed" | ExecuteTimer Called? | Final Status |
|----------------|----------------------|---------------------|--------------|
| RUNNING        | ✓                    | ✓ (PAUSED)          | CLOSED       |
| PAUSED         | ✓                    | ✗ (not needed)      | CLOSED       |
| NOT STARTED    | ✓                    | ✗ (not needed)      | CLOSED       |
| COMPLETED      | ✓                    | ✗ (not needed)      | CLOSED       |

## Files Modified

- `src/app/components/task-details-modal/task-details-modal.component.ts`

## Testing Checklist

- [x] Change to Closed from RUNNING - calls ExecuteTimer, shows "Closed"
- [x] Change to Closed from PAUSED - no API call, shows "Closed"
- [x] Change to Closed from NOT STARTED - no API call, shows "Closed"
- [x] Dropdown displays "Closed" correctly in all scenarios
- [x] Timer stops properly when running
- [x] Daily Remarks section appears
- [x] Parent component receives taskStopped event
- [x] Task list refreshes after status change
- [x] AUTO CLOSED count updates
- [x] Error handling works if API fails (when running)

## Related Components

- Stop button: `stopTaskFromModal()` - similar logic, checks if running first
- Status dropdown: `onStatusChange()` - now optimized for efficiency
- Parent component: Receives `taskStopped` event and refreshes listing
