import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Api } from '../services/api';
import { AvatarUtil } from '../utils/avatar.util';

/** One row of General/GetEmployeeList (PKG_COMMON_LOOKUPS.SP_GET_EMPLOYEE_LIST). */
interface DirEmployee {
  empId: string;
  employeeName: string;
  department: string | null;
  designation: string | null;
  profileImageBase64: string | null;
  status: string | null;            // ACTIVE | LEAVE
  contactNumber: string | null;
  email: string | null;
  dateOfJoined: string | null;
}

/** Cards grouped under their first letter (the list comes sorted by name). */
interface LetterGroup { letter: string; items: DirEmployee[]; }

/** The work details shown in the profile panel (no date of birth, no home address). */
interface DirProfile {
  photo: string;
  phone: string; telephone: string; email: string;
  location: string; nationality: string; doj: string;
  qualification: string; skills: string[]; careerSummary: string;
  experienceInd: number | null; experienceAbroad: number | null;
}

/**
 * Employee Directory — every signed-in user can look colleagues up.
 * Same API as Employee Master (General/GetEmployeeList, read-only here); the profile
 * panel uses Login/GetEmployeeProfile. Location = the employee's country (COM_LOC).
 *
 * One scroll per API batch: the 500 rows of a batch scroll on one page. They are drawn
 * RENDER_STEP at a time as the user nears the end (keeps the page light), and after the
 * last one the user moves to the next / previous 500.
 */
@Component({
  selector: 'app-employee-directory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-directory.component.html',
  styleUrls: ['./employee-directory.component.css']
})
export class EmployeeDirectoryComponent implements OnInit, AfterViewInit, OnDestroy {
  // ── filters ───────────────────────────────────────────────────────────────
  filterEmpId = '';
  filterName = '';
  filterDepartment = '';
  filterLocation = '';
  departments: string[] = [];
  readonly locations = [
    { value: 'OM', label: 'Oman' },
    { value: 'UAE', label: 'UAE' },
    { value: 'KSA', label: 'Saudi Arabia' },
    { value: 'IND', label: 'India' }
  ];

  // ── data ──────────────────────────────────────────────────────────────────
  readonly BATCH_SIZE = 500;
  readonly RENDER_STEP = 60;
  batch: DirEmployee[] = [];
  batchNo = 1;
  hasMoreBatches = false;
  renderCount = 0;                   // how many of the batch are drawn so far
  groups: LetterGroup[] = [];        // the drawn cards, under letter headers
  state: 'loading' | 'ready' | 'error' = 'loading';

  // ── profile panel / card menu ─────────────────────────────────────────────
  selected: DirEmployee | null = null;
  profile: DirProfile | null = null;
  profileState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  menuFor: string | null = null;
  copied: string | null = null;
  showTopBtn = false;

  // ── filter dropdowns (department / location) ──────────────────────────────
  openDd: 'dept' | 'loc' | null = null;
  ddQuery = '';

  readonly skeletons = Array.from({ length: 9 });
  private typing$ = new Subject<void>();
  private subs: Subscription[] = [];
  private loadSub?: Subscription;
  private profileSub?: Subscription;
  private moreObserver?: IntersectionObserver;
  private topObserver?: IntersectionObserver;

  @ViewChild('topMark') topMark?: ElementRef<HTMLElement>;
  @ViewChild('moreMark') set moreMark(el: ElementRef<HTMLElement> | undefined) {
    // the "draw more" marker comes and goes with the list — (re)attach the observer
    this.moreObserver?.disconnect();
    this.moreEl = el?.nativeElement;
    if (el && typeof IntersectionObserver !== 'undefined') {
      this.moreObserver = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
          this.zone.run(() => this.renderMore());
          // still in view after drawing (tall screen)? observe again so it fires once more
          setTimeout(() => { if (this.moreEl && this.moreObserver) { this.moreObserver.unobserve(this.moreEl); this.moreObserver.observe(this.moreEl); } }, 50);
        }
      }, { rootMargin: '600px 0px' });
      this.moreObserver.observe(el.nativeElement);
    }
  }
  private moreEl?: HTMLElement;

  constructor(private api: Api, private zone: NgZone, private host: ElementRef<HTMLElement>) { }

  ngOnInit(): void {
    this.subs.push(this.typing$.pipe(debounceTime(450)).subscribe(() => this.search()));
    this.subs.push(this.api.GetDepartmentList().subscribe({
      next: (res: any) => {
        const raw: any[] = Array.isArray(res?.data) ? res.data : [];
        this.departments = [...new Set(raw.map(d => (d.deptName || d.description || '').toString().trim()).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b));
      },
      error: () => { /* the filter just stays empty */ }
    }));
    this.fetch(1);
  }

  ngAfterViewInit(): void {
    // back-to-top button: shown once the top of the page has scrolled away
    if (this.topMark && typeof IntersectionObserver !== 'undefined') {
      this.topObserver = new IntersectionObserver(entries => {
        const away = !entries[0].isIntersecting;
        if (away !== this.showTopBtn) { this.zone.run(() => (this.showTopBtn = away)); }
      });
      this.topObserver.observe(this.topMark.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.loadSub?.unsubscribe();
    this.profileSub?.unsubscribe();
    this.moreObserver?.disconnect();
    this.topObserver?.disconnect();
    document.body.style.overflow = '';
  }

  // ── loading ───────────────────────────────────────────────────────────────
  private fetch(batchNo: number): void {
    this.state = 'loading';
    this.loadSub?.unsubscribe();
    this.loadSub = this.api.getEmployeeList(
      this.filterEmpId.trim(), this.filterName.trim(), this.filterDepartment, '', this.filterLocation, '',
      batchNo, this.BATCH_SIZE
    ).subscribe({
      next: (res: any) => {
        this.batch = Array.isArray(res?.data) ? res.data : [];
        this.batchNo = batchNo;
        this.hasMoreBatches = this.batch.length === this.BATCH_SIZE;
        this.renderCount = 0;
        this.renderMore();
        this.state = 'ready';
      },
      error: () => { this.batch = []; this.groups = []; this.state = 'error'; }
    });
  }

  /** Draw the next RENDER_STEP cards of the batch (called as the end of the list nears). */
  renderMore(): void {
    if (this.renderCount >= this.batch.length) { return; }
    this.renderCount = Math.min(this.batch.length, this.renderCount + this.RENDER_STEP);
    const groups: LetterGroup[] = [];
    for (const e of this.batch.slice(0, this.renderCount)) {
      const ch = (e.employeeName || '').trim().charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(ch) ? ch : '#';
      const last = groups[groups.length - 1];
      if (last && last.letter === letter) { last.items.push(e); } else { groups.push({ letter, items: [e] }); }
    }
    this.groups = groups;
  }
  get allRendered(): boolean { return this.renderCount >= this.batch.length; }

  search(): void { this.fetch(1); this.toTop(); }
  onType(): void { this.typing$.next(); }
  clearFilters(): void {
    this.filterEmpId = this.filterName = this.filterDepartment = this.filterLocation = '';
    this.search();
  }
  get hasFilters(): boolean { return !!(this.filterEmpId || this.filterName || this.filterDepartment || this.filterLocation); }

  get rangeFrom(): number { return this.batch.length ? (this.batchNo - 1) * this.BATCH_SIZE + 1 : 0; }
  get rangeTo(): number { return this.batch.length ? this.rangeFrom + this.batch.length - 1 : 0; }
  /** Exact total once the last batch is in (the API returns no count); null while more batches exist. */
  get knownTotal(): number | null { return this.hasMoreBatches ? null : (this.batchNo - 1) * this.BATCH_SIZE + this.batch.length; }

  nextBatch(): void { if (this.hasMoreBatches) { this.fetch(this.batchNo + 1); this.toTop(); } }
  prevBatch(): void { if (this.batchNo > 1) { this.fetch(this.batchNo - 1); this.toTop(); } }
  toTop(): void { this.topMark?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  trackEmp = (_: number, e: DirEmployee) => e.empId;
  trackGroup = (_: number, g: LetterGroup) => g.letter + g.items[0]?.empId;

  // ── labels ────────────────────────────────────────────────────────────────
  photo(e: DirEmployee): string | null {
    return e.profileImageBase64 ? AvatarUtil.processProfileImage(e.profileImageBase64) : null;
  }
  initials(name: string): string {
    const p = (name || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
  }
  tc(v: string | null | undefined): string {
    return (v || '').toLowerCase().replace(/(^|[\s.'(/&-])\p{L}/gu, c => c.toUpperCase())
      .replace(/\b(It|Hr|Hod|Ced|Qa|Qc|Qs|Qaqc|Mep|Pmc|Dpr|Cad|Pmv|Llc|Erp|Hse|Ceo|Cfo|Coo|Ac|Mis|Bim|Gm|Agm|Pm|Pro)\b/g, w => w.toUpperCase());
  }
  private hash(key: string): number {
    let n = 0;
    for (const ch of key || '') { n = (n * 31 + ch.charCodeAt(0)) >>> 0; }
    return n;
  }
  private static readonly AV = [
    'linear-gradient(135deg,#1B2A38,#334155)', 'linear-gradient(135deg,#0ea5e9,#2563eb)', 'linear-gradient(135deg,#f59e0b,#d97706)',
    'linear-gradient(135deg,#7c3aed,#4f46e5)', 'linear-gradient(135deg,#10b981,#0f766e)', 'linear-gradient(135deg,#ec4899,#be185d)'
  ];
  avatarBg(e: DirEmployee): string { return EmployeeDirectoryComponent.AV[this.hash(e.empId) % EmployeeDirectoryComponent.AV.length]; }
  /** Department tone (chip + card accent), stable per department. */
  deptTone(dept: string | null): string { return 't' + (this.hash((dept || '').toUpperCase()) % 6); }
  isOnLeave(e: DirEmployee): boolean { return (e.status || '').trim().toUpperCase() === 'LEAVE'; }
  locationLabel(code: string): string { return this.locations.find(l => l.value === code)?.label ?? code; }
  private static readonly MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /** "07-May-2023" (fixed three-letter months — the browser's short month is "Sept" in en-GB). */
  fmtDate(v: string | null | undefined): string {
    if (!v) { return ''; }
    const d = new Date(v);
    if (isNaN(d.getTime())) { return ''; }
    return String(d.getDate()).padStart(2, '0') + '-' + EmployeeDirectoryComponent.MON[d.getMonth()] + '-' + d.getFullYear();
  }
  serviceText(v: string | null | undefined): string {
    const d = v ? new Date(v) : null;
    if (!d || isNaN(d.getTime())) { return ''; }
    const now = new Date();
    let m = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
    if (now.getDate() < d.getDate()) { m--; }
    if (m < 0) { return ''; }
    const y = Math.floor(m / 12), r = m % 12;
    return [y ? y + (y === 1 ? ' yr' : ' yrs') : '', r ? r + (r === 1 ? ' mo' : ' mos') : ''].filter(Boolean).join(' ') || 'New joiner';
  }
  tel(v: string | null | undefined): string { return 'tel:' + (v || '').replace(/[^\d+]/g, ''); }
  /** The phone, or '' when the record only holds a placeholder such as "+968-" (fewer than 7 digits). */
  phone(v: string | null | undefined): string {
    const s = (v || '').trim();
    return s.replace(/\D/g, '').length >= 7 ? s : '';
  }

  // ── filter dropdowns ──────────────────────────────────────────────────────
  toggleDd(which: 'dept' | 'loc', ev: Event): void {
    ev.stopPropagation();
    this.menuFor = null;
    this.openDd = this.openDd === which ? null : which;
    this.ddQuery = '';
    if (this.openDd === 'dept') {
      setTimeout(() => (this.host.nativeElement.querySelector('.ed-dd-search input') as HTMLInputElement | null)?.focus());
    }
  }
  get deptMatches(): string[] {
    const q = this.ddQuery.trim().toLowerCase();
    return q ? this.departments.filter(d => d.toLowerCase().includes(q)) : this.departments;
  }
  pickDept(d: string, ev?: Event): void {
    ev?.stopPropagation();
    this.openDd = null;
    if (d !== this.filterDepartment) { this.filterDepartment = d; this.search(); }
  }
  pickLoc(v: string, ev?: Event): void {
    ev?.stopPropagation();
    this.openDd = null;
    if (v !== this.filterLocation) { this.filterLocation = v; this.search(); }
  }

  // ── card menu ─────────────────────────────────────────────────────────────
  toggleMenu(e: DirEmployee, ev: Event): void {
    ev.stopPropagation();
    this.menuFor = this.menuFor === e.empId ? null : e.empId;
  }
  copy(text: string | null | undefined, what: string, ev?: Event): void {
    ev?.stopPropagation();
    this.menuFor = null;
    if (!text) { return; }
    navigator.clipboard?.writeText(text).then(() => {
      this.copied = what;
      setTimeout(() => { if (this.copied === what) { this.copied = null; } }, 1800);
    }).catch(() => { /* clipboard not allowed — nothing to do */ });
  }
  @HostListener('document:click')
  onDocClick(): void { this.menuFor = null; this.openDd = null; }

  // ── profile panel ─────────────────────────────────────────────────────────
  openProfile(e: DirEmployee): void {
    this.menuFor = null;
    this.selected = e;
    this.profile = null;
    this.profileState = 'loading';
    document.body.style.overflow = 'hidden';
    this.profileSub?.unsubscribe();
    this.profileSub = this.api.GetEmployeeProfile(e.empId).subscribe({
      next: (res: any) => {
        const p = res?.success !== false ? res?.data : null;
        if (!p) { this.profileState = 'error'; return; }
        const s = (v: unknown) => (v ?? '').toString().trim();
        this.profile = {
          photo: s(p.profileImageBase64) ? AvatarUtil.processProfileImage(p.profileImageBase64) : (this.photo(e) || ''),
          phone: this.phone(s(p.phone)) || this.phone(e.contactNumber), telephone: this.phone(s(p.telephone)), email: s(p.email) || s(e.email),
          location: s(p.location), nationality: s(p.nation), doj: s(p.doj) || s(e.dateOfJoined),
          qualification: s(p.qualification),
          skills: s(p.skillset).split(/[,;\n]+/).map(x => x.trim()).filter(Boolean),
          careerSummary: s(p.careerSummary),
          experienceInd: p.experienceInd ?? null, experienceAbroad: p.experienceAbroad ?? null
        };
        this.profileState = 'ready';
      },
      error: () => { this.profileState = 'error'; }
    });
  }
  closeProfile(): void {
    this.selected = null;
    this.profile = null;
    this.profileState = 'idle';
    document.body.style.overflow = '';
  }
  @HostListener('document:keydown.escape')
  onEsc(): void { if (this.selected) { this.closeProfile(); } this.menuFor = null; this.openDd = null; }
  photoFailed(): void { if (this.profile) { this.profile = { ...this.profile, photo: '' }; } }
}
