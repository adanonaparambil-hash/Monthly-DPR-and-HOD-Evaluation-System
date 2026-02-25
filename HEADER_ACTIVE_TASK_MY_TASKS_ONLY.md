# Header Active Task - My Tasks Only Fix

## Issue
The task listing header was showing running tasks from both "My Tasks" and "Assigned to Others" tabs. This was incorrect - the header should only display running tasks from the "My Tasks" list.

## Root Cause
In the `loadActiveTasks()` function in `my-task.component.ts`, the code was searching for active tasks in the combined list:
```typescript
this.tasks = this.convertActiveTasksToTasks([...this.myTasksList, ...this.assignedByMeList]);
const runningTask = this.tasks.find(t => t.status === 'RUNNING');
```

This meant if a task in "Assigned to Others" was running, it would appear in the header.

## Solution
Modified the logic to only search for active tasks within the `myTasksList`:

```typescript
// Convert all tasks for display in the table
this.tasks = this.convertActiveTasksToTasks([...this.myTasksList, ...this.assignedByMeList]);

// But only search for active task in MY TASKS list for the header
const myTasksOnly = this.convertActiveTasksToTasks(this.myTasksList);
const runningTask = myTasksOnly.find(t => t.status === 'RUNNING');
```

## Changes Made

### File: `src/app/my-task/my-task.component.ts`

1. **First occurrence (line ~833)**: Updated the active task detection logic in the first response handler
2. **Second occurrence (line ~958)**: Updated the active task detection logic in the second response handler

Both changes:
- Create a separate `myTasksOnly` array containing only tasks from `myTasksList`
- Search for RUNNING, PAUSED, CLOSED, or any task only within `myTasksOnly`
- Updated all `taskData` lookups to use `this.myTasksList` instead of the combined array
- Updated console logs to indicate "MY TASKS" for clarity

## Behavior After Fix

The header will now:
- ✅ Show running tasks ONLY from "My Tasks" tab
- ✅ Ignore any running tasks in "Assigned to Others" tab
- ✅ Follow priority: RUNNING > PAUSED > CLOSED > First available task from My Tasks
- ✅ Show "No active task" if My Tasks list is empty, even if Assigned to Others has running tasks

## Testing
Test the following scenarios:
1. Start a task in "My Tasks" - should appear in header ✓
2. Start a task in "Assigned to Others" - should NOT appear in header ✓
3. Have both running - only "My Tasks" one should appear in header ✓
4. Stop all "My Tasks" - header should show no active task even if "Assigned to Others" has running tasks ✓
