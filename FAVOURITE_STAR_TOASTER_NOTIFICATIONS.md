# Favourite Star Toaster Notifications Implementation

## Summary
Added toaster notifications to the favourite star toggle functionality in the Select Task modal, matching the same notification system used for logout and other actions.

## Changes Made

### 1. Added ToasterComponent to My-Task Component
**File**: `src/app/my-task/my-task.component.ts`
- Imported `ToasterComponent` from `../components/toaster/toaster.component`
- Added `ToasterComponent` to the component's imports array

### 2. Added Toaster to Template
**File**: `src/app/my-task/my-task.component.html`
- Added `<app-toaster></app-toaster>` at the top of the template
- This enables toaster notifications to display in the top-right corner

### 3. Updated Favourite Toggle Method
**File**: `src/app/my-task/my-task.component.ts` - `toggleFavourite()` method

**Success Notifications:**
- ⭐ **Adding to favourites**: Shows green success toaster with message: `"[Category Name] added to favourites!"`
- ☆ **Removing from favourites**: Shows green success toaster with message: `"[Category Name] removed from favourites!"`

**Error Notifications:**
- ❌ **API failure**: Shows red error toaster with the error message from API
- ❌ **Network error**: Shows red error toaster with message: `"Error updating favourite status. Please try again."`

## User Experience
- Toaster appears in the top-right corner (same as logout notification)
- Success toasters are green and auto-dismiss after 4 seconds
- Error toasters are red and auto-dismiss after 5 seconds
- Toasters can be manually dismissed by clicking on them
- Multiple toasters stack vertically if triggered in quick succession

## Testing
To test the functionality:
1. Navigate to My Task page
2. Click "New Task" or any task to open the Select Task modal
3. Click the star icon next to any task category
4. Observe the green success toaster appearing in the top-right corner
5. Click the star again to remove from favourites
6. Observe another success toaster confirming removal

## Technical Details
- Uses the custom `ToasterService` (not ngx-toastr)
- Toaster component is standalone and imported directly
- Notifications are non-blocking and don't interrupt user workflow
- Consistent with the application's existing notification system
