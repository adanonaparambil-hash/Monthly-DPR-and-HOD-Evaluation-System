import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription, filter, take } from 'rxjs';
import { Api } from '../../services/api';
import { NoticePopupService } from '../../services/notice-popup.service';
import { AvatarUtil } from '../../utils/avatar.util';

/** One row of General/GetMyCelebrations (PKG_EMP_CELEBRATION.SP_GET_MY_CELEBRATIONS). */
export interface Celebration {
  celebType: 'BIRTHDAY' | 'ANNIVERSARY';
  years: number | null;
  celebYear: number;
  empId: string;
  employeeName: string | null;
  designation: string | null;
  department: string | null;
  dateOfJoined: string | null;
  profileImageBase64: string | null;
}

interface Bit { left: number; delay: number; dur: number; size: number; color: string; }

/**
 * Birthday / work-anniversary surprise for the LOGGED-IN user only.
 *
 * Mounted once in the layout, so it runs on whichever page the user lands on.
 * The API returns today's celebrations that were never shown this year; the
 * moment one appears it is marked seen in the database — so it shows exactly
 * once per year, across browsers and devices. Waits for the login notice popup
 * to close first, so the two never stack.
 *
 * Flow: gift box (tap to open) → lid flies off + confetti → greeting card.
 * prefers-reduced-motion: no confetti / balloons, just the card fading in.
 *
 * The overlay root is moved to <body> (a host page can trap fixed children under
 * the header — see components/new-joiners-card), so dark mode is bound from
 * body.dark-theme instead of :host-context.
 */
@Component({
  selector: 'app-celebration-overlay',
  standalone: true,
  templateUrl: './celebration-overlay.component.html',
  styleUrls: ['./celebration-overlay.component.css']
})
export class CelebrationOverlayComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('root') root?: ElementRef<HTMLElement>;
  @ViewChild('fx') fx?: ElementRef<HTMLCanvasElement>;

  /** Let the landing dashboard paint before the surprise appears. */
  private static readonly START_DELAY_MS = 1500;

  current: Celebration | null = null;
  queue: Celebration[] = [];
  stage: 'gift' | 'opening' | 'card' = 'gift';
  balloons: Bit[] = [];
  sparkles: Bit[] = [];

  private subs: Subscription[] = [];
  private timers: any[] = [];
  private raf = 0;
  private readonly reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private static readonly MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  private static readonly AV = ['#059669', '#0284c7', '#7c3aed', '#d97706', '#e11d48', '#4f46e5', '#0d9488', '#c2410c'];

  constructor(private api: Api, private notices: NoticePopupService, private zone: NgZone) {}

  ngOnInit(): void {
    this.timers.push(setTimeout(() => this.load(), CelebrationOverlayComponent.START_DELAY_MS));
  }

  ngAfterViewInit(): void {
    const el = this.root?.nativeElement;
    if (el) { document.body.appendChild(el); }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.timers.forEach(t => clearTimeout(t));
    cancelAnimationFrame(this.raf);
    this.root?.nativeElement.remove();
    if (this.current) { document.body.style.overflow = ''; }
  }

  // ── flow ──────────────────────────────────────────────────────────────────
  private load(): void {
    this.subs.push(this.api.getMyCelebrations().subscribe({
      next: (res: any) => {
        const rows: Celebration[] = Array.isArray(res?.data) ? res.data : [];
        this.queue = rows.filter(r => r?.celebType === 'BIRTHDAY' || r?.celebType === 'ANNIVERSARY');
        if (!this.queue.length) { return; }
        // never on top of the login announcement popup — wait until it is closed
        this.subs.push(this.notices.notice$.pipe(filter(n => !n), take(1)).subscribe(() => this.next()));
      },
      error: () => { /* non-critical: no surprise today */ }
    }));
  }

  private next(): void {
    cancelAnimationFrame(this.raf);
    this.current = this.queue.shift() ?? null;
    if (!this.current) { this.close(); return; }

    const c = this.current;
    // shown = used up: mark it now, so a refresh or a second tab never repeats it
    this.subs.push(this.api.markCelebrationSeen(c.celebType).subscribe({ error: () => { /* retried next login */ } }));

    this.balloons = c.celebType === 'BIRTHDAY' && !this.reduced ? this.makeBits(9, ['#f472b6', '#a78bfa', '#fbbf24', '#34d399', '#60a5fa', '#fb7185']) : [];
    this.sparkles = c.celebType === 'ANNIVERSARY' && !this.reduced ? this.makeBits(16, ['#fbbf24', '#fde68a', '#ffffff']) : [];
    this.stage = this.reduced ? 'card' : 'gift';
    document.body.style.overflow = 'hidden';
    this.focusSoon(this.reduced ? '.cel-btn' : '.cel-gift');
  }

  openGift(): void {
    if (this.stage !== 'gift') { return; }
    this.stage = 'opening';
    this.timers.push(setTimeout(() => {
      this.stage = 'card';
      this.burst();
      this.focusSoon('.cel-btn');
    }, 520));
  }

  /** "Thank you" / skip: the next celebration (birthday + anniversary on one day), or close. */
  done(): void {
    if (this.queue.length) { this.next(); } else { this.close(); }
  }

  private close(): void {
    cancelAnimationFrame(this.raf);
    this.current = null;
    this.balloons = this.sparkles = [];
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.current) { this.done(); } }

  private focusSoon(sel: string): void {
    this.timers.push(setTimeout(() => (this.root?.nativeElement.querySelector(sel) as HTMLElement | null)?.focus(), 60));
  }

  private makeBits(n: number, colors: string[]): Bit[] {
    return Array.from({ length: n }, (_, i) => ({
      left: Math.round((i + 0.5) * (100 / n) + (Math.random() * 6 - 3)),
      delay: +(Math.random() * 2.2).toFixed(2),
      dur: +(5 + Math.random() * 3).toFixed(2),
      size: Math.round(36 + Math.random() * 22),
      color: colors[i % colors.length]
    }));
  }

  // ── confetti (canvas, outside Angular so frames don't trigger change detection) ──
  private burst(): void {
    if (this.reduced) { return; }
    this.zone.runOutsideAngular(() => setTimeout(() => {
      const cv = this.fx?.nativeElement;
      const ctx = cv?.getContext('2d');
      if (!cv || !ctx) { return; }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = (cv.width = Math.round(innerWidth * dpr));
      const H = (cv.height = Math.round(innerHeight * dpr));
      const colors = this.current?.celebType === 'ANNIVERSARY'
        ? ['#059669', '#10b981', '#fbbf24', '#f59e0b', '#ffffff', '#0284c7']
        : ['#f472b6', '#a78bfa', '#fbbf24', '#34d399', '#60a5fa', '#fb7185', '#ffffff'];
      type P = { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; c: string; round: boolean };
      const parts: P[] = [];
      const shoot = (x: number, y: number, angle: number, spread: number, count: number, speed: number) => {
        for (let i = 0; i < count; i++) {
          const a = angle + (Math.random() - 0.5) * spread;
          const v = (speed * (0.55 + Math.random() * 0.6)) * dpr;
          const s = (5 + Math.random() * 6) * dpr;
          parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: s, h: s * (0.45 + Math.random() * 0.5),
            rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35, c: colors[(Math.random() * colors.length) | 0],
            round: Math.random() < 0.25 });
        }
      };
      shoot(W / 2, H * 0.5, -Math.PI / 2, Math.PI * 0.95, 170, 17);          // from the opened box
      const side = () => {                                                  // two side cannons a moment later
        shoot(0, H * 0.75, -Math.PI / 3, 0.6, 70, 22);
        shoot(W, H * 0.75, -Math.PI * 2 / 3, 0.6, 70, 22);
      };
      const sideAt = performance.now() + 450;
      let fired = false;
      const g = 0.32 * dpr, start = performance.now();
      const tick = (t: number) => {
        if (!fired && t >= sideAt) { side(); fired = true; }
        ctx.clearRect(0, 0, W, H);
        let alive = 0;
        for (const p of parts) {
          p.vx *= 0.986; p.vy = p.vy * 0.986 + g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
          if (p.y > H + 40) { continue; }
          alive++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(1, Math.cos(p.rot * 1.7));                               // paper flip
          ctx.fillStyle = p.c;
          if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2); ctx.fill(); }
          else { ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
          ctx.restore();
        }
        if ((alive || !fired) && t - start < 7000) { this.raf = requestAnimationFrame(tick); }
        else { ctx.clearRect(0, 0, W, H); }
      };
      this.raf = requestAnimationFrame(tick);
    }, 30));
  }

  // ── labels ────────────────────────────────────────────────────────────────
  get dark(): boolean { return document.body.classList.contains('dark-theme'); }
  get isBirthday(): boolean { return this.current?.celebType === 'BIRTHDAY'; }

  firstName(c: Celebration): string {
    const w = (c.employeeName || '').trim().split(/\s+/)[0] || '';
    return w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : 'there';
  }
  fullName(c: Celebration): string {
    return (c.employeeName || '').toLowerCase().replace(/(^|[\s.'-])\p{L}/gu, m => m.toUpperCase());
  }
  ordinal(n: number | null): string {
    const v = n ?? 0, t = v % 100;
    const suf = t >= 11 && t <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[v % 10] ?? 'th';
    return v + suf;
  }
  photo(c: Celebration): string | null {
    return c.profileImageBase64 ? AvatarUtil.processProfileImage(c.profileImageBase64) : null;
  }
  initials(c: Celebration): string {
    const p = (c.employeeName || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '★';
  }
  avatarBg(c: Celebration): string {
    let n = 0;
    for (const ch of c.empId || '') { n = (n * 31 + ch.charCodeAt(0)) >>> 0; }
    return CelebrationOverlayComponent.AV[n % CelebrationOverlayComponent.AV.length];
  }
  joined(c: Celebration): string {
    const d = c.dateOfJoined ? new Date(c.dateOfJoined) : null;
    return d && !isNaN(d.getTime()) ? d.getDate() + ' ' + CelebrationOverlayComponent.MON[d.getMonth()] + ' ' + d.getFullYear() : '';
  }
}
