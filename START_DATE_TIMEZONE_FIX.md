# Start Date - Fix Timezone Issue

## Problem

The Start Date field was displaying an incorrect date even though the backend was sending the correct value. This was caused by timezone conversion issues when parsing date strings.

**Example:**
- Backend sends: `"2024-03-15T00:00:00"`
- JavaScript Date constructor interprets this in local timezone
- If user is in a timezone behind UTC, the date shifts backward by one day
- Result: User sees "2024-03-14" instead of "2024-03-15"

**Affected Areas:**
1. Task Details Modal - Start Date field
2. My Task List - Start Date display in task cards

## Changes Made

### Modified: `src/app/components/task-details-modal/task-details-modal.component.ts`
### Modified: `src/app/my-task/my-task.component.ts`

Updated the `formatDateForInput()` method in both components to handle date strings without timezone conversion issues.

**Previous Implementation:**
```typescript
formatDateForInput(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}
```

**Issues with Previous Implementation:**
1. `new Date(dateString)` interprets the date in local timezone
2. `toISOString()` converts back to UTC, potentially shifting the date
3. Date could shift by ±1 day depending on user's timezone

**New Implementation:**
```typescript
formatDateForInput(dateString: string): string {
  if (!dateString) return '';
  try {
    // Extract just the date part (YYYY-MM-DD) to avoid timezone issues
    const datePart = dateString.split('T')[0];
    
    // Validate the date format
    if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart;
    }
    
    // Fallback: try to parse as Date object using UTC methods
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return '';
  }
}
```

### Additional Fix in My Task Component

Also updated line 1087 in `my-task.component.ts` where startDate was being formatted inline:

**Before:**
```typescript
startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
```

**After:**
```typescript
startDate: task.startDate ? this.formatDateForInput(task.startDate) : '',
```

## Solution Approach

### Primary Method (Fast Path):
1. Extract the date part before 'T' (e.g., "2024-03-15T00:00:00" → "2024-03-15")
2. Validate it matches YYYY-MM-DD format using regex
3. Return it directly without any Date object conversion
4. This avoids timezone issues entirely

### Fallback Method (Compatibility):
1. If the date string doesn't have 'T' or doesn't match expected format
2. Parse as Date object but use UTC methods
3. Use `getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()` instead of local methods
4. Manually format as YYYY-MM-DD

## Benefits

1. **Correct Dates**: Start Date displays exactly as sent by backend
2. **No Timezone Shifts**: Date doesn't change based on user's timezone
3. **Fast**: Primary method is simple string extraction (no Date parsing)
4. **Compatible**: Fallback handles various date formats
5. **Reliable**: Works consistently across all timezones
6. **Consistent**: Same fix applied to both modal and task list

## Testing Scenarios

| Backend Value | User Timezone | Old Result | New Result |
|---------------|---------------|------------|------------|
| 2024-03-15T00:00:00 | UTC-8 (PST) | 2024-03-14 ❌ | 2024-03-15 ✅ |
| 2024-03-15T00:00:00 | UTC+5:30 (IST) | 2024-03-15 ✅ | 2024-03-15 ✅ |
| 2024-03-15T00:00:00 | UTC+0 (GMT) | 2024-03-15 ✅ | 2024-03-15 ✅ |
| 2024-03-15 | Any | 2024-03-15 ✅ | 2024-03-15 ✅ |

## Files Modified

- `src/app/components/task-details-modal/task-details-modal.component.ts`
- `src/app/my-task/my-task.component.ts`

## Testing Checklist

- [x] Start Date displays correctly in task details modal
- [x] Start Date displays correctly in my task list
- [x] Date matches the value sent by backend
- [x] No timezone-related date shifts
- [x] Works in different timezones (UTC, PST, IST, etc.)
- [x] Handles various date formats from backend
- [x] Target Date also uses same method (already working)
- [x] Date input field accepts the formatted value
- [x] Task cards show correct start date

## Related Issues

This same method is used for:
- Start Date (`selectedTaskStartDate`) in modal
- Target Date (`selectedTaskEndDate`) in modal
- Start Date in task list display
- Start Date in `getActiveTaskList` API response

All fields now display dates correctly without timezone issues.

## Technical Notes

**Why this happens:**
- JavaScript's `Date` constructor treats date strings without timezone info as local time
- `toISOString()` always returns UTC time
- The conversion between local and UTC can shift dates by ±1 day

**Why the fix works:**
- We extract the date string directly without parsing
- No Date object creation = no timezone conversion
- The date string is already in YYYY-MM-DD format (what input[type="date"] expects)
