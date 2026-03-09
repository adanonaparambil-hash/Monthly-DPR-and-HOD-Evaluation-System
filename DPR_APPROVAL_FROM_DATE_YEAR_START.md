# DPR Approval From Date - Year Start Default

## Requirement
The "From Date" in the DPR Approval page should always default to the start of the current year (e.g., 2026-01-01) instead of the first day of the current month.

## Implementation
Updated the `setDefaultDates()` method in the DPR Approval component to set the "From Date" to January 1st of the current year.

### Changes Made
**File**: `src/app/dpr-approval/dpr-approval.component.ts`

**Before:**
```typescript
// Set From Date as first day of current month
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
this.fromDate = this.formatDateForInput(firstDayOfMonth);
```

**After:**
```typescript
// Set From Date as January 1st of current year (2026-01-01)
const firstDayOfYear = new Date(today.getFullYear(), 0, 1); // Month 0 = January
this.fromDate = this.formatDateForInput(firstDayOfYear);
```

## Behavior
- **From Date**: Always defaults to January 1st of the current year (e.g., 2026-01-01)
- **To Date**: Defaults to today's date
- This provides a full year view of DPR records by default

## Example
If the current date is March 2, 2026:
- From Date: 2026-01-01
- To Date: 2026-03-02

## Status
✅ **IMPLEMENTED** - DPR Approval page now defaults to showing records from the start of the current year.
