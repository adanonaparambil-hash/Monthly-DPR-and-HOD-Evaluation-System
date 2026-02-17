import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api } from '../services/api';
import { TaskBulkApprovalRequest } from '../models/TimeSheetDPR.model';
import { TaskDetailsModalComponent } from '../components/task-details-modal/task-details-modal.component';
import { ToasterComponent } from '../components/toaster/toaster.component';
import { SessionService } from '../services/session.service';
import Swal from 'sweetalert2';

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
  taskId?: number;
  categoryId?: number;
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
  imports: [CommonModule, FormsModule, ToasterComponent, TaskDetailsModalComponent],
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

  // Task details modal properties
  showTaskDetailsModal = false;
  selectedTaskIdForModal: number = 0;
  selectedUserIdForModal: string = '';
  selectedCategoryIdForModal: number = 0;

  constructor(
    private api: Api,
    private sessionService: SessionService
  ) {}

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
    const userId = userData.empId || userData.employeeId;

    if (!userId) {
      console.error('Employee ID not found in session');
      return;
    }

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
      next: (response: any) => {
        console.log('GetEmployeeApprovalListPaged API Response:', response);
        
        if (response.success && response.data) {
          // Map the API response to DPRLog format
          // API returns: data.records (array) and data.totalCount (number)
          this.displayedLogs = response.data.records?.map((item: any) => ({
            id: item.approvalId?.toString() || item.taskId?.toString(),
            taskId: item.taskId, // Store taskId separately for approval
            categoryId: item.categoryID || item.categoryId, // Store categoryId from API
            date: this.formatDisplayDate(item.logDate),
            project: item.project || 'N/A',
            projectType: 'internal',
            taskTitle: item.taskTitle || 'No Title',
            taskDescription: item.dailyRemarks || item.taskDescription || 'No Description',
            category: item.category || 'N/A',
            categoryType: 'feature',
            hours: this.formatHours(item.hours),
            status: item.status?.toLowerCase() || 'pending',
            isSelected: false
          })) || [];

          this.totalRecords = response.data.totalCount || 0;
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
      error: (error: any) => {
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
      Swal.fire({
        icon: 'warning',
        title: 'No Selection',
        text: 'Please select at least one record to approve',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    // Show confirmation dialog
    Swal.fire({
      title: 'Confirm Approval',
      text: `Do you want to approve ${selectedLogs.length} selected record(s)?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Yes, Approve',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.performApproval(selectedLogs);
      }
    });
  }

  performApproval(selectedLogs: DPRLog[]) {
    // Get current user (approver) from localStorage
    const currentUser = localStorage.getItem('current_user');
    if (!currentUser) {
      Swal.fire({
        icon: 'error',
        title: 'Session Error',
        text: 'No user session found. Please login again.',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    const approverData = JSON.parse(currentUser);
    const approverId = approverData.empId || approverData.employeeId;

    if (!approverId) {
      console.error('User session data:', approverData);
      Swal.fire({
        icon: 'error',
        title: 'Session Error',
        text: 'Employee ID not found in session. Please login again.',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    console.log('Approver ID:', approverId);

    // Get the selected user (whose logs are being approved)
    if (!this.selectedUser) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No user selected',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    const userId = this.selectedUser.id;

    // Get the first selected log's taskId (or use 0 if not available)
    const taskId = selectedLogs[0]?.taskId || 0;

    // Extract approval IDs from selected logs (using the 'id' which is approvalId)
    const approvalIds = selectedLogs.map(log => Number(log.id));

    // Determine fullApprove based on whether "Select All" checkbox was used
    // fullApprove = 'Y' if header checkbox is checked and all displayed logs are selected
    // fullApprove = 'N' if only individual checkboxes are selected
    const fullApprove = (this.selectAll && selectedLogs.length === this.displayedLogs.length) ? 'Y' : 'N';

    // Create the approval request
    const approvalRequest: TaskBulkApprovalRequest = {
      taskId: taskId,
      userId: userId,
      approverId: approverId,
      approvalIds: approvalIds,
      action: 'A',
      fullApprove: fullApprove
    };

    console.log('Calling BulkTaskApproval API with request:', approvalRequest);

    this.api.bulkTaskApproval(approvalRequest).subscribe({
      next: (response: any) => {
        console.log('BulkTaskApproval API Response:', response);
        
        if (response.success) {
          // Reset selections
          this.selectAll = false;
          this.displayedLogs.forEach(log => log.isSelected = false);
          
          // Reload the approval list to reflect changes
          this.loadApprovalList();
          
          // Show success message with SweetAlert
          Swal.fire({
            icon: 'success',
            title: 'Approval Successful',
            text: response.message || 'Tasks approved successfully',
            confirmButtonColor: '#10b981',
            timer: 3000
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Approval Failed',
            text: response.message || 'Failed to approve tasks',
            confirmButtonColor: '#3b82f6'
          });
        }
      },
      error: (error: any) => {
        console.error('Error approving tasks:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'An error occurred while approving tasks',
          confirmButtonColor: '#3b82f6'
        });
      }
    });
  }

  cancelSelection() {
    this.displayedLogs.forEach(log => log.isSelected = false);
    this.selectAll = false;
  }

  onRowClick(log: DPRLog, event: MouseEvent) {
    // Don't open modal if clicking on checkbox
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('.checkbox-col')) {
      return;
    }

    // Open task details modal
    this.openTaskDetailsModal(log);
  }

  showTaskDetails(log: DPRLog) {
    // Open task details modal instead of SweetAlert
    this.openTaskDetailsModal(log);
  }

  // Open task details modal when clicking on a DPR log
  openTaskDetailsModal(log: DPRLog) {
    const taskId = log.taskId || 0;
    
    if (!taskId) {
      console.error('Invalid task ID for log:', log);
      return;
    }

    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    // Use categoryId directly from the log (from API response)
    // Fallback to looking it up by name if not available
    const categoryId = log.categoryId || this.getCategoryIdFromName(log.category);
    
    console.log('Opening task details modal from DPR Approval:', {
      taskId: taskId,
      userId: userId,
      categoryId: categoryId,
      categoryIdFromLog: log.categoryId,
      category: log.category
    });
    
    // Set properties for standalone modal component
    this.selectedTaskIdForModal = taskId;
    this.selectedUserIdForModal = userId;
    this.selectedCategoryIdForModal = categoryId || 0;
    
    // Show the modal
    this.showTaskDetailsModal = true;
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  // Helper method to get category ID from category name (fallback)
  private getCategoryIdFromName(categoryName: string): number {
    // Try to find the category ID from the task categories list
    const category = this.taskCategories.find(cat => cat.categoryName === categoryName);
    if (category) {
      return category.categoryId;
    }
    
    // If not found, return 0 (will need to be handled by the modal)
    console.warn('Category ID not found for:', categoryName);
    return 0;
  }

  // Close task details modal
  closeTaskDetailsModal() {
    this.showTaskDetailsModal = false;
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Reload approval list to reflect any changes
    this.loadApprovalList();
  }

  // Handle task updated event from modal
  onTaskUpdated(task: any) {
    console.log('Task updated from modal:', task);
    // Reload approval list to reflect changes
    this.loadApprovalList();
  }

  // Handle task paused event from modal
  onTaskPaused(taskId: number) {
    console.log('Task paused from modal:', taskId);
  }

  // Handle task resumed event from modal
  onTaskResumed(taskId: number) {
    console.log('Task resumed from modal:', taskId);
  }

  // Handle task stopped event from modal
  onTaskStopped(taskId: number) {
    console.log('Task stopped from modal:', taskId);
    // Reload approval list to reflect changes
    this.loadApprovalList();
  }
}