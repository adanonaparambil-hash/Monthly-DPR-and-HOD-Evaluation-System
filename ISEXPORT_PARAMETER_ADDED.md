# isExport Parameter Added to getUserDailyLogHistory

## Overview
Added the `isExport` parameter to the `getUserDailyLogHistory` API call in the "My Logged Hours" component.

## Changes Made

### File: `src/app/my-logged-hours/my-logged-hours.ts`

#### Modified Method: `loadLoggedHours()`

Added `isExport: 'N'` to the request object:

```typescript
// Build request object
const request: any = {
  fromDate: this.fromDate || undefined,
  toDate: this.toDate || undefined,
  projectId: this.selectedProject !== 'all' ? Number(this.selectedProject) : undefined,
  categoryId: this.selectedCategory !== 'all' ? Number(this.selectedCategory) : undefined,
  pageNumber: this.currentPage,
  pageSize: this.pageSize,
  isExport: 'N'  // Always 'N' for normal data loading
};
```

## Behavior

- **When user clicks "Apply Filter" button**: The `isExport` parameter is sent as `'N'`
- **When loading data**: The `isExport` parameter is always `'N'` for normal data viewing
- **Purpose**: Indicates to the API that this is a data viewing request, not an export request

## API Request Example

```json
{
  "fromDate": "2026-02-01",
  "toDate": "2026-02-23",
  "projectId": 123,
  "categoryId": 21,
  "departmentId": 5,
  "employeeId": "ITS48",
  "pageNumber": 1,
  "pageSize": 500,
  "isExport": "N"
}
```

## Notes

- The parameter is always set to `'N'` for normal data loading
- If an export feature is added later, it would use `'Y'` for the `isExport` parameter
- This parameter is included in all calls to `getUserDailyLogHistory`, including:
  - Initial page load
  - Filter application
  - Pagination (load more)
  - Data refresh

## Testing

✅ Parameter is included in the request object
✅ No syntax errors
✅ Existing functionality remains unchanged
✅ API receives the `isExport: 'N'` parameter on every call
