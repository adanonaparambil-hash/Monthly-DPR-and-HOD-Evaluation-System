# Assignee User ID Fix and Debug Status Removal

## Issues Fixed

### 1. Assignee Sending Name Instead of User ID
The save function was sending the assignee name (text) instead of the user ID when saving task changes.

### 2. Debug Status Text Visible in Modal
The debug text "Status: pause" was showing in the modal header next to the Running Timer, which was not needed.

## Root Causes

### Issue 1: Assignee Field
- The `Task` interface only had `assignee` field (name) but no `assigneeId` field
- The `convertActiveTasksToTasks` method was mapping `assignedByName` to `assignee` but not mapping the ID
- The `saveTaskChanges` method was using `this.selectedTask.assignee` (name) instead of the user ID

### Issue 2: Debug Text
- The debug status display was enabled in the HTML template to help troubleshoot the pause/resume button issue
- It was left visible after debugging

## Solutions Implemented

### 1. Added assigneeId Field to Task Interface
```typescript
interface Task {
  id: number;
  title: string;
  description: string;
  status: 'NOT STARTED' | 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'CLOSED';
  category: string;
  categoryId?: number;
  loggedHours: string;
  totalHours: string;
  startDate: string;
  assignee: string;
  assigneeId?: string; // Added this field
  assigneeImage?: string;
  progress: number;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  isFavorite?: boolean;
}
```

### 2. Updated convertActiveTasksToTasks Method
Now maps both assignee name and ID from the API response:
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
  assignee: task.assigneeName || 'Unassigned',  // Display name
  assigneeId: task.assigneeId || '',             // User ID for API calls
  assigneeImage: task.assigneeImageBase64 || undefined,
  progress: task.progress || 0,
  isFavorite: false
};
```

### 3. Updated saveTaskChanges Method
Changed from using assignee name to assignee ID:
```typescript
const saveRequest: TaskSaveDto = {
  // ... other fields
  assignees: [this.selectedTask.assigneeId || userId],  // Now uses ID instead of name
  // ... other fields
};
```

### 4. Removed Debug Status Text
Removed the debug display from the HTML template:
```html
<div class="timer-buttons">
  <!-- Debug text removed -->
  
  <!-- Show Pause button when task is RUNNING -->
  <button class="timer-btn pause-btn" 
          *ngIf="selectedTaskDetailStatus === 'running'"
          (click)="pauseTaskFromModal()"
          title="Pause Task">
    <i class="fas fa-pause"></i>
  </button>
  
  <!-- Show Resume button when task is PAUSED -->
  <button class="timer-btn resume-btn" 
          *ngIf="selectedTaskDetailStatus === 'pause' || selectedTaskDetailStatus === 'paused'"
          (click)="resumeTaskFromModal()"
          title="Resume Task">
    <i class="fas fa-play"></i>
  </button>
  
  <!-- Always show Stop button -->
  <button class="timer-btn stop-btn"
          (click)="stopTaskFromModal()"
          title="Stop Task">
    <i class="fas fa-stop"></i>
  </button>
</div>
```

## API Data Mapping

The `ActiveTaskDto` interface from the API provides:
- `assigneeId`: The user ID (e.g., "ITS48")
- `assigneeName`: The display name (e.g., "John Doe")
- `assigneeImage`: Optional image URL
- `assigneeImageBase64`: Optional base64 image data

Now both fields are properly captured and used:
- `assigneeName` → displayed in the UI
- `assigneeId` → sent to the API in save requests

## Testing Instructions

1. Open a task in the modal
2. Verify the debug "Status: pause" text is no longer visible
3. Make changes to the task
4. Click Save
5. Check the browser console for "Saving task changes" log
6. Verify the `assignees` array contains user IDs (e.g., ["ITS48"]) not names
7. Verify the API receives the correct user ID in the assignees field

## Files Modified

- `src/app/my-task/my-task.component.ts`
  - Added `assigneeId` field to Task interface
  - Updated `convertActiveTasksToTasks()` to map assigneeId from API
  - Updated `saveTaskChanges()` to use assigneeId instead of assignee name
  - Added debug logging for assigneeId in conversion method
  
- `src/app/my-task/my-task.component.html`
  - Removed debug status text display from timer buttons section

## Notes

- The assignee name is still displayed in the UI for user-friendly viewing
- The assignee ID is now properly sent to the API for backend processing
- The debug console logs will show both assigneeId and assigneeName for the first 3 tasks when loading
- This ensures the API receives the correct user identifier instead of the display name
