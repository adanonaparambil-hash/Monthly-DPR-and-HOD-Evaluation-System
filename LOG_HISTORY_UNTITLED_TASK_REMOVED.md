# Log History - Remove "Untitled Task" and "No description" Text

## Changes Made

### Modified: `src/app/my-logged-hours/my-logged-hours.ts`

Changed the default values for task title and description from verbose text to "-" (dash) when no data is available.

**Previous Behavior:**
- When a task had no title, it displayed "Untitled Task" in the Task Title column
- When a task had no description, it displayed "No description" in the Description column
- This was verbose and took up unnecessary space

**New Behavior:**
- When a task has no title, it displays "-" (dash)
- When a task has no description, it displays "-" (dash)
- Cleaner, more minimal appearance
- Consistent with other empty field displays

## Changes in Detail

Updated two locations where task title and description are mapped from API response:

1. **First mapping** (line ~711):
   ```typescript
   title: log.taskTitle || '-',        // Changed from 'Untitled Task'
   description: log.description || '-', // Changed from 'No description'
   ```

2. **Second mapping** (line ~745):
   ```typescript
   title: log.taskTitle || '-',        // Changed from 'Untitled Task'
   description: log.description || '-', // Changed from 'No description'
   ```

Both mappings occur in the `getUserDailyLogHistory` API response handler:
- First one handles the standard response format
- Second one handles direct array response format

## Visual Impact

**Before:**
```
Task Title          | Description
--------------------|--------------------
My Important Task   | Task details here
Untitled Task       | No description
Another Task        | Some description
Untitled Task       | No description
```

**After:**
```
Task Title          | Description
--------------------|--------------------
My Important Task   | Task details here
-                   | -
Another Task        | Some description
-                   | -
```

## Files Modified

- `src/app/my-logged-hours/my-logged-hours.ts`

## Testing

- [x] Tasks with titles display correctly
- [x] Tasks without titles show "-" instead of "Untitled Task"
- [x] Tasks with descriptions display correctly
- [x] Tasks without descriptions show "-" instead of "No description"
- [x] No impact on other columns or functionality
- [x] Consistent display across all records
- [x] Cleaner, more professional appearance
