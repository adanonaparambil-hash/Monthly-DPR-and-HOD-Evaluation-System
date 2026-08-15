import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api } from '../services/api';
import { CraneLoaderComponent } from '../shared/crane-loader/crane-loader.component';

interface LunchRow {
  employeeId:        string;
  employeeName:      string;
  designation:       string;
  department:        string;
  departmentId:      number | null;
  location:          string;
  monitorDate:       string;
  windowStart:       string;
  windowEnd:         string;
  localTime:         string;
  inWindowNow:       string;
  workMinutes:       number;
  breakMinutes:      number;
  breakReason:       string | null;
  breakRemarks:      string | null;
  isTimerRunningNow: string;
  runningTask:       string | null;
  runningSince:      string | null;
  isOnBreakNow:      string;
  breakReasonNow:    string | null;
  lastPunchTime:     string | null;
  punchCount:        number;
  punchTimes:        string | null;
  status:            string;
  profileImageBase64: string | null;
}

interface LunchSummary {
  location:       string;
  windowStart:    string;
  windowEnd:      string;
  inWindowNow:    string;
  totalEmployees: number;
  workedInLunch:  number;
  onBreak:        number;
  idle:           number;
}

@Component({
  selector: 'app-lunch-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule, CraneLoaderComponent],
  templateUrl: './lunch-monitor.component.html',
  styleUrls: ['./lunch-monitor.component.css']
})
export class LunchMonitorComponent implements OnInit, OnDestroy {

  rows:    LunchRow[]     = [];
  summary: LunchSummary[] = [];

  loading   = false;
  loadError = '';

  // Filters
  selectedDate       = '';     // yyyy-MM-dd; empty = live (today)
  selectedDepartment = 0;
  selectedLocation   = '';     // '' = all, or IND / OM
  selectedStatus     = '';     // '' = all
  selectedDpr        = 'Y';    // 'Y' = DPR users (default), 'N' = non-DPR, '' = all
  searchText         = '';

  departments: any[] = [];

  readonly locations = [
    { code: '',    label: 'All Locations' },
    { code: 'OM',  label: 'Oman (1:00 – 2:00 PM)' },
    { code: 'IND', label: 'India (1:00 – 1:30 PM)' }
  ];

  readonly statuses = [
    { code: '',                label: 'All Statuses' },
    { code: 'WORKED IN LUNCH', label: 'Worked in lunch' },
    { code: 'ON BREAK',        label: 'On break' },
    { code: 'IDLE',            label: 'Idle' }
  ];

  readonly dprOptions = [
    { code: 'Y', label: 'DPR Users' },
    { code: 'N', label: 'Non-DPR Users' },
    { code: '',  label: 'All Users' }
  ];

  lastRefreshed: Date | null = null;
  private refreshTimer: any = null;

  constructor(private api: Api) {}

  ngOnInit(): void {
    this.loadDepartments();
    this.loadData();
    // Live view auto-refreshes every 5 minutes (only when no historical date picked)
    this.refreshTimer = setInterval(() => {
      if (!this.selectedDate && !this.loading) this.loadData(true);
    }, 5 * 60 * 1000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  get isLive(): boolean {
    return !this.selectedDate;
  }

  loadDepartments(): void {
    // Same source as the break-history screen: DailyTimeSheet/GetDepartmentList
    this.api.getDepartmentList().subscribe({
      next: (res: any) => {
        const data: any[] = res?.data ?? [];
        this.departments = data.filter((d: any) => (d.status ?? 'Y') === 'Y');
      },
      error: () => { this.departments = []; }
    });
  }

  loadData(silent = false): void {
    if (!silent) this.loading = true;
    this.loadError = '';

    const request = {
      date:          this.selectedDate || null,
      departmentId:  this.selectedDepartment ? Number(this.selectedDepartment) : 0,
      comLoc:        this.selectedLocation || null,
      status:        this.selectedStatus || null,
      isDpr:         this.selectedDpr || null,
      minOverlapMin: 5
    };

    this.api.getLunchMonitor(request).subscribe({
      next: (res: any) => {
        this.rows    = res?.data?.rows ?? [];
        this.summary = res?.data?.summary ?? [];
        this.lastRefreshed = new Date();
        this.loading = false;
      },
      error: (err) => {
        this.rows = [];
        this.summary = [];
        this.loading = false;
        this.loadError = err?.error?.message || err?.message || 'Failed to load lunch monitor';
      }
    });
  }

  clearDate(): void {
    this.selectedDate = '';
    this.loadData();
  }

  get filteredRows(): LunchRow[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.rows;
    return this.rows.filter(r =>
      (r.employeeName || '').toLowerCase().includes(q) ||
      (r.employeeId   || '').toLowerCase().includes(q) ||
      (r.department   || '').toLowerCase().includes(q) ||
      (r.designation  || '').toLowerCase().includes(q) ||
      (r.runningTask  || '').toLowerCase().includes(q)
    );
  }

  statusClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'WORKED IN LUNCH': return 'pill-red';
      case 'ON BREAK':        return 'pill-green';
      default:                return 'pill-gray';
    }
  }

  statusLabel(row: LunchRow): string {
    if (row.status === 'WORKED IN LUNCH') return 'Worked in lunch';
    if (row.status === 'ON BREAK')        return 'On break';
    return 'Idle';
  }

  formatMin(min: number): string {
    if (!min || min <= 0) return '—';
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  initials(name: string): string {
    return (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0])
      .join('')
      .toUpperCase();
  }

  trackRow(_: number, r: LunchRow): string {
    return r.employeeId;
  }

  // ── CSV export of the current filtered view ────────────────────────────
  exportCSV(): void {
    const cols = [
      ['Employee ID',   (r: LunchRow) => r.employeeId],
      ['Employee Name', (r: LunchRow) => r.employeeName],
      ['Department',    (r: LunchRow) => r.department],
      ['Designation',   (r: LunchRow) => r.designation],
      ['Location',      (r: LunchRow) => r.location],
      ['Date',          (r: LunchRow) => r.monitorDate],
      ['Lunch Window',  (r: LunchRow) => `${r.windowStart} - ${r.windowEnd}`],
      ['Status',        (r: LunchRow) => this.statusLabel(r)],
      ['Worked (min)',  (r: LunchRow) => String(r.workMinutes ?? 0)],
      ['Break (min)',   (r: LunchRow) => String(r.breakMinutes ?? 0)],
      ['Break Reason',  (r: LunchRow) => r.breakReason ?? ''],
      ['Last Punch',    (r: LunchRow) => r.lastPunchTime ?? ''],
      ['Punch Times',   (r: LunchRow) => r.punchTimes ?? ''],
      ['Running Task',  (r: LunchRow) => r.runningTask ?? '']
    ] as const;

    const escape = (v: string) =>
      /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

    const header = cols.map(c => escape(c[0])).join(',');
    const lines  = this.filteredRows.map(r => cols.map(c => escape(c[1](r) || '')).join(','));
    const csv    = [header, ...lines].join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `lunch-monitor-${this.selectedDate || new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
