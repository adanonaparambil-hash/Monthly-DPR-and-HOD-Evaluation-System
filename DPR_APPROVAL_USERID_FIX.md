# DPR Approval - Use Record's UserId for API Calls

## Issue
When opening task details modal from DPR Approval listing, the API call was using the session userId instead of the record's userId. This caused incorrect data to be loaded when viewing other users' tasks.

## Solution
Updated the DPR Approval component to capture and use the record's userId from the API response.

## Changes Made

### 1. Updated DPRLog Interface
Added `userId` field to store the user ID from the API response:

```typescript
interface DPRLog {
  id: string;
  taskId?: number;
  categoryId?: number;
  userId?: string;  // Added this field
  date: string;
  project: string;
  projectType: 'internal' | 'client';
  taskTitle: string;
  taskDescription: string;
  category: string;
  categoryType: 'security' | 'backend' | 'feature' | 'bugfix';
  hours: string;
  status: 'pending' | 'approved' | 'rejected';
  isSelected?: boolean;
}
```

### 2. Updated loadApprovalList() Method
Modified the API response mapping to capture userId from the record:

```typescript
this.displayedLogs = response.data.records?.map((item: any) => ({
  id: item.approvalId?.toString() || item.taskId?.toString(),
  taskId: item.taskId,
  categoryId: item.categoryID || item.categoryId,
  userId: item.userId || item.empId || item.employeeId || '', // Capture userId
  date: this.formatDisplayDate(item.logDate),
  project: item.project || 'N/A',
  projectType: 'internal',
  taskTitle: item.taskTitle || 'No Title',
  taskDescription: item.dailyRemarks || item.taskDescription || 'No Description',
  category: item.category || 'N/A',
  categoryType: 'feature',
  hours: this.formatHours(item.hours),
  status: item.status?.toLowerCase() || 'pending',
  isSelected: false
})) || [];
```

### 3. Updated openTaskDetailsModal() Method
Modified to use the record's userId instead of session userId:

```typescript
openTaskDetailsModal(log: DPRLog) {
  const taskId = log.taskId || 0;
  
  if (!taskId) {
    console.error('Invalid task ID for log:', log);
    return;
  }

  // Use the record's userId instead of session userId
  const recordUserId = log.userId || '';
  
  // Fallback to session userId if record doesn't have userId
  const currentUser = this.sessionService.getCurrentUser();
  const sessionUserId = currentUser?.empId || currentUser?.employeeId || '';
  const userId = recordUserId || sessionUserId;
  
  // Use categoryId directly from the log
  const categoryId = log.categoryId || this.getCategoryIdFromName(log.category);
  
  console.log('Opening task details modal from DPR Approval:', {
    taskId: taskId,
    userId: userId,
    recordUserId: recordUserId,
    sessionUserId: sessionUserId,
    categoryId: categoryId,
    categoryIdFromLog: log.categoryId,
    category: log.category
  });
  
  // Set properties for modal
  this.selectedTaskIdForModal = taskId;
  this.selectedUserIdForModal = userId;
  this.selectedCategoryIdForModal = categoryId || 0;
  
  // Show the modal
  this.showTaskDetailsModal = true;
  document.body.style.overflow = 'hidden';
}
```

## How It Works

1. When the DPR Approval list is loaded, the userId is captured from each record in the API response
2. The userId is stored in the `DPRLog` object along with other record data
3. When opening the task details modal, the record's userId is used instead of the session userId
4. If the record doesn't have a userId, it falls back to the session userId for safety

## Benefits

- Correctly loads task data for the user who owns the record
- Works consistently with the "My Logged Hours" implementation
- Maintains view-only mode for DPR Approval (always view-only)
- Provides proper fallback to session userId if record userId is missing

## Files Modified

- `src/app/dpr-approval/dpr-approval.component.ts`

## Testing

Test by:
1. Opening DPR Approval page
2. Selecting a user from the pending users list
3. Clicking on any task record to open the modal
4. Verify that the correct user's task data is loaded
5. Verify that the modal is in view-only mode (no timer, no save button)
6. Verify that comments can still be added

## Status
✅ Complete - No TypeScript errors
