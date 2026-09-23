import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Api } from '../services/api';
import {
  BranchOption,
  SupplierPaymentForecastRow,
  SupplierReportRequest
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
export class SupplierPaymentForecastComponent implements OnInit {

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
  loadError = '';
  hasRun = false;

  /** Fixed for now — the report accepts them but there is no picker on screen. */
  readonly fixedProjectCode = 'ALL';
  readonly fixedVendorName = 'ALL';
  readonly fixedOutstandingStatus = 'OUTSTANDING';

  /**
   * The scrolling box around the table. Paging scrolls THIS back to the top,
   * not the window: the table has its own scrollbar, so moving the page would
   * throw the user out of the report instead of to the first new row.
   */
  @ViewChild('tableWrap') tableWrap?: ElementRef<HTMLDivElement>;

  constructor(private api: Api, private toastr: ToastrService) {}

  ngOnInit(): void {
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
        this.runReport(1);
      },
      error: () => {
        this.branches = [{ branchId: 1, branchName: 'ALL' }];
        this.branchesLoading = false;
        this.runReport(1);
      }
    });
  }

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
      vendorName: this.fixedVendorName,
      outstandingStatus: this.fixedOutstandingStatus,
      pageNo: batchNo,
      pageSize: size
    };
  }

  /** Always hits the server. Page moves inside a loaded batch do not call this. */
  runReport(batchNo = 1): void {
    this.loading = true;
    this.loadError = '';

    this.api.GetSupplierPaymentForecast(this.buildRequest(batchNo, this.BATCH_SIZE)).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.batch = res.data || [];
          this.batchNo = batchNo;
          this.totalCount = res.totalCount || this.batch.length;
          this.totalPages = Math.ceil(this.totalCount / this.pageSize) || 0;
          this.showPage();
        } else {
          this.clearResults();
          this.loadError = res?.message || 'The report could not be loaded.';
        }
        this.hasRun = true;
        this.loading = false;
      },
      error: (err) => {
        console.error('Supplier payment forecast failed:', err);
        this.clearResults();
        this.loadError = this.describeError(err);
        this.hasRun = true;
        this.loading = false;
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
    this.pageNo = 1;
    this.runReport(1);
  }

  resetFilters(): void {
    this.selectedBranchName = 'ALL';
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
  total(field: keyof SupplierPaymentForecastRow): number {
    return this.pagedRows.reduce((sum, r) => sum + (Number(r[field]) || 0), 0);
  }

  get grandTotal(): number {
    return this.total('total_Outstanding');
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
