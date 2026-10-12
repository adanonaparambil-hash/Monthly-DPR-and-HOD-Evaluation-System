import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import Swal, { SweetAlertIcon } from 'sweetalert2';
import { Api } from '../services/api';
import { SessionService } from '../services/session.service';
import { CraneLoaderComponent } from '../shared/crane-loader/crane-loader.component';

/** PKG_MENU_ADMIN.SP_GET_MENU_LIST row. */
export interface AdminMenu {
  menuId: number; menuName: string; menuUrl: string | null; parentId: number | null; parentName: string | null;
  menuOrder: number | null; icon: string | null; isActive: string | null; isExternal: string | null; duration: number | null;
  userCount: number; childCount: number; isSystem: string | null;
  createdBy?: string | null; createdDate?: string | null; updatedBy?: string | null; updatedDate?: string | null;
}
/** One editable access line for the "Access by user" tab. */
interface AccessLine {
  menuId: number; menuName: string; menuUrl: string | null; parentId: number | null; isActive: string | null;
  isExternal: string | null; has: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean;
}
interface MenuUser {
  userId: string; employeeName: string | null; department: string | null; designation: string | null; status: string | null;
  canAdd: string; canEdit: string; canDelete: string; grantedOn: string | null; grantedBy: string | null;
}
interface AuditRow {
  auditId: number; action: string; menuId: number | null; menuName: string | null; userId: string | null; userName: string | null;
  details: string | null; actor: string; actorName: string | null; actionOn: string;
}
interface Emp { idValue: string; description: string; }
type Tab = 'menus' | 'byUser' | 'byMenu' | 'activity';

/**
 * IT Admin → Menu Management.
 *
 * Manages TM_MENU_MASTER (menus) and TS_USER_MENU_ACCESS (who sees which menu) through
 * PKG_MENU_ADMIN. The server authorises every call from the token: whoever holds the
 * Menu Management menu may read; CAN_EDIT on it allows changes — this page only mirrors
 * that (canEdit hides the editing controls), it does not enforce it.
 *
 * Sidebar rules the screen keeps visible to the admin:
 *  - two levels: top-level menus and their sub-menus;
 *  - a sub-menu needs its parent granted (granting one adds the other — server side too);
 *  - access = a grant row; CAN_ADD is "admin", CAN_EDIT the external-link edit mode.
 */
@Component({
  selector: 'app-menu-management',
  standalone: true,
  imports: [CommonModule, FormsModule, CraneLoaderComponent],
  templateUrl: './menu-management.component.html',
  styleUrls: ['./menu-management.component.css']
})
export class MenuManagementComponent implements OnInit, OnDestroy {
  // rights
  state: 'loading' | 'ready' | 'denied' | 'error' = 'loading';
  canEdit = false;
  me = '';

  tab: Tab = 'menus';

  // ── menus ──
  menus: AdminMenu[] = [];
  menusLoading = false;
  menuQuery = '';
  showInactive = true;
  collapsed: Record<number, boolean> = {};
  form: any = null;               // drawer model; null = closed
  formError = '';
  saving = false;
  readonly ICONS = ['fa-chart-line', 'fa-chart-pie', 'fa-gauge-high', 'fa-sitemap', 'fa-user-shield', 'fa-file-invoice-dollar',
    'fa-clipboard-check', 'fa-briefcase', 'fa-building', 'fa-folder-open', 'fa-link', 'fa-gear', 'fa-users', 'fa-calendar-check',
    'fa-box-archive', 'fa-helmet-safety', 'fa-truck', 'fa-coins', 'fa-list-check', 'fa-layer-group'];

  // ── access by user ──
  employees: Emp[] = [];
  userPick: Emp | null = null;
  userQuery = '';
  userDdOpen = false;
  lines: AccessLine[] = [];
  private original = '';
  accessLoading = false;
  accessSaving = false;
  copyQuery = '';
  copyDdOpen = false;

  // ── access by menu ──
  menuPick: AdminMenu | null = null;
  menuUsers: MenuUser[] = [];
  menuUsersLoading = false;
  menuUserQuery = '';
  addQuery = '';
  addDdOpen = false;
  addList: Emp[] = [];
  addFlags = { canAdd: false, canEdit: false, canDelete: false };
  granting = false;
  busyUser = '';

  // ── activity ──
  audit: AuditRow[] = [];
  auditLoading = false;
  auditQuery = '';
  auditAction = 'ALL';

  private subs: Subscription[] = [];

  constructor(private api: Api, private session: SessionService, private toastr: ToastrService) {}

  ngOnInit(): void {
    const u = this.session.getCurrentUser() || {};
    this.me = (u.empId || u.employeeId || u.userId || '').toString().trim().toUpperCase();
    this.subs.push(this.api.menuAdminRights().subscribe({
      next: (res: any) => {
        const r = res?.data || {};
        if (!res?.success || r.canView !== 'Y') { this.state = 'denied'; return; }
        this.canEdit = r.canEdit === 'Y';
        this.state = 'ready';
        this.loadMenus();
        this.loadEmployees();
      },
      error: () => { this.state = 'error'; }
    }));
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  async setTab(t: Tab): Promise<void> {
    if (this.tab === 'byUser' && t !== 'byUser' && this.dirty && !(await this.confirmLeaveUnsaved())) { return; }
    this.tab = t;
    if (t === 'activity') { this.loadAudit(); }
  }

  // ── dialogs (SweetAlert2 — global z-index fix in styles.css keeps them on top) ──
  /** Yes/No dialog; resolves true only on the confirm button. */
  private async ask(o: { title: string; html: string; confirm: string; icon?: SweetAlertIcon; danger?: boolean }): Promise<boolean> {
    const res = await Swal.fire({
      title: o.title,
      html: o.html,
      icon: o.icon ?? (o.danger ? 'warning' : 'question'),
      showCancelButton: true,
      confirmButtonText: o.confirm,
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      focusCancel: !!o.danger,
      confirmButtonColor: o.danger ? '#dc2626' : '#0f6b50',
      cancelButtonColor: '#64748b',
      theme: this.swalTheme()
    });
    return res.isConfirmed;
  }
  private info(title: string, html: string): void {
    Swal.fire({ title, html, icon: 'info', confirmButtonText: 'OK', confirmButtonColor: '#0f6b50', theme: this.swalTheme() });
  }
  /** Follow the portal's own dark mode (a body class), not the OS setting. */
  private swalTheme(): 'dark' | 'light' { return document.body.classList.contains('dark-theme') ? 'dark' : 'light'; }
  /** Names go into the dialog as HTML — escape them. */
  private esc(v: unknown): string {
    return (v ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);
  }
  private confirmLeaveUnsaved(): Promise<boolean> {
    return this.ask({
      title: 'Unsaved changes',
      html: `You changed access for <b>${this.esc(this.tc(this.userPick?.description))}</b> but did not save.<br>Leave without saving?`,
      confirm: 'Leave without saving', icon: 'warning', danger: true
    });
  }

  // ═════════════ MENUS ═════════════
  loadMenus(): void {
    this.menusLoading = true;
    this.subs.push(this.api.menuAdminMenus().subscribe({
      next: (res: any) => {
        this.menus = res?.success && Array.isArray(res.data) ? res.data : [];
        if (!res?.success) { this.toastr.error(res?.message || 'Could not load menus.'); }
        this.menusLoading = false;
        if (this.menuPick) { this.menuPick = this.menus.find(m => m.menuId === this.menuPick!.menuId) || null; }
      },
      error: () => { this.menusLoading = false; this.toastr.error('Could not load menus.'); }
    }));
  }

  get roots(): AdminMenu[] { return this.menus.filter(m => m.parentId == null); }
  childrenOf(id: number): AdminMenu[] { return this.menus.filter(m => m.parentId === id); }

  /** Roots (with their visible children) after search + inactive filter. */
  get menuTree(): { root: AdminMenu; kids: AdminMenu[] }[] {
    const q = this.menuQuery.trim().toLowerCase();
    const hit = (m: AdminMenu) => !q || (m.menuName || '').toLowerCase().includes(q) || (m.menuUrl || '').toLowerCase().includes(q);
    const show = (m: AdminMenu) => this.showInactive || m.isActive === 'Y';
    return this.roots
      .map(root => {
        const kids = this.childrenOf(root.menuId).filter(k => show(k) && (hit(k) || hit(root)));
        return { root, kids };
      })
      .filter(g => show(g.root) && (hit(g.root) || g.kids.length));
  }

  get stats() {
    return {
      total: this.menus.length,
      groups: this.roots.filter(r => r.childCount > 0 || !r.menuUrl).length,
      external: this.menus.filter(m => this.kind(m) === 'external').length,
      inactive: this.menus.filter(m => m.isActive !== 'Y').length
    };
  }

  /** What the sidebar will actually do with this row (matches layout.isExternalMenu). */
  kind(m: { menuUrl: string | null; isExternal: string | null; childCount?: number }): 'group' | 'external' | 'internal' {
    const url = (m.menuUrl || '').trim();
    if (!url) { return 'group'; }
    return /^https?:\/\//i.test(url) && (m.isExternal || '').trim().toUpperCase() === 'Y' ? 'external' : 'internal';
  }
  kindLabel(k: string): string { return k === 'group' ? 'Group' : k === 'external' ? 'External link' : 'In-app page'; }
  iconOf(m: { icon: string | null; menuName: string }): string {
    const i = (m.icon || '').trim();
    return /^fa-[a-z0-9-]+$/.test(i) ? i : (this.kind(m as any) === 'group' ? 'fa-folder' : 'fa-link');
  }

  openNew(parent?: AdminMenu): void {
    if (!this.canEdit) { return; }
    this.formError = '';
    this.form = {
      menuId: null, menuName: '', menuUrl: '', parentId: parent ? parent.menuId : null, menuOrder: null,
      icon: '', isActive: true, isExternal: false, duration: 0
    };
  }
  openEdit(m: AdminMenu): void {
    this.formError = '';
    this.form = {
      menuId: m.menuId, menuName: m.menuName, menuUrl: m.menuUrl || '', parentId: m.parentId, menuOrder: m.menuOrder,
      icon: m.icon || '', isActive: m.isActive === 'Y', isExternal: (m.isExternal || '').trim() === 'Y', duration: m.duration || 0,
      _system: m.isSystem === 'Y', _children: m.childCount, _users: m.userCount
    };
  }
  closeForm(): void { this.form = null; }

  /** Parents a menu may sit under: top-level menus other than itself. */
  get parentOptions(): AdminMenu[] {
    return this.roots.filter(r => !this.form || r.menuId !== this.form.menuId);
  }
  get formKind(): string {
    return this.form ? this.kindLabel(this.kind({ menuUrl: this.form.menuUrl, isExternal: this.form.isExternal ? 'Y' : 'N' })) : '';
  }
  onUrlChange(): void {
    if (this.form && /^https?:\/\//i.test((this.form.menuUrl || '').trim())) { this.form.isExternal = true; }
  }

  saveMenu(): void {
    if (!this.form || this.saving) { return; }
    const f = this.form;
    if (!(f.menuName || '').trim()) { this.formError = 'Menu name is required.'; return; }
    this.saving = true;
    this.formError = '';
    this.subs.push(this.api.menuAdminSaveMenu({
      menuId: f.menuId, menuName: f.menuName.trim(), menuUrl: (f.menuUrl || '').trim() || null,
      parentId: f.parentId ?? null, menuOrder: f.menuOrder === '' || f.menuOrder == null ? null : Number(f.menuOrder),
      icon: (f.icon || '').trim() || null, isActive: f.isActive ? 'Y' : 'N', isExternal: f.isExternal ? 'Y' : 'N',
      duration: Number(f.duration) || 0
    }).subscribe({
      next: (res: any) => {
        this.saving = false;
        if (res?.success) {
          this.toastr.success(res.message || 'Saved');
          this.form = null;
          this.loadMenus();
        } else {
          this.formError = res?.message || 'Could not save the menu.';
        }
      },
      error: () => { this.saving = false; this.formError = 'Could not save the menu.'; }
    }));
  }

  toggleActive(m: AdminMenu): void {
    if (!this.canEdit || m.isSystem === 'Y') { return; }
    this.subs.push(this.api.menuAdminSaveMenu({
      menuId: m.menuId, menuName: m.menuName, menuUrl: m.menuUrl, parentId: m.parentId, menuOrder: m.menuOrder,
      icon: m.icon, isActive: m.isActive === 'Y' ? 'N' : 'Y', isExternal: (m.isExternal || '').trim() || 'N', duration: m.duration || 0
    }).subscribe({
      next: (res: any) => {
        if (res?.success) { this.toastr.success(m.isActive === 'Y' ? 'Menu hidden from everyone' : 'Menu active again'); this.loadMenus(); }
        else { this.toastr.error(res?.message || 'Could not change the menu.'); }
      },
      error: () => this.toastr.error('Could not change the menu.')
    }));
  }

  async deleteMenu(m: AdminMenu): Promise<void> {
    if (!this.canEdit || m.isSystem === 'Y') { return; }
    const name = `<b>${this.esc(m.menuName)}</b>`;
    if (m.childCount > 0) {
      this.info('Menu has sub-menus', `${name} has ${m.childCount} sub-menu(s).<br>Delete or move them first, or switch it off instead.`);
      return;
    }
    const ok = await this.ask({
      title: 'Delete this menu?',
      html: `${name} will be removed from the sidebar` +
            (m.userCount ? ` and <b>${m.userCount}</b> ${m.userCount === 1 ? 'person loses' : 'people lose'} it` : '') +
            '.<br><small>This cannot be undone — to hide it for now, switch it off instead.</small>',
      confirm: 'Delete menu', danger: true
    });
    if (!ok) { return; }
    this.subs.push(this.api.menuAdminDeleteMenu(m.menuId).subscribe({
      next: (res: any) => {
        if (res?.success) { this.toastr.success('Menu deleted'); this.loadMenus(); }
        else { this.toastr.error(res?.message || 'Could not delete the menu.'); }
      },
      error: () => this.toastr.error('Could not delete the menu.')
    }));
  }

  openUsersOf(m: AdminMenu): void { this.tab = 'byMenu'; this.pickMenu(m); }
  toggleGroup(id: number): void { this.collapsed[id] = !this.collapsed[id]; }

  // ═════════════ EMPLOYEES (pickers) ═════════════
  private loadEmployees(): void {
    this.subs.push(this.api.GetEmployeeListAll().subscribe({
      next: (res: any) => {
        const d = res?.data || res || [];
        this.employees = (Array.isArray(d) ? d : [])
          .map((e: any) => ({ idValue: (e.idValue || '').toString().trim().toUpperCase(), description: (e.description || '').toString().trim() }))
          .filter((e: Emp) => e.idValue);
      },
      error: () => { /* pickers stay empty */ }
    }));
  }
  matches(q: string, exclude?: Set<string>): Emp[] {
    const s = q.trim().toLowerCase();
    if (!s) { return []; }
    const words = s.split(/\s+/);
    return this.employees
      .filter(e => !exclude?.has(e.idValue) && words.every(w => (e.description + ' ' + e.idValue).toLowerCase().includes(w)))
      .slice(0, 30);
  }

  // ═════════════ ACCESS BY USER ═════════════
  async pickUser(e: Emp): Promise<void> {
    this.userDdOpen = false;
    if (this.dirty && !(await this.confirmLeaveUnsaved())) { return; }
    this.userPick = e;
    this.userQuery = '';
    this.userDdOpen = false;
    this.loadUserAccess(e.idValue, true);
  }

  private loadUserAccess(userId: string, asCurrent: boolean): void {
    this.accessLoading = true;
    this.subs.push(this.api.menuAdminUserAccess(userId).subscribe({
      next: (res: any) => {
        this.accessLoading = false;
        if (!res?.success) { this.toastr.error(res?.message || 'Could not load access.'); return; }
        const rows: AccessLine[] = (res.data || []).map((r: any) => ({
          menuId: r.menuId, menuName: r.menuName, menuUrl: r.menuUrl, parentId: r.parentId, isActive: r.isActive, isExternal: r.isExternal,
          has: r.hasAccess === 'Y', canAdd: r.canAdd === 'Y', canEdit: r.canEdit === 'Y', canDelete: r.canDelete === 'Y'
        }));
        if (asCurrent) {
          this.lines = rows;
          this.original = this.snapshot();
        } else {
          // "copy from": take the other person's set onto the current employee (unsaved)
          const by = new Map(rows.map(r => [r.menuId, r]));
          this.lines.forEach(l => {
            const s = by.get(l.menuId);
            l.has = !!s?.has; l.canAdd = !!s?.canAdd; l.canEdit = !!s?.canEdit; l.canDelete = !!s?.canDelete;
          });
          this.keepAdminSelf();
          this.toastr.info('Access copied — review and Save to apply.');
        }
      },
      error: () => { this.accessLoading = false; this.toastr.error('Could not load access.'); }
    }));
  }

  copyFrom(e: Emp): void {
    this.copyQuery = '';
    this.copyDdOpen = false;
    if (!this.userPick || e.idValue === this.userPick.idValue) { return; }
    this.loadUserAccess(e.idValue, false);
  }

  get rootLines(): AccessLine[] { return this.lines.filter(l => l.parentId == null); }
  kidLines(id: number): AccessLine[] { return this.lines.filter(l => l.parentId === id); }
  get grantedCount(): number { return this.lines.filter(l => l.has).length; }

  /** Toggling access keeps the tree valid: a child needs its parent; a parent takes its children with it. */
  toggleLine(l: AccessLine): void {
    if (!this.canEdit || this.isLockedSelf(l)) { return; }
    l.has = !l.has;
    if (!l.has) { l.canAdd = l.canEdit = l.canDelete = false; }
    if (l.has && l.parentId != null) {
      const p = this.lines.find(x => x.menuId === l.parentId);
      if (p) { p.has = true; }
    }
    if (!l.has && l.parentId == null) {
      this.kidLines(l.menuId).forEach(k => { k.has = false; k.canAdd = k.canEdit = k.canDelete = false; });
    }
  }
  toggleFlag(l: AccessLine, f: 'canAdd' | 'canEdit' | 'canDelete'): void {
    if (!this.canEdit || !l.has) { return; }
    l[f] = !l[f];
  }
  setGroup(root: AccessLine, on: boolean): void {
    if (!this.canEdit) { return; }
    root.has = on || this.isLockedSelf(root);
    this.kidLines(root.menuId).forEach(k => {
      if (this.isLockedSelf(k)) { return; }
      k.has = on;
      if (!on) { k.canAdd = k.canEdit = k.canDelete = false; }
    });
    if (!on) { root.canAdd = root.canEdit = root.canDelete = false; }
  }

  /** An admin cannot take Menu Management (or its group) away from themselves. */
  isLockedSelf(l: AccessLine): boolean {
    if (!this.userPick || this.userPick.idValue !== this.me) { return false; }
    const admin = this.lines.find(x => (x.menuUrl || '').trim().toLowerCase() === '/menu-management');
    return !!admin && (l.menuId === admin.menuId || l.menuId === admin.parentId);
  }
  private keepAdminSelf(): void { this.lines.filter(l => this.isLockedSelf(l)).forEach(l => (l.has = true)); }

  private snapshot(): string {
    return JSON.stringify(this.lines.filter(l => l.has).map(l => [l.menuId, l.canAdd, l.canEdit, l.canDelete]));
  }
  get dirty(): boolean { return !!this.userPick && this.snapshot() !== this.original; }
  resetAccess(): void { if (this.userPick) { this.loadUserAccess(this.userPick.idValue, true); } }

  saveAccess(): void {
    if (!this.userPick || this.accessSaving || !this.canEdit) { return; }
    this.accessSaving = true;
    const yn = (b: boolean) => (b ? 'Y' : 'N');
    this.subs.push(this.api.menuAdminSaveUserAccess({
      userId: this.userPick.idValue,
      access: this.lines.filter(l => l.has).map(l => ({ menuId: l.menuId, canAdd: yn(l.canAdd), canEdit: yn(l.canEdit), canDelete: yn(l.canDelete) }))
    }).subscribe({
      next: (res: any) => {
        this.accessSaving = false;
        if (res?.success) {
          this.toastr.success(res.message || 'Access saved');
          this.loadUserAccess(this.userPick!.idValue, true);
          this.loadMenus();
        } else {
          this.toastr.error(res?.message || 'Could not save access.');
        }
      },
      error: () => { this.accessSaving = false; this.toastr.error('Could not save access.'); }
    }));
  }

  // ═════════════ ACCESS BY MENU ═════════════
  pickMenu(m: AdminMenu | null): void {
    this.menuPick = m;
    this.menuUsers = [];
    this.addList = [];
    if (!m) { return; }
    this.loadMenuUsers();
  }
  pickMenuById(id: any): void { this.pickMenu(this.menus.find(m => m.menuId === Number(id)) || null); }

  loadMenuUsers(): void {
    if (!this.menuPick) { return; }
    this.menuUsersLoading = true;
    this.subs.push(this.api.menuAdminMenuUsers(this.menuPick.menuId).subscribe({
      next: (res: any) => {
        this.menuUsersLoading = false;
        this.menuUsers = res?.success && Array.isArray(res.data) ? res.data : [];
        if (!res?.success) { this.toastr.error(res?.message || 'Could not load users.'); }
      },
      error: () => { this.menuUsersLoading = false; this.toastr.error('Could not load users.'); }
    }));
  }

  get filteredMenuUsers(): MenuUser[] {
    const q = this.menuUserQuery.trim().toLowerCase();
    return q ? this.menuUsers.filter(u => [u.employeeName, u.userId, u.department, u.designation].join(' ').toLowerCase().includes(q)) : this.menuUsers;
  }
  get existingIds(): Set<string> { return new Set([...this.menuUsers.map(u => u.userId), ...this.addList.map(a => a.idValue)]); }

  queueAdd(e: Emp): void {
    if (!this.addList.some(a => a.idValue === e.idValue)) { this.addList = [...this.addList, e]; }
    this.addQuery = '';
    this.addDdOpen = false;
  }
  unqueue(e: Emp): void { this.addList = this.addList.filter(a => a.idValue !== e.idValue); }

  grantQueued(): void {
    if (!this.menuPick || !this.addList.length || this.granting || !this.canEdit) { return; }
    this.granting = true;
    const yn = (b: boolean) => (b ? 'Y' : 'N');
    this.subs.push(this.api.menuAdminGrantMenuUsers({
      menuId: this.menuPick.menuId, userIds: this.addList.map(a => a.idValue),
      canAdd: yn(this.addFlags.canAdd), canEdit: yn(this.addFlags.canEdit), canDelete: yn(this.addFlags.canDelete)
    }).subscribe({
      next: (res: any) => {
        this.granting = false;
        if (res?.success) {
          this.toastr.success(res.message || 'Access granted');
          this.addList = [];
          this.loadMenuUsers();
          this.loadMenus();
        } else { this.toastr.error(res?.message || 'Could not grant access.'); }
      },
      error: () => { this.granting = false; this.toastr.error('Could not grant access.'); }
    }));
  }

  /** Change one flag for one user — re-grants that user with the new flag set. */
  flipUserFlag(u: MenuUser, f: 'canAdd' | 'canEdit' | 'canDelete'): void {
    if (!this.menuPick || !this.canEdit || this.busyUser) { return; }
    const next = { canAdd: u.canAdd, canEdit: u.canEdit, canDelete: u.canDelete, [f]: u[f] === 'Y' ? 'N' : 'Y' };
    this.busyUser = u.userId;
    this.subs.push(this.api.menuAdminGrantMenuUsers({ menuId: this.menuPick.menuId, userIds: [u.userId], ...next }).subscribe({
      next: (res: any) => {
        this.busyUser = '';
        if (res?.success) { Object.assign(u, next); } else { this.toastr.error(res?.message || 'Could not change the permission.'); }
      },
      error: () => { this.busyUser = ''; this.toastr.error('Could not change the permission.'); }
    }));
  }

  async revoke(u: MenuUser): Promise<void> {
    if (!this.menuPick || !this.canEdit) { return; }
    const kids = this.menuPick.parentId == null && this.menuPick.childCount > 0
      ? ` and its <b>${this.menuPick.childCount}</b> sub-menu(s)` : '';
    const ok = await this.ask({
      title: 'Remove access?',
      html: `<b>${this.esc(this.tc(u.employeeName) || u.userId)}</b> <small>(${this.esc(u.userId)})</small><br>` +
            `will no longer see <b>${this.esc(this.menuPick.menuName)}</b>${kids} in the sidebar.`,
      confirm: 'Remove access', danger: true
    });
    if (!ok) { return; }
    this.busyUser = u.userId;
    this.subs.push(this.api.menuAdminRevokeMenuUser({ menuId: this.menuPick.menuId, userId: u.userId }).subscribe({
      next: (res: any) => {
        this.busyUser = '';
        if (res?.success) {
          this.menuUsers = this.menuUsers.filter(x => x.userId !== u.userId);
          this.toastr.success('Access removed');
          this.loadMenus();
        } else { this.toastr.error(res?.message || 'Could not remove access.'); }
      },
      error: () => { this.busyUser = ''; this.toastr.error('Could not remove access.'); }
    }));
  }

  // ═════════════ ACTIVITY ═════════════
  loadAudit(): void {
    this.auditLoading = true;
    this.subs.push(this.api.menuAdminAuditLog(500).subscribe({
      next: (res: any) => {
        this.auditLoading = false;
        this.audit = res?.success && Array.isArray(res.data) ? res.data : [];
      },
      error: () => { this.auditLoading = false; this.toastr.error('Could not load activity.'); }
    }));
  }
  get filteredAudit(): AuditRow[] {
    const q = this.auditQuery.trim().toLowerCase();
    return this.audit.filter(a =>
      (this.auditAction === 'ALL' || (this.auditAction === 'MENU' ? a.action.startsWith('MENU_') : a.action === this.auditAction)) &&
      (!q || [a.menuName, a.userId, a.userName, a.actor, a.actorName, a.details].join(' ').toLowerCase().includes(q)));
  }
  actionLabel(a: string): string {
    return ({ GRANT: 'Granted', UPDATE: 'Changed', REVOKE: 'Removed', MENU_CREATE: 'Menu created', MENU_UPDATE: 'Menu edited', MENU_DELETE: 'Menu deleted' } as any)[a] || a;
  }

  // ═════════════ shared ═════════════
  @HostListener('document:click')
  closeDropdowns(): void { this.userDdOpen = this.copyDdOpen = this.addDdOpen = false; }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.form) { this.closeForm(); }
    this.closeDropdowns();
  }

  @HostListener('window:beforeunload', ['$event'])
  onUnload(e: BeforeUnloadEvent): void { if (this.dirty) { e.preventDefault(); } }

  tc(v: string | null | undefined): string {
    return (v || '').toLowerCase().replace(/(^|[\s.'(/&-])\p{L}/gu, c => c.toUpperCase())
      .replace(/\b(It|Hr|Hod|Ced|Qa|Qc|Qs|Qaqc|Mep|Pmc|Dpr|Cad|Pmv|Fmt|Mis|Wir|Mir|Pm|Gm|Agm)\b/g, w => w.toUpperCase());
  }
  initials(n: string | null | undefined): string {
    const p = (n || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] || '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  private static readonly MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  fmtDate(v: string | null | undefined, withTime = false): string {
    const d = v ? new Date(v) : null;
    if (!d || isNaN(d.getTime())) { return ''; }
    const base = String(d.getDate()).padStart(2, '0') + ' ' + MenuManagementComponent.MON[d.getMonth()] + ' ' + d.getFullYear();
    if (!withTime) { return base; }
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
    return base + ', ' + (h % 12 || 12) + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  trackMenu = (_: number, m: { menuId: number }) => m.menuId;
}
