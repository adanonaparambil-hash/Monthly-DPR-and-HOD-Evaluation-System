import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Api } from '../services/api';
import { QaqcDrillKind, QaqcWeeklyIr, QaqcWeeklyIrDiscipline, QaqcWeeklyPeriod, QaqcWeeklyProject, QaqcWeeklyResult } from '../models/qaqcWeekly.model';
import { DrillSpec, QaqcDrillComponent } from './drill/qaqc-drill.component';
import { bindTooltip, escHtml, fmtNum, reduceMotion, setupReveal } from '../utils/dash-fx';

// ── view models ──────────────────────────────────────────────────────────────

type SortKey = 'open' | 'total' | 'name';
type IrFilter = 'ALL' | 'WIR' | 'MIR';
type Level = 'hi' | 'md' | 'ok';
/** A KPI tile the user clicked: the project list re-ranks by it and the other columns fade back. */
type Lens = 'obs' | 'ncr' | 'week' | 'trn' | null;
type IrView = 'dept' | 'disc';

interface ProjectChip { code: string; label: string; name: string; }

/** One half of a scoreboard row: observations or NCRs of one project. */
interface Part {
  total: number; closed: number; open: number; week: number;
  cW: number;     // closed, % of this project's own total
  oW: number;     // open, % of this project's own total
  pct: number;    // closed, rounded %
}

/** One row of the scoreboard — every number of the weekly sheet for one project. */
interface ScoreRow {
  code: string; label: string; name: string;
  obs: Part; ncr: Part;
  trn: number; trnWeek: number;
  trnW: number;   // trainings as % of the busiest project shown (the colour level of the training box)
  openItems: number; closure: number;
  level: Level; levelText: string;
  tags: string[];
  tip: string;
}

/** A project that needs a look, with the plain-language reasons. */
interface AttentionRow {
  code: string; label: string; name: string;
  level: 'hi' | 'md'; levelText: string;
  openItems: number; closure: number; points: number;
  tags: { text: string; kind: 'cr' | 'wt' | 'nu' }[];
}

/** One line of "this week vs last week". */
interface WeekCmp {
  key: string; title: string; icon: string; color: string;
  now: number; prev: number | null; delta: number | null;
  deltaText: string; trend: 'up' | 'down' | 'flat' | 'na';
  wNow: number; wPrev: number;
}

/** One column of the inspection-request matrix: a document type + department. */
interface MatCol { key: string; docType: string; department: string; accent: string; total: number; }
/** One row of the matrix: a status and its value in every column. */
/** what a click on a count lists */
interface DrillTarget { kind: QaqcDrillKind; metric: string; dept?: string; disc?: string; label: string; }
/** One inspection card: a department (or discipline) of WIR or MIR, every status as a ring slice and a row. */
interface IrSeg { code: string; text: string; color: string; v: number; w: number; tip: string; d: DrillTarget | null; dash: string; off: number; }
interface IrCard { key: string; docType: string; name: string; total: number; totCell: { d: DrillTarget | null }; okPct: number; pending: number; segs: IrSeg[]; }
/** The colour key above the cards: each status and its count over every card shown. */
interface IrLegend { code: string; text: string; color: string; v: number; }
interface MatRow {
  code: string; text: string; kind: 'code' | 'cmt' | 'open' | 'tot'; color: string;
  cells: { v: number; w: number; tip: string; d: DrillTarget | null }[];
}

const LS_PROJECTS = 'qaqcWeekly.projects';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Component({
  selector: 'app-qaqc-weekly-dashboard',
  standalone: true,
  imports: [CommonModule, QaqcDrillComponent],
  templateUrl: './qaqc-weekly-dashboard.component.html',
  styleUrls: ['../styles/dpr-dash.css', './qaqc-weekly-dashboard.component.css']
})
export class QaqcWeeklyDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('tip') tipEl?: ElementRef<HTMLElement>;

  // ── state ──────────────────────────────────────────────────────────────────
  loading = true;
  loaded = false;
  loadError: string | null = null;
  updatedText = '';

  period: QaqcWeeklyPeriod | null = null;
  /** DD/MM/YYYY the user picked; null = let the server choose (last Thursday → Thursday). */
  fromDate: string | null = null;
  toDate: string | null = null;

  allProjects: ProjectChip[] = [];
  selected = new Set<string>();
  pickerOpen = false;

  projects: QaqcWeeklyProject[] = [];
  ir: QaqcWeeklyIr[] = [];
  irDisc: QaqcWeeklyIrDiscipline[] = [];

  readonly sorts: { key: SortKey; label: string }[] = [
    { key: 'open',  label: 'Most open' },
    { key: 'total', label: 'Most observations' },
    { key: 'name',  label: 'A – Z' }
  ];
  sortKey: SortKey = 'open';
  irFilter: IrFilter = 'ALL';

  /** the short form names used on this page, spelled out in the header for anyone new to them */
  readonly formNames: { code: string; name: string }[] = [
    { code: 'WIR',  name: 'Work Inspection Request' },
    { code: 'MIR',  name: 'Material Inspection Request' },
    { code: 'SOR',  name: 'Site Observation Report' },
    { code: 'QTBT', name: 'Training Evidence Report' },
    { code: 'NCR',  name: 'Non Conformance Report' }
  ];
  irView: IrView = 'dept';
  /** the inspection table can scroll sideways: is there more on the left / right? (drives the arrows and the edge fade) */
  lens: Lens = null;
  /** ring geometry: circumference of the hero ring (r = 52) and of the project-card rings (r = 26) */
  readonly heroC = 326.73;
  readonly rC = 163.36;
  /** inspection-card ring (r = 23) */
  readonly irC = 144.51;

  // ── derived (recomputed by compute()) ──────────────────────────────────────
  kObsTotal = 0; kObsClosed = 0; kObsOpen = 0; kObsWeek = 0; kObsPct = 0;
  kNcrCum = 0;   kNcrClosed = 0; kNcrOpen = 0; kNcrWeek = 0; kNcrPct = 0;
  kTrn = 0;      kTrnWeek = 0;
  kWir = 0;      kMir = 0;       kIrCommented = 0; kIrOpen = 0; kIrCommentedPct = 0;
  kClosedWeek = 0;
  kClosure = 0;
  closedDelta: number | null = null;
  trnDelta: number | null = null;

  headline = '';
  prevText = '';
  rows: ScoreRow[] = [];
  hiddenCount = 0;
  totals = { obsTotal: 0, obsClosed: 0, obsOpen: 0, obsWeek: 0, ncrCum: 0, ncrClosed: 0, ncrOpen: 0, ncrWeek: 0, trn: 0, trnWeek: 0 };
  attention: AttentionRow[] = [];
  cmps: WeekCmp[] = [];
  deptCards: IrCard[] = [];
  deptLegend: IrLegend[] = [];
  discCards: IrCard[] = [];
  discLegend: IrLegend[] = [];

  private prev: QaqcWeeklyResult | null = null;
  private prevSeq = 0;
  private reqSeq = 0;
  private bootstrapped = false;
  private destroyed = false;
  private subs: Subscription[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private intervals: ReturnType<typeof setInterval>[] = [];
  private fxCleanup: (() => void)[] = [];
  private countCancel: (() => void) | null = null;
  private pickTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private api: Api,
    private el: ElementRef<HTMLElement>,
    private zone: NgZone
  ) { }

  // ══ lifecycle ═════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.restoreSelection();
    this.fetch(true);
    // the sheet moves slowly — a quiet refresh every 10 minutes keeps a wall display honest
    this.intervals.push(setInterval(() => { if (!this.loading) { this.fetch(false); } }, 600000));
  }

  ngAfterViewInit(): void {
    const tip = this.tipEl?.nativeElement;
    if (tip) { this.fxCleanup.push(bindTooltip(this.el.nativeElement, tip, this.zone)); }
    this.fxCleanup.push(setupReveal(this.el.nativeElement));
    this.fxCleanup.push(this.pinRail());
  }

  /**
   * The right column rides along beside the project cards (CSS position:sticky, desktop only). When it is taller
   * than the view, its sticky top goes negative by the difference: it scrolls with the page until its bottom is
   * in view and then stays, so all of it can be read and the column beside the cards is never empty.
   */
  private pinRail(): () => void {
    const host = this.el.nativeElement as HTMLElement;
    const rail = host.querySelector<HTMLElement>('.rail');
    const view = host.closest('main.content') as HTMLElement | null;   // the portal scrolls inside <main class="content">
    if (!rail || typeof ResizeObserver === 'undefined') { return () => { }; }
    const set = () => {
      const viewH = view ? view.clientHeight : window.innerHeight;
      rail.style.setProperty('--rail-top', Math.min(16, viewH - rail.offsetHeight - 16) + 'px');
    };
    return this.zone.runOutsideAngular(() => {
      const ro = new ResizeObserver(set);
      ro.observe(rail);
      if (view) { ro.observe(view); }
      set();
      return () => ro.disconnect();
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.countCancel?.();
    this.fxCleanup.forEach(fn => fn());
    this.timers.forEach(t => clearTimeout(t));
    this.intervals.forEach(t => clearInterval(t));
    if (this.pickTimer) { clearTimeout(this.pickTimer); }
    this.subs.forEach(s => s.unsubscribe());
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: Event): void {
    if (!this.pickerOpen) { return; }
    const box = this.el.nativeElement.querySelector('.picker');
    if (box && !box.contains(ev.target as Node)) { this.pickerOpen = false; }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void { this.pickerOpen = false; }

  // ══ template helpers ══════════════════════════════════════════════════════

  trackCode = (_: number, p: ProjectChip): string => p.code;
  trackRow = (_: number, r: ScoreRow): string => r.code;
  trackAtt = (_: number, a: AttentionRow): string => a.code;
  trackCmp = (_: number, c: WeekCmp): string => c.key;
  /** the status under the pointer on an inspection card: its ring slice and its tile light up together */
  irHot: { key: string; code: string } | null = null;
  irEnter(c: IrCard, g: IrSeg): void { this.irHot = { key: c.key, code: g.code }; }
  irLeave(): void { this.irHot = null; }
  irHotSeg(c: IrCard): IrSeg | null {
    const h = this.irHot;
    return h && h.key === c.key ? c.segs.find(s => s.code === h.code) ?? null : null;
  }
  isIrHot(c: IrCard, g: IrSeg): boolean { return !!this.irHot && this.irHot.key === c.key && this.irHot.code === g.code; }

  trackIrCard = (_: number, c: IrCard): string => c.key;
  trackIrLeg = (_: number, l: IrLegend): string => l.code;

  get scopeText(): string {
    const n = this.selected.size;
    return n ? `${n} of ${this.allProjects.length} projects` : `All ${this.allProjects.length || this.projects.length} projects`;
  }
  get pickerText(): string {
    const n = this.selected.size;
    return n ? `${n} selected` : 'All projects';
  }
  get weekTitle(): string {
    const f = this.parse(this.period?.fromDate), t = this.parse(this.period?.toDate);
    if (!f || !t) { return '—'; }
    const sameYear = f.getFullYear() === t.getFullYear();
    return `${this.dm(f)}${sameYear ? '' : ' ' + f.getFullYear()} – ${this.dm(t)} ${t.getFullYear()}`;
  }
  get weekSub(): string {
    const f = this.parse(this.period?.fromDate), t = this.parse(this.period?.toDate);
    if (!f || !t) { return ''; }
    const days = Math.round((t.getTime() - f.getTime()) / 86400000);
    return `${days} day${days === 1 ? '' : 's'} · after ${this.wd(f)}, through ${this.wd(t)}`;
  }
  get weekTip(): string {
    return 'A document counts in the week when its date is <b>after</b> the first day and <b>on or before</b> the last day, ' +
           'so two weeks in a row never count the same Thursday twice.';
  }
  get isDefaultWeek(): boolean { return this.fromDate === null && this.toDate === null; }
  get canNext(): boolean {
    const t = this.parse(this.period?.toDate);
    return !!t && t.getTime() < this.latestThursday().getTime();
  }
  /** yyyy-MM-dd for <input type=date> */
  get fromIso(): string { return this.toIsoOf(this.period?.fromDate); }
  get toIso(): string { return this.toIsoOf(this.period?.toDate); }

  // ══ actions ═══════════════════════════════════════════════════════════════

  refresh(): void { this.fetch(false); }
  retry(): void { this.fetch(true); }

  step(dir: -1 | 1): void {
    const f = this.parse(this.period?.fromDate), t = this.parse(this.period?.toDate);
    if (!f || !t || (dir > 0 && !this.canNext)) { return; }
    f.setDate(f.getDate() + 7 * dir);
    t.setDate(t.getDate() + 7 * dir);
    this.fromDate = this.fmt(f);
    this.toDate = this.fmt(t);
    this.fetch(true);
  }

  thisWeek(): void {
    if (this.isDefaultWeek) { return; }
    this.fromDate = null;
    this.toDate = null;
    this.fetch(true);
  }

  onFrom(ev: Event): void { this.pickDate('from', (ev.target as HTMLInputElement).value); }
  onTo(ev: Event): void { this.pickDate('to', (ev.target as HTMLInputElement).value); }

  setSort(k: SortKey): void {
    if (k === this.sortKey && !this.lens) { return; }
    this.sortKey = k;
    this.lens = null;
    this.buildRows();
    this.schedule(() => this.runFx());
  }

  setIrFilter(f: IrFilter): void {
    if (f === this.irFilter) { return; }
    this.irFilter = f;
    this.buildMatrix();
    this.schedule(() => this.runFx());
  }

  /** Click a KPI tile → rank the projects by that number; click it again to go back. */
  setLens(l: Exclude<Lens, null>): void {
    this.lens = this.lens === l ? null : l;
    this.buildRows();
    this.schedule(() => this.runFx());
  }

  setIrView(v: IrView): void {
    if (v === this.irView) { return; }
    this.irView = v;
    this.schedule(() => this.runFx());
  }

  /** the pill on a project card */
  riskText(r: ScoreRow): string { return r.level === 'hi' ? 'High risk' : r.level === 'md' ? 'Watch' : 'On track'; }

  /** one short line at the foot of a project card: the main reason, or the good news */
  note(r: ScoreRow): string {
    if (r.level !== 'ok' && r.tags.length) { return r.tags[0].charAt(0).toUpperCase() + r.tags[0].slice(1); }
    const week = r.obs.week + r.ncr.week;
    if (week > 0) { return `${week} closed this week`; }
    if (r.closure >= 80) { return 'High compliance site'; }
    const closed = r.obs.closed + r.ncr.closed;
    return closed ? `${closed} closed to date` : 'Nothing closed yet';
  }

  /** From "Needs attention": open that project's window. */
  focusProject(code: string): void {
    const r = this.rows.find(x => x.code === code);
    if (r) { this.openProject(r); }
  }

  /**
   * A project row: one window with the project's status and reasons on top and every record type below
   * (observations, NCRs, trainings, WIR, MIR), each with its filters and a paged list.
   */
  openProject(r: ScoreRow, tab?: number): void {
    const per = this.period;
    const views = (list: [string, string, number | null][]) => list.map(([metric, label, count]) => ({ metric, label, count }));
    const ir = (kind: 'WIR' | 'MIR', label: string, icon: string, accent: string) => ({
      kind, label, icon, accent, big: null, bigLabel: 'total', sub: 'Loading…', pct: null,
      views: views([['TOTAL', 'All', null], ['CODE1', 'Code 1', null], ['CODE2', 'Code 2', null], ['CODE3', 'Code 3', null],
                    ['CODER', 'Code R', null], ['COMMENTED', 'Commented', null], ['OPEN', 'Open', null]])
    });
    this.drill = {
      request: { kind: 'OBS', metric: 'OPEN', fromDate: per?.fromDate ?? null, toDate: per?.toDate ?? null,
                 projectCodes: [r.code], department: null, discipline: null },
      title: r.label,
      subtitle: [r.name, per ? 'week ' + this.periodText(per.fromDate, per.toDate) : ''].filter(x => !!x).join(' · '),
      icon: 'apartment',
      accent: r.level === 'hi' ? 'var(--a4)' : r.level === 'md' ? 'var(--a2)' : 'var(--a1)',
      insight: { level: r.level, levelText: r.levelText, closure: r.closure, tags: r.tags },
      // start where the work is: open observations, else open NCRs
      tab: tab ?? (r.obs.open > 0 || r.ncr.open === 0 ? 0 : 1),
      tabs: [
        { kind: 'OBS', label: 'Observations', icon: 'visibility', accent: 'var(--a3)',
          big: r.obs.open, bigLabel: 'open', sub: `${r.obs.closed} closed · ${r.obs.total} total`, pct: r.obs.pct,
          start: r.obs.open > 0 ? 'OPEN' : 'TOTAL',
          views: views([['OPEN', 'Open', r.obs.open], ['CLOSED', 'Closed', r.obs.closed], ['WEEK', 'Closed this week', r.obs.week], ['TOTAL', 'All', r.obs.total]]) },
        { kind: 'NCR', label: 'NCRs', icon: 'report_problem', accent: 'var(--a4)',
          big: r.ncr.open, bigLabel: 'open', sub: `${r.ncr.closed} closed · ${r.ncr.total} total`, pct: r.ncr.pct,
          start: r.ncr.open > 0 ? 'OPEN' : 'TOTAL',
          views: views([['OPEN', 'Open', r.ncr.open], ['CLOSED', 'Closed', r.ncr.closed], ['WEEK', 'Closed this week', r.ncr.week], ['TOTAL', 'All', r.ncr.total]]) },
        { kind: 'TRN', label: 'Trainings', icon: 'school', accent: 'var(--a6)',
          big: r.trn, bigLabel: 'held', sub: `+${r.trnWeek} this week`, pct: null,
          views: views([['TOTAL', 'All', r.trn], ['WEEK', 'Held this week', r.trnWeek]]) },
        ir('WIR', 'Work inspections', 'engineering', 'var(--a5)'),
        ir('MIR', 'Material inspections', 'inventory_2', 'var(--a2)')
      ]
    };
  }

  // ══ drill-down: click any count → the records behind it ═════════════════════════════

  /** the window of records, or null when closed */
  drill: DrillSpec | null = null;

  /** every project the dashboard is showing — the KPI tiles and the Total row add these up */
  private shownCodes(): string[] { return this.projects.map(p => p.projectCode); }

  /** one project row's count */
  openRow(ev: Event, kind: QaqcDrillKind, metric: string, count: number, r: ScoreRow): void {
    this.openDrill(ev, kind, metric, count, { codes: [r.code], scope: r.label + ' · ' + r.name });
  }

  /** a tile / total: all the projects on screen */
  openAll(ev: Event | null, kind: QaqcDrillKind, metric: string, count: number): void {
    this.openDrill(ev, kind, metric, count, { codes: this.shownCodes(), scope: this.scopeText });
  }

  /** a WIR / MIR count that is not tied to a table cell (the tile): follows the project selection, like the inspection table */
  openIr(ev: Event, kind: 'WIR' | 'MIR', count: number): void {
    this.openDrill(ev, kind, 'TOTAL', count, { codes: Array.from(this.selected), scope: this.scopeText });
  }

  /** "Closed this week" tile: observations first, NCRs when there are no observations */
  openClosedWeek(ev: Event): void {
    if (this.kObsWeek > 0 || this.kNcrWeek === 0) { this.openAll(ev, 'OBS', 'WEEK', this.kObsWeek); }
    else { this.openAll(ev, 'NCR', 'WEEK', this.kNcrWeek); }
  }

  /** a cell of the inspection table */
  openCell(c: { d: DrillTarget | null }): void {
    const d = c.d;
    if (!d) { return; }
    this.openDrill(null, d.kind, d.metric, 1, { codes: Array.from(this.selected), scope: this.scopeText + ' · ' + d.label, dept: d.dept, disc: d.disc });
  }

  /** the "this week vs last week" numbers — last week uses the previous week's dates */
  openCmp(ev: Event, c: WeekCmp, last: boolean): void {
    const kind: QaqcDrillKind = c.key === 'obs' ? 'OBS' : c.key === 'ncr' ? 'NCR' : 'TRN';
    this.openDrill(ev, kind, 'WEEK', (last ? c.prev : c.now) ?? 0, { codes: this.shownCodes(), scope: this.scopeText, prev: last });
  }

  closeDrill(): void { this.drill = null; }

  private openDrill(ev: Event | null, kind: QaqcDrillKind, metric: string, count: number,
                    opt: { codes: string[]; scope: string; dept?: string; disc?: string; prev?: boolean }): void {
    ev?.stopPropagation();
    if (!count) { return; }                                  // nothing to list
    const per = opt.prev ? this.prev?.period : this.period;
    const names: Record<QaqcDrillKind, string> = { OBS: 'Observations', NCR: 'NCRs', TRN: 'Trainings', WIR: 'Work inspection requests', MIR: 'Material inspection requests' };
    const what: Record<string, string> = {
      TOTAL: 'all', CLOSED: 'closed', OPEN: (kind === 'WIR' || kind === 'MIR') ? 'pending · no comment yet' : 'open',
      WEEK: kind === 'TRN' ? 'held this week' : 'closed this week',
      CODE1: 'Code 1 · approved', CODE2: 'Code 2 · approved with comments', CODE3: 'Code 3 · revise and resubmit', CODER: 'Code R · not approved',
      COMMENTED: 'pending · has an inspector comment'
    };
    const sub = [opt.scope];
    if (metric === 'WEEK' && per) { sub.push((opt.prev ? 'last week ' : 'week ') + this.periodText(per.fromDate, per.toDate)); }
    this.drill = {
      request: { kind, metric, fromDate: per?.fromDate ?? null, toDate: per?.toDate ?? null, projectCodes: opt.codes, department: opt.dept ?? null, discipline: opt.disc ?? null },
      title: names[kind] + ' · ' + (what[metric] ?? metric.toLowerCase()),
      subtitle: sub.filter(x => !!x).join(' · '),
      icon: kind === 'OBS' ? 'visibility' : kind === 'NCR' ? 'report_problem' : kind === 'TRN' ? 'school' : kind === 'WIR' ? 'engineering' : 'inventory_2',
      accent: kind === 'OBS' ? 'var(--a3)' : kind === 'NCR' ? 'var(--a4)' : kind === 'TRN' ? 'var(--a6)' : 'var(--a5)'
    };
  }

  /** "08 Oct – 15 Oct 2026" for a DD/MM/YYYY pair */
  private periodText(from: string, to: string): string {
    const f = this.parse(from), t = this.parse(to);
    return f && t ? `${this.dm(f)} – ${this.dm(t)} ${t.getFullYear()}` : '';
  }

  goIr(): void {
    this.el.nativeElement.querySelector('#qw-ir')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  /** stroke-dashoffset of a ring showing pct % of its circumference */
  off(c: number, pct: number): number { return c * (1 - Math.max(0, Math.min(100, pct)) / 100); }

  /** how many projects have at least one training on record */
  get rowsWithTrainings(): number { return this.rows.filter(r => r.trn > 0).length; }

  get lensText(): string {
    return this.lens === 'obs' ? 'Observations open' : this.lens === 'ncr' ? 'NCRs open'
         : this.lens === 'week' ? 'Closed this week' : this.lens === 'trn' ? 'Trainings held' : '';
  }

  togglePicker(ev: Event): void { ev.stopPropagation(); this.pickerOpen = !this.pickerOpen; }

  toggleProject(code: string): void {
    if (this.selected.has(code)) { this.selected.delete(code); } else { this.selected.add(code); }
    this.selectionChanged();
  }

  clearProjects(): void {
    if (!this.selected.size) { return; }
    this.selected.clear();
    this.selectionChanged();
  }

  // ══ data ══════════════════════════════════════════════════════════════════

  /** `replay` = first load / a week or project change: count-ups run again. A quiet refresh does not. */
  private fetch(replay: boolean): void {
    const seq = ++this.reqSeq;
    this.loading = true;
    this.loadError = null;

    // A remembered project list needs the full list of projects too (for the picker), so the very first
    // call goes out unfiltered, learns the projects, and is followed at once by the filtered call.
    const bootstrap = !this.bootstrapped && this.selected.size > 0;
    const codes = bootstrap ? [] : Array.from(this.selected);

    this.subs.push(this.api.getQaqcWeekly({ fromDate: this.fromDate, toDate: this.toDate, projectCodes: codes }).subscribe({
      next: (res: any) => {
        if (this.destroyed || seq !== this.reqSeq) { return; }
        const d: QaqcWeeklyResult | null = res?.data ?? null;
        if (!res?.success || !d) { this.fail(res?.message); return; }

        if (!this.bootstrapped && (bootstrap || this.selected.size === 0)) {
          this.allProjects = d.projects.map(p => ({ code: p.projectCode, label: p.projectLabel || p.projectCode, name: p.projectName }));
          this.bootstrapped = true;
          this.pruneSelection();
          if (bootstrap && this.selected.size > 0) { this.fetch(replay); return; }   // loading stays on
        }
        this.apply(d, replay);
      },
      error: (e: any) => {
        if (this.destroyed || seq !== this.reqSeq) { return; }
        this.fail(e?.error?.message || e?.message);
      }
    }));
  }

  private apply(d: QaqcWeeklyResult, replay: boolean): void {
    this.period = d.period;
    this.projects = d.projects ?? [];
    this.ir = d.ir ?? [];
    this.irDisc = d.irDiscipline ?? [];
    this.compute();
    this.loading = false;
    this.loaded = true;
    this.updatedText = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    this.loadPrev(d.period);
    if (replay) { this.schedule(() => this.runFx()); }
  }

  private fail(message?: string): void {
    this.loading = false;
    this.loadError = message || 'Could not load the dashboard';
  }

  private pickDate(which: 'from' | 'to', iso: string): void {
    if (!iso) { return; }
    const picked = this.fmtIso(iso);
    if (!picked) { return; }
    // the other end stays where it is now (so one date can be changed on its own)
    const from = which === 'from' ? picked : (this.fromDate ?? this.period?.fromDate ?? null);
    const to   = which === 'to'   ? picked : (this.toDate   ?? this.period?.toDate   ?? null);
    const f = this.parse(from ?? undefined), t = this.parse(to ?? undefined);
    if (f && t && f.getTime() >= t.getTime()) {
      this.loadError = 'The first date must be earlier than the last date.';
      return;
    }
    this.fromDate = from;
    this.toDate = to;
    this.fetch(true);
  }

  private selectionChanged(): void {
    try { localStorage.setItem(LS_PROJECTS, JSON.stringify(Array.from(this.selected))); } catch { /* storage may be blocked */ }
    // several clicks in a row become one request
    if (this.pickTimer) { clearTimeout(this.pickTimer); }
    this.pickTimer = setTimeout(() => this.fetch(true), 280);
  }

  private restoreSelection(): void {
    try {
      const raw = localStorage.getItem(LS_PROJECTS);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) { arr.filter((c: any) => typeof c === 'string' && c).forEach((c: string) => this.selected.add(c)); }
    } catch { /* ignore */ }
  }

  /** A remembered project that no longer exists would filter the whole page to nothing. */
  private pruneSelection(): void {
    const known = new Set(this.allProjects.map(p => p.code));
    Array.from(this.selected).forEach(c => { if (!known.has(c)) { this.selected.delete(c); } });
  }

  /** Quietly fetches the week before the one on screen (same project list) for the comparison. */
  private loadPrev(p: QaqcWeeklyPeriod | null): void {
    const f = this.parse(p?.fromDate), t = this.parse(p?.toDate);
    if (!f || !t) { this.prev = null; this.buildCmp(); return; }
    f.setDate(f.getDate() - 7);
    t.setDate(t.getDate() - 7);
    const seq = ++this.prevSeq;
    this.subs.push(this.api.getQaqcWeekly({ fromDate: this.fmt(f), toDate: this.fmt(t), projectCodes: Array.from(this.selected) }).subscribe({
      next: (res: any) => {
        if (this.destroyed || seq !== this.prevSeq) { return; }
        this.prev = res?.success ? (res.data ?? null) : null;
        this.buildCmp();
        this.schedule(() => this.runFx());
      },
      error: () => {
        if (this.destroyed || seq !== this.prevSeq) { return; }
        this.prev = null;
        this.buildCmp();
      }
    }));
  }

  // ══ derived data ══════════════════════════════════════════════════════════

  private compute(): void {
    const P = this.projects;
    const sum = (f: (p: QaqcWeeklyProject) => number) => P.reduce((s, p) => s + f(p), 0);

    this.kObsTotal = sum(p => p.obsTotal);   this.kObsClosed = sum(p => p.obsClosed);
    this.kObsOpen = sum(p => p.obsOpen);     this.kObsWeek = sum(p => p.obsClosedLastWeek);
    this.kObsPct = this.pct(this.kObsClosed, this.kObsTotal);

    this.kNcrCum = sum(p => p.ncrCumulative); this.kNcrClosed = sum(p => p.ncrClosedTotal);
    this.kNcrOpen = sum(p => p.ncrOpen);      this.kNcrWeek = sum(p => p.ncrClosedLastWeek);
    this.kNcrPct = this.pct(this.kNcrClosed, this.kNcrCum);

    this.kTrn = sum(p => p.trainings);       this.kTrnWeek = sum(p => p.trainingsWeek);
    this.kClosedWeek = this.kObsWeek + this.kNcrWeek;
    this.kClosure = this.pct(this.kObsClosed + this.kNcrClosed, this.kObsTotal + this.kNcrCum);

    this.kWir = this.ir.filter(r => r.docType === 'WIR').reduce((s, r) => s + r.total, 0);
    this.kMir = this.ir.filter(r => r.docType === 'MIR').reduce((s, r) => s + r.total, 0);
    this.kIrCommented = this.ir.reduce((s, r) => s + r.commented, 0);
    this.kIrOpen = this.ir.reduce((s, r) => s + r.openCount, 0);
    this.kIrCommentedPct = this.pct(this.kIrCommented, this.kWir + this.kMir);

    this.totals = {
      obsTotal: this.kObsTotal, obsClosed: this.kObsClosed, obsOpen: this.kObsOpen, obsWeek: this.kObsWeek,
      ncrCum: this.kNcrCum, ncrClosed: this.kNcrClosed, ncrOpen: this.kNcrOpen, ncrWeek: this.kNcrWeek,
      trn: this.kTrn, trnWeek: this.kTrnWeek
    };

    this.buildRows();
    this.buildAttention();
    this.buildHeadline();
    this.buildCmp();
    this.buildMatrix();
  }

  /**
   * What the numbers say about one project. Open NCRs weigh most, then how much of its work is still
   * open (75%+ / 50%+ with 10+ open), then a week with nothing closed. No training is a note only.
   * High = 7+ points, Watch = 2–6.
   */
  private risk(p: QaqcWeeklyProject): { pts: number; tags: AttentionRow['tags']; open: number; total: number } {
    const total = p.obsTotal + p.ncrCumulative;
    const open = p.obsOpen + p.ncrOpen;
    const share = this.pct(open, total);
    const weekClosed = p.obsClosedLastWeek + p.ncrClosedLastWeek;
    const tags: AttentionRow['tags'] = [];
    let pts = 0;
    if (p.ncrOpen > 0) { tags.push({ text: `${p.ncrOpen} open NCR${p.ncrOpen === 1 ? '' : 's'}`, kind: 'cr' }); pts += 3 + Math.min(p.ncrOpen, 3); }
    if (open >= 10 && share >= 75) { tags.push({ text: `${share}% still open`, kind: 'cr' }); pts += 3; }
    else if (open >= 10 && share >= 50) { tags.push({ text: `${share}% still open`, kind: 'wt' }); pts += 1; }
    if (open > 0 && weekClosed === 0) { tags.push({ text: 'nothing closed this week', kind: 'wt' }); pts += 1; }
    if (p.trainingsWeek === 0) { tags.push({ text: p.trainings ? 'no training this week' : 'no trainings on record', kind: 'nu' }); }
    return { pts, tags, open, total };
  }

  /** One row per project that has anything at all, with every figure of the weekly sheet. */
  private buildRows(): void {
    const all = this.projects;
    const live = all.filter(p => p.obsTotal + p.ncrCumulative + p.trainings > 0);
    this.hiddenCount = all.length - live.length;

    const sorted = [...live].sort((x, y) => {
      if (this.lens) {
        const m = (p: QaqcWeeklyProject) => this.lens === 'obs' ? p.obsOpen : this.lens === 'ncr' ? p.ncrOpen
                                         : this.lens === 'week' ? p.obsClosedLastWeek + p.ncrClosedLastWeek : p.trainings;
        return m(y) - m(x) || (y.obsOpen + y.ncrOpen) - (x.obsOpen + x.ncrOpen);
      }
      if (this.sortKey === 'name') { return (x.projectLabel || x.projectCode).localeCompare(y.projectLabel || y.projectCode); }
      if (this.sortKey === 'total') { return y.obsTotal - x.obsTotal || (y.obsOpen + y.ncrOpen) - (x.obsOpen + x.ncrOpen); }
      return (y.obsOpen + y.ncrOpen) - (x.obsOpen + x.ncrOpen) || y.obsTotal - x.obsTotal;
    });
    const w = (v: number, total: number) => total > 0 ? 100 * v / total : 0;
    const maxTrn = Math.max(1, ...live.map(p => p.trainings));

    this.rows = sorted.map(p => {
      const r = this.risk(p);
      const label = p.projectLabel || p.projectCode;
      const closure = this.pct(p.obsClosed + p.ncrClosedTotal, r.total);
      const level: Level = r.pts >= 7 ? 'hi' : r.pts >= 2 ? 'md' : 'ok';
      return {
        code: p.projectCode, label, name: p.projectName,
        obs: { total: p.obsTotal, closed: p.obsClosed, open: p.obsOpen, week: p.obsClosedLastWeek,
               cW: w(p.obsClosed, p.obsTotal), oW: w(p.obsOpen, p.obsTotal), pct: this.pct(p.obsClosed, p.obsTotal) },
        ncr: { total: p.ncrCumulative, closed: p.ncrClosedTotal, open: p.ncrOpen, week: p.ncrClosedLastWeek,
               cW: w(p.ncrClosedTotal, p.ncrCumulative), oW: w(p.ncrOpen, p.ncrCumulative), pct: this.pct(p.ncrClosedTotal, p.ncrCumulative) },
        trn: p.trainings, trnWeek: p.trainingsWeek, trnW: Math.round(100 * p.trainings / maxTrn),
        openItems: r.open, closure, level,
        levelText: level === 'hi' ? 'High' : level === 'md' ? 'Watch' : 'On track',
        tags: r.tags.filter(t => t.kind !== 'nu').map(t => t.text),
        tip: `<b>${escHtml(label)}</b> · ${escHtml(p.projectName || '')}<br>` +
             `Observations + NCRs closed: <b>${p.obsClosed + p.ncrClosedTotal}</b> of <b>${r.total}</b> (<b>${closure}%</b>)` +
             (r.tags.length ? `<br>${r.tags.map(t => escHtml(t.text)).join(' · ')}` : '')
      } as ScoreRow;
    });
  }

  private buildAttention(): void {
    const rows: AttentionRow[] = [];
    for (const p of this.projects) {
      if (p.obsTotal + p.ncrCumulative + p.trainings === 0) { continue; }
      const r = this.risk(p);
      if (r.pts < 2) { continue; }
      rows.push({
        code: p.projectCode, label: p.projectLabel || p.projectCode, name: p.projectName,
        level: r.pts >= 7 ? 'hi' : 'md', levelText: r.pts >= 7 ? 'High' : 'Watch',
        openItems: r.open, closure: this.pct(p.obsClosed + p.ncrClosedTotal, r.total), points: r.pts, tags: r.tags
      });
    }
    this.attention = rows.sort((a, b) => b.points - a.points || b.openItems - a.openItems).slice(0, 5);
  }

  /** The one sentence at the top: what the whole page says. */
  private buildHeadline(): void {
    if (!this.projects.length) { this.headline = ''; return; }
    const open = this.kObsOpen + this.kNcrOpen;
    const n = this.projects.filter(p => p.obsOpen + p.ncrOpen > 0).length;
    const a = open === 0 ? 'Nothing is open' : `${open.toLocaleString('en-US')} open item${open === 1 ? '' : 's'} across ${n} project${n === 1 ? '' : 's'}`;
    const b = this.kClosedWeek > 0 ? `${this.kClosedWeek} closed this week` : 'nothing closed this week yet';
    const c = this.kNcrOpen > 0 ? `${this.kNcrOpen} NCR${this.kNcrOpen === 1 ? '' : 's'} open` : 'no NCR open';
    this.headline = `${a} · ${b} · ${c}`;
  }

  /** This week against the week before it (observations closed, NCRs closed, trainings held). */
  private buildCmp(): void {
    const pv = this.prev?.projects ?? null;
    const sum = (f: (p: QaqcWeeklyProject) => number) => pv ? pv.reduce((s, p) => s + f(p), 0) : null;
    const line = (key: string, title: string, icon: string, color: string, now: number, prev: number | null): WeekCmp => {
      const delta = prev === null ? null : now - prev;
      const max = Math.max(now, prev ?? 0, 1);
      return {
        key, title, icon, color, now, prev, delta,
        trend: delta === null ? 'na' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
        deltaText: delta === null ? '—' : delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '±0',
        wNow: 100 * now / max, wPrev: prev === null ? 0 : 100 * prev / max
      };
    };
    const pObs = sum(p => p.obsClosedLastWeek), pNcr = sum(p => p.ncrClosedLastWeek), pTrn = sum(p => p.trainingsWeek);
    this.cmps = [
      line('obs', 'Observations closed', 'visibility',     'var(--a1)', this.kObsWeek, pObs),
      line('ncr', 'NCRs closed',         'report_problem', 'var(--a3)', this.kNcrWeek, pNcr),
      line('trn', 'Trainings held',      'school',         'var(--a6)', this.kTrnWeek, pTrn)
    ];
    this.closedDelta = pObs === null || pNcr === null ? null : this.kClosedWeek - (pObs + pNcr);
    this.trnDelta = pTrn === null ? null : this.kTrnWeek - pTrn;
    const pp = this.prev?.period;
    const f = this.parse(pp?.fromDate), t = this.parse(pp?.toDate);
    this.prevText = f && t ? `Last week: ${this.dm(f)} – ${this.dm(t)} ${t.getFullYear()}` : 'Last week is loading…';
  }

  /** WIR / MIR by department, and WIR by discipline: the same table, only the grouping column differs. */
  private buildMatrix(): void {
    const departments = Array.from(new Set(this.ir.map(r => r.department)));
    const byDept = this.matrixOf(
      this.ir.filter(r => this.irFilter === 'ALL' || r.docType === this.irFilter)
             .map(r => ({ docType: r.docType, label: r.department, accent: this.deptAccent(r.department, departments.indexOf(r.department)), c: r })), 'dept');
    this.deptCards = this.cardsOf(byDept);
    this.deptLegend = this.legendOf(byDept);

    // MIR has no discipline, so this table is WIR only (the template hides it when the filter is MIR)
    const palette = ['var(--a6)', 'var(--a5)', 'var(--a3)', 'var(--a1)', 'var(--a4)', 'var(--a2)'];
    const byDisc = this.matrixOf(this.irDisc.map((r, i) => ({ docType: r.docType, label: r.discipline, accent: palette[i % palette.length], c: r })), 'disc');
    this.discCards = this.cardsOf(byDisc);
    this.discLegend = this.legendOf(byDisc);
  }

  /** the matrix turned into one card per column: ring slices laid end to end, approval share, pending */
  private cardsOf(m: { cols: MatCol[]; rows: MatRow[] }): IrCard[] {
    const C = this.irC;
    const totRow = m.rows.find(r => r.kind === 'tot');
    return m.cols.map((c, j) => {
      let at = 0;
      const segs: IrSeg[] = m.rows.filter(r => r.kind !== 'tot').map(r => {
        const cell = r.cells[j];
        const len = c.total ? C * cell.v / c.total : 0;
        const seg: IrSeg = { code: r.code, text: r.text, color: r.color, v: cell.v, w: cell.w, tip: cell.tip, d: cell.d,
                             dash: `${len.toFixed(2)} ${C}`, off: -at };
        at += len;
        return seg;
      });
      const v = (code: string) => segs.find(x => x.code === code)?.v ?? 0;
      return { key: c.key, docType: c.docType, name: c.department, total: c.total, totCell: { d: totRow?.cells[j]?.d ?? null },
               okPct: Math.min(100, this.pct(v('Code 1') + v('Code 2'), c.total)), pending: v('Commented') + v('Open'), segs };
    });
  }

  private legendOf(m: { cols: MatCol[]; rows: MatRow[] }): IrLegend[] {
    return m.rows.filter(r => r.kind !== 'tot').map(r => ({ code: r.code, text: r.text, color: r.color, v: r.cells.reduce((a, c) => a + c.v, 0) }));
  }

  /** One column per item, one row per status. Pending = no Code yet, split into Commented and Open. */
  private matrixOf(items: { docType: string; label: string; accent: string;
      c: { code1: number; code2: number; code3: number; codeR: number; commented: number; openCount: number; total: number } }[],
      dim: 'dept' | 'disc'): { cols: MatCol[]; rows: MatRow[] } {
    const cols: MatCol[] = items.map(i => ({
      key: `${i.docType}|${i.label}`, docType: i.docType, department: i.label, accent: i.accent, total: i.c.total
    }));
    const def: { code: string; text: string; kind: MatRow['kind']; color: string; metric: string; get: (c: typeof items[number]['c']) => number }[] = [
      { code: 'Code 1',    text: 'Approved · work can proceed',                  kind: 'code', color: 'var(--a1)', metric: 'CODE1',    get: c => c.code1 },
      { code: 'Code 2',    text: 'Approved with comments · proceed',             kind: 'code', color: 'var(--a5)', metric: 'CODE2',    get: c => c.code2 },
      { code: 'Code 3',    text: 'Approved with comments · revise and resubmit', kind: 'code', color: 'var(--a3)', metric: 'CODE3',    get: c => c.code3 },
      { code: 'Code R',    text: 'Not approved · reason noted',                  kind: 'code', color: 'var(--a4)', metric: 'CODER',    get: c => c.codeR },
      { code: 'Commented', text: 'Pending · has an inspector comment',            kind: 'cmt',  color: 'var(--a6)', metric: 'COMMENTED',    get: c => c.commented },
      { code: 'Open',      text: 'Pending · no comment yet',                      kind: 'open', color: 'var(--ink4)', metric: 'OPEN',  get: c => c.openCount },
      { code: 'Total',     text: 'All documents',                                kind: 'tot',  color: 'var(--brand)', metric: 'TOTAL', get: c => c.total }
    ];
    const rows: MatRow[] = def.map(d => ({
      code: d.code, text: d.text, kind: d.kind, color: d.color,
      cells: items.map(i => {
        const v = d.get(i.c);
        return { v, w: this.pct(v, i.c.total),
                 tip: `<b>${escHtml(i.docType)} · ${escHtml(i.label)}</b><br>${escHtml(d.code)}: <b>${v}</b> of ${i.c.total} (${this.pct(v, i.c.total)}%)<br><i>Click to list these records</i>`,
                 // nothing to list when the count is 0
                 d: v > 0 ? { kind: i.docType as QaqcDrillKind, metric: d.metric, dept: dim === 'dept' ? i.label : undefined, disc: dim === 'disc' ? i.label : undefined,
                              label: (dim === 'dept' ? 'Department ' : 'Discipline ') + i.label } : null };
      })
    }));
    return { cols, rows };
  }

  /** The sheet colours CIVIL purple and ELE blue; the rest take the next free accent. */
  private deptAccent(dep: string, idx: number): string {
    const d = (dep || '').toUpperCase();
    if (/CIV/.test(d)) { return 'var(--a6)'; }
    if (/ELE/.test(d)) { return 'var(--a5)'; }
    if (/MECH|MEP|HVAC|PLUMB/.test(d)) { return 'var(--a3)'; }
    const free = ['var(--a1)', 'var(--a4)', 'var(--a2)'];
    return free[Math.max(idx, 0) % free.length];
  }

  private pct(v: number, total: number): number { return total > 0 ? Math.round(100 * v / total) : 0; }

  // ══ motion ════════════════════════════════════════════════════════════════

  private schedule(fn: () => void): void { this.timers.push(setTimeout(fn, 0)); }

  /**
   * Count every [data-cu] number up from zero. Two rules the shared helper does not keep:
   *  - it writes into the element's EXISTING text node (nodeValue), never textContent — Angular holds that
   *    node, and replacing it would freeze the number at whatever it showed when the data next changed;
   *  - the landing value is always read from data-cu at the end, so a refresh that changes the figure
   *    mid-animation, or an animation cancelled halfway, can never leave a wrong number on screen.
   */
  private runFx(): void {
    if (this.destroyed) { return; }
    this.countCancel?.();
    this.countCancel = null;
    if (reduceMotion()) { return; }

    const rafs: number[] = [];
    const targets: { el: HTMLElement; node: Text }[] = [];
    const landing = (el: HTMLElement) => fmtNum(parseFloat(el.getAttribute('data-cu') || '0') || 0, 0);

    this.el.nativeElement.querySelectorAll<HTMLElement>('[data-cu]').forEach(el => {
      const node = el.firstChild;
      const to = parseFloat(el.getAttribute('data-cu') || '0');
      if (!node || node.nodeType !== Node.TEXT_NODE || !isFinite(to) || to <= 0) { return; }
      targets.push({ el, node: node as Text });
    });

    const t0 = performance.now();
    this.zone.runOutsideAngular(() => {
      const frame = (now: number) => {
        if (this.destroyed) { return; }
        const p = Math.min((now - t0) / 1100, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        targets.forEach(t => {
          const to = parseFloat(t.el.getAttribute('data-cu') || '0') || 0;
          t.node.nodeValue = p < 1 ? fmtNum(to * ease, 0) : landing(t.el);
        });
        if (p < 1) { rafs.push(requestAnimationFrame(frame)); }
      };
      rafs.push(requestAnimationFrame(frame));
    });

    this.countCancel = () => {
      rafs.forEach(id => cancelAnimationFrame(id));
      targets.forEach(t => { t.node.nodeValue = landing(t.el); });   // never leave an in-between number
    };
  }

  // ══ dates (DD/MM/YYYY ↔ Date, always local noon so a DST shift can't move the day) ═══

  private parse(s?: string | null): Date | null {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s ?? '').trim());
    return m ? new Date(+m[3], +m[2] - 1, +m[1], 12, 0, 0) : null;
  }
  private fmt(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  private toIsoOf(s?: string | null): string {
    const d = this.parse(s);
    if (!d) { return ''; }
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  /** yyyy-MM-dd → DD/MM/YYYY ('' when it is not a date) */
  private fmtIso(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  }
  private latestThursday(): Date {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() - 4 + 7) % 7));
    return d;
  }
  private dm(d: Date): string { return `${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]}`; }
  private wd(d: Date): string { return `${DAY[d.getDay()]} ${this.dm(d)}`; }
}
