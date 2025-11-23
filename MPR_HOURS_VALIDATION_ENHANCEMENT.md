# MPR Hours Validation Enhancement

## Overview
Enhanced the Monthly Performance Report (MPR) form to prevent users from exceeding their worked hours allocation. Users can only add tasks up to 100% of their worked hours, and cannot save if hours are exceeded.

## Key Features Implemented

### 1. Add Task Validation
Users cannot add new tasks when they've reached 100% of their worked hours allocation.

**Validation Checks:**
- ✅ Checks if Worked Hours is set before allowing task addition
- ✅ Calculates current total actual hours
- ✅ Prevents adding tasks if total hours >= worked hours
- ✅ Shows clear warning message with percentage and hours used
- ✅ Displays remaining hours info when task is successfully added

### 2. Save Draft Validation
Enhanced save draft to include hours validation.

**New Validation:**
- ✅ Checks if total actual hours exceed worked hours
- ✅ Shows detailed warning with exceeded amount and percentage
- ✅ Prevents saving until hours are adjusted

### 3. Visual Hours Tracker
Added a real-time hours tracking indicator in the Task Details section.

**Features:**
- 📊 Shows current hours used vs total worked hours
- 📈 Displays utilization percentage
- 🎨 Color-coded progress bar based on utilization level
- ⚠️ Warning message when hours are exceeded
- ℹ️ Info message showing remaining hours

### 4. Helper Methods
Added utility methods for hours tracking and validation.

## Code Changes

### TypeScript Changes (`monthly-dpr.component.ts`)

#### 1. Enhanced `addNewTask()` Method
```typescript
addNewTask() {
  // Calculate current total actual hours
  const totalActualHours = this.tasks.reduce(
    (sum, task) => sum + (Number(task.actualHours) || 0),
    0
  );

  // Check if worked hours is set
  if (!this.WorkedHours || this.WorkedHours === 0) {
    this.toastr.warning('Please set Worked Hours before adding tasks.', 'Validation Failed');
    return;
  }

  // Check if total hours have reached or exceeded 100% of worked hours
  if (totalActualHours >= this.WorkedHours) {
    const percentage = Math.round((totalActualHours / this.WorkedHours) * 100);
    this.toastr.warning(
      `You have already allocated ${percentage}% (${totalActualHours}/${this.WorkedHours} hours) of your worked hours. Cannot add more tasks.`,
      'Hours Limit Reached'
    );
    return;
  }

  // ... rest of the method
}
```

#### 2. Enhanced `validateActualHours()` Method
```typescript
validateActualHours() {
  const totalActualHours = this.tasks.reduce(
    (sum, task) => sum + (Number(task.actualHours) || 0),
    0
  );

  this.hoursExceeded = totalActualHours > this.WorkedHours;

  if (this.hoursExceeded) {
    const exceededBy = totalActualHours - this.WorkedHours;
    const percentage = Math.round((totalActualHours / this.WorkedHours) * 100);
    this.toastr.warning(
      `Total actual hours (${totalActualHours}) exceed worked hours (${this.WorkedHours}) by ${exceededBy} hours (${percentage}%). Please adjust task hours.`,
      'Hours Exceeded'
    );
  }

  this.calculateOverallRating();
}
```

#### 3. Enhanced `saveDraft()` Method
```typescript
saveDraft() {
  // ... existing validations

  // Check if total actual hours exceed worked hours
  const totalActualHours = this.tasks.reduce((sum, task) => sum + (Number(task.actualHours) || 0), 0);
  
  if (totalActualHours > this.WorkedHours) {
    const exceededBy = totalActualHours - this.WorkedHours;
    const percentage = Math.round((totalActualHours / this.WorkedHours) * 100);
    this.toastr.warning(
      `Cannot save: Total actual hours (${totalActualHours}) exceed worked hours (${this.WorkedHours}) by ${exceededBy} hours (${percentage}%). Please adjust task hours.`,
      'Hours Exceeded'
    );
    return;
  }

  this.ApprovalStatus = 'D';
  this.saveEmployeeDetails();
}
```

#### 4. New Helper Methods
```typescript
// Get total actual hours
getTotalActualHours(): number {
  return this.tasks.reduce(
    (sum, task) => sum + (Number(task.actualHours) || 0),
    0
  );
}

// Get remaining hours
getRemainingHours(): number {
  const totalActualHours = this.getTotalActualHours();
  return Math.max(0, this.WorkedHours - totalActualHours);
}

// Get hours utilization percentage
getHoursUtilizationPercentage(): number {
  if (!this.WorkedHours || this.WorkedHours === 0) return 0;
  const totalActualHours = this.getTotalActualHours();
  return Math.round((totalActualHours / this.WorkedHours) * 100);
}

// Check if can add more tasks based on hours
canAddMoreTasksBasedOnHours(): boolean {
  const totalActualHours = this.getTotalActualHours();
  return totalActualHours < this.WorkedHours;
}

// Get hours status class for styling
getHoursStatusClass(): string {
  const percentage = this.getHoursUtilizationPercentage();
  if (percentage > 100) return 'hours-exceeded';
  if (percentage === 100) return 'hours-full';
  if (percentage >= 80) return 'hours-high';
  if (percentage >= 50) return 'hours-medium';
  return 'hours-low';
}
```

### HTML Changes (`monthly-dpr.component.html`)

Added hours tracker indicator in Task Details section:

```html
@if (showTaskDetails) {
  <div class="task-content" [@fadeInUp]>
    <!-- Hours Tracking Indicator -->
    @if (WorkedHours > 0) {
      <div class="hours-tracker" [class]="getHoursStatusClass()">
        <div class="hours-info">
          <div class="hours-label">
            <i class="fas fa-clock"></i>
            <span>Hours Utilization</span>
          </div>
          <div class="hours-stats">
            <span class="hours-used">{{ getTotalActualHours() }} / {{ WorkedHours }} hours</span>
            <span class="hours-percentage" [class.exceeded]="hoursExceeded">{{ getHoursUtilizationPercentage() }}%</span>
          </div>
        </div>
        <div class="hours-progress-bar">
          <div class="hours-progress-fill" [style.width.%]="getHoursUtilizationPercentage()"></div>
        </div>
        @if (getRemainingHours() > 0) {
          <div class="hours-remaining">
            <i class="fas fa-info-circle"></i>
            <span>{{ getRemainingHours() }} hours remaining</span>
          </div>
        }
        @if (hoursExceeded) {
          <div class="hours-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <span>Hours exceeded by {{ getTotalActualHours() - WorkedHours }} hours. Please adjust task hours.</span>
          </div>
        }
      </div>
    }
    <!-- Rest of task table -->
  </div>
}
```

### CSS Changes (`monthly-dpr.component.css`)

Added comprehensive styling for the hours tracker with:
- Color-coded states (low, medium, high, full, exceeded)
- Animated progress bar
- Warning animations for exceeded state
- Dark mode support
- Responsive design

**Color Coding:**
- 🟢 **Green (0-49%)**: Low utilization - hours-low
- 🔵 **Blue (50-79%)**: Medium utilization - hours-medium
- 🟡 **Yellow (80-99%)**: High utilization - hours-high
- 🟠 **Orange (100%)**: Full utilization - hours-full
- 🔴 **Red (>100%)**: Exceeded - hours-exceeded with pulse animation

## User Experience Flow

### Scenario 1: Adding Tasks Within Limit
1. User has 160 worked hours
2. User adds tasks totaling 120 hours (75%)
3. ✅ Hours tracker shows: "120 / 160 hours (75%)" in blue
4. ✅ Info message: "40 hours remaining"
5. ✅ User can add more tasks

### Scenario 2: Reaching 100% Limit
1. User has 160 worked hours
2. User adds tasks totaling 160 hours (100%)
3. 🟠 Hours tracker shows: "160 / 160 hours (100%)" in orange
4. ⚠️ "Add New Task" button is blocked
5. ⚠️ Warning: "You have already allocated 100% of your worked hours. Cannot add more tasks."

### Scenario 3: Exceeding Hours (Manual Entry)
1. User has 160 worked hours
2. User manually enters task hours totaling 180 hours
3. 🔴 Hours tracker shows: "180 / 160 hours (113%)" in red with pulse animation
4. ⚠️ Warning: "Hours exceeded by 20 hours. Please adjust task hours."
5. ❌ Cannot save draft or submit until adjusted

### Scenario 4: Attempting to Save with Exceeded Hours
1. User tries to save with 180/160 hours
2. ❌ Validation blocks save
3. ⚠️ Warning: "Cannot save: Total actual hours (180) exceed worked hours (160) by 20 hours (113%). Please adjust task hours."

## Validation Messages

### Add Task Blocked
```
Title: Hours Limit Reached
Message: You have already allocated X% (Y/Z hours) of your worked hours. Cannot add more tasks.
```

### Hours Exceeded Warning
```
Title: Hours Exceeded
Message: Total actual hours (X) exceed worked hours (Y) by Z hours (P%). Please adjust task hours.
```

### Save Blocked
```
Title: Hours Exceeded
Message: Cannot save: Total actual hours (X) exceed worked hours (Y) by Z hours (P%). Please adjust task hours.
```

### Task Added Successfully
```
Title: Task Added
Message: You have X hours remaining out of Y worked hours.
```

## Benefits

1. **Prevents Over-allocation**: Users cannot allocate more hours than they worked
2. **Real-time Feedback**: Visual indicator shows current utilization status
3. **Clear Warnings**: Detailed messages explain exactly what's wrong
4. **Better Planning**: Users can see remaining hours before adding tasks
5. **Data Integrity**: Ensures accurate time tracking and reporting
6. **User-Friendly**: Color-coded visual feedback is intuitive
7. **Responsive**: Works seamlessly on all screen sizes

## Technical Details

### Files Modified
- `src/app/monthly-dpr.component/monthly-dpr.component.ts`
- `src/app/monthly-dpr.component/monthly-dpr.component.html`
- `src/app/monthly-dpr.component/monthly-dpr.component.css`

### Dependencies
- No new dependencies required
- Uses existing Toastr for notifications
- Uses Font Awesome icons (already in project)

### Performance
- Calculations are lightweight (simple array reduce operations)
- Real-time updates on every hour change
- No API calls for validation (client-side only)

## Testing Recommendations

### Test Cases

1. **Add Task with No Worked Hours**
   - ✅ Should show warning: "Please set Worked Hours before adding tasks"

2. **Add Task at 0% Utilization**
   - ✅ Should add task successfully
   - ✅ Should show remaining hours

3. **Add Task at 50% Utilization**
   - ✅ Should add task successfully
   - ✅ Hours tracker should be blue

4. **Add Task at 80% Utilization**
   - ✅ Should add task successfully
   - ✅ Hours tracker should be yellow

5. **Add Task at 100% Utilization**
   - ❌ Should block task addition
   - ⚠️ Should show "Hours Limit Reached" warning

6. **Manually Enter Hours Exceeding Limit**
   - ⚠️ Should show red warning in hours tracker
   - ⚠️ Should show exceeded message
   - ❌ Should block save/submit

7. **Adjust Hours Back to Valid Range**
   - ✅ Warning should disappear
   - ✅ Should allow save/submit

8. **Delete Task**
   - ✅ Hours tracker should update immediately
   - ✅ Should recalculate remaining hours

9. **Save Draft with Exceeded Hours**
   - ❌ Should block save
   - ⚠️ Should show detailed warning

10. **Submit with Exceeded Hours**
    - ❌ Should block submit
    - ⚠️ Should show detailed warning

## Notes

- Validation is client-side (server-side validation should also exist)
- Hours tracker only shows when WorkedHours > 0
- Progress bar width is capped at 100% visually (but percentage can show >100%)
- All animations are smooth and non-intrusive
- Dark mode fully supported
- Mobile responsive design included

## Future Enhancements (Optional)

1. Add sound notification when hours exceed limit
2. Add confirmation dialog when approaching 100%
3. Add ability to set custom hour limits per task
4. Add historical hours tracking chart
5. Add export functionality for hours report
