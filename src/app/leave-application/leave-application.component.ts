import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { Api } from '../services/api';
import { AvatarUtil } from '../utils/avatar.util';
import { LeaveViewComponent } from './leave-view/leave-view.component';

/** One choice in a dropdown. `value` is what will be sent to the API later. */
export interface LeaveOption { value: string; label: string; phone?: string; email?: string; }

/** A leave type tile, with the extra rules that apply to it. */
export interface LeaveTypeDef {
  value: string;
  label: string;
  icon: string;
  hint: string;
  /** Minimum days between today and the first day of leave. */
  noticeDays?: number;
  /** Supporting document that must be uploaded with this type. */
  requires?: 'ticket' | 'medical';
  /** At least one handover person is mandatory for this type. */
  handoverRequired?: boolean;
}

/** One person taking over part of the work — each of them approves their own handover. */
export interface LeaveHandover {
  empId: string;
  name: string;
  phone: string;
  email: string;
  project: string;
  activities: string;
  remarks: string;
}

export type LeaveFileSlot = 'ticket' | 'medical' | 'other';

/** The applicant, shown at the top (session first, then GetEmployeeProfile). */
export interface LeaveApplicant {
  name: string; empId: string; designation: string; department: string;
  location: string; doj: string; email: string; phone: string; photo: string;
}

/**
 * New leave application.
 *
 * Lists come from the same APIs the Exit Form uses:
 *   colleagues (handover responsible person) → GetEmployeeListAll — the Exit Form's
 *       "Project Manager / Site Incharge" and "Responsible Person Name" list (includes workers)
 *   approvers  (Approved by)                 → GetHodMasterList   — the Exit Form's "HOD Name"
 * Applicant details: the session user, filled out by GetEmployeeProfile (same as the Profile page);
 * the phone shown there is the contact number while on leave.
 * Rules: Annual Leave → 30 days' notice + air ticket + at least one handover; Sick Leave → medical certificate.
 * Approval order: each handover person (optional except for Annual Leave), then the HOD.
 * Submit → LeaveForm/SaveLeaveApplication (PKG_LEAVEFORM). The rules (notice days, required
 * document, handover) come from TM_LEAVE_TYPE_MASTER via LeaveForm/GetLeaveTypes; the list
 * below is the fallback. /leave-application?leaveId=… shows a submitted application instead
 * of the form (LeaveViewComponent) — that is the link in the e-mails and notifications.
 */
@Component({
  selector: 'app-leave-application',
  standalone: true,
  imports: [CommonModule, FormsModule, LeaveViewComponent],
  templateUrl: './leave-application.component.html',
  styleUrls: ['./leave-application.component.css']
})
export class LeaveApplicationComponent implements OnInit, OnDestroy {

  // ── option lists ──────────────────────────────────────────────────────────
  leaveTypes: LeaveTypeDef[] = [
    { value: 'ANNUAL', label: 'Annual Leave', icon: 'fa-umbrella-beach', hint: '30 days notice · ticket · handover', noticeDays: 30, requires: 'ticket', handoverRequired: true },
    { value: 'EMERGENCY_EXPAT', label: 'Emergency Leave (Expat)', icon: 'fa-plane-departure', hint: 'Urgent travel home' },
    { value: 'CME', label: 'Continuing Medical Education', icon: 'fa-graduation-cap', hint: 'Courses and training' },
    { value: 'SICK', label: 'Sick Leave', icon: 'fa-notes-medical', hint: 'Medical certificate', requires: 'medical' },
    { value: 'COMP_OFF', label: 'Compensatory OFF', icon: 'fa-business-time', hint: 'For extra days worked' }
  ];
  colleagues: LeaveOption[] = [];
  approvers: LeaveOption[] = [];
  colleaguesState: 'loading' | 'ready' | 'error' = 'loading';
  approversState: 'loading' | 'ready' | 'error' = 'loading';

  me: LeaveApplicant = { name: '', empId: '', designation: '', department: '', location: '', doj: '', email: '', phone: '', photo: '' };

  // ── form state ────────────────────────────────────────────────────────────
  leaveType = '';
  fromDate = '';
  toDate = '';
  /** Optional: people taking over the work. Empty = no handover step. */
  handovers: LeaveHandover[] = [];
  approvedBy = '';
  travelRoute = '';
  reason = '';
  files: Record<LeaveFileSlot, File | null> = { ticket: null, medical: null, other: null };
  dragSlot: LeaveFileSlot | null = null;

  /** Set after the first Save click, so errors only show once the user has tried. */
  submitted = false;
  saving = false;

  /** ?leaveId=… — show that application instead of the form. */
  viewLeaveId: number | null = null;
  viewApprovalId: number | null = null;
  private formReady = false;
  notice: { kind: 'info' | 'error'; text: string } | null = null;

  readonly maxFileMb = 5;

  // ── responsible-person picker (one open at a time) ────────────────────────
  pickerFor: number | null = null;
  pickerQuery = '';
  /** Rows rendered at once; the employee list has hundreds of names. */
  readonly pickerLimit = 100;

  private selfId = '';
  private subs: Subscription[] = [];

  constructor(private api: Api, private host: ElementRef<HTMLElement>, private route: ActivatedRoute, private router: Router) { }

  static blankHandover(): LeaveHandover {
    return { empId: '', name: '', phone: '', email: '', project: '', activities: '', remarks: '' };
  }

  ngOnInit(): void {
    let u: any = {};
    try { u = JSON.parse(localStorage.getItem('current_user') || '{}') || {}; } catch { u = {}; }
    this.selfId = (u.empId || u.employeeId || '').toString().trim().toUpperCase();
    this.me = {
      name: this.clean(u.employeeName), empId: this.clean(u.empId), designation: this.clean(u.designation),
      department: this.clean(u.department), location: this.clean(u.location), doj: this.clean(u.doj || u.dateOfJoining),
      email: this.clean(u.email || u.emailId), phone: this.clean(u.phone),
      photo: this.clean(u.profileImageBase64) ? AvatarUtil.processProfileImage(u.profileImageBase64) : ''
    };
    this.subs.push(this.route.queryParamMap.subscribe(q => {
      const id = Number(q.get('leaveId'));
      const ap = Number(q.get('approvalID') || q.get('approvalId'));
      this.viewLeaveId = id > 0 ? id : null;
      this.viewApprovalId = ap > 0 ? ap : null;
      if (!this.viewLeaveId) { this.initForm(); }
    }));
  }

  /** The form's lists load once, and only when the form is actually shown. */
  private initForm(): void {
    if (this.formReady) { return; }
    this.formReady = true;
    this.loadMe();
    this.loadColleagues();
    this.loadApprovers();
    this.loadLeaveTypes();
  }

  /** Leave the view of a submitted application and start a new one. */
  openNewApplication(): void {
    this.reset();
    this.router.navigate(['/leave-application']);
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  private clean(v: unknown): string { return (v ?? '').toString().trim(); }

  // ── data ──────────────────────────────────────────────────────────────────
  /** Same call as the Profile page; fills in phone, joining date, photo… */
  private loadMe(): void {
    if (!this.me.empId) { return; }
    this.subs.push(this.api.GetEmployeeProfile(this.me.empId).subscribe({
      next: (res: any) => {
        const d = res?.success ? res.data : null;
        if (!d) { return; }
        const pick = (a: unknown, b: string) => this.clean(a) || b;
        this.me = {
          name: pick(d.employeeName, this.me.name), empId: pick(d.empId, this.me.empId),
          designation: pick(d.designation, this.me.designation), department: pick(d.department, this.me.department),
          location: pick(d.location, this.me.location), doj: pick(d.doj, this.me.doj),
          email: pick(d.email, this.me.email), phone: pick(d.phone || d.telephone, this.me.phone),
          photo: this.clean(d.profileImageBase64) ? AvatarUtil.processProfileImage(d.profileImageBase64) : this.me.photo
        };
      },
      error: () => { /* keep the session values */ }
    }));
  }

  /** Same source as the Exit Form's "Responsible Person Name" / "Project Manager / Site Incharge". */
  loadColleagues(): void {
    this.colleaguesState = 'loading';
    this.subs.push(this.api.GetEmployeeListAll().subscribe({
      next: (res: any) => {
        const rows: any[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        this.colleagues = this.toOptions(rows)
          .filter(o => o.value.toUpperCase() !== this.selfId)          // you can't hand over to yourself
          .sort((a, b) => a.label.localeCompare(b.label));
        this.colleaguesState = 'ready';
      },
      error: () => { this.colleagues = []; this.colleaguesState = 'error'; }
    }));
  }

  /** Same source as the Exit Form's "HOD Name" dropdown. */
  loadApprovers(): void {
    this.approversState = 'loading';
    this.subs.push(this.api.GetHodMasterList().subscribe({
      next: (res: any) => {
        const rows: any[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        this.approvers = this.toOptions(rows).sort((a, b) => a.label.localeCompare(b.label));
        this.approversState = 'ready';
      },
      error: () => { this.approvers = []; this.approversState = 'error'; }
    }));
  }

  /**
   * The rules live in TM_LEAVE_TYPE_MASTER: names, notice days, required document and the
   * handover rule come from there; icons and hints stay here. The built-in list is kept if
   * the call fails, so the form always works.
   */
  private loadLeaveTypes(): void {
    this.subs.push(this.api.GetLeaveTypes().subscribe({
      next: (res: any) => {
        const rows: any[] = res?.success && Array.isArray(res.data) ? res.data : [];
        if (!rows.length) { return; }
        const byCode = new Map(this.leaveTypes.map(t => [t.value, t] as [string, LeaveTypeDef]));
        this.leaveTypes = rows
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
          .map(r => {
            const code = (r.leaveTypeCode || '').toString().trim().toUpperCase();
            const base = byCode.get(code);
            const doc = (r.requiredDoc || '').toString().trim().toUpperCase();
            const requires: LeaveTypeDef['requires'] = doc === 'TICKET' ? 'ticket' : doc === 'MEDICAL' ? 'medical' : undefined;
            const noticeDays = Number(r.noticeDays) || 0;
            const handoverRequired = (r.handoverRequired || '').toString().trim().toUpperCase() === 'Y';
            const hint = base?.hint ?? [noticeDays ? noticeDays + ' days notice' : '', requires === 'ticket' ? 'ticket' : requires === 'medical' ? 'Medical certificate' : '', handoverRequired ? 'handover' : ''].filter(Boolean).join(' · ');
            return {
              value: code, label: (r.leaveTypeName || base?.label || code).toString(),
              icon: base?.icon ?? 'fa-calendar-days', hint: hint || 'Leave',
              noticeDays: noticeDays || undefined, requires, handoverRequired
            } as LeaveTypeDef;
          })
          .filter(t => !!t.value);
      },
      error: () => { /* keep the built-in list */ }
    }));
  }

  /** Map the list rows the way the Exit Form does (idValue / description, phoneNumber / email). */
  private toOptions(rows: any[]): LeaveOption[] {
    const seen = new Set<string>();
    const out: LeaveOption[] = [];
    for (const r of rows) {
      const id = (r?.idValue ?? r?.empId ?? r?.id ?? r?.employeeId ?? r?.EmpId ?? '').toString().trim();
      const raw = (r?.description ?? r?.employeeName ?? r?.name ?? r?.EmployeeName ?? '').toString().trim();
      if (!id || !raw || seen.has(id)) { continue; }
      seen.add(id);
      // descriptions sometimes carry the ID as well ("NAME (ITS41)" / "NAME - ITS41"): show it once
      const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const label = raw.replace(new RegExp('\\s*[-–(]\\s*' + esc + '\\s*\\)?\\s*$', 'i'), '').trim() || raw;
      const phone = (r?.phoneNumber ?? r?.phone ?? r?.mobileNo ?? '').toString().trim();
      const email = (r?.email ?? r?.emailId ?? '').toString().trim();
      out.push({ value: id, label, phone, email });
    }
    return out;
  }

  labelOf(list: { value: string; label: string }[], value: string): string {
    return list.find(o => o.value === value)?.label ?? '';
  }

  // ── applicant card ────────────────────────────────────────────────────────
  /** "ADAN ONAPARAMBIL" → "Adan Onaparambil"; keeps short codes such as IT / HR upper-case. */
  tc(v: string): string {
    return (v || '').toLowerCase().replace(/(^|[\s.'(/-])\p{L}/gu, c => c.toUpperCase())
      .replace(/\b(It|Hr|Hod|Ced|Qa|Qc|Qaqc|Mep|Pmc|Dpr|Cad|Pmv|Llc)\b/g, w => w.toUpperCase());
  }
  initials(name: string): string {
    const p = (name || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
  }
  private parseDate(v: string): Date | null {
    if (!v) { return null; }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  get dojText(): string {
    const d = this.parseDate(this.me.doj);
    return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : this.me.doj;
  }
  /** "6 yrs 4 mos" since joining. */
  get serviceText(): string {
    const d = this.parseDate(this.me.doj);
    if (!d) { return ''; }
    const now = new Date();
    let m = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
    if (now.getDate() < d.getDate()) { m--; }
    if (m < 0) { return ''; }
    const y = Math.floor(m / 12), r = m % 12;
    return [y ? y + (y === 1 ? ' yr' : ' yrs') : '', r ? r + (r === 1 ? ' mo' : ' mos') : ''].filter(Boolean).join(' ') || 'Less than a month';
  }
  photoFailed(): void { this.me = { ...this.me, photo: '' }; }

  // ── leave type rules ──────────────────────────────────────────────────────
  get typeDef(): LeaveTypeDef | undefined { return this.leaveTypes.find(t => t.value === this.leaveType); }
  get needsTicket(): boolean { return this.typeDef?.requires === 'ticket'; }
  get needsMedical(): boolean { return this.typeDef?.requires === 'medical'; }
  get needsHandover(): boolean { return !!this.typeDef?.handoverRequired; }
  /** Annual Leave needs a handover: open the first card for them straight away. */
  pickType(v: string): void {
    this.leaveType = v;
    if (this.needsHandover && !this.handovers.length) { this.handovers = [LeaveApplicationComponent.blankHandover()]; }
  }

  private iso(d: Date): string {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /** Earliest allowed first day for the chosen type (today + notice), or null when there is no notice rule. */
  get minFrom(): string | null {
    const n = this.typeDef?.noticeDays;
    if (!n) { return null; }
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n);
    return this.iso(d);
  }
  get minFromText(): string {
    const m = this.minFrom;
    return m ? new Date(m + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }
  get noticeError(): boolean { return !!this.minFrom && !!this.fromDate && this.fromDate < this.minFrom; }

  // ── handover cards (optional) ─────────────────────────────────────────────
  addHandover(): void {
    this.handovers = [...this.handovers, LeaveApplicationComponent.blankHandover()];
    const n = this.handovers.length;
    setTimeout(() => this.host.nativeElement.querySelector(`#lv-ho-${n - 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }
  /** The last card can't be removed while the leave type requires a handover. */
  canRemoveHandover(): boolean { return !this.needsHandover || this.handovers.length > 1; }
  removeHandover(i: number): void {
    if (!this.canRemoveHandover()) { return; }
    this.handovers = this.handovers.filter((_, k) => k !== i);
    this.pickerFor = null;
  }
  trackHo = (i: number) => i;

  /** People already chosen on another card can't be picked twice. */
  takenElsewhere(id: string, i: number): boolean {
    return this.handovers.some((h, k) => k !== i && h.empId === id);
  }

  openPicker(i: number, ev?: Event): void {
    ev?.stopPropagation();
    if (this.colleaguesState !== 'ready') { return; }
    this.pickerFor = this.pickerFor === i ? null : i;
    if (this.pickerFor !== null) {
      this.pickerQuery = '';
      setTimeout(() => (this.host.nativeElement.querySelector('.lv-pick-panel input') as HTMLInputElement | null)?.focus());
    }
  }
  get pickerMatches(): LeaveOption[] {
    const q = this.pickerQuery.trim().toLowerCase();
    return q ? this.colleagues.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)) : this.colleagues;
  }
  get pickerShown(): LeaveOption[] { return this.pickerMatches.slice(0, this.pickerLimit); }
  get pickerMore(): number { return Math.max(0, this.pickerMatches.length - this.pickerLimit); }

  /** Picking a person fills their phone and email from the employee list (still editable). */
  pickPerson(i: number, o: LeaveOption): void {
    if (this.takenElsewhere(o.value, i)) { return; }
    const h = this.handovers[i];
    h.empId = o.value;
    h.name = o.label;
    if (o.phone) { h.phone = o.phone; }
    if (o.email) { h.email = o.email; }
    this.pickerFor = null;
  }
  clearPerson(i: number, ev?: Event): void {
    ev?.stopPropagation();
    Object.assign(this.handovers[i], { empId: '', name: '', phone: '', email: '' });
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (this.pickerFor !== null && !(ev.target as HTMLElement)?.closest?.('.lv-pick-wrap')) { this.pickerFor = null; }
  }
  @HostListener('document:keydown.escape')
  onEsc(): void { this.pickerFor = null; }

  private static readonly AV = ['#0f6b50', '#1B2A38', '#2563eb', '#7c3aed', '#b45309', '#0e7490', '#be185d'];
  avatarColor(key: string): string {
    let n = 0;
    for (const ch of key || '') { n = (n * 31 + ch.charCodeAt(0)) >>> 0; }
    return LeaveApplicationComponent.AV[n % LeaveApplicationComponent.AV.length];
  }

  /** Field errors for one card, keyed by field name. Once a card is added, its details are required. */
  hoErrors(h: LeaveHandover): Record<string, string> {
    const e: Record<string, string> = {};
    if (!h.empId) { e['person'] = 'Choose the responsible person.'; }
    if (!h.phone.trim()) { e['phone'] = 'Phone number is required.'; }
    else if (!/^[+]?[0-9\s\-()]{7,15}$/.test(h.phone.trim())) { e['phone'] = 'Enter a valid phone number.'; }
    if (!h.email.trim()) { e['email'] = 'Email is required.'; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(h.email.trim())) { e['email'] = 'Enter a valid email.'; }
    if (!h.project.trim()) { e['project'] = 'Project name is required.'; }
    if (!h.activities.trim()) { e['activities'] = 'Describe what is being handed over.'; }
    return e;
  }
  hoComplete(h: LeaveHandover): boolean { return !Object.keys(this.hoErrors(h)).length; }
  hoShow(h: LeaveHandover, field: string): string | null { return this.submitted ? (this.hoErrors(h)[field] ?? null) : null; }

  /** Names of the people chosen so far, in card order. */
  get handoverNames(): string[] { return this.handovers.filter(h => h.empId).map(h => this.tc(h.name) || h.empId); }
  get handoversComplete(): number { return this.handovers.filter(h => this.hoComplete(h)).length; }
  /** Approval-flow step text: up to two names, then "+N more". */
  get handoverFlowText(): string {
    const n = this.handoverNames;
    return n.length <= 2 ? n.join(', ') : n.slice(0, 2).join(', ') + ' +' + (n.length - 2) + ' more';
  }
  /** Summary text: "Name A, Name B" or "Name A +2 more". */
  get handoverSummary(): string {
    const n = this.handoverNames;
    if (!n.length) { return ''; }
    return n.length <= 2 ? n.join(', ') : n[0] + ' +' + (n.length - 1) + ' more';
  }
  get approverName(): string { return this.tc(this.labelOf(this.approvers, this.approvedBy)); }

  // ── derived ───────────────────────────────────────────────────────────────
  /** Inclusive calendar days between the two dates, or null while incomplete/invalid. */
  get totalDays(): number | null {
    if (!this.fromDate || !this.toDate) { return null; }
    const a = new Date(this.fromDate), b = new Date(this.toDate);
    if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) { return null; }
    return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  }
  get dateOrderError(): boolean {
    return !!this.fromDate && !!this.toDate && new Date(this.toDate) < new Date(this.fromDate);
  }
  get errors(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!this.leaveType) { e['leaveType'] = 'Choose a leave type.'; }
    if (!this.fromDate) { e['fromDate'] = 'Choose the first day of leave.'; }
    else if (this.noticeError) { e['fromDate'] = `Apply at least ${this.typeDef?.noticeDays} days ahead — the earliest start is ${this.minFromText}.`; }
    if (!this.toDate) { e['toDate'] = 'Choose the last day of leave.'; }
    else if (this.dateOrderError) { e['toDate'] = 'The to date must be on or after the from date.'; }
    if (this.needsTicket && !this.files.ticket) { e['ticket'] = 'Upload your air ticket for annual leave.'; }
    if (this.needsMedical && !this.files.medical) { e['medical'] = 'Upload the medical certificate for sick leave.'; }
    if (this.needsHandover && !this.handovers.length) { e['handovers'] = 'Annual leave needs at least one handover person.'; }
    else if (this.handoversComplete !== this.handovers.length) {
      e['handovers'] = this.needsHandover ? 'Complete the details for every handover person.' : 'Complete the details for every handover person, or remove the card.';
    }
    if (!this.approvedBy) { e['approvedBy'] = 'Choose your approver.'; }
    return e;
  }
  show(field: string): string | null { return this.submitted ? (this.errors[field] ?? null) : null; }

  // ── summary card ──────────────────────────────────────────────────────────
  /** Required items for the progress bar — grows with the leave type's own rules. */
  get requiredChecks(): boolean[] {
    const c = [!!this.leaveType, !!this.fromDate && !this.noticeError, !!this.toDate && !this.dateOrderError, !!this.approvedBy];
    if (this.needsTicket) { c.push(!!this.files.ticket); }
    if (this.needsMedical) { c.push(!!this.files.medical); }
    if (this.handovers.length || this.needsHandover) { c.push(!!this.handovers.length && this.handoversComplete === this.handovers.length); }
    return c;
  }
  get requiredDone(): number { return this.requiredChecks.filter(Boolean).length; }
  get requiredTotal(): number { return this.requiredChecks.length; }
  /** "4 Oct – 8 Oct 2026 · 5 days" (or the one date chosen so far). */
  get dateRange(): string {
    const f = (v: string, y: boolean) => { const d = new Date(v + 'T00:00:00'); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', y ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' }); };
    if (this.fromDate && this.toDate) {
      const days = this.totalDays;
      return f(this.fromDate, false) + ' – ' + f(this.toDate, true) + (days ? ' · ' + days + (days === 1 ? ' day' : ' days') : '');
    }
    return this.fromDate ? 'From ' + f(this.fromDate, true) : this.toDate ? 'To ' + f(this.toDate, true) : '';
  }

  // ── attachments (ticket / medical certificate / other) ────────────────────
  onFilePicked(slot: LeaveFileSlot, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.takeFile(slot, input.files?.[0] ?? null);
    input.value = '';                       // allow picking the same file again after removing it
  }
  onDrop(slot: LeaveFileSlot, ev: DragEvent): void {
    ev.preventDefault();
    this.dragSlot = null;
    this.takeFile(slot, ev.dataTransfer?.files?.[0] ?? null);
  }
  onDragOver(slot: LeaveFileSlot, ev: DragEvent): void { ev.preventDefault(); this.dragSlot = slot; }
  fileIn(slot: LeaveFileSlot): File | null { return this.files[slot] ?? null; }
  removeFile(slot: LeaveFileSlot): void { this.files = { ...this.files, [slot]: null }; }
  private takeFile(slot: LeaveFileSlot, f: File | null): void {
    if (!f) { return; }
    if (f.size > this.maxFileMb * 1024 * 1024) {
      this.notice = { kind: 'error', text: `"${f.name}" is larger than ${this.maxFileMb} MB.` };
      return;
    }
    this.files = { ...this.files, [slot]: f };
    this.notice = null;
  }
  fileSize(f: File): string {
    return f.size < 1024 * 1024 ? Math.max(1, Math.round(f.size / 1024)) + ' KB' : (f.size / 1024 / 1024).toFixed(1) + ' MB';
  }

  // ── actions ───────────────────────────────────────────────────────────────
  reset(): void {
    this.leaveType = this.fromDate = this.toDate = this.approvedBy = this.reason = this.travelRoute = '';
    this.handovers = [];
    this.files = { ticket: null, medical: null, other: null };
    this.submitted = false;
    this.notice = null;
    this.pickerFor = null;
  }

  private readFile(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve((r.result as string) || '');
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);                      // "data:…;base64,…" — the API strips the prefix
    });
  }

  async save(): Promise<void> {
    if (this.saving) { return; }
    this.submitted = true;
    if (Object.keys(this.errors).length) {
      this.notice = { kind: 'error', text: 'Please complete the highlighted fields.' };
      setTimeout(() => this.host.nativeElement.querySelector('.lv-err')?.closest('.lv-sec, .lv-me-appr')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      return;
    }

    // one document per application: the required one for the type, otherwise the optional one
    const slot: LeaveFileSlot = this.needsTicket ? 'ticket' : this.needsMedical ? 'medical' : 'other';
    const file = this.files[slot];
    this.saving = true;
    this.notice = null;
    let fileBase64: string | null = null;
    try {
      fileBase64 = file ? await this.readFile(file) : null;
    } catch {
      this.saving = false;
      this.notice = { kind: 'error', text: 'The document could not be read. Please attach it again.' };
      return;
    }

    const request = {
      employeeId: this.me.empId,
      leaveType: this.leaveType,
      fromDate: this.fromDate,                  // yyyy-MM-dd, no time zone shift
      toDate: this.toDate,
      reason: this.reason.trim() || null,
      travelRoute: this.needsTicket ? (this.travelRoute.trim() || null) : null,
      contactNumber: this.me.phone || null,     // the phone on the applicant card
      approverId: this.approvedBy,
      handovers: this.handovers.map(h => ({
        rpersonEmpId: h.empId, rpersonPhone: h.phone.trim(), rpersonEmail: h.email.trim(),
        project: h.project.trim(), activities: h.activities.trim(), remarks: h.remarks.trim() || null
      })),
      docCategory: file ? slot.toUpperCase() : null,
      fileName: file?.name ?? null,
      fileType: file?.type || null,
      fileBase64,
      baseurl: document.baseURI
    };

    this.subs.push(this.api.SaveLeaveApplication(request).subscribe({
      next: (res: any) => {
        this.saving = false;
        const id = Number(res?.data);
        if (res?.success && id > 0) {
          const first = this.handoverNames.length
            ? (this.handoverNames.length === 1 ? this.handoverNames[0] : this.handoverNames.length + ' handover persons')
            : (this.approverName || 'your HOD');
          Swal.fire({
            icon: 'success',
            title: 'Leave application submitted',
            text: `Application #${id} has been sent to ${first} for approval.`,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'View application'
          }).then(() => {
            this.reset();
            this.router.navigate(['/leave-application'], { queryParams: { leaveId: id } });
          });
        } else {
          this.notice = { kind: 'error', text: res?.message || 'The application could not be submitted.' };
          setTimeout(() => this.host.nativeElement.querySelector('.lv-notice')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        }
      },
      error: (err: any) => {
        this.saving = false;
        const msg = err?.status === 413 ? 'The document is too large.' : 'The application could not be submitted. Please try again.';
        this.notice = { kind: 'error', text: msg };
      }
    }));
  }
}
