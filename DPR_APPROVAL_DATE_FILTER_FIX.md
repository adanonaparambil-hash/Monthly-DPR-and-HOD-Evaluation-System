# DPR Approval - Default Date Filter and Page Size Update

## Changes Made

### 1. Default Date Range
Updated the default date filter to show current month's data:

**Before:**
- From Date: 7 days ago
- To Date: Today

**After:**
- From Date: First day of current month
- To Date: Today (current date)

### 2. Page Size
Increased the page size to fetch more records per API call:

**Before:**
- Page Size: 100 records

**After:**
- Page Size: 500 records

## Implementation Details

### Date Filter Changes

```typescript
setDefaultDates() {
  const today = new Date();
  
  // Set To Date as today
  this.toDate = this.formatDateForInput(today);
  
  // Set From Date as first day of current month
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  this.fromDate = this.formatDateForInput(firstDayOfMonth);
  
  console.log('Default dates set:', {
    fromDate: this.fromDate,
    toDate: this.toDate
  });
}
```

### Page Size Change

```typescript
// Pagination properties
currentPage = 1;
pageSize = 500;  // Changed from 100 to 500
totalRecords = 0;
totalPages = 0;
```

## How It Works

### On Page Load:
1. `ngOnInit()` is called
2. `setDefaultDates()` sets:
   - **From Date:** First day of current month (e.g., December 1, 2024)
   - **To Date:** Today's date (e.g., December 24, 2024)
3. `loadApprovalList()` is called with these default dates
4. API `GetEmployeeApprovalListPaged` is called with:
   - `pageSize: 500`
   - `fromDate: 2024-12-01`
   - `toDate: 2024-12-24`

### Example Dates:
If today is **December 24, 2024**:
- From Date: **December 1, 2024**
- To Date: **December 24, 2024**

If today is **January 15, 2025**:
- From Date: **January 1, 2025**
- To Date: **January 15, 2025**

## Benefits

### 1. Better Default Date Range
- Shows all records for the current month by default
- More relevant data for monthly reporting
- Aligns with typical DPR approval workflows

### 2. Improved Performance
- Fetches 500 records per page instead of 100
- Reduces number of API calls needed
- Better user experience with less pagination

### 3. Consistent Behavior
- Always starts from the first day of the month
- Predictable date range for users
- Easier to review monthly DPR submissions

## API Impact

### GetEmployeeApprovalListPaged API
The API is called with these parameters:

```typescript
this.api.GetEmployeeApprovalListPaged(
  employeeId,        // Selected user's ID
  this.currentPage,  // Current page number (default: 1)
  this.pageSize,     // Page size (now: 500)
  fromDateFormatted, // First day of current month
  toDateFormatted,   // Today's date
  projectId,         // Selected project (0 for all)
  categoryId         // Selected category (0 for all)
)
```

### Expected Response:
```json
{
  "success": true,
  "data": {
    "records": [...],      // Array of up to 500 records
    "totalCount": 1250     // Total records matching filters
  }
}
```

## Testing

### Test Scenarios:

1. **Page Load:**
   - Open DPR Approval page
   - Verify From Date shows first day of current month
   - Verify To Date shows today's date
   - Verify records are loaded

2. **Different Months:**
   - Test on different days of the month
   - Verify From Date always shows 1st of the month
   - Verify To Date always shows current date

3. **Month Boundaries:**
   - Test on first day of month (e.g., Jan 1)
   - Test on last day of month (e.g., Jan 31)
   - Verify dates are correct

4. **Page Size:**
   - Check if 500 records are loaded per page
   - Verify pagination works correctly
   - Check total pages calculation

5. **Filter Changes:**
   - Change date filters manually
   - Apply filters
   - Verify API is called with correct dates

## User Experience

### Before:
- Default showed last 7 days
- Users had to manually change dates to see full month
- More pagination needed (100 records per page)

### After:
- Default shows current month automatically
- More relevant data displayed immediately
- Less pagination needed (500 records per page)
- Better for monthly DPR review workflows

## Files Modified
- `src/app/dpr-approval/dpr-approval.component.ts`
  - Updated `pageSize` from 100 to 500
  - Updated `setDefaultDates()` to use first day of current month

## Verification Checklist

- [ ] From Date defaults to first day of current month
- [ ] To Date defaults to today's date
- [ ] Page size is 500 records
- [ ] API is called with correct parameters
- [ ] Records are displayed correctly
- [ ] Pagination works with 500 records per page
- [ ] Date filters can be changed manually
- [ ] Apply Filters button works correctly

## Summary
The DPR Approval page now defaults to showing the current month's data (from 1st of the month to today) and fetches 500 records per page instead of 100, providing a better user experience and reducing the number of API calls needed.
