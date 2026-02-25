# Add AUTO CLOSED Status to Dropdown

## Issue
The status dropdown in the task details modal was missing the "AUTO CLOSED" option. Tasks with AUTO CLOSED status couldn't be properly displayed or selected in the modal.

## Expected Behavior
- Status dropdown should include "AUTO CLOSED" as an option
- AUTO CLOSED status should be properly mapped between API and component formats
- Users should be able to see and select AUTO CLOSED status

## Solution

### File: `src/app/components/task-details-modal/task-details-modal.component.html`

Added "AUTO CLOSED" option to the status dropdown:

```html
<select class="modal-status-select" [(ngModel)]="selectedTaskDetailStatus" (ngModelChange)="onStatusChange($event)" [disabled]="isViewOnly || taskId === 0">
  <option value="not-started">Not Started</option>
  <option value="not-closed">Closed</option>
  <option value="running">Running</option>
  <option value="completed">Completed</option>
  <option value="pause">Pause</option>
  <option value="auto-closed">Auto Closed</option>
</select>
```

### File: `src/app/components/task-details-modal/task-details-modal.component.ts`

Updated status mappings to include AUTO CLOSED:

**Component to API mapping (for saving):**
```typescript
const statusMap: { [key: string]: string } = {
  'not-started': 'NOT STARTED',
  'running': 'RUNNING',
  'pause': 'PAUSED',
  'paused': 'PAUSED',
  'completed': 'COMPLETED',
  'not-closed': 'CLOSED',
  'auto-closed': 'AUTO CLOSED'  // Added
};
```

**API to Component mapping (for loading):**
```typescript
mapTaskStatus(status: string): string {
  const statusMap: { [key: string]: string } = {
    'NOT STARTED': 'not-started',
    'RUNNING': 'running',
    'PAUSED': 'pause',
    'COMPLETED': 'completed',
    'CLOSED': 'not-closed',
    'AUTO CLOSED': 'auto-closed'  // Added
  };
  return statusMap[status] || 'not-started';
}
```

## Status Mapping Table

| Display Text | Component Value | API Value |
|--------------|----------------|-----------|
| Not Started | not-started | NOT STARTED |
| Closed | not-closed | CLOSED |
| Running | running | RUNNING |
| Completed | completed | COMPLETED |
| Pause | pause | PAUSED |
| Auto Closed | auto-closed | AUTO CLOSED |

## Changes Made
1. Added `<option value="auto-closed">Auto Closed</option>` to the status dropdown
2. Added `'auto-closed': 'AUTO CLOSED'` to the component-to-API status mapping
3. Added `'AUTO CLOSED': 'auto-closed'` to the API-to-component status mapping

## Result
- AUTO CLOSED status now appears in the dropdown
- Tasks with AUTO CLOSED status display correctly
- Users can select AUTO CLOSED status if needed
- Proper bidirectional mapping between component and API formats
- Consistent with other status options

## User Experience
- Complete status options available in dropdown
- AUTO CLOSED tasks display with correct status
- Status selection works seamlessly
- Consistent status handling across the application
