import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Theme } from '../services/theme';

interface LoggedHour {
  id: string;
  taskId?: string;
  title: string;
  description: string;
  category: string;
  type?: string;
  process?: string;
  assignedTo?: string;
  assignedBy?: string;
  department?: string;
  project?: string;
  workPlace?: string;
  trade?: string;
  stage?: string;
  section?: string;
  startDate?: string;
  targetDate?: string;
  timeTaken?: string;
  progress?: number;
  status?: string;
  instruction?: string;
  count?: number;
  unit?: string;
  remarks?: string;
  folderPath?: string;
  documentLink?: string;
  priority?: string;
  duration: string;
  date: string;
  loggedBy: string;
}

interface ColumnDefinition {
  key: string;
  label: string;
  visible: boolean;
  width?: string;
  type: 'text' | 'number' | 'date' | 'select' | 'percentage';
  required?: boolean;
}

@Component({
  selector: 'app-my-logged-hours',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-logged-hours.html',
  styleUrls: ['./my-logged-hours.css']
})
export class MyLoggedHoursComponent implements OnInit {
  isDarkMode = false;
  
  // Filter properties
  fromDate = '2023-10-23';
  toDate = '2023-10-29';
  selectedProject = 'all';
  selectedCategory = 'all';

  // Column management
  showColumnModal = false;
  availableColumns: ColumnDefinition[] = [
    { key: 'taskId', label: 'Task ID', visible: false, width: '120px', type: 'text' },
    { key: 'title', label: 'Task Title', visible: true, width: '250px', type: 'text', required: true },
    { key: 'description', label: 'Description', visible: true, width: '300px', type: 'text', required: true },
    { key: 'category', label: 'Task Category', visible: true, width: '180px', type: 'select', required: true },
    { key: 'type', label: 'Type', visible: false, width: '120px', type: 'select' },
    { key: 'process', label: 'Process', visible: false, width: '150px', type: 'text' },
    { key: 'assignedTo', label: 'Assigned To', visible: false, width: '150px', type: 'text' },
    { key: 'assignedBy', label: 'Assigned By', visible: false, width: '150px', type: 'text' },
    { key: 'department', label: 'Department', visible: false, width: '130px', type: 'select' },
    { key: 'project', label: 'Project', visible: false, width: '180px', type: 'text' },
    { key: 'workPlace', label: 'Work Place', visible: false, width: '130px', type: 'select' },
    { key: 'trade', label: 'Trade', visible: false, width: '120px', type: 'select' },
    { key: 'stage', label: 'Stage', visible: false, width: '120px', type: 'select' },
    { key: 'section', label: 'Section', visible: false, width: '120px', type: 'select' },
    { key: 'startDate', label: 'Start Date', visible: false, width: '130px', type: 'date' },
    { key: 'targetDate', label: 'Target Date', visible: false, width: '130px', type: 'date' },
    { key: 'timeTaken', label: 'Time Taken', visible: false, width: '120px', type: 'text' },
    { key: 'progress', label: 'Progress (%)', visible: false, width: '140px', type: 'percentage' },
    { key: 'status', label: 'Status', visible: false, width: '120px', type: 'select' },
    { key: 'instruction', label: 'Instruction', visible: false, width: '200px', type: 'text' },
    { key: 'count', label: 'Count', visible: false, width: '100px', type: 'number' },
    { key: 'unit', label: 'Unit', visible: false, width: '100px', type: 'select' },
    { key: 'remarks', label: 'Remarks', visible: false, width: '200px', type: 'text' },
    { key: 'folderPath', label: 'Folder Path', visible: false, width: '200px', type: 'text' },
    { key: 'documentLink', label: 'Document Link', visible: false, width: '200px', type: 'text' },
    { key: 'loggedBy', label: 'Logged By', visible: true, width: '150px', type: 'text', required: true },
    { key: 'duration', label: 'Duration', visible: true, width: '120px', type: 'text', required: true }
  ];

  // Sample data
  loggedHours: LoggedHour[] = [
    // Today's records
    {
      id: '1',
      taskId: 'TSK-204',
      title: 'Implement OAuth2 Authentication Flow',
      description: 'Refactored the token exchange logic and integrated PKCE for better security.',
      category: 'Security Enhancement',
      type: 'Feature',
      process: 'Development',
      assignedTo: 'John Smith',
      assignedBy: 'Marcus Thorne',
      department: 'Engineering',
      project: 'Identity Management v3',
      workPlace: 'Office',
      trade: 'Development',
      stage: 'Development',
      section: 'Backend',
      startDate: '2023-10-20',
      targetDate: '2023-10-30',
      timeTaken: '4h 20m',
      progress: 75,
      status: 'In Progress',
      instruction: 'Ensure PKCE compliance and test with multiple OAuth providers',
      count: 3,
      unit: 'Features',
      remarks: 'Good progress, needs testing',
      folderPath: '/projects/auth/oauth2',
      documentLink: 'https://docs.company.com/oauth2-spec',
      duration: '04:20',
      date: '2023-10-26',
      loggedBy: 'John Smith'
    },
    {
      id: '2',
      taskId: 'TSK-189',
      title: 'Database Schema Migration',
      description: 'Finalized the user metadata expansion script and tested on staging.',
      category: 'Back-end',
      type: 'Maintenance',
      process: 'Database',
      assignedTo: 'Sarah Johnson',
      assignedBy: 'Alex Chen',
      department: 'Engineering',
      project: 'Core Platform',
      workPlace: 'Remote',
      trade: 'Database',
      stage: 'Testing',
      section: 'Database',
      startDate: '2023-10-22',
      targetDate: '2023-10-28',
      timeTaken: '1h 52m',
      progress: 90,
      status: 'Review Required',
      instruction: 'Test migration on staging before production deployment',
      count: 5,
      unit: 'Tables',
      remarks: 'Migration script ready for review',
      folderPath: '/database/migrations',
      documentLink: 'https://docs.company.com/db-migration',
      duration: '01:52',
      date: '2023-10-26',
      loggedBy: 'Sarah Johnson'
    },
    {
      id: '3',
      taskId: 'TSK-205',
      title: 'Team Standup',
      description: 'Daily sync with engineering team.',
      category: 'Meeting',
      type: 'Meeting',
      process: 'Communication',
      assignedTo: 'Mike Davis',
      assignedBy: 'Team Lead',
      department: 'Engineering',
      project: 'General',
      workPlace: 'Office',
      trade: 'Management',
      stage: 'Planning',
      section: 'Management',
      startDate: '2023-10-26',
      targetDate: '2023-10-26',
      timeTaken: '30m',
      progress: 100,
      status: 'Completed',
      instruction: 'Regular daily standup meeting',
      count: 1,
      unit: 'Meeting',
      remarks: 'Good team sync',
      folderPath: '/meetings/standup',
      documentLink: 'https://calendar.company.com/standup',
      duration: '00:30',
      date: '2023-10-26',
      loggedBy: 'Mike Davis'
    },
    // Yesterday's records
    {
      id: '4',
      taskId: 'TSK-210',
      title: 'UI Polish - Dashboard Widgets',
      description: 'Adjusted spacing and added empty state illustrations for the analytics tab.',
      category: 'Feature Development',
      type: 'Enhancement',
      process: 'UI/UX',
      assignedTo: 'Emily Chen',
      assignedBy: 'Design Lead',
      department: 'Design',
      project: 'Dashboard v2',
      workPlace: 'Office',
      trade: 'Design',
      stage: 'Development',
      section: 'Frontend',
      startDate: '2023-10-24',
      targetDate: '2023-10-27',
      timeTaken: '8h 15m',
      progress: 85,
      status: 'In Progress',
      instruction: 'Focus on responsive design and accessibility',
      count: 4,
      unit: 'Widgets',
      remarks: 'Great visual improvements',
      folderPath: '/ui/dashboard/widgets',
      documentLink: 'https://figma.com/dashboard-widgets',
      duration: '08:15',
      date: '2023-10-25',
      loggedBy: 'Emily Chen'
    },
    {
      id: '5',
      taskId: 'TSK-211',
      title: 'Code Review: PR #405',
      description: 'Reviewing the new notification system implementation.',
      category: 'Code Review',
      type: 'Review',
      process: 'Quality Assurance',
      assignedTo: 'Alex Rodriguez',
      assignedBy: 'Senior Developer',
      department: 'Engineering',
      project: 'Notification System',
      workPlace: 'Remote',
      trade: 'Development',
      stage: 'Review',
      section: 'Backend',
      startDate: '2023-10-25',
      targetDate: '2023-10-25',
      timeTaken: '1h 15m',
      progress: 100,
      status: 'Completed',
      instruction: 'Review code quality, performance, and security aspects',
      count: 1,
      unit: 'PR',
      remarks: 'Code looks good, minor suggestions provided',
      folderPath: '/reviews/pr-405',
      documentLink: 'https://github.com/company/repo/pull/405',
      duration: '01:15',
      date: '2023-10-25',
      loggedBy: 'Alex Rodriguez'
    },
    // Tuesday's records
    {
      id: '6',
      taskId: 'TSK-202',
      title: 'Critical Bug: Data Export Failure',
      description: 'Hotfix deployed to production. Memory leak during large CSV generation was resolved.',
      category: 'Bug Fix',
      type: 'Bug Fix',
      process: 'Maintenance',
      assignedTo: 'David Wilson',
      assignedBy: 'Product Manager',
      department: 'Engineering',
      project: 'Data Platform',
      workPlace: 'Office',
      trade: 'Development',
      stage: 'Production',
      section: 'Backend',
      startDate: '2023-10-24',
      targetDate: '2023-10-24',
      timeTaken: '7h 30m',
      progress: 100,
      status: 'Completed',
      instruction: 'Critical production issue - immediate fix required',
      count: 1,
      unit: 'Bug',
      remarks: 'Successfully resolved memory leak issue',
      folderPath: '/hotfixes/data-export',
      documentLink: 'https://jira.company.com/TSK-202',
      priority: 'High Priority',
      duration: '07:30',
      date: '2023-10-24',
      loggedBy: 'David Wilson'
    }
  ];

  constructor(private themeService: Theme) {}

  ngOnInit() {
    // Subscribe to theme changes
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
    
    // Initialize component
  }

  getTodayRecords(): LoggedHour[] {
    return this.loggedHours.filter(record => record.date === '2023-10-26');
  }

  getYesterdayRecords(): LoggedHour[] {
    return this.loggedHours.filter(record => record.date === '2023-10-25');
  }

  getTuesdayRecords(): LoggedHour[] {
    return this.loggedHours.filter(record => record.date === '2023-10-24');
  }

  getCategoryClass(category: string): string {
    const categoryMap: { [key: string]: string } = {
      'Security Enhancement': 'security',
      'Back-end': 'backend',
      'Meeting': 'meeting',
      'Feature Development': 'feature',
      'Code Review': 'review',
      'Bug Fix': 'bug'
    };
    return categoryMap[category] || 'default';
  }

  getPriorityClass(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      'High Priority': 'high',
      'Medium Priority': 'medium',
      'Low Priority': 'low'
    };
    return priorityMap[priority] || 'default';
  }

  exportReport() {
    // Implement export functionality
    console.log('Exporting report from', this.fromDate, 'to', this.toDate);
  }

  logNewHours() {
    // Implement add new hours functionality
    console.log('Opening add new hours modal...');
  }

  // Column management methods
  openColumnModal() {
    this.showColumnModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeColumnModal() {
    this.showColumnModal = false;
    document.body.style.overflow = 'auto';
  }

  toggleColumn(columnKey: string) {
    const column = this.availableColumns.find(col => col.key === columnKey);
    if (column && !column.required) {
      column.visible = !column.visible;
    }
  }

  getVisibleColumns(): ColumnDefinition[] {
    return this.availableColumns.filter(col => col.visible);
  }

  resetColumns() {
    // Reset to default visible columns
    this.availableColumns.forEach(col => {
      col.visible = col.required || ['title', 'description', 'category', 'loggedBy', 'duration'].includes(col.key);
    });
  }

  applyColumnChanges() {
    this.closeColumnModal();
    // Column changes are automatically applied since we're using the same array
  }

  formatColumnValue(value: any, column: ColumnDefinition): string {
    if (!value && value !== 0) return '-';
    
    switch (column.type) {
      case 'percentage':
        return `${value}%`;
      case 'date':
        if (typeof value === 'string') {
          const date = new Date(value);
          return isNaN(date.getTime()) ? value : date.toLocaleDateString();
        }
        return value.toString();
      case 'number':
        return typeof value === 'number' ? value.toString() : value;
      case 'select':
        return value.toString();
      default:
        return value.toString();
    }
  }

  getGridTemplateColumns(): string {
    const visibleColumns = this.getVisibleColumns();
    
    // Calculate dynamic widths based on column content and type
    return visibleColumns.map(col => {
      // Set specific widths for different column types
      switch (col.key) {
        case 'title':
          return '300px'; // Wider for title + description
        case 'description':
          return '350px'; // Wide for description text
        case 'category':
          return '180px';
        case 'loggedBy':
          return '150px';
        case 'duration':
          return '120px';
        case 'progress':
          return '140px';
        case 'taskId':
          return '120px';
        case 'startDate':
        case 'targetDate':
          return '130px';
        case 'status':
        case 'type':
        case 'trade':
        case 'stage':
        case 'section':
          return '120px';
        case 'assignedTo':
        case 'assignedBy':
        case 'department':
          return '150px';
        case 'project':
        case 'workPlace':
          return '180px';
        case 'process':
        case 'instruction':
        case 'remarks':
          return '200px';
        case 'folderPath':
        case 'documentLink':
          return '250px';
        case 'count':
        case 'unit':
          return '100px';
        case 'timeTaken':
          return '120px';
        default:
          return col.width || '150px';
      }
    }).join(' ');
  }

  getRequiredColumnsCount(): number {
    return this.availableColumns.filter(col => col.required).length;
  }

  // Add tooltip functionality for truncated content
  getTooltipText(record: LoggedHour, columnKey: string): string {
    const value = this.getColumnValue(record, columnKey);
    return value ? value.toString() : '';
  }

  // Enhanced column value getter with better type handling
  getColumnValue(record: LoggedHour, columnKey: string): any {
    const value = (record as any)[columnKey];
    
    // Handle special cases
    if (columnKey === 'progress' && typeof value === 'number') {
      return Math.min(100, Math.max(0, value)); // Ensure progress is between 0-100
    }
    
    if (columnKey === 'count' && value === undefined) {
      return 0;
    }
    
    return value || '';
  }

  // Column search functionality
  searchColumns(searchTerm: string) {
    if (!searchTerm.trim()) {
      // Show all columns if search is empty
      return;
    }
    
    const term = searchTerm.toLowerCase();
    // This would filter the visible columns in the modal
    // Implementation depends on how you want to handle the search
    console.log('Searching columns for:', term);
  }

  // Method to get column statistics for the modal
  getColumnStats() {
    const visible = this.getVisibleColumns().length;
    const total = this.availableColumns.length;
    const required = this.getRequiredColumnsCount();
    
    return {
      visible,
      hidden: total - visible,
      required,
      total
    };
  }

  // Helper method to check if description column is visible
  isDescriptionColumnVisible(): boolean {
    return this.getVisibleColumns().some(col => col.key === 'description');
  }
}