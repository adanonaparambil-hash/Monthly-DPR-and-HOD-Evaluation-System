# Past Reports Server-Side Pagination Implementation

## Overview
Implemented server-side pagination for the Past Reports listing with efficient data fetching and caching mechanism.

## Key Features

### 1. Server-Side Pagination Parameters
Added to `DPRMonthlyReviewListingRequest`:
- `row_num`: Starting row number for the current batch
- `page_number`: Current batch number (starts from 1)
- `items_per_page`: Number of records to fetch per API call (500)
- `department`: Department filter (string value - idValue from dropdown)

### 2. Pagination Strategy
- **Display**: 100 records per page on the UI
- **Fetch**: 500 records per API call
- **Batching**: 5 pages (100 records each) from a single API call
- **Smart Loading**: Next API call only when user navigates beyond cached data

### 3. Implementation Details

#### Component Properties
```typescript
currentPage = 1;              // Current page being displayed
pageSize = 100;               // Records displayed per page
itemsPerPage = 500;           // Records fetched from API per call
cachedData: any[] = [];       // Cache for all fetched data
currentBatch = 1;             // Track which batch of 500 records
```

#### API Request Structure
```typescript
{
  month: number,
  year: number,
  status: string,
  page_number: 1,              // Batch number (1, 2, 3...)
  items_per_page: 500,         // Fetch 500 records
  row_num: 1,                  // Starting row number
  department: string           // Department filter (CED only) - idValue from dropdown
}
```

#### Pagination Flow
1. **Initial Load**: Fetches first 500 records (batch 1)
2. **Pages 1-5**: Display from cached data (no API call)
3. **Page 6**: Triggers API call for next 500 records (batch 2)
4. **Pages 6-10**: Display from cached data
5. **Page 11**: Triggers API call for next 500 records (batch 3)
6. And so on...

### 4. Key Methods

#### loadReports(resetCache: boolean)
- Fetches data from API with pagination parameters
- Manages data caching
- Calculates total pages and records
- `resetCache = true`: Clears cache and starts fresh (used on filter change)
- `resetCache = false`: Appends new data to cache (used on page navigation)

#### onPageChange(page: number)
- Handles page navigation
- Checks if more data needs to be fetched
- Triggers API call when needed

#### getRowNumber(index: number)
- Calculates the serial number for each row
- Formula: `((currentPage - 1) * pageSize) + index + 1`

### 5. Department Filter
- Only visible for CED users
- Default selection: "IT" department
- Passed as string value (idValue from dropdown) in API request ONLY when selected (not null/empty)
- Resets to "IT" when clearing filters
- Backend receives department parameter only when a value is selected
- Value sent: `filters.department` (string from dropdown's idValue)

### 6. UI Updates
- Added "Sl No" column to display row numbers
- HOD Name column displayed for all users
- Department filter dropdown (CED only)
- Table scrolling enabled (max-height: 600px)
- Pagination info shows correct record range

### 7. Cache Management
- Cache cleared on:
  - Filter changes
  - Clear filters button click
  - Search input change
- Cache preserved on:
  - Page navigation within cached range

## Benefits

1. **Performance**: Reduces API calls by fetching 500 records at once
2. **User Experience**: Smooth navigation through first 5 pages without loading
3. **Scalability**: Can handle large datasets efficiently
4. **Memory Efficient**: Only loads data as needed
5. **Responsive**: Quick page transitions within cached data
6. **Scrollable Table**: Max height of 600px prevents long lists, adds vertical scroll

## API Response Expected
The API should return:
```typescript
{
  success: boolean,
  data: Array<Report>,
  totalRecords?: number  // Optional: Total count of all records
}
```

## Testing Checklist
- [ ] Initial load shows first 100 records
- [ ] Navigate through pages 1-5 without API calls
- [ ] Page 6 triggers new API call
- [ ] Row numbers are sequential across pages
- [ ] Department filter works correctly
- [ ] IT department is selected by default for CED
- [ ] Clear filters resets to IT department
- [ ] Search triggers cache reset
- [ ] Pagination info displays correct ranges
- [ ] Empty state shows when no data
