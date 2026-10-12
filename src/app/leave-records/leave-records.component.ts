import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Api } from '../services/api';
import { CraneLoaderComponent } from '../shared/crane-loader/crane-loader.component';

type Mode = 'inbox' | 'report';
type Status = 'Pending' | 'Approved' | 'Rejected';

/** One leave row, from either the approval inbox or my own applications. */
interface LeaveRow {
  leaveId: number;
  approvalId?: number;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  leaveTypeName: string;
  fromDate: string | null;
  toDate: string | null;
  noOfDays: number;
  status: Status;
  requestDate: string | null;
  approvalDate?: string | null;
  /** inbox: HANDOVER / HOD step name; whether it is my turn now */
  stageName?: string;
  canAct?: boolean;
  /** report: where the application is in its chain */
  approverName?: string;
  approvedSteps?: number;
  totalSteps?: number;
}

/**
 * Leave applications on their own pages (moved out of Approval Management):
 *
 *  /leave-inbox   Approvals → Leave Approvals            mode 'inbox'
 *                 PKG_LEAVEFORM.SP_GET_LEAVE_APPROVAL_INBOX — steps assigned to me
 *                 (handover first, then HOD); server-side paging.
 *  /leave-report  Past Reports → Leave Application Report mode 'report'
 *                 PKG_LEAVEFORM.SP_GET_MY_LEAVE_APPLICATIONS — everything I applied
 *                 for, with a summary; one call, paged on the client.
 *
 * Both open the existing leave view (/leave-application?leaveId=…) to read or act,
 * and come back here with the filters and page kept. Styling is Approval
 * Management's own stylesheet, so the three pages look the same.
 */
@Component({
  selector: 'app-leave-records',
  standalone: true,
  imports: [CommonModule, FormsModule, CraneLoaderComponent],
  templateUrl: './leave-records.component.html',
  styleUrls: ['../leave-approval/leave-approval.component.css', './leave-records.component.css']
})
export class LeaveRecordsComponent implements OnInit, OnDestroy {
  mode: Mode = 'inbox';

  loading = false;
  error = '';
  showFilters = true;

  /** inbox: the current server page. report: every application I made. */
  private rows: LeaveRow[] = [];

  // filters
  status = 'P';               // inbox: P | A | R | ALL — report: ALL | P | A | R
  fromDate = '';
  toDate = '';
  leaveType = 'all';          // report only, applied on the client
  empSearch = '';             // inbox only
  empId = '';
  showEmpDd = false;
  private empList: { idValue: string; description: string }[] = [];
  filteredEmp: { idValue: string; description: string }[] = [];

  // paging
  readonly PAGE_SIZES = [25, 50, 100];
  pageNo = 1;
  pageSize = 50;
  private serverTotal = 0;

  private subs: Subscription[] = [];
  private loadSub?: Subscription;

  constructor(private api: Api, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.mode = this.route.snapshot.data['mode'] === 'report' ? 'report' : 'inbox';
    this.status = this.mode === 'inbox' ? 'P' : 'ALL';
    this.restoreState();

    if (this.mode === 'inbox') {
      this.subs.push(this.api.GetEmployeeListAll().subscribe({
        next: (res: any) => {
          const data = res?.data || res || [];
          this.empList = Array.isArray(data) ? data : [];
          this.filteredEmp = this.empList.slice(0, 200);
        },
        error: () => { /* the filter just stays empty */ }
      }));
    }
    this.load();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.loadSub?.unsubscribe();
  }

  // ── data ──────────────────────────────────────────────────────────────────
  load(): void {
    this.loading = true;
    this.error = '';
    this.loadSub?.unsubscribe();

    if (this.mode === 'inbox') {
      this.loadSub = this.api.GetLeaveApprovalInbox({
        status: this.status,
        fromDate: this.fromDate || null,
        toDate: this.toDate || null,
        employeeId: this.empId || undefined,
        pageNo: this.pageNo,
        pageSize: this.pageSize
      }).subscribe({
        next: (res: any) => {
          this.rows = res?.success && Array.isArray(res.data) ? res.data.map((x: any) => this.fromInbox(x)) : [];
          this.serverTotal = res?.success ? (res.totalCount || 0) : 0;
          if (!res?.success) { this.error = res?.message || 'Could not load leave approvals.'; }
          this.loading = false;
        },
        error: () => { this.rows = []; this.serverTotal = 0; this.error = 'Could not load leave approvals.'; this.loading = false; }
      });
    } else {
      this.loadSub = this.api.GetMyLeaveApplications({
        status: this.status === 'ALL' ? undefined : this.status,
        fromDate: this.fromDate || undefined,
        toDate: this.toDate || undefined
      }).subscribe({
        next: (res: any) => {
          this.rows = res?.success && Array.isArray(res.data) ? res.data.map((x: any) => this.fromMine(x)) : [];
          if (!res?.success) { this.error = res?.message || 'Could not load your leave applications.'; }
          this.loading = false;
        },
        error: () => { this.rows = []; this.error = 'Could not load your leave applications.'; this.loading = false; }
      });
    }
  }

  private fromInbox(x: any): LeaveRow {
    return {
      leaveId: Number(x.leaveId), approvalId: Number(x.approvalId),
      employeeId: x.employeeId || '', employeeName: x.employeeName || x.employeeId || '',
      department: x.department || '', designation: x.designation || '',
      leaveTypeName: x.leaveTypeName || x.leaveType || 'Leave',
      fromDate: x.fromDate, toDate: x.toDate, noOfDays: x.noOfDays || 0,
      status: this.statusOf(x.approvalStatus), requestDate: x.requestDate, approvalDate: x.approvalDate,
      stageName: x.stageName || x.approverRole || '', canAct: (x.canAct || '').toString().toUpperCase() === 'Y'
    };
  }

  private fromMine(x: any): LeaveRow {
    return {
      leaveId: Number(x.leaveId),
      employeeId: x.employeeId || '', employeeName: x.employeeName || '', department: '', designation: '',
      leaveTypeName: x.leaveTypeName || x.leaveType || 'Leave',
      fromDate: x.fromDate, toDate: x.toDate, noOfDays: x.noOfDays || 0,
      status: this.statusOf(x.status), requestDate: x.submittedDate,
      approverName: x.approverName || '', approvedSteps: x.approvedSteps || 0, totalSteps: x.totalSteps || 0
    };
  }

  private statusOf(s: unknown): Status {
    const v = (s ?? '').toString().trim().toUpperCase();
    return v === 'A' ? 'Approved' : v === 'R' ? 'Rejected' : 'Pending';
  }

  // ── what is on screen ─────────────────────────────────────────────────────
  /** report: the leave-type filter is applied here (the API has no such filter). */
  private get filtered(): LeaveRow[] {
    return this.mode === 'report' && this.leaveType !== 'all'
      ? this.rows.filter(r => r.leaveTypeName === this.leaveType) : this.rows;
  }
  get total(): number { return this.mode === 'inbox' ? this.serverTotal : this.filtered.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageRows(): LeaveRow[] {
    if (this.mode === 'inbox') { return this.rows; }
    const from = (this.pageNo - 1) * this.pageSize;
    return this.filtered.slice(from, from + this.pageSize);
  }
  get rangeText(): string {
    if (!this.total) { return '0'; }
    const a = (this.pageNo - 1) * this.pageSize + 1;
    return a + '–' + Math.min(this.pageNo * this.pageSize, this.total);
  }
  pageNumbers(): number[] {
    const n = this.totalPages, cur = this.pageNo, max = 5;
    if (n <= max) { return Array.from({ length: n }, (_, i) => i + 1); }
    let start = Math.max(1, cur - 2), end = Math.min(n, cur + 2);
    if (cur <= 3) { end = max; } else if (cur >= n - 2) { start = n - max + 1; }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
  rowNo(i: number): number { return (this.pageNo - 1) * this.pageSize + i + 1; }

  /** report: leave types present in my applications, for the filter. */
  get leaveTypes(): string[] {
    return Array.from(new Set(this.rows.map(r => r.leaveTypeName).filter(Boolean))).sort();
  }

  /** report summary — over everything loaded (the status/date filters apply, the type filter does too). */
  get kpi() {
    const rows = this.filtered;
    const by = (s: Status) => rows.filter(r => r.status === s);
    return {
      total: rows.length,
      pending: by('Pending').length,
      approved: by('Approved').length,
      rejected: by('Rejected').length,
      daysApproved: by('Approved').reduce((n, r) => n + (Number(r.noOfDays) || 0), 0)
    };
  }

  /** inbox: rows where it is my turn right now. */
  get myTurnCount(): number { return this.mode === 'inbox' ? this.rows.filter(r => r.canAct && r.status === 'Pending').length : 0; }

  // ── actions ───────────────────────────────────────────────────────────────
  search(): void { this.pageNo = 1; this.load(); }

  clear(): void {
    this.status = this.mode === 'inbox' ? 'P' : 'ALL';
    this.fromDate = this.toDate = '';
    this.leaveType = 'all';
    this.empSearch = this.empId = '';
    this.filteredEmp = this.empList.slice(0, 200);
    this.search();
  }

  /** Clicking a KPI tile filters the report by that status. */
  quickStatus(code: string): void {
    if (this.mode !== 'report') { return; }
    this.status = code;
    this.search();
  }

  goTo(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.pageNo) { return; }
    this.pageNo = page;
    if (this.mode === 'inbox') { this.load(); }
  }
  pageSizeChanged(): void {
    this.pageNo = 1;
    if (this.mode === 'inbox') { this.load(); }
  }
  typeChanged(): void { this.pageNo = 1; }

  open(r: LeaveRow): void {
    this.saveState();
    sessionStorage.setItem('returnUrl', this.mode === 'inbox' ? '/leave-inbox' : '/leave-report');
    const queryParams: any = { leaveId: r.leaveId };
    if (this.mode === 'inbox' && r.approvalId) { queryParams.approvalID = r.approvalId; }
    this.router.navigate(['/leave-application'], { queryParams });
  }

  newApplication(): void { this.router.navigate(['/leave-application']); }

  // employee filter (inbox)
  onEmpSearch(): void {
    const q = this.empSearch.trim().toLowerCase();
    if (!q) { this.empId = ''; }
    this.filteredEmp = (q ? this.empList.filter(e =>
      (e.description || '').toLowerCase().includes(q) || (e.idValue || '').toLowerCase().includes(q)) : this.empList).slice(0, 200);
  }
  pickEmp(e: { idValue: string; description: string }): void {
    this.empSearch = e.description;
    this.empId = e.idValue;
    this.showEmpDd = false;
  }
  onEmpBlur(): void { setTimeout(() => { this.showEmpDd = false; }, 200); }

  exportCsv(): void {
    const esc = (v: unknown) => '"' + (v ?? '').toString().replace(/"/g, '""') + '"';
    const d = (v: string | null | undefined) => this.fmtDate(v);
    const head = this.mode === 'inbox'
      ? ['Employee', 'Employee ID', 'Department', 'Leave type', 'From', 'To', 'Days', 'Stage', 'Submitted', 'Status']
      : ['Leave type', 'From', 'To', 'Days', 'Approvals', 'Submitted', 'Status'];
    const body = this.pageRows.map(r => (this.mode === 'inbox'
      ? [r.employeeName, r.employeeId, r.department, r.leaveTypeName, d(r.fromDate), d(r.toDate), r.noOfDays, r.stageName, d(r.requestDate), r.status]
      : [r.leaveTypeName, d(r.fromDate), d(r.toDate), r.noOfDays, `${r.approvedSteps}/${r.totalSteps}`, d(r.requestDate), r.status]
    ).map(esc).join(','));
    const blob = new Blob(['﻿' + [head.map(esc).join(','), ...body].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (this.mode === 'inbox' ? 'leave-approvals' : 'my-leave-applications') + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ── list state (kept while opening a record and coming back) ───────────────
  private get stateKey(): string { return 'leaveRecordsState:' + this.mode; }
  private saveState(): void {
    const s = { status: this.status, fromDate: this.fromDate, toDate: this.toDate, leaveType: this.leaveType,
      empSearch: this.empSearch, empId: this.empId, pageNo: this.pageNo, pageSize: this.pageSize, showFilters: this.showFilters };
    try { sessionStorage.setItem(this.stateKey, JSON.stringify(s)); } catch { /* storage blocked */ }
  }
  private restoreState(): void {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(this.stateKey); sessionStorage.removeItem(this.stateKey); } catch { return; }
    if (!raw) { return; }
    try {
      const s = JSON.parse(raw);
      this.status = s.status ?? this.status;
      this.fromDate = s.fromDate ?? '';
      this.toDate = s.toDate ?? '';
      this.leaveType = s.leaveType ?? 'all';
      this.empSearch = s.empSearch ?? '';
      this.empId = s.empId ?? '';
      this.pageSize = this.PAGE_SIZES.includes(Number(s.pageSize)) ? Number(s.pageSize) : this.pageSize;
      this.pageNo = Math.max(1, Number(s.pageNo) || 1);
      this.showFilters = s.showFilters !== false;
    } catch { /* ignore a bad entry */ }
  }

  // ── labels ────────────────────────────────────────────────────────────────
  private static readonly MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /** "07 Oct 2026" — fixed month names (en-GB would print "Sept"). */
  fmtDate(v: string | null | undefined): string {
    const d = v ? new Date(v) : null;
    if (!d || isNaN(d.getTime())) { return ''; }
    return String(d.getDate()).padStart(2, '0') + ' ' + LeaveRecordsComponent.MON[d.getMonth()] + ' ' + d.getFullYear();
  }
  fmtTime(v: string | null | undefined): string {
    const d = v ? new Date(v) : null;
    if (!d || isNaN(d.getTime())) { return ''; }
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
    return (h % 12 || 12) + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  stageText(r: LeaveRow): string {
    const s = (r.stageName || '').toUpperCase();
    return s.includes('HANDOVER') ? 'Handover' : s.includes('HOD') ? 'HOD' : this.tc(r.stageName);
  }
  progressPct(r: LeaveRow): number {
    return r.totalSteps ? Math.round(((r.approvedSteps || 0) / r.totalSteps) * 100) : 0;
  }
  tc(v: unknown): string {
    const s = (v ?? '').toString().trim();
    if (!s) { return ''; }
    return s.toLowerCase().replace(/(^|[\s&(/-])(\p{L})/gu, (_m: string, p: string, c: string) => p + c.toUpperCase())
      .replace(/\b(It|Hr|Hod|Ced|Qa|Qc|Qs|Qaqc|Mep|Pmc|Pmv|Mis|Dpr|Cad|Ai)\b/g, (w: string) => w.toUpperCase());
  }
  initialsOf(name: unknown): string {
    const w = (name ?? '').toString().trim().split(/\s+/).filter(Boolean);
    return ((w[0]?.[0] || '?') + (w.length > 1 ? w[1][0] : '')).toUpperCase();
  }
  avatarColor(name: unknown): string {
    const palette = ['#0f6b50', '#1d4ed8', '#7c3aed', '#b45309', '#be123c', '#0e7490'];
    const n = (name ?? '').toString();
    let h = 0; for (let i = 0; i < n.length; i++) { h = (h * 31 + n.charCodeAt(i)) >>> 0; }
    return palette[h % palette.length];
  }
  trackRow = (_: number, r: LeaveRow) => r.leaveId + ':' + (r.approvalId ?? '');
}
