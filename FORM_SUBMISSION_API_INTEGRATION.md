# Form Submission API Integration

## Overview
Implemented comprehensive form submission functionality with proper validation, confirmation popup, and API integration for both Emergency and Planned Exit forms.

## Key Features Implemented

### 1. **Form Validation Enhancement**
- **Email Validation**: Proper email format validation using regex pattern
- **Phone Number Validation**: 10-digit mobile number validation
- **Landline Validation**: Flexible landline number format validation
- **Required Field Validation**: All mandatory fields must be filled
- **Declaration Validation**: All checkboxes must be checked before submission

### 2. **Submission Confirmation Popup**
- **User Confirmation**: "Are you sure you want to submit?" popup
- **Form Type Specific**: Different messages for Emergency vs Planned forms
- **Clear Warning**: Informs user that form cannot be modified after submission

### 3. **API Integration**
- **InsertEmployeeExit API**: Integrated with existing API endpoint
- **Data Mapping**: Proper mapping from form data to EmployeeExitRequest model
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Success Handling**: Moves to approval workflow on successful submission

## Technical Implementation

### 1. **Enhanced Form Validators**
```typescript
// Contact Details with validation
telephoneMobile: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
telephoneLandline: ['', Validators.pattern(/^[0-9-+\s()]{7,15}$/)],
emailId: ['', [Validators.required, Validators.email]],

// Responsibility validation
responsiblePersonPhone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
responsiblePersonEmail: ['', [Validators.required, Validators.email]],

// Declaration validation
decInfoAccurate: [false, Validators.requiredTrue],
decHandoverComplete: [false, Validators.requiredTrue],
decReturnAssets: [false, Validators.requiredTrue],
decUnderstandReturn: [false, Validators.requiredTrue]
```

### 2. **Submission Flow**
```typescript
submitForm() {
  // 1. Validate form and declarations
  // 2. Additional email and phone validation
  // 3. Show confirmation popup
  // 4. Perform API submission
  // 5. Handle success/error responses
}
```

### 3. **Data Preparation**
```typescript
private prepareExitRequest(): EmployeeExitRequest {
  // Maps form data to API model
  // Handles date formatting
  // Processes responsibilities array
  // Sets form type (E/P) from query parameter
}
```

## Validation Rules

### 1. **Email Validation**
- **Pattern**: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- **Applied To**: Personal email, responsibility emails
- **Error Message**: "Please enter a valid email address"

### 2. **Phone Number Validation**
- **Mobile Pattern**: `/^[0-9]{10}$/` (exactly 10 digits)
- **Landline Pattern**: `/^[0-9-+\s()]{7,15}$/` (flexible format)
- **Applied To**: Personal mobile, landline, responsibility phones
- **Error Messages**: Specific messages for mobile vs landline

### 3. **Declaration Validation**
- **Rule**: All 4 checkboxes must be checked
- **Validator**: `Validators.requiredTrue`
- **Error Message**: "This declaration must be checked"

## API Data Mapping

### 1. **EmployeeExitRequest Structure**
```typescript
{
  employeeId: string,           // From form
  formType: string,             // 'E' or 'P' from query parameter
  dateOfDeparture: string,      // Formatted as YYYY-MM-DD
  dateArrival: string,          // Formatted as YYYY-MM-DD
  flightTime: string,           // Time string
  responsibilitiesHanded: string, // For planned leave only
  noOfDaysApproved: number,     // Parsed integer
  depHod: string,               // HOD selection
  projectSiteIncharge: string,  // Project manager selection
  reasonForLeave: string,       // Reason text
  approvalStatus: 'Pending',    // Default status
  category: string,             // Staff/Worker for planned
  declaration1-4: string,       // 'true'/'false' strings
  responsibilities: array       // For emergency only
}
```

### 2. **Responsibilities Array** (Emergency Forms)
```typescript
{
  activities: string,           // Activities description
  project: string,              // Project name
  rpersonPhone: string,         // Responsible person phone
  rpersonEmail: string,         // Responsible person email
  rpersonEmpId: string,         // Using name as ID
  remarks: string               // Additional remarks
}
```

## User Experience Flow

### 1. **Form Completion**
- User fills out all required fields
- Real-time validation provides immediate feedback
- Clear error messages guide user corrections

### 2. **Pre-Submission Validation**
- Form validation check
- Declaration checkbox verification
- Email and phone format validation
- User-friendly error alerts

### 3. **Confirmation Process**
- Confirmation popup with clear message
- Form type specific warning text
- Option to cancel or proceed

### 4. **Submission Process**
- Loading state with "Submitting..." indicator
- API call with proper error handling
- Success: Move to approval workflow
- Error: Show error message, allow retry

## Error Handling

### 1. **Client-Side Validation**
- Required field validation
- Format validation (email, phone)
- Declaration validation
- Real-time feedback

### 2. **API Error Handling**
- Network errors
- Server validation errors
- Timeout handling
- User-friendly error messages

### 3. **Success Handling**
- Move to approval workflow (Step 4)
- Maintain form data for review
- Enable department approval process

## Form Type Handling

### 1. **Emergency Forms (E)**
- Include responsibilities array
- Skip planned-leave specific fields
- Different confirmation message

### 2. **Planned Forms (P)**
- Include category and project manager
- Include responsibilities handover text
- Skip emergency-specific responsibilities array

## Benefits

### 1. **Data Integrity**
- Proper validation ensures clean data
- Required field enforcement
- Format validation prevents bad data

### 2. **User Experience**
- Clear confirmation process
- Helpful error messages
- Smooth submission flow

### 3. **API Integration**
- Proper data mapping
- Error handling
- Success workflow

### 4. **Maintainability**
- Clean separation of concerns
- Reusable validation methods
- Clear error handling patterns

## Usage
1. User completes form with all required information
2. System validates all fields and declarations
3. Confirmation popup asks for final confirmation
4. API call submits data to backend
5. Success moves to approval workflow
6. Errors are handled gracefully with retry options

The implementation ensures robust form submission with proper validation, user confirmation, and seamless API integration.