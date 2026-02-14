# Estimated Hours Save Function Fix

## Issue
The Estimated Hours value was not being properly captured and sent in the save function when saving task changes.

## Root Cause
The `selectedTaskEstimatedHours` variable might have been treated as a string from the input field, or there was no explicit type conversion when building the save request.

## Solution Implemented

### 1. Added Explicit Type Declaration
Changed the variable declaration to explicitly type it as a number:
```typescript
selectedTaskEstimatedHours: number = 40;
```

### 2. Added Type Conversion in Save Method
Added explicit conversion to ensure the value is always a valid number:
```typescript
// Convert estimated hours to number
const estimatedHoursValue = parseFloat(this.selectedTaskEstimatedHours?.toString() || '0') || 0;

console.log('Estimated Hours Debug:', {
  raw: this.selectedTaskEstimatedHours,
  type: typeof this.selectedTaskEstimatedHours,
  converted: estimatedHoursValue
});
```

### 3. Updated Save Request
Used the converted value in the save request:
```typescript
const saveRequest: TaskSaveDto = {
  // ... other fields
  estimatedHours: estimatedHoursValue,
  // ... other fields
};
```

## How It Works

1. When the modal opens, `selectedTaskEstimatedHours` is populated from the API response:
   ```typescript
   this.selectedTaskEstimatedHours = taskDetails.estimtedHours || taskDetails.estimatedHours || 0;
   ```

2. The input field is bound with two-way binding:
   ```html
   <input 
     type="number" 
     class="metadata-input" 
     [(ngModel)]="selectedTaskEstimatedHours"
     placeholder="0.00"
     step="0.5"
     min="0"
   >
   ```

3. When saving, the value is explicitly converted to a number using `parseFloat()`:
   - Handles both number and string inputs
   - Converts to 0 if the value is null, undefined, or invalid
   - Ensures the API receives a valid numeric value

## Debug Output
Added console logging to help verify the value is being captured correctly:
```
Estimated Hours Debug: {
  raw: <actual value from input>,
  type: <typeof value>,
  converted: <final numeric value>
}
```

This will appear in the browser console when clicking the Save button.

## Testing Instructions
1. Open a task in the modal
2. Change the Estimated Hours value (e.g., enter 8.5)
3. Open browser console (F12)
4. Click the Save button
5. Check the console for "Estimated Hours Debug" log
6. Verify the value is being captured correctly
7. Check the "Saving task changes" log to see the full request payload

## Files Modified
- `src/app/my-task/my-task.component.ts`
  - Added explicit type declaration for `selectedTaskEstimatedHours`
  - Added type conversion logic in `saveTaskChanges()` method
  - Added debug logging for troubleshooting

## Notes
- The conversion handles edge cases like null, undefined, empty string, and invalid numbers
- The `parseFloat()` function properly handles decimal values (e.g., 8.5 hours)
- The fallback value is 0 if conversion fails
- The debug log can be removed once the issue is verified as fixed
