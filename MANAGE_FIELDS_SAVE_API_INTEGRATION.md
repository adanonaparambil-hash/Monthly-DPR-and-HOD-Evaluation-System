# Manage Fields Modal - Save Custom Field API Integration

## Overview
Updated the `saveCurrentField()` method in the "My Logged Hours" Manage Fields modal to properly call the `saveCustomField` API with the correct parameters for both creating new fields and editing existing fields.

## API Details

### API Endpoint
`POST /DailyTimeSheet/SaveOrUpdateCustomField`

### API Method
`saveCustomField(CustomFieldDtolist: any): Observable<any>`

## Implementation

### Parameters Sent to API

```typescript
{
  fieldId: number,        // 0 for new field, actual ID for edit
  fieldName: string,      // Field name from user input
  fieldType: string,      // 'TEXT', 'NUMBER', 'DATE', 'DROPDOWN' (uppercase)
  isMandatory: string,    // 'Y' or 'N'
  isActive: string,       // 'Y' or 'N'
  userId: string,         // Logged-in user's empId from session
  options: array          // Array of options (only for DROPDOWN type)
}
```

### Options Array Structure (for Dropdown fields)
```typescript
[
  {
    optionId: number,     // 0 for new option, actual ID for existing
    optionValue: string,  // Option text
    isActive: string,     // 'Y' or 'N'
    sortOrder: number     // Display order (1, 2, 3, ...)
  }
]
```

## Key Changes Made

### 1. Updated Parameter Names
- Changed `createdBy` → `userId`
- Ensured `fieldId` is `0` for new fields (not `undefined`)
- Ensured `optionId` is `0` for new options (not `undefined`)

### 2. Field Type Formatting
- Convert field type to uppercase: `TEXT`, `NUMBER`, `DATE`, `DROPDOWN`
- Ensures consistency with backend expectations

### 3. Single API Call
- Removed separate `updateCustomField` API call
- Now uses only `saveCustomField` for both create and update operations
- API handles create vs update based on `fieldId` (0 = create, >0 = update)

### 4. User Session Validation
- Added validation to ensure user session exists before saving
- Shows error if userId is not found

### 5. Options Handling
- Options array is only populated for DROPDOWN field type
- Empty array for TEXT, NUMBER, and DATE types
- Each option includes `optionId` (0 for new, actual ID for existing)

## Code Implementation

```typescript
saveCurrentField() {
  if (!this.isCurrentFieldValid()) {
    this.toasterService.showError('Validation Error', 'Please fill in all required fields');
    return;
  }

  // Get logged-in user from session
  const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
  const userId = currentUser.empId || currentUser.employeeId || '';

  if (!userId) {
    this.toasterService.showError('Error', 'User session not found');
    return;
  }

  // Prepare options array for dropdown (only if fieldType is DROPDOWN)
  let optionsData: any[] = [];
  if (this.currentField.fieldType === 'Dropdown') {
    optionsData = this.currentFieldOptions
      .filter(opt => opt.optionValue && opt.optionValue.trim())
      .map((opt, index) => ({
        optionId: this.editingField && opt.optionId ? opt.optionId : 0,
        optionValue: opt.optionValue.trim(),
        isActive: opt.isActive ? 'Y' : 'N',
        sortOrder: opt.sortOrder || (index + 1)
      }));
  }

  // Prepare field data according to API requirements
  const fieldData = {
    fieldId: this.editingField && this.currentField.fieldId ? this.currentField.fieldId : 0,
    fieldName: this.currentField.fieldName.trim(),
    fieldType: this.currentField.fieldType.toUpperCase(), // TEXT, NUMBER, DATE, DROPDOWN
    isMandatory: this.currentField.isMandatory ? 'Y' : 'N',
    isActive: this.currentField.isActive ? 'Y' : 'N',
    userId: userId, // Logged-in user's empId
    options: optionsData // Only for dropdown, empty array for others
  };

  console.log(this.editingField ? 'Updating field:' : 'Creating field:', fieldData);

  // Call the saveCustomField API (handles both create and update)
  this.api.saveCustomField(fieldData).subscribe({
    next: (response: any) => {
      console.log('Field saved:', response);
      
      if (response && response.success) {
        this.toasterService.showSuccess('Success', 
          this.editingField ? 'Field updated successfully' : 'Field created successfully');
        this.closeAddFieldModal();
        this.loadCustomFields();
      } else {
        this.toasterService.showError('Error', response?.message || 'Failed to save field');
      }
    },
    error: (error: any) => {
      console.error('Error saving field:', error);
      this.toasterService.showError('Error', 'Failed to save field. Please try again.');
    }
  });
}
```

## Workflow

### Creating a New Field
1. User clicks "Add New Field" button
2. Modal opens with empty form
3. User fills in:
   - Field Name (required)
   - Field Type: TEXT, NUMBER, DATE, or DROPDOWN (required)
   - Active toggle (default: true)
   - Mandatory toggle (default: false)
   - Options (only if DROPDOWN type selected)
4. User clicks "Save Changes"
5. Validation checks if all required fields are filled
6. API called with `fieldId: 0` (indicates new field)
7. Success message shown and modal closed
8. Custom fields list refreshed

### Editing an Existing Field
1. User clicks edit icon on a field row
2. Modal opens with field data pre-filled
3. Field Type is disabled (cannot be changed)
4. User can modify:
   - Field Name
   - Active toggle
   - Mandatory toggle
   - Options (if DROPDOWN type)
5. User clicks "Save Changes"
6. API called with actual `fieldId` (indicates update)
7. Success message shown and modal closed
8. Custom fields list refreshed

## Validation

The `isCurrentFieldValid()` method ensures:
- Field Name is not empty
- Field Type is selected
- For DROPDOWN type: At least one valid option exists

## Error Handling

- Shows validation error if required fields are missing
- Shows error if user session is not found
- Shows error if API call fails
- All errors displayed using toaster notifications

## Files Modified

- `src/app/my-logged-hours/my-logged-hours.ts`

## Testing

Test by:
1. Open "My Logged Hours" page
2. Click "Manage Fields" button
3. Click "Add New Field"
4. Fill in field details:
   - Name: "Priority"
   - Type: DROPDOWN
   - Add options: "High", "Medium", "Low"
   - Toggle Active: ON
   - Toggle Mandatory: ON
5. Click "Save Changes"
6. Verify success message appears
7. Verify new field appears in the list
8. Click edit icon on the new field
9. Modify the field name to "Task Priority"
10. Click "Save Changes"
11. Verify update success message
12. Verify field name updated in the list

## Status
✅ Complete - No TypeScript errors
