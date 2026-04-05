# Implementation Plan: HOD Master

## Overview

Implement the HOD Master screen as a standalone Angular component at `/hod-master`. The feature includes a filter section, a listing table, and an edit modal backed by existing API methods. Route registration, sidebar menu integration, and toast notifications are also part of this plan.

## Tasks

- [x] 1. Verify existing models and API methods
  - Confirm `HodMasterDto` and `HodMasterRequestDto` exist in `src/app/models/common.model.ts`
  - Confirm `getHodMaster()` and `saveHodMaster()` exist in `src/app/services/api.ts`
  - No code changes expected; this is a read-only verification step
  - _Requirements: 1.1, 2.4, 3.1_

- [x] 2. Create HodMasterComponent scaffold
  - [x] 2.1 Create component files at `src/app/hod-master/`
    - Create `hod-master.component.ts` as a standalone Angular component
    - Declare class properties: `hodList`, `filterName`, `filterDepartment`, `isLoading`, `showEditModal`, `selectedHod`, `isSaving`
    - Inject `Api` service and `ToastrService`
    - Implement `ngOnInit()` to call `loadHodList()`
    - Implement `loadHodList()` calling `api.getHodMaster(filterName, filterDepartment)`
    - Implement `onSearch()`, `openEditModal(hod)`, `closeEditModal()`, `onSave()`
    - In `onSave()`, build `HodMasterRequestDto` from `selectedHod`; set `createdBy` from `localStorage.current_user.empId`
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2_

  - [ ]* 2.2 Write property test for filter forwarding (Property 1)
    - **Property 1: Filter parameters are forwarded to the API**
    - **Validates: Requirements 1.1, 1.2, 1.5**
    - Generate random name/department string pairs; spy on `api.getHodMaster`; call `onSearch()`; assert spy was called with exact strings

  - [ ]* 2.3 Write property test for edit modal state (Property 3)
    - **Property 3: Edit modal opens with matching HOD data**
    - **Validates: Requirements 2.1**
    - Generate random `HodMasterDto` objects; call `openEditModal(hod)`; assert `selectedHod === hod` and `showEditModal === true`

  - [ ]* 2.4 Write property test for save request mapping (Property 4)
    - **Property 4: Save request maps selectedHod fields correctly**
    - **Validates: Requirements 2.4**
    - Generate random `HodMasterDto`; set as `selectedHod`; spy on `api.saveHodMaster`; call `onSave()`; assert payload fields match

  - [ ]* 2.5 Write property test for createdBy sourced from session (Property 5)
    - **Property 5: createdBy is always sourced from the session**
    - **Validates: Requirements 3.1**
    - Generate random `empId` values in `localStorage.current_user`; call `onSave()`; assert `createdBy` equals session `empId`

  - [ ]* 2.6 Write property test for isActive values (Property 6)
    - **Property 6: isActive is always 'Y' or 'N'**
    - **Validates: Requirements 3.2**
    - Set `selectedHod.isActive` to `'Y'` and `'N'`; call `onSave()`; assert submitted `isActive` is one of those two values only

- [x] 3. Build component template and styles
  - [x] 3.1 Create `hod-master.component.html`
    - Filter section: Name text input bound to `filterName`, Department text input bound to `filterDepartment`, Search button calling `onSearch()`
    - HOD listing table with columns: `#`, Employee Name, Emp ID, Department, Status (Active/Inactive badge), Actions (edit icon)
    - Loading spinner shown while `isLoading` is true
    - "No data" row shown when `hodList` is empty and not loading
    - Edit modal overlay: read-only fields for `employeeName`, `empId`, `department`, `designation`; editable `isActive` select (`Y`/`N`); Cancel and Save buttons
    - _Requirements: 1.3, 1.4, 2.2, 2.3, 2.7_

  - [ ]* 3.2 Write property test for table row count (Property 2)
    - **Property 2: Table row count matches API response**
    - **Validates: Requirements 1.3**
    - Provide mock `HodMasterDto` arrays of varying lengths; trigger change detection; assert rendered `<tr>` count equals array length

  - [x] 3.3 Create `hod-master.component.css`
    - Style filter card, table, status badges (Active = green, Inactive = red), edit icon button, modal overlay, and modal card
    - Reuse existing CSS variables (`--primary-green`, `--primary-dark`, `--card-bg`, etc.)
    - Ensure mobile-responsive layout for filter inputs and table
    - _Requirements: 1.3, 2.2_

- [x] 4. Register route and wire navigation
  - [x] 4.1 Add route in `src/app/app.routes.ts`
    - Import `HodMasterComponent`
    - Add `{ path: 'hod-master', component: HodMasterComponent }` inside the authenticated layout children array
    - _Requirements: 3.3_

  - [x] 4.2 Add HOD Master menu item in `src/app/layout/layout.html`
    - Inside the System Master submenu `<div class="submenu">`, add a new `<a>` with `*ngIf="isHod"`, `routerLink="/hod-master"`, `routerLinkActive="active"`, and `(click)="closeSidebarOnMobile()"`
    - Use icon `fas fa-user-tie` and label `HOD Master`
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 4.3 Update `isSystemMasterRouteActive()` in `src/app/layout/layout.ts`
    - Extend the method to also return `true` when `currentRoute` includes `/hod-master`
    - This ensures the System Master submenu auto-opens when navigating to `/hod-master`
    - _Requirements: 4.3_

  - [ ]* 4.4 Write property test for menu item visibility (Property 7)
    - **Property 7: HOD Master menu item visibility matches role**
    - **Validates: Requirements 4.1, 4.2**
    - For each `isHOD` value (`'H'`, `'E'`, `'C'`, `''`); assert menu item is rendered only when value is `'H'`

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integration and final wiring
  - [x] 6.1 Add `getPageTitle()` entry for `/hod-master` in `layout.ts`
    - Add `'/hod-master': 'HOD Master'` to the `routeTitles` map so the header shows the correct page title
    - _Requirements: 4.3_

  - [ ]* 6.2 Write integration tests for filter → API → table flow
    - Mock `api.getHodMaster`; set filter values; call `onSearch()`; assert table rows reflect mock response
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [ ]* 6.3 Write integration tests for edit → save → reload flow
    - Mock `api.saveHodMaster` returning success; open modal; call `onSave()`; assert modal closes and `loadHodList` is called again
    - _Requirements: 2.5, 2.6_

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- `HodMasterDto`, `HodMasterRequestDto`, `getHodMaster()`, and `saveHodMaster()` already exist — no model or API changes needed
- The route is protected by `AuthGuard` via the parent layout route (no extra guard needed)
- `createdBy` must always come from `localStorage.current_user.empId`, never from user input
- Property tests use jasmine/karma (existing Angular test setup)
