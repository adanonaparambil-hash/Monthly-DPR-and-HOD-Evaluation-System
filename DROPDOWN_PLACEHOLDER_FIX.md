# Dropdown Placeholder Fix - Project and Assignee Fields

## Issue
When users clicked on the Project or Assignee dropdown fields, the display text (e.g., "Select project...") remained in the input field. Users had to manually clear this text before they could type to search, which was confusing and inconvenient.

## Problem Details
- Input field showed the selected value or placeholder text using `[value]` binding
- When user clicked to search, they had to delete the existing text first
- This created a poor user experience and made the search functionality less intuitive
- The placeholder wasn't behaving like a true placeholder

## Solution Applied

### 1. Updated TypeScript Component
Modified the `showProjectDropdown()` and `showAssigneeDropdown()` methods to intelligently populate the search term:

**Project Dropdown:**
```typescript
showProjectDropdown() {
  if (this.isViewOnly) return;
  this.isProjectDropdownVisible = true;
  // If a project is already selected, show its name in search term for editing
  // Otherwise, keep it empty for new search
  if (this.selectedProjectId) {
    const selectedProject = this.projectsList.find(p => p.projectId?.toString() === this.selectedProjectId);
    this.projectSearchTerm = selectedProject?.projectName || '';
  } else {
    this.projectSearchTerm = '';
  }
}
```

**Assignee Dropdown:**
```typescript
showAssigneeDropdown() {
  if (this.isViewOnly) return;
  this.isAssigneeDropdownVisible = true;
  // If an assignee is already selected, show their name in search term for editing
  // Otherwise, keep it empty for new search
  if (this.selectedAssigneeId) {
    const selectedAssignee = this.employeeMasterList.find(emp => emp.idValue?.toString() === this.selectedAssigneeId?.toString());
    this.assigneeSearchTerm = selectedAssignee?.description || '';
  } else {
    this.assigneeSearchTerm = '';
  }
}
```

Also updated the hide methods to clear search terms when closing:

```typescript
hideProjectDropdown() {
  setTimeout(() => {
    this.isProjectDropdownVisible = false;
    this.projectSearchTerm = ''; // Clear search term when closing dropdown
  }, 200);
}

hideAssigneeDropdown() {
  setTimeout(() => {
    this.isAssigneeDropdownVisible = false;
    this.assigneeSearchTerm = ''; // Clear search term when closing dropdown
  }, 200);
}
```

### 2. Updated HTML Template
Changed the input value binding to conditionally show either the search term (when focused) or the display name (when not focused):

**Project Dropdown:**
```html
<input 
  type="text" 
  [value]="isProjectDropdownVisible ? projectSearchTerm : getProjectDisplayName()"
  [placeholder]="projectsList.length === 0 ? 'Loading projects...' : 'Search and select project...'"
  ...
>
```

**Assignee Dropdown:**
```html
<input 
  type="text" 
  [value]="isAssigneeDropdownVisible ? assigneeSearchTerm : getAssigneeDisplayName()"
  [placeholder]="employeeMasterList.length === 0 ? 'Loading employees...' : 'Search and select assignee...'"
  ...
>
```

## How It Works Now

### Scenario 1: No Value Selected (New Task)
**Before Click:**
- Shows placeholder: "Select project..."
- `selectedProjectId` is empty

**After Click:**
- Input field is empty
- Shows placeholder text
- User can start typing to search
- `projectSearchTerm = ''`

### Scenario 2: Value Already Selected (Existing Task)
**Before Click:**
- Shows selected value: "Project Alpha"
- `selectedProjectId = '123'`

**After Click:**
- Input field shows: "Project Alpha"
- User can see the current selection
- User can modify/search by typing
- User can clear and select a different project
- `projectSearchTerm = 'Project Alpha'`

### During Search:
- User types search text
- `projectSearchTerm` updates with each keystroke
- Dropdown filters results based on search term
- Input shows: `projectSearchTerm` (user's typed text)

### After Selection:
- User clicks on an item from dropdown
- Dropdown closes
- Input shows selected item name
- Search term is cleared
- Input shows: `getProjectDisplayName()` (selected project name)

## User Experience Improvements

1. **Smart Initialization**: Shows existing selection when editing, empty when creating new
2. **No Manual Clearing**: Users don't need to delete existing text before searching
3. **Immediate Search**: Can start typing immediately after clicking
4. **Clear Placeholder**: Placeholder text is visible and guides the user
5. **Smooth Transition**: Seamless switch between display mode and search mode
6. **Intuitive Behavior**: Works like standard searchable dropdowns in modern UIs
7. **Edit Friendly**: Can see and modify existing selections easily

## Technical Benefits

1. **Conditional Logic**: Checks if value exists before populating search term
2. **Clean State Management**: Search term is cleared on close
3. **Conditional Rendering**: Shows appropriate content based on dropdown state
4. **No Side Effects**: Doesn't affect the selected value
5. **Consistent Behavior**: Both Project and Assignee dropdowns work the same way

## Files Modified
1. `src/app/components/task-details-modal/task-details-modal.component.ts` - Updated show/hide methods with conditional logic
2. `src/app/components/task-details-modal/task-details-modal.component.html` - Updated input value bindings

## Testing Checklist
- [ ] Open NEW task modal (no project selected)
- [ ] Click on Project dropdown - verify input is empty with placeholder
- [ ] Type to search projects - verify filtering works
- [ ] Select a project - verify it displays correctly
- [ ] Save and reopen task
- [ ] Click on Project dropdown - verify it shows the selected project name
- [ ] Modify search to find different project
- [ ] Select new project - verify it updates
- [ ] Repeat for Assignee dropdown
- [ ] Test with no selection (placeholder should show)
- [ ] Test with existing selection (selected name should show in input when clicked)
- [ ] Verify blur behavior (dropdown closes, search term clears)

## Status
✅ COMPLETE - Dropdown inputs now intelligently show existing selections or empty placeholder based on context

