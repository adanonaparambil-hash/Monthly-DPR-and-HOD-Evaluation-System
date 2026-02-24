# New Task - Status Fixed as "Not Started"

## Issue
When creating a new task (clicking "Assign" from Select Task modal), the task doesn't have a taskId yet, but the status dropdown was still visible and editable. This was incorrect because:
- New tasks should always be "NOT STARTED" by default
- Users should only be able to change status AFTER saving the task
- Showing a dropdown for new tasks was confusing

## Expected Behavior
- For NEW tasks (taskId = 0): Show fixed "Not Started" badge (not editable)
- For EXISTING tasks (taskId > 0): Show status dropdown (editable)
- Task ID badge should only appear for existing tasks

## Solution

### File: `src/app/components/task-details-modal/task-details-modal.component.html`

Updated the header to conditionally show different elements based on whether it's a new or existing task:

```html
<button class="modal-back-button" (click)="close()">
  <i class="fas fa-arrow-left"></i>
</button>

<!-- Only show Task ID badge if taskId exists (not a new task) -->
@if (taskId && taskId > 0) {
  <div class="modal-task-id-badge">TSK-{{ selectedTaskId }}</div>
}

<!-- View-only badge -->
@if (isViewOnly) {
  <div class="view-only-badge">
    <i class="fas fa-eye"></i>
    View Only
  </div>
}

<!-- Only show status dropdown if taskId exists (not a new task) -->
@if (taskId && taskId > 0) {
  <div class="status-dropdown-container">
    <select class="modal-status-select" [(ngModel)]="selectedTaskDetailStatus" [disabled]="isViewOnly || taskId === 0">
      <option value="not-started">Not Started</option>
      <option value="not-closed">Closed</option>
      <option value="running">Running</option>
      <option value="completed">Completed</option>
      <option value="pause">Pause</option>
    </select>
  </div>
} @else {
  <!-- For new tasks, show fixed "Not Started" badge -->
  <div class="status-badge-fixed">
    <i class="fas fa-circle" style="color: #94a3b8; font-size: 8px;"></i>
    Not Started
  </div>
}
```

### File: `src/app/components/task-details-modal/task-details-modal.component.css`

Added styling for the fixed status badge:

```css
/* Fixed status badge for new tasks (not editable) */
.status-badge-fixed {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  border: 2px solid #cbd5e1;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  cursor: default;
  user-select: none;
}

.status-badge-fixed i {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
```

## Changes Made
1. Task ID badge (`TSK-XXX`) only shows for existing tasks (taskId > 0)
2. Status dropdown only shows for existing tasks (taskId > 0)
3. For new tasks (taskId = 0), a fixed "Not Started" badge is displayed
4. The fixed badge has a pulsing dot animation to indicate it's a new task
5. Status cannot be changed until the task is saved

## Result
- New tasks clearly show "Not Started" status as a non-editable badge
- No confusion about task status for new assignments
- Task ID only appears after the task is saved
- Users can change status only after saving the task
- Clean, intuitive UI that guides users through the workflow

## User Experience
- Clear visual distinction between new and existing tasks
- Users understand they need to save first before changing status
- No accidental status changes on new tasks
- Professional, polished appearance with animated badge
