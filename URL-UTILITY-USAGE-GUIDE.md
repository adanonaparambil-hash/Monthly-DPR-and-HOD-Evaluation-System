# URL Utility Usage Guide

## Problem
When saving URLs to the backend (for email notifications, etc.), only the relative path is saved (e.g., `monthly-dpr/143`). When users click links in emails, they get incomplete URLs that don't work in production.

## Solution
Created `UrlUtil` service that generates full URLs including the base URL and baseHref for production.

## Installation

The utility is already created at: `src/app/utils/url.util.ts`

## Usage

### 1. Import the Utility

```typescript
import { UrlUtil } from '../utils/url.util';

@Component({
  // ...
})
export class YourComponent {
  constructor(private urlUtil: UrlUtil) {}
}
```

### 2. Generate Full URLs

#### Get Full URL for Monthly DPR
```typescript
// Instead of saving: 'monthly-dpr/143'
const relativePath = 'monthly-dpr/143';

// Save this full URL:
const fullUrl = this.urlUtil.getFullUrl(relativePath);
// Result: 'https://adraklive.com/AdrakMPRUI/monthly-dpr/143'
```

#### Or use the specific method:
```typescript
const dprId = 143;
const fullUrl = this.urlUtil.getMonthlyDprUrl(dprId);
// Result: 'https://adraklive.com/AdrakMPRUI/monthly-dpr/143'
```

### 3. Example: Sending Email Notification

```typescript
// In your component or service
sendEvaluationNotification(dprId: number, employeeEmail: string) {
  // Generate full URL
  const fullUrl = this.urlUtil.getMonthlyDprUrl(dprId);
  
  // Send to backend
  const emailData = {
    to: employeeEmail,
    subject: 'MPR Evaluation Ready',
    body: `Your MPR evaluation is ready. Click here to view: ${fullUrl}`,
    url: fullUrl  // Save full URL to database
  };
  
  this.api.sendEmail(emailData).subscribe({
    next: (response) => {
      console.log('Email sent with full URL:', fullUrl);
    },
    error: (error) => {
      console.error('Error sending email:', error);
    }
  });
}
```

### 4. Example: Saving URL to Database

```typescript
// When creating or updating a record
saveMonthlyDpr(dprData: any) {
  const dprId = dprData.id;
  
  // Generate full URL
  const fullUrl = this.urlUtil.getMonthlyDprUrl(dprId);
  
  // Add full URL to the data
  const dataToSave = {
    ...dprData,
    url: fullUrl,  // Full URL for email links
    relativePath: `monthly-dpr/${dprId}`  // Optional: keep relative path too
  };
  
  this.api.saveMonthlyDpr(dataToSave).subscribe({
    next: (response) => {
      console.log('Saved with full URL:', fullUrl);
    }
  });
}
```

### 5. Example: Getting Current Page URL

```typescript
// Get the full URL of the current page
getCurrentPageUrl() {
  const fullUrl = this.urlUtil.getCurrentRouteFullUrl();
  console.log('Current page full URL:', fullUrl);
  // Result: 'https://adraklive.com/AdrakMPRUI/monthly-dpr/143'
  
  return fullUrl;
}
```

## Available Methods

### `getBaseUrl(): string`
Returns the base URL of the application.
- **Development**: `http://localhost:4200`
- **Production**: `https://adraklive.com/AdrakMPRUI`

### `getFullUrl(routePath: string): string`
Generates a full URL for any route path.
```typescript
this.urlUtil.getFullUrl('monthly-dpr/143')
// Returns: 'https://adraklive.com/AdrakMPRUI/monthly-dpr/143'
```

### `getCurrentFullUrl(): string`
Gets the current browser URL.
```typescript
this.urlUtil.getCurrentFullUrl()
// Returns: Current window.location.href
```

### `getCurrentRouteFullUrl(): string`
Gets the full URL for the current route (handles baseHref automatically).
```typescript
this.urlUtil.getCurrentRouteFullUrl()
// Returns: 'https://adraklive.com/AdrakMPRUI/monthly-dpr/143'
```

### `getMonthlyDprUrl(dprId: number | string): string`
Generates full URL for monthly DPR.
```typescript
this.urlUtil.getMonthlyDprUrl(143)
// Returns: 'https://adraklive.com/AdrakMPRUI/monthly-dpr/143'
```

### `getPastReportsUrl(dprId?: number | string): string`
Generates full URL for past reports.
```typescript
this.urlUtil.getPastReportsUrl(143)
// Returns: 'https://adraklive.com/AdrakMPRUI/past-reports?dprid=143'
```

### `getEmployeeDashboardUrl(): string`
Generates full URL for employee dashboard.
```typescript
this.urlUtil.getEmployeeDashboardUrl()
// Returns: 'https://adraklive.com/AdrakMPRUI/employee-dashboard'
```

### `getHodDashboardUrl(): string`
Generates full URL for HOD dashboard.
```typescript
this.urlUtil.getHodDashboardUrl()
// Returns: 'https://adraklive.com/AdrakMPRUI/hod-dashboard'
```

### `getCedDashboardUrl(): string`
Generates full URL for CED dashboard.
```typescript
this.urlUtil.getCedDashboardUrl()
// Returns: 'https://adraklive.com/AdrakMPRUI/ced-dashboard'
```

### `getRelativePath(fullUrl: string): string`
Extracts relative path from full URL.
```typescript
this.urlUtil.getRelativePath('https://adraklive.com/AdrakMPRUI/monthly-dpr/143')
// Returns: 'monthly-dpr/143'
```

## Common Use Cases

### Use Case 1: Email Notifications
```typescript
// When HOD evaluates an employee
sendEvaluationCompleteEmail(dprId: number, employeeEmail: string) {
  const fullUrl = this.urlUtil.getMonthlyDprUrl(dprId);
  
  const emailData = {
    to: employeeEmail,
    subject: 'Your MPR Evaluation is Complete',
    body: `
      Your Monthly Performance Review has been evaluated.
      
      Click here to view your evaluation:
      ${fullUrl}
      
      Thank you!
    `,
    url: fullUrl
  };
  
  this.api.sendEmail(emailData).subscribe();
}
```

### Use Case 2: Notification System
```typescript
// Create notification with full URL
createNotification(userId: string, dprId: number) {
  const fullUrl = this.urlUtil.getMonthlyDprUrl(dprId);
  
  const notification = {
    userId: userId,
    message: 'Your MPR is ready for review',
    url: fullUrl,  // Full URL for clicking
    type: 'MPR_READY',
    createdAt: new Date()
  };
  
  this.api.createNotification(notification).subscribe();
}
```

### Use Case 3: Share Link
```typescript
// Copy full URL to clipboard
copyLinkToClipboard(dprId: number) {
  const fullUrl = this.urlUtil.getMonthlyDprUrl(dprId);
  
  navigator.clipboard.writeText(fullUrl).then(() => {
    console.log('Full URL copied:', fullUrl);
    this.showToast('Link copied to clipboard!');
  });
}
```

### Use Case 4: Backend API Call
```typescript
// When submitting MPR
submitMonthlyDpr(dprData: any) {
  const dprId = dprData.id;
  const fullUrl = this.urlUtil.getMonthlyDprUrl(dprId);
  
  // Include full URL in the submission
  const submissionData = {
    ...dprData,
    reviewUrl: fullUrl,  // Backend can use this for emails
    submittedAt: new Date()
  };
  
  this.api.submitDpr(submissionData).subscribe({
    next: (response) => {
      console.log('Submitted with URL:', fullUrl);
    }
  });
}
```

## Integration Example

### In Monthly DPR Component

```typescript
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UrlUtil } from '../utils/url.util';
import { Api } from '../services/api';

@Component({
  selector: 'app-monthly-dpr',
  // ...
})
export class MonthlyDprComponent implements OnInit {
  dprId: number = 0;
  
  constructor(
    private route: ActivatedRoute,
    private api: Api,
    private urlUtil: UrlUtil  // Inject the utility
  ) {}
  
  ngOnInit() {
    // Get DPR ID from route
    this.dprId = Number(this.route.snapshot.paramMap.get('id'));
    
    // Log the full URL
    const fullUrl = this.urlUtil.getMonthlyDprUrl(this.dprId);
    console.log('Full DPR URL:', fullUrl);
  }
  
  // When saving or submitting
  saveDpr() {
    const fullUrl = this.urlUtil.getMonthlyDprUrl(this.dprId);
    
    const dprData = {
      id: this.dprId,
      // ... other data
      url: fullUrl  // Include full URL
    };
    
    this.api.saveDpr(dprData).subscribe();
  }
  
  // When sharing
  shareDpr() {
    const fullUrl = this.urlUtil.getMonthlyDprUrl(this.dprId);
    
    // Copy to clipboard or share
    navigator.clipboard.writeText(fullUrl);
  }
}
```

## Backend Integration

### API Endpoint Example
When your backend receives the full URL, it can use it directly in emails:

```typescript
// Backend (Node.js/Express example)
app.post('/api/submit-dpr', (req, res) => {
  const { id, url, employeeEmail } = req.body;
  
  // Save the full URL to database
  await db.dprs.update({
    id: id,
    reviewUrl: url  // Full URL: https://adraklive.com/AdrakMPRUI/monthly-dpr/143
  });
  
  // Send email with full URL
  await sendEmail({
    to: employeeEmail,
    subject: 'MPR Submitted',
    body: `Your MPR has been submitted. View it here: ${url}`
  });
  
  res.json({ success: true });
});
```

## Environment Configuration

### Development
```typescript
// environment.ts
export const environment = {
  production: false,
  apiBaseUrl: 'https://localhost:44344',
  appBaseUrl: 'http://localhost:4200'  // Optional: Add this
};
```

### Production
```typescript
// environment.prod.ts
export const environment = {
  production: true,
  apiBaseUrl: 'https://adraklive.com/AdrakMPRAPI',
  appBaseUrl: 'https://adraklive.com/AdrakMPRUI'  // Optional: Add this
};
```

## Testing

### Test in Development
```typescript
const url = this.urlUtil.getMonthlyDprUrl(143);
console.log(url);
// Expected: 'http://localhost:4200/monthly-dpr/143'
```

### Test in Production
```typescript
const url = this.urlUtil.getMonthlyDprUrl(143);
console.log(url);
// Expected: 'https://adraklive.com/AdrakMPRUI/monthly-dpr/143'
```

## Migration Guide

### Step 1: Update Components
Replace all instances where you're saving relative URLs:

**Before:**
```typescript
const url = 'monthly-dpr/143';
this.api.saveUrl(url);
```

**After:**
```typescript
const fullUrl = this.urlUtil.getMonthlyDprUrl(143);
this.api.saveUrl(fullUrl);
```

### Step 2: Update API Calls
Wherever you're sending URLs to the backend, use the utility:

```typescript
// In your service or component
import { UrlUtil } from '../utils/url.util';

constructor(private urlUtil: UrlUtil) {}

// When creating notification
createNotification(dprId: number) {
  const fullUrl = this.urlUtil.getMonthlyDprUrl(dprId);
  
  return this.http.post('/api/notifications', {
    url: fullUrl,  // Full URL
    // ... other data
  });
}
```

### Step 3: Update Email Templates
In your backend, use the full URL directly:

```html
<!-- Email template -->
<p>Your MPR is ready for review.</p>
<a href="{{url}}">Click here to view</a>
<!-- url will be: https://adraklive.com/AdrakMPRUI/monthly-dpr/143 -->
```

## Benefits

1. ✅ **Email Links Work**: Users can click links in emails and go directly to the page
2. ✅ **Shareable Links**: Full URLs can be shared via any medium
3. ✅ **Bookmarkable**: Users can bookmark full URLs
4. ✅ **Environment Aware**: Automatically uses correct URL for dev/prod
5. ✅ **BaseHref Aware**: Handles production baseHref automatically
6. ✅ **Consistent**: All URLs generated the same way
7. ✅ **Maintainable**: Change base URL in one place

## Common Scenarios

### Scenario 1: HOD Evaluates Employee
```typescript
evaluateEmployee(dprId: number, employeeId: string) {
  // ... evaluation logic
  
  // Generate full URL for notification
  const fullUrl = this.urlUtil.getMonthlyDprUrl(dprId);
  
  // Send notification to employee
  this.api.sendNotification({
    employeeId: employeeId,
    message: 'Your MPR has been evaluated',
    url: fullUrl,  // Full URL
    type: 'EVALUATION_COMPLETE'
  }).subscribe();
}
```

### Scenario 2: Employee Submits MPR
```typescript
submitMpr(dprId: number, hodEmail: string) {
  // ... submission logic
  
  // Generate full URL for HOD
  const fullUrl = this.urlUtil.getMonthlyDprUrl(dprId);
  
  // Notify HOD
  this.api.sendNotification({
    email: hodEmail,
    message: 'New MPR submitted for your review',
    url: fullUrl,  // Full URL
    type: 'MPR_SUBMITTED'
  }).subscribe();
}
```

### Scenario 3: Share Dashboard Link
```typescript
shareDashboard() {
  const fullUrl = this.urlUtil.getEmployeeDashboardUrl();
  
  // Copy to clipboard
  navigator.clipboard.writeText(fullUrl).then(() => {
    this.showToast('Dashboard link copied!');
  });
}
```

## Troubleshooting

### Issue: URLs still showing relative paths
**Solution**: Make sure you're using the utility in all places where URLs are saved to backend.

### Issue: Wrong base URL in production
**Solution**: Verify `environment.prod.ts` has correct production URL.

### Issue: BaseHref not included
**Solution**: The utility automatically includes baseHref for production.

### Issue: URLs not working in emails
**Solution**: Ensure backend is saving the full URL, not just the relative path.

## Quick Reference

| Method | Input | Output (Production) |
|--------|-------|---------------------|
| `getBaseUrl()` | - | `https://adraklive.com/AdrakMPRUI` |
| `getFullUrl('monthly-dpr/143')` | Route path | `https://adraklive.com/AdrakMPRUI/monthly-dpr/143` |
| `getMonthlyDprUrl(143)` | DPR ID | `https://adraklive.com/AdrakMPRUI/monthly-dpr/143` |
| `getPastReportsUrl(143)` | DPR ID | `https://adraklive.com/AdrakMPRUI/past-reports?dprid=143` |
| `getCurrentRouteFullUrl()` | - | Current page full URL |

## Next Steps

1. **Identify all places** where URLs are saved to backend
2. **Import UrlUtil** in those components/services
3. **Replace relative paths** with full URLs using the utility
4. **Test in development** to ensure URLs are correct
5. **Deploy to production** and verify email links work
6. **Update backend** to use the full URLs in email templates

## Example Implementation Locations

Look for these patterns in your code and update them:

```typescript
// Pattern 1: Direct URL strings
const url = 'monthly-dpr/143';  // ❌ Replace this

// Pattern 2: Router URL
const url = this.router.url;  // ❌ This is relative

// Pattern 3: Template strings
const url = `monthly-dpr/${id}`;  // ❌ Replace this

// Replace all with:
const url = this.urlUtil.getMonthlyDprUrl(id);  // ✅ Use this
```

## Support

If you need help implementing this in specific components, let me know which component and I'll provide the exact code changes needed.
