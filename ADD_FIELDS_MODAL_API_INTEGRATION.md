# Add Fields Modal API Integration

## Summary
Implemented API integration for the "Add Fields" modal in the My Task component. The modal now uses the `GetCustomMappedFields` API to fetch fields with mapping status, and calls `saveTaskFieldMapping` API to persist field selections. Fields already mapped are disabled to prevent duplicate selections.

## Changes Made

### 1. New API Method: `getCustomMappedFields()`
**File:** `src/app/services/api.ts`

Added new API method:
```typescript
getCustomMappedFields(userId: string, categoryId: number): Observable<any> {
  return this.http.get(`${this.apiUrl}/DailyTimeSheet/GetCustomMappedFields/${userId}/${categoryId}`);
}
```

### 2. Updated Model Interface
**File:** `src/app/models/TimeSheetDPR.model.ts`

Added new interface for mapped fields:
```typescript
export interface CustomMappedFieldDto {
  fieldId: number;
  fieldName: string;
  fieldType: string;
  isMapped: 'Y' | 'N';
  options: string[];
}
```

### 3. Updated CustomField Interface
**File:** `src/app/my-task/my-task.component.ts`

Added `isMapped` property:
```typescript
interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'textarea' | 'date';
  description: string;
  options?: string[];
  value?: any;
  fieldId?: number;
  isMapped?: 'Y' | 'N';  // NEW
}
```

### 4. Updated `openAddFieldModal()` Method
**File:** `src/app/my-task/my-task.component.ts`

Modified to:
- Validate user is logged in
- Validate task has a category ID
- Call `getCustomMappedFields(userId, categoryId)` API
- Map response data with `isMapped` flag
- Pre-select fields where `isMapped === 'Y'`
- Show modal only after successful API load

### 5. Added `isFieldMapped()` Helper Method
**File:** `src/app/my-task/my-task.component.ts`

```typescript
isFieldMapped(fieldKey: string): boolean {
  const field = this.availableCustomFields.find(f => f.key === fieldKey);
  return field?.isMapped === 'Y';
}
```

### 6. Updated HTML Template
**File:** `src/app/my-task/my-task.component.html`

Changed checkbox logic:
- Use `isFieldMapped()` instead of `isFieldSelected()` for disabled state
- Show "Already Mapped" label for mapped fields
- Disable checkboxes for fields with `isMapped === 'Y'`

### 7. API Response Structure
The `GetCustomMappedFields` API returns:
```json
{
  "success": true,
  "message": "Mapped field details fetched successfully",
  "data": [
    {
      "fieldId": 1,
      "fieldName": "Section",
      "fieldType": "Dropdown",
      "isMapped": "N",
      "options": ["Civil", "Electrical", "Mechanical"]
    },
    {
      "fieldId": 2,
      "fieldName": "Instruction",
      "fieldType": "Text",
      "isMapped": "Y",
      "options": []
    }
  ]
}
```

### 8. User Flow
1. User opens task details modal
2. User clicks "Add Fields" button
3. System validates user and category
4. API call to `GetCustomMappedFields` with userId and categoryId
5. Modal displays fields with:
   - Fields with `isMapped: "Y"` → Checkbox disabled, shows "Already Mapped"
   - Fields with `isMapped: "N"` → Checkbox enabled, user can select
6. User selects/deselects available fields
7. User clicks "Apply"
8. API call to `saveTaskFieldMapping` with selected field IDs
9. On success:
   - Fields are added/removed from UI
   - Success toaster shown
   - Modal closed

### 9. Field Mapping Logic
- **Already Mapped (isMapped: "Y")**: 
  - Checkbox is disabled
  - Shows "Already Mapped" label
  - Pre-selected in the modal
  - Cannot be unchecked by user
  
- **Not Mapped (isMapped: "N")**:
  - Checkbox is enabled
  - User can select/deselect
  - Can be added to the task

### 10. Error Handling
- User authentication check
- Task selection validation
- Category ID validation
- API error responses
- Network errors
- Empty field list handling

## API Endpoints Used

1. **GET** `/api/DailyTimeSheet/GetCustomMappedFields/{userId}/{categoryId}`
   - Fetches custom fields with mapping status
   - Parameters: userId (string), categoryId (number)
   - Returns: List of fields with `isMapped` flag

2. **POST** `/api/DailyTimeSheet/SaveMapping`
   - Saves field mapping for category
   - Body: `{ categoryId, fieldIds[], userId }`
   - Returns: Success/error response

## Testing Recommendations
1. Test with fields that have `isMapped: "Y"` (should be disabled)
2. Test with fields that have `isMapped: "N"` (should be selectable)
3. Test with no task selected (should show error)
4. Test with no user logged in (should show error)
5. Test API error scenarios
6. Test network failure scenarios
7. Verify disabled fields cannot be unchecked
8. Verify only unmapped fields can be selected
9. Verify "Already Mapped" label appears correctly
10. Verify toaster notifications appear correctly

## Technical Notes
- Replaced `getCustomFields()` with `getCustomMappedFields(userId, categoryId)`
- Added `isMapped` flag to track field mapping status
- Pre-selects already mapped fields in the modal
- Prevents duplicate field mapping by disabling mapped fields
- Maintains consistency with existing API integration patterns
- Uses TypeScript type safety with proper interfaces
