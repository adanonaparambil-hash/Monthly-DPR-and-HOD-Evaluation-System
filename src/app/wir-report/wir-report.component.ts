import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Api } from '../services/api';
import { CraneLoaderComponent } from '../shared/crane-loader/crane-loader.component';
import { WirListRequest, WirRow } from '../models/wir.model';

// ── Per-column filter state (log-analytics pattern) ──────────────────────────
interface ColFilter {
  searchText:     string;
  selectedValues: Set<string>;
  sortDir:        'asc' | 'desc' | null;
  dateFrom:       string;   // yyyy-MM-dd (input[type=date])
  dateTo:         string;
}

interface WirColumn {
  key:   string;
  label: string;
  width: number;
  type:  'text' | 'list' | 'date';   // text = contains search, list = checkbox values, date = range
}

// Display row: WirRow + combined project label
interface WirEntry extends WirRow {
  project: string;
}

@Component({
  selector: 'app-wir-report',
  standalone: true,
  imports: [CommonModule, FormsModule, CraneLoaderComponent],
  templateUrl: './wir-report.component.html',
  styleUrls: ['./wir-report.component.css']
})
export class WirReportComponent implements OnInit, OnDestroy {

  // ── Columns ────────────────────────────────────────────────────────────────
  allColumns: WirColumn[] = [
    { key: 'docid',       label: 'WIR No.',       width: 160, type: 'text' },
    { key: 'docdate',     label: 'Date',          width: 105, type: 'date' },
    { key: 'project',     label: 'Project',       width: 220, type: 'list' },
    { key: 'discipline',  label: 'Discipline',    width: 130, type: 'list' },
    { key: 'subject',     label: 'Subject',       width: 240, type: 'text' },
    { key: 'location',    label: 'Location',      width: 170, type: 'text' },
    { key: 'zone',        label: 'Zone',          width: 90,  type: 'list' },
    { key: 'llevel',      label: 'Level',         width: 90,  type: 'list' },
    { key: 'contractor',  label: 'Contractor',    width: 160, type: 'list' },
    { key: 'inspectedBy', label: 'Inspected By',  width: 150, type: 'list' },
    { key: 'approvedBy',  label: 'Approved By',   width: 150, type: 'list' },
    { key: 'status',      label: 'Status',        width: 190, type: 'list' },
    { key: 'qaqcStatus',  label: 'QAQC',          width: 110, type: 'list' },
  ];

  colFilters: { [col: string]: ColFilter } = {};

  // ── Data ───────────────────────────────────────────────────────────────────
  rows:         WirEntry[] = [];   // raw from server
  filteredRows: WirEntry[] = [];   // after client-side column filters
  pagedRows:    WirEntry[] = [];

  loading      = false;
  loadError    = '';

  // Server-side filters
  fromDate = '';   // yyyy-MM-dd
  toDate   = '';

  // Global search (client-side over loaded rows)
  searchText    = '';
  private searchSubject = new Subject<string>();

  // Pagination — 100 rows per page; the server is fetched in chunks of 500,
  // and clicking into a page beyond the loaded rows pulls the next chunk.
  pageSize    = 100;
  chunkSize   = 500;
  currentPage = 1;
  totalPages  = 1;
  effectiveTotal = 0;   // pager denominator (server total, or filtered count)
  rangeStart     = 0;   // 1-based index of first row on the page
  rangeEnd       = 0;

  totalRecords = 0;     // total matching rows on the server
  private fetchingRest = false;
  private pendingAfterLoad: Array<() => void> = [];

  // Column filter popup
  openFilterCol: string | null = null;
  popupX = 0;
  popupY = 0;
  filterDropdownItems: string[] = [];

  // PDF preview modal
  pdfOpen    = false;
  pdfLoading = false;
  pdfError   = '';
  pdfDocid   = '';
  pdfUrl: SafeResourceUrl | null = null;
  private pdfBlobUrl: string | null = null;
  private pdfBlob: Blob | null = null;

  private subs = new Subscription();

  constructor(private api: Api, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.initColFilters();
    this.subs.add(
      this.searchSubject.pipe(debounceTime(300)).subscribe(() => {
        if (this.searchText.trim()) {
          this.ensureAllLoaded(() => this.applyFilters());
        } else {
          this.applyFilters();
        }
      })
    );
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.revokePdfUrl();
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  initColFilters(): void {
    this.allColumns.forEach(c => {
      this.colFilters[c.key] = {
        searchText: '', selectedValues: new Set(),
        sortDir: null, dateFrom: '', dateTo: ''
      };
    });
  }

  // ── Load from server (first chunk = chunkSize rows + total count) ─────────
  loadData(): void {
    this.loading = true;
    this.loadError = '';
    this.fetchingRest = false;
    this.pendingAfterLoad = [];

    const request: WirListRequest = {
      fromDate: this.toDDMMYYYY(this.fromDate),
      toDate:   this.toDDMMYYYY(this.toDate),
      offset:   0,
      limit:    this.chunkSize
    };

    this.api.getWirList(request).subscribe({
      next: (res: any) => {
        const data: WirRow[] = res?.data?.rows ?? [];
        this.totalRecords = res?.data?.total ?? data.length;
        this.rows = data.map(r => this.toEntry(r));
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.rows = [];
        this.totalRecords = 0;
        this.applyFilters();
        this.loadError = err?.error?.message || err?.message || 'Failed to load WIR list';
      }
    });
  }

  private toEntry(r: WirRow): WirEntry {
    return { ...r, project: [r.projectCode, r.projectName].filter(Boolean).join(' - ') };
  }

  get loadedAll(): boolean {
    return this.rows.length >= this.totalRecords;
  }

  // Fetch the remaining rows (beyond the first chunk) once, then run `after`.
  // Called before any operation that must see the FULL dataset: filtering,
  // sorting, status chips, export, show-all.
  private ensureAllLoaded(after: () => void): void {
    if (this.loadedAll) { after(); return; }

    this.pendingAfterLoad.push(after);
    if (this.fetchingRest) return;

    this.fetchingRest = true;
    this.loading = true;

    const request: WirListRequest = {
      fromDate: this.toDDMMYYYY(this.fromDate),
      toDate:   this.toDDMMYYYY(this.toDate),
      offset:   this.rows.length,
      limit:    null
    };

    this.api.getWirList(request).subscribe({
      next: (res: any) => {
        const data: WirRow[] = res?.data?.rows ?? [];
        this.rows = [...this.rows, ...data.map(r => this.toEntry(r))];
        this.totalRecords = Math.max(this.totalRecords, this.rows.length);
        this.finishRestLoad();
      },
      error: () => {
        // Keep working with what we have — filters will apply to loaded rows.
        this.totalRecords = this.rows.length;
        this.finishRestLoad();
      }
    });
  }

  private finishRestLoad(): void {
    this.fetchingRest = false;
    this.loading = false;
    const callbacks = this.pendingAfterLoad;
    this.pendingAfterLoad = [];
    callbacks.forEach(cb => cb());
  }

  onDateChange(): void { this.loadData(); }

  clearDates(): void {
    this.fromDate = '';
    this.toDate = '';
    this.loadData();
  }

  private toDDMMYYYY(iso: string): string | null {
    if (!iso) return null;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  // ── Global search ─────────────────────────────────────────────────────────
  onSearchChange(): void { this.searchSubject.next(this.searchText); }

  clearSearch(): void {
    this.searchText = '';
    this.applyFilters();
  }

  // ── Client-side filtering / sorting ───────────────────────────────────────
  applyFilters(): void {
    let out = [...this.rows];

    // Global search across all columns
    const q = this.searchText.trim().toLowerCase();
    if (q) {
      out = out.filter(r =>
        this.allColumns.some(c => this.cellValue(r, c.key).toLowerCase().includes(q))
      );
    }

    // Per-column filters
    for (const col of this.allColumns) {
      const f = this.colFilters[col.key];
      if (!f) continue;

      if (col.type === 'text') {
        const t = f.searchText.trim().toLowerCase();
        if (t) out = out.filter(r => this.cellValue(r, col.key).toLowerCase().includes(t));
      } else if (col.type === 'list') {
        if (f.selectedValues.size > 0)
          out = out.filter(r => f.selectedValues.has(this.cellValue(r, col.key)));
      } else if (col.type === 'date') {
        if (f.dateFrom) {
          const from = new Date(f.dateFrom).getTime();
          out = out.filter(r => { const t = this.parseDDMMYYYY(this.cellValue(r, col.key)); return t !== null && t >= from; });
        }
        if (f.dateTo) {
          const to = new Date(f.dateTo).getTime();
          out = out.filter(r => { const t = this.parseDDMMYYYY(this.cellValue(r, col.key)); return t !== null && t <= to; });
        }
      }
    }

    // Sorting (single active column)
    const sortCol = this.allColumns.find(c => this.colFilters[c.key]?.sortDir);
    if (sortCol) {
      const dir = this.colFilters[sortCol.key].sortDir === 'asc' ? 1 : -1;
      out.sort((a, b) => {
        if (sortCol.type === 'date') {
          const ta = this.parseDDMMYYYY(this.cellValue(a, sortCol.key)) ?? 0;
          const tb = this.parseDDMMYYYY(this.cellValue(b, sortCol.key)) ?? 0;
          return (ta - tb) * dir;
        }
        return this.cellValue(a, sortCol.key)
          .localeCompare(this.cellValue(b, sortCol.key), undefined, { numeric: true }) * dir;
      });
    }

    this.filteredRows = out;
    this.currentPage = 1;
    this.updatePage();
  }

  cellValue(row: WirEntry, key: string): string {
    return String((row as any)[key] ?? '');
  }

  private parseDDMMYYYY(v: string): number | null {
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  // Denominator: the server total while browsing unfiltered; once any client
  // filter is active the full dataset is already loaded, so use its count.
  updatePage(): void {
    this.effectiveTotal = this.anyFilterActive ? this.filteredRows.length : this.totalRecords;
    this.totalPages = Math.max(1, Math.ceil(this.effectiveTotal / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedRows  = this.filteredRows.slice(start, start + this.pageSize);
    this.rangeStart = this.effectiveTotal === 0 ? 0 : start + 1;
    this.rangeEnd   = Math.min(start + this.pageSize, this.effectiveTotal);
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;

    // Browsing unfiltered past the loaded rows → fetch EVERYTHING up to the
    // requested page in one call (covers jumps straight to the last page too).
    const needed = Math.min(p * this.pageSize, this.totalRecords);
    if (!this.anyFilterActive && !this.loadedAll && this.rows.length < needed) {
      this.loadUpTo(needed, () => {
        this.filteredRows = [...this.rows];
        this.currentPage = p;
        this.updatePage();
      });
      return;
    }

    this.currentPage = p;
    this.updatePage();
  }

  // Fetch rows from the server until at least `target` rows are loaded.
  // One request: offset = loaded count, limit = whatever is missing
  // (minimum one chunk, so sequential Next clicks still buffer ahead).
  private loadUpTo(target: number, after: () => void): void {
    this.loading = true;
    const missing = target - this.rows.length;
    const request: WirListRequest = {
      fromDate: this.toDDMMYYYY(this.fromDate),
      toDate:   this.toDDMMYYYY(this.toDate),
      offset:   this.rows.length,
      limit:    Math.max(this.chunkSize, missing)
    };

    this.api.getWirList(request).subscribe({
      next: (res: any) => {
        const data: WirRow[] = res?.data?.rows ?? [];
        this.rows = [...this.rows, ...data.map(r => this.toEntry(r))];
        if (data.length === 0) this.totalRecords = this.rows.length;
        this.loading = false;
        after();
      },
      error: () => {
        this.totalRecords = this.rows.length;
        this.loading = false;
        after();
      }
    });
  }

  // ── Column filter popup ───────────────────────────────────────────────────
  toggleColFilter(col: string, event: Event): void {
    event.stopPropagation();
    if (this.openFilterCol === col) { this.openFilterCol = null; return; }

    const btn = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.popupX = Math.min(btn.left, window.innerWidth - 275);
    this.popupY = btn.bottom + 4;
    this.openFilterCol = col;
    this.colFilters[col].searchText = this.colType(col) === 'text' ? this.colFilters[col].searchText : '';
    // Dropdown values must come from the FULL dataset, not just the first chunk
    this.ensureAllLoaded(() => this.rebuildDropdownItems());
  }

  colType(col: string): string {
    return this.allColumns.find(c => c.key === col)?.type ?? 'list';
  }

  colLabel(col: string): string {
    return this.allColumns.find(c => c.key === col)?.label ?? col;
  }

  rebuildDropdownItems(): void {
    if (!this.openFilterCol || this.colType(this.openFilterCol) !== 'list') { this.filterDropdownItems = []; return; }
    const col = this.openFilterCol;
    const text = this.colFilters[col].searchText.trim().toLowerCase();

    // Distinct values from data that survives all OTHER filters — so the list
    // only offers values that actually exist in the current view.
    const values = new Set<string>();
    for (const r of this.rowsFilteredExcept(col)) {
      const v = this.cellValue(r, col);
      if (v) values.add(v);
    }
    let items = Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (text) items = items.filter(v => v.toLowerCase().includes(text));
    this.filterDropdownItems = items;
  }

  private rowsFilteredExcept(skipCol: string): WirEntry[] {
    let out = [...this.rows];
    const q = this.searchText.trim().toLowerCase();
    if (q) {
      out = out.filter(r =>
        this.allColumns.some(c => this.cellValue(r, c.key).toLowerCase().includes(q))
      );
    }
    for (const col of this.allColumns) {
      if (col.key === skipCol) continue;
      const f = this.colFilters[col.key];
      if (!f) continue;
      if (col.type === 'text') {
        const t = f.searchText.trim().toLowerCase();
        if (t) out = out.filter(r => this.cellValue(r, col.key).toLowerCase().includes(t));
      } else if (col.type === 'list' && f.selectedValues.size > 0) {
        out = out.filter(r => f.selectedValues.has(this.cellValue(r, col.key)));
      }
    }
    return out;
  }

  onFilterSearch(event: Event): void {
    if (!this.openFilterCol) return;
    this.colFilters[this.openFilterCol].searchText = (event.target as HTMLInputElement).value;
    if (this.colType(this.openFilterCol) === 'text') {
      this.applyFilters();
    } else {
      this.rebuildDropdownItems();
    }
  }

  toggleValue(col: string, val: string): void {
    const set = this.colFilters[col].selectedValues;
    set.has(val) ? set.delete(val) : set.add(val);
    this.applyFilters();
  }

  allSelected(col: string): boolean {
    return this.filterDropdownItems.length > 0 &&
           this.filterDropdownItems.every(v => this.colFilters[col].selectedValues.has(v));
  }

  toggleSelectAll(col: string): void {
    const set = this.colFilters[col].selectedValues;
    if (this.allSelected(col)) {
      this.filterDropdownItems.forEach(v => set.delete(v));
    } else {
      this.filterDropdownItems.forEach(v => set.add(v));
    }
    this.applyFilters();
  }

  setSort(col: string, dir: 'asc' | 'desc'): void {
    const cur = this.colFilters[col].sortDir;
    this.allColumns.forEach(c => this.colFilters[c.key].sortDir = null);
    this.colFilters[col].sortDir = cur === dir ? null : dir;
    this.ensureAllLoaded(() => this.applyFilters());
  }

  sortBy(col: string, event: Event): void {
    event.stopPropagation();
    const cur = this.colFilters[col].sortDir;
    this.allColumns.forEach(c => this.colFilters[c.key].sortDir = null);
    this.colFilters[col].sortDir = cur === 'asc' ? 'desc' : cur === 'desc' ? null : 'asc';
    this.ensureAllLoaded(() => this.applyFilters());
  }

  clearColFilter(col: string): void {
    const f = this.colFilters[col];
    f.searchText = '';
    f.selectedValues.clear();
    f.dateFrom = '';
    f.dateTo = '';
    this.applyFilters();
    this.rebuildDropdownItems();
  }

  clearAllFilters(): void {
    this.allColumns.forEach(c => {
      const f = this.colFilters[c.key];
      f.searchText = '';
      f.selectedValues.clear();
      f.sortDir = null;
      f.dateFrom = '';
      f.dateTo = '';
    });
    this.searchText = '';
    this.applyFilters();
  }

  isFiltered(col: string): boolean {
    const f = this.colFilters[col];
    if (!f) return false;
    const type = this.colType(col);
    if (type === 'text') return f.searchText.trim().length > 0;
    if (type === 'date') return !!(f.dateFrom || f.dateTo);
    return f.selectedValues.size > 0;
  }

  get anyFilterActive(): boolean {
    return this.searchText.trim().length > 0 ||
           this.allColumns.some(c => this.isFiltered(c.key));
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.cfp-pop') && !target.closest('.filter-btn')) {
      this.openFilterCol = null;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pdfOpen) this.closePdf();
    this.openFilterCol = null;
  }

  // ── Status pill colors ────────────────────────────────────────────────────
  statusClass(status: string): string {
    const s = (status || '').toUpperCase();
    if (s.startsWith('CODE 1')) return 'pill-green';
    if (s.startsWith('CODE R')) return 'pill-red';
    if (s.startsWith('CODE'))   return 'pill-amber';
    return 'pill-gray';
  }

  qaqcClass(status: string): string {
    const s = (status || '').toUpperCase();
    if (s === 'ACCEPTED') return 'pill-green';
    if (s === 'REJECTED') return 'pill-red';
    return 'pill-amber';
  }

  // ── PDF preview ───────────────────────────────────────────────────────────
  openPdf(row: WirEntry): void {
    this.pdfOpen = true;
    this.pdfLoading = true;
    this.pdfError = '';
    this.pdfDocid = row.docid;
    this.revokePdfUrl();

    this.api.getWirPdf(row.docid).subscribe({
      next: (blob: Blob) => {
        this.pdfBlob = blob;
        this.pdfBlobUrl = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfBlobUrl);
        this.pdfLoading = false;
      },
      error: () => {
        this.pdfLoading = false;
        this.pdfError = 'Failed to generate the PDF for this WIR. Please try again.';
      }
    });
  }

  downloadPdf(): void {
    if (!this.pdfBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(this.pdfBlob);
    a.download = `WIR_${this.pdfDocid}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  openPdfNewTab(): void {
    if (this.pdfBlobUrl) window.open(this.pdfBlobUrl, '_blank');
  }

  closePdf(): void {
    this.pdfOpen = false;
    this.pdfError = '';
    this.revokePdfUrl();
  }

  private revokePdfUrl(): void {
    if (this.pdfBlobUrl) {
      URL.revokeObjectURL(this.pdfBlobUrl);
      this.pdfBlobUrl = null;
    }
    this.pdfUrl = null;
    this.pdfBlob = null;
  }

  // ── CSV export (current filtered view, full dataset) ─────────────────────
  exportCSV(): void {
    this.ensureAllLoaded(() => {
      this.applyFilters();   // recompute over the full dataset if rows just arrived
      this.doExportCSV();
    });
  }

  private doExportCSV(): void {
    const cols = this.allColumns;
    const escape = (v: string): string =>
      v.includes(',') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"` : v;

    const header = cols.map(c => escape(c.label)).join(',');
    const lines  = this.filteredRows.map(r =>
      cols.map(c => escape(this.cellValue(r, c.key))).join(',')
    );

    const csv  = [header, ...lines].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `wir-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
