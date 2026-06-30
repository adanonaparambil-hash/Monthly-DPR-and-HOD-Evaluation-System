import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../services/api';
import { AuthService } from '../services/auth.service';
import { ToasterService } from '../services/toaster.service';
import { ToasterComponent } from '../components/toaster/toaster.component';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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

  // PDF export
  isPdfGenerating = false;

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
        if (this.pendingHodId) {
          this.byodForm.get('hodId')?.setValue(this.pendingHodId);
          this.pendingHodId = '';
        }
      },
      error: () => { this.isLoadingHods = false; }
    });

    // Check for existing BYOD record in route params
    const byodId = this.route.snapshot.queryParamMap.get('byodId')
      || this.route.snapshot.paramMap.get('byodId');
    const approvalId = this.route.snapshot.queryParamMap.get('approvalID')
                    || this.route.snapshot.queryParamMap.get('approvalId');
    const approverCode = this.route.snapshot.queryParamMap.get('approverCode') || '';

    if (byodId) {
      // VIEW MODE — profile is loaded inside loadByodRecord() using the record's employeeId,
      // so we must NOT load the logged-in user's profile here (it would overwrite the employee's data)
      this.isViewMode = true;
      if (approvalId) this.incomingApprovalId = +approvalId;
      this.incomingApproverCode = approverCode.toUpperCase();
      this.loadByodRecord(+byodId);
    } else {
      // NEW FORM — load the logged-in user's profile to pre-fill the form
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
              this.byodForm.patchValue({
                idNo:        res.data.empId        || '',
                name:        res.data.employeeName || '',
                doj:         this.parseDoj(res.data.doj),
                department:  res.data.department   || '',
                designation: res.data.designation  || ''
              });
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

          // Load the BYOD applicant's profile (NOT the logged-in approver's)
          const recordEmpId = (d.employeeId || '').toString();
          if (recordEmpId) {
            this.api.GetEmployeeProfile(recordEmpId).subscribe({
              next: (profileRes: any) => {
                if (profileRes?.success && profileRes?.data) {
                  this.profile = profileRes.data;
                  this.profileImageSrc = profileRes.data.profileImageBase64
                    ? `data:image/jpeg;base64,${profileRes.data.profileImageBase64}`
                    : null;
                  this.byodForm.patchValue({
                    idNo:        profileRes.data.empId        || '',
                    name:        profileRes.data.employeeName || '',
                    doj:         this.parseDoj(profileRes.data.doj),
                    department:  profileRes.data.department   || '',
                    designation: profileRes.data.designation  || ''
                  });
                }
                this.isLoadingProfile = false;
              },
              error: () => { this.isLoadingProfile = false; }
            });
          } else {
            this.isLoadingProfile = false;
          }

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

  /** Returns approvalDetails sorted by ApprovalLevel for view-mode dynamic rendering */
  get sortedApprovalDetails(): ByodApprovalDetail[] {
    return [...this.approvalDetails].sort((a, b) => (a.approvalLevel ?? 999) - (b.approvalLevel ?? 999));
  }

  getApproverIcon(code: string): string {
    const map: Record<string, string> = {
      'HOD': 'fa-user-tie', 'CEO': 'fa-crown', 'IT': 'fa-desktop',
      'ADMIN-HEAD': 'fa-user-shield', 'ADMIN': 'fa-file-invoice',
    };
    return map[(code || '').toUpperCase()] || 'fa-user-check';
  }

  getApproverColorClass(code: string): string {
    const map: Record<string, string> = {
      'HOD': 'byod-ci-purple', 'CEO': 'byod-ci-amber', 'IT': 'byod-ci-cyan',
      'ADMIN-HEAD': 'byod-ci-navy', 'ADMIN': 'byod-ci-violet',
    };
    return map[(code || '').toUpperCase()] || 'byod-ci-blue';
  }

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

  async downloadAsPdf(): Promise<void> {
    if (this.isPdfGenerating) return;
    this.isPdfGenerating = true;
    try {
      // ── Load logo ────────────────────────────────────────────────────────────
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
      const fv = this.byodForm.getRawValue();
      const rec = this.byodRecord;
      const formNo = rec?.byodId ? `BYOD-${rec.byodId}` : 'ATC/IT/FORMS/BYOD/001';
      const formDate = rec?.createdOn ? new Date(rec.createdOn).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
      const empNameRaw = (fv.name || 'Employee').toUpperCase();
      const hodName = this.hodList.find(h => h.idValue === fv.hodId)?.description || fv.hodId || '—';

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
      pdf.text('APPLICATION FOR ADVANCE AMOUNT — BYOD', margin + 17, 15);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(180, 220, 215);
      pdf.text(`Form No: ${formNo}   |   Date: ${formDate}`, pW - margin, 9, { align: 'right' });

      // Status chip
      const status = rec?.status || 'S';
      const statusLabel = status === 'A' ? 'APPROVED' : status === 'R' ? 'REJECTED' : status === 'P' ? 'PENDING' : 'SUBMITTED';
      const sc: [number,number,number] = status === 'A' ? [22,163,74] : status === 'R' ? [220,38,38] : [234,179,8];
      const chipW = pdf.getTextWidth(statusLabel) + 6;
      pdf.setFillColor(...sc); pdf.roundedRect(pW - margin - chipW - 1, 13, chipW, 5, 1, 1, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.setTextColor(255, 255, 255);
      pdf.text(statusLabel, pW - margin - chipW / 2 - 1, 16.6, { align: 'center' });
      y = 23;

      // ══════════════════════════════════════════════════════════════════════════
      // 1. EMPLOYEE DETAILS
      // ══════════════════════════════════════════════════════════════════════════
      secHeader('1.  EMPLOYEE DETAILS');

      const photoSize = 22, photoX = margin + cW - photoSize, photoY = y;
      if (this.profileImageSrc) {
        try {
          pdf.addImage(this.profileImageSrc, 'JPEG', photoX, photoY, photoSize, photoSize);
          pdf.setDrawColor(...teal); pdf.setLineWidth(0.5); pdf.rect(photoX, photoY, photoSize, photoSize, 'S');
        } catch (_) {}
      } else {
        pdf.setFillColor(226, 232, 240); pdf.rect(photoX, photoY, photoSize, photoSize, 'F');
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); pdf.setTextColor(148, 163, 184);
        pdf.text('PHOTO', photoX + photoSize / 2, photoY + photoSize / 2 + 1, { align: 'center' });
      }

      const fw = cW - photoSize - 6, hw3 = (fw - 4) / 2, startY = y;
      const empRows = [
        { l: 'Employee Name', lv: fv.name || '—', r: 'Employee ID', rv: fv.idNo || '—' },
        { l: 'Department', lv: fv.department || '—', r: 'Designation', rv: fv.designation || '—' },
        { l: 'Date of Joining', lv: fmtDate(fv.doj), r: 'HOD', rv: hodName },
      ];
      empRows.forEach(row => {
        const lL = pdf.splitTextToSize(row.lv || '—', hw3 - 2);
        const rL = pdf.splitTextToSize(row.rv || '—', hw3 - 2);
        const rh = Math.max(lL.length, rL.length) * 3.2 + 6.5;
        chk(rh);
        pdf.setFillColor(248, 250, 252); pdf.rect(margin, y, fw, rh - 0.8, 'F');
        pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.12); pdf.rect(margin, y, fw, rh - 0.8, 'S');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
        pdf.text(row.l, margin + 2.5, y + 3);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(15, 23, 42);
        pdf.text(lL, margin + 2.5, y + 6.5);
        const rx = margin + hw3 + 5;
        pdf.setFillColor(226, 232, 240); pdf.rect(margin + hw3 + 2, y + 0.8, 0.25, rh - 2.3, 'F');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
        pdf.text(row.r, rx, y + 3);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(15, 23, 42);
        pdf.text(rL, rx, y + 6.5);
        y += rh;
      });
      y = Math.max(y, startY + photoSize + 2) + 1;

      // ══════════════════════════════════════════════════════════════════════════
      // 2. ADVANCE REQUEST DETAILS
      // ══════════════════════════════════════════════════════════════════════════
      secHeader('2.  ADVANCE REQUEST DETAILS');
      twoCol([
        { l: 'Advance Amount', lv: 'OMR 300/-', r: 'Repayment Period', rv: '5 Years (60 Monthly Installments)' },
        { l: 'Monthly Deduction', lv: 'OMR 5/- per month', r: 'Policy Reference', rv: 'ATC/IT/FORMS/BYOD/001' },
      ]);

      // ══════════════════════════════════════════════════════════════════════════
      // 3. IT ASSESSMENT  (show if IT approver has filled it)
      // ══════════════════════════════════════════════════════════════════════════
      if (this.itCategory || this.itUserType) {
        secHeader('3.  IT ASSESSMENT');
        const catLabel = this.itCategory === 'Y' ? 'Yes — Eligible' : this.itCategory === 'N' ? 'No — Not Eligible' : this.itCategory || '—';
        const typeLabel = this.itUserType === 'F' ? 'First Time User' : this.itUserType === 'E' ? 'Existing User' : this.itUserType || '—';
        twoCol([
          { l: 'Category of Staff (Eligibility)', lv: catLabel, r: 'User Type', rv: typeLabel },
        ]);
        if (this.itUserType === 'E') {
          twoCol([
            { l: 'Asset Code', lv: this.itAssetCode || '—', r: 'Date of Purchase', rv: fmtDate(this.itDateOfPurchase) },
            { l: 'Period (Years as on Date)', lv: this.itYearsAsOnDate || '—' },
          ]);
        }
      }

      // ══════════════════════════════════════════════════════════════════════════
      // 4. DECLARATION
      // ══════════════════════════════════════════════════════════════════════════
      const decNum = (this.itCategory || this.itUserType) ? '4' : '3';
      secHeader(`${decNum}.  DECLARATION`);
      const decText = 'I hereby agree to the BYOD policy terms and conditions. I understand that the advance amount of OMR 300/- will be deducted from my salary in 60 monthly installments of OMR 5/- each. I confirm all information provided is accurate.';
      const decLines = pdf.splitTextToSize(decText, cW - 13);
      const dh = decLines.length * 3.2 + 6;
      chk(dh);
      const agreed = !!fv.agreementAccepted;
      pdf.setFillColor(agreed ? 240 : 248, agreed ? 253 : 250, agreed ? 244 : 252);
      pdf.setDrawColor(agreed ? 22 : 226, agreed ? 163 : 232, agreed ? 74 : 240);
      pdf.setLineWidth(0.12);
      pdf.roundedRect(margin, y, cW, dh - 0.8, 1, 1, 'FD');
      if (agreed) {
        pdf.setFillColor(22, 163, 74); pdf.roundedRect(margin + 2.5, y + 1.8, 3.5, 3.5, 0.4, 0.4, 'F');
        pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0.6);
        pdf.line(margin + 3.2, y + 3.8, margin + 4.0, y + 4.7);
        pdf.line(margin + 4.0, y + 4.7, margin + 5.4, y + 2.8);
      } else {
        pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.25);
        pdf.roundedRect(margin + 2.5, y + 1.8, 3.5, 3.5, 0.4, 0.4, 'S');
      }
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(15, 23, 42);
      pdf.text(decLines, margin + 8, y + 4);
      y += dh + 1;

      // ══════════════════════════════════════════════════════════════════════════
      // 5. APPROVAL WORKFLOW
      // ══════════════════════════════════════════════════════════════════════════
      if (this.approvalDetails && this.approvalDetails.length > 0) {
        const apvNum = (this.itCategory || this.itUserType) ? '5' : '4';
        secHeader(`${apvNum}.  APPROVAL WORKFLOW`);
        const scMap: Record<string, [number,number,number]> = { A:[22,163,74], R:[220,38,38], P:[148,163,184], I:[234,179,8] };

        this.approvalDetails.forEach((apv, idx) => {
          const code = (apv.approvalStatusCode || '').toUpperCase();
          const sc2: [number,number,number] = scMap[code] || scMap['P'];
          const stLabel = code === 'A' ? 'APPROVED' : code === 'R' ? 'REJECTED' : 'PENDING';
          const pS = 10;
          const textMaxW = cW - pS - 10;
          const isIT = (apv.approverCode || '').toUpperCase() === 'IT';
          const isActioned = code === 'A' || code === 'R';
          if (!isActioned && !isIT) return;
          const contactLine = [apv.email, apv.phoneNumber].filter(Boolean).join('   |   ');
          const remarksLines = apv.remarks ? pdf.splitTextToSize(`Remarks: ${apv.remarks}`, textMaxW) : [];
          const boxH = Math.max(16, pS + 4)
                     + (contactLine ? 3.5 : 0)
                     + (isActioned && apv.approvalDate ? 3.5 : 0)
                     + remarksLines.length * 3.2;
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
          pdf.text(apv.approverRole || `Step ${idx + 1}`, margin + 5, y + 5.5, { maxWidth: textMaxW });

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
          if (remarksLines.length > 0) { pdf.setFont('helvetica', 'italic'); pdf.setFontSize(6.5); pdf.setTextColor(71, 85, 105); pdf.text(remarksLines, margin + 5, infoY); }
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
        pdf.text(`AL ADRAK TRADING AND CONTRACTING LLC   |   BYOD APPLICATION   |   ${empNameRaw}`, margin, pH - 2.5);
        pdf.text(`Page ${p} of ${totalPages}`, pW - margin, pH - 2.5, { align: 'right' });
      }

      const empId = (fv.idNo || 'EMP').replace(/\s+/g, '');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      pdf.save(`BYOD_${empId}_${dateStr}.pdf`);
      this.toaster.showSuccess('Export Complete', 'PDF downloaded successfully.');
    } catch (err) {
      console.error('PDF error:', err);
      this.toaster.showError('Export Failed', 'Failed to generate PDF. Please try again.');
    } finally {
      this.isPdfGenerating = false;
    }
  }
}

