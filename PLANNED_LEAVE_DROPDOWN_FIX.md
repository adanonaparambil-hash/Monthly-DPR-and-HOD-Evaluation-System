# Planned Leave Dropdown Height Fix

## Issue Identified
The planned leave section dropdown was still expanding too much, while the emergency section dropdown was working correctly.

## Root Cause
The planned leave dropdown is wrapped in different CSS containers:
- `.form-grid-planned` - 4-column grid layout
- `.hod-name-group` - specific container with max-width: 500px
- `.planned-dropdown` - specific class for the planned leave dropdown

These containers were potentially overriding the general dropdown height settings.

## Solution Applied

### 1. High Specificity CSS Rules
Added very specific CSS selectors to target the planned leave dropdown:
```css
.form-grid-planned .hod-name-group .searchable-dropdown .dropdown-list.planned-dropdown
```

### 2. Force Height with !important
- Desktop: `max-height: 120px !important`
- Mobile: `max-height: 100px !important`
- All positioning and styling properties use `!important` to override any conflicting styles

### 3. Container Fixes
- Added `overflow: visible` to `.form-grid-planned`
- Added `position: relative` and `z-index: 10` to `.hod-name-group`
- Ensured proper positioning context for the dropdown

### 4. Complete Style Override
Applied all necessary dropdown styles with `!important` to ensure they take precedence:
- Position, dimensions, colors, borders, shadows
- Item padding and alignment
- Scrolling behavior

## Files Modified
- `emergency-exit-form.component.css` - Added high-specificity rules for planned leave dropdown

## Result
- ✅ Planned leave dropdown now has consistent 120px height (100px on mobile)
- ✅ Proper scrolling behavior
- ✅ No interference with form layout
- ✅ Emergency section dropdown remains unaffected
- ✅ Both dropdowns now behave identically