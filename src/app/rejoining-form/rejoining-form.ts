import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Api } from '../services/api';
import { ToasterService } from '../services/toaster.service';
import { ToasterComponent } from '../components/toaster/toaster.component';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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

  // Approval transaction history (from TS_EMP_APPROVAL_HISTORY)
  approvalHistory: any[] = [];
  openHistoryApv: any = null;

  // Approver action (when opened from pending approvals with matching approvalId)
  incomingApprovalId: number | null = null;
  incomingApproverCode: string = '';
  approverRemarks: string = '';
  isApproving = false;
  approvalActionDone = false;

  // Resubmit mode: owner viewing their own R/S/P record
  isResubmitMode = false;

  // PDF export
  isPdfGenerating = false;

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
    // Check if opened from approval listing FIRST — a saved record must show the
    // submitted employee, never the logged-in user (who is only the default for NEW forms)
    const rejoinId  = this.route.snapshot.queryParamMap.get('rejoinId');
    const approvalId = this.route.snapshot.queryParamMap.get('approvalID')
                    || this.route.snapshot.queryParamMap.get('approvalId');
    const approverCode = this.route.snapshot.queryParamMap.get('approverCode') || '';
    if (rejoinId) {
      this.isViewMode = true;
      if (approvalId) this.incomingApprovalId = +approvalId;
      this.incomingApproverCode = approverCode.toUpperCase();
    }

    this.loadEmployeeMasterList();

    if (rejoinId) {
      // Existing record: employee/profile/punches come from the record itself
      this.loadRejoinRecord(+rejoinId);
    } else {
      // New form: default punches to the logged-in user
      const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
      const empId = (currentUser?.empId || currentUser?.userId || currentUser?.id || '').toString();
      if (empId) this.loadPunches(empId);
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

          // Bind approval transaction history (past approve/reject actions with comments)
          this.approvalHistory = this.mapApprovalHistory(d.approvalHistory || d.ApprovalHistory || []);

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

  /** Normalize the approval history rows returned by the API */
  private mapApprovalHistory(raw: any[]): any[] {
    return (raw || []).map((h: any) => ({
      approvalLevel: h.approvalLevel ?? h.ApprovalLevel,
      approverCode: (h.approverCode || h.ApproverCode || '').toString().trim(),
      approverRole: h.approverRole || h.ApproverRole || '',
      approverId: (h.approverId || h.ApproverId || '').toString().trim(),
      approverName: h.approverName || h.ApproverName || '',
      action: (h.action || h.Action || '').toString().trim().toUpperCase(),
      remarks: h.remarks || h.Remarks || '',
      actionDate: h.actionDate || h.ActionDate || null
    }));
  }

  /** History entries (approve/reject comments) for this approver's step.
   *  Matches on ApproverCode (role/section) AND ApproverId, so a user who appears
   *  in multiple sections only sees each comment under the section it was made in.
   *  RESUBMITTED entries are excluded — only Approved/Rejected actions are shown. */
  getApvHistory(apv: any): any[] {
    if (!this.approvalHistory || this.approvalHistory.length === 0 || !apv) {
      return [];
    }
    const id = (apv.approverId || '').toString().trim();
    const code = (apv.approverCode || '').toString().trim();
    if (!id && !code) {
      return [];
    }
    return this.approvalHistory.filter((h: any) => {
      if (h.action === 'RESUBMITTED') { return false; }
      const codeMatches = !code || h.approverCode === code;
      const idMatches = !id || h.approverId === id;
      return codeMatches && idMatches;
    });
  }

  toggleApvHistory(apv: any, event?: Event): void {
    if (event) { event.stopPropagation(); }
    this.openHistoryApv = this.openHistoryApv === apv ? null : apv;
  }

  getHistoryActionLabel(h: any): string {
    switch (h.action) {
      case 'APPROVED': return 'Approved';
      case 'REJECTED': return 'Rejected';
      case 'RESUBMITTED': return 'Resubmitted';
      default: return h.action || 'Updated';
    }
  }

  getHistoryActionClass(h: any): string {
    switch (h.action) {
      case 'APPROVED': return 'history-action-approved';
      case 'REJECTED': return 'history-action-rejected';
      case 'RESUBMITTED': return 'history-action-resubmitted';
      default: return 'history-action-other';
    }
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
        // Auto-select logged-in user — NEW forms only. When viewing a saved
        // record the employee comes from the record; never overwrite it here.
        if (this.isViewMode) { return; }
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
        if (this.isViewMode) { return; }
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

          // Keep the visible Employee field in sync with whoever this profile
          // belongs to (record owner on saved forms; logged-in user on new forms)
          if (d.employeeName) {
            this.selectedEmployeeDisplay = `${d.employeeName} (${d.empId || ''})`.trim();
          }
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

  async downloadAsPdf(): Promise<void> {
    if (this.isPdfGenerating) return;
    this.isPdfGenerating = true;
    try {
      // ── Load logo ─────────────────────────────────────────────────────────────
      let logoDataUrl = '';
      try {
        const r = await fetch('assets/images/Logo_LoginScreen.png');
        const b = await r.blob();
        logoDataUrl = await new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); });
      } catch (_) {}

      // ── Constants ─────────────────────────────────────────────────────────────
      const pW = 210, pH = 297, margin = 8, cW = pW - margin * 2, footerH = 8;
      const maxY = pH - footerH - 4;
      const teal = [19, 130, 113] as [number, number, number];
      const dark = [27, 42, 56] as [number, number, number];
      const fv = this.rejoiningForm.getRawValue();
      const rec = this.rejoinRecord;
      const formNo = rec?.rejoinId ? `RJ-${rec.rejoinId}` : 'RJ-2024-001';
      const formDate = rec?.createdOn ? new Date(rec.createdOn).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
      const empNameRaw = (fv.employeeName || this.selectedEmployeeDisplay || 'Employee').toUpperCase();
      const isExpat = this.employeeType === 'expatriate';

      const fmtDate = (d: string) => { if (!d) return '—'; try { const dt = new Date(d); return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); } catch { return d; } };

      // ── PDF setup ─────────────────────────────────────────────────────────────
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let y = 0;
      const newPage = () => { pdf.addPage(); y = margin + 2; };
      const chk = (need: number) => { if (y + need > maxY) newPage(); };

      const secHeader = (title: string) => {
        chk(8);
        pdf.setFillColor(...teal); pdf.rect(margin, y, cW, 5.5, 'F');
        pdf.setFillColor(255, 255, 255); pdf.rect(margin, y, 2, 5.5, 'F');
        pdf.setFillColor(...teal); pdf.rect(margin + 0.5, y, 1.5, 5.5, 'F');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(255, 255, 255);
        pdf.text(title, margin + 4, y + 3.8);
        y += 7;
      };

      const twoCol = (rows: { l: string; lv: string; r?: string; rv?: string }[]) => {
        const hw = (cW - 6) / 2;
        rows.forEach(row => {
          const lLines = pdf.splitTextToSize(row.lv || '—', hw - 2);
          const rLines = row.r ? pdf.splitTextToSize(row.rv || '—', hw - 2) : [];
          const rh = Math.max(lLines.length, rLines.length) * 3.2 + 6.5;
          chk(rh);
          pdf.setFillColor(248, 250, 252); pdf.rect(margin, y, cW, rh - 0.8, 'F');
          pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.12); pdf.rect(margin, y, cW, rh - 0.8, 'S');
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
          pdf.text(row.l, margin + 2.5, y + 3);
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(15, 23, 42);
          pdf.text(lLines, margin + 2.5, y + 6.5);
          if (row.r) {
            const rx = margin + hw + 6;
            pdf.setFillColor(226, 232, 240); pdf.rect(margin + hw + 3, y + 0.8, 0.25, rh - 2.3, 'F');
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
            pdf.text(row.r, rx, y + 3);
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(15, 23, 42);
            pdf.text(rLines, rx, y + 6.5);
          }
          y += rh;
        });
        y += 0.5;
      };

      const fullField = (label: string, value: string) => {
        const lines = pdf.splitTextToSize(value || '—', cW - 6);
        const fh = lines.length * 3.2 + 7;
        chk(fh);
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
        pdf.text(label, margin, y + 3);
        pdf.setFillColor(248, 250, 252); pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.12);
        pdf.roundedRect(margin, y + 5, cW, lines.length * 3.2 + 2, 1, 1, 'FD');
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(15, 23, 42);
        pdf.text(lines, margin + 2, y + 8);
        y += fh;
      };

      // ══════════════════════════════════════════════════════════════════════════
      // HEADER
      // ══════════════════════════════════════════════════════════════════════════
      pdf.setFillColor(...dark); pdf.rect(0, 0, pW, 20, 'F');
      pdf.setFillColor(...teal); pdf.rect(0, 18.5, pW, 1.5, 'F');
      if (logoDataUrl) { try { pdf.addImage(logoDataUrl, 'PNG', margin, 3, 14, 12); } catch (_) {} }
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5); pdf.setTextColor(255, 255, 255);
      pdf.text('AL ADRAK TRADING AND CONTRACTING LLC', margin + 17, 9);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(165, 212, 206);
      pdf.text('JOINING REPORT — RETURN FROM LEAVE', margin + 17, 15);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(180, 220, 215);
      pdf.text(`Form No: ${formNo}   |   Date: ${formDate}   |   ${isExpat ? 'EXPATRIATE' : 'NATIONAL'}`, pW - margin, 9, { align: 'right' });

      const status = rec?.status || '';
      if (status) {
        const sc: [number,number,number] = status === 'A' ? [22,163,74] : status === 'R' ? [220,38,38] : [234,179,8];
        const stLbl = status === 'A' ? 'APPROVED' : status === 'R' ? 'REJECTED' : 'PENDING';
        const cW2 = pdf.getTextWidth(stLbl) + 6;
        pdf.setFillColor(...sc); pdf.roundedRect(pW - margin - cW2 - 1, 13, cW2, 5, 1, 1, 'F');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.setTextColor(255, 255, 255);
        pdf.text(stLbl, pW - margin - cW2 / 2 - 1, 16.6, { align: 'center' });
      }
      y = 23;

      // ══════════════════════════════════════════════════════════════════════════
      // 1. EMPLOYEE DETAILS
      // ══════════════════════════════════════════════════════════════════════════
      secHeader('1.  EMPLOYEE DETAILS');

      const photo = this.profileImage;
      const hasPhoto = photo && !photo.includes('default-avatar');
      const photoSize = 22, photoX = margin + cW - photoSize, photoY = y;
      if (hasPhoto) {
        try {
          pdf.addImage(photo, photo.startsWith('data:image/png') ? 'PNG' : 'JPEG', photoX, photoY, photoSize, photoSize);
          pdf.setDrawColor(...teal); pdf.setLineWidth(0.5); pdf.rect(photoX, photoY, photoSize, photoSize, 'S');
        } catch (_) {}
      } else {
        pdf.setFillColor(226, 232, 240); pdf.rect(photoX, photoY, photoSize, photoSize, 'F');
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); pdf.setTextColor(148, 163, 184);
        pdf.text('PHOTO', photoX + photoSize / 2, photoY + photoSize / 2 + 1, { align: 'center' });
      }

      const fw = cW - photoSize - 6, hw2 = (fw - 4) / 2, startY = y;
      const empRows = [
        { l: 'Employee Name', lv: fv.employeeName || this.selectedEmployeeDisplay || '—', r: 'Employee ID', rv: fv.employeeId || '—' },
        { l: 'Department', lv: fv.department || '—', r: 'Designation', rv: fv.designation || '—' },
        { l: 'Station / Section', lv: fv.stationSection || '—', r: 'Labour Card Expiry', rv: fmtDate(fv.labourCardExpiry) },
      ];
      empRows.forEach(row => {
        const lL = pdf.splitTextToSize(row.lv || '—', hw2 - 2);
        const rL = pdf.splitTextToSize(row.rv || '—', hw2 - 2);
        const rh = Math.max(lL.length, rL.length) * 3.2 + 6.5;
        chk(rh);
        pdf.setFillColor(248, 250, 252); pdf.rect(margin, y, fw, rh - 0.8, 'F');
        pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.12); pdf.rect(margin, y, fw, rh - 0.8, 'S');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
        pdf.text(row.l, margin + 2.5, y + 3);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(15, 23, 42);
        pdf.text(lL, margin + 2.5, y + 6.5);
        const rx = margin + hw2 + 5;
        pdf.setFillColor(226, 232, 240); pdf.rect(margin + hw2 + 2, y + 0.8, 0.25, rh - 2.3, 'F');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
        pdf.text(row.r, rx, y + 3);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(15, 23, 42);
        pdf.text(rL, rx, y + 6.5);
        y += rh;
      });
      y = Math.max(y, startY + photoSize + 2) + 1;

      // ══════════════════════════════════════════════════════════════════════════
      // 2. EMERGENCY CONTACT
      // ══════════════════════════════════════════════════════════════════════════
      secHeader('2.  EMERGENCY CONTACT');
      twoCol([
        { l: 'Contact Name', lv: fv.emergencyName || '—', r: 'Relationship', rv: fv.emergencyRelation || '—' },
        { l: 'Phone Number', lv: fv.emergencyContact || '—', r: 'Email', rv: fv.emergencyEmail || '—' },
      ]);
      if (fv.emergencyAddress) fullField('Address', fv.emergencyAddress);

      // ══════════════════════════════════════════════════════════════════════════
      // 3. LEAVE & JOINING DETAILS
      // ══════════════════════════════════════════════════════════════════════════
      secHeader('3.  LEAVE & JOINING DETAILS');
      twoCol([
        { l: isExpat ? 'Date of Departure' : 'Leave Start Date', lv: fmtDate(fv.dateOfDeparture), r: 'Approved Return Date', rv: fmtDate(fv.approvedReturnDate) },
        { l: 'Extended Upto', lv: fmtDate(fv.extendedUpto) || '—', r: isExpat ? 'Actual Arrival Date' : '', rv: isExpat ? fmtDate(fv.previousExitDate) : '' },
        { l: 'Joining Date', lv: fmtDate(fv.rejoiningDate), r: 'Type of Leave', rv: fv.leaveType || '—' },
      ]);
      if (fv.reasonForRejoining) fullField('Remarks / Notes', fv.reasonForRejoining);

      // ══════════════════════════════════════════════════════════════════════════
      // 4. PUNCH DETAILS
      // ══════════════════════════════════════════════════════════════════════════
      secHeader('4.  PUNCH DETAILS');
      if (this.punches && this.punches.length > 0) {
        const colW = (cW - 3) / 4;
        const punchRowH = 13;
        chk(punchRowH);

        // Draw 4 punch cells in a single row
        this.punches.forEach((punch, pi) => {
          const cx = margin + pi * (colW + 1);
          const hasTime = !!punch.time;
          const fillR = hasTime ? 232 : 248, fillG = hasTime ? 246 : 250, fillB = hasTime ? 243 : 252;
          pdf.setFillColor(fillR, fillG, fillB);
          pdf.setDrawColor(hasTime ? 19 : 226, hasTime ? 130 : 232, hasTime ? 113 : 240);
          pdf.setLineWidth(0.2);
          pdf.roundedRect(cx, y, colW, punchRowH, 1, 1, 'FD');

          // Punch label
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
          pdf.text(punch.label, cx + colW / 2, y + 4.5, { align: 'center' });

          // Time value
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
          pdf.setTextColor(hasTime ? 19 : 148, hasTime ? 130 : 163, hasTime ? 113 : 184);
          pdf.text(punch.time || '--:--', cx + colW / 2, y + 10, { align: 'center' });
        });
        y += punchRowH + 1;

        // Date caption
        if (this.punchDate) {
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); pdf.setTextColor(148, 163, 184);
          pdf.text(`Punch date: ${fmtDate(this.punchDate)}`, margin, y + 2.5);
          y += 5;
        }
      } else {
        chk(8);
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7); pdf.setTextColor(148, 163, 184);
        pdf.text('No punch data available for this record.', margin + 2, y + 4.5);
        y += 8;
      }

      // ══════════════════════════════════════════════════════════════════════════
      // 5. PASSPORT DETAILS  (expatriate only)
      // ══════════════════════════════════════════════════════════════════════════
      if (isExpat) {
        secHeader('5.  PASSPORT DETAILS');
        twoCol([
          { l: 'Passport No.', lv: fv.passportNo || '—', r: 'Issue Date', rv: fmtDate(fv.passportIssueDate) },
          { l: 'Expiry Date', lv: fmtDate(fv.passportExpiryDate) },
        ]);
      }

      // ══════════════════════════════════════════════════════════════════════════
      // 6. DECLARATIONS
      // ══════════════════════════════════════════════════════════════════════════
      const decNum = isExpat ? '6' : '5';
      secHeader(`${decNum}.  DECLARATIONS`);
      const decItems = [
        { ok: !!fv.medicalClearance,   text: 'I confirm I am medically fit to resume duties and have no health concerns that would affect my work.' },
        { ok: !!fv.agreementAccepted,  text: 'I agree to comply with all company policies and procedures upon rejoining and confirm all information provided is accurate.' },
      ];
      decItems.forEach(dec => {
        const lines = pdf.splitTextToSize(dec.text, cW - 13);
        const dh = lines.length * 3.2 + 6;
        chk(dh);
        pdf.setFillColor(dec.ok ? 240 : 248, dec.ok ? 253 : 250, dec.ok ? 244 : 252);
        pdf.setDrawColor(dec.ok ? 22 : 226, dec.ok ? 163 : 232, dec.ok ? 74 : 240);
        pdf.setLineWidth(0.12);
        pdf.roundedRect(margin, y, cW, dh - 0.8, 1, 1, 'FD');
        if (dec.ok) {
          pdf.setFillColor(22, 163, 74); pdf.roundedRect(margin + 2.5, y + 1.8, 3.5, 3.5, 0.4, 0.4, 'F');
          pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0.6);
          pdf.line(margin + 3.2, y + 3.8, margin + 4.0, y + 4.7);
          pdf.line(margin + 4.0, y + 4.7, margin + 5.4, y + 2.8);
        } else {
          pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.25);
          pdf.roundedRect(margin + 2.5, y + 1.8, 3.5, 3.5, 0.4, 0.4, 'S');
        }
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(15, 23, 42);
        pdf.text(lines, margin + 8, y + 4);
        y += dh;
      });
      y += 1;

      // ══════════════════════════════════════════════════════════════════════════
      // 6. APPROVAL WORKFLOW
      // ══════════════════════════════════════════════════════════════════════════
      if (this.approvalList && this.approvalList.length > 0) {
        const apvNum = isExpat ? '7' : '6';
        secHeader(`${apvNum}.  APPROVAL WORKFLOW`);
        const scMap: Record<string, [number,number,number]> = { A:[22,163,74], R:[220,38,38], P:[148,163,184] };

        this.approvalList.forEach((apv: any, idx: number) => {
          const code = (apv.approvalStatusCode || apv.status || '').toUpperCase();
          const sc2: [number,number,number] = scMap[code] || scMap['P'];
          const stLabel = code === 'A' ? 'APPROVED' : code === 'R' ? 'REJECTED' : 'PENDING';
          const pS = 10;
          const textMaxW = cW - pS - 10;
          const isActioned = code === 'A' || code === 'R';
          // Past approve/reject comments for this approver (resubmits excluded)
          const apvHistory = this.getApvHistory(apv);
          if (!isActioned && apvHistory.length === 0) return;
          const contactLine = [apv.email, apv.phoneNumber].filter(Boolean).join('   |   ');
          const remarksLines = apv.remarks ? pdf.splitTextToSize(`Remarks: ${apv.remarks}`, textMaxW) : [];
          const historyLines: string[] = [];
          apvHistory.forEach((h: any) => {
            const remark = h.remarks && String(h.remarks).trim() ? String(h.remarks).trim() : 'No comment added.';
            const line = `${this.getHistoryActionLabel(h)}${h.actionDate ? ' on ' + fmtDate(h.actionDate) : ''} - ${remark}`;
            historyLines.push(...pdf.splitTextToSize(line, textMaxW));
          });
          const boxH = Math.max(16, pS + 4)
                     + (contactLine ? 3.5 : 0)
                     + (isActioned && apv.approvalDate ? 3.5 : 0)
                     + remarksLines.length * 3.2
                     + (historyLines.length ? historyLines.length * 3.2 + 4 : 0);
          chk(boxH + 3);

          pdf.setFillColor(250, 252, 252); pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.15);
          pdf.roundedRect(margin, y, cW, boxH, 1.5, 1.5, 'FD');
          pdf.setFillColor(...sc2); pdf.rect(margin, y, 2.5, boxH, 'F');

          // Approver photo — right side, vertically centred
          const pX = margin + cW - pS - 1.5;
          const pY = y + (boxH - pS) / 2;
          const rawB64 = apv.profileImageBase64 || apv.profileImage || '';
          const imgSrc = rawB64 ? (rawB64.startsWith('data:') ? rawB64 : `data:image/jpeg;base64,${rawB64}`) : '';
          if (imgSrc) {
            try {
              pdf.addImage(imgSrc, 'JPEG', pX, pY, pS, pS);
              pdf.setDrawColor(...sc2); pdf.setLineWidth(0.35); pdf.rect(pX, pY, pS, pS, 'S');
            } catch (_) {
              pdf.setFillColor(232, 240, 248); pdf.rect(pX, pY, pS, pS, 'F');
            }
          } else {
            pdf.setFillColor(232, 240, 248); pdf.rect(pX, pY, pS, pS, 'F');
            pdf.setDrawColor(210, 220, 230); pdf.setLineWidth(0.2); pdf.rect(pX, pY, pS, pS, 'S');
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(4.5); pdf.setTextColor(160, 174, 192);
            pdf.text('NO\nPHOTO', pX + pS / 2, pY + pS / 2, { align: 'center' });
          }

          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(15, 23, 42);
          pdf.text(apv.approverRole || apv.department || `Step ${idx + 1}`, margin + 5, y + 5.5, { maxWidth: textMaxW });

          const bW = pdf.getTextWidth(stLabel) + 5;
          pdf.setFillColor(...sc2); pdf.roundedRect(pX - bW - 3, y + 2, bW, 5, 0.8, 0.8, 'F');
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(255, 255, 255);
          pdf.text(stLabel, pX - bW / 2 - 3, y + 5.5, { align: 'center' });

          const appId = apv.approverId || apv.approvedId || '';
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(15, 23, 42);
          pdf.text(`${apv.employeeName || '—'}${appId ? '   ID: ' + appId : ''}`, margin + 5, y + 10, { maxWidth: textMaxW });
          let infoY = y + 13.5;
          if (contactLine) {
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(71, 85, 105);
            pdf.text(contactLine, margin + 5, infoY, { maxWidth: textMaxW });
            infoY += 3.5;
          }
          if (isActioned && apv.approvalDate) {
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.setTextColor(100, 116, 139);
            pdf.text('Date:', margin + 5, infoY);
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(15, 23, 42);
            pdf.text(fmtDate(apv.approvalDate), margin + 16, infoY);
            infoY += 3.5;
          }
          if (remarksLines.length > 0) {
            pdf.setFont('helvetica', 'italic'); pdf.setFontSize(6.5); pdf.setTextColor(71, 85, 105);
            pdf.text(remarksLines, margin + 5, infoY);
            infoY += remarksLines.length * 3.2;
          }
          if (historyLines.length > 0) {
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.setTextColor(100, 116, 139);
            pdf.text('Comment History:', margin + 5, infoY + 0.8);
            infoY += 4;
            pdf.setFont('helvetica', 'italic'); pdf.setFontSize(6.5); pdf.setTextColor(71, 85, 105);
            pdf.text(historyLines, margin + 5, infoY);
          }
          y += boxH + 3;
        });
      }

      // ══════════════════════════════════════════════════════════════════════════
      // FOOTERS
      // ══════════════════════════════════════════════════════════════════════════
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFillColor(...dark); pdf.rect(0, pH - footerH, pW, footerH, 'F');
        pdf.setFillColor(...teal); pdf.rect(0, pH - footerH, pW, 1.5, 'F');
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(255, 255, 255);
        pdf.text(`AL ADRAK TRADING AND CONTRACTING LLC   |   JOINING REPORT   |   ${empNameRaw}`, margin, pH - 2.5);
        pdf.text(`Page ${p} of ${totalPages}`, pW - margin, pH - 2.5, { align: 'right' });
      }

      const empId = (fv.employeeId || 'EMP').replace(/\s+/g, '');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      pdf.save(`RejoinReport_${empId}_${dateStr}.pdf`);
      this.toaster.showSuccess('Export Complete', 'PDF downloaded successfully.');
    } catch (err) {
      console.error('PDF error:', err);
      this.toaster.showError('Export Failed', 'Failed to generate PDF. Please try again.');
    } finally {
      this.isPdfGenerating = false;
    }
  }
}

