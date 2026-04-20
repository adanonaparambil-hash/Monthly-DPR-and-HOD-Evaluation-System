import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Api } from '../services/api';
import { ToasterService } from '../services/toaster.service';
import { ToasterComponent } from '../components/toaster/toaster.component';

@Component({
  selector: 'app-rejoining-form',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ToasterComponent],
  templateUrl: './rejoining-form.html',
  styleUrl: './rejoining-form.css'
})
export class RejoiningForm implements OnInit {
  rejoiningForm: FormGroup;
  isSubmitting = false;
  submitSuccess = false;

  // View mode (loaded from approval listing)
  isViewMode = false;
  rejoinRecord: any = null;
  approvalList: any[] = [];
  isLoadingRecord = false;

  // Approver action (when opened from pending approvals with matching approvalId)
  incomingApprovalId: number | null = null;
  incomingApproverCode: string = '';
  approverRemarks: string = '';
  isApproving = false;
  approvalActionDone = false;

  // Resubmit mode: owner viewing their own R/S/P record
  isResubmitMode = false;

  // Employee profile data
  employeeProfile: any = null;
  isLoadingProfile = false;
  profileImage: string = 'assets/images/default-avatar.png';

  // Employee type tab
  employeeType: 'expatriate' | 'national' = 'expatriate';
  employeeMasterList: { idValue: string; description: string; nationality: string }[] = [];
  employeeSearchTerm = '';
  showEmployeeDropdown = false;
  selectedEmployeeDisplay = '';
  dropdownTop = 0;
  dropdownLeft = 0;
  dropdownWidth = 0;

  // Today's punch times
  punches: { label: string; icon: string; color: string; time: string }[] = [];
  punchesLoading = true;
  punchDate: string = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private api: Api,
    private toaster: ToasterService
  ) {
    this.rejoiningForm = this.fb.group({
      employeeId:          ['', [Validators.required]],
      employeeName:        [''],
      department:          [''],
      designation:         [''],
      stationSection:      [''],
      labourCardExpiry:    [''],
      // Emergency Contact
      emergencyName:       [''],
      emergencyRelation:   [''],
      emergencyContact:    [''],
      emergencyEmail:      [''],
      emergencyAddress:    [''],
      // Leave & Joining
      leaveType:           [''],
      dateOfDeparture:     [''],
      approvedReturnDate:  [''],
      extendedUpto:        [''],
      previousExitDate:    [''],
      rejoiningDate:       [''],
      reasonForRejoining:  [''],
      // Passport
      passportNo:          [''],
      passportIssueDate:   [''],
      passportExpiryDate:  [''],
      // Declaration
      medicalClearance:    [false],
      agreementAccepted:   [false],
      // Salary
      previousSalary:      [''],
      expectedSalary:      [''],
      contactNumber:       [''],
      email:               [''],
    });
  }

  ngOnInit(): void {
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const empId = (currentUser?.empId || currentUser?.userId || currentUser?.id || '').toString();
    this.loadEmployeeMasterList();
    if (empId) this.loadPunches(empId);

    // Check if opened from approval listing
    const rejoinId  = this.route.snapshot.queryParamMap.get('rejoinId');
    const approvalId = this.route.snapshot.queryParamMap.get('approvalID')
                    || this.route.snapshot.queryParamMap.get('approvalId');
    const approverCode = this.route.snapshot.queryParamMap.get('approverCode') || '';
    if (rejoinId) {
      this.isViewMode = true;
      if (approvalId) this.incomingApprovalId = +approvalId;
      this.incomingApproverCode = approverCode.toUpperCase();
      this.loadRejoinRecord(+rejoinId);
    }
  }
  loadPunches(empId: string, forDate?: string): void {
    if (!empId) return;

    let date: string;
    if (forDate) {
      // Use the provided date (e.g. createdOn from the record)
      const d = new Date(forDate);
      date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else {
      const today = new Date();
      date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    this.punchDate = date;
    const meta = [
      { label: 'Punch 1', icon: 'fa-sign-in-alt',  color: 'green'  },
      { label: 'Punch 2', icon: 'fa-sign-out-alt', color: 'red'    },
      { label: 'Punch 3', icon: 'fa-sign-in-alt',  color: 'blue'   },
      { label: 'Punch 4', icon: 'fa-sign-out-alt', color: 'orange' },
    ];

    this.punchesLoading = true;
    this.punches = [];

    this.api.getEmployeePunchByDate(empId, date).subscribe({
      next: (res: any) => {
        const list: any[] = (res?.data || []).slice(0, 4);
        this.punches = meta.map((m, i) => {
          const p = list[i];
          let time = '';
          if (p) {
            const raw: string = p.punchTime || p.accessTime || '';
            const parts = raw.trim().split(' ');
            const timePart = parts.length > 1 ? parts[1] : parts[0];
            if (timePart) {
              const [hStr, mStr] = timePart.split(':');
              let h = parseInt(hStr, 10);
              const m = mStr || '00';
              const ampm = h >= 12 ? 'PM' : 'AM';
              h = h % 12 || 12;
              time = `${String(h).padStart(2, '0')}:${m} ${ampm}`;
            }
          }
          return { ...m, time };
        });
        this.punchesLoading = false;
      },
      error: () => {
        this.punches = meta.map(m => ({ ...m, time: '' }));
        this.punchesLoading = false;
      }
    });
  }

  loadRejoinRecord(rejoinId: number): void {
    this.isLoadingRecord = true;
    this.api.getEmployeeRejoiningById(rejoinId).subscribe({
      next: (res: any) => {
        this.isLoadingRecord = false;
        if (res?.success && res?.data) {
          const d = res.data;
          this.rejoinRecord = d;
          this.approvalList = d.approvalList || [];

          // Patch form with all returned fields
          this.rejoiningForm.patchValue({
            employeeId:         d.employeeId || '',
            stationSection:     d.section || '',
            labourCardExpiry:   this.parseToInputDate(d.labourCardExpiryDate),
            emergencyName:      d.emergencyContactName || '',
            emergencyRelation:  d.relation || '',
            emergencyContact:   d.emergencyContactPhone || '',
            emergencyEmail:     d.emergencyContactEmail || '',
            emergencyAddress:   d.emergencyContactAddress || '',
            leaveType:          d.leaveType || '',
            dateOfDeparture:    this.parseToInputDate(d.dateOfDeparture),
            approvedReturnDate: this.parseToInputDate(d.approvedLeaveArrivalDate),
            extendedUpto:       this.parseToInputDate(d.extensionDate),
            previousExitDate:   this.parseToInputDate(d.arrivedOn),
            rejoiningDate:      this.parseToInputDate(d.joiningDate),
            reasonForRejoining: d.remarks || '',
            passportNo:         d.passportNo || '',
            passportIssueDate:  this.parseToInputDate(d.passportDateOfIssue),
            passportExpiryDate: this.parseToInputDate(d.passportExpiryDate),
          });

          // Determine if the logged-in user is the record owner
          const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
          const loggedEmpId = (currentUser?.empId || currentUser?.userId || currentUser?.id || '').toString();
          const recordStatus = (d.status || '').toUpperCase();
          const isOwner = loggedEmpId && d.employeeId && loggedEmpId === d.employeeId.toString();
          const isResubmittable = isOwner && recordStatus === 'R';

          if (isResubmittable) {
            // Owner viewing a rejected/pending record — allow editing & resubmission
            this.isResubmitMode = true;
            // Enable all controls so the user can edit
            Object.keys(this.rejoiningForm.controls).forEach(k =>
              this.rejoiningForm.get(k)?.enable()
            );
            // Keep employeeId read-only (shouldn't change)
            this.rejoiningForm.get('employeeId')?.disable();
          } else {
            // Pure view mode — disable everything
            this.isResubmitMode = false;
            Object.keys(this.rejoiningForm.controls).forEach(k =>
              this.rejoiningForm.get(k)?.disable()
            );
          }

          // Auto-check declarations in view mode (already submitted)
          this.rejoiningForm.get('medicalClearance')?.setValue(true);
          this.rejoiningForm.get('agreementAccepted')?.setValue(true);

          // Load employee profile for avatar/name
          if (d.employeeId) {
            this.loadEmployeeProfile(d.employeeId);
            this.loadPunches(d.employeeId, d.createdOn);
          }
        }
      },
      error: () => { this.isLoadingRecord = false; }
    });
  }

  /** Overall form status label shown in the banner */
  getFormStatusLabel(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'P': return 'Pending';
      case 'A': return 'Approved';
      case 'R': return 'Rejected';
      case 'S': return 'Pending';   // legacy — treat same as P
      default:  return 'In Progress';
    }
  }

  /** CSS modifier class for the banner status badge */
  getFormStatusClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'A': return 'rj-status-approved';
      case 'R': return 'rj-status-rejected';
      case 'P':
      case 'S': return 'rj-status-pending';
      default:  return '';
    }
  }

  /** Dot/icon for the banner status badge */
  getFormStatusIcon(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'A': return 'fa-check-circle';
      case 'R': return 'fa-times-circle';
      default:  return 'fa-clock';
    }
  }

  getApprovalStatusClass(code: string): string {
    switch ((code || '').toUpperCase()) {
      case 'A': return 'rj-apv-approved';
      case 'R': return 'rj-apv-rejected';
      default:  return 'rj-apv-pending';
    }
  }

  /** Check if a specific approver card belongs to the current user and is pending */
  isMyPendingApproval(apv: any): boolean {
    if (!this.incomingApprovalId || !this.isViewMode) return false;
    if ((apv.approvalStatusCode || '').toUpperCase() !== 'P') return false;
    // Match by approverCode from URL (e.g. 'HR', 'ADMIN')
    if (this.incomingApproverCode) {
      return (apv.approverCode || '').toUpperCase() === this.incomingApproverCode;
    }
    // Fallback: match by current user's empId
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const myEmpId = (currentUser?.empId || currentUser?.userId || '').toString();
    return apv.approverId === myEmpId;
  }

  submitApprovalAction(status: 'A' | 'R'): void {
    if (!this.incomingApprovalId) return;
    this.isApproving = true;

    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const d = this.rejoinRecord || {};
    // Helper: return null for empty/falsy date strings so backend DateTime? stays null
    const dt = (v: any) => (v && String(v).trim() !== '') ? v : null;

    const payload: any = {
      // ── record identity ──────────────────────────────────────
      rejoinId:                 d.rejoinId,
      employeeId:               d.employeeId || '',
      // ── all existing form fields ─────────────────────────────
      section:                  d.section || '',
      labourCardExpiryDate:     dt(d.labourCardExpiryDate),
      emergencyContactName:     d.emergencyContactName || '',
      relation:                 d.relation || '',
      emergencyContactPhone:    d.emergencyContactPhone || '',
      emergencyContactEmail:    d.emergencyContactEmail || '',
      emergencyContactAddress:  d.emergencyContactAddress || '',
      leaveType:                d.leaveType || '',
      dateOfDeparture:          dt(d.dateOfDeparture),
      approvedLeaveArrivalDate: dt(d.approvedLeaveArrivalDate),
      extensionDate:            dt(d.extensionDate),
      arrivedOn:                dt(d.arrivedOn),
      joiningDate:              dt(d.joiningDate),
      remarks:                  d.remarks || '',
      passportNo:               d.passportNo || '',
      passportDateOfIssue:      dt(d.passportDateOfIssue),
      passportExpiryDate:       dt(d.passportExpiryDate),
      // ── approval-specific fields ─────────────────────────────
      approvalId:               this.incomingApprovalId,
      approvalRemarks:          this.approverRemarks || '',
      status:                   status,
      createdBy:                currentUser?.empId || currentUser?.userId || '',
      baseurl:                  document.baseURI
    };

    console.log('=== REJOINING APPROVAL ACTION ===');
    console.log('Action:', status === 'A' ? 'APPROVE' : 'REJECT');
    console.log('API URL: POST /api/EmpExitForm/SaveEmployeeRejoining');
    console.log('Full payload:', JSON.stringify(payload, null, 2));

    this.api.saveEmployeeRejoining(payload).subscribe({
      next: (res: any) => {
        this.isApproving = false;
        this.approvalActionDone = true;
        const label = status === 'A' ? 'Approved' : 'Rejected';
        this.toaster.showSuccess(
          `Application ${label}`,
          `The rejoining request has been ${label.toLowerCase()} successfully.`
        );
        setTimeout(() => {
          this.router.navigate(['/leave-approval'], { queryParams: { tab: 'pending' } });
        }, 1800);
      },
      error: () => {
        this.isApproving = false;
        this.toaster.showError('Action Failed', 'Something went wrong. Please try again.');
      }
    });
  }

  getApprovalStatusLabel(code: string): string {
    switch ((code || '').toUpperCase()) {
      case 'A': return 'Approved';
      case 'R': return 'Rejected';
      default:  return 'Pending';
    }
  }

  getApprovalStatusIcon(code: string): string {
    switch ((code || '').toUpperCase()) {
      case 'A': return 'fa-check-circle';
      case 'R': return 'fa-times-circle';
      default:  return 'fa-clock';
    }
  }

  getApproverImage(item: any): string | null {
    const b64 = item.profileImageBase64 || item.profileImage;
    if (!b64) return null;
    return b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
  }

  loadEmployeeMasterList(): void {
    this.api.GetEmployeeMasterList().subscribe({
      next: (res: any) => {
        const list = res?.data || (Array.isArray(res) ? res : []);
        this.employeeMasterList = list.map((emp: any) => ({
          idValue: (emp.idValue || emp.empId || emp.id || emp.employeeId || '').toString(),
          description: emp.description || emp.employeeName || emp.name || '',
          nationality: (emp.nationality || emp.Nationality || '').toString().toUpperCase()
        }));
        // Auto-select logged-in user
        const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
        const empId = (currentUser?.empId || currentUser?.userId || currentUser?.id || '').toString();
        if (empId) {
          const match = this.employeeMasterList.find(e => e.idValue === empId);
          if (match) {
            this.selectEmployee(match);
          } else {
            this.loadEmployeeProfile(empId);
          }
        }
      },
      error: () => {
        const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
        const empId = (currentUser?.empId || currentUser?.userId || currentUser?.id || '').toString();
        if (empId) this.loadEmployeeProfile(empId);
      }
    });
  }

  get filteredEmployees() {
    const term = this.employeeSearchTerm.toLowerCase();
    if (!term) return this.employeeMasterList;
    return this.employeeMasterList.filter(e =>
      e.description.toLowerCase().includes(term) || e.idValue.toLowerCase().includes(term)
    );
  }

  selectEmployee(emp: { idValue: string; description: string; nationality: string }): void {
    this.selectedEmployeeDisplay = `${emp.description} (${emp.idValue})`;
    this.rejoiningForm.patchValue({ employeeId: emp.idValue });
    this.showEmployeeDropdown = false;
    this.employeeSearchTerm = '';
    this.employeeType = emp.nationality === 'OMANI' ? 'national' : 'expatriate';
    this.loadEmployeeProfile(emp.idValue);
    this.loadPunches(emp.idValue);
  }

  toggleEmployeeDropdown(trigger: HTMLElement): void {
    if (this.showEmployeeDropdown) {
      this.showEmployeeDropdown = false;
      return;
    }
    const rect = trigger.getBoundingClientRect();
    this.dropdownTop = rect.bottom + window.scrollY + 4;
    this.dropdownLeft = rect.left + window.scrollX;
    this.dropdownWidth = rect.width;
    this.showEmployeeDropdown = true;
  }

  closeEmployeeDropdown(): void {
    this.showEmployeeDropdown = false;
  }

  loadEmployeeProfile(empId: string): void {
    this.isLoadingProfile = true;
    this.api.GetEmployeeProfile(empId).subscribe({
      next: (res: any) => {
        this.isLoadingProfile = false;
        if (res?.success && res?.data) {
          const d = res.data;
          this.employeeProfile = d;

          // Set profile image
          if (d.profileImageBase64) {
            this.profileImage = d.profileImageBase64.startsWith('data:')
              ? d.profileImageBase64
              : `data:image/jpeg;base64,${d.profileImageBase64}`;
          }

          // Patch form fields
          this.rejoiningForm.patchValue({
            employeeId: d.empId || '',
            employeeName: d.employeeName || '',
            department: d.department || '',
            designation: d.designation || '',
            email: d.email || '',
            contactNumber: (d.phone || '').replace(/\D/g, '').slice(-10)
          });
        }
      },
      error: (err: any) => {
        this.isLoadingProfile = false;
        console.error('Failed to load employee profile', err);
      }
    });
  }

  onSubmit(): void {
    if (!this.rejoiningForm.get('employeeId')?.value && !this.rejoinRecord?.employeeId) {
      return;
    }
    this.isSubmitting = true;
    const v = this.rejoiningForm.getRawValue(); // getRawValue includes disabled fields
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const createdBy = (currentUser?.empId || currentUser?.userId || currentUser?.id || '').toString();
    // Helper: return null for empty/falsy date strings so backend DateTime? stays null
    const dt = (v: any) => (v && String(v).trim() !== '') ? v : null;

    const payload: any = {
      // Include rejoinId when resubmitting an existing record
      ...(this.isResubmitMode && this.rejoinRecord?.rejoinId
        ? { rejoinId: this.rejoinRecord.rejoinId }
        : {}),
      employeeId:               v.employeeId || this.rejoinRecord?.employeeId,
      section:                  v.stationSection || '',
      labourCardExpiryDate:     dt(v.labourCardExpiry),
      emergencyContactName:     v.emergencyName || '',
      relation:                 v.emergencyRelation || '',
      emergencyContactPhone:    v.emergencyContact || '',
      emergencyContactEmail:    v.emergencyEmail || '',
      emergencyContactAddress:  v.emergencyAddress || '',
      leaveType:                v.leaveType || '',
      dateOfDeparture:          dt(v.dateOfDeparture),
      approvedLeaveArrivalDate: dt(v.approvedReturnDate),
      extensionDate:            dt(v.extendedUpto),
      arrivedOn:                dt(v.previousExitDate),
      joiningDate:              dt(v.rejoiningDate),
      remarks:                  v.reasonForRejoining || '',
      passportNo:               v.passportNo || '',
      passportDateOfIssue:      dt(v.passportIssueDate),
      passportExpiryDate:       dt(v.passportExpiryDate),
      status:                   'S',
      createdBy:                createdBy,
      baseurl:                  document.baseURI
    };

    console.log('=== REJOINING FORM SUBMIT ===');
    console.log('Mode:', this.isResubmitMode ? 'RESUBMIT (existing record)' : 'NEW SUBMISSION');
    console.log('API URL: POST /api/EmpExitForm/SaveEmployeeRejoining');
    console.log('Full payload:', JSON.stringify(payload, null, 2));

    this.api.saveEmployeeRejoining(payload).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        if (res?.success) {
          this.toaster.showSuccess(
            'Application Submitted',
            'Your rejoining request has been submitted successfully.'
          );
          setTimeout(() => {
            this.router.navigate(['/leave-approval'], { queryParams: { tab: 'myRequests' } });
          }, 1800);
        } else {
          this.toaster.showError('Submission Failed', res?.message || 'Failed to submit. Please try again.');
        }
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.toaster.showError('Submission Failed', 'Something went wrong. Please try again.');
        console.error('Error saving rejoining form:', err);
      }
    });
  }

  private markFormGroupTouched(): void {
    Object.keys(this.rejoiningForm.controls).forEach(key => {
      this.rejoiningForm.get(key)?.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.rejoiningForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.rejoiningForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return `${this.getFieldLabel(fieldName)} is required`;
      if (field.errors['email']) return 'Please enter a valid email address';
      if (field.errors['pattern']) return 'Please enter a valid format';
      if (field.errors['minlength']) return `Minimum ${field.errors['minlength'].requiredLength} characters required`;
      if (field.errors['min']) return 'Value must be greater than 0';
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      employeeId: 'Employee ID', employeeName: 'Employee Name',
      department: 'Department', designation: 'Designation',
      previousExitDate: 'Previous Exit Date', rejoiningDate: 'Rejoining Date',
      reasonForRejoining: 'Reason for Rejoining', previousSalary: 'Previous Salary',
      expectedSalary: 'Expected Salary', contactNumber: 'Contact Number',
      email: 'Email Address', emergencyContact: 'Emergency Contact',
      medicalClearance: 'Medical Clearance', agreementAccepted: 'Agreement'
    };
    return labels[fieldName] || fieldName;
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  getTodayDate(): string {
    const d = this.punchDate ? new Date(this.punchDate) : new Date();
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  onAvatarError(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/images/default-avatar.png';
  }

  // Converts "08-SEP-2025" or any parseable date string to "yyyy-MM-dd" for <input type="date">
  parseToInputDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }

  getSkillsArray(): string[] {
    return this.employeeProfile?.skillset
      ? this.employeeProfile.skillset.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];
  }

  goBack(): void { this.location.back(); }

  goToMyRequests(): void {
    this.router.navigate(['/leave-approval'], { queryParams: { tab: 'myRequests' } });
  }
}

