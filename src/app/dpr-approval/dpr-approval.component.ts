import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api } from '../services/api';
import { TaskBulkApprovalRequest } from '../models/TimeSheetDPR.model';

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

interface PendingApprovalUserResponse {
  employeeId: string;
  employeeName: string;
  designation: string;
  pendingLogCount: number;
  lastActivityDate: string;
  employeeImage: string | null;
  employeeImageBase64: string | null;
}

interface Project {
  projectId: number;
  projectName: string;
  projectCode?: string;
}

interface Department {
  departmentId: number;
  deptCode: string;
  deptName: string;
  status: string;
  createdBy: string;
  createdOn: string;
}

interface TaskCategory {
  categoryId: number;
  categoryName: string;
  departmentId: number;
  estimatedhours: number;
  departmentName: string;
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
  selectedProject: string | number = 'all';
  selectedDepartment: string | number = 'all';
  selectedTaskCategory: string | number = 'all';
  selectAll = false;

  // Pagination properties
  currentPage = 1;
  pageSize = 100;
  totalRecords = 0;
  totalPages = 0;
  displayedLogs: DPRLog[] = [];
  allDprLogs: DPRLog[] = []; // Store all logs

  pendingUsers: PendingUser[] = [];
  projects: Project[] = [];
  departments: Department[] = [];
  taskCategories: TaskCategory[] = [];

  constructor(private api: Api) {}

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
    // Load pending approval users from API
    this.loadPendingApprovalUsers();
    
    // Load projects for dropdown
    this.loadProjects();
    
    // Load departments for dropdown
    this.loadDepartments();
    
    // Set default dates (last 7 days)
    this.setDefaultDates();
    
    // Load approval list
    this.loadApprovalList();
  }

  setDefaultDates() {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    
    this.toDate = this.formatDateForInput(today);
    this.fromDate = this.formatDateForInput(lastWeek);
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDateForAPI(dateString: string): string {
    if (!dateString) return '';
    // Convert YYYY-MM-DD to format expected by API
    return dateString;
  }

  loadPendingApprovalUsers() {
    // Get current user ID from local storage
    const currentUser = localStorage.getItem('current_user');
    if (!currentUser) {
      console.error('No user session found');
      return;
    }

    const userData = JSON.parse(currentUser);
    const userId = userData.employeeId;

    console.log('Calling getPendingApprovalUsers API with userId:', userId);

    this.api.getPendingApprovalUsers(userId).subscribe({
      next: (response) => {
        console.log('getPendingApprovalUsers API Response:', response);
        
        if (response.success && response.data) {
          this.pendingUsers = response.data.map((user: PendingApprovalUserResponse, index: number) => ({
            id: user.employeeId,
            name: user.employeeName,
            role: user.designation,
            avatar: user.employeeImageBase64 || user.employeeImage || undefined,
            initials: this.getUserInitials(user.employeeName),
            pendingLogs: user.pendingLogCount,
            lastActivity: this.formatLastActivity(user.lastActivityDate),
            isSelected: index === 0 // Select first user by default
          }));

          console.log('Mapped pending users:', this.pendingUsers);

          // Set the first user as selected by default
          if (this.pendingUsers.length > 0) {
            this.selectedUser = this.pendingUsers[0];
          }
        } else {
          console.warn('API response success is false or no data:', response);
        }
      },
      error: (error) => {
        console.error('Error loading pending approval users:', error);
      }
    });
  }

  formatLastActivity(dateString: string): string {
    if (!dateString) return 'N/A';
    
    const activityDate = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - activityDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return diffMins <= 1 ? '1m ago' : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return diffHours === 1 ? '1h ago' : `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return diffDays === 1 ? '1d ago' : `${diffDays}d ago`;
    } else {
      return activityDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  loadProjects() {
    console.log('Calling getProjects API');
    
    this.api.getProjects().subscribe({
      next: (response) => {
        console.log('getProjects API Response:', response);
        
        if (response.success && response.data) {
          this.projects = response.data;
          console.log('Loaded projects:', this.projects);
        } else {
          console.warn('API response success is false or no data:', response);
        }
      },
      error: (error) => {
        console.error('Error loading projects:', error);
      }
    });
  }

  loadDepartments() {
    console.log('Calling getDepartmentList API');
    
    this.api.getDepartmentList().subscribe({
      next: (response) => {
        console.log('getDepartmentList API Response:', response);
        
        if (response.success && response.data) {
          // Filter only active departments (status === 'Y')
          this.departments = response.data.filter((dept: Department) => dept.status === 'Y');
          console.log('Loaded departments:', this.departments);
        } else {
          console.warn('API response success is false or no data:', response);
        }
      },
      error: (error) => {
        console.error('Error loading departments:', error);
      }
    });
  }

  onDepartmentChange() {
    console.log('Department changed to:', this.selectedDepartment);
    
    // Reset task category selection
    this.selectedTaskCategory = 'all';
    this.taskCategories = [];
    
    // If "All Departments" is selected, don't load categories
    if (this.selectedDepartment === 'all') {
      return;
    }
    
    // Load task categories for the selected department
    this.loadDepartmentTaskCategories(Number(this.selectedDepartment));
  }

  loadDepartmentTaskCategories(departmentId: number) {
    console.log('Calling getDepartmentTaskCategories API with departmentId:', departmentId);
    
    this.api.getDepartmentTaskCategories(departmentId).subscribe({
      next: (response) => {
        console.log('getDepartmentTaskCategories API Response:', response);
        
        if (response.success && response.data) {
          // Combine all categories from favouriteList, departmentList, and allDepartmentList
          const allCategories = [
            ...(response.data.favouriteList || []),
            ...(response.data.departmentList || []),
            ...(response.data.allDepartmentList || [])
          ];
          
          // Remove duplicates based on categoryId
          const uniqueCategories = allCategories.filter((category, index, self) =>
            index === self.findIndex((c) => c.categoryId === category.categoryId)
          );
          
          this.taskCategories = uniqueCategories;
          console.log('Loaded task categories:', this.taskCategories);
        } else {
          console.warn('API response success is false or no data:', response);
        }
      },
      error: (error) => {
        console.error('Error loading task categories:', error);
      }
    });
  }

  loadApprovalList() {
    if (!this.selectedUser) {
      console.warn('No user selected');
      return;
    }

    const employeeId = this.selectedUser.id;
    const fromDateFormatted = this.formatDateForAPI(this.fromDate);
    const toDateFormatted = this.formatDateForAPI(this.toDate);
    const projectId = this.selectedProject === 'all' ? 0 : Number(this.selectedProject);
    const categoryId = this.selectedTaskCategory === 'all' ? 0 : Number(this.selectedTaskCategory);

    console.log('Calling GetEmployeeApprovalListPaged API with params:', {
      employeeId,
      pageNo: this.currentPage,
      pageSize: this.pageSize,
      fromDate: fromDateFormatted,
      toDate: toDateFormatted,
      projectId,
      categoryId
    });

    this.api.GetEmployeeApprovalListPaged(
      employeeId,
      this.currentPage,
      this.pageSize,
      fromDateFormatted,
      toDateFormatted,
      projectId,
      categoryId
    ).subscribe({
      next: (response) => {
        console.log('GetEmployeeApprovalListPaged API Response:', response);
        
        if (response.success && response.data) {
          // Map the API response to DPRLog format
          this.displayedLogs = response.data.items?.map((item: any) => ({
            id: item.taskId?.toString() || item.id,
            date: this.formatDisplayDate(item.taskDate || item.date),
            project: item.projectName || item.project,
            projectType: item.projectType || 'internal',
            taskTitle: item.taskTitle || item.title,
            taskDescription: item.dailyRemarks || item.taskDescription || item.description,
            category: item.categoryName || item.category,
            categoryType: item.categoryType || 'feature',
            hours: this.formatHours(item.totalHours || item.hours),
            status: 'pending',
            isSelected: false
          })) || [];

          this.totalRecords = response.data.totalRecords || 0;
          this.totalPages = Math.ceil(this.totalRecords / this.pageSize);
          
          console.log('Loaded approval logs:', this.displayedLogs);
          console.log('Total records:', this.totalRecords);
        } else {
          console.warn('API response success is false or no data:', response);
          this.displayedLogs = [];
          this.totalRecords = 0;
          this.totalPages = 0;
        }
      },
      error: (error) => {
        console.error('Error loading approval list:', error);
        this.displayedLogs = [];
        this.totalRecords = 0;
        this.totalPages = 0;
      }
    });
  }

  formatDisplayDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatHours(hours: number | string): string {
    if (typeof hours === 'string') return hours;
    if (!hours) return '00:00';
    
    const totalMinutes = Math.round(hours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  applyFilters() {
    // Reset to first page when applying filters
    this.currentPage = 1;
    this.loadApprovalList();
  }

  // Initialize all logs - in real app, this would be from API
  initializeAllLogs() {
    // This method is no longer needed as we're using real API data
    // Keeping it for backward compatibility but it won't be called
  }

  // Load specific page
  loadPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    
    this.currentPage = page;
    
    // Load data from API with new page number
    this.loadApprovalList();
    
    // Reset selection when changing pages
    this.selectAll = false;
    
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
    
    // Load approval list for the selected user
    this.currentPage = 1;
    this.loadApprovalList();
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
    if (selectedLogs.length === 0) {
      console.warn('No logs selected for approval');
      return;
    }

    // Get current user (approver) from localStorage
    const currentUser = localStorage.getItem('current_user');
    if (!currentUser) {
      console.error('No user session found');
      return;
    }

    const approverData = JSON.parse(currentUser);
    const approverId = approverData.employeeId;

    // Get the selected user (whose logs are being approved)
    if (!this.selectedUser) {
      console.error('No user selected');
      return;
    }

    const userId = this.selectedUser.id;

    // Extract approval IDs from selected logs
    const approvalIds = selectedLogs.map(log => Number(log.id));

    // Determine if this is a full approval (all displayed logs are selected)
    const fullApprove = this.selectAll && selectedLogs.length === this.displayedLogs.length;

    // Create the approval request
    const approvalRequest: TaskBulkApprovalRequest = {
      taskId: 0, // Not used for bulk approval
      userId: userId,
      approverId: approverId,
      approvalIds: approvalIds,
      action: 'APPROVAL',
      fullApprove: fullApprove
    };

    console.log('Calling BulkTaskApproval API with request:', approvalRequest);

    this.api.bulkTaskApproval(approvalRequest).subscribe({
      next: (response: any) => {
        console.log('BulkTaskApproval API Response:', response);
        
        if (response.success) {
          console.log('Approval successful:', response.message);
          
          // Reset selections
          this.selectAll = false;
          this.displayedLogs.forEach(log => log.isSelected = false);
          
          // Reload the approval list to reflect changes
          this.loadApprovalList();
          
          // Show success message (you can integrate a toaster service here)
          alert(response.message || 'Tasks approved successfully');
        } else {
          console.error('Approval failed:', response.message);
          alert(response.message || 'Failed to approve tasks');
        }
      },
      error: (error: any) => {
        console.error('Error approving tasks:', error);
        alert('An error occurred while approving tasks');
      }
    });
  }

  cancelSelection() {
    this.displayedLogs.forEach(log => log.isSelected = false);
    this.selectAll = false;
  }
}