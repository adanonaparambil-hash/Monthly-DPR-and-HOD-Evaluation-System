# Navigation Fix for Planned Leave Form

## 🐛 Issue Identified
The Planned Leave form was not navigating to the next step when clicking the "Next" button.

## 🔍 Root Causes Found

### 1. **Validation Issue**
- The `validateEmployeeInfo()` method was requiring `telephoneMobile` and `emailId` fields for all form types
- For Planned Leave, Contact Details section is hidden, so these fields are not available
- Validation was failing, preventing navigation

### 2. **Form Validation Setup**
- The `updateFormValidations()` method wasn't properly clearing validators for contact fields in Planned Leave mode
- Contact fields retained their required validators even when hidden

### 3. **Navigation Button Logic**
- The Next button condition `*ngIf="currentStep < 4"` wasn't appropriate for Planned Leave
- Planned Leave uses internal steps 1 → 3 → 4, so the button logic needed adjustment

## ✅ Fixes Applied

### 1. **Updated Validation Logic**
```typescript
validateEmployeeInfo(): boolean {
  let requiredFields = ['employeeName', 'employeeId', 'department', 'dateOfDeparture', 
                       'noOfDaysApproved', 'reasonForEmergency', 'hodName'];
  
  // Add contact details validation only for Emergency form
  if (this.formType === 'E') {
    requiredFields.push('address', 'telephoneMobile', 'emailId');
  }
  
  // Add planned leave specific validations
  if (this.formType === 'P') {
    requiredFields.push('category', 'responsibilitiesHandedOverTo', 'projectManagerName');
  }
}
```

### 2. **Enhanced Form Validation Setup**
```typescript
updateFormValidations() {
  // ... existing code ...
  
  if (this.formType === 'P') {
    // Remove contact details requirements for planned leave
    addressControl?.clearValidators();
    telephoneMobileControl?.clearValidators();
    emailIdControl?.clearValidators();
  } else {
    // Add contact details requirements for emergency
    addressControl?.setValidators([Validators.required]);
    telephoneMobileControl?.setValidators([Validators.required]);
    emailIdControl?.setValidators([Validators.required, Validators.email]);
  }
}
```

### 3. **Improved Navigation Button Logic**
```typescript
shouldShowNextButton(): boolean {
  if (this.formType === 'P') {
    return this.currentStep === 1 || this.currentStep === 3; // Show on Step 1 and Step 3
  } else {
    return this.currentStep < 4; // Show on all steps except final for emergency
  }
}
```

### 4. **Added Debug Logging**
- Added console logs to `nextStep()` method to help debug navigation issues
- Added validation logging to identify which fields are failing

## 🎯 Validation Requirements by Form Type

### **Emergency Exit Form (E)**
**Step 1 Required Fields:**
- employeeName, employeeId, department
- dateOfDeparture, noOfDaysApproved
- address, telephoneMobile, emailId (Contact Details)
- reasonForEmergency, hodName

### **Planned Leave Form (P)**
**Step 1 Required Fields:**
- employeeName, employeeId, department
- dateOfDeparture, noOfDaysApproved
- reasonForEmergency, hodName
- category, responsibilitiesHandedOverTo, projectManagerName (Planned Leave specific)

## 🔄 Navigation Flow

### **Emergency Exit Form**
- Step 1 → Step 2 → Step 3 → Step 4
- Next button shows on steps 1, 2, 3

### **Planned Leave Form**
- Step 1 → Step 3 → Step 4 (internal steps)
- Displays as: Step 1 → Step 2 → Step 3
- Next button shows on Step 1 and Step 3

## 🧪 Testing
The fixes ensure that:
- ✅ Planned Leave form validates only relevant fields in Step 1
- ✅ Navigation works correctly from Step 1 to approvals
- ✅ Contact fields are not required for Planned Leave
- ✅ Emergency form behavior remains unchanged
- ✅ Debug logging helps identify future issues

## 🚀 Result
The Planned Leave form now navigates correctly:
1. User fills Step 1 (all information)
2. Clicks "Next" → Goes to Step 2 (approvals)
3. Completes approvals → Goes to Step 3 (final review)
4. Submits form successfully