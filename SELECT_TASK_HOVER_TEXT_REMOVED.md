# Select Task Modal - Hover Text and Cursor Fix

## Issue
User reported that hovering over task cards in the Select Task modal was showing unwanted text and the cursor was still showing as clickable (pointer) even though the card itself is no longer clickable.

## Changes Made

### File: `src/app/my-task/my-task.component.css`

#### 1. Changed Cursor from Pointer to Default
```css
.task-item {
  cursor: default;  /* Changed from cursor: pointer */
}
```

#### 2. Updated Hover Effect to Neutral Style
Changed from blue interactive hover to subtle neutral hover:

**Before:**
```css
.task-item:hover {
  background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%);
  border-color: #3b82f6;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}
```

**After:**
```css
.task-item:hover {
  background: linear-gradient(135deg, #f1f5f9 0%, #ffffff 100%);
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
```

## Result
- Task cards no longer show pointer cursor (now shows default cursor)
- Hover effect is subtle and neutral (gray instead of blue)
- No hover text appears
- Only the "Assign" and "Add" buttons are interactive and clickable
- Star icon remains interactive with pointer cursor

## User Experience
- Users understand that the card itself is not clickable
- Clear visual distinction between clickable buttons and non-clickable card area
- Cleaner, more professional appearance without confusing hover effects
