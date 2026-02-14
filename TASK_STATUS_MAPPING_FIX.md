# Task Status Mapping Fix

## Issue
When saving a task from the task details modal, if the status dropdown shows "pause", the backend was receiving "PAUSE" but it should be "PAUSED" (with a "D" at the end).

## Root Cause
The UI uses lowercase status values like `'pause'`, `'running'`, `'not-started'`, etc. When saving the task, the code was simply uppercasing these values with `.toUpperCase()`, which converted `'pause'` to `'PAUSE'` instead of the correct backend value `'PAUSED'`.

## Solution
Created a mapping function `mapUIStatusToBackendStatus()` that properly converts UI status values to their correct backend equivalents.

## Changes Made

### 1. Added Status Mapping Function
**File:** `src/app/my-task/my-task.component.ts`

```typescript
private mapUIStatusToBackendStatus(uiStatus: string): string {
  const statusMap: { [key: string]: string } = {
    'pause': 'PAUSED',
    'running': 'RUNNING',
    'not-started': 'NOT STARTED',
    'not-closed': 'NOT CLOSED',
    'completed': 'COMPLETED',
    'closed': 'CLOSED'
  };
  
  const normalizedStatus = uiStatus?.toLowerCase().trim() || 'not-started';
  const mappedStatus = statusMap[normalizedStatus];
  
  if (mappedStatus) {
    console.log(`Status mapping: UI "${uiStatus}" -> Backend "${mappedStatus}"`);
    return mappedStatus;
  }
  
  // If no mapping found, uppercase the status
  console.warn(`No status mapping found for "${uiStatus}", using uppercase`);
  return uiStatus?.toUpperCase() || 'NOT STARTED';
}
```

### 2. Updated Save Task Request
**File:** `src/app/my-task/my-task.component.ts`

Changed from:
```typescript
status: this.selectedTaskDetailStatus?.toUpperCase() || 'NOT STARTED',
```

To:
```typescript
status: this.mapUIStatusToBackendStatus(this.selectedTaskDetailStatus),
```

## Status Mappings

| UI Status (lowercase) | Backend Status (uppercase) |
|----------------------|---------------------------|
| pause                | PAUSED                    |
| running              | RUNNING                   |
| not-started          | NOT STARTED               |
| not-closed           | NOT CLOSED                |
| completed            | COMPLETED                 |
| closed               | CLOSED                    |

## Benefits

1. **Correct Status Values**: Backend now receives "PAUSED" instead of "PAUSE"
2. **Centralized Mapping**: All status conversions go through one function
3. **Maintainable**: Easy to add new status mappings in the future
4. **Logging**: Console logs show the mapping for debugging
5. **Fallback**: If no mapping exists, falls back to uppercase

## Testing Recommendations

1. Test saving a task with status "pause" → Should send "PAUSED" to backend
2. Test saving a task with status "running" → Should send "RUNNING" to backend
3. Test saving a task with status "not-started" → Should send "NOT STARTED" to backend
4. Test saving a task with status "completed" → Should send "COMPLETED" to backend
5. Verify backend accepts and processes the status correctly
6. Check console logs to confirm status mapping is working

## Technical Notes

- The mapping function is case-insensitive (normalizes to lowercase before mapping)
- Handles null/undefined status values with a default of "NOT STARTED"
- Includes console logging for debugging status conversions
- Placed near other helper methods for better code organization
