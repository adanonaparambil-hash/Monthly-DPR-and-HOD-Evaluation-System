# Status-Based Access Control Implementation for Monthly DPR

## Overview
This document outlines the implementation of status-based access control for the Monthly DPR component based on user roles (Employee, HOD, CED) and DPR status (D, R, S, A).

## Status Definitions
- **D (Draft)**: Employee can edit all fields without restrictions
- **R (Rework)**: Employee can see comment history and make changes like Draft status
- **S (Submitted)**: Employee can view but not edit; HOD can edit evaluation section
- **A (Approved)**: All fields are non-editable for viewing purposes only

## Role-Based Behavior Implementation

### Employee Behavior
#### Status 'D' (Draft)
- ✅ Can edit all fields without restrictions
- ✅ SAVE DRAFT and SUBMIT buttons visible
- ✅ ADD KPI, ADD TASK, and action buttons visible
- ✅ Normal flow with all functionality

#### Status 'R' (Rework)
- ✅ Can see Remarks History
- ✅ Can make changes like Draft status
- ✅ Same flow as Status 'D'

#### Status 'S' (Submitted)
- ✅ Can view but not edit any fields
- ✅ SAVE DRAFT and SUBMIT buttons hidden
- ✅ All table action columns hidden
- ✅ Read-only mode for all employee fields

#### Status 'A' (Approved)
- ✅ All fields are non-editable
- ✅ All buttons hidden
- ✅ View-only mode like Status 'S'

### HOD (Head of Department) Behavior
#### Status 'S' (Submitted)
- ✅ Can only edit HOD Evaluation section (Quality, Timeliness, Initiative, Overall Score)
- ✅ Can edit Management Remarks
- ✅ All other fields are view-only
- ✅ REWORK and APPROVE buttons visible
- ✅ Employee fields are disabled

#### Status 'A' (Approved) or 'R' (Rework)
- ✅ Can only view content
- ✅ No sections or buttons are editable
- ✅ All fields disabled

### CED Behavior
#### All Statuses
- ✅ All fields disabled in all statuses
- ✅ Management Remarks section hidden
- ✅ HOD Evaluation and Remarks History visible
- ✅ All table action columns hidden
- ✅ All buttons hidden (SAVE DRAFT, SUBMIT, REWORK, APPROVE, ADD KPI, etc.)
- ✅ View-only mode for everything

## Implementation Details

### New Getter Methods Added
```typescript
// Field editability for different roles and statuses
get canEditFields(): boolean {
  if (this.isCed) return false; // CED can never edit anything
  if (this.isEmployee) return this.currentStatus === 'D' || this.currentStatus === 'R';
  if (this.isHod) return false; // HOD can only edit evaluation fields, not employee fields
  return false;
}

// HOD Evaluation section visibility
get showHodEvaluationSection(): boolean {
  if (this.isEmployee) return false; // Employee never sees HOD evaluation
  return this.isHod || this.isCed; // HOD and CED can see it
}

// Management Remarks section visibility
get showManagementRemarksSection(): boolean {
  if (this.isEmployee) return false; // Employee never sees management remarks
  if (this.isCed) return false; // CED should not see management remarks
  return this.isHod; // Only HOD can see management remarks
}

// Remarks History section visibility
get showRemarksHistorySection(): boolean {
  return this.canViewRemarksHistory;
}
```

### Updated Access Control Logic
- **Management Remarks**: Now properly hidden for CED users
- **Remarks History**: Visible for CED and HOD always, for Employee only during rework status
- **Table Actions**: Hidden for CED, visible for Employee only in Draft/Rework status
- **Button Visibility**: Properly controlled based on role and status combinations

### HTML Template Updates
- All form fields now use `[disabled]="!canEditFields"` for consistent access control
- Section visibility controlled by new getter methods
- Table action columns conditionally shown/hidden
- Button visibility properly managed for each role and status combination

## Status Flow Integration
The component reads the status from `res.data.status` in the `GetDPREmployeeReviewDetails()` method and sets `this.currentStatus`, which drives all the access control logic through the getter methods.

## Testing Scenarios
1. **Employee with Draft status**: Full edit access, all buttons visible
2. **Employee with Rework status**: Full edit access + remarks history visible
3. **Employee with Submitted status**: Read-only mode, no buttons
4. **Employee with Approved status**: Read-only mode, no buttons
5. **HOD with Submitted status**: Can edit evaluation and remarks only
6. **HOD with other statuses**: Read-only mode
7. **CED with any status**: Complete read-only mode, management remarks hidden

## Key Features
- ✅ Dynamic field enabling/disabling based on role and status
- ✅ Conditional section visibility
- ✅ Proper button management
- ✅ Table action column visibility control
- ✅ Remarks history access control
- ✅ Management remarks visibility for appropriate roles only