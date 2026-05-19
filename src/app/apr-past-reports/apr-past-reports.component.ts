import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { DropdownOption } from '../models/common.model';
import { Api } from '../services/api';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { DPRMonthlyReviewListingRequest } from '../models/task.model';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-apr-past-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './apr-past-reports.component.html',
  styleUrls: ['./apr-past-reports.component.css'],
  animations: [
    trigger('fadeInUp', [
      state('in', style({ transform: 'translateY(0)', opacity: 1 })),
      transition('void => *', [
        style({ transform: 'translateY(20px)', opacity: 0 }),
        animate('0.4s ease-out')
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate('0.3s ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ])
    ])
  ]
})
export class AprPastReportsComponent implements OnInit, OnDestroy {
  // Math reference for template
  Math = Math;

  hodList: DropdownOption[] = [];
  departmentList: DropdownOption[] = [];
  employeeList: any[] = [];

  // User session and role properties
  userSession = JSON.parse(localStorage.getItem('current_user') || '{}');
  userType: 'E' | 'H' | 'C' = 'E';
  empId = '';



  // Role-based getters
  get isEmployee(): boolean { return this.userType === 'E'; }
  get isHod(): boolean { return this.userType === 'H'; }
  get isCed(): boolean { return this.userType === 'C'; }

  // HOD sees only the team reports tab — no "Pending My Review" tab
  get showPendingReviewTab(): boolean { return !this.isHod; }

  // Filter properties
  filters = {
    employeeName: '',
    employeeId: '',
    month: '',
    year: '',
    status: '',
    hodName: '',
    department: ''
  };

  // Pagination properties - Server-side pagination
  currentPage = 1;
  pageSize = 100; // Display 100 records per page
  itemsPerPage = 500; // Fetch 500 records from API at a time
  totalRecords = 0;
  totalPages = 0;
  cachedData: any[] = []; // Cache for all fetched data
  currentBatch = 1; // Track which batch of 500 records we're on

  // Data properties
  reports: any[] = [];
  filteredReports: any[] = [];
  loading = false;
  animationState = 'in';

  // View mode: 'my-reports' | 'pending-review'
  activeTab: 'my-reports' | 'pending-review' = 'pending-review';
  reviewerReports: any[] = [];
  filteredReviewerReports: any[] = [];
  reviewerLoading = false;
  pendingReviewCount = 0;

  // Reviewer tab filters
  reviewerFilters = { year: '', assessmentStatus: '' };

  // Search debouncing
  private searchSubject = new Subject<string>();

  // Dropdown options
  months = [
    { value: '', label: 'Select month' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  years = (() => {
    const currentYear = new Date().getFullYear();
    const result = [{ value: '', label: 'Select year' }];
    for (let y = currentYear; y >= currentYear - 4; y--) {
      result.push({ value: y.toString(), label: y.toString() });
    }
    return result;
  })();

  statuses = [
    { value: '', label: 'All Statuses' },
    { value: 'P', label: 'Pending' },
    { value: 'S', label: 'Submitted' },
  ];

  constructor(private api: Api, private toastr: ToastrService, private router: Router) { }

  ngOnInit() {
    this.initializeUserSession();
    this.setDefaultPreviousMonth();
    this.loadHodMasterList();

    // Load employee list for HOD and CED users
    if (!this.isEmployee) {
      this.loadEmployeeList();
    }

    // CED: load department list for the dropdown (non-blocking), then load reports immediately
    if (this.isCed) {
      this.loadDepartmentList();
    }
    this.loadReports();

    // Search debouncing — only fires when user explicitly types
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(() => {
      this.loadReports();
    });
  }

  setDefaultPreviousMonth() {
    const today = new Date();
    this.filters.year = (today.getFullYear() - 1).toString();
    this.filters.month = '';
    // Default: Pending (P) — shows records awaiting review
    this.filters.status = 'P';
  }

  initializeUserSession() {
    if (this.userSession) {
      this.empId = this.userSession.empId || '';

      // Determine userType from session
      const code = ((this.userSession.isHOD || this.userSession.role || this.userSession.userType || '') as string).toString().toUpperCase();
      if (code === 'H') {
        this.userType = 'H';
      } else if (code === 'C') {
        this.userType = 'C';
      } else {
        this.userType = 'E';
      }
    }
  }

  ngOnDestroy() {
    this.searchSubject.complete();
  }

  onSearchChange() {
    this.currentPage = 1;
    this.searchSubject.next(this.filters.employeeName);
  }

  loadReports(resetCache: boolean = true) {
    if (resetCache) {
      this.cachedData = [];
      this.currentBatch = 1;
      this.currentPage = 1;
    }

    this.loading = true;

    // Create request object based on user role
    const request: DPRMonthlyReviewListingRequest = {
      month: this.filters.month ? Number(this.filters.month) : undefined,
      year: this.filters.year ? Number(this.filters.year) : undefined,
      status: this.filters.status || undefined,
      page_number: this.currentBatch,
      items_per_page: this.itemsPerPage,
      row_num: ((this.currentBatch - 1) * this.itemsPerPage) + 1,
      formType: 'A'
    };

    // Add department filter for CED users — only when explicitly selected
    if (this.isCed && this.filters.department) {
      request.department = this.filters.department;
    }

    // Role-based filtering — always pass the logged-in user's ID in the correct field
    if (this.isEmployee) {
      // Employee: always filter by their own empId; no hodName
      request.employeeId = this.empId;
      request.hodName    = undefined;
    } else if (this.isHod) {
      // HOD: always filter by their own empId as both hodName and employeeId (unless employee search is active)
      request.hodName    = this.empId;
      request.employeeId = this.filters.employeeId || this.empId;
    } else if (this.isCed) {
      // CED: always pass own empId as hodName; employeeId defaults to own empId unless filter is set
      request.hodName      = this.empId;
      request.employeeId   = this.filters.employeeId || this.empId;
      request.employeeName = this.filters.employeeName || undefined;
    }

    this.api.GetMonthlyReviewListing(request).subscribe({
      next: (response: any) => {
        this.loading = false;
        if (response && response.success && response.data) {

          console.log(response);

          // Add new data to cache
          this.cachedData = [...this.cachedData, ...response.data];

          // Update total records from API response if available
          if (response.totalRecords !== undefined) {
            this.totalRecords = response.totalRecords;
          } else {
            // If API doesn't return total, estimate based on returned data
            this.totalRecords = this.cachedData.length;
            // If we got full batch, there might be more
            if (response.data.length === this.itemsPerPage) {
              this.totalRecords = this.cachedData.length + 1; // Indicate more data available
            }
          }

          this.reports = this.cachedData;
          this.filteredReports = this.cachedData;
          this.totalPages = Math.ceil(this.totalRecords / this.pageSize);

        } else {
          if (resetCache) {
            this.reports = [];
            this.filteredReports = [];
            this.cachedData = [];
            this.totalRecords = 0;
            this.totalPages = 0;
            this.toastr.warning('No reports found', 'No Data');
          }
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Error loading reports:', error);
        if (resetCache) {
          this.reports = [];
          this.filteredReports = [];
          this.cachedData = [];
          this.totalRecords = 0;
          this.totalPages = 0;
        }
      }
    });
  }

  clearFilters() {
    this.filters = {
      employeeName: '',
      employeeId: '',
      month: '',
      year: '',
      status: 'P',
      hodName: '',
      department: ''
    };

    this.setDefaultPreviousMonth();
    this.loadReports(true);
  }

  onPageChange(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;

      // Check if we need to fetch more data from API
      const requiredDataLength = page * this.pageSize;
      const availableDataLength = this.cachedData.length;

      // If we need more data and haven't reached the end
      if (requiredDataLength > availableDataLength && availableDataLength % this.itemsPerPage === 0) {
        // Fetch next batch (next 500 records)
        this.currentBatch++;
        this.loadReports(false); // Don't reset cache
      }
    }
  }

  getPaginatedReports() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.filteredReports.slice(startIndex, endIndex);
  }

  getRowNumber(index: number): number {
    return ((this.currentPage - 1) * this.pageSize) + index + 1;
  }

  getStatusClass(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'a': return 'status-approved';
      case 's': return 'status-pending';
      case 'p': return 'status-pending';
      case 'r': return 'status-rejected';
      case 'd': return 'status-draft';
      default: return '';
    }
  }

  getMonthName(monthNumber: number): string {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[monthNumber - 1] || '';
  }

  getStatusLabel(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'a': return 'Approved';
      case 'd': return 'Draft';
      case 'r': return 'Rework';
      case 's': return 'Submitted';
      case 'p': return 'Pending';
      default: return status;
    }
  }

  getRoleBasedTitle(): string {
    switch (this.userType) {
      case 'E': return 'My APR Reports';
      case 'H': return 'Team APR Reports';
      case 'C': return 'All APR Reports';
      default: return 'APR Past Reports';
    }
  }

  getEmployeeNameLabel(): string {
    return this.isHod ? 'Employee Name' : 'Employee Name';
  }

  viewReport(report: any) {
    // Navigate to APR in read-only mode with the selected record ID
    if (report) {
      this.router.navigate(['/apr', report], {
        queryParams: {
          readonly: '1',
          from: 'apr-past-reports'
        }
      });
    } else {
      this.toastr.error('Invalid report ID', 'Error');
    }
  }

  // Open an APR for reviewer assessment (no readonly flag so the reviewer can submit their rating)
  reviewReport(dprId: any) {
    if (dprId) {
      this.router.navigate(['/apr', dprId], {
        queryParams: {
          from: 'pending-review'
        }
      });
    } else {
      this.toastr.error('Invalid report ID', 'Error');
    }
  }

  getPageNumbers(): number[] {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }



  loadEmployeeList(): void {
    this.api.getEmployeeMasterList().subscribe(
      (response: any) => {
        if (response && response.success && response.data) {
          this.employeeList = response.data;
        } else {
          console.warn('No employee records found');
        }
      },
      (error) => {
        console.error('Error fetching employee list:', error);
      }
    );
  }

  loadHodMasterList(): void {
    this.api.GetHodMasterList().subscribe(
      (response: any) => {
        if (response && response.success && response.data) {
          this.hodList = response.data;
        } else {
          console.warn('No HOD records found or API call failed');
        }
      },
      (error) => {
        console.error('Error fetching HOD master list:', error);
      }
    );
  }

  loadDepartmentList(): void {
    this.api.GetDepartmentList().subscribe(
      (response: any) => {
        if (response && response.success && response.data) {
          this.departmentList = response.data;
          console.log('Department list loaded:', this.departmentList);
        } else {
          console.warn('No Department records found or API call failed');
        }
      },
      (error) => {
        console.error('Error fetching Department list:', error);
      }
    );
  }

  applyFilters() {
    // Reset cache and call the API with current filter values
    this.loadReports(true);
  }

  switchTab(tab: 'my-reports' | 'pending-review') {
    this.activeTab = tab;
    if (tab === 'pending-review') {
      this.loadReviewerReports();
    }
  }
  loadReviewerReports() {
    this.reviewerLoading = true;
    const request: DPRMonthlyReviewListingRequest = {
      reviewerId: this.empId,
      formType: 'A',
      page_number: 1,
      items_per_page: 500,
      row_num: 1,
    };
    this.api.GetMonthlyReviewListing(request).subscribe({
      next: (response: any) => {
        this.reviewerLoading = false;
        if (response?.success && response?.data) {
          this.reviewerReports = response.data;
          this.pendingReviewCount = this.reviewerReports.filter(
            (r: any) => r.status === 'S'
          ).length;
          this.applyReviewerFilters();
        } else {
          this.reviewerReports = [];
          this.filteredReviewerReports = [];
          this.pendingReviewCount = 0;
        }
      },
      error: () => {
        this.reviewerLoading = false;
        this.reviewerReports = [];
        this.filteredReviewerReports = [];
      }
    });
  }

  applyReviewerFilters(): void {
    let result = [...this.reviewerReports];
    if (this.reviewerFilters.year) {
      result = result.filter(r => String(r.year) === this.reviewerFilters.year);
    }
    if (this.reviewerFilters.assessmentStatus === 'done') {
      result = result.filter(r => r.myAssessmentStatus === 'done');
    } else if (this.reviewerFilters.assessmentStatus === 'pending') {
      result = result.filter(r => r.myAssessmentStatus !== 'done' && r.status === 'S');
    }
    this.filteredReviewerReports = result;
  }

  clearReviewerFilters(): void {
    this.reviewerFilters = { year: '', assessmentStatus: '' };
    this.filteredReviewerReports = [...this.reviewerReports];
  }


}
