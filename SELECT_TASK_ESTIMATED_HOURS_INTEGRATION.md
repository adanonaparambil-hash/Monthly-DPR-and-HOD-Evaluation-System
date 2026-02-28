# Select Task - Estimated Hours Integration

## Overview
When a user selects a task from the "Select Task" modal, the estimated hours from the task category is now automatically passed to the task details modal and saved with the task.

## Changes Made

### 1. Pass Estimated Hours from Category Selection

#### File: `src/app/my-task/my-task.component.ts`

**Method: `selectTask()`**

Added code to pass estimated hours from category:
```typescript
this.selectedTaskEstimatedHours = category.sequenceNumber || 0; // Pass estimated hours from category
```

**Full Updated Method:**
```typescript
selectTask(category: TaskCategory): void {
  this.newTaskCategory = category;
  this.selectedCategoryId = category.categoryId;
  console.log('Selected task category:', category);
  
  const currentUser = this.sessionService.getCurrentUser();
  const userId = currentUser?.empId || currentUser?.employeeId || '';
  
  if (!userId) {
    this.toasterService.showError('Error', 'Unable to identify current user...');
    return;
  }
  
  console.log('Opening modal for new task assignment with categoryId:', 
    category.categoryId, 'estimatedHours:', category.sequenceNumber);
  
  // Set properties for standalone modal component
  this.selectedTaskIdForModal = 0; // 0 indicates new task
  this.selectedUserIdForModal = userId;
  this.selectedCategoryIdForModal = category.categoryId;
  this.selectedCategoryNameForModal = category.categoryName;
  this.selectedTaskEstimatedHours = category.sequenceNumber || 0; // NEW
  
  this.showSelectTaskModal = false;
  this.showTaskDetailsModal = true;
  document.body.style.overflow = 'hidden';
}
```

### 2. Pass Estimated Hours to Modal Component

#### File: `src/app/my-task/my-task.component.html`

Added `[estimatedHours]` input binding:
```html
<app-task-details-modal
  [taskId]="selectedTaskIdForModal"
  [userId]="selectedUserIdForModal"
  [categoryId]="selectedCategoryIdForModal"
  [categoryName]="selectedCategoryNameForModal"
  [estimatedHours]="selectedTaskEstimatedHours"
  [isViewOnly]="isTaskModalViewOnly"
  (closeModal)="closeTaskDetailsModal()"
  ...>
</app-task-details-modal>
```

### 3. Receive Estimated Hours in Modal

#### File: `src/app/components/task-details-modal/task-details-modal.component.ts`

**Added Input Property:**
```typescript
@Input() estimatedHours?: number; // Estimated hours from category
```

**Updated ngOnInit for New Tasks:**
```typescript
else if (this.categoryId && this.userId) {
  // New task - just show empty form with category info
  console.log('New task mode - showing empty form for categoryId:', 
    this.categoryId, 'estimatedHours:', this.estimatedHours);
  
  this.selectedTaskDetailStatus = 'not-started';
  this.selectedTaskCategory = this.categoryName || '';
  this.selectedTaskEstimatedHours = this.estimatedHours || 0; // NEW
  this.editableTaskTitle = '';
  this.editableTaskDescription = '';
  this.dailyRemarks = '';
  this.selectedTaskProgress = 0;
  this.taskProgress = 0;
}
```

### 4. Save Estimated Hours with Task

The `saveTaskBulk` API call already includes estimated hours:
```typescript
const taskSaveRequest: TaskSaveDto = {
  taskId: this.taskId,
  categoryId: this.categoryId,
  taskTitle: this.editableTaskTitle?.trim() || '',
  description: this.editableTaskDescription?.trim() || '',
  projectId: parseInt(this.selectedProjectId) || 0,
  departmentId: 0,
  targetDate: this.selectedTaskEndDate || undefined,
  startDate: this.selectedTaskStartDate || undefined,
  progress: this.taskProgress || 0,
  estimatedHours: this.selectedTaskEstimatedHours || 0, // Included
  status: apiStatus,
  createdBy: userId,
  assignees: assignees,
  customFields: this.selectedCustomFields.map(...)
};

this.api.saveTaskBulk(taskSaveRequest).subscribe({...});
```

## Data Flow

### Step 1: User Selects Task Category
```
User clicks on category in "Select Task" modal
Category object: {
  categoryId: 123,
  categoryName: "Development",
  sequenceNumber: 8.5  // This is estimatedHours from API
}
```

### Step 2: Pass to Parent Component
```typescript
// In my-task.component.ts
this.selectedTaskEstimatedHours = category.sequenceNumber || 0;
// Result: selectedTaskEstimatedHours = 8.5
```

### Step 3: Pass to Modal Component
```html
<!-- In my-task.component.html -->
<app-task-details-modal
  [estimatedHours]="selectedTaskEstimatedHours">
</app-task-details-modal>
```

### Step 4: Receive in Modal
```typescript
// In task-details-modal.component.ts
@Input() estimatedHours?: number;

ngOnInit() {
  this.selectedTaskEstimatedHours = this.estimatedHours || 0;
  // Result: selectedTaskEstimatedHours = 8.5
}
```

### Step 5: Display in Form
```html
<!-- Estimated Hours field shows: 8.5 -->
<input [(ngModel)]="selectedTaskEstimatedHours" />
```

### Step 6: Save to API
```typescript
const taskSaveRequest = {
  ...
  estimatedHours: this.selectedTaskEstimatedHours || 0,
  // Sent to API: estimatedHours: 8.5
};

this.api.saveTaskBulk(taskSaveRequest).subscribe({...});
```

## Files Modified

1. **src/app/my-task/my-task.component.ts**
   - Updated `selectTask()` method to pass estimated hours

2. **src/app/my-task/my-task.component.html**
   - Added `[estimatedHours]` input binding to modal

3. **src/app/components/task-details-modal/task-details-modal.component.ts**
   - Added `@Input() estimatedHours` property
   - Updated `ngOnInit()` to set estimated hours for new tasks

## API Integration

### Task Category API Response
```json
{
  "categoryId": 123,
  "categoryName": "Development",
  "estimatedHours": 8.5,
  "departmentId": 5
}
```

### Component Mapping
```typescript
sequenceNumber: cat.eSTIMATEDHOURS || cat.estimatedHours || 0
// Maps to: sequenceNumber = 8.5
```

### Save Task API Request
```json
{
  "taskId": 0,
  "categoryId": 123,
  "taskTitle": "New Task",
  "estimatedHours": 8.5,
  ...
}
```

## User Experience

### Before
1. User selects task category from "Select Task" modal
2. Task details modal opens
3. Estimated Hours field is empty (0)
4. User must manually enter estimated hours
5. User saves task

### After
1. User selects task category from "Select Task" modal
2. Task details modal opens
3. **Estimated Hours field shows category's estimated hours** (e.g., 8.5)
4. User can modify if needed or keep default
5. User saves task with estimated hours

## Benefits

1. ✅ **Automatic Population**: Estimated hours filled automatically
2. ✅ **Consistency**: Uses category's predefined estimated hours
3. ✅ **Time Saving**: No need to manually enter hours
4. ✅ **Accuracy**: Reduces data entry errors
5. ✅ **Flexibility**: User can still modify if needed
6. ✅ **Complete Data**: Tasks always have estimated hours

## Testing Checklist

- [x] Select task from "Select Task" modal
- [x] Task details modal opens
- [x] Estimated Hours field shows category's value
- [x] Value is editable
- [x] Save task includes estimated hours
- [x] API receives correct estimated hours value
- [x] Task loads with correct estimated hours
- [x] Console logs show estimated hours flow
- [x] No TypeScript errors
- [x] No runtime errors

## Example Scenarios

### Scenario 1: Development Task (8.5 hours)
```
1. User clicks "Development" category (estimatedHours: 8.5)
2. Modal opens with Estimated Hours: 8.5
3. User enters task title and description
4. User clicks Save
5. API receives: estimatedHours: 8.5
6. Task saved successfully
```

### Scenario 2: Quick Task (0.5 hours)
```
1. User clicks "Quick Fix" category (estimatedHours: 0.5)
2. Modal opens with Estimated Hours: 0.5
3. User enters task details
4. User clicks Save
5. API receives: estimatedHours: 0.5
```

### Scenario 3: User Modifies Estimated Hours
```
1. User clicks "Development" category (estimatedHours: 8.5)
2. Modal opens with Estimated Hours: 8.5
3. User changes to 10.0
4. User clicks Save
5. API receives: estimatedHours: 10.0
```

## Console Logging

Enhanced logging helps track the flow:

```typescript
// In selectTask()
console.log('Opening modal for new task assignment with categoryId:', 
  category.categoryId, 'estimatedHours:', category.sequenceNumber);

// In ngOnInit()
console.log('New task mode - showing empty form for categoryId:', 
  this.categoryId, 'estimatedHours:', this.estimatedHours);
```

## Notes

- The category's `sequenceNumber` field stores the estimated hours
- API returns it as `estimatedHours` or `eSTIMATEDHOURS`
- Both variants are handled with fallback: `cat.eSTIMATEDHOURS || cat.estimatedHours || 0`
- The modal's `selectedTaskEstimatedHours` property already existed
- No duplicate properties were created
- The save API already included estimated hours field
- This change completes the data flow from category to saved task

## Future Enhancements

1. **Historical Tracking**: Track actual vs estimated hours
2. **Auto-adjust**: Suggest estimated hours based on historical data
3. **Validation**: Warn if estimated hours seem too high/low
4. **Templates**: Save common task templates with estimated hours
5. **Reporting**: Show estimated vs actual hours in reports
