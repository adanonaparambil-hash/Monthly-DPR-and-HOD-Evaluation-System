# Task Category Form Updates - Department Dropdown & Sequence Number

## Summary
Updated the Add New Category and Edit Category forms in the Manage Task Categories modal to:
1. Replace the Department text input with a dropdown bound to the API
2. Add a new Sequence Number field (numeric input)
3. Update form layout to support 3 columns

## Changes Made

### 1. TypeScript Component (`src/app/my-task/my-task.component.ts`)

#### Updated Interface
```typescript
interface TaskCategory {
  categoryId: number;
  categoryName: string;
  departmentId: number;
  departmentName?: string;
  sequenceNumber?: number;  // NEW FIELD
  isEditing?: boolean;
}
```

#### Updated Initialization
```typescript
newTaskCategory: TaskCategory = { 
  categoryId: 0, 
  categoryName: '', 
  departmentId: 0, 
  departmentName: '', 
  sequenceNumber: 0  // NEW FIELD
};
```

#### Added Method: `onDepartmentChange()`
```typescript
onDepartmentChange(departmentId: number, category: TaskCategory): void {
  const selectedDept = this.departmentMasterList.find(dept => dept.departmentId === departmentId);
  if (selectedDept) {
    category.departmentId = departmentId;
    category.departmentName = selectedDept.deptName;
    console.log('Department changed:', selectedDept.deptName);
  }
}
```

#### Updated `saveNewCategory()` Method
- Now includes `sequenceNumber` in the new category object
- Resets `sequenceNumber` to 0 after save

#### Updated `cancelAddCategory()` Method
- Resets `sequenceNumber` to 0 when canceling

### 2. HTML Template (`src/app/my-task/my-task.component.html`)

#### Add New Category Form
```html
<div class="form-row">
  <!-- Department Dropdown -->
  <div class="form-group">
    <label class="form-label">Department <span class="required">*</span></label>
    <div class="select-wrapper">
      <select 
        class="form-select" 
        [(ngModel)]="newTaskCategory.departmentId"
        (ngModelChange)="onDepartmentChange($event, newTaskCategory)"
      >
        <option value="0" disabled>Select Department</option>
        @for (dept of departmentMasterList; track dept.departmentId) {
          <option [value]="dept.departmentId">{{ dept.deptName }}</option>
        }
      </select>
      <i class="fas fa-chevron-down select-icon"></i>
    </div>
  </div>

  <!-- Task Category Name -->
  <div class="form-group">
    <label class="form-label">Task Category Name <span class="required">*</span></label>
    <input 
      type="text" 
      class="form-input" 
      [(ngModel)]="newTaskCategory.categoryName"
      placeholder="e.g., API Development, UI Design"
    />
  </div>

  <!-- Sequence Number (NEW) -->
  <div class="form-group">
    <label class="form-label">Sequence Number</label>
    <input 
      type="number" 
      class="form-input" 
      [(ngModel)]="newTaskCategory.sequenceNumber"
      placeholder="e.g., 1, 2, 3..."
      min="0"
    />
  </div>
</div>
```

#### Edit Category Form
Similar structure with:
- Department dropdown using `edit-select` class
- Sequence number input field
- Same 3-column layout

#### Updated Validation
```html
[disabled]="!newTaskCategory.categoryName.trim() || newTaskCategory.departmentId === 0"
```

### 3. CSS Styles (`src/app/my-task/my-task.component.css`)

#### Updated Form Row Layout
```css
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;  /* 3 columns */
  gap: 16px;
}

@media (max-width: 1024px) {
  .form-row {
    grid-template-columns: 1fr 1fr;  /* 2 columns on tablets */
  }
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;  /* 1 column on mobile */
  }
}
```

#### Added Select Wrapper Styles
```css
.select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.form-select,
.edit-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  width: 100%;
  padding: 10px 36px 10px 14px;
  background: var(--background-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.3s ease;
}

.select-wrapper .select-icon {
  position: absolute;
  right: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  pointer-events: none;
}
```

#### Added Required Field Indicator
```css
.form-label .required,
.edit-label .required {
  color: #ef4444;
  margin-left: 2px;
}
```

#### Added Number Input Styles
```css
.form-input[type="number"],
.edit-input[type="number"] {
  -moz-appearance: textfield;
}

.form-input[type="number"]::-webkit-outer-spin-button,
.form-input[type="number"]::-webkit-inner-spin-button,
.edit-input[type="number"]::-webkit-outer-spin-button,
.edit-input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
```

#### Updated Edit Form Row
```css
.edit-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;  /* 3 columns */
  gap: 12px;
}
```

## Form Fields

### Add New Category Form
1. **Department** (Dropdown - Required)
   - Bound to: `newTaskCategory.departmentId`
   - Options from: `departmentMasterList`
   - Display: `deptName`
   - Value: `departmentId`

2. **Task Category Name** (Text Input - Required)
   - Bound to: `newTaskCategory.categoryName`
   - Placeholder: "e.g., API Development, UI Design"

3. **Sequence Number** (Number Input - Optional)
   - Bound to: `newTaskCategory.sequenceNumber`
   - Placeholder: "e.g., 1, 2, 3..."
   - Min value: 0

### Edit Category Form
Same fields as Add form with edit-specific styling

## Data Flow

1. **Department Selection**:
   - User selects department from dropdown
   - `onDepartmentChange()` is triggered
   - Method finds department in `departmentMasterList`
   - Updates both `departmentId` and `departmentName` in category object

2. **Save Operation**:
   - Validates category name and department ID
   - Creates new category with all fields including `sequenceNumber`
   - Adds to `allDepartmentList`
   - Resets form

## Features

✅ Department dropdown populated from API
✅ Sequence number field for ordering categories
✅ 3-column responsive layout
✅ Required field indicators (red asterisk)
✅ Proper validation (department and name required)
✅ Clean number input (no spinner arrows)
✅ Consistent styling between Add and Edit forms
✅ Mobile responsive (1 column on mobile, 2 on tablet, 3 on desktop)

## Testing

1. Open Manage Task Categories modal
2. Click "Add New Category"
3. Verify department dropdown shows departments from API
4. Select a department
5. Enter category name
6. Enter sequence number (optional)
7. Click Save
8. Edit an existing category
9. Verify all fields work correctly in edit mode

## Notes

- Department dropdown uses `departmentId` as value (not department name)
- Sequence number is optional and defaults to 0
- Form layout is responsive and adapts to screen size
- Both Add and Edit forms have consistent behavior
