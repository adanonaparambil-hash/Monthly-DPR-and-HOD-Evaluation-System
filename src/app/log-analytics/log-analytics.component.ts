import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Employee { id: string; name: string; }
interface TaskCategory { id: number; name: string; taskCount: number; totalHours: string; }
interface LogEntry {
  id: number; employee: Employee; taskCategory: TaskCategory;
  taskTitle: string; project: string; description: string; dailyComment: string;
  logTime: string; department: string; location: string; dprId: string;
  approvalStatus: 'running' | 'completed' | 'paused' | 'closed';
  startDate: string; targetDate: string; createdDate: string;
  assignedBy: string; progress: number; dailyCount: number;
}

// A grouped row: single task, potentially multiple employees who logged time
interface GroupedEntry extends LogEntry {
  employees: Employee[];       // all employees who logged this task
  logTimes: string[];          // individual log times per employee
  totalLogTime: string;        // sum of all log times for display
}

// Per-column filter state
interface ColFilter {
  searchText: string;
  selectedValues: Set<string>;
  sortDir: 'asc' | 'desc' | null;
  dateFrom: string;
  dateTo:   string;
  timeOp:   '>' | '>=' | '<' | '<=' | '=';  // for logTime arithmetic filter
  timeVal:  number | null;                   // hours value (e.g. 5 for "5 hours")
}

@Component({
  selector: 'app-log-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './log-analytics.component.html',
  styleUrls: ['./log-analytics.component.css']
})
export class LogAnalyticsComponent implements OnInit {
  Math = Math;

  // ── Global search (top bar) ──────────────────────────────────────────────
  searchTerm = '';

  // ── UI state ─────────────────────────────────────────────────────────────
  showColumnsPanel = false;
  showGroupByMenu  = false;
  groupBy = 'taskCategory';

  // ── Column filter dropdowns ───────────────────────────────────────────────
  openFilterCol: string | null = null;   // which column dropdown is open
  colFilters: { [col: string]: ColFilter } = {};

  // ── Column definitions ────────────────────────────────────────────────────
  allColumns = [
    { key: 'employee',       label: 'Employee',        icon: 'fa-user',         textSearch: false },
    { key: 'taskCategory',   label: 'Category',        icon: 'fa-tag',          textSearch: false },
    { key: 'taskTitle',      label: 'Task Title',      icon: 'fa-list-check',   textSearch: true  },
    { key: 'project',        label: 'Project',         icon: 'fa-cube',         textSearch: false },
    { key: 'description',    label: 'Description',     icon: 'fa-align-left',   textSearch: true  },
    { key: 'dailyComment',   label: 'Daily Comment',   icon: 'fa-comment',      textSearch: true  },
    { key: 'logTime',        label: 'Log Time',        icon: 'fa-clock',        textSearch: false, timeFilter: true  },
    { key: 'approvalStatus', label: 'Status',          icon: 'fa-circle-check', textSearch: false },
    { key: 'startDate',      label: 'Start Date',      icon: 'fa-calendar-plus', textSearch: false, dateFilter: true  },
    { key: 'targetDate',     label: 'Target Date',     icon: 'fa-calendar-check',textSearch: false, dateFilter: true  },
    { key: 'createdDate',    label: 'Created Date',    icon: 'fa-calendar',      textSearch: false, dateFilter: true  },
    { key: 'assignedBy',     label: 'Assigned By',     icon: 'fa-user-tie',      textSearch: false, dateFilter: false },
    { key: 'progress',       label: 'Progress',        icon: 'fa-chart-line',    textSearch: false, dateFilter: false },
    { key: 'dailyCount',     label: 'Daily Count',     icon: 'fa-hashtag',       textSearch: false, dateFilter: false },
    { key: 'department',     label: 'Department',      icon: 'fa-building',      textSearch: false, dateFilter: false },
    { key: 'location',       label: 'Location',        icon: 'fa-location-dot',  textSearch: false, dateFilter: false },
    { key: 'dprId',          label: 'DPR ID',          icon: 'fa-hashtag',       textSearch: false, dateFilter: false },
  ];

  visibleColumns: { [key: string]: boolean } = {
    employee: true, taskCategory: true, taskTitle: true, project: true,
    description: true, dailyComment: true, logTime: true,
    approvalStatus: true, startDate: false, targetDate: false,
    createdDate: false, assignedBy: false, progress: false,
    dailyCount: false, department: false, location: false, dprId: false
  };

  // ── Column widths (resizable) ─────────────────────────────────────────────
  columnWidths: { [key: string]: number } = {
    employee: 200, taskCategory: 120, taskTitle: 190, project: 140,
    description: 260, dailyComment: 200, logTime: 100,
    approvalStatus: 120, startDate: 120, targetDate: 120,
    createdDate: 120, assignedBy: 160, progress: 130,
    dailyCount: 110, department: 130, location: 130, dprId: 100
  };

  private resizing = false;
  private resizingColumn = '';
  private startX = 0;
  private startWidth = 0;

  // ── Column drag-to-reorder ────────────────────────────────────────────────
  dragSourceKey: string | null = null;   // column being dragged
  dragOverKey:   string | null = null;   // column currently hovered over
  dragOverSide:  'left' | 'right' = 'left'; // which half of the target is hovered

  // ── Pagination ────────────────────────────────────────────────────────────
  currentPage = 1;
  pageSize = 20;

  // ── GroupBy ───────────────────────────────────────────────────────────────
  groupByOptions = [
    { value: 'taskCategory', label: 'Task Category', icon: 'fa-tag'      },
    { value: 'employee',     label: 'Employee',      icon: 'fa-user'     },
    { value: 'department',   label: 'Department',    icon: 'fa-building' },
    { value: 'project',      label: 'Project',       icon: 'fa-cube'     },
    { value: 'date',         label: 'Date',          icon: 'fa-calendar' },
  ];

  // ── Data ──────────────────────────────────────────────────────────────────
  logEntries: LogEntry[] = [];
  filteredLogEntries: LogEntry[] = [];
  employees: Employee[] = [];
  taskCategories: TaskCategory[] = [];
  visibleCategories: TaskCategory[] = [];
  expandedCategories: { [key: string]: boolean } = {};
  private readonly INITIAL_VISIBLE = 999; // show all by default

  constructor(private elRef: ElementRef) {}

  ngOnInit(): void {
    this.initializeMockData();
    this.initColFilters();
    this.applyFilters();
    this.taskCategories.forEach(c => { this.expandedCategories[c.name] = true; });
  }

  // ── Init per-column filter state ─────────────────────────────────────────
  initColFilters(): void {
    this.allColumns.forEach(c => {
      this.colFilters[c.key] = {
        searchText: '', selectedValues: new Set(), sortDir: null,
        dateFrom: '', dateTo: '', timeOp: '>', timeVal: null
      };
    });
  }

  // ── Get raw cell value for a given column key ─────────────────────────────
  getCellValue(entry: LogEntry, col: string): string {
    switch (col) {
      case 'employee':       return entry.employee.name;
      case 'taskCategory':   return this.getCategoryShortLabel(entry.taskCategory.name);
      case 'taskTitle':      return entry.taskTitle;
      case 'project':        return entry.project;
      case 'description':    return entry.description || '—';
      case 'dailyComment':   return entry.dailyComment || '—';
      case 'logTime':        return entry.logTime;
      case 'approvalStatus': return entry.approvalStatus;
      case 'startDate':      return entry.startDate || '—';
      case 'targetDate':     return entry.targetDate || '—';
      case 'createdDate':    return entry.createdDate || '—';
      case 'assignedBy':     return entry.assignedBy || '—';
      case 'progress':       return entry.progress != null ? entry.progress + '%' : '0%';
      case 'dailyCount':     return entry.dailyCount != null ? String(entry.dailyCount) : '0';
      case 'department':     return entry.department;
      case 'location':       return entry.location;
      case 'dprId':          return entry.dprId;
      default:               return '';
    }
  }

  // ── Unique values in a column (for checkbox list) ─────────────────────────
  getUniqueValues(col: string): string[] {
    const vals = new Set<string>();
    this.logEntries.forEach(e => vals.add(this.getCellValue(e, col)));
    return Array.from(vals).sort();
  }

  // ── Filtered unique values (respects the search box inside the dropdown) ─
  getFilteredUniqueValues(col: string): string[] {
    const search = (this.colFilters[col]?.searchText || '').toLowerCase();
    return this.getUniqueValues(col).filter(v => v.toLowerCase().includes(search));
  }

  // ── Check if ALL visible values are selected ──────────────────────────────
  allSelected(col: string): boolean {
    const visible = this.getFilteredUniqueValues(col);
    const sel = this.colFilters[col].selectedValues;
    return visible.length > 0 && visible.every(v => sel.has(v));
  }

  // ── Toggle Select All for a column ───────────────────────────────────────
  toggleSelectAll(col: string): void {
    const visible = this.getFilteredUniqueValues(col);
    if (this.allSelected(col)) {
      visible.forEach(v => this.colFilters[col].selectedValues.delete(v));
    } else {
      visible.forEach(v => this.colFilters[col].selectedValues.add(v));
    }
    this.applyFilters();
  }

  // ── Toggle a single checkbox value ───────────────────────────────────────
  toggleValue(col: string, val: string): void {
    const s = this.colFilters[col].selectedValues;
    s.has(val) ? s.delete(val) : s.add(val);
    this.applyFilters();
  }

  // ── Open / close column filter dropdown ──────────────────────────────────
  toggleColFilter(col: string, event: Event): void {
    event.stopPropagation();
    if (this.openFilterCol === col) {
      this.openFilterCol = null;
    } else {
      this.openFilterCol = col;
      // Pre-select all if nothing selected yet
      if (this.colFilters[col].selectedValues.size === 0) {
        this.getUniqueValues(col).forEach(v => this.colFilters[col].selectedValues.add(v));
      }
    }
  }

  closeAllDropdowns(): void { this.openFilterCol = null; this.showGroupByMenu = false; }

  // ── Sort from column header ───────────────────────────────────────────────
  sortBy(col: string, event: Event): void {
    event.stopPropagation();
    const f = this.colFilters[col];
    if (f.sortDir === null || f.sortDir === 'desc') {
      // Clear all other sorts
      this.allColumns.forEach(c => { if (c.key !== col) this.colFilters[c.key].sortDir = null; });
      f.sortDir = 'asc';
    } else {
      f.sortDir = 'desc';
    }
    this.applyFilters();
  }

  // ── Is this a free-text search column (no checkbox list)? ───────────────
  isTextSearchCol(col: string): boolean {
    return this.allColumns.find(c => c.key === col)?.textSearch ?? false;
  }

  // ── Is this a date-range filter column? ───────────────────────────────────
  isDateCol(col: string): boolean {
    return (this.allColumns.find(c => c.key === col) as any)?.dateFilter ?? false;
  }

  // ── Is this an arithmetic time-filter column? ─────────────────────────────
  isTimeFilterCol(col: string): boolean {
    return (this.allColumns.find(c => c.key === col) as any)?.timeFilter ?? false;
  }

  // ── Parse DD/MM/YYYY → Date (for comparison) ──────────────────────────────
  private parseDate(str: string): Date | null {
    if (!str) return null;
    // Input type=date gives YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str);
    // Stored as DD/MM/YYYY
    const [d, m, y] = str.split('/');
    if (!d || !m || !y) return null;
    return new Date(`${y}-${m}-${d}`);
  }

  // ── Does this column have an active filter? ───────────────────────────────
  isFiltered(col: string): boolean {
    const f = this.colFilters[col];
    if (!f) return false;
    if (this.isTimeFilterCol(col))  return f.timeVal !== null && f.timeVal >= 0;
    if (this.isDateCol(col))        return !!(f.dateFrom || f.dateTo);
    if (this.isTextSearchCol(col))  return (f.searchText || '').trim().length > 0;
    const all = this.getUniqueValues(col);
    return f.selectedValues.size > 0 && f.selectedValues.size < all.length;
  }

  // ── Total active filters across all columns ───────────────────────────────
  get activeFiltersCount(): number {
    return this.allColumns.filter(c => this.isFiltered(c.key)).length;
  }

  // ── Clear a single column filter ─────────────────────────────────────────
  clearColFilter(col: string, event: Event): void {
    event.stopPropagation();
    this.colFilters[col].searchText = '';
    this.colFilters[col].dateFrom   = '';
    this.colFilters[col].dateTo     = '';
    this.colFilters[col].timeVal    = null;
    this.colFilters[col].timeOp     = '>';
    if (!this.isTextSearchCol(col) && !this.isDateCol(col) && !this.isTimeFilterCol(col)) {
      const all = this.getUniqueValues(col);
      all.forEach(v => this.colFilters[col].selectedValues.add(v));
    }
    this.applyFilters();
    this.openFilterCol = null;
  }

  // ── Clear all filters ─────────────────────────────────────────────────────
  clearAllFilters(): void {
    this.searchTerm = '';
    this.allColumns.forEach(c => {
      this.colFilters[c.key].searchText = '';
      this.colFilters[c.key].sortDir    = null;
      this.colFilters[c.key].dateFrom   = '';
      this.colFilters[c.key].dateTo     = '';
      this.colFilters[c.key].timeVal    = null;
      this.colFilters[c.key].timeOp     = '>';
      const all = this.getUniqueValues(c.key);
      all.forEach(v => this.colFilters[c.key].selectedValues.add(v));
    });
    this.applyFilters();
  }

  // ── Master filter + sort pipeline ────────────────────────────────────────
  applyFilters(): void {
    let result = [...this.logEntries];

    // Global search
    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      result = result.filter(e =>
        e.employee.name.toLowerCase().includes(q) ||
        e.taskTitle.toLowerCase().includes(q) ||
        e.project.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
      );
    }

    // Per-column value filters
    this.allColumns.forEach(c => {
      const f = this.colFilters[c.key];
      if (!f) return;

      if (this.isTimeFilterCol(c.key)) {
        // Arithmetic time filter: compare total minutes against threshold
        const f = this.colFilters[c.key];
        if (f.timeVal !== null && f.timeVal >= 0) {
          const thresholdMins = f.timeVal * 60;
          result = result.filter(e => {
            const mins = this.timeToMinutes(this.getCellValue(e, c.key));
            switch (f.timeOp) {
              case '>':  return mins >  thresholdMins;
              case '>=': return mins >= thresholdMins;
              case '<':  return mins <  thresholdMins;
              case '<=': return mins <= thresholdMins;
              case '=':  return mins === thresholdMins;
              default:   return true;
            }
          });
        }
      } else if (this.isDateCol(c.key)) {
        // Date-range filter
        const from = this.parseDate(f.dateFrom);
        const to   = this.parseDate(f.dateTo);
        if (from || to) {
          result = result.filter(e => {
            const cellDate = this.parseDate(this.getCellValue(e, c.key));
            if (!cellDate) return false;
            if (from && cellDate < from) return false;
            if (to)   { const toEnd = new Date(to); toEnd.setHours(23,59,59,999); if (cellDate > toEnd) return false; }
            return true;
          });
        }
      } else if (this.isTextSearchCol(c.key)) {
        // Text-search columns: filter by substring match on searchText
        const term = (f.searchText || '').trim().toLowerCase();
        if (term) {
          result = result.filter(e => this.getCellValue(e, c.key).toLowerCase().includes(term));
        }
      } else {
        // Checkbox columns: filter by selected set
        if (f.selectedValues.size === 0) return;
        const all = this.getUniqueValues(c.key);
        if (f.selectedValues.size < all.length) {
          result = result.filter(e => f.selectedValues.has(this.getCellValue(e, c.key)));
        }
      }
    });

    // Sort (find the active sorted column)
    const sortCol = this.allColumns.find(c => this.colFilters[c.key]?.sortDir !== null);
    if (sortCol) {
      const dir = this.colFilters[sortCol.key].sortDir === 'asc' ? 1 : -1;
      result.sort((a, b) => {
        let av = this.getCellValue(a, sortCol.key).toLowerCase();
        let bv = this.getCellValue(b, sortCol.key).toLowerCase();
        if (sortCol.key === 'logTime') {
          return (this.timeToMinutes(av) - this.timeToMinutes(bv)) * dir;
        }
        return av < bv ? -dir : av > bv ? dir : 0;
      });
    }

    this.filteredLogEntries = result;
    this.currentPage = 1;
    const ids = new Set(result.map(e => e.taskCategory.id));
    this.visibleCategories = this.taskCategories.filter(c => ids.has(c.id));
  }

  private timeToMinutes(t: string): number {
    const p = t.split(':');
    return p.length === 2 ? parseInt(p[0]) * 60 + parseInt(p[1]) : 0;
  }

  onSearch(): void { this.applyFilters(); }

  getEntriesForCategory(name: string): LogEntry[] {
    return this.filteredLogEntries.filter(e => e.taskCategory.name === name);
  }

  // ── Group rows that share the same taskTitle within a category ────────────
  getGroupedEntriesForCategory(categoryName: string): GroupedEntry[] {
    const rows = this.getEntriesForCategory(categoryName);
    const map = new Map<string, GroupedEntry>();

    rows.forEach(entry => {
      const key = entry.taskTitle.trim().toLowerCase();
      if (!map.has(key)) {
        // First occurrence — seed the grouped row
        const g: GroupedEntry = {
          ...entry,
          employees:    [entry.employee],
          logTimes:     [entry.logTime],
          totalLogTime: entry.logTime,
        };
        map.set(key, g);
      } else {
        // Subsequent occurrence — merge employee and log time
        const g = map.get(key)!;
        // Avoid duplicates (same employee logging twice)
        if (!g.employees.some(em => em.id === entry.employee.id)) {
          g.employees.push(entry.employee);
        }
        g.logTimes.push(entry.logTime);
        g.totalLogTime = this.sumLogTimes([...g.logTimes]);
      }
    });

    return Array.from(map.values());
  }

  // ── Helper: names of overflow employees for tooltip ─────────────────────
  getOverflowEmpNames(entry: GroupedEntry): string {
    return entry.employees.slice(3).map(e => e.name).join(', ');
  }

  // ── Helper: per-employee time breakdown for tooltip ───────────────────────
  getTimeBreakdown(entry: GroupedEntry): string {
    return entry.employees.map((em, i) => em.name + ': ' + (entry.logTimes[i] || '')).join(' | ');
  }

  // ── Sum an array of HH:MM strings ─────────────────────────────────────────
  sumLogTimes(times: string[]): string {
    let totalMins = 0;
    times.forEach(t => { totalMins += this.timeToMinutes(t); });
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  toggleCategory(name: string): void { this.expandedCategories[name] = !this.expandedCategories[name]; }

  // ── Columns panel ─────────────────────────────────────────────────────────
  toggleColumnsPanel(): void { this.showColumnsPanel = !this.showColumnsPanel; }
  toggleColumn(key: string): void { this.visibleColumns[key] = !this.visibleColumns[key]; }
  saveColumnsSettings(): void { this.showColumnsPanel = false; }
  resetColumnsToDefault(): void {
    this.visibleColumns = {
      employee: true, taskCategory: true, taskTitle: true, project: true,
      description: true, dailyComment: true, logTime: true,
      approvalStatus: true, startDate: false, targetDate: false,
      createdDate: false, assignedBy: false, progress: false,
      dailyCount: false, department: false, location: false, dprId: false
    };
  }
  get visibleCols(): typeof this.allColumns {
    return this.allColumns.filter(c => this.visibleColumns[c.key]);
  }

  // ── Grid template ─────────────────────────────────────────────────────────
  getGridTemplateColumns(): string {
    return this.visibleCols.map(c => `${Math.max(80, this.columnWidths[c.key] || 120)}px`).join(' ');
  }

  // ── Column resize ─────────────────────────────────────────────────────────
  startResize(event: MouseEvent, col: string): void {
    event.preventDefault(); event.stopPropagation();
    this.resizing = true; this.resizingColumn = col;
    this.startX = event.clientX;
    this.startWidth = this.columnWidths[col] || 120;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.resizing) return;
    const diff = event.clientX - this.startX;
    this.columnWidths[this.resizingColumn] = Math.max(60, this.startWidth + diff);
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    if (!this.resizing) return;
    this.resizing = false; this.resizingColumn = '';
    document.body.style.cursor = ''; document.body.style.userSelect = '';
  }

  // ── Column drag-reorder ───────────────────────────────────────────────────
  onColDragStart(event: DragEvent, key: string): void {
    if (this.resizing) { event.preventDefault(); return; }
    this.dragSourceKey = key;
    this.dragOverKey   = null;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', key);
    }
  }

  onColDragOver(event: DragEvent, key: string): void {
    if (!this.dragSourceKey || this.dragSourceKey === key) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverKey = key;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.dragOverSide = event.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
  }

  onColDragLeave(key: string): void {
    if (this.dragOverKey === key) this.dragOverKey = null;
  }

  onColDrop(event: DragEvent, targetKey: string): void {
    event.preventDefault();
    if (!this.dragSourceKey || this.dragSourceKey === targetKey) {
      this.dragSourceKey = null; this.dragOverKey = null; return;
    }
    const cols = this.allColumns;
    const fromIdx = cols.findIndex(c => c.key === this.dragSourceKey);
    const toIdx   = cols.findIndex(c => c.key === targetKey);
    if (fromIdx === -1 || toIdx === -1) { this.dragSourceKey = null; this.dragOverKey = null; return; }
    const [moved] = cols.splice(fromIdx, 1);
    let insertAt = cols.findIndex(c => c.key === targetKey);
    if (this.dragOverSide === 'right') insertAt += 1;
    cols.splice(insertAt, 0, moved);
    this.dragSourceKey = null;
    this.dragOverKey   = null;
  }

  onColDragEnd(): void {
    this.dragSourceKey = null;
    this.dragOverKey   = null;
  }

  // Close dropdowns on outside click
  @HostListener('document:click', ['$event'])
  onDocClick(event: Event): void {
    this.closeAllDropdowns();
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  get totalRecords(): number { return this.filteredLogEntries.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.totalRecords / this.pageSize)); }
  previousPage(): void { if (this.currentPage > 1) this.currentPage--; }
  nextPage(): void { if (this.currentPage < this.totalPages) this.currentPage++; }

  // ── Group by ──────────────────────────────────────────────────────────────
  get groupByLabel(): string { return this.groupByOptions.find(o => o.value === this.groupBy)?.label ?? 'Task Category'; }
  toggleGroupByMenu(e: Event): void { e.stopPropagation(); this.showGroupByMenu = !this.showGroupByMenu; }
  setGroupBy(v: string, e: Event): void { e.stopPropagation(); this.groupBy = v; this.showGroupByMenu = false; }

  // ── Export ────────────────────────────────────────────────────────────────
  exportData(): void { console.log('Export'); }

  // ── Category total hours ──────────────────────────────────────────────────
  getTotalHoursForCategory(name: string): string {
    return this.taskCategories.find(c => c.name === name)?.totalHours || '0:00';
  }

  // ── Generic group-by support ──────────────────────────────────────────────
  // Returns the group key for a log entry based on current groupBy value
  getGroupKey(entry: LogEntry): string {
    switch (this.groupBy) {
      case 'employee':     return entry.employee.name;
      case 'department':   return entry.department || 'Other';
      case 'project':      return entry.project || 'Other';
      case 'date':         return entry.startDate || 'No Date';
      default:             return entry.taskCategory.name; // taskCategory
    }
  }

  // Returns unique sorted group keys from filtered data
  get dynamicGroups(): string[] {
    const keys = new Set<string>();
    this.filteredLogEntries.forEach(e => keys.add(this.getGroupKey(e)));
    return Array.from(keys).sort();
  }

  // Returns entries (grouped by task title) for a given dynamic group key
  getGroupedEntriesForGroup(groupKey: string): GroupedEntry[] {
    const rows = this.filteredLogEntries.filter(e => this.getGroupKey(e) === groupKey);
    const map = new Map<string, GroupedEntry>();
    rows.forEach(entry => {
      const key = entry.taskTitle.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, { ...entry, employees: [entry.employee], logTimes: [entry.logTime], totalLogTime: entry.logTime });
      } else {
        const g = map.get(key)!;
        if (!g.employees.some(em => em.id === entry.employee.id)) g.employees.push(entry.employee);
        g.logTimes.push(entry.logTime);
        g.totalLogTime = this.sumLogTimes([...g.logTimes]);
      }
    });
    return Array.from(map.values());
  }

  // Group header icon based on groupBy
  get groupByIcon(): string {
    return this.groupByOptions.find(o => o.value === this.groupBy)?.icon ?? 'fa-tag';
  }

  // Total log time for a group (sum all filtered entries in that group)
  getGroupTotalTime(groupKey: string): string {
    const times = this.filteredLogEntries
      .filter(e => this.getGroupKey(e) === groupKey)
      .map(e => e.logTime);
    return this.sumLogTimes(times);
  }

  // Avatar/initials for employee group header
  getGroupAvatar(groupKey: string): string {
    if (this.groupBy === 'employee') return this.getAvatarColor(groupKey);
    return '';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getEmployeeInitials(n: string): string {
    return n.split(' ').map(x => x[0]).join('').toUpperCase().substring(0, 2);
  }
  private AVATAR_COLORS = ['#6366F1','#EC4899','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EF4444','#14B8A6'];
  getAvatarColor(name: string): string {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    return this.AVATAR_COLORS[Math.abs(h) % this.AVATAR_COLORS.length];
  }
  getProjectColor(name: string): string {
    const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  private CAT_LABEL: { [k: string]: string } = {
    'IT APPLICATION DEVELOPMENT': 'Development',
    'IT SECURITY SUPPORT':        'Security',
    'IT NETWORK SUPPORT':         'Network',
    'IT SITE VISIT':              'Site Visit'
  };
  getCategoryShortLabel(n: string): string { return this.CAT_LABEL[n] ?? n; }

  private CAT_COLOR: { [k: string]: string } = {
    'IT APPLICATION DEVELOPMENT': '#dbeafe',
    'IT SECURITY SUPPORT':        '#fee2e2',
    'IT NETWORK SUPPORT':         '#d1fae5',
    'IT SITE VISIT':              '#fef3c7'
  };
  private CAT_TEXT_COLOR: { [k: string]: string } = {
    'IT APPLICATION DEVELOPMENT': '#1d4ed8',
    'IT SECURITY SUPPORT':        '#b91c1c',
    'IT NETWORK SUPPORT':         '#065f46',
    'IT SITE VISIT':              '#92400e'
  };
  getCategoryBg(n: string): string   { return this.CAT_COLOR[n]      ?? '#f3f4f6'; }
  getCategoryTxt(n: string): string  { return this.CAT_TEXT_COLOR[n] ?? '#374151'; }

  // ── Mock data ─────────────────────────────────────────────────────────────
  initializeMockData(): void {
    this.employees = [
      { id:'1', name:'Adan Onaparambil'           },
      { id:'2', name:'Mithun Raj Devarajan Sudh'  },
      { id:'3', name:'Peteti Venkata Shyam Sund'  },
      { id:'4', name:'Rajan Prabhakaran'           },
      { id:'5', name:'Sunil Kumar'                 },
      { id:'6', name:'Anitha Krishnan'             },
      { id:'7', name:'Vinod Pachupillai'           }
    ];
    this.taskCategories = [
      { id:1, name:'IT APPLICATION DEVELOPMENT', taskCount:12, totalHours:'285:45' },
      { id:2, name:'IT SECURITY SUPPORT',        taskCount:8,  totalHours:'120:30' },
      { id:3, name:'IT NETWORK SUPPORT',         taskCount:10, totalHours:'210:15' },
      { id:4, name:'IT SITE VISIT',              taskCount:5,  totalHours:'95:00'  }
    ];
    const c = this.taskCategories, e = this.employees;
    this.logEntries = [
      {id:1,  employee:e[0],taskCategory:c[0],taskTitle:'Axpert Dashboard Creation',      project:'Axpert',           description:'Dashboard UI for file management workflow', dailyComment:'LPO and GRN Dashboard changes',       logTime:'09:55',department:'IT',location:'Office',   dprId:'DPR001',approvalStatus:'completed',startDate:'01/06/2026',targetDate:'15/06/2026',createdDate:'28/05/2026',assignedBy:'Rajan Prabhakaran', progress:100, dailyCount:3},
      {id:2,  employee:e[1],taskCategory:c[0],taskTitle:'Adraklive Module',               project:'Adraklive',        description:'—',                                         dailyComment:'—',                                   logTime:'09:41',department:'IT',location:'Office',   dprId:'DPR002',approvalStatus:'running',   startDate:'02/06/2026',targetDate:'20/06/2026',createdDate:'29/05/2026',assignedBy:'Adan Onaparambil',  progress:55,  dailyCount:1},
      {id:3,  employee:e[2],taskCategory:c[0],taskTitle:'Development and Support',        project:'—',                description:'Sunil to Rajan follow-up',                  dailyComment:'—',                                   logTime:'48:15',department:'IT',location:'Remote',  dprId:'DPR003',approvalStatus:'completed',startDate:'01/06/2026',targetDate:'10/06/2026',createdDate:'01/06/2026',assignedBy:'Sunil Kumar',       progress:100, dailyCount:5},
      {id:4,  employee:e[3],taskCategory:c[0],taskTitle:'ERP Module Integration',         project:'ERP System',       description:'Backend API integration for HR module',     dailyComment:'Completed auth module',               logTime:'07:30',department:'IT',location:'Office',   dprId:'DPR004',approvalStatus:'completed',startDate:'03/06/2026',targetDate:'18/06/2026',createdDate:'02/06/2026',assignedBy:'Vinod Pachupillai', progress:100, dailyCount:2},
      {id:5,  employee:e[4],taskCategory:c[0],taskTitle:'Mobile App Development',         project:'Al Adrak App',     description:'Flutter UI for leave management',           dailyComment:'Fixed navigation issues',             logTime:'08:00',department:'IT',location:'Office',   dprId:'DPR005',approvalStatus:'running',   startDate:'01/06/2026',targetDate:'25/06/2026',createdDate:'30/05/2026',assignedBy:'Rajan Prabhakaran', progress:40,  dailyCount:4},
      {id:6,  employee:e[5],taskCategory:c[0],taskTitle:'Payroll System Update',          project:'HR Portal',        description:'Updated payroll calculation logic',         dailyComment:'Tested with UAT team',                logTime:'06:15',department:'IT',location:'Office',   dprId:'DPR006',approvalStatus:'completed',startDate:'02/06/2026',targetDate:'12/06/2026',createdDate:'01/06/2026',assignedBy:'Anitha Krishnan',   progress:100, dailyCount:2},
      {id:7,  employee:e[6],taskCategory:c[0],taskTitle:'Database Optimization',          project:'Axpert',           description:'Query optimization for reports module',     dailyComment:'Reduced load time by 40%',            logTime:'05:30',department:'IT',location:'Office',   dprId:'DPR007',approvalStatus:'completed',startDate:'04/06/2026',targetDate:'14/06/2026',createdDate:'03/06/2026',assignedBy:'Mithun Raj',        progress:100, dailyCount:1},
      {id:8,  employee:e[0],taskCategory:c[0],taskTitle:'Report Generation Module',       project:'DPR Portal',       description:'Monthly DPR auto-report builder',           dailyComment:'PDF export working',                  logTime:'07:45',department:'IT',location:'Office',   dprId:'DPR008',approvalStatus:'paused',   startDate:'05/06/2026',targetDate:'22/06/2026',createdDate:'04/06/2026',assignedBy:'Sunil Kumar',       progress:70,  dailyCount:3},
      {id:9,  employee:e[1],taskCategory:c[0],taskTitle:'API Gateway Setup',              project:'Infrastructure',   description:'Nginx reverse proxy config',               dailyComment:'SSL certificates installed',          logTime:'04:20',department:'IT',location:'Office',   dprId:'DPR009',approvalStatus:'completed',startDate:'01/06/2026',targetDate:'08/06/2026',createdDate:'31/05/2026',assignedBy:'Vinod Pachupillai', progress:100, dailyCount:1},
      {id:10, employee:e[2],taskCategory:c[0],taskTitle:'User Access Management',         project:'HR Portal',        description:'Role-based access control implementation', dailyComment:'Admin panel updated',                 logTime:'06:00',department:'IT',location:'Office',   dprId:'DPR010',approvalStatus:'completed',startDate:'06/06/2026',targetDate:'16/06/2026',createdDate:'05/06/2026',assignedBy:'Rajan Prabhakaran', progress:100, dailyCount:2},
      {id:11, employee:e[3],taskCategory:c[0],taskTitle:'Performance Monitoring',         project:'Infrastructure',   description:'Grafana dashboard setup',                  dailyComment:'Alerts configured',                   logTime:'05:00',department:'IT',location:'Office',   dprId:'DPR011',approvalStatus:'running',   startDate:'07/06/2026',targetDate:'28/06/2026',createdDate:'06/06/2026',assignedBy:'Adan Onaparambil',  progress:30,  dailyCount:0},
      {id:12, employee:e[4],taskCategory:c[0],taskTitle:'Bug Fix – Login Flow',           project:'Axpert',           description:'Fixed session timeout issue',              dailyComment:'Tested on staging',                   logTime:'03:30',department:'IT',location:'Office',   dprId:'DPR012',approvalStatus:'completed',startDate:'03/06/2026',targetDate:'05/06/2026',createdDate:'03/06/2026',assignedBy:'Anitha Krishnan',   progress:100, dailyCount:1},
      {id:13, employee:e[5],taskCategory:c[1],taskTitle:'Firewall Rule Update',           project:'Network Security', description:'Updated inbound rules for DMZ',            dailyComment:'Change approved by management',       logTime:'04:00',department:'IT',location:'Office',   dprId:'DPR013',approvalStatus:'completed',startDate:'01/06/2026',targetDate:'07/06/2026',createdDate:'31/05/2026',assignedBy:'Sunil Kumar',       progress:100, dailyCount:2},
      {id:14, employee:e[6],taskCategory:c[1],taskTitle:'Vulnerability Assessment',       project:'Security Audit',   description:'Ran Nessus scan on production servers',    dailyComment:'Report generated and shared',         logTime:'08:30',department:'IT',location:'Office',   dprId:'DPR014',approvalStatus:'completed',startDate:'02/06/2026',targetDate:'09/06/2026',createdDate:'01/06/2026',assignedBy:'Mithun Raj',        progress:100, dailyCount:4},
      {id:15, employee:e[0],taskCategory:c[1],taskTitle:'Antivirus Policy Update',        project:'Endpoint Security',description:'Pushed updated AV definitions',            dailyComment:'All 148 endpoints updated',           logTime:'03:00',department:'IT',location:'Office',   dprId:'DPR015',approvalStatus:'running',   startDate:'03/06/2026',targetDate:'19/06/2026',createdDate:'02/06/2026',assignedBy:'Rajan Prabhakaran', progress:60,  dailyCount:3},
      {id:16, employee:e[1],taskCategory:c[1],taskTitle:'SSL Certificate Renewal',        project:'Infrastructure',   description:'Renewed certificates for 3 domains',      dailyComment:'Certs valid for 1 year',              logTime:'02:30',department:'IT',location:'Office',   dprId:'DPR016',approvalStatus:'completed',startDate:'04/06/2026',targetDate:'06/06/2026',createdDate:'04/06/2026',assignedBy:'Vinod Pachupillai', progress:100, dailyCount:1},
      {id:17, employee:e[2],taskCategory:c[1],taskTitle:'Security Incident Response',     project:'SIEM',             description:'Investigated failed login attempts',       dailyComment:'IP blocked in firewall',              logTime:'05:00',department:'IT',location:'Office',   dprId:'DPR017',approvalStatus:'completed',startDate:'05/06/2026',targetDate:'05/06/2026',createdDate:'05/06/2026',assignedBy:'Adan Onaparambil',  progress:100, dailyCount:2},
      {id:18, employee:e[3],taskCategory:c[1],taskTitle:'Patch Management',               project:'Endpoint Security',description:'Applied OS patches on all servers',        dailyComment:'Rebooted during off-hours',           logTime:'06:00',department:'IT',location:'Office',   dprId:'DPR018',approvalStatus:'completed',startDate:'06/06/2026',targetDate:'13/06/2026',createdDate:'05/06/2026',assignedBy:'Anitha Krishnan',   progress:100, dailyCount:5},
      {id:19, employee:e[4],taskCategory:c[1],taskTitle:'Quarterly Access Review',      project:'IAM',             description:'Quarterly user access review',             dailyComment:'Removed 12 stale accounts',          logTime:'04:30',department:'IT',location:'Office',  dprId:'DPR019',approvalStatus:'running',   startDate:'07/06/2026',targetDate:'30/06/2026',createdDate:'06/06/2026',assignedBy:'Sunil Kumar',       progress:50,  dailyCount:2},
      {id:20, employee:e[5],taskCategory:c[1],taskTitle:'Security Awareness Training',  project:'HR Training',     description:'Phishing simulation campaign',             dailyComment:'85% pass rate achieved',             logTime:'03:00',department:'IT',location:'Office',  dprId:'DPR020',approvalStatus:'completed', startDate:'08/06/2026',targetDate:'10/06/2026',createdDate:'07/06/2026',assignedBy:'Mithun Raj',        progress:100, dailyCount:1},
      {id:21, employee:e[6],taskCategory:c[2],taskTitle:'Network Switch Configuration', project:'Infrastructure',  description:'VLAN setup for new office floor',          dailyComment:'QoS policies applied',               logTime:'06:00',department:'IT',location:'Office',  dprId:'DPR021',approvalStatus:'completed', startDate:'01/06/2026',targetDate:'11/06/2026',createdDate:'31/05/2026',assignedBy:'Rajan Prabhakaran', progress:100, dailyCount:3},
      {id:22, employee:e[0],taskCategory:c[2],taskTitle:'WiFi Access Point Install',    project:'Network Expansion',description:'Installed 4 APs on 3rd floor',           dailyComment:'Coverage tested and verified',       logTime:'05:30',department:'IT',location:'Site',   dprId:'DPR022',approvalStatus:'completed', startDate:'02/06/2026',targetDate:'04/06/2026',createdDate:'01/06/2026',assignedBy:'Vinod Pachupillai', progress:100, dailyCount:4},
      {id:23, employee:e[1],taskCategory:c[2],taskTitle:'VPN Troubleshooting',          project:'Remote Access',   description:'Fixed split-tunnel routing issue',         dailyComment:'Users can now access intranet',      logTime:'03:45',department:'IT',location:'Office',  dprId:'DPR023',approvalStatus:'running',   startDate:'03/06/2026',targetDate:'21/06/2026',createdDate:'02/06/2026',assignedBy:'Adan Onaparambil',  progress:45,  dailyCount:1},
      {id:24, employee:e[2],taskCategory:c[2],taskTitle:'Internet Bandwidth Upgrade',   project:'ISP Management',  description:'Coordinated with ISP for 1Gbps upgrade',  dailyComment:'Provisioned and speed tested',       logTime:'04:00',department:'IT',location:'Office',  dprId:'DPR024',approvalStatus:'completed', startDate:'04/06/2026',targetDate:'10/06/2026',createdDate:'03/06/2026',assignedBy:'Anitha Krishnan',   progress:100, dailyCount:2},
      {id:25, employee:e[3],taskCategory:c[2],taskTitle:'DNS Server Maintenance',       project:'Infrastructure',  description:'Cleared stale DNS entries',               dailyComment:'Propagation verified across zones',  logTime:'02:30',department:'IT',location:'Office',  dprId:'DPR025',approvalStatus:'completed', startDate:'05/06/2026',targetDate:'05/06/2026',createdDate:'05/06/2026',assignedBy:'Sunil Kumar',       progress:100, dailyCount:1},
      {id:26, employee:e[4],taskCategory:c[2],taskTitle:'Load Balancer Setup',          project:'Infrastructure',  description:'HAProxy config for web tier',             dailyComment:'Health checks passing',              logTime:'07:00',department:'IT',location:'Office',  dprId:'DPR026',approvalStatus:'completed', startDate:'06/06/2026',targetDate:'15/06/2026',createdDate:'05/06/2026',assignedBy:'Mithun Raj',        progress:100, dailyCount:3},
      {id:27, employee:e[5],taskCategory:c[2],taskTitle:'Network Monitoring Alert',     project:'NOC',             description:'Resolved high latency on WAN link',        dailyComment:'Routed via backup path',             logTime:'03:00',department:'IT',location:'Office',  dprId:'DPR027',approvalStatus:'running',   startDate:'07/06/2026',targetDate:'24/06/2026',createdDate:'06/06/2026',assignedBy:'Rajan Prabhakaran', progress:35,  dailyCount:2},
      {id:28, employee:e[6],taskCategory:c[2],taskTitle:'Server Room Cable Management', project:'Server Room',     description:'Labelled and reorganised patch panel',     dailyComment:'Documentation updated in Confluence',logTime:'04:00',department:'IT',location:'Office',  dprId:'DPR028',approvalStatus:'completed', startDate:'08/06/2026',targetDate:'08/06/2026',createdDate:'08/06/2026',assignedBy:'Vinod Pachupillai', progress:100, dailyCount:1},
      {id:29, employee:e[0],taskCategory:c[2],taskTitle:'Proxy Server ACL Update',      project:'Infrastructure',  description:'Updated Squid proxy ACLs',                dailyComment:'Blocked non-business streaming',     logTime:'02:30',department:'IT',location:'Office',  dprId:'DPR029',approvalStatus:'completed', startDate:'09/06/2026',targetDate:'09/06/2026',createdDate:'09/06/2026',assignedBy:'Adan Onaparambil',  progress:100, dailyCount:0},
      {id:30, employee:e[1],taskCategory:c[2],taskTitle:'MPLS Failover Testing',        project:'WAN',             description:'Tested failover on MPLS circuit',          dailyComment:'Failover achieved in under 30 sec',  logTime:'05:00',department:'IT',location:'Office',  dprId:'DPR030',approvalStatus:'completed', startDate:'10/06/2026',targetDate:'10/06/2026',createdDate:'10/06/2026',assignedBy:'Anitha Krishnan',   progress:100, dailyCount:2},
      {id:31, employee:e[2],taskCategory:c[3],taskTitle:'Site Survey – Al Quoz',        project:'Site Expansion',  description:'Network assessment at Al Quoz site',       dailyComment:'Full report submitted to PM',        logTime:'08:00',department:'IT',location:'Al Quoz',  dprId:'DPR031',approvalStatus:'completed', startDate:'01/06/2026',targetDate:'03/06/2026',createdDate:'31/05/2026',assignedBy:'Sunil Kumar',       progress:100, dailyCount:1},
      {id:32, employee:e[3],taskCategory:c[3],taskTitle:'Hardware Deployment – Jebel Ali',project:'Hardware Rollout',description:'Deployed and configured 10 workstations',dailyComment:'All units configured and handed over',logTime:'10:00',department:'IT',location:'Jebel Ali',dprId:'DPR032',approvalStatus:'completed', startDate:'02/06/2026',targetDate:'06/06/2026',createdDate:'01/06/2026',assignedBy:'Mithun Raj',        progress:100, dailyCount:4},
      {id:33, employee:e[4],taskCategory:c[3],taskTitle:'CCTV Installation Support',    project:'Security Systems',description:'Assisted vendor with IP camera setup',     dailyComment:'NVR configured and recording',       logTime:'06:30',department:'IT',location:'Sharjah',  dprId:'DPR033',approvalStatus:'running',   startDate:'05/06/2026',targetDate:'26/06/2026',createdDate:'04/06/2026',assignedBy:'Rajan Prabhakaran', progress:65,  dailyCount:3},
      {id:34, employee:e[5],taskCategory:c[3],taskTitle:'Printer Setup – Deira Office', project:'Hardware Support', description:'Network printer configuration and test',  dailyComment:'Print server updated successfully',  logTime:'03:30',department:'IT',location:'Deira',    dprId:'DPR034',approvalStatus:'completed', startDate:'07/06/2026',targetDate:'07/06/2026',createdDate:'07/06/2026',assignedBy:'Vinod Pachupillai', progress:100, dailyCount:1},
      {id:35, employee:e[6],taskCategory:c[3],taskTitle:'Server Room Audit – Abu Dhabi',project:'Compliance',      description:'Physical audit of server room facilities', dailyComment:'Audit findings documented in Jira',  logTime:'09:00',department:'IT',location:'Abu Dhabi', dprId:'DPR035',approvalStatus:'completed', startDate:'09/06/2026',targetDate:'11/06/2026',createdDate:'08/06/2026',assignedBy:'Adan Onaparambil',  progress:100, dailyCount:2},
      // Multi-user rows: same taskTitle, different employees
      {id:36, employee:e[1],taskCategory:c[0],taskTitle:'Axpert Dashboard Creation',    project:'Axpert',           description:'Dashboard UI for file management workflow', dailyComment:'Worked on filter panel UI',           logTime:'04:30',department:'IT',location:'Office',   dprId:'DPR001',approvalStatus:'completed',startDate:'01/06/2026',targetDate:'15/06/2026',createdDate:'28/05/2026',assignedBy:'Rajan Prabhakaran', progress:100, dailyCount:2},
      {id:37, employee:e[2],taskCategory:c[0],taskTitle:'Axpert Dashboard Creation',    project:'Axpert',           description:'Dashboard UI for file management workflow', dailyComment:'API integration for dashboard charts',logTime:'03:15',department:'IT',location:'Remote',  dprId:'DPR001',approvalStatus:'completed',startDate:'01/06/2026',targetDate:'15/06/2026',createdDate:'28/05/2026',assignedBy:'Rajan Prabhakaran', progress:100, dailyCount:1},
      {id:38, employee:e[4],taskCategory:c[0],taskTitle:'ERP Module Integration',       project:'ERP System',       description:'Backend API integration for HR module',     dailyComment:'Testing and bug fixing',              logTime:'05:00',department:'IT',location:'Office',   dprId:'DPR004',approvalStatus:'completed',startDate:'03/06/2026',targetDate:'18/06/2026',createdDate:'02/06/2026',assignedBy:'Vinod Pachupillai', progress:100, dailyCount:3},
      {id:39, employee:e[5],taskCategory:c[1],taskTitle:'Patch Management',             project:'Endpoint Security',description:'Applied OS patches on all servers',        dailyComment:'Verified patch deployment',           logTime:'02:30',department:'IT',location:'Office',   dprId:'DPR018',approvalStatus:'completed',startDate:'06/06/2026',targetDate:'13/06/2026',createdDate:'05/06/2026',assignedBy:'Anitha Krishnan',   progress:100, dailyCount:2},
    ];
  }
}
