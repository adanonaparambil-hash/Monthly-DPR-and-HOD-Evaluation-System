# Export Report Implementation - API Field Names (PascalCase)

## Overview
Implemented the export functionality for "My Logged Hours" that exports data to Excel using the exact API field names with PascalCase formatting (first letter capitalized, rest as-is).

## Changes Made

### File: `src/app/my-logged-hours/my-logged-hours.ts`

#### Added Property: `columnToApiFieldMap`

A mapping object that converts UI column keys to exact API field names in PascalCase:

```typescript
columnToApiFieldMap: { [key: string]: string } = {
  'taskId': 'TaskId',
  'title': 'TaskTitle',
  'description': 'Description',
  'dailyComment': 'DailyComment',
  'projectName': 'ProjectName',
  'category': 'CategoryName',
  'type': 'Type',
  'process': 'Process',
  'assignedTo': 'AssignedTo',
  'assignedBy': 'AssignedBy',
  'department': 'Department',
  'project': 'ProjectName',
  'workPlace': 'WorkPlace',
  'trade': 'Trade',
  'stage': 'Stage',
  'section': 'Section',
  'startDate': 'StartDate',
  'targetDate': 'TargetDate',
  'timeTaken': 'TimeTaken',
  'progress': 'Progress',
  'status': 'Status',
  'instruction': 'Instruction',
  'count': 'Count',
  'unit': 'Unit',
  'remarks': 'Remarks',
  'folderPath': 'FolderPath',
  'documentLink': 'DocumentLink',
  'priority': 'Priority',
  'loggedBy': 'LoggedBy',
  'duration': 'Duration',
  'date': 'LogDate'  // Added log date mapping
};
```

#### Added Helper Method: `capitalizeFirstLetter()`

```typescript
capitalizeFirstLetter(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
```

This ensures all field names have only the first letter capitalized.

#### Modified Method: `exportReport()`

Updated to use PascalCase API field names:

```typescript
const selectedColumns = allColumns.map(col => {
  // For custom field columns, extract the actual field name and capitalize first letter
  if (col.key.startsWith('customField_')) {
    const fieldName = col.key.replace('customField_', '');
    return this.capitalizeFirstLetter(fieldName);
  }
  // For standard columns, map to API field names (already capitalized in map)
  return this.columnToApiFieldMap[col.key] || this.capitalizeFirstLetter(col.key);
}).filter(fieldName => fieldName);
```

## API Field Name Mapping (PascalCase)

### Standard Columns

| UI Column Key | Display Label | API Field Name (PascalCase) |
|--------------|---------------|----------------------------|
| taskId | Task ID | TaskId |
| title | Task Title | TaskTitle |
| description | Description | Description |
| dailyComment | Daily Comment | DailyComment |
| projectName | Project Name | ProjectName |
| category | Task Category | CategoryName |
| loggedBy | Logged By | LoggedBy |
| duration | Duration | Duration |
| date | Date | LogDate |
| type | Type | Type |
| process | Process | Process |
| assignedTo | Assigned To | AssignedTo |
| assignedBy | Assigned By | AssignedBy |
| department | Department | Department |
| project | Project | ProjectName |
| workPlace | Work Place | WorkPlace |
| trade | Trade | Trade |
| stage | Stage | Stage |
| section | Section | Section |
| startDate | Start Date | StartDate |
| targetDate | Target Date | TargetDate |
| timeTaken | Time Taken | TimeTaken |
| progress | Progress (%) | Progress |
| status | Status | Status |
| instruction | Instruction | Instruction |
| count | Count | Count |
| unit | Unit | Unit |
| remarks | Remarks | Remarks |
| folderPath | Folder Path | FolderPath |
| documentLink | Document Link | DocumentLink |
| priority | Priority | Priority |

### Custom Field Columns

Custom fields are capitalized using `capitalizeFirstLetter()`:
- `customField_instruction` → `"Instruction"`
- `customField_stage` → `"Stage"`
- `customField_trade` → `"Trade"`
- `customField_time taken` → `"Time taken"` (only first letter capitalized)
- `customField_count` → `"Count"`
- `customField_remarks` → `"Remarks"`

## Export Request Example

### Request with Standard Columns
```json
{
  "fromDate": "2026-02-01",
  "toDate": "2026-02-23",
  "projectId": 123,
  "categoryId": 21,
  "departmentId": 5,
  "employeeId": "ITS48",
  "pageNumber": 0,
  "pageSize": 0,
  "isExport": "Y",
  "selectedColumns": [
    "TaskId",
    "TaskTitle",
    "Description",
    "DailyComment",
    "ProjectName",
    "CategoryName",
    "LogDate",
    "LoggedBy",
    "Duration"
  ]
}
```

### Request with Custom Fields
```json
{
  "fromDate": "2026-02-01",
  "toDate": "2026-02-23",
  "pageNumber": 0,
  "pageSize": 0,
  "isExport": "Y",
  "selectedColumns": [
    "TaskTitle",
    "Description",
    "CategoryName",
    "Instruction",
    "Stage",
    "Trade",
    "Time taken",
    "Count",
    "Remarks",
    "LogDate",
    "LoggedBy",
    "Duration"
  ]
}
```

## How It Works

### 1. Column Collection
When user clicks "Export Report":
- Gets all visible columns from the table
- Includes both standard and custom field columns

### 2. Field Name Mapping with PascalCase
For each visible column:
- **Standard columns**: Uses `columnToApiFieldMap` to get the PascalCase API field name
  - Example: `title` → `TaskTitle`
  - Example: `category` → `CategoryName`
  - Example: `date` → `LogDate`
- **Custom field columns**: Capitalizes only the first letter
  - Example: `customField_instruction` → `Instruction`
  - Example: `customField_stage` → `Stage`
  - Example: `customField_time taken` → `Time taken`

### 3. API Call
Sends the PascalCase field names to the export API:
```typescript
selectedColumns: [
  "TaskTitle",      // from 'title' column
  "Description",    // from 'description' column
  "CategoryName",   // from 'category' column
  "Instruction",    // from custom field
  "Stage",          // from custom field
  "LogDate",        // from 'date' column (added)
  "LoggedBy",       // from 'loggedBy' column
  "Duration"        // from 'duration' column
]
```

### 4. API Response
The API uses these PascalCase field names to:
- Match columns in the database/response
- Generate Excel headers
- Populate data correctly

## Key Features

✅ **PascalCase Formatting**: All field names have only the first letter capitalized
✅ **LogDate Included**: Date column is now mapped to `LogDate` and included in exports
✅ **Correct Mapping**: API can properly match field names to database columns
✅ **Consistent**: Uses the same field names as the API response
✅ **Maintainable**: Centralized mapping in `columnToApiFieldMap`
✅ **Flexible**: Easy to add new columns or update mappings
✅ **Custom Fields**: Custom field names are capitalized consistently

## Capitalization Examples

### Standard Fields
- `taskTitle` → `TaskTitle`
- `categoryName` → `CategoryName`
- `dailyComment` → `DailyComment`
- `loggedBy` → `LoggedBy`
- `logDate` → `LogDate` (NEW)

### Custom Fields
- `instruction` → `Instruction`
- `stage` → `Stage`
- `trade` → `Trade`
- `time taken` → `Time taken` (only first letter)
- `planned hours` → `Planned hours` (only first letter)

## Testing Scenarios

### Scenario 1: Export Standard Columns with Date
User exports with columns: Task Title, Description, Category, Date, Duration
```json
{
  "selectedColumns": ["TaskTitle", "Description", "CategoryName", "LogDate", "Duration"]
}
```

### Scenario 2: Export with Custom Fields
User exports with: Task Title, Instruction, Stage, Trade, Date, Duration
```json
{
  "selectedColumns": ["TaskTitle", "Instruction", "Stage", "Trade", "LogDate", "Duration"]
}
```

### Scenario 3: Export All Visible Columns
User exports with all visible columns including custom fields and date
```json
{
  "selectedColumns": [
    "TaskTitle",
    "Description",
    "DailyComment",
    "ProjectName",
    "CategoryName",
    "Instruction",
    "Stage",
    "Trade",
    "Time taken",
    "LogDate",
    "LoggedBy",
    "Duration"
  ]
}
```

## Notes

- All field names follow PascalCase convention (first letter uppercase, rest as-is)
- The `LogDate` field is now included in the mapping for date columns
- Custom field names are capitalized using `capitalizeFirstLetter()` helper
- The `filter(fieldName => fieldName)` removes any undefined values from unmapped columns
- Console logs show the exact field names being sent for debugging
- The API expects field names in this exact format for proper column matching

