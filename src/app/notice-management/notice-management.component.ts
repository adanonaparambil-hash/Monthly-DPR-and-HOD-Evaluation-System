import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ViewEncapsulation } from '@angular/core';
import { Api } from '../services/api';
import { ToasterService } from '../services/toaster.service';
import { ToasterComponent } from '../components/toaster/toaster.component';
import Swal from 'sweetalert2';

interface Notice {
  noticeId: number;
  title: string;
  content: string;
  priority: string;
  recipient: string;
  startDate: string;
  expiryDate: string;
  status: string;
  createdBy: string;
}

interface Department {
  departmentId: number;
  deptName: string;
  [key: string]: any;
}

interface Employee {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  departmentId: number;
  departmentName: string;
}

interface CreateNoticeForm {
  title: string;
  content: string;
  recipientType: 'Entire Company' | 'Department Wise' | 'User Wise';
  selectedDepartments: Department[];
  selectedUsers: Employee[];
  startDate: string;
  expiryDate: string;
  priority: 'High' | 'Medium' | 'Low';
  displayOnLogin: boolean;
  isActive: boolean;
}

@Component({
  selector: 'app-notice-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ToasterComponent],
  templateUrl: './notice-management.component.html',
  styleUrls: ['./notice-management.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class NoticeManagementComponent implements OnInit {
  searchQuery = '';
  selectedRecipientType = '';
  selectedStatus = '';
  selectedDateRange = '';
  selectedFromDate = '';
  selectedToDate = '';
  currentPage = 1;
  itemsPerPage = 100;
  pageStart = 0;
  pageEnd = 500;
  isListLoading = false;

  notices: Notice[] = [];
  filteredNotices: Notice[] = [];

  recipientTypes = ['Global', 'Department', 'Individual'];
  statusOptions = ['Active', 'Pending', 'Expired'];
  dateRanges = ['Today', 'This Week', 'This Month', 'Custom'];

  // Modal state
  showCreateModal = false;
  isEditMode = false;
  editingNoticeId: number | null = null;
  departmentSearchQuery = '';
  isDepartmentsLoading = false;

  // Available departments (populated from API)
  availableDepartments: Department[] = [];
  filteredDepartments: Department[] = [];

  // User Wise state
  selectedDeptForUsers: Department | null = null;
  availableUsers: Employee[] = [];
  isUsersLoading = false;
  userSearchQuery = '';
  filteredUsers: Employee[] = [];

  // Form data
  createNoticeForm: CreateNoticeForm = {
    title: '',
    content: '',
    recipientType: 'Entire Company',
    selectedDepartments: [],
    selectedUsers: [],
    startDate: '',
    expiryDate: '',
    priority: 'Medium',
    displayOnLogin: true,
    isActive: true
  };

  constructor(private api: Api, private toaster: ToasterService) {}

  @ViewChild('richEditor') richEditor!: ElementRef;

  toolbarState: { [key: string]: boolean } = {};

  execCmd(command: string) {
    document.execCommand(command, false);
    this.richEditor?.nativeElement.focus();
    this.syncEditorContent();
    this.updateToolbarState();
  }

  isActive(command: string): boolean {
    return this.toolbarState[command] ?? false;
  }

  updateToolbarState() {
    ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter'].forEach(cmd => {
      try { this.toolbarState[cmd] = document.queryCommandState(cmd); } catch { this.toolbarState[cmd] = false; }
    });
  }

  onEditorInput(event: Event) {
    this.syncEditorContent();
  }

  onEditorBlur() {
    this.syncEditorContent();
  }

  syncEditorContent() {
    if (this.richEditor?.nativeElement) {
      this.createNoticeForm.content = this.richEditor.nativeElement.innerHTML;
    }
  }

  analytics = {
    activeBroadcasts: 0,
    upcomingNotices: 0,
    highPriorityActions: 0
  };

  ngOnInit() {
    this.loadNotices();
  }

  loadNotices() {
    this.isListLoading = true;
    const request = {
      pageStart: this.pageStart,
      pageEnd: this.pageEnd,
      startDate: this.selectedFromDate ? new Date(this.selectedFromDate) : undefined,
      expiryDate: this.selectedToDate ? new Date(this.selectedToDate) : undefined,
      status: this.selectedStatus || undefined,
      priority: this.selectedRecipientType || undefined
    };
    this.api.getNoticesPaged(request).subscribe({
      next: (res: any) => {
        const data = res?.data ?? {};
        this.notices = data.notices ?? [];
        this.filteredNotices = [...this.notices];
        this.analytics.activeBroadcasts = data.activeCount ?? 0;
        this.analytics.upcomingNotices = data.upcomingCount ?? 0;
        this.analytics.highPriorityActions = data.highPriorityCount ?? 0;
        this.isListLoading = false;
      },
      error: () => { this.isListLoading = false; }
    });
  }

  applyFilters() {
    this.filteredNotices = this.notices.filter(notice => {
      const matchesSearch = !this.searchQuery ||
        notice.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        notice.content?.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesPriority = !this.selectedRecipientType || notice.priority === this.selectedRecipientType;
      const matchesStatus = !this.selectedStatus || notice.status?.toUpperCase() === this.selectedStatus.toUpperCase();
      return matchesSearch && matchesPriority && matchesStatus;
    });
    this.currentPage = 1;
  }

  get paginatedNotices() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredNotices.slice(start, start + this.itemsPerPage);
  }

  get totalPages() {
    return Math.ceil(this.filteredNotices.length / this.itemsPerPage);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      // Load next batch when reaching last page
      if (page === this.totalPages && this.notices.length === this.pageEnd - this.pageStart) {
        this.pageStart = this.pageEnd;
        this.pageEnd = this.pageEnd + 500;
        this.loadNotices();
      }
    }
  }

  getRecipientDisplay(recipient: string): string {
    if (!recipient) return '';
    const parts = recipient.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length <= 5) return parts.join(', ');
    return parts.slice(0, 5).join(', ');
  }

  getRecipientTooltip(recipient: string): string {
    if (!recipient) return '';
    const parts = recipient.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length <= 5) return '';
    return parts.join(', ');
  }

  hasMoreRecipients(recipient: string): boolean {
    if (!recipient) return false;
    return recipient.split(',').length > 5;
  }

  createNotice() {
    this.showCreateModal = true;
  }

  onRecipientTypeChange() {
    if (this.createNoticeForm.recipientType === 'Department Wise' || this.createNoticeForm.recipientType === 'User Wise') {
      this.loadDepartments();
    }
    // Reset user selection when switching
    this.selectedDeptForUsers = null;
    this.availableUsers = [];
    this.filteredUsers = [];
    this.createNoticeForm.selectedUsers = [];
  }

  loadDepartments() {
    if (this.availableDepartments.length > 0) {
      this.filteredDepartments = [...this.availableDepartments];
      return;
    }
    this.isDepartmentsLoading = true;
    this.api.getDepartmentList().subscribe({
      next: (res: any) => {
        const data = res?.data ?? res ?? [];
        this.availableDepartments = data.map((d: any) => ({ ...d }));
        this.filteredDepartments = [...this.availableDepartments];
        this.isDepartmentsLoading = false;
      },
      error: () => {
        this.isDepartmentsLoading = false;
      }
    });
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.isEditMode = false;
    this.editingNoticeId = null;
    this.resetForm();
  }

  resetForm() {
    this.createNoticeForm = {
      title: '',
      content: '',
      recipientType: 'Entire Company',
      selectedDepartments: [],
      selectedUsers: [],
      startDate: '',
      expiryDate: '',
      priority: 'Medium',
      displayOnLogin: true,
      isActive: true
    };
    this.departmentSearchQuery = '';
    this.filteredDepartments = [...this.availableDepartments];
    this.selectedDeptForUsers = null;
    this.availableUsers = [];
    this.filteredUsers = [];
    this.userSearchQuery = '';
    if (this.richEditor?.nativeElement) {
      this.richEditor.nativeElement.innerHTML = '';
    }
  }

  searchDepartments() {
    const q = this.departmentSearchQuery.trim().toLowerCase();
    this.filteredDepartments = q
      ? this.availableDepartments.filter(d => this.getDeptName(d).toLowerCase().includes(q))
      : [...this.availableDepartments];
  }

  toggleDepartment(dept: Department) {
    const index = this.createNoticeForm.selectedDepartments.findIndex(d => this.getDeptId(d) === this.getDeptId(dept));
    if (index > -1) {
      this.createNoticeForm.selectedDepartments.splice(index, 1);
    } else {
      this.createNoticeForm.selectedDepartments.push(dept);
    }
  }

  isDepartmentSelected(dept: Department): boolean {
    const deptId = this.getDeptId(dept);
    return this.createNoticeForm.selectedDepartments.some(d => this.getDeptId(d) === deptId);
  }

  getDeptName(dept: any): string {
    return dept?.deptName ?? dept?.departmentName ?? dept?.description ?? dept?.name ?? '';
  }

  getDeptId(dept: any): number {
    return dept?.departmentId ?? dept?.DepartmentId ?? 0;
  }

  // User Wise methods
  selectDeptForUsers(dept: Department) {
    this.selectedDeptForUsers = dept;
    this.availableUsers = [];
    this.filteredUsers = [];
    this.userSearchQuery = '';
    this.isUsersLoading = true;
    const deptId = this.getDeptId(dept);
    console.log('Calling getEmployeesByDepartment with deptId:', deptId, 'raw dept:', JSON.stringify(dept));
    this.api.getEmployeesByDepartment(deptId).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res ?? [];
        this.availableUsers = data.map((e: any) => ({
          employeeId: e.employeeId,
          employeeCode: e.employeeCode ?? '',
          employeeName: e.employeeName ?? '',
          departmentId: e.departmentId,
          departmentName: e.departmentName ?? ''
        }));
        this.filteredUsers = [...this.availableUsers];
        this.isUsersLoading = false;
      },
      error: () => { this.isUsersLoading = false; }
    });
  }

  searchUsers() {
    const q = this.userSearchQuery.trim().toLowerCase();
    this.filteredUsers = q
      ? this.availableUsers.filter(u => u.employeeName.toLowerCase().includes(q))
      : [...this.availableUsers];
  }

  toggleUser(emp: Employee) {
    const idx = this.createNoticeForm.selectedUsers.findIndex(u => u.employeeCode === emp.employeeCode);
    if (idx > -1) {
      this.createNoticeForm.selectedUsers.splice(idx, 1);
    } else {
      this.createNoticeForm.selectedUsers.push(emp);
    }
  }

  isUserSelected(emp: Employee): boolean {
    return this.createNoticeForm.selectedUsers.some(u => u.employeeCode === emp.employeeCode);
  }

  saveNotice() {
    if (!this.createNoticeForm.title.trim() || !this.createNoticeForm.content.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    // Build targetType, targetIds (users) and targetDeptId (departments)
    let targetType: string;
    let targetIds: string[] | undefined = undefined;
    let targetDeptId: number[] | undefined = undefined;

    if (this.createNoticeForm.recipientType === 'Entire Company') {
      targetType = 'ALL';
    } else if (this.createNoticeForm.recipientType === 'Department Wise') {
      targetType = 'DEPARTMENT';
      targetDeptId = this.createNoticeForm.selectedDepartments.map(d => this.getDeptId(d));
    } else {
      targetType = 'USER';
      targetIds = this.createNoticeForm.selectedUsers.map(u => String(u.employeeCode));
    }

    const payload = {
      noticeId: this.editingNoticeId ?? undefined,
      title: this.createNoticeForm.title,
      content: this.createNoticeForm.content,
      priority: this.createNoticeForm.priority,
      startDate: this.createNoticeForm.startDate ? new Date(this.createNoticeForm.startDate) : undefined,
      expiryDate: this.createNoticeForm.expiryDate ? new Date(this.createNoticeForm.expiryDate) : undefined,
      showOnLogin: this.createNoticeForm.displayOnLogin ? 'Y' : 'N',
      isactive: this.createNoticeForm.isActive ? 'Y' : 'N',
      createdBy: JSON.parse(localStorage.getItem('current_user') || '{}')?.empId ?? '',
      targetType: targetType,
      targetIds: targetIds,
      targetDeptId: targetDeptId
    };

    this.api.saveNotice(payload).subscribe({
      next: (res: any) => {
        this.toaster.showSuccess('Success', this.isEditMode ? 'Notice updated successfully.' : 'Notice sent successfully.');
        this.closeCreateModal();
        this.pageStart = 0;
        this.pageEnd = 500;
        this.loadNotices();
      },
      error: (err: any) => {
        this.toaster.showError('Error', err?.error?.message ?? 'Failed to save notice. Please try again.');
      }
    });
  }

  discardDraft() {
    if (confirm('Are you sure you want to discard this draft?')) {
      this.closeCreateModal();
    }
  }

  getPriorityClass(priority: string): string {
    return `priority-${priority.toLowerCase()}`;
  }

  getStatusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  viewNotice(notice: Notice) {
    console.log('View notice:', notice);
  }

  editNotice(notice: Notice) {
    this.isEditMode = true;
    this.editingNoticeId = notice.noticeId;
    this.showCreateModal = true;

    this.api.getNoticeById(notice.noticeId).subscribe({
      next: (res: any) => {
        const n = res?.data?.notice;
        const recipients = res?.data?.recipients ?? [];

        // Map recipientType
        let recipientType: 'Entire Company' | 'Department Wise' | 'User Wise' = 'Entire Company';
        if (n.recipientType === 'DEPARTMENT') recipientType = 'Department Wise';
        else if (n.recipientType === 'USER') recipientType = 'User Wise';

        this.createNoticeForm = {
          title: n.title ?? '',
          content: n.content ?? '',
          recipientType,
          selectedDepartments: [],
          selectedUsers: [],
          startDate: n.startDate ? n.startDate.substring(0, 10) : '',
          expiryDate: n.expiryDate ? n.expiryDate.substring(0, 10) : '',
          priority: n.priority ?? 'Medium',
          displayOnLogin: n.showOnLogin === 'Y',
          isActive: n.isActive === 'Y'
        };

        // Set rich editor content
        setTimeout(() => {
          if (this.richEditor?.nativeElement) {
            this.richEditor.nativeElement.innerHTML = n.content ?? '';
          }
        }, 50);

        if (recipientType === 'Entire Company') return;

        // Load department list for DEPARTMENT and USER types
        this.isDepartmentsLoading = true;
        this.api.getDepartmentList().subscribe({
          next: (deptRes: any) => {
            const deptData = deptRes?.data ?? deptRes ?? [];
            this.availableDepartments = deptData.map((d: any) => ({ ...d }));
            this.filteredDepartments = [...this.availableDepartments];
            this.isDepartmentsLoading = false;

            // department field in recipients is the numeric dept ID
            const recipientDeptIds: number[] = recipients
              .map((r: any) => parseInt(r.department, 10))
              .filter((id: number) => !isNaN(id));

            if (recipientType === 'Department Wise') {
              // Match by departmentId numeric value
              this.createNoticeForm.selectedDepartments = this.availableDepartments.filter(d =>
                recipientDeptIds.includes(this.getDeptId(d))
              );
            } else if (recipientType === 'User Wise') {
              // Pre-select users from recipients
              this.createNoticeForm.selectedUsers = recipients
                .filter((r: any) => r.userId)
                .map((r: any) => ({
                  employeeId: 0,
                  employeeCode: r.userId,
                  employeeName: r.employeeName ?? r.userId,
                  departmentId: parseInt(r.department, 10) || 0,
                  departmentName: ''
                }));

              // Find dept from first recipient and load users
              const firstDeptId = recipientDeptIds[0];
              if (firstDeptId) {
                const deptMatch = this.availableDepartments.find(d => this.getDeptId(d) === firstDeptId);
                if (deptMatch) {
                  this.selectedDeptForUsers = deptMatch;
                  this.isUsersLoading = true;
                  this.api.getEmployeesByDepartment(firstDeptId).subscribe({
                    next: (empRes: any) => {
                      const empData = empRes?.data ?? empRes ?? [];
                      this.availableUsers = empData.map((e: any) => ({
                        employeeId: e.employeeId,
                        employeeCode: e.employeeCode ?? '',
                        employeeName: e.employeeName ?? '',
                        departmentId: e.departmentId,
                        departmentName: e.departmentName ?? ''
                      }));
                      this.filteredUsers = [...this.availableUsers];
                      this.isUsersLoading = false;
                    },
                    error: () => { this.isUsersLoading = false; }
                  });
                }
              }
            }
          },
          error: () => { this.isDepartmentsLoading = false; }
        });
      },
      error: () => this.toaster.showError('Error', 'Failed to load notice details.')
    });
  }

  deleteNotice(notice: Notice) {
    Swal.fire({
      title: 'Delete Notice?',
      text: `Are you sure you want to delete "${notice.title}"? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel'
    }).then(result => {
      if (result.isConfirmed) {
        this.api.deleteNotice(notice.noticeId).subscribe({
          next: () => {
            this.toaster.showSuccess('Deleted', 'Notice deleted successfully.');
            this.loadNotices();
          },
          error: () => this.toaster.showError('Error', 'Failed to delete notice.')
        });
      }
    });
  }
}
