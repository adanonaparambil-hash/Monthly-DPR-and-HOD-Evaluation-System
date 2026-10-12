import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Api } from '../services/api';
import { NoticePopupService } from '../services/notice-popup.service';
import { AiReportComponent } from '../components/ai-report/ai-report.component';
import { NewJoinersCardComponent } from '../components/new-joiners-card/new-joiners-card.component';
import { I18nService } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import { bindTooltip, countUpAll, escHtml, fmtNum, reduceMotion, setupReveal } from '../utils/dash-fx';
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

// ── view models ─────────────────────────────────────────────────────────────
// Every list the template loops over is a plain field, rebuilt once per load.
// Getters that rebuild arrays make *ngFor tear down and recreate its rows on
// every change-detection pass.

interface KpiTile {
  label: string;
  pillCls: string;
  pillTxt: string;
  value: number;
  dec: number;
  unit: string;
  barPct: number;
  icon: string;
  foot: string;
  color: string;
}

interface TlSeg {
  left: number;
  width: number;
  bg: string;
  label: string;
  tip: string;
  gap: boolean;
}

interface StatBox {
  k: string;
  v: string;
  unit: string;
  d: string;
  color: string;
}

interface WeekCol {
  h: number;
  val: string;
  day: string;
  varTxt: string;
  varCls: string;
  off: boolean;
  offIcon: string;
  today: boolean;
  short: boolean;
  peak: boolean;
  tip: string;
}

interface CalCell {
  empty: boolean;
  cls: string;
  day: number;
  hh: string;
  tip: string;
  delay: string;
}

interface TaskRow {
  icon: string;
  color: string;
  title: string;
  sub: string;
  logged: string;
  of: string;
  over: boolean;
}

interface EstRow {
  name: string;
  vv: string;
  over: boolean;
  width: number;
  tip: string;
}

interface NoticeRow {
  title: string;
  sub: string;
  unread: boolean;
  icon: string;
  color: string;
  raw: any;
}

interface NotifRow {
  id: number;
  icon: string;
  color: string;
  message: string;
  time: string;
  unread: boolean;
  link: string;
  isNotice: boolean;
  noticeId: number;
}

interface FormRow {
  icon: string;
  color: string;
  title: string;
  sub: string;
  pillCls: string;
  pillTxt: string;
}

/** Categorical accents — validated set (light). Kept in step with the --a1..--a6
 *  tokens in the stylesheet; used only where a colour is chosen per row in TS. */
const A = {
  emerald: 'var(--a1)',
  indigo: 'var(--a2)',
  amber: 'var(--a3)',
  rose: 'var(--a4)',
  sky: 'var(--a5)',
  violet: 'var(--a6)'
};

const RING1_C = 314;   // 2πr, r = 50
const RING2_C = 377;   // 2πr, r = 60

@Component({
  selector: 'app-dpr-employee-dashboard',
  standalone: true,
  imports: [CommonModule, AiReportComponent, NewJoinersCardComponent, TPipe],
  // Arabic pilot: this page flips itself to RTL (the rest of the app is unaffected)
  host: { '[class.is-rtl]': 'i18n.isAr()', '[attr.dir]': 'i18n.dir()', '[attr.lang]': 'i18n.lang()' },
  templateUrl: './dpr-employee-dashboard.component.html',
  styleUrls: ['../styles/dpr-dash.css', './dpr-employee-dashboard.component.css']
})
export class DprEmployeeDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  /** declared first: the field initialisers below already translate */
  readonly i18n = inject(I18nService);
  private tr(text: string, params?: Record<string, unknown>): string { return this.i18n.t(text, params); }

  @ViewChild('aiReport') aiReport?: AiReportComponent;
  @ViewChild('notifPanel') notifPanel?: ElementRef<HTMLElement>;
  @ViewChild('noticePanel') noticePanel?: ElementRef<HTMLElement>;
  @ViewChild('tip') tipEl?: ElementRef<HTMLElement>;

  loading = false;
  loadError: string | null = null;

  // ── hero ───────────────────────────────────────────────────────────────────
  greetingText = this.greeting();
  firstName = '';
  dateText = this.todayLine();
  locText = '';
  deptText = '';
  expDailyText = '—';
  timerRunning = false;
  runningText = this.tr('No timer running');
  lastPunchText = '—';
  breakText = '—';
  travelText = '—';
  streakDays = 0;
  autoClosedCount = 0;
  readonly ring1C = RING1_C;
  ring1Offset = RING1_C;
  ring1Mid = '0:00';
  ring1Sub = this.tr('OF — TODAY');
  heroWorked = '00:00';
  heroGap = '00:00';
  heroRemaining = '—';
  heroMonth = '— h';

  // ── quick actions ──────────────────────────────────────────────────────────
  notifUnread = 0;
  notifSub = this.tr('Nothing new');
  noticeUnread = 0;
  noticeSub = this.tr('Nothing published');
  approvalCount = 0;
  approvalSub = this.tr('Requests and approvals');
  /** flips false→true after each loader lands, replaying the badge pop */
  badgePop = false;

  // ── KPI tiles ──────────────────────────────────────────────────────────────
  kpis: KpiTile[] = this.blankKpis();

  // ── month expected vs achieved ─────────────────────────────────────────────
  monthName = new Date().toLocaleDateString(this.i18n.locale(), { month: 'long' });
  readonly ring2C = RING2_C;
  ring2Offset = RING2_C;
  achievedPct = 0;
  soFarFill = 0;
  soFarMark = 0;
  endFill = 0;
  endGhost = 0;
  endMark = 0;
  soFarText = '— h';
  endText = '— h';
  soFarTip = '';
  soFarMarkTip = '';
  endGhostTip = '';
  endMarkTip = '';
  monthStats: StatBox[] = [];
  monthNote = '';

  // ── quote ──────────────────────────────────────────────────────────────────
  quoteText: string | null = null;
  quoteAuthor = '';

  // ── today ──────────────────────────────────────────────────────────────────
  tlSegs: TlSeg[] = [];
  tlStart = '';
  tlEnd = '';
  tlPunches = '';
  todayStats: StatBox[] = [];

  // ── active task ────────────────────────────────────────────────────────────
  actCategory = '';
  actTitle = this.tr('No task running');
  actSub = '';
  actProgress = 0;
  actToday = '—';
  actTotal = '—';
  actLive = '—';
  overdueRow: TaskRow | null = null;

  // ── week ───────────────────────────────────────────────────────────────────
  weekCols: WeekCol[] = [];
  weekTargetPct = 75;
  weekTargetLabel = '— h';
  weekStats: StatBox[] = [];
  weekFill = 0;
  weekMark = 0;
  weekTotalText = '— h';
  weekPillCls = 'nu';
  weekPillTxt = '—';
  weekFillTip = '';
  weekMarkTip = '';

  // ── calendar ───────────────────────────────────────────────────────────────
  readonly dows = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  calCells: CalCell[] = [];
  calMonthLabel = '';
  calFoot: { k: string; v: string }[] = [];

  // ── work ───────────────────────────────────────────────────────────────────
  taskRows: TaskRow[] = [];
  estRows: EstRow[] = [];
  estFoot = '';

  // ── communications ─────────────────────────────────────────────────────────
  noticeRows: NoticeRow[] = [];
  notifRows: NotifRow[] = [];
  formRows: FormRow[] = [];
  pulseNotif = false;
  pulseNotice = false;

  private empId = '';
  private runSinceMin: number | null = null;
  private rafIds: number[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private intervals: ReturnType<typeof setInterval>[] = [];
  private subs: Subscription[] = [];
  private destroyed = false;
  private fxCleanup: (() => void)[] = [];
  /** last API payloads, re-mapped when the language changes */
  private lastData: any = null;
  private lastNotifs: any[] | null = null;
  private lastNotices: any[] | null = null;

  constructor(
    private api: Api,
    private router: Router,
    private noticePopup: NoticePopupService,
    private el: ElementRef<HTMLElement>,
    private zone: NgZone
  ) {
    this.buildSkeletonCalendar();
  }

  ngOnInit(): void {
    const u = JSON.parse(localStorage.getItem('current_user') || '{}');
    this.empId = (u.empId || u.employeeId || '').toString().trim();
    this.subs.push(this.i18n.changed$.subscribe(() => this.relabel()));

    if (!this.empId) {
      this.loadError = 'Sign in to load live data';
      return;
    }

    this.load();
    this.loadAutoClosed();
    this.loadNotifications();
    this.loadNotices();
  }

  ngAfterViewInit(): void {
    this.countUpAll();
    const tip = this.tipEl?.nativeElement;
    if (tip) { this.fxCleanup.push(bindTooltip(this.el.nativeElement, tip, this.zone)); }
    this.fxCleanup.push(setupReveal(this.el.nativeElement));
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.fxCleanup.forEach(fn => fn());
    this.rafIds.forEach(id => cancelAnimationFrame(id));
    this.timers.forEach(t => clearTimeout(t));
    this.intervals.forEach(t => clearInterval(t));
    this.subs.forEach(s => s.unsubscribe());
  }

  /** Language switched: rebuild every TS-made label from the cached payloads (no API call). */
  private relabel(): void {
    this.greetingText = this.greeting();
    this.dateText = this.todayLine();
    if (this.lastData) {
      this.applyDashboard(this.lastData);
    } else {
      this.kpis = this.blankKpis();
      this.buildSkeletonCalendar();
    }
    if (this.lastNotifs) { this.applyNotifications(this.lastNotifs); }
    if (this.lastNotices) { this.applyNotices(this.lastNotices); }
  }

  // ══ NAVIGATION ════════════════════════════════════════════════════════════

  openNotifications(): void { this.flash(this.notifPanel, 'notif'); }
  openAnnouncements(): void { this.flash(this.noticePanel, 'notice'); }
  openApprovals(): void { this.router.navigate(['/leave-approval']); }
  openLogHistory(): void { this.router.navigate(['/my-logged-hours']); }
  openTasks(): void { this.router.navigate(['/my-task']); }
  openForms(): void { this.router.navigate(['/leave-approval']); }
  newRequest(): void { this.router.navigate(['/exit-form']); }

  /** The AI report is manual only — nothing is generated on load. */
  generateAi(): void { this.aiReport?.generate(); }

  /** Scroll a panel into view and pulse it once, so the button lands somewhere visible. */
  private flash(ref: ElementRef<HTMLElement> | undefined, which: 'notif' | 'notice'): void {
    ref?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (which === 'notif') { this.pulseNotif = false; } else { this.pulseNotice = false; }
    this.timers.push(setTimeout(() => {
      if (which === 'notif') { this.pulseNotif = true; } else { this.pulseNotice = true; }
      this.timers.push(setTimeout(() => {
        if (which === 'notif') { this.pulseNotif = false; } else { this.pulseNotice = false; }
      }, 1400));
    }, 30));
  }

  openNotice(row: NoticeRow): void {
    this.noticePopup.showNotice(row.raw);
    if (row.unread && row.raw?.noticeId != null) {
      row.unread = false;
      row.raw.isRead = 'Y';   // the cached payload too, so a relabel keeps it read
      this.noticeUnread = Math.max(this.noticeUnread - 1, 0);
      this.subs.push(this.api.markNoticeAsRead(row.raw.noticeId, this.empId).subscribe({ error: () => { } }));
    }
  }

  openNotification(row: NotifRow): void {
    if (row.unread) {
      row.unread = false;
      this.notifUnread = Math.max(this.notifUnread - 1, 0);
      this.notifSub = this.notifUnread > 0 ? this.tr('{n} unread', { n: this.notifUnread }) : this.tr('All caught up');
      const raw = this.lastNotifs?.find(n => this.num(n?.id) === row.id);
      if (raw) { raw.isRead = 'Y'; }
      this.subs.push(this.api.markNotificationAsRead({
        notificationId: row.id, userId: this.empId, actionType: 'S'
      }).subscribe({ error: () => { } }));
    }

    if (row.isNotice && row.noticeId) {
      this.subs.push(this.api.getUserNotices(this.empId, row.noticeId, 'N').subscribe({
        next: (res: any) => {
          const list: any[] = Array.isArray(res?.data) ? res.data : [];
          if (list.length) { this.noticePopup.showNotice(list[0]); }
        },
        error: () => { }
      }));
      return;
    }

    if (row.link && row.link !== '#') {
      this.router.navigateByUrl(row.link.startsWith('/') ? row.link : '/' + row.link);
    }
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
        this.lastData = res?.data ?? null;
        this.applyDashboard(this.lastData);
        this.countUpAll();
      },
      error: (err: any) => {
        if (this.destroyed) { return; }
        this.loading = false;
        // a server-side failure arrives as a non-2xx that still carries the
        // ServiceResponse — show its message instead of blaming the network
        const msg = typeof err?.error?.message === 'string' ? err.error.message.trim() : '';
        this.loadError = msg
          || (err?.status === 0 ? 'Could not reach the server' : 'Could not load your dashboard');
      }
    }));
  }

  /** The auto-closed counter is not part of PKG_DPR_DASH. */
  private loadAutoClosed(): void {
    this.subs.push(this.api.GetAutoClosedTaskCount(this.empId).subscribe({
      next: (res: any) => {
        if (this.destroyed) { return; }
        this.autoClosedCount = this.num(res?.success === false ? 0 : res?.data);
      },
      error: () => { }
    }));
  }

  private loadNotifications(): void {
    this.subs.push(this.api.getUserNotifications(this.empId).subscribe({
      next: (res: any) => {
        if (this.destroyed) { return; }
        const list: any[] = Array.isArray(res?.data) ? res.data : [];
        this.lastNotifs = list;
        this.applyNotifications(list);
        this.popBadges();
      },
      error: () => { }
    }));
  }

  private applyNotifications(list: any[]): void {
    const rows = list.map(n => this.toNotifRow(n));
    this.notifUnread = rows.filter(r => r.unread).length;
    this.notifSub = this.notifUnread > 0
      ? this.tr('{n} unread', { n: this.notifUnread })
      : this.tr(rows.length ? 'All caught up' : 'Nothing new');
    this.notifRows = rows.slice(0, 5);
  }

  /** Same call the login popup makes — it returns every notice aimed at this user. */
  private loadNotices(): void {
    this.subs.push(this.api.getUserNotices(this.empId, 0, 'Y').subscribe({
      next: (res: any) => {
        if (this.destroyed) { return; }
        const list: any[] = Array.isArray(res?.data) ? res.data : [];
        this.lastNotices = list;
        this.applyNotices(list);
        this.popBadges();
      },
      error: () => { }
    }));
  }

  private applyNotices(list: any[]): void {
    const sorted = list.slice().sort((a, b) => this.ts(b?.startDate) - this.ts(a?.startDate));
    this.noticeRows = sorted.slice(0, 4).map(n => this.toNoticeRow(n));
    this.noticeUnread = list.filter(n => (n?.isRead ?? '') === 'N').length;
    const newest = sorted[0];
    this.noticeSub = newest
      ? ((newest.title ?? '').toString().trim() || this.tr('Latest notice'))
      : this.tr('Nothing published');
  }

  // ══ MAPPING ═══════════════════════════════════════════════════════════════

  private applyDashboard(d: any): void {
    const hero: DprEmpHero = d?.hero ?? {};
    const tiles: DprEmpTiles = d?.tiles ?? {};
    const timeline: DprEmpTimelineSeg[] = d?.timeline ?? [];
    const week: DprEmpWeekDay[] = d?.week ?? [];
    const calendar: DprEmpCalendarDay[] = d?.calendar ?? [];
    const myTasks: DprEmpTask[] = d?.myTasks ?? [];
    const estActual: DprEmpEstAct[] = d?.estVsActual ?? [];
    const myForms: DprEmpForm[] = d?.myForms ?? [];

    const gapMin = this.applyTimeline(hero, timeline);
    this.applyHero(hero, tiles, calendar, gapMin);
    const weekInfo = this.applyWeek(week, hero);
    const month = this.applyMonth(tiles, hero);
    this.applyKpis(hero, tiles, myTasks, weekInfo, month);
    this.applyActiveTask(hero, timeline, myTasks);
    this.applyCalendar(calendar, tiles);
    this.applyTasks(myTasks);
    this.applyEstActual(estActual);
    this.applyForms(myForms);
    this.applyApprovals(tiles, myForms);
  }

  // ── hero ───────────────────────────────────────────────────────────────────

  private applyHero(hero: DprEmpHero, tiles: DprEmpTiles, calendar: DprEmpCalendarDay[], gapMin: number): void {
    const name = (hero.employeeName ?? '').trim();
    this.firstName = this.titleCase(name.split(/\s+/)[0] || '');
    this.greetingText = this.greeting();
    this.dateText = this.todayLine();
    this.locText = (hero.location ?? '').trim();
    this.deptText = (hero.department ?? '').trim();

    const logged = this.num(hero.todayLoggedMin);
    const expH = this.num(hero.expectedDailyHours);
    const expMin = expH * 60;
    this.expDailyText = expH > 0 ? this.tr('{h} h expected today', { h: this.trim1(expH) }) : '';

    const frac = expMin > 0 ? this.clamp(logged / expMin, 0, 1) : 0;
    this.ring1Offset = RING1_C * (1 - frac);
    this.ring1Mid = this.hShort(logged);
    this.ring1Sub = expH > 0 ? this.tr('OF {h}H TODAY', { h: this.trim1(expH) }) : this.tr('OF — TODAY');

    const runTitle = (hero.runningTaskTitle ?? '').trim();
    this.runSinceMin = this.parseHm(hero.runningSince);
    this.timerRunning = runTitle.length > 0;
    this.runningText = this.tr(this.timerRunning ? 'Running' : 'Idle');

    const lp = this.parseHm(hero.lastPunch);
    this.lastPunchText = lp === null ? '—' : this.to12h(lp);

    const brk = this.num(hero.breakMinToday);
    const trv = this.num(hero.travelMinToday);
    this.breakText = brk > 0 ? this.hmLong(brk) : '—';
    this.travelText = trv > 0 ? this.hmLong(trv) : '—';

    this.heroWorked = this.hm(logged);
    this.heroGap = this.hm(gapMin);
    this.heroRemaining = expMin > 0 ? this.hm(Math.max(expMin - logged, 0)) : '—';
    this.heroMonth = this.hrs(this.n1(this.num(tiles.monthHours)));

    this.quoteText = (hero.quoteText ?? '').trim() || null;
    this.quoteAuthor = (hero.quoteAuthor ?? '').trim();
    this.streakDays = this.currentStreak(calendar);

    // live ticker for the running timer
    this.intervals.forEach(t => clearInterval(t));
    this.intervals = [];
    if (this.timerRunning && this.runSinceMin !== null) {
      this.actLive = this.elapsedFrom(this.runSinceMin, true);
      this.intervals.push(setInterval(() => {
        this.actLive = this.elapsedFrom(this.runSinceMin, true);
      }, 1000));
    }
  }

  /** Consecutive reported working days ending today (or yesterday, while today is still open).
   *  Weekly offs and leave neither count nor break it. This month only — that is what the cursor holds. */
  private currentStreak(rows: DprEmpCalendarDay[]): number {
    const past = rows.filter(r => (r.isFuture ?? '') !== 'Y');
    let streak = 0;
    for (let i = past.length - 1; i >= 0; i--) {
      const r = past[i];
      const working = (r.isWorkingDay ?? '') === 'Y';
      const leave = (r.onLeave ?? '') === 'Y';
      if (!working || leave) { continue; }
      const h = this.num(r.hours);
      if ((r.isToday ?? '') === 'Y' && h <= 0) { continue; }
      if (h > 0) { streak++; } else { break; }
    }
    return streak;
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────

  private applyKpis(
    hero: DprEmpHero, tiles: DprEmpTiles, myTasks: DprEmpTask[],
    week: { total: number; target: number; active: number },
    month: { pct: number; achieved: number; expected: number }
  ): void {
    const logged = this.num(hero.todayLoggedMin);
    const expH = this.num(hero.expectedDailyHours);
    const expMin = expH * 60;
    const dayPct = expMin > 0 ? (logged / expMin) * 100 : 0;

    let dayFoot: string;
    if ((hero.onLeaveToday ?? '') === 'Y') {
      dayFoot = this.tr('On leave today');
    } else if ((hero.isWorkingDayToday ?? '') === 'N') {
      dayFoot = this.tr('Not a working day');
    } else if (expMin > 0 && logged >= expMin) {
      dayFoot = this.tr('{n} min done · target met', { n: logged });
    } else if (expMin > 0) {
      dayFoot = this.tr('{n} min done · {left} to target', { n: logged, left: this.hm(expMin - logged) });
    } else {
      dayFoot = this.tr('{n} min done', { n: logged });
    }

    const weekPct = week.target > 0 ? (week.total / week.target) * 100 : 0;
    const openTasks = this.num(tiles.openTasks) || myTasks.length;
    const running = myTasks.filter(t => (t.isRunning ?? '') === 'Y').length;
    const overdue = myTasks.filter(t => (t.isOverdue ?? '') === 'Y').length;
    const awaiting = this.num(tiles.myLogsAwaitingApproval);

    this.kpis = [
      {
        label: this.tr('Logged today'), color: A.emerald, icon: 'schedule',
        pillCls: dayPct >= 100 ? 'ok' : dayPct >= 60 ? 'ok' : 'wt',
        pillTxt: this.n1(dayPct) + '%',
        value: logged / 60, dec: 2, unit: ' ' + this.tr('h / {e}', { e: expH > 0 ? this.hrs(this.trim1(expH)) : '—' }),
        barPct: this.clamp(dayPct, 0, 100), foot: dayFoot
      },
      {
        label: this.tr('This week'), color: A.sky, icon: 'trending_up',
        pillCls: weekPct >= 100 ? 'ok' : weekPct >= 85 ? 'nu' : 'wt',
        pillTxt: this.tr(weekPct >= 100 ? 'On track' : weekPct >= 85 ? 'Close' : 'Behind'),
        value: week.total, dec: 2, unit: ' ' + this.tr('h total'),
        barPct: this.clamp(weekPct, 0, 100),
        foot: this.tr(week.active === 1 ? 'Avg {avg} h / day · {n} active day' : 'Avg {avg} h / day · {n} active days',
          { avg: this.n2(week.active > 0 ? week.total / week.active : 0), n: week.active })
      },
      {
        label: this.tr('Open work'), color: A.indigo, icon: 'list_alt',
        pillCls: overdue > 0 ? 'cr' : 'nu',
        pillTxt: running > 0 ? this.tr('{n} running', { n: running }) : (overdue > 0 ? this.tr('{n} overdue', { n: overdue }) : this.tr('Idle')),
        value: openTasks, dec: 0, unit: ' ' + this.tr(openTasks === 1 ? 'task' : 'tasks'),
        barPct: openTasks > 0 ? this.clamp(((openTasks - overdue) / openTasks) * 100, 0, 100) : 0,
        foot: this.tr(awaiting === 1 ? '{o} overdue · {a} log awaiting approval' : '{o} overdue · {a} logs awaiting approval', { o: overdue, a: awaiting })
      },
      {
        label: this.tr('Month achieved'), color: A.violet, icon: 'military_tech',
        pillCls: month.pct >= 100 ? 'ok' : month.pct >= 85 ? 'nu' : 'wt',
        pillTxt: this.tr(month.pct >= 100 ? 'Ahead' : month.pct >= 85 ? 'Close' : 'Behind'),
        value: month.pct, dec: 1, unit: this.tr('% of target'),
        barPct: this.clamp(month.pct, 0, 100),
        foot: this.tr('{a} h of {e} h expected so far', { a: this.n1(month.achieved), e: this.n1(month.expected) })
      }
    ];
  }

  // ── month expected vs achieved ─────────────────────────────────────────────

  private applyMonth(tiles: DprEmpTiles, hero: DprEmpHero): { pct: number; achieved: number; expected: number } {
    const achieved = this.num(tiles.monthHours);
    const expToDate = this.num(tiles.expectedHoursToDate);
    const expFull = this.num(tiles.expectedHoursFullMonth);
    const daysToDate = this.num(tiles.workingDaysToDate);
    const daysFull = this.num(tiles.workingDaysFullMonth);
    const reported = this.num(tiles.daysReported);
    const leave = this.num(tiles.leaveDays);
    const daily = this.num(hero.expectedDailyHours);

    this.monthName = this.monthOnly(tiles.monthKey);
    const pct = expToDate > 0 ? (achieved / expToDate) * 100 : 0;
    this.achievedPct = pct;
    this.ring2Offset = RING2_C * (1 - this.clamp(pct / 100, 0, 1));

    // Days still ahead come from the expected hours themselves, so leave and
    // holidays are already out of them — the working-day counts can differ in
    // whether they are net of leave.
    const remainingExp = Math.max(expFull - expToDate, 0);
    const daysLeft = daily > 0 ? remainingExp / daily : Math.max(daysFull - daysToDate, 0);
    const pace = daysToDate > 0 ? achieved / daysToDate : 0;
    const projected = achieved + pace * daysLeft;
    const needed = daysLeft > 0 ? Math.max(expFull - achieved, 0) / daysLeft : 0;
    const ahead = achieved - expToDate;

    const scale = Math.max(expFull, projected, achieved, 1) * 1.05;
    this.soFarFill = this.clamp((achieved / scale) * 100, 0, 100);
    this.soFarMark = this.clamp((expToDate / scale) * 100, 0, 100);
    this.endFill = this.soFarFill;
    this.endGhost = this.clamp(((projected - achieved) / scale) * 100, 0, 100 - this.endFill);
    this.endMark = this.clamp((expFull / scale) * 100, 0, 100);

    this.soFarText = this.hrs(this.n1(achieved));
    this.endText = this.hrs(this.n1(projected));
    this.soFarTip = this.tr('Achieved <b>{a} h</b> against <b>{e} h</b> expected over {d} working days',
      { a: this.n1(achieved), e: this.n1(expToDate), d: this.trim1(daysToDate) });
    this.soFarMarkTip = this.tr('Expected to date — <b>{e} h</b>', { e: this.n1(expToDate) });
    this.endGhostTip = this.tr('{d} working days left at your pace of <b>{p} h/day</b> → <b>+{x} h</b>',
      { d: this.trim1(daysLeft), p: this.n2(pace), x: this.n1(projected - achieved) });
    this.endMarkTip = this.tr('Full-month expected — <b>{e} h</b>', { e: this.n1(expFull) });

    const projDelta = projected - expFull;
    this.monthStats = [
      {
        k: this.tr(ahead >= 0 ? 'Ahead by' : 'Behind by'), v: (ahead >= 0 ? '+' : '−') + this.n1(Math.abs(ahead)),
        unit: ' ' + this.tr('h'), d: this.tr('vs expected today'), color: ahead >= 0 ? A.emerald : A.rose
      },
      {
        k: this.tr('Your pace'), v: this.n2(pace), unit: ' ' + this.tr('h/day'),
        d: this.tr('Target is {t}', { t: daily > 0 ? this.trim1(daily) : '—' }), color: A.sky
      },
      {
        k: this.tr('Projected'), v: this.n1(projected), unit: ' ' + this.tr('h'),
        d: this.tr(projDelta >= 0 ? '{v} h over target' : '{v} h under target', { v: (projDelta >= 0 ? '+' : '−') + this.n1(Math.abs(projDelta)) }),
        color: A.indigo
      },
      daysLeft > 0 && projDelta < 0
        ? { k: this.tr('Needed to recover'), v: this.n1(needed), unit: ' ' + this.tr('h/day'), d: this.tr('Over {d} days left', { d: this.trim1(daysLeft) }), color: A.amber }
        : { k: this.tr('Days reported'), v: this.n0(reported), unit: '/' + this.trim1(daysFull), d: this.tr('{n} leave', { n: this.trim1(leave) }), color: A.amber }
    ];
    this.monthNote = this.tr('Expected hours already allow for your weekly off, public holidays and approved leave.');

    return { pct, achieved, expected: expToDate };
  }

  // ── timeline ───────────────────────────────────────────────────────────────

  /** Draws today's segments and returns the unlogged minutes inside the punch span.
   *  The same number feeds the hero, so the page never shows two different gaps. */
  private applyTimeline(hero: DprEmpHero, timeline: DprEmpTimelineSeg[]): number {
    const rows = timeline
      .map(s => {
        const start = this.parseHm(s.startTime);
        const mins = Math.max(this.num(s.minutes), 0);
        const end = this.parseHm(s.endTime) ?? (start === null ? null : start + mins);
        return { s, start, end };
      })
      .filter(r => r.start !== null && r.end !== null)
      .sort((a, b) => (a.start as number) - (b.start as number)) as { s: DprEmpTimelineSeg; start: number; end: number }[];

    const fp = this.parseHm(hero.firstPunch);
    const lp = this.parseHm(hero.lastPunch);
    const now = this.nowMin();

    if (!rows.length && fp === null) {
      this.tlSegs = [];
      this.tlStart = '';
      this.tlEnd = '';
      this.tlPunches = '';
      this.todayStats = this.buildTodayStats(hero, 0);
      return 0;
    }

    const winStart = Math.min(fp ?? Infinity, ...rows.map(r => r.start));
    const lastEnd = rows.length ? Math.max(...rows.map(r => r.end)) : winStart;
    const running = rows.some(r => (r.s.isRunning ?? '') === 'Y');
    const winEnd = Math.max(running ? now : Math.max(lastEnd, lp ?? lastEnd), winStart + 30);
    const span = winEnd - winStart;
    const pct = (m: number) => this.clamp((m / span) * 100, 0, 100);

    const segs: TlSeg[] = [];
    let cursor = winStart;
    let gapTotal = 0;
    const pushGap = (from: number, to: number) => {
      const g = to - from;
      if (g < 5) { return; }
      gapTotal += g;
      const w = pct(g);
      segs.push({
        left: pct(from - winStart), width: w, bg: '', gap: true,
        label: w >= 11 ? this.hmLong(g) : '',
        tip: this.tr('No log against this time — <b>{d}</b>', { d: this.hmLong(g) })
      });
    };

    rows.forEach(r => {
      if (r.start > cursor) { pushGap(cursor, r.start); }
      const isWork = (r.s.segType ?? '').toUpperCase() === 'WORK';
      const isRun = (r.s.isRunning ?? '') === 'Y';
      const label = (r.s.label ?? '').trim();
      const isTravel = !isWork && label.toUpperCase().indexOf('TRAVEL') >= 0;
      const mins = r.end - r.start;
      const w = pct(mins);
      segs.push({
        left: pct(r.start - winStart), width: w, gap: false,
        bg: isWork ? (isRun ? A.indigo : A.emerald) : (isTravel ? A.amber : A.sky),
        label: w >= 14 ? (isRun ? this.tr('{l} · running', { l: label || this.tr('Work') }) : (label || this.tr(isWork ? 'Work' : 'Break'))) : '',
        tip: this.tr('{l} — {a} to {b} · <b>{d}</b>', {
          l: escHtml(label || this.tr(isWork ? 'Work' : 'Break')), a: this.hm(r.start),
          b: isRun ? this.tr('now, running') : this.hm(r.end), d: this.hmLong(mins)
        })
      });
      cursor = Math.max(cursor, r.end);
    });
    if (!running && lp !== null && lp > cursor) { pushGap(cursor, lp); }

    this.tlSegs = segs;
    this.tlStart = this.tr('{t} first punch', { t: fp !== null ? this.to12h(fp) : this.to12h(winStart) });
    this.tlEnd = running ? this.tr('{t} now', { t: this.to12h(now) }) : this.to12h(winEnd);
    const pc = this.num(hero.punchCount);
    this.tlPunches = pc > 0 ? this.tr(pc === 1 ? '{n} punch' : '{n} punches', { n: pc }) : '';
    this.todayStats = this.buildTodayStats(hero, gapTotal);
    return gapTotal;
  }

  private buildTodayStats(hero: DprEmpHero, gapMin: number): StatBox[] {
    const logged = this.num(hero.todayLoggedMin);
    const expH = this.num(hero.expectedDailyHours);
    const brk = this.num(hero.breakMinToday);
    const lp = this.parseHm(hero.lastPunch);
    const t12 = lp === null ? null : this.to12hParts(lp);
    return [
      { k: this.tr('Day logged'), v: this.hm(logged), unit: '', d: expH > 0 ? this.tr('of {h} h', { h: this.trim1(expH) }) : '', color: A.emerald },
      { k: this.tr('Break'), v: this.hm(brk), unit: '', d: this.tr(brk > 0 ? (hero.openBreakReason ? 'On break now' : 'Taken today') : 'None yet'), color: A.sky },
      { k: this.tr('Not logged'), v: this.hm(gapMin), unit: '', d: this.tr(gapMin > 0 ? 'Needs a log' : 'All accounted for'), color: gapMin > 0 ? A.rose : A.emerald },
      { k: this.tr('Last punch'), v: t12 ? t12.hm : '—', unit: t12 ? ' ' + t12.ap : '', d: this.tr('{n} punches today', { n: this.num(hero.punchCount) }), color: A.amber }
    ];
  }

  // ── active task ────────────────────────────────────────────────────────────

  private applyActiveTask(hero: DprEmpHero, timeline: DprEmpTimelineSeg[], myTasks: DprEmpTask[]): void {
    const runTitle = (hero.runningTaskTitle ?? '').trim();
    const runId = hero.runningTaskId ?? null;
    const match = myTasks.find(t => (runId !== null && this.num(t.taskId) === this.num(runId))
      || (runTitle && (t.taskTitle ?? '').trim() === runTitle)) ?? null;

    const todayOnTask = timeline
      .filter(s => (s.segType ?? '').toUpperCase() === 'WORK' && (s.label ?? '').trim() === runTitle)
      .reduce((sum, s) => sum + this.num(s.minutes), 0);

    const pick = match ?? (runTitle ? null : myTasks[0] ?? null);
    this.actCategory = ((pick?.categoryName ?? '').trim() || this.tr('Uncategorised'));
    if (runTitle) {
      this.actTitle = runTitle;
      const since = (hero.runningSince ?? '').trim();
      this.actSub = since ? this.tr('Started {t} today', { t: since }) : this.tr('Running now');
      this.actToday = this.hm(todayOnTask);
    } else if (pick) {
      this.actTitle = (pick.taskTitle ?? '').trim() || this.tr('Untitled task');
      this.actSub = this.tr('Not running · next in your list');
      this.actToday = '00:00';
      this.actLive = '—';
    } else {
      this.actTitle = this.tr('No task running');
      this.actSub = this.tr('{n} tasks touched today', { n: this.num(hero.tasksToday) });
      this.actToday = '—';
      this.actLive = '—';
    }
    this.actProgress = this.clamp(this.num(pick?.progress), 0, 100);
    this.actTotal = pick ? this.hm(this.num(pick.myLoggedHours) * 60) : '—';

    const od = myTasks.find(t => (t.isOverdue ?? '') === 'Y' && t !== match) ?? null;
    this.overdueRow = od ? this.toTaskRow(od) : null;
  }

  // ── week ───────────────────────────────────────────────────────────────────

  private applyWeek(week: DprEmpWeekDay[], hero: DprEmpHero): { total: number; target: number; active: number } {
    if (!week.length) {
      this.weekCols = [];
      this.weekStats = [];
      this.weekFill = 0;
      this.weekMark = 0;
      return { total: 0, target: 0, active: 0 };
    }

    const target = this.num(week[0].targetHours) || this.num(hero.expectedDailyHours);
    const hours = week.map(w => this.num(w.hours));
    const maxH = Math.max(...hours, 0);
    // Chart ceiling leaves headroom above the tallest bar for its value label.
    const axisMax = Math.max(target * 1.33, maxH * 1.1, 1);
    this.weekTargetPct = this.clamp((target / axisMax) * 100, 0, 100);
    this.weekTargetLabel = target > 0 ? this.hrs(this.trim1(target)) : '—';

    const isOff = (w: DprEmpWeekDay) => (w.isWorkingDay ?? '') !== 'Y' || (w.onLeave ?? '') === 'Y';
    const pastIdx = week.map((w, i) => ({ w, i })).filter(x => (x.w.isToday ?? '') !== 'Y' && !isOff(x.w));
    const peakH = pastIdx.length ? Math.max(...pastIdx.map(x => hours[x.i])) : 0;

    let onTarget = 0;
    let working = 0;
    this.weekCols = week.map((w, i) => {
      const h = hours[i];
      const today = (w.isToday ?? '') === 'Y';
      const off = isOff(w);
      const leave = (w.onLeave ?? '') === 'Y';
      const diff = h - target;
      if (!off && !today) {
        working++;
        if (target > 0 && h >= target) { onTarget++; }
      }
      const running = today && this.timerRunning;
      return {
        h: off && h <= 0 ? 0 : this.clamp((h / axisMax) * 100, 0, 100),
        val: this.n2(h),
        day: this.tr(today ? 'TODAY' : (w.dayName ?? '').trim().toUpperCase().slice(0, 3)),
        varTxt: off ? this.tr(leave ? 'LEAVE' : 'OFF') : running ? this.tr('Live') : (diff >= 0 ? '+' : '−') + this.n1(Math.abs(diff)),
        varCls: off ? 'nx' : running ? 'run' : diff >= 0 ? 'up' : 'dn',
        off: off && h <= 0,
        offIcon: leave ? 'beach_access' : 'bedtime',
        today,
        short: !off && !today && target > 0 && h < target,
        peak: !off && !today && h > 0 && h === peakH,
        tip: this.fmtDate(w.theDate) + ' — '
          + (off && h <= 0 ? this.tr(leave ? 'approved leave' : 'weekly off, no target')
            : this.tr('<b>{v} h</b>', { v: this.n2(h) }) + (today ? this.tr(' so far') : '')
            + (target > 0 && !today ? this.tr(diff >= 0 ? ' · {v} h over target' : ' · {v} h short of target', { v: this.n2(Math.abs(diff)) }) : ''))
      };
    });

    const total = hours.reduce((s, v) => s + v, 0);
    const active = hours.filter(v => v > 0).length;
    const weekTarget = week.filter(w => !isOff(w)).reduce((s, w) => s + (this.num(w.targetHours) || target), 0);
    const peakIdx = hours.indexOf(Math.max(...hours));
    const peakDay = peakIdx >= 0 ? this.fmtDay(week[peakIdx].theDate) : '—';

    this.weekStats = [
      { k: this.tr('Week total'), v: this.hm(total * 60), unit: '', d: this.tr(active === 1 ? '{n} active day' : '{n} active days', { n: active }), color: A.emerald },
      { k: this.tr('Daily average'), v: this.n2(active > 0 ? total / active : 0), unit: ' ' + this.tr('h'), d: this.tr('Target {t} h', { t: this.trim1(target) }), color: A.sky },
      { k: this.tr('Peak day'), v: this.hm(Math.max(...hours) * 60), unit: '', d: peakDay, color: A.amber },
      { k: this.tr('Days on target'), v: String(onTarget), unit: '/' + working, d: this.tr('{n} fell short', { n: working - onTarget }), color: A.violet }
    ];

    const wkScale = Math.max(weekTarget, total, 1) * 1.1;
    this.weekFill = this.clamp((total / wkScale) * 100, 0, 100);
    this.weekMark = this.clamp((weekTarget / wkScale) * 100, 0, 100);
    this.weekTotalText = this.hrs(this.n2(total));
    const delta = total - weekTarget;
    this.weekPillCls = delta >= 0 ? 'ok' : 'wt';
    this.weekPillTxt = this.tr(delta >= 0 ? '{v} h ahead' : '{v} h behind', { v: this.n2(Math.abs(delta)) });
    this.weekFillTip = this.tr('Logged this week — <b>{v} h</b>', { v: this.n2(total) });
    this.weekMarkTip = this.tr('Week target — <b>{v} h</b>', { v: this.n1(weekTarget) });

    return { total, target: weekTarget, active };
  }

  // ── calendar ───────────────────────────────────────────────────────────────

  private applyCalendar(rows: DprEmpCalendarDay[], tiles: DprEmpTiles): void {
    this.calMonthLabel = this.monthOnly(tiles.monthKey ?? (rows[0]?.theDate ?? null));
    if (!rows.length) {
      this.buildSkeletonCalendar();
      this.calFoot = [];
      return;
    }

    const cells: CalCell[] = [];
    const lead = this.leadingBlanks(rows[0]);
    for (let i = 0; i < lead; i++) {
      cells.push({ empty: true, cls: '', day: 0, hh: '', tip: '', delay: '' });
    }

    let missed = 0;
    rows.forEach((r, idx) => {
      const h = this.num(r.hours);
      const target = this.num(r.targetHours);
      const working = (r.isWorkingDay ?? '') === 'Y';
      const leave = (r.onLeave ?? '') === 'Y';
      const future = (r.isFuture ?? '') === 'Y';
      const today = (r.isToday ?? '') === 'Y';

      let cls = '';
      let hh = '';
      let lab = '';
      if (leave) {
        cls = 'lv'; hh = this.tr('LEAVE'); lab = this.tr('approved leave');
      } else if (h > 0) {
        const ratio = h / Math.max(target, 1);
        cls = ratio >= 1.15 ? 'l5' : ratio >= 1.05 ? 'l4' : ratio >= 0.95 ? 'l3' : ratio >= 0.75 ? 'l2' : 'l1';
        hh = this.n1(h);
        lab = this.tr('<b>{v} h</b>', { v: this.n1(h) }) + (today ? this.tr(' so far') : '');
      } else if (future) {
        cls = 'ahead'; lab = this.tr('still ahead');
      } else if (!working) {
        cls = 'off'; hh = this.tr('OFF'); lab = this.tr('weekly off');
      } else if (!today) {
        cls = 'ms'; hh = this.tr('MISS'); lab = this.tr('no DPR logged'); missed++;
      } else {
        lab = this.tr('nothing logged yet');
      }
      if (today) { cls = (cls + ' today').trim(); }
      cells.push({
        empty: false, cls, hh,
        day: this.num(r.dayNum) || idx + 1,
        tip: this.fmtDate(r.theDate) + ' — ' + lab,
        delay: (idx * 14) + 'ms'
      });
    });
    this.calCells = cells;

    const reported = this.num(tiles.daysReported);
    const monthHours = this.num(tiles.monthHours);
    this.calFoot = [
      { k: this.tr('Reported'), v: this.tr('{a} of {b}', { a: this.n0(reported), b: this.trim1(this.num(tiles.workingDaysFullMonth)) }) },
      { k: this.tr('Total'), v: this.hrs(this.n1(monthHours)) },
      { k: this.tr('Avg'), v: this.tr('{v} h/d', { v: this.n2(reported > 0 ? monthHours / reported : 0) }) },
      { k: this.tr('Leave'), v: this.trim1(this.num(tiles.leaveDays)) },
      { k: this.tr('Missed'), v: String(missed) }
    ];
  }

  /** Sunday-first index of the month's first row, from Oracle's DY value
   *  (never new Date().getDay() — that shifts with the browser timezone). */
  private leadingBlanks(first: DprEmpCalendarDay): number {
    const dy = (first.dayName ?? '').trim().toUpperCase().slice(0, 3);
    const i = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].indexOf(dy);
    if (i >= 0) { return i; }
    const p = (first.theDate ?? '').split('-');
    return p.length === 3 ? new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay() : 0;
  }

  /** Neutral grid of the right size so the calendar does not reflow while loading. */
  private buildSkeletonCalendar(): void {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const cells: CalCell[] = [];
    for (let i = 0; i < first; i++) {
      cells.push({ empty: true, cls: '', day: 0, hh: '', tip: '', delay: '' });
    }
    for (let d = 1; d <= days; d++) {
      cells.push({ empty: false, cls: d === now.getDate() ? 'today' : '', day: d, hh: '', tip: '', delay: '' });
    }
    this.calCells = cells;
    this.calMonthLabel = now.toLocaleDateString(this.i18n.locale(), { month: 'long' });
  }

  // ── tasks, estimates, forms ────────────────────────────────────────────────

  private applyTasks(rows: DprEmpTask[]): void {
    this.taskRows = rows.slice(0, 5).map(t => this.toTaskRow(t));
  }

  private toTaskRow(t: DprEmpTask): TaskRow {
    const st = (t.assigneeStatus ?? '').trim().toUpperCase();
    const running = (t.isRunning ?? '') === 'Y' || st === 'RUNNING';
    const overdue = (t.isOverdue ?? '') === 'Y';
    const paused = st === 'PAUSED';
    const cat = (t.categoryName ?? '').trim() || this.tr('Uncategorised');
    const due = t.targetDate ? this.tr(overdue ? 'was due {d}' : 'due {d}', { d: this.fmtDay(t.targetDate) }) : this.tr('no target date');
    const est = this.num(t.estimatedHours);
    const mine = this.num(t.myLoggedHours);
    return {
      icon: running ? 'play_arrow' : overdue ? 'priority_high' : paused ? 'pause' : 'task_alt',
      color: running ? A.emerald : overdue ? A.rose : paused ? A.amber : A.sky,
      title: (t.taskTitle ?? '').trim() || this.tr('Untitled task'),
      sub: (paused ? this.tr('Paused') + ' · ' : '') + cat + ' · ' + due,
      logged: this.n1(mine),
      of: est > 0 ? this.tr('of {h} h', { h: this.trim1(est) }) : this.tr('h logged'),
      over: est > 0 && mine > est
    };
  }

  /** Distance from the estimate on one axis — left of centre is under, right is over. */
  private applyEstActual(rows: DprEmpEstAct[]): void {
    const withEst = rows.filter(r => this.num(r.estimatedHours) > 0).slice(0, 5);
    if (!withEst.length) {
      this.estRows = [];
      this.estFoot = '';
      return;
    }
    const diffs = withEst.map(r => this.num(r.totalActualHours) - this.num(r.estimatedHours));
    const maxAbs = Math.max(...diffs.map(Math.abs), 1) * 1.1;
    this.estRows = withEst.map((r, i) => {
      const est = this.num(r.estimatedHours);
      const act = this.num(r.totalActualHours);
      const d = diffs[i];
      return {
        name: (r.taskTitle ?? '').trim() || this.tr('Untitled task'),
        vv: this.tr('{a} / {e} h', { a: this.n1(act), e: this.trim1(est) }),
        over: d > 0,
        width: this.clamp((Math.abs(d) / maxAbs) * 50, 0.8, 50),
        tip: this.tr(d > 0 ? 'Estimate {e} h, your hours {a} h — <b>{d} h over</b>' : 'Estimate {e} h, your hours {a} h — <b>{d} h under</b>',
          { e: this.n1(est), a: this.n1(act), d: this.n1(Math.abs(d)) })
      };
    });
    const estSum = withEst.reduce((s, r) => s + this.num(r.estimatedHours), 0);
    const actSum = withEst.reduce((s, r) => s + this.num(r.totalActualHours), 0);
    this.estFoot = this.tr('{a} h actual of {e} h estimated', { a: this.n1(actSum), e: this.n1(estSum) });
  }

  private applyForms(rows: DprEmpForm[]): void {
    this.formRows = rows.slice(0, 4).map(f => {
      const type = (f.formType ?? '').trim() || 'Request';
      const typeLabel = this.tr(type);
      const t = type.toUpperCase();
      const st = (f.status ?? '').trim().toUpperCase();
      const step = (f.currentStep ?? '').trim();
      const age = this.daysSince(f.submittedDate);
      const days = this.num(f.duration);
      const icon = t.indexOf('EMERGENCY') >= 0 ? 'emergency'
        : t.indexOf('RESIGN') >= 0 ? 'logout'
          : t.indexOf('LEAVE') >= 0 ? 'flight_takeoff' : 'description';
      const color = t.indexOf('EMERGENCY') >= 0 ? A.rose
        : t.indexOf('RESIGN') >= 0 ? A.violet
          : t.indexOf('LEAVE') >= 0 ? A.amber : A.sky;
      const approved = st.charAt(0) === 'A' || step.toUpperCase() === 'COMPLETED';
      const rejected = st.charAt(0) === 'R' || step.toUpperCase() === 'REJECTED';
      const parts = [
        f.departureDate ? this.tr('Leaves {d}', { d: this.fmtDay(f.departureDate) }) : '',
        f.submittedDate ? this.tr('submitted {d}', { d: this.fmtDay(f.submittedDate) }) : '',
        !approved && !rejected && age !== null ? this.tr(age === 1 ? '{n} day in queue' : '{n} days in queue', { n: age }) : ''
      ].filter(p => p);
      return {
        icon, color,
        title: typeLabel + (days > 0 ? ' · ' + this.tr(days === 1 ? '{n} day' : '{n} days', { n: this.trim1(days) }) : ''),
        sub: parts.join(' · ') || this.tr('No detail'),
        pillCls: approved ? 'ok' : rejected ? 'cr' : 'wt',
        pillTxt: approved ? this.tr('Approved') : rejected ? this.tr('Rejected') : (step ? this.tr('With {r}', { r: this.tr(this.roleLabel(step)) }) : this.tr('Pending'))
      };
    });
  }

  private applyApprovals(tiles: DprEmpTiles, forms: DprEmpForm[]): void {
    const waitingMe = this.num(tiles.formApprovalsWaitingMe);
    const mineOpen = forms.filter(f => {
      const st = (f.status ?? '').trim().toUpperCase();
      const step = (f.currentStep ?? '').trim().toUpperCase();
      return st.charAt(0) !== 'A' && st.charAt(0) !== 'R' && step !== 'COMPLETED' && step !== 'REJECTED';
    }).length;
    this.approvalCount = waitingMe + mineOpen;
    this.approvalSub = waitingMe > 0
      ? this.tr(waitingMe === 1 ? '{n} form waiting on you' : '{n} forms waiting on you', { n: waitingMe })
      : mineOpen > 0
        ? this.tr('{n} of your requests in progress', { n: mineOpen })
        : this.tr('Nothing waiting');
    this.popBadges();
  }

  private toNoticeRow(n: any): NoticeRow {
    const pr = (n?.priority ?? '').toString().trim().toUpperCase();
    const high = pr.startsWith('H') || pr === 'URGENT';
    return {
      title: (n?.title ?? '').toString().trim() || this.tr('Notice'),
      sub: [n?.startDate ? this.tr('Posted {d}', { d: this.fmtIsoDay(n.startDate) }) : '', (n?.createdBy ?? '').toString().trim()]
        .filter((p: string) => p).join(' · '),
      unread: (n?.isRead ?? '') === 'N',
      icon: high ? 'priority_high' : 'campaign',
      color: high ? A.rose : A.amber,
      raw: n
    };
  }

  private toNotifRow(n: any): NotifRow {
    const title = (n?.title ?? '').toString().toLowerCase();
    const msg = (n?.message ?? '').toString();
    const m = (title + ' ' + msg).toLowerCase();
    const icon = m.indexOf('reject') >= 0 ? 'cancel'
      : m.indexOf('approv') >= 0 ? 'check_circle'
        : m.indexOf('notice') >= 0 || n?.isNotice ? 'campaign'
          : m.indexOf('task') >= 0 || m.indexOf('assign') >= 0 ? 'assignment_ind'
            : m.indexOf('leave') >= 0 ? 'flight_takeoff' : 'notifications';
    const color = icon === 'cancel' ? A.rose : icon === 'check_circle' ? A.emerald
      : icon === 'campaign' ? A.amber : icon === 'assignment_ind' ? A.sky : A.indigo;
    return {
      id: this.num(n?.id),
      icon, color,
      message: msg.trim() || (n?.title ?? '').toString().trim() || this.tr('Notification'),
      time: this.relTime(n?.createdAt),
      unread: !(n?.isRead === true || n?.isRead === 'Y'),
      link: (n?.link ?? '').toString().trim(),
      isNotice: !!n?.isNotice,
      noticeId: this.num(n?.noticeID)
    };
  }

  private blankKpis(): KpiTile[] {
    const b = (label: string, color: string, icon: string, unit: string, dec: number): KpiTile =>
      ({ label: this.tr(label), color, icon, unit, dec, value: 0, pillCls: 'nu', pillTxt: '—', barPct: 0, foot: this.tr('Loading…') });
    return [
      b('Logged today', A.emerald, 'schedule', ' ' + this.tr('h'), 2),
      b('This week', A.sky, 'trending_up', ' ' + this.tr('h total'), 2),
      b('Open work', A.indigo, 'list_alt', ' ' + this.tr('tasks'), 0),
      b('Month achieved', A.violet, 'military_tech', this.tr('% of target'), 1)
    ];
  }

  // ══ ANIMATION ═════════════════════════════════════════════════════════════
  // Bars, rings and timeline segments grow through CSS keyframes that end at
  // their bound value, so the resting frame is always the real one. Only the
  // KPI numbers count up, and they are written outside Angular's zone.

  private countUpAll(): void {
    this.fxCleanup.push(countUpAll(this.el.nativeElement, this.zone, () => !this.destroyed));
  }

  // ══ REVEAL + BADGES ═══════════════════════════════════════════════════════

  private popBadges(): void {
    this.badgePop = false;
    this.timers.push(setTimeout(() => { this.badgePop = true; }, 20));
  }

  // ══ FORMATTERS ════════════════════════════════════════════════════════════

  fmt(v: number, dec: number): string { return fmtNum(v, dec); }

  private num(v: unknown): number {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    return isFinite(n) ? n : 0;
  }

  private clamp(v: number, lo: number, hi: number): number { return Math.min(Math.max(v, lo), hi); }
  private n0(v: number): string { return this.fmt(v, 0); }
  private n1(v: number): string { return this.fmt(v, 1); }
  private n2(v: number): string { return this.fmt(v, 2); }

  /** 9 -> '9', 8.5 -> '8.5' */
  private trim1(v: number): string {
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }

  /** minutes -> 'HH:MM' */
  private hm(min: number): string {
    const m = Math.max(Math.round(min), 0);
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  /** minutes -> 'H:MM' (ring centre) */
  private hShort(min: number): string {
    const m = Math.max(Math.round(min), 0);
    return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
  }

  /** minutes -> '1 h 35 m' / '47 m' */
  private hmLong(min: number): string {
    const m = Math.max(Math.round(min), 0);
    const h = Math.floor(m / 60);
    return h > 0 ? this.tr('{h} h {m} m', { h, m: String(m % 60).padStart(2, '0') }) : this.tr('{m} m', { m: m % 60 });
  }

  /** '8.5' -> '8.5 h' (Arabic: '8.5 س') */
  private hrs(v: string): string { return this.tr('{v} h', { v }); }

  /** 'HH:MI' TEXT -> minutes since midnight (never subtract HHMM numerically) */
  private parseHm(txt: string | null | undefined): number | null {
    const m = /^(\d{1,2}):(\d{2})/.exec((txt ?? '').trim());
    if (!m) { return null; }
    const h = +m[1];
    const mi = +m[2];
    return h > 23 || mi > 59 ? null : h * 60 + mi;
  }

  private to12hParts(min: number): { hm: string; ap: string } {
    const h24 = Math.floor(min / 60) % 24;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return { hm: String(h12).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'), ap: this.tr(h24 >= 12 ? 'PM' : 'AM') };
  }

  private to12h(min: number): string {
    const p = this.to12hParts(min);
    return p.hm + ' ' + p.ap;
  }

  private nowMin(): number {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  /** elapsed from a user-local 'HH:MI' start to now */
  private elapsedFrom(startMin: number | null, withSeconds = false): string {
    if (startMin === null) { return withSeconds ? '—' : ''; }
    const now = new Date();
    let sec = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) - startMin * 60;
    if (sec < 0) { sec += 24 * 3600; }
    const base = String(Math.floor(sec / 3600)).padStart(2, '0') + ':' + String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    return withSeconds ? base + ':' + String(sec % 60).padStart(2, '0') : base;
  }

  private greeting(): string {
    const h = new Date().getHours();
    return this.tr(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }

  private todayLine(): string {
    return new Date().toLocaleDateString(this.i18n.locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  /** Approver role codes: short ones are acronyms (HOD, IT, HR) and stay upper;
   *  longer ones (HANDOVER) read better title-cased. */
  private roleLabel(code: string): string {
    const t = code.trim();
    return t.length <= 3 ? t.toUpperCase() : this.titleCase(t);
  }

  private titleCase(s: string): string {
    return s.toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase());
  }

  /** 'YYYY-MM-DD' -> 'Tue 22 Sep' (parsed as UTC so the day never shifts) */
  private fmtDate(iso: string | null | undefined): string {
    const p = (iso ?? '').split('-');
    if (p.length < 3) { return (iso ?? '').trim() || '—'; }
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]))
      .toLocaleDateString(this.i18n.locale(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  /** 'YYYY-MM-DD' -> '22 Sep' */
  private fmtDay(iso: string | null | undefined): string {
    const p = (iso ?? '').split('-');
    if (p.length < 3) { return (iso ?? '').trim() || '—'; }
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]))
      .toLocaleDateString(this.i18n.locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  /** a DateTime from .NET (ISO string) -> '22 Sep' */
  private fmtIsoDay(v: unknown): string {
    const t = this.ts(v);
    return t ? new Date(t).toLocaleDateString(this.i18n.locale(), { day: 'numeric', month: 'short' }) : '';
  }

  private ts(v: unknown): number {
    const t = v ? Date.parse(String(v)) : NaN;
    return isFinite(t) ? t : 0;
  }

  /** 'YYYY-MM' -> 'September' */
  private monthOnly(key: string | null | undefined): string {
    const p = (key ?? '').split('-');
    if (p.length < 2) { return new Date().toLocaleDateString(this.i18n.locale(), { month: 'long' }); }
    return new Date(Date.UTC(+p[0], +p[1] - 1, 1)).toLocaleDateString(this.i18n.locale(), { month: 'long', timeZone: 'UTC' });
  }

  private daysSince(iso: string | null | undefined): number | null {
    const p = (iso ?? '').split('-');
    if (p.length < 3) { return null; }
    const now = new Date();
    const d = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(+p[0], +p[1] - 1, +p[2])) / 86400000);
    return isFinite(d) && d >= 0 ? d : null;
  }

  private relTime(v: unknown): string {
    const t = this.ts(v);
    if (!t) { return ''; }
    const mins = Math.max(Math.round((Date.now() - t) / 60000), 0);
    if (mins < 1) { return this.tr('Just now'); }
    if (mins < 60) { return this.tr(mins === 1 ? '{n} minute ago' : '{n} minutes ago', { n: mins }); }
    const h = Math.round(mins / 60);
    if (h < 24) { return this.tr(h === 1 ? '{n} hour ago' : '{n} hours ago', { n: h }); }
    const d = Math.round(h / 24);
    if (d === 1) { return this.tr('Yesterday'); }
    if (d < 7) { return this.tr('{n} days ago', { n: d }); }
    return new Date(t).toLocaleDateString(this.i18n.locale(), { day: 'numeric', month: 'short' });
  }
}
