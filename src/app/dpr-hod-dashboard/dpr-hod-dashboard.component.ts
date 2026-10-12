import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Api } from '../services/api';
import { AiReportComponent } from '../components/ai-report/ai-report.component';
import { NewJoinersCardComponent } from '../components/new-joiners-card/new-joiners-card.component';
import { bindTooltip, countUpAll, escHtml, fmtNum, setupReveal } from '../utils/dash-fx';
import {
  DprHodAttendanceRow, DprHodDept, DprHodException, DprHodFormQueueItem,
  DprHodHeatmapCell, DprHodLeaderboardRow, DprHodLogQueueItem, DprHodNotDone,
  DprHodSummary, DprHodTeamMember, DprHodTrendDay
} from '../models/dprDashboard.model';

// ── view models ─────────────────────────────────────────────────────────────
// Every list the template loops over is a plain field, rebuilt once per load.

interface DeptPill { label: string; dept: string | null; count: number; logged: number; }
interface Decision { a: string; small: string; why: string; color: string; }
interface KpiTile { label: string; color: string; icon: string; pillCls: string; pillTxt: string; value: number; dec: number; unit: string; barPct: number; foot: string; }
interface TrendEnd { cx: number; cy: number; label: string; }
interface TrendX { x: number; label: string; }
interface HourBar { h: number; label: string; tip: string; today: boolean; off: boolean; }
interface FormRow { ini: string; color: string; name: string; sub: string; stage: string; ageCls: string; ageTxt: string; }
interface LogRow { ini: string; color: string; name: string; sub: string; count: number; hours: string; }
interface Member {
  id: string; ini: string; img: string | null; color: string; name: string; role: string;
  pillCls: string; pillTxt: string; today: string; exp: string; pct: number; ringOff: number;
  task: string; in: string; out: string; mon: string; monBad: boolean; delay: string;
}
interface AttRow {
  name: string; in: string; out: string; office: string; dpr: string; dprBad: boolean;
  gap: string; gapCls: string; punches: number; spanW: number; workW: number; brkW: number; gapW: number; tip: string; sortKey: number;
}
interface PersonRow { ini: string; color: string; name: string; sub: string; ageCls: string; ageTxt: string; }
interface HeatDay { label: string; name: string; }
interface HeatCell { cls: string; label: string; tip: string; }
interface HeatRow { name: string; cells: HeatCell[]; }
interface StackSeg { w: number; c: string; }
interface LeadRow { rank: number; rkCls: string; ini: string; color: string; name: string; sub: string; segs: StackSeg[]; comp: string; hours: string; tip: string; }
interface RemarkSeg { w: number; c: string; label: string; n: number; }
interface BreakRow { ini: string; color: string; name: string; sub: string; mins: string; }
interface LeaveRow { ini: string; color: string; name: string; sub: string; type: string; chipCls: string; chipTxt: string; tip: string; order: number; }

const A = { emerald: 'var(--a1)', indigo: 'var(--a2)', amber: 'var(--a3)', rose: 'var(--a4)', sky: 'var(--a5)', violet: 'var(--a6)' };
const AV = [A.emerald, A.indigo, A.sky, A.violet, A.amber, A.rose];
const RING_C = 314;      // hero ring, r = 50
const MEM_C = 94;        // member ring, r = 15

@Component({
  selector: 'app-dpr-hod-dashboard',
  standalone: true,
  imports: [CommonModule, AiReportComponent, NewJoinersCardComponent],
  templateUrl: './dpr-hod-dashboard.component.html',
  styleUrls: ['../styles/dpr-dash.css', './dpr-hod-dashboard.component.css']
})
export class DprHodDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('aiReport') aiReport?: AiReportComponent;
  @ViewChild('tip') tipEl?: ElementRef<HTMLElement>;

  loading = false;
  loadError: string | null = null;

  // ── hero ───────────────────────────────────────────────────────────────────
  hodName = '';
  heroLine = 'Loading department pulse…';
  dateText = this.todayLine();
  scopeText = 'All departments';
  monthText = '';
  deptPills: DeptPill[] = [];
  activeDept = 0;
  chipForms = 0; chipLogs = 0; chipNoDpr = 0; chipLogged = 0; chipLeave = 0;
  chipBreak: number | null = null;
  readonly ringC = RING_C;
  ringOffset = RING_C;
  adoptionText = '—';
  rsLogged = '—'; rsExpected = '—'; rsDays = '—'; rsFulfil = '—';
  teamCount = 0;

  // ── quick actions ──────────────────────────────────────────────────────────
  notifUnread = 0; notifSub = 'Nothing new';
  noticeUnread = 0; noticeSub = 'Nothing published';
  badgePop = false;

  // ── decision strip + KPIs ──────────────────────────────────────────────────
  dcTarget: Decision = { a: '—', small: '', why: 'Loading…', color: A.emerald };
  dcLog: Decision = { a: '—', small: '', why: 'Loading…', color: A.rose };
  dcQueue: Decision = { a: '—', small: '', why: 'Loading…', color: A.indigo };
  kpis: KpiTile[] = this.blankKpis();

  // ── trend ──────────────────────────────────────────────────────────────────
  trHas = false;
  trPts = '';
  trArea = '';
  trEnd: TrendEnd | null = null;
  trX: TrendX[] = [];
  trAria = '';
  trAvg = '—';
  hourBars: HourBar[] = [];
  hourMax = '—';

  // ── queues ─────────────────────────────────────────────────────────────────
  formRows: FormRow[] = []; formCount = 0; formNote = '';
  logRows: LogRow[] = []; logCount = 0; logNote = '';

  // ── team ───────────────────────────────────────────────────────────────────
  team: Member[] = [];
  attRows: AttRow[] = [];
  attNote = '';
  notDoneRows: PersonRow[] = [];
  /** On leave & returning — every source combined (see leaveSet). */
  leaveRows: LeaveRow[] = [];
  leaveOnLeave = 0; leaveDueWeek = 0; leaveOverdue = 0;
  leaveNote = '';
  hmDays: HeatDay[] = [];
  hmRows: HeatRow[] = [];

  // ── ranking + exceptions ───────────────────────────────────────────────────
  leadRows: LeadRow[] = [];
  leadMore = 0;
  topLogger = '—';
  lowRows: PersonRow[] = []; lowCount = 0;
  staleRows: PersonRow[] = []; staleCount = 0; staleUnlogged = '—';
  remarkAvg = '—';
  remarkSegs: RemarkSeg[] = [];

  // ── break & lunch (SP_GET_LUNCH_MONITOR — already in api.ts, never wired here) ──
  lunchReady = false;
  lunchWindow = '';
  lunchOnBreak = 0; lunchWorked = 0; lunchIdle = 0;
  breakRows: BreakRow[] = [];
  lunchFailed = false;
  /** Last lunch-monitor rows, unfiltered — re-filtered whenever the team list changes. */
  private lunchRaw: any[] | null = null;

  /** Members counted as on leave today: employee master CURRENTSTATUS = LEAVE, the
   *  HR leave function (P_CUR_TEAM.onLeaveToday) and SP_GET_HOD_LEAVE_STATUS.
   *  Drives the hero chip, the KPI, the leave card, and which members are hidden
   *  from the live cards (team pulse, punch vs logged, no DPR today). */
  private leaveSet = new Set<string>();
  private leaveIds = new Set<string>();
  private leaveRaw: any[] = [];
  private lastPayload: any = null;

  aiMonth = '';

  /** 'HH:MM' of the cached payload on screen while live data loads; null = live. */
  staleSince: string | null = null;
  quoteText: string | null = null;
  quoteAuthor = '';

  private hodId = '';
  private currentDept: string | null = null;
  private reqSeq = 0;
  private pillsLoaded = false;
  private firstLoadDone = false;
  private destroyed = false;
  private subs: Subscription[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private intervals: ReturnType<typeof setInterval>[] = [];
  private fxCleanup: (() => void)[] = [];
  private dailyExp = new Map<string, number>();
  private teamDailyExp: number | null = null;
  private workingDaysToDate: number | null = null;
  private deptIdByName = new Map<string, number>();
  private teamIds = new Set<string>();

  constructor(
    private api: Api,
    private router: Router,
    private el: ElementRef<HTMLElement>,
    private zone: NgZone
  ) { }

  ngOnInit(): void {
    const u = this.readUser();
    this.hodId = u.id;
    this.hodName = u.name || u.id;
    if (!this.hodId) {
      this.loadError = 'Sign in to load live data';
      this.heroLine = 'Department pulse';
      return;
    }
    this.load(null, true);
    this.loadDeptIds();
    this.loadNotifications();
    this.loadNotices();
    this.loadQuote();
    // the hero promises a 5-minute refresh — silent, no re-entrance animation
    this.intervals.push(setInterval(() => { if (!this.loading) { this.load(this.currentDept, false); } }, 300000));
  }

  ngAfterViewInit(): void {
    this.countUp();
    const tip = this.tipEl?.nativeElement;
    if (tip) { this.fxCleanup.push(bindTooltip(this.el.nativeElement, tip, this.zone)); }
    this.fxCleanup.push(setupReveal(this.el.nativeElement));
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.fxCleanup.forEach(fn => fn());
    this.timers.forEach(t => clearTimeout(t));
    this.intervals.forEach(t => clearInterval(t));
    this.subs.forEach(s => s.unsubscribe());
  }

  trackMember = (_: number, m: Member): string => m.id;
  trackByIndex(i: number): number { return i; }

  // ══ NAVIGATION ════════════════════════════════════════════════════════════

  selectDept(i: number): void {
    if (i < 0 || i >= this.deptPills.length || i === this.activeDept) { return; }
    this.activeDept = i;
    this.currentDept = this.deptPills[i].dept;
    this.scopeText = this.currentDept ?? 'All departments';
    if (this.hodId) { this.load(this.currentDept, true); }
  }
  openForms(): void { this.router.navigate(['/leave-approval']); }
  openLogs(): void { this.router.navigate(['/dpr-approval']); }
  openAnalytics(): void { this.router.navigate(['/log-analytics']); }
  /** There is no /lunch-monitor route (it fell through to the login redirect); the
   *  monitor lives as a modal on Log History, which opens it from ?open=lunch. */
  openLunch(): void { this.router.navigate(['/my-logged-hours'], { queryParams: { open: 'lunch' } }); }
  retryLunch(): void { this.lunchFailed = false; this.loadLunch(); }
  /** Employee Master, pre-filtered to the department on screen (all of them when the HOD has several). */
  openTeamList(): void {
    this.router.navigate(['/employee-master'], this.currentDept ? { queryParams: { department: this.currentDept } } : {});
  }
  /** The department audit is manual only — nothing is generated on load. */
  generateAi(): void { this.aiReport?.generate(); }

  // ══ API ═══════════════════════════════════════════════════════════════════

  /** `replay` = first load or a pill click: count-ups and reveals run again. */
  private load(dept: string | null, replay: boolean): void {
    const seq = ++this.reqSeq;
    this.loading = true;
    this.loadError = null;
    // The live query takes ~40 s (it reads the punch view four times — see
    // Scripts/DPR_PUNCH_SNAPSHOT.sql). Paint the last payload this HOD saw TODAY
    // straight away, then swap in the live one. Background refreshes skip this:
    // the page already shows data.
    let painted = false;
    if (replay) {
      const cached = this.readCache(dept);
      if (cached) {
        this.applyAll(cached.data);
        this.staleSince = cached.at;
        this.countUp();
        painted = true;
      }
    }
    // leave status is a 140 ms call — fire it now, not after the 40 s dashboard proc,
    // or the card says "return date not recorded" until the slow call lands
    this.loadLeave();
    // the lunch proc takes ~15 s on its own — start it now instead of after the dashboard
    this.loadLunch();
    this.subs.push(this.api.getDprHodDashboard(this.hodId, dept).subscribe({
      next: (res: any) => {
        if (this.destroyed || seq !== this.reqSeq) { return; }
        this.loading = false;
        this.firstLoadDone = true;
        if (res?.success === false) { this.failRefresh(res?.message || 'Could not load live data'); return; }
        const d = res?.data ?? null;
        if (!d) { this.failRefresh('No dashboard data returned'); return; }
        this.applyAll(d);
        this.staleSince = null;
        this.writeCache(dept, d);
        // the numbers were already counted up from the cached paint
        if (replay && !painted) { this.countUp(); }
      },
      error: (err: any) => {
        if (this.destroyed || seq !== this.reqSeq) { return; }
        this.loading = false;
        this.firstLoadDone = true;
        const msg = typeof err?.error?.message === 'string' ? err.error.message.trim() : '';
        this.failRefresh(err?.status === 401 ? 'Session expired — sign in again' : (msg || 'Could not load live data'));
      }
    }));
  }

  /** A failed refresh keeps any cached data on screen and says how old it is. */
  private failRefresh(msg: string): void {
    this.loadError = this.staleSince ? msg + ' — showing data from ' + this.staleSince : msg;
  }

  // ══ CACHE ═════════════════════════════════════════════════════════════════
  // localStorage, one entry per HOD + department scope. Only ever painted for
  // the HOD who owns it, and only on the day it was saved: an entry from
  // yesterday would put yesterday's "no DPR today" list under today's heading.
  // The key prefix is deliberately not one clearSession() removes, so the
  // cache survives logout and the next login paints instantly.

  private static readonly CACHE_PREFIX = 'dprHodDash:v1:';
  private static readonly CACHE_MAX_CHARS = 1_500_000;

  private cacheKey(dept: string | null): string {
    return DprHodDashboardComponent.CACHE_PREFIX + this.key(this.hodId) + ':' + (dept ? this.key(dept) : '*');
  }

  private localDay(): string {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  private readCache(dept: string | null): { data: any; at: string } | null {
    try {
      const raw = localStorage.getItem(this.cacheKey(dept));
      if (!raw) { return null; }
      const c = JSON.parse(raw);
      if (c?.owner !== this.key(this.hodId) || c?.day !== this.localDay() || !c?.data) { return null; }
      return { data: c.data, at: String(c.at || '') };
    } catch { return null; }
  }

  private writeCache(dept: string | null, data: any): void {
    try {
      const now = new Date();
      const at = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      const json = JSON.stringify({ owner: this.key(this.hodId), day: this.localDay(), at, data });
      if (json.length > DprHodDashboardComponent.CACHE_MAX_CHARS) { return; }
      this.purgeCache();
      localStorage.setItem(this.cacheKey(dept), json);
    } catch { /* storage full or blocked — the page works without a cache */ }
  }

  /** Drop entries from other days or other users, so at most today's data lingers. */
  private purgeCache(): void {
    const day = this.localDay();
    const owner = this.key(this.hodId);
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(DprHodDashboardComponent.CACHE_PREFIX)) { continue; }
      try {
        const c = JSON.parse(localStorage.getItem(k) || '{}');
        if (c?.day !== day || c?.owner !== owner) { stale.push(k); }
      } catch { stale.push(k); }
    }
    stale.forEach(k => localStorage.removeItem(k));
  }

  // ══ QUOTE ═════════════════════════════════════════════════════════════════
  // General/GetTodaysBirthdaysAndQuotes returns a RANDOM quote on every call, so
  // the first one fetched each day is kept for the rest of that day — a real
  // quote of the day, and one request per day instead of one per load.

  private loadQuote(): void {
    const KEY = 'dprQuote:v1';
    try {
      const c = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (c?.day === this.localDay() && c?.text) { this.quoteText = c.text; this.quoteAuthor = c.author || ''; return; }
    } catch { /* fall through to the API */ }
    this.subs.push(this.api.GetTodaysBirthdaysAndQuotes().subscribe({
      next: (res: any) => {
        if (this.destroyed) { return; }
        const q = Array.isArray(res?.data?.quotes) ? res.data.quotes[0] : null;
        const text = (q?.quoteText ?? '').toString().trim();
        if (!text) { return; }
        this.quoteText = text;
        this.quoteAuthor = (q?.author ?? '').toString().trim();
        try { localStorage.setItem(KEY, JSON.stringify({ day: this.localDay(), text, author: this.quoteAuthor })); } catch { /* optional */ }
      },
      error: () => { }
    }));
  }

  private readUser(): { id: string; name: string } {
    try {
      const u = JSON.parse(localStorage.getItem('current_user') || '{}') as Record<string, unknown>;
      const pick = (k: string) => (typeof u[k] === 'string' ? (u[k] as string).trim() : '');
      return { id: pick('empId') || pick('employeeId'), name: pick('empName') || pick('employeeName') || pick('fullName') || pick('userName') || pick('name') };
    } catch { return { id: '', name: '' }; }
  }

  /** DailyTimeSheet/GetDepartmentList — the lunch monitor filters by id, the dashboard by name. */
  private loadDeptIds(): void {
    this.subs.push(this.api.getDepartmentList().subscribe({
      next: (res: any) => {
        const rows: any[] = Array.isArray(res?.data) ? res.data : [];
        rows.forEach(d => {
          const name = this.key(d?.departmentName ?? d?.name ?? d?.deptName);
          const id = this.num(d?.departmentId ?? d?.id);
          if (name && id) { this.deptIdByName.set(name, id); }
        });
      },
      error: () => { }
    }));
  }

  /** Same call the Lunch Monitor screen makes, scoped to the members on this page. */
  private loadLunch(): void {
    const id = this.currentDept ? (this.deptIdByName.get(this.key(this.currentDept)) ?? 0) : 0;
    this.subs.push(this.api.getLunchMonitor({ date: null, departmentId: id, comLoc: null, status: null, isDpr: null, minOverlapMin: 5 }).subscribe({
      next: (res: any) => {
        if (this.destroyed) { return; }
        this.lunchRaw = Array.isArray(res?.data?.rows) ? res.data.rows : [];
        this.lunchFailed = false;
        this.renderLunch();
      },
      error: () => { if (this.destroyed) { return; } this.lunchFailed = !this.lunchReady; }
    }));
  }

  private loadNotifications(): void {
    this.subs.push(this.api.getUserNotifications(this.hodId).subscribe({
      next: (res: any) => {
        if (this.destroyed) { return; }
        const list: any[] = Array.isArray(res?.data) ? res.data : [];
        this.notifUnread = list.filter(n => !(n?.isRead === true || n?.isRead === 'Y')).length;
        this.notifSub = this.notifUnread > 0 ? this.notifUnread + ' unread' : (list.length ? 'All caught up' : 'Nothing new');
        this.popBadges();
      },
      error: () => { }
    }));
  }

  private loadNotices(): void {
    this.subs.push(this.api.getUserNotices(this.hodId, 0, 'Y').subscribe({
      next: (res: any) => {
        if (this.destroyed) { return; }
        const list: any[] = Array.isArray(res?.data) ? res.data : [];
        this.noticeUnread = list.filter(n => (n?.isRead ?? '') === 'N').length;
        const newest = list.slice().sort((a, b) => Date.parse(b?.startDate ?? '') - Date.parse(a?.startDate ?? ''))[0];
        this.noticeSub = newest ? ((newest.title ?? '').toString().trim() || 'Latest notice') : 'Nothing published';
        this.popBadges();
      },
      error: () => { }
    }));
  }

  // ══ MAPPING ═══════════════════════════════════════════════════════════════

  private applyAll(d: any): void {
    this.lastPayload = d;
    const depts: DprHodDept[] = d?.departments ?? [];
    const summary: DprHodSummary | null = d?.summary ?? null;
    const trend: DprHodTrendDay[] = d?.trend ?? [];
    const formQueue: DprHodFormQueueItem[] = d?.formQueue ?? [];
    const logQueue: DprHodLogQueueItem[] = d?.logQueue ?? [];
    const attendance: DprHodAttendanceRow[] = d?.attendance ?? [];
    const notDone: DprHodNotDone[] = d?.notDone ?? [];
    const heatmap: DprHodHeatmapCell[] = d?.heatmap ?? [];
    const leaderboard: DprHodLeaderboardRow[] = d?.leaderboard ?? [];
    const exceptions: DprHodException[] = d?.exceptions ?? [];

    // cursor 1 is never dept-scoped — cache the pills from the first response
    if (!this.pillsLoaded) { this.applyDeptPills(depts); this.pillsLoaded = true; }

    // P_CUR_TEAM LEFT JOINs profile documents unaggregated — a member with two
    // profile pictures arrives twice, so de-duplicate before counting anything
    const members = this.dedupeTeam(d?.team ?? []);
    this.teamIds = new Set(members.map(m => this.key(m.empId)).filter(k => k));
    this.rebuildLeaveSet(members);
    this.renderLunch();
    this.deriveExpectations(leaderboard);

    const attByEmp = new Map<string, DprHodAttendanceRow>();
    attendance.forEach(a => { const k = this.key(a.empId); if (k) { attByEmp.set(k, a); } });
    const lbByEmp = new Map<string, DprHodLeaderboardRow>();
    leaderboard.forEach(r => { const k = this.key(r.empId); if (k) { lbByEmp.set(k, r); } });
    const roleByEmp = new Map<string, string>();
    members.forEach(m => { const k = this.key(m.empId); if (k) { roleByEmp.set(k, (m.designation ?? '').trim()); } });

    this.applyHero(summary, members, notDone, formQueue);
    const trendAvg = this.applyTrend(trend, members.length);
    this.applyFormQueue(formQueue, summary);
    this.applyLogQueue(logQueue, summary);
    this.applyDecisions(summary, leaderboard, notDone, formQueue, logQueue, trendAvg);
    this.applyKpis(summary, members, formQueue, logQueue);
    this.applyTeam(members, attByEmp, lbByEmp);
    this.applyAttendance(attendance, members);
    this.applyNotDone(notDone, members, exceptions);
    this.chipNoDpr = this.notDoneRows.length;                // the hero chip counts what the card lists
    this.applyHeatmap(heatmap, trend, members);
    this.applyLeaderboard(leaderboard, roleByEmp);
    this.applyExceptions(exceptions, lbByEmp, members.length);
    this.applyLeave(members);
    if (summary?.monthKey) { this.aiMonth = this.monthLabel(summary.monthKey); this.monthText = this.monthOnly(summary.monthKey); }
  }

  private applyDeptPills(depts: DprHodDept[]): void {
    const rows = depts.filter(r => this.key(r.department));
    const total = rows.reduce((a, r) => a + this.num(r.teamCount), 0);
    const logged = rows.reduce((a, r) => a + this.num(r.loggedToday), 0);
    this.deptPills = [
      { label: 'All', dept: null, count: total, logged },
      ...rows.map(r => ({ label: (r.department ?? '').trim(), dept: (r.department ?? '').trim(), count: this.num(r.teamCount), logged: this.num(r.loggedToday) }))
    ];
    // a single department needs no "All" pill
    if (this.deptPills.length === 2) { this.deptPills = [this.deptPills[1]]; this.currentDept = this.deptPills[0].dept; this.scopeText = this.currentDept ?? ''; }
    if (this.activeDept >= this.deptPills.length) { this.activeDept = 0; }
  }

  // ── hero ───────────────────────────────────────────────────────────────────

  private applyHero(s: DprHodSummary | null, members: DprHodTeamMember[], notDone: DprHodNotDone[], forms: DprHodFormQueueItem[]): void {
    const team = this.num(s?.teamCount) || members.length;
    const logged = this.num(s?.loggedToday);
    const monthHours = this.num(s?.monthHours);
    const expected = this.num(s?.expectedHoursToDate);
    this.teamCount = team;
    this.heroLine = team > 0 ? logged + ' of ' + team + ' logged a DPR today' : 'No team members in this scope';
    if (s?.theDate) { this.dateText = this.longDate(s.theDate); }

    const adoption = team > 0 ? this.clamp(logged / team * 100, 0, 100) : 0;
    this.ringOffset = RING_C * (1 - adoption / 100);
    this.adoptionText = team > 0 ? this.trim1(adoption) + '%' : '—';

    this.chipForms = this.num(s?.pendingFormApprovals) || forms.length;
    this.chipLogs = this.num(s?.pendingLogApprovals);
    this.chipNoDpr = notDone.length;
    this.chipLogged = logged;
    this.chipLeave = this.leaveSet.size;

    this.rsLogged = fmtNum(monthHours, 1) + ' h';
    this.rsExpected = fmtNum(expected, 1) + ' h';
    // working days are not a cursor column — recovered from the leaderboard algebra
    this.rsDays = this.workingDaysToDate != null ? String(Math.round(this.workingDaysToDate)) : '—';
    this.rsFulfil = expected > 0 ? this.trim1(monthHours / expected * 100) + '%' : '—';
  }

  /** PKG_DPR_DASH does not expose working days or the per-day expected hours.
   *  Both are recoverable from the leaderboard: consistencyPct = daysReported /
   *  workingDays × 100 and expectedHours = workingDays × dailyExpected. */
  private deriveExpectations(lb: DprHodLeaderboardRow[]): void {
    this.dailyExp.clear();
    this.teamDailyExp = null;
    this.workingDaysToDate = null;
    const wds: number[] = [];
    const dailies: number[] = [];
    for (const r of lb) {
      const dr = this.num(r.daysReported), cp = this.num(r.consistencyPct), eh = this.num(r.expectedHours);
      if (dr <= 0 || cp <= 0) { continue; }
      const wd = dr * 100 / cp;
      if (!isFinite(wd) || wd <= 0) { continue; }
      wds.push(wd);
      if (eh <= 0) { continue; }
      const de = eh / wd;
      if (!isFinite(de) || de <= 0 || de > 24) { continue; }
      dailies.push(de);
      const k = this.key(r.empId);
      if (k) { this.dailyExp.set(k, de); }
    }
    if (wds.length) { this.workingDaysToDate = Math.max(...wds); }
    if (dailies.length) { this.teamDailyExp = dailies.reduce((a, b) => a + b, 0) / dailies.length; }
  }

  private dailyExpFor(empId: string | null | undefined): number | null {
    const k = this.key(empId);
    return (k && this.dailyExp.get(k)) || this.teamDailyExp;
  }

  // ── decisions + KPIs ───────────────────────────────────────────────────────

  private applyDecisions(s: DprHodSummary | null, lb: DprHodLeaderboardRow[], notDone: DprHodNotDone[],
                         forms: DprHodFormQueueItem[], logs: DprHodLogQueueItem[], trendAvg: number | null): void {
    const monthHours = this.num(s?.monthHours);
    const expected = this.num(s?.expectedHoursToDate);
    const pct = expected > 0 ? monthHours / expected * 100 : 0;
    const below = lb.filter(r => this.num(r.fulfilPct) < 85).length;
    this.dcTarget = {
      a: expected > 0 ? this.trim1(pct) + '%' : '—', small: 'of expected hours',
      why: fmtNum(monthHours, 1) + ' h logged against ' + fmtNum(expected, 1) + ' h expected'
        + (lb.length ? ' · ' + below + ' of ' + lb.length + ' individually below 85%' : ''),
      color: pct >= 100 ? A.emerald : pct >= 85 ? A.amber : A.rose
    };

    const ages = notDone.map(r => this.num(r.daysSinceLastLog)).filter(v => v > 0 && v < 999);
    const never = notDone.filter(r => this.num(r.daysSinceLastLog) >= 999 || r.lastLogDate == null).length;
    const longest = ages.length ? Math.max(...ages) : 0;
    this.dcLog = {
      a: notDone.length + (notDone.length === 1 ? ' member' : ' members'), small: 'no DPR today',
      why: notDone.length === 0
        ? 'Everyone who punched in has logged a DPR' + (trendAvg != null ? ' · 14-day discipline ' + this.trim1(trendAvg) + '%' : '')
        : 'Punched in, nothing logged.' + (longest > 0 ? ' Longest silence ' + longest + ' working days.' : '') + (never > 0 ? ' ' + never + ' never logged.' : ''),
      color: notDone.length === 0 ? A.emerald : A.rose
    };

    const pf = this.num(s?.pendingFormApprovals) || forms.length;
    const pl = this.num(s?.pendingLogApprovals);
    const oldest = Math.max(0, ...forms.map(f => this.daysSince(f.requestDate) ?? 0));
    const mins = logs.reduce((a, r) => a + this.num(r.pendingMinutes), 0);
    this.dcQueue = {
      a: (pf + pl) + (pf + pl === 1 ? ' approval' : ' approvals'), small: pf + ' forms · ' + pl + ' logs',
      why: (forms.length ? 'Oldest form waiting ' + oldest + (oldest === 1 ? ' day' : ' days') : 'No forms waiting')
        + (mins > 0 ? ' · logs cover ' + fmtNum(mins / 60, 1) + ' h of unconfirmed team time' : ''),
      color: pf + pl > 0 ? A.indigo : A.emerald
    };
  }

  private applyKpis(s: DprHodSummary | null, members: DprHodTeamMember[], forms: DprHodFormQueueItem[], logs: DprHodLogQueueItem[]): void {
    const team = this.num(s?.teamCount) || members.length;
    const logged = this.num(s?.loggedToday);
    const adoption = team > 0 ? logged / team * 100 : 0;
    const monthHours = this.num(s?.monthHours);
    const expected = this.num(s?.expectedHoursToDate);
    const fulfil = expected > 0 ? monthHours / expected * 100 : 0;
    const pf = this.num(s?.pendingFormApprovals) || forms.length;
    const pl = this.num(s?.pendingLogApprovals);
    const leave = members.filter(m => this.leaveSet.has(this.key(m.empId)));
    const leaveN = leave.length;
    const names = leave.slice(0, 2).map(m => this.firstName(m.employeeName)).join(', ');

    this.kpis = [
      { label: 'Team adoption', color: A.emerald, icon: 'groups', pillCls: adoption >= 90 ? 'ok' : adoption >= 70 ? 'wt' : 'cr',
        pillTxt: this.trim1(adoption) + '%', value: logged, dec: 0, unit: ' of ' + team + ' today', barPct: this.clamp(adoption, 0, 100),
        foot: (team - logged) + ' still to log today' },
      { label: 'Hours logged', color: A.sky, icon: 'schedule', pillCls: fulfil >= 100 ? 'ok' : fulfil >= 85 ? 'nu' : 'wt',
        pillTxt: expected > 0 ? this.trim1(fulfil) + '% fulfilment' : '—', value: monthHours, dec: 1, unit: ' h this month', barPct: this.clamp(fulfil, 0, 100),
        foot: 'of ' + fmtNum(expected, 1) + ' h expected to date' },
      { label: 'Awaiting me', color: A.indigo, icon: 'inbox', pillCls: pf + pl > 0 ? 'cr' : 'ok', pillTxt: pf + pl > 0 ? 'Action needed' : 'Clear',
        value: pf + pl, dec: 0, unit: pf + pl === 1 ? ' approval' : ' approvals', barPct: pf + pl > 0 ? this.clamp(pf / (pf + pl) * 100, 0, 100) : 0,
        foot: pf + ' forms · ' + pl + ' DPR logs · ' + logs.length + (logs.length === 1 ? ' member' : ' members') },
      { label: 'On leave today', color: A.violet, icon: 'flight_takeoff', pillCls: 'nu', pillTxt: team > 0 ? this.trim1(leaveN / team * 100) + '% of team' : '—',
        value: leaveN, dec: 0, unit: leaveN === 1 ? ' member' : ' members', barPct: team > 0 ? this.clamp(leaveN / team * 100, 0, 100) : 0,
        foot: leaveN > 0 ? (names + (leave.length > 2 ? ' +' + (leave.length - 2) : '')) : 'Full team available' }
    ];
  }

  // ── trend: the discipline ratio, not raw hours ─────────────────────────────

  /** Of the people who punched in each day, the share that filed a DPR. Returns the mean. */
  private applyTrend(rows: DprHodTrendDay[], teamSize: number): number | null {
    const n = rows.length;
    if (n < 2) { this.trHas = false; this.trPts = ''; this.trArea = ''; this.trEnd = null; this.trX = []; this.hourBars = []; return null; }
    const W = 700, L = 40, R = 690, top = 20, base = 150;
    const x = (i: number) => this.r2(L + i * (R - L) / (n - 1));
    const y = (v: number) => this.r2(base - v / 100 * (base - top));

    // Punch coverage is partial (site and mobile punches do not all reach the
    // view), so "logged ÷ punched" capped at 100% and told the HOD nothing.
    // Logged ÷ active team is the honest measure. Friday is the weekly off.
    const active = Math.max(teamSize - this.leaveSet.size, 1);
    const ratio = rows.map(r => {
      const p = this.num(r.membersPunched), l = this.num(r.membersLogged);
      const fri = (r.dayName ?? '').trim().toUpperCase().startsWith('FRI');
      if (fri || (p <= 0 && l <= 0)) { return null; }
      return this.clamp(l / active * 100, 0, 100);
    });
    const pts: string[] = [];
    let lastI = -1;
    ratio.forEach((v, i) => { if (v != null) { pts.push(x(i) + ',' + y(v)); lastI = i; } });
    this.trHas = pts.length >= 2;
    this.trPts = pts.join(' ');
    this.trArea = this.trHas ? 'M' + pts[0] + ' L' + pts.slice(1).join(' L') + ' L' + x(n - 1) + ',' + base + ' L' + x(0) + ',' + base + ' Z' : '';
    const lastV = lastI >= 0 ? (ratio[lastI] as number) : null;
    this.trEnd = lastV != null ? { cx: x(lastI), cy: y(lastV), label: Math.round(lastV) + '%' } : null;
    this.trX = rows.map((r, i) => ({ x: x(i), label: i % 2 === 0 ? this.dayNum(r.theDate) : '' }));
    const vals = ratio.filter((v): v is number => v != null);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    this.trAvg = avg != null ? this.trim1(avg) + '%' : '—';
    this.trAria = 'Share of the active team that filed a DPR over ' + n + ' days'
      + (vals.length ? ', from ' + Math.round(Math.min(...vals)) + ' to ' + Math.round(Math.max(...vals)) + ' percent' : '');

    const hrs = rows.map(r => this.num(r.totalHours));
    const max = Math.max(1, ...hrs);
    this.hourMax = fmtNum(max, 1) + ' h';
    this.hourBars = rows.map((r, i) => ({
      h: this.clamp(hrs[i] / max * 100, 0, 100),
      label: this.dayNum(r.theDate),
      today: r.isToday === 'Y',
      off: ratio[i] == null,
      tip: this.fmtDate(r.theDate) + ' — <b>' + fmtNum(hrs[i], 1) + ' h</b> logged by ' + this.num(r.membersLogged) + ' of ' + active + ' active members'
    }));
    return avg;
  }

  // ── queues ─────────────────────────────────────────────────────────────────

  private applyFormQueue(rows: DprHodFormQueueItem[], s: DprHodSummary | null): void {
    this.formCount = this.num(s?.pendingFormApprovals) || rows.length;
    const sorted = rows.slice().sort((a, b) => (this.daysSince(b.requestDate) ?? 0) - (this.daysSince(a.requestDate) ?? 0));
    this.formRows = sorted.slice(0, 5).map((r, i) => {
      const age = this.daysSince(r.requestDate);
      const type = (r.formType ?? '').trim() || 'Form';
      const days = this.num(r.duration);
      const parts = [
        r.departureDate ? 'Leaves ' + this.shortDate(r.departureDate) : '',
        days > 0 ? this.trim1(days) + (days === 1 ? ' day' : ' days') : '',
        (r.reason ?? '').trim() ? '“' + (r.reason ?? '').trim() + '”' : ''
      ].filter(p => p);
      return {
        ini: this.initials(r.employeeName), color: this.formColor(type),
        name: ((r.employeeName ?? '').trim() || '—') + ' · ' + type,
        sub: parts.join(' · ') || ('Submitted ' + this.shortDate(r.requestDate)),
        stage: (r.approverRole ?? '').trim() || '—',
        ageCls: age == null ? '' : age > 5 ? 'a3' : age >= 3 ? 'a2' : 'a1',
        ageTxt: age == null ? '—' : age + (age === 1 ? ' day' : ' days')
      };
    });
    const b = [0, 0, 0, 0];
    rows.forEach(r => { const a = this.daysSince(r.requestDate); if (a == null) { return; } if (a <= 2) { b[0]++; } else if (a <= 5) { b[1]++; } else if (a <= 10) { b[2]++; } else { b[3]++; } });
    const more = rows.length - this.formRows.length;
    this.formNote = rows.length ? (more > 0 ? '+' + more + ' more · ' : '') + 'Ageing 0–2 d: ' + b[0] + ' · 3–5 d: ' + b[1] + ' · 6–10 d: ' + b[2] + ' · 10+ d: ' + b[3] : '';
  }

  private applyLogQueue(rows: DprHodLogQueueItem[], s: DprHodSummary | null): void {
    const summed = rows.reduce((a, r) => a + this.num(r.pendingLogCount), 0);
    this.logCount = this.num(s?.pendingLogApprovals) || summed;
    const sorted = rows.slice().sort((a, b) => this.num(b.pendingLogCount) - this.num(a.pendingLogCount));
    this.logRows = sorted.slice(0, 5).map((r, i) => ({
      ini: this.initials(r.employeeName), color: AV[i % AV.length],
      name: (r.employeeName ?? '').trim() || '—',
      sub: ((r.designation ?? '').trim() || '—') + ' · last activity ' + this.relDate(r.lastActivityDate),
      count: this.num(r.pendingLogCount),
      hours: fmtNum(this.num(r.pendingMinutes) / 60, 1) + ' h'
    }));
    const more = rows.length - this.logRows.length;
    const mins = rows.reduce((a, r) => a + this.num(r.pendingMinutes), 0);
    this.logNote = rows.length ? (more > 0 ? '+' + more + ' more members · ' : '') + fmtNum(mins / 60, 1) + ' h of team time awaiting your confirmation' : '';
  }

  // ── team ───────────────────────────────────────────────────────────────────

  private applyTeam(members: DprHodTeamMember[], att: Map<string, DprHodAttendanceRow>, lb: Map<string, DprHodLeaderboardRow>): void {
    this.team = members.filter(m => !this.leaveSet.has(this.key(m.empId))).map((m, i) => {
      const todayMin = this.num(m.todayMin);
      const running = m.runningNow === 'Y';
      const onLeave = m.onLeaveToday === 'Y';
      const punches = this.num(m.punchCount);
      const state = onLeave ? 'leave' : running ? 'run' : todayMin > 0 ? 'pause' : punches > 0 ? 'nolog' : 'absent';
      const de = this.dailyExpFor(m.empId);
      const pct = de && de > 0 ? this.clamp(Math.round(todayMin / (de * 60) * 100), 0, 100) : 0;
      const a = att.get(this.key(m.empId));
      const row = lb.get(this.key(m.empId));
      const monExp = this.num(m.expectedHoursToDate) || this.num(row?.expectedHours);
      const monH = this.num(m.monthHours);
      const monPct = monExp > 0 ? monH / monExp * 100 : 0;
      const color = state === 'run' ? A.emerald : state === 'pause' ? A.amber : state === 'nolog' ? A.rose : state === 'leave' ? A.violet : A.indigo;
      const pill = state === 'run' ? ['ok', 'Running'] : state === 'pause' ? ['wt', 'Paused'] : state === 'nolog' ? ['cr', 'No log'] : state === 'leave' ? ['nu', 'Leave'] : ['nu', 'Not in'];
      return {
        id: this.key(m.empId) || this.key(m.employeeName) || String(i),
        ini: this.initials(m.employeeName), img: this.imgSrc(m.profileImageBase64), color,
        name: (m.employeeName ?? '').trim() || '—', role: (m.designation ?? '').trim() || '—',
        pillCls: pill[0], pillTxt: pill[1],
        today: this.hm(todayMin), exp: de && de > 0 ? this.trim1(de) : '—', pct, ringOff: MEM_C * (1 - pct / 100),
        task: running ? ((m.runningTaskTitle ?? '').trim() || 'Timer running') : onLeave ? 'Approved leave' : todayMin > 0 ? 'Logged · timer stopped' : punches > 0 ? 'Punched in · no timer' : 'No punch today',
        in: (a?.firstPunch ?? m.lastPunch ?? '').trim() || '—',
        out: this.num(a?.punchCount ?? m.punchCount) > 1 ? ((a?.lastPunch ?? m.lastPunch ?? '').trim() || '—') : '—',
        mon: monExp > 0 ? this.trim1(monPct) + '% month' : fmtNum(monH, 1) + ' h month',
        monBad: monExp > 0 && monPct < 85,
        delay: (60 + i * 40) + 'ms'
      };
    });
  }

  private applyAttendance(rows: DprHodAttendanceRow[], members: DprHodTeamMember[]): void {
    const leave = this.leaveSet;
    const prepared = rows.filter(r => !leave.has(this.key(r.empId))).map(r => {
      const punches = this.num(r.punchCount), loggedMin = this.num(r.loggedMin), breakMin = this.num(r.breakMin);
      const gapMin = r.gapMin ?? null;
      // gapMin is GREATEST(span − logged − break, 0) inside the proc, so inverting it
      // invents office time whenever logged + break outran the punch span. Trust the
      // measured span when the proc sends it; otherwise only invert when the floor
      // provably did not bind.
      const measured = r.elapsedMin != null ? this.num(r.elapsedMin) : null;
      const elapsed = measured != null ? measured : (gapMin != null && gapMin > 0 && punches > 1 ? gapMin + loggedMin + breakMin : null);
      const gap = elapsed != null ? Math.max(elapsed - loggedMin - breakMin, 0) : null;
      const onLeave = leave.has(this.key(r.empId));
      return { r, punches, loggedMin, breakMin, elapsed, gap, onLeave };
    });
    const scale = Math.max(60, ...prepared.map(p => p.elapsed ?? 0));
    const pct = (m: number) => this.clamp(m / scale * 100, 0, 100);
    this.attRows = prepared.map(p => {
      const name = (p.r.employeeName ?? '').trim() || '—';
      const over = p.elapsed != null && p.loggedMin + p.breakMin > p.elapsed + 1;
      return {
        name,
        in: (p.r.firstPunch ?? '').trim() || '—',
        out: p.punches > 1 ? ((p.r.lastPunch ?? '').trim() || '—') : '—',
        office: p.onLeave && p.punches === 0 ? 'On leave' : p.elapsed != null ? this.hm(p.elapsed) : '—',
        dpr: this.hm(p.loggedMin), dprBad: p.loggedMin === 0 && !p.onLeave,
        gap: p.gap == null ? '—' : over ? 'over' : this.hm(p.gap),
        gapCls: p.gap == null ? '' : over ? 'a2' : p.gap <= 30 ? 'a1' : p.gap <= 120 ? 'a2' : 'a3',
        punches: p.punches,
        spanW: p.elapsed != null ? pct(p.elapsed) : 0,
        workW: pct(Math.min(p.loggedMin, p.elapsed ?? p.loggedMin)),
        brkW: pct(Math.min(p.breakMin, Math.max((p.elapsed ?? p.breakMin) - p.loggedMin, 0))),
        gapW: p.gap != null ? pct(p.gap) : 0,
        tip: escHtml(name) + ' — in office <b>' + (p.elapsed != null ? this.hmLong(p.elapsed) : '—') + '</b>, logged <b>' + this.hmLong(p.loggedMin)
          + '</b>, break <b>' + this.hmLong(p.breakMin) + '</b>' + (p.gap != null ? ', unaccounted <b>' + this.hmLong(p.gap) + '</b>' : '')
          + (over ? ' — logged more than the punch span, usually a missed punch-out' : ''),
        sortKey: p.onLeave ? -1 : (p.gap ?? -0.5)
      };
    }).sort((a, b) => b.sortKey - a.sortKey);
    const overs = this.attRows.filter(r => r.gap === 'over').length;
    this.attNote = 'Active members only, sorted worst first.' + (overs > 0 ? ' ' + overs + (overs === 1 ? ' member' : ' members') + ' logged more than the punch span — usually a forgotten punch-out, not extra work.' : '');
  }

  private applyNotDone(rows: DprHodNotDone[], members: DprHodTeamMember[], exceptions: DprHodException[]): void {
    const seen = new Set<string>();
    const sorted = rows.filter(r => !this.leaveSet.has(this.key(r.empId)))
      .sort((a, b) => this.num(b.daysSinceLastLog) - this.num(a.daysSinceLastLog));
    this.notDoneRows = sorted.map(r => {
      seen.add(this.key(r.empId));
      const d = r.daysSinceLastLog == null ? null : this.num(r.daysSinceLastLog);
      const never = d == null || d >= 999 || !r.lastLogDate;
      return {
        ini: this.initials(r.employeeName), color: never || (d ?? 0) >= 3 ? A.rose : A.amber,
        name: (r.employeeName ?? '').trim() || '—',
        sub: ((r.designation ?? '').trim() || '—') + ' · punched ' + ((r.firstPunch ?? '').trim() || '—') + (never ? ' · never logged' : ' · last DPR ' + this.shortDate(r.lastLogDate)),
        ageCls: never || (d ?? 0) >= 3 ? 'a3' : (d ?? 0) >= 1 ? 'a2' : 'a1',
        ageTxt: never ? 'Never' : d === 0 ? 'Today' : d + (d === 1 ? ' day' : ' days')
      };
    });
    // STALE (no DPR for 3+ days) without a punch today would otherwise be invisible —
    // it used to have its own "Non-submitters" card, which repeated most of this list.
    const role = new Map(members.map(m => [this.key(m.empId), (m.designation ?? '').trim()]));
    exceptions
      .filter(r => (r.excType ?? '').trim().toUpperCase() === 'STALE')
      .filter(r => !seen.has(this.key(r.empId)) && !this.leaveSet.has(this.key(r.empId)))
      .sort((a, b) => this.num(b.metricValue) - this.num(a.metricValue))
      .forEach(r => {
        const d = this.num(r.metricValue);
        const never = d >= 999;
        this.notDoneRows.push({
          ini: this.initials(r.employeeName), color: A.rose,
          name: (r.employeeName ?? '').trim() || '—',
          sub: (role.get(this.key(r.empId)) || '—') + ' · no punch today · ' + ((r.detail ?? '').trim() || 'no recent DPR'),
          ageCls: 'a3', ageTxt: never ? 'Never' : d + (d === 1 ? ' day' : ' days')
        });
      });
  }

  // ── leave: master status + HR function + SP_GET_HOD_LEAVE_STATUS ──────────

  private isLeaveStatus(m: DprHodTeamMember): boolean {
    return this.key(m.currentStatus) === 'LEAVE' || (m.onLeaveToday ?? '') === 'Y';
  }

  private rebuildLeaveSet(members: DprHodTeamMember[]): void {
    const ids = new Set<string>(this.leaveIds);
    members.forEach(m => { if (this.isLeaveStatus(m)) { ids.add(this.key(m.empId)); } });
    this.leaveSet = ids;
  }

  private loadLeave(): void {
    this.subs.push(this.api.getDprHodLeave(this.hodId, this.currentDept).subscribe({
      next: (res: any) => {
        if (this.destroyed) { return; }
        const rows: any[] = res?.success === false ? [] : (Array.isArray(res?.data) ? res.data : []);
        this.leaveRaw = rows;
        this.leaveIds = new Set(rows
          .filter(r => this.key(r?.leaveStatus) !== 'REJOINED')
          .map(r => this.key(r?.empId)).filter(k => k));
        this.refreshLeaveViews();
      },
      // Until SP_GET_HOD_LEAVE_STATUS is deployed the card still lists members the
      // employee master marks as Leave — just without return dates.
      error: () => { this.leaveRaw = []; this.leaveIds = new Set(); this.refreshLeaveViews(); }
    }));
  }

  /** A late leave answer can add or remove members from the leave set, which changes
   *  the hero chip, the KPI, team pulse, punch vs logged and no-DPR alike — so re-map
   *  the last payload instead of patching each card. Pure computation, no request. */
  private refreshLeaveViews(): void {
    if (this.lastPayload) { this.applyAll(this.lastPayload); } else { this.applyLeave([]); }
  }

  private applyLeave(members: DprHodTeamMember[]): void {
    const byId = new Map<string, any>();
    this.leaveRaw.forEach(r => { const k = this.key(r?.empId); if (k) { byId.set(k, r); } });
    const rows: LeaveRow[] = [];
    let onLeave = 0, dueWeek = 0, overdue = 0;

    byId.forEach((r, k) => {
      const st = this.key(r.leaveStatus);
      const over = this.num(r.overdueDays);
      const until = r.daysUntilBack == null ? null : this.num(r.daysUntilBack);
      const type = (r.leaveType ?? '').toString().trim() || 'Leave';
      const parts = [
        r.departedOn ? 'left ' + this.shortDate(r.departedOn) : '',
        r.dueBack ? (r.extendedTo ? 'extended to ' : 'due back ') + this.shortDate(r.dueBack) : 'return date not recorded',
        this.num(r.daysApproved) > 0 ? this.trim1(this.num(r.daysApproved)) + ' days approved' : ''
      ].filter(p => p);
      let chipCls = 'a2', chipTxt = 'On leave', order = 2, color = A.violet;
      if (st === 'REJOINED') { chipCls = 'a1'; chipTxt = 'Back ' + this.shortDate(r.rejoinedOn); order = 3; color = A.emerald; }
      else if (st === 'OVERDUE') { chipCls = 'a3'; chipTxt = 'Overdue ' + over + (over === 1 ? ' day' : ' days'); order = 0; color = A.rose; overdue++; onLeave++; }
      else if (st === 'DUE_TODAY') { chipCls = 'a2'; chipTxt = 'Due today'; order = 1; color = A.amber; dueWeek++; onLeave++; }
      else { onLeave++; if (until != null && until <= 7) { dueWeek++; chipTxt = 'Back in ' + until + (until === 1 ? ' day' : ' days'); } }
      rows.push({
        ini: this.initials(r.employeeName), color,
        name: (r.employeeName ?? '').toString().trim() || k,
        sub: parts.join(' · '), type, chipCls, chipTxt, order,
        tip: escHtml(type) + (r.reason ? ' — ' + escHtml((r.reason ?? '').toString()) : '')
          + (r.plannedReturn && r.extendedTo ? ' · planned return ' + this.shortDate(r.plannedReturn) : '')
      });
    });
    // marked Leave in the master but no approved form found: still on leave, no dates
    members.filter(m => this.isLeaveStatus(m) && !byId.has(this.key(m.empId))).forEach(m => {
      onLeave++;
      rows.push({
        ini: this.initials(m.employeeName), color: A.violet,
        name: (m.employeeName ?? '').trim() || '—',
        sub: ((m.designation ?? '').trim() || '—') + ' · return date not recorded',
        type: 'Leave', chipCls: 'a2', chipTxt: 'On leave', order: 2,
        tip: (m.onLeaveToday ?? '') === 'Y' ? 'Approved leave in HR' : 'Employee master status: Leave'
      });
    });
    rows.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    this.leaveRows = rows;
    this.leaveOnLeave = onLeave; this.leaveDueWeek = dueWeek; this.leaveOverdue = overdue;
    this.leaveNote = overdue > 0
      ? overdue + (overdue === 1 ? ' member is' : ' members are') + ' past the return date with no rejoining form — check before the month closes.'
      : (rows.length ? 'Return dates come from the approved exit form, or the rejoining form when it extends them.' : '');
  }

  private applyHeatmap(cells: DprHodHeatmapCell[], trend: DprHodTrendDay[], members: DprHodTeamMember[]): void {
    if (!cells.length) { this.hmDays = []; this.hmRows = []; return; }
    const dates: string[] = [];
    const dayName = new Map<string, string>();
    cells.forEach(c => { const d = (c.theDate ?? '').trim(); if (d && !dayName.has(d)) { dayName.set(d, (c.dayName ?? '').trim()); dates.push(d); } });
    dates.sort();
    this.hmDays = dates.map(d => ({ label: this.dayNum(d), name: (dayName.get(d) ?? '').slice(0, 3).toUpperCase() }));
    // a day nobody punched AND nobody logged is a non-working day for everyone
    const offDay = new Set<string>();
    trend.forEach(t => { const d = (t.theDate ?? '').trim(); if (d && this.num(t.membersPunched) === 0 && this.num(t.membersLogged) === 0) { offDay.add(d); } });
    const leaveToday = new Set(members.filter(m => m.onLeaveToday === 'Y').map(m => this.key(m.empId)));
    const today = (trend.find(t => t.isToday === 'Y')?.theDate ?? '').trim();

    const order: string[] = [];
    const byEmp = new Map<string, { name: string; hours: Map<string, number> }>();
    cells.forEach(c => {
      const k = this.key(c.empId) || this.key(c.employeeName);
      if (!k) { return; }
      let row = byEmp.get(k);
      if (!row) { row = { name: (c.employeeName ?? '').trim(), hours: new Map() }; byEmp.set(k, row); order.push(k); }
      const d = (c.theDate ?? '').trim();
      if (d) { row.hours.set(d, this.num(c.hours)); }
    });
    this.hmRows = order.map(k => {
      const row = byEmp.get(k)!;
      const de = this.dailyExpFor(k);
      const name = this.fullName(row.name) || k;
      return {
        name,
        cells: dates.map(d => {
          const hrs = row.hours.get(d) ?? 0;
          const off = offDay.has(d) || (d === today && leaveToday.has(k));
          const v = off ? -1 : de && de > 0 ? Math.round(hrs / de * 100) : hrs > 0 ? 100 : 0;
          const cls = off ? 'off' : v === 0 ? 'ms' : v < 60 ? 'l1' : v < 85 ? 'l2' : v < 100 ? 'l3' : v < 115 ? 'l4' : 'l5';
          return { cls, label: off ? '' : v === 0 ? '—' : fmtNum(hrs, 1), tip: escHtml(name) + ' · ' + this.fmtDate(d) + ' — ' + (off ? 'non-working day or leave' : v === 0 ? 'no DPR logged' : '<b>' + fmtNum(hrs, 1) + ' h</b> · ' + v + '% of daily target') };
        })
      };
    });
  }

  // ── ranking: the composite, broken into its 80 / 10 / 10 parts ────────────

  private applyLeaderboard(rows: DprHodLeaderboardRow[], roles: Map<string, string>): void {
    if (!rows.length) { this.leadRows = []; this.leadMore = 0; this.topLogger = '—'; return; }
    const sorted = rows.slice().sort((a, b) => {
      const ra = this.num(a.teamRank), rb = this.num(b.teamRank);
      if (ra > 0 && rb > 0 && ra !== rb) { return ra - rb; }
      return this.num(b.compositeScore) - this.num(a.compositeScore);
    });
    const maxComp = Math.max(1, ...sorted.map(r => this.num(r.compositeScore)));
    this.leadRows = sorted.slice(0, 6).map((r, i) => {
      const f = 0.8 * this.num(r.fulfilPct), c = 0.1 * Math.min(this.num(r.consistencyPct), 100), m = 0.1 * this.num(r.remarkScore);
      const comp = this.num(r.compositeScore) || f + c + m;
      const rank = this.num(r.teamRank) || i + 1;
      return {
        rank, rkCls: rank === 1 ? 't1' : rank === 2 ? 't2' : rank === 3 ? 't3' : '',
        ini: this.initials(r.employeeName), color: AV[i % AV.length],
        name: (r.employeeName ?? '').trim() || '—', sub: roles.get(this.key(r.empId)) || (this.num(r.daysReported) + ' days reported'),
        segs: [{ w: this.clamp(f / maxComp * 100, 0, 100), c: A.emerald }, { w: this.clamp(c / maxComp * 100, 0, 100), c: A.sky }, { w: this.clamp(m / maxComp * 100, 0, 100), c: A.violet }],
        comp: this.trim1(comp), hours: fmtNum(this.num(r.monthHours), 1),
        tip: 'Fulfilment <b>' + this.trim1(this.num(r.fulfilPct)) + '%</b> × 0.8 = ' + this.trim1(f) + ' · consistency <b>' + this.trim1(this.num(r.consistencyPct)) + '%</b> × 0.1 = ' + this.trim1(c)
          + ' · remark quality <b>' + this.trim1(this.num(r.remarkScore)) + '%</b> × 0.1 = ' + this.trim1(m)
      };
    });
    this.leadMore = Math.max(rows.length - this.leadRows.length, 0);
    const top = rows.slice().sort((a, b) => this.num(b.monthHours) - this.num(a.monthHours))[0];
    this.topLogger = top ? ((top.employeeName ?? '').trim() || '—') + ' · ' + fmtNum(this.num(top.monthHours), 1) + ' h' : '—';
  }

  // ── exceptions: pure SQL rules, never an AI call ───────────────────────────

  private applyExceptions(rows: DprHodException[], lb: Map<string, DprHodLeaderboardRow>, teamSize: number): void {
    const of = (t: string) => rows.filter(r => (r.excType ?? '').trim().toUpperCase() === t);
    const low = of('LOW_FULFIL'), stale = of('STALE'), dup = of('REMARK_DUP');

    this.lowCount = low.length;
    this.lowRows = low.slice(0, 4).map(r => {
      const m = lb.get(this.key(r.empId));
      const v = this.num(r.metricValue);
      return {
        ini: this.initials(r.employeeName), color: v < 65 ? A.rose : A.amber,
        name: (r.employeeName ?? '').trim() || '—',
        sub: ((r.detail ?? '').trim() || '—') + (m ? ' · ' + fmtNum(this.num(m.monthHours), 1) + ' of ' + fmtNum(this.num(m.expectedHours), 1) + ' h' : ''),
        ageCls: v < 65 ? 'a3' : 'a2', ageTxt: this.trim1(v) + '%'
      };
    });

    // de-duplicated against LOW_FULFIL so the two cards never repeat a person
    const lowIds = new Set(low.map(r => this.key(r.empId)));
    const staleOnly = stale.filter(r => !lowIds.has(this.key(r.empId)));
    this.staleCount = staleOnly.length;
    const unlogged = staleOnly.reduce((a, r) => { const m = lb.get(this.key(r.empId)); return a + Math.max(this.num(m?.expectedHours) - this.num(m?.monthHours), 0); }, 0);
    this.staleUnlogged = fmtNum(unlogged, 0) + ' h';
    this.staleRows = staleOnly.slice(0, 4).map(r => {
      const never = this.num(r.metricValue) >= 999;
      const d = this.num(r.metricValue);
      return {
        ini: this.initials(r.employeeName), color: never ? A.rose : A.amber,
        name: (r.employeeName ?? '').trim() || '—',
        sub: (r.detail ?? '').trim() || '—',
        ageCls: never || d >= 5 ? 'a3' : 'a2', ageTxt: never ? 'Never' : d + (d === 1 ? ' day' : ' days')
      };
    });

    const dupIds = new Set(dup.map(r => this.key(r.empId)).filter(k => k));
    let proper = 0, desc = 0, none = 0;
    lb.forEach((r, id) => { if (dupIds.has(id)) { return; } const sc = this.num(r.remarkScore); if (sc >= 85) { proper++; } else if (sc >= 50) { desc++; } else { none++; } });
    const dupCount = Array.from(dupIds).filter(id => lb.has(id)).length;
    const total = proper + desc + none + dupCount;
    const scores = Array.from(lb.values()).map(r => this.num(r.remarkScore));
    this.remarkAvg = scores.length ? this.trim1(scores.reduce((a, b) => a + b, 0) / scores.length) : '—';
    this.remarkSegs = total > 0 ? [
      { w: proper / total * 100, c: A.emerald, label: 'Proper remarks', n: proper },
      { w: desc / total * 100, c: A.amber, label: 'Thin remarks', n: desc },
      { w: none / total * 100, c: A.rose, label: 'No remarks', n: none },
      { w: dupCount / total * 100, c: A.violet, label: 'Copy-paste across tasks', n: dupCount }
    ] : [];
    void teamSize;
  }

  // ── break & lunch ──────────────────────────────────────────────────────────

  /** Team filter needs the dashboard's member list; until it arrives, show nothing rather than the whole company. */
  private renderLunch(): void {
    if (this.lunchRaw == null || !this.teamIds.size) { return; }
    this.applyLunch(this.lunchRaw.filter(r => this.teamIds.has(this.key(r?.employeeId))));
  }

  private applyLunch(rows: any[]): void {
    this.lunchReady = true;
    const onBreak = rows.filter(r => (r?.isOnBreakNow ?? '') === 'Y');
    this.lunchOnBreak = onBreak.length;
    this.lunchWorked = rows.filter(r => (r?.status ?? '').toString().toUpperCase() === 'WORKED IN LUNCH').length;
    this.lunchIdle = rows.filter(r => (r?.status ?? '').toString().toUpperCase() === 'IDLE').length;
    this.chipBreak = onBreak.length;
    const first = rows[0];
    this.lunchWindow = first?.windowStart && first?.windowEnd
      ? (first.location ? first.location + ' ' : '') + first.windowStart + '–' + first.windowEnd + ((first.inWindowNow ?? '') === 'Y' ? ' · lunch window now' : '')
      : '';
    this.breakRows = onBreak.slice().sort((a, b) => this.num(b?.breakMinutes) - this.num(a?.breakMinutes)).slice(0, 6).map((r, i) => ({
      ini: this.initials(r?.employeeName), color: AV[(i + 2) % AV.length],
      name: (r?.employeeName ?? '').toString().trim() || '—',
      sub: [((r?.breakReasonNow ?? r?.breakReason ?? '').toString().trim() || 'Break'), (r?.breakRemarks ?? '').toString().trim()].filter(p => p).join(' · '),
      mins: this.hmLong(this.num(r?.breakMinutes))
    }));
  }

  // ── small state helpers ────────────────────────────────────────────────────

  private blankKpis(): KpiTile[] {
    const b = (label: string, color: string, icon: string, unit: string, dec: number): KpiTile =>
      ({ label, color, icon, unit, dec, value: 0, pillCls: 'nu', pillTxt: '—', barPct: 0, foot: 'Loading…' });
    return [b('Team adoption', A.emerald, 'groups', ' today', 0), b('Hours logged', A.sky, 'schedule', ' h this month', 1),
      b('Awaiting me', A.indigo, 'inbox', ' approvals', 0), b('On leave today', A.violet, 'flight_takeoff', ' members', 0)];
  }
  private countUp(): void { this.fxCleanup.push(countUpAll(this.el.nativeElement, this.zone, () => !this.destroyed)); }
  private popBadges(): void { this.badgePop = false; this.timers.push(setTimeout(() => { this.badgePop = true; }, 20)); }

  // ══ FORMATTERS ════════════════════════════════════════════════════════════

  fmt(v: number, dec: number): string { return fmtNum(v, dec); }
  private num(v: unknown): number { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return isFinite(n) ? n : 0; }
  private key(v: unknown): string { return (v ?? '').toString().trim().toUpperCase(); }
  private clamp(v: number, lo: number, hi: number): number { return Math.min(Math.max(v, lo), hi); }
  private r2(v: number): number { return Math.round(v * 100) / 100; }
  private trim1(v: number): string { const r = Math.round(v * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); }
  private hm(min: number): string { const m = Math.max(Math.round(min), 0); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  private hmLong(min: number): string { const m = Math.max(Math.round(min), 0); const h = Math.floor(m / 60); return h > 0 ? h + ' h ' + String(m % 60).padStart(2, '0') + ' m' : (m % 60) + ' m'; }
  private initials(name: unknown): string { return (name ?? '').toString().trim().split(/\s+/).filter(Boolean).map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase() || '—'; }
  private firstName(name: unknown): string { const w = (name ?? '').toString().trim().split(/\s+/)[0] || ''; return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }
  /** 'VINOD PACHUPILLAI VIJAYAN PILLAI' → 'Vinod Pachupillai Vijayan Pillai' (the heatmap shows the full name) */
  private fullName(name: string): string {
    return name.trim().split(/\s+/).filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  private formColor(type: string): string {
    const u = type.toUpperCase();
    return u.indexOf('EMERGENCY') >= 0 ? A.rose : u.indexOf('RESIGN') >= 0 ? A.violet : u.indexOf('LEAVE') >= 0 ? A.amber : A.sky;
  }
  private imgSrc(b64: string | null | undefined): string | null {
    const s = (b64 ?? '').trim();
    if (!s) { return null; }
    const mime = s.startsWith('/9j/') ? 'jpeg' : s.startsWith('R0lGOD') ? 'gif' : s.startsWith('UklGR') ? 'webp' : 'png';
    return 'data:image/' + mime + ';base64,' + s;
  }
  private dedupeTeam(rows: DprHodTeamMember[]): DprHodTeamMember[] {
    const seen = new Set<string>();
    return rows.filter(r => { const k = this.key(r.empId) || this.key(r.employeeName); if (!k || seen.has(k)) { return false; } seen.add(k); return true; });
  }
  private parseDate(v: unknown): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((v ?? '').toString().trim());
    if (!m) { return null; }
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  private daysSince(v: unknown): number | null {
    const d = this.parseDate(v);
    if (!d) { return null; }
    const now = new Date();
    return Math.max(0, Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - d.getTime()) / 86400000));
  }
  private relDate(v: unknown): string { const n = this.daysSince(v); return n == null ? 'unknown' : n === 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago'; }
  private shortDate(v: unknown): string { const d = this.parseDate(v); return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—'; }
  private fmtDate(v: unknown): string { const d = this.parseDate(v); return d ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—'; }
  private dayNum(v: unknown): string { const d = this.parseDate(v); return d ? String(d.getUTCDate()) : ''; }
  private longDate(v: unknown): string { const d = this.parseDate(v); return d ? d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : this.todayLine(); }
  private todayLine(): string { return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  private monthLabel(k: string): string { const m = /^(\d{4})-(\d{2})$/.exec(k.trim()); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : k; }
  private monthOnly(k: string): string { const m = /^(\d{4})-(\d{2})$/.exec(k.trim()); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }) : k; }
}
