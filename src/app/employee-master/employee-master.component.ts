import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Api } from '../services/api';
import { AvatarUtil } from '../utils/avatar.util';

export interface EmployeeDto {
  empId: string;
  employeeName: string;
  department: string;
  designation: string;
  profileImage: string | null;
  profileImageBase64: string | null;
  status: string;
  contactNumber: string | null;
  email: string | null;
  dateOfJoined: string;
  dateOfBirth: string;
}

export interface EmployeeProfileDto {
  empId: string;
  employeeName: string;
  department: string;
  designation: string;
  phone: string | null;
  email: string | null;
  careerSummary: string | null;
  experienceInd: number | null;
  experienceAbroad: number | null;
  qualification: string | null;
  skillset: string | null;
  doj: string | null;
  dob: string | null;
  location: string | null;
  profileImage: string | null;
  profileImageBase64: string | null;
  address: string | null;
  telephone: string | null;
  nation: string | null;
  postOffice: string | null;
  state: string | null;
  district: string | null;
  place: string | null;
}

@Component({
  selector: 'app-employee-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-master.component.html',
  styleUrls: ['./employee-master.component.css']
})
export class EmployeeMasterComponent implements OnInit {
  employeeList: EmployeeDto[] = [];   // current 100-record page shown in table
  filterName: string = '';
  filterDepartment: string = '';
  filterDesignation: string = '';
  isLoading: boolean = false;
  departmentList: string[] = [];

  // Two-level pagination
  // Level 1 — API batch: each call fetches BATCH_SIZE records
  // Level 2 — Local page: each visible page shows PAGE_SIZE records from the current batch
  readonly PAGE_SIZE  = 100;   // rows shown per page
  readonly BATCH_SIZE = 500;   // records fetched per API call

  apiBatchNo: number = 1;       // which 500-block we're on (1-based)
  hasMoreBatches: boolean = false; // true when API returned a full batch (more may exist)

  currentPage: number = 1;      // local page within current batch (1-based)
  totalLocalPages: number = 1;  // total local pages in current batch
  batchEmployees: EmployeeDto[] = []; // all records from current API batch

  // View modal
  showViewModal: boolean = false;
  selectedEmployee: EmployeeDto | null = null;
  employeeProfile: EmployeeProfileDto | null = null;
  isLoadingProfile: boolean = false;

  constructor(private api: Api, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.loadDepartments();
    this.fetchBatch(1);
  }

  loadDepartments(): void {
    this.api.GetDepartmentList().subscribe({
      next: (res: any) => {
        const raw: any[] = Array.isArray(res?.data) ? res.data : [];
        this.departmentList = raw
          .map((d: any) => (d.deptName || d.description || '').trim())
          .filter((n: string) => n.length > 0);
      },
      error: () => { /* non-critical, silently ignore */ }
    });
  }

  /** Fetch a specific API batch (1-based). Resets local page to 1. */
  fetchBatch(batchNo: number): void {
    this.isLoading = true;
    this.apiBatchNo = batchNo;
    this.currentPage = 1;

    this.api.getEmployeeList(
      this.filterName, this.filterDepartment, this.filterDesignation,
      batchNo, this.BATCH_SIZE
    ).subscribe({
      next: (res: any) => {
        this.batchEmployees = res.data ?? [];
        // If we got a full batch, there might be more
        this.hasMoreBatches = this.batchEmployees.length === this.BATCH_SIZE;
        this.totalLocalPages = Math.ceil(this.batchEmployees.length / this.PAGE_SIZE) || 1;
        this.updatePagedList();
        this.isLoading = false;
      },
      error: () => {
        this.toastr.error('Failed to load employee list.');
        this.isLoading = false;
      }
    });
  }

  updatePagedList(): void {
    const start = (this.currentPage - 1) * this.PAGE_SIZE;
    this.employeeList = this.batchEmployees.slice(start, start + this.PAGE_SIZE);
  }

  onApply(): void {
    this.fetchBatch(1);
  }

  // ── Local page navigation (within current 500-batch) ──────────

  prevLocalPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagedList();
    }
  }

  nextLocalPage(): void {
    if (this.currentPage < this.totalLocalPages) {
      this.currentPage++;
      this.updatePagedList();
    } else if (this.hasMoreBatches) {
      // Last local page of this batch → fetch next API batch
      this.fetchBatch(this.apiBatchNo + 1);
    }
  }

  prevApiBatch(): void {
    if (this.apiBatchNo > 1) {
      this.fetchBatch(this.apiBatchNo - 1);
    }
  }

  get isFirstRecord(): boolean {
    return this.apiBatchNo === 1 && this.currentPage === 1;
  }

  get isLastLocalPage(): boolean {
    return this.currentPage === this.totalLocalPages;
  }

  get globalStart(): number {
    if (this.batchEmployees.length === 0) return 0;
    return (this.apiBatchNo - 1) * this.BATCH_SIZE + (this.currentPage - 1) * this.PAGE_SIZE + 1;
  }

  get globalEnd(): number {
    return (this.apiBatchNo - 1) * this.BATCH_SIZE + Math.min(this.currentPage * this.PAGE_SIZE, this.batchEmployees.length);
  }

  get batchLabel(): string {
    const from = (this.apiBatchNo - 1) * this.BATCH_SIZE + 1;
    const to   = (this.apiBatchNo - 1) * this.BATCH_SIZE + this.batchEmployees.length;
    return `Records ${from}–${to}`;
  }

  openViewModal(emp: EmployeeDto): void {
    this.selectedEmployee = emp;
    this.employeeProfile = null;
    this.showViewModal = true;
    this.isLoadingProfile = true;

    this.api.GetEmployeeProfile(emp.empId).subscribe({
      next: (res: any) => {
        this.employeeProfile = res.data ?? null;
        this.isLoadingProfile = false;
      },
      error: () => {
        this.toastr.error('Failed to load employee profile.');
        this.isLoadingProfile = false;
      }
    });
  }

  closeViewModal(): void {
    this.showViewModal = false;
    this.selectedEmployee = null;
    this.employeeProfile = null;
  }

  getProfileImageFromProfile(profile: EmployeeProfileDto): string {
    return AvatarUtil.processProfileImage(profile.profileImageBase64);
  }

  getProfileImage(emp: EmployeeDto): string {
    return AvatarUtil.processProfileImage(emp.profileImageBase64);
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].substring(0, 2).toUpperCase();
  }

  private readonly avatarColors = [
    'linear-gradient(135deg,#1B2A38,#138271)',
    'linear-gradient(135deg,#3b82f6,#6366f1)',
    'linear-gradient(135deg,#ec4899,#f43f5e)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#8b5cf6,#6366f1)',
    'linear-gradient(135deg,#10b981,#059669)',
  ];

  getAvatarColor(name: string): string {
    if (!name) return this.avatarColors[0];
    return this.avatarColors[name.charCodeAt(0) % this.avatarColors.length];
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
