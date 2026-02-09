# Estimated Hours Display Fix

## Summary
Fixed the issue where estimated hours (sequence number) were not displaying in the edit form by correcting the API field name mapping and adding visual display in the category list view.

## Problem
The estimated hours field was being fetched from the backend but not displaying in the UI because:
1. The API field name is `eSTIMATEDHOURS` (not `estimatedHours`)
2. No visual display of estimated hours in the list view

## Solution
1. Updated field mapping to check for both `eSTIMATEDHOURS` and `estimatedHours`
2. Added estimated hours display in the category list view
3. Added debugging logs to track data flow
4. Added CSS styling for the hours badge

## Changes Made

### 1. Component TypeScript (`src/app/my-task/my-task.component.ts`)

#### Updated `loadTaskCategories()` Method
Changed field mapping to handle the correct API field name:

```typescript
sequenceNumber: cat.eSTIMATEDHOURS || cat.estimatedHours || 0
```

This tries `eSTIMATEDHOURS` first (the actual API field), then falls back to `estimatedHours`, then defaults to 0.

#### Added Debug Logging
```typescript
// Debug: Log first category to see structure
if (this.allDepartmentList.length > 0) {
  console.log('Sample category with sequenceNumber:', this.allDepartmentList[0]);
}
```

#### Updated `startEditCategory()` Method
Added logging to track values when entering edit mode:

```typescript
console.log('Editing category:', {
  categoryId: category.categoryId,
  categoryName: category.categoryName,
  departmentId: category.departmentId,
  departmentName: category.departmentName,
  sequenceNumber: category.sequenceNumber
});
```

### 2. HTML Template (`src/app/my-task/my-task.component.html`)

#### Added Estimated Hours Display in List View
```html
<p class="category-dept">
  {{ category.departmentName }}
  @if (category.sequenceNumber && category.sequenceNumber > 0) {
    <span class="category-hours"> • {{ category.sequenceNumber }}h</span>
  }
</p>
```

This shows the estimated hours as a badge next to the department name (e.g., "ENGINEERING • 10h").

### 3. CSS Styles (`src/app/my-task/my-task.component.css`)

#### Updated `.category-dept` Styling
```css
.category-dept {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 4px;
}
```

#### Added `.category-hours` Styling
```css
.category-hours {
  color: var(--primary-color);
  font-weight: 700;
  font-size: 11px;
  padding: 2px 6px;
  background: rgba(27, 42, 56, 0.1);
  border-radius: 4px;
  text-transform: none;
}
```

## API Field Name Issue

### Model Definition
```typescript
export interface TaskCategoryDto {
  categoryId: number;
  categoryName: string;
  departmentId: number;
  eSTIMATEDHOURS: number;  // Note the unusual casing!
  departmentName: string;
}
```

### API Response Example
```json
{
  "success": true,
  "data": {
    "allDepartmentList": [
      {
        "categoryId": 1,
        "categoryName": "API Development",
        "departmentId": 5,
        "departmentName": "ENGINEERING",
        "eSTIMATEDHOURS": 10
      }
    ]
  }
}
```

## Data Flow

### Loading Categories
1. API returns `eSTIMATEDHOURS: 10`
2. Component maps: `sequenceNumber: cat.eSTIMATEDHOURS || cat.estimatedHours || 0`
3. Result: `sequenceNumber: 10`
4. Console logs the mapped category for verification

### Viewing Categories
1. List displays: "ENGINEERING • 10h"
2. Badge only shows if `sequenceNumber > 0`

### Editing Categories
1. User clicks "Edit"
2. Console logs the category data including `sequenceNumber`
3. Edit form displays with `sequenceNumber` value in the input field
4. User can see and modify the value

### Saving Categories
1. Component sends: `estimatedHours: category.sequenceNumber`
2. API saves the value
3. On reload, value is fetched as `eSTIMATEDHOURS`

## Features

✅ Correctly maps `eSTIMATEDHOURS` from API to `sequenceNumber` in UI
✅ Displays estimated hours in category list view as a badge
✅ Shows estimated hours in edit form input field
✅ Handles both field name variations (`eSTIMATEDHOURS` and `estimatedHours`)
✅ Defaults to 0 if field is missing
✅ Only displays badge when value is greater than 0
✅ Debug logging to track data flow
✅ Styled badge with primary color and background

## Testing

### Test Display in List View
1. Open Manage Task Categories modal
2. Look at categories with estimated hours
3. Verify badge shows next to department name (e.g., "ENGINEERING • 10h")
4. Verify badge only shows for categories with hours > 0

### Test Edit Form Display
1. Click "Edit" on a category with estimated hours
2. Check browser console for debug log
3. Verify the "Estimated Hours" input field shows the correct value
4. Modify the value and save
5. Verify updated value displays correctly

### Test Console Logs
1. Open browser console
2. Load the Manage Task Categories modal
3. Look for: "Sample category with sequenceNumber:"
4. Click "Edit" on a category
5. Look for: "Editing category:" with all field values

## Notes

- The API uses an unusual field name: `eSTIMATEDHOURS` (lowercase 'e', rest uppercase)
- The component handles both `eSTIMATEDHOURS` and `estimatedHours` for flexibility
- The hours badge only appears when the value is greater than 0
- Debug logs help verify data is being loaded and mapped correctly
- The edit form binding `[(ngModel)]="category.sequenceNumber"` works correctly once the mapping is fixed
