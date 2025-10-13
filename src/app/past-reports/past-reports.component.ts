import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { DropdownOption  } from '../models/common.model';
import { Api } from '../services/api';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

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
export class PastReportsComponent implements OnInit {
  // Math reference for template
  Math = Math;
  
  hodList: DropdownOption[] = [];

  // Filter properties
  filters = {
    employeeName: '',
    month: '',
    year: '',
    status: '',
    hodName: ''
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

  // Dropdown options
  months = [
    { value: '', label: 'Select month' },
    { value: 'January', label: 'January' },
    { value: 'February', label: 'February' },
    { value: 'March', label: 'March' },
    { value: 'April', label: 'April' },
    { value: 'May', label: 'May' },
    { value: 'June', label: 'June' },
    { value: 'July', label: 'July' },
    { value: 'August', label: 'August' },
    { value: 'September', label: 'September' },
    { value: 'October', label: 'October' },
    { value: 'November', label: 'November' },
    { value: 'December', label: 'December' }
  ];

  years = [
    { value: '', label: 'Select year' },
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

  constructor(private api: Api,private toastr: ToastrService, private router: Router) {}

  ngOnInit() {
    this.loadMockData();
    this.applyFilters();

    this.loadHodMasterList();

  }

  loadMockData() {
    // Mock data matching your design
    this.reports = [
      {
        id: 1,
        employeeName: 'John Smith',
        month: 'January',
        year: '2024',
        status: 'Approved',
        hodName: 'Sarah Johnson'
      },
      {
        id: 2,
        employeeName: 'Emma Davis',
        month: 'January',
        year: '2024',
        status: 'Pending',
        hodName: 'Michael Brown'
      },
      {
        id: 3,
        employeeName: 'David Wilson',
        month: 'February',
        year: '2024',
        status: 'Rejected',
        hodName: 'Sarah Johnson'
      },
      {
        id: 4,
        employeeName: 'Lisa Anderson',
        month: 'February',
        year: '2024',
        status: 'Approved',
        hodName: 'Robert Taylor'
      },
      {
        id: 5,
        employeeName: 'Mark Thompson',
        month: 'March',
        year: '2024',
        status: 'Approved',
        hodName: 'Sarah Johnson'
      },
      {
        id: 6,
        employeeName: 'Jennifer Lee',
        month: 'March',
        year: '2024',
        status: 'Pending',
        hodName: 'Michael Brown'
      },
      {
        id: 7,
        employeeName: 'Robert Garcia',
        month: 'April',
        year: '2024',
        status: 'Approved',
        hodName: 'Sarah Johnson'
      },
      {
        id: 8,
        employeeName: 'Maria Rodriguez',
        month: 'April',
        year: '2024',
        status: 'Rejected',
        hodName: 'Robert Taylor'
      },
      {
        id: 9,
        employeeName: 'James Wilson',
        month: 'May',
        year: '2024',
        status: 'Approved',
        hodName: 'Michael Brown'
      },
      {
        id: 10,
        employeeName: 'Patricia Moore',
        month: 'May',
        year: '2024',
        status: 'Pending',
        hodName: 'Sarah Johnson'
      }
    ];

    this.totalRecords = this.reports.length;
  }

  applyFilters() {
    this.loading = true;
    
    setTimeout(() => {
      this.filteredReports = this.reports.filter(report => {
        return (
          (!this.filters.employeeName || report.employeeName.toLowerCase().includes(this.filters.employeeName.toLowerCase())) &&
          (!this.filters.month || report.month === this.filters.month) &&
          (!this.filters.year || report.year === this.filters.year) &&
          (!this.filters.status || report.status === this.filters.status) &&
          (!this.filters.hodName || report.hodName.toLowerCase().includes(this.filters.hodName.toLowerCase()))
        );
      });

      this.totalRecords = this.filteredReports.length;
      this.totalPages = Math.ceil(this.totalRecords / this.pageSize);
      this.currentPage = 1;
      this.loading = false;
    }, 300);
  }

  clearFilters() {
    this.filters = {
      employeeName: '',
      month: '',
      year: '',
      status: '',
      hodName: ''
    };
    this.applyFilters();
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
        return 'status-approved';
      case 'pending':
        return 'status-pending';
      case 'rejected':
        return 'status-rejected';
      default:
        return '';
    }
  }
  
  viewReport(report: any) {
    // Navigate to Monthly DPR in read-only mode with the selected record ID
    this.router.navigate(['/monthly-dpr', report.id], { queryParams: { readonly: '1' } });
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

}