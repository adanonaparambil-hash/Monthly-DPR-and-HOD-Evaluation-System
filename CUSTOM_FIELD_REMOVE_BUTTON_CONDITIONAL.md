# Custom Field Remove Button Conditional Display

## Summary
Updated the custom fields display to conditionally show the remove button. Dynamically loaded fields (from API with `isMapped: "Y"`) cannot be removed, while manually added fields can be removed by the user.

## Issue
Previously, all custom fields showed a remove button (X icon) in the top-right corner, allowing users to delete any field including those that were dynamically loaded from the API based on the task's category mapping.

## Solution
Added a conditional check to only show the remove button for fields that are NOT mapped (i.e., `isMapped !== 'Y'`).

## Changes Made

### Updated Custom Field Card Template
**File:** `src/app/my-task/my-task.component.html`

Changed from:
```html
<div class="metadata-card custom-field-card">
  <div class="metadata-content">
    <!-- Field inputs -->
  </div>
  <button class="remove-field-btn" (click)="removeCustomField(field.key)" title="Remove field">
    <i class="fas fa-times"></i>
  </button>
</div>
```

To:
```html
<div class="metadata-card custom-field-card">
  <div class="metadata-content">
    <!-- Field inputs -->
  </div>
  <!-- Only show remove button for fields that are NOT mapped (manually added fields) -->
  @if (field.isMapped !== 'Y') {
  <button class="remove-field-btn" (click)="removeCustomField(field.key)" title="Remove field">
    <i class="fas fa-times"></i>
  </button>
  }
</div>
```

## Field Types

### Dynamically Loaded Fields (isMapped: "Y")
- **Source**: Loaded from `GetTaskById` API response
- **Characteristics**:
  - Have `isMapped: "Y"` property
  - Mapped to the task's category
  - Cannot be removed by user
  - No remove button displayed
  - Permanent for this task category

### Manually Added Fields (isMapped: "N" or undefined)
- **Source**: Added by user via "Add Fields" button
- **Characteristics**:
  - Have `isMapped: "N"` or no `isMapped` property
  - User-selected from available fields
  - Can be removed by user
  - Remove button (X icon) displayed
  - Temporary until saved

## Visual Behavior

### Before Fix
```
┌─────────────────────────────────┐
│ Instruction              [X]    │  ← Dynamically loaded (shouldn't have X)
│ [text input]                    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Custom Note              [X]    │  ← Manually added (should have X)
│ [text input]                    │
└─────────────────────────────────┘
```

### After Fix
```
┌─────────────────────────────────┐
│ Instruction                     │  ← Dynamically loaded (no X button)
│ [text input]                    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Custom Note              [X]    │  ← Manually added (has X button)
│ [text input]                    │
└─────────────────────────────────┘
```

## Logic Flow

1. **Task Opens**: API returns custom fields with `isMapped: "Y"`
2. **Fields Created**: Dynamically loaded fields are added to `selectedCustomFields`
3. **Display**: Template renders each field
4. **Remove Button Check**: 
   - If `field.isMapped === 'Y'` → No remove button
   - If `field.isMapped !== 'Y'` → Show remove button
5. **User Adds Field**: New field has `isMapped: "N"` or undefined
6. **Remove Button**: Manually added field shows remove button

## Benefits

1. **Data Integrity**: Prevents users from removing required category fields
2. **Clear UX**: Visual indication of which fields are permanent vs. removable
3. **Consistent Behavior**: Mapped fields stay consistent across all tasks in that category
4. **User Control**: Users can still add and remove their own custom fields
5. **API-Driven**: Field removability is controlled by backend mapping

## Testing Recommendations

1. Open a task with dynamically loaded fields (isMapped: "Y")
   - Verify NO remove button appears on these fields
2. Click "Add Fields" and add a new field
   - Verify remove button DOES appear on manually added field
3. Try to remove a dynamically loaded field
   - Should not be possible (no button to click)
4. Remove a manually added field
   - Should work normally
5. Save task and reload
   - Dynamically loaded fields should still have no remove button
6. Test with different task categories
   - Each category's mapped fields should be non-removable

## Technical Notes

- Uses Angular's `@if` directive for conditional rendering
- Checks `field.isMapped !== 'Y'` (not equal to 'Y')
- This means fields with `isMapped: 'N'`, `undefined`, or any other value will show the remove button
- Only fields explicitly marked as `isMapped: 'Y'` from the API are protected
- The `removeCustomField()` method still exists but is only accessible for removable fields
- No changes needed to TypeScript logic - purely template-based solution
