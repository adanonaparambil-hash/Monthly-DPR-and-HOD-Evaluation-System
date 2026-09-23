import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Api } from '../services/api';
import { DropdownOption } from '../models/common.model';
import {
  FlowConfigType, FlowConfigLevel, FlowConfigApprover, FlowConfigRole,
  SaveFlowConfigRequest
} from '../models/employeeExit.model';

/**
 * HOD-only approval-flow configuration modal for the exit form.
 *
 * Deliberately its OWN component rather than more code inside
 * emergency-exit-form.component.ts — that file is already ~4,400 lines and is a
 * form, not an admin screen. The exit form only hosts this and passes `open`.
 *
 * Reads GetFlowConfig and writes SaveFlowConfig — the two endpoints over
 * PKG_EXITFORM.SP_GET_EXIT_FLOW_CONFIG_HOD / SP_SAVE_EXIT_FLOW_CONFIG. Those
 * procedures perform NO access check of their own, so who may open this screen
 * is decided by the parent that renders it. Nothing here touches the exit
 * form's own validation or save path.
 *
 * Employee types come from TM_EMP_TYPE_MASTER and are CREATE-ONLY: a type is
 * joined by value from two other tables, so editing one would have to cascade.
 */

/** One TM_EMP_EXIT_APPROVAL_FLOW_MASTER row, as the config cursor returns it. */
export type FlowLevelRow = FlowConfigLevel;

/** One TM_EMP_EXIT_DEPARTMENT_PERSONS row, as the config cursor returns it. */
export type FlowApproverRow = FlowConfigApprover;

@Component({
  selector: 'app-exit-approval-flow-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './exit-approval-flow-config.component.html',
  styleUrls: ['./exit-approval-flow-config.component.css']
})
export class ExitApprovalFlowConfigComponent implements OnChanges {

  /** Parent controls visibility; the modal renders nothing when false. */
  @Input() open = false;
  /** Employee list for the approver picker — reuses the form's existing list. */
  @Input() employeeList: DropdownOption[] = [];
  /** Module being configured: 'E' exit, 'R' rejoining, 'B' byod. */
  @Input() formType = 'E';
  /** Emitted on close. `true` = something was saved, so the parent should reload. */
  @Output() closed = new EventEmitter<boolean>();

  loading = false;
  loadError: string | null = null;
  dirty = false;                       // did any write succeed this session?

  /** TM_EMP_TYPE_MASTER rows — the authoritative type list. */
  typeRows: FlowConfigType[] = [];
  levels: FlowLevelRow[] = [];
  approvers: FlowApproverRow[] = [];
  /** Role codes already in use, for the role dropdown. */
  roleRows: FlowConfigRole[] = [];

  /** Roles whose person comes from the FORM, never from the config. */
  /**
   * Roles whose person comes from the FORM, never from this configuration.
   * The filer picks them per request, so there is nobody to assign here:
   * no "+" button, no "nobody assigned" warning, and they are kept out of the
   * role dropdown when adding an approver.
   *
   * Staff / Omani : HOD, PROJECT_MANAGER, HANDOVER
   * Worker        : SITE_ADMIN, SITE_INCHARGE, CAMBOSS
   *
   * These match the roles SP_CREATE_EXIT_APPROVAL_FLOW fills from its own
   * parameters rather than from TM_EMP_EXIT_DEPARTMENT_PERSONS.
   */
  readonly FORM_ROLES = [
    'HOD', 'PROJECT_MANAGER', 'HANDOVER',
    'SITE_ADMIN', 'SITE_INCHARGE', 'CAMBOSS'
  ];

  activeTab: 'levels' | 'approvers' = 'levels';
  selectedType = '';
  newTypeName = '';
  showNewType = false;

  // add/edit buffers
  showLevelForm = false;
  levelForm: FlowLevelRow = this.blankLevel();
  showApproverForm = false;
  approverForm: FlowApproverRow = this.blankApprover();
  approverSearch = '';

  constructor(private api: Api, private toastr: ToastrService, private cdr: ChangeDetectorRef) {}

  ngOnChanges(ch: SimpleChanges): void {
    // load only when it becomes visible, so opening is the trigger
    if (ch['open'] && this.open) {
      this.dirty = false;
      this.load();
    }
    // employeeList arrives from the parent after load — rebuild the picker
    if (ch['employeeList']) {
      this.rebuildFilteredEmployees();
    }
  }

  // ── data ────────────────────────────────────────────────────────────────
  /**
   * @param silent re-sync after a write — keep the panel on screen instead of
   *        flipping to the loading state, and leave an error toast to the writer.
   */
  load(silent = false): void {
    if (!silent) { this.loading = true; this.loadError = null; }
    this.api.GetFlowConfig(this.formType).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res?.success === false) {
          if (!silent) { this.loadError = res?.message || 'Could not load the flow configuration'; }
          return;
        }
        // cursor order: types, levels, approvers, roles
        this.typeRows = res?.data?.types ?? [];
        this.levels = res?.data?.levels ?? [];
        this.approvers = res?.data?.approvers ?? [];
        this.roleRows = res?.data?.roles ?? [];
        // rebuild cached derived fields BEFORE checking selectedType so that
        // this.types is up-to-date when the membership check runs below
        this.rebuildDerived();
        // a type that was just created has no rows yet, so keep the selection
        // if it still exists rather than snapping back to the first one
        if (!this.selectedType || !this.types.includes(this.selectedType)) {
          this.selectedType = this.types[0] || '';
          // selectedType changed — groupedApprovers depends on it
          this.rebuildDerived();
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        if (silent) { return; }
        const msg = typeof err?.error?.message === 'string' ? err.error.message.trim() : '';
        this.loadError = msg || 'Could not load the flow configuration';
        this.cdr.detectChanges();
      }
    });
  }

  // ── derived ─────────────────────────────────────────────────────────────
  private up(v: any): string { return (v ?? '').toString().trim().toUpperCase(); }

  /**
   * CACHED FIELDS — not getters.
   *
   * `types`, `groupedApprovers`, and `filteredEmployees` were plain getters
   * that rebuilt arrays/maps on every change-detection pass and returned new
   * references each time. Angular's *ngFor sees a new reference → schedules
   * another pass → getter runs again → infinite loop → browser hang.
   *
   * The fix is the same pattern already applied to `previewFlowSteps` in the
   * parent form: store the result in a field and rebuild it only when the
   * underlying data actually changes. Template binds to the field, not the
   * getter.
   */

  /** Sorted unique type codes. Rebuilt by rebuildDerived(). */
  types: string[] = [];

  /** Approvers tab grouped by role. Rebuilt by rebuildDerived(). */
  groupedApprovers: { role: string; isForm: boolean; people: FlowApproverRow[] }[] = [];

  /** Employee picker list, filtered by approverSearch. Rebuilt by rebuildFilteredEmployees(). */
  filteredEmployees: DropdownOption[] = [];

  /**
   * Rebuilds `types` and `groupedApprovers` from the raw data arrays.
   * Call after any mutation that changes typeRows / levels / approvers,
   * or when selectedType changes.
   */
  private rebuildDerived(): void {
    // ── types ──────────────────────────────────────────────────────────────
    const s = new Set<string>();
    this.typeRows.forEach(t => { const c = this.up(t.typeCode); if (c) { s.add(c); } });
    this.levels.forEach(l => { const t = this.up(l.empType) || 'DEFAULT'; s.add(t); });
    this.approvers.forEach(a => { const t = this.up(a.empType) || 'DEFAULT'; s.add(t); });
    this.types = [...s].sort((a, b) =>
      (a === 'DEFAULT' ? 1 : b === 'DEFAULT' ? -1 : a.localeCompare(b)));

    // ── groupedApprovers ───────────────────────────────────────────────────
    const map = new Map<string, { role: string; isForm: boolean; people: FlowApproverRow[] }>();
    const ensure = (role: string) => {
      const key = this.up(role);
      let g = map.get(key);
      if (!g) {
        g = { role: (role || '').trim(), isForm: this.isFormRole(role), people: [] };
        map.set(key, g);
      }
      return g;
    };

    this.selectedLevels
      .filter(l => this.up(l.isActive) !== 'N')
      .forEach(l => { if ((l.roleCode || '').trim()) { ensure(l.roleCode!); } });

    this.selectedApprovers.forEach(a => {
      if (!(a.roleCode || '').trim()) { return; }
      const g = ensure(a.roleCode!);
      if ((a.employeeId || '').toString().trim()) { g.people.push(a); }
    });

    this.groupedApprovers = [...map.values()]
      .map(g => ({
        ...g,
        people: g.people.slice().sort((x, y) =>
          (this.up(y.isHead) === 'Y' ? 1 : 0) - (this.up(x.isHead) === 'Y' ? 1 : 0) ||
          (x.employeeName || '').localeCompare(y.employeeName || ''))
      }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }

  /**
   * Rebuilds `filteredEmployees` from the current employeeList and approverSearch.
   * Call whenever approverSearch changes or employeeList is refreshed.
   */
  rebuildFilteredEmployees(): void {
    const t = (this.approverSearch || '').trim().toLowerCase();
    const list = this.employeeList || [];
    if (!t) {
      this.filteredEmployees = list.slice(0, 60);
    } else {
      this.filteredEmployees = list.filter(e =>
        (e.description || '').toLowerCase().includes(t) ||
        (e.idValue || '').toLowerCase().includes(t)).slice(0, 60);
    }
  }


  /** The master row for a type code, when it has one. */
  typeRow(code: string): FlowConfigType | undefined {
    return this.typeRows.find(t => this.up(t.typeCode) === this.up(code));
  }

  /**
   * Display name for a type. TYPE_NAME is often stored as the code itself
   * (STAFF, OMANI_DRIVER), which reads as shouting in a sidebar, so a name
   * that is just the code gets title-cased for display. A name the user
   * actually typed is shown exactly as they typed it.
   */
  typeLabel(code: string): string {
    const row = this.typeRow(code);
    const name = (row?.typeName || '').trim();
    const raw = name || (code || '').trim();
    if (!raw) { return ''; }

    // only prettify when it looks like a code: ALL CAPS with no lowercase
    if (raw === raw.toUpperCase()) {
      return raw.split(/[_\s]+/).filter(Boolean)
        .map(w => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ');
    }
    return raw;
  }

  /** 'Y' when the type exists in TM_EMP_TYPE_MASTER and is active. */
  isTypeRegistered(code: string): boolean {
    const r = this.typeRow(code);
    return !!r && this.up(r.isActive) !== 'N';
  }

  levelsFor(type: string): FlowLevelRow[] {
    return this.levels
      .filter(l => (this.up(l.empType) || 'DEFAULT') === this.up(type))
      .slice()
      .sort((a, b) => Number(a.approvalLevel ?? 0) - Number(b.approvalLevel ?? 0));
  }

  approversFor(type: string): FlowApproverRow[] {
    return this.approvers
      .filter(a => (this.up(a.empType) || 'DEFAULT') === this.up(type))
      .slice()
      .sort((a, b) => (a.roleCode || '').localeCompare(b.roleCode || '')
                       || (this.up(b.isHead) === 'Y' ? 1 : -1));
  }

  get selectedLevels(): FlowLevelRow[] { return this.levelsFor(this.selectedType); }
  get selectedApprovers(): FlowApproverRow[] { return this.approversFor(this.selectedType); }

  activeLevelCount(type: string): number {
    return this.levelsFor(type).filter(l => this.up(l.isActive) !== 'N').length;
  }

  /**
   * Counted the same way as activeLevelCount — the two used to disagree, so a
   * type read "9 levels · 24 approvers" when 2 of those 24 were off. Form-role
   * placeholder rows (no EMPLOYEE_ID) are excluded too, so this matches what
   * the Approvers tab actually lists.
   */
  activeApproverCount(type: string): number {
    return this.approversFor(type).filter(a =>
      this.up(a.isActive) !== 'N' && this.hasPerson(a)).length;
  }

  /**
   * DEPARTMENT_ID is no longer asked for. Every row uses 'ALL': the two master
   * tables are joined on ROLE_CODE *and* DEPARTMENT_ID, so a level on one
   * department and its approvers on another silently match nothing and the
   * step produces no approver. Sending 'ALL' everywhere removes that trap.
   */
  readonly DEFAULT_DEPARTMENT = 'ALL';

  /* The role dropdown that used to live in the Add-approver dialog is gone, and
     its options getter with it. It merged this type's roles with every role in
     use anywhere, which is exactly the leak that showed another employee type's
     roles on this one's sections. The role now comes from the + that was
     clicked, so no list has to be assembled at all. */

  isFormRole(role: any): boolean { return this.FORM_ROLES.includes(this.up(role)); }

  /** A row that names an actual person — not a form-role placeholder. */
  private hasPerson(a: FlowApproverRow): boolean {
    return !!(a.employeeId || '').toString().trim();
  }

  /** Active approvers of a role who are real people. */
  peopleOf(role: any): FlowApproverRow[] {
    return this.selectedApprovers.filter(a =>
      this.up(a.roleCode) === this.up(role) &&
      this.up(a.isActive) !== 'N' &&
      this.hasPerson(a));
  }

  /** What the Approvers tab actually lists — drives its count pill. */
  get approverPeopleCount(): number {
    return this.selectedApprovers.filter(a =>
      this.up(a.isActive) !== 'N' && this.hasPerson(a)).length;
  }

  /**
   * groupedApprovers is now a CACHED FIELD (see rebuildDerived above).
   * It is rebuilt whenever selectedType changes or data is reloaded.
   * Template binds to the field directly — no getter, no new array per CD pass.
   */

  /** 'N' = this role has no active level, so its people never get asked. */
  roleHasLevel(role: any): boolean {
    return this.selectedLevels.some(l =>
      this.up(l.roleCode) === this.up(role) && this.up(l.isActive) !== 'N');
  }


  // ── type actions ────────────────────────────────────────────────────────
  selectType(t: string): void {
    this.selectedType = this.up(t);
    this.showLevelForm = false;
    this.showApproverForm = false;
    // groupedApprovers depends on selectedType — rebuild now
    this.rebuildDerived();
  }

  /**
   * Creates the type in TM_EMP_TYPE_MASTER straight away — it is a real row
   * now, not something implied by its levels. The code is what the two master
   * tables join on, so it is normalised to A-Z/0-9/underscore here; the
   * procedure rejects anything else anyway.
   *
   * A type is CREATE-ONLY. There is no edit path, here or in the procedure.
   */
  openNewType(): void {
    this.newTypeName = '';
    this.showNewType = true;
  }

  /**
   * Activate / deactivate an employee type.
   *
   * IS_ACTIVE is the ONLY field a type can be updated on. TYPE_CODE is what
   * the two master tables join to by value, so renaming would orphan every
   * level and approver under it; IS_ACTIVE is joined on by nothing, so this is
   * safe and fully reversible.
   *
   * Switching one off only hides it from the exit form's picker. Its levels
   * and approvers are untouched, and forms already filed under it keep working
   * because their chain comes from the flow tables, not the type master.
   */
  toggleTypeActive(code: string, ev: Event): void {
    // the card itself selects the type; the switch must not do both
    ev.stopPropagation();

    const row = this.typeRow(code);
    if (!row?.typeId) {
      this.toastr.info('This type has no row in the employee-type master yet.');
      return;
    }

    const next = this.isTypeRegistered(code) ? 'N' : 'Y';

    this.write(this.api.SaveFlowConfig({
      entity: 'TYPE',
      id: row.typeId,
      formType: this.formType,
      isActive: next
    }), next === 'Y' ? 'Employee type activated' : 'Employee type deactivated',
       () => { row.isActive = next; });
  }

  /** Live preview of what the name will be stored as. */
  get newTypeCode(): string {
    return this.up(this.newTypeName).replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
  }

  createType(): void {
    const raw = (this.newTypeName || '').trim();
    if (!raw) { this.toastr.error('Enter a name for the new employee type'); return; }

    const code = this.newTypeCode;
    if (code.length < 2) { this.toastr.error('Type code must be at least 2 characters'); return; }
    if (this.types.includes(code)) { this.toastr.info(`"${code}" already exists`); this.selectType(code); return; }

    this.write(this.api.SaveFlowConfig({
      entity: 'TYPE',
      formType: this.formType,
      typeCode: code,
      typeName: raw,
      isActive: 'Y'
    }), 'Employee type created', () => {
      this.selectedType = code;
      this.showNewType = false;
      this.newTypeName = '';
      this.activeTab = 'levels';
      // the type exists but has no chain yet, so open the first level form
      this.levelForm = { ...this.blankLevel(), empType: code, approvalLevel: 1 };
      this.showLevelForm = true;
    });
  }

  // ── level actions ───────────────────────────────────────────────────────
  private blankLevel(): FlowLevelRow {
    return { flowId: null, empType: '', departmentId: 'ALL', approvalLevel: null,
             roleCode: '', isAnyOneAllowed: 'Y', isActive: 'Y' };
  }

  addLevel(): void {
    const next = this.selectedLevels.length
      ? Math.max(...this.selectedLevels.map(l => Number(l.approvalLevel ?? 0))) + 1 : 1;
    this.levelForm = { ...this.blankLevel(), empType: this.selectedType, approvalLevel: next };
    this.showLevelForm = true;
  }

  editLevel(row: FlowLevelRow): void {
    this.levelForm = { ...row };
    this.showLevelForm = true;
  }

  /**
   * SP_SAVE_EXIT_FLOW_CONFIG replaces every column on update, so a partial
   * payload would blank the ones left out. Each level write therefore sends the
   * whole row, with only the field being changed overridden.
   */
  private levelPayload(row: FlowLevelRow, patch: Partial<SaveFlowConfigRequest> = {}): SaveFlowConfigRequest {
    return {
      entity: 'LEVEL',
      id: row.flowId ?? null,
      formType: this.formType,
      empType: this.up(row.empType) || this.selectedType,
      // not asked for any more - every row is ALL, see DEFAULT_DEPARTMENT
      departmentId: this.DEFAULT_DEPARTMENT,
      roleCode: (row.roleCode || '').trim(),
      approvalLevel: Number(row.approvalLevel ?? 0),
      // IS_ANY_ONE_ALLOWED is not asked for any more: one approver acting is
      // enough on every level, so it is always sent as 'Y'.
      isAnyOneAllowed: 'Y',
      isActive: this.up(row.isActive) === 'N' ? 'N' : 'Y',
      ...patch
    };
  }

  saveLevel(): void {
    const f = this.levelForm;
    if (!this.up(f.roleCode)) { this.toastr.error('Role code is required'); return; }
    if (!Number(f.approvalLevel)) { this.toastr.error('Approval level must be 1 or more'); return; }
    this.write(this.api.SaveFlowConfig(this.levelPayload(f)),
      'Level saved', () => { this.showLevelForm = false; });
  }

  /**
   * Move a level up or down by swapping the two APPROVAL_LEVEL numbers.
   *
   * The old single-call reorder procedure does not exist in this design, so
   * this is two writes. They cannot corrupt the chain — the procedure's
   * uniqueness check is on (level, role), and the two rows have different
   * roles — but if the second one fails the order is left half-applied, so the
   * failure path re-reads rather than trusting the local list.
   */
  moveLevel(row: FlowLevelRow, dir: -1 | 1): void {
    const list = this.selectedLevels;
    const i = list.indexOf(row);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) { return; }

    const other = list[j];
    const mine = Number(row.approvalLevel ?? 0);
    const theirs = Number(other.approvalLevel ?? 0);
    if (mine === theirs) { return; }

    this.api.SaveFlowConfig(this.levelPayload(row, { approvalLevel: theirs })).subscribe({
      next: (first: any) => {
        if (first?.success === false) { this.toastr.error(first?.message || 'Could not change the order'); return; }
        this.api.SaveFlowConfig(this.levelPayload(other, { approvalLevel: mine })).subscribe({
          next: (second: any) => {
            if (second?.success === false) {
              this.toastr.error(second?.message || 'Order left half-applied — reloading');
            } else {
              this.dirty = true;
              this.toastr.success('Order updated');
            }
            this.load(true);
          },
          error: () => { this.toastr.error('Order left half-applied — reloading'); this.load(true); }
        });
      },
      error: () => { this.toastr.error('Could not change the order'); }
    });
  }

  toggleLevelActive(row: FlowLevelRow): void {
    const next = this.up(row.isActive) === 'N' ? 'Y' : 'N';
    this.write(this.api.SaveFlowConfig(this.levelPayload(row, { isActive: next })),
      next === 'Y' ? 'Level activated' : 'Level deactivated',
      () => { row.isActive = next; });
  }


  deactivateLevel(row: FlowLevelRow): void {
    // soft delete only — there is no delete in the procedure at all, because
    // hard-deleting a role that in-flight forms reference orphans those rows
    this.write(this.api.SaveFlowConfig(this.levelPayload(row, { isActive: 'N' })),
      'Level deactivated', () => { row.isActive = 'N'; });
  }

  // ── approver actions ────────────────────────────────────────────────────
  private blankApprover(): FlowApproverRow {
    return { deptPersonId: null, empType: '', departmentId: 'ALL', roleCode: '',
             employeeId: '', employeeName: '', isHead: 'N', isActive: 'Y' };
  }

  /**
   * Only ever called from a role section's + button, so `role` decides the
   * approver's role and the dialog shows it locked. There is no header-level
   * "Add approver" any more: choosing the role by hand let an approver be filed
   * under a role belonging to a different employee type.
   */
  addApprover(role: string): void {
    this.approverForm = {
      ...this.blankApprover(),
      empType: this.selectedType,
      departmentId: this.DEFAULT_DEPARTMENT,
      roleCode: (role || '').trim()
    };
    this.approverSearch = '';
    this.empPickerOpen = false;
    this.showApproverForm = true;
    this.rebuildFilteredEmployees();
  }

  editApprover(row: FlowApproverRow): void {
    this.approverForm = { ...row };
    // the chosen person renders as a chip, so the search box starts empty
    this.approverSearch = '';
    this.empPickerOpen = false;
    this.showApproverForm = true;
    this.rebuildFilteredEmployees();
  }

  // ── employee picker ─────────────────────────────────────────────────────
  // The list is already in memory (employeeList, from GetEmployeeMasterList on
  // the parent) — opening the picker costs no API call.

  empPickerOpen = false;

  /** Click or focus opens the list; no typing required to see the options. */
  openEmpPicker(): void {
    this.empPickerOpen = true;
    this.cdr.detectChanges();
  }

  /** Delayed so a click on a row lands before the list unmounts on blur. */
  closeEmpPicker(): void {
    setTimeout(() => { this.empPickerOpen = false; this.cdr.detectChanges(); }, 160);
  }

  /**
   * filteredEmployees is now a CACHED FIELD (see rebuildFilteredEmployees above).
   * Call rebuildFilteredEmployees() whenever approverSearch changes.
   */

  /**
   * Already on this role for this type. The procedure refuses a duplicate, so
   * flagging it here turns a save-time error into something visible up front.
   */
  isAlreadyApprover(empId: any): boolean {
    const id = (empId || '').toString().trim().toUpperCase();
    if (!id) { return false; }
    const role = this.up(this.approverForm.roleCode);
    return this.selectedApprovers.some(a =>
      this.up(a.employeeId) === id &&
      this.up(a.roleCode) === role &&
      this.up(a.isActive) !== 'N' &&
      // editing that very row is not a duplicate of itself
      a.deptPersonId !== this.approverForm.deptPersonId);
  }

  pickEmployee(e: DropdownOption): void {
    if (this.isAlreadyApprover(e.idValue)) { return; }
    this.approverForm.employeeId = (e.idValue || '').trim();
    this.approverForm.employeeName = (e.description || '').split(' | ')[0];
    this.approverSearch = '';
    this.empPickerOpen = false;
    this.rebuildFilteredEmployees();
    this.cdr.detectChanges();
  }

  clearEmployee(): void {
    this.approverForm.employeeId = '';
    this.approverForm.employeeName = '';
    this.approverSearch = '';
    this.empPickerOpen = true;
    this.rebuildFilteredEmployees();
    this.cdr.detectChanges();
  }

  /** Initials for the avatar chip — cheap identity cue in a long list. */
  initials(name: any, id: any): string {
    const n = (name || '').toString().trim();
    if (n) {
      const parts = n.split(/\s+/).filter(Boolean);
      return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
    }
    return (id || '').toString().trim().slice(0, 2).toUpperCase();
  }

  /** Whole row on every write, for the same reason as levelPayload. */
  private approverPayload(row: FlowApproverRow, patch: Partial<SaveFlowConfigRequest> = {}): SaveFlowConfigRequest {
    return {
      entity: 'APPROVER',
      id: row.deptPersonId ?? null,
      formType: this.formType,
      empType: this.up(row.empType) || this.selectedType,
      // not asked for any more - every row is ALL, see DEFAULT_DEPARTMENT
      departmentId: this.DEFAULT_DEPARTMENT,
      roleCode: (row.roleCode || '').trim(),
      employeeId: (row.employeeId || '').trim(),
      isHead: this.up(row.isHead) === 'Y' ? 'Y' : 'N',
      isNational: (row.isNational || '').trim() || null,
      isActive: this.up(row.isActive) === 'N' ? 'N' : 'Y',
      ...patch
    };
  }

  saveApprover(): void {
    const f = this.approverForm;
    if (!this.up(f.roleCode)) { this.toastr.error('Role is required'); return; }
    if (!(f.employeeId || '').trim()) { this.toastr.error('Select an employee'); return; }
    this.write(this.api.SaveFlowConfig(this.approverPayload(f)),
      'Approver saved', () => { this.showApproverForm = false; });
  }

  toggleApproverActive(row: FlowApproverRow): void {
    const next = this.up(row.isActive) === 'N' ? 'Y' : 'N';
    this.write(this.api.SaveFlowConfig(this.approverPayload(row, { isActive: next })),
      next === 'Y' ? 'Approver activated' : 'Approver deactivated',
      () => { row.isActive = next; });
  }

  toggleHead(row: FlowApproverRow): void {
    const next = this.up(row.isHead) === 'Y' ? 'N' : 'Y';
    this.write(this.api.SaveFlowConfig(this.approverPayload(row, { isHead: next })),
      next === 'Y' ? 'Set as head' : 'Head removed',
      () => { row.isHead = next; });
  }

  deactivateApprover(row: FlowApproverRow): void {
    this.write(this.api.SaveFlowConfig(this.approverPayload(row, { isActive: 'N' })),
      'Approver deactivated', () => { row.isActive = 'N'; });
  }

  // ── shared write handler ────────────────────────────────────────────────
  /**
   * One place for every button's result handling.
   *
   * A refusal the procedure decided ("role already exists", "employee not
   * found") arrives as 200 + success:false, so it is shown as its own message
   * rather than a generic failure. On success the whole config is re-fetched:
   * an insert has no id client-side, and the warnings above are derived from
   * the list, so re-reading is what keeps both honest.
   */
  private write(obs: any, okMsg: string, onOk: () => void): void {
    obs.subscribe({
      next: (res: any) => {
        if (res?.success === false) {
          this.toastr.error(res?.message || 'Could not save');
          return;
        }
        this.dirty = true;
        onOk();
        this.toastr.success(res?.message || okMsg);
        this.cdr.detectChanges();
        this.load(true);
      },
      error: (err: any) => {
        const msg = typeof err?.error?.message === 'string' ? err.error.message.trim() : '';
        this.toastr.error(msg || 'Could not save');
      }
    });
  }

  close(): void {
    this.showLevelForm = false;
    this.showApproverForm = false;
    this.showNewType = false;
    this.empPickerOpen = false;
    this.closed.emit(this.dirty);
  }

  /** Backdrop click closes; clicks inside must not bubble out to it. */
  stop(ev: Event): void { ev.stopPropagation(); }

  prettyRole(code: any): string {
    const c = (code || '').toString().trim();
    const map: { [k: string]: string } = {
      'HANDOVER': 'Handing Over', 'HOD': 'HOD', 'PROJECT_MANAGER': 'Project Manager',
      'IT': 'IT', 'AUDIT': 'Audit', 'FINANCE': 'Finance', 'FACILITY': 'Facility',
      'TRANSPORT': 'Transport', 'HR': 'HR', 'ADMIN': 'Admin', 'PASSPORT': 'Passport',
      // worker chain
      'SITE_ADMIN': 'Site Admin', 'SITE_INCHARGE': 'Site Incharge',
      'CAMBOSS': 'Camp Boss', 'BNS_CAMP': 'BNS Camp', 'STORE': 'Store',
      'TRAINING_CENTER': 'Training Center'
    };
    // unmapped codes still read better title-cased than SHOUTED
    const hit = map[c.toUpperCase()];
    if (hit) { return hit; }
    if (c && c === c.toUpperCase()) {
      return c.split(/[_\s]+/).filter((w: string) => !!w)
        .map((w: string) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ');
    }
    return c;
  }
}
