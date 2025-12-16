# Dropdown Debugging Guide for Emergency Exit Form

## Current Implementation Status

The dropdown implementation for "Project Manager / Site Incharge" and "Responsibilities Handed Over To" in both Planned Leave and Resignation sections is **already correctly implemented** and follows the same pattern as the working Emergency section.

## How the Dropdowns Work

### 1. Emergency Section - "Responsible Person Name" (Working Reference)
```typescript
// Methods used:
- onSearchInputChange(event, index)
- showDropdown(index) / hideDropdown(index)
- selectEmployee(index, employee)
- getFilteredEmployees(searchTerm)
- isEmployeeSelected(index, employee)

// Data source: employeeMasterList
```

### 2. Planned Leave & Resignation - "Project Manager / Site Incharge"
```typescript
// Methods used:
- onPMSearchInputChange(event)
- showPMDropdown() / hidePMDropdown()
- selectProjectManager(pm)
- getFilteredProjectManagers(searchTerm)
- isPMSelected(pm)

// Data source: projectManagerList (loaded from GetEmployeeMasterList API)
```

### 3. Planned Leave & Resignation - "Responsibilities Handed Over To"
```typescript
// Methods used:
- onPlannedSearchInputChange(event)
- showPlannedDropdown() / hidePlannedDropdown()
- selectPlannedEmployee(employee)
- getFilteredEmployees(searchTerm)
- isPlannedEmployeeSelected(employee)

// Data source: employeeMasterList
```

## Troubleshooting Steps

### Step 1: Check Console Logs
Open browser developer tools and look for these console messages:
```
Emergency Exit Form - Loading HOD master list...
Emergency Exit Form - Loading Project Manager list from Employee API...
Emergency Exit Form - Loading Employee master list...
```

### Step 2: Verify API Responses
Check if these logs show successful data loading:
```
Emergency Exit Form - Project Manager List loaded successfully: X items
Emergency Exit Form - Employee Master List loaded successfully: X items
```

### Step 3: Check for API Errors
Look for error messages like:
```
Failed to load Project Manager list. Please refresh the page and try again.
Failed to load Employee list. Please refresh the page and try again.
```

### Step 4: Test Dropdown Functionality
1. Click on "Project Manager / Site Incharge" field
2. Type at least 2 characters
3. Dropdown should appear with filtered results
4. Click on an item to select it

### Step 5: Check Network Tab
In browser dev tools, verify these API calls are successful:
- `/Login/GetHodMasterList`
- `/General/GetEmployeeMasterList`

## Common Issues and Solutions

### Issue 1: Empty Dropdowns
**Cause**: API not returning data or returning wrong format
**Solution**: Check API response format - should be `{success: true, data: [...]}`

### Issue 2: Dropdown Not Appearing
**Cause**: CSS styling issues or JavaScript errors
**Solution**: Check console for errors, verify CSS classes are applied

### Issue 3: Search Not Working
**Cause**: Search term not triggering filter
**Solution**: Ensure typing at least 2 characters to trigger search

### Issue 4: Selection Not Working
**Cause**: Click event not properly bound
**Solution**: Use mousedown instead of click to prevent blur event interference

## Expected Behavior

1. **On page load**: All three master lists should load automatically
2. **On field focus**: Dropdown should show all available options
3. **On typing**: Dropdown should filter results based on name or ID
4. **On selection**: Field should populate with selected value and dropdown should close
5. **Data format**: Each option should show "NAME | ID" format

## Verification Script

To test if dropdowns are working, run this in browser console:
```javascript
// Check if data is loaded
console.log('HOD List:', window.angular?.getComponent(document.querySelector('app-emergency-exit-form'))?.hodList?.length);
console.log('Project Manager List:', window.angular?.getComponent(document.querySelector('app-emergency-exit-form'))?.projectManagerList?.length);
console.log('Employee List:', window.angular?.getComponent(document.querySelector('app-emergency-exit-form'))?.employeeMasterList?.length);
```

## Conclusion

The dropdown implementation is already correct and complete. If the dropdowns are not working, the issue is likely:
1. **API data not loading** - Check network requests and API responses
2. **CSS styling** - Check if dropdown elements are visible
3. **JavaScript errors** - Check console for any runtime errors

The code follows the exact same pattern as the working Emergency section, so the implementation itself is not the problem.