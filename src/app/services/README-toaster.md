# Toaster Service Usage Guide

## Overview
The ToasterService provides beautiful, animated toast notifications for user feedback instead of basic browser alerts.

## Features
- ✅ Modern animated toasts
- 🎨 Different types: success, error, warning, info
- ⏱️ Auto-dismiss with customizable duration
- 📱 Responsive design
- 🎯 Click to dismiss
- 🔄 Multiple toasts support

## Usage

### 1. Import and Inject
```typescript
import { ToasterService } from '../services/toaster.service';
import { ToasterComponent } from '../components/toaster/toaster.component';

@Component({
  imports: [ToasterComponent], // Add to imports
  // ...
})
export class YourComponent {
  constructor(private toasterService: ToasterService) {}
}
```

### 2. Add to Template
```html
<app-toaster></app-toaster>
```

### 3. Show Notifications
```typescript
// Success notification
this.toasterService.showSuccess('Success!', 'Operation completed successfully.');

// Error notification  
this.toasterService.showError('Error!', 'Something went wrong.');

// Warning notification
this.toasterService.showWarning('Warning!', 'Please check your input.');

// Info notification
this.toasterService.showInfo('Info', 'Here is some information.');

// Custom duration (default: 4000ms for success/warning/info, 5000ms for error)
this.toasterService.showSuccess('Success!', 'Message', 6000);
```

## Toast Types
- **Success**: Green gradient, check icon
- **Error**: Red gradient, exclamation icon  
- **Warning**: Orange gradient, triangle icon
- **Info**: Blue gradient, info icon

## Methods
- `showSuccess(title, message, duration?)` - Show success toast
- `showError(title, message, duration?)` - Show error toast  
- `showWarning(title, message, duration?)` - Show warning toast
- `showInfo(title, message, duration?)` - Show info toast
- `removeToast(id)` - Remove specific toast
- `clearAll()` - Remove all toasts

## Example Implementation (Profile Component)
```typescript
// Replace alert() with toaster
saveProfile() {
  this.api.updateProfile(profile).subscribe({
    next: (res) => {
      this.toasterService.showSuccess('Profile Updated!', 'Your profile has been updated successfully.');
    },
    error: (err) => {
      this.toasterService.showError('Update Failed', 'Please try again.');
    }
  });
}
```