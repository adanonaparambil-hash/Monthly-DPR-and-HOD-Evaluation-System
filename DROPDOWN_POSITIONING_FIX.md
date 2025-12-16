# Dropdown Positioning and Content Bleeding Fix

## Issue
The searchable dropdowns for "Project Manager / Site Incharge" and "Responsibilities Handed Over To" were showing background content from other form fields (like "Date of Arrival", "No. of Days Requested") instead of the actual dropdown options.

## Root Cause
1. **Z-index conflicts**: Multiple form elements competing for the same stacking context
2. **CSS containment issues**: Form grid layout was interfering with dropdown positioning
3. **Content bleeding**: Other form field content was appearing inside dropdown items
4. **Insufficient isolation**: Dropdown wasn't properly isolated from parent container styles

## Changes Made

### 1. Enhanced Z-index Management
**File**: `src/app/emergency-exit-form/emergency-exit-form.component.css`

- Increased searchable dropdown z-index from 10 to 1000
- Added specific z-index handling for dropdown-containing form groups
- Ensured proper stacking context for form grid and sections

### 2. Improved Form Grid Layout
```css
/* Enhanced planned leave form grid */
.form-grid-planned .form-group:has(.searchable-dropdown) {
  z-index: 1000;
  position: relative;
  overflow: visible;
}
```

### 3. Content Isolation
Added strict rules to prevent form field content from appearing in dropdowns:
```css
/* Prevent any form elements from appearing in dropdown */
.dropdown-list input[type="date"],
.dropdown-list input[type="number"],
.dropdown-list input[type="text"],
.dropdown-list select,
.dropdown-list textarea,
.dropdown-list label:not(.employee-name):not(.employee-id) {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  position: absolute !important;
  left: -9999px !important;
}
```

### 4. Enhanced Dropdown Isolation
- Added `contain: layout style paint !important` to dropdown list
- Enhanced backdrop filtering
- Improved isolation rules for dropdown containers

### 5. Container Overflow Management
Ensured all parent containers allow dropdown visibility:
```css
.form-section,
.step-content,
.form-content,
.form-grid-planned {
  overflow: visible !important;
  position: relative !important;
}
```

## Expected Behavior After Fix

### Project Manager / Site Incharge Dropdown
- Shows only employee names and IDs from the API
- No background form field content visible
- Proper white background with clean styling
- Correct hover and selection states

### Responsibilities Handed Over To Dropdown
- Shows only employee names and IDs from the API
- No interference from other form fields
- Proper positioning and z-index stacking
- Clean dropdown appearance

## Technical Details

### Z-index Hierarchy
1. **Form containers**: z-index: 1
2. **Regular form groups**: z-index: auto
3. **Dropdown form groups**: z-index: 1000
4. **Searchable dropdown**: z-index: 1000
5. **Dropdown list**: z-index: 99999

### CSS Containment Strategy
- Used `contain: layout style paint` for dropdown isolation
- Applied `isolation: isolate` for proper stacking context
- Prevented content bleeding with strict display rules

### Responsive Considerations
- Maintained mobile responsiveness
- Adjusted dropdown heights for smaller screens
- Preserved touch interaction capabilities

## Testing Checklist
- [ ] Project Manager dropdown shows only employee data
- [ ] Responsibilities dropdown shows only employee data
- [ ] No form field content appears in dropdowns
- [ ] Dropdowns have proper white backgrounds
- [ ] Hover states work correctly
- [ ] Selection functionality works
- [ ] Mobile responsiveness maintained
- [ ] No layout shifts when dropdowns open
- [ ] Z-index stacking works properly

## Notes
- The fix maintains backward compatibility with existing functionality
- All dropdown styling remains consistent with the design system
- Performance impact is minimal due to efficient CSS selectors
- The solution is scalable for additional dropdowns if needed