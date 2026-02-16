# My Logged Hours - Fix Instructions

## Problem
The application is using `src/app/my-logged-hours/my-logged-hours.ts` (NOT the `.component.ts` version) which still has hardcoded data.

## Solution Required

You need to manually update the file `src/app/my-logged-hours/my-logged-hours.ts` with the following changes:

### 1. Add API Import
At the top of the file, add:
```typescript
import { Api } from '../services/api';
```

### 2. Update Constructor
Change:
```typescript
constructor(private themeService: Theme) {}
```

To:
```typescript
constructor(
  private themeService: Theme,
  private api: Api
) {}
```

### 3. Replace Hardcoded loggedHours Array
Replace the entire `loggedHours: LoggedHour[] = [...]` array (lines 129-300+) with:
```typescript
// Logged hours data from API (no hardcoded data)
loggedHours: LoggedHour[] = [];
```

### 4. Update ngOnInit Method
Replace the existing `ngOnInit()` method with:
```typescript
ngOnInit() {
  // Subscribe to theme changes
  this.themeService.isDarkMode$.subscribe(isDark => {
    this.isDarkMode = isDark;
  });
  
  // Set default date range (1st of current month to today)
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  this.fromDate = this.formatDateForInput(firstDayOfMonth);
  this.toDate = this.formatDateForInput(today);
  
  // Load dropdown data from API
  this.loadProjects();
  this.loadDepartments();
  
  // Load logged hours data
  this.loadLoggedHours();
}
```

### 5. Add New Methods (add these BEFORE the existing getTodayRecords method)

```typescript
formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

loadProjects() {
  console.log('Loading projects for My Logged Hours');
  
  this.api.getProjects().subscribe({
    next: (response) => {
      console.log('getProjects API Response:', response);
      
      if (response.success && response.data) {
        this.projects = response.data;
        console.log('Loaded projects:', this.projects.length);
      }
    },
    error: (error) => {
      console.error('Error loading projects:', error);
    }
  });
}

loadDepartments() {
  console.log('Loading departments for My Logged Hours');
  
  this.api.getDepartmentList().subscribe({
    next: (response) => {
      console.log('getDepartmentList API Response:', response);
      
      if (response.success && response.data) {
        this.departments = response.data.filter((dept: Department) => dept.status === 'Y');
        console.log('Loaded departments:', this.departments.length);
      }
    },
    error: (error) => {
      console.error('Error loading departments:', error);
    }
  });
}

onDepartmentChange() {
  console.log('Department changed to:', this.selectedDepartment);
  
  this.selectedCategory = 'all';
  this.taskCategories = [];
  
  if (this.selectedDepartment === 'all') {
    this.loadLoggedHours();
    return;
  }
  
  this.loadDepartmentTaskCategories(Number(this.selectedDepartment));
  this.loadLoggedHours();
}

loadDepartmentTaskCategories(departmentId: number) {
  console.log('Loading task categories for department:', departmentId);
  
  this.api.getDepartmentTaskCategories(departmentId).subscribe({
    next: (response) => {
      console.log('getDepartmentTaskCategories API Response:', response);
      
      if (response.success && response.data) {
        const allCategories = [
          ...(response.data.favouriteList || []),
          ...(response.data.departmentList || []),
          ...(response.data.allDepartmentList || [])
        ];
        
        const uniqueCategories = allCategories.filter((category, index, self) =>
          index === self.findIndex((c) => c.categoryId === category.categoryId)
        );
        
        this.taskCategories = uniqueCategories;
        console.log('Loaded task categories:', this.taskCategories.length);
      }
    },
    error: (error) => {
      console.error('Error loading task categories:', error);
    }
  });
}

onProjectChange() {
  console.log('Project changed to:', this.selectedProject);
  this.loadLoggedHours();
}

onCategoryChange() {
  console.log('Category changed to:', this.selectedCategory);
  this.loadLoggedHours();
}

onDateChange() {
  console.log('Date range changed:', this.fromDate, 'to', this.toDate);
  this.loadLoggedHours();
}

loadLoggedHours() {
  console.log('Loading logged hours from API');
  this.isLoadingData = true;
  
  const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
  const userId = currentUser.empId || currentUser.employeeId || '';
  
  if (!userId) {
    console.error('No user ID found');
    this.isLoadingData = false;
    return;
  }
  
  const request = {
    userId: userId,
    fromDate: this.fromDate || undefined,
    toDate: this.toDate || undefined,
    projectId: this.selectedProject !== 'all' ? Number(this.selectedProject) : undefined,
    categoryId: this.selectedCategory !== 'all' ? Number(this.selectedCategory) : undefined
  };
  
  console.log('getUserDailyLogHistory request:', request);
  
  this.api.getUserDailyLogHistory(request).subscribe({
    next: (response) => {
      console.log('getUserDailyLogHistory API Response:', response);
      
      if (response && response.success && response.data) {
        this.loggedHours = response.data.map((log: any, index: number) => ({
          id: `${log.taskId}-${index}`,
          taskId: `TSK-${log.taskId}`,
          title: log.taskTitle || 'Untitled Task',
          description: log.description || log.dailyComment || 'No description',
          category: log.categoryName || 'Uncategorized',
          duration: log.duration || '00:00',
          date: log.logDate ? log.logDate.split('T')[0] : '',
          project: log.projectName || 'No Project',
          dailyComment: log.dailyComment || '',
          loggedBy: log.loggedBy || ''
        }));
        
        console.log('Loaded logged hours:', this.loggedHours.length, 'records');
      } else {
        console.warn('No logged hours data found');
        this.loggedHours = [];
      }
      
      this.isLoadingData = false;
    },
    error: (error) => {
      console.error('Error loading logged hours:', error);
      this.loggedHours = [];
      this.isLoadingData = false;
    }
  });
}
```

### 6. Update getTodayRecords, getYesterdayRecords, getTuesdayRecords

Replace these three methods with:
```typescript
getTodayRecords(): LoggedHour[] {
  const today = this.formatDateForInput(new Date());
  return this.loggedHours.filter(record => record.date === today);
}

getYesterdayRecords(): LoggedHour[] {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = this.formatDateForInput(yesterday);
  return this.loggedHours.filter(record => record.date === yesterdayStr);
}

getTuesdayRecords(): LoggedHour[] {
  // This method is deprecated - data is now dynamic
  return [];
}
```

## After Making Changes

1. Save the file
2. Rebuild the Angular application: `ng build` or restart the dev server
3. Refresh the browser
4. The page should now load data from the API instead of showing hardcoded data

## Verification

Check the browser console - you should see:
- "Loading projects for My Logged Hours"
- "Loading departments for My Logged Hours"
- "Loading logged hours from API"
- API responses logged

The page should now display real data from the backend API.
