/**
 * The single-application leave document, as a vector PDF.
 *
 * One leave application only — the one on screen — never a list. It is built
 * with jsPDF and autotable rather than by photographing the page, so the text
 * stays selectable and sharp at any zoom, long handover descriptions break
 * across pages instead of being cut off, and the same file serves both
 * "Export PDF" (saved) and "Print" (opened in the print dialog).
 *
 * jsPDF is large, so it is imported inside the function: the leave page loads
 * without it and only pays for it when someone asks for a document.
 */

export interface LeavePdfModel {
  leaveNo: string;
  status: 'A' | 'R' | 'P';
  statusLabel: string;
  generatedBy: string;
  applicant: {
    name: string; empId: string; designation: string; department: string;
    location: string; joined: string; email: string; phone: string;
  };
  leave: {
    type: string; from: string; to: string; days: string; submitted: string;
    contact: string; route: string; approver: string; reason: string; document: string;
  };
  handovers: { name: string; contact: string; project: string; activities: string; remarks: string; status: string }[];
  approvals: { step: string; approver: string; status: string; date: string; remarks: string }[];
  result: string;
}

type RGB = [number, number, number];
const TEAL: RGB = [19, 130, 113];
const DARK: RGB = [27, 42, 56];
const INK: RGB = [15, 23, 42];
const MUTED: RGB = [100, 116, 139];
const LINE: RGB = [226, 232, 240];
const SOFT: RGB = [248, 250, 252];

const STATUS_COLOUR: Record<'A' | 'R' | 'P', RGB> = {
  A: [22, 163, 74],
  R: [220, 38, 38],
  P: [217, 119, 6]
};

async function logoDataUrl(): Promise<string> {
  try {
    const r = await fetch('assets/images/Logo_LoginScreen.png');
    const b = await r.blob();
    return await new Promise<string>(res => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.readAsDataURL(b);
    });
  } catch { return ''; }
}

export async function buildLeavePdf(m: LeavePdfModel): Promise<import('jspdf').jsPDF> {
  const [{ jsPDF }, autoTableMod, logo] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'), logoDataUrl()
  ]);
  const autoTable = autoTableMod.default;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pW = 210, pH = 297, margin = 12, cW = pW - margin * 2;
  const footerTop = pH - 14;
  let y = 0;

  const lastY = () => ((pdf as any).lastAutoTable?.finalY as number | undefined) ?? y;
  const room = (need: number) => { if (y + need > footerTop - 4) { pdf.addPage(); y = margin; } };

  // ── header ────────────────────────────────────────────────────────────────
  pdf.setFillColor(...DARK); pdf.rect(0, 0, pW, 26, 'F');
  pdf.setFillColor(...TEAL); pdf.rect(0, 24.5, pW, 1.5, 'F');
  if (logo) { try { pdf.addImage(logo, 'PNG', margin, 4.5, 16, 14); } catch { /* header without a logo */ } }
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(255, 255, 255);
  pdf.text('AL ADRAK TRADING AND CONTRACTING LLC', margin + 20, 11);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(165, 212, 206);
  pdf.text('LEAVE APPLICATION', margin + 20, 17.5);

  pdf.setFontSize(8); pdf.setTextColor(180, 220, 215);
  pdf.text(m.leaveNo, pW - margin, 10, { align: 'right' });
  const chipW = pdf.getTextWidth(m.statusLabel.toUpperCase()) + 8;
  pdf.setFillColor(...STATUS_COLOUR[m.status]);
  pdf.roundedRect(pW - margin - chipW, 13, chipW, 6, 1.2, 1.2, 'F');
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(255, 255, 255);
  pdf.text(m.statusLabel.toUpperCase(), pW - margin - chipW / 2, 17.1, { align: 'center' });
  y = 33;

  // ── section heading ───────────────────────────────────────────────────────
  const heading = (title: string) => {
    room(14);
    pdf.setFillColor(...TEAL); pdf.rect(margin, y, 1.6, 5.2, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...DARK);
    pdf.text(title.toUpperCase(), margin + 4, y + 4);
    pdf.setDrawColor(...LINE); pdf.setLineWidth(0.2); pdf.line(margin + 4 + pdf.getTextWidth(title.toUpperCase()) + 3, y + 3.2, pW - margin, y + 3.2);
    y += 8;
  };

  // label/value pairs in a grid, so a long value wraps inside its own cell
  const pairs = (rows: [string, string][], cols = 2) => {
    const gap = 4, w = (cW - gap * (cols - 1)) / cols;
    for (let i = 0; i < rows.length; i += cols) {
      const slice = rows.slice(i, i + cols);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
      const wrapped = slice.map(([, v]) => pdf.splitTextToSize(v || '—', w - 5) as string[]);
      const h = Math.max(...wrapped.map(l => l.length)) * 3.8 + 7.2;
      room(h + 1);
      slice.forEach(([label], c) => {
        const x = margin + c * (w + gap);
        pdf.setFillColor(...SOFT); pdf.setDrawColor(...LINE); pdf.setLineWidth(0.15);
        pdf.roundedRect(x, y, w, h, 1.2, 1.2, 'FD');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.setTextColor(...MUTED);
        pdf.text(label.toUpperCase(), x + 2.5, y + 4);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...INK);
        pdf.text(wrapped[c], x + 2.5, y + 8);
      });
      y += h + 1.6;
    }
  };

  const tableTheme = {
    margin: { left: margin, right: margin, bottom: 18 },
    styles: { font: 'helvetica', fontSize: 8.2, cellPadding: 2.2, textColor: INK, lineColor: LINE, lineWidth: 0.15, valign: 'top' as const },
    headStyles: { fillColor: DARK, textColor: [255, 255, 255] as RGB, fontStyle: 'bold' as const, fontSize: 7.5 },
    alternateRowStyles: { fillColor: SOFT }
  };

  // ── applicant ─────────────────────────────────────────────────────────────
  heading('Applicant');
  pairs([
    ['Name', m.applicant.name],
    ['Employee ID', m.applicant.empId],
    ['Designation', m.applicant.designation],
    ['Department', m.applicant.department],
    ['Location', m.applicant.location],
    ['Date of joining', m.applicant.joined],
    ['Email', m.applicant.email],
    ['Phone', m.applicant.phone]
  ], 3);

  // ── the leave ─────────────────────────────────────────────────────────────
  y += 2;
  heading('Leave details');
  pairs([
    ['Leave type', m.leave.type],
    ['Number of days', m.leave.days],
    ['From', m.leave.from],
    ['To', m.leave.to],
    ['Submitted', m.leave.submitted],
    ['Approver (HOD)', m.leave.approver],
    ['Contact while on leave', m.leave.contact],
    ['Travel route', m.leave.route]
  ], 3);
  pairs([['Reason', m.leave.reason]], 1);
  pairs([['Attached document', m.leave.document]], 1);

  // ── handovers ─────────────────────────────────────────────────────────────
  if (m.handovers.length) {
    y += 2;
    heading(`Handover (${m.handovers.length})`);
    autoTable(pdf, {
      ...tableTheme,
      startY: y,
      head: [['Handed over to', 'Project', 'Activities', 'Remarks', 'Status']],
      body: m.handovers.map(h => [`${h.name}\n${h.contact}`, h.project, h.activities, h.remarks || '—', h.status]),
      columnStyles: { 0: { cellWidth: 44 }, 1: { cellWidth: 26 }, 3: { cellWidth: 34 }, 4: { cellWidth: 26, fontStyle: 'bold' } }
    });
    y = lastY() + 5;
  }

  // ── approvals ─────────────────────────────────────────────────────────────
  room(30);
  heading('Approval trail');
  autoTable(pdf, {
    ...tableTheme,
    startY: y,
    head: [['Step', 'Approver', 'Status', 'Date', 'Remarks']],
    body: [
      ...m.approvals.map(a => [a.step, a.approver, a.status, a.date || '—', a.remarks || '—']),
      [{ content: 'Result', styles: { fontStyle: 'bold' as const } }, { content: m.result, colSpan: 4, styles: { fontStyle: 'bold' as const, textColor: STATUS_COLOUR[m.status] } }]
    ],
    columnStyles: { 0: { cellWidth: 34 }, 2: { cellWidth: 32 }, 3: { cellWidth: 36 } },
    didParseCell: d => {
      if (d.section === 'body' && d.column.index === 2 && typeof d.cell.raw === 'string') {
        const s = d.cell.raw.toLowerCase();
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.textColor = s.startsWith('approved') ? STATUS_COLOUR.A : s.startsWith('rejected') ? STATUS_COLOUR.R : STATUS_COLOUR.P;
      }
    }
  });
  y = lastY() + 10;

  // ── signatures ────────────────────────────────────────────────────────────
  room(26);
  const sigW = (cW - 12) / 3;
  ['Employee', 'Head of Department', 'HR'].forEach((who, i) => {
    const x = margin + i * (sigW + 6);
    pdf.setDrawColor(...MUTED); pdf.setLineWidth(0.25); pdf.line(x, y + 14, x + sigW, y + 14);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(...DARK);
    pdf.text(who, x, y + 18.5);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(...MUTED);
    pdf.text('Name, signature and date', x, y + 22);
  });

  // ── footer and page numbers, on every page ────────────────────────────────
  const total = pdf.getNumberOfPages();
  const stamp = `Generated ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}${m.generatedBy ? ' by ' + m.generatedBy : ''}`;
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(...LINE); pdf.setLineWidth(0.2); pdf.line(margin, pH - 11, pW - margin, pH - 11);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...MUTED);
    pdf.text(`${m.leaveNo}  ·  ${m.applicant.name}`, margin, pH - 7);
    pdf.text(stamp, pW / 2, pH - 7, { align: 'center' });
    pdf.text(`Page ${p} of ${total}`, pW - margin, pH - 7, { align: 'right' });
  }

  return pdf;
}
