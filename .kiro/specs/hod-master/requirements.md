# Requirements Document

## Introduction

The HOD Master feature provides a dedicated screen under the System Master menu for users with the HOD role (`isHOD === 'H'`) to view and manage the list of Heads of Department. The screen supports filtering by name and department, displays results in a table, and allows editing the active status of each HOD record via a modal dialog backed by the `saveHodMaster` API.

---

## Glossary

- **HodMasterComponent**: The Angular standalone component rendered at route `/hod-master` that hosts the filter section, listing table, and edit modal.
- **HOD**: Head of Department — a user whose `isHOD` session flag equals `'H'`.
- **hodList**: The in-memory array of `HodMasterDto` objects currently displayed in the table.
- **Edit Modal**: The overlay dialog that opens when the user clicks the edit icon on a table row.
- **Api_Service**: The Angular `Api` injectable service that communicates with the backend REST API.
- **Layout**: The authenticated shell component (`app-layout`) that renders the sidebar navigation and wraps all protected routes.
- **AuthGuard**: The Angular route guard that redirects unauthenticated users to the login page.
- **Session**: The JSON object stored in `localStorage` under the key `current_user`, containing `empId`, `isHOD`, and other user attributes.

---

## Requirements

### Requirement 1: HOD List Loading and Filtering

**User Story:** As an HOD user, I want to view and filter the list of HODs, so that I can quickly find specific department heads.

#### Acceptance Criteria

1. WHEN the user navigates to `/hod-master`, THE HodMasterComponent SHALL call `getHodMaster` with empty name and department strings and populate `hodList` from the response.
2. WHEN the user enters values in the Name and/or Department filter inputs and clicks the Search button, THE HodMasterComponent SHALL call `getHodMaster` with the provided filter values.
3. WHEN `getHodMaster` returns a list of records, THE HodMasterComponent SHALL render one table row per record displaying the serial number, employee name, employee ID, department, status, and an edit action icon.
4. IF the `getHodMaster` API call fails, THEN THE HodMasterComponent SHALL display an error toast notification and render an empty table with a "No data" message.
5. WHEN the Search button is clicked with empty filter inputs, THE HodMasterComponent SHALL call `getHodMaster` with empty strings to retrieve all records.

---

### Requirement 2: Edit HOD Record

**User Story:** As an HOD user, I want to edit the active status of an HOD record, so that I can enable or disable HODs as needed.

#### Acceptance Criteria

1. WHEN the user clicks the edit icon on a table row, THE HodMasterComponent SHALL set `selectedHod` to the corresponding `HodMasterDto` and open the Edit Modal.
2. WHILE the Edit Modal is open, THE HodMasterComponent SHALL display `employeeName`, `empId`, `department`, and `designation` as read-only fields.
3. WHILE the Edit Modal is open, THE HodMasterComponent SHALL display `isActive` as an editable toggle or select control accepting only `'Y'` or `'N'`.
4. WHEN the user clicks the Save button in the Edit Modal, THE HodMasterComponent SHALL construct a `HodMasterRequestDto` from `selectedHod` and call `saveHodMaster`.
5. WHEN `saveHodMaster` returns a success response, THE HodMasterComponent SHALL display a success toast, close the Edit Modal, and reload the HOD list using the current filter values.
6. IF `saveHodMaster` returns an error response, THEN THE HodMasterComponent SHALL display an error toast and keep the Edit Modal open.
7. WHEN the user clicks the Cancel button or the close icon in the Edit Modal, THE HodMasterComponent SHALL close the modal without calling `saveHodMaster`.

---

### Requirement 3: Data Integrity and Security

**User Story:** As a system administrator, I want HOD Master operations to be secure and data-consistent, so that only authorised users can make changes and audit trails are maintained.

#### Acceptance Criteria

1. THE HodMasterComponent SHALL populate the `createdBy` field of every `HodMasterRequestDto` from `localStorage.current_user.empId`, never from user-supplied input.
2. THE HodMasterComponent SHALL only submit `isActive` values of `'Y'` or `'N'` to `saveHodMaster`.
3. THE Route `/hod-master` SHALL be protected by `AuthGuard` so that unauthenticated users are redirected to the login page.

---

### Requirement 4: Navigation and Role-Based Visibility

**User Story:** As an HOD user, I want the HOD Master option to appear in the sidebar menu, so that I can navigate to it easily.

#### Acceptance Criteria

1. WHEN the authenticated user's `isHOD` session value equals `'H'`, THE Layout SHALL display the HOD Master menu item inside the System Master submenu.
2. WHEN the authenticated user's `isHOD` session value is not `'H'`, THE Layout SHALL not render the HOD Master menu item.
3. WHEN the current route is `/hod-master`, THE Layout SHALL auto-open the System Master submenu so the active item is visible.
4. WHEN the user clicks the HOD Master menu item, THE Layout SHALL navigate to `/hod-master` and close the sidebar on mobile viewports.
