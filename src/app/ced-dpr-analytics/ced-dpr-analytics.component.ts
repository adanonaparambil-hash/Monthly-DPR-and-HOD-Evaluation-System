import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api } from '../services/api';

// ── API response shapes (SP_GET_CED_DPR_DASHBOARD cursors) ───────────────────
interface CedSummary {
  totalEmployees:    number;
  loggedEmployees:   number;
  notLoggedEmployees: number;
  adoptionPct:       number;
  hoursLogged:       number;
  hoursLoggedDisplay?: string;   // exact "Nh MMm" from raw minutes (SP)
  expectedHours:     number;
  workingDays:       number;
  fromDate:          string;
  toDate:            string;
}

interface CedDept {
  departmentId:   number;
  departmentName: string;
  headcount:      number;
  loggedCount:    number;
  missingCount:   number;
  loggedHrs:      number;
  loggedHrsDisplay?: string;     // exact "Nh MMm" from raw minutes (SP)
  expectedHrs:    number;
  compliancePct:  number;
  rank?:          number;
}

interface CedDaily {
  logDate:         string;
  dayName:         string;
  loggedEmployees: number;
  hoursLogged:     number;
  hoursLoggedDisplay?: string;   // exact "Nh MMm" from raw minutes (SP)
  expectedHours:   number;
  adoptionPct:     number;
}

interface CedHeatCell {
  departmentId:   number;
  departmentName: string;
  logDate:        string;
  loggedHrs:      number;
  expectedHrs:    number;
  compliancePct:  number;
}

interface CedEmployee {
  employeeId:       string;
  employeeName:     string;
  designation:      string;
  empCategory:      string;
  location:         string;
  departmentId:     number;
  departmentName:   string;
  dailyExpectedHrs: number;
  expectedHrs:      number;
  loggedHrs:        number;
  loggedHrsDisplay?: string;    // exact "Nh MMm" from raw minutes (SP)
  loggedDays:       number;
  workingDays:      number;
  loggedInRange:    string;   // 'Y' / 'N'
  compliancePct:    number;
  lastLogDate:      string | null;
  daysSinceLastLog: number;   // -1 = never used DPR
  loggedDays30?:    number;   // logged days in trailing 30 days (filter-independent)
  workingDays30?:   number;
  consistencyPct?:  number;   // loggedDays30 / workingDays30
  deptRank?:        number;   // compliance rank within department (from SQL ROW_NUMBER)
}

interface HeatRow {
  name: string;
  cells: ({ pct: number; log: number; exp: number; date: string } | null)[];
}

@Component({
  selector: 'app-ced-dpr-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ced-dpr-analytics.component.html',
  styleUrls: ['./ced-dpr-analytics.component.css']
})
export class CedDprAnalyticsComponent implements OnInit, OnDestroy {
  Math = Math;

  // ── filters ───────────────────────────────────────────────────────────────
  fromDate = '';
  toDate   = '';
  activePreset = '30d';   // default view = last 30 days

  // ── state ─────────────────────────────────────────────────────────────────
  loading = false;
  loaded  = false;   // becomes true after first successful load — drives entrance animations
  errorMsg = '';
  dateError = '';   // date-range validation message (max 1 month)
  exportingAll = false;

  summary: CedSummary | null = null;
  depts:     CedDept[]     = [];
  daily:     CedDaily[]    = [];
  employees: CedEmployee[] = [];

  heatDates: string[] = [];
  heatRows:  HeatRow[] = [];

  // department performance filter + per-dept mini sparkline (from heatmap data)
  deptFilter: 'all' | 'high' | 'avg' | 'low' = 'all';
  deptSpark: Record<string, string> = {};

  // ── display mode (big-screen kiosk: fullscreen + section slider) ──────────
  displayMode = false;
  autoPlay = true;
  activeSlide = 0;
  slideLabels: string[] = [];
  @ViewChild('deck') deckRef?: ElementRef<HTMLDivElement>;
  private rotateTimer: ReturnType<typeof setInterval> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private scrollDebounce: ReturnType<typeof setTimeout> | null = null;
  /** rotate interval — how long each section stays on screen */
  private readonly ROTATE_MS = 25000;
  /** silent data refresh interval while in display mode */
  private readonly LIVE_REFRESH_MS = 5 * 60 * 1000;
  private fsHandler = () => {
    if (!document.fullscreenElement && this.displayMode) this.exitDisplay(false);
  };

  topLoggers:     CedEmployee[] = [];
  mostConsistent: CedEmployee[] = [];

  insightChips: { text: string; dot: string }[] = [];

  // animated KPI display values (count-up)
  kpi: { [k: string]: number } = {
    totalEmployees: 0, loggedEmployees: 0, notLoggedEmployees: 0,
    adoptionPct: 0, hoursLogged: 0, expectedHours: 0
  };
  private kpiRaf = 0;
  private reduceMotion = false;

  // Not Using DPR section
  missingSearch = '';
  missingDept   = '';
  missingPage   = 0;
  readonly MISSING_PER_PAGE = 8;

  // dept drill modal
  drillDept: CedDept | null = null;
  drillSearch = '';
  drillPage   = 0;
  readonly DRILL_PER_PAGE = 8;

  // SVG compliance ring geometry (r = 26)
  readonly RING_CIRC = 2 * Math.PI * 26;

  // SVG adoption donut geometry (r = 54)
  readonly DONUT_CIRC = 2 * Math.PI * 54;

  // SVG daily-trend area chart
  readonly TREND_W = 640;
  readonly TREND_H = 150;
  trendPath: { line: string; fill: string } | null = null;
  trendPts: { x: number; y: number; d: CedDaily }[] = [];

  private readonly AVATAR_COLORS = ['#6366f1','#3b82f6','#10b981','#8b5cf6','#0ea5e9','#f59e0b','#14b8a6','#ec4899'];

  constructor(private api: Api) {}

  ngOnInit(): void {
    this.reduceMotion = typeof window !== 'undefined'
      && !!window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.setPreset('30d');
  }

  // ── date helpers / presets ───────────────────────────────────────────────
  private fmtDate(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  setPreset(p: string): void {
    this.activePreset = p;
    const today = new Date();
    if (p === 'today') {
      this.fromDate = this.fmtDate(today);
      this.toDate = this.fromDate;
    } else if (p === 'yesterday') {
      const y = new Date(today.getTime() - 86400000);
      this.fromDate = this.fmtDate(y);
      this.toDate = this.fromDate;
    } else if (p === '7d') {
      this.fromDate = this.fmtDate(new Date(today.getTime() - 6 * 86400000));
      this.toDate = this.fmtDate(today);
    } else if (p === '30d') {
      this.fromDate = this.fmtDate(new Date(today.getTime() - 29 * 86400000));
      this.toDate = this.fmtDate(today);
    }
    this.load();
  }

  onDateChange(): void {
    this.activePreset = '';
    this.validateRange();   // live feedback while picking dates
  }

  /** Max range = 1 month. Sets dateError and returns false when invalid. */
  private validateRange(): boolean {
    this.dateError = '';
    if (!this.fromDate) return false;

    const from = new Date(this.fromDate);
    const to = new Date(this.toDate || this.fromDate);

    if (to < from) {
      this.dateError = '"To" date cannot be before "From" date.';
      return false;
    }

    const max = new Date(from);
    max.setMonth(max.getMonth() + 1);
    if (to > max) {
      this.dateError = 'You can view a maximum of 1 month of data at a time. Please select a shorter period.';
      return false;
    }
    return true;
  }

  // ── data load ─────────────────────────────────────────────────────────────
  /** silent=true refreshes data without flashing the skeleton (display mode) */
  load(silent = false): void {
    if (!this.fromDate) return;
    if (!this.validateRange()) return;
    if (!silent) {
      this.loading = true;
      this.loaded = false;
    }
    this.errorMsg = '';

    const req = { fromDate: this.fromDate, toDate: this.toDate || this.fromDate };

    this.api.getCedDprDashboard(req).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res?.Data ?? {};

        this.summary   = this.norm(data.summary ?? data.Summary) as CedSummary | null;
        this.depts     = (data.departments ?? data.Departments ?? []).map((r: any) => this.norm(r)) as CedDept[];
        this.daily     = (data.daily ?? data.Daily ?? []).map((r: any) => this.norm(r)) as CedDaily[];
        this.employees = (data.employees ?? data.Employees ?? []).map((r: any) => this.norm(r)) as CedEmployee[];

        // rank departments (cursor is already compliance desc)
        this.depts.forEach((d, i) => d.rank = i + 1);

        this.buildHeatmap((data.heatmap ?? data.Heatmap ?? []).map((r: any) => this.norm(r)) as CedHeatCell[]);
        this.buildTrendPath();
        this.buildSpotlight();
        this.buildInsights();
        this.animateKpis();

        this.missingPage = 0;
        this.loading = false;
        this.loaded = true;

        // display mode: section set may have changed → rebuild slide nav
        if (this.displayMode) {
          setTimeout(() => {
            this.collectSlides();
            const last = Math.max(0, this.slideLabels.length - 1);
            this.goTo(Math.min(this.activeSlide, last), false, 'auto');
          });
        }
      },
      error: (err) => {
        console.error('GetCedDprDashboard failed:', err);
        this.errorMsg = 'Failed to load dashboard data. Please try again.';
        this.summary = null;
        this.depts = []; this.daily = []; this.employees = [];
        this.heatRows = []; this.heatDates = [];
        this.topLoggers = []; this.mostConsistent = [];
        this.insightChips = [];
        this.loading = false;
      }
    });
  }

  /** Serializer sends camelCase; be tolerant of PascalCase too */
  private norm(obj: any): any {
    if (!obj) return obj;
    const out: any = {};
    for (const k of Object.keys(obj)) {
      out[k.charAt(0).toLowerCase() + k.slice(1)] = obj[k];
    }
    return out;
  }

  /** Count-up animation for KPI numbers (skipped when reduced motion is preferred) */
  private animateKpis(): void {
    cancelAnimationFrame(this.kpiRaf);
    const s = this.summary;
    if (!s) return;

    const targets: { [k: string]: number } = {
      totalEmployees:     s.totalEmployees     ?? 0,
      loggedEmployees:    s.loggedEmployees    ?? 0,
      notLoggedEmployees: s.notLoggedEmployees ?? 0,
      adoptionPct:        s.adoptionPct        ?? 0,
      hoursLogged:        s.hoursLogged        ?? 0,
      expectedHours:      s.expectedHours      ?? 0
    };

    if (this.reduceMotion) {
      this.kpi = { ...targets };
      return;
    }

    const DURATION = 900;
    const start = performance.now();
    const from: { [k: string]: number } = {};
    Object.keys(targets).forEach(k => from[k] = 0);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const ease = 1 - Math.pow(1 - t, 3);   // easeOutCubic
      for (const k of Object.keys(targets)) {
        this.kpi[k] = from[k] + (targets[k] - from[k]) * ease;
      }
      if (t < 1) this.kpiRaf = requestAnimationFrame(tick);
    };
    this.kpiRaf = requestAnimationFrame(tick);
  }

  private buildHeatmap(cells: CedHeatCell[]): void {
    const dates = [...new Set(cells.map(c => c.logDate))].sort();
    this.heatDates = dates;
    const byDept = new Map<string, Map<string, CedHeatCell>>();
    for (const c of cells) {
      if (!byDept.has(c.departmentName)) byDept.set(c.departmentName, new Map());
      byDept.get(c.departmentName)!.set(c.logDate, c);
    }
    this.heatRows = [...byDept.entries()].map(([name, m]) => ({
      name,
      cells: dates.map(dt => {
        const c = m.get(dt);
        return c ? { pct: c.compliancePct ?? 0, log: c.loggedHrs ?? 0, exp: c.expectedHrs ?? 0, date: dt } : null;
      })
    })).sort((a, b) => a.name.localeCompare(b.name));

    // mini sparkline per department (daily compliance) for the dept cards
    this.deptSpark = {};
    const w = 64, h = 20, pad = 2.5;
    for (const row of this.heatRows) {
      const vals = row.cells.map(c => c?.pct ?? 0);
      if (!vals.length) continue;
      const mx = Math.max(100, ...vals);
      const pts = vals.length === 1
        ? [[pad, h - pad - (vals[0] / mx) * (h - pad * 2)],
           [w - pad, h - pad - (vals[0] / mx) * (h - pad * 2)]]
        : vals.map((v, i) => [
            pad + (i / (vals.length - 1)) * (w - pad * 2),
            h - pad - (v / mx) * (h - pad * 2)
          ]);
      this.deptSpark[row.name] = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    }
  }

  /** Smooth cubic-bezier area path for the daily adoption trend (SVG).
   *  Single-day ranges render as a flat line with one centered point. */
  private buildTrendPath(): void {
    this.trendPath = null;
    this.trendPts = [];
    if (this.daily.length === 0) return;

    const w = this.TREND_W, h = this.TREND_H, pad = 10;
    const vals = this.daily.map(d => d.adoptionPct ?? 0);
    const mx = Math.max(100, ...vals);

    if (this.daily.length === 1) {
      const y = h - pad - (vals[0] / (mx || 1)) * (h - pad * 2);
      this.trendPath = {
        line: `M${pad} ${y.toFixed(1)} L${(w - pad).toFixed(1)} ${y.toFixed(1)}`,
        fill: `M${pad} ${y.toFixed(1)} L${(w - pad).toFixed(1)} ${y.toFixed(1)} L${(w - pad).toFixed(1)} ${h} L${pad} ${h} Z`
      };
      this.trendPts = [{ x: w / 2, y, d: this.daily[0] }];
      return;
    }

    const pts = vals.map((v, i) => ({
      x: pad + (i / (vals.length - 1)) * (w - pad * 2),
      y: h - pad - (v / (mx || 1)) * (h - pad * 2),
      d: this.daily[i]
    }));

    let p = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const px = pts[i - 1].x, py = pts[i - 1].y;
      const x = pts[i].x, y = pts[i].y;
      const cx = (px + x) / 2;
      p += ` C${cx.toFixed(1)} ${py.toFixed(1)} ${cx.toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }

    this.trendPath = {
      line: p,
      fill: `${p} L${(w - pad).toFixed(1)} ${h} L${pad} ${h} Z`
    };
    this.trendPts = pts;
  }

  /** stroke-dasharray for the adoption donut (r = 54) */
  donutDash(pct: number | null | undefined): string {
    const v = Math.max(0, Math.min(100, pct ?? 0));
    return `${(v / 100) * this.DONUT_CIRC} ${this.DONUT_CIRC}`;
  }

  private buildSpotlight(): void {
    const active = this.employees.filter(e => e.loggedInRange === 'Y');
    this.topLoggers = [...active].sort((a, b) => (b.loggedHrs ?? 0) - (a.loggedHrs ?? 0)).slice(0, 5);
    // Consistency is filter-independent: trailing 30-day logging regularity
    // (falls back to range compliance if the SP doesn't return it yet)
    this.mostConsistent = [...active]
      .sort((a, b) => this.consVal(b) - this.consVal(a))
      .slice(0, 5);
  }

  /** 30-day consistency value with fallback to range compliance */
  consVal(e: CedEmployee): number {
    return e.consistencyPct ?? e.compliancePct ?? 0;
  }

  private buildInsights(): void {
    this.insightChips = [];
    if (!this.summary) return;
    const s = this.summary;
    if (this.depts.length) {
      const best = this.depts[0];
      const worst = this.depts[this.depts.length - 1];
      this.insightChips.push({ text: `${best.departmentName} is the best department (${best.compliancePct}%)`, dot: '#10b981' });
      if (worst.departmentName !== best.departmentName) {
        this.insightChips.push({ text: `${worst.departmentName} has the lowest compliance (${worst.compliancePct}%)`, dot: '#f43f5e' });
      }
    }
    this.insightChips.push({ text: `${s.notLoggedEmployees} employees have not logged in this period`, dot: '#f43f5e' });
    if (s.loggedEmployees > 0) {
      this.insightChips.push({ text: `Average logged ${this.hm(s.hoursLogged / s.loggedEmployees)} per active user`, dot: '#6366f1' });
    }
    if (s.totalEmployees > 0) {
      this.insightChips.push({ text: `Expected average ${this.hm(s.expectedHours / s.totalEmployees)} per employee`, dot: '#3b82f6' });
    }
    this.insightChips.push({ text: `${s.workingDays} working day(s) in the selected period`, dot: '#0ea5e9' });
  }

  private hm(v: number): string {
    if (!v || v < 0) return '0h 0m';
    return Math.floor(v) + 'h ' + Math.round((v % 1) * 60) + 'm';
  }

  // ── display helpers ───────────────────────────────────────────────────────
  fmt(n: number | null | undefined): string {
    return Math.round(n ?? 0).toLocaleString('en-US');
  }

  fmt1(n: number | null | undefined): string {
    return (Math.round((n ?? 0) * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
  }

  compColor(c: number | null | undefined): string {
    const v = c ?? 0;
    return v >= 90 ? '#10b981' : v >= 70 ? '#f59e0b' : '#f43f5e';
  }

  /** Performance tier — same thresholds as compColor */
  deptTier(c: number | null | undefined): 'high' | 'avg' | 'low' {
    const v = c ?? 0;
    return v >= 90 ? 'high' : v >= 70 ? 'avg' : 'low';
  }

  get deptCounts(): { high: number; avg: number; low: number } {
    let high = 0, avg = 0, low = 0;
    for (const d of this.depts) {
      const t = this.deptTier(d.compliancePct);
      if (t === 'high') high++; else if (t === 'avg') avg++; else low++;
    }
    return { high, avg, low };
  }

  get filteredDepts(): CedDept[] {
    if (this.deptFilter === 'all') return this.depts;
    return this.depts.filter(d => this.deptTier(d.compliancePct) === this.deptFilter);
  }

  /** stroke-dasharray for the dept compliance ring */
  ringDash(pct: number | null | undefined): string {
    const v = Math.max(0, Math.min(100, pct ?? 0));
    return `${(v / 100) * this.RING_CIRC} ${this.RING_CIRC}`;
  }

  heatBg(pct: number): string {
    const v = Math.max(0, Math.min(100, pct));
    if (v >= 90) return 'rgba(16,185,129,' + (0.28 + v / 250) + ')';
    if (v >= 70) return 'rgba(245,158,11,' + (0.28 + v / 300) + ')';
    return 'rgba(244,63,94,' + (0.22 + (100 - v) / 250) + ')';
  }

  initials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  avatarBg(name: string): string {
    let h = 0;
    for (const ch of (name || '')) h = (h * 31 + ch.charCodeAt(0)) & 0xffffffff;
    const a = this.AVATAR_COLORS[Math.abs(h) % this.AVATAR_COLORS.length];
    const b = this.AVATAR_COLORS[Math.abs(h * 7) % this.AVATAR_COLORS.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
  }

  medal(i: number): string {
    return i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'transparent';
  }

  badge(e: CedEmployee): { t: string; bg: string; c: string } {
    if (e.daysSinceLastLog === -1)                          return { t: 'NEVER USED', bg: 'rgba(100,116,139,0.12)', c: '#64748b' };
    if (e.loggedInRange !== 'Y' && e.daysSinceLastLog >= 7) return { t: 'CRITICAL',   bg: 'rgba(244,63,94,0.12)',  c: '#e11d48' };
    if (e.loggedInRange !== 'Y' && e.daysSinceLastLog >= 3) return { t: 'AT RISK',    bg: 'rgba(245,158,11,0.14)', c: '#d97706' };
    if (e.loggedInRange !== 'Y')                            return { t: 'MISSING',    bg: 'rgba(244,63,94,0.10)',  c: '#f43f5e' };
    return { t: 'ACTIVE', bg: 'rgba(16,185,129,0.12)', c: '#059669' };
  }

  lastLogLabel(e: CedEmployee): string {
    if (e.daysSinceLastLog === -1) return 'Never';
    if (e.daysSinceLastLog === 0)  return 'Today';
    if (e.daysSinceLastLog === 1)  return 'Yesterday';
    return e.daysSinceLastLog + ' days ago';
  }

  heatDateLabel(dt: string): string {
    const d = new Date(dt + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  // ── Not Using DPR section ────────────────────────────────────────────────
  get missingPool(): CedEmployee[] {
    const q = this.missingSearch.trim().toLowerCase();
    return this.employees.filter(e =>
      e.loggedInRange !== 'Y' &&
      (!this.missingDept || e.departmentName === this.missingDept) &&
      (!q ||
        (e.employeeName || '').toLowerCase().includes(q) ||
        (e.employeeId || '').toLowerCase().includes(q) ||
        (e.designation || '').toLowerCase().includes(q)));
  }

  get missingPages(): number {
    return Math.max(1, Math.ceil(this.missingPool.length / this.MISSING_PER_PAGE));
  }

  get missingRows(): CedEmployee[] {
    const page = Math.min(this.missingPage, this.missingPages - 1);
    return this.missingPool.slice(page * this.MISSING_PER_PAGE, (page + 1) * this.MISSING_PER_PAGE);
  }

  get missingDeptNames(): string[] {
    return [...new Set(this.employees.filter(e => e.loggedInRange !== 'Y').map(e => e.departmentName))].sort();
  }

  missingPrev(): void { if (this.missingPage > 0) this.missingPage--; }
  missingNext(): void { if (this.missingPage < this.missingPages - 1) this.missingPage++; }
  onMissingFilter(): void { this.missingPage = 0; }

  // ── dept drill modal ─────────────────────────────────────────────────────
  openDrill(d: CedDept): void {
    this.drillDept = d;
    this.drillSearch = '';
    this.drillPage = 0;
  }

  closeDrill(): void { this.drillDept = null; }

  get drillPool(): CedEmployee[] {
    if (!this.drillDept) return [];
    const q = this.drillSearch.trim().toLowerCase();
    return this.employees
      .filter(e =>
        e.departmentId === this.drillDept!.departmentId &&
        (!q ||
          (e.employeeName || '').toLowerCase().includes(q) ||
          (e.employeeId || '').toLowerCase().includes(q) ||
          (e.designation || '').toLowerCase().includes(q)))
      // authoritative order comes from the SP (DeptRank via ROW_NUMBER);
      // compliance sort is only the fallback until the SP returns it
      .sort((a, b) =>
        (a.deptRank ?? Number.MAX_SAFE_INTEGER) - (b.deptRank ?? Number.MAX_SAFE_INTEGER) ||
        (b.compliancePct ?? 0) - (a.compliancePct ?? 0) ||
        (b.loggedHrs ?? 0) - (a.loggedHrs ?? 0));
  }

  /** Rank shown in the drill table: SQL DeptRank if present, else position in the sorted pool */
  drillRankOf(u: CedEmployee, indexOnPage: number): number {
    return u.deptRank ?? (this.drillPage * this.DRILL_PER_PAGE + indexOnPage + 1);
  }

  get drillPages(): number {
    return Math.max(1, Math.ceil(this.drillPool.length / this.DRILL_PER_PAGE));
  }

  get drillRows(): CedEmployee[] {
    const page = Math.min(this.drillPage, this.drillPages - 1);
    return this.drillPool.slice(page * this.DRILL_PER_PAGE, (page + 1) * this.DRILL_PER_PAGE);
  }

  drillPrev(): void { if (this.drillPage > 0) this.drillPage--; }
  drillNext(): void { if (this.drillPage < this.drillPages - 1) this.drillPage++; }

  // ── display mode (big-screen kiosk) ───────────────────────────────────────

  enterDisplay(): void {
    if (this.displayMode) return;
    this.displayMode = true;
    this.activeSlide = 0;
    document.body.classList.add('ca-kiosk');
    document.addEventListener('fullscreenchange', this.fsHandler);
    document.documentElement.requestFullscreen?.().catch(() => { /* fullscreen optional */ });
    setTimeout(() => {
      this.collectSlides();
      this.goTo(0, false, 'auto');
    });
    this.startRotate();
    this.refreshTimer = setInterval(() => this.load(true), this.LIVE_REFRESH_MS);
  }

  exitDisplay(leaveFullscreen = true): void {
    if (!this.displayMode) return;
    this.displayMode = false;
    this.activeSlide = 0;
    document.body.classList.remove('ca-kiosk');
    document.removeEventListener('fullscreenchange', this.fsHandler);
    if (leaveFullscreen && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    this.stopRotate();
    if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
  }

  /** Read visible sections from the deck — labels come from data-slide attrs */
  private collectSlides(): void {
    const deck = this.deckRef?.nativeElement;
    this.slideLabels = deck
      ? Array.from(deck.children)
          .map(c => (c as HTMLElement).dataset['slide'] || '')
          .filter(Boolean)
      : [];
  }

  goTo(i: number, user = true, behavior?: ScrollBehavior): void {
    const deck = this.deckRef?.nativeElement;
    if (!deck || !this.slideLabels.length) return;
    this.activeSlide = Math.max(0, Math.min(i, this.slideLabels.length - 1));
    deck.scrollTo({
      left: this.activeSlide * deck.clientWidth,
      behavior: behavior ?? (this.reduceMotion ? 'auto' : 'smooth')
    });
    if (user) this.startRotate();   // manual nav resets the rotation clock
  }

  advance(dir: number, user = true): void {
    const n = this.slideLabels.length;
    if (!n) return;
    this.goTo((this.activeSlide + dir + n) % n, user);
  }

  toggleAutoPlay(): void {
    this.autoPlay = !this.autoPlay;
    this.startRotate();
  }

  private startRotate(): void {
    this.stopRotate();
    if (!this.autoPlay || !this.displayMode) return;
    this.rotateTimer = setInterval(() => this.advance(1, false), this.ROTATE_MS);
  }

  private stopRotate(): void {
    if (this.rotateTimer) { clearInterval(this.rotateTimer); this.rotateTimer = null; }
  }

  /** Keep the active chip in sync when the user swipes/scrolls the deck */
  onDeckScroll(): void {
    if (!this.displayMode) return;
    if (this.scrollDebounce) clearTimeout(this.scrollDebounce);
    this.scrollDebounce = setTimeout(() => {
      const deck = this.deckRef?.nativeElement;
      if (deck && deck.clientWidth > 0) {
        this.activeSlide = Math.round(deck.scrollLeft / deck.clientWidth);
      }
    }, 120);
  }

  @HostListener('document:keydown', ['$event'])
  onDisplayKeys(e: KeyboardEvent): void {
    if (!this.displayMode) return;
    if (e.key === 'ArrowRight') this.advance(1);
    else if (e.key === 'ArrowLeft') this.advance(-1);
    else if (e.key === 'Escape' && !document.fullscreenElement) this.exitDisplay(false);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.displayMode) this.goTo(this.activeSlide, false, 'auto');
  }

  ngOnDestroy(): void {
    this.exitDisplay();
    if (this.scrollDebounce) clearTimeout(this.scrollDebounce);
  }

  // ── export ────────────────────────────────────────────────────────────────

  /** Full dashboard export — one Excel workbook, each dataset on its own sheet
   *  (Summary / Departments / Daily Trend / Heatmap / Employees), built by the API. */
  exportAll(): void {
    if (!this.fromDate || this.exportingAll) return;
    if (!this.validateRange()) return;
    this.exportingAll = true;

    const from = this.fromDate;
    const to = this.toDate || this.fromDate;

    this.api.exportCedDprDashboard({ fromDate: from, toDate: to }).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = from === to
          ? `CED_DPR_Dashboard_${from}.xlsx`
          : `CED_DPR_Dashboard_${from}_to_${to}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.exportingAll = false;
      },
      error: (err) => {
        console.error('ExportCedDprDashboard failed:', err);
        this.exportingAll = false;
      }
    });
  }

  exportMissing(): void {
    const cols = ['Department', 'Employee ID', 'Employee Name', 'Designation', 'Status', 'Last Log', 'Compliance %'];
    const escape = (v: any): string => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = this.missingPool.map(e => [
      escape(e.departmentName), escape(e.employeeId), escape(e.employeeName),
      escape(e.designation), escape(this.badge(e).t), escape(this.lastLogLabel(e)),
      escape(e.compliancePct)
    ].join(','));
    const csv  = [cols.map(escape).join(','), ...rows].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `dpr-not-using-${this.fromDate}${this.toDate !== this.fromDate ? '_to_' + this.toDate : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
