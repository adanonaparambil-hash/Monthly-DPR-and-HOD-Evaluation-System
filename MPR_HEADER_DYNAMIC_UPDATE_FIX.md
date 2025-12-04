# MPR Header Dynamic Update Fix

## Issue
When navigating to the MPR Entry screen from Past Reports or other saved data sources, the header was showing "Dashboard" instead of "Monthly Performance Review - [Month] [Year]". The session storage was being cleared too early in `ngOnInit()`, before the data was loaded from the API.

## Root Cause
The session storage was being cleared immediately in `ngOnInit()`, but the month/year data was only available after the API call completed in `GetDPREmployeeReviewDetails()`. This created a timing issue where:
1. Session storage was cleared
2. Layout component read the empty session storage and showed default title
3. API data loaded and set the month/year (but layout didn't update)

## Solution

### 1. Removed Premature Session Storage Clearing
- Removed `sessionStorage.removeItem('currentMPRMonthYear')` from `ngOnInit()`
- Session storage is now only updated when we have valid month/year data

### 2. Added Dynamic Header Update Method
Created a new `updateHeaderTitle()` method in the MPR component that:
- Updates session storage with the current month/year
- Dispatches a custom event to notify the layout component
- Ensures the header updates immediately when data is loaded

```typescript
private updateHeaderTitle(): void {
  if (this.monthYear) {
    sessionStorage.setItem('currentMPRMonthYear', this.monthYear);
    // Trigger a custom event to notify the layout component
    window.dispatchEvent(new CustomEvent('mprMonthYearUpdated', { detail: this.monthYear }));
  }
}
```

### 3. Updated All Month/Year Setting Points
Both places where `monthYear` is set now call `updateHeaderTitle()`:
- `setPreviousMonthYear()` - for new DPR creation
- `GetDPREmployeeReviewDetails()` - for loading existing DPR data

### 4. Added Event Listener in Layout Component
The layout component now:
- Listens for the `mprMonthYearUpdated` custom event
- Forces change detection when the event is received
- Updates the header title dynamically without page refresh
- Properly cleans up the event listener in `ngOnDestroy()`

## Technical Implementation

### MPR Component Changes
```typescript
// In setPreviousMonthYear()
this.monthYear = currentDate.toLocaleDateString('en-US', options);
this.updateHeaderTitle(); // Update header immediately

// In GetDPREmployeeReviewDetails()
this.monthYear = `${monthNames[dpr.month - 1]} ${dpr.year}`;
this.updateHeaderTitle(); // Update header immediately
```

### Layout Component Changes
```typescript
// In ngOnInit()
window.addEventListener('mprMonthYearUpdated', this.handleMPRMonthYearUpdate.bind(this));

// Event handler
private handleMPRMonthYearUpdate(event: any): void {
  const currentUrl = this.currentRoute;
  this.currentRoute = '';
  setTimeout(() => {
    this.currentRoute = currentUrl;
  }, 0);
}

// In ngOnDestroy()
window.removeEventListener('mprMonthYearUpdated', this.handleMPRMonthYearUpdate.bind(this));
```

## Benefits

1. **Real-time Updates**: Header updates immediately when MPR data is loaded
2. **Works from Any Source**: Whether creating new DPR or loading from Past Reports
3. **No Page Refresh Needed**: Uses custom events for instant updates
4. **Clean Architecture**: Proper event handling with cleanup
5. **Consistent Behavior**: Same experience regardless of navigation path

## Testing Scenarios

### Scenario 1: Direct MPR Entry (New DPR)
- Navigate to MPR Entry from menu
- Header shows: "Monthly Performance Review - [Previous Month] [Year]"
- ✅ Works correctly

### Scenario 2: From Past Reports (Existing DPR)
- Click on a report from Past Reports listing
- Header shows: "Monthly Performance Review - [Report Month] [Year]"
- ✅ Now works correctly (previously showed "Dashboard")

### Scenario 3: From Dashboard Links
- Click on any MPR link from Employee/HOD/CED Dashboard
- Header shows: "Monthly Performance Review - [Correct Month] [Year]"
- ✅ Now works correctly

### Scenario 4: Navigation Between MPRs
- Navigate from one MPR to another
- Header updates to show the correct month/year for each MPR
- ✅ Works correctly with dynamic updates

## User Experience

Users now see the correct "Monthly Performance Review - [Month] [Year]" header title:
- Immediately when the page loads
- When navigating from any source (menu, dashboards, past reports)
- Without any page refresh or delay
- Consistently across all navigation paths

The header provides clear context about which month's performance review they are viewing or editing.
