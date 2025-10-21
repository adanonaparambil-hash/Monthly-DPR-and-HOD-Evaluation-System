import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { trigger, transition, style, animate, state } from '@angular/animations';
import { filter } from 'rxjs/operators';
import { Theme } from '../services/theme';
import { Api } from '../services/api';

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
export class layout implements OnInit {
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

  constructor(private router: Router, private themeService: Theme, private api: Api) {
    // Subscribe to theme changes
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
  }

  ngOnInit() {
    // Track route changes for page title
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute = event.url;
    });

    // Theme is automatically applied by the service

    // Load notifications on component init
    this.loadNotifications();
    //this.loadNotificationCount();

    // Set up periodic refresh for notifications (every 30 seconds)
    // setInterval(() => {
    //   this.loadNotificationCount();
    // }, 30000);
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
    return routeTitles[this.currentRoute] || 'Dashboard';
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    this.showProfile = false;

    // Load notifications when dropdown is opened
    if (this.showNotifications) {
      this.loadNotifications();
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

    this.api.markAllNotificationsAsRead(userId).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationCount = 0;
          this.hasNewNotifications = false;
          this.showNotifications = false;

          // Update all notifications to read status
          this.notifications.forEach(notification => {
            notification.isRead = true;
          });

          console.log('All notifications marked as read');
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
    this.router.navigate(['/login']);
    localStorage.removeItem('access_token');
    localStorage.clear();
    sessionStorage.clear();
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

  // Load notifications from API
  loadNotifications() {
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
          // Map notifications - response.data is directly the array of notifications
          this.notifications = response.data.map((notification: any) => ({
            id: notification.id,
            icon: this.getNotificationIcon(notification.title),
            message: notification.message,
            time: this.formatNotificationTime(notification.createdAt),
            isRead: notification.isRead,
            link: notification.link
          }));

          // Calculate unread count from the notifications array
          const newCount = this.notifications.filter(n => !n.isRead).length;



          // Check if there are new notifications
          if (newCount > this.notificationCount) {
            this.hasNewNotifications = true;

            // Auto-reset new notification flag after 5 seconds
            setTimeout(() => {
              this.hasNewNotifications = false;
            }, 5000);
          }

          this.notificationCount = newCount;
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

  // Load notification count (now handled by loadNotifications)
  loadNotificationCount() {
    // We get the unread count from getUserNotifications API response
    // So we just call loadNotifications which handles both notifications and count
    this.loadNotifications();
  }

  // Mark single notification as read
  markNotificationAsRead(notificationId: number) {
    this.api.markNotificationAsRead(notificationId).subscribe({
      next: (response) => {
        if (response.success) {
          // Update the notification in the local array
          const notification = this.notifications.find(n => n.id === notificationId);
          if (notification) {
            notification.isRead = true;
          }

          // Update the count by reloading notifications
          this.loadNotifications();
        }
      },
      error: (error) => {
        console.error('Error marking notification as read:', error);
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
