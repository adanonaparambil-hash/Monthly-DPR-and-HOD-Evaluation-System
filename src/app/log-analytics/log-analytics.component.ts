import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Employee { id: string; name: string; }
interface TaskCategory { id: number; name: string; taskCount: number; totalHours: string; }
interface LogEntry {
  id: number; employee: Employee; taskCategory: TaskCategory;
  taskTitle: string; project: string; description: string; dailyComment: string;
  logTime: string; department: string; location: string; dprId: string;
  approvalStatus: 'running' | 'completed' | 'paused' | 'closed';
}
interface Filter {
  dateRange: { from: string; to: string };
  department: string; employee: string; project: string; taskCategory: string;
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

  filters: Filter = {
    dateRange: { from: '2026-01-06', to: '2026-05-06' },
    department: 'IT', employee: '', project: '', taskCategory: ''
  };

  searchTerm = '';
  showFilters = false;
  showColumnsPanel = false;
  showGroupByMenu = false;
  groupBy = 'taskCategory';
  
  // Sorting properties
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Column resizing properties
  columnWidths = {
    employee: 220,
    category: 120,
    taskTitle: 200,
    project: 150,
    description: 300,  // Increased default width
    dailyComment: 200, // Increased default width
    logTime: 100
  };
  
  private resizing = false;
  private resizingColumn = '';
  private startX = 0;
  private startWidth = 0;

  currentPage = 1;
  pageSize = 20;
  totalRecords = 0;

  visibleColumns: { [key: string]: boolean } = {
    employee: true, taskCategory: true, taskTitle: true, project: true,
    description: true, dailyComment: true, logTime: true,
    department: false, location: false, dprId: false, approvalStatus: false
  };

  columnsList = [
    { key: 'employee',       label: 'Employee',       icon: 'fa-user' },
    { key: 'taskCategory',   label: 'Task Category',  icon: 'fa-tag' },
    { key: 'taskTitle',      label: 'Task Title',     icon: 'fa-list-check' },
    { key: 'project',        label: 'Project',        icon: 'fa-cube' },
    { key: 'description',    label: 'Description',    icon: 'fa-align-left' },
    { key: 'dailyComment',   label: 'Daily Comment',  icon: 'fa-comment' },
    { key: 'logTime',        label: 'Log Time',       icon: 'fa-clock' },
    { key: 'department',     label: 'Department',     icon: 'fa-building' },
    { key: 'location',       label: 'Location',       icon: 'fa-location-dot' },
    { key: 'dprId',          label: 'DPR ID',         icon: 'fa-hashtag' },
    { key: 'approvalStatus', label: 'Approval Status',icon: 'fa-circle-check' }
  ];

  groupByOptions = [
    { value: 'taskCategory', label: 'Task Category', icon: 'fa-tag' },
    { value: 'employee',     label: 'Employee',      icon: 'fa-user' },
    { value: 'department',   label: 'Department',    icon: 'fa-building' },
    { value: 'project',      label: 'Project',       icon: 'fa-cube' },
    { value: 'date',         label: 'Date',          icon: 'fa-calendar' },
    { value: 'status',       label: 'Status',        icon: 'fa-circle' }
  ];

  logEntries: LogEntry[] = [];
  filteredLogEntries: LogEntry[] = [];
  visibleCategories: TaskCategory[] = [];
  employees: Employee[] = [];
  taskCategories: TaskCategory[] = [];
  departments: any[] = [];
  expandedCategories: { [key: string]: boolean } = {};
  expandedCategoryLimits: { [key: string]: number } = {};
  private readonly INITIAL_VISIBLE = 3;

  ngOnInit(): void {
    this.initializeMockData();
    this.applyFilters();
    this.taskCategories.forEach(c => {
      this.expandedCategories[c.name] = true;
      this.expandedCategoryLimits[c.name] = this.INITIAL_VISIBLE;
    });
  }

  @HostListener('document:click')
  onDocClick(): void { this.showGroupByMenu = false; }

  @HostListener('window:resize')
  onWindowResize(): void {
    // Simple resize handler - no complex calculations needed
    // The CSS will handle the scrolling automatically
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.resizing) {
      this.performResize(event);
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    if (this.resizing) {
      this.stopResize();
    }
  }

  initializeMockData(): void {
    this.employees = [
      { id: '1', name: 'Adan Onaparambil' },
      { id: '2', name: 'Mithun Raj Devarajan Sudh' },
      { id: '3', name: 'Peteti Venkata Shyam Sund' },
      { id: '4', name: 'Rajan Prabhakaran' },
      { id: '5', name: 'Sunil Kumar' },
      { id: '6', name: 'Anitha Krishnan' },
      { id: '7', name: 'Vinod Pachupillai' }
    ];

    this.taskCategories = [
      { id: 1, name: 'IT APPLICATION DEVELOPMENT', taskCount: 12, totalHours: '285:45' },
      { id: 2, name: 'IT SECURITY SUPPORT',        taskCount: 8,  totalHours: '120:30' },
      { id: 3, name: 'IT NETWORK SUPPORT',         taskCount: 10, totalHours: '210:15' },
      { id: 4, name: 'IT SITE VISIT',              taskCount: 5,  totalHours: '95:00'  }
    ];

    this.departments = [
      { id: 'it', name: 'IT' }, { id: 'dev', name: 'Development' },
      { id: 'sup', name: 'Support' }, { id: 'net', name: 'Network' }
    ];

    const c = this.taskCategories, e = this.employees;
    this.logEntries = [
      // IT APPLICATION DEVELOPMENT (12)
      { id:1,  employee:e[0], taskCategory:c[0], taskTitle:'Axpert Dashboard Creation',    project:'Axpert',          description:'Dashboard UI for file management workflow',   dailyComment:'LPO and GRN Dashboard changes in UI',  logTime:'09:55', department:'IT', location:'Office', dprId:'DPR001', approvalStatus:'completed' },
      { id:2,  employee:e[1], taskCategory:c[0], taskTitle:'Adraklive Module',             project:'Adraklive',       description:'—',                                           dailyComment:'—',                                    logTime:'09:41', department:'IT', location:'Office', dprId:'DPR002', approvalStatus:'running'  },
      { id:3,  employee:e[2], taskCategory:c[0], taskTitle:'Development and Support',      project:'—',               description:'1. Sunil to Rajan Prabhakaran 2. Follow-up',  dailyComment:'—',                                    logTime:'48:15', department:'IT', location:'Remote', dprId:'DPR003', approvalStatus:'completed' },
      { id:4,  employee:e[3], taskCategory:c[0], taskTitle:'ERP Module Integration',       project:'ERP System',      description:'Backend API integration for HR module',       dailyComment:'Completed auth module',                logTime:'07:30', department:'IT', location:'Office', dprId:'DPR004', approvalStatus:'completed' },
      { id:5,  employee:e[4], taskCategory:c[0], taskTitle:'Mobile App Development',       project:'Al Adrak App',    description:'Flutter UI for leave management',             dailyComment:'Fixed navigation issues',              logTime:'08:00', department:'IT', location:'Office', dprId:'DPR005', approvalStatus:'running'  },
      { id:6,  employee:e[5], taskCategory:c[0], taskTitle:'Payroll System Update',        project:'HR Portal',       description:'Updated payroll calculation logic',           dailyComment:'Tested with UAT team',                 logTime:'06:15', department:'IT', location:'Office', dprId:'DPR006', approvalStatus:'completed' },
      { id:7,  employee:e[6], taskCategory:c[0], taskTitle:'Database Optimization',        project:'Axpert',          description:'Query optimization for reports module',       dailyComment:'Reduced load time by 40%',             logTime:'05:30', department:'IT', location:'Office', dprId:'DPR007', approvalStatus:'completed' },
      { id:8,  employee:e[0], taskCategory:c[0], taskTitle:'Report Generation Module',     project:'DPR Portal',      description:'Monthly DPR auto-report builder',            dailyComment:'PDF export working',                   logTime:'07:45', department:'IT', location:'Office', dprId:'DPR008', approvalStatus:'paused'  },
      { id:9,  employee:e[1], taskCategory:c[0], taskTitle:'API Gateway Setup',            project:'Infrastructure',  description:'Nginx reverse proxy config',                 dailyComment:'SSL certificates installed',           logTime:'04:20', department:'IT', location:'Office', dprId:'DPR009', approvalStatus:'completed' },
      { id:10, employee:e[2], taskCategory:c[0], taskTitle:'User Access Management',       project:'HR Portal',       description:'Role-based access control implementation',   dailyComment:'Admin panel updated',                  logTime:'06:00', department:'IT', location:'Office', dprId:'DPR010', approvalStatus:'completed' },
      { id:11, employee:e[3], taskCategory:c[0], taskTitle:'Performance Monitoring',       project:'Infrastructure',  description:'Grafana dashboard setup',                    dailyComment:'Alerts configured',                    logTime:'05:00', department:'IT', location:'Office', dprId:'DPR011', approvalStatus:'running'  },
      { id:12, employee:e[4], taskCategory:c[0], taskTitle:'Bug Fix – Login Flow',         project:'Axpert',          description:'Fixed session timeout issue',                dailyComment:'Tested on staging',                    logTime:'03:30', department:'IT', location:'Office', dprId:'DPR012', approvalStatus:'completed' },
      // IT SECURITY SUPPORT (8)
      { id:13, employee:e[5], taskCategory:c[1], taskTitle:'Firewall Rule Update',         project:'Network Security',description:'Updated inbound rules for DMZ',              dailyComment:'Change approved by management',        logTime:'04:00', department:'IT', location:'Office', dprId:'DPR013', approvalStatus:'completed' },
      { id:14, employee:e[6], taskCategory:c[1], taskTitle:'Vulnerability Assessment',     project:'Security Audit',  description:'Ran Nessus scan on production servers',      dailyComment:'Report generated and shared',          logTime:'08:30', department:'IT', location:'Office', dprId:'DPR014', approvalStatus:'completed' },
      { id:15, employee:e[0], taskCategory:c[1], taskTitle:'Antivirus Policy Update',      project:'Endpoint Security',description:'Pushed updated AV definitions',            dailyComment:'All 148 endpoints updated',            logTime:'03:00', department:'IT', location:'Office', dprId:'DPR015', approvalStatus:'running'  },
      { id:16, employee:e[1], taskCategory:c[1], taskTitle:'SSL Certificate Renewal',      project:'Infrastructure',  description:'Renewed certificates for 3 domains',        dailyComment:'Certs valid for 1 year',               logTime:'02:30', department:'IT', location:'Office', dprId:'DPR016', approvalStatus:'completed' },
      { id:17, employee:e[2], taskCategory:c[1], taskTitle:'Security Incident Response',   project:'SIEM',            description:'Investigated failed login attempts',         dailyComment:'IP blocked in firewall',               logTime:'05:00', department:'IT', location:'Office', dprId:'DPR017', approvalStatus:'completed' },
      { id:18, employee:e[3], taskCategory:c[1], taskTitle:'Patch Management',             project:'Endpoint Security',description:'Applied OS patches on all servers',        dailyComment:'Rebooted during off-hours',            logTime:'06:00', department:'IT', location:'Office', dprId:'DPR018', approvalStatus:'completed' },
      { id:19, employee:e[4], taskCategory:c[1], taskTitle:'Quarterly Access Review',      project:'IAM',             description:'Quarterly user access review',               dailyComment:'Removed 12 stale accounts',            logTime:'04:30', department:'IT', location:'Office', dprId:'DPR019', approvalStatus:'running'  },
      { id:20, employee:e[5], taskCategory:c[1], taskTitle:'Security Awareness Training',  project:'HR Training',     description:'Phishing simulation campaign',               dailyComment:'85% pass rate achieved',               logTime:'03:00', department:'IT', location:'Office', dprId:'DPR020', approvalStatus:'completed' },
      // IT NETWORK SUPPORT (10)
      { id:21, employee:e[6], taskCategory:c[2], taskTitle:'Network Switch Configuration', project:'Infrastructure',  description:'VLAN setup for new office floor',           dailyComment:'QoS policies applied',                 logTime:'06:00', department:'IT', location:'Office', dprId:'DPR021', approvalStatus:'completed' },
      { id:22, employee:e[0], taskCategory:c[2], taskTitle:'WiFi Access Point Install',    project:'Network Expansion',description:'Installed 4 APs on 3rd floor',            dailyComment:'Coverage tested and verified',         logTime:'05:30', department:'IT', location:'Site',   dprId:'DPR022', approvalStatus:'completed' },
      { id:23, employee:e[1], taskCategory:c[2], taskTitle:'VPN Troubleshooting',          project:'Remote Access',   description:'Fixed split-tunnel routing issue',          dailyComment:'Users can now access intranet',        logTime:'03:45', department:'IT', location:'Office', dprId:'DPR023', approvalStatus:'running'  },
      { id:24, employee:e[2], taskCategory:c[2], taskTitle:'Internet Bandwidth Upgrade',   project:'ISP Management',  description:'Coordinated with ISP for 1Gbps upgrade',   dailyComment:'Provisioned and speed tested',         logTime:'04:00', department:'IT', location:'Office', dprId:'DPR024', approvalStatus:'completed' },
      { id:25, employee:e[3], taskCategory:c[2], taskTitle:'DNS Server Maintenance',       project:'Infrastructure',  description:'Cleared stale DNS entries',                 dailyComment:'Propagation verified across zones',    logTime:'02:30', department:'IT', location:'Office', dprId:'DPR025', approvalStatus:'completed' },
      { id:26, employee:e[4], taskCategory:c[2], taskTitle:'Load Balancer Setup',          project:'Infrastructure',  description:'HAProxy config for web tier',               dailyComment:'Health checks passing',                logTime:'07:00', department:'IT', location:'Office', dprId:'DPR026', approvalStatus:'completed' },
      { id:27, employee:e[5], taskCategory:c[2], taskTitle:'Network Monitoring Alert',     project:'NOC',             description:'Resolved high latency on WAN link',         dailyComment:'Routed via backup path',               logTime:'03:00', department:'IT', location:'Office', dprId:'DPR027', approvalStatus:'running'  },
      { id:28, employee:e[6], taskCategory:c[2], taskTitle:'Server Room Cable Management', project:'Server Room',     description:'Labelled and reorganised patch panel',      dailyComment:'Documentation updated in Confluence', logTime:'04:00', department:'IT', location:'Office', dprId:'DPR028', approvalStatus:'completed' },
      { id:29, employee:e[0], taskCategory:c[2], taskTitle:'Proxy Server ACL Update',      project:'Infrastructure',  description:'Updated Squid proxy ACLs',                  dailyComment:'Blocked non-business streaming sites',logTime:'02:30', department:'IT', location:'Office', dprId:'DPR029', approvalStatus:'completed' },
      { id:30, employee:e[1], taskCategory:c[2], taskTitle:'MPLS Failover Testing',        project:'WAN',             description:'Tested failover on MPLS circuit',           dailyComment:'Failover achieved in under 30 sec',   logTime:'05:00', department:'IT', location:'Office', dprId:'DPR030', approvalStatus:'completed' },
      // IT SITE VISIT (5)
      { id:31, employee:e[2], taskCategory:c[3], taskTitle:'Site Survey – Al Quoz',        project:'Site Expansion',  description:'Network assessment at Al Quoz site',        dailyComment:'Full report submitted to PM',          logTime:'08:00', department:'IT', location:'Al Quoz',   dprId:'DPR031', approvalStatus:'completed' },
      { id:32, employee:e[3], taskCategory:c[3], taskTitle:'Hardware Deployment – Jebel Ali',project:'Hardware Rollout',description:'Deployed and configured 10 workstations', dailyComment:'All units configured and handed over', logTime:'10:00', department:'IT', location:'Jebel Ali', dprId:'DPR032', approvalStatus:'completed' },
      { id:33, employee:e[4], taskCategory:c[3], taskTitle:'CCTV Installation Support',    project:'Security Systems',description:'Assisted vendor with IP camera setup',      dailyComment:'NVR configured and recording',         logTime:'06:30', department:'IT', location:'Sharjah',   dprId:'DPR033', approvalStatus:'running'  },
      { id:34, employee:e[5], taskCategory:c[3], taskTitle:'Printer Setup – Deira Office', project:'Hardware Support', description:'Network printer configuration and test',   dailyComment:'Print server updated successfully',    logTime:'03:30', department:'IT', location:'Deira',     dprId:'DPR034', approvalStatus:'completed' },
      { id:35, employee:e[6], taskCategory:c[3], taskTitle:'Server Room Audit – Abu Dhabi', project:'Compliance',     description:'Physical audit of server room facilities', dailyComment:'Audit findings documented in Jira',   logTime:'09:00', department:'IT', location:'Abu Dhabi',  dprId:'DPR035', approvalStatus:'completed' }
    ];
    this.totalRecords = this.logEntries.length;
  }

  applyFilters(): void {
    let f = [...this.logEntries];
    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      f = f.filter(e =>
        e.employee.name.toLowerCase().includes(q) ||
        e.taskTitle.toLowerCase().includes(q) ||
        e.project.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
      );
    }
    if (this.filters.department)    f = f.filter(e => e.department    === this.filters.department);
    if (this.filters.employee)      f = f.filter(e => e.employee.id   === this.filters.employee);
    if (this.filters.project)       f = f.filter(e => e.project.includes(this.filters.project));
    if (this.filters.taskCategory)  f = f.filter(e => e.taskCategory.name === this.filters.taskCategory);

    this.filteredLogEntries = f;
    this.totalRecords = f.length;
    this.currentPage = 1;
    const ids = new Set(f.map(e => e.taskCategory.id));
    this.visibleCategories = this.taskCategories.filter(c => ids.has(c.id));
    
    // Apply sorting after filtering
    this.applySorting();
  }

  getEntriesForCategory(name: string): LogEntry[] {
    return this.filteredLogEntries.filter(e => e.taskCategory.name === name);
  }
  getVisibleEntries(name: string): LogEntry[] {
    return this.getEntriesForCategory(name).slice(0, this.expandedCategoryLimits[name] ?? this.INITIAL_VISIBLE);
  }
  getCategoryHiddenCount(name: string): number {
    return Math.max(0, this.getEntriesForCategory(name).length - (this.expandedCategoryLimits[name] ?? this.INITIAL_VISIBLE));
  }
  showMoreCategory(name: string, e: Event): void {
    e.stopPropagation();
    this.expandedCategoryLimits[name] = this.getEntriesForCategory(name).length;
  }
  toggleCategory(name: string): void { this.expandedCategories[name] = !this.expandedCategories[name]; }
  toggleFilters(): void { this.showFilters = !this.showFilters; }
  toggleColumnsPanel(): void { this.showColumnsPanel = !this.showColumnsPanel; }
  toggleGroupByMenu(e: Event): void { e.stopPropagation(); this.showGroupByMenu = !this.showGroupByMenu; }
  setGroupBy(v: string, e: Event): void { e.stopPropagation(); this.groupBy = v; this.showGroupByMenu = false; }
  clearAllFilters(): void {
    this.filters = { dateRange: { from: '', to: '' }, department: '', employee: '', project: '', taskCategory: '' };
    this.searchTerm = '';
    this.applyFilters();
  }
  onFilterChange(): void { this.applyFilters(); }
  onSearch(): void { this.applyFilters(); }
  onPageSizeChange(): void { this.currentPage = 1; }
  exportData(): void { console.log('Export'); }
  newView(): void { console.log('New view'); }
  saveColumnsSettings(): void { this.showColumnsPanel = false; }
  resetColumnsToDefault(): void {
    this.visibleColumns = {
      employee: true, taskCategory: true, taskTitle: true, project: true,
      description: true, dailyComment: true, logTime: true,
      department: false, location: false, dprId: false, approvalStatus: false
    };
  }

  get groupByLabel(): string { return this.groupByOptions.find(o => o.value === this.groupBy)?.label ?? 'Task Category'; }
  get activeFiltersCount(): number {
    let n = 0;
    if (this.filters.dateRange.from && this.filters.dateRange.to) n++;
    if (this.filters.department)   n++;
    if (this.filters.employee)     n++;
    if (this.filters.taskCategory) n++;
    if (this.filters.project)      n++;
    return n;
  }
  get visibleColumnCount(): number { return Object.values(this.visibleColumns).filter(Boolean).length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.totalRecords / this.pageSize)); }
  previousPage(): void { if (this.currentPage > 1) this.currentPage--; }
  nextPage(): void { if (this.currentPage < this.totalPages) this.currentPage++; }
  goToPage(p: number): void { this.currentPage = p; }
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const cur = this.currentPage, tot = this.totalPages, r = 2;
    for (let i = Math.max(1, cur - r); i <= Math.min(tot, cur + r); i++) pages.push(i);
    return pages;
  }

  formatDate(d: string): string {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
  getEmployeeInitials(n: string): string {
    return n.split(' ').map(x => x[0]).join('').toUpperCase().substring(0, 2);
  }
  getEmployeeNameById(id: string): string { return this.employees.find(e => e.id === id)?.name ?? ''; }

  private AVATAR_COLORS = ['#6366F1','#EC4899','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EF4444','#14B8A6'];
  getAvatarColor(name: string): string {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    return this.AVATAR_COLORS[Math.abs(h) % this.AVATAR_COLORS.length];
  }

  // Category styling maps
  private CAT_ACCENT: { [k: string]: string } = {
    'IT APPLICATION DEVELOPMENT': 'accent-blue',
    'IT SECURITY SUPPORT':        'accent-red',
    'IT NETWORK SUPPORT':         'accent-green',
    'IT SITE VISIT':              'accent-amber'
  };
  private CAT_TEXT: { [k: string]: string } = {
    'IT APPLICATION DEVELOPMENT': 'text-blue',
    'IT SECURITY SUPPORT':        'text-red',
    'IT NETWORK SUPPORT':         'text-green',
    'IT SITE VISIT':              'text-amber'
  };
  private CAT_BADGE: { [k: string]: string } = {
    'IT APPLICATION DEVELOPMENT': 'badge-blue',
    'IT SECURITY SUPPORT':        'badge-red',
    'IT NETWORK SUPPORT':         'badge-green',
    'IT SITE VISIT':              'badge-amber'
  };
  private CAT_PILL: { [k: string]: string } = {
    'IT APPLICATION DEVELOPMENT': 'pill-blue',
    'IT SECURITY SUPPORT':        'pill-red',
    'IT NETWORK SUPPORT':         'pill-green',
    'IT SITE VISIT':              'pill-amber'
  };
  private CAT_LABEL: { [k: string]: string } = {
    'IT APPLICATION DEVELOPMENT': 'Development',
    'IT SECURITY SUPPORT':        'Security',
    'IT NETWORK SUPPORT':         'Network',
    'IT SITE VISIT':              'Site Visit'
  };
  getCategoryAccentClass(n: string): string { return this.CAT_ACCENT[n] ?? 'accent-blue'; }
  getCategoryTextClass(n: string):   string { return this.CAT_TEXT[n]   ?? 'text-blue';   }
  getCategoryBadgeClass(n: string):  string { return this.CAT_BADGE[n]  ?? 'badge-blue';  }
  getCategoryPillClass(n: string):   string { return this.CAT_PILL[n]   ?? 'pill-blue';   }
  getCategoryShortLabel(n: string):  string { return this.CAT_LABEL[n]  ?? n;             }

  // Additional methods for the new template
  getTotalHoursForCategory(categoryName: string): string {
    const category = this.taskCategories.find(c => c.name === categoryName);
    return category ? category.totalHours : '0:00';
  }

  getHiddenEntriesCount(categoryName: string): number {
    return this.getCategoryHiddenCount(categoryName);
  }

  getEmployeeColor(employeeName: string): string {
    return this.getAvatarColor(employeeName);
  }

  getCategoryColor(categoryName: string): string {
    const colorMap: { [key: string]: string } = {
      'IT APPLICATION DEVELOPMENT': '#e3f2fd',
      'IT SECURITY SUPPORT': '#fff3e0',
      'IT NETWORK SUPPORT': '#f3e5f5', 
      'IT SITE VISIT': '#e8f5e8'
    };
    return colorMap[categoryName] || '#f5f5f5';
  }

  getCategoryShortName(categoryName: string): string {
    return this.getCategoryShortLabel(categoryName);
  }

  getProjectColor(projectName: string): string {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    let hash = 0;
    for (let i = 0; i < projectName.length; i++) {
      hash = projectName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  toggleColumn(columnKey: string): void {
    this.visibleColumns[columnKey] = !this.visibleColumns[columnKey];
  }

  // Available columns for the panel
  availableColumns = [
    {key: 'employee', label: 'Employee'},
    {key: 'taskCategory', label: 'Category'}, 
    {key: 'taskTitle', label: 'Task Title'},
    {key: 'project', label: 'Project'},
    {key: 'description', label: 'Description'},
    {key: 'dailyComment', label: 'Daily Comment'},
    {key: 'logTime', label: 'Log Time'}
  ];

  // Sorting functionality
  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applySorting();
  }

  private applySorting(): void {
    if (!this.sortColumn) return;

    this.filteredLogEntries.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (this.sortColumn) {
        case 'employee':
          aValue = a.employee.name;
          bValue = b.employee.name;
          break;
        case 'category':
          aValue = a.taskCategory.name;
          bValue = b.taskCategory.name;
          break;
        case 'taskTitle':
          aValue = a.taskTitle;
          bValue = b.taskTitle;
          break;
        case 'project':
          aValue = a.project;
          bValue = b.project;
          break;
        case 'description':
          aValue = a.description || '';
          bValue = b.description || '';
          break;
        case 'dailyComment':
          aValue = a.dailyComment || '';
          bValue = b.dailyComment || '';
          break;
        case 'logTime':
          // Convert time to minutes for proper sorting
          aValue = this.timeToMinutes(a.logTime);
          bValue = this.timeToMinutes(b.logTime);
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  private timeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return 0;
  }

  // Column resizing methods
  getGridTemplateColumns(): string {
    // Ensure minimum widths to prevent overlap and maintain proper alignment
    const employeeWidth = Math.max(180, this.columnWidths.employee);
    const categoryWidth = Math.max(100, this.columnWidths.category);
    const titleWidth = Math.max(150, this.columnWidths.taskTitle);
    const projectWidth = Math.max(120, this.columnWidths.project);
    const descriptionWidth = Math.max(200, this.columnWidths.description);
    const commentWidth = Math.max(140, this.columnWidths.dailyComment);
    const timeWidth = Math.max(100, this.columnWidths.logTime);
    
    // Use consistent pixel widths to ensure perfect header-data alignment
    return `${employeeWidth}px ${categoryWidth}px ${titleWidth}px ${projectWidth}px ${descriptionWidth}px ${commentWidth}px ${timeWidth}px 110px`;
  }

  startResize(event: MouseEvent, column: string): void {
    event.preventDefault();
    event.stopPropagation();
    
    this.resizing = true;
    this.resizingColumn = column;
    this.startX = event.clientX;
    this.startWidth = this.columnWidths[column as keyof typeof this.columnWidths];
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  performResize(event: MouseEvent): void {
    if (!this.resizing || !this.resizingColumn) return;
    
    const diff = event.clientX - this.startX;
    let minWidth = 50; // Default minimum
    
    // Set specific minimum widths for each column
    switch (this.resizingColumn) {
      case 'employee': minWidth = 180; break;
      case 'category': minWidth = 100; break;
      case 'taskTitle': minWidth = 150; break;
      case 'project': minWidth = 120; break;
      case 'description': minWidth = 200; break;
      case 'dailyComment': minWidth = 140; break;
      case 'logTime': minWidth = 80; break;
    }
    
    const newWidth = Math.max(minWidth, this.startWidth + diff);
    (this.columnWidths as any)[this.resizingColumn] = newWidth;
  }

  stopResize(): void {
    this.resizing = false;
    this.resizingColumn = '';
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
}
