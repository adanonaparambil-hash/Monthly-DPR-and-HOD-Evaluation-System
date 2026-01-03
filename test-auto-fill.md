# Auto-Fill Functionality Implementation

## Summary

I have successfully implemented the auto-fill functionality for the emergency exit form. Here's what was implemented:

### Changes Made:

1. **Extended DropdownOption Interface** (`src/app/models/common.model.ts`):
   - Added `email?: string` field
   - Added `phoneNumber?: string` field

2. **Updated loadEmployeeMasterList Method** (`src/app/emergency-exit-form/emergency-exit-form.component.ts`):
   - Now maps email and phone number fields from the API response
   - Handles multiple possible field names: `email`, `Email`, `emailId`, `EmailId`
   - Handles multiple possible phone field names: `phoneNumber`, `PhoneNumber`, `phone`, `Phone`

3. **Enhanced selectEmployee Method**:
   - Now auto-fills `responsiblePersonPhone` and `responsiblePersonEmail` fields
   - When a user selects an employee from the dropdown, both phone and email are automatically populated

### How It Works:

1. When `GetEmployeeMasterList` API is called, the response data is mapped to include email and phone number fields
2. When a user selects an employee from the "Responsible Person Name" dropdown in the Emergency form's responsibilities section
3. The `selectEmployee` method automatically fills in:
   - `responsiblePersonName` (employee name)
   - `responsiblePersonId` (employee ID)
   - `responsiblePersonPhone` (employee phone number) - **NEW**
   - `responsiblePersonEmail` (employee email) - **NEW**

### API Response Expected Format:

The `GetEmployeeMasterList` API should return data in this format:
```json
{
  "success": true,
  "data": [
    {
      "idValue": "EMP001",
      "description": "John Doe - Software Engineer",
      "email": "john.doe@company.com",
      "phoneNumber": "+1234567890"
    }
  ]
}
```

### Testing:

To test this functionality:
1. Open the Emergency Exit form
2. Add a responsibility in the "Responsibilities Handed Over To" section
3. Click on the "Responsible Person Name" dropdown
4. Select any employee
5. The "Phone Number" and "Email ID" fields should automatically populate with the selected employee's contact information

The implementation is backward compatible and will work even if the API doesn't return email/phone fields (they will just remain empty).