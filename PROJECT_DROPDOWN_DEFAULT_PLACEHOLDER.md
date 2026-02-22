# Project Dropdown - Default "Select Project" Placeholder

## Issue
The project dropdown in the task details modal was showing an empty value when no project was selected, making it unclear to users that they need to select a project.

## Solution
Updated the `getProjectDisplayName()` method to show "Select project..." as the default placeholder text when no project is selected, matching the behavior of the assignee dropdown.

## Changes Made

### Before
```typescript
getProjectDisplayName(): string {
  const project = this.projectsList.find(p => p.projectId?.toString() === this.selectedProjectId);
  return project?.projectName || '';
}
```

**Problem:** Returned empty string when no project was selected, leaving the dropdown looking empty.

### After
```typescript
getProjectDisplayName(): string {
  if (!this.selectedProjectId) {
    return 'Select project...';
  }
  const project = this.projectsList.find(p => p.projectId?.toString() === this.selectedProjectId);
  return project?.projectName || 'Select project...';
}
```

**Improvement:** 
- Shows "Select project..." when `selectedProjectId` is empty/null
- Shows "Select project..." as fallback if project is not found in the list
- Provides clear guidance to users about what action to take

## Behavior

### Initial State (No Project Selected)
- Display: "Select project..."
- User sees clear placeholder text
- Indicates that a project needs to be selected

### After Selection
- Display: Selected project name (e.g., "Website Redesign")
- Shows the actual project name
- User knows which project is currently selected

### If Project Not Found
- Display: "Select project..."
- Fallback for edge cases where projectId exists but project is not in the list

## Consistency

This change makes the project dropdown consistent with the assignee dropdown:

```typescript
getAssigneeDisplayName(): string {
  if (!this.selectedAssigneeId) {
    return 'Select assignee...';
  }
  const selected = this.employeeMasterList.find(emp => emp.idValue?.toString() === this.selectedAssigneeId?.toString());
  return selected ? selected.description : 'Select assignee...';
}
```

Both dropdowns now follow the same pattern:
1. Check if value is selected
2. If not, show "Select..." placeholder
3. If yes, find and display the selected item
4. Fallback to "Select..." if item not found

## User Experience

### Before:
```
┌─────────────────────────┐
│ Project                 │
│ ┌─────────────────────┐ │
│ │                     │ │  ← Empty, unclear
│ └─────────────────────┘ │
└─────────────────────────┘
```

### After:
```
┌─────────────────────────┐
│ Project                 │
│ ┌─────────────────────┐ │
│ │ Select project...   │ │  ← Clear placeholder
│ └─────────────────────┘ │
└─────────────────────────┘
```

### After Selection:
```
┌─────────────────────────┐
│ Project                 │
│ ┌─────────────────────┐ │
│ │ Website Redesign    │ │  ← Selected project
│ └─────────────────────┘ │
└─────────────────────────┘
```

## Benefits

- **Clear guidance**: Users immediately understand they need to select a project
- **Consistent UX**: Matches the assignee dropdown behavior
- **Professional appearance**: No empty/blank fields
- **Better accessibility**: Screen readers can announce the placeholder text
- **Reduced confusion**: Users know what action to take

## Files Modified

- `src/app/components/task-details-modal/task-details-modal.component.ts`

## Testing

Test by:
1. Open task details modal for a new task (no project selected)
2. Verify the project dropdown shows "Select project..."
3. Click on the project dropdown
4. Select a project from the list
5. Verify the selected project name is displayed
6. Clear the selection (if applicable)
7. Verify it returns to "Select project..."
8. Open an existing task with a project already assigned
9. Verify the project name is displayed correctly

## Status
✅ Complete - No TypeScript errors
