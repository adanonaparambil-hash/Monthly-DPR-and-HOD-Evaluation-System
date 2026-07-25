import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AiReportService, AiDept } from '../../services/ai-report.service';

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
  styleUrls: ['./ai-report.component.css']
})
export class AiReportComponent {
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
  }

  private runGenerate(regenerate: boolean): void {
    this.loading = true;
    this.error = '';
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
      },
      error: err => {
        this.error = err?.error?.message
          || 'Could not generate the report right now. Please try again in a minute.';
        this.loading = false;
      }
    });
  }

  close(): void {
    this.reportHtml = '';
    this.reportMarkdown = '';
    this.error = '';
  }

  /**
   * Export as a real TEXT-based A4 PDF built directly from the markdown with jsPDF.
   * Crisp, selectable, tens-of-KB output (the old html2canvas approach rasterized
   * the whole report into a huge image — 100 MB+ and blurry). Renders headings,
   * paragraphs, bullet lists and proper bordered tables with page breaks.
   */
  exportPdf(): void {
    const md = this.reportMarkdown || '';
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = 210, pageH = 297, margin = 14;
    const contentW = pageW - margin * 2;
    const footerH = 12;
    const maxY = pageH - footerH;
    let y = 0;

    const NAVY: [number, number, number] = [27, 42, 56];
    const TEAL: [number, number, number] = [19, 130, 113];
    const AMBER: [number, number, number] = [245, 158, 11];
    const INK: [number, number, number] = [51, 65, 85];

    const strip = (s: string) =>
      (s || '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1$2')
        // Transliterate characters the PDF's standard (WinAnsi) font can't encode.
        // Left as-is they make jsPDF mis-measure line width, so text overflows the
        // margin and renders with broken letter spacing. Do specific swaps first,
        // then strip any remaining arrows / symbols / emoji. (Em/en dashes are
        // WinAnsi-safe and deliberately left untouched.)
        .replace(/[‘’‚‛]/g, "'")        // ‘ ’ smart single quotes
        .replace(/[“”„‟]/g, '"')        // “ ” smart double quotes
        .replace(/…/g, '...')                          // … ellipsis
        .replace(/[•‣◦⁃]/g, '-')        // • bullets
        .replace(/[→➔➜➡]/g, '->')       // → arrows
        .replace(/←/g, '<-').replace(/↔/g, '<->')
        .replace(/⇒/g, '=>').replace(/⇐/g, '<=')  // ⇒ ⇐
        .replace(/≥/g, '>=').replace(/≤/g, '<=')  // ≥ ≤
        .replace(/×/g, 'x').replace(/÷/g, '/').replace(/±/g, '+/-')
        .replace(/[✓✔]/g, 'Y').replace(/[✖✗✘❌]/g, 'X') // ✓ ✗
        .replace(/[⚠⛔❗❕]/g, '!')        // ⚠ warning
        .replace(/[☀-➿]/g, '')                    // remaining dingbats/symbols
        .replace(/[\u{1F000}-\u{1FAFF}]/gu, '')             // emoji
        .replace(/[︀-️]/g, '')                    // variation selectors
        .replace(/[←-⇿]/g, '')                    // any other arrows
        .replace(/ /g, ' ')                            // non-breaking space
        .replace(/\s+/g, ' ')
        .trim();

    const newPage = () => { pdf.addPage(); y = margin + 4; };
    const need = (h: number) => { if (y + h > maxY) newPage(); };

    // ── Header band on the first page ─────────────────────────────────────────
    pdf.setFillColor(...NAVY);
    pdf.rect(0, 0, pageW, 26, 'F');
    pdf.setFillColor(...TEAL);
    pdf.rect(0, 24, pageW, 2, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.setTextColor(255, 255, 255);
    pdf.text('DPR Performance Insight', margin, 12);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.setTextColor(203, 213, 225);
    pdf.text(`${this.scopeLabel}   ·   ${this.generatedDate}`, margin, 19);
    y = 26 + 8;

    // ── Markdown → blocks ─────────────────────────────────────────────────────
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const isSep = (s: string) => !!s && s.includes('-') && /^[\s|:-]+$/.test(s.trim());
    const cellsOf = (s: string) =>
      s.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => strip(c));

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      if (!line) { i++; continue; }
      if (/^-{3,}$/.test(line)) { need(6); y += 3; pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.2); pdf.line(margin, y, pageW - margin, y); y += 4; i++; continue; }

      // Table block — rendered with jsPDF-AutoTable for clean alignment,
      // wrapping, numeric right-align, page breaks and repeated headers.
      if (line.includes('|') && i + 1 < lines.length &&
          (isSep(lines[i + 1]) || lines[i + 1].includes('|'))) {
        const header = cellsOf(line);
        i++;
        if (i < lines.length && isSep(lines[i])) i++;
        const rows: string[][] = [];
        while (i < lines.length && lines[i].trim() && lines[i].includes('|') && !isSep(lines[i])) {
          rows.push(cellsOf(lines[i].trim())); i++;
        }

        const cols = header.length || 1;
        // Longest content per column (header + cells).
        const maxLen = header.map((h, ci) => {
          let m = (h ?? '').length;
          for (const r of rows) m = Math.max(m, (r[ci] ?? '').length);
          return m;
        });
        // Right-align purely numeric / percentage columns; emphasise the first column.
        const colStyles: Record<number, any> = {};
        header.forEach((_, ci) => {
          const vals = rows.map(r => (r[ci] ?? '').trim()).filter(v => v.length > 0);
          const numeric = vals.length > 0 && vals.every(v => /^[-+]?\d[\d.,]*%?$/.test(v));
          if (numeric) colStyles[ci] = { halign: 'right' };
        });
        colStyles[0] = { ...(colStyles[0] || {}), fontStyle: 'bold', textColor: [30, 41, 59] };

        // Long free-text columns (e.g. "Reason for Rank") must get real width, or
        // autoTable squeezes them to 1-2 characters per line. Give each a fixed
        // width from the space left after reserving room for the narrow columns.
        const wideIdx = header.map((_, ci) => ci).filter(ci => maxLen[ci] > 30);
        if (wideIdx.length) {
          const narrowCount = cols - wideIdx.length;
          const reserved = narrowCount * 13;                 // ~13mm per narrow column
          const perWide = Math.min(70, Math.max(34, (contentW - reserved) / wideIdx.length));
          wideIdx.forEach(ci => {
            colStyles[ci] = { ...(colStyles[ci] || {}), cellWidth: perWide, halign: 'left' };
          });
        }

        autoTable(pdf, {
          head: [header],
          body: rows.length ? rows : [header.map(() => '')],
          startY: y + 1,
          margin: { left: margin, right: margin, top: margin + 2, bottom: footerH + 2 },
          theme: 'grid',
          styles: {
            fontSize: cols > 7 ? 7 : 8.2, cellPadding: { top: 2, right: 2.4, bottom: 2, left: 2.4 },
            overflow: 'linebreak', valign: 'top', lineColor: [226, 232, 240], lineWidth: 0.1,
            textColor: [51, 65, 85],
          },
          headStyles: {
            fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', valign: 'middle',
            lineColor: [255, 255, 255], lineWidth: 0.1,
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: colStyles,
          tableWidth: 'auto',
        });
        y = (pdf as any).lastAutoTable.finalY + 5;
        continue;
      }

      // Heading
      const hm = line.match(/^(#{1,6})\s+(.+)$/);
      if (hm) {
        const lvl = hm[1].length;
        const txt = strip(hm[2]);
        const size = lvl <= 1 ? 15 : lvl === 2 ? 12.5 : 11;
        need(14);
        y += lvl <= 2 ? 5 : 3;
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(size); pdf.setTextColor(...(lvl <= 2 ? NAVY : TEAL));
        const wrapped = pdf.splitTextToSize(txt, contentW);
        pdf.text(wrapped, margin, y);
        y += wrapped.length * (size * 0.42) + 1.5;
        if (lvl <= 2) { pdf.setDrawColor(...TEAL); pdf.setLineWidth(0.5); pdf.line(margin, y, pageW - margin, y); y += 4; }
        i++; continue;
      }

      // Bullet
      const lm = line.match(/^[-*]\s+(.+)$/);
      if (lm) {
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(...INK);
        const wrapped = pdf.splitTextToSize(strip(lm[1]), contentW - 6);
        const h = wrapped.length * 4.6 + 1.5;
        need(h);
        pdf.setFillColor(...AMBER);
        pdf.circle(margin + 1.4, y - 1.2, 0.9, 'F');
        pdf.text(wrapped, margin + 6, y);
        y += h;
        i++; continue;
      }

      // Paragraph
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(...INK);
      const wrapped = pdf.splitTextToSize(strip(line), contentW);
      const h = wrapped.length * 4.8 + 2;
      need(h);
      pdf.text(wrapped, margin, y);
      y += h;
      i++;
    }

    // ── Footers on every page ─────────────────────────────────────────────────
    const total = pdf.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      pdf.setPage(p);
      pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.2);
      pdf.line(margin, pageH - 9, pageW - margin, pageH - 9);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(148, 163, 184);
      pdf.text('AL ADRAK — DPR Performance Insight', margin, pageH - 4.5);
      pdf.text(`Page ${p} of ${total}`, pageW - margin, pageH - 4.5, { align: 'right' });
    }

    const safe = (this.scopeLabel || 'AI-Report').replace(/[^\w-]+/g, '_');
    pdf.save(`DPR-Insight-${safe}-${(this.generatedDate || '').replace(/[: ]/g, '-')}.pdf`);
  }

  /**
   * Robust, safe markdown → HTML. Line-based block parser so tables, headings,
   * lists and paragraphs each render as clean, well-aligned structures (no
   * global-regex mangling that scatters table cells).
   */
  private renderMarkdown(md: string): string {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // inline formatting: bold, italic, code
    const inline = (s: string) =>
      esc(s)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>');

    const cellsOf = (s: string) =>
      s.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());

    // a markdown table separator row: |---|:--:|---| etc.
    const isSep = (s: string) =>
      !!s && s.includes('-') && /^[\s|:-]+$/.test(s.trim());

    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    let i = 0;
    let listOpen = false;
    const closeList = () => { if (listOpen) { out.push('</ul>'); listOpen = false; } };

    while (i < lines.length) {
      const line = lines[i].trim();

      // blank line
      if (!line) { closeList(); i++; continue; }

      // horizontal rule / markdown separator "---"
      if (/^-{3,}$/.test(line)) { closeList(); out.push('<hr class="air-hr">'); i++; continue; }

      // table: a "pipe block" — current line has a '|' and the next line is
      // either a separator row (|---|---|) or another pipe row. Handles tables
      // with OR without a separator row (some models omit it).
      if (line.includes('|') && i + 1 < lines.length &&
          (isSep(lines[i + 1]) || lines[i + 1].includes('|'))) {
        closeList();
        const header = cellsOf(line);
        i++;
        if (i < lines.length && isSep(lines[i])) { i++; } // skip separator if present
        const rows: string[][] = [];
        while (i < lines.length && lines[i].trim() && lines[i].includes('|') && !isSep(lines[i])) {
          rows.push(cellsOf(lines[i].trim()));
          i++;
        }
        // Long-text columns (names, "reason"/"evidence"/"why" sentences) should wrap;
        // short numeric columns stay on one line so rows read cleanly. Detect by the
        // longest content in each column.
        const wideCol = header.map((h, ci) => {
          let m = (h || '').length;
          for (const r of rows) m = Math.max(m, (r[ci] ?? '').length);
          return m > 24;
        });
        let t = '<table class="air-table"><thead><tr>';
        t += header.map(c => `<th>${inline(c)}</th>`).join('');
        t += '</tr></thead><tbody>';
        for (const r of rows) {
          t += '<tr>' + header.map((_, ci) =>
            `<td${wideCol[ci] ? ' class="air-wrap"' : ''}>${inline(r[ci] ?? '')}</td>`).join('') + '</tr>';
        }
        // Wrap in a horizontally-scrollable container so wide tables (e.g. the
        // company-wide employee ranking) keep their column widths and stay readable
        // instead of being crushed into the fixed sheet width.
        out.push('<div class="air-tablewrap">' + t + '</tbody></table></div>');
        continue;
      }

      // headings (#..######)
      const hm = line.match(/^(#{1,6})\s+(.+)$/);
      if (hm) { closeList(); const lvl = hm[1].length; out.push(`<h${lvl}>${inline(hm[2])}</h${lvl}>`); i++; continue; }

      // bullet list item
      const lm = line.match(/^[-*]\s+(.+)$/);
      if (lm) {
        if (!listOpen) { out.push('<ul>'); listOpen = true; }
        out.push(`<li>${inline(lm[1])}</li>`);
        i++; continue;
      }

      // paragraph
      closeList();
      out.push(`<p>${inline(line)}</p>`);
      i++;
    }
    closeList();
    return out.join('\n');
  }
}
