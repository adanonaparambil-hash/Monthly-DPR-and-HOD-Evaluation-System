import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Api } from '../services/api';
import { AuthService } from '../services/auth.service';
import { TaskDetailsModalComponent } from '../components/task-details-modal/task-details-modal.component';

// ── Custom field value from P_CUSTOM_CURSOR ───────────────────────────────────
interface TaskFieldValue {
  taskId:     number;
  fieldId:    number;
  fieldName:  string;
  fieldType:  string;
  fieldValue: string | null;
}

interface TaskFieldDefinition {
  fieldId:   number;
  fieldName: string;
  fieldType: string;
}

// ── API response shape ────────────────────────────────────────────────────────
interface LogAnalyticsRow {
  employeeId:     string;
  employeeName:   string;
  departmentId:   number;
  deptName:       string;
  categoryId:     number;
  categoryName:   string;
  taskId:         number;
  taskTitle:      string;
  projectId:      number;
  projectName:    string;
  description:    string;
  approvalStatus: string;
  progress:       number;
  startDate:      string;
  targetDate:     string;
  createdDate:    string;
  assignedBy:     string;
  logDate:        string;
  totalMin:       number;
  employeeCount:  number;
  employeeNames:  string;
  dailyComment:   string;
  dailyCount:     number;
}

interface SummaryRow {
  groupKey:      string;
  groupLabel:    string;
  taskCount:     number;
  employeeCount: number;
  totalMin:      number;
}

// ── Display-friendly entry (matches HTML template bindings) ───────────────────
interface LogEntry {
  id:             number;
  employee:       { id: string; name: string };
  employees:      { id: string; name: string }[];
  taskCategory:   { id: number; name: string };
  taskTitle:      string;
  project:        string;
  description:    string;
  dailyComment:   string;
  logTime:        string;         // formatted HH:MM
  logTimeMins:    number;
  totalLogTime:   string;
  logTimes:       string[];
  approvalStatus: string;
  startDate:      string;
  targetDate:     string;
  createdDate:    string;
  assignedBy:     string;
  progress:       number;
  department:     string;
  dprId:          string;
  dailyCount:     number;
  location:       string;
  groupKey:       string;
  groupLabel:     string;
  customFields:   { [fieldId: number]: string | null };
  assigneeIds:    string[];  // all active assignee IDs — used for modal userId & edit permission
}

// ── Per-column filter state ───────────────────────────────────────────────────
interface ColFilter {
  searchText:     string;
  selectedValues: Set<string>;
  sortDir:        'asc' | 'desc' | null;
  dateFrom:       string;
  dateTo:         string;
  timeOp:         '>' | '>=' | '<' | '<=' | '=';
  timeVal:        number | null;
}

interface ColPrefItem {
  colKey:    string;
  isVisible: string;
  colOrder:  number;
  colWidth:  number;
}

@Component({
  selector: 'app-log-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, TaskDetailsModalComponent],
  templateUrl: './log-analytics.component.html',
  styleUrls: ['./log-analytics.component.css']
})
export class LogAnalyticsComponent implements OnInit, OnDestroy {
  Math = Math;

  // ── Auth / Role ───────────────────────────────────────────────────────────
  userId     = '';
  userType   = 'E';   // 'E' = Employee, 'H' = HOD, 'C' = CEO/Admin
  userDeptId: number | null = null;

  // ── Task detail modal ────────────────────────────────────────────────────
  showTaskDetailsModal       = false;
  selectedTaskIdForModal     = 0;
  selectedCategoryIdForModal = 0;
  selectedUserIdForModal     = '';
  isTaskModalViewOnly        = true;

  get isHOD():   boolean { return this.userType === 'H' || this.userType === 'C'; }
  get isNormal(): boolean { return this.userType === 'E'; }

  /** Normal users cannot filter/toggle employee or department columns */
  canFilterCol(key: string): boolean {
    if (this.isNormal && (key === 'employee' || key === 'department')) return false;
    return true;
  }

  /** Columns the user is allowed to show/hide in the column manager */
  get manageableCols() {
    return this.allColumns.filter(c => this.canFilterCol(c.key));
  }

  /** Group-by options available to the current user */
  get availableGroupByOptions() {
    if (this.isNormal) {
      return this.groupByOptions.filter(o => o.value !== 'employee' && o.value !== 'department');
    }
    return this.groupByOptions;
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  loading        = false;
  filtersLoading = false;

  // ── Global search ─────────────────────────────────────────────────────────
  searchTerm = '';
  private searchSubject = new Subject<void>();
  private subs          = new Subscription();

  // ── UI state ──────────────────────────────────────────────────────────────
  showColumnsPanel = false;
  showGroupByMenu  = false;
  showComLocMenu   = false;
  groupBy          = 'taskCategory';

  // ── Employee popup ────────────────────────────────────────────────────────
  empPopupEntry: LogEntry | null = null;
  empPopupPos   = { top: 0, left: 0 };

  // ── Column filter dropdowns ───────────────────────────────────────────────
  openFilterCol:       string | null = null;
  filterDropdownPos    = { top: 0, left: 0 };
  filterDropdownItems: string[] = [];
  colFilters:          { [col: string]: ColFilter } = {};

  // ── Column definitions ────────────────────────────────────────────────────
  allColumns = [
    { key: 'employee',       label: 'Employee',       icon: 'fa-user',           textSearch: false },
    { key: 'taskCategory',   label: 'Category',       icon: 'fa-tag',            textSearch: false },
    { key: 'taskTitle',      label: 'Task Title',     icon: 'fa-list-check',     textSearch: true  },
    { key: 'project',        label: 'Project',        icon: 'fa-cube',           textSearch: false },
    { key: 'description',    label: 'Description',    icon: 'fa-align-left',     textSearch: true  },
    { key: 'dailyComment',   label: 'Daily Comment',  icon: 'fa-comment',        textSearch: true  },
    { key: 'logTime',        label: 'Log Time',       icon: 'fa-clock',          textSearch: false, timeFilter: true  },
    { key: 'approvalStatus', label: 'Status',         icon: 'fa-circle-check',   textSearch: false },
    { key: 'startDate',      label: 'Start Date',     icon: 'fa-calendar-plus',  textSearch: false, dateFilter: true  },
    { key: 'targetDate',     label: 'Target Date',    icon: 'fa-calendar-check', textSearch: false, dateFilter: true  },
    { key: 'createdDate',    label: 'Created Date',   icon: 'fa-calendar',       textSearch: false, dateFilter: true  },
    { key: 'assignedBy',     label: 'Assigned By',    icon: 'fa-user-tie',       textSearch: false },
    { key: 'dailyCount',    label: 'Daily Count',    icon: 'fa-hashtag',        textSearch: false },
    { key: 'progress',       label: 'Progress',       icon: 'fa-chart-line',     textSearch: false },
    { key: 'department',     label: 'Department',     icon: 'fa-building',       textSearch: false },
    { key: 'dprId',          label: 'DPR ID',         icon: 'fa-hashtag',        textSearch: false },
  ];

  visibleColumns: { [key: string]: boolean } = {
    employee: true, taskCategory: true, taskTitle: true, project: true,
    description: true, dailyComment: true, logTime: true,
    approvalStatus: true, startDate: false, targetDate: false,
    createdDate: false, assignedBy: false, dailyCount: false, progress: false,
    department: false, dprId: false
  };

  columnWidths: { [key: string]: number } = {
    employee: 200, taskCategory: 120, taskTitle: 190, project: 140,
    description: 260, dailyComment: 200, logTime: 100,
    approvalStatus: 120, startDate: 120, targetDate: 120,
    createdDate: 120, assignedBy: 160, dailyCount: 100, progress: 130,
    department: 130, dprId: 100
  };

  private resizing       = false;
  private resizingColumn = '';
  private startX         = 0;
  private startWidth     = 0;

  // ── Column drag-reorder ───────────────────────────────────────────────────
  dragSourceKey: string | null   = null;
  dragOverKey:   string | null   = null;
  dragOverSide:  'left' | 'right' = 'left';

  // ── Pagination ────────────────────────────────────────────────────────────
  currentPage  = 1;
  pageSize     = 500;
  totalRecords = 0;

  // ── GroupBy ───────────────────────────────────────────────────────────────
  groupByOptions = [
    { value: 'taskCategory', label: 'Task Category', icon: 'fa-tag'      },
    { value: 'employee',     label: 'Employee',      icon: 'fa-user'     },
    { value: 'department',   label: 'Department',    icon: 'fa-building' },
    { value: 'project',      label: 'Project',       icon: 'fa-cube'     },
    { value: 'date',         label: 'Date',          icon: 'fa-calendar' },
  ];

  // ── COM_LOC filter ────────────────────────────────────────────────────────
  comLocOptions = [
    { value: 'IND', label: 'India' },
    { value: 'KSA', label: 'Saudi Arabia' },
    { value: 'OM',  label: 'Oman' },
    { value: 'UAE', label: 'UAE' },
  ];

  // ── Filter dropdown options (loaded once from API) ─────────────────────────
  filterEmployees:  { employeeId: string; employeeName: string }[]   = [];
  filterCategories: { categoryId: number; categoryName: string }[]   = [];
  filterProjects:   { projectId: number;  projectName: string }[]    = [];
  filterStatuses:   string[]                                          = [];
  filterDepts:      { departmentId: number; deptName: string }[]     = [];

  // ── Custom fields ─────────────────────────────────────────────────────────
  customFieldDefs: TaskFieldDefinition[] = [];
  // taskId → fieldId → value
  private customValueMap: Map<number, Map<number, string | null>> = new Map();

  // ── Active filter params ──────────────────────────────────────────────────
  activeFilters = {
    employeeIds:       [] as string[],
    assignedByIds:     [] as string[],
    categoryIds:       [] as number[],
    projectIds:        [] as number[],
    statuses:          [] as string[],
    deptIds:           [] as number[],
    comLocs:           [] as string[],
    taskTitleSearch:   '',
    descriptionSearch: '',
    commentSearch:     '',
    logTimeOp:         '',
    logTimeMin:        null as number | null,
    startDateFrom:  '', startDateTo:  '',
    targetDateFrom: '', targetDateTo: '',
    createdDateFrom:'', createdDateTo:'',
    logDateFrom:    '', logDateTo:    '',
  };

  activeSortCol = 'LOG_DATE';
  activeSortDir = 'DESC';

  // ── Data from API ─────────────────────────────────────────────────────────
  logEntries:  LogEntry[] = [];
  summaryMap:  { [key: string]: SummaryRow } = {};

  // expandedCategories is the property name the HTML uses for expand/collapse
  expandedCategories: { [key: string]: boolean } = {};

  constructor(
    private api:  Api,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.auth.getUser();
    this.userId = user?.empId ?? user?.employeeId ?? user?.userId ?? user?.id ?? '';

    // Same pattern used by apr.component and monthly-dpr.component:
    // isHOD is stored as 'H', 'C', or '' at login time (login.component.ts line 280)
    const code = ((user?.isHOD || user?.role || user?.userType || '') as string)
      .toString().toUpperCase();
    if (code === 'H') {
      this.userType = 'H';
    } else if (code === 'C') {
      this.userType = 'C';
    } else {
      this.userType = 'E';
    }

    this.userDeptId = user?.departmentID ?? user?.departmentId ?? user?.deptId ?? null;

    // HOD: pre-filter to their own department on initial load
    if (this.userType === 'H' && this.userDeptId) {
      this.activeFilters.deptIds = [this.userDeptId];
    }

    this.initColFilters();

    this.subs.add(
      this.searchSubject.pipe(debounceTime(400)).subscribe(() => {
        this.resetPagination();
        this.loadData();
      })
    );

    this.loadSettings();
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  // ── Init col filters ──────────────────────────────────────────────────────
  initColFilters(): void {
    this.allColumns.forEach(c => {
      this.colFilters[c.key] = {
        searchText: '', selectedValues: new Set(),
        sortDir: null, dateFrom: '', dateTo: '',
        timeOp: '>', timeVal: null
      };
    });
  }

  // ── Step 1: load settings → prefs → filter options → data ────────────────
  loadSettings(): void {
    if (!this.userId) { this.loadFilterOptions(); this.loadData(); return; }

    this.api.getAnalyticsSettings(this.userId).subscribe({
      next: (res: any) => {
        const settings: { [k: string]: string } = res?.data ?? res ?? {};
        if (settings['GROUP_BY']) this.groupBy = settings['GROUP_BY'];
        this.loadColPrefs();
        this.loadFilterOptions();
        this.loadData();
      },
      error: () => { this.loadFilterOptions(); this.loadData(); }
    });
  }

  loadColPrefs(): void {
    this.api.getLogColPrefs(this.userId).subscribe({
      next: (res: any) => {
        const prefs: ColPrefItem[] = res?.data ?? res ?? [];
        if (!prefs || prefs.length === 0) return;

        const sorted   = [...prefs].sort((a, b) => a.colOrder - b.colOrder);
        const reordered = sorted
          .map(p => this.allColumns.find(c => c.key === p.colKey))
          .filter(Boolean) as typeof this.allColumns;
        const savedKeys = new Set(sorted.map(p => p.colKey));
        const unsaved   = this.allColumns.filter(c => !savedKeys.has(c.key));
        this.allColumns.splice(0, this.allColumns.length, ...reordered, ...unsaved);

        prefs.forEach(p => {
          this.visibleColumns[p.colKey] = p.isVisible === 'Y';
          this.columnWidths[p.colKey]   = p.colWidth;
        });
      },
      error: () => {}
    });
  }

  loadFilterOptions(): void {
    if (!this.userId) return;
    this.filtersLoading = true;
    this.api.getLogFilterOptions(this.userId).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res ?? {};
        this.filterEmployees  = data.employees    ?? [];
        this.filterCategories = data.categories   ?? [];
        this.filterProjects   = data.projects     ?? [];
        this.filterStatuses   = data.statuses     ?? [];
        this.filterDepts      = data.departments  ?? [];

        // Sync department checkbox UI to match HOD's pre-set dept filter
        if (this.userType === 'H' && this.userDeptId && this.activeFilters.deptIds.includes(this.userDeptId)) {
          const hodDept = this.filterDepts.find(d => d.departmentId === this.userDeptId);
          if (hodDept) {
            this.colFilters['department'].selectedValues.add(hodDept.deptName);
          }
        }

        // Load custom field definitions and inject as dynamic columns
        const defs: TaskFieldDefinition[] = data.customFields ?? [];
        this.customFieldDefs = defs;
        this._applyCustomFieldColumns(defs);

        this.filtersLoading = false;
      },
      error: () => { this.filtersLoading = false; }
    });
  }

  private _applyCustomFieldColumns(defs: TaskFieldDefinition[]): void {
    // Remove any stale cf_ columns first
    const baseKeys = new Set(this.allColumns.filter(c => !c.key.startsWith('cf_')).map(c => c.key));
    this.allColumns = this.allColumns.filter(c => !c.key.startsWith('cf_'));

    defs.forEach(def => {
      const key = `cf_${def.fieldId}`;
      if (!this.visibleColumns.hasOwnProperty(key)) {
        this.visibleColumns[key] = false;
      }
      if (!this.columnWidths.hasOwnProperty(key)) {
        this.columnWidths[key] = 150;
      }
      if (!this.colFilters[key]) {
        this.colFilters[key] = {
          searchText: '', selectedValues: new Set(),
          sortDir: null, dateFrom: '', dateTo: '',
          timeOp: '>', timeVal: null
        };
      }
      this.allColumns.push({
        key,
        label: def.fieldName,
        icon: def.fieldType === 'date' ? 'fa-calendar-alt'
            : def.fieldType === 'number' ? 'fa-hashtag'
            : def.fieldType === 'dropdown' ? 'fa-list'
            : 'fa-input-text',
        textSearch: def.fieldType !== 'dropdown'
      });
    });
  }

  // ── Build request and fetch data ──────────────────────────────────────────
  loadData(): void {
    this.loading = true;
    const f      = this.activeFilters;

    // Normal employees can only see their own records — lock employeeIds to self.
    // Guard: if userId is empty (not yet resolved), fall back to null (no restriction)
    // so the SP doesn't receive an empty string that breaks the INSTR filter.
    const effectiveEmployeeIds = this.isNormal
      ? (this.userId ? this.userId : null)
      : (f.employeeIds.length ? f.employeeIds.join(',') : null);

    // HOD/Admin: respect whatever dept filter the user chose; no automatic dept default.
    // Normal user: dept filter is irrelevant (data is already locked to their userId).
    const effectiveDeptIds = f.deptIds.length ? f.deptIds.join(',') : null;

    const request = {
      userId:          this.userId,
      groupBy:         this.groupBy,
      employeeIds:     effectiveEmployeeIds,
      assignedByIds:   f.assignedByIds.length  ? f.assignedByIds.join(',')  : null,
      categoryIds:     f.categoryIds.length    ? f.categoryIds.join(',')    : null,
      projectIds:      f.projectIds.length     ? f.projectIds.join(',')     : null,
      statuses:        f.statuses.length       ? f.statuses.join(',')       : null,
      deptIds:         effectiveDeptIds,
      comLoc:          f.comLocs.length ? f.comLocs.join(',') : null,
      taskTitle:       f.taskTitleSearch    || null,
      description:     f.descriptionSearch  || null,
      dailyComment:    f.commentSearch      || null,
      logTimeOp:       f.logTimeOp          || null,
      logTimeMin:      f.logTimeMin,
      startDateFrom:   f.startDateFrom   || null,
      startDateTo:     f.startDateTo     || null,
      targetDateFrom:  f.targetDateFrom  || null,
      targetDateTo:    f.targetDateTo    || null,
      createdDateFrom: f.createdDateFrom || null,
      createdDateTo:   f.createdDateTo   || null,
      logDateFrom:     f.logDateFrom     || null,
      logDateTo:       f.logDateTo       || null,
      sortCol:         this.activeSortCol,
      sortDir:         this.activeSortDir,
      pageNumber:      this.currentPage,
      pageSize:        this.pageSize,
      exportAll:       'N'
    };

    this.api.getLogAnalytics(request).subscribe({
      next: (res: any) => {
        const result      = res?.data ?? res ?? {};
        const rows: LogAnalyticsRow[] = result.data ?? [];
        this.totalRecords = result.totalCount ?? 0;

        // Build summary map keyed by groupKey (strip T00:00:00 if date groupBy)
        this.summaryMap = {};
        (result.summary ?? []).forEach((s: SummaryRow) => {
          const key = s.groupKey ? s.groupKey.substring(0, 10) : s.groupKey;
          this.summaryMap[key] = { ...s, groupKey: key };
          if (this.expandedCategories[s.groupLabel] === undefined)
            this.expandedCategories[s.groupLabel] = true;
        });

        // Build custom value map: taskId → fieldId → value
        this.customValueMap = new Map();
        const customValues: TaskFieldValue[] = result.customValues ?? [];
        customValues.forEach(cv => {
          if (!this.customValueMap.has(cv.taskId)) {
            this.customValueMap.set(cv.taskId, new Map());
          }
          this.customValueMap.get(cv.taskId)!.set(cv.fieldId, cv.fieldValue ?? null);
        });

        // Transform API rows → display entries, apply cf filters, then sort client-side
        this.logEntries = this.applyCustomFieldFilters(this.transformRows(rows));
        this.sortEntries();
        this.loading    = false;
      },
      error: () => { this.loading = false; }
    });
  }

  // ── Transform API rows to display-friendly entries ────────────────────────
  private transformRows(rows: LogAnalyticsRow[]): LogEntry[] {
    const shouldMerge = this.groupBy === 'taskCategory' || this.groupBy === 'project' || this.groupBy === 'department';

    if (!shouldMerge) {
      return rows.map(r => {
        const entry = this.toEntry(r, [{ id: r.employeeId, name: r.employeeName }],
          this.minsToHHMM(r.totalMin), this.minsToHHMM(r.totalMin));
        entry.assigneeIds = r.employeeId ? [r.employeeId] : [];
        return entry;
      });
    }

    // Collect all distinct employee IDs per task from raw rows (needed for edit permission)
    const taskEmpIds = new Map<number, string[]>();
    rows.forEach(r => {
      if (!taskEmpIds.has(r.taskId)) taskEmpIds.set(r.taskId, []);
      if (r.employeeId && !taskEmpIds.get(r.taskId)!.includes(r.employeeId)) {
        taskEmpIds.get(r.taskId)!.push(r.employeeId);
      }
    });

    // Merge per-task: one display row per task (employees merged from employeeNames)
    const map = new Map<number, LogEntry>();
    rows.forEach(r => {
      if (!map.has(r.taskId)) {
        const allIds  = taskEmpIds.get(r.taskId) ?? [];
        const names   = r.employeeNames
          ? r.employeeNames.split(', ').map(n => n.trim())
          : [r.employeeName];
        // Pair names with IDs positionally (both built from same LISTAGG ORDER BY employeeName)
        const empList = names.map((name, i) => ({ id: allIds[i] ?? '', name }));
        const logTimeFormatted = this.minsToHHMM(r.totalMin);
        const entry = this.toEntry(r, empList, logTimeFormatted, logTimeFormatted);
        entry.assigneeIds = allIds;
        map.set(r.taskId, entry);
      }
    });
    return Array.from(map.values());
  }

  private toEntry(
    r: LogAnalyticsRow,
    employees: { id: string; name: string }[],
    logTime: string,
    totalLogTime: string
  ): LogEntry {
    const groupKey   = this.getGroupKey(r);
    const groupLabel = this.summaryMap[groupKey]?.groupLabel ?? this.getGroupLabel(r);

    // Merge custom field values for this task
    const cfMap = this.customValueMap.get(r.taskId) ?? new Map<number, string | null>();
    const customFields: { [fieldId: number]: string | null } = {};
    this.customFieldDefs.forEach(def => {
      customFields[def.fieldId] = cfMap.get(def.fieldId) ?? null;
    });

    return {
      id:             r.taskId,
      employee:       employees[0] ?? { id: r.employeeId, name: r.employeeName },
      employees,
      taskCategory:   { id: r.categoryId,  name: r.categoryName  },
      taskTitle:      r.taskTitle,
      project:        r.projectName,
      description:    r.description,
      dailyComment:   r.dailyComment,
      logTime,
      logTimeMins:    r.totalMin,
      totalLogTime,
      logTimes:       employees.map(() => logTime),
      approvalStatus: r.approvalStatus?.toLowerCase() ?? '',
      startDate:      this.formatDate(r.startDate),
      targetDate:     this.formatDate(r.targetDate),
      createdDate:    this.formatDate(r.createdDate),
      assignedBy:     r.assignedBy,
      progress:       r.progress ?? 0,
      department:     r.deptName,
      dprId:          String(r.taskId),
      dailyCount:     r.dailyCount ?? 0,
      location:       '',
      groupKey,
      groupLabel,
      customFields,
      assigneeIds:    [],   // filled by transformRows after toEntry
    };
  }

  private getGroupKey(r: LogAnalyticsRow): string {
    switch (this.groupBy) {
      case 'taskCategory': return String(r.categoryId);
      case 'project':      return String(r.projectId);
      case 'department':   return String(r.departmentId);
      case 'employee':     return r.employeeId;
      // ODP.NET may append T00:00:00 — strip to YYYY-MM-DD only
      case 'date':         return (r.logDate ?? '').substring(0, 10);
      default:             return String(r.categoryId);
    }
  }

  private getGroupLabel(r: LogAnalyticsRow): string {
    switch (this.groupBy) {
      case 'taskCategory': return r.categoryName;
      case 'project':      return r.projectName;
      case 'department':   return r.deptName;
      case 'employee':     return r.employeeName;
      case 'date':         return this._formatGroupDate((r.logDate ?? '').substring(0, 10));
      default:             return r.categoryName;
    }
  }

  private _formatGroupDate(ymd: string): string {
    if (!ymd || ymd.length < 10) return ymd;
    const [y, m, d] = ymd.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d} ${months[+m - 1]} ${y}`;
  }

  // ── Properties/methods used by the HTML template ──────────────────────────

  /** Client-side filtered entries based on the search box */
  get filteredEntries(): LogEntry[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.logEntries;
    return this.logEntries.filter(entry => {
      const employeeNames = entry.employees.map(e => e.name).join(' ');
      return [
        entry.employee?.name,
        employeeNames,
        entry.taskTitle,
        entry.project,
        entry.taskCategory?.name,
        entry.description,
        entry.dailyComment,
        entry.department
      ].some(v => v && v.toLowerCase().includes(term));
    });
  }

  /** Ordered list of distinct group labels for current page data */
  get dynamicGroups(): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const e of this.filteredEntries) {
      if (!seen.has(e.groupLabel)) { seen.add(e.groupLabel); result.push(e.groupLabel); }
    }
    return result;
  }

  getGroupedEntriesForGroup(groupLabel: string): LogEntry[] {
    return this.filteredEntries.filter(e => e.groupLabel === groupLabel);
  }

  toggleCategory(groupLabel: string): void {
    this.expandedCategories[groupLabel] = !this.expandedCategories[groupLabel];
  }

  getGroupAvatar(groupLabel: string): string { return this.getAvatarColor(groupLabel); }

  getGroupTotalTime(groupLabel: string): string {
    // Find groupKey for this label
    const entry = this.logEntries.find(e => e.groupLabel === groupLabel);
    if (!entry) return '0:00';
    const s = this.summaryMap[entry.groupKey];
    return s ? this.minsToHHMM(s.totalMin) : '0:00';
  }

  // ── applyFilters is called from HTML for every filter interaction ─────────
  applyFilters(): void {
    const f = this.colFilters;

    // Text search columns
    this.activeFilters.taskTitleSearch   = f['taskTitle']?.searchText    ?? '';
    this.activeFilters.descriptionSearch = f['description']?.searchText  ?? '';
    this.activeFilters.commentSearch     = f['dailyComment']?.searchText ?? '';

    // Date range columns
    this.activeFilters.startDateFrom  = f['startDate']?.dateFrom  ?? '';
    this.activeFilters.startDateTo    = f['startDate']?.dateTo    ?? '';
    this.activeFilters.targetDateFrom = f['targetDate']?.dateFrom ?? '';
    this.activeFilters.targetDateTo   = f['targetDate']?.dateTo   ?? '';
    this.activeFilters.createdDateFrom= f['createdDate']?.dateFrom ?? '';
    this.activeFilters.createdDateTo  = f['createdDate']?.dateTo   ?? '';

    // Log time filter (hours → minutes)
    const tf = f['logTime'];
    if (tf?.timeVal !== null && tf?.timeVal !== undefined && tf.timeVal >= 0) {
      this.activeFilters.logTimeOp  = tf.timeOp;
      this.activeFilters.logTimeMin = Math.round(tf.timeVal * 60);
    } else {
      this.activeFilters.logTimeOp  = '';
      this.activeFilters.logTimeMin = null;
    }

    this.resetPagination();
    this.loadData();
  }

  // ── Checkbox filter methods used by HTML ──────────────────────────────────

  /** Values shown in checkbox list — selected items pinned to top, then rest */
  getFilteredUniqueValues(col: string): string[] {
    const text     = (this.colFilters[col]?.searchText ?? '').toLowerCase();
    const raw      = this.getRawFilterValues(col);
    const filtered = text ? raw.filter(v => v.toLowerCase().includes(text)) : raw;
    const selected = this.colFilters[col]?.selectedValues ?? new Set<string>();
    return [
      ...filtered.filter(v =>  selected.has(v)),
      ...filtered.filter(v => !selected.has(v))
    ];
  }

  private getRawFilterValues(col: string): string[] {
    switch (col) {
      case 'employee':       return this.filterEmployees.map(e => e.employeeName);
      case 'assignedBy':     return this.filterEmployees.map(e => e.employeeName);
      case 'taskCategory':   return this.filterCategories.map(c => c.categoryName);
      case 'project':        return this.filterProjects.map(p => p.projectName);
      case 'approvalStatus': return this.filterStatuses;
      case 'department':     return this.filterDepts.map(d => d.deptName);
      default:
        if (col.startsWith('cf_')) {
          // For dropdown-type custom fields, collect distinct values from loaded entries
          const fieldId = Number(col.replace('cf_', ''));
          const vals = new Set<string>();
          this.logEntries.forEach(e => {
            const v = e.customFields?.[fieldId];
            if (v) vals.add(v);
          });
          return Array.from(vals).sort();
        }
        return [];
    }
  }

  allSelected(col: string): boolean {
    const all = this.getRawFilterValues(col);
    if (!all.length) return false;
    return all.every(v => this.colFilters[col]?.selectedValues.has(v));
  }

  toggleSelectAll(col: string): void {
    const all = this.getRawFilterValues(col);
    if (this.allSelected(col)) {
      this.colFilters[col].selectedValues.clear();
      this.syncCheckboxFilterToActive(col, []);
    } else {
      this.colFilters[col].selectedValues = new Set(all);
      this.syncCheckboxFilterToActive(col, all);
    }
    this.applyFilters();
  }

  toggleValue(col: string, val: string): void {
    const set = this.colFilters[col].selectedValues;
    set.has(val) ? set.delete(val) : set.add(val);
    this.syncCheckboxFilterToActive(col, Array.from(set));
    this.applyFilters();
  }

  private syncCheckboxFilterToActive(col: string, selectedLabels: string[]): void {
    switch (col) {
      case 'employee':
        this.activeFilters.employeeIds = this.filterEmployees
          .filter(e => selectedLabels.includes(e.employeeName))
          .map(e => e.employeeId);
        break;
      case 'assignedBy':
        this.activeFilters.assignedByIds = this.filterEmployees
          .filter(e => selectedLabels.includes(e.employeeName))
          .map(e => e.employeeId);
        break;
      case 'taskCategory':
        this.activeFilters.categoryIds = this.filterCategories
          .filter(c => selectedLabels.includes(c.categoryName))
          .map(c => c.categoryId);
        break;
      case 'project':
        this.activeFilters.projectIds = this.filterProjects
          .filter(p => selectedLabels.includes(p.projectName))
          .map(p => p.projectId);
        break;
      case 'approvalStatus':
        this.activeFilters.statuses = selectedLabels;
        break;
      case 'department':
        this.activeFilters.deptIds = this.filterDepts
          .filter(d => selectedLabels.includes(d.deptName))
          .map(d => d.departmentId);
        break;
    }
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
  sortBy(col: string, event: Event): void {
    event.stopPropagation();
    const f = this.colFilters[col];
    if (f.sortDir === null || f.sortDir === 'desc') {
      this.allColumns.forEach(c => { if (c.key !== col) this.colFilters[c.key].sortDir = null; });
      f.sortDir = 'asc';
    } else {
      f.sortDir = 'desc';
    }
    this.activeSortCol = this.colKeyToSortParam(col);
    this.activeSortDir = f.sortDir.toUpperCase();
    this.resetPagination();
    this.loadData();
  }

  private colKeyToSortParam(col: string): string {
    if (col.startsWith('cf_')) return col.replace('cf_', 'CF_').toUpperCase();
    const map: { [k: string]: string } = {
      employee: 'EMPLOYEE_NAME', taskCategory: 'CATEGORY_NAME',
      taskTitle: 'TASK_TITLE', project: 'PROJECT_NAME',
      logTime: 'TOTAL_MIN', approvalStatus: 'STATUS',
      startDate: 'START_DATE', targetDate: 'TARGET_DATE',
      createdDate: 'CREATED_DATE', progress: 'PROGRESS',
      department: 'DEPT_NAME', assignedBy: 'ASSIGNED_BY',
      dailyComment: 'DAILY_COMMENT', description: 'DESCRIPTION'
    };
    return map[col] ?? 'LOG_DATE';
  }

  private sortEntries(): void {
    const dir = this.activeSortDir === 'ASC' ? 1 : -1;

    const getVal = (e: LogEntry): string | number => {
      switch (this.activeSortCol) {
        case 'EMPLOYEE_NAME':  return (e.employee?.name  ?? '').toLowerCase();
        case 'CATEGORY_NAME':  return (e.taskCategory?.name ?? '').toLowerCase();
        case 'TASK_TITLE':     return (e.taskTitle    ?? '').toLowerCase();
        case 'PROJECT_NAME':   return (e.project      ?? '').toLowerCase();
        case 'TOTAL_MIN':      return e.logTimeMins   ?? 0;
        case 'STATUS':         return (e.approvalStatus ?? '').toLowerCase();
        case 'START_DATE':     return e.startDate     ?? '';
        case 'TARGET_DATE':    return e.targetDate    ?? '';
        case 'CREATED_DATE':   return e.createdDate   ?? '';
        case 'PROGRESS':       return e.progress      ?? 0;
        case 'DEPT_NAME':      return (e.department   ?? '').toLowerCase();
        case 'ASSIGNED_BY':    return (e.assignedBy   ?? '').toLowerCase();
        case 'DAILY_COMMENT':  return (e.dailyComment ?? '').toLowerCase();
        case 'DESCRIPTION':    return (e.description  ?? '').toLowerCase();
        default:
          // cf_ custom field sort
          if (this.activeSortCol.startsWith('CF_')) {
            const fid = Number(this.activeSortCol.replace('CF_', ''));
            return (e.customFields?.[fid] ?? '').toLowerCase();
          }
          return '';
      }
    };

    this.logEntries.sort((a, b) => {
      const av = getVal(a), bv = getVal(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return  1 * dir;
      return 0;
    });
  }

  // ── Clear filters ─────────────────────────────────────────────────────────
  clearColFilter(col: string, event: Event): void {
    event.stopPropagation();
    const f = this.colFilters[col];
    f.searchText = ''; f.selectedValues.clear();
    f.dateFrom = ''; f.dateTo = '';
    f.timeVal  = null; f.timeOp = '>';

    if      (col === 'employee')       this.activeFilters.employeeIds       = [];
    else if (col === 'assignedBy')     this.activeFilters.assignedByIds     = [];
    else if (col === 'taskCategory')   this.activeFilters.categoryIds       = [];
    else if (col === 'project')        this.activeFilters.projectIds        = [];
    else if (col === 'approvalStatus') this.activeFilters.statuses          = [];
    else if (col === 'department')     this.activeFilters.deptIds           = [];
    else if (col === 'taskTitle')      this.activeFilters.taskTitleSearch   = '';
    else if (col === 'description')    this.activeFilters.descriptionSearch = '';
    else if (col === 'dailyComment')   this.activeFilters.commentSearch     = '';
    else if (col === 'logTime')      { this.activeFilters.logTimeOp = ''; this.activeFilters.logTimeMin = null; }
    else if (col === 'startDate')    { this.activeFilters.startDateFrom   = ''; this.activeFilters.startDateTo   = ''; }
    else if (col === 'targetDate')   { this.activeFilters.targetDateFrom  = ''; this.activeFilters.targetDateTo  = ''; }
    else if (col === 'createdDate')  { this.activeFilters.createdDateFrom = ''; this.activeFilters.createdDateTo = ''; }

    this.openFilterCol = null;
    this.resetPagination();
    this.loadData();
  }

  clearAllFilters(): void {
    this.searchTerm = '';
    this.activeFilters = {
      employeeIds: [], assignedByIds: [], categoryIds: [], projectIds: [],
      statuses: [], deptIds: [], comLocs: [],
      taskTitleSearch: '', descriptionSearch: '', commentSearch: '',
      logTimeOp: '', logTimeMin: null,
      startDateFrom: '', startDateTo: '', targetDateFrom: '', targetDateTo: '',
      createdDateFrom: '', createdDateTo: '', logDateFrom: '', logDateTo: '',
    };
    this.allColumns.forEach(c => {
      this.colFilters[c.key].searchText = '';
      this.colFilters[c.key].selectedValues.clear();
      this.colFilters[c.key].sortDir = null;
      this.colFilters[c.key].dateFrom = ''; this.colFilters[c.key].dateTo = '';
      this.colFilters[c.key].timeVal  = null; this.colFilters[c.key].timeOp = '>';
    });
    this.activeSortCol = 'LOG_DATE';
    this.activeSortDir = 'DESC';
    this.resetPagination();
    this.loadData();
  }

  get activeFiltersCount(): number {
    const f = this.activeFilters;
    let n = 0;
    if (f.employeeIds.length)     n++;
    if (f.assignedByIds.length)   n++;
    if (f.categoryIds.length)     n++;
    if (f.projectIds.length)      n++;
    if (f.statuses.length)        n++;
    if (f.deptIds.length)         n++;
    if (f.comLocs.length)         n++;
    if (f.taskTitleSearch)        n++;
    if (f.descriptionSearch)      n++;
    if (f.commentSearch)          n++;
    if (f.logTimeMin !== null)    n++;
    if (f.startDateFrom || f.startDateTo)     n++;
    if (f.targetDateFrom || f.targetDateTo)   n++;
    if (f.createdDateFrom || f.createdDateTo) n++;
    return n;
  }

  isFiltered(col: string): boolean {
    if (this.isTimeFilterCol(col))  return this.colFilters[col]?.timeVal !== null;
    if (this.isDateCol(col))        return !!(this.colFilters[col]?.dateFrom || this.colFilters[col]?.dateTo);
    if (this.isTextSearchCol(col))  return (this.colFilters[col]?.searchText ?? '').trim().length > 0;
    return this.colFilters[col]?.selectedValues.size > 0;
  }

  isTextSearchCol(col: string): boolean { return this.allColumns.find(c => c.key === col)?.textSearch ?? false; }
  isDateCol(col: string): boolean       { return !!(this.allColumns.find(c => c.key === col) as any)?.dateFilter; }
  isTimeFilterCol(col: string): boolean { return !!(this.allColumns.find(c => c.key === col) as any)?.timeFilter; }

  // ── Column filter dropdown ────────────────────────────────────────────────
  toggleColFilter(col: string, event: Event): void {
    event.stopPropagation();
    if (this.openFilterCol === col) { this.openFilterCol = null; return; }
    const btn  = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const panelWidth = 260;
    const left = Math.min(rect.left, window.innerWidth - panelWidth - 8);
    this.filterDropdownPos = { top: rect.bottom + 6, left: Math.max(4, left) };
    if (this.colFilters[col]) { this.colFilters[col].searchText = ''; }
    this.openFilterCol = col;
    this.filterDropdownItems = this.getFilteredUniqueValues(col);
  }

  closeAllDropdowns(): void { this.openFilterCol = null; this.showGroupByMenu = false; this.showComLocMenu = false; this.empPopupEntry = null; }

  // ── Task detail modal ─────────────────────────────────────────────────────
  openTaskModal(entry: LogEntry, event: Event): void {
    event.stopPropagation();
    this.selectedTaskIdForModal     = entry.id;
    this.selectedCategoryIdForModal = entry.taskCategory?.id ?? 0;
    // Pass logged-in user if they are an assignee, otherwise pass any valid assignee ID
    // (modal needs a valid assignee userId for the GetTaskById API call)
    const isAssignee = entry.assigneeIds.includes(this.userId);
    this.selectedUserIdForModal  = isAssignee
      ? this.userId
      : (entry.assigneeIds[0] || entry.employee?.id || this.userId);
    this.isTaskModalViewOnly     = !isAssignee;
    this.showTaskDetailsModal    = true;
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
  }

  closeTaskDetailsModal(): void {
    this.showTaskDetailsModal    = false;
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
  }

  // Keep modal open for AUTO CLOSED tasks — the modal handles log-time internally
  onModalShowLogTime(_data: any): void { }

  // ── Global search (client-side only — no backend call) ───────────────────
  onSearch(): void { /* filtering handled reactively by filteredEntries getter */ }

  // ── Filter dropdown search input ──────────────────────────────────────────
  onFilterSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (!this.openFilterCol) return;
    this.colFilters[this.openFilterCol].searchText = val;
    this.filterDropdownItems = this.getFilteredUniqueValues(this.openFilterCol);
    if (this.isTextSearchCol(this.openFilterCol)) {
      this.applyFilters();
    }
  }

  // ── GroupBy ───────────────────────────────────────────────────────────────
  get groupByLabel(): string { return this.groupByOptions.find(o => o.value === this.groupBy)?.label ?? 'Task Category'; }
  get groupByIcon():  string { return this.groupByOptions.find(o => o.value === this.groupBy)?.icon  ?? 'fa-tag'; }

  toggleGroupByMenu(e: Event): void { e.stopPropagation(); this.showGroupByMenu = !this.showGroupByMenu; }

  setGroupBy(v: string, e: Event): void {
    e.stopPropagation();
    this.groupBy         = v;
    this.showGroupByMenu = false;
    if (this.userId) {
      this.api.saveAnalyticsSetting({ userId: this.userId, settingKey: 'GROUP_BY', settingValue: v }).subscribe();
    }
    this.resetPagination();
    this.loadData();
  }

  // ── COM_LOC filter ────────────────────────────────────────────────────────
  get comLocLabel(): string {
    const sel = this.activeFilters.comLocs;
    if (!sel.length) return 'All Locations';
    if (sel.length === 1) return this.comLocOptions.find(o => o.value === sel[0])?.label ?? sel[0];
    return `${sel.length} Locations`;
  }
  toggleComLocMenu(e: Event): void { e.stopPropagation(); this.showComLocMenu = !this.showComLocMenu; this.showGroupByMenu = false; }
  toggleComLoc(val: string, e: Event): void {
    e.stopPropagation();
    const idx = this.activeFilters.comLocs.indexOf(val);
    if (idx === -1) this.activeFilters.comLocs.push(val);
    else            this.activeFilters.comLocs.splice(idx, 1);
    this.resetPagination();
    this.loadData();
  }
  clearComLocs(e: Event): void {
    e.stopPropagation();
    this.activeFilters.comLocs = [];
    this.showComLocMenu = false;
    this.resetPagination();
    this.loadData();
  }

  // ── Columns panel ─────────────────────────────────────────────────────────
  toggleColumnsPanel(): void { this.showColumnsPanel = !this.showColumnsPanel; }

  saveColumnsSettings(): void {
    this.showColumnsPanel = false;
    if (!this.userId) return;
    const prefs = this.allColumns.map((c, i) => ({
      colKey: c.key, isVisible: this.visibleColumns[c.key] ? 'Y' : 'N',
      colOrder: i + 1, colWidth: this.columnWidths[c.key] ?? 120
    }));
    this.api.saveLogColPrefs({ userId: this.userId, prefs }).subscribe();
  }

  resetColumnsToDefault(): void {
    // Reset fixed columns — keep custom field visibility as-is
    const fixed: { [k: string]: boolean } = {
      employee: true, taskCategory: true, taskTitle: true, project: true,
      description: true, dailyComment: true, logTime: true,
      approvalStatus: true, startDate: false, targetDate: false,
      createdDate: false, assignedBy: false, progress: false,
      department: false, dprId: false
    };
    Object.keys(this.visibleColumns).forEach(k => {
      this.visibleColumns[k] = fixed.hasOwnProperty(k) ? fixed[k] : false;
    });
  }

  get visibleCols(): typeof this.allColumns { return this.allColumns.filter(c => this.visibleColumns[c.key]); }

  // ── Column resize ─────────────────────────────────────────────────────────
  startResize(event: MouseEvent, col: string): void {
    event.preventDefault(); event.stopPropagation();
    this.resizing = true; this.resizingColumn = col;
    this.startX   = event.clientX;
    this.startWidth = this.columnWidths[col] || 120;
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.resizing) return;
    this.columnWidths[this.resizingColumn] = Math.max(60, this.startWidth + event.clientX - this.startX);
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    if (!this.resizing) return;
    this.resizing = false; this.resizingColumn = '';
    document.body.style.cursor = ''; document.body.style.userSelect = '';
    if (this.userId) { this.persistColPrefs(); }
  }

  // ── Column drag-reorder ───────────────────────────────────────────────────
  onColDragStart(event: DragEvent, key: string): void {
    if (this.resizing) { event.preventDefault(); return; }
    this.dragSourceKey = key; this.dragOverKey = null;
    if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', key); }
  }

  onColDragOver(event: DragEvent, key: string): void {
    if (!this.dragSourceKey || this.dragSourceKey === key) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverKey  = key;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.dragOverSide = event.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
  }

  onColDragLeave(key: string): void { if (this.dragOverKey === key) this.dragOverKey = null; }

  onColDrop(event: DragEvent, targetKey: string): void {
    event.preventDefault();
    if (!this.dragSourceKey || this.dragSourceKey === targetKey) { this.dragSourceKey = null; this.dragOverKey = null; return; }
    const cols    = this.allColumns;
    const fromIdx = cols.findIndex(c => c.key === this.dragSourceKey);
    const [moved] = cols.splice(fromIdx, 1);
    let insertAt  = cols.findIndex(c => c.key === targetKey);
    if (this.dragOverSide === 'right') insertAt++;
    cols.splice(insertAt, 0, moved);
    this.dragSourceKey = null; this.dragOverKey = null;
    if (this.userId) { this.persistColPrefs(); }
  }

  onColDragEnd(): void { this.dragSourceKey = null; this.dragOverKey = null; }

  private persistColPrefs(): void {
    const prefs = this.allColumns.map((c, i) => ({
      colKey: c.key, isVisible: this.visibleColumns[c.key] ? 'Y' : 'N',
      colOrder: i + 1, colWidth: this.columnWidths[c.key] ?? 120
    }));
    this.api.saveLogColPrefs({ userId: this.userId, prefs }).subscribe();
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  get totalPages(): number { return Math.max(1, Math.ceil(this.totalRecords / this.pageSize)); }

  private resetPagination(): void {
    this.currentPage = 1;
  }

  previousPage(): void { if (this.currentPage > 1) { this.currentPage--; this.loadData(); } }
  nextPage():     void { if (this.currentPage < this.totalPages) { this.currentPage++; this.loadData(); } }

  onPageSizeChange(): void { this.resetPagination(); this.loadData(); }

  // ── Custom field client-side filter ──────────────────────────────────────
  private applyCustomFieldFilters(entries: LogEntry[]): LogEntry[] {
    let result = entries;

    this.customFieldDefs.forEach(def => {
      const key    = `cf_${def.fieldId}`;
      const filter = this.colFilters[key];
      if (!filter) return;

      // Text / free-input fields — filter by searchText
      if (def.fieldType !== 'dropdown') {
        const text = (filter.searchText ?? '').trim().toLowerCase();
        if (text) {
          result = result.filter(e => {
            const v = (e.customFields[def.fieldId] ?? '').toLowerCase();
            return v.includes(text);
          });
        }
      } else {
        // Dropdown fields — filter by selected checkbox values
        if (filter.selectedValues.size > 0) {
          result = result.filter(e => {
            const v = e.customFields[def.fieldId] ?? '';
            return filter.selectedValues.has(v);
          });
        }
      }
    });

    return result;
  }

  // ── Export ────────────────────────────────────────────────────────────────
  exportLoading = false;

  exportData(): void {
    const f = this.activeFilters;
    this.exportLoading = true;

    const expEmployeeIds = this.isNormal
      ? (this.userId ? this.userId : null)
      : (f.employeeIds.length ? f.employeeIds.join(',') : null);
    const expDeptIds = f.deptIds.length ? f.deptIds.join(',') : null;

    const request = {
      userId:          this.userId,
      groupBy:         this.groupBy,
      employeeIds:     expEmployeeIds,
      categoryIds:     f.categoryIds.length  ? f.categoryIds.join(',')  : null,
      projectIds:      f.projectIds.length   ? f.projectIds.join(',')   : null,
      statuses:        f.statuses.length     ? f.statuses.join(',')     : null,
      deptIds:         expDeptIds,
      taskTitle:       f.taskTitleSearch   || null,
      description:     f.descriptionSearch || null,
      dailyComment:    f.commentSearch     || null,
      logTimeOp:       f.logTimeOp         || null,
      logTimeMin:      f.logTimeMin,
      startDateFrom:   f.startDateFrom   || null,
      startDateTo:     f.startDateTo     || null,
      targetDateFrom:  f.targetDateFrom  || null,
      targetDateTo:    f.targetDateTo    || null,
      createdDateFrom: f.createdDateFrom || null,
      createdDateTo:   f.createdDateTo   || null,
      logDateFrom:     f.logDateFrom     || null,
      logDateTo:       f.logDateTo       || null,
      sortCol:         this.activeSortCol,
      sortDir:         this.activeSortDir,
      pageNumber:      1,
      pageSize:        999999,
      exportAll:       'Y'
    };

    this.api.getLogAnalytics(request).subscribe({
      next: (res: any) => {
        const result      = res?.data ?? res ?? {};
        const rows: LogAnalyticsRow[] = result.data ?? [];

        // Rebuild custom value map for export rows
        const exportCustomMap = new Map<number, Map<number, string | null>>();
        (result.customValues ?? []).forEach((cv: TaskFieldValue) => {
          if (!exportCustomMap.has(cv.taskId)) exportCustomMap.set(cv.taskId, new Map());
          exportCustomMap.get(cv.taskId)!.set(cv.fieldId, cv.fieldValue ?? null);
        });

        // Build export entries (all rows, no paging)
        const entries = this._buildExportEntries(rows, exportCustomMap);

        // Apply custom field filters client-side
        const filtered = this._applyCustomFieldFiltersToEntries(entries);

        this._downloadCSV(filtered);
        this.exportLoading = false;
      },
      error: () => { this.exportLoading = false; }
    });
  }

  private _buildExportEntries(
    rows: LogAnalyticsRow[],
    cfMap: Map<number, Map<number, string | null>>
  ): LogEntry[] {
    // Temporarily swap the instance customValueMap for export
    const saved = this.customValueMap;
    this.customValueMap = cfMap;
    const entries = this.transformRows(rows);
    this.customValueMap = saved;
    return entries;
  }

  private _applyCustomFieldFiltersToEntries(entries: LogEntry[]): LogEntry[] {
    return this.applyCustomFieldFilters(entries);
  }

  private _downloadCSV(entries: LogEntry[]): void {
    // Export only columns currently visible in the UI, in the user's column order.
    // Custom labels for columns whose display label differs from what export needs.
    const exportLabel: { [key: string]: string } = {
      logTime: 'Log Time (HH:MM)', progress: 'Progress %', dprId: 'Task ID'
    };

    const visibleCols = this.allColumns
      .filter(c => this.visibleColumns[c.key] === true)
      .map(c => ({ key: c.key, label: exportLabel[c.key] ?? c.label }));

    // Group column always first — gives grouping context regardless of column visibility
    const allCols = [{ key: 'group', label: 'Group' }, ...visibleCols];

    const escape = (v: any): string => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const getCellValue = (entry: LogEntry, key: string): string => {
      switch (key) {
        case 'group':          return entry.groupLabel;
        case 'employee':       return entry.employees.map(e => e.name).join(' | ');
        case 'department':     return entry.department;
        case 'taskCategory':   return entry.taskCategory.name;
        case 'taskTitle':      return entry.taskTitle;
        case 'project':        return entry.project;
        case 'approvalStatus': return entry.approvalStatus;
        case 'logTime':        return entry.logTime;
        case 'startDate':      return entry.startDate;
        case 'targetDate':     return entry.targetDate;
        case 'createdDate':    return entry.createdDate;
        case 'assignedBy':     return entry.assignedBy;
        case 'progress':       return String(entry.progress);
        case 'description':    return entry.description;
        case 'dailyComment':   return entry.dailyComment;
        case 'dprId':          return entry.dprId;
        default:
          if (key.startsWith('cf_')) {
            const fid = Number(key.replace('cf_', ''));
            return entry.customFields[fid] ?? '';
          }
          return '';
      }
    };

    const header = allCols.map(c => escape(c.label)).join(',');
    const dataRows = entries.map(entry =>
      allCols.map(c => escape(getCellValue(entry, c.key))).join(',')
    );

    const csv     = [header, ...dataRows].join('\r\n');
    const blob    = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url     = URL.createObjectURL(blob);
    const anchor  = document.createElement('a');
    const date    = new Date().toISOString().slice(0, 10);
    anchor.href     = url;
    anchor.download = `log-analytics-${this.groupBy}-${date}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // ── Close dropdowns on outside click ─────────────────────────────────────
  @HostListener('document:click')
  onDocClick(): void { this.closeAllDropdowns(); }

  // ── Helpers ───────────────────────────────────────────────────────────────
  minsToHHMM(mins: number): string {
    if (!mins || mins < 0) return '00:00';
    const totalMins = Math.round(mins);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  getEmployeeInitials(n: string): string {
    return (n || '').split(' ').map(x => x[0]).join('').toUpperCase().substring(0, 2);
  }

  private AVATAR_COLORS = ['#6366F1','#EC4899','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EF4444','#14B8A6'];
  getAvatarColor(name: string): string {
    let h = 0;
    for (const c of (name || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    return this.AVATAR_COLORS[Math.abs(h) % this.AVATAR_COLORS.length];
  }

  getProjectColor(name: string): string {
    const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  private categoryColorIndex(name: string): number {
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash);
  }

  getCategoryBg(name: string): string {
    const bgs = ['#dbeafe','#d1fae5','#fef3c7','#fee2e2','#ede9fe','#fce7f3','#e0f2fe','#dcfce7'];
    return bgs[this.categoryColorIndex(name) % bgs.length];
  }

  getCategoryTxt(name: string): string {
    const txts = ['#1d4ed8','#065f46','#92400e','#b91c1c','#6d28d9','#9d174d','#0369a1','#166534'];
    return txts[this.categoryColorIndex(name) % txts.length];
  }

  getCategoryShortLabel(name: string): string {
    return name || '—';
  }

  getOverflowEmpNames(entry: LogEntry): string {
    return entry.employees.slice(3).map(e => e.name).join(', ');
  }

  getTimeBreakdown(entry: LogEntry): string {
    return entry.employees.map((em, i) => `${em.name}: ${entry.logTimes[i] ?? ''}`).join(' | ');
  }

  private formatDate(d: string | null): string {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
  }

  // ── Employee popup ─────────────────────────────────────────────────────────
  toggleEmpPopup(entry: LogEntry, event: Event): void {
    event.stopPropagation();
    if (this.empPopupEntry === entry) { this.empPopupEntry = null; return; }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const popupH = Math.min(entry.employees.length * 46 + 48, 320);
    const top    = rect.bottom + window.scrollY + 4;
    const left   = Math.min(rect.left + window.scrollX, window.innerWidth - 260);
    this.empPopupPos  = { top, left };
    this.empPopupEntry = entry;
  }

  // ── Status badge helpers ───────────────────────────────────────────────────
  private STATUS_MAP: Record<string, { bg: string; txt: string; border: string; icon: string }> = {
    'completed':   { bg: '#dcfce7', txt: '#15803d', border: '#86efac', icon: 'fa-circle-check'  },
    'running':     { bg: '#dbeafe', txt: '#1d4ed8', border: '#93c5fd', icon: 'fa-circle-play'   },
    'inprogress':  { bg: '#dbeafe', txt: '#1d4ed8', border: '#93c5fd', icon: 'fa-circle-play'   },
    'in progress': { bg: '#dbeafe', txt: '#1d4ed8', border: '#93c5fd', icon: 'fa-circle-play'   },
    'paused':      { bg: '#fef9c3', txt: '#a16207', border: '#fde047', icon: 'fa-circle-pause'  },
    'pending':     { bg: '#ffedd5', txt: '#c2410c', border: '#fb923c', icon: 'fa-hourglass-half'},
    'closed':      { bg: '#e0e7ff', txt: '#4338ca', border: '#a5b4fc', icon: 'fa-circle-xmark'  },
    'cancelled':   { bg: '#fce7f3', txt: '#be185d', border: '#f9a8d4', icon: 'fa-ban'           },
    'canceled':    { bg: '#fce7f3', txt: '#be185d', border: '#f9a8d4', icon: 'fa-ban'           },
    'rejected':    { bg: '#fee2e2', txt: '#b91c1c', border: '#fca5a5', icon: 'fa-circle-exclamation' },
    'approved':    { bg: '#dcfce7', txt: '#15803d', border: '#86efac', icon: 'fa-circle-check'  },
    'review':      { bg: '#ede9fe', txt: '#6d28d9', border: '#c4b5fd', icon: 'fa-magnifying-glass' },
    'on hold':     { bg: '#fef9c3', txt: '#a16207', border: '#fde047', icon: 'fa-circle-pause'  },
    'onhold':      { bg: '#fef9c3', txt: '#a16207', border: '#fde047', icon: 'fa-circle-pause'  },
    'open':        { bg: '#e0f2fe', txt: '#0369a1', border: '#7dd3fc', icon: 'fa-circle-dot'    },
    'reopen':      { bg: '#fef3c7', txt: '#b45309', border: '#fcd34d', icon: 'fa-rotate-left'   },
    'overdue':     { bg: '#fee2e2', txt: '#b91c1c', border: '#fca5a5', icon: 'fa-triangle-exclamation' },
    'draft':       { bg: '#f1f5f9', txt: '#475569', border: '#cbd5e1', icon: 'fa-file-pen'      },
    'new':         { bg: '#e0f2fe', txt: '#0369a1', border: '#7dd3fc', icon: 'fa-star'          },
    'assigned':    { bg: '#fae8ff', txt: '#86198f', border: '#e879f9', icon: 'fa-user-check'    },
    'todo':        { bg: '#f1f5f9', txt: '#475569', border: '#cbd5e1', icon: 'fa-list-check'    },
    'to do':       { bg: '#f1f5f9', txt: '#475569', border: '#cbd5e1', icon: 'fa-list-check'    },
    'hold':        { bg: '#fef9c3', txt: '#a16207', border: '#fde047', icon: 'fa-circle-pause'  },
    'active':      { bg: '#dcfce7', txt: '#15803d', border: '#86efac', icon: 'fa-circle-play'   },
  };

  private _statusKey(s: string): string { return (s || '').toLowerCase().trim(); }

  getStatusBg(s: string): string     { return (this.STATUS_MAP[this._statusKey(s)] ?? this._statusFallback(s)).bg;     }
  getStatusTxt(s: string): string    { return (this.STATUS_MAP[this._statusKey(s)] ?? this._statusFallback(s)).txt;    }
  getStatusBorder(s: string): string { return (this.STATUS_MAP[this._statusKey(s)] ?? this._statusFallback(s)).border; }
  getStatusIcon(s: string): string   { return (this.STATUS_MAP[this._statusKey(s)] ?? this._statusFallback(s)).icon;   }

  private _FALLBACK_BG  = ['#dbeafe','#d1fae5','#fef9c3','#fee2e2','#ede9fe','#fce7f3','#e0f2fe','#dcfce7'];
  private _FALLBACK_TXT = ['#1d4ed8','#065f46','#854d0e','#991b1b','#6d28d9','#9d174d','#0369a1','#166534'];
  private _statusFallback(s: string): { bg: string; txt: string; border: string; icon: string } {
    let h = 0;
    for (const c of (s || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    const i = Math.abs(h) % this._FALLBACK_BG.length;
    return { bg: this._FALLBACK_BG[i], txt: this._FALLBACK_TXT[i], border: this._FALLBACK_TXT[i] + '66', icon: 'fa-circle' };
  }
}
