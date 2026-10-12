import { AfterViewInit, Component, ElementRef, HostBinding, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Api } from '../../services/api';
import { AvatarUtil } from '../../utils/avatar.util';

/** One row of General/GetNewJoiners (PKG_COMMON_LOOKUPS.SP_GET_NEW_JOINERS). */
export interface NewJoiner {
  empId: string;
  employeeName: string;
  department: string | null;
  designation: string | null;
  empCategory: string | null;
  comLoc: string | null;
  dateOfJoined: string | null;
  email: string | null;
  contactNumber: string | null;
  profileImageBase64: string | null;
  isMyDept: string | null;
}

type Tab = 'all' | 'mine';

/**
 * "Welcome our new colleagues" — staff who joined last month (workers and labour are
 * left out by the procedure), shown on the employee dashboard as one compact strip:
 * an overlapping row of faces + "Meet them". The full profile cards live in the
 * panel that opens on click; a face opens that person's profile directly.
 *
 * Self-contained: loads its own data and renders nothing until there is at least one
 * joiner, so an empty month or a failed call leaves the dashboard unchanged.
 * The popup and the "Meet them" panel are moved to <body> after the first render: a host
 * page can otherwise trap them under the portal header (ced-dpr-analytics' .ca-page uses
 * isolation:isolate, so no z-index inside it can rise above the header).
 */
@Component({
  selector: 'app-new-joiners-card',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet],
  templateUrl: './new-joiners-card.component.html',
  styleUrls: ['./new-joiners-card.component.css']
})
export class NewJoinersCardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('overlays') overlays?: ElementRef<HTMLElement>;

  /** Faces in the strip; phones show the first STACK_SM (CSS hides the rest). */
  readonly STACK_MAX = 9;
  readonly STACK_SM = 5;

  joiners: NewJoiner[] = [];
  month = '';
  loaded = false;

  selected: NewJoiner | null = null;
  drawerOpen = false;
  drawerTab: Tab = 'all';
  query = '';
  copied = '';

  private sub?: Subscription;
  private lastFocus: HTMLElement | null = null;
  private static readonly MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  private static readonly MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];
  private static readonly LOC: Record<string, string> = { OM: 'Oman', UAE: 'UAE', KSA: 'Saudi Arabia', IND: 'India' };
  private static readonly AV = ['#059669', '#0284c7', '#7c3aed', '#d97706', '#e11d48', '#4f46e5', '#0d9488', '#c2410c'];

  constructor(private api: Api) {}

  ngOnInit(): void {
    this.sub = this.api.getNewJoiners().subscribe({
      next: (res: any) => {
        const d = res?.data ?? {};
        this.joiners = Array.isArray(d.joiners) ? d.joiners : [];
        this.month = d.month || '';
        this.loaded = true;
      },
      // non-critical: on failure the card simply stays hidden
      error: () => { this.joiners = []; this.loaded = true; }
    });
  }

  ngAfterViewInit(): void {
    const el = this.overlays?.nativeElement;
    if (el) { document.body.appendChild(el); }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.overlays?.nativeElement.remove();   // it lives under <body>, not inside the host
    document.body.style.overflow = '';
  }

  // ── lists ─────────────────────────────────────────────────────────────────
  /** ThemeService toggles .dark-theme on <body>; the moved overlays read it from there. */
  get dark(): boolean { return document.body.classList.contains('dark-theme'); }
  get visible(): boolean { return this.loaded && this.joiners.length > 0; }
  /** No box at all while loading / empty, so the dashboard's flex gap doesn't leave a hole. */
  @HostBinding('style.display') get hostDisplay(): string { return this.visible ? 'block' : 'none'; }
  get mineCount(): number { return this.joiners.filter(j => j.isMyDept === 'Y').length; }
  listFor(tab: Tab): NewJoiner[] { return tab === 'mine' ? this.joiners.filter(j => j.isMyDept === 'Y') : this.joiners; }
  get stack(): NewJoiner[] { return this.joiners.slice(0, this.STACK_MAX); }
  get restLg(): number { return Math.max(this.joiners.length - this.STACK_MAX, 0); }
  get restSm(): number { return Math.max(this.joiners.length - this.STACK_SM, 0); }
  /** "Thanigaivel, Eliyaziya and 46 others" — first names of the two newest. */
  get namesLine(): string {
    const first = (j: NewJoiner) => this.tc((j.employeeName || '').trim().split(/\s+/)[0]);
    const n = this.joiners.length;
    if (n === 1) { return this.tc(this.joiners[0].employeeName); }
    if (n === 2) { return first(this.joiners[0]) + ' and ' + first(this.joiners[1]); }
    return first(this.joiners[0]) + ', ' + first(this.joiners[1]) + ' and ' + (n - 2) + ' others';
  }
  get drawerList(): NewJoiner[] {
    const words = this.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return this.listFor(this.drawerTab).filter(j => {
      const hay = [j.employeeName, j.empId, j.designation, j.department].join(' ').toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }

  /** Bound picker handed to the tabs template. */
  readonly setDrawerTabFn = (t: Tab) => { this.drawerTab = t; };

  // ── popup / drawer ────────────────────────────────────────────────────────
  open(j: NewJoiner): void {
    this.lastFocus = document.activeElement as HTMLElement | null;
    this.selected = j;
    this.copied = '';
    this.lockScroll();
    setTimeout(() => (this.overlays?.nativeElement.querySelector('.nj-modal .nj-x') as HTMLElement | null)?.focus());
  }
  closeProfile(): void {
    this.selected = null;
    if (!this.drawerOpen) { this.unlockScroll(); }
    this.lastFocus?.focus?.();
  }
  openDrawer(tab: Tab = 'all'): void {
    this.drawerTab = tab;
    this.query = '';
    this.drawerOpen = true;
    this.lockScroll();
    setTimeout(() => (this.overlays?.nativeElement.querySelector('.nj-search input') as HTMLInputElement | null)?.focus(), 250);
  }
  closeDrawer(): void { this.drawerOpen = false; this.unlockScroll(); }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.selected) { this.closeProfile(); } else if (this.drawerOpen) { this.closeDrawer(); }
  }

  copy(value: string): void {
    navigator.clipboard?.writeText(value).then(() => {
      this.copied = value;
      setTimeout(() => { if (this.copied === value) { this.copied = ''; } }, 1400);
    }).catch(() => { /* clipboard blocked — nothing to do */ });
  }

  private lockScroll(): void { document.body.style.overflow = 'hidden'; }
  private unlockScroll(): void { document.body.style.overflow = ''; }

  // ── labels ────────────────────────────────────────────────────────────────
  get monthLabel(): string {
    const m = /^(\d{4})-(\d{2})$/.exec(this.month);
    return m ? NewJoinersCardComponent.MONTH[+m[2] - 1] + ' ' + m[1] : 'Last month';
  }
  photo(j: NewJoiner): string | null {
    return j.profileImageBase64 ? AvatarUtil.processProfileImage(j.profileImageBase64) : null;
  }
  initials(name: string): string {
    const p = (name || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
  }
  avatarBg(j: NewJoiner): string {
    let n = 0;
    for (const ch of j.empId || '') { n = (n * 31 + ch.charCodeAt(0)) >>> 0; }
    return NewJoinersCardComponent.AV[n % NewJoinersCardComponent.AV.length];
  }
  /** Title case that keeps short department codes upper-case (QS, PMV, MEP, HR…). */
  tc(v: string | null | undefined): string {
    return (v || '').toLowerCase().replace(/(^|[\s.'(/&-])\p{L}/gu, c => c.toUpperCase())
      .replace(/\b(It|Hr|Hod|Ced|Qa|Qc|Qs|Qaqc|Mep|Pmc|Dpr|Cad|Pmv|Fmt|Llc|Erp|Hse|Ceo|Cfo|Coo|Ac|Mis|Bim|Gm|Agm|Pm|Pro|Sr)\b/g,
        w => w.toUpperCase());
  }
  location(code: string | null): string { return NewJoinersCardComponent.LOC[(code || '').toUpperCase()] ?? (code || ''); }
  /** "30 Sep 2026" — fixed month names (en-GB short month would print "Sept"). */
  fmtDate(v: string | null): string {
    const d = v ? new Date(v) : null;
    if (!d || isNaN(d.getTime())) { return ''; }
    return d.getDate() + ' ' + NewJoinersCardComponent.MON[d.getMonth()] + ' ' + d.getFullYear();
  }
  /** Days since joining: "Day 7"; "Today" on the joining day. */
  dayText(v: string | null): string {
    const d = v ? new Date(v) : null;
    if (!d || isNaN(d.getTime())) { return ''; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const n = Math.round((today.getTime() - start.getTime()) / 86400000);
    return n <= 0 ? 'Today' : 'Day ' + n;
  }
  /** The phone, or '' when the record only holds a placeholder such as "+968-". */
  phone(v: string | null | undefined): string {
    const s = (v || '').trim();
    return s.replace(/\D/g, '').length >= 7 ? s : '';
  }
  tel(v: string): string { return 'tel:' + v.replace(/[^\d+]/g, ''); }
}
