import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { trigger, transition, style, animate, state } from '@angular/animations';
import { filter } from 'rxjs/operators';
import { Theme } from '../services/theme';

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
  
  notificationCount = 3;
  notifications = [
    {
      icon: 'fas fa-check-circle text-success',
      message: 'Your DPR report has been approved',
      time: '2 minutes ago'
    },
    {
      icon: 'fas fa-exclamation-triangle text-warning',
      message: 'Pending evaluation for Alex Thompson',
      time: '1 hour ago'
    },
    {
      icon: 'fas fa-info-circle text-info',
      message: 'New performance metrics available',
      time: '3 hours ago'
    }
  ];


  
 userSession = JSON.parse(localStorage.getItem('current_user') || '{}');
 

  userProfile = {
    name: this.userSession.employeeName || '',
    role: this.userSession.designation || '',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face&auto=format'
  };

  constructor(private router: Router, private themeService: Theme) {
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
  }

  getPageTitle(): string {
    const routeTitles: { [key: string]: string } = {
      '/dashboard': 'Dashboard',
      '/employee-dashboard': 'Employee Analytics',
      '/hod-dashboard': 'HOD Dashboard',
      '/ced-dashboard': 'CED Dashboard',
      '/monthly-dpr': 'DPR Report',
      '/past-reports': 'Past Reports',
      '/profile': 'My Profile'
    };
    return routeTitles[this.currentRoute] || 'Dashboard';
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    this.showProfile = false;
  }

  toggleProfile() {
    this.showProfile = !this.showProfile;
    this.showNotifications = false;
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  markAllAsRead() {
    this.notificationCount = 0;
    this.showNotifications = false;
  }

  logout() {
    this.router.navigate(['/login']);
    localStorage.removeItem('access_token');
    localStorage.clear();
    sessionStorage.clear();
  }

  

}
