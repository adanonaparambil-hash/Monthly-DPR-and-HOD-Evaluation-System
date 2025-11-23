# MPR Validation Improvements

## Overview
Added comprehensive validation for both "Save Draft" and "Submit" buttons in the Monthly Performance Report (MPR) form to ensure data quality and completeness.

## Changes Made

### 1. Save Draft Validation (`saveDraft()` method)

**New Validations Added:**

1. **Reporting To Field** - Required
   - Checks if the "Reporting To" field is filled
   - Shows warning: "Please specify the Reporting To field before saving."

2. **At Least One Task** - Required
   - Checks if at least one task exists with a valid task name
   - Shows warning: "Please add at least one task before saving."

**Code Changes:**
```typescript
saveDraft() {
  // Validation for Save Draft
  if (!this.reportingTo) {
    this.toastr.warning('Please specify the Reporting To field before saving.', 'Validation Failed');
    return;
  }

  // Check if at least one task exists with valid data
  const validTasks = this.tasks.filter(
    (task) => task.taskName && task.taskName.trim() !== ''
  );

  if (validTasks.length === 0) {
    this.toastr.warning('Please add at least one task before saving.', 'Validation Failed');
    return;
  }

  this.ApprovalStatus = 'D';
  this.saveEmployeeDetails();
}
```

### 2. Submit Validation (`saveEmployeeDetails()` method)

**Enhanced Validations (when ApprovalStatus == "S"):**

1. **Reporting To Field** - Required
   - Message: "Please specify the Reporting To field before submitting."

2. **At Least One Task Exists** - Required
   - Checks if tasks array has at least one entry
   - Message: "Please add at least one task before submitting."

3. **All Tasks Complete** - Required
   - Each task must have:
     - Task name (not empty)
     - Description (not empty)
     - Actual hours (greater than 0)
   - Message: "Please complete all task details. Each task must have a name, description, and actual hours."

4. **Total Hours Validation** - Required
   - Sum of actual hours cannot exceed worked hours
   - Message: "The sum of actual hours exceeds the Worked Hours. Please adjust your task hours."

5. **At Least One KPI** - Required
   - At least one KPI must be:
     - Selected (kpiMasterId > 0)
     - Has a valid value (not empty, not zero)
   - Message: "Please complete at least one KPI with selection and value."

**Validation Order:**
```
1. Reporting To field
2. At least one task exists
3. All tasks are complete
4. Total hours don't exceed worked hours
5. At least one KPI is filled
```

## Validation Logic

### Save Draft Requirements (Minimum)
- ✅ Reporting To field must be filled
- ✅ At least one task with a task name

### Submit Requirements (Complete)
- ✅ Reporting To field must be filled
- ✅ At least one task exists
- ✅ All tasks must be complete (name, description, actual hours > 0)
- ✅ Total actual hours ≤ worked hours
- ✅ At least one KPI must be selected and filled

## User Experience Improvements

### Before Changes
- ❌ Could save draft without any data
- ❌ Could save draft without Reporting To
- ❌ No clear validation messages
- ❌ Could submit with incomplete tasks

### After Changes
- ✅ Clear validation messages for each requirement
- ✅ Prevents saving without minimum required data
- ✅ Ensures data quality before submission
- ✅ User-friendly warning messages using Toastr
- ✅ Validation happens before confirmation dialog

## Validation Messages

All validation messages use the Toastr warning notification with:
- **Title**: "Validation Failed"
- **Message**: Clear description of what's missing
- **Type**: Warning (yellow notification)

## Technical Details

### Files Modified
- `src/app/monthly-dpr.component/monthly-dpr.component.ts`

### Methods Updated
1. `saveDraft()` - Added validation before saving draft
2. `saveEmployeeDetails()` - Enhanced validation for submit with better ordering

### Validation Approach
- **Early Return Pattern**: Validation checks return immediately if failed
- **Clear Messages**: Each validation has a specific, actionable message
- **Progressive Validation**: Checks are ordered from basic to complex
- **Non-blocking**: Uses Toastr warnings instead of blocking alerts

## Testing Recommendations

### Test Cases for Save Draft
1. ✅ Try to save without Reporting To → Should show warning
2. ✅ Try to save without any tasks → Should show warning
3. ✅ Save with Reporting To and one task → Should succeed

### Test Cases for Submit
1. ✅ Try to submit without Reporting To → Should show warning
2. ✅ Try to submit with empty tasks array → Should show warning
3. ✅ Try to submit with incomplete task (missing name) → Should show warning
4. ✅ Try to submit with incomplete task (missing description) → Should show warning
5. ✅ Try to submit with incomplete task (actual hours = 0) → Should show warning
6. ✅ Try to submit with total hours > worked hours → Should show warning
7. ✅ Try to submit without any KPI filled → Should show warning
8. ✅ Submit with all validations passed → Should show confirmation dialog

## Benefits

1. **Data Quality**: Ensures minimum required data is present
2. **User Guidance**: Clear messages guide users on what's missing
3. **Consistency**: Same validation approach for both save and submit
4. **Error Prevention**: Catches issues before API calls
5. **Better UX**: Users know exactly what's required before proceeding

## Notes

- Validation is client-side only (server-side validation should also exist)
- Draft saves have relaxed validation (only basic requirements)
- Submit has strict validation (all fields must be complete)
- Validation messages are user-friendly and actionable
- No changes to HTML template required
- No changes to CSS required
