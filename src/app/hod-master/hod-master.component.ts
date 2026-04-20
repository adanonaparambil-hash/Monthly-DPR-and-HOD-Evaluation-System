import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Api } from '../services/api';
import { HodMasterDto, HodMasterRequestDto } from '../models/common.model';
import { AvatarUtil } from '../utils/avatar.util';

@Component({
  selector: 'app-hod-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hod-master.component.html',
  styleUrls: ['./hod-master.component.css']
})
export class HodMasterComponent implements OnInit {
  hodList: HodMasterDto[] = [];
  filterName: string = '';
  filterDepartment: string = '';
  isLoading: boolean = false;
  showEditModal: boolean = false;
  isCreateMode: boolean = false;
  selectedHod: HodMasterDto | null = null;
  isSaving: boolean = false;
  departmentList: string[] = [];
  selectedDepartment: string = '';

  // Create form fields
  createEmpId: string = '';
  createEmpName: string = '';
  createDesignation: string = '';
  createIsActive: string = 'Y';

  // Employee master searchable dropdown
  empMasterList: { idValue: string; description: string; email: string; phoneNumber: string }[] = [];
  empSearchText: string = '';
  showEmpDropdown: boolean = false;
  isLoadingProfile: boolean = false;
  createProfileImage: string | null = null;

  get filteredEmpList() {
    if (!this.empSearchText.trim()) return this.empMasterList.slice(0, 50);
    const q = this.empSearchText.toLowerCase();
    return this.empMasterList.filter(e => e.description.toLowerCase().includes(q)).slice(0, 50);
  }

  constructor(private api: Api, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.loadDepartments();
    this.loadHodList();
  }

  loadDepartments(): void {
    this.api.GetDepartmentList().subscribe({
      next: (res: any) => {
        const raw: any[] = Array.isArray(res?.data) ? res.data : [];
        this.departmentList = raw
          .map((d: any) => (d.deptName || d.description || '').trim())
          .filter((n: string) => n.length > 0)
          .sort((a: string, b: string) => a.localeCompare(b));
      },
      error: () => {}
    });
  }

  loadHodList(): void {
    this.isLoading = true;
    this.api.getHodMaster(this.filterName, this.filterDepartment).subscribe({
      next: (res: any) => {
        this.hodList = res.data ?? [];
        this.isLoading = false;
      },
      error: () => {
        this.toastr.error('Failed to load HOD list.');
        this.isLoading = false;
      }
    });
  }

  onSearch(): void {
    this.loadHodList();
  }

  openCreateModal(): void {
    this.isCreateMode = true;
    this.createEmpId = '';
    this.createEmpName = '';
    this.createDesignation = '';
    this.createIsActive = 'Y';
    this.selectedDepartment = '';
    this.empSearchText = '';
    this.showEmpDropdown = false;
    this.createProfileImage = null;
    this.isLoadingProfile = false;
    this.showEditModal = true;

    // Load dept list if not already loaded
    if (this.departmentList.length === 0) this.loadDepartments();

    if (this.empMasterList.length === 0) {
      this.api.getEmployeeMasterList().subscribe({
        next: (res: any) => { this.empMasterList = res.data ?? []; },
        error: () => {}
      });
    }
  }

  selectEmployee(emp: { idValue: string; description: string }): void {
    const parts = emp.description.split('|');
    this.createEmpName = parts[0]?.trim() ?? emp.description;
    this.createEmpId = emp.idValue;
    this.empSearchText = emp.description;
    this.showEmpDropdown = false;
    this.createDesignation = '';
    this.createProfileImage = null;
    this.isLoadingProfile = true;

    this.api.GetEmployeeProfile(emp.idValue).subscribe({
      next: (res: any) => {
        const profile = res.data;
        if (profile) {
          this.createDesignation = profile.designation ?? '';
          // profileImageBase64 comes as a raw base64 string from the API
          this.createProfileImage = profile.profileImageBase64 ?? null;
          // Auto-select department
          const dept: string = (profile.department ?? '').trim();
          if (dept) {
            const match = this.departmentList.find(
              d => d.toLowerCase() === dept.toLowerCase()
            );
            if (match) {
              setTimeout(() => { this.selectedDepartment = match; }, 0);
            } else {
              if (!this.departmentList.includes(dept)) {
                this.departmentList = [dept, ...this.departmentList];
              }
              setTimeout(() => { this.selectedDepartment = dept; }, 0);
            }
          }
        }
        this.isLoadingProfile = false;
      },
      error: () => { this.isLoadingProfile = false; }
    });
  }

  onEmpSearchFocus(): void { this.showEmpDropdown = true; }

  onEmpSearchBlur(): void {
    // Delay so click on item registers first
    setTimeout(() => { this.showEmpDropdown = false; }, 200);
  }

  openEditModal(hod: HodMasterDto): void {
    this.isCreateMode = false;
    this.selectedHod = { ...hod };
    this.selectedDepartment = '';
    this.showEditModal = true;

    const hodDept = (hod.department || '').trim();

    // Use already-loaded list, or fetch if empty
    const applyDept = (depts: string[]) => {
      const exactMatch = depts.find(d => d === hodDept);
      const ciMatch = depts.find(d => d.toLowerCase() === hodDept.toLowerCase());
      const matched = exactMatch ?? ciMatch;
      if (!matched && hodDept && !depts.includes(hodDept)) depts.unshift(hodDept);
      this.departmentList = [...depts];
      setTimeout(() => { this.selectedDepartment = matched ?? hodDept; }, 0);
    };

    if (this.departmentList.length > 0) {
      applyDept([...this.departmentList]);
    } else {
      this.api.GetDepartmentList().subscribe({
        next: (res: any) => {
          const raw: any[] = Array.isArray(res?.data) ? res.data : [];
          const depts = raw.map((d: any) => (d.deptName || d.description || '').trim()).filter(n => n.length > 0).sort((a: string, b: string) => a.localeCompare(b));
          applyDept(depts);
        },
        error: () => {
          this.departmentList = hodDept ? [hodDept] : [];
          setTimeout(() => { this.selectedDepartment = hodDept; }, 0);
        }
      });
    }
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedHod = null;
    this.isCreateMode = false;
    this.createProfileImage = null;
    this.isLoadingProfile = false;
  }

  isActiveStatus(val: string): boolean {
    return (val || '').trim() === 'Y';
  }

  get activeCount(): number {
    return this.hodList.filter(h => h.isActive === 'Y').length;
  }

  getProfileImage(hod: HodMasterDto): string {
    return AvatarUtil.processProfileImage(hod.profileImageBase64);
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
    const idx = name.charCodeAt(0) % this.avatarColors.length;
    return this.avatarColors[idx];
  }

  onSave(): void {
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');

    if (this.isCreateMode) {
      if (!this.createEmpId.trim() || !this.createEmpName.trim() || !this.selectedDepartment) {
        this.toastr.warning('Please fill all required fields.');
        return;
      }
      const request: HodMasterRequestDto = {
        empId: this.createEmpId.trim(),
        employeeName: this.createEmpName.trim(),
        department: this.selectedDepartment,
        designation: this.createDesignation.trim(),
        isActive: this.createIsActive,
        createdBy: currentUser.empId
      };
      this.isSaving = true;
      this.api.saveHodMaster(request).subscribe({
        next: () => {
          this.toastr.success('HOD created successfully.');
          this.isSaving = false;
          this.closeEditModal();
          this.loadHodList();
        },
        error: () => {
          this.toastr.error('Failed to create HOD.');
          this.isSaving = false;
        }
      });
      return;
    }

    if (!this.selectedHod) return;
    const request: HodMasterRequestDto = {
      id: this.selectedHod.id,
      empId: this.selectedHod.empId,
      employeeName: this.selectedHod.employeeName,
      department: this.selectedDepartment,
      designation: this.selectedHod.designation,
      isActive: this.selectedHod.isActive,
      createdBy: currentUser.empId
    };

    this.isSaving = true;
    this.api.saveHodMaster(request).subscribe({
      next: () => {
        this.toastr.success('HOD saved successfully.');
        this.isSaving = false;
        this.closeEditModal();
        this.loadHodList();
      },
      error: () => {
        this.toastr.error('Failed to save HOD.');
        this.isSaving = false;
      }
    });
  }
}
