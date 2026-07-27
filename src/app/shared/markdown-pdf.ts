import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Shared markdown → A4 PDF exporter (real TEXT-based output, not a raster).
 * Used by the AI Insight Report modal and the AI Assistant chat export.
 * Renders headings, paragraphs, bullet lists and bordered tables (via
 * jsPDF-AutoTable) with page breaks and per-page footers.
 */
export interface MarkdownPdfOptions {
  markdown: string;
  headerTitle: string;     // dark banner title on page 1
  headerSubtitle: string;  // small line under the title (scope · date)
  footerText: string;      // left side of every page's footer
  filename: string;        // full file name incl. .pdf
}

export function exportMarkdownPdf(opts: MarkdownPdfOptions): void {
  const md = opts.markdown || '';
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
      .replace(/[‘’‚‛]/g, "'")
      .replace(/[“”„‟]/g, '"')
      .replace(/…/g, '...')
      .replace(/[•‣◦⁃]/g, '-')
      .replace(/[→➔➜➡]/g, '->')
      .replace(/←/g, '<-').replace(/↔/g, '<->')
      .replace(/⇒/g, '=>').replace(/⇐/g, '<=')
      .replace(/≥/g, '>=').replace(/≤/g, '<=')
      .replace(/×/g, 'x').replace(/÷/g, '/').replace(/±/g, '+/-')
      .replace(/[✓✔]/g, 'Y').replace(/[✖✗✘❌]/g, 'X')
      .replace(/[⚠⛔❗❕]/g, '!')
      .replace(/[☀-➿]/g, '')
      .replace(/[\u{1F000}-\u{1FAFF}]/gu, '')
      .replace(/[︀-️]/g, '')
      .replace(/[←-⇿]/g, '')
      .replace(/ /g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const newPage = () => { pdf.addPage(); y = margin + 4; };
  const need = (h: number) => { if (y + h > maxY) newPage(); };

  // ── First page opening ─────────────────────────────────────────────────────
  // Audit reports (API-injected header) start with a KICKER: line and carry
  // their own designed title block — no repeated banner, matching the approved
  // period-audit layout. Everything else keeps the compact header band.
  const isAudit = md.trimStart().startsWith('KICKER:');
  if (!isAudit) {
    pdf.setFillColor(...NAVY);
    pdf.rect(0, 0, pageW, 26, 'F');
    pdf.setFillColor(...TEAL);
    pdf.rect(0, 24, pageW, 2, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.setTextColor(255, 255, 255);
    pdf.text(opts.headerTitle, margin, 12);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.setTextColor(203, 213, 225);
    pdf.text(opts.headerSubtitle, margin, 19);
    y = 26 + 8;
  } else {
    y = margin + 6;
  }
  let firstHeadingDone = false;   // audit mode: first # renders as the big title
  let sectionNo = 0;              // running SECTION counter for banner headings

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

    // KICKER: small-caps confidentiality strip over a navy rule (page-1 title block)
    if (line.startsWith('KICKER:')) {
      const txt = strip(line.slice(7));
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...TEAL);
      // Tracking via charSpace rather than injected spaces: a long kicker built
      // from injected spaces can run past the right margin. Shrink until it fits.
      const kick = txt.toUpperCase();
      let cs = 1.1;
      while (cs > 0 && pdf.getTextWidth(kick) + cs * Math.max(0, kick.length - 1) > contentW) cs -= 0.1;
      pdf.text(kick, margin, y, { charSpace: Math.max(0, cs) });
      y += 2.5;
      pdf.setDrawColor(...NAVY); pdf.setLineWidth(0.8);
      pdf.line(margin, y, pageW - margin, y);
      y += 8;
      i++; continue;
    }

    // TILES: value | label ;; … → KPI stat-tile grid (4 per row)
    if (line.startsWith('TILES:')) {
      const tiles = line.slice(6).split(';;')
        .map(t => t.split('|'))
        .filter(p => p.length >= 2)
        .map(p => ({ v: strip(p[0]), l: strip(p.slice(1).join('|')).toUpperCase() }));
      if (tiles.length) {
        const perRow = 4, gap = 4;
        const tw = (contentW - gap * (perRow - 1)) / perRow;
        const th = 17;
        for (let r = 0; r < tiles.length; r += perRow) {
          need(th + 4);
          const row = tiles.slice(r, r + perRow);
          row.forEach((t, ci) => {
            const x = margin + ci * (tw + gap);
            pdf.setFillColor(248, 250, 252);
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.2);
            pdf.roundedRect(x, y, tw, th, 1.6, 1.6, 'FD');
            pdf.setFillColor(...TEAL);
            pdf.rect(x, y, tw, 1.1, 'F');                       // teal top accent
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.setTextColor(...NAVY);
            pdf.text(t.v, x + tw / 2, y + 7.5, { align: 'center' });
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(5.6); pdf.setTextColor(100, 116, 139);
            const ll = pdf.splitTextToSize(t.l, tw - 4).slice(0, 2);
            pdf.text(ll, x + tw / 2, y + 11.5, { align: 'center' });
          });
          y += th + 3;
        }
        y += 3;
      }
      i++; continue;
    }

    // Blockquote → shaded note panel with teal left bar
    if (line.startsWith('>')) {
      const note: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        note.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.6);
      const wrapped = pdf.splitTextToSize(strip(note.join(' ')), contentW - 10);
      const h = wrapped.length * 4.1 + 7;
      need(h + 4);
      pdf.setFillColor(241, 245, 249);
      pdf.rect(margin, y - 2, contentW, h, 'F');
      pdf.setFillColor(...TEAL);
      pdf.rect(margin, y - 2, 1.4, h, 'F');
      pdf.setTextColor(71, 85, 105);
      pdf.text(wrapped, margin + 5, y + 3);
      y += h + 4;
      continue;
    }

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

      // ── Font + padding scale down as columns multiply, so wide audit tables
      //    (11-12 cols) still fit A4 portrait at readable size. ──────────────
      let bodyFont = cols > 11 ? 5.9 : cols > 9 ? 6.4 : cols > 7 ? 7.1 : 8.2;
      const pad = cols > 9 ? 1.5 : cols > 7 ? 1.9 : 2.4;

      // Which columns are short enough that NOTHING in them should ever wrap
      // (row numbers, hours, percentages, day pairs, dates, short labels like
      // "Medium"). Only genuinely long free text is allowed to wrap.
      const NOWRAP_MAX_CHARS = 16;
      const isShort = maxLen.map(m => m <= NOWRAP_MAX_CHARS);
      const wideIdx = header.map((_, ci) => ci).filter(ci => !isShort[ci]);

      // Measure headers AND body cells: a column must be at least as wide as its
      // widest single-line content, or autoTable breaks "46" into "4"/"6" and
      // "Medium" into "Medi"/"um". Step the fonts down until the no-wrap
      // minimums fit the page.
      let headFont = Math.max(5.0, bodyFont - 0.5);
      let headW: number[] = [];
      let noWrapMin: number[] = [];
      for (;;) {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(headFont);
        headW = header.map(h => pdf.getTextWidth(h || '') + pad * 2 + 0.6);

        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(bodyFont);
        const bodyW = header.map((_, ci) => {
          let w = 0;
          for (const r of rows) w = Math.max(w, pdf.getTextWidth(r[ci] ?? ''));
          return w + pad * 2 + 0.6;
        });

        // short column → fit header AND body; long text column → fit header only
        noWrapMin = header.map((_, ci) =>
          isShort[ci] ? Math.max(headW[ci], bodyW[ci]) : headW[ci]);

        const total = noWrapMin.reduce((a, b) => a + b, 0);
        if (total <= contentW || bodyFont <= 5.0) break;
        headFont = Math.max(4.8, headFont - 0.25);
        bodyFont = Math.max(5.0, bodyFont - 0.25);
      }

      // Right-align purely numeric / percentage columns; emphasise the first column.
      const colStyles: Record<number, any> = {};
      header.forEach((_, ci) => {
        const vals = rows.map(r => (r[ci] ?? '').trim()).filter(v => v.length > 0);
        const numeric = vals.length > 0 && vals.every(v => /^[-+]?[\d.,]+%?$/.test(v));
        const dayPair = vals.length > 0 && vals.every(v => /^\d+\/\d+$/.test(v));
        colStyles[ci] = {
          minCellWidth: noWrapMin[ci],                       // never wraps
          ...(isShort[ci] ? { overflow: 'visible' as const } : {}),
          ...(numeric ? { halign: 'right' as const }
              : dayPair ? { halign: 'center' as const } : {}),
        };
      });
      colStyles[0] = { ...(colStyles[0] || {}), fontStyle: 'bold', textColor: [30, 41, 59] };

      // Long free-text columns share the width left over after every no-wrap
      // column is satisfied — proportional to how much text each holds.
      if (wideIdx.length) {
        const reservedNarrow = header
          .map((_, ci) => (wideIdx.includes(ci) ? 0 : noWrapMin[ci]))
          .reduce((a, b) => a + b, 0);
        const slack = Math.max(0, contentW - reservedNarrow);
        const totalWideLen = wideIdx.reduce((a, ci) => a + maxLen[ci], 0) || 1;
        wideIdx.forEach(ci => {
          const share = slack * (maxLen[ci] / totalWideLen);
          colStyles[ci] = {
            ...(colStyles[ci] || {}),
            cellWidth: Math.max(headW[ci], Math.min(72, share)),
            halign: 'left',
          };
        });
      }

      autoTable(pdf, {
        head: [header],
        body: rows.length ? rows : [header.map(() => '')],
        startY: y + 1,
        margin: { left: margin, right: margin, top: margin + 2, bottom: footerH + 2 },
        showHead: 'firstPage',   // long tables: header row once, not on every page
        theme: 'grid',
        styles: {
          fontSize: bodyFont, cellPadding: { top: pad * 0.85, right: pad, bottom: pad * 0.85, left: pad },
          overflow: 'linebreak', valign: 'top', lineColor: [226, 232, 240], lineWidth: 0.1,
          textColor: [51, 65, 85],
        },
        headStyles: {
          fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', valign: 'middle',
          fontSize: headFont, cellPadding: { top: pad, right: pad, bottom: pad, left: pad },
          lineColor: [255, 255, 255], lineWidth: 0.1,
          overflow: 'visible',   // never wrap a header label
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

      // Audit mode, first heading → big document title (part of the title block)
      if (isAudit && !firstHeadingDone && lvl <= 2) {
        firstHeadingDone = true;
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22); pdf.setTextColor(...NAVY);
        const wrapped = pdf.splitTextToSize(txt, contentW);
        pdf.text(wrapped, margin, y + 4);
        y += wrapped.length * 9 + 6;
        i++; continue;
      }

      // Audit mode, numbered section (e.g. "## 3. Department Comparison")
      // → full-width navy SECTION banner, like the approved period-audit layout
      const sm = isAudit ? txt.match(/^(\d+)[.)]\s*(.+)$/) : null;
      if (sm && lvl <= 2) {
        sectionNo = parseInt(sm[1], 10);
        const title = sm[2];
        need(22);
        y += 4;
        pdf.setFillColor(...NAVY);
        pdf.roundedRect(margin, y - 4, contentW, 13.5, 1.2, 1.2, 'F');
        pdf.setFillColor(...TEAL);
        pdf.rect(margin, y - 4, 2.2, 13.5, 'F');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.setTextColor(26, 188, 156);
        pdf.text(`S E C T I O N   ${sectionNo}`, margin + 6, y);
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12.5); pdf.setTextColor(255, 255, 255);
        pdf.text(pdf.splitTextToSize(title, contentW - 12)[0], margin + 6, y + 6);
        y += 15;
        i++; continue;
      }

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
    pdf.text(opts.footerText, margin, pageH - 4.5);
    pdf.text(`Page ${p} of ${total}`, pageW - margin, pageH - 4.5, { align: 'right' });
  }

  pdf.save(opts.filename);
}
