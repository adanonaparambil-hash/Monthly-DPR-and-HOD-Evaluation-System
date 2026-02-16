# My Logged Hours - CategoryID from API Response

## Issue
The `GetUserDailyLogHistory` API response includes `CategoryId` field, but the component was trying to look it up by category name instead of using the value directly from the API.

## Solution
Updated the My Logged Hours component to use the `CategoryId` directly from the API response when opening the task details modal, matching the implementation in DPR Approval.

---

## Changes Made

### 1. Updated LoggedHour Interface
Added `categoryId` field to store the category ID from API response:

```typescript
interface LoggedHour {
  id: string;
  taskId: string;
  categoryId?: number;  // ✅ Added
  title: string;
  description: string;
  category: string;
  priority?: string;
  duration: string;
  date: string;
  project: string;
  dailyComment?: string;
  loggedBy?: string;
}
```

---

### 2. Updated API Response Mapping
Added `categoryId` mapping from the API response in both response handlers:

```typescript
// First handler (response.success && response.data)
this.loggedHours = response.data.map((log: any, index: number) => ({
  id: `${log.taskId}-${index}`,
  taskId: `TSK-${log.taskId}`,
  categoryId: log.CategoryId || log.categoryId, // ✅ Added - handles both field name variations
  title: log.taskTitle || 'Untitled Task',
  description: log.description || log.dailyComment || 'No description',
  category: log.categoryName || 'Uncategorized',
  duration: log.duration || '00:00',
  date: log.logDate ? log.logDate.split('T')[0] : '',
  project: log.projectName || 'No Project',
  dailyComment: log.dailyComment || '',
  loggedBy: log.loggedBy || ''
}));

// Second handler (Array.isArray(response.data))
this.loggedHours = response.data.map((log: any, index: number) => ({
  id: `${log.taskId}-${index}`,
  taskId: `TSK-${log.taskId}`,
  categoryId: log.CategoryId || log.categoryId, // ✅ Added - handles both field name variations
  title: log.taskTitle || 'Untitled Task',
  description: log.description || log.dailyComment || 'No description',
  category: log.categoryName || 'Uncategorized',
  duration: log.duration || '00:00',
  date: log.logDate ? log.logDate.split('T')[0] : '',
  // ... rest of fields
}));
```

**Note**: Handles both `CategoryId` (PascalCase) and `categoryId` (camelCase) from API response.

---

### 3. Updated openTaskDetailsModal Method
Changed to use `categoryId` directly from the log, with fallback to lookup by name:

```typescript
openTaskDetailsModal(loggedHour: LoggedHour) {
  // Extract numeric task ID from the taskId string (e.g., "TSK-123" -> 123)
  const taskIdMatch = loggedHour.taskId.match(/\d+/);
  const taskId = taskIdMatch ? parseInt(taskIdMatch[0]) : 0;
  
  if (!taskId) {
    console.error('Invalid task ID:', loggedHour.taskId);
    return;
  }

  // Get current user
  const currentUser = this.sessionService.getCurrentUser();
  const userId = currentUser?.empId || currentUser?.employeeId || '';
  
  // ✅ Use categoryId directly from the log (from API response)
  // Fallback to looking it up by name if not available
  const categoryId = loggedHour.categoryId || this.getCategoryIdFromName(loggedHour.category);
  
  console.log('Opening task details modal from My Logged Hours:', {
    taskId: taskId,
    userId: userId,
    categoryId: categoryId,
    categoryIdFromLog: loggedHour.categoryId,  // ✅ Added for debugging
    category: loggedHour.category
  });
  
  // Set properties for standalone modal component
  this.selectedTaskIdForModal = taskId;
  this.selectedUserIdForModal = userId;
  this.selectedCategoryIdForModal = categoryId || 0;
  
  // Show the modal
  this.showTaskDetailsModal = true;
  
  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}
```

---

### 4. Updated getCategoryIdFromName Method
Changed to a fallback helper method:

```typescript
// Helper method to get category ID from category name (fallback)
private getCategoryIdFromName(categoryName: string): number {
  // Try to find the category ID from the task categories list
  const category = this.taskCategories.find(cat => cat.categoryName === categoryName);
  if (category) {
    return category.categoryId;
  }
  
  // If not found, return 0 (will need to be handled by the modal)
  console.warn('Category ID not found for:', categoryName);
  return 0;
}
```

---

## Benefits

1. **Consistent with DPR Approval**: Both pages now use the same pattern
2. **More Reliable**: Uses the exact categoryId from the API response instead of trying to match by name
3. **Better Performance**: No need to search through the taskCategories array
4. **Handles Edge Cases**: Fallback to name lookup if categoryId is not in the response
5. **Debugging Support**: Added console log to show both categoryId from log and from lookup

---

## Data Flow

### Before (Lookup by Name)
```
API Response → category name → search taskCategories array → find categoryId → pass to modal
```

### After (Direct from API)
```
API Response → CategoryId field → pass directly to modal
                                ↓ (if not available)
                         fallback to name lookup
```

---

## Comparison with DPR Approval

Both pages now follow the exact same pattern:

| Feature | My Logged Hours | DPR Approval |
|---------|----------------|--------------|
| API Call | `GetUserDailyLogHistory` | `GetEmployeeApprovalListPaged` |
| CategoryId Field | `CategoryId` or `categoryId` | `categoryID` or `categoryId` |
| Interface Field | `categoryId?: number` | `categoryId?: number` |
| Primary Source | `loggedHour.categoryId` | `log.categoryId` |
| Fallback | `getCategoryIdFromName()` | `getCategoryIdFromName()` |
| Modal Integration | ✅ Same | ✅ Same |

---

## Testing

✅ No TypeScript compilation errors
✅ CategoryId properly mapped from API response
✅ Modal receives correct categoryId
✅ Fallback to name lookup works if categoryId not in response
✅ Console logging added for debugging
✅ Consistent with DPR Approval implementation

---

## Files Modified

- `src/app/my-logged-hours/my-logged-hours.component.ts`
  - Updated `LoggedHour` interface
  - Updated API response mapping (both handlers)
  - Updated `openTaskDetailsModal()` method
  - Updated `getCategoryIdFromName()` method comment

---

## Summary

The My Logged Hours component now correctly uses the `CategoryId` field from the `GetUserDailyLogHistory` API response when opening the task details modal. This matches the implementation in DPR Approval and is more reliable and efficient than looking up the category ID by name. A fallback mechanism is still in place for cases where the categoryId might not be in the response.

Both My Logged Hours and DPR Approval now use the same pattern for handling categoryId from their respective API responses.
