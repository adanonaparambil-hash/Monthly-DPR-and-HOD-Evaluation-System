# Department Filter Fix - Past Reports

## Issue
Department parameter was passing null to the backend instead of the selected dropdown value.

## Root Cause
The `loadReports()` was being called in `ngOnInit()` before the asynchronous `loadDepartmentList()` completed. This meant:
1. `loadDepartmentList()` starts fetching data
2. `loadReports()` is called immediately (department not set yet)
3. Department list arrives and sets IT as default
4. But reports were already loaded without the department filter

## Solution

### 1. Changed Loading Order
```typescript
ngOnInit() {
  this.initializeUserSession();
  this.setDefaultPreviousMonth();
  this.loadHodMasterList();
  
  // Load department list first for CED users, then load reports
  if (this.isCed) {
    this.loadDepartmentList(); // This will call loadReports() when done
  } else {
    this.loadReports();
  }
}
```

### 2. Updated loadDepartmentList()
Now calls `loadReports()` after department is set:
```typescript
loadDepartmentList(): void {
  this.api.GetDepartmentList().subscribe(
    (response: any) => {
      if (response && response.success && response.data) {
        this.departmentList = response.data;
        
        // Set IT department as default if CED user
        if (this.isCed) {
          const itDepartment = this.departmentList.find(dept => 
            dept.description?.toUpperCase() === 'IT' || 
            dept.idValue?.toUpperCase() === 'IT'
          );
          if (itDepartment && itDepartment.idValue) {
            this.filters.department = itDepartment.idValue;
          }
        }
        
        // Load reports AFTER department is set
        this.loadReports();
      }
    }
  );
}
```

### 3. Added Debug Logging
Added console logs to track:
- Department list loading
- IT department detection
- Department filter value being set
- Department value being sent to API

## How It Works Now

### For CED Users:
1. Component initializes
2. `loadDepartmentList()` is called
3. Department list is fetched from API
4. IT department is found and set as default
5. `loadReports()` is called with department filter
6. API receives: `department: "IT"` (or the actual idValue)

### For Non-CED Users (Employee/HOD):
1. Component initializes
2. `loadReports()` is called directly
3. No department filter is sent

## Testing
Check browser console for these logs:
- "Department list loaded:" - Shows all departments
- "IT Department found:" - Shows the IT department object
- "Department filter set to:" - Shows the idValue being set
- "Department filter applied:" - Shows the value being sent to API

## Expected Behavior
- CED users: Department dropdown defaults to "IT"
- First API call includes: `department: "IT"` (or actual IT idValue)
- Changing department triggers new API call with new value
- Empty department selection = no department parameter sent
