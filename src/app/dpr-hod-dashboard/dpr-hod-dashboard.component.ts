import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Api } from '../services/api';
import {
  DprHodAttendanceRow, DprHodDept, DprHodException, DprHodFormQueueItem,
  DprHodHeatmapCell, DprHodLeaderboardRow, DprHodLogQueueItem, DprHodNotDone,
  DprHodSummary, DprHodTeamMember, DprHodTrendDay
} from '../models/dprDashboard.model';

// ── view models ──────────────────────────────────────────────────────────────
interface TrendTick { v: number; y: number; }
interface TrendPath { d: string; c: string; w: number; dash: boolean; o: number; }
interface TrendDot { cx: number; cy: number; r: number; f: string; }

interface TeamMember {
  id: string;                                   // trackBy key — keeps cards alive across refreshes
  n: string; r: string; h: string; p: number;
  s: 'run' | 'pause' | 'break' | 'none' | 'leave';
  t: string; in: string; out: string;
  ini: string; img: string | null; exp: string;
  color: string; pillClass: string; pillLabel: string;
  anim: string; ringOff: number;
}

interface AttRow {
  n: string; in: string; out: string; off: string; dpr: string;
  dprColor: string; hasGap: boolean; gapLabel: string; gapCls: string;
}

interface HeatCell { bg: string; fg: string; label: string; title: string; }
interface HeatRow { n: string; cells: HeatCell[]; }

interface LeadRow { n: string; p: number; v: string; c: string; tc: string; }
interface StackSeg { w: number; c: string; }

/** One `.ap` row — used by every queue / exception card. */
interface ApRow {
  color: string; icon: string | null; ini: string;
  name: string; sub: string; ageCls: string; ageLbl: string;
}

/** One department pill. `dept === null` is the "All" scope. */
interface DeptPill { label: string; dept: string | null; count: number; logged: number; }

@Component({
  selector: 'app-dpr-hod-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dpr-hod-dashboard.component.html',
  styleUrls: ['./dpr-hod-dashboard.component.css']
})
export class DprHodDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  // ── request state ───────────────────────────────────────────────────────────
  loading = false;
  loadError: string | null = null;

  private hodId = '';
  private currentDept: string | null = null;
  private reqSeq = 0;
  private pillsLoaded = false;
  private viewReady = false;
  private countGen = 0;
  private firstLoadDone = false;

  // ── hero ────────────────────────────────────────────────────────────────────
  hodName = 'Vinod Kumar';
  heroDateLine = 'Sunday, 30 August 2026 · auto-refresh 5 min';

  deptPills: DeptPill[] = [
    { label: 'All 3',      dept: null,              count: 20, logged: 17 },
    { label: 'IT',         dept: 'IT',              count: 9,  logged: 8 },
    { label: 'Planning',   dept: 'Planning',        count: 7,  logged: 6 },
    { label: 'Doc Control', dept: 'Document Control', count: 4, logged: 3 }
  ];
  activeDept = 0;
  hodTitle = '17 of 20 logged today · All departments';

  chipForms = 9;
  chipLogs = 63;
  chipNoDpr = 3;
  chipLogged = 17;

  // hero adoption ring: 85.2% of circumference 314 (same as the design)
  heroRingOffset = 314 * (1 - 0.852);
  heroAdoptionText = '85.2%';

  rsLogged = '1 742 h';
  rsExpected = '2 046 h';
  rsWorkingDays = '22';
  rsFulfil = '85.1%';

  // flips true 320ms after view init — drives every width/height/ring transition
  animate = false;

  // ── tiles (data-c / data-s are read imperatively by countUp) ─────────────────
  t1c = '85.2'; t1s: string | null = '%';   t1sub = '17 of 20 logged';
  t2c = '1742'; t2s: string | null = ' h';  t2sub = 'of 2 046 h expected';
  t3c = '72';   t3s: string | null = null;  t3sub = '9 forms · 63 DPR logs';
  t4c = '6';    t4s: string | null = ' d';  t4sub = 'Exit form from 12 Aug';

  // ── trend chart ─────────────────────────────────────────────────────────────
  trendTicks: TrendTick[] = [];
  trendPrePaths: TrendPath[] = [];   // expected (dashed) + adoption lines
  trendAreaD = '';
  trendLoggedD = '';
  trendDots: TrendDot[] = [];

  quoteTopLogger = 'Rahul Menon · 189 h';

  // ── action queues ───────────────────────────────────────────────────────────
  formCount = 9;
  formChip = 'EXIT 4 · BYOD 3 · REJOIN 2';
  formRows: ApRow[] = [
    { color: '#dc2626', icon: 'fas fa-person-walking-arrow-right', ini: 'RM', name: 'Rahul Menon · Exit Form', sub: '12 Aug 09:41 · stage IT', ageCls: 'ah', ageLbl: '6d' },
    { color: '#0ea5e9', icon: 'fas fa-laptop',                     ini: 'AN', name: 'Aisha Nair · BYOD',       sub: 'Laptop · 18 Aug',       ageCls: 'aw', ageLbl: '4d' },
    { color: '#7c3aed', icon: 'fas fa-rotate-left',                ini: 'IB', name: 'Imran Baig · Rejoining',  sub: '26 Aug',                ageCls: 'ao', ageLbl: '2d' }
  ];
  formNote = 'Ageing 0–2: 3 · 3–5: 2 · 6–10: 3 · 10+: 1';

  logCount = 63;
  logChip = '7 EMPLOYEES';
  logRows: ApRow[] = [
    { color: '#138271', icon: null, ini: 'PD', name: 'Priya Das · Site Engineer', sub: '12 pending logs · last activity 2 days ago', ageCls: 'ao', ageLbl: '12' },
    { color: '#6366f1', icon: null, ini: 'RM', name: 'Rahul Menon · Planner',     sub: '11 pending logs · yesterday',                ageCls: 'ao', ageLbl: '11' },
    { color: '#0e7490', icon: null, ini: 'JT', name: 'Joseph Thomas · MEP',       sub: '9 pending logs · today',                     ageCls: 'ao', ageLbl: '9' }
  ];

  // ── team pulse ──────────────────────────────────────────────────────────────
  teamCount = 20;
  team: TeamMember[] = [];

  // ── attendance & punch table ────────────────────────────────────────────────
  attRows: AttRow[] = [];

  // ── DPR not done today ──────────────────────────────────────────────────────
  notDoneCount = 3;
  notDoneRows: ApRow[] = [
    { color: '#dc2626', icon: null, ini: 'SK', name: 'Suresh Kumar (ITS217)', sub: 'Site Engineer · punched 07:42', ageCls: 'ah', ageLbl: '0h' },
    { color: '#dc2626', icon: null, ini: 'AN', name: 'Anjali Nair (ITS309)',  sub: 'Site Engineer · punched 08:05', ageCls: 'ah', ageLbl: '0h' },
    { color: '#64748b', icon: null, ini: 'LM', name: 'Laila Al Maskari',      sub: 'Planner · on approved leave',   ageCls: 'ao', ageLbl: 'LEAVE' }
  ];

  // ── compliance heatmap ──────────────────────────────────────────────────────
  hmapDays: string[] = ['M', 'T', 'W', 'T', 'F', 'S', 'S', 'M', 'T', 'W'];
  hmapRows: HeatRow[] = [];

  // ── top loggers & most consistent ───────────────────────────────────────────
  leadRows: LeadRow[] = [
    { n: 'Rahul Menon — hours',           p: 100, v: '189h',  c: '#138271', tc: '#16a34a' },
    { n: 'Joseph Thomas — hours',         p: 94,  v: '178h',  c: '#138271', tc: '#16a34a' },
    { n: 'Adan Onaparambil — hours',      p: 87,  v: '167h',  c: '#2dd4bf', tc: 'inherit' },
    { n: 'Priya Das — consistency',       p: 96,  v: '95.5%', c: '#0ea5e9', tc: '#16a34a' },
    { n: 'Aisha Nair — consistency',      p: 82,  v: '81.8%', c: '#818cf8', tc: 'inherit' },
    { n: 'Maryam Al Kindi — consistency', p: 64,  v: '63.6%', c: '#f59e0b', tc: '#b45309' }
  ];

  // ── exceptions (computed — no AI) ────────────────────────────────────────────
  lowCount = 4;
  lowRows: ApRow[] = [
    { color: '#dc2626', icon: null, ini: 'SK', name: 'Suresh Kumar (ITS217) · 61.4', sub: '118.0 / 198.0 h · fulfil 59.6% · days 14/22', ageCls: 'ah', ageLbl: 'LOW' },
    { color: '#f59e0b', icon: null, ini: 'MK', name: 'Maryam Al Kindi · 66.2',       sub: '131.5 / 198.0 h · cons 63.6% · rmk 55.0',     ageCls: 'aw', ageLbl: 'MED' }
  ];
  lowNote = 'Flags never shown to the flagged employee.';

  staleCount = 3;
  staleOf = 14;
  staleChip = '572 h UNLOGGED';
  staleRows: ApRow[] = [
    { color: '#dc2626', icon: null, ini: 'AN', name: 'Anjali Nair (ITS309)', sub: 'Target 198.0 h · 22 working days · last log —', ageCls: 'ah', ageLbl: 'NEVER USED' },
    { color: '#f59e0b', icon: null, ini: 'IB', name: 'Imran Baig (ITS144)',  sub: 'Last log 19 Jun 2026',                          ageCls: 'aw', ageLbl: 'STOPPED' }
  ];
  staleNote = 'Complement of "needs attention" — the two lists never repeat a person.';

  remarkAvg = '71.4';
  stackSegs: StackSeg[] = [
    { w: 55, c: '#16a34a' },
    { w: 18, c: '#f59e0b' },
    { w: 9,  c: '#dc2626' },
    { w: 18, c: '#8b5cf6' }
  ];
  stackCounts = { proper: 6, desc: 2, none: 1, dup: 2 };

  auditMonthLabel = 'August 2026 ▾';

  // ── derived expectations (recovered algebraically from the leaderboard) ──────
  private dailyExp = new Map<string, number>();
  private teamDailyExp: number | null = null;
  private workingDaysToDate: number | null = null;

  private timers: ReturnType<typeof setTimeout>[] = [];
  private intervals: ReturnType<typeof setInterval>[] = [];
  private subs: Subscription[] = [];
  // one live handle per counter element — never a growing list, the 5-minute
  // refresh would otherwise append ~320 dead raf ids per cycle
  private countRafs = new Map<HTMLElement, number>();
  private countSnaps = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  private animateTimer: ReturnType<typeof setTimeout> | null = null;
  // hero numbers from the LAST payload — the title must agree with the chips
  private heroLogged = 0;
  private heroTeam = 0;

  private static readonly MAX_AP = 3;
  private static readonly AV_PALETTE = ['#138271', '#6366f1', '#0e7490', '#0ea5e9', '#7c3aed', '#f59e0b', '#0369a1', '#b45309'];
  private static readonly LEAD_PALETTE = ['#138271', '#138271', '#2dd4bf', '#0ea5e9', '#818cf8', '#f59e0b'];

  constructor(
    private el: ElementRef<HTMLElement>,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private api: Api
  ) {
    this.buildTrend();
    this.buildTeam();
    this.buildAttendance();
    this.buildHeatmap();
  }

  // ── lifecycle ───────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const u = this.readUser();
    this.hodId = u.id;
    // never leave the demo name standing for a real signed-in HOD
    if (u.name) { this.hodName = u.name; } else if (u.id) { this.hodName = u.id; }

    if (!this.hodId) {
      // "-demo" routes bypass the auth guard but the API needs a JWT — keep the
      // approved design fully visible rather than showing an error wall.
      // But clear the seeds first: they name invented employees ("Suresh Kumar
      // (ITS217)") under headings like "DPR not done today" and "Low fulfilment".
      // Left standing, a fabricated compliance flag reads as a real one.
      this.clearForFirstLoad();
      this.firstLoadDone = true;
      this.loadError = 'Sign in to load live data';
      return;
    }
    this.load(null, true);
    // the hero promises "auto-refresh 5 min" — so actually wire it.
    // `replay: false` — a background refresh must not tear the page down and
    // re-animate it while the HOD is reading.
    this.intervals.push(setInterval(() => {
      if (!this.loading) { this.load(this.currentDept, false); }
    }, 300000));
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    // count-ups + stroke draw-on are pure DOM decoration — run outside Angular
    this.zone.runOutsideAngular(() => {
      this.runCounters();
      this.drawPaths();
    });
    // same 320ms delay as the design before widths / heights / rings transition in
    this.armAnimate();
  }

  ngOnDestroy(): void {
    this.timers.forEach(t => clearTimeout(t));
    this.intervals.forEach(i => clearInterval(i));
    if (this.animateTimer !== null) { clearTimeout(this.animateTimer); }
    this.countRafs.forEach(id => cancelAnimationFrame(id));
    this.countSnaps.forEach(t => clearTimeout(t));
    this.countRafs.clear();
    this.countSnaps.clear();
    this.subs.forEach(s => s.unsubscribe());
  }

  trackMember = (_: number, m: TeamMember): string => m.id;

  // dept pill click — sets the scope, rewrites the hero title and refetches
  selectDept(i: number): void {
    if (i < 0 || i >= this.deptPills.length) { return; }
    this.activeDept = i;
    const pill = this.deptPills[i];
    this.currentDept = pill.dept;
    this.hodTitle = this.titleFor(pill);
    if (this.hodId) { this.load(this.currentDept, true); }
  }

  // ── HTTP ────────────────────────────────────────────────────────────────────
  /** `replay` — run the full entrance choreography (first load / explicit click). */
  private load(dept: string | null, replay: boolean): void {
    const seq = ++this.reqSeq;
    this.loading = true;
    this.loadError = null;
    if (!this.firstLoadDone) { this.clearForFirstLoad(); }

    const sub = this.api.getDprHodDashboard(this.hodId, dept).subscribe({
      next: (res: any) => {
        if (seq !== this.reqSeq) { return; }        // a newer pill click won
        this.loading = false;
        this.firstLoadDone = true;
        if (res?.success === false) {
          this.loadError = (res?.message as string) || 'Could not load live data';
          return;
        }
        const d = res?.data ?? null;
        if (!d) { this.loadError = 'No dashboard data returned'; return; }
        this.applyAll(d);
        this.replayAnimations(replay);
      },
      error: (err: any) => {
        if (seq !== this.reqSeq) { return; }
        this.loading = false;
        this.firstLoadDone = true;
        // a proc/validation failure arrives as a non-2xx with the ServiceResponse
        // still in the body — show that message instead of a generic one
        const body = err?.error;
        const msg = typeof body?.message === 'string' ? body.message.trim() : '';
        this.loadError = err?.status === 401
          ? 'Session expired — sign in again to load live data'
          : (msg || 'Could not load live data');
      }
    });
    this.subs.push(sub);
  }

  private readUser(): { id: string; name: string } {
    try {
      const u = JSON.parse(localStorage.getItem('current_user') || '{}') as Record<string, unknown>;
      const pick = (k: string) => (typeof u[k] === 'string' ? (u[k] as string).trim() : '');
      return {
        id: pick('empId') || pick('employeeId'),
        name: pick('empName') || pick('employeeName') || pick('fullName') || pick('userName') || pick('name')
      };
    } catch {
      return { id: '', name: '' };
    }
  }

  /** Wipe the demo seeds the first time a real request goes out, so a signed-in
   *  HOD never sees sample names/numbers. Every card keeps its markup and shows
   *  a calm inline empty state until the payload lands. */
  private clearForFirstLoad(): void {
    this.hodTitle = 'Loading department pulse…';
    // the pills are seeded with sample departments — they survive a failed load
    // otherwise, and clicking one would scope a real request to a fake department
    this.deptPills = []; this.activeDept = 0; this.currentDept = null;
    this.heroLogged = 0; this.heroTeam = 0;
    this.chipForms = 0; this.chipLogs = 0; this.chipNoDpr = 0; this.chipLogged = 0;
    this.heroRingOffset = 314; this.heroAdoptionText = '—';
    this.rsLogged = '—'; this.rsExpected = '—'; this.rsWorkingDays = '—'; this.rsFulfil = '—';
    this.t1c = '0'; this.t1sub = '—';
    this.t2c = '0'; this.t2sub = '—';
    this.t3c = '0'; this.t3sub = '—';
    this.t4c = '0'; this.t4sub = '—';
    this.trendTicks = []; this.trendPrePaths = []; this.trendAreaD = ''; this.trendLoggedD = ''; this.trendDots = [];
    this.quoteTopLogger = '—';
    this.formCount = 0; this.formChip = 'NO PENDING FORMS'; this.formRows = []; this.formNote = '';
    this.logCount = 0; this.logChip = '0 EMPLOYEES'; this.logRows = [];
    this.teamCount = 0; this.team = []; this.attRows = [];
    this.notDoneCount = 0; this.notDoneRows = [];
    this.hmapRows = [];
    this.leadRows = [];
    this.lowCount = 0; this.lowRows = [];
    this.staleCount = 0; this.staleOf = 0; this.staleChip = '0 h UNLOGGED'; this.staleRows = [];
    this.remarkAvg = '—';
    this.stackSegs = [];
    this.stackCounts = { proper: 0, desc: 0, none: 0, dup: 0 };
  }

  // ── payload → view models ───────────────────────────────────────────────────
  private applyAll(d: any): void {
    const depts: DprHodDept[]              = d?.departments ?? [];
    const summary: DprHodSummary | null    = d?.summary ?? null;
    const trend: DprHodTrendDay[]          = d?.trend ?? [];
    const formQueue: DprHodFormQueueItem[] = d?.formQueue ?? [];
    const logQueue: DprHodLogQueueItem[]   = d?.logQueue ?? [];
    const teamRaw: DprHodTeamMember[]      = d?.team ?? [];
    const attendance: DprHodAttendanceRow[] = d?.attendance ?? [];
    const notDone: DprHodNotDone[]         = d?.notDone ?? [];
    const heatmap: DprHodHeatmapCell[]     = d?.heatmap ?? [];
    const leaderboard: DprHodLeaderboardRow[] = d?.leaderboard ?? [];
    const exceptions: DprHodException[]    = d?.exceptions ?? [];

    // cursor 1 is never dept-scoped — cache the pills from the first response
    if (!this.pillsLoaded) { this.applyDeptPills(depts); this.pillsLoaded = true; }

    const members = this.dedupeTeam(teamRaw);
    this.deriveExpectations(leaderboard);

    const attByEmp = new Map<string, DprHodAttendanceRow>();
    attendance.forEach(a => { const k = this.key(a.empId); if (k) { attByEmp.set(k, a); } });
    const leaveByEmp = new Map<string, boolean>();
    members.forEach(m => { const k = this.key(m.empId); if (k) { leaveByEmp.set(k, m.onLeaveToday === 'Y'); } });
    const lbByEmp = new Map<string, DprHodLeaderboardRow>();
    leaderboard.forEach(r => { const k = this.key(r.empId); if (k) { lbByEmp.set(k, r); } });

    this.applyHero(summary, notDone, formQueue);
    this.applyTrend(trend, summary);
    this.applyFormQueue(formQueue, summary);
    this.applyLogQueue(logQueue, summary);
    this.applyTeam(members, attByEmp);
    this.applyAttendance(attendance, leaveByEmp);
    this.applyNotDone(notDone, members);
    this.applyHeatmap(heatmap, trend, members);
    this.applyLeaderboard(leaderboard);
    this.applyExceptions(exceptions, lbByEmp, members.length);

    if (summary?.monthKey) { this.auditMonthLabel = this.monthLabel(summary.monthKey) + ' ▾'; }
    // the pill counts are cached from the FIRST response only, so the title must
    // come from this payload's summary — otherwise it contradicts the hero chips
    // and the adoption ring after every auto-refresh
    const pill = this.deptPills[this.activeDept] ?? this.deptPills[0] ?? null;
    if (pill) {
      this.hodTitle = this.heroLogged + ' of ' + this.heroTeam + ' logged today · ' + (pill.dept ?? 'All departments');
    }
  }

  private applyDeptPills(depts: DprHodDept[]): void {
    const rows = depts.filter(r => this.key(r.department));
    const total = rows.reduce((a, r) => a + this.num(r.teamCount), 0);
    const logged = rows.reduce((a, r) => a + this.num(r.loggedToday), 0);
    this.deptPills = [
      { label: 'All ' + rows.length, dept: null, count: total, logged },
      ...rows.map(r => ({
        label: (r.department ?? '').trim(),
        dept: (r.department ?? '').trim(),
        count: this.num(r.teamCount),
        logged: this.num(r.loggedToday)
      }))
    ];
    if (this.activeDept >= this.deptPills.length) { this.activeDept = 0; this.currentDept = null; }
  }

  private titleFor(p: DeptPill): string {
    return p.logged + ' of ' + p.count + ' logged today · ' + (p.dept ?? 'All departments');
  }

  private applyHero(s: DprHodSummary | null, notDone: DprHodNotDone[], forms: DprHodFormQueueItem[]): void {
    const team = this.num(s?.teamCount);
    const logged = this.num(s?.loggedToday);
    const monthHours = this.num(s?.monthHours);
    const expected = this.num(s?.expectedHoursToDate);
    const pf = this.num(s?.pendingFormApprovals);
    const pl = this.num(s?.pendingLogApprovals);

    this.teamCount = team;
    this.heroLogged = logged;
    this.heroTeam = team;
    if (s?.theDate) { this.heroDateLine = this.longDate(s.theDate) + ' · auto-refresh 5 min'; }

    const adoption = team > 0 ? this.clamp(logged / team * 100, 0, 100) : 0;
    this.heroRingOffset = 314 * (1 - adoption / 100);
    this.heroAdoptionText = team > 0 ? adoption.toFixed(1) + '%' : '—';

    this.chipForms = pf;
    this.chipLogs = pl;
    this.chipNoDpr = notDone.length;
    this.chipLogged = logged;

    this.rsLogged = this.fmtNum(monthHours, 0) + ' h';
    this.rsExpected = this.fmtNum(expected, 0) + ' h';
    // WorkingDaysToDate is not a cursor column — recovered from the leaderboard
    // (daysReported / consistencyPct). '—' when the algebra is unavailable.
    this.rsWorkingDays = this.workingDaysToDate != null ? String(Math.round(this.workingDaysToDate)) : '—';
    this.rsFulfil = expected > 0 ? (monthHours / expected * 100).toFixed(1) + '%' : '—';

    // tiles — keep ONE decimal on tile 1, countUp infers dec from the string
    this.t1c = team > 0 ? adoption.toFixed(1) : '0.0';
    this.t1s = '%';
    this.t1sub = team > 0 ? logged + ' of ' + team + ' logged' : 'No team members in scope';

    this.t2c = String(Math.round(monthHours));
    this.t2s = ' h';
    this.t2sub = expected > 0 ? 'of ' + this.fmtNum(expected, 0) + ' h expected' : 'no expected hours yet';

    this.t3c = String(pf + pl);
    this.t3s = null;
    this.t3sub = pf + ' forms · ' + pl + ' DPR logs';

    const oldest = forms
      .map(f => this.daysSince(f.requestDate))
      .filter((v): v is number => v != null);
    if (oldest.length) {
      const max = Math.max(...oldest);
      const which = forms.find(f => this.daysSince(f.requestDate) === max);
      this.t4c = String(max);
      this.t4s = ' d';
      this.t4sub = (which?.formType ?? 'Form') + ' from ' + this.shortDate(which?.requestDate);
    } else {
      this.t4c = '0';
      this.t4s = ' d';
      this.t4sub = 'Nothing pending';
    }
  }

  /** PKG_DPR_DASH does not expose working days or the per-day expected hours.
   *  Both are recoverable from the leaderboard, which returns
   *  consistencyPct = daysReported / workingDays * 100 and
   *  expectedHours  = workingDays * dailyExpected. */
  private deriveExpectations(lb: DprHodLeaderboardRow[]): void {
    this.dailyExp.clear();
    this.teamDailyExp = null;
    this.workingDaysToDate = null;
    const wds: number[] = [];
    const dailies: number[] = [];
    for (const r of lb) {
      const dr = this.num(r.daysReported);
      const cp = this.num(r.consistencyPct);
      const eh = this.num(r.expectedHours);
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
    if (k && this.dailyExp.has(k)) { return this.dailyExp.get(k) ?? null; }
    return this.teamDailyExp;
  }

  // ── trend: 14-day team compliance ───────────────────────────────────────────
  private applyTrend(rows: DprHodTrendDay[], s: DprHodSummary | null): void {
    const W = 660, H = 170, P = 30;
    const n = rows.length;
    if (n < 2) {
      // x() divides by (n-1) — a single row would put NaN in every path `d`
      this.trendTicks = []; this.trendPrePaths = [];
      this.trendAreaD = ''; this.trendLoggedD = ''; this.trendDots = [];
      return;
    }
    const teamCount = this.num(s?.teamCount);
    const avgDaily = this.teamDailyExp ?? 0;

    const logged = rows.map(r => this.num(r.totalHours));
    const expected = rows.map(r => {
      const present = Math.max(this.num(r.membersPunched), this.num(r.membersLogged));
      return this.r2(present * avgDaily);
    });
    const adoptionPct = rows.map(r => {
      const den = this.num(r.membersPunched) || teamCount;
      return den > 0 ? this.clamp(this.num(r.membersLogged) / den * 100, 0, 100) : 0;
    });

    const peak = Math.max(1, ...logged, ...expected);
    const max = Math.max(40, Math.ceil(peak / 40) * 40);
    const scale = max / 100;                    // maps 100% onto the axis top
    const adoption = adoptionPct.map(v => v * scale);

    const x = (i: number) => P + i * (W - 2 * P) / (n - 1);
    const y = (v: number) => H - 18 - (v / max) * (H - 40);
    const lineD = (d: number[]) => 'M' + d.map((v, i) => this.r2(x(i)) + ',' + this.r2(y(v))).join(' L');

    this.trendTicks = [max / 4, max / 2, max * 3 / 4, max].map(v => ({ v: Math.round(v), y: this.r2(y(v)) }));
    this.trendPrePaths = [
      { d: lineD(expected), c: '#94a3b8', w: 1.8, dash: true,  o: 1 },
      { d: lineD(adoption), c: '#6366f1', w: 1.8, dash: false, o: .75 }
    ];
    this.trendLoggedD = lineD(logged);
    this.trendAreaD = this.trendLoggedD +
      ' L' + this.r2(x(n - 1)) + ',' + (H - 18) + ' L' + this.r2(x(0)) + ',' + (H - 18) + ' Z';
    this.trendDots = logged.map((v, i) => {
      const today = rows[i]?.isToday === 'Y';
      return { cx: this.r2(x(i)), cy: this.r2(y(v)), r: today ? 4.6 : 2.6, f: today ? '#4f46e5' : '#138271' };
    });
  }

  // ── forms awaiting approval ─────────────────────────────────────────────────
  private applyFormQueue(rows: DprHodFormQueueItem[], s: DprHodSummary | null): void {
    this.formCount = this.num(s?.pendingFormApprovals) || rows.length;

    const byType = new Map<string, number>();
    rows.forEach(r => {
      const t = (r.formType ?? '').trim() || 'OTHER';
      byType.set(t, (byType.get(t) ?? 0) + 1);
    });
    this.formChip = byType.size
      ? Array.from(byType.entries()).map(([t, c]) => this.shortType(t) + ' ' + c).join(' · ')
      : 'NO PENDING FORMS';

    this.formRows = rows.slice(0, DprHodDashboardComponent.MAX_AP).map(r => {
      const look = this.formLook(r.formType);
      const age = this.daysSince(r.requestDate);
      return {
        color: look.c,
        icon: look.i,
        ini: this.initials(r.employeeName),
        name: (r.employeeName ?? '—') + ' · ' + ((r.formType ?? '').trim() || 'Form'),
        sub: this.shortDate(r.requestDate) + ' · stage ' + ((r.approverRole ?? '').trim() || '—'),
        ageCls: age == null ? 'ao' : age > 5 ? 'ah' : age >= 3 ? 'aw' : 'ao',
        ageLbl: age == null ? '—' : age + 'd'
      };
    });

    // ageing buckets over ALL rows, not just the three shown
    const b = [0, 0, 0, 0];
    rows.forEach(r => {
      const a = this.daysSince(r.requestDate);
      if (a == null) { return; }
      if (a <= 2) { b[0]++; } else if (a <= 5) { b[1]++; } else if (a <= 10) { b[2]++; } else { b[3]++; }
    });
    const more = rows.length - this.formRows.length;
    this.formNote = (more > 0 ? '+' + more + ' more · ' : '') +
      'Ageing 0–2: ' + b[0] + ' · 3–5: ' + b[1] + ' · 6–10: ' + b[2] + ' · 10+: ' + b[3];
  }

  // ── DPR logs awaiting approval ──────────────────────────────────────────────
  private applyLogQueue(rows: DprHodLogQueueItem[], s: DprHodSummary | null): void {
    const summed = rows.reduce((a, r) => a + this.num(r.pendingLogCount), 0);
    this.logCount = this.num(s?.pendingLogApprovals) || summed;
    this.logChip = rows.length + (rows.length === 1 ? ' EMPLOYEE' : ' EMPLOYEES');
    this.logRows = rows.slice(0, DprHodDashboardComponent.MAX_AP).map((r, i) => ({
      color: this.avColor(i),
      icon: null,
      ini: this.initials(r.employeeName),
      name: (r.employeeName ?? '—') + ' · ' + ((r.designation ?? '').trim() || '—'),
      sub: this.num(r.pendingLogCount) + ' pending logs · ' + this.relDate(r.lastActivityDate),
      ageCls: 'ao',
      ageLbl: String(this.num(r.pendingLogCount))
    }));
  }

  // ── team pulse cards ────────────────────────────────────────────────────────
  private applyTeam(members: DprHodTeamMember[], att: Map<string, DprHodAttendanceRow>): void {
    const sc: Record<TeamMember['s'], string> = {
      run: '#138271', pause: '#b45309', break: '#0369a1', none: '#dc2626', leave: '#64748b'
    };
    const pill: Record<TeamMember['s'], { cls: string; lbl: string }> = {
      run:   { cls: 'pr',  lbl: 'RUNNING' },
      pause: { cls: 'pp',  lbl: 'PAUSED' },
      break: { cls: 'pbk', lbl: 'ON BREAK' },
      none:  { cls: 'pl',  lbl: 'NO LOG' },
      leave: { cls: 'pi',  lbl: 'LEAVE' }
    };

    this.team = members.map((m, i) => {
      const todayMin = this.num(m.todayMin);
      const running = m.runningNow === 'Y';
      const onLeave = m.onLeaveToday === 'Y';
      const punches = this.num(m.punchCount);
      const s: TeamMember['s'] = onLeave ? 'leave'
        : running ? 'run'
        : todayMin > 0 ? 'pause'
        : 'none';

      const de = this.dailyExpFor(m.empId);
      const p = de && de > 0 ? Math.round(todayMin / (de * 60) * 100) : 0;
      const a = att.get(this.key(m.empId));

      return {
        id: this.key(m.empId) || this.key(m.employeeName) || String(i),
        n: (m.employeeName ?? '—').trim() || '—',
        r: (m.designation ?? '').trim() || '—',
        h: (todayMin / 60).toFixed(1),
        p,
        s,
        t: running ? ((m.runningTaskTitle ?? '').trim() || 'Timer running')
          : onLeave ? 'Approved leave'
          : todayMin > 0 ? 'Logged · timer stopped'
          : punches > 0 ? 'Punched · no timer'
          : 'No punch · no timer',
        in: (a?.firstPunch ?? m.lastPunch ?? '').trim() || '—',
        out: this.num(a?.punchCount ?? m.punchCount) > 1 ? ((a?.lastPunch ?? m.lastPunch ?? '').trim() || '—') : '—',
        ini: this.initials(m.employeeName),
        img: this.imgSrc(m.profileImageBase64),
        exp: de && de > 0 ? this.fmtHours(de) + 'h' : '—',
        color: sc[s],
        pillClass: pill[s].cls,
        pillLabel: pill[s].lbl,
        anim: 'memin .5s ' + (i * 50) + 'ms cubic-bezier(.22,1,.36,1)',
        ringOff: 94 * (1 - this.clamp(p, 0, 100) / 100)
      };
    });
  }

  // ── attendance & punch — today ──────────────────────────────────────────────
  private applyAttendance(rows: DprHodAttendanceRow[], leave: Map<string, boolean>): void {
    this.attRows = rows.map(r => {
      const punches = this.num(r.punchCount);
      const loggedMin = this.num(r.loggedMin);
      const breakMin = this.num(r.breakMin);
      const gapMin = r.gapMin ?? null;
      const onLeave = leave.get(this.key(r.empId)) === true;
      // GapMin is GREATEST(span - logged - break, 0) inside the proc, so inverting
      // it invents office time whenever logged + break outran the punch span (a
      // single punch gives span 0 and gap 0). Trust the measured span when the
      // proc sends it; otherwise only invert when the floor provably did not bind.
      const measured = r.elapsedMin != null ? this.num(r.elapsedMin) : null;
      const elapsed = measured != null
        ? measured
        : (gapMin != null && gapMin > 0 && punches > 1 ? gapMin + loggedMin + breakMin : null);
      const residual = elapsed != null ? elapsed - loggedMin - breakMin : null;
      const g = residual != null && residual >= 0 ? residual / 60 : -1;
      return {
        n: (r.employeeName ?? '—').trim() || '—',
        in: (r.firstPunch ?? '').trim() || '—',
        out: punches > 1 ? ((r.lastPunch ?? '').trim() || '—') : '—',
        off: onLeave && punches === 0 ? 'On leave' : elapsed != null ? this.hm(elapsed) : '—',
        dpr: loggedMin > 0 ? (loggedMin / 60).toFixed(1) + 'h' : onLeave && punches === 0 ? '—' : '0.0h',
        dprColor: loggedMin === 0 ? 'var(--bad)' : 'var(--teal)',
        hasGap: g >= 0,
        gapLabel: g < 0 ? '—' : g.toFixed(1) + 'h',
        gapCls: g < 0 ? '' : g <= 1.5 ? 'gok' : g <= 3 ? 'gwn' : 'gbd'
      };
    });
  }

  // ── DPR not done — today ────────────────────────────────────────────────────
  private applyNotDone(rows: DprHodNotDone[], members: DprHodTeamMember[]): void {
    this.notDoneCount = rows.length;
    const main: ApRow[] = rows.slice(0, DprHodDashboardComponent.MAX_AP).map(r => ({
      color: '#dc2626',
      icon: null,
      ini: this.initials(r.employeeName),
      name: (r.employeeName ?? '—') + ((r.empId ?? '').trim() ? ' (' + (r.empId ?? '').trim() + ')' : ''),
      sub: ((r.designation ?? '').trim() || '—') + ' · punched ' + ((r.firstPunch ?? '').trim() || '—'),
      ageCls: 'ah',
      ageLbl: '0h'
    }));
    // P_CUR_NOT_DONE requires a punch today, so people on approved leave can
    // never appear in it — append them from the team cursor instead.
    const onLeave = members.filter(m => m.onLeaveToday === 'Y').slice(0, 1).map(m => ({
      color: '#64748b',
      icon: null,
      ini: this.initials(m.employeeName),
      name: (m.employeeName ?? '—').trim() || '—',
      sub: ((m.designation ?? '').trim() || '—') + ' · on approved leave',
      ageCls: 'ao',
      ageLbl: 'LEAVE'
    }));
    this.notDoneRows = [...main, ...onLeave];
  }

  // ── compliance heatmap — member × day ───────────────────────────────────────
  private applyHeatmap(cells: DprHodHeatmapCell[], trend: DprHodTrendDay[], members: DprHodTeamMember[]): void {
    if (!cells.length) { this.hmapRows = []; return; }

    // column order comes from the data — the API returns 10 days
    const dates: string[] = [];
    const dayName = new Map<string, string>();
    cells.forEach(c => {
      const d = (c.theDate ?? '').trim();
      if (!d) { return; }
      if (!dayName.has(d)) { dayName.set(d, (c.dayName ?? '').trim()); dates.push(d); }
    });
    dates.sort();
    this.hmapDays = dates.map(d => (dayName.get(d) ?? '?').charAt(0).toUpperCase());

    // a day nobody punched AND nobody logged is a non-working day for everyone
    const offDay = new Set<string>();
    trend.forEach(t => {
      const d = (t.theDate ?? '').trim();
      if (d && this.num(t.membersPunched) === 0 && this.num(t.membersLogged) === 0) { offDay.add(d); }
    });
    const leaveToday = new Map<string, boolean>();
    members.forEach(m => { const k = this.key(m.empId); if (k) { leaveToday.set(k, m.onLeaveToday === 'Y'); } });
    const today = (trend.find(t => t.isToday === 'Y')?.theDate ?? '').trim();

    const order: string[] = [];
    const byEmp = new Map<string, { name: string; hours: Map<string, number> }>();
    cells.forEach(c => {
      const k = this.key(c.empId) || this.key(c.employeeName);
      if (!k) { return; }
      let row = byEmp.get(k);
      if (!row) {
        row = { name: (c.employeeName ?? '').trim(), hours: new Map<string, number>() };
        byEmp.set(k, row);
        order.push(k);
      }
      const d = (c.theDate ?? '').trim();
      if (d) { row.hours.set(d, this.num(c.hours)); }
    });

    const col = (v: number) =>
      v < 0 ? '#e2e8f0' : v === 0 ? '#fecdd3' : v < 60 ? '#fde68a' : v < 85 ? '#a7f3d0' : v < 105 ? '#2dd4bf' : '#0f766e';

    this.hmapRows = order.map(k => {
      const row = byEmp.get(k)!;
      const de = this.dailyExpFor(k);
      const first = (row.name.trim().split(/\s+/).filter(Boolean)[0]) || k;
      return {
        n: first,
        cells: dates.map(d => {
          const hrs = row.hours.get(d) ?? 0;
          const off = offDay.has(d) || (d === today && leaveToday.get(k) === true);
          const v = off ? -1 : de && de > 0 ? Math.round(hrs / de * 100) : hrs > 0 ? 100 : 0;
          return {
            bg: col(v),
            fg: (v < 0 || v < 85) ? '#334155' : '#fff',
            label: v < 0 ? '' : String(v),
            title: first + ' ' + d + ': ' + (v < 0 ? 'non-working / leave' : v + '%')
          };
        })
      };
    });
  }

  // ── top loggers & most consistent ───────────────────────────────────────────
  private applyLeaderboard(rows: DprHodLeaderboardRow[]): void {
    if (!rows.length) { this.leadRows = []; this.quoteTopLogger = '—'; return; }

    const byHours = [...rows].sort((a, b) => this.num(b.monthHours) - this.num(a.monthHours)).slice(0, 3);
    const byCons = [...rows].sort((a, b) => this.num(b.consistencyPct) - this.num(a.consistencyPct)).slice(0, 3);
    const topHours = this.num(byHours[0]?.monthHours);

    const tc = (pct: number) => pct >= 90 ? '#16a34a' : pct >= 70 ? 'inherit' : '#b45309';
    const out: LeadRow[] = [];

    byHours.forEach(r => {
      const h = this.num(r.monthHours);
      const p = topHours > 0 ? this.clamp(h / topHours * 100, 0, 100) : 0;
      out.push({
        n: ((r.employeeName ?? '—').trim() || '—') + ' — hours',
        p: Math.round(p),
        v: this.fmtHours(h) + 'h',
        c: DprHodDashboardComponent.LEAD_PALETTE[out.length] ?? '#138271',
        tc: tc(p)
      });
    });
    byCons.forEach(r => {
      const pct = this.num(r.consistencyPct);
      out.push({
        n: ((r.employeeName ?? '—').trim() || '—') + ' — consistency',
        p: Math.round(this.clamp(pct, 0, 100)),
        v: pct.toFixed(1) + '%',
        c: DprHodDashboardComponent.LEAD_PALETTE[out.length] ?? '#0ea5e9',
        tc: tc(pct)
      });
    });
    this.leadRows = out;

    const top = byHours[0];
    this.quoteTopLogger = top
      ? ((top.employeeName ?? '—').trim() || '—') + ' · ' + this.fmtHours(this.num(top.monthHours)) + ' h'
      : '—';
  }

  // ── exceptions — pure SQL, never an AI call ─────────────────────────────────
  private applyExceptions(rows: DprHodException[], lb: Map<string, DprHodLeaderboardRow>, teamSize: number): void {
    const low = rows.filter(r => (r.excType ?? '').trim().toUpperCase() === 'LOW_FULFIL');
    const stale = rows.filter(r => (r.excType ?? '').trim().toUpperCase() === 'STALE');
    const dup = rows.filter(r => (r.excType ?? '').trim().toUpperCase() === 'REMARK_DUP');
    const wd = this.workingDaysToDate != null ? String(Math.round(this.workingDaysToDate)) : '—';

    // ── LOW_FULFIL ──
    this.lowCount = low.length;
    this.lowRows = low.slice(0, DprHodDashboardComponent.MAX_AP).map(r => {
      const m = lb.get(this.key(r.empId));
      const metric = this.num(r.metricValue);
      const id = (r.empId ?? '').trim();
      const comp = m?.compositeScore != null ? ' · ' + this.num(m.compositeScore).toFixed(1) : '';
      const extra = m
        ? ' · fulfil ' + this.num(m.fulfilPct).toFixed(1) + '% · days ' + this.num(m.daysReported) + '/' + wd
        : '';
      return {
        color: metric < 65 ? '#dc2626' : '#f59e0b',
        icon: null,
        ini: this.initials(r.employeeName),
        name: ((r.employeeName ?? '—').trim() || '—') + (id ? ' (' + id + ')' : '') + comp,
        sub: ((r.detail ?? '').trim() || '—') + extra,
        ageCls: metric < 65 ? 'ah' : 'aw',
        ageLbl: metric < 65 ? 'LOW' : 'MED'
      };
    });
    const lowMore = low.length - this.lowRows.length;
    this.lowNote = (lowMore > 0 ? '+' + lowMore + ' more · ' : '') + 'Flags never shown to the flagged employee.';

    // ── STALE (de-duplicated against LOW_FULFIL so the card note stays true) ──
    const lowIds = new Set(low.map(r => this.key(r.empId)).filter(Boolean));
    const staleOnly = stale.filter(r => !lowIds.has(this.key(r.empId)));
    this.staleCount = staleOnly.length;
    this.staleOf = teamSize;
    const unlogged = staleOnly.reduce((a, r) => {
      const m = lb.get(this.key(r.empId));
      return a + Math.max(this.num(m?.expectedHours) - this.num(m?.monthHours), 0);
    }, 0);
    this.staleChip = this.fmtNum(Math.round(unlogged), 0) + ' h UNLOGGED';
    this.staleRows = staleOnly.slice(0, DprHodDashboardComponent.MAX_AP).map(r => {
      const m = lb.get(this.key(r.empId));
      const never = this.num(r.metricValue) >= 999;
      const id = (r.empId ?? '').trim();
      const target = m?.expectedHours != null
        ? ' · Target ' + this.fmtHours(this.num(m.expectedHours)) + ' h · ' + wd + ' working days'
        : '';
      return {
        color: never ? '#dc2626' : '#f59e0b',
        icon: null,
        ini: this.initials(r.employeeName),
        name: ((r.employeeName ?? '—').trim() || '—') + (id ? ' (' + id + ')' : ''),
        sub: ((r.detail ?? '').trim() || '—') + target,
        ageCls: never ? 'ah' : 'aw',
        ageLbl: never ? 'NEVER USED' : 'STOPPED'
      };
    });
    const staleMore = staleOnly.length - this.staleRows.length;
    this.staleNote = (staleMore > 0 ? '+' + staleMore + ' more · ' : '') +
      'Complement of "needs attention" — the two lists never repeat a person.';

    // ── REMARK discipline ──
    const scores = Array.from(lb.values()).map(r => this.num(r.remarkScore));
    const dupIds = new Set(dup.map(r => this.key(r.empId)).filter(Boolean));
    let proper = 0, desc = 0, none = 0;
    lb.forEach((r, id) => {
      if (dupIds.has(id)) { return; }              // copy-paste bucket wins
      const sc = this.num(r.remarkScore);
      if (sc >= 85) { proper++; } else if (sc >= 50) { desc++; } else { none++; }
    });
    const dupCount = Array.from(dupIds).filter(id => lb.has(id)).length;
    const total = proper + desc + none + dupCount;
    this.stackCounts = { proper, desc, none, dup: dupCount };
    this.stackSegs = total > 0 ? [
      { w: this.r2(proper / total * 100),   c: '#16a34a' },
      { w: this.r2(desc / total * 100),     c: '#f59e0b' },
      { w: this.r2(none / total * 100),     c: '#dc2626' },
      { w: this.r2(dupCount / total * 100), c: '#8b5cf6' }
    ] : [];
    this.remarkAvg = scores.length
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : '—';
  }

  // ── animation replay after real data lands ──────────────────────────────────
  private replayAnimations(full: boolean): void {
    if (!this.viewReady) { return; }              // ngAfterViewInit will do it
    if (!full) {
      // background refresh: write the new values and let the existing CSS
      // transitions interpolate to them — no teardown, no re-entrance animation
      this.cdr.detectChanges();
      this.zone.runOutsideAngular(() => this.snapCounters());
      return;
    }
    this.animate = false;
    this.cdr.detectChanges();                     // write the new attrs / path d
    this.zone.runOutsideAngular(() => {
      this.runCounters();
      this.drawPaths();
    });
    this.armAnimate();
  }

  /** single live handle — re-arming must never leave an orphan timeout behind */
  private armAnimate(): void {
    if (this.animateTimer !== null) { clearTimeout(this.animateTimer); }
    this.animateTimer = setTimeout(() => { this.animate = true; this.animateTimer = null; }, 320);
  }

  private runCounters(): void {
    const gen = ++this.countGen;
    const counters = this.el.nativeElement.querySelectorAll<HTMLElement>('[data-c]');
    counters.forEach(c => this.countUp(c, gen));
  }

  /** final values only — used by the silent background refresh */
  private snapCounters(): void {
    this.countGen++;                              // stop any count-up in flight
    this.el.nativeElement.querySelectorAll<HTMLElement>('[data-c]').forEach(el => {
      const raw = String(el.getAttribute('data-c'));
      const t = parseFloat(raw);
      if (!isFinite(t)) { return; }
      el.textContent = this.fmtCounter(t, raw, el.getAttribute('data-s') || '');
    });
  }

  private fmtCounter(v: number, raw: string, suffix: string): string {
    const dec = raw.indexOf('.') > -1 ? raw.split('.')[1].length : 0;
    return v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + suffix;
  }

  // ── count-up numbers: cubic ease-out ~1.3s + safety snap after 1.5s ─────────
  private countUp(el: HTMLElement, gen: number): void {
    const raw = String(el.getAttribute('data-c'));
    const t = parseFloat(raw);
    if (!isFinite(t)) { return; }
    const s = el.getAttribute('data-s') || '';
    const fmt = (v: number) => this.fmtCounter(v, raw, s);
    const ease = (p: number) => 1 - Math.pow(1 - p, 3);
    // one live raf + one live snap per element — the arrays used to grow by ~78
    // dead ids per counter on every 5-minute refresh
    const prevRaf = this.countRafs.get(el);
    if (prevRaf !== undefined) { cancelAnimationFrame(prevRaf); }
    const prevSnap = this.countSnaps.get(el);
    if (prevSnap !== undefined) { clearTimeout(prevSnap); }
    el.textContent = fmt(t);            // final value first — never left blank
    let live = false;
    const t0 = performance.now();
    const step = (now: number) => {
      if (gen !== this.countGen) { this.countRafs.delete(el); return; }   // newer payload took over
      const p = Math.min((now - t0) / 1300, 1);
      live = p < 1;
      el.textContent = fmt(t * ease(p));
      if (p < 1) { this.countRafs.set(el, requestAnimationFrame(step)); } else { this.countRafs.delete(el); }
    };
    this.countRafs.set(el, requestAnimationFrame(step));
    this.countSnaps.set(el, setTimeout(() => {
      this.countSnaps.delete(el);
      if (live && gen === this.countGen) { el.textContent = fmt(t); }
    }, 1500));
  }

  // ── stroke draw-on for the trend chart paths (design's drawPaths()) ─────────
  private drawPaths(): void {
    const paths = this.el.nativeElement.querySelectorAll<SVGPathElement>('.chart svg path[stroke]');
    paths.forEach((p, i) => {
      try {
        p.classList.remove('drawn');
        void p.getBoundingClientRect();   // force reflow so the draw restarts
        const len = p.getTotalLength();
        if (!len) { return; }
        p.style.setProperty('--len', String(len));
        p.classList.add('drawn');
        p.style.animationDelay = (0.25 + i * 0.16) + 's';
      } catch { /* svg not measurable — leave path fully drawn */ }
    });
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  private num(v: number | null | undefined): number {
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }
  private key(v: string | null | undefined): string {
    return (v ?? '').trim().toUpperCase();
  }
  private clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v;
  }
  private r2(v: number): number {
    return Math.round(v * 100) / 100;
  }
  private fmtNum(v: number, dec: number): string {
    return v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  /** 8 → '8', 8.5 → '8.5' */
  private fmtHours(v: number): string {
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }
  private hm(min: number): string {
    const t = Math.max(0, Math.round(min));
    return Math.floor(t / 60) + 'h ' + String(t % 60).padStart(2, '0') + 'm';
  }
  private initials(name: string | null | undefined): string {
    return (name ?? '').trim().split(/\s+/).filter(Boolean)
      .map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase() || '—';
  }
  private avColor(i: number): string {
    const p = DprHodDashboardComponent.AV_PALETTE;
    return p[i % p.length] ?? '#138271';
  }
  private imgSrc(b64: string | null | undefined): string | null {
    const s = (b64 ?? '').trim();
    if (!s) { return null; }
    const mime = s.startsWith('/9j/') ? 'jpeg'
      : s.startsWith('R0lGOD') ? 'gif'
      : s.startsWith('UklGR') ? 'webp'
      : s.startsWith('Qk0') ? 'bmp'
      : 'png';
    return 'data:image/' + mime + ';base64,' + s;
  }
  private dedupeTeam(rows: DprHodTeamMember[]): DprHodTeamMember[] {
    const seen = new Set<string>();
    const out: DprHodTeamMember[] = [];
    rows.forEach(r => {
      const k = this.key(r.empId) || this.key(r.employeeName);
      if (!k || seen.has(k)) { return; }
      seen.add(k);
      out.push(r);
    });
    return out;
  }
  private parseDate(v: string | null | undefined): Date | null {
    const s = (v ?? '').trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) { return null; }
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  private daysSince(v: string | null | undefined): number | null {
    const d = this.parseDate(v);
    if (!d) { return null; }
    const now = new Date();
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((t.getTime() - d.getTime()) / 86400000));
  }
  private relDate(v: string | null | undefined): string {
    const n = this.daysSince(v);
    if (n == null) { return 'no activity date'; }
    return n === 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago';
  }
  private shortDate(v: string | null | undefined): string {
    const d = this.parseDate(v);
    return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';
  }
  private longDate(v: string | null | undefined): string {
    const d = this.parseDate(v);
    return d
      ? d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  private monthLabel(monthKey: string): string {
    const m = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
    if (!m) { return monthKey; }
    return new Date(Number(m[1]), Number(m[2]) - 1, 1)
      .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  private shortType(t: string): string {
    const u = t.trim().toUpperCase();
    return u === 'EMERGENCY LEAVE' ? 'EMERGENCY'
      : u === 'PLANNED LEAVE' ? 'PLANNED'
      : u === 'RESIGNATION' ? 'RESIGNATION'
      : u;
  }
  private formLook(t: string | null | undefined): { c: string; i: string } {
    const u = (t ?? '').trim().toUpperCase();
    if (u === 'EMERGENCY LEAVE') { return { c: '#dc2626', i: 'fas fa-person-walking-arrow-right' }; }
    if (u === 'PLANNED LEAVE')   { return { c: '#0ea5e9', i: 'fas fa-calendar-day' }; }
    if (u === 'RESIGNATION')     { return { c: '#7c3aed', i: 'fas fa-rotate-left' }; }
    return { c: '#64748b', i: 'fas fa-file-lines' };
  }

  // ══ demo seeds — used ONLY on the "-demo" routes where there is no JWT ══════

  // ── trend chart geometry — identical to the design's lineChart('trend', …) ──
  private buildTrend(): void {
    const W = 660, H = 170, P = 30, max = 160;
    const expected = [152, 152, 148, 152, 152, 120, 152, 152, 152, 148, 152, 120, 152, 152];
    const adoption = [92, 96, 80, 97, 90, 84, 95, 98, 84, 91, 96, 80, 97, 78].map(v => v * 1.6);
    const logged   = [141, 149, 122, 150, 138, 101, 147, 151, 128, 140, 149, 96, 150, 96];
    const n = expected.length;
    const x = (i: number) => P + i * (W - 2 * P) / (n - 1);
    const y = (v: number) => H - 18 - (v / max) * (H - 40);
    const lineD = (d: number[]) => 'M' + d.map((v, i) => this.r2(x(i)) + ',' + this.r2(y(v))).join(' L');

    this.trendTicks = [40, 80, 120, 160].map(v => ({ v, y: this.r2(y(v)) }));
    this.trendPrePaths = [
      { d: lineD(expected), c: '#94a3b8', w: 1.8, dash: true,  o: 1 },
      { d: lineD(adoption), c: '#6366f1', w: 1.8, dash: false, o: .75 }
    ];
    this.trendLoggedD = lineD(logged);
    this.trendAreaD = this.trendLoggedD +
      ' L' + this.r2(x(n - 1)) + ',' + (H - 18) + ' L' + this.r2(x(0)) + ',' + (H - 18) + ' Z';
    this.trendDots = logged.map((v, i) => ({
      cx: this.r2(x(i)), cy: this.r2(y(v)),
      r: i === n - 1 ? 4.6 : 2.6,
      f: i === n - 1 ? '#4f46e5' : '#138271'
    }));
  }

  // ── team pulse cards (design's mem[] + sc + pill maps) ──────────────────────
  private buildTeam(): void {
    const mem: { n: string; r: string; h: string; p: number; s: TeamMember['s']; t: string; i: string; o: string }[] = [
      { n: 'Adan Onaparambil', r: 'Automation Assoc.', h: '6.9', p: 76, s: 'run',   t: 'Warehouse detailing — 1h 47m',  i: '07:58', o: '—' },
      { n: 'Priya Das',        r: 'Site Engineer',     h: '5.8', p: 64, s: 'break', t: 'Lunch break · 12m',             i: '08:04', o: '—' },
      { n: 'Rahul Menon',      r: 'Planner',           h: '7.1', p: 79, s: 'run',   t: 'Baseline reprogramme — 55m',    i: '07:46', o: '—' },
      { n: 'Joseph Thomas',    r: 'MEP Supervisor',    h: '7.9', p: 88, s: 'run',   t: 'Duct QC — 4h 22m',              i: '07:31', o: '—' },
      { n: 'Aisha Nair',       r: 'Doc Controller',    h: '5.5', p: 61, s: 'run',   t: 'Register migration — 38m',      i: '08:12', o: '—' },
      { n: 'Maryam Al Kindi',  r: 'HR Executive',      h: '4.2', p: 47, s: 'pause', t: 'Paused · onboarding files',     i: '08:22', o: '—' },
      { n: 'Suresh Kumar',     r: 'Site Engineer',     h: '0.0', p: 0,  s: 'none',  t: 'Punched · no timer',            i: '07:42', o: '—' },
      { n: 'Laila Al Maskari', r: 'Planner',           h: '0.0', p: 0,  s: 'leave', t: 'Approved leave',                i: '—',     o: '—' }
    ];
    const sc: Record<TeamMember['s'], string> = {
      run: '#138271', pause: '#b45309', break: '#0369a1', none: '#dc2626', leave: '#64748b'
    };
    const pill: Record<TeamMember['s'], { cls: string; lbl: string }> = {
      run:   { cls: 'pr',  lbl: 'RUNNING' },
      pause: { cls: 'pp',  lbl: 'PAUSED' },
      break: { cls: 'pbk', lbl: 'ON BREAK' },
      none:  { cls: 'pl',  lbl: 'NO LOG' },
      leave: { cls: 'pi',  lbl: 'LEAVE' }
    };
    this.team = mem.map((m, i) => ({
      id: this.key(m.n) || String(i),
      n: m.n, r: m.r, h: m.h, p: m.p, s: m.s, t: m.t, in: m.i, out: m.o,
      ini: this.initials(m.n),
      img: null,
      exp: '9h',
      color: sc[m.s],
      pillClass: pill[m.s].cls,
      pillLabel: pill[m.s].lbl,
      anim: 'memin .5s ' + (i * 50) + 'ms cubic-bezier(.22,1,.36,1)',
      ringOff: 94 * (1 - m.p / 100)
    }));
  }

  // ── attendance & punch — today (design's attTable()) ────────────────────────
  private buildAttendance(): void {
    const rows: [string, string, string, string, string, number][] = [
      ['Joseph Thomas',    '07:31', '—', '8h 42m',   '7.9h', 0.8],
      ['Rahul Menon',      '07:46', '—', '8h 27m',   '7.1h', 1.4],
      ['Suresh Kumar',     '07:42', '—', '8h 31m',   '0.0h', 8.5],
      ['Adan Onaparambil', '07:58', '—', '8h 15m',   '6.9h', 1.4],
      ['Priya Das',        '08:04', '—', '8h 09m',   '5.8h', 2.3],
      ['Aisha Nair',       '08:12', '—', '8h 01m',   '5.5h', 2.5],
      ['Maryam Al Kindi',  '08:22', '—', '7h 51m',   '4.2h', 3.7],
      ['Laila Al Maskari', '—',     '—', 'On leave', '—',    -1]
    ];
    this.attRows = rows.map(([n, tin, tout, off, dpr, g]) => ({
      n, in: tin, out: tout, off, dpr,
      dprColor: dpr === '0.0h' ? 'var(--bad)' : 'var(--teal)',
      hasGap: g >= 0,
      gapLabel: g < 0 ? '—' : g.toFixed(1) + 'h',
      gapCls: g < 0 ? '' : g <= 1.5 ? 'gok' : g <= 3 ? 'gwn' : 'gbd'
    }));
  }

  // ── compliance heatmap — member × day (design's hmap()) ─────────────────────
  private buildHeatmap(): void {
    const rows: [string, number[]][] = [
      ['Adan',   [95, 104, 88, 110, 92, 0, -1, 98, 101, 94]],
      ['Priya',  [88, 92, 79, 95, 86, 71, -1, 90, 84, 88]],
      ['Rahul',  [102, 98, 110, 96, 104, 88, -1, 99, 106, 101]],
      ['Joseph', [112, 108, 96, 118, 110, 94, -1, 105, 99, 112]],
      ['Aisha',  [74, 81, 68, 79, 72, -1, -1, 77, 83, 76]],
      ['Maryam', [62, 58, 71, 54, 66, -1, -1, 60, 55, 63]],
      ['Suresh', [41, 0, 38, 45, 0, -1, -1, 36, 42, 0]],
      ['Laila',  [88, 91, -1, -1, -1, -1, -1, -1, 84, 90]]
    ];
    const col = (v: number) =>
      v < 0 ? '#e2e8f0' : v === 0 ? '#fecdd3' : v < 60 ? '#fde68a' : v < 85 ? '#a7f3d0' : v < 105 ? '#2dd4bf' : '#0f766e';
    this.hmapRows = rows.map(([n, vs]) => ({
      n,
      cells: vs.map(v => ({
        bg: col(v),
        fg: (v < 0 || v < 85) ? '#334155' : '#fff',
        label: v < 0 ? '' : String(v),
        title: n + ': ' + (v < 0 ? 'leave' : v + '%')
      }))
    }));
  }
}
