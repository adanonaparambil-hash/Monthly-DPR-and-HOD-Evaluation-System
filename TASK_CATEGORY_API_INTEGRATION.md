# Task Category API Integration - Save & Update

## Summary
Integrated the `saveTaskCategory` API for both creating new task categories and updating existing ones in the Manage Task Categories modal.

## Changes Made

### 1. Component TypeScript (`src/app/my-task/my-task.component.ts`)

#### Updated `saveNewCategory()` Method
Now calls the API to create a new task category:

```typescript
saveNewCategory() {
  if (this.newTaskCategory.categoryName.trim() && this.newTaskCategory.departmentId) {
    // Get current user
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const userId = currentUser.empId || currentUser.employeeId || '1';

    // Prepare API request
    const request: any = {
      categoryName: this.newTaskCategory.categoryName.trim(),
      departmentId: this.newTaskCategory.departmentId,
      createdBy: userId,
      estimatedHours: this.newTaskCategory.sequenceNumber || 0
    };

    // Call API to create category
    this.api.saveTaskCategory(request).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          console.log('Category created successfully:', response);
          
          // Reset form
          this.isAddingNewCategory = false;
          this.newTaskCategory = { 
            categoryId: 0, 
            categoryName: '', 
            departmentId: 0, 
            departmentName: '', 
            sequenceNumber: 0 
          };
          
          // Reload task categories to get fresh data
          this.loadTaskCategories();
        } else {
          console.error('Failed to create category:', response?.message);
          alert('Failed to create category: ' + (response?.message || 'Unknown error'));
        }
      },
      error: (error: any) => {
        console.error('Error creating category:', error);
        alert('Error creating category. Please try again.');
      }
    });
  }
}
```

#### Updated `saveCategory()` Method
Now calls the API to update an existing task category:

```typescript
saveCategory(category: TaskCategory) {
  if (category.categoryName.trim() && category.departmentId) {
    // Get current user
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const userId = currentUser.empId || currentUser.employeeId || '1';

    // Prepare API request
    const request: any = {
      categoryId: category.categoryId,
      categoryName: category.categoryName.trim(),
      departmentId: category.departmentId,
      createdBy: userId,
      estimatedHours: category.sequenceNumber || 0
    };

    // Call API to update category
    this.api.saveTaskCategory(request).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          category.isEditing = false;
          console.log('Category updated successfully:', response);
          
          // Reload task categories to get fresh data
          this.loadTaskCategories();
        } else {
          console.error('Failed to update category:', response?.message);
          alert('Failed to update category: ' + (response?.message || 'Unknown error'));
        }
      },
      error: (error: any) => {
        console.error('Error updating category:', error);
        alert('Error updating category. Please try again.');
      }
    });
  }
}
```

### 2. HTML Template (`src/app/my-task/my-task.component.html`)

#### Updated Edit Form Save Button
Added validation to disable save button when required fields are empty:

```html
<button 
  class="btn-save-edit" 
  (click)="saveCategory(category)"
  [disabled]="!category.categoryName.trim() || category.departmentId === 0"
>
  <i class="fas fa-check"></i>
  Save
</button>
```

### 3. API Service (`src/app/services/api.ts`)

The API method already exists:
```typescript
saveTaskCategory(request: TaskCategoryRequest): Observable<any> {
  return this.http.post(`${this.apiUrl}/DailyTimeSheet/SaveTaskCategory`, request);
}
```

## API Request Structure

### TaskCategoryRequest Model
```typescript
export interface TaskCategoryRequest {
  categoryId?: number;        // Optional for new, required for update
  categoryName: string;        // Required
  departmentId: number;        // Required
  createdBy: string;          // User ID
  estimatedHours: number;     // Sequence number
}
```

### Create New Category Request
```json
{
  "categoryName": "API Development",
  "departmentId": 5,
  "createdBy": "EMP001",
  "estimatedHours": 1
}
```

### Update Existing Category Request
```json
{
  "categoryId": 123,
  "categoryName": "API Development",
  "departmentId": 5,
  "createdBy": "EMP001",
  "estimatedHours": 1
}
```

## Data Flow

### Create New Category
1. User fills in the form (Department, Category Name, Sequence Number)
2. User clicks "Save Category"
3. `saveNewCategory()` is called
4. Gets current user ID from localStorage
5. Prepares request object with:
   - `categoryName`: trimmed category name
   - `departmentId`: selected department ID
   - `createdBy`: current user ID
   - `estimatedHours`: sequence number (or 0 if not provided)
6. Calls `api.saveTaskCategory(request)`
7. On success:
   - Closes the add form
   - Resets form fields
   - Reloads task categories from API
8. On error:
   - Shows error alert
   - Keeps form open for retry

### Update Existing Category
1. User clicks "Edit" on a category
2. User modifies fields (Department, Category Name, Sequence Number)
3. User clicks "Save"
4. `saveCategory(category)` is called
5. Gets current user ID from localStorage
6. Prepares request object with:
   - `categoryId`: existing category ID
   - `categoryName`: trimmed category name
   - `departmentId`: selected department ID
   - `createdBy`: current user ID
   - `estimatedHours`: sequence number (or 0 if not provided)
7. Calls `api.saveTaskCategory(request)`
8. On success:
   - Exits edit mode
   - Reloads task categories from API
9. On error:
   - Shows error alert
   - Keeps edit mode active for retry

## Field Mapping

| UI Field | API Field | Notes |
|----------|-----------|-------|
| Category Name | `categoryName` | Required, trimmed |
| Department | `departmentId` | Required, from dropdown |
| Sequence Number | `estimatedHours` | Optional, defaults to 0 |
| Category ID | `categoryId` | Only for updates |
| Created By | `createdBy` | Current user ID |

## Features

✅ Creates new task categories via API
✅ Updates existing task categories via API
✅ Gets current user ID from localStorage
✅ Validates required fields before API call
✅ Reloads categories after successful save
✅ Shows error alerts on failure
✅ Disables save button when validation fails
✅ Closes form/exits edit mode on success
✅ Handles both success and error responses

## Error Handling

- **Network Error**: Shows alert "Error creating/updating category. Please try again."
- **API Error**: Shows alert with error message from API response
- **Validation Error**: Save button is disabled until all required fields are filled

## Testing

### Test Create New Category
1. Open Manage Task Categories modal
2. Click "Add New Category"
3. Select a department from dropdown
4. Enter category name
5. Enter sequence number (optional)
6. Click "Save Category"
7. Verify API is called with correct data
8. Verify form closes on success
9. Verify categories list is refreshed

### Test Update Category
1. Open Manage Task Categories modal
2. Click "Edit" on an existing category
3. Change department, name, or sequence number
4. Click "Save"
5. Verify API is called with categoryId
6. Verify edit mode exits on success
7. Verify categories list is refreshed

### Test Validation
1. Try to save without selecting department - button should be disabled
2. Try to save with empty category name - button should be disabled
3. Verify save button is enabled only when all required fields are filled

## Notes

- The `estimatedHours` field is used to store the sequence number
- The API uses the same endpoint for both create and update operations
- The presence of `categoryId` in the request determines if it's an update
- After successful save, the component reloads all categories to ensure data consistency
- User ID is retrieved from localStorage `current_user` object
