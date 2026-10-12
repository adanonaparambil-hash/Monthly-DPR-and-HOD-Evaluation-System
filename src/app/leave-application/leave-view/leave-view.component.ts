import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { Api } from '../../services/api';
import { AvatarUtil } from '../../utils/avatar.util';

/** The applicant's profile (GetEmployeeProfile — same call as the form and the Profile page). */
interface ApplicantProfile {
  photo: string; designation: string; department: string; location: string; doj: string; email: string; phone: string;
}

type StepState = 'approved' | 'rejected' | 'current' | 'waiting' | 'skipped';

/**
 * A submitted leave application: details, handovers, document, the approval
 * timeline and — when it is the signed-in user's turn — Approve / Reject.
 *
 * Opened by /leave-application?leaveId=… (the link in the e-mails and portal
 * notifications) and from Approval Management; `approvalId` picks the step the
 * approver was sent for, but any pending step of theirs that is current works.
 */
@Component({
  selector: 'app-leave-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './leave-view.component.html',
  styleUrls: ['./leave-view.component.css']
})
export class LeaveViewComponent implements OnChanges, OnDestroy {
  @Input() leaveId: number | null = null;
  @Input() approvalId: number | null = null;
  /** Leave the view (the parent clears the query params and shows the form). */
  @Output() newApplication = new EventEmitter<void>();

  state: 'loading' | 'ready' | 'error' = 'loading';
  error = '';
  leave: any = null;
  handovers: any[] = [];
  approvals: any[] = [];
  history: any[] = [];

  remarks = '';
  acting: 'A' | 'R' | null = null;
  notice: { kind: 'info' | 'error'; text: string } | null = null;

  /** Photo + details of the applicant; null until loaded (the header shows initials meanwhile). */
  profile: ApplicantProfile | null = null;

  private me = '';
  private sub?: Subscription;
  private profileSub?: Subscription;
  private profileFor = '';

  constructor(private api: Api, private router: Router) {
    try {
      const u = JSON.parse(localStorage.getItem('current_user') || '{}') || {};
      this.me = (u.empId || u.employeeId || '').toString().trim().toUpperCase();
    } catch { this.me = ''; }
  }

  ngOnChanges(): void { this.load(); }
  ngOnDestroy(): void { this.sub?.unsubscribe(); this.profileSub?.unsubscribe(); }

  load(): void {
    if (!this.leaveId) { this.state = 'error'; this.error = 'No leave application was given.'; return; }
    this.state = 'loading';
    this.sub?.unsubscribe();
    this.sub = this.api.GetLeaveById(this.leaveId).subscribe({
      next: (res: any) => {
        const d = res?.success ? res.data : null;
        if (!d?.leave) { this.state = 'error'; this.error = res?.message || 'This leave application could not be found.'; return; }
        this.leave = d.leave;
        this.handovers = d.handovers || [];
        this.approvals = d.approvals || [];
        this.history = d.history || [];
        this.state = 'ready';
        this.loadProfile((d.leave.employeeId || '').toString().trim());
      },
      error: () => { this.state = 'error'; this.error = 'The leave application could not be loaded. Please try again.'; }
    });
  }

  /** Photo, joining date, phone… of the applicant — loaded once per employee. */
  private loadProfile(empId: string): void {
    if (!empId || empId === this.profileFor) { return; }
    this.profileFor = empId;
    this.profile = null;
    this.profileSub?.unsubscribe();
    this.profileSub = this.api.GetEmployeeProfile(empId).subscribe({
      next: (res: any) => {
        const p = res?.success ? res.data : null;
        if (!p) { return; }
        const s = (v: unknown) => (v ?? '').toString().trim();
        this.profile = {
          photo: s(p.profileImageBase64) ? AvatarUtil.processProfileImage(p.profileImageBase64) : '',
          designation: s(p.designation), department: s(p.department), location: s(p.location),
          doj: s(p.doj), email: s(p.email), phone: s(p.phone || p.telephone)
        };
      },
      error: () => { /* header keeps the details stored with the application */ }
    });
  }
  photoFailed(): void { if (this.profile) { this.profile = { ...this.profile, photo: '' }; } }

  private parseDate(v: string): Date | null {
    if (!v) { return null; }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  get dojText(): string {
    const d = this.parseDate(this.profile?.doj || '');
    return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : (this.profile?.doj || '');
  }
  /** "6 yrs 4 mos" since joining. */
  get serviceText(): string {
    const d = this.parseDate(this.profile?.doj || '');
    if (!d) { return ''; }
    const now = new Date();
    let m = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
    if (now.getDate() < d.getDate()) { m--; }
    if (m < 0) { return ''; }
    const y = Math.floor(m / 12), r = m % 12;
    return [y ? y + (y === 1 ? ' yr' : ' yrs') : '', r ? r + (r === 1 ? ' mo' : ' mos') : ''].filter(Boolean).join(' ') || 'Less than a month';
  }

  // ── status ────────────────────────────────────────────────────────────────
  private up(v: unknown): string { return (v ?? '').toString().trim().toUpperCase(); }
  get status(): string { return this.up(this.leave?.status) || 'P'; }
  get statusLabel(): string { return this.status === 'A' ? 'Approved' : this.status === 'R' ? 'Rejected' : 'Pending'; }
  get minPendingLevel(): number | null {
    const lv = this.approvals.filter(a => this.up(a.approvalStatus) === 'P').map(a => Number(a.approvalLevel));
    return lv.length ? Math.min(...lv) : null;
  }
  stepState(a: any): StepState {
    const s = this.up(a.approvalStatus);
    if (s === 'A') { return 'approved'; }
    if (s === 'R') { return 'rejected'; }
    if (this.status !== 'P') { return 'skipped'; }                 // application already decided
    return Number(a.approvalLevel) === this.minPendingLevel ? 'current' : 'waiting';
  }
  stepText(a: any): string {
    switch (this.stepState(a)) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'current': return 'Waiting for approval';
      case 'waiting': return a.approverRole === 'HOD' ? 'After all handovers approve' : 'Waiting';
      default: return 'Not required';
    }
  }
  get handoverSteps(): any[] { return this.approvals.filter(a => this.up(a.approverRole) === 'HANDOVER'); }
  get hodSteps(): any[] { return this.approvals.filter(a => this.up(a.approverRole) !== 'HANDOVER'); }
  get handoversApproved(): number { return this.handoverSteps.filter(a => this.up(a.approvalStatus) === 'A').length; }

  /** The step the signed-in user can act on now (null when it is not their turn). */
  get myStep(): any | null {
    if (this.status !== 'P' || !this.me) { return null; }
    const mine = this.approvals.filter(a => this.up(a.approverId) === this.me && this.stepState(a) === 'current');
    return mine.find(a => this.approvalId && Number(a.approvalId) === Number(this.approvalId)) ?? mine[0] ?? null;
  }
  /** The user is an approver but it is not their turn yet (the HOD before the handovers finish). */
  get myWaitingStep(): any | null {
    if (this.status !== 'P' || this.myStep) { return null; }
    return this.approvals.find(a => this.up(a.approverId) === this.me && this.stepState(a) === 'waiting') ?? null;
  }
  get isApplicant(): boolean { return this.up(this.leave?.employeeId) === this.me || this.up(this.leave?.createdBy) === this.me; }

  // ── labels ────────────────────────────────────────────────────────────────
  tc(v: string): string {
    return (v || '').toLowerCase().replace(/(^|[\s.'(/-])\p{L}/gu, c => c.toUpperCase())
      .replace(/\b(It|Hr|Hod|Ced|Qa|Qc|Qaqc|Mep|Pmc|Dpr|Cad|Pmv|Llc)\b/g, w => w.toUpperCase());
  }
  initials(name: string): string {
    const p = (name || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
  }
  private static readonly AV = ['#0f6b50', '#1B2A38', '#2563eb', '#7c3aed', '#b45309', '#0e7490', '#be185d'];
  avatarColor(key: string): string {
    let n = 0;
    for (const ch of key || '') { n = (n * 31 + ch.charCodeAt(0)) >>> 0; }
    return LeaveViewComponent.AV[n % LeaveViewComponent.AV.length];
  }
  typeIcon(code: string): string {
    switch (this.up(code)) {
      case 'ANNUAL': return 'fa-umbrella-beach';
      case 'EMERGENCY_EXPAT': return 'fa-plane-departure';
      case 'CME': return 'fa-graduation-cap';
      case 'SICK': return 'fa-notes-medical';
      case 'COMP_OFF': return 'fa-business-time';
      default: return 'fa-calendar-days';
    }
  }
  docLabel(cat: string): string {
    switch (this.up(cat)) {
      case 'TICKET': return 'Air ticket';
      case 'MEDICAL': return 'Medical certificate';
      default: return 'Attachment';
    }
  }
  fileSize(kb: number): string { return !kb ? '' : kb < 1024 ? Math.round(kb) + ' KB' : (kb / 1024).toFixed(1) + ' MB'; }

  // ── document ──────────────────────────────────────────────────────────────
  private fileBlob(): Blob | null {
    const b64: string = this.leave?.fileData;
    if (!b64) { return null; }
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
    return new Blob([bytes], { type: this.leave?.fileType || 'application/octet-stream' });
  }
  openFile(download: boolean): void {
    const blob = this.fileBlob();
    if (!blob) { return; }
    const url = URL.createObjectURL(blob);
    if (download) {
      const a = document.createElement('a');
      a.href = url;
      a.download = this.leave?.fileName || 'document';
      document.body.appendChild(a); a.click(); a.remove();
    } else {
      window.open(url, '_blank');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ── approve / reject ──────────────────────────────────────────────────────
  act(status: 'A' | 'R'): void {
    const step = this.myStep;
    if (!step || this.acting) { return; }
    if (status === 'R' && !this.remarks.trim()) {
      this.notice = { kind: 'error', text: 'Add a remark explaining why the application is rejected.' };
      return;
    }
    this.notice = null;
    const who = this.tc(this.leave?.employeeName) || 'this employee';
    Swal.fire({
      title: status === 'A' ? 'Approve this leave?' : 'Reject this leave?',
      text: status === 'A'
        ? (this.up(step.approverRole) === 'HANDOVER'
            ? `You confirm you will cover ${who}'s work during the leave.`
            : `The leave of ${who} will be approved.`)
        : `The application of ${who} will be rejected and the employee informed.`,
      icon: status === 'A' ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonColor: status === 'A' ? '#10b981' : '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: status === 'A' ? 'Yes, approve' : 'Yes, reject',
      cancelButtonText: 'Cancel'
    }).then(r => {
      if (!r.isConfirmed) { return; }
      this.acting = status;
      this.api.UpdateLeaveApproval({
        approvalId: Number(step.approvalId), leaveId: Number(this.leaveId), status,
        remarks: this.remarks.trim() || undefined, baseurl: document.baseURI
      }).subscribe({
        next: (res: any) => {
          this.acting = null;
          if (res?.success) {
            this.remarks = '';
            Swal.fire({ icon: 'success', title: res.message || 'Done', timer: 2200, showConfirmButton: false });
            this.load();
          } else {
            this.notice = { kind: 'error', text: res?.message || 'The action could not be saved.' };
          }
        },
        error: () => { this.acting = null; this.notice = { kind: 'error', text: 'The action could not be saved. Please try again.' }; }
      });
    });
  }

  goBack(): void {
    const back = sessionStorage.getItem('returnUrl');
    if (back) {
      sessionStorage.removeItem('returnUrl');
      this.router.navigateByUrl(back);
    } else {
      // opened from an e-mail / notification: approvers go to their leave inbox, applicants to their report
      const isApprover = !!this.me && this.approvals.some(a => this.up(a.approverId) === this.me);
      this.router.navigate([isApprover ? '/leave-inbox' : '/leave-report']);
    }
  }
}
