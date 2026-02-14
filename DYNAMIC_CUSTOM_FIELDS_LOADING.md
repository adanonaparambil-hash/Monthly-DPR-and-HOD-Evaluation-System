# Dynamic Custom Fields Loading from API

## Summary
Implemented dynamic loading and binding of custom fields from the `GetTaskById` API response. When a task is opened, the system now automatically creates and populates custom field inputs based on the `customFields` array returned by the API, including their saved values.

## API Response Structure

The `GetTaskById` API returns custom fields in this format:
```json
{
  "success": true,
  "message": "Task fetched successfully",
  "data": {
    "taskId": 41,
    "taskTitle": "Testing finance task",
    "customFields": [
      {
        "fieldId": 2,
        "fieldName": "Instruction",
        "fieldType": "Text",
        "options": null,
        "isMapped": "Y",
        "savedValue": null
      },
      {
        "fieldId": 3,
        "fieldName": "Stage",
        "fieldType": "Dropdown",
        "options": "Design and Engineering,Procurement,Pre Construction",
        "isMapped": "Y",
        "savedValue": null
      },
      {
        "fieldId": 12,
        "fieldName": "Unit",
        "fieldType": "Dropdown",
        "options": "Percentage,Linear Meters,Square Meters",
        "isMapped": "Y",
        "savedValue": "2"
      }
    ]
  }
}
```

## Changes Made

### 1. Added Custom Fields Loading in `openTaskDetailsModal()`
**File:** `src/app/my-task/my-task.component.ts`

Added logic to process and bind custom fields from API response:

```typescript
// Load and bind custom fields from API response
if (taskDetails.customFields && Array.isArray(taskDetails.customFields)) {
  this.selectedCustomFields = taskDetails.customFields
    .filter((field: any) => field.isMapped === 'Y')
    .map((field: any) => {
      // Parse options string to array
      let optionsArray: string[] = [];
      if (field.options && typeof field.options === 'string') {
        optionsArray = field.options.split(',').map((opt: string) => opt.trim());
      } else if (Array.isArray(field.options)) {
        optionsArray = field.options;
      }
      
      return {
        key: field.fieldName?.toLowerCase().replace(/\s+/g, '_') || `field_${field.fieldId}`,
        label: field.fieldName || 'Custom Field',
        type: this.mapFieldType(field.fieldType),
        description: `${field.fieldName} field`,
        options: optionsArray,
        fieldId: field.fieldId,
        isMapped: field.isMapped,
        value: field.savedValue || ''
      };
    });
  
  console.log('Custom fields loaded from task:', this.selectedCustomFields.length, 'fields');
} else {
  this.selectedCustomFields = [];
}
```

### 2. Added Custom Fields Loading in `stopActiveTask()`
**File:** `src/app/my-task/my-task.component.ts`

Added the same custom fields loading logic when a task is stopped (which also opens the modal).

## How It Works

### Field Processing
1. **Filter**: Only fields with `isMapped === 'Y'` are loaded
2. **Options Parsing**: 
   - If `options` is a comma-separated string: Split into array
   - If `options` is already an array: Use as-is
   - If `options` is null: Empty array
3. **Value Binding**: Use `savedValue` from API or empty string
4. **Field Mapping**: Convert API field type to component field type

### Field Types Mapping
- `"Text"` → `'text'`
- `"Dropdown"` → `'dropdown'`
- `"Number"` → `'number'`
- `"Textarea"` → `'textarea'`
- `"Date"` → `'date'`

### Example Flow

**API Returns:**
```json
{
  "fieldId": 12,
  "fieldName": "Unit",
  "fieldType": "Dropdown",
  "options": "Percentage,Linear Meters,Square Meters",
  "isMapped": "Y",
  "savedValue": "2"
}
```

**Component Creates:**
```typescript
{
  key: "unit",
  label: "Unit",
  type: "dropdown",
  description: "Unit field",
  options: ["Percentage", "Linear Meters", "Square Meters"],
  fieldId: 12,
  isMapped: "Y",
  value: "2"  // Index of "Square Meters"
}
```

**UI Displays:**
- Dropdown with label "Unit"
- Options: Percentage, Linear Meters, Square Meters
- Pre-selected: "Square Meters" (index 2)

## Benefits

1. **Dynamic Fields**: Fields are created automatically based on API response
2. **Saved Values**: Previously saved values are loaded and displayed
3. **Flexible**: Supports all field types (text, dropdown, number, textarea, date)
4. **Options Parsing**: Handles both string and array formats for dropdown options
5. **Clean UI**: Only mapped fields (`isMapped: 'Y'`) are shown
6. **Consistent**: Same logic applies when opening task or stopping task

## Field Display

The custom fields are displayed in the task details modal under "Project Metadata" section:

- **Text fields**: Show input with saved value
- **Number fields**: Show number input with saved value
- **Dropdown fields**: Show dropdown with saved option selected (by index)
- **Textarea fields**: Show textarea with saved value
- **Date fields**: Show date picker with saved date

## Testing Recommendations

1. Test opening a task with no custom fields (should show no fields)
2. Test opening a task with text fields (should show text inputs with values)
3. Test opening a task with dropdown fields (should show dropdowns with correct option selected)
4. Test opening a task with null savedValue (should show empty field)
5. Test opening a task with savedValue="2" for dropdown (should select 3rd option)
6. Test options as comma-separated string (should parse correctly)
7. Test options as array (should use directly)
8. Test stopping a task (should also load custom fields)
9. Test saving modified custom field values
10. Verify console logs show correct number of fields loaded

## Technical Notes

- Custom fields are loaded in both `openTaskDetailsModal()` and `stopActiveTask()` methods
- Options string format: `"Option1,Option2,Option3"` (comma-separated)
- Dropdown values are stored as indices (0, 1, 2, etc.)
- Fields with `isMapped: 'N'` are filtered out
- Empty `selectedCustomFields` array if no custom fields in API response
- Uses existing `mapFieldType()` method for type conversion
- Integrates seamlessly with existing "Add Fields" functionality
