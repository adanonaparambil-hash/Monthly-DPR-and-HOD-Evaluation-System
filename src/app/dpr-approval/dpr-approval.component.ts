import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface PendingUser {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  initials?: string;
  pendingLogs: number;
  lastActivity: string;
  isSelected?: boolean;
}

interface DPRLog {
  id: string;
  date: string;
  project: string;
  projectType: 'internal' | 'client';
  taskTitle: string;
  taskDescription: string;
  category: string;
  categoryType: 'security' | 'backend' | 'feature' | 'bugfix';
  hours: string;
  status: 'pending' | 'approved' | 'rejected';
  isSelected?: boolean;
}

@Component({
  selector: 'app-dpr-approval',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dpr-approval.component.html',
  styleUrls: ['./dpr-approval.component.css']
})
export class DprApprovalComponent implements OnInit {
  selectedUser: PendingUser | null = null;
  fromDate = '2023-10-23';
  toDate = '2023-10-29';
  selectedProject = 'all';
  selectedTaskTypes = 'all';
  selectAll = false;

  // Pagination properties
  currentPage = 1;
  pageSize = 100;
  totalRecords = 0;
  totalPages = 0;
  displayedLogs: DPRLog[] = [];
  allDprLogs: DPRLog[] = []; // Store all logs

  pendingUsers: PendingUser[] = [
    {
      id: '1',
      name: 'Sarah Miller',
      role: 'Front-end Developer',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC5_s6ycPEg7DHhmJ1VyqXY0Phb_qLONHqfeyKjAcW7NGcquu1lVCxyIQZi7se1eEB_J3DBduHaZGjy3OGJ_cXgLjDCoYDS_h3p07rnnSceQya5CrmhjvYDjqi35JniOlzoFJ-PhBcd2p_mvcA2UNs1peISG1MAlmMlTgG0_D1VqKT-_6mvpvUsz7-GqE6lI11cuMVa7jfp7lJ_Xzg3h7U_jwuxyn6fVGig92BW3lM5S4cO8QyEU4YzOSmNs-CCxgWma8PkdYrj0409',
      pendingLogs: 8,
      lastActivity: '2h ago',
      isSelected: true
    },
    {
      id: '2',
      name: 'David Chen',
      role: 'Backend Engineer',
      initials: 'DC',
      pendingLogs: 5,
      lastActivity: '4h ago'
    },
    {
      id: '3',
      name: 'Alex Johnson',
      role: 'Product Designer',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbgcr89zuRQM5tEBF4nOOC_Ufk-L6BFr_7mjbCil0oUrkHz4X6jyLZUJMa01HnXIbS8FeSrPa7uH9M63izeT79w-f5fS2s2AIU3vxDbt6j4ChexuqUzEjXymAkdn-8NQ1DZHqs5bKDhP1MZdSS86XQ5aHnMBXaQ_3dx-xgqPAwlcHY4STDOyXE8a6t-Dl--fOMBUkXZVtDYsZjvGisn6IUUVxTL_m37uKRqMouq4Qdx1vkOe9N55ggfOWHd6LZMqx8FzNyQM5ilFrw',
      pendingLogs: 12,
      lastActivity: '1d ago'
    },
    {
      id: '4',
      name: 'Maria Rodriguez',
      role: 'QA Engineer',
      initials: 'MR',
      pendingLogs: 3,
      lastActivity: '1d ago'
    }
  ];

  dprLogs: DPRLog[] = [
    {
      id: '1',
      date: 'Oct 26, 2023',
      project: 'Internal Tools',
      projectType: 'internal',
      taskTitle: 'Implement OAuth2 Authentication Flow',
      taskDescription: 'Refactored the token exchange logic and integrated PKCE.',
      category: 'Security',
      categoryType: 'security',
      hours: '04:20',
      status: 'pending'
    },
    {
      id: '2',
      date: 'Oct 25, 2023',
      project: 'Client Work',
      projectType: 'client',
      taskTitle: 'Database Schema Migration',
      taskDescription: 'User metadata expansion script testing.',
      category: 'Back-end',
      categoryType: 'backend',
      hours: '01:52',
      status: 'pending'
    },
    {
      id: '3',
      date: 'Oct 24, 2023',
      project: 'Internal Tools',
      projectType: 'internal',
      taskTitle: 'UI Polish - Dashboard Widgets',
      taskDescription: 'Adjusted spacing and added empty states.',
      category: 'Feature',
      categoryType: 'feature',
      hours: '08:15',
      status: 'pending'
    },
    {
      id: '4',
      date: 'Oct 24, 2023',
      project: 'Client Work',
      projectType: 'client',
      taskTitle: 'Critical Bug: Data Export',
      taskDescription: 'Hotfix deployed to production.',
      category: 'Bug Fix',
      categoryType: 'bugfix',
      hours: '07:30',
      status: 'pending'
    }
  ];

  ngOnInit() {
    // Set the first user as selected by default
    if (this.pendingUsers.length > 0) {
      this.selectedUser = this.pendingUsers[0];
    }
    
    // Initialize all logs (simulating API data)
    this.initializeAllLogs();
    
    // Load first page
    this.loadPage(1);
  }

  // Initialize all logs - in real app, this would be from API
  initializeAllLogs() {
    // Store the initial logs
    this.allDprLogs = [...this.dprLogs];
    
    // Simulate more records for pagination demo
    // In real app, you would fetch from API with pagination params
    const additionalLogs: DPRLog[] = [];
    for (let i = 5; i <= 250; i++) {
      additionalLogs.push({
        id: i.toString(),
        date: `Oct ${20 + (i % 10)}, 2023`,
        project: i % 2 === 0 ? 'Internal Tools' : 'Client Work',
        projectType: i % 2 === 0 ? 'internal' : 'client',
        taskTitle: `Task ${i}: Development Work`,
        taskDescription: `Description for task ${i} with various details.`,
        category: ['Security', 'Back-end', 'Feature', 'Bug Fix'][i % 4],
        categoryType: ['security', 'backend', 'feature', 'bugfix'][i % 4] as any,
        hours: `0${Math.floor(Math.random() * 8) + 1}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
        status: 'pending'
      });
    }
    
    this.allDprLogs = [...this.allDprLogs, ...additionalLogs];
    this.totalRecords = this.allDprLogs.length;
    this.totalPages = Math.ceil(this.totalRecords / this.pageSize);
  }

  // Load specific page
  loadPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    
    this.currentPage = page;
    const startIndex = (page - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    
    // Simulate API call delay
    this.displayedLogs = this.allDprLogs.slice(startIndex, endIndex);
    
    // Reset selection when changing pages
    this.selectAll = false;
    this.displayedLogs.forEach(log => log.isSelected = false);
    
    // Scroll to top of table
    const tableWrapper = document.querySelector('.table-wrapper');
    if (tableWrapper) {
      tableWrapper.scrollTop = 0;
    }
  }

  // Navigate to next page
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.loadPage(this.currentPage + 1);
    }
  }

  // Navigate to previous page
  previousPage() {
    if (this.currentPage > 1) {
      this.loadPage(this.currentPage - 1);
    }
  }

  // Navigate to first page
  firstPage() {
    this.loadPage(1);
  }

  // Navigate to last page
  lastPage() {
    this.loadPage(this.totalPages);
  }

  // Go to specific page
  goToPage(page: number) {
    this.loadPage(page);
  }

  // Get page numbers to display
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    
    if (this.totalPages <= maxPagesToShow) {
      // Show all pages if total is less than max
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show current page and surrounding pages
      let startPage = Math.max(1, this.currentPage - 2);
      let endPage = Math.min(this.totalPages, this.currentPage + 2);
      
      // Adjust if at the beginning or end
      if (this.currentPage <= 3) {
        endPage = maxPagesToShow;
      } else if (this.currentPage >= this.totalPages - 2) {
        startPage = this.totalPages - maxPagesToShow + 1;
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  }

  // Get current page range text
  getCurrentPageRange(): string {
    const startRecord = (this.currentPage - 1) * this.pageSize + 1;
    const endRecord = Math.min(this.currentPage * this.pageSize, this.totalRecords);
    return `${startRecord}-${endRecord}`;
  }

  // Get serial number for a row based on pagination
  getSerialNumber(index: number): number {
    return (this.currentPage - 1) * this.pageSize + index + 1;
  }

  // TrackBy functions for performance
  trackByUserId(index: number, user: PendingUser): string {
    return user.id;
  }

  trackByLogId(index: number, log: DPRLog): string {
    return log.id;
  }

  selectUser(user: PendingUser) {
    // Reset previous selection
    this.pendingUsers.forEach(u => u.isSelected = false);
    
    // Set new selection
    user.isSelected = true;
    this.selectedUser = user;
  }

  toggleSelectAll() {
    this.selectAll = !this.selectAll;
    this.displayedLogs.forEach(log => log.isSelected = this.selectAll);
  }

  toggleLogSelection(log: DPRLog) {
    log.isSelected = !log.isSelected;
    
    // Update select all checkbox
    this.selectAll = this.displayedLogs.every(l => l.isSelected);
  }

  getSelectedLogsCount(): number {
    return this.displayedLogs.filter(log => log.isSelected).length;
  }

  getTotalPendingUsers(): number {
    return this.pendingUsers.length;
  }

  getProjectBadgeClass(projectType: string): string {
    return projectType === 'internal' ? 'internal' : 'client';
  }

  getCategoryBadgeClass(categoryType: string): string {
    return categoryType;
  }

  getUserInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  getInitialsClass(name: string): string {
    const colors = ['initials-blue', 'initials-pink', 'initials-green', 'initials-yellow', 'initials-purple'];
    const index = name.length % colors.length;
    return colors[index];
  }

  approveSelected() {
    const selectedLogs = this.displayedLogs.filter(log => log.isSelected);
    if (selectedLogs.length > 0) {
      console.log('Approving logs:', selectedLogs);
      // Implement approval logic here
      selectedLogs.forEach(log => {
        log.status = 'approved';
        log.isSelected = false;
      });
      this.selectAll = false;
      
      // Remove approved logs from allDprLogs
      this.allDprLogs = this.allDprLogs.filter(log => log.status !== 'approved');
      this.totalRecords = this.allDprLogs.length;
      this.totalPages = Math.ceil(this.totalRecords / this.pageSize);
      
      // Reload current page
      this.loadPage(Math.min(this.currentPage, this.totalPages || 1));
    }
  }

  cancelSelection() {
    this.displayedLogs.forEach(log => log.isSelected = false);
    this.selectAll = false;
  }
}