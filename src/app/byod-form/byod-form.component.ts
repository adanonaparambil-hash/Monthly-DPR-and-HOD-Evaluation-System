import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../services/api';
import { AuthService } from '../services/auth.service';
import { ToasterService } from '../services/toaster.service';
import { ToasterComponent } from '../components/toaster/toaster.component';

export interface ByodApprovalDetail {
  approverRole?: string;
  approverCode?: string;
  approvalStatusCode?: string;
  approvalStatus?: string;
  remarks?: string;
  department?: string;
  approvalDate?: string;
  approvalLevel?: number;
  approverId?: string;       // API field name
  approvedId?: string;       // legacy alias
  employeeName?: string;
  email?: string;
  phoneNumber?: string;
  profileImageBase64?: string;
  profileImage?: string;
}

@Component({
  selector: 'app-byod-form',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ToasterComponent],
  templateUrl: './byod-form.component.html',
  styleUrl: './byod-form.component.css'
})
export class ByodFormComponent implements OnInit {
  byodForm: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  isLoadingProfile = true;
  isLoadingHods = true;
  hodList: { idValue: string; description: string }[] = [];

  profile: any = null;
  profileImageSrc: string | null = null;

  // Approval details
  approvalDetails: ByodApprovalDetail[] = [];
  isLoadingApprovals = false;
  byodRecord: any = null;
  isViewMode = false;

  // Approver action
  incomingApprovalId: number | null = null;
  incomingApproverCode: string = '';
  approverRemarks: string = '';
  isApproving = false;
  approvalActionDone = false;

  // Resubmit mode: owner viewing their own R record
  isResubmitMode = false;

  // IT-specific editable fields (only for IT approver)
  itCategory: string = '';
  itUserType: string = '';
  itAssetCode: string = '';
  itDateOfPurchase: string = '';
  itYearsAsOnDate: string = '';

  // Store pending hodId to apply after HOD list loads
  private pendingHodId: string = '';

  constructor(
    private fb: FormBuilder,
    private api: Api,
    private auth: AuthService,
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private toaster: ToasterService
  ) {
    this.byodForm = this.fb.group({
      idNo:              ['', Validators.required],
      name:              ['', [Validators.required, Validators.minLength(2)]],
      doj:               ['', Validators.required],
      department:        ['', Validators.required],
      designation:       ['', Validators.required],
      hodId:             ['', Validators.required],
      agreementAccepted: [false, Validators.requiredTrue]
    });
  }

  ngOnInit(): void {
    // Load HOD list
    this.api.GetHodMasterList().subscribe({
      next: (res: any) => {
        if (res?.success && res?.data) this.hodList = res.data;
        this.isLoadingHods = false;
        // Apply pending hodId if byod record loaded before HOD list
        if (this.pendingHodId) {
          this.byodForm.get('hodId')?.setValue(this.pendingHodId);
          this.pendingHodId = '';
        }
      },
      error: () => { this.isLoadingHods = false; }
    });

    // Load employee profile
    const user = this.auth.getUser();
    const empId = user?.empId || user?.userId || user?.id || '';
    if (empId) {
      this.api.GetEmployeeProfile(empId).subscribe({
        next: (res: any) => {
          if (res?.success && res?.data) {
            this.profile = res.data;
            this.profileImageSrc = res.data.profileImageBase64
              ? `data:image/jpeg;base64,${res.data.profileImageBase64}`
              : null;
            // Patch form with API values
            this.byodForm.patchValue({
              idNo:        res.data.empId        || '',
              name:        res.data.employeeName || '',
              doj:         this.parseDoj(res.data.doj),
              department:  res.data.department   || '',
              designation: res.data.designation  || ''
            });
            // Disable the auto-filled fields
            ['idNo','name','doj','department','designation'].forEach(f =>
              this.byodForm.get(f)?.disable()
            );
          }
          this.isLoadingProfile = false;
        },
        error: () => { this.isLoadingProfile = false; }
      });
    } else {
      this.isLoadingProfile = false;
    }

    // Load existing BYOD record if byodId is in route params
    const byodId = this.route.snapshot.queryParamMap.get('byodId')
      || this.route.snapshot.paramMap.get('byodId');
    const approvalId = this.route.snapshot.queryParamMap.get('approvalID')
                    || this.route.snapshot.queryParamMap.get('approvalId');
    const approverCode = this.route.snapshot.queryParamMap.get('approverCode') || '';
    if (byodId) {
      this.isViewMode = true;
      if (approvalId) this.incomingApprovalId = +approvalId;
      this.incomingApproverCode = approverCode.toUpperCase();
      this.loadByodRecord(+byodId);
    }
  }

  loadByodRecord(byodId: number): void {
    this.isLoadingApprovals = true;
    this.api.getEmployeeByodById(byodId).subscribe({
      next: (res: any) => {
        this.isLoadingApprovals = false;
        if (res?.success && res?.data) {
          const d = res.data;
          this.byodRecord = d;

          // Map approvalList (actual API field)
          this.approvalDetails = d.approvalList || [];

          // Pre-fill IT fields from existing record
          // userExisting: 'Y' → Category Yes, 'N' → Category No
          this.itCategory = d.userExisting === 'Y' ? 'Y' : d.userExisting === 'N' ? 'N' : (d.category || '');

          // userType from API → normalize to 'F' (First Time) or 'E' (Existing)
          // API may return: 'F', 'E', 'First Time', 'Existing', 'N', 'Y' — handle all
          const rawUserType = (d.userType || '').toString().trim().toUpperCase();
          console.log('[BYOD] raw userType from API:', d.userType, '| raw userExisting:', d.userExisting);
          if (rawUserType === 'F' || rawUserType === 'FIRST' || rawUserType === 'FIRST TIME' || rawUserType === 'N') {
            this.itUserType = 'F';
          } else if (rawUserType === 'E' || rawUserType === 'EXISTING' || rawUserType === 'Y') {
            this.itUserType = 'E';
          } else {
            this.itUserType = rawUserType; // pass through as-is if already correct
          }
          console.log('[BYOD] resolved itUserType:', this.itUserType);

          this.itAssetCode      = d.assetCode        || '';
          this.itDateOfPurchase = d.dateOfPurchase   ? d.dateOfPurchase.split('T')[0] : '';
          this.itYearsAsOnDate  = d.yearsAsOnDate    ? String(d.yearsAsOnDate) : '';

          // Patch BYOD-specific fields into form
          const hodValue = d.hod || '';
          if (this.hodList.length > 0) {
            // HOD list already loaded — patch directly
            this.byodForm.patchValue({ hodId: hodValue });
          } else {
            // HOD list not yet loaded — store for later
            this.pendingHodId = hodValue;
          }

          // Disable all fields in view mode
          Object.keys(this.byodForm.controls).forEach(k =>
            this.byodForm.get(k)?.disable()
          );
          // Auto-check agreement in view mode (already submitted)
          this.byodForm.get('agreementAccepted')?.setValue(true);

          // Resubmit mode: owner viewing a rejected record
          const user = this.auth.getUser();
          const loggedEmpId = (user?.empId || user?.userId || user?.id || '').toString();
          const recordStatus = (d.status || '').toUpperCase();
          const isOwner = loggedEmpId && d.employeeId && loggedEmpId === d.employeeId.toString();
          this.isResubmitMode = !!(isOwner && recordStatus === 'R');

          if (this.isResubmitMode) {
            // Re-enable editable fields so owner can fix and resubmit
            this.byodForm.get('hodId')?.enable();
            this.byodForm.get('agreementAccepted')?.enable();
          }
        }
      },
      error: () => { this.isLoadingApprovals = false; }
    });
  }

  getApproverImage(detail: ByodApprovalDetail): string | null {
    const b64 = detail.profileImageBase64 || detail.profileImage;
    if (!b64) return null;
    return b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
  }

  getApprovalByCode(code: string): ByodApprovalDetail | null {
    return this.approvalDetails.find(
      a => (a.approverCode || '').toUpperCase() === code.toUpperCase()
    ) || null;
  }

  // Convenience getters used in template to avoid 'as' alias issues
  get hodApv()       { return this.getApprovalByCode('HOD'); }
  get ceoApv()       { return this.getApprovalByCode('CEO'); }
  get itApv()        { return this.getApprovalByCode('IT'); }
  get adminApv()     { return this.getApprovalByCode('ADMIN'); }
  get adminHeadApv() { return this.getApprovalByCode('ADMIN-HEAD'); }

  /** Check if a specific approver card belongs to the current user and is pending */
  isMyPendingApproval(detail: ByodApprovalDetail): boolean {
    if (!this.incomingApprovalId || !this.isViewMode) return false;
    if ((detail.approvalStatusCode || '').toUpperCase() !== 'P') return false;
    // Match by approverCode from URL (e.g. 'HOD', 'CEO', 'IT', 'ADMIN')
    if (this.incomingApproverCode) {
      return (detail.approverCode || '').toUpperCase() === this.incomingApproverCode;
    }
    // Fallback: match by current user's empId
    const user = this.auth.getUser();
    const myEmpId = (user?.empId || user?.userId || user?.id || '').toString();
    return (detail.approverId || detail.approvedId || '') === myEmpId;
  }

  submitApprovalAction(status: 'A' | 'R'): void {
    if (!this.incomingApprovalId) return;
    this.isApproving = true;
    const user = this.auth.getUser();
    const d = this.byodRecord || {};

    const payload: any = {
      // ── record identity ──────────────────────────────────────
      byodId:          d.byodId,
      employeeId:      d.employeeId || '',
      // ── all existing record fields ───────────────────────────
      hod:             d.hod || '',
      category:        d.category        || null,
      userType:        d.userType        || null,
      userExisting:    d.userExisting    || null,
      assetCode:       d.assetCode       || null,
      dateOfPurchase:  d.dateOfPurchase  || null,
      yearsAsOnDate:   d.yearsAsOnDate   != null ? +d.yearsAsOnDate : null,
      // ── approval-specific fields ─────────────────────────────
      approvalId:      this.incomingApprovalId,
      approvalRemarks: this.approverRemarks || '',
      status:          status,
      createdBy:       user?.empId || user?.userId || user?.id || '',
      baseurl:         document.baseURI
    };

    // IT approver can override the IT-specific fields with freshly entered values
    if (this.incomingApproverCode === 'IT') {
      payload.category       = this.itCategory       || null;
      payload.userType       = this.itUserType       || null;
      payload.userExisting   = this.itCategory === 'Y' ? 'Y' : this.itCategory === 'N' ? 'N' : (d.userExisting || null);
      payload.assetCode      = this.itAssetCode      || null;
      payload.dateOfPurchase = this.itDateOfPurchase || null;
      payload.yearsAsOnDate  = this.itYearsAsOnDate  ? +this.itYearsAsOnDate : null;
    }

    this.api.saveEmployeeByod(payload).subscribe({
      next: () => {
        this.isApproving = false;
        this.approvalActionDone = true;
        const label = status === 'A' ? 'Approved' : 'Rejected';
        this.toaster.showSuccess(
          `Application ${label}`,
          `The BYOD request has been ${label.toLowerCase()} successfully.`
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

  getStatusClass(status?: string): string {
    const s = (status || '').toUpperCase();
    if (s === 'A' || s === 'APPROVED') return 'byod-apv-approved';
    if (s === 'R' || s === 'REJECTED') return 'byod-apv-rejected';
    return 'byod-apv-pending';
  }

  getStatusLabel(status?: string): string {
    const s = (status || '').toUpperCase();
    if (s === 'A' || s === 'APPROVED') return 'Approved';
    if (s === 'R' || s === 'REJECTED') return 'Rejected';
    return 'Pending';
  }

  getStatusIcon(status?: string): string {
    const s = (status || '').toUpperCase();
    if (s === 'A' || s === 'APPROVED') return 'fa-check-circle';
    if (s === 'R' || s === 'REJECTED') return 'fa-times-circle';
    return 'fa-clock';
  }

  /** Convert "08-SEP-2025" → "2025-09-08" for date input */
  private parseDoj(doj: string): string {
    if (!doj) return '';
    const months: Record<string, string> = {
      JAN:'01', FEB:'02', MAR:'03', APR:'04', MAY:'05', JUN:'06',
      JUL:'07', AUG:'08', SEP:'09', OCT:'10', NOV:'11', DEC:'12'
    };
    const parts = doj.split('-');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return `${y}-${months[m.toUpperCase()] || '01'}-${d.padStart(2,'0')}`;
    }
    return '';
  }

  get selectedHodName(): string {
    const id = this.byodForm.get('hodId')?.value;
    return this.hodList.find(h => h.idValue === id)?.description || '';
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString('en-GB');
  }

  getByodStatusLabel(status?: string): string {
    switch ((status || '').toUpperCase()) {
      case 'S': return 'Pending'; // Changed from 'Submitted' to 'Pending' for backward compatibility
      case 'P': return 'Pending';
      case 'A': return 'Approved';
      case 'R': return 'Rejected';
      default:  return status || 'Active Policy';
    }
  }

  isInvalid(f: string): boolean {
    const c = this.byodForm.get(f);
    return !!(c && c.invalid && c.touched);
  }

  onSubmit(): void {
    if (this.byodForm.invalid) { this.byodForm.markAllAsTouched(); return; }

    const raw = this.byodForm.getRawValue(); // getRawValue includes disabled fields
    const user = this.auth.getUser();

    const request: any = {
      ...(this.isResubmitMode && this.byodRecord?.byodId ? { byodId: this.byodRecord.byodId } : {}),
      employeeId: raw.idNo,
      hod:        raw.hodId,
      status:     'S',
      createdBy:  user?.empId || user?.userId || user?.id || '',
      baseurl:    document.baseURI
    };

    this.isSubmitting = true;
    this.api.saveEmployeeByod(request).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        if (res?.success !== false) {
          this.toaster.showSuccess(
            'Application Submitted',
            'Your BYOD request has been submitted successfully.'
          );
          setTimeout(() => {
            this.router.navigate(['/leave-approval'], { queryParams: { tab: 'myRequests' } });
          }, 1800);
        } else {
          this.toaster.showError('Submission Failed', res?.message || 'Failed to submit. Please try again.');
        }
      },
      error: () => {
        this.isSubmitting = false;
        this.toaster.showError('Submission Failed', 'Something went wrong. Please try again.');
      }
    });
  }

  reset(): void { this.submitSuccess = false; this.byodForm.reset(); }

  goToMyRequests(): void {
    this.router.navigate(['/leave-approval'], { queryParams: { tab: 'myRequests' } });
  }

  goBack(): void { this.location.back(); }
}

