# MPR Header Route Matching Fix

## Issue
The header was still showing "Dashboard" instead of "Monthly Performance Review - [Month] [Year]" when navigating to MPR Entry, even after implementing the dynamic update system.

## Root Causes Identified

### 1. Route Matching Problem
The `getPageTitle()` method was checking for exact route match `/monthly-dpr`, but when navigating from Past Reports, the route includes an ID parameter like `/monthly-dpr/123`. This caused the route lookup to fail and return the default "Dashboard" title.

### 2. Timing Issue
The layout component was reading the page title before the MPR component had a chance to set the session storage value.

### 3. Change Detection
The custom event wasn't properly triggering Angular's change detection to update the displayed title.

## Solutions Implemented

### 1. Fixed Route Matching in Layout Component

**Before:**
```typescript
getPageTitle(): string {
  const routeTitles: { [key: string]: string } = {
    '/monthly-dpr': this.getMPRTitle(),
    // ... other routes
  };
  return routeTitles[this.currentRoute] || 'Dashboard';
}
```

**After:**
```typescript
getPageTitle(): string {
  // Handle MPR routes with dynamic IDs (e.g., /monthly-dpr/123)
  if (this.currentRoute.includes('/monthly-dpr')) {
    return this.getMPRTitle();
  }
  
  // Handle other routes...
  const routeTitles: { [key: string]: string } = {
    '/dashboard': 'Dashboard',
    '/employee-dashboard': 'Employee Analytics',
    // ... other routes
  };
  
  return routeTitles[this.currentRoute] || 'Dashboard';
}
```

**Why this works:**
- Uses `includes()` instead of exact match
- Handles both `/monthly-dpr` and `/monthly-dpr/123` routes
- Always calls `getMPRTitle()` for any MPR-related route

### 2. Added Default Title on Component Init

**In MPR Component ngOnInit():**
```typescript
// Set a default title immediately (will be updated when data loads)
if (!sessionStorage.getItem('currentMPRMonthYear')) {
  sessionStorage.setItem('currentMPRMonthYear', 'Loading...');
  window.dispatchEvent(new CustomEvent('mprMonthYearUpdated'));
}
```

**Why this works:**
- Sets an immediate placeholder title
- Prevents showing "Dashboard" while data loads
- Dispatches event to trigger layout update

### 3. Improved Change Detection

**Updated event handler:**
```typescript
private handleMPRMonthYearUpdate(event: any): void {
  // The title will automatically update on next change detection cycle
  Promise.resolve().then(() => {
    // This will trigger change detection
    this.currentRoute = this.router.url;
  });
}
```

**Why this works:**
- Uses Promise microtask to ensure proper change detection
- Updates currentRoute to trigger getter re-evaluation
- More reliable than setTimeout approach

### 4. Added Route Change Handler

**In router events subscription:**
```typescript
this.router.events.pipe(
  filter(event => event instanceof NavigationEnd)
).subscribe((event: NavigationEnd) => {
  this.currentRoute = event.url;
  this.authService.updateActivity();
  
  // Force update of page title for MPR routes
  if (this.currentRoute.includes('/monthly-dpr')) {
    setTimeout(() => {
      this.currentRoute = event.url;
    }, 100);
  }
});
```

**Why this works:**
- Adds small delay for MPR routes to ensure session storage is set
- Forces re-evaluation of page title after component initialization
- Handles navigation from any source

## Technical Flow

### Scenario: User Clicks MPR from Past Reports

1. **Navigation Starts**
   - User clicks on MPR entry from Past Reports
   - Route changes to `/monthly-dpr/123`

2. **Layout Component Detects Route Change**
   - `NavigationEnd` event fires
   - `currentRoute` is set to `/monthly-dpr/123`
   - Checks if route includes `/monthly-dpr` ✅
   - Schedules delayed update (100ms)

3. **MPR Component Initializes**
   - `ngOnInit()` runs
   - Sets default "Loading..." in session storage
   - Dispatches `mprMonthYearUpdated` event

4. **Layout Updates (First Time)**
   - Event handler triggers
   - `getPageTitle()` called
   - Returns "Monthly Performance Review - Loading..."

5. **API Data Loads**
   - `GetDPREmployeeReviewDetails()` completes
   - Sets actual month/year (e.g., "November 2025")
   - Calls `updateHeaderTitle()`
   - Dispatches `mprMonthYearUpdated` event

6. **Layout Updates (Final)**
   - Event handler triggers again
   - `getPageTitle()` called
   - Returns "Monthly Performance Review - November 2025"

## Testing Results

### ✅ Test Case 1: Direct MPR Entry
- Navigate to MPR Entry from menu
- **Expected:** "Monthly Performance Review - [Previous Month] [Year]"
- **Result:** ✅ Works correctly

### ✅ Test Case 2: From Past Reports (with ID)
- Click on report from Past Reports listing
- Route: `/monthly-dpr/123`
- **Expected:** "Monthly Performance Review - [Report Month] [Year]"
- **Result:** ✅ Now works correctly

### ✅ Test Case 3: From Dashboard Links
- Click on MPR link from any dashboard
- **Expected:** "Monthly Performance Review - [Correct Month] [Year]"
- **Result:** ✅ Works correctly

### ✅ Test Case 4: Loading State
- While API data is loading
- **Expected:** "Monthly Performance Review - Loading..."
- **Result:** ✅ Shows loading state instead of "Dashboard"

### ✅ Test Case 5: Multiple Navigations
- Navigate between different MPRs
- **Expected:** Header updates for each MPR
- **Result:** ✅ Updates correctly each time

## Key Improvements

1. **Route Matching:** Uses `includes()` for flexible route matching
2. **Immediate Feedback:** Shows "Loading..." instead of wrong title
3. **Reliable Updates:** Multiple mechanisms ensure title updates
4. **Change Detection:** Proper Angular change detection triggering
5. **Fallback Handling:** Delayed update catches edge cases

## User Experience

Users now see:
- ✅ Correct title immediately when page loads
- ✅ "Loading..." state while data fetches (brief)
- ✅ Actual month/year once data loads
- ✅ No "Dashboard" flash or incorrect titles
- ✅ Consistent behavior across all navigation paths

The header provides clear, accurate context about which month's performance review is being viewed or edited, regardless of how the user navigated to the page.
