import { NgZone } from '@angular/core';

/**
 * DOM-only motion helpers shared by the DPR dashboards (employee + HOD).
 * None of these touch Angular state: bars, rings and reveals are CSS-driven,
 * and the resting markup always holds the real values, so a page is correct
 * even if nothing here ever runs.
 */

export function reduceMotion(): boolean {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Tooltip strings carry <b> for figures and go in via innerHTML — any text
 *  that came from the database is escaped with this first. */
export function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
}

/** 1234.5 → '1,234.5' */
export function fmtNum(v: number, dec: number): string {
  return v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Count every `[data-cu]` element up from zero to its value. The element's
 * text already holds the final formatted number; this only replays it.
 * Runs outside the zone — a per-frame change-detection pass is the one thing
 * that would make a dashboard stutter. Returns a cancel function.
 */
export function countUpAll(host: HTMLElement, zone: NgZone, alive: () => boolean, delayMs = 60): () => void {
  if (reduceMotion()) { return () => { /* nothing to cancel */ }; }
  const rafs: number[] = [];
  const timer = setTimeout(() => {
    host.querySelectorAll<HTMLElement>('[data-cu]').forEach(el => {
      const target = parseFloat(el.getAttribute('data-cu') || '0');
      const dec = parseInt(el.getAttribute('data-dec') || '0', 10);
      if (!isFinite(target) || target === 0) { return; }
      const final = el.textContent;
      const t0 = performance.now();
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      zone.runOutsideAngular(() => {
        const frame = (now: number) => {
          if (!alive()) { return; }
          const p = Math.min((now - t0) / 1200, 1);
          el.textContent = fmtNum(target * ease(p), dec);
          if (p < 1) { rafs.push(requestAnimationFrame(frame)); } else { el.textContent = final; }
        };
        rafs.push(requestAnimationFrame(frame));
      });
    });
  }, delayMs);
  return () => { clearTimeout(timer); rafs.forEach(id => cancelAnimationFrame(id)); };
}

/**
 * Cards below the fold wait for the viewport instead of animating unseen at
 * load. `.pre` only suppresses the entrance keyframe; removing it replays it.
 * Nothing stays hidden: no observer → no .pre; and a 4 s timer clears the rest.
 * Returns a cleanup function.
 */
export function setupReveal(host: HTMLElement): () => void {
  if (reduceMotion() || typeof IntersectionObserver === 'undefined') { return () => { /* nothing */ }; }
  const vh = window.innerHeight || 0;
  const below = Array.from(host.querySelectorAll<HTMLElement>('.an'))
    .filter(e => e.getBoundingClientRect().top > vh * 0.92);
  if (!below.length) { return () => { /* nothing */ }; }
  below.forEach(e => e.classList.add('pre'));
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) { return; }
      (en.target as HTMLElement).classList.remove('pre');
      io.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  below.forEach(e => io.observe(e));
  const safety = setTimeout(() => below.forEach(e => e.classList.remove('pre')), 4000);
  return () => { clearTimeout(safety); io.disconnect(); below.forEach(e => e.classList.remove('pre')); };
}

/**
 * One shared tooltip for every `[data-tip]` mark under `host`. Listeners live
 * outside the zone: mouse movement must not trigger change detection.
 * Returns an unbind function.
 */
export function bindTooltip(host: HTMLElement, tip: HTMLElement, zone: NgZone): () => void {
  let shown: Element | null = null;

  const place = (e: MouseEvent) => {
    const pad = 12;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + w > window.innerWidth - 8) { x = e.clientX - w - pad; }
    if (y + h > window.innerHeight - 8) { y = e.clientY - h - pad; }
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  };
  const over = (e: MouseEvent) => {
    const t = (e.target as Element)?.closest?.('[data-tip]');
    if (!t || t === shown) { return; }
    const txt = t.getAttribute('data-tip');
    if (!txt) { return; }
    shown = t;
    tip.innerHTML = txt;
    tip.classList.add('on');
    place(e);
  };
  const move = (e: MouseEvent) => { if (shown) { place(e); } };
  const out = (e: MouseEvent) => {
    if (!shown) { return; }
    const to = e.relatedTarget as Element | null;
    if (to?.closest?.('[data-tip]') === shown) { return; }
    shown = null;
    tip.classList.remove('on');
  };

  zone.runOutsideAngular(() => {
    host.addEventListener('mouseover', over);
    host.addEventListener('mousemove', move);
    host.addEventListener('mouseout', out);
  });
  return () => {
    host.removeEventListener('mouseover', over);
    host.removeEventListener('mousemove', move);
    host.removeEventListener('mouseout', out);
  };
}
