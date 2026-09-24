import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Api } from '../services/api';
import {
  BranchOption,
  SupplierPaymentForecastRow,
  SupplierReportRequest,
  CurrencyOption,
  VendorOption,
  ReportColumn
} from '../models/financeReport.model';

/**
 * Finance › Supplier Payment Forecast.
 *
 * What falls due, bucketed forward from today: already overdue, next 30 days,
 * 31-60, 61-90, 91-120, beyond 120.
 */
@Component({
  selector: 'app-supplier-payment-forecast',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supplier-payment-forecast.component.html',
  styleUrls: ['./finance-reports.css']
})
export class SupplierPaymentForecastComponent implements OnInit, OnDestroy {

  /** 'ALL' plus every active branch. */
  branches: BranchOption[] = [];
  branchesLoading = false;

  /**
   * The branch the page opens on. Held as the NAME because that is what the
   * report filters on (BR.BRANCHNAME = :BNAME OR :BNAME = 'ALL'); the id is
   * looked up from the same list when the request is built. "ALL" runs every branch at once, which is
   * the slowest possible first query, so the default is the main company and
   * the user widens from there.
   *
   * Matched case-insensitively against the branch list. If the name is ever
   * renamed in the BRANCH master this silently falls back to "ALL" rather than
   * showing an empty dropdown.
   */
  readonly DEFAULT_BRANCH = 'AL ADRAK TRADING AND CONTRACTING COMPANY LLC';

  selectedBranchName = 'ALL';

  /**
   * Paging is TWO-LEVEL. The server hands over BATCH_SIZE rows at a time and
   * the table shows pageSize of them, so pages inside a batch cost nothing and
   * only crossing a batch boundary goes back to the database. That matters
   * here: the report is a GROUP BY over a very large join, so each round trip
   * is expensive and the point is to make as few as possible.
   *
   * Every size below divides BATCH_SIZE exactly, so a page never straddles two
   * batches and one slice is always enough.
   */
  /**
   * The columns, in order. `key` is the name the PROCEDURE knows - it is sent
   * verbatim as the sort column, so the header and the ORDER BY can never drift
   * apart the way two hand-kept lists would.
   */
  readonly COLUMNS: ReportColumn[] = [
    { key: 'VENDORNAME',        label: 'Vendor',            text: true, filter: true },
    { key: 'CURRENCY',          label: 'Currency',          text: true, filter: true },
    { key: 'OVERDUE',           label: 'Overdue' },
    { key: 'NEXT_30_DAYS',      label: 'Next 30 Days' },
    { key: 'DAYS_31_60',        label: '31-60 Days' },
    { key: 'DAYS_61_90',        label: '61-90 Days' },
    { key: 'DAYS_91_120',       label: '91-120 Days' },
    { key: 'ABOVE_120_DAYS',    label: 'Above 120 Days' },
    { key: 'TOTAL_OUTSTANDING', label: 'Total Outstanding' }
  ];

  /** Sorting is SERVER-side - the screen only holds one batch at a time. */
  sortColumn = 'VENDORNAME';
  sortDir: 'ASC' | 'DESC' = 'ASC';

  currencies: CurrencyOption[] = [];
  selectedCurrency = 'ALL';

  /**
   * Vendors for the Vendor column filter, and the picked one.
   *
   * Hundreds of entries even after the branch and outstanding filters, so
   * unlike Currency this popover NEEDS a search box. vendorQuery drives it
   * and visibleVendors is the filtered slice actually rendered.
   */
  vendors: VendorOption[] = [];
  selectedVendor = 'ALL';
  vendorQuery = '';

  /**
   * Capped deliberately. Rendering many hundreds of buttons inside a popover
   * costs a visible pause every time it opens; the search box is how you reach
   * the rest, and the footer says so when the list is trimmed.
   */
  readonly VENDOR_LIST_LIMIT = 200;

  /** Which column's popover is open, by column key. Null = none. */
  openFilter: string | null = null;

  readonly BATCH_SIZE = 500;
  readonly PAGE_SIZES = [100, 250, 500];

  /** The batch currently held (up to BATCH_SIZE rows) and which batch it is. */
  private batch: SupplierPaymentForecastRow[] = [];
  private batchNo = 0;

  /**
   * The slice on screen. A CACHED FIELD, not a getter — a getter that builds
   * a new array is re-read on every change-detection pass, and *ngFor then
   * tears down and re-creates every row, which schedules another pass.
   */
  pagedRows: SupplierPaymentForecastRow[] = [];

  pageNo = 1;
  pageSize = 100;
  totalCount = 0;
  totalPages = 0;

  loading = false;
  exporting = false;

  /**
   * When the figures were last rebuilt.
   *
   * The report reads a snapshot refreshed every 4 hours rather than
   * aggregating the whole company live — that is what took it from timing out
   * to well under a second. Because of that the screen MUST date what it is
   * showing: without this the numbers look current to the second, and someone
   * deciding what to pay today would act on a bill that was entered after the
   * last refresh and is not in here yet.
   */
  asOf: Date | null = null;

  /**
   * Set when the last scheduled rebuild FAILED, so stale figures are not
   * passed off as current. There is no rebuild button on screen — the 4-hourly
   * job owns that — which makes showing the failure more important, not less:
   * it is the only way anyone would know the numbers had stopped moving.
   */
  snapshotFailed = false;

  /**
   * Seconds the current run has been going. Shown while loading: a spinner with
   * no number is indistinguishable from a page that has died, which is exactly
   * how this looked when the query ran long.
   */
  elapsed = 0;
  private elapsedTimer: any = null;
  private inFlight: any = null;
  loadError = '';
  hasRun = false;

  /** Fixed for now — the report accepts them but there is no picker on screen. */
  readonly fixedProjectCode = 'ALL';
  readonly fixedOutstandingStatus = 'OUTSTANDING';

  /**
   * The scrolling box around the table. Paging scrolls THIS back to the top,
   * not the window: the table has its own scrollbar, so moving the page would
   * throw the user out of the report instead of to the first new row.
   */
  @ViewChild('tableWrap') tableWrap?: ElementRef<HTMLDivElement>;

  constructor(private api: Api, private toastr: ToastrService) {}

  ngOnDestroy(): void {
    this.stopTimer();
    this.inFlight?.unsubscribe();
  }

  private startTimer(): void {
    this.stopTimer();
    this.elapsed = 0;
    this.elapsedTimer = setInterval(() => { this.elapsed++; }, 1000);
  }

  private stopTimer(): void {
    if (this.elapsedTimer) { clearInterval(this.elapsedTimer); this.elapsedTimer = null; }
  }

  /** Abandon the current run and go back to whatever was on screen. */
  cancelRun(): void {
    this.inFlight?.unsubscribe();
    this.inFlight = null;
    this.stopTimer();
    this.loading = false;
    this.loadError = 'Cancelled. The report was still running - try a single branch, or a narrower filter.';
  }

  ngOnInit(): void {
    this.loadCurrencies();
    this.loadSnapshotStatus();
    // The report is NOT started here. loadBranches() starts it once the list is
    // back, otherwise the first run would go out as "ALL" and be thrown away
    // the moment the default branch was applied - two slow queries for one page.
    this.loadBranches();
  }

  loadBranches(): void {
    this.branchesLoading = true;
    this.api.GetFinanceBranchList().subscribe({
      next: (res: any) => {
        const data = res?.data || [];
        // 'ALL' is not a row in BRANCH — it is the sentinel the report
        // understands, paired with branch id 1.
        this.branches = [{ branchId: 1, branchName: 'ALL' }, ...(Array.isArray(data) ? data : [])];
        this.branchesLoading = false;
        this.applyDefaultBranch();
        // Vendors depend on the branch, so this waits until the default has
        // been applied - loading them first would list the vendors for ALL
        // branches and then silently disagree with the report on screen.
        this.loadVendors();
        this.runReport(1);
      },
      error: () => {
        this.branches = [{ branchId: 1, branchName: 'ALL' }];
        this.branchesLoading = false;
        this.runReport(1);
      }
    });
  }

  /** Reads only the metadata row - it never touches the report tables. */
  loadSnapshotStatus(): void {
    this.api.GetFinanceSnapshotStatus().subscribe({
      next: (res: any) => {
        const d = res?.data;
        if (!d) { return; }
        if (d.refreshed_At ?? d.refreshedAt) {
          this.asOf = new Date(d.refreshed_At ?? d.refreshedAt);
        }
        this.snapshotFailed = (d.status ?? '') === 'FAILED';
      },
      error: () => { /* the report itself also carries asOf, so this is only a fallback */ }
    });
  }

  loadCurrencies(): void {
    this.api.GetFinanceCurrencyList().subscribe({
      next: (res: any) => {
        const data = res?.data || [];
        this.currencies = Array.isArray(data) ? data : [];
      },
      error: () => { this.currencies = []; }
    });
  }

  /**
   * Loaded ONCE on init, not per keystroke. The list comes from the snapshot
   * and changes only when that is rebuilt, so searching it in the browser is
   * both instant and correct — a round trip per character would be neither.
   */
  loadVendors(): void {
    const picked = this.branches.find(b => b.branchName === this.selectedBranchName);
    const bid = this.selectedBranchName === 'ALL' ? 1 : Number(picked?.branchId ?? 1);

    this.api.GetFinanceVendorList(this.selectedBranchName || 'ALL', bid, this.fixedOutstandingStatus).subscribe({
      next: (res: any) => {
        const data = res?.data || [];
        this.vendors = Array.isArray(data) ? data : [];
      },
      error: () => { this.vendors = []; }
    });
  }

  // ── sorting and the column filters ───────────────────────────────────────
  sortBy(col: ReportColumn): void {
    if (this.sortColumn === col.key) {
      this.sortDir = this.sortDir === 'ASC' ? 'DESC' : 'ASC';
    } else {
      this.sortColumn = col.key;
      // Money reads largest-first; a name reads A-Z.
      this.sortDir = col.text ? 'ASC' : 'DESC';
    }
    this.pageNo = 1;
    this.runReport(1);
  }

  sortIcon(col: ReportColumn): string {
    if (this.sortColumn !== col.key) { return 'fa-sort'; }
    return this.sortDir === 'ASC' ? 'fa-sort-up' : 'fa-sort-down';
  }

  /**
   * Both go back to the server. Sorting the 500 rows on hand would reorder a
   * slice of the report and present it as the whole thing, and the same goes
   * for filtering - page 1 of "RIAL OMANI only" is not the first 100 RIAL OMANI
   * suppliers unless the database did the filtering.
   */
  toggleFilter(col: ReportColumn, event: Event): void {
    event.stopPropagation();
    this.openFilter = this.openFilter === col.key ? null : col.key;
  }

  pickCurrency(value: string): void {
    this.selectedCurrency = value;
    this.openFilter = null;
    this.pageNo = 1;
    this.runReport(1);
  }

  pickVendor(value: string): void {
    this.selectedVendor = value;
    this.openFilter = null;
    this.vendorQuery = '';
    this.pageNo = 1;
    this.runReport(1);
  }

  /**
   * The vendors actually rendered: those matching the search box, capped at
   * VENDOR_LIST_LIMIT. Called from the template, so it stays cheap - a plain
   * substring match over an array that is loaded once.
   */
  visibleVendors(): VendorOption[] {
    const q = this.vendorQuery.trim().toUpperCase();
    const matches = q
      ? this.vendors.filter(v => (v.vendorName || '').toUpperCase().includes(q))
      : this.vendors;
    return matches.slice(0, this.VENDOR_LIST_LIMIT);
  }

  /** How many matched but were not rendered, so the footer can say so. */
  hiddenVendorCount(): number {
    const q = this.vendorQuery.trim().toUpperCase();
    const total = q
      ? this.vendors.filter(v => (v.vendorName || '').toUpperCase().includes(q)).length
      : this.vendors.length;
    return Math.max(0, total - this.VENDOR_LIST_LIMIT);
  }

  /** True when a column has a filter actually doing something. */
  filterActive(col: ReportColumn): boolean {
    if (col.key === 'CURRENCY')   { return this.selectedCurrency !== 'ALL'; }
    if (col.key === 'VENDORNAME') { return this.selectedVendor !== 'ALL'; }
    return false;
  }

  /** Any click outside closes whichever popover is open. */
  @HostListener('document:click')
  onDocumentClick(): void { this.openFilter = null; }

  /** Select DEFAULT_BRANCH if the list contains it; otherwise stay on ALL. */
  private applyDefaultBranch(): void {
    const want = this.DEFAULT_BRANCH.trim().toUpperCase();
    const hit = this.branches.find(b => (b.branchName || '').trim().toUpperCase() === want);
    if (hit?.branchName) { this.selectedBranchName = hit.branchName; }
  }

  /** `pageSize: 0` means "every row" and is only ever sent by Export. */
  private buildRequest(batchNo: number, size: number): SupplierReportRequest {
    const picked = this.branches.find(b => b.branchName === this.selectedBranchName);
    return {
      branchName: this.selectedBranchName || 'ALL',
      // 1 whenever the branch is ALL: the advances sub-query filters on the id,
      // so leaving a real branch id there would narrow the advances while the
      // rest of the report covered every branch.
      branchId: this.selectedBranchName === 'ALL' ? 1 : Number(picked?.branchId ?? 1),
      projectCode: this.fixedProjectCode,
      vendorName: this.selectedVendor || 'ALL',
      outstandingStatus: this.fixedOutstandingStatus,
      currency: this.selectedCurrency || 'ALL',
      sortColumn: this.sortColumn,
      sortDir: this.sortDir,
      pageNo: batchNo,
      pageSize: size
    };
  }

  /** Always hits the server. Page moves inside a loaded batch do not call this. */
  runReport(batchNo = 1): void {
    this.loading = true;
    this.loadError = '';
    this.startTimer();

    this.inFlight = this.api.GetSupplierPaymentForecast(this.buildRequest(batchNo, this.BATCH_SIZE)).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.batch = res.data || [];
          this.batchNo = batchNo;
          this.totalCount = res.totalCount || this.batch.length;
          this.totalPages = Math.ceil(this.totalCount / this.pageSize) || 0;
          this.asOf = res.asOf ? new Date(res.asOf) : null;
          this.showPage();
        } else {
          this.clearResults();
          this.loadError = res?.message || 'The report could not be loaded.';
        }
        this.hasRun = true;
        this.loading = false;
        this.stopTimer();
      },
      error: (err) => {
        console.error('Supplier payment forecast failed:', err);
        this.clearResults();
        this.loadError = this.describeError(err);
        this.hasRun = true;
        this.loading = false;
        this.stopTimer();
      }
    });
  }

  /**
   * Turn an HTTP failure into something a person can act on.
   *
   * A 400 from this API is the global InvalidModelStateResponseFactory, whose
   * message is the bare string "Validation Failed" - true but useless. The
   * field-level reasons sit in error.errors, so they get pulled out.
   */
  private describeError(err: any): string {
    // rxjs timeout() raises a TimeoutError, which has no HTTP body at all -
    // without naming it the user would see "The report could not be loaded"
    // and no reason.
    if (err?.name === 'TimeoutError') {
      return 'The report took too long and was stopped. Pick a single branch, ' +
             'or ask IT to look at the query performance.';
    }
    const body = err?.error;
    const detail = Array.isArray(body?.errors)
      ? body.errors.map((e: any) => (e?.field ? e.field + ": " : "") + (e?.error ?? "")).join("; ")
      : "";
    const base = body?.message || body?.Message || err?.message || "The report could not be loaded.";
    return detail ? base + " - " + detail : base;
  }

  private clearResults(): void {
    this.batch = [];
    this.batchNo = 0;
    this.pagedRows = [];
    this.totalCount = 0;
    this.totalPages = 0;
  }

  /** Branch picked - a different result set, so start at page 1 again. */
  onBranchChange(): void {
    // A vendor that has something outstanding in one branch may have nothing
    // in another, so the picked vendor is cleared rather than silently
    // carried over into a branch where it would return an empty report.
    this.selectedVendor = 'ALL';
    this.vendorQuery = '';
    this.loadVendors();
    this.pageNo = 1;
    this.runReport(1);
  }

  resetFilters(): void {
    this.selectedBranchName = 'ALL';
    this.selectedCurrency = 'ALL';
    this.selectedVendor = 'ALL';
    this.vendorQuery = '';
    // Back to ALL branches means a different vendor list.
    this.loadVendors();
    this.sortColumn = 'VENDORNAME';
    this.sortDir = 'ASC';
    this.pageNo = 1;
    this.runReport(1);
  }

  // ── paging ────────────────────────────────────────────────────────────────
  private batchNoFor(page: number): number {
    return Math.floor(((page - 1) * this.pageSize) / this.BATCH_SIZE) + 1;
  }

  private offsetInBatch(page: number): number {
    return ((page - 1) * this.pageSize) % this.BATCH_SIZE;
  }

  /** Cut the current page out of the batch already in memory. No API call. */
  private showPage(): void {
    const from = this.offsetInBatch(this.pageNo);
    this.pagedRows = this.batch.slice(from, from + this.pageSize);
    // Back to row 1 of the new page, inside the table only.
    if (this.tableWrap) { this.tableWrap.nativeElement.scrollTop = 0; }
  }

  /** Fetches only when the page falls outside the batch already held. */
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) { return; }
    this.pageNo = page;
    const needed = this.batchNoFor(page);
    if (needed === this.batchNo) { this.showPage(); } else { this.runReport(needed); }
  }

  firstPage(): void { this.goToPage(1); }
  prevPage():  void { this.goToPage(this.pageNo - 1); }
  nextPage():  void { this.goToPage(this.pageNo + 1); }
  lastPage():  void { this.goToPage(this.totalPages); }

  /**
   * Page size changed. totalPages has to be recomputed BEFORE anything reads
   * it — goToPage guards on `page > totalPages` and would bounce off a stale
   * value. Back to page 1, which is always in batch 1.
   */
  pageSizeChanged(): void {
    this.pageSize = Number(this.pageSize) || 100;
    this.totalPages = Math.ceil(this.totalCount / this.pageSize) || 0;
    this.pageNo = 1;
    if (this.batchNo === 1) { this.showPage(); } else { this.runReport(1); }
  }

  pageRange(): string {
    if (!this.totalCount) { return '0'; }
    const start = (this.pageNo - 1) * this.pageSize + 1;
    const end = Math.min(this.pageNo * this.pageSize, this.totalCount);
    return `${start}–${end}`;
  }

  /** Up to five page buttons, centred on the current page. */
  pageNumbers(): number[] {
    const pages: number[] = [];
    const max = 5;
    if (this.totalPages <= max) {
      for (let i = 1; i <= this.totalPages; i++) { pages.push(i); }
    } else {
      let start = Math.max(1, this.pageNo - 2);
      let end = Math.min(this.totalPages, this.pageNo + 2);
      if (this.pageNo <= 3) { end = max; }
      else if (this.pageNo >= this.totalPages - 2) { start = this.totalPages - max + 1; }
      for (let i = start; i <= end; i++) { pages.push(i); }
    }
    return pages;
  }

  /** Row number continues across pages instead of restarting at 1. */
  rowNumber(i: number): number {
    return (this.pageNo - 1) * this.pageSize + i + 1;
  }

  /**
   * Totals for the rows ON THIS PAGE, and labelled as such in the template.
   *
   * Now that the server only sends a batch at a time, a whole-result total
   * cannot be computed here without fetching everything — which is exactly the
   * fetch the paging exists to avoid. A footer silently totalling part of the
   * data would be worse than one that says which part, so it says which part.
   * The Export file is the place to total the full set.
   */
  /**
   * Total of one COLUMN over the rows on this page. Takes the column, not a
   * property name, so it goes through cell() and stays in step with the header
   * and the body - all three now read from the same COLUMNS list.
   */
  totalOf(col: ReportColumn): number {
    return this.pagedRows.reduce((sum, r) => sum + (Number(this.cell(r, col)) || 0), 0);
  }

  /** Cell value for a column, so the template can loop instead of repeating. */
  cell(row: any, col: ReportColumn): any {
    // COLUMN KEYS are the procedure's names (TOTAL_OUTSTANDING); the row uses
    // the JSON names (total_Outstanding). Matching on letters only bridges the
    // two without a second lookup table to keep in step.
    const want = col.key.replace(/_/g, '').toLowerCase();
    for (const k of Object.keys(row || {})) {
      if (k.replace(/_/g, '').toLowerCase() === want) { return row[k]; }
    }
    return null;
  }

  trackByRow(_i: number, r: SupplierPaymentForecastRow): string {
    return `${r.vendorName}#${r.currency}`;
  }

  /** Marks a zero so the eye skips it, without hiding it entirely. */
  cls(value: number | undefined | null): string {
    const n = Number(value) || 0;
    if (n === 0) { return 'fin-zero'; }
    return n < 0 ? 'fin-neg' : '';
  }

  /**
   * Export covers EVERY row, not the page on screen, so it makes its own call
   * with pageSize 0 ("all rows"). That is the one place a full fetch is worth
   * it — the user asked for the whole file and is waiting for it.
   */
  exportCsv(): void {
    if (!this.totalCount) {
      this.toastr.info('There is nothing to export yet.', 'Supplier Payment Forecast');
      return;
    }

    this.exporting = true;
    this.api.GetSupplierPaymentForecast(this.buildRequest(1, 0)).subscribe({
      next: (res: any) => {
        const all: SupplierPaymentForecastRow[] = (res?.success && res.data) ? res.data : [];
        if (!all.length) {
          this.toastr.error('The export returned no rows.', 'Supplier Payment Forecast');
          this.exporting = false;
          return;
        }
        this.writeCsv(all);
        this.exporting = false;
        this.toastr.success(`${all.length} rows exported.`, 'Supplier Payment Forecast');
      },
      error: (err) => {
        console.error('Export failed:', err);
        this.toastr.error(err?.error?.message || 'The export could not be produced.', 'Supplier Payment Forecast');
        this.exporting = false;
      }
    });
  }

  private writeCsv(all: SupplierPaymentForecastRow[]): void {
    const head = ['Vendor', 'Currency', 'Overdue', 'Next 30 Days', '31-60 Days',
                  '61-90 Days', '91-120 Days', 'Above 120 Days', 'Total Outstanding'];

    // Every field is quoted and internal quotes doubled: vendor names contain
    // commas ("AL ADRAK TRADING & CONT. CO. LLC") and would otherwise split
    // across columns.
    const esc = (v: any) => `"${(v ?? '').toString().replace(/"/g, '""')}"`;
    const sum = (f: keyof SupplierPaymentForecastRow) =>
      all.reduce((s, r) => s + (Number(r[f]) || 0), 0);

    const lines = [
      head.map(esc).join(','),
      ...all.map(r => [
        r.vendorName, r.currency, r.overdue, r.next_30_Days, r.days_31_60,
        r.days_61_90, r.days_91_120, r.above_120_Days, r.total_Outstanding
      ].map(esc).join(',')),
      // Totals over the WHOLE file, not a page.
      ['TOTAL', '', sum('overdue'), sum('next_30_Days'), sum('days_31_60'),
       sum('days_61_90'), sum('days_91_120'), sum('above_120_Days'),
       sum('total_Outstanding')].map(esc).join(',')
    ];

    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SupplierPaymentForecast_${this.selectedBranchName}_${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
