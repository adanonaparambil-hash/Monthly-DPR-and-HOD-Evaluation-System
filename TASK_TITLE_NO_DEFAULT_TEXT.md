# Task Title - Remove "No Task Selected" Default Text

## Issue
When there was no task title in the header, the system was displaying "No Task Selected" as a default fallback text. This was unnecessary and should only show the title if one exists, otherwise leave it empty.

## Expected Behavior
- If task title exists → Display the title
- If task title is empty/null → Display nothing (empty string)
- No default fallback text like "No Task Selected"

## Solution

### File: `src/app/my-task/my-task.component.html`

Changed the task title display to show empty string instead of "No Task Selected":

**Before:**
```html
<h2 class="task-title">{{ activeTask?.title || 'No Task Selected' }}</h2>
```

**After:**
```html
<h2 class="task-title">{{ activeTask?.title || '' }}</h2>
```

## Changes Made
1. Removed the fallback text `'No Task Selected'`
2. Changed to empty string `''` when no title exists
3. Title will be blank if there's no active task or no title

## Result
- Clean header without unnecessary default text
- Title only shows when there's actual content
- Empty state is handled gracefully with blank space
- More professional appearance

## User Experience
- No confusing "No Task Selected" text when there's no task
- Clean, minimal interface
- Title appears only when relevant
- Better visual hierarchy
