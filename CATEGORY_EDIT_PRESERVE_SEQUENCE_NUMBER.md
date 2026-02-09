# Task Category Edit - Preserve Sequence Number (Estimated Hours)

## Summary
Updated the task category loading and editing functionality to properly preserve and display the `estimatedHours` (sequence number) field when editing existing categories.

## Problem
When editing a task category, the existing `estimatedHours` value from the API was not being mapped to the `sequenceNumber` field in the UI, causing the field to appear empty or show incorrect values.

## Solution
Updated the `loadTaskCategories()` method to properly map the API's `estimatedHours` field to the component's `sequenceNumber` field for all category lists.

## Changes Made

### 1. Component TypeScript (`src/app/my-task/my-task.component.ts`)

#### Updated `loadTaskCategories()` Method
Now properly maps `estimatedHours` from API to `sequenceNumber` in the UI:

```typescript
loadTaskCategories(): void {
  const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
  const userId = currentUser.empId || currentUser.employeeId || '1';
  
  this.api.getUserTaskCategories(userId).subscribe({
    next: (response: any) => {
      if (response && response.success && response.data) {
        // Map API response to TaskCategory interface with sequenceNumber
        this.favouriteList = (response.data.favouriteList || []).map((cat: any) => ({
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          departmentId: cat.departmentId,
          departmentName: cat.departmentName,
          sequenceNumber: cat.estimatedHours || 0,  // MAP estimatedHours to sequenceNumber
          isEditing: false
        }));
        
        this.departmentList = (response.data.departmentList || []).map((cat: any) => ({
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          departmentId: cat.departmentId,
          departmentName: cat.departmentName,
          sequenceNumber: cat.estimatedHours || 0,  // MAP estimatedHours to sequenceNumber
          isEditing: false
        }));
        
        this.allDepartmentList = (response.data.allDepartmentList || []).map((cat: any) => ({
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          departmentId: cat.departmentId,
          departmentName: cat.departmentName,
          sequenceNumber: cat.estimatedHours || 0,  // MAP estimatedHours to sequenceNumber
          isEditing: false
        }));
        
        this.taskCategories = [...this.allDepartmentList];
      }
      // ... similar mapping for direct data response
    },
    error: (error: any) => {
      console.error('Error loading task categories:', error);
    }
  });
}
```

#### Updated `cancelEdit()` Method
Now reloads data from API to discard any unsaved changes:

```typescript
cancelEdit(category: TaskCategory) {
  category.isEditing = false;
  // Reload original data from API to discard changes
  this.loadTaskCategories();
}
```

## Data Flow

### Loading Categories
1. Component calls `loadTaskCategories()`
2. API returns categories with `estimatedHours` field
3. Component maps each category:
   - `categoryId` → `categoryId`
   - `categoryName` → `categoryName`
   - `departmentId` → `departmentId`
   - `departmentName` → `departmentName`
   - `estimatedHours` → `sequenceNumber` ✅
   - Sets `isEditing` to `false`

### Editing a Category
1. User clicks "Edit" button
2. `startEditCategory()` sets `isEditing = true`
3. Edit form displays with all fields populated:
   - Department dropdown shows current `departmentId`
   - Category name shows current `categoryName`
   - Sequence number shows current `sequenceNumber` (from `estimatedHours`) ✅
4. User can modify any field
5. On Save: Sends updated values to API
6. On Cancel: Reloads data from API to restore original values

### Saving Changes
1. User modifies fields and clicks "Save"
2. `saveCategory()` sends request with:
   - `categoryId`: existing ID
   - `categoryName`: updated name
   - `departmentId`: updated department
   - `estimatedHours`: updated sequence number
   - `createdBy`: current user
3. API saves the changes
4. Component reloads categories to show updated data

## Field Mapping

| API Field | Component Field | Direction | Notes |
|-----------|----------------|-----------|-------|
| `estimatedHours` | `sequenceNumber` | API → UI | When loading categories |
| `sequenceNumber` | `estimatedHours` | UI → API | When saving categories |

## Example API Response

```json
{
  "success": true,
  "message": "Categories fetched successfully",
  "data": {
    "favouriteList": [
      {
        "categoryId": 1,
        "categoryName": "API Development",
        "departmentId": 5,
        "departmentName": "ENGINEERING",
        "estimatedHours": 10
      }
    ],
    "departmentList": [...],
    "allDepartmentList": [...]
  }
}
```

## Example Component Data After Mapping

```typescript
{
  categoryId: 1,
  categoryName: "API Development",
  departmentId: 5,
  departmentName: "ENGINEERING",
  sequenceNumber: 10,  // Mapped from estimatedHours
  isEditing: false
}
```

## Features

✅ Properly maps `estimatedHours` from API to `sequenceNumber` in UI
✅ Preserves sequence number when entering edit mode
✅ Displays existing sequence number in edit form
✅ Allows user to modify sequence number
✅ Saves updated sequence number back to API as `estimatedHours`
✅ Reloads data on cancel to discard unsaved changes
✅ Handles missing or null `estimatedHours` (defaults to 0)
✅ Consistent mapping across all category lists (favorites, department, all)

## Testing

### Test Edit with Existing Sequence Number
1. Create a category with sequence number 5
2. Save and close the form
3. Click "Edit" on the category
4. Verify sequence number field shows "5"
5. Change sequence number to 10
6. Click "Save"
7. Verify updated value is saved
8. Edit again and verify it shows "10"

### Test Edit without Sequence Number
1. Edit a category that has no sequence number (or 0)
2. Verify field is empty or shows "0"
3. Enter a sequence number
4. Save and verify it's stored

### Test Cancel Edit
1. Edit a category
2. Change the sequence number
3. Click "Cancel"
4. Verify original value is restored
5. Edit again and verify original value is still there

## Notes

- The API uses `estimatedHours` field name for storing sequence numbers
- The UI uses `sequenceNumber` for better clarity
- Mapping happens in both directions (load and save)
- Default value is 0 if `estimatedHours` is missing or null
- Cancel button now reloads data from API to ensure original values are restored
- All three category lists (favorites, department, all) are properly mapped
