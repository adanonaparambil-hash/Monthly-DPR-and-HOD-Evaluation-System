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
  selector: 'app-past-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './past-reports.component.html',
  styleUrls: ['./past-reports.component.css'],
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
export class PastReportsComponent implements OnInit, OnDestroy {
  // Math reference for template
  Math = Math;

  hodList: DropdownOption[] = [];
  departmentList: DropdownOption[] = [];

  // User session and role properties
  userSession = JSON.parse(localStorage.getItem('current_user') || '{}');
  userType: 'E' | 'H' | 'C' = 'E';
  empId = '';
  
  

  // Role-based getters
  get isEmployee(): boolean { return this.userType === 'E'; }
  get isHod(): boolean { return this.userType === 'H'; }
  get isCed(): boolean { return this.userType === 'C'; }

  // Filter properties
  filters = {
    employeeName: '',
    month: '',
    year: '',
    status: '',
    hodName: '',
    department: ''
  };

  // Pagination properties
  currentPage = 1;
  pageSize = 10;
  totalRecords = 0;
  totalPages = 0;

  // Data properties
  reports: any[] = [];
  filteredReports: any[] = [];
  loading = false;
  animationState = 'in';

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

  years = [
    { value: '', label: 'Select year' },
    { value: '2025', label: '2025' },
    { value: '2024', label: '2024' },
    { value: '2023', label: '2023' },
    { value: '2022', label: '2022' },
    { value: '2021', label: '2021' }
  ];

  statuses = [
    { value: '', label: 'Select status' },
    { value: 'A', label: 'Approved' },
    { value: 'D', label: 'Draft' },
    { value: 'R', label: 'Rework' },
    { value: 'S', label: 'Submit' }
  ];

  constructor(private api: Api, private toastr: ToastrService, private router: Router) { }

  ngOnInit() {
    this.initializeUserSession();
    this.setDefaultPreviousMonth();
    this.loadHodMasterList();
    this.loadDepartmentList();
    this.loadReports();

    // Setup search debouncing
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(() => {
      this.loadReports();
    });
  }

  setDefaultPreviousMonth() {
    const today = new Date();
    // Get previous month
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    
    // Set month (1-12)
    this.filters.month = (previousMonth.getMonth() + 1).toString();
    
    // Set year
    this.filters.year = previousMonth.getFullYear().toString();
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
    this.searchSubject.next(this.filters.employeeName);
  }

  loadReports() {
    this.loading = true;

    // Create request object based on user role
    const request: DPRMonthlyReviewListingRequest = {
      month: this.filters.month ? Number(this.filters.month) : undefined,
      year: this.filters.year ? Number(this.filters.year) : undefined,
      status: this.filters.status || undefined
    };

    // Role-based filtering logic
    if (this.isEmployee) {
      // Employee (E): Pass employeeId from session, filter by their own records
      request.employeeId = this.empId;
      request.employeeName = this.filters.employeeName || '';
      request.hodName = '';
    } else if (this.isHod) {
      // HOD (H): Pass empId in hodName field, show reports under this HOD
      request.hodName = this.empId;
      request.employeeName = this.filters.employeeName || '';
      request.employeeId = '';
    } else if (this.isCed) {
      // CED (C): Show all records, allow filtering by all fields
      request.employeeName = this.filters.employeeName || '';
      request.hodName = this.filters.hodName || '';
      request.employeeId = '';
    }

    this.api.GetMonthlyReviewListing(request).subscribe({
      next: (response: any) => {
        this.loading = false;
        if (response && response.success && response.data) {

          console.log(response);

          this.reports = response.data;
          this.filteredReports = this.reports;
          this.totalRecords = this.reports.length;
          this.totalPages = Math.ceil(this.totalRecords / this.pageSize);
          this.currentPage = 1;
        } else {
          this.reports = [];
          this.filteredReports = [];
          this.totalRecords = 0;
          this.totalPages = 0;
          this.toastr.warning('No reports found', 'No Data');
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Error loading reports:', error);
        // this.toastr.error('Failed to load reports', 'Error');
        this.reports = [];
        this.filteredReports = [];
        this.totalRecords = 0;
        this.totalPages = 0;
      }
    });
  }

  clearFilters() {
    this.filters = {
      employeeName: '',
      month: '',
      year: '',
      status: '',
      hodName: '',
      department: ''
    };
    
    // Set default previous month and year
    this.setDefaultPreviousMonth();
    
    // Reset filters based on user role
    if (this.isEmployee) {
      // Employee can't filter by employee name or HOD
      this.filters.employeeName = '';
      this.filters.hodName = '';
      this.filters.department = '';
    } else if (this.isHod) {
      // HOD can filter by employee name but not HOD name
      this.filters.hodName = '';
      this.filters.department = '';
    } else if (this.isCed) {
      // Set IT department as default for CED
      const itDepartment = this.departmentList.find(dept => 
        dept.description?.toUpperCase() === 'IT' || 
        dept.idValue?.toUpperCase() === 'IT'
      );
      if (itDepartment && itDepartment.idValue) {
        this.filters.department = itDepartment.idValue;
      }
    }
    
    this.loadReports();
  }

  onPageChange(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPaginatedReports() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.filteredReports.slice(startIndex, endIndex);
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'a':
        return 'status-approved';
      case 'pending':
      case 's':
        return 'status-pending';
      case 'rejected':
      case 'r':
        return 'status-rejected';
      case 'draft':
      case 'd':
        return 'status-draft';
      default:
        return '';
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
    switch (status.toLowerCase()) {
      case 'a': return 'Approved';
      case 'd': return 'Draft';
      case 'r': return 'Rework';
      case 's': return 'Submitted';
      default: return status;
    }
  }

  getRoleBasedTitle(): string {
    switch (this.userType) {
      case 'E': return 'My Reports';
      case 'H': return 'Team Reports';
      case 'C': return 'All Reports';
      default: return 'Past Reports';
    }
  }

  getEmployeeNameLabel(): string {
    return this.isHod ? 'Employee Name' : 'Employee Name';
  }

  viewReport(report: any) {

    // Navigate to Monthly DPR in read-only mode with the selected record ID
    if (report) {
      this.router.navigate(['/monthly-dpr', report], { 
        queryParams: { 
          readonly: '1',
          from: 'past-reports' 
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
          
          // Set IT department as default if CED user
          if (this.isCed) {
            const itDepartment = this.departmentList.find(dept => 
              dept.description?.toUpperCase() === 'IT' || 
              dept.idValue?.toUpperCase() === 'IT'
            );
            if (itDepartment && itDepartment.idValue) {
              this.filters.department = itDepartment.idValue;
            }
          }
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
    // Call the API with current filter values
    this.loadReports();
  }


}