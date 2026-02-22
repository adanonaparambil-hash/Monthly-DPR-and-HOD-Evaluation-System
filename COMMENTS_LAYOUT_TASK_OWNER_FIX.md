# Comments Layout - Use Task Owner UserId for Left/Right Positioning

## Issue
In the task details modal comments section, the LEFT/RIGHT positioning was using the session userId to determine which comments belong to the "current user". This was incorrect because:
- LEFT side should show the task owner's comments (the modal's userId)
- RIGHT side should show all other users' comments
- Using session userId would fail when viewing other users' tasks

Additionally, the comments had different colors (green for left, gray for right) which was visually inconsistent.

## Solution
1. Updated the `isOwnComment()` method to use the modal's `userId` input property (task owner) instead of the session userId
2. Changed both LEFT and RIGHT side comments to use the same white/neutral color scheme for consistency

## Changes Made

### 1. Updated isOwnComment() Method

**Before:**
```typescript
// Check if comment belongs to current user
isOwnComment(comment: TaskCommentDto): boolean {
  const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
  const currentUserId = currentUser.empId || currentUser.employeeId || '';
  const currentUserName = currentUser.empName || currentUser.employeeName || '';
  
  // Check by userId if available, otherwise check by name
  if (comment.userId) {
    return comment.userId === currentUserId;
  }
  return comment.empName === currentUserName;
}
```

**After:**
```typescript
// Check if comment belongs to the task owner (modal's userId)
// LEFT side = task owner's comments
// RIGHT side = all other users' comments
isOwnComment(comment: TaskCommentDto): boolean {
  // Use the modal's userId (task owner) instead of session userId
  const taskOwnerUserId = this.userId;
  
  // Check by userId if available
  if (comment.userId) {
    return comment.userId === taskOwnerUserId;
  }
  
  // Fallback: if no userId in comment, return false (show on right side)
  return false;
}
```

### 2. Updated Comment Styling - Unified Color Scheme

**Before:**
- LEFT side (task owner): Green gradient background, white text
- RIGHT side (others): Gray gradient background, dark text

**After:**
- Both sides: White gradient background, dark text, subtle border

```css
/* LEFT side - Task owner's comments */
.comment-item.comment-own .comment-body {
  background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
  color: #1f2937;
  border-radius: 8px 8px 8px 2px;
  max-width: 70%;
  border: 1px solid #e5e7eb;
}

/* RIGHT side - Other users' comments */
.comment-item.comment-other .comment-body {
  background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
  color: #1f2937;
  border-radius: 8px 8px 2px 8px;
  max-width: 70%;
  text-align: right;
  border: 1px solid #e5e7eb;
}
```

## How It Works

1. The modal receives `userId` as an input property (the task owner's userId)
2. When determining comment positioning, it compares the comment's userId with the modal's userId
3. If they match → LEFT side (task owner's comment)
4. If they don't match → RIGHT side (other users' comments)
5. No dependency on session userId from localStorage
6. Both sides use the same white/neutral color scheme for visual consistency

## Benefits

- Correctly positions comments based on task ownership, not session
- Works consistently when viewing other users' tasks from:
  - "Assigned to Others" tab
  - "My Logged Hours" listing
  - "DPR Approval" listing
- Task owner's comments always appear on LEFT
- All other users' comments always appear on RIGHT
- Unified color scheme provides clean, professional appearance
- No confusion when multiple users are viewing the same task

## Visual Layout

```
┌─────────────────────────────────────────┐
│  Task Details Modal                     │
├─────────────────────────────────────────┤
│  Comments Tab                           │
│                                         │
│  ┌──────────────┐                      │
│  │ Task Owner   │ (white background)   │
│  │ Comment      │                      │
│  └──────────────┘                      │
│                                         │
│                      ┌──────────────┐  │
│                      │ Other User   │  │
│                      │ Comment      │  │
│                      └──────────────┘  │
│                      (white background) │
│                                         │
│  ┌──────────────┐                      │
│  │ Task Owner   │ (white background)   │
│  │ Comment      │                      │
│  └──────────────┘                      │
└─────────────────────────────────────────┘
```

## Files Modified

- `src/app/components/task-details-modal/task-details-modal.component.ts`
- `src/app/components/task-details-modal/task-details-modal.component.css`

## Testing

Test by:
1. Open a task from "My Logged Hours" where the record userId is different from session userId
2. Go to Comments tab
3. Verify that the task owner's comments appear on the LEFT side with white background
4. Verify that all other users' comments appear on the RIGHT side with white background
5. Verify both sides have the same color scheme
6. Repeat test from "DPR Approval" listing
7. Repeat test from "Assigned to Others" tab

## Status
✅ Complete - No TypeScript errors

