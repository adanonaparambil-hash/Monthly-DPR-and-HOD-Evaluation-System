# Assignee Mandatory Validation

## Summary
Added validation to make the "Assigned To" field mandatory when saving a task. Users must select an assignee before they can save the task.

## Changes Made

### 1. TypeScript Validation
**File**: `src/app/components/task-details-modal/task-details-modal.component.ts`

Added validation check in `saveTaskChanges()` method:
```typescript
// Validate Assignee is selected (mandatory)
if (!this.selectedAssigneeId || this.selectedAssigneeId.trim() === '') {
  this.toasterService.showError(
    'Validation Error', 
    'Assigned To is mandatory. Please select an assignee.'
  );
  return;
}
```

**Validation Order:**
1. Check if Assignee is selected (NEW)
2. Check Daily Remarks for Closed/Completed status
3. Check mandatory custom fields

### 2. Visual Indicator
**File**: `src/app/components/task-details-modal/task-details-modal.component.html`

Added red asterisk (*) to the "Assigned To" label:
```html
<p class="metadata-label">
  <i class="fas fa-user label-icon"></i>
  Assigned To
  <span class="required-indicator">*</span>
</p>
```

## User Experience

### Before Save:
- Red asterisk (*) appears next to "Assigned To" label
- Indicates the field is mandatory

### When Saving Without Assignee:
- Error toaster appears: "Assigned To is mandatory. Please select an assignee."
- Save operation is blocked
- User must select an assignee to proceed

### When Saving With Assignee:
- Validation passes
- Task saves successfully
- All other validations proceed normally

## Validation Flow

```
User clicks Save
    ↓
Check if Assignee selected?
    ↓ NO
    Show error: "Assigned To is mandatory"
    Stop save
    ↓ YES
Check Daily Remarks (if Closed/Completed)?
    ↓
Check Mandatory Custom Fields?
    ↓
Proceed with save
```

## Error Messages

**Assignee Missing:**
- Title: "Validation Error"
- Message: "Assigned To is mandatory. Please select an assignee."

**Daily Remarks Missing (Closed/Completed):**
- Title: "Validation Error"
- Message: "Daily Remarks is mandatory when closing or completing a task"

**Custom Fields Missing:**
- Title: "Validation Error"
- Message: "Please fill in the following mandatory fields: [field names]"

## Technical Details

### Validation Logic:
- Checks if `selectedAssigneeId` is null, undefined, or empty string
- Uses `.trim()` to catch whitespace-only values
- Runs before all other validations (first check)

### Visual Styling:
- Uses existing `.required-indicator` class
- Red color (#ef4444)
- Bold font weight
- 4px left margin
- 14px font size

## Testing Checklist
- [x] Assignee field shows red asterisk (*)
- [x] Save without assignee shows error
- [x] Error message is clear and helpful
- [x] Save with assignee proceeds normally
- [x] Validation runs before other checks
- [x] Error toaster displays correctly
- [x] User can select assignee and retry save
- [x] Works for both new and existing tasks

## Notes
- Assignee validation is the FIRST check in the save flow
- This ensures users are immediately notified if assignee is missing
- The red asterisk provides visual feedback before attempting to save
- Validation is consistent with other mandatory fields (Daily Remarks, Custom Fields)
- Empty string and whitespace-only values are both rejected
