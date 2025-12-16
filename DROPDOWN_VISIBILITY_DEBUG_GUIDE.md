# Dropdown Visibility Debug Guide

## Issue
The dropdowns in Planned Leave and Resignation sections are not showing any employee values when expanded, even though the data should be loading correctly.

## Debugging Approach Applied

### 1. Added Debugging CSS
I've added temporary debugging CSS with colored borders and backgrounds to help identify what's happening:

- **Red border** around dropdown containers (`.dropdown-list.pm-dropdown`, `.dropdown-list.planned-dropdown`)
- **Green border** around dropdown items
- **Yellow background** on employee info containers
- **Light red background** on employee names
- **Light green background** on employee IDs
- **Debug headers** showing "PM Dropdown" and "Planned Dropdown"

### 2. Forced Visibility
The debugging CSS forces all elements to be visible by overriding any hiding rules:
- `display: block/flex !important`
- `visibility: visible !important`
- `opacity: 1 !important`
- Removes any off-screen positioning

### 3. Simple Fallback Styles
Added basic dropdown styling as a fallback in case the complex isolation rules are causing issues.

## What to Check Now

### Step 1: Open the Dropdowns
1. Go to Planned Leave or Resignation form
2. Click on "Project Manager / Site Incharge" field
3. Click on "Responsibilities Handed Over To" field

### Step 2: Look for Debug Indicators
You should see:
- **Red border** around the dropdown container
- **Debug header** saying "PM Dropdown" or "Planned Dropdown"
- **Colored backgrounds** on employee information if data is present

### Step 3: Check Browser Console
Open browser developer tools and look for:
```
Emergency Exit Form - Loading Project Manager list from Employee API...
Emergency Exit Form - Loading Employee master list...
Emergency Exit Form - Project Manager List loaded successfully: X items
Emergency Exit Form - Employee Master List loaded successfully: X items
```

### Step 4: Identify the Issue

#### If you see colored borders but no employee data:
- **Data loading issue** - Check API responses in Network tab
- **Empty arrays** - The API might not be returning data

#### If you see employee data with colored backgrounds:
- **CSS isolation issue** - The original styling was hiding the content
- **Remove debugging CSS** and apply cleaner styles

#### If you see no dropdown at all:
- **Visibility condition issue** - Check `isPMDropdownVisible()` and `isPlannedDropdownVisible()` methods
- **JavaScript error** - Check console for errors

#### If you see "No project managers found" or "No employees found":
- **Filter issue** - The search filter might be too restrictive
- **Data format issue** - The data format might not match expected structure

## Next Steps Based on Results

### If Data is Loading but Hidden:
Remove the debugging CSS and apply clean, simple dropdown styles without aggressive isolation.

### If Data is Not Loading:
1. Check API endpoints in Network tab
2. Verify API response format matches expected structure
3. Check for JavaScript errors preventing data loading

### If Dropdowns Don't Appear:
1. Check visibility methods in TypeScript
2. Verify focus/blur event handlers
3. Check for CSS conflicts preventing dropdown display

## Debugging CSS Location
The debugging styles are at the end of `src/app/emergency-exit-form/emergency-exit-form.component.css`

**Important**: Remove the debugging CSS once the issue is identified and fixed, as it uses bright colors and borders that are not suitable for production.

## Expected Behavior After Fix
The dropdowns should show employee names and IDs in a clean white dropdown list, identical to the Emergency section's "Responsible Person Name" dropdown.