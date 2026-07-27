import { Component, Input, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiReportService, AiDept } from '../../services/ai-report.service';
import { renderMarkdown } from '../../shared/markdown-render';
import { exportMarkdownPdf } from '../../shared/markdown-pdf';

/**
 * Reusable "AI Insight Report" panel.
 * Drop <app-ai-report [buttonLabel]="'...'"></app-ai-report> onto any page.
 * The API decides scope + prompt from the logged-in user's role, so the same
 * component serves CED (all depts), HOD (their dept), and Employee (self).
 *
 * Role-based filters (shown before generating):
 *   Employee ('E') → no filters, generates immediately.
 *   HOD      ('H') → date range only (dept locked to their own).
 *   CED      ('C') → date range + department drop-down (All = company-wide).
 * Role/dept come from GET /api/AI/ValidateToken so the UI never guesses.
 */
@Component({
  selector: 'app-ai-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-report.component.html',
  styleUrls: ['./ai-report.component.css'],
  // The report body is injected via [innerHTML]; with the default emulated
  // encapsulation the component's .air-* styles never match that injected
  // HTML (no _ngcontent attributes), so tables rendered border-less.
  // All selectors here are `air-`-prefixed, so going global is safe.
  encapsulation: ViewEncapsulation.None
})
export class AiReportComponent implements OnDestroy {
  /** Text on the launch button. Defaults suit any role. */
  @Input() buttonLabel = 'Generate AI Insight Report';

  /** Hide the built-in launch button — used when the host page places its own
   *  trigger (e.g. in a toolbar) and calls generate() via a template ref. */
  @Input() hideLaunchButton = false;

  loading = false;
  error = '';
  scopeLabel = '';
  generatedDate = '';
  fromCache = false;
  reportHtml = '';         // rendered markdown
  private reportMarkdown = '';

  // ── role-based filter step ──────────────────────────────────────────────
  role: 'E' | 'H' | 'C' = 'E';
  private ctxLoaded = false;
  loadingCtx = false;
  showFilters = false;
  dateFrom = '';
  dateTo = '';
  deptId: number | null = null;      // CED department drill-down (null = all)
  departments: AiDept[] = [];

  constructor(private api: AiReportService) {}

  /** The app header (z-index 1001) sits above the overlay because the page
   *  content wrapper creates its own stacking context (z-index: 2), which caps
   *  the overlay's z-index inside it. While any AI overlay (filter / loading /
   *  report) is open we tag <body> so global CSS hides the top header and the
   *  page behind can't scroll. */
  private syncBodyLock(): void {
    const open = this.showFilters || this.loading || !!this.reportHtml;
    document.body.classList.toggle('air-modal-open', open);
  }

  ngOnDestroy(): void {
    document.body.classList.remove('air-modal-open');
  }

  /** Entry point the host pages call. Employees generate straight away;
   *  HOD/CED get the filter step first. Resolves role once, lazily. */
  generate(regenerate = false): void {
    if (regenerate) { this.runGenerate(true); return; }

    if (this.ctxLoaded) { this.afterContext(); return; }

    this.loadingCtx = true;
    this.error = '';
    this.api.validate().subscribe({
      next: c => {
        this.role = (c?.role === 'H' || c?.role === 'C') ? c.role : 'E';
        this.ctxLoaded = true;
        this.loadingCtx = false;
        this.afterContext();
      },
      error: () => {
        // Fall back to a plain generate — the API enforces scope regardless.
        this.ctxLoaded = true;
        this.loadingCtx = false;
        this.runGenerate(false);
      }
    });
  }

  private afterContext(): void {
    if (this.role === 'E') { this.runGenerate(false); return; }
    this.initFilterDefaults();
    if (this.role === 'C' && this.departments.length === 0) {
      this.api.departments().subscribe({
        next: r => this.departments = r?.data ?? [],
        error: () => this.departments = []
      });
    }
    this.showFilters = true;
    this.syncBodyLock();
  }

  /** Default window mirrors the API: month-to-date, or the whole previous
   *  month when the current month is still under 10 days old. */
  private initFilterDefaults(): void {
    const today = new Date();
    let from: Date, to: Date;
    if (today.getDate() < 10) {
      to = new Date(today.getFullYear(), today.getMonth(), 0);       // last day of prev month
      from = new Date(to.getFullYear(), to.getMonth(), 1);
    } else {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = today;
    }
    this.dateFrom = this.fmt(from);
    this.dateTo = this.fmt(to);
  }

  private fmt(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  /** "Generate" button inside the filter panel. */
  submitFilters(): void {
    if (this.dateFrom && this.dateTo && this.dateTo < this.dateFrom) {
      this.error = '"To" date cannot be before "From" date.';
      return;
    }
    this.showFilters = false;
    this.runGenerate(false);
  }

  cancelFilters(): void {
    this.showFilters = false;
    this.syncBodyLock();
  }

  private runGenerate(regenerate: boolean): void {
    this.loading = true;
    this.error = '';
    this.syncBodyLock();
    this.api.generate({
      regenerate,
      dateFrom: this.role === 'E' ? null : this.dateFrom || null,
      dateTo: this.role === 'E' ? null : this.dateTo || null,
      deptId: this.role === 'C' ? this.deptId : null
    }).subscribe({
      next: res => {
        this.reportMarkdown = res.reportMarkdown || '';
        this.reportHtml = this.renderMarkdown(this.reportMarkdown);
        this.scopeLabel = res.scopeLabel;
        this.generatedDate = res.generatedDate;
        this.fromCache = res.fromCache;
        this.loading = false;
        this.syncBodyLock();
      },
      error: err => {
        this.error = err?.error?.message
          || 'Could not generate the report right now. Please try again in a minute.';
        this.loading = false;
        this.syncBodyLock();
      }
    });
  }

  close(): void {
    this.reportHtml = '';
    this.reportMarkdown = '';
    this.error = '';
    this.syncBodyLock();
  }

  /** Export via the shared markdown → PDF exporter (see shared/markdown-pdf.ts). */
  exportPdf(): void {
    const safe = (this.scopeLabel || 'AI-Report').replace(/[^\w-]+/g, '_');
    exportMarkdownPdf({
      markdown: this.reportMarkdown || '',
      headerTitle: 'DPR Performance Insight',
      headerSubtitle: `${this.scopeLabel}   ·   ${this.generatedDate}`,
      footerText: 'AL ADRAK — DPR Performance Insight',
      filename: `DPR-Insight-${safe}-${(this.generatedDate || '').replace(/[: ]/g, '-')}.pdf`,
    });
  }

  /** Markdown → HTML via the shared renderer (see shared/markdown-render.ts). */
  private renderMarkdown(md: string): string {
    return renderMarkdown(md);
  }
}
