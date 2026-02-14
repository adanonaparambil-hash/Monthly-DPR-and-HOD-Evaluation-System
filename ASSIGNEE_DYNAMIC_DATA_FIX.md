# Assignee Dynamic Data Fix

## Issue
The assignee column was showing "Unassigned" for all tasks instead of displaying the actual assignee names from the backend API. The data was hardcoded as a fallback instead of using the dynamic values from the API response.

## Root Cause
The code was only using `task.assigneeName` field, but the API response has two different assignee-related fields:
- `assignedByName` - The person who created/assigned the task
- `assigneeName` - The person to whom the task is assigned

For "My Tasks" view, we should display `assignedByName` (who assigned the task to me), not `assigneeName`.

## Solution Implemented

### 1. Updated Data Mapping Logic
Changed the `convertActiveTasksToTasks` method to use both fields with proper fallback:

```typescript
// Determine assignee name - use assignedByName (who created/assigned the task)
const assigneeName = task.assignedByName || task.assigneeName || '';
const assigneeId = task.assignedById || task.assigneeId || '';
const assigneeImage = task.assignedByImageBase64 || task.assigneeImageBase64 || undefined;
```

**Priority order:**
1. First try `assignedByName` (primary - who assigned the task)
2. Then try `assigneeName` (fallback - who it's assigned to)
3. Finally use empty string (will show "Unassigned" as last resort)

### 2. Enhanced Debug Logging
Added comprehensive logging to help identify which fields contain data:

```typescript
if (index < 3) {
  console.log(`Task ${index + 1}:`, {
    taskId: task.taskId,
    title: task.taskTitle,
    apiStatus: task.status,
    mappedstatus: task.status as any,
    category: task.taskCategory,
    assignedById: task.assignedById,
    assignedByName: task.assignedByName,
    assigneeId: task.assigneeId,
    assigneeName: task.assigneeName,
    finalAssignee: assigneeName
  });
}
```

This logs both sets of assignee fields for the first 3 tasks, making it easy to see which field contains the actual data.

### 3. Updated Task Object Mapping
Applied the determined values to the task object:

```typescript
return {
  id: task.taskId,
  title: task.taskTitle || '',
  description: task.description || '',
  status: task.status as any,
  category: task.taskCategory || 'General',
  loggedHours: this.formatMinutesToTime(task.todayLoggedHours),
  totalHours: this.formatMinutesToTime(task.totalLoggedHours),
  startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
  assignee: assigneeName || 'Unassigned',
  assigneeId: assigneeId,
  assigneeImage: assigneeImage,
  progress: task.progress || 0,
  isFavorite: false
};
```

## API Field Structure

According to the `ActiveTaskDto` interface:

```typescript
export interface ActiveTaskDto {
  taskId: number;
  taskCategory: string;
  taskTitle: string;
  description: string;
  startDate?: string | Date;
  LastStartTime?: string | Date;

  todayLoggedHours: number;
  totalLoggedHours: number;

  progress: number;
  status: string;

  assignedById: string;        // ID of person who assigned the task
  assignedByName: string;       // Name of person who assigned the task
  assignedByImage?: string;
  assignedByImageBase64?: string;

  assigneeId: string;           // ID of person task is assigned to
  assigneeName: string;         // Name of person task is assigned to
  assigneeImage?: string;
  assigneeImageBase64?: string;
}
```

## Understanding the Fields

**For "My Tasks" view:**
- `assignedByName` = The person who created/assigned this task (e.g., "Manager Name")
- `assigneeName` = The person doing the task (usually the logged-in user)

**For "Assigned By Me" view:**
- `assignedByName` = The logged-in user (who assigned the task)
- `assigneeName` = The person who should do the task (e.g., "Team Member Name")

## Display Logic

The code now uses `assignedByName` as the primary field because:
1. In "My Tasks" view, users want to see who assigned them the task
2. This matches the typical workflow where you see who gave you the work
3. Falls back to `assigneeName` if `assignedByName` is empty
4. Shows "Unassigned" only if both fields are empty

## Testing Instructions

1. Open the My Task page
2. Check the browser console (F12)
3. Look for logs showing:
   ```
   Task 1: {
     taskId: 26,
     title: "...",
     assignedById: "ITS48",
     assignedByName: "John Doe",
     assigneeId: "ITS49",
     assigneeName: "Jane Smith",
     finalAssignee: "John Doe"
   }
   ```
4. Verify the ASSIGNEE column now shows actual names from the API
5. Check that:
   - Names display correctly (not "Unassigned")
   - Avatar shows first letter of the name
   - Names are from the backend API response
   - Different tasks show different assignee names

## Troubleshooting

If assignee names are still showing "Unassigned":

1. **Check Console Logs:**
   - Look at the first 3 task logs
   - Check if `assignedByName` has a value
   - Check if `assigneeName` has a value
   - See what `finalAssignee` shows

2. **Verify API Response:**
   - Open Network tab in browser DevTools
   - Find the `getActiveTaskList` API call
   - Check the response data
   - Verify `assignedByName` or `assigneeName` fields exist and have values

3. **Check Data Flow:**
   - API returns data → `ActiveTaskDto`
   - `convertActiveTasksToTasks()` maps to `Task` interface
   - HTML displays `task.assignee`

4. **Possible Issues:**
   - API not returning assignee fields
   - Fields are null or empty in database
   - Wrong API endpoint being called
   - Data not being populated on backend

## Files Modified

- `src/app/my-task/my-task.component.ts`
  - Updated `convertActiveTasksToTasks()` method
  - Changed assignee mapping to use `assignedByName` first, then `assigneeName`
  - Added comprehensive debug logging for both assignee fields
  - Updated assigneeId and assigneeImage mapping to use both field sets

## Benefits

1. **Dynamic Data**: Assignee names now come from the backend API
2. **Proper Fallback**: Uses multiple fields to ensure data is found
3. **Better Debugging**: Console logs show exactly which fields have data
4. **Correct Context**: Shows who assigned the task (more relevant for "My Tasks")
5. **No Hardcoding**: "Unassigned" only shows when API truly has no data

## Notes

- The primary field is now `assignedByName` (who assigned the task)
- Falls back to `assigneeName` if `assignedByName` is empty
- The debug logs will help identify which field the API is actually populating
- If both fields are empty, it means the backend is not returning assignee data
- The 200px column width provides ample space for full names to display
