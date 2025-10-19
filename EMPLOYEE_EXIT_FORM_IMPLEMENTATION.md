# Employee Exit Form Implementation

## Overview
This implementation extends the existing Emergency Exit Form to support both Emergency Exit and Employee Exit (Planned Leave) modes using a flag-based approach.

## Features Implemented

### 🔄 Dual Mode Support
- **Emergency Exit Form** (`formType = 'E'`)
- **Employee Exit Form - Planned Leave** (`formType = 'P'`)

### 📋 Form Type Differences

#### Emergency Exit Form (E)
- 4 Steps: Employee Info → Responsibility Handover → Department Approvals → Final Review
- Shows Contact Details section
- Uses "Emergency Details" section
- Requires detailed responsibility handover in Step 2

#### Employee Exit Form - Planned Leave (P)
- 3 Steps: Employee Info → Department Approvals → Final Review (Step 2 is skipped)
- Hides Contact Details section
- Shows "Leave Details" section instead of "Emergency Details"
- Includes Category selection (Staff/Worker)
- Includes "Responsibilities Handed Over To" text field
- Includes Project Manager/Site Incharge selection and approval

### 🆕 New Fields for Planned Leave

1. **Category Selection** (Radio buttons)
   - Staff
   - Worker

2. **Responsibilities Handed Over To** (Text input)
   - Simple text field for entering the person's name

3. **Project Manager/Site Incharge Selection** (Dropdown)
   - Populated from API: `GetProjectManagerList()`
   - Required field for planned leave

4. **Project Manager Approval Card**
   - Appears before HOD approval in Step 3 (displayed as Step 2)
   - Includes remarks and days allowed fields
   - Approve/Reject buttons

### 🔧 Technical Implementation

#### Component Structure
```typescript
// Form type flag
@Input() formType: 'E' | 'P' = 'E';

// New properties
projectManagerList: DropdownOption[] = [];
pmRemarks: string = '';
pmDaysAllowed: number = 0;
```

#### Key Methods
- `getFormHeaderTitle()`: Returns appropriate header title
- `shouldShowStep(step)`: Controls step visibility
- `getDisplayStepNumber(step)`: Adjusts step numbering for planned leave
- `approveProjectManager(approved)`: Handles PM approval
- `setFormType()`: Reads form type from route query parameters
- `updateFormValidations()`: Updates field validations based on form type

#### API Integration
- `GetProjectManagerList()`: Fetches Project Manager/Site Incharge list
- Fallback data provided for demo purposes

### 🎨 UI/UX Features

#### Navigation-Based Form Selection
- Integrated into the main navigation menu
- Clear separation between Emergency and Planned Leave forms
- No need for form type switching within the form

#### Conditional Rendering
- Contact Details section hidden for Planned Leave
- Step 2 (Responsibility Handover) hidden for Planned Leave
- Project Manager approval card shown only for Planned Leave
- Dynamic step numbering (Step 3 shows as Step 2 for Planned Leave)

#### Styling
- New radio button styling for Category selection
- Project Manager approval card with green theme
- Responsive design maintained

### 📱 Responsive Design
- Form type selector adapts to mobile screens
- All new components are mobile-friendly
- Maintains existing responsive behavior

### 🔄 Workflow Differences

#### Emergency Exit Workflow
1. Employee fills personal info, contact details, emergency reason
2. Employee details responsibility handover
3. HOD and department approvals
4. Final review and submission

#### Planned Leave Workflow
1. Employee fills personal info, category, leave reason, responsibilities handover person, selects PM and HOD
2. Project Manager approval → HOD approval → Other department approvals
3. Final review and submission

### 🚀 Usage

#### Via Navigation Menu
Users can access the forms through the navigation menu:
- **Emergency Exit Form**: Navigate to "Exit Form" → "Emergency Exit Form"
- **Employee Exit Form (Planned Leave)**: Navigate to "Exit Form" → "Employee Exit Form (Planned Leave)"

#### Via Direct URL
```
/emergency-exit-form?type=E  // Emergency Exit Form
/emergency-exit-form?type=P  // Employee Exit Form (Planned Leave)
```

#### Via Input Property (for programmatic usage)
```html
<app-emergency-exit-form [formType]="'P'"></app-emergency-exit-form>
```

### 🔧 Configuration

#### API Endpoints Required
- `GetProjectManagerList()`: Returns list of Project Managers/Site Incharges
- Existing `GetHodMasterList()`: Returns list of HODs

#### Form Validation
- Dynamic validation based on form type
- Required fields adjust automatically
- Contact details not required for Planned Leave

### 📝 Notes
- All existing Emergency Exit Form functionality is preserved
- No breaking changes to existing code
- Backward compatible with existing implementations
- Easy to extend for additional form types in the future

### 🎯 Future Enhancements
- Add more form types (e.g., Medical Leave, Maternity Leave)
- Implement role-based access control
- Add email notifications for approvals
- Integrate with HR systems
- Add PDF generation with form-specific templates