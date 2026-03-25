import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api } from '../services/api';
import { TaskBulkApprovalRequest, DecreaseTimeLogRequest } from '../models/TimeSheetDPR.model';
import { TaskDetailsModalComponent } from '../components/task-details-modal/task-details-modal.component';
import { ToasterComponent } from '../components/toaster/toaster.component';
import { ToasterService } from '../services/toaster.service';
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
  userId?: string;
  date: string;
  rawDate?: string; // Raw ISO date from API for API calls
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

  // Search property
  searchTerm: string = '';

  // Pagination properties
  currentPage = 1;
  pageSize = 500;
  totalRecords = 0;
  totalPages = 0;
  displayedLogs: DPRLog[] = [];
  allDprLogs: DPRLog[] = []; // Store all logs

  pendingUsers: PendingUser[] = [];
  filteredPendingUsers: PendingUser[] = [];
  projects: Project[] = [];
  departments: Department[] = [];
  taskCategories: TaskCategory[] = [];

  // Task details modal properties
  showTaskDetailsModal = false;
  selectedTaskIdForModal: number = 0;
  selectedUserIdForModal: string = '';
  selectedCategoryIdForModal: number = 0;
  isTaskModalViewOnly: boolean = true; // Always view-only in DPR Approval

  // Day Log History modal properties
  showDayLogHistoryModal = false;
  selectedLogForDayHistory: DPRLog | null = null;
  dayLogHistory: any[] = [];
  isLoadingDayLogs = false;

  constructor(
    private api: Api,
    private sessionService: SessionService,
    private toasterService: ToasterService
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
    
    // Set To Date as today
    this.toDate = this.formatDateForInput(today);
    
    // Set From Date as January 1st of current year (2026-01-01)
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1); // Month 0 = January
    this.fromDate = this.formatDateForInput(firstDayOfYear);
    
    console.log('Default dates set:', {
      fromDate: this.fromDate,
      toDate: this.toDate
    });
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

  // Refresh pending users list while keeping the current user selected
  refreshPendingUsersKeepSelection(currentSelectedUserId: string | undefined) {
    const currentUser = localStorage.getItem('current_user');
    if (!currentUser) return;

    const userData = JSON.parse(currentUser);
    const userId = userData.empId || userData.employeeId;
    if (!userId) return;

    this.api.getPendingApprovalUsers(userId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.pendingUsers = response.data.map((user: PendingApprovalUserResponse) => ({
            id: user.employeeId,
            name: user.employeeName,
            role: user.designation,
            avatar: user.employeeImageBase64 || user.employeeImage || undefined,
            initials: this.getUserInitials(user.employeeName),
            pendingLogs: user.pendingLogCount,
            lastActivity: this.formatLastActivity(user.lastActivityDate),
            // Keep the previously selected user highlighted, not auto-select first
            isSelected: user.employeeId === currentSelectedUserId
          }));

          // Restore selectedUser reference to the same user (updated data)
          const stillExists = this.pendingUsers.find(u => u.id === currentSelectedUserId);
          if (stillExists) {
            this.selectedUser = stillExists;
          }
          // If the user no longer exists in the list (all their logs approved),
          // select the first user and load their records
          else if (this.pendingUsers.length > 0) {
            this.pendingUsers[0].isSelected = true;
            this.selectedUser = this.pendingUsers[0];
            this.loadApprovalList();
          } else {
            this.selectedUser = null;
            this.displayedLogs = [];
          }
        }
      },
      error: (error) => {
        console.error('Error refreshing pending users:', error);
      }
    });
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

          // Initialize filtered list
          this.filteredPendingUsers = [...this.pendingUsers];

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

  // Search method for pending users
  onSearchChange(searchValue: string) {
    this.searchTerm = searchValue.toLowerCase().trim();
    this.filterPendingUsers();
  }

  // Filter pending users based on search term
  filterPendingUsers() {
    if (!this.searchTerm) {
      this.filteredPendingUsers = [...this.pendingUsers];
    } else {
      this.filteredPendingUsers = this.pendingUsers.filter(user =>
        user.name.toLowerCase().includes(this.searchTerm) ||
        user.role.toLowerCase().includes(this.searchTerm)
      );
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
          this.displayedLogs = response.data.records?.map((item: any) => {
            // Extract userId - try multiple possible field names from API
            const userId = item.userId || item.empId || item.employeeId || item.UserId || item.EmpId || '';
            
            // If still no userId, use the selected user's ID as fallback
            const finalUserId = userId || this.selectedUser?.id || '';
            
            console.log('Mapping approval record:', {
              approvalId: item.approvalId,
              taskId: item.taskId,
              userId: finalUserId,
              rawUserId: item.userId,
              rawEmpId: item.empId,
              rawEmployeeId: item.employeeId,
              selectedUserId: this.selectedUser?.id
            });
            
            return {
              id: item.approvalId?.toString() || item.taskId?.toString(),
              taskId: item.taskId, // Store taskId separately for approval
              categoryId: item.categoryID || item.categoryId, // Store categoryId from API
              userId: finalUserId, // Store userId from API or fallback to selected user
              date: this.formatDisplayDate(item.logDate),
              rawDate: item.logDate || '', // Keep raw ISO date for API calls
              project: item.project || 'N/A',
              projectType: 'internal',
              taskTitle: item.taskTitle || '-',
              taskDescription: item.dailyRemarks || item.taskDescription || '-',
              category: item.category || 'N/A',
              categoryType: 'feature',
              hours: this.formatHours(item.hours),
              status: item.status?.toLowerCase() || 'pending',
              isSelected: false
            };
          }) || [];

          this.totalRecords = response.data.totalCount || 0;
          this.totalPages = Math.ceil(this.totalRecords / this.pageSize);
          
          console.log('Loaded approval logs:', this.displayedLogs.length, 'records');
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

          // Remember the currently selected user before refreshing
          const currentSelectedUserId = this.selectedUser?.id;

          // Reload approval list for the current user first
          this.loadApprovalList();

          // Refresh pending users sidebar without changing the selected user
          this.refreshPendingUsersKeepSelection(currentSelectedUserId);
          
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

    // IMPORTANT: Use the record's userId (from the selected employee record)
    // NOT the session userId (which is the HOD/approver)
    const recordUserId = log.userId || '';
    
    if (!recordUserId) {
      console.error('No userId found in log record:', log);
      // Fallback to selected user's ID if log doesn't have userId
      const userId = this.selectedUser?.id || '';
      console.warn('Using selected user ID as fallback:', userId);
      this.selectedUserIdForModal = userId;
    } else {
      console.log('Using record userId:', recordUserId);
      this.selectedUserIdForModal = recordUserId;
    }
    
    // Use categoryId directly from the log (from API response)
    const categoryId = log.categoryId || this.getCategoryIdFromName(log.category);
    
    console.log('Opening task details modal from DPR Approval:', {
      taskId: taskId,
      userId: this.selectedUserIdForModal,
      recordUserId: recordUserId,
      selectedUserFromList: this.selectedUser?.id,
      categoryId: categoryId,
      logData: log
    });
    
    // Set properties for standalone modal component
    this.selectedTaskIdForModal = taskId;
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

  // ===== Day Log History Modal =====

  openDayLogHistoryModal(log: DPRLog, event: Event) {
    event.stopPropagation();
    this.selectedLogForDayHistory = log;
    this.showDayLogHistoryModal = true;
    this.loadDayLogHistory(log);
    document.body.style.overflow = 'hidden';
  }

  closeDayLogHistoryModal() {
    this.showDayLogHistoryModal = false;
    this.selectedLogForDayHistory = null;
    this.dayLogHistory = [];
    document.body.style.overflow = '';
  }

  loadDayLogHistory(log: DPRLog) {
    this.isLoadingDayLogs = true;
    const taskId = log.taskId || 0;
    const userId = log.userId || this.selectedUser?.id || '';
    // logDate: use the raw ISO date from the API response
    const logDate = log.rawDate || log.date;

    this.api.getUserTaskDayLogHistory({ userId, taskId, logDate }).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.dayLogHistory = response.data;
        } else {
          this.dayLogHistory = [];
        }
        this.isLoadingDayLogs = false;
      },
      error: () => {
        this.dayLogHistory = [];
        this.isLoadingDayLogs = false;
        this.toasterService.showError('Error', 'Failed to load day log history');
      }
    });
  }

  formatLogDateOnly(dateTime: string | Date): string {
    if (!dateTime) return 'N/A';
    const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatTimeOnly(timeString: string | Date): string {
    if (!timeString) return 'N/A';
    const date = typeof timeString === 'string' ? new Date(timeString) : timeString;
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  getDayLogStatusClass(status: string): string {
    if (!status) return '';
    switch (status.toUpperCase().trim()) {
      case 'RUNNING': return 'status-running';
      case 'COMPLETED': return 'status-completed';
      case 'PAUSED': return 'status-paused';
      default: return '';
    }
  }

  editDayLog(log: any) {
    console.log('Edit day log:', log);
    // Always show Log Time popup for all records
    this.openLogTimePopup(log);
  }

  openLogTimePopup(log: any) {
    // Store the current DPR log for refreshing after save
    this.currentDPRLog = log;
    
    // Prepare all popup data first
    this.logTimeTimeLogId = log.timeLogId || 0;
    this.logTimeStatus = (log.status || 'AUTO CLOSED').toUpperCase();

    // Parse original minutes from minutesSpent, or fall back to parsing log.duration string
    let originalMinutes = log.minutesSpent || log.totalMinutes || 0;
    if (!originalMinutes && log.duration) {
      const parts = (log.duration as string).split(':');
      if (parts.length === 2) {
        originalMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      }
    }
    this.logTimeOriginalMinutes = originalMinutes;
    this.logTimeTotalMinutes = originalMinutes;

    const h = Math.floor(this.logTimeTotalMinutes / 60);
    const m = this.logTimeTotalMinutes % 60;
    this.logTimeTotalDisplay = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.logTimeEditValue = this.logTimeTotalDisplay;

    // Bind date
    if (log.logDate) {
      const d = new Date(log.logDate);
      this.logTimeDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else {
      this.logTimeDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // Bind start/end time
    this.logTimeStartTime = log.startTime ? new Date(log.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '09:00 AM';
    this.logTimeEndTime = log.endTime ? new Date(log.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '11:30 AM';

    this.isEditingLogTime = false;

    // Keep Day Log History modal open — ltp-modal-overlay covers it via position:absolute
    this.showLogTimePopup = true;
  }

  // ===== Log Time Popup (rendered at dpr-approval level to escape stacking context) =====
  showLogTimePopup = false;
  logTimeDate = '';
  logTimeStartTime = '09:00 AM';
  logTimeEndTime = '11:30 AM';
  logTimeTotalMinutes = 150;
  logTimeTotalDisplay = '02:30';
  logTimeEditValue = '02:30';
  isEditingLogTime = false;
  private logTimeTaskId = 0;
  private logTimeUserId = '';
  private logTimeTimeLogId = 0;
  logTimeStatus = '';
  private logTimeOriginalMinutes = 0;
  private currentDPRLog: DPRLog | null = null;

  onShowLogTime(data: any) {
    if (!data) { this.showLogTimePopup = false; return; }
    this.logTimeTaskId = data.taskId;
    this.logTimeUserId = data.userId;
    this.logTimeDate = data.date;
    this.logTimeStartTime = data.startTime || '09:00 AM';
    this.logTimeEndTime = data.endTime || '11:30 AM';
    this.logTimeTotalMinutes = data.totalMinutes || 0;
    this.logTimeOriginalMinutes = data.totalMinutes || 0;
    this.logTimeTotalDisplay = data.totalDisplay || '00:00';
    this.logTimeEditValue = data.totalDisplay || '00:00';
    this.logTimeTimeLogId = data.timeLogId || 0;
    this.logTimeStatus = data.status || 'AUTO CLOSED';
    this.isEditingLogTime = false;
    this.showLogTimePopup = true;
  }

  closeLogTimePopup() {
    this.showLogTimePopup = false;
  }

  onLogTimeStartEndChange() {
    try {
      const parseTime = (t: string) => {
        const [time, period] = t.trim().split(' ');
        let [h, m] = time.split(':').map(Number);
        if (period?.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (period?.toUpperCase() === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      };
      const diff = parseTime(this.logTimeEndTime) - parseTime(this.logTimeStartTime);
      if (diff > 0) {
        this.logTimeTotalMinutes = diff;
        this.logTimeTotalDisplay = `${String(Math.floor(diff / 60)).padStart(2, '0')}:${String(diff % 60).padStart(2, '0')}`;
        this.logTimeEditValue = this.logTimeTotalDisplay;
      }
    } catch (e) {}
  }

  startEditLogTime() { this.isEditingLogTime = true; }

  confirmEditLogTime() {
    const parts = this.logTimeEditValue.split(':');
    if (parts.length === 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m) && h >= 0 && m >= 0 && m <= 59) {
        const newMinutes = h * 60 + m;
        this.logTimeTotalMinutes = newMinutes;
        this.logTimeTotalDisplay = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
    this.isEditingLogTime = false;
  }

  submitLogTime() {
    if (this.logTimeTotalMinutes < 0) {
      this.toasterService.showError('Invalid Time', 'Time cannot be negative');
      return;
    }
    if (!this.logTimeTimeLogId) {
      this.toasterService.showError('Error', 'Time log ID not found');
      return;
    }
    const currentUser = this.sessionService.getCurrentUser();
    const sessionUserId = currentUser?.empId || currentUser?.employeeId || this.logTimeUserId;
    this.api.decreaseTimeLog({ timeLogId: this.logTimeTimeLogId, newMinutes: this.logTimeTotalMinutes, userId: sessionUserId }).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          this.toasterService.showSuccess('Success', 'Time logged successfully');
          this.showLogTimePopup = false;
          // Reload day log history to show updated data
          if (this.selectedLogForDayHistory) {
            this.loadDayLogHistory(this.selectedLogForDayHistory);
          }
        } else {
          this.toasterService.showError('Error', response?.message || 'Failed to log time');
        }
      },
      error: () => {
        this.toasterService.showError('Error', 'Failed to log time');
      }
    });
  }

  updateTimeLog(log: any, newMinutes: number) {
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';

    const request: DecreaseTimeLogRequest = {
      timeLogId: log.timeLogId,
      newMinutes: newMinutes,
      userId: userId
    };

    Swal.fire({
      title: 'Updating...',
      text: 'Please wait while we update the time log',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    this.api.decreaseTimeLog(request).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          Swal.fire({
            icon: 'success',
            title: 'Updated!',
            text: 'Time log has been updated successfully',
            confirmButtonColor: '#6366f1',
            timer: 2000
          });
          // Refresh the day log history modal
          if (this.selectedLogForDayHistory) {
            this.loadDayLogHistory(this.selectedLogForDayHistory);
          }
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: response?.message || 'Failed to update time log',
            confirmButtonColor: '#6366f1'
          });
        }
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'An error occurred while updating the time log',
          confirmButtonColor: '#6366f1'
        });
      }
    });
  }
}