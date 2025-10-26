import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { trigger, transition, style, animate, state } from '@angular/animations';
import { filter } from 'rxjs/operators';
import { Theme } from '../services/theme';
import { Api } from '../services/api';
import { SessionService } from '../services/session.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 }))
      ])
    ]),
    trigger('slideDown', [
      transition(':enter', [
        style({ transform: 'translateY(-10px)', opacity: 0 }),
        animate('200ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'translateY(-10px)', opacity: 0 }))
      ])
    ])
  ]
})
export class layout implements OnInit, OnDestroy {
  isDarkMode = false;
  showNotifications = false;
  showProfile = false;
  sidebarCollapsed = false;
  currentRoute = '';
  isExitFormMenuOpen = false;

  notificationCount = 0;
  hasNewNotifications = false;
  notifications: any[] = [];
  isLoadingNotifications = false;
  notificationsLoaded = false; // Track if notifications have been loaded

  // Polling interval reference
  private notificationCountInterval: any;

  userSession = JSON.parse(localStorage.getItem('current_user') || '{}');

  // Role flags derived from session (isHOD: 'E' employee, 'C' CED, 'H' HOD)
  get isEmployee(): boolean {
    const code = (this.userSession?.isHOD || '').toString().toUpperCase();
    return code === 'E';
  }

  get isHod(): boolean {
    const code = (this.userSession?.isHOD || '').toString().toUpperCase();
    return code === 'H';
  }

  get isCed(): boolean {
    const code = (this.userSession?.isHOD || '').toString().toUpperCase();
    return code === 'C';
  }


  userProfile = {
    name: this.userSession.employeeName || '',
    role: this.userSession.designation || '',
    avatar: this.userSession.profileImageBase64 ||
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face&auto=format'
  };

  constructor(
    private router: Router, 
    private themeService: Theme, 
    private api: Api,
    private sessionService: SessionService
  ) {
    // Subscribe to theme changes
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    // Subscribe to session validity changes
    this.sessionService.sessionValid$.subscribe(isValid => {
      if (!isValid) {
        console.log('Session invalid detected in layout - user will be redirected');
      }
    });
  }

  ngOnInit() {
    // Validate session on layout initialization
    if (!this.sessionService.validateSession()) {
      return; // Session service will handle redirect
    }

    // Track route changes for page title
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute = event.url;
      
      // Validate session on each route change
      this.sessionService.validateSession();
    });

    // Theme is automatically applied by the service

    // Start polling for notification count every 10 seconds (lightweight)
    this.startNotificationCountPolling();
  }

  ngOnDestroy() {
    // Clean up the polling interval
    if (this.notificationCountInterval) {
      clearInterval(this.notificationCountInterval);
    }
  }

  getPageTitle(): string {
    const routeTitles: { [key: string]: string } = {
      '/dashboard': 'Dashboard',
      '/employee-dashboard': 'Employee Analytics',
      '/hod-dashboard': 'HOD Dashboard',
      '/ced-dashboard': 'CED Dashboard',
      '/monthly-dpr': 'MPR Entry',
      '/past-reports': 'Past Reports',
      '/profile': 'My Profile',
      '/emergency-exit-form': 'Exit Form'
    };

    // Handle emergency exit form with query parameters
    if (this.currentRoute.includes('/emergency-exit-form')) {
      return 'Exit Form';
    }

    return routeTitles[this.currentRoute] || 'Dashboard';
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    this.showProfile = false;

    // Load full notifications only when dropdown is opened and not already loaded
    if (this.showNotifications && !this.notificationsLoaded) {
      this.loadFullNotifications();
    }

    // Reset new notification flag when opening
    if (this.showNotifications) {
      this.hasNewNotifications = false;
    }
  }

  toggleProfile() {
    this.showProfile = !this.showProfile;
    this.showNotifications = false;
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  // markAllAsRead() {
  //   this.notificationCount = 0;
  //   this.hasNewNotifications = false;
  //   this.showNotifications = false;
  // }


  markAllAsRead() {
    const userId = this.userSession?.empId || this.userSession?.employeeId;
    if (!userId) {
      console.error('User ID not found');
      return;
    }

    const request: any = {
      notificationId: 0, // 0 for all notifications
      userId: userId.toString(),
      actionType: 'A' // 'A' flag for All mark as read
    };

    this.api.markNotificationAsRead(request).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationCount = 0;
          this.hasNewNotifications = false;

          // Update all notifications to read status
          this.notifications.forEach((notification: any) => {
            notification.isRead = true;
          });

          console.log('All notifications marked as read');

          // Optionally close the dropdown after marking all as read
          // this.showNotifications = false;
        }
      },
      error: (error) => {
        console.error('Error marking notifications as read:', error);
      }
    });
  }


  toggleExitFormMenu() {
    this.isExitFormMenuOpen = !this.isExitFormMenuOpen;
  }

  isExitFormRouteActive(): boolean {
    return this.currentRoute.includes('/emergency-exit-form');
  }

  logout() {
    // Use session service for proper logout
    this.sessionService.clearSession();
    this.router.navigate(['/login']);
  }

  // Method to add new notifications (for testing or real-time updates)
  addNewNotification(notification: any) {
    this.notifications.unshift(notification);
    this.notificationCount++;
    this.hasNewNotifications = true;

    // Auto-reset new notification flag after 5 seconds
    setTimeout(() => {
      this.hasNewNotifications = false;
    }, 5000);
  }

  // Method to simulate urgent notifications (for testing)
  simulateUrgentNotifications() {
    this.notificationCount = 8; // More than 5 triggers urgent animations
    this.hasNewNotifications = true;
  }

  // Close dropdowns when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;

    // Check if click is outside notification dropdown
    if (this.showNotifications && !target.closest('.notification-wrapper')) {
      this.showNotifications = false;
    }

    // Check if click is outside profile dropdown
    if (this.showProfile && !target.closest('.profile-wrapper')) {
      this.showProfile = false;
    }
  }

  // Start polling for notification count every 3 seconds (lightweight API call)
  startNotificationCountPolling() {
    // Initial load
    this.loadNotificationCount();

    // Set up polling every 3 seconds
    this.notificationCountInterval = setInterval(() => {
      this.loadNotificationCount();
    }, 3000); // 3 seconds
  }

  // Load only notification count (lightweight API call)
  loadNotificationCount() {
    const userId = this.userSession?.empId || this.userSession?.employeeId;
    if (!userId) {
      console.error('User ID not found');
      return;
    }

    this.api.GetUnreadNotificationCount(userId).subscribe({
      next: (response) => {
        if (response.success) {
          const newCount = response.data || 0;

          // Check if there are new notifications
          if (newCount > this.notificationCount) {
            this.hasNewNotifications = true;
            this.notificationsLoaded = false; // Reset to reload notifications when opened

            // Auto-reset new notification flag after 5 seconds
            setTimeout(() => {
              this.hasNewNotifications = false;
            }, 5000);
          }

          this.notificationCount = newCount;
        }
      },
      error: (error) => {
        console.error('Error loading notification count:', error);
      }
    });
  }

  // Load full notifications (called only when user clicks notification icon)
  loadFullNotifications() {
    const userId = this.userSession?.empId || this.userSession?.employeeId;
    if (!userId) {
      console.error('User ID not found');
      return;
    }

    this.isLoadingNotifications = true;
    this.api.getUserNotifications(userId).subscribe({
      next: (response) => {
        this.isLoadingNotifications = false;
        if (response.success && response.data && Array.isArray(response.data)) {
          // Clear existing notifications first
          this.notifications = [];

          // Map notifications with animation delay
          const newNotifications = response.data.map((notification: any) => ({
            id: notification.id,
            icon: this.getNotificationIcon(notification.title),
            message: notification.message,
            time: this.formatNotificationTime(notification.createdAt),
            isRead: notification.isRead,
            link: notification.link
          }));

          // Add notifications one by one with animation delay for better UX
          this.addNotificationsWithAnimation(newNotifications);

          this.notificationsLoaded = true;

          // Update count from actual notifications
          this.notificationCount = newNotifications.filter((n: any) => !n.isRead).length;
        } else {
          console.error('Unexpected API response structure:', response);
          this.notifications = [];
          this.notificationCount = 0;
        }
      },
      error: (error) => {
        this.isLoadingNotifications = false;
        console.error('Error loading notifications:', error);
      }
    });
  }

  // Add notifications with animation delay for better user experience
  private addNotificationsWithAnimation(notifications: any[]) {
    notifications.forEach((notification, index) => {
      setTimeout(() => {
        this.notifications.push(notification);
      }, index * 100); // 100ms delay between each notification
    });
  }

  // Refresh notifications manually
  refreshNotifications() {
    this.notificationsLoaded = false;
    this.notifications = [];
    this.loadFullNotifications();

    // Also refresh the count
    this.loadNotificationCount();

    console.log('Notifications refreshed');
  }

  // Navigate to notification link if available
  navigateToNotification(notification: any, event?: Event) {
    if (event) {
      event.stopPropagation();
    }

    // Mark as read first
    if (!notification.isRead) {
      this.markNotificationAsRead(notification.id);
    }

    // Navigate to link if available
    if (notification.link && notification.link !== '#') {
      // Parse the link to separate route from query parameters
      const link = notification.link;
      const [routePath, queryString] = link.split('?');

      if (queryString) {
        // Parse query parameters
        const queryParams: any = {};
        queryString.split('&').forEach((param: string) => {
          const [key, value] = param.split('=');
          queryParams[key] = value;
        });

        // Navigate with proper query parameters
        this.router.navigate([routePath], { queryParams });
      } else {
        // Navigate without query parameters
        this.router.navigate([routePath]);
      }

      this.showNotifications = false; // Close dropdown after navigation
    }
  }

  // TrackBy function for better performance with ngFor
  trackNotificationById(index: number, notification: any): number {
    return notification.id;
  }

  // Mark single notification as read
  markNotificationAsRead(notificationId: number, event?: Event) {
    // Prevent event bubbling if called from click event
    if (event) {
      event.stopPropagation();
    }

    const userId = this.userSession?.empId || this.userSession?.employeeId;
    if (!userId) {
      console.error('User ID not found');
      return;
    }

    const request: any = {
      notificationId: notificationId,
      userId: userId.toString(),
      actionType: 'S' // 'S' flag for Single notification mark as read
    };

    this.api.markNotificationAsRead(request).subscribe({
      next: (response) => {
        if (response.success) {
          // Update the notification in the local array
          const notification = this.notifications.find((n: any) => n.id === notificationId);
          if (notification) {
            notification.isRead = true;

            // Update the count locally
            this.notificationCount = this.notifications.filter((n: any) => !n.isRead).length;
          }

          console.log('Notification marked as read');
        }
      },
      error: (error) => {
        console.error('Error marking notification as read:', error);
      }
    });
  }

  // Clear/Delete single notification
  clearNotification(notificationId: number, event?: Event) {
    // Prevent event bubbling if called from click event
    if (event) {
      event.stopPropagation();
    }

    const userId = this.userSession?.empId || this.userSession?.employeeId;
    if (!userId) {
      console.error('User ID not found');
      return;
    }

    const request: any = {
      notificationId: notificationId,
      userId: userId.toString(),
      actionType: 'S' // 'S' flag for Single notification delete
    };

    this.api.deleteNotification(request).subscribe({
      next: (response) => {
        if (response.success) {
          // Remove notification from local array
          const index = this.notifications.findIndex((n: any) => n.id === notificationId);
          if (index > -1) {
            const wasUnread = !this.notifications[index].isRead;
            this.notifications.splice(index, 1);

            // Update count if it was unread
            if (wasUnread) {
              this.notificationCount = Math.max(0, this.notificationCount - 1);
            }
          }

          console.log('Notification deleted');
        }
      },
      error: (error) => {
        console.error('Error deleting notification:', error);
      }
    });
  }

  // Clear all notifications
  clearAllNotifications() {
    const userId = this.userSession?.empId || this.userSession?.employeeId;
    if (!userId) {
      console.error('User ID not found');
      return;
    }

    const request: any = {
      notificationId: 0, // 0 for all notifications
      userId: userId.toString(),
      actionType: 'A' // 'A' flag for All notifications delete
    };

    this.api.deleteNotification(request).subscribe({
      next: (response) => {
        if (response.success) {
          this.notifications = [];
          this.notificationCount = 0;
          this.hasNewNotifications = false;
          this.notificationsLoaded = false;

          console.log('All notifications cleared');
        }
      },
      error: (error) => {
        console.error('Error clearing all notifications:', error);
      }
    });
  }

  // Helper method to get appropriate icon based on notification type
  private getNotificationIcon(title: string): string {
    const titleLower = title.toLowerCase();

    if (titleLower.includes('approved') || titleLower.includes('success')) {
      return 'fas fa-check-circle text-success';
    } else if (titleLower.includes('pending') || titleLower.includes('warning')) {
      return 'fas fa-exclamation-triangle text-warning';
    } else if (titleLower.includes('rejected') || titleLower.includes('error')) {
      return 'fas fa-times-circle text-danger';
    } else {
      return 'fas fa-info-circle text-info';
    }
  }

  // Helper method to format notification time
  private formatNotificationTime(createdAt: string): string {
    const now = new Date();
    const notificationDate = new Date(createdAt);
    const diffInMinutes = Math.floor((now.getTime() - notificationDate.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  }



}
