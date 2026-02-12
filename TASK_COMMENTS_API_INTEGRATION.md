# Task Comments API Integration - Complete

## Summary
Successfully integrated the `saveComment` and `getComments` APIs to allow users to add and view comments on tasks in the My Task component's task details modal. All hardcoded comment values have been removed and replaced with dynamic data from the backend.

## Changes Made

### 1. API Service (src/app/services/api.ts)
- Already had the `saveComment(request: TaskCommentDto)` method defined
  - Endpoint: `POST /api/DailyTimeSheet/SaveComment`
- Already had the `getComments(taskId: number)` method defined
  - Endpoint: `GET /api/DailyTimeSheet/GetComments/{taskId}`

### 2. Model (src/app/models/TimeSheetDPR.model.ts)
- Already had the `TaskCommentDto` interface defined:
```typescript
export interface TaskCommentDto {
  commentId: number;
  taskId: number;
  userId: string;
  comments: string;
  submittedOn: string | Date;
  empName: string;
  profileImage?: string;
  profileImageBase64?: string;
}
```

### 3. My Task Component (src/app/my-task/my-task.component.ts)

#### Added Properties
```typescript
taskComments: TaskCommentDto[] = []; // Comments from API
```

#### Added `loadComments` Method
```typescript
loadComments(taskId: number): void {
  // Clear existing comments
  this.taskComments = [];
  
  this.api.getComments(taskId).subscribe({
    next: (response: any) => {
      if (response && response.success && response.data) {
        this.taskComments = response.data.map((comment: any) => ({
          commentId: comment.commentId || 0,
          taskId: comment.taskId || taskId,
          userId: comment.userId || '',
          comments: comment.comments || '',
          submittedOn: comment.submittedOn || new Date().toISOString(),
          empName: comment.empName || 'Unknown User',
          profileImage: comment.profileImage || undefined,
          profileImageBase64: comment.profileImageBase64 || undefined
        }));
        console.log('Task comments loaded:', this.taskComments.length, 'comments for task', taskId);
      }
    },
    error: (error: any) => {
      console.error('Error loading task comments:', error);
      this.taskComments = [];
    }
  });
}
```

#### Added Helper Methods
```typescript
// Get initials from name (e.g., "John Doe" -> "JD")
getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Get relative time (e.g., "2h ago", "45m ago")
getTimeAgo(date: string | Date): string {
  const now = new Date();
  const commentDate = new Date(date);
  const diffMs = now.getTime() - commentDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // Format as date if older than 7 days
  return commentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
```

#### Updated Imports
Added `TaskCommentDto` to the imports:
```typescript
import { TaskSaveDto, ActiveTaskListResponse, ActiveTaskDto, TaskCommentDto } from '../models/TimeSheetDPR.model';
```

#### Updated `openTaskDetailsModal` Method
- Added call to `loadComments(task.id)` when modal opens
- Comments are loaded immediately when the modal is displayed

#### Updated `closeTaskDetailsModal` Method
- Added `this.taskComments = []` to clear comments when modal closes
- Prevents stale data from showing when opening different tasks

#### Updated `addComment` Method
```typescript
addComment() {
  if (!this.newComment.trim()) {
    return;
  }

  // Get current user
  const currentUser = this.sessionService.getCurrentUser();
  const userId = currentUser?.empId || currentUser?.employeeId || '';
  
  if (!userId) {
    this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
    return;
  }

  // Get task ID from selected task
  const taskId = this.selectedTask?.id;
  if (!taskId) {
    this.toasterService.showError('Error', 'No task selected');
    return;
  }

  // Prepare comment DTO
  const commentDto: TaskCommentDto = {
    commentId: 0, // 0 for new comment
    taskId: taskId,
    userId: userId,
    comments: this.newComment.trim(),
    submittedOn: new Date().toISOString(),
    empName: currentUser?.employeeName || currentUser?.name || '',
    profileImage: currentUser?.profileImage || undefined,
    profileImageBase64: currentUser?.profileImageBase64 || undefined
  };

  // Call API to save comment
  this.api.saveComment(commentDto).subscribe({
    next: (response: any) => {
      if (response && response.success) {
        // Log the comment activity
        this.logTaskAction('comment_added', {
          comment: this.newComment.trim(),
          taskTitle: this.selectedTask?.title
        });

        // Clear the input
        this.newComment = '';
        
        // Show success message
        this.toasterService.showSuccess('Comment Added', 'Your comment has been saved successfully');
        
        // Reload comments to show the new comment
        if (taskId) {
          this.loadComments(taskId);
        }
        
        console.log('Comment saved successfully:', response);
      } else {
        this.toasterService.showError('Failed', response?.message || 'Failed to save comment');
      }
    },
    error: (error: any) => {
      console.error('Error saving comment:', error);
      this.toasterService.showError('Error', 'Failed to save comment. Please try again.');
    }
  });
}
```

### 4. My Task Component HTML (src/app/my-task/my-task.component.html)

#### Removed All Hardcoded Comments
All three comment sections now display dynamic data from the API instead of hardcoded values.

**Main Comments Section (Daily Remarks):**
```html
<div class="comments-content" *ngIf="activeSidebarTab === 'comments'">
  <!-- Display comments from API -->
  <div class="comment-item" *ngFor="let comment of taskComments">
    <div class="comment-avatar" *ngIf="!comment.profileImageBase64">
      {{ getInitials(comment.empName) }}
    </div>
    <img *ngIf="comment.profileImageBase64" [src]="comment.profileImageBase64" 
         alt="{{ comment.empName }}" class="comment-avatar" />
    <div class="comment-body">
      <div class="comment-header">
        <span class="comment-author">{{ comment.empName }}</span>
        <span class="comment-time">{{ getTimeAgo(comment.submittedOn) }}</span>
      </div>
      <div class="comment-message">
        {{ comment.comments }}
      </div>
    </div>
  </div>
  
  <!-- Empty state when no comments -->
  <div class="no-comments" *ngIf="taskComments.length === 0">
    <i class="fas fa-comments"></i>
    <p>No comments yet. Be the first to comment!</p>
  </div>
</div>
```

**Compact Comments Section:**
```html
<div *ngIf="activeSidebarTab === 'comments'">
  <!-- Display comments from API -->
  <div class="comment-item-compact" *ngFor="let comment of taskComments">
    <div class="comment-avatar-compact" *ngIf="!comment.profileImageBase64">
      {{ getInitials(comment.empName) }}
    </div>
    <img *ngIf="comment.profileImageBase64" [src]="comment.profileImageBase64" 
         alt="{{ comment.empName }}" class="comment-avatar-compact" />
    <div class="comment-content-compact">
      <div class="comment-header-compact">
        <span class="comment-author-compact">{{ comment.empName }}</span>
        <span class="comment-time-compact">{{ getTimeAgo(comment.submittedOn) }}</span>
      </div>
      <p class="comment-text-compact">{{ comment.comments }}</p>
    </div>
  </div>
  
  <!-- Empty state when no comments -->
  <div class="no-comments-compact" *ngIf="taskComments.length === 0">
    <i class="fas fa-comments"></i>
    <p>No comments yet</p>
  </div>
</div>
```

**Alternative Comments Section:**
```html
<div class="comments-section" *ngIf="activeSidebarTab === 'comments'">
  <!-- Display comments from API -->
  <div class="comment-item" *ngFor="let comment of taskComments">
    <div class="comment-avatar" *ngIf="!comment.profileImageBase64">
      {{ getInitials(comment.empName) }}
    </div>
    <img *ngIf="comment.profileImageBase64" [src]="comment.profileImageBase64" 
         alt="{{ comment.empName }}" class="comment-avatar" />
    <div class="comment-content">
      <div class="comment-header">
        <span class="comment-author">{{ comment.empName }}</span>
        <span class="comment-time">{{ getTimeAgo(comment.submittedOn) }}</span>
      </div>
      <p class="comment-text">
        {{ comment.comments }}
      </p>
    </div>
  </div>
  
  <!-- Empty state when no comments -->
  <div class="no-comments" *ngIf="taskComments.length === 0">
    <i class="fas fa-comments"></i>
    <p>No comments yet</p>
  </div>

  <div class="add-comment-section">
    <textarea class="comment-input" placeholder="Add a comment..." 
              [(ngModel)]="newComment" (keyup.enter)="addComment()"></textarea>
    <button class="send-comment-btn" (click)="addComment()" [disabled]="!newComment.trim()">
      <i class="fas fa-paper-plane"></i>
    </button>
  </div>
</div>
```

#### Updated Comment Input Sections (3 locations)

**Location 1 - Compact Comment Input:**
```html
<div class="comment-input-compact" *ngIf="activeSidebarTab === 'comments'">
  <textarea placeholder="Type a message..." [(ngModel)]="newComment" (keyup.enter)="addComment()"></textarea>
  <button class="send-btn-compact" (click)="addComment()" [disabled]="!newComment.trim()">
    <i class="fas fa-paper-plane"></i>
  </button>
</div>
```

**Location 2 - Add Comment Section:**
```html
<div class="add-comment-section">
  <textarea class="comment-input" placeholder="Add a comment..." [(ngModel)]="newComment" (keyup.enter)="addComment()"></textarea>
  <button class="send-comment-btn" (click)="addComment()" [disabled]="!newComment.trim()">
    <i class="fas fa-paper-plane"></i>
  </button>
</div>
```

**Location 3 - Main Comment Input (already had bindings):**
```html
<div class="add-comment" *ngIf="activeSidebarTab === 'comments'">
  <div class="comment-input-container">
    <input type="text" class="comment-input" placeholder="Add a comment..." [(ngModel)]="newComment"
      (keyup.enter)="addComment()">
    <button class="send-button" (click)="addComment()" [disabled]="!newComment.trim()">
      <i class="fas fa-paper-plane"></i>
    </button>
  </div>
</div>
```

## API Request/Response Formats

### Get Comments
**Request:** `GET /api/DailyTimeSheet/GetComments/{taskId}`

**Response:**
```json
{
  "success": true,
  "message": "Comments fetched successfully",
  "data": [
    {
      "commentId": 1,
      "taskId": 26,
      "userId": "ITS48",
      "comments": "adding text comments",
      "submittedOn": "2026-02-12T11:17:55",
      "empName": "ADAN ONAPARAMBIL",
      "profileImage": null,
      "profileImageBase64": "data:image/png;base64,/9j/4AAQSkZJRgABAQEAY5rfTG0Cufsub1ia6FDlV96cQZ//2Q=="
    }
  ]
}
```

### Save Comment
**Endpoint:** `POST /api/DailyTimeSheet/SaveComment`

**Body:**
```json
{
  "commentId": 0,
  "taskId": 26,
  "userId": "ITS48",
  "comments": "This is a test comment",
  "submittedOn": "2026-02-12T10:30:00.000Z",
  "empName": "John Doe",
  "profileImage": "base64string...",
  "profileImageBase64": "base64string..."
}
```

### Response
```json
{
  "success": true,
  "message": "Comment saved successfully",
  "data": {
    "commentId": 123,
    "taskId": 26,
    "userId": "ITS48",
    "comments": "This is a test comment",
    "submittedOn": "2026-02-12T10:30:00",
    "empName": "John Doe"
  }
}
```

## User Experience Flow

1. User opens task details modal
2. Comments are automatically loaded from API via `getComments(taskId)`
3. Comments display with:
   - User's profile image (if available) or initials
   - User's name
   - Relative time (e.g., "2h ago", "45m ago")
   - Comment text
4. If no comments exist, an empty state is shown
5. User navigates to the "Comments" tab (Daily Remarks) in the sidebar
6. User types a comment in the textarea
7. User can either:
   - Click the send button (paper plane icon)
   - Press Enter key
8. Validation checks:
   - Comment must not be empty (whitespace trimmed)
   - User must be logged in (userId required)
   - Task must be selected (taskId required)
9. If validation passes:
   - API call is made with comment data via `saveComment`
   - On success: Comment is saved, input cleared, success toaster shown
   - Comments are automatically reloaded to show the new comment
   - On error: Error toaster shown with message
10. Send button is disabled when comment is empty

## Features
- ✅ Comments loaded from backend via API
- ✅ All hardcoded comment values removed
- ✅ Comments automatically loaded when modal opens
- ✅ Comments automatically reloaded after adding new comment
- ✅ Comment saved to database via API
- ✅ User ID automatically retrieved from session
- ✅ Task ID automatically retrieved from selected task
- ✅ Comment timestamp automatically set
- ✅ User name and profile image included
- ✅ Profile image displayed if available, otherwise initials shown
- ✅ Relative time display (e.g., "2h ago", "Just now")
- ✅ Empty state when no comments exist
- ✅ Input validation (no empty comments)
- ✅ Success/error toaster notifications
- ✅ Input cleared after successful save
- ✅ Enter key support for quick submission
- ✅ Button disabled when input is empty
- ✅ Activity log updated after comment added
- ✅ All 3 comment sections updated with dynamic data
- ✅ Comments cleared when modal closes

## Data Mapping
- `commentId`: Always 0 for new comments
- `taskId`: From `selectedTask.id`
- `userId`: From session (empId or employeeId)
- `comments`: User input (trimmed)
- `submittedOn`: Current timestamp (ISO format)
- `empName`: From session (employeeName or name)
- `profileImage`: From session (optional)
- `profileImageBase64`: From session (optional)

## Testing Checklist
- [x] API methods exist in service
- [x] Model interface defined
- [x] Import added to component
- [x] taskComments array property added
- [x] loadComments method created
- [x] Helper methods added (getInitials, getTimeAgo)
- [x] loadComments called when modal opens
- [x] Comments cleared when modal closes
- [x] addComment method updated with API call and reload
- [x] All HTML comment sections updated with dynamic bindings
- [x] Hardcoded comments removed
- [x] Empty state added for no comments
- [x] Profile image support added
- [x] No TypeScript errors
- [ ] Test with actual API response
- [ ] Verify comments load from database
- [ ] Verify comment saves to database
- [ ] Test with multiple comments
- [ ] Test with no comments (empty state)
- [ ] Test profile image display
- [ ] Test initials display
- [ ] Test relative time display
- [ ] Test comment reload after save
- [ ] Test validation (empty comment)
- [ ] Test validation (no user logged in)
- [ ] Test validation (no task selected)
- [ ] Test Enter key submission
- [ ] Test button disabled state
- [ ] Test success toaster
- [ ] Test error toaster
- [ ] Test input clears after save

## Notes
- The `commentId` is always set to 0 for new comments (API will generate the actual ID)
- The `submittedOn` timestamp is set to the current time when the comment is submitted
- User information (name, profile image) is automatically retrieved from the session
- The comment input is cleared only after successful API response
- All three comment sections in the modal now use the same `taskComments` array
- Comments are automatically reloaded after a new comment is added
- The existing `logTaskAction` method is still called to maintain activity logging
- Profile images are displayed if available (base64), otherwise user initials are shown
- Initials are generated from the first and last name (e.g., "John Doe" -> "JD")
- Relative time is displayed for recent comments (e.g., "2h ago", "45m ago")
- Comments older than 7 days show the date (e.g., "Jan 15")
- Empty state is shown when no comments exist with a friendly message
- All hardcoded comment values (names, times, messages) have been removed
- Comments are loaded when the modal opens and cleared when it closes
