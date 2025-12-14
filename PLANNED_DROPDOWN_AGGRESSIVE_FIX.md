# Planned Leave Dropdown - Aggressive Layout Fix

## Issue
The planned leave dropdown was still expanding and pushing down the "Travel Information" section, despite previous height restrictions.

## Root Cause
The dropdown was still affecting the document flow and causing parent containers to expand, even with `position: absolute`.

## Aggressive Solution Applied

### 1. Fixed Height (Not Auto)
- Changed from `height: auto` to `height: 120px !important` (desktop)
- Changed to `height: 100px !important` (mobile)
- This ensures the dropdown never exceeds these dimensions

### 2. Complete Layout Isolation
Added CSS containment properties:
```css
contain: layout style paint !important;
transform: translateZ(0) !important;
will-change: transform !important;
```

### 3. Parent Container Fixes
- `.form-grid-planned`: Added `contain: layout !important`
- `.hod-name-group`: Added `contain: layout !important`
- `.searchable-dropdown`: Added `contain: layout !important`
- `.step-content`: Added `contain: layout !important`
- `.form-content`: Added `overflow: visible !important`

### 4. CSS Containment Strategy
Used CSS containment to isolate the dropdown's layout effects:
- `contain: layout` - Prevents layout changes from affecting parent elements
- `contain: style` - Isolates style calculations
- `contain: paint` - Creates a new stacking context

### 5. Hardware Acceleration
- `transform: translateZ(0)` - Forces GPU acceleration
- `will-change: transform` - Optimizes for transform changes

## Expected Result
- ✅ Dropdown has fixed 120px height (100px mobile)
- ✅ Completely isolated from document flow
- ✅ No parent container expansion
- ✅ Travel Information section stays in place
- ✅ Hardware accelerated for smooth performance

## Files Modified
- `emergency-exit-form.component.css` - Added aggressive layout isolation

This fix uses modern CSS containment and hardware acceleration to completely isolate the dropdown from affecting the page layout.