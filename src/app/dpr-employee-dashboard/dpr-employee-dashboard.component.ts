import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Api } from '../services/api';
import {
  DprEmpCalendarDay,
  DprEmpEstAct,
  DprEmpForm,
  DprEmpHero,
  DprEmpTask,
  DprEmpTiles,
  DprEmpTimelineSeg,
  DprEmpWeekDay
} from '../models/dprDashboard.model';

interface CountTile {
  value: number;
  suffix: string;
  dec: number;
}

interface TileSmall {
  cls: string;
  txt: string;
}

interface CalCell {
  empty: boolean;
  cls: string;
  day: number;
  hh: string | null;
  title: string;
  delay: string;
}

/** the 3 coloured hero rows + the separated month row */
interface SplitRow {
  color: string;
  label: string;
  val: string;
}

/** one segment of today's timeline bar */
interface TlSeg {
  left: number;
  width: number;
  bg: string;
  lbl: string | null;
}

interface WeekBar {
  h: number;
  em: string;
  bd: string;
  lo: boolean;
  td: boolean;
}

interface EstBar {
  h: number;
  em: string;
  bd: string;
  est: boolean;
  td: boolean;
}

interface NoteItem {
  k: string;
  v: string;
  /** plain-text tail after the bold value, e.g. " working days" */
  s?: string;
}

interface TaskStatRow {
  label: string;
  sub: string;
  count: number;
}

interface FormRow {
  color: string;
  icon: string;
  apn: string;
  aps: string;
  ageCls: string;
  ageTxt: string;
}

const WORK_G = 'linear-gradient(90deg,#2dd4bf,#138271)';
const RUN_G = 'linear-gradient(90deg,#818cf8,#4f46e5)';
const BREAK_G = 'linear-gradient(90deg,#38bdf8,#0369a1)';
const TRAVEL_G = 'linear-gradient(90deg,#fbbf24,#d97706)';
/** hero split colours are assigned by rank, never by category name */
const SPLIT_COLORS = ['#2dd4bf', '#818cf8', '#f59e0b'];

@Component({
  selector: 'app-dpr-employee-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dpr-employee-dashboard.component.html',
  styleUrls: ['./dpr-employee-dashboard.component.css']
})
export class DprEmployeeDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  /** flips true 320ms after view init — drives all width/height/ring CSS transitions.
   *  Replayed (false -> bind -> true) every time real data lands. */
  animate = false;

  /** true while the dashboard request is in flight — rendered non-destructively */
  loading = false;
  /** inline notice shown inside the existing hero .chips row; never replaces the layout */
  loadError: string | null = null;

  // ── hero ───────────────────────────────────────────────────────────────────
  readonly ringCircumference = 314;
  ringOffset = 314 * (1 - 0.76);
  ringMid = '06:52';
  ringSub = 'of 9h today';

  heroTitle = 'Good afternoon, Adan Onaparambil';
  dateLine =
    new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
    ' · Muscat · IT Department';

  runningChipOk = true;
  runningText = 'Muscat warehouse — detailing · 01:47';
  lastPunchText = '02:03 PM';
  breakText = '00:47';
  travelText = '01:35';
  autoClosedCount = 2;
  autoClosedChipText = 'auto-closed — timer locked';

  splitRows: SplitRow[] = [
    { color: SPLIT_COLORS[0], label: 'Design', val: '02:18' },
    { color: SPLIT_COLORS[1], label: 'Site coord.', val: '02:06' },
    { color: SPLIT_COLORS[2], label: 'Docs', val: '01:14' }
  ];
  monthHoursText = '167.5 h';

  // ── tiles ──────────────────────────────────────────────────────────────────
  tiles: CountTile[] = [
    { value: 6.87, suffix: 'h', dec: 2 },
    { value: 38.25, suffix: 'h', dec: 2 },
    { value: 2, suffix: '', dec: 0 },
    { value: 4, suffix: ' / 5', dec: 0 }
  ];
  tileValues: string[] = this.tiles.map(t => this.fmt(t.value, t.dec, t.suffix));
  tileSmall: TileSmall[] = [
    { cls: 'up', txt: '412 min · on pace' },
    { cls: 'fl', txt: 'Avg 6.42 h/day · 5 active days' },
    { cls: 'dn', txt: 'blocks new timers' },
    { cls: 'up', txt: '76% of month target' }
  ];

  // ── today at a glance ──────────────────────────────────────────────────────
  dayLoggedText = '06:52';
  punchHm = '02:03';
  punchAmPm = 'PM';

  tlSegs: TlSeg[] = [
    { left: 0, width: 26, bg: WORK_G, lbl: 'Work 2h 10m' },
    { left: 27, width: 8, bg: BREAK_G, lbl: null },
    { left: 36, width: 30, bg: WORK_G, lbl: 'Work 2h 32m' },
    { left: 67, width: 11, bg: TRAVEL_G, lbl: null },
    { left: 79, width: 21, bg: RUN_G, lbl: 'Running' }
  ];
  tlMarks: string[] = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
  gapText: string | null = '1h 51m';

  // ── active task ────────────────────────────────────────────────────────────
  actTitle = 'Muscat warehouse — structural detailing';
  actSub = 'Design · assigned by Sujith Kumar';
  actPillCls = 'pr';
  actPillText = 'RUNNING';
  actProgress = 65;
  actProgressText = '65%';
  actLive = '01:47:12';
  actToday = '02:18';
  actTotal = '20:45';

  // ── quote ──────────────────────────────────────────────────────────────────
  quoteText: string | null = 'Success is not final, failure is not fatal: it is the courage to continue that counts.';
  quoteAuthor = 'Winston Churchill';

  // ── week bars ──────────────────────────────────────────────────────────────
  weekBars: WeekBar[] = [
    { h: 70, em: '7.75', bd: 'MON', lo: false, td: false },
    { h: 82, em: '9.20', bd: 'TUE', lo: false, td: false },
    { h: 58, em: '6.40', bd: 'WED', lo: true, td: false },
    { h: 86, em: '9.50', bd: 'THU', lo: false, td: false },
    { h: 44, em: '5.00', bd: 'SAT', lo: true, td: false },
    { h: 62, em: '6.87', bd: 'TODAY', lo: false, td: true }
  ];
  targetLinePct = 66;
  targetLabel = '9h target';
  weekNote: NoteItem[] = [
    { k: 'Total', v: '38:15' },
    { k: 'Avg', v: '6.42 h/day' },
    { k: 'Peak', v: '09:30' },
    { k: 'Active', v: '5 days' }
  ];

  // ── calendar ───────────────────────────────────────────────────────────────
  readonly dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  calCells: CalCell[] = [];
  calMonthLabel = 'August 2026';
  calStats: NoteItem[] = [
    { k: 'Logged', v: '21 of 22', s: ' working days' },
    { k: 'Total', v: '167.5 h' },
    { k: 'Avg', v: '7.98 h/day' },
    { k: 'Longest streak', v: '11 days' },
    { k: 'Leave', v: '2 days' },
    { k: 'Missed', v: '1 day' }
  ];

  // ── my work ────────────────────────────────────────────────────────────────
  tasksBandCount = '22 tasks';
  taskStats: TaskStatRow[] = [
    { label: 'Auto closed', sub: 'needs review before approval', count: 2 },
    { label: 'Running', sub: '', count: 1 },
    { label: 'Paused', sub: '', count: 2 },
    { label: 'Not started', sub: '', count: 3 },
    { label: 'Open total', sub: 'none overdue', count: 14 }
  ];

  estBars: EstBar[] = [
    { h: 76, em: '160', bd: 'JUL est', est: true, td: false },
    { h: 80, em: '168', bd: 'JUL act', est: false, td: false },
    { h: 75, em: '158', bd: 'AUG est', est: true, td: false },
    { h: 79, em: '167.5', bd: 'AUG act', est: false, td: true }
  ];
  estNote: NoteItem[] = [
    { k: 'Tasks completed', v: '+12%' },
    { k: 'You run', v: '~6% over estimate' }
  ];
  estEmptyNote: string | null = null;

  // ── my forms ───────────────────────────────────────────────────────────────
  formRows: FormRow[] = [
    { color: '#dc2626', icon: 'fas fa-person-walking-arrow-right', apn: 'REQ1042 · Emergency Exit', aps: 'Submitted 12 Aug 09:41 · 14 days', ageCls: 'ao', ageTxt: 'PENDING' },
    { color: '#0ea5e9', icon: 'fas fa-laptop', apn: 'REQ1031 · BYOD — Laptop 1', aps: '300 OMR over 60 months', ageCls: 'ag', ageTxt: 'APPROVED' },
    { color: '#f59e0b', icon: 'fas fa-umbrella-beach', apn: 'REQ1055 · Leave 12–14 Aug', aps: 'With HR since yesterday', ageCls: 'ao', ageTxt: 'PENDING' },
    { color: '#7c3aed', icon: 'fas fa-rotate-left', apn: 'REQ1029 · Rejoining', aps: 'Rejected by IT — "attach ticket copy"', ageCls: 'ah', ageTxt: 'RESUBMIT' }
  ];

  private empId = '';
  private runSinceMin: number | null = null;
  private rafIds: number[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private intervals: ReturnType<typeof setInterval>[] = [];
  private subs: Subscription[] = [];
  private destroyed = false;

  constructor(
    private api: Api,
    private el: ElementRef<HTMLElement>,
    private zone: NgZone
  ) {
    this.buildDemoCalendar();
  }

  ngOnInit(): void {
    const u = JSON.parse(localStorage.getItem('current_user') || '{}');
    this.empId = (u.empId || u.employeeId || '').toString().trim();

    if (!this.empId) {
      // "-demo" route with no session: keep the approved design visible, say why.
      // Placeholders FIRST — the seed values are sample data, and leaving them on
      // screen presents invented figures as if they were this user's real numbers.
      this.applyPlaceholders();
      this.loadError = 'Sign in to load live data';
      return;
    }

    this.applyPlaceholders();
    this.load();
    this.loadAutoClosed();
  }

  ngAfterViewInit(): void {
    this.timers.push(setTimeout(() => { this.animate = true; }, 320));
    this.tiles.forEach((_, i) => this.countUp(i));
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.rafIds.forEach(id => cancelAnimationFrame(id));
    this.timers.forEach(t => clearTimeout(t));
    this.intervals.forEach(t => clearInterval(t));
    // without this an in-flight response lands on the destroyed instance and
    // re-arms the 1s live ticker + the count-up frames that were just drained
    this.subs.forEach(s => s.unsubscribe());
  }

  // ══ API ═══════════════════════════════════════════════════════════════════

  /** month/year omitted on purpose — the procedure resolves the user-local current month */
  private load(): void {
    this.loading = true;
    this.subs.push(this.api.getDprEmployeeDashboard(this.empId).subscribe({
      next: (res: any) => {
        if (this.destroyed) { return; }
        this.loading = false;
        if (res?.success === false) {
          this.loadError = res?.message || 'Could not load your dashboard';
          return;
        }
        this.loadError = null;
        this.applyDashboard(res?.data ?? null);
        this.replayAnimations();
      },
      error: (err: any) => {
        if (this.destroyed) { return; }
        this.loading = false;
        // a server-side failure arrives as a non-2xx that still carries the
        // ServiceResponse — show its message instead of blaming the network
        const msg = typeof err?.error?.message === 'string' ? err.error.message.trim() : '';
        this.loadError = msg
          || (err?.status === 0
            ? 'Could not reach the server — showing placeholders'
            : 'Could not load your dashboard');
      }
    }));
  }

  /** the auto-closed counter is not part of PKG_DPR_DASH — one value feeds the
   *  hero chip, the tile and the "My tasks" row */
  private loadAutoClosed(): void {
    this.subs.push(this.api.GetAutoClosedTaskCount(this.empId).subscribe({
      next: (res: any) => {
        if (this.destroyed) { return; }
        const n = this.num(res?.success === false ? 0 : res?.data);
        this.autoClosedCount = n;
        this.autoClosedChipText = n > 0 ? 'auto-closed — timer locked' : 'auto-closed — none';
        this.taskStats[0].count = n;
        this.taskStats[0].sub = n > 0 ? 'needs review before approval' : 'nothing to review';
        this.tiles[2] = { value: n, suffix: '', dec: 0 };
        this.tileSmall[2] = n > 0
          ? { cls: 'dn', txt: 'blocks new timers' }
          : { cls: 'up', txt: 'timers unlocked' };
        this.tileValues[2] = this.fmt(n, 0, '');
        this.countUp(2);
      },
      error: () => { /* non-fatal: the dashboard itself still renders */ }
    }));
  }

  /** dashes + zeros in the existing boxes, so nothing reflows while loading */
  private applyPlaceholders(): void {
    this.heroTitle = this.greeting() + ', …';
    this.dateLine = this.todayLine();
    this.runningChipOk = false;
    this.runningText = '—';
    this.lastPunchText = '—';
    this.breakText = '—';
    this.travelText = '—';
    this.autoClosedCount = 0;
    this.autoClosedChipText = 'auto-closed';
    this.ringMid = '00:00';
    this.ringSub = 'of — today';
    this.ringOffset = this.ringCircumference;
    this.splitRows = SPLIT_COLORS.map(c => ({ color: c, label: '—', val: '—' }));
    this.monthHoursText = '— h';

    this.tiles = [
      { value: 0, suffix: 'h', dec: 2 },
      { value: 0, suffix: 'h', dec: 2 },
      { value: 0, suffix: '', dec: 0 },
      { value: 0, suffix: ' / 5', dec: 0 }
    ];
    this.tileValues = this.tiles.map(t => this.fmt(t.value, t.dec, t.suffix));
    this.tileSmall = [
      { cls: 'fl', txt: 'loading…' },
      { cls: 'fl', txt: 'loading…' },
      { cls: 'fl', txt: 'loading…' },
      { cls: 'fl', txt: 'loading…' }
    ];

    this.dayLoggedText = '00:00';
    this.punchHm = '—';
    this.punchAmPm = '';
    this.tlSegs = [];
    this.tlMarks = [];
    this.gapText = null;

    this.actTitle = '—';
    this.actSub = '';
    this.actPillCls = 'pi';
    this.actPillText = 'IDLE';
    this.actProgress = 0;
    this.actProgressText = '—';
    this.actLive = '—';
    this.actToday = '—';
    this.actTotal = '—';

    this.quoteText = null;
    this.quoteAuthor = '';

    this.weekBars = this.skeletonWeek();
    this.targetLinePct = 66;
    this.targetLabel = 'target';
    this.weekNote = [{ k: 'Total', v: '—' }, { k: 'Avg', v: '—' }, { k: 'Peak', v: '—' }, { k: 'Active', v: '—' }];

    this.buildSkeletonCalendar();
    this.calStats = [
      { k: 'Logged', v: '—' }, { k: 'Total', v: '—' }, { k: 'Avg', v: '—' },
      { k: 'Longest streak', v: '—' }, { k: 'Leave', v: '—' }, { k: 'Missed', v: '—' }
    ];

    this.tasksBandCount = '— tasks';
    this.taskStats = [
      { label: 'Auto closed', sub: '', count: 0 },
      { label: 'Running', sub: '', count: 0 },
      { label: 'Paused', sub: '', count: 0 },
      { label: 'Not started', sub: '', count: 0 },
      { label: 'Open total', sub: '', count: 0 }
    ];
    this.estBars = [];
    this.estNote = [];
    this.estEmptyNote = 'Loading…';
    this.formRows = [];
  }

  private applyDashboard(d: any): void {
    const hero: DprEmpHero = d?.hero ?? {};
    const tiles: DprEmpTiles = d?.tiles ?? {};
    const timeline: DprEmpTimelineSeg[] = d?.timeline ?? [];
    const week: DprEmpWeekDay[] = d?.week ?? [];
    const calendar: DprEmpCalendarDay[] = d?.calendar ?? [];
    const myTasks: DprEmpTask[] = d?.myTasks ?? [];
    const estActual: DprEmpEstAct[] = d?.estVsActual ?? [];
    const myForms: DprEmpForm[] = d?.myForms ?? [];

    this.applyHero(hero, tiles, timeline, myTasks);
    this.applyTiles(hero, tiles, week);
    this.applyTimeline(timeline);
    this.applyActiveTask(hero, timeline, myTasks);
    this.applyWeek(week, hero);
    this.applyCalendar(calendar, tiles);
    this.applyTasks(myTasks);
    this.applyEstActual(estActual);
    this.applyForms(myForms);
  }

  // ══ HERO ══════════════════════════════════════════════════════════════════

  private applyHero(hero: DprEmpHero, tiles: DprEmpTiles, timeline: DprEmpTimelineSeg[], myTasks: DprEmpTask[]): void {
    const name = (hero.employeeName ?? '').trim();
    this.heroTitle = this.greeting() + (name ? ', ' + name : '');

    const bits = [(hero.location ?? '').trim(), (hero.department ?? '').trim()].filter(b => b.length > 0);
    this.dateLine = this.todayLine() + (bits.length ? ' · ' + bits.join(' · ') : '');

    const logged = this.num(hero.todayLoggedMin);
    const expH = this.num(hero.expectedDailyHours);
    const expMin = expH * 60;
    const frac = expMin > 0 ? this.clamp(logged / expMin, 0, 1) : 0;
    this.ringOffset = this.ringCircumference * (1 - frac);
    this.ringMid = this.hm(logged);
    this.ringSub = 'of ' + (expH > 0 ? this.n1(expH) + 'h' : '—') + ' today';

    // running task chip
    const runTitle = (hero.runningTaskTitle ?? '').trim();
    this.runSinceMin = this.parseHm(hero.runningSince);
    if (runTitle) {
      const el = this.elapsedFrom(this.runSinceMin);
      this.runningChipOk = true;
      this.runningText = runTitle + (el ? ' · ' + el : '');
    } else {
      this.runningChipOk = false;
      this.runningText = 'No timer running';
    }

    // punch chip + attbox
    const lp = this.parseHm(hero.lastPunch);
    if (lp === null) {
      this.lastPunchText = '—';
      this.punchHm = '—';
      this.punchAmPm = '';
    } else {
      const t12 = this.to12h(lp);
      this.lastPunchText = t12.hm + ' ' + t12.ap;
      this.punchHm = t12.hm;
      this.punchAmPm = t12.ap;
    }

    const brk = this.num(hero.breakMinToday);
    const trv = this.num(hero.travelMinToday);
    const openBrk = (hero.openBreakReason ?? '').trim();
    this.breakText = brk > 0 ? this.hm(brk) + (openBrk && openBrk.toUpperCase() !== 'TRAVEL' ? ' · open' : '') : '—';
    this.travelText = trv > 0 ? this.hm(trv) + (openBrk.toUpperCase() === 'TRAVEL' ? ' · open' : '') : '—';
    this.dayLoggedText = this.hm(logged);

    // today's split: WORK minutes per category (category recovered from myTasks by title)
    const catOf = new Map<string, string>();
    myTasks.forEach(t => {
      const title = (t.taskTitle ?? '').trim();
      const cat = (t.categoryName ?? '').trim();
      if (title && cat) { catOf.set(title, cat); }
    });
    const buckets = new Map<string, number>();
    timeline
      .filter(s => (s.segType ?? '').toUpperCase() === 'WORK')
      .forEach(s => {
        const label = (s.label ?? '').trim();
        const key = catOf.get(label) || label || 'Untitled';
        buckets.set(key, (buckets.get(key) ?? 0) + this.num(s.minutes));
      });
    const top = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    this.splitRows = SPLIT_COLORS.map((c, i) => top[i]
      ? { color: c, label: top[i][0], val: this.hm(top[i][1]) }
      : { color: c, label: '—', val: '—' });

    this.monthHoursText = this.n1(this.num(tiles.monthHours)) + ' h';
    this.quoteText = (hero.quoteText ?? '').trim() || null;
    this.quoteAuthor = (hero.quoteAuthor ?? '').trim();

    // unlogged gap: punch span minus logged minus breaks (HH:MI text, parsed first)
    const fp = this.parseHm(hero.firstPunch);
    if (fp === null || lp === null || lp <= fp) {
      this.gapText = null;
    } else {
      this.gapText = this.hmLong(Math.max(lp - fp - logged - brk - trv, 0));
    }

    // live ticker for the running timer
    this.intervals.forEach(t => clearInterval(t));
    this.intervals = [];
    if (runTitle && this.runSinceMin !== null) {
      this.actLive = this.elapsedFrom(this.runSinceMin, true);
      this.intervals.push(setInterval(() => {
        this.actLive = this.elapsedFrom(this.runSinceMin, true);
      }, 1000));
    }
  }

  private applyTiles(hero: DprEmpHero, tiles: DprEmpTiles, week: DprEmpWeekDay[]): void {
    const logged = this.num(hero.todayLoggedMin);
    const expMin = this.num(hero.expectedDailyHours) * 60;

    const weekTotal = week.reduce((s, w) => s + this.num(w.hours), 0);
    const activeDays = week.filter(w => this.num(w.hours) > 0).length;
    const avg = activeDays > 0 ? weekTotal / activeDays : 0;

    const fulfil = this.num(tiles.fulfilPct);
    const consistency = this.num(tiles.consistencyPct);

    this.tiles = [
      { value: logged / 60, suffix: 'h', dec: 2 },
      { value: weekTotal, suffix: 'h', dec: 2 },
      { value: this.autoClosedCount, suffix: '', dec: 0 },
      { value: this.clamp(Math.round(fulfil / 20), 0, 5), suffix: ' / 5', dec: 0 }
    ];

    let pace: TileSmall;
    if ((hero.onLeaveToday ?? '') === 'Y') {
      pace = { cls: 'fl', txt: logged + ' min · on leave today' };
    } else if ((hero.isWorkingDayToday ?? '') === 'N') {
      pace = { cls: 'fl', txt: logged + ' min · non-working day' };
    } else if (expMin > 0 && logged >= expMin) {
      pace = { cls: 'up', txt: logged + ' min · target met' };
    } else if (expMin > 0) {
      pace = { cls: 'fl', txt: logged + ' min · ' + this.hm(expMin - logged) + ' to target' };
    } else {
      pace = { cls: 'fl', txt: logged + ' min today' };
    }

    this.tileSmall = [
      pace,
      { cls: 'fl', txt: 'Avg ' + this.n2(avg) + ' h/day · ' + activeDays + ' active days' },
      this.autoClosedCount > 0
        ? { cls: 'dn', txt: 'blocks new timers' }
        : { cls: 'up', txt: 'timers unlocked' },
      {
        cls: fulfil >= 100 ? 'up' : fulfil < 70 ? 'dn' : 'fl',
        txt: this.n1(fulfil) + '% of target · ' + this.n1(consistency) + '% days reported'
      }
    ];
    this.tileValues = this.tiles.map(t => this.fmt(t.value, t.dec, t.suffix));
  }

  // ══ TIMELINE ══════════════════════════════════════════════════════════════

  private applyTimeline(timeline: DprEmpTimelineSeg[]): void {
    const rows = timeline.filter(s => this.parseHm(s.startTime) !== null);
    if (!rows.length) {
      this.tlSegs = [];
      this.tlMarks = [];
      return;
    }

    const starts = rows.map(s => this.parseHm(s.startTime) as number);
    const ends = rows.map((s, i) => this.parseHm(s.endTime) ?? (starts[i] + this.num(s.minutes)));
    let winStart = Math.floor(Math.min(...starts) / 60) * 60;
    let winEnd = Math.ceil(Math.max(...ends) / 60) * 60;
    if (winEnd <= winStart) { winEnd = winStart + 60; }
    const span = winEnd - winStart;

    this.tlSegs = rows.map((s, i) => {
      const isWork = (s.segType ?? '').toUpperCase() === 'WORK';
      const running = (s.isRunning ?? '') === 'Y';
      const label = (s.label ?? '').trim();
      const mins = Math.max(this.num(s.minutes), 0);
      const width = this.clamp((mins / span) * 100, 0, 100);
      const bg = isWork
        ? (running ? RUN_G : WORK_G)
        : (label.toUpperCase().indexOf('TRAVEL') >= 0 ? TRAVEL_G : BREAK_G);
      let lbl: string | null = null;
      if (width >= 18) {
        lbl = running ? 'Running' : (isWork ? 'Work ' + this.hmLong(mins) : label + ' ' + this.hmLong(mins));
      }
      return {
        left: this.clamp(((starts[i] - winStart) / span) * 100, 0, 100),
        width,
        bg,
        lbl
      };
    });

    this.tlMarks = [0, 1, 2, 3, 4, 5].map(i => this.hm(winStart + Math.round((span / 5) * i)));
  }

  private applyActiveTask(hero: DprEmpHero, timeline: DprEmpTimelineSeg[], myTasks: DprEmpTask[]): void {
    const runTitle = (hero.runningTaskTitle ?? '').trim();
    const runId = hero.runningTaskId ?? null;
    const match = myTasks.find(t => (runId !== null && this.num(t.taskId) === this.num(runId))
      || (runTitle && (t.taskTitle ?? '').trim() === runTitle)) ?? null;

    const todayMinOnTask = timeline
      .filter(s => (s.segType ?? '').toUpperCase() === 'WORK' && (s.label ?? '').trim() === runTitle)
      .reduce((sum, s) => sum + this.num(s.minutes), 0);

    if (runTitle) {
      this.actTitle = runTitle;
      const cat = (match?.categoryName ?? '').trim();
      const since = (hero.runningSince ?? '').trim();
      this.actSub = [cat || 'Uncategorised', since ? 'started ' + since : ''].filter(b => b).join(' · ');
      this.actPillCls = 'pr';
      this.actPillText = 'RUNNING';
      this.actLive = this.elapsedFrom(this.runSinceMin, true);
      this.actToday = this.hm(todayMinOnTask);
    } else {
      const open = myTasks[0] ?? null;
      this.actTitle = open ? (open.taskTitle ?? '—') : 'No task running';
      this.actSub = open
        ? [(open.categoryName ?? '').trim() || 'Uncategorised', 'not started'].join(' · ')
        : this.num(hero.tasksToday) + ' tasks touched today';
      this.actPillCls = 'pi';
      this.actPillText = 'IDLE';
      this.actLive = '—';
      this.actToday = this.hm(this.num(hero.todayLoggedMin));
    }

    const prog = this.clamp(this.num(match?.progress), 0, 100);
    this.actProgress = prog;
    this.actProgressText = Math.round(prog) + '%';
    this.actTotal = match ? this.hm(this.num(match.myLoggedHours) * 60) : '—';
  }

  // ══ WEEK ══════════════════════════════════════════════════════════════════

  private applyWeek(week: DprEmpWeekDay[], hero: DprEmpHero): void {
    if (!week.length) {
      this.weekBars = this.skeletonWeek();
      this.weekNote = [{ k: 'Total', v: '—' }, { k: 'Avg', v: '—' }, { k: 'Peak', v: '—' }, { k: 'Active', v: '—' }];
      return;
    }

    const target = this.num(week[0].targetHours) || this.num(hero.expectedDailyHours);
    const maxH = Math.max(...week.map(w => this.num(w.hours)));
    const axisMax = Math.max(target, maxH, 1) * 1.25;

    this.weekBars = week.map(w => {
      const h = this.num(w.hours);
      const isToday = (w.isToday ?? '') === 'Y';
      const working = (w.isWorkingDay ?? '') === 'Y';
      const leave = (w.onLeave ?? '') === 'Y';
      return {
        h: this.clamp((h / axisMax) * 100, 0, 100),
        em: this.n2(h),
        bd: isToday ? 'TODAY' : (w.dayName ?? '').toUpperCase(),
        lo: !isToday && working && !leave && target > 0 && h < target * 0.8,
        td: isToday
      };
    });

    this.targetLinePct = this.clamp((target / axisMax) * 100, 0, 100);
    this.targetLabel = (target > 0 ? this.n1(target) : '—') + 'h target';

    const total = week.reduce((s, w) => s + this.num(w.hours), 0);
    const active = week.filter(w => this.num(w.hours) > 0).length;
    this.weekNote = [
      { k: 'Total', v: this.hm(total * 60) },
      { k: 'Avg', v: this.n2(active > 0 ? total / active : 0) + ' h/day' },
      { k: 'Peak', v: this.hm(maxH * 60) },
      { k: 'Active', v: active + (active === 1 ? ' day' : ' days') }
    ];
  }

  // ══ CALENDAR ══════════════════════════════════════════════════════════════

  private applyCalendar(rows: DprEmpCalendarDay[], tiles: DprEmpTiles): void {
    this.calMonthLabel = this.monthLabel(tiles.monthKey ?? (rows[0]?.theDate ?? null));

    if (!rows.length) {
      this.buildSkeletonCalendar();
      this.calStats = [
        { k: 'Logged', v: 'no records', s: ' this month' }, { k: 'Total', v: '0 h' }, { k: 'Avg', v: '0 h/day' },
        { k: 'Longest streak', v: '0 days' }, { k: 'Leave', v: '0 days' }, { k: 'Missed', v: '0 days' }
      ];
      return;
    }

    const lead = this.leadingBlanks(rows[0]);
    const cells: CalCell[] = [];
    for (let i = 0; i < lead; i++) {
      cells.push({ empty: true, cls: '', day: 0, hh: null, title: '', delay: '' });
    }

    let idx = 0;
    let missed = 0;
    let streak = 0;
    let bestStreak = 0;

    rows.forEach(r => {
      const h = this.num(r.hours);
      const target = this.num(r.targetHours);
      const working = (r.isWorkingDay ?? '') === 'Y';
      const leave = (r.onLeave ?? '') === 'Y';
      const future = (r.isFuture ?? '') === 'Y';

      let cls = '';
      let lab = '';
      if (leave) {
        cls = 'lv'; lab = 'Leave';
      } else if (h > 0) {
        const ratio = h / Math.max(target, 1);
        cls = ratio >= 1.125 ? 'g5' : ratio >= 1 ? 'g4' : ratio >= 0.875 ? 'g3' : ratio >= 0.75 ? 'g2' : 'g1';
        lab = this.n1(h) + ' h';
      } else if (working && !future) {
        cls = 'ms'; lab = 'Missed';
      } else if (!working) {
        cls = 'wknd'; lab = 'Weekend';
      } else {
        lab = 'No log';
      }
      if ((r.isToday ?? '') === 'Y') { cls = (cls + ' today').trim(); }

      if (working && !leave && !future) {
        if (h > 0) { streak++; bestStreak = Math.max(bestStreak, streak); } else { missed++; streak = 0; }
      }

      cells.push({
        empty: false,
        cls,
        day: this.num(r.dayNum) || idx + 1,
        hh: h > 0 ? this.n1(h) : null,
        title: this.fmtDate(r.theDate) + ' · ' + lab,
        delay: (idx * 18) + 'ms'
      });
      idx++;
    });

    this.calCells = cells;

    const reported = this.num(tiles.daysReported);
    const monthHours = this.num(tiles.monthHours);
    const fullMonthDays = this.num(tiles.workingDaysFullMonth);
    this.calStats = [
      { k: 'Logged', v: this.n0(reported) + ' of ' + this.n1(fullMonthDays), s: ' working days' },
      { k: 'Total', v: this.n1(monthHours) + ' h' },
      { k: 'Avg', v: this.n2(reported > 0 ? monthHours / reported : 0) + ' h/day' },
      { k: 'Longest streak', v: bestStreak + (bestStreak === 1 ? ' day' : ' days') },
      { k: 'Leave', v: this.n1(this.num(tiles.leaveDays)) + ' days' },
      { k: 'Missed', v: missed + (missed === 1 ? ' day' : ' days') }
    ];
  }

  /** Sunday-first index of the month's first row, taken from Oracle's DY value
   *  (never new Date().getDay() — that shifts with the browser timezone) */
  private leadingBlanks(first: DprEmpCalendarDay): number {
    const dy = (first.dayName ?? '').trim().toUpperCase().slice(0, 3);
    const i = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].indexOf(dy);
    if (i >= 0) { return i; }
    const parts = (first.theDate ?? '').split('-');
    if (parts.length === 3) {
      return new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2])).getUTCDay();
    }
    return 0;
  }

  // ══ MY WORK ═══════════════════════════════════════════════════════════════

  private applyTasks(rows: DprEmpTask[]): void {
    const st = (t: DprEmpTask) => (t.assigneeStatus ?? '').trim().toUpperCase();
    const running = rows.filter(t => st(t) === 'RUNNING' || (t.isRunning ?? '') === 'Y').length;
    const paused = rows.filter(t => st(t) === 'PAUSED').length;
    const notStarted = rows.filter(t => st(t) === 'OPEN').length;
    const overdue = rows.filter(t => (t.isOverdue ?? '') === 'Y').length;

    this.tasksBandCount = rows.length + (rows.length === 1 ? ' task' : ' tasks');
    this.taskStats = [
      {
        label: 'Auto closed',
        sub: this.autoClosedCount > 0 ? 'needs review before approval' : 'nothing to review',
        count: this.autoClosedCount
      },
      { label: 'Running', sub: '', count: running },
      { label: 'Paused', sub: '', count: paused },
      { label: 'Not started', sub: '', count: notStarted },
      {
        label: 'Open total',
        sub: rows.length === 0 ? 'no open assignments' : (overdue > 0 ? overdue + ' overdue' : 'none overdue'),
        count: rows.length
      }
    ];
  }

  /** the cursor is per-task, so the card shows est/act pairs for the top tasks */
  private applyEstActual(rows: DprEmpEstAct[]): void {
    const top = rows.slice(0, 2);
    if (!top.length) {
      this.estBars = [];
      this.estNote = [];
      this.estEmptyNote = 'No estimated-vs-actual data for this month';
      return;
    }

    this.estEmptyNote = null;
    const values: number[] = [];
    top.forEach(r => { values.push(this.num(r.estimatedHours), this.num(r.monthHours)); });
    const axisMax = Math.max(...values, 1) * 1.25;

    const bars: EstBar[] = [];
    top.forEach((r, i) => {
      const est = this.num(r.estimatedHours);
      const act = this.num(r.monthHours);
      const short = this.shortTitle(r.taskTitle);
      bars.push({ h: this.clamp((est / axisMax) * 100, 0, 100), em: this.n1(est), bd: short + ' est', est: true, td: false });
      bars.push({ h: this.clamp((act / axisMax) * 100, 0, 100), em: this.n1(act), bd: short + ' act', est: false, td: i === 0 });
    });
    this.estBars = bars;

    const estTotal = top.reduce((s, r) => s + this.num(r.estimatedHours), 0);
    const actTotal = top.reduce((s, r) => s + this.num(r.monthHours), 0);
    const delta = estTotal > 0 ? ((actTotal - estTotal) / estTotal) * 100 : 0;
    this.estNote = [
      { k: 'Estimated', v: this.n1(estTotal) + ' h vs ' + this.n1(actTotal) + ' h actual' },
      {
        k: 'You run',
        v: estTotal > 0 ? '~' + this.n0(Math.abs(delta)) + '% ' + (delta >= 0 ? 'over' : 'under') + ' estimate' : 'no estimate set'
      }
    ];
  }

  private applyForms(rows: DprEmpForm[]): void {
    this.formRows = rows.map(f => {
      const type = (f.formType ?? '').trim();
      const look = this.formLook(type);
      const st = (f.status ?? '').trim().toUpperCase();
      const age = this.daysSince(f.submittedDate);
      const step = (f.currentStep ?? '').trim();
      const parts = [
        f.submittedDate ? 'Submitted ' + this.fmtDate(f.submittedDate) : '',
        step,
        age !== null ? age + (age === 1 ? ' day' : ' days') : ''
      ].filter(p => p.length > 0);
      return {
        color: look.color,
        icon: look.icon,
        apn: (f.exitId != null ? 'REQ' + f.exitId + ' · ' : '') + (type || 'Request'),
        aps: parts.join(' · ') || 'No detail',
        ageCls: st.charAt(0) === 'A' ? 'ag' : st.charAt(0) === 'R' ? 'ah' : 'ao',
        ageTxt: st.charAt(0) === 'A' ? 'APPROVED' : st.charAt(0) === 'R' ? 'RESUBMIT' : 'PENDING'
      };
    });
  }

  private formLook(type: string): { color: string; icon: string } {
    const t = type.toUpperCase();
    if (t.indexOf('EMERGENCY') >= 0) { return { color: '#dc2626', icon: 'fas fa-person-walking-arrow-right' }; }
    if (t.indexOf('PLANNED') >= 0 || t.indexOf('LEAVE') >= 0) { return { color: '#f59e0b', icon: 'fas fa-umbrella-beach' }; }
    if (t.indexOf('RESIGN') >= 0) { return { color: '#7c3aed', icon: 'fas fa-rotate-left' }; }
    return { color: '#0ea5e9', icon: 'fas fa-file-circle-check' };
  }

  // ══ ANIMATION (unchanged contract) ════════════════════════════════════════

  /** replay the exact 320ms flip so widths/heights/rings transition to real values */
  private replayAnimations(): void {
    this.animate = false;
    this.timers.push(setTimeout(() => { this.animate = true; }, 320));
    this.tileValues = this.tiles.map(t => this.fmt(t.value, t.dec, t.suffix));
    this.tiles.forEach((_, i) => this.countUp(i));
  }

  /** same formatter as the design: fixed decimals + space thousand grouping + suffix */
  private fmt(v: number, dec: number, suffix: string): string {
    return v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + suffix;
  }

  /** the `<b>` of tile i — written imperatively so the count-up needs no change detection */
  private tileEl(i: number): HTMLElement | null {
    return this.el.nativeElement.querySelectorAll<HTMLElement>('.tiles .tile b')[i] ?? null;
  }

  /** cubic ease-out count-up over ~1.3s with the design's 1.5s snap-to-final safety */
  private countUp(i: number): void {
    const tile = this.tiles[i];
    if (!tile) { return; }
    const final = this.fmt(tile.value, tile.dec, tile.suffix);
    const el = this.tileEl(i);
    if (!el) { this.tileValues[i] = final; return; }   // view not built yet
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const t0 = performance.now();
    let live = false;
    // zone.js patches requestAnimationFrame, so an in-zone loop costs one
    // whole-app change-detection pass per frame — decorate the DOM directly
    // and re-enter the zone once, at the end, to publish the final value
    this.zone.runOutsideAngular(() => {
      const frame = (now: number) => {
        if (this.destroyed) { return; }
        const p = Math.min((now - t0) / 1300, 1);
        live = true;
        el.textContent = this.fmt(tile.value * ease(p), tile.dec, tile.suffix);
        if (p < 1) {
          this.rafIds.push(requestAnimationFrame(frame));
        } else {
          live = false;
          this.zone.run(() => { this.tileValues[i] = final; });
        }
      };
      this.rafIds.push(requestAnimationFrame(frame));
    });
    this.timers.push(setTimeout(() => {
      if (live) { this.tileValues[i] = final; }
    }, 1500));
  }

  // ══ CALENDAR SEEDS ════════════════════════════════════════════════════════

  /** same data + rules as the design's monthCal(): 0 = none, -1 = leave, -2 = missed.
   *  Only used on the "-demo" route when there is no session to load. */
  private buildDemoCalendar(): void {
    const year = 2026;
    const month = 7; // August 2026
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const hrs: { [d: number]: number } = {
      1: 0, 2: 0, 3: 7.9, 4: 8.6, 5: 7.2, 6: 9.1, 7: 8.4, 8: 5.0, 9: 0, 10: 6.9, 11: 8.8, 12: 9.2, 13: 7.6, 14: 8.1,
      15: -1, 16: 0, 17: 8.3, 18: 7.7, 19: 9.4, 20: 8.9, 21: 8.2, 22: 4.5, 23: 0, 24: 8.0, 25: -2, 26: 8.5, 27: 9.0,
      28: 7.8, 29: 5.2, 30: 0, 31: 6.9
    };
    const cells: CalCell[] = [];
    for (let i = 0; i < first; i++) {
      cells.push({ empty: true, cls: '', day: 0, hh: null, title: '', delay: '' });
    }
    let idx = 0;
    for (let d = 1; d <= days; d++) {
      const dw = new Date(year, month, d).getDay();
      const wknd = (dw === 5 || dw === 6);
      const v = hrs[d];
      let cls = '';
      let lab = '';
      if (v === -1) { cls = 'lv'; lab = 'Leave'; }
      else if (v === -2) { cls = 'ms'; lab = 'Missed'; }
      else if (v > 0) {
        cls = v >= 9 ? 'g5' : v >= 8 ? 'g4' : v >= 7 ? 'g3' : v >= 6 ? 'g2' : 'g1';
        lab = v.toFixed(1) + ' h';
      } else {
        if (wknd) { cls = 'wknd'; }
        lab = wknd ? 'Weekend' : 'No log';
      }
      if (d === 30) { cls = (cls + ' today').trim(); }
      cells.push({
        empty: false,
        cls,
        day: d,
        hh: v > 0 ? v.toFixed(1) : null,
        title: d + ' Aug 2026 · ' + lab,
        delay: (idx * 18) + 'ms'
      });
      idx++;
    }
    this.calCells = cells;
  }

  /** neutral grid of the right size so the calendar does not reflow while loading */
  private buildSkeletonCalendar(): void {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const cells: CalCell[] = [];
    for (let i = 0; i < first; i++) {
      cells.push({ empty: true, cls: '', day: 0, hh: null, title: '', delay: '' });
    }
    for (let d = 1; d <= days; d++) {
      cells.push({
        empty: false,
        cls: d === now.getDate() ? 'today' : '',
        day: d,
        hh: null,
        title: '',
        delay: ((d - 1) * 18) + 'ms'
      });
    }
    this.calCells = cells;
    this.calMonthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  private skeletonWeek(): WeekBar[] {
    const names = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    return names.map(n => ({ h: 0, em: '0.00', bd: n, lo: false, td: false }));
  }

  // ══ FORMATTERS ════════════════════════════════════════════════════════════

  private num(v: unknown): number {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    return isFinite(n) ? n : 0;
  }

  private clamp(v: number, lo: number, hi: number): number {
    return Math.min(Math.max(v, lo), hi);
  }

  private n0(v: number): string { return this.fmt(v, 0, ''); }
  private n1(v: number): string { return this.fmt(v, 1, ''); }
  private n2(v: number): string { return this.fmt(v, 2, ''); }

  /** minutes -> 'HH:MM' */
  private hm(min: number): string {
    const m = Math.max(Math.round(min), 0);
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  /** minutes -> 'Xh YYm' */
  private hmLong(min: number): string {
    const m = Math.max(Math.round(min), 0);
    const h = Math.floor(m / 60);
    return h > 0 ? h + 'h ' + String(m % 60).padStart(2, '0') + 'm' : (m % 60) + 'm';
  }

  /** 'HH:MI' TEXT -> minutes since midnight (never subtract HHMM numerically) */
  private parseHm(txt: string | null | undefined): number | null {
    const s = (txt ?? '').trim();
    const m = /^(\d{1,2}):(\d{2})/.exec(s);
    if (!m) { return null; }
    const h = +m[1];
    const mi = +m[2];
    if (h > 23 || mi > 59) { return null; }
    return h * 60 + mi;
  }

  private to12h(min: number): { hm: string; ap: string } {
    const h24 = Math.floor(min / 60) % 24;
    const mi = min % 60;
    const ap = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return { hm: String(h12).padStart(2, '0') + ':' + String(mi).padStart(2, '0'), ap };
  }

  /** elapsed from a user-local 'HH:MI' start to now */
  private elapsedFrom(startMin: number | null, withSeconds = false): string {
    if (startMin === null) { return withSeconds ? '—' : ''; }
    const now = new Date();
    let sec = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) - startMin * 60;
    if (sec < 0) { sec += 24 * 3600; }
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const base = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    return withSeconds ? base + ':' + String(sec % 60).padStart(2, '0') : base;
  }

  private greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  private todayLine(): string {
    return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  /** 'YYYY-MM-DD' -> 'd MMM yyyy' (parsed as UTC so the day never shifts) */
  private fmtDate(iso: string | null | undefined): string {
    const p = (iso ?? '').split('-');
    if (p.length < 3) { return (iso ?? '').trim() || '—'; }
    const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  /** 'YYYY-MM' or 'YYYY-MM-DD' -> 'August 2026' */
  private monthLabel(key: string | null | undefined): string {
    const p = (key ?? '').split('-');
    if (p.length < 2) { return this.calMonthLabel; }
    const d = new Date(Date.UTC(+p[0], +p[1] - 1, 1));
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  private daysSince(iso: string | null | undefined): number | null {
    const p = (iso ?? '').split('-');
    if (p.length < 3) { return null; }
    const then = Date.UTC(+p[0], +p[1] - 1, +p[2]);
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const d = Math.round((today - then) / 86400000);
    return isFinite(d) && d >= 0 ? d : null;
  }

  private shortTitle(t: string | null | undefined): string {
    const s = (t ?? '').trim();
    if (!s) { return 'TASK'; }
    const w = s.split(/\s+/)[0].replace(/[^A-Za-z0-9]/g, '');
    return (w || s).slice(0, 6).toUpperCase();
  }
}
