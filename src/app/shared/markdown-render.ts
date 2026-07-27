/**
 * Shared, dependency-free markdown → HTML renderer used by the AI report modal
 * and the AI assistant chat. Line-based block parser so tables, headings, lists
 * and paragraphs each render as clean structures (no global-regex mangling).
 *
 * Output uses the `air-*` classes (air-tablewrap / air-table / air-wrap /
 * air-hr) styled in ai-report.component.css. NOTE: because this HTML is
 * injected via [innerHTML], the consuming component must set
 * `encapsulation: ViewEncapsulation.None` or the styles will not reach it.
 */
export function renderMarkdown(md: string): string {
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

    // KICKER: small-caps confidentiality strip (injected by the API header)
    if (line.startsWith('KICKER:')) {
      closeList();
      out.push(`<div class="air-kicker">${esc(line.slice(7).trim())}</div>`);
      i++; continue;
    }

    // TILES: value | label ;; value | label … → KPI stat-tile grid
    if (line.startsWith('TILES:')) {
      closeList();
      const tiles = line.slice(6).split(';;')
        .map(t => t.split('|'))
        .filter(p => p.length >= 2)
        .map(p => `<div class="air-tile"><div class="air-tile-v">${esc(p[0].trim())}</div>` +
                  `<div class="air-tile-l">${esc(p.slice(1).join('|').trim())}</div></div>`);
      if (tiles.length) out.push(`<div class="air-tiles">${tiles.join('')}</div>`);
      i++; continue;
    }

    // blockquote → highlighted note panel (consecutive > lines merge)
    if (line.startsWith('>')) {
      closeList();
      const note: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        note.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<div class="air-note">${inline(note.join(' '))}</div>`);
      continue;
    }

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
      // Long-text columns (names, "reason"/"evidence" sentences) should wrap;
      // short numeric columns stay on one line so rows read cleanly.
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
      // Horizontally-scrollable wrapper so wide tables keep their column
      // widths instead of being crushed into the container width.
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
