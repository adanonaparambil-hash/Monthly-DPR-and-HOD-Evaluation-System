# Favourite Star Toggle Implementation

## Summary
Implemented the favourite/star toggle functionality for task categories in the "Select Task" modal. Users can now click the star icon to add/remove categories from their favorites list.

## Features
- ⭐ Empty star → Click → Calls API with `isFavourite = 'Y'` → Star turns gold
- 🌟 Gold star → Click → Calls API with `isFavourite = 'N'` → Star becomes empty
- 🔄 After each toggle, categories are reloaded to update all tabs
- 🎨 Visual feedback with hover effects and animations
- 🚫 Click event doesn't trigger task selection (stopPropagation)

## Changes Made

### 1. Component TypeScript (`src/app/my-task/my-task.component.ts`)

#### Updated `TaskCategory` Interface
Added `isFavourite` field:
```typescript
interface TaskCategory {
  categoryId: number;
  categoryName: string;
  departmentId: number;
  departmentName?: string;
  sequenceNumber?: number;
  isFavourite?: 'Y' | 'N';  // NEW FIELD
  isEditing?: boolean;
}
```

#### Updated `loadTaskCategories()` Method
Now maps `isFavourite` status from API:
```typescript
this.favouriteList = (response.data.favouriteList || []).map((cat: any) => ({
  // ... other fields
  isFavourite: 'Y',  // Items in favouriteList are always favorites
  isEditing: false
}));

this.departmentList = (response.data.departmentList || []).map((cat: any) => ({
  // ... other fields
  isFavourite: cat.isFavourite || 'N',  // Get from API or default to 'N'
  isEditing: false
}));

this.allDepartmentList = (response.data.allDepartmentList || []).map((cat: any) => ({
  // ... other fields
  isFavourite: cat.isFavourite || 'N',  // Get from API or default to 'N'
  isEditing: false
}));
```

#### Added `toggleFavourite()` Method
```typescript
toggleFavourite(category: TaskCategory, event: Event): void {
  event.stopPropagation(); // Prevent task selection when clicking star
  
  // Get current user
  const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
  const userId = currentUser.empId || currentUser.employeeId || '1';
  
  // Determine new favourite status (toggle)
  const newFavouriteStatus: 'Y' | 'N' = category.isFavourite === 'Y' ? 'N' : 'Y';
  
  // Prepare API request
  const request: any = {
    userId: userId,
    categoryId: category.categoryId,
    isFavourite: newFavouriteStatus
  };
  
  console.log('Toggling favourite:', {
    categoryName: category.categoryName,
    currentStatus: category.isFavourite,
    newStatus: newFavouriteStatus
  });
  
  // Call API to toggle favourite
  this.api.toggleFavouriteCategory(request).subscribe({
    next: (response: any) => {
      if (response && response.success) {
        console.log('Favourite toggled successfully:', response);
        
        // Reload task categories to update all lists
        this.loadTaskCategories();
      } else {
        console.error('Failed to toggle favourite:', response?.message);
        alert('Failed to update favourite status: ' + (response?.message || 'Unknown error'));
      }
    },
    error: (error: any) => {
      console.error('Error toggling favourite:', error);
      alert('Error updating favourite status. Please try again.');
    }
  });
}
```

#### Added `isFavourited()` Helper Method
```typescript
isFavourited(category: TaskCategory): boolean {
  return category.isFavourite === 'Y';
}
```

### 2. HTML Template (`src/app/my-task/my-task.component.html`)

#### Favorites Tab
Star is always gold (active) and clickable to remove:
```html
<i class="fas fa-star star-icon active" 
   (click)="toggleFavourite(task, $event)" 
   title="Remove from favorites"></i>
```

#### My Department Tasks Tab
Star shows current state and toggles:
```html
<i [class]="isFavourited(task) ? 'fas fa-star star-icon active' : 'far fa-star star-icon'" 
   (click)="toggleFavourite(task, $event)" 
   [title]="isFavourited(task) ? 'Remove from favorites' : 'Add to favorites'"></i>
```

#### All Department Tasks Tab
Same as My Department Tasks tab:
```html
<i [class]="isFavourited(task) ? 'fas fa-star star-icon active' : 'far fa-star star-icon'" 
   (click)="toggleFavourite(task, $event)" 
   [title]="isFavourited(task) ? 'Remove from favorites' : 'Add to favorites'"></i>
```

### 3. CSS Styles (`src/app/my-task/my-task.component.css`)

Already exists with proper styling:
```css
.star-icon {
  color: #cbd5e1;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.star-icon.active {
  color: #fbbf24;  /* Gold color */
  filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.5));
}

.star-icon:hover {
  color: #fbbf24;
  transform: scale(1.2) rotate(15deg);
}
```

### 4. API Service (`src/app/services/api.ts`)

The API method already exists:
```typescript
toggleFavouriteCategory(request: ToggleFavouriteCategoryRequest): Observable<any> {
  return this.http.post(`${this.apiUrl}/DailyTimeSheet/ToggleFavourite`, request);
}
```

## API Request Structure

### ToggleFavouriteCategoryRequest Model
```typescript
export interface ToggleFavouriteCategoryRequest {
  userId: string;
  categoryId: number;
  isFavourite: 'Y' | 'N';
}
```

### Add to Favorites Request
```json
{
  "userId": "EMP001",
  "categoryId": 123,
  "isFavourite": "Y"
}
```

### Remove from Favorites Request
```json
{
  "userId": "EMP001",
  "categoryId": 123,
  "isFavourite": "N"
}
```

## Data Flow

### Adding to Favorites
1. User clicks empty star (far fa-star) on a category
2. `toggleFavourite()` is called with the category
3. Event propagation is stopped (doesn't select task)
4. Current status is 'N', new status becomes 'Y'
5. API is called with `isFavourite: 'Y'`
6. On success, `loadTaskCategories()` is called
7. Category appears in "PINNED FAVORITES" tab
8. Star turns gold in all tabs

### Removing from Favorites
1. User clicks gold star (fas fa-star active) on a category
2. `toggleFavourite()` is called with the category
3. Event propagation is stopped
4. Current status is 'Y', new status becomes 'N'
5. API is called with `isFavourite: 'N'`
6. On success, `loadTaskCategories()` is called
7. Category is removed from "PINNED FAVORITES" tab
8. Star becomes empty in other tabs

### Visual States
- **Empty Star** (`far fa-star`): Not favorited, gray color
- **Gold Star** (`fas fa-star active`): Favorited, gold color with glow
- **Hover**: Star turns gold and scales up with rotation

## Features

✅ Click star to toggle favorite status
✅ Empty star → Gold star (add to favorites)
✅ Gold star → Empty star (remove from favorites)
✅ Calls `toggleFavouriteCategory` API
✅ Passes correct parameters (userId, categoryId, isFavourite)
✅ Reloads categories after successful toggle
✅ Updates all three tabs (Favorites, My Department, All)
✅ Visual feedback with hover effects
✅ Prevents task selection when clicking star
✅ Shows tooltip on hover
✅ Error handling with user alerts
✅ Console logging for debugging

## User Experience

### In Favorites Tab
- All stars are gold (active)
- Click star → Removes from favorites
- Category disappears from this tab
- Still visible in other tabs with empty star

### In My Department / All Tabs
- Stars show current favorite status
- Empty star → Click → Turns gold, appears in Favorites
- Gold star → Click → Becomes empty, removed from Favorites
- Hover shows tooltip: "Add to favorites" or "Remove from favorites"

## Testing

### Test Add to Favorites
1. Open Select Task modal
2. Go to "MY DEPARTMENT TASKS" or "ALL DEPARTMENT TASKS" tab
3. Find a category with empty star
4. Click the star
5. Verify API is called with `isFavourite: 'Y'`
6. Verify star turns gold
7. Go to "PINNED FAVORITES" tab
8. Verify category appears there

### Test Remove from Favorites
1. Open Select Task modal
2. Go to "PINNED FAVORITES" tab
3. Click a gold star
4. Verify API is called with `isFavourite: 'N'`
5. Verify category disappears from Favorites tab
6. Go to other tabs
7. Verify star is now empty

### Test Star Doesn't Select Task
1. Click a star icon
2. Verify task is NOT selected
3. Verify only favorite status changes

### Test Visual Feedback
1. Hover over star
2. Verify it turns gold and scales up
3. Verify rotation animation
4. Verify tooltip appears

## Notes

- Star click uses `event.stopPropagation()` to prevent task selection
- Categories in `favouriteList` always have `isFavourite: 'Y'`
- Categories in other lists get `isFavourite` from API or default to 'N'
- After toggle, all categories are reloaded to ensure consistency
- User ID is retrieved from localStorage `current_user` object
- Gold color: `#fbbf24` with glow effect
- Empty color: `#cbd5e1` (gray)
