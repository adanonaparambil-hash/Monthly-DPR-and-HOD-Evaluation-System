import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { filter } from 'rxjs/operators';
import { Theme } from '../services/theme';
import { Api } from '../services/api';
import { AuthService } from '../services/auth.service';
import { SessionMonitorComponent } from '../components/session-monitor.component';
import { AvatarUtil } from '../utils/avatar.util';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, SessionMonitorComponent],
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
  isMPRMenuOpen = false;
  isDPRMenuOpen = false;
  isApprovalsMenuOpen = false;
  isDPROnlyMode = false; // New property to control DPR-only mode

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
    avatar: AvatarUtil.processProfileImage(
      this.userSession.profileImageBase64
    )
  };

  constructor(
    private router: Router, 
    private themeService: Theme, 
    private api: Api,
    private authService: AuthService
  ) {
    // Subscribe to theme changes
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    // Subscribe to session changes
    this.authService.session$.subscribe(session => {
      if (!session) {
        console.log('Session cleared - user will be redirected');
      }
    });
  }

  ngOnInit() {
    // Check if user is logged in
    if (!this.authService.isLoggedIn()) {
      this.authService.logout('unauthorized');
      return;
    }

    // Initialize current route immediately
    this.currentRoute = this.router.url;
    
    // Check for DPR-only mode first
    this.checkDPROnlyMode();
    
    // Also check again after a short delay to ensure everything is loaded
    setTimeout(() => {
      this.checkDPROnlyMode();
    }, 100);
    
    // Update menu states based on initial route
    this.updateMenuStatesBasedOnRoute();

    // Initialize sidebar state based on screen size
    this.initializeSidebarState();

    // Track route changes for page title
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute = event.url;
      
      // Check for DPR-only mode on route changes
      this.checkDPROnlyMode();
      
      // Auto-open relevant menus based on current route
      this.updateMenuStatesBasedOnRoute();
      
      // Update activity on route change
      this.authService.updateActivity();
      
      // Force update of page title for MPR routes
      if (this.currentRoute.includes('/monthly-dpr')) {
        // Small delay to ensure MPR component has set session storage
        setTimeout(() => {
          this.currentRoute = event.url;
        }, 100);
      }
      
      // Debug log for DPR-only mode
      console.log('Route changed:', {
        route: this.currentRoute,
        isDPROnlyMode: this.isDPROnlyMode,
        sessionStorage: sessionStorage.getItem('isDPROnlyMode')
      });
    });

    // Listen for MPR month/year updates from the MPR component
    window.addEventListener('mprMonthYearUpdated', this.handleMPRMonthYearUpdate.bind(this));

    // Theme is automatically applied by the service

    // Start polling for notification count every 10 seconds (lightweight)
    this.startNotificationCountPolling();
  }

  // Handler for MPR month/year updates
  private handleMPRMonthYearUpdate(event: any): void {
    // The title will automatically update on next change detection cycle
    // We can force it by triggering a micro-task
    Promise.resolve().then(() => {
      // This will trigger change detection
      this.currentRoute = this.router.url;
    });
  }

  private initializeSidebarState() {
    // Collapse sidebar on mobile by default, keep expanded on desktop
    if (window.innerWidth <= 768) {
      this.sidebarCollapsed = true;
    } else {
      this.sidebarCollapsed = false;
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    // Auto-collapse sidebar on mobile, but don't auto-expand on desktop
    if (event.target.innerWidth <= 768) {
      this.sidebarCollapsed = true;
    }
    // On desktop, keep the user's preference (don't force expand)
  }

  ngOnDestroy() {
    // Clean up the polling interval
    if (this.notificationCountInterval) {
      clearInterval(this.notificationCountInterval);
    }
    
    // Clean up event listener
    window.removeEventListener('mprMonthYearUpdated', this.handleMPRMonthYearUpdate.bind(this));
    
    // Clear DPR-only mode from sessionStorage when component is destroyed
    // (but only if we're not navigating to another DPR route)
    const isDPRRoute = window.location.pathname.includes('/my-task') || 
                       window.location.pathname.includes('/my-logged-hours') || 
                       window.location.pathname.includes('/dpr-approval');
    
    if (!isDPRRoute) {
      sessionStorage.removeItem('isDPROnlyMode');
    }
  }

  getPageTitle(): string {
    // Handle MPR routes with dynamic IDs (e.g., /monthly-dpr/123)
    if (this.currentRoute.includes('/monthly-dpr')) {
      return this.getMPRTitle();
    }

    // Handle Past Reports with role-based title
    if (this.currentRoute.includes('/past-reports')) {
      return this.getPastReportsTitle();
    }

    // Handle exit form with query parameters
    if (this.currentRoute.includes('/exit-form')) {
      return 'Exit Form';
    }

    const routeTitles: { [key: string]: string } = {
      '/dashboard': 'Dashboard',
      '/employee-dashboard': 'Employee Analytics',
      '/hod-dashboard': 'HOD Dashboard',
      '/ced-dashboard': 'CED Performance Dashboard',
      '/ced-dashboard-old': 'CED Dashboard (Old)',
      '/ced-dashboard-new': 'CED Performance Dashboard',
      '/profile': 'My Profile',
      '/leave-approval': 'Leave Approval Management',
      '/dpr-approval': 'DPR Approval Management',
      '/chat': 'Internal Communications',
      '/my-task': 'My Task Management',
      '/my-logged-hours': 'My Logged Hours'
    };

    return routeTitles[this.currentRoute] || 'Dashboard';
  }

  getMPRTitle(): string {
    // Get month and year from session storage if available
    const monthYear = sessionStorage.getItem('currentMPRMonthYear');
    if (monthYear) {
      return `Monthly Performance Review - ${monthYear}`;
    }
    return 'Monthly Performance Review';
  }

  getPastReportsTitle(): string {
    // Get role-based title for Past Reports
    const code = (this.userSession?.isHOD || '').toString().toUpperCase();
    switch (code) {
      case 'E': return 'My Reports';
      case 'H': return 'Team Reports';
      case 'C': return 'All Reports';
      default: return 'Past Reports';
    }
  }

  isDashboardRoute(): boolean {
    return this.currentRoute === '/employee-dashboard' || 
           this.currentRoute === '/hod-dashboard' || 
           this.currentRoute === '/ced-dashboard' ||
           this.currentRoute === '/ced-dashboard-new';
  }

  getPageSubtitle(): string {
    if (this.currentRoute === '/ced-dashboard' || this.currentRoute === '/ced-dashboard-new') {
      return '';
    }
    
    // Add subtitle for Past Reports based on role
    if (this.currentRoute.includes('/past-reports')) {
      const code = (this.userSession?.isHOD || '').toString().toUpperCase();
      switch (code) {
        case 'E': return 'View your monthly performance reports';
        case 'H': return 'View and manage your team\'s performance reports';
        case 'C': return 'View all employee performance reports across the organization';
        default: return '';
      }
    }
    
    return '';
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

  closeSidebarOnMobile() {
    // Close sidebar on mobile when menu item is clicked
    if (window.innerWidth <= 768) {
      this.sidebarCollapsed = true;
    }
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
    return this.currentRoute.includes('/exit-form');
  }

  toggleMPRMenu() {
    this.isMPRMenuOpen = !this.isMPRMenuOpen;
  }

  isMPRRouteActive(): boolean {
    return this.currentRoute.includes('/monthly-dpr') || this.currentRoute.includes('/past-reports');
  }

  toggleDPRMenu() {
    this.isDPRMenuOpen = !this.isDPRMenuOpen;
  }

  // New method to open DPR in new tab
  openDPRInNewTab() {
    // Set a flag in localStorage that the new tab can read
    localStorage.setItem('dprOnlyMode', 'true');
    localStorage.setItem('dprModeTimestamp', Date.now().toString());
    
    // Open My Task page in new tab with URL parameter for immediate detection
    window.open('/my-task?dprMode=true', '_blank');
  }

  isDPRRouteActive(): boolean {
    return this.currentRoute.includes('/my-task') || 
           this.currentRoute.includes('/my-logged-hours') || 
           this.currentRoute.includes('/dpr');
  }

  toggleApprovalsMenu() {
    this.isApprovalsMenuOpen = !this.isApprovalsMenuOpen;
  }

  isApprovalsRouteActive(): boolean {
    return this.currentRoute.includes('/leave-approval') || 
           this.currentRoute.includes('/dpr-approval') || 
           this.currentRoute.includes('/approvals');
  }

  // Update menu states based on current route
  updateMenuStatesBasedOnRoute(): void {
    // Auto-open MPR menu if on MPR-related routes
    if (this.isMPRRouteActive()) {
      this.isMPRMenuOpen = true;
    }
    
    // Auto-open DPR menu if on DPR-related routes
    if (this.isDPRRouteActive()) {
      this.isDPRMenuOpen = true;
    }
    
    // Auto-open Exit Form menu if on exit form routes
    if (this.isExitFormRouteActive()) {
      this.isExitFormMenuOpen = true;
    }
    
    // Auto-open Approvals menu if on approval routes (future)
    if (this.isApprovalsRouteActive()) {
      this.isApprovalsMenuOpen = true;
    }
  }

  isLoggingOut = false;

  logout() {
    // Prevent multiple logout calls
    if (this.isLoggingOut) {
      return;
    }
    
    this.isLoggingOut = true;
    
    // Use auth service for proper logout
    this.authService.logout('manual');
    
    this.isLoggingOut = false;
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

  // Keyboard shortcuts for navigation
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    // Only trigger if not typing in an input field
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return;
    }

    // Navigation shortcuts
    switch (event.key) {
      case '1':
        // Navigate to Dashboard based on role
        if (this.isEmployee) {
          this.router.navigate(['/employee-dashboard']);
        } else if (this.isHod) {
          this.router.navigate(['/hod-dashboard']);
        } else if (this.isCed) {
          this.router.navigate(['/ced-dashboard']);
        }
        break;
      case '2':
        // Navigate to MPR Entry
        this.router.navigate(['/monthly-dpr']);
        break;
      case '3':
        // Navigate to Past Reports
        this.router.navigate(['/past-reports']);
        break;
      case '4':
        // Navigate to Profile
        this.router.navigate(['/profile']);
        break;
    }
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

    // Close sidebar on mobile when clicking outside
    if (window.innerWidth <= 768) {
      const sidebar = document.querySelector('.sidebar');
      const menuToggle = document.querySelector('.menu-toggle');
      
      // Check if click is outside sidebar and not on menu toggle
      if (sidebar && !sidebar.contains(target) && menuToggle && !menuToggle.contains(target)) {
        // Close sidebar if it's open
        if (!this.sidebarCollapsed) {
          this.sidebarCollapsed = true;
        }
      }
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
  trackNotificationById(_index: number, notification: any): number {
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

  // Handle avatar image errors
  onAvatarError(event: Event): void {
    AvatarUtil.handleImageError(event);
  }

  // Navigate to DPR route while maintaining DPR-only mode
  navigateDPRRoute(route: string): void {
    // Ensure DPR-only mode persists
    sessionStorage.setItem('isDPROnlyMode', 'true');
    
    // Close sidebar on mobile
    this.closeSidebarOnMobile();
    
    // Navigate to the route
    this.router.navigate([route]);
  }

  // Check if we're in DPR-only mode - improved detection with URL parameters
  private checkDPROnlyMode(): void {
    // Check if we're on a DPR-related route (clean the route first)
    const cleanRoute = this.currentRoute.split('?')[0].split('#')[0];
    const isDPRRoute = cleanRoute === '/my-task' || 
                       cleanRoute === '/my-logged-hours' || 
                       cleanRoute === '/dpr-approval';
    
    if (isDPRRoute) {
      // First check URL parameters for DPR mode
      const urlParams = new URLSearchParams(window.location.search);
      const dprModeFromURL = urlParams.get('dprMode');
      
      if (dprModeFromURL === 'true') {
        this.isDPROnlyMode = true;
        sessionStorage.setItem('isDPROnlyMode', 'true');
        // Clean up URL parameter
        const url = new URL(window.location.href);
        url.searchParams.delete('dprMode');
        window.history.replaceState({}, '', url.toString());
      }
      // Check localStorage for DPR mode flag
      else {
        const dprFlag = localStorage.getItem('dprOnlyMode');
        const timestamp = localStorage.getItem('dprModeTimestamp');
        
        if (dprFlag === 'true' && timestamp) {
          // Check if the flag is recent (within last 30 seconds)
          const isRecent = (Date.now() - parseInt(timestamp)) < 30000;
          
          if (isRecent) {
            this.isDPROnlyMode = true;
            // Move to sessionStorage for this session
            sessionStorage.setItem('isDPROnlyMode', 'true');
            // Clear localStorage flags
            localStorage.removeItem('dprOnlyMode');
            localStorage.removeItem('dprModeTimestamp');
          }
        }
        
        // Also check sessionStorage for existing session
        if (sessionStorage.getItem('isDPROnlyMode') === 'true') {
          this.isDPROnlyMode = true;
        }
      }
    } else {
      // If not on a DPR route, clear the DPR-only mode
      this.isDPROnlyMode = false;
      sessionStorage.removeItem('isDPROnlyMode');
    }
    
    // If in DPR-only mode, auto-open DPR menu
    if (this.isDPROnlyMode) {
      this.isDPRMenuOpen = true;
    }
    
    console.log('DPR-only mode check:', {
      isDPRRoute,
      cleanRoute,
      currentRoute: this.currentRoute,
      isDPROnlyMode: this.isDPROnlyMode,
      urlParams: new URLSearchParams(window.location.search).get('dprMode'),
      localStorage: localStorage.getItem('dprOnlyMode'),
      sessionStorage: sessionStorage.getItem('isDPROnlyMode')
    });
  }
}
