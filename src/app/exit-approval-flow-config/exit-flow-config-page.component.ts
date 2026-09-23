import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api } from '../services/api';
import { DropdownOption } from '../models/common.model';
import { EmpType, EmpTypeFlowStep } from '../models/employeeExit.model';
import { ExitApprovalFlowConfigComponent } from './exit-approval-flow-config.component';

/**
 * Host page for the emp-type approval flow.
 *
 * Exists so both new procedures can be exercised end to end without touching
 * emergency-exit-form.component.ts (~4,400 lines). Two halves:
 *
 *   TOP    the EMPLOYEE view — SP_GET_EMP_TYPE_APPROVAL_FLOW. Picking a type
 *          renders its real chain. This is what the exit form's "Current
 *          Approval Flow" card will show once it is wired up.
 *   BUTTON the CONFIGURATION modal — SP_GET_EXIT_FLOW_CONFIG_HOD /
 *          SP_SAVE_EXIT_FLOW_CONFIG.
 *
 * Neither procedure checks permissions, so whoever routes to this page decides
 * who may see it.
 */
interface StepGroup {
  level: number;
  roleCode: string;
  isFormSelected: boolean;
  isAnyOneAllowed: boolean;
  people: EmpTypeFlowStep[];
}

@Component({
  selector: 'app-exit-flow-config-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ExitApprovalFlowConfigComponent],
  templateUrl: './exit-flow-config-page.component.html',
  styleUrls: ['./exit-flow-config-page.component.css']
})
export class ExitFlowConfigPageComponent implements OnInit {

  formType = 'E';
  readonly formTypes = [
    { code: 'E', label: 'Exit' },
    { code: 'R', label: 'Rejoining' },
    { code: 'B', label: 'BYOD' }
  ];

  types: EmpType[] = [];
  steps: EmpTypeFlowStep[] = [];
  selectedType = '';

  loading = false;
  message = '';
  configOpen = false;

  employeeList: DropdownOption[] = [];

  constructor(private api: Api, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadTypes();
    this.loadEmployees();
  }

  /** First render: types only, empty chain. That is the normal state. */
  loadTypes(): void {
    this.loading = true;
    this.selectedType = '';
    this.steps = [];
    this.api.GetEmpTypeApprovalFlow(this.formType).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.types = res?.data?.types ?? [];
        this.message = res?.message || '';
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        this.types = [];
        this.message = err?.error?.message || 'Could not load employee types';
        this.cdr.detectChanges();
      }
    });
  }

  /** Second call: the chosen type's chain. */
  selectType(code: string): void {
    this.selectedType = code;
    this.loading = true;
    this.api.GetEmpTypeApprovalFlow(this.formType, code).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.types = res?.data?.types ?? this.types;
        this.steps = res?.data?.steps ?? [];
        this.message = res?.message || '';
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        this.steps = [];
        this.message = err?.error?.message || 'Could not load the approval flow';
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * The cursor returns one row per person, so a level with three approvers
   * arrives as three rows. Group them back into one step per (level, role) —
   * the chain is what the user reads, not the person rows.
   */
  get groupedSteps(): StepGroup[] {
    const map = new Map<string, StepGroup>();
    for (const s of this.steps) {
      const key = `${s.approvalLevel}|${s.roleCode}`;
      let g = map.get(key);
      if (!g) {
        g = {
          level: Number(s.approvalLevel ?? 0),
          roleCode: (s.roleCode || '').trim(),
          isFormSelected: (s.isFormSelected || '').toUpperCase() === 'Y',
          isAnyOneAllowed: (s.isAnyOneAllowed || '').toUpperCase() === 'Y',
          people: []
        };
        map.set(key, g);
      }
      // a LEFT JOIN miss is a real row with no person on it
      if (s.employeeId) { g.people.push(s); }
    }
    return [...map.values()].sort((a, b) => a.level - b.level);
  }

  /** Levels that will block a form: nobody configured and not named on the form. */
  get emptyLevels(): StepGroup[] {
    return this.groupedSteps.filter(g => !g.isFormSelected && g.people.length === 0);
  }

  typeName(code: string): string {
    return this.types.find(t => (t.typeCode || '').toUpperCase() === (code || '').toUpperCase())?.typeName || code;
  }

  private loadEmployees(): void {
    this.api.GetEmployeeMasterList().subscribe({
      next: (res: any) => {
        const rows = res?.data ?? (Array.isArray(res) ? res : []);
        this.employeeList = (rows || []).map((e: any) => ({
          idValue: e.idValue || e.empId || e.employeeId,
          description: e.description || e.employeeName || e.name,
          email: e.email || e.Email,
          phoneNumber: e.phoneNumber || e.phone,
          firstlogin: (e.firstlogin ?? 'N').toString().trim().toUpperCase()
        }));
        this.cdr.detectChanges();
      },
      error: () => { this.employeeList = []; }
    });
  }

  openConfig(): void { this.configOpen = true; }

  /** `saved` is true when the modal wrote something, so the chain is re-read. */
  onConfigClosed(saved: boolean): void {
    this.configOpen = false;
    if (saved) {
      if (this.selectedType) { this.selectType(this.selectedType); }
      else { this.loadTypes(); }
    }
  }

  prettyRole(code: any): string {
    const c = (code || '').toString().trim();
    const map: { [k: string]: string } = {
      'HANDOVER': 'Handing Over', 'HOD': 'HOD', 'PROJECT_MANAGER': 'Project Manager',
      'IT': 'IT', 'AUDIT': 'Audit', 'FINANCE': 'Finance', 'FACILITY': 'Facility',
      'TRANSPORT': 'Transport', 'HR': 'HR', 'ADMIN': 'Admin', 'PASSPORT': 'Passport'
    };
    return map[c.toUpperCase()] || c;
  }
}
