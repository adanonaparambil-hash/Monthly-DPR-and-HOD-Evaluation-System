import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  ALLOW_LABEL, Allow, BAR_GRID, BAR_TICKS, Bar, HODS, OtDay, OtRequest, POLICY, STAGE_LABEL, Stage,
  allowance, bar, checks, csvDownload, dateOf, dprMin, eligibleDates, fmtLong, fmtStamp, hhmm, hm, hue, initials,
  monthOpen, sampleMine, stage, stageCls, titleCase, workMin
} from './ot-data';

/* ════════════════════════════════════════════════════════════════════════
   Form Services → OT Request — SUBMISSION ONLY (design: ot-request-v2).
   HOD and Operations approve on Approvals → OT Approvals (ot-approvals).
   UI ONLY: sample data from ot-data.ts; methods marked "API:" get a call.
   ════════════════════════════════════════════════════════════════════════ */

type Filter = 'all' | 'yes' | 'no';

interface CalCell { iso: string; d: number; pad: boolean; we: boolean; today: boolean; req: OtRequest | null; eligible: boolean; }

@Component({
  selector: 'app-ot-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ot-request.component.html',
  styleUrls: ['./ot-shared.css', './ot-request.component.css']
})
export class OtRequestComponent implements OnInit {

  readonly hods = HODS;
  readonly policy = POLICY;
  readonly ticks = BAR_TICKS;
  readonly grid = BAR_GRID;
  readonly dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly weekend = [5, 6];                 // Friday, Saturday (Oman)
  readonly briefMax = 600;

  me = { id: '', name: '' };
  y = 0;
  m = 0;
  filter: Filter = 'all';
  q = '';
  view: 'cards' | 'table' = 'cards';

  days: OtDay[] = [];
  requests: OtRequest[] = [];

  detail: OtRequest | null = null;
  newOpen = false;
  policyOpen = false;
  form = { date: '', hodId: '', hour: '', task: '', brief: '', agree: false };
  errors: Record<string, string> = {};
  /** errors show live only after the first Submit */
  submitted = false;

  ngOnInit(): void {
    this.me = this.readUser();
    const now = new Date();
    this.y = now.getFullYear();
    this.m = now.getMonth();
    try { this.view = localStorage.getItem('otView') === 'table' ? 'table' : 'cards'; } catch { /* private mode */ }
    const s = sampleMine(this.me);                 // API: GET my OT days + requests for the month
    this.days = s.days;
    this.requests = s.requests;
  }

  // ══ month ══════════════════════════════════════════════════════════════════

  get monthKey(): string { return `${this.y}-${String(this.m + 1).padStart(2, '0')}`; }
  get monthLabel(): string { return new Date(this.y, this.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
  get isOpen(): boolean { return monthOpen(this.y, this.m); }
  get atCurrent(): boolean { const n = new Date(); return this.y === n.getFullYear() && this.m === n.getMonth(); }
  get payrollLabel(): string { return new Date(this.y, this.m + 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }

  shiftMonth(step: number): void {
    const d = new Date(this.y, this.m + step, 1);
    if (d > new Date()) { return; }
    this.y = d.getFullYear();
    this.m = d.getMonth();
  }

  // ══ data for the month ═════════════════════════════════════════════════════

  get monthReqs(): OtRequest[] { return this.requests.filter(r => r.date.startsWith(this.monthKey)).sort((a, b) => a.date.localeCompare(b.date)); }

  get kpi() {
    const all = this.monthReqs;
    const appr = all.filter(r => r.hod === 'APPROVED');
    const pct = all.length ? Math.round(appr.length / all.length * 100) : 0;
    return {
      count: all.length, hours: hhmm(all.reduce((s, r) => s + r.worked, 0)),
      approved: appr.length, pct, pending: all.filter(r => r.hod === 'PENDING').length,
      ring: 157.1 * (1 - pct / 100)
    };
  }

  get allow() {
    const live = this.monthReqs.filter(r => r.hod !== 'REJECTED' && r.ops !== 'REJECTED');
    const full = live.filter(r => allowance(r.punches) === 'full').length;
    const half = live.filter(r => allowance(r.punches) === 'half').length;
    const total = full + half * 0.5;
    const appr = live.filter(r => r.hod === 'APPROVED').reduce((s, r) => s + (allowance(r.punches) === 'full' ? 1 : 0.5), 0);
    return { full, half, total, appr, pct: total ? appr / total * 100 : 0 };
  }

  get cal(): CalCell[] {
    const first = new Date(this.y, this.m, 1).getDay();
    const count = new Date(this.y, this.m + 1, 0).getDate();
    const elig = new Set(eligibleDates(this.y, this.m).map(e => e.iso));
    const now = new Date();
    const cells: CalCell[] = [];
    for (let i = 0; i < first; i++) { cells.push({ iso: '', d: 0, pad: true, we: false, today: false, req: null, eligible: false }); }
    for (let d = 1; d <= count; d++) {
      const iso = `${this.monthKey}-${String(d).padStart(2, '0')}`;
      const wd = new Date(this.y, this.m, d).getDay();
      cells.push({
        iso, d, pad: false, we: this.weekend.includes(wd), req: this.activeReq(iso),
        today: now.getFullYear() === this.y && now.getMonth() === this.m && now.getDate() === d,
        eligible: elig.has(iso)
      });
    }
    return cells;
  }

  dayCls(c: CalCell): string {
    if (c.req) { const s = stage(c.req); return 'has ' + (s === 'done' || s === 'ops' ? 'ok' : s === 'hod' ? 'pend' : 'rej'); }
    return c.eligible && this.isOpen ? 'can' : '';
  }

  get counts() {
    const all = this.monthReqs;
    return { all: all.length, yes: all.filter(r => r.hod === 'APPROVED').length, no: all.filter(r => r.hod === 'PENDING').length };
  }

  get list(): OtRequest[] {
    const words = this.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return this.monthReqs.filter(r => {
      if (this.filter === 'yes' && r.hod !== 'APPROVED') { return false; }
      if (this.filter === 'no' && r.hod !== 'PENDING') { return false; }
      const hay = `${r.brief} ${r.task} ${r.date}`.toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }

  setView(v: 'cards' | 'table'): void { this.view = v; try { localStorage.setItem('otView', v); } catch { /* ignore */ } }

  // ══ calendar / detail ══════════════════════════════════════════════════════

  clickDay(c: CalCell): void {
    if (c.pad) { return; }
    if (c.req) { this.openDetail(c.req); return; }
    if (!c.eligible) { this.toast('OT can be requested for Saturdays and special working days only', 'info'); return; }
    if (!this.isOpen) { this.toast(`${this.monthLabel} is closed for new requests`, 'info'); return; }
    this.openNew(c.iso);
  }

  openDetail(r: OtRequest): void { this.detail = r; }
  closeDetail(): void { this.detail = null; }

  /** API: cancel request (STAFF_OT_REQUEST active = 0) */
  async cancel(r: OtRequest): Promise<void> {
    const res = await Swal.fire({
      title: 'Cancel this request?', html: `${fmtLong(r.date)} · ${hhmm(r.worked)} logged.<br>You can request the day again while the month is open.`,
      icon: 'warning', showCancelButton: true, reverseButtons: true, focusCancel: true, confirmButtonText: 'Cancel request', cancelButtonText: 'Keep it',
      confirmButtonColor: '#d92d20', cancelButtonColor: '#64748b', theme: this.swalTheme()
    });
    if (!res.isConfirmed) { return; }
    this.requests = this.requests.filter(x => x !== r);
    this.detail = null;
    this.toast('Request cancelled', 'success');
  }

  requestAgain(r: OtRequest): void {
    this.detail = null;
    this.openNew(r.date, r);
  }

  // ══ new request ════════════════════════════════════════════════════════════

  get minDate(): string { return `${this.monthKey}-01`; }
  get maxDate(): string {
    const last = `${this.monthKey}-${String(new Date(this.y, this.m + 1, 0).getDate()).padStart(2, '0')}`;
    const today = this.iso(new Date());
    return last < today ? last : today;
  }

  openNew(iso = '', from?: OtRequest): void {
    if (!this.isOpen) { this.toast(`${this.monthLabel} is closed for new requests`, 'info'); return; }
    this.submitted = false;
    this.errors = {};
    this.form = {
      date: iso, hodId: from?.hodId || this.lastHod(), hour: '', task: from?.task ?? '', brief: from?.brief ?? '', agree: false
    };
    this.onDate();
    this.newOpen = true;
  }
  closeNew(): void { this.newOpen = false; }

  /** punches + DPR found for the chosen date */
  get picked(): OtDay | null { return this.days.find(d => d.date === this.form.date) ?? null; }
  get pickedSpecial(): string { return eligibleDates(this.y, this.m).find(e => e.iso === this.form.date)?.special ?? ''; }

  onDate(): void {
    const p = this.picked;
    if (p && p.punches.length >= 2 && !this.form.hour) { this.form.hour = this.toHHMM(workMin(p.punches)); }
    if (this.submitted) { this.validate(); }
  }

  validate(): boolean {
    const f = this.form, e: Record<string, string> = {};
    const p = this.picked;
    const eligible = eligibleDates(this.y, this.m).some(x => x.iso === f.date);
    const dup = this.activeReq(f.date);
    if (!f.date) { e['date'] = 'Choose the OT date.'; }
    else if (!eligible) { e['date'] = 'OT can be requested for Saturdays and special working days only.'; }
    else if (dup && dup.hod !== 'REJECTED') { e['date'] = 'A request already exists for this date.'; }
    else if (!p || allowance(p.punches) === 'none') { e['date'] = 'Your punches for this day do not meet the minimum (4 hours with 2 punches).'; }
    else if (!dprMin(p.tasks)) { e['date'] = 'Log your DPR for this day first — it is mandatory.'; }
    const min = this.fromHHMM(f.hour);
    if (!min) { e['hour'] = 'Enter the hours you worked.'; } else if (min > 16 * 60) { e['hour'] = 'More than 16 hours in one day.'; }
    if (!f.hodId) { e['hod'] = 'Choose your HOD.'; }
    if (f.brief.trim().length < 30) { e['brief'] = 'Describe the work (at least 30 characters).'; }
    if (!f.agree) { e['agree'] = 'Please confirm to continue.'; }
    this.errors = e;
    return !Object.keys(e).length;
  }

  /** API: createOtRequest */
  submit(): void {
    this.submitted = true;
    if (!this.validate()) { return; }
    const p = this.picked as OtDay;
    const hod = HODS.find(h => h.id === this.form.hodId);
    const old = this.activeReq(this.form.date);
    if (old) { this.requests = this.requests.filter(x => x !== old); }
    this.requests = [...this.requests, {
      id: Date.now(), empId: this.me.id, empName: this.me.name, dept: '', date: this.form.date, special: p.special,
      punches: p.punches, site: p.site, tasks: p.tasks, task: this.form.task.trim(), worked: this.fromHHMM(this.form.hour),
      brief: this.form.brief.trim(), hodId: this.form.hodId, hodName: hod?.name ?? this.form.hodId,
      hod: 'PENDING', hodRemark: '', ops: 'WAITING', opsRemark: '', requestedOn: new Date().toISOString()
    }];
    this.newOpen = false;
    this.toast(old ? 'Sent again to your HOD' : 'Request submitted — sent to your HOD', 'success');
  }

  exportCsv(): void {
    csvDownload(`ot-requests-${this.monthKey}.csv`,
      ['Date', 'Day', 'Punches', 'Task', 'Worked', 'Status', 'Allowance (est.)', 'Brief', 'HOD', 'HOD remark', 'Operations remark'],
      this.list.map(r => [r.date, dateOf(r.date).toLocaleDateString('en-GB', { weekday: 'long' }), r.punches.join(' | '), r.task, hhmm(r.worked),
        STAGE_LABEL[stage(r)], ALLOW_LABEL[allowance(r.punches)], r.brief, r.hodName, r.hodRemark, r.opsRemark]));
  }

  // ══ view helpers ═══════════════════════════════════════════════════════════

  stageOf(r: OtRequest): Stage { return stage(r); }
  stageLabel(r: OtRequest): string { return STAGE_LABEL[stage(r)]; }
  stageClass(r: OtRequest): string { return stageCls(stage(r)); }
  allowOf(p: string[]): Allow { return allowance(p); }
  allowLabel(p: string[]): string { return ALLOW_LABEL[allowance(p)]; }
  allowClass(p: string[]): string { const a = allowance(p); return a === 'full' ? 'full' : a === 'half' ? 'info' : 'none'; }
  barOf(p: string[]): Bar { return bar(p); }
  checksOf(d: { punches: string[]; tasks: { name: string; remark: string; mins: number }[] }) { return checks(d.punches, d.tasks); }
  work(p: string[]): string { return hm(workMin(p)); }
  dpr(d: OtDay | OtRequest): number { return dprMin(d.tasks); }
  hm(min: number): string { return hm(min); }
  hhmm(min: number): string { return hhmm(min); }
  long(iso: string): string { return fmtLong(iso); }
  stamp(iso: string): string { return fmtStamp(iso); }
  ini(n: string): string { return initials(n); }
  hueOf(id: string): number { return hue(id); }
  dd(iso: string): string { return iso.slice(8, 10); }
  dow(iso: string): string { return this.dows[dateOf(iso).getDay()]; }
  monYr(iso: string): string { return dateOf(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }); }
  dayName(iso: string): string { return dateOf(iso).toLocaleDateString('en-GB', { weekday: 'long' }); }
  over(r: OtRequest): boolean { return r.worked > workMin(r.punches) + 30; }

  /** horizontal steps: Submitted → HOD → Operations → Paid */
  steps(r: OtRequest): { label: string; short: string; cls: string }[] {
    const s = stage(r);
    return [
      { label: 'Submitted', short: 'Submitted', cls: 'done' },
      { label: 'HOD approval', short: 'HOD', cls: s === 'hod' ? 'cur' : s === 'hod-rejected' ? 'bad' : 'done' },
      { label: 'Operations review', short: 'Operations', cls: s === 'ops' ? 'cur' : s === 'ops-rejected' ? 'bad' : s === 'done' ? 'done' : '' },
      { label: 'Paid with salary', short: 'Paid', cls: s === 'done' ? 'cur' : '' }
    ];
  }
  vsteps(r: OtRequest): { label: string; sub: string; cls: string }[] {
    const st = this.steps(r);
    const s = stage(r);
    const subs = [
      'Request submitted ' + fmtStamp(r.requestedOn),
      s === 'hod' ? 'Waiting for ' + r.hodName : s === 'hod-rejected' ? 'Rejected by ' + r.hodName : 'Approved by ' + r.hodName,
      s === 'ops' ? 'Operations checks punches & DPR' : s === 'ops-rejected' ? 'Rejected by Operations' : s === 'done' ? 'Confirmed by Operations' : 'After HOD approval',
      'With the ' + new Date(dateOf(r.date).getFullYear(), dateOf(r.date).getMonth() + 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) + ' salary'
    ];
    return st.map((x, i) => ({ ...x, sub: subs[i] }));
  }

  canCancel(r: OtRequest): boolean { return r.hod === 'PENDING' && monthOpen(dateOf(r.date).getFullYear(), dateOf(r.date).getMonth()); }
  canAgain(r: OtRequest): boolean { return r.hod === 'REJECTED' && monthOpen(dateOf(r.date).getFullYear(), dateOf(r.date).getMonth()); }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.policyOpen) { this.policyOpen = false; } else if (this.newOpen) { this.newOpen = false; } else if (this.detail) { this.detail = null; }
  }

  // ══ utils ═════════════════════════════════════════════════════════════════

  private activeReq(iso: string): OtRequest | null { return this.requests.find(r => r.date === iso) ?? null; }
  private lastHod(): string { return [...this.requests].sort((a, b) => b.requestedOn.localeCompare(a.requestedOn))[0]?.hodId ?? ''; }
  private toHHMM(min: number): string { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`; }
  private fromHHMM(v: string): number { const m = /^(\d{1,2}):(\d{2})$/.exec(v || ''); return m ? +m[1] * 60 + +m[2] : 0; }
  private iso(d: Date): string { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  private readUser(): { id: string; name: string } {
    try {
      const u = JSON.parse(localStorage.getItem('current_user') || '{}');
      return { id: (u.empId || u.employeeId || 'ITS48').toString().trim(), name: titleCase((u.employeeName || u.name || 'You').toString().trim()) };
    } catch { return { id: 'ITS48', name: 'You' }; }
  }
  private swalTheme(): 'dark' | 'light' { return document.body.classList.contains('dark-theme') ? 'dark' : 'light'; }
  private toast(title: string, icon: 'success' | 'info'): void {
    Swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 2600, timerProgressBar: true, theme: this.swalTheme() });
  }
}
