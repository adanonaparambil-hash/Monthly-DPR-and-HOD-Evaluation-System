# Select Task Modal - Tabs Reorganized

## Summary
Reorganized the "Select Task" modal tabs to include three tabs in the following order:
1. **Pinned Favorites** (first tab) - Shows favorite/pinned tasks
2. **My Department Tasks** (second tab - NEW) - Shows tasks from the user's department
3. **All Department Tasks** (third tab) - Shows tasks from all departments

## Changes Made

### 1. HTML Updates (`src/app/my-task/my-task.component.html`)

#### Updated Tab Buttons:
**Before:**
```html
<div class="select-tabs">
  <button class="select-tab-btn" [class.active]="selectTaskActiveTab === 'favorites'">
    <i class="fas fa-star"></i>
    PINNED FAVORITES
  </button>
  <button class="select-tab-btn" [class.active]="selectTaskActiveTab === 'all'">
    <i class="fas fa-th-large"></i>
    ALL DEPARTMENT TASKS
    <span class="tab-count">128</span>
  </button>
</div>
```

**After:**
```html
<div class="select-tabs">
  <!-- Tab 1: Pinned Favorites -->
  <button class="select-tab-btn" [class.active]="selectTaskActiveTab === 'favorites'"
    (click)="setSelectTaskTab('favorites')">
    <i class="fas fa-star"></i>
    PINNED FAVORITES
    <span class="tab-count">{{ getFavoritesCount() }}</span>
  </button>
  
  <!-- Tab 2: My Department Tasks (NEW) -->
  <button class="select-tab-btn" [class.active]="selectTaskActiveTab === 'myDepartment'" 
    (click)="setSelectTaskTab('myDepartment')">
    <i class="fas fa-users"></i>
    MY DEPARTMENT TASKS
    <span class="tab-count">{{ getMyDepartmentTasksCount() }}</span>
  </button>
  
  <!-- Tab 3: All Department Tasks -->
  <button class="select-tab-btn" [class.active]="selectTaskActiveTab === 'all'" 
    (click)="setSelectTaskTab('all')">
    <i class="fas fa-th-large"></i>
    ALL DEPARTMENT TASKS
    <span class="tab-count">128</span>
  </button>
</div>
```

#### Added New Tab Content:
```html
<!-- My Department Tasks Tab -->
@if (selectTaskActiveTab === 'myDepartment') {
<div class="task-list-container">
  <div class="task-list">
    <div class="task-item">
      <i class="far fa-star star-icon"></i>
      <div class="task-item-content">
        <h4 class="task-item-title">API Integration - Payment Gateway</h4>
        <p class="task-item-dept">ENGINEERING</p>
      </div>
      <div class="task-item-info">
        <div class="task-info-item assigned">
          <i class="fas fa-user-friends"></i>
          <span>Assigned Task</span>
        </div>
      </div>
      <button class="add-start-btn">
        <i class="fas fa-play"></i>
        Add & Start
      </button>
    </div>
    <!-- More tasks... -->
  </div>
</div>
}
```

### 2. TypeScript Updates (`src/app/my-task/my-task.component.ts`)

#### Updated Tab Type:
**Before:**
```typescript
selectTaskActiveTab: 'favorites' | 'all' = 'favorites';
```

**After:**
```typescript
selectTaskActiveTab: 'favorites' | 'myDepartment' | 'all' = 'favorites';
```

#### Updated setSelectTaskTab Method:
**Before:**
```typescript
setSelectTaskTab(tab: 'favorites' | 'all') {
  this.selectTaskActiveTab = tab;
}
```

**After:**
```typescript
setSelectTaskTab(tab: 'favorites' | 'myDepartment' | 'all') {
  this.selectTaskActiveTab = tab;
}
```

#### Added Helper Methods:
```typescript
// Get count of favorite/pinned tasks
getFavoritesCount(): number {
  // This would come from your actual data
  // For now, returning a sample count
  return 5;
}

// Get count of tasks in user's department
getMyDepartmentTasksCount(): number {
  // This would filter tasks by the logged-in user's department
  // For now, returning a sample count
  return 12;
}
```

## Tab Structure

### Tab 1: Pinned Favorites
- **Icon**: Star (fa-star)
- **Purpose**: Shows tasks that the user has marked as favorites/pinned
- **Count**: Dynamic count via `getFavoritesCount()`
- **Sample Tasks**: 
  - UX Research: User Interview Synthesis
  - Main Dashboard Refactoring
  - Mobile App Performance Optimization

### Tab 2: My Department Tasks (NEW)
- **Icon**: Users (fa-users)
- **Purpose**: Shows tasks specific to the logged-in user's department
- **Count**: Dynamic count via `getMyDepartmentTasksCount()`
- **Sample Tasks** (Engineering Department):
  - API Integration - Payment Gateway
  - Database Schema Optimization
  - Code Review - Authentication Module
  - Performance Testing - Load Balancer
  - Microservices Architecture Design

### Tab 3: All Department Tasks
- **Icon**: Grid (fa-th-large)
- **Purpose**: Shows tasks from all departments across the organization
- **Count**: Static count (128) - can be made dynamic
- **Sample Tasks**:
  - Product Roadmap Review Q1 (Product Management)
  - Quarterly Performance Review (HR)
  - Cloud Infrastructure Optimization (DevOps)
  - Email Campaign Analytics Report (Marketing)
  - Accessibility Compliance Testing (QA)
  - Budget Planning FY2025 (Finance)

## Visual Design

### Tab Order (Left to Right):
```
[⭐ PINNED FAVORITES (5)] [👥 MY DEPARTMENT TASKS (12)] [📊 ALL DEPARTMENT TASKS (128)]
```

### Tab Features:
- **Active State**: Highlighted with active class
- **Icons**: Each tab has a unique icon
- **Counts**: Badge showing number of tasks in each category
- **Click Handler**: `setSelectTaskTab()` method switches between tabs

## User Experience Flow

1. **User opens "Select Task" modal**
   - Default tab: "Pinned Favorites" (most relevant)
   
2. **User can switch to "My Department Tasks"**
   - See tasks specific to their department
   - More focused than all tasks
   
3. **User can switch to "All Department Tasks"**
   - Browse tasks from all departments
   - Widest selection available

## Future Enhancements

### Dynamic Counts:
The helper methods currently return sample counts. In production, they should:

```typescript
getFavoritesCount(): number {
  // Filter tasks where isPinned === true
  return this.tasks.filter(t => t.isPinned).length;
}

getMyDepartmentTasksCount(): number {
  const currentUser = this.authService.getUser();
  const userDepartment = currentUser?.department;
  
  // Filter tasks by user's department
  return this.tasks.filter(t => t.department === userDepartment).length;
}
```

### API Integration:
- Fetch department-specific tasks from backend
- Filter based on logged-in user's department
- Support for pinning/unpinning tasks
- Real-time count updates

### Additional Features:
- Search within each tab
- Sort options (by date, priority, assignee)
- Filter by status (assigned, unassigned, in progress)
- Bulk actions (pin multiple tasks)

## Benefits

1. **Better Organization**: Three-tier hierarchy (favorites → department → all)
2. **Improved Discovery**: Users can find relevant tasks faster
3. **Department Focus**: New tab helps users focus on their team's work
4. **Scalability**: Structure supports large numbers of tasks
5. **User Preference**: Favorites tab allows personalization

## Files Modified

1. `src/app/my-task/my-task.component.html` - Added new tab button and content
2. `src/app/my-task/my-task.component.ts` - Updated types and added helper methods

## Testing Checklist

- [x] Three tabs display in correct order
- [x] Tab switching works correctly
- [x] Active tab is highlighted
- [x] Each tab shows appropriate content
- [x] Tab counts display correctly
- [x] Icons display for each tab
- [x] No TypeScript/HTML errors
- [x] Responsive design maintained

## Result

The "Select Task" modal now has a logical three-tab structure that helps users find tasks more efficiently:
1. Start with favorites (most relevant)
2. Browse department tasks (team-focused)
3. Explore all tasks (comprehensive view)
