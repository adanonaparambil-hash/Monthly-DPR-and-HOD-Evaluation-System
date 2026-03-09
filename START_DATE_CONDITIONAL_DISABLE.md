# Start Date - Conditional Disable Implementation

## Overview
Implemented conditional disabling of the Start Date field in the task details modal. The field is now only editable when the task status is "NOT STARTED" and disabled for all other statuses.

## Business Rule

### Start Date Editability
- ✅ **Enabled**: When task status is **"NOT STARTED"**
- ❌ **Disabled**: When task status is:
  - RUNNING
  - PAUSED
  - CLOSED
  - AUTO CLOSED
  - Any other status

## Rationale

The Start Date should only be changeable before the task has started. Once a task begins (RUNNING status) or moves to any other state, the start date becomes a historical record and should not be modified.

## Implementation Details

### 1. HTML Template Update
**File**: `src/app/components/task-details-modal/task-details-modal.component.html`

Added `[disabled]` binding to the Start Date input:
```html
<input type="date" 
       class="metadata-input" 
       [(ngModel)]="selectedTaskStartDate" 
       [readonly]="isViewOnly" 
       [disabled]="isStartDateDisabled()">
```

### 2. TypeScript Method
**File**: `src/app/components/task-details-modal/task-details-modal.component.ts`

Added new method:
```typescript
isStartDateDisabled(): boolean {
  // Start Date is only editable when status is "NOT STARTED"
  // For all other statuses (RUNNING, PAUSED, CLOSED, AUTO CLOSED), it should be disabled
  return this.selectedTaskDetailStatus !== 'not-started';
}
```

### 3. CSS Styling
**File**: `src/app/components/task-details-modal/task-details-modal.component.css`

Added disabled state styling:
```css
.metadata-input:disabled {
  background-color: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
  border-color: #e5e7eb;
}
```

## Status Mapping

The component uses internal status values:
- `'not-started'` → NOT STARTED (editable)
- `'running'` → RUNNING (disabled)
- `'pause'` → PAUSED (disabled)
- `'not-closed'` → CLOSED (disabled)
- `'auto-closed'` → AUTO CLOSED (disabled)

## User Experience

### When Status is "NOT STARTED"
- ✅ Start Date field is **enabled**
- ✅ User can click and select a date
- ✅ Field has normal appearance
- ✅ Cursor shows as text/pointer

### When Status is Any Other State
- ❌ Start Date field is **disabled**
- ❌ User cannot click or modify
- ❌ Field appears grayed out (opacity 0.6)
- ❌ Cursor shows as "not-allowed"
- ❌ Background color changes to indicate disabled state

## Visual Indicators

### Light Mode (Disabled)
- Background: `#f3f4f6` (light gray)
- Text: `#9ca3af` (gray)
- Border: `#e5e7eb` (light gray border)
- Opacity: `0.6`
- Cursor: `not-allowed`

### Dark Mode (Disabled)
- Background: `#2a2a2a` (dark gray)
- Text: `#6b7280` (gray)
- Border: `#374151` (dark border)
- Opacity: `0.6`
- Cursor: `not-allowed`

## Behavior Flow

### Scenario 1: New Task
1. User creates new task
2. Status is "NOT STARTED"
3. Start Date field is **enabled**
4. User can select start date

### Scenario 2: Task Started
1. User starts task (status → RUNNING)
2. Start Date field becomes **disabled**
3. User cannot modify start date
4. Field shows grayed out appearance

### Scenario 3: Task Paused
1. User pauses task (status → PAUSED)
2. Start Date field remains **disabled**
3. User cannot modify start date

### Scenario 4: Task Closed
1. User closes task (status → CLOSED)
2. Start Date field remains **disabled**
3. Start date is locked as historical record

### Scenario 5: Status Changed Back to NOT STARTED
1. If status is changed back to "NOT STARTED"
2. Start Date field becomes **enabled** again
3. User can modify start date

## Integration with View-Only Mode

The Start Date field respects both conditions:
1. **View-Only Mode**: `[readonly]="isViewOnly"`
2. **Status-Based Disable**: `[disabled]="isStartDateDisabled()"`

If either condition is true, the field cannot be edited:
- View-only mode: Field is readonly
- Status not "NOT STARTED": Field is disabled

## Benefits

1. ✅ **Data Integrity**: Prevents accidental modification of historical start dates
2. ✅ **Clear UX**: Visual feedback shows when field is editable
3. ✅ **Business Logic**: Enforces rule that start date is set before task begins
4. ✅ **Consistent**: Works across all task statuses
5. ✅ **Accessible**: Uses standard disabled attribute for screen readers
6. ✅ **Responsive**: Updates automatically when status changes

## Testing Checklist

- [x] Start Date enabled when status is "NOT STARTED"
- [x] Start Date disabled when status is "RUNNING"
- [x] Start Date disabled when status is "PAUSED"
- [x] Start Date disabled when status is "CLOSED"
- [x] Start Date disabled when status is "AUTO CLOSED"
- [x] Disabled styling applied correctly (light mode)
- [x] Disabled styling applied correctly (dark mode)
- [x] Cursor changes to "not-allowed" when disabled
- [x] Field cannot be clicked when disabled
- [x] Field re-enables if status changes back to "NOT STARTED"
- [x] Works correctly with view-only mode
- [x] No TypeScript errors
- [x] No build errors

## Edge Cases Handled

1. **New Task**: Status is "NOT STARTED" by default → Field is enabled ✓
2. **Task in Progress**: Status is not "NOT STARTED" → Field is disabled ✓
3. **Status Change**: Field enables/disables dynamically ✓
4. **View-Only Mode**: Field respects both readonly and disabled states ✓
5. **Dark Mode**: Disabled styling works in dark mode ✓

## Future Enhancements

1. **Tooltip**: Add tooltip explaining why field is disabled
2. **History**: Show start date change history
3. **Validation**: Add validation for start date (e.g., cannot be in future)
4. **Permissions**: Add role-based override for admins

## Notes

- The disabled state is purely client-side validation
- Server-side validation should also enforce this rule
- The start date is still sent to the API even when disabled
- The field uses Angular's `[disabled]` binding for reactive updates
- The method `isStartDateDisabled()` is called on every change detection cycle
