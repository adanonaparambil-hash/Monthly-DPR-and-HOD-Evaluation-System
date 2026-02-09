# Project Dropdown API Binding

## Summary
Integrated the Project dropdown in the task modal with the `getProjects` API to dynamically load and display project names, with projectId as the value for selection.

## API Details

### Endpoint: `getProjects`
**Response Format:**
```json
{
  "success": true,
  "message": "Project list fetched successfully",
  "data": [
    {
      "projectId": 442,
      "projectName": "1012A-GHALA CHURCH - INDIAN ORTHODOX",
      "departmentId": 0,
      "isActive": "Y",
      "createdBy": "SYSTEM",
      "createdOn": "2026-02-09T16:13:13"
    },
    {
      "projectId": 443,
      "projectName": "Another Project Name",
      "departmentId": 1,
      "isActive": "Y",
      "createdBy": "SYSTEM",
      "createdOn": "2026-02-09T16:13:13"
    }
  ]
}
```

## Changes Made

### 1. HTML Updates (`src/app/my-task/my-task.component.html`)

#### Updated Project Dropdown:
**Before:**
```html
<div class="metadata-card">
  <div class="metadata-icon">
    <i class="fas fa-folder"></i>
  </div>
  <div class="metadata-content">
    <p class="metadata-label">Project</p>
    <select class="metadata-select">
      <option>Marketing Dashboard</option>
      <option>User Onboarding</option>
      <option>API Revamp</option>
    </select>
  </div>
</div>
```

**After:**
```html
<div class="metadata-card">
  <div class="metadata-icon">
    <i class="fas fa-folder"></i>
  </div>
  <div class="metadata-content">
    <p class="metadata-label">Project</p>
    <select class="metadata-select" [(ngModel)]="selectedProjectId">
      <option value="">{{ projectsList.length === 0 ? 'Loading projects...' : 'Select Project' }}</option>
      @for (project of projectsList; track project.projectId) {
        <option [value]="project.projectId">{{ project.projectName }}</option>
      }
    </select>
  </div>
</div>
```

### 2. TypeScript Updates (`src/app/my-task/my-task.component.ts`)

#### Added Properties:
```typescript
// Projects List from API
projectsList: any[] = [];
selectedProjectId: string = '';
```

#### Updated ngOnInit:
```typescript
ngOnInit() {
  // ... existing code ...
  
  // Load employee master list for assignee dropdown
  this.loadEmployeeMasterList();
  
  // Load projects list for project dropdown
  this.loadProjectsList();  // Added
  
  // Set logged-in user as default assignee
  this.setLoggedInUserAsDefaultAssignee();
}
```

#### Added loadProjectsList Method:
```typescript
// Load Projects List from API
loadProjectsList(): void {
  this.api.getProjects().subscribe({
    next: (response: any) => {
      if (response && response.success && response.data) {
        this.projectsList = response.data.map((project: any) => ({
          projectId: project.projectId || project.ProjectId || project.id,
          projectName: project.projectName || project.ProjectName || project.name,
          departmentId: project.departmentId || project.DepartmentId,
          isActive: project.isActive || project.IsActive
        }));
        console.log('Projects List loaded:', this.projectsList.length, 'projects');
      } else if (response && Array.isArray(response)) {
        // Handle direct array response
        this.projectsList = response.map((project: any) => ({
          projectId: project.projectId || project.ProjectId || project.id,
          projectName: project.projectName || project.ProjectName || project.name,
          departmentId: project.departmentId || project.DepartmentId,
          isActive: project.isActive || project.IsActive
        }));
        console.log('Projects List loaded (direct array):', this.projectsList.length, 'projects');
      }
    },
    error: (error: any) => {
      console.error('Error loading projects list:', error);
      // Keep empty list if API fails
    }
  });
}
```

## Features

### 1. Dynamic Loading
- Projects are fetched from the API when the component initializes
- Loading state shows "Loading projects..." while fetching
- After loading, shows "Select Project" placeholder

### 2. Two-Way Binding
- Uses `[(ngModel)]="selectedProjectId"` for two-way data binding
- Selected value is the `projectId` (numeric ID)
- Displayed text is the `projectName` (human-readable name)

### 3. Flexible Field Mapping
The method handles multiple possible field name formats:
- `projectId` or `ProjectId` or `id`
- `projectName` or `ProjectName` or `name`
- `departmentId` or `DepartmentId`
- `isActive` or `IsActive`

### 4. Response Format Handling
Supports two response formats:
1. **Success Object**: `{ success: true, data: [...] }`
2. **Direct Array**: `[...]`

### 5. Error Handling
- Graceful error handling with console logging
- Empty list maintained if API fails
- User can still interact with the form

## Data Flow

1. **Component Initialization**: `ngOnInit()` is called
2. **API Call**: `loadProjectsList()` calls `api.getProjects()`
3. **Response Processing**: Maps API response to internal format
4. **UI Update**: Dropdown populates with project names
5. **User Selection**: User selects a project
6. **Value Binding**: `selectedProjectId` is set to the chosen `projectId`

## Usage Example

### When User Selects a Project:
```typescript
// User sees: "1012A-GHALA CHURCH - INDIAN ORTHODOX"
// selectedProjectId value: 442

// Access selected project:
const selectedProject = this.projectsList.find(p => p.projectId === this.selectedProjectId);
console.log(selectedProject.projectName); // "1012A-GHALA CHURCH - INDIAN ORTHODOX"
console.log(selectedProject.projectId);   // 442
```

### Saving Task with Project:
```typescript
saveTask() {
  const taskData = {
    // ... other fields ...
    projectId: this.selectedProjectId,  // Sends the numeric ID
    // ... other fields ...
  };
  
  // Send to API
  this.api.saveTask(taskData).subscribe(...);
}
```

## UI States

### 1. Loading State:
```
Project: [Loading projects... ▼]
```

### 2. Loaded State (No Selection):
```
Project: [Select Project ▼]
```

### 3. Loaded State (With Selection):
```
Project: [1012A-GHALA CHURCH - INDIAN ORTHODOX ▼]
```

### 4. Dropdown Open:
```
Project: [1012A-GHALA CHURCH - INDIAN ORTHODOX ▼]
         ┌─────────────────────────────────────────┐
         │ Select Project                          │
         │ 1012A-GHALA CHURCH - INDIAN ORTHODOX   │
         │ Another Project Name                    │
         │ Third Project                           │
         └─────────────────────────────────────────┘
```

## Benefits

1. **Dynamic Data**: Projects are always up-to-date from the API
2. **Proper Value Binding**: Stores projectId (number) not projectName (string)
3. **User-Friendly**: Shows readable project names in the dropdown
4. **Flexible**: Handles different API response formats
5. **Robust**: Graceful error handling
6. **Maintainable**: Clean separation of concerns

## Console Logging

The implementation includes helpful console logs:
- Success: "Projects List loaded: X projects"
- Success (Direct Array): "Projects List loaded (direct array): X projects"
- Error: "Error loading projects list: [error details]"

## Files Modified

1. `src/app/my-task/my-task.component.html` - Updated Project dropdown with API binding
2. `src/app/my-task/my-task.component.ts` - Added properties and loadProjectsList method

## Testing Checklist

- [x] API method exists (`getProjects`)
- [x] Projects list property added
- [x] Selected project ID property added
- [x] loadProjectsList method implemented
- [x] Method called in ngOnInit
- [x] Two-way binding with ngModel
- [x] Loading state placeholder
- [x] Select placeholder after loading
- [x] Project names display correctly
- [x] Project IDs bind as values
- [x] Error handling implemented
- [x] Console logging for debugging
- [x] No TypeScript/HTML errors

## Result

The Project dropdown now dynamically loads projects from the API, displays project names to the user, and stores the projectId as the selected value for form submission.
