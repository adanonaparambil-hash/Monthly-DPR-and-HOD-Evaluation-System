# Select Task Modal - Assign Button Creates New Task

## Issue
When user clicked "Assign" button from the Select Task modal, if a task with the same category already existed in their task list, the modal was loading the existing task's details instead of creating a new task assignment. This was incorrect behavior.

## Expected Behavior
- When clicking "Assign" from Select Task modal → Always create NEW task with empty form
- Task details should only load AFTER the user saves the new task
- Existing task details should only load when opening a task from the My Tasks list

## Solution

### File: `src/app/my-task/my-task.component.ts`

The `selectTask()` method was updated to always treat assignments from the Select Task modal as NEW tasks:

**Before:**
```typescript
selectTask(category: TaskCategory): void {
  // ... code ...
  
  // Check if there's an existing task for this category
  const existingTask = this.myTasksList.find(t => t.taskCategory === category.categoryName);
  
  if (existingTask) {
    // Load existing task details
    this.selectedTaskIdForModal = existingTask.taskId;
  } else {
    // New task
    this.selectedTaskIdForModal = 0;
  }
  
  this.showTaskDetailsModal = true;
}
```

**After:**
```typescript
selectTask(category: TaskCategory): void {
  // ... code ...
  
  // Always treat as NEW task assignment from Select Task modal
  // Task details will be loaded after saving
  console.log('Opening modal for new task assignment with categoryId:', category.categoryId);
  
  // Set properties for standalone modal component
  this.selectedTaskIdForModal = 0; // 0 indicates new task
  this.selectedUserIdForModal = userId;
  this.selectedCategoryIdForModal = category.categoryId;
  
  this.showTaskDetailsModal = true;
}
```

### File: `src/app/components/task-details-modal/task-details-modal.component.ts`

The modal component already handles this correctly in `ngOnInit()`:

```typescript
ngOnInit() {
  // Load common data
  this.loadCustomFields();
  this.loadProjectsList();
  this.loadEmployeeMasterList();
  
  // If taskId > 0, load existing task details
  if (this.taskId && this.taskId > 0 && this.userId && this.categoryId) {
    this.loadTaskDetails();
    this.loadTaskFiles(this.taskId);
    this.loadComments(this.taskId);
    this.loadActivity(this.taskId);
  } else if (this.categoryId && this.userId) {
    // New task - show empty form
    this.selectedTaskDetailStatus = 'not-started';
    this.editableTaskTitle = '';
    this.editableTaskDescription = '';
    this.dailyRemarks = '';
    this.selectedTaskProgress = 0;
  }
}
```

## Result
- Clicking "Assign" from Select Task modal now always opens an empty form for a new task
- No existing task details are loaded
- User fills in the details and saves
- After saving, the task details will be properly loaded
- This prevents confusion and data mixing between different task assignments

## User Experience
- Clear distinction between creating a new task and editing an existing one
- Users can assign the same category multiple times without interference
- Each assignment is independent until saved
