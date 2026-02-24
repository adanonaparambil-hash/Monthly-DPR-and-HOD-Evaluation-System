# New Task - Category Name Display

## Issue
When creating a new task (clicking "Assign" from Select Task modal), the task category name was not being displayed in the modal. Users needed to see which category they were assigning.

## Expected Behavior
- For NEW tasks (taskId = 0): Display the category name from the selected category
- Category name should be visible but not editable
- Category information should be clear to the user

## Solution

The implementation was already in place but needed verification:

### File: `src/app/my-task/my-task.component.ts`

The `selectTask()` method stores the category name:

```typescript
selectTask(category: TaskCategory): void {
  this.newTaskCategory = category;
  this.selectedCategoryId = category.categoryId;
  console.log('Selected task category:', category);
  
  // ... user validation ...
  
  // Set properties for standalone modal component
  this.selectedTaskIdForModal = 0; // 0 indicates new task
  this.selectedUserIdForModal = userId;
  this.selectedCategoryIdForModal = category.categoryId;
  this.selectedCategoryNameForModal = category.categoryName; // Pass category name for new tasks
  
  this.showTaskDetailsModal = true;
}
```

Property declaration:
```typescript
selectedCategoryNameForModal: string = ''; // Category name for new tasks
```

### File: `src/app/my-task/my-task.component.html`

The modal component receives the category name:

```html
@if (showTaskDetailsModal) {
  <app-task-details-modal
    [taskId]="selectedTaskIdForModal"
    [userId]="selectedUserIdForModal"
    [categoryId]="selectedCategoryIdForModal"
    [categoryName]="selectedCategoryNameForModal"
    [isViewOnly]="isTaskModalViewOnly"
    (closeModal)="closeTaskDetailsModal()"
    (taskUpdated)="onTaskUpdatedFromModal($event)"
    (taskPaused)="onTaskPausedFromModal($event)"
    (taskResumed)="onTaskResumedFromModal($event)"
    (taskStopped)="onTaskStoppedFromModal($event)">
  </app-task-details-modal>
}
```

### File: `src/app/components/task-details-modal/task-details-modal.component.ts`

Input property and initialization:

```typescript
// Input properties
@Input() taskId!: number;
@Input() userId!: string;
@Input() categoryId!: number;
@Input() categoryName?: string; // Category name for new tasks
@Input() isViewOnly: boolean = false;

ngOnInit() {
  // ... load common data ...
  
  if (this.taskId && this.taskId > 0 && this.userId && this.categoryId) {
    // Load existing task details
    this.loadTaskDetails();
  } else if (this.categoryId && this.userId) {
    // New task - set category name
    this.selectedTaskDetailStatus = 'not-started';
    this.selectedTaskCategory = this.categoryName || ''; // Set category name for new tasks
    this.editableTaskTitle = '';
    this.editableTaskDescription = '';
    // ...
  }
}
```

### File: `src/app/components/task-details-modal/task-details-modal.component.html`

The category is displayed in the modal:

```html
<div class="title-section">
  <div class="title-content">
    <div class="task-meta">
      <span class="modal-category-badge">{{ selectedTaskCategory }}</span>
    </div>
    <input type="text" class="modal-task-title editable-title" 
           [(ngModel)]="editableTaskTitle"
           placeholder="Enter task title..." 
           [readonly]="isViewOnly">
  </div>
  <!-- ... rest of the content ... -->
</div>
```

## Result
- New tasks display the selected category name in a badge
- Category name is visible and clear to the user
- Category is not editable (comes from the selected category)
- Users can see which category they are assigning a task to
- Category information flows correctly from Select Task modal → Parent component → Task Details modal

## User Experience
- Clear indication of which category the new task belongs to
- Category badge appears prominently in the task details
- No confusion about task categorization
- Professional, informative display
