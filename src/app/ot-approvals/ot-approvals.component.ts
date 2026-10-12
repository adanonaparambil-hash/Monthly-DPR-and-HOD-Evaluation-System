import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  ALLOW_LABEL, BAR_GRID, BAR_TICKS, Bar, OtRequest, STAGE_LABEL, allowance, bar, checks, csvDownload, dateOf, dprMin,
  fmtLong, fmtShort, fmtStamp, hhmm, hm, hue, initials, sampleQueue, stage, stageCls, titleCase, workMin
} from '../ot-request/ot-data';

/* ════════════════════════════════════════════════════════════════════════
   Approvals → OT Approvals — one listing screen for both approval steps.
     HOD queue        : requests where I am the chosen HOD
     Operations queue : requests every HOD has approved
   A user sees only the queue(s) their role allows (API decides); the sample
   shows both. UI ONLY — methods marked "API:" get a call later.
   ════════════════════════════════════════════════════════════════════════ */

type Queue = 'hod' | 'ops';
type Status = 'pending' | 'approved' | 'rejected' | 'all';

@Component({
  selector: 'app-ot-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ot-approvals.component.html',
  styleUrls: ['../ot-request/ot-shared.css', './ot-approvals.component.css']
})
export class OtApprovalsComponent implements OnInit {

  readonly ticks = BAR_TICKS;
  readonly grid = BAR_GRID;

  me = { id: '', name: '' };
  /** API: from the user's roles — HOD (has a team) and/or Operations approver */
  roles = { hod: true, ops: true };
  queue: Queue = 'hod';
  status: Status = 'pending';
  q = '';
  y = 0;
  m = 0;

  items: OtRequest[] = [];
  selected = new Set<number>();
  detail: OtRequest | null = null;

  ngOnInit(): void {
    this.me = this.readUser();
    const now = new Date();
    this.y = now.getFullYear();
    this.m = now.getMonth();
    this.items = sampleQueue(this.me);             // API: GET OT approval queue(s) for the month
    if (!this.roles.hod) { this.queue = 'ops'; }
  }

  // ══ month ══════════════════════════════════════════════════════════════════

  get monthKey(): string { return `${this.y}-${String(this.m + 1).padStart(2, '0')}`; }
  get monthLabel(): string { return new Date(this.y, this.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
  get atCurrent(): boolean { const n = new Date(); return this.y === n.getFullYear() && this.m === n.getMonth(); }
  get payrollLabel(): string { return new Date(this.y, this.m + 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
  shiftMonth(step: number): void {
    const d = new Date(this.y, this.m + step, 1);
    if (d > new Date()) { return; }
    this.y = d.getFullYear();
    this.m = d.getMonth();
    this.selected.clear();
  }

  // ══ queues ═════════════════════════════════════════════════════════════════

  setQueue(q: Queue): void { this.queue = q; this.status = 'pending'; this.selected.clear(); }
  setStatus(s: Status): void { this.status = s; this.selected.clear(); }

  /** everything in a queue for the month, before the status filter */
  private base(q: Queue): OtRequest[] {
    return this.items
      .filter(r => r.date.startsWith(this.monthKey))
      .filter(r => q === 'hod' ? r.hodId === this.me.id : r.hod === 'APPROVED')
      .sort((a, b) => a.date.localeCompare(b.date) || a.empName.localeCompare(b.empName));
  }

  stateIn(q: Queue, r: OtRequest): Status {
    const s = q === 'hod' ? r.hod : r.ops;
    return s === 'APPROVED' ? 'approved' : s === 'REJECTED' ? 'rejected' : 'pending';
  }

  pendingCount(q: Queue): number { return this.base(q).filter(r => this.stateIn(q, r) === 'pending').length; }

  get counts(): Record<Status, number> {
    const b = this.base(this.queue);
    return {
      pending: b.filter(r => this.stateIn(this.queue, r) === 'pending').length,
      approved: b.filter(r => this.stateIn(this.queue, r) === 'approved').length,
      rejected: b.filter(r => this.stateIn(this.queue, r) === 'rejected').length,
      all: b.length
    };
  }

  get list(): OtRequest[] {
    const words = this.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return this.base(this.queue)
      .filter(r => this.status === 'all' || this.stateIn(this.queue, r) === this.status)
      .filter(r => { const hay = `${r.empName} ${r.empId} ${r.dept} ${r.hodName} ${r.task} ${r.brief}`.toLowerCase(); return words.every(w => hay.includes(w)); });
  }

  get kpi() {
    const b = this.base(this.queue);
    const appr = b.filter(r => this.stateIn(this.queue, r) === 'approved');
    const days = appr.reduce((s, r) => s + (allowance(r.punches) === 'full' ? 1 : allowance(r.punches) === 'half' ? 0.5 : 0), 0);
    return { ...this.counts, days, hours: hhmm(appr.reduce((s, r) => s + r.worked, 0)) };
  }

  // ══ selection ══════════════════════════════════════════════════════════════

  canAct(r: OtRequest): boolean { return this.stateIn(this.queue, r) === 'pending'; }
  canRevert(r: OtRequest): boolean {
    if (this.queue === 'hod') { return r.hod === 'REJECTED' || (r.hod === 'APPROVED' && r.ops === 'PENDING'); }
    return r.ops === 'APPROVED' || r.ops === 'REJECTED';
  }
  get selectedItems(): OtRequest[] { return this.list.filter(r => this.selected.has(r.id)); }
  get selectable(): OtRequest[] { return this.list.filter(r => this.canAct(r)); }
  get allSelected(): boolean { return this.selectable.length > 0 && this.selectable.every(r => this.selected.has(r.id)); }
  toggleSel(r: OtRequest, ev?: Event): void { ev?.stopPropagation(); this.selected.has(r.id) ? this.selected.delete(r.id) : this.selected.add(r.id); }
  toggleAll(): void { const all = this.allSelected; this.selectable.forEach(r => all ? this.selected.delete(r.id) : this.selected.add(r.id)); }

  // ══ decisions ══════════════════════════════════════════════════════════════

  /** API: HOD → appovereject(mod 'h') · Operations → appovereject(mod 'o') */
  async decide(rs: OtRequest[], approve: boolean, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    if (!rs.length) { return; }
    const who = this.queue === 'hod' ? 'HOD' : 'Operations';
    const what = rs.length === 1
      ? `<b>${this.esc(rs[0].empName)}</b> · ${fmtLong(rs[0].date)} · ${hhmm(rs[0].worked)} logged`
      : `<b>${rs.length} requests</b> · ${hhmm(rs.reduce((s, r) => s + r.worked, 0))} logged in total`;
    const res = await Swal.fire({
      title: `${approve ? (this.queue === 'hod' ? 'Approve' : 'Confirm') : 'Reject'} OT`, html: what, input: 'textarea',
      inputPlaceholder: approve ? `${who} note (optional)` : 'Reason (required)', inputAttributes: { maxlength: '300' },
      inputValidator: v => (!approve && !(v || '').trim() ? 'Please give a reason' : null),
      showCancelButton: true, reverseButtons: true, confirmButtonText: approve ? (this.queue === 'hod' ? 'Approve' : 'Confirm') : 'Reject', cancelButtonText: 'Back',
      confirmButtonColor: approve ? '#0f9d6b' : '#d92d20', cancelButtonColor: '#64748b', theme: this.swalTheme()
    });
    if (!res.isConfirmed) { return; }
    const note = String(res.value ?? '').trim();
    rs.forEach(r => {
      if (this.queue === 'hod') { r.hod = approve ? 'APPROVED' : 'REJECTED'; r.hodRemark = note; r.ops = approve ? 'PENDING' : 'WAITING'; }
      else { r.ops = approve ? 'APPROVED' : 'REJECTED'; r.opsRemark = note; }
      this.selected.delete(r.id);
    });
    this.toast(rs.length === 1 ? (approve ? 'Approved' : 'Rejected') : `${rs.length} requests ${approve ? 'approved' : 'rejected'}`);
  }

  /** API: revert (mod 'c') */
  async revert(r: OtRequest, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    const res = await Swal.fire({
      title: 'Revert to pending?', html: `${this.esc(r.empName)} · ${fmtLong(r.date)}`, icon: 'warning', showCancelButton: true, reverseButtons: true,
      confirmButtonText: 'Revert', cancelButtonText: 'Back', confirmButtonColor: '#b7791f', cancelButtonColor: '#64748b', theme: this.swalTheme()
    });
    if (!res.isConfirmed) { return; }
    if (this.queue === 'hod') { r.hod = 'PENDING'; r.hodRemark = ''; r.ops = 'WAITING'; } else { r.ops = 'PENDING'; r.opsRemark = ''; }
    this.toast('Reverted to pending');
  }

  exportCsv(): void {
    csvDownload(`ot-${this.queue === 'hod' ? 'hod' : 'operations'}-${this.monthKey}.csv`,
      ['Date', 'Employee ID', 'Employee', 'Department', 'Punches', 'Worked', 'DPR', 'Allowance (est.)', 'Task', 'Brief', 'HOD', 'HOD status', 'HOD remark', 'Operations status', 'Operations remark'],
      this.list.map(r => [r.date, r.empId, r.empName, r.dept, r.punches.join(' | '), hhmm(r.worked), hhmm(dprMin(r.tasks)), ALLOW_LABEL[allowance(r.punches)],
        r.task, r.brief, r.hodName, r.hod, r.hodRemark, r.ops === 'WAITING' ? '' : r.ops, r.opsRemark]));
  }

  // ══ view helpers ═══════════════════════════════════════════════════════════

  open(r: OtRequest): void { this.detail = r; }
  close(): void { this.detail = null; }
  stageLabel(r: OtRequest): string { return STAGE_LABEL[stage(r)]; }
  stageClass(r: OtRequest): string { return stageCls(stage(r)); }
  allowLabel(p: string[]): string { const a = allowance(p); return a === 'full' ? 'Full day' : a === 'half' ? 'Half day' : 'Not eligible'; }
  allowClass(p: string[]): string { const a = allowance(p); return a === 'full' ? 'full' : a === 'half' ? 'info' : 'bad'; }
  barOf(p: string[]): Bar { return bar(p); }
  checksOf(r: OtRequest) { return checks(r.punches, r.tasks); }
  work(p: string[]): string { return hm(workMin(p)); }
  dpr(r: OtRequest): number { return dprMin(r.tasks); }
  over(r: OtRequest): boolean { return r.worked > workMin(r.punches) + 30; }
  hm(v: number): string { return hm(v); }
  hhmm(v: number): string { return hhmm(v); }
  short(iso: string): string { return fmtShort(iso); }
  long(iso: string): string { return fmtLong(iso); }
  stamp(iso: string): string { return fmtStamp(iso); }
  ini(n: string): string { return initials(n); }
  hueOf(id: string): number { return hue(id); }
  dayName(iso: string): string { return dateOf(iso).toLocaleDateString('en-GB', { weekday: 'long' }); }

  vsteps(r: OtRequest): { label: string; sub: string; cls: string }[] {
    const s = stage(r);
    return [
      { label: 'Submitted', sub: fmtStamp(r.requestedOn), cls: 'done' },
      { label: 'HOD approval', sub: s === 'hod' ? 'Waiting for ' + r.hodName : (s === 'hod-rejected' ? 'Rejected by ' : 'Approved by ') + r.hodName,
        cls: s === 'hod' ? 'cur' : s === 'hod-rejected' ? 'bad' : 'done' },
      { label: 'Operations review', sub: s === 'ops' ? 'Checking punches & DPR' : s === 'ops-rejected' ? 'Rejected' : s === 'done' ? 'Confirmed' : 'After HOD approval',
        cls: s === 'ops' ? 'cur' : s === 'ops-rejected' ? 'bad' : s === 'done' ? 'done' : '' },
      { label: 'Paid with salary', sub: 'With the ' + new Date(dateOf(r.date).getFullYear(), dateOf(r.date).getMonth() + 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) + ' salary',
        cls: s === 'done' ? 'cur' : '' }
    ];
  }

  @HostListener('document:keydown.escape')
  onEsc(): void { if (this.detail) { this.detail = null; } }

  // ══ utils ═════════════════════════════════════════════════════════════════

  private readUser(): { id: string; name: string } {
    try {
      const u = JSON.parse(localStorage.getItem('current_user') || '{}');
      return { id: (u.empId || u.employeeId || 'ITS48').toString().trim(), name: titleCase((u.employeeName || u.name || 'You').toString().trim()) };
    } catch { return { id: 'ITS48', name: 'You' }; }
  }
  private esc(v: unknown): string {
    return (v ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);
  }
  private swalTheme(): 'dark' | 'light' { return document.body.classList.contains('dark-theme') ? 'dark' : 'light'; }
  private toast(title: string): void {
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title, showConfirmButton: false, timer: 2400, timerProgressBar: true, theme: this.swalTheme() });
  }
}
