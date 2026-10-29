import { afterNextRender, Component, ElementRef, EventEmitter, HostListener, Injector, Input, NgZone, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable, Subscription } from 'rxjs';
import { Api } from '../../services/api';
import { QaqcDrillKind, QaqcDrillRequest, QaqcDrillResult, QaqcDrillRow } from '../../models/qaqcWeekly.model';

/** One filter inside a tab: "Open 76", "Closed this week 2" … (count null = not known yet). */
export interface DrillView { metric: string; label: string; count: number | null; }

/** One record type of a project window: the tab card shows its summary, the list shows its records. */
export interface DrillTab {
  kind: QaqcDrillKind;
  label: string;            // "Observations"
  icon: string;
  accent: string;
  big: number | null;       // the headline number (null = filled in after the first load)
  bigLabel: string;         // "open" / "held" / "total"
  sub: string;              // "4 closed · 80 total"
  pct: number | null;       // closed share for the little bar, null = no bar
  views: DrillView[];
  start?: string;           // metric shown first (default: the first view)
}

/** The "why" of a project: its status and the plain-language reasons. */
export interface DrillInsight { level: 'hi' | 'md' | 'ok'; levelText: string; closure: number; tags: string[]; }

/** What the dashboard hands over when someone clicks a count (or a whole project row). */
export interface DrillSpec {
  request: QaqcDrillRequest;
  title: string;          // "Observations · open"  /  "P399 - DBK"
  subtitle: string;       // "P399 - DBK · week 08 Oct – 15 Oct 2026"
  icon: string;           // material symbol
  accent: string;         // css colour (var(--a3) …)
  /** project window: one tab per record type (request.kind / metric are then taken from the tab) */
  tabs?: DrillTab[];
  tab?: number;
  insight?: DrillInsight;
}

interface Col { key: keyof QaqcDrillRow; label: string; cls: string; }
interface Loaded { rows: QaqcDrillRow[]; total: number; capped: boolean; }

type SortKey = keyof QaqcDrillRow;

/**
 * The records behind one count of the weekly QA/QC dashboard — or, with tabs, everything of one project:
 * search, sort, page (fitted to the window), export, and one click on a record opens its report
 * (the same PDF the QAQC report pages show).
 */
@Component({
  selector: 'app-qaqc-drill',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qaqc-drill.component.html',
  styleUrls: ['../../styles/dpr-dash.css', './qaqc-drill.component.css']
})
export class QaqcDrillComponent implements OnInit, OnDestroy {

  @Input({ required: true }) spec!: DrillSpec;
  @Output() closed = new EventEmitter<void>();

  loading = true;
  error: string | null = null;

  private all: QaqcDrillRow[] = [];
  totalCount = 0;
  capped = false;

  // project window: which tab / filter is showing (answers are kept, so switching back is instant)
  tabIndex = 0;
  metric = '';
  private cache = new Map<string, Loaded>();

  search = '';
  sortKey: SortKey = 'docDate';
  sortDir: 1 | -1 = -1;
  page = 1;
  /** 0 = as many rows as fit the window (no scrolling inside the list) */
  pageSizeChoice = 0;
  pageSize = 10;
  readonly pageSizes = [0, 25, 50, 100];

  /** the table after search + sort (all pages) and the part on screen */
  view: QaqcDrillRow[] = [];
  paged: QaqcDrillRow[] = [];

  // report viewer
  pdfOpen = false;
  pdfLoading = false;
  pdfError = '';
  pdfDocId = '';
  pdfUrl: SafeResourceUrl | null = null;
  private pdfBlob: Blob | null = null;
  private pdfBlobUrl: string | null = null;
  private pdfSub?: Subscription;

  private sub?: Subscription;
  private extraSubs: Subscription[] = [];
  private ro?: ResizeObserver;
  private bodyEl?: HTMLElement;

  constructor(private api: Api, private sanitizer: DomSanitizer, private zone: NgZone, private injector: Injector) { }

  /** the list area: watched so a page holds exactly as many rows as fit */
  @ViewChild('body') set bodyRef(ref: ElementRef<HTMLElement> | undefined) {
    const el = ref?.nativeElement;
    if (el === this.bodyEl) { return; }
    this.ro?.disconnect();
    this.bodyEl = el;
    if (el && typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.zone.run(() => this.fit()));
      this.ro.observe(el);
    }
  }

  // ══ lifecycle ═════════════════════════════════════════════════════════════

  ngOnInit(): void {
    document.body.style.overflow = 'hidden';     // the page behind stays still while the window is open
    if (this.spec.tabs?.length) {
      this.tabIndex = Math.min(Math.max(this.spec.tab ?? 0, 0), this.spec.tabs.length - 1);
      const t = this.spec.tabs[this.tabIndex];
      this.metric = t.start ?? t.views[0]?.metric ?? 'TOTAL';
      this.prefetchUnknown();
    } else {
      this.metric = this.spec.request.metric;
    }
    this.load();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.sub?.unsubscribe();
    this.extraSubs.forEach(s => s.unsubscribe());
    this.pdfSub?.unsubscribe();
    this.ro?.disconnect();
    this.revokePdf();
  }

  /** Esc: first closes the report, then the window */
  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.pdfOpen) { this.closePdf(); } else { this.close(); }
  }

  close(): void { this.closed.emit(); }

  // ══ what is showing ═══════════════════════════════════════════════════════

  get tabs(): DrillTab[] { return this.spec.tabs ?? []; }
  get tab(): DrillTab | null { return this.tabs[this.tabIndex] ?? null; }
  get kind(): QaqcDrillKind { return this.tab?.kind ?? this.spec.request.kind; }
  /** list colour: the tab's in a project window, the window's otherwise */
  get accent(): string { return this.tab?.accent ?? this.spec.accent; }

  private get request(): QaqcDrillRequest {
    return { ...this.spec.request, kind: this.kind, metric: this.metric };
  }

  /** one project only → the project column would repeat the title */
  get oneProject(): boolean { return (this.spec.request.projectCodes?.length ?? 0) === 1; }

  setTab(i: number): void {
    if (i === this.tabIndex || !this.tabs[i]) { return; }
    this.tabIndex = i;
    const t = this.tabs[i];
    this.metric = t.start ?? t.views[0]?.metric ?? 'TOTAL';
    this.resetList();
    this.load();
  }

  setView(v: DrillView): void {
    if (v.metric === this.metric) { return; }
    this.metric = v.metric;
    this.resetList();
    this.load();
  }

  private resetList(): void {
    this.search = '';
    this.sortKey = 'docDate';
    this.sortDir = -1;
    this.page = 1;
  }

  // ══ loading ═══════════════════════════════════════════════════════════════

  load(): void {
    const key = this.kind + '|' + this.metric;
    const hit = this.cache.get(key);
    this.sub?.unsubscribe();
    if (hit) { this.show(hit); return; }
    this.loading = true;
    this.error = null;
    this.sub = this.api.getQaqcDrill(this.request).subscribe({
      next: (res: any) => {
        const d: QaqcDrillResult | null = res?.data ?? null;
        if (!res?.success || !d) { this.fail(res?.message); return; }
        const got: Loaded = { rows: d.rows ?? [], total: d.totalCount ?? (d.rows?.length ?? 0), capped: !!d.capped };
        this.cache.set(key, got);
        this.learnCounts(this.kind, this.metric, got);
        this.show(got);
      },
      error: (e: any) => this.fail(e?.error?.message || e?.message)
    });
  }

  private show(d: Loaded): void {
    this.all = d.rows;
    this.totalCount = d.total;
    this.capped = d.capped;
    this.loading = false;
    this.error = null;
    this.page = 1;
    this.recompute();
    // the first rendered rows decide the row height (the app renders on the next frame, so wait for it)
    afterNextRender(() => this.fit(), { injector: this.injector });
  }

  private fail(message?: string): void {
    this.loading = false;
    this.error = message || 'Could not load the records.';
  }

  /**
   * WIR / MIR have no per-project numbers on the dashboard: load each one's full list once in the background
   * and count its filters from the status (the status text is exactly what each filter selects).
   */
  private prefetchUnknown(): void {
    this.tabs.forEach(t => {
      if (t.big !== null || t === this.tab) { return; }
      const req: QaqcDrillRequest = { ...this.spec.request, kind: t.kind, metric: 'TOTAL' };
      this.extraSubs.push(this.api.getQaqcDrill(req).subscribe({
        next: (res: any) => {
          const d: QaqcDrillResult | null = res?.data ?? null;
          if (!res?.success || !d) { return; }
          const got: Loaded = { rows: d.rows ?? [], total: d.totalCount ?? 0, capped: !!d.capped };
          this.cache.set(t.kind + '|TOTAL', got);
          this.learnCounts(t.kind, 'TOTAL', got);
        },
        error: () => { /* the tab simply loads when opened */ }
      }));
    });
  }

  private learnCounts(kind: QaqcDrillKind, metric: string, d: Loaded): void {
    const t = this.tabs.find(x => x.kind === kind);
    if (!t) { return; }
    const v = t.views.find(x => x.metric === metric);
    if (v && v.count === null) { v.count = d.total; }
    if (metric !== 'TOTAL' || (kind !== 'WIR' && kind !== 'MIR')) { return; }
    if (t.big === null) { t.big = d.total; }
    if (d.capped) { return; }                  // not every record loaded → counts stay unknown
    const n = (f: (s: string) => boolean) => d.rows.filter(r => f((r.status || '').toUpperCase())).length;
    const by: Record<string, number> = {
      CODE1: n(s => s.startsWith('CODE 1')), CODE2: n(s => s.startsWith('CODE 2')),
      CODE3: n(s => s.startsWith('CODE 3')), CODER: n(s => s.startsWith('CODE R')),
      COMMENTED: n(s => s === 'PENDING - COMMENTED'), OPEN: n(s => s === 'PENDING - OPEN')
    };
    t.views.forEach(x => { if (x.count === null && by[x.metric] !== undefined) { x.count = by[x.metric]; } });
    const approved = by['CODE1'] + by['CODE2'];
    const pending = by['COMMENTED'] + by['OPEN'];
    t.sub = `${approved} approved · ${pending} pending`;
    t.pct = d.total ? Math.round(approved * 100 / d.total) : 0;
  }

  // ══ the table ═════════════════════════════════════════════════════════════

  /** how many records were actually loaded (less than totalCount when the safety cap applied) */
  get loadedCount(): number { return this.all.length; }

  /** the second line under the subject: the two category columns of this record type */
  get subLabel(): string {
    const k = this.kind;
    return k === 'OBS' ? 'Report · contract' : k === 'NCR' ? 'Discipline · area' : k === 'TRN' ? 'Session · location'
         : k === 'MIR' ? 'Department · material' : 'Department · discipline';
  }

  /** what the screen shows: few, wide columns (the categories sit under the subject) */
  get columns(): Col[] {
    const k = this.kind;
    const cols: Col[] = [
      { key: 'docId',   label: k === 'WIR' ? 'WIR no.' : k === 'MIR' ? 'MIR no.' : 'Doc no.', cls: 'c-doc' },
      { key: 'docDate', label: 'Date', cls: 'c-date' }
    ];
    if (!this.oneProject) { cols.push({ key: 'projectCode', label: 'Project', cls: 'c-proj' }); }
    cols.push({ key: 'title', label: k === 'OBS' ? 'Location' : k === 'TRN' ? 'Topic' : 'Subject', cls: 'c-title' });
    if (this.all.some(r => r.status)) { cols.push({ key: 'status', label: 'Status', cls: 'c-status' }); }
    cols.push({ key: 'person', label: k === 'OBS' ? 'Issued by' : k === 'NCR' ? 'Resident' : k === 'TRN' ? 'Prepared by' : 'Inspected by', cls: 'c-person' });
    if (this.all.some(r => r.closedDate)) { cols.push({ key: 'closedDate', label: 'Closed on', cls: 'c-date' }); }
    return cols;
  }

  /** the CSV keeps every field in its own column */
  private get exportColumns(): Col[] {
    const k = this.kind;
    const cols: Col[] = [
      { key: 'docId',       label: k === 'WIR' ? 'WIR no.' : k === 'MIR' ? 'MIR no.' : 'Doc no.', cls: '' },
      { key: 'docDate',     label: 'Date', cls: '' },
      { key: 'projectCode', label: 'Project', cls: '' },
      { key: 'title',       label: k === 'OBS' ? 'Location' : k === 'TRN' ? 'Topic' : 'Subject', cls: '' },
      { key: 'category',    label: k === 'OBS' ? 'Report' : k === 'NCR' ? 'Discipline' : k === 'TRN' ? 'Session' : 'Department', cls: '' },
      { key: 'category2',   label: k === 'OBS' ? 'Contract' : k === 'NCR' ? 'Area' : k === 'TRN' ? 'Location' : k === 'MIR' ? 'Material' : 'Discipline', cls: '' }
    ];
    if (this.all.some(r => r.status)) { cols.push({ key: 'status', label: 'Status', cls: '' }); }
    cols.push({ key: 'person', label: k === 'OBS' ? 'Issued by' : k === 'NCR' ? 'Resident' : k === 'TRN' ? 'Prepared by' : 'Inspected by', cls: '' });
    if (this.all.some(r => r.closedDate)) { cols.push({ key: 'closedDate', label: 'Closed on', cls: '' }); }
    return cols;
  }

  /** "STRUCTURAL · CIVIL" — blanks left out */
  cats(r: QaqcDrillRow): string { return [r.category, r.category2].filter(x => !!(x || '').trim()).join(' · '); }

  trackRow = (_: number, r: QaqcDrillRow): string => r.docId;
  trackCol = (_: number, c: Col): string => c.key;
  trackTab = (_: number, t: DrillTab): string => t.kind;
  trackView = (_: number, v: DrillView): string => v.metric;

  onSearch(ev: Event): void {
    this.search = (ev.target as HTMLInputElement).value;
    this.page = 1;
    this.recompute();
  }

  sortBy(key: SortKey): void {
    if (this.sortKey === key) { this.sortDir = (this.sortDir === 1 ? -1 : 1); }
    else { this.sortKey = key; this.sortDir = key === 'docDate' || key === 'closedDate' ? -1 : 1; }
    this.recompute();
  }

  setPageSize(ev: Event): void {
    this.pageSizeChoice = Number((ev.target as HTMLSelectElement).value) || 0;
    this.page = 1;
    if (this.pageSizeChoice) { this.pageSize = this.pageSizeChoice; this.slice(); } else { this.fit(); }
  }

  /** "Fit": as many rows as the list area holds, so the page never scrolls inside */
  private fit(): void {
    if (this.pageSizeChoice || !this.bodyEl || this.loading || this.error) { return; }
    const head = this.bodyEl.querySelector('thead') as HTMLElement | null;
    const row = this.bodyEl.querySelector('tbody tr') as HTMLElement | null;
    if (!head || !row) { return; }             // table not drawn yet: nothing to measure
    const scrollbar = this.bodyEl.querySelector('.dr-tw') as HTMLElement | null;
    const hScroll = scrollbar ? scrollbar.offsetHeight - scrollbar.clientHeight : 0;
    const avail = this.bodyEl.clientHeight - head.offsetHeight - hScroll - 4;   // 4px: row borders round up
    const rowH = Math.max(row.offsetHeight, 36);
    const n = Math.max(5, Math.floor(avail / rowH));
    if (n === this.pageSize) { return; }
    const first = (this.page - 1) * this.pageSize;       // keep the first record of the page in view
    this.pageSize = n;
    this.page = Math.floor(first / n) + 1;
    this.slice();
  }

  goPage(p: number): void {
    this.page = Math.min(Math.max(1, p), this.pageCount);
    this.slice();
  }

  get pageCount(): number { return Math.max(1, Math.ceil(this.view.length / this.pageSize)); }
  get rangeText(): string {
    if (!this.view.length) { return '0'; }
    const a = (this.page - 1) * this.pageSize + 1;
    return `${a}–${Math.min(this.page * this.pageSize, this.view.length)}`;
  }
  /** first, last and a short run around the current page; 0 = a gap ("…") */
  get pageNumbers(): number[] {
    const n = this.pageCount, p = this.page, out: number[] = [];
    const add = (x: number) => { if (x >= 1 && x <= n && !out.includes(x)) { out.push(x); } };
    add(1);
    if (p - 1 > 2) { out.push(0); }
    for (let x = p - 1; x <= p + 1; x++) { add(x); }
    if (p + 1 < n - 1) { out.push(0); }
    add(n);
    return out;
  }

  private recompute(): void {
    const q = this.search.trim().toLowerCase();
    const rows = q
      ? this.all.filter(r => (r.docId + ' ' + r.projectCode + ' ' + r.projectName + ' ' + r.title + ' ' + r.category + ' ' +
                              r.category2 + ' ' + r.status + ' ' + r.person).toLowerCase().includes(q))
      : [...this.all];
    const key = this.sortKey, dir = this.sortDir;
    const val = (r: QaqcDrillRow): string | number => (key === 'docDate' || key === 'closedDate') ? this.dateNum(r[key]) : (r[key] ?? '').toString().toLowerCase();
    rows.sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
    this.view = rows;
    this.slice();
  }

  private slice(): void {
    if (this.page > this.pageCount) { this.page = this.pageCount; }
    const a = (this.page - 1) * this.pageSize;
    this.paged = this.view.slice(a, a + this.pageSize);
  }

  /** DD/MM/YYYY → yyyymmdd (sortable); blank sorts first */
  private dateNum(s: string): number {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || '');
    return m ? +(m[3] + m[2] + m[1]) : 0;
  }

  /** "P. 409 AMD" → "P409 - AMD" (the way the rest of the dashboard writes a project) */
  projectLabel(code: string): string {
    const m = /^([A-Za-z]+)\.\s*([0-9]+)\s+(.*)$/.exec(code || '');
    return m ? `${m[1]}${m[2]} - ${m[3]}` : (code || '');
  }

  /** colour of a status pill */
  statusClass(s: string): string {
    const v = (s || '').toUpperCase();
    if (v.startsWith('CODE 1') || v === 'CLOSED' || v === 'APPROVED') { return 's-ok'; }
    if (v.startsWith('CODE 2')) { return 's-info'; }
    if (v.startsWith('CODE 3')) { return 's-warn'; }
    if (v.startsWith('CODE R') || v === 'REJECTED') { return 's-bad'; }
    if (v.includes('COMMENTED')) { return 's-cmt'; }
    if (v.startsWith('PARTIALLY')) { return 's-warn'; }
    return 's-open';
  }

  // ══ export ════════════════════════════════════════════════════════════════

  exportCsv(): void {
    const cols = this.exportColumns;
    const esc = (v: any) => { const t = (v ?? '').toString(); return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const lines = [cols.map(c => esc(c.label)).join(',')];
    this.view.forEach(r => lines.push(cols.map(c => esc(c.key === 'projectCode' ? this.projectLabel(r.projectCode) + ' ' + r.projectName : r[c.key])).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `qaqc-${this.kind.toLowerCase()}-${this.metric.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ══ the report of one record ═════════════════════════════════════════════

  private pdfCall(docId: string): Observable<Blob> {
    switch (this.kind) {
      case 'OBS': return this.api.getSorPdf(docId);
      case 'NCR': return this.api.getNcrPdf(docId);
      case 'TRN': return this.api.getQtbtPdf(docId);
      case 'WIR': return this.api.getWirPdf(docId);
      default:    return this.api.getMirPdf(docId);
    }
  }

  openPdf(row: QaqcDrillRow): void {
    this.pdfOpen = true;
    this.pdfLoading = true;
    this.pdfError = '';
    this.pdfDocId = row.docId;
    this.revokePdf();
    this.pdfSub?.unsubscribe();
    this.pdfSub = this.pdfCall(row.docId).subscribe({
      next: (blob: Blob) => {
        this.pdfBlob = blob;
        this.pdfBlobUrl = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfBlobUrl);
        this.pdfLoading = false;
      },
      error: () => {
        this.pdfLoading = false;
        this.pdfError = 'Could not open the report for ' + row.docId + '. Please try again.';
      }
    });
  }

  closePdf(): void {
    this.pdfOpen = false;
    this.pdfError = '';
    this.pdfSub?.unsubscribe();
    this.revokePdf();
  }

  downloadPdf(): void {
    if (!this.pdfBlob) { return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(this.pdfBlob);
    a.download = `${this.kind}_${this.pdfDocId.replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  openPdfNewTab(): void { if (this.pdfBlobUrl) { window.open(this.pdfBlobUrl, '_blank'); } }

  private revokePdf(): void {
    if (this.pdfBlobUrl) { URL.revokeObjectURL(this.pdfBlobUrl); this.pdfBlobUrl = null; }
    this.pdfUrl = null;
    this.pdfBlob = null;
  }

  // clicking the dark backdrop (not the window) closes
  onBackdrop(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) { this.close(); }
  }
}
