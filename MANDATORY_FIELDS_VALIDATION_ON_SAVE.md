# Mandatory Custom Fields Validation on Task Save

## Overview
Added validation to ensure that all mandatory custom fields (where `isMandatory === 'Y'`) are filled before allowing the user to save a task when the status is set to "Closed" or "Completed".

## Business Rule
When a task status is changed to "Closed" or "Completed", all custom fields marked as mandatory must have values entered before the task can be saved.

## Implementation

### 1. Updated CustomField Interface
Added `isMandatory` property to track which fields are required:

```typescript
interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'textarea' | 'date';
  description: string;
  options?: string[];
  value?: any;
  fieldId?: number;
  isMapped?: 'Y' | 'N';
  isMandatory?: 'Y' | 'N';  // Added this field
}
```

### 2. Updated Custom Fields Loading
Modified both `loadCustomFields()` and task details loading to capture `isMandatory` from API:

```typescript
// In loadCustomFields() - from getCustomFields API
this.availableCustomFields = response.data.map((field: any) => ({
  // ... other fields
  isMandatory: field.isMandatory || 'N'
}));

// In task details loading - from getTaskById API
this.selectedCustomFields = taskDetails.customFields.map((field: any) => ({
  // ... other fields
  isMandatory: field.isMandatory || 'N'
}));
```

### 3. Created Validation Function
Added `validateMandatoryFields()` method to check mandatory fields with detailed console logging:

```typescript
validateMandatoryFields(): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];
  
  console.log('=== Validating Mandatory Fields ===');
  console.log('Current status:', this.selectedTaskDetailStatus);
  console.log('Selected custom fields:', this.selectedCustomFields);
  
  // Check if status is Closed or Completed
  const statusRequiringValidation = ['not-closed', 'completed'];
  if (!statusRequiringValidation.includes(this.selectedTaskDetailStatus)) {
    console.log('Status does not require validation. Skipping...');
    return { isValid: true, missingFields: [] };
  }
  
  console.log('Status requires validation. Checking mandatory fields...');
  
  // Check each custom field
  this.selectedCustomFields.forEach(field => {
    console.log(`Checking field: ${field.label}, isMandatory: ${field.isMandatory}, value: ${field.value}`);
    
    if (field.isMandatory === 'Y') {
      const value = field.value;
      const isEmpty = value === null || value === undefined || value === '' || 
                     (typeof value === 'string' && value.trim() === '');
      
      if (isEmpty) {
        console.log(`Field "${field.label}" is mandatory but empty!`);
        missingFields.push(field.label);
      } else {
        console.log(`Field "${field.label}" is mandatory and has value: ${value}`);
      }
    }
  });
  
  console.log('Missing fields:', missingFields);
  console.log('Validation result:', missingFields.length === 0 ? 'VALID' : 'INVALID');
  
  return {
    isValid: missingFields.length === 0,
    missingFields: missingFields
  };
}
```

### 4. Updated saveTaskChanges() Method
Added validation call before saving:

```typescript
saveTaskChanges() {
  console.log('=== saveTaskChanges START ===');
  
  // Validate mandatory fields if status is Closed or Completed
  const validation = this.validateMandatoryFields();
  if (!validation.isValid) {
    const fieldsList = validation.missingFields.join(', ');
    this.toasterService.showError(
      'Validation Error', 
      `Please fill in the following mandatory fields: ${fieldsList}`
    );
    return;
  }
  
  // Continue with save...
}
```

## Data Flow

### API Responses Providing isMandatory

1. **getCustomFields API**
   - Returns all available custom fields
   - Each field includes `isMandatory: 'Y' | 'N'`
   - Loaded into `availableCustomFields`

2. **getTaskById API**
   - Returns task details with custom fields
   - Each custom field includes `isMandatory: 'Y' | 'N'`
   - Loaded into `selectedCustomFields`

### Field Addition Flow
When user adds a field via "Add Fields" modal:
```typescript
this.selectedCustomFields.push({ ...field, value: '', isMapped: 'Y' });
```
The spread operator `...field` copies all properties including `isMandatory`.

## Validation Logic

### When Validation Runs
- Only when task status is "Closed" (`not-closed` in component) or "Completed" (`completed` in component)
- For other statuses (Not Started, Running, Paused), validation is skipped

### What is Validated
- All custom fields where `isMandatory === 'Y'`
- Checks if field value is:
  - `null`
  - `undefined`
  - Empty string `''`
  - String with only whitespace

### Validation Result
- **Valid**: All mandatory fields have values → Save proceeds
- **Invalid**: One or more mandatory fields are empty → Shows error message with list of missing fields

## Console Logging for Debugging

The validation function includes detailed console logs to help debug:

```
=== Validating Mandatory Fields ===
Current status: completed
Selected custom fields: [...]
Status requires validation. Checking mandatory fields...
Checking field: Priority, isMandatory: Y, value: 
Field "Priority" is mandatory but empty!
Checking field: Description, isMandatory: N, value: Some text
Missing fields: ["Priority"]
Validation result: INVALID
```

## User Experience

### Scenario 1: Status is Not Closed/Completed
```
User changes status to "Running"
User clicks "Save"
→ Console: "Status does not require validation. Skipping..."
→ No validation, saves immediately
```

### Scenario 2: Status is Closed/Completed, All Fields Filled
```
User changes status to "Completed"
User has filled all mandatory fields
User clicks "Save"
→ Console: "Status requires validation. Checking mandatory fields..."
→ Console: All mandatory fields have values
→ Console: "Validation result: VALID"
→ Validation passes, saves successfully
```

### Scenario 3: Status is Closed/Completed, Missing Mandatory Fields
```
User changes status to "Closed"
User has NOT filled mandatory field "Priority"
User clicks "Save"
→ Console: "Field 'Priority' is mandatory but empty!"
→ Console: "Validation result: INVALID"
→ Validation fails
→ Error message: "Please fill in the following mandatory fields: Priority"
→ Save is blocked
```

### Scenario 4: Multiple Missing Fields
```
User changes status to "Completed"
User has NOT filled "Priority" and "Estimated Cost"
User clicks "Save"
→ Error message: "Please fill in the following mandatory fields: Priority, Estimated Cost"
→ Save is blocked
```

## Error Messages

### Single Missing Field
```
Validation Error
Please fill in the following mandatory fields: Priority
```

### Multiple Missing Fields
```
Validation Error
Please fill in the following mandatory fields: Priority, Estimated Cost, Risk Level
```

## Status Mapping

Component status values that trigger validation:
- `not-closed` → Maps to API status "CLOSED"
- `completed` → Maps to API status "COMPLETED"

Other statuses that DON'T trigger validation:
- `not-started` → "NOT STARTED"
- `running` → "RUNNING"
- `pause` / `paused` → "PAUSED"

## Benefits

- **Data Quality**: Ensures important information is captured before task completion
- **User Guidance**: Clear error messages tell users exactly which fields need to be filled
- **Flexible**: Only enforces validation when task is being closed/completed
- **Prevents Incomplete Data**: Stops users from marking tasks as complete without required information
- **Debuggable**: Console logs help identify validation issues

## Files Modified

- `src/app/components/task-details-modal/task-details-modal.component.ts`

## Testing Steps

1. **Setup**:
   - Create a custom field with `isMandatory = 'Y'` (e.g., "Priority")
   - Open task details modal

2. **Test Case 1: Validation Skipped for Other Statuses**:
   - Set status to "Running"
   - Leave mandatory field empty
   - Click "Save"
   - Expected: Saves without validation
   - Check console: Should see "Status does not require validation. Skipping..."

3. **Test Case 2: Validation Fails for Closed Status**:
   - Set status to "Closed"
   - Leave mandatory field "Priority" empty
   - Click "Save"
   - Expected: Error message appears
   - Check console: Should see validation logs and "Field 'Priority' is mandatory but empty!"

4. **Test Case 3: Validation Passes**:
   - Set status to "Completed"
   - Fill in mandatory field "Priority" with value "High"
   - Click "Save"
   - Expected: Saves successfully
   - Check console: Should see "Field 'Priority' is mandatory and has value: High"

5. **Test Case 4: Multiple Missing Fields**:
   - Add another mandatory field "Risk Level"
   - Set status to "Closed"
   - Leave both fields empty
   - Click "Save"
   - Expected: Error lists both fields

## Troubleshooting

If validation is not working:

1. **Check Console Logs**: Look for validation logs to see what's happening
2. **Verify isMandatory**: Check if `isMandatory === 'Y'` in console logs
3. **Check Status**: Verify status is 'not-closed' or 'completed'
4. **Check API Response**: Ensure `getCustomFields` and `getTaskById` return `isMandatory` field
5. **Check Field Values**: Verify field values are being captured correctly

## Status
✅ Complete - No TypeScript errors
✅ Console logging added for debugging

