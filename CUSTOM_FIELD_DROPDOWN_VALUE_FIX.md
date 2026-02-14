# Custom Field Dropdown Value Fix

## Issue
When saving custom field dropdown values, the system was saving the display text (e.g., "Civil", "Electrical") instead of the option's value/index. The backend expects the value (index) to be saved, not the display text.

## Root Cause
The dropdown options were using the same value for both the `value` attribute and display text:
```html
<option [value]="option">{{ option }}</option>
```

This meant when a user selected "Civil", the value saved was the string "Civil" instead of its index (e.g., 0).

## Solution
Modified the dropdown to use the option's index as the value while displaying the option text:
```html
<option [value]="i">{{ option }}</option>
```

Now when a user selects "Civil" (index 0), the value saved is "0", not "Civil".

## Changes Made

### 1. Updated Task Details Modal Dropdown
**File:** `src/app/my-task/my-task.component.html`

Changed from:
```html
<select class="metadata-select" [(ngModel)]="field.value">
  <option value="">Select {{ field.label }}</option>
  @for (option of field.options; track option) {
    <option [value]="option">{{ option }}</option>
  }
</select>
```

To:
```html
<select class="metadata-select" [(ngModel)]="field.value">
  <option value="">Select {{ field.label }}</option>
  @for (option of field.options; track option; let i = $index) {
    <option [value]="i">{{ option }}</option>
  }
</select>
```

### 2. Updated Compact View Dropdown
**File:** `src/app/my-task/my-task.component.html`

Changed from:
```html
<select *ngIf="field.type === 'dropdown'" [(ngModel)]="field.value">
  <option value="">Select {{ field.label }}</option>
  <option *ngFor="let option of field.options" [value]="option">{{ option }}</option>
</select>
```

To:
```html
<select *ngIf="field.type === 'dropdown'" [(ngModel)]="field.value">
  <option value="">Select {{ field.label }}</option>
  <option *ngFor="let option of field.options; let i = index" [value]="i">{{ option }}</option>
</select>
```

### 3. Updated Custom Fields Mapping in Save
**File:** `src/app/my-task/my-task.component.ts`

Enhanced the custom fields mapping to handle dropdown values properly:
```typescript
customFields: this.selectedCustomFields.map(field => {
  let fieldValue = field.value?.toString() || '';
  
  // For dropdown fields, ensure we're sending the selected value
  if (field.type === 'dropdown' && field.value) {
    // The value is already the selected option index from the dropdown
    fieldValue = field.value.toString();
  }
  
  return {
    fieldId: field.fieldId || 0,
    value: fieldValue
  };
})
```

## How It Works

### Saving
1. User selects "Civil" from dropdown (which is at index 0)
2. `field.value` is set to `0` (the index)
3. When saving, the value `"0"` is sent to the backend
4. Backend receives: `{ fieldId: 1, value: "0" }`

### Loading (Future Enhancement)
When loading existing values from the backend:
1. Backend returns: `{ fieldId: 1, value: "0" }`
2. Frontend sets `field.value = "0"`
3. Dropdown shows "Civil" (the option at index 0)

## Example

Given this API response:
```json
{
  "fieldId": 1,
  "fieldName": "Section",
  "fieldType": "Dropdown",
  "options": ["Civil", "Electrical", "Mechanical", "Architectural"]
}
```

### Before Fix
- User selects "Electrical"
- Saved value: `"Electrical"` ❌
- Backend receives the text instead of index

### After Fix
- User selects "Electrical" (index 1)
- Saved value: `"1"` ✅
- Backend receives the index as expected

## Benefits

1. **Correct Data Format**: Backend receives index values instead of display text
2. **Consistent with Backend**: Matches backend's expected data format
3. **Localization Ready**: Display text can be translated without affecting saved values
4. **Data Integrity**: Index values are more reliable than text matching

## Testing Recommendations

1. Test selecting different dropdown options and verify correct index is saved
2. Test saving a task with multiple dropdown fields
3. Test loading a task with existing dropdown values (verify correct option is selected)
4. Test empty/unselected dropdown (should save empty string)
5. Verify backend receives and processes the index values correctly
6. Test with dropdowns that have many options
7. Verify the display text shows correctly while the value is the index

## Technical Notes

- Uses Angular's `$index` in `@for` loops and `index` in `*ngFor` loops
- The value is stored as a number (index) but converted to string when saving
- Empty selection (value="") is handled correctly
- Compatible with Angular's two-way binding `[(ngModel)]`
