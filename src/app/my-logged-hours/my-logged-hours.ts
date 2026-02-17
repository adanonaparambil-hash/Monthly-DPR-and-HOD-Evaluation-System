import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Theme } from '../services/theme';
import { Api } from '../services/api';
import { TaskDetailsModalComponent } from '../components/task-details-modal/task-details-modal.component';
import { ToasterComponent } from '../components/toaster/toaster.component';

interface LoggedHour {
  id: string;
  taskId?: string;
  title: string;
  description: string;
  category: string;
  categoryId?: number;  // Added for modal
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
  dailyComment?: string;
}

interface Project {
  projectId: number;
  projectName: string;
  departmentId?: number;
  isActive?: string;
}

interface Department {
  departmentId: number;
  deptCode: string;
  deptName: string;
  status: string;
}

interface TaskCategory {
  categoryId: number;
  categoryName: string;
  departmentId: number;
  departmentName?: string;
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
  imports: [CommonModule, FormsModule, ToasterComponent, TaskDetailsModalComponent],
  templateUrl: './my-logged-hours.html',
  styleUrls: ['./my-logged-hours.css']
})
export class MyLoggedHoursComponent implements OnInit {
  isDarkMode = false;
  
  // Filter properties - Updated with API integration
  fromDate = '';
  toDate = '';
  selectedProject: string | number = 'all';
  selectedDepartment: string | number = 'all';
  selectedCategory: string | number = 'all';

  // API data
  projects: Project[] = [];
  departments: Department[] = [];
  taskCategories: TaskCategory[] = [];
  
  // Loading state
  isLoadingData = false;

  // Task Details Modal
  showTaskModal = false;
  selectedTaskId: number = 0;
  selectedTaskCategoryId: number = 0;
  currentUserId: string = '';

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

  // Logged hours data from API (no hardcoded data)
  loggedHours: LoggedHour[] = [];

  constructor(
    private themeService: Theme,
    private api: Api
  ) {}

  ngOnInit() {
    // Subscribe to theme changes
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
    
    // Get current user ID for modal
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    this.currentUserId = currentUser.empId || currentUser.employeeId || '';
    
    // Set default date range (1st of current month to today)
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    this.fromDate = this.formatDateForInput(firstDayOfMonth);
    this.toDate = this.formatDateForInput(today);
    
    // Load dropdown data from API
    this.loadProjects();
    this.loadDepartments();
    this.loadAllTaskCategories();
    
    // Load logged hours data
    this.loadLoggedHours();
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadProjects() {
    console.log('Loading projects for My Logged Hours');
    
    this.api.getProjects().subscribe({
      next: (response) => {
        console.log('getProjects API Response:', response);
        
        if (response.success && response.data) {
          this.projects = response.data;
          console.log('Loaded projects:', this.projects.length);
        } else {
          console.warn('API response success is false or no data:', response);
        }
      },
      error: (error) => {
        console.error('Error loading projects:', error);
      }
    });
  }

  loadDepartments() {
    console.log('Loading departments for My Logged Hours');
    
    this.api.getDepartmentList().subscribe({
      next: (response) => {
        console.log('getDepartmentList API Response:', response);
        
        if (response.success && response.data) {
          // Filter only active departments (status === 'Y')
          this.departments = response.data.filter((dept: Department) => dept.status === 'Y');
          console.log('Loaded departments:', this.departments.length);
        } else {
          console.warn('API response success is false or no data:', response);
        }
      },
      error: (error) => {
        console.error('Error loading departments:', error);
      }
    });
  }

  loadAllTaskCategories() {
    console.log('Loading all task categories for My Logged Hours');
    
    // Use current user ID to load their categories
    const userId = this.currentUserId;
    if (!userId) {
      console.warn('No user ID available to load task categories');
      return;
    }
    
    this.api.getUserTaskCategories(userId).subscribe({
      next: (response: any) => {
        console.log('getUserTaskCategories API Response:', response);
        
        if (response.success && response.data) {
          // Combine all categories from different lists
          const allCategories = [
            ...(response.data.favouriteList || []),
            ...(response.data.departmentList || []),
            ...(response.data.allDepartmentList || [])
          ];
          
          // Remove duplicates based on categoryId
          const uniqueCategories = allCategories.filter((category: any, index: number, self: any[]) =>
            index === self.findIndex((c: any) => c.categoryId === category.categoryId)
          );
          
          this.taskCategories = uniqueCategories;
          console.log('Loaded task categories:', this.taskCategories.length);
        } else {
          console.warn('API response success is false or no data:', response);
        }
      },
      error: (error: any) => {
        console.error('Error loading task categories:', error);
      }
    });
  }

  onDepartmentChange() {
    console.log('Department changed to:', this.selectedDepartment);
    
    // Reset task category selection
    this.selectedCategory = 'all';
    this.taskCategories = [];
    
    // If "All Departments" is selected, don't load categories
    if (this.selectedDepartment === 'all') {
      // Reload logged hours with updated filter
      this.loadLoggedHours();
      return;
    }
    
    // Load task categories for the selected department
    this.loadDepartmentTaskCategories(Number(this.selectedDepartment));
    
    // Reload logged hours with updated filter
    this.loadLoggedHours();
  }

  loadDepartmentTaskCategories(departmentId: number) {
    console.log('Loading task categories for department:', departmentId);
    
    this.api.getDepartmentTaskCategories(departmentId).subscribe({
      next: (response) => {
        console.log('getDepartmentTaskCategories API Response:', response);
        
        if (response.success && response.data) {
          // Combine all categories from favouriteList, departmentList, and allDepartmentList
          const allCategories = [
            ...(response.data.favouriteList || []),
            ...(response.data.departmentList || []),
            ...(response.data.allDepartmentList || [])
          ];
          
          // Remove duplicates based on categoryId
          const uniqueCategories = allCategories.filter((category, index, self) =>
            index === self.findIndex((c) => c.categoryId === category.categoryId)
          );
          
          this.taskCategories = uniqueCategories;
          console.log('Loaded task categories:', this.taskCategories.length);
        } else {
          console.warn('API response success is false or no data:', response);
        }
      },
      error: (error) => {
        console.error('Error loading task categories:', error);
      }
    });
  }

  onProjectChange() {
    console.log('Project changed to:', this.selectedProject);
    // Reload logged hours with updated filter
    this.loadLoggedHours();
  }

  onCategoryChange() {
    console.log('Category changed to:', this.selectedCategory);
    // Reload logged hours with updated filter
    this.loadLoggedHours();
  }

  onDateChange() {
    console.log('Date range changed:', this.fromDate, 'to', this.toDate);
    // Reload logged hours with updated filter
    this.loadLoggedHours();
  }

  loadLoggedHours() {
    console.log('Loading logged hours from API');
    this.isLoadingData = true;
    
    // Get current user
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const userId = currentUser.empId || currentUser.employeeId || '';
    
    if (!userId) {
      console.error('No user ID found');
      this.isLoadingData = false;
      return;
    }
    
    const request = {
      userId: userId,
      fromDate: this.fromDate || undefined,
      toDate: this.toDate || undefined,
      projectId: this.selectedProject !== 'all' ? Number(this.selectedProject) : undefined,
      categoryId: this.selectedCategory !== 'all' ? Number(this.selectedCategory) : undefined
    };
    
    console.log('getUserDailyLogHistory request:', request);
    
    this.api.getUserDailyLogHistory(request).subscribe({
      next: (response) => {
        console.log('getUserDailyLogHistory API Response:', response);
        
        if (response && response.success && response.data) {
          // Map API response to LoggedHour interface
          this.loggedHours = response.data.map((log: any, index: number) => ({
            id: `${log.taskId}-${index}`,
            taskId: `TSK-${log.taskId}`,
            title: log.taskTitle || 'Untitled Task',
            description: log.description || log.dailyComment || 'No description',
            category: log.categoryName || 'Uncategorized',
            categoryId: log.categoryId ?? 0,
            duration: log.duration || '00:00',
            date: log.logDate ? log.logDate.split('T')[0] : '',
            project: log.projectName || 'No Project',
            loggedBy: log.loggedBy || '',
            dailyComment: log.dailyComment || ''
          }));
          
          console.log('Loaded logged hours:', this.loggedHours.length, 'records');
        } else if (response && Array.isArray(response.data)) {
          // Handle direct array response
          this.loggedHours = response.data.map((log: any, index: number) => ({
            id: `${log.taskId}-${index}`,
            taskId: `TSK-${log.taskId}`,
            title: log.taskTitle || 'Untitled Task',
            description: log.description || log.dailyComment || 'No description',
            category: log.categoryName || 'Uncategorized',
            categoryId: log.categoryId ?? 0,
            duration: log.duration || '00:00',
            date: log.logDate ? log.logDate.split('T')[0] : '',
            project: log.projectName || 'No Project',
            loggedBy: log.loggedBy || '',
            dailyComment: log.dailyComment || ''
          }));
          
          console.log('Loaded logged hours (direct array):', this.loggedHours.length, 'records');
        } else {
          console.warn('No logged hours data found');
          this.loggedHours = [];
        }
        
        this.isLoadingData = false;
      },
      error: (error) => {
        console.error('Error loading logged hours:', error);
        this.loggedHours = [];
        this.isLoadingData = false;
      }
    });
  }

  // Group logged hours by date
  getGroupedLoggedHours(): { date: string; displayDate: string; displayDay: string; records: LoggedHour[] }[] {
    // Group records by date
    const grouped = this.loggedHours.reduce((acc, record) => {
      if (!acc[record.date]) {
        acc[record.date] = [];
      }
      acc[record.date].push(record);
      return acc;
    }, {} as { [key: string]: LoggedHour[] });
    
    // Convert to array and sort by date (newest first)
    const groupedArray = Object.keys(grouped).map(date => ({
      date: date,
      displayDate: this.formatDisplayDate(date),
      displayDay: this.formatDisplayDay(date),
      records: grouped[date]
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return groupedArray;
  }

  formatDisplayDate(dateString: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  formatDisplayDay(dateString: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    // Reset time parts for comparison
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    if (date.getTime() === today.getTime()) {
      return 'Today';
    } else if (date.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      const options: Intl.DateTimeFormatOptions = { weekday: 'long' };
      return date.toLocaleDateString('en-US', options);
    }
  }

  getTodayRecords(): LoggedHour[] {
    const today = this.formatDateForInput(new Date());
    return this.loggedHours.filter(record => record.date === today);
  }

  getYesterdayRecords(): LoggedHour[] {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this.formatDateForInput(yesterday);
    return this.loggedHours.filter(record => record.date === yesterdayStr);
  }

  getTuesdayRecords(): LoggedHour[] {
    // Get records from 2 days ago
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoStr = this.formatDateForInput(twoDaysAgo);
    return this.loggedHours.filter(record => record.date === twoDaysAgoStr);
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

  // Task Details Modal Methods
  openTaskModal(record: LoggedHour) {
    // Extract taskId from the record (remove 'TSK-' prefix)
    const taskIdStr = record.taskId?.replace('TSK-', '') || '0';
    this.selectedTaskId = parseInt(taskIdStr, 10);
    
    // Get current user for userId
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const userId = currentUser.empId || currentUser.employeeId || '';
    
    // Use categoryId from API response if valid (not 0, null, undefined)
    // Otherwise fall back to finding it from taskCategories array
    let categoryId = record.categoryId;
    if (!categoryId || categoryId === 0) {
      // Try to find categoryId from taskCategories array by matching category name
      const category = this.taskCategories.find(cat => cat.categoryName === record.category);
      categoryId = category?.categoryId || 0;
    }
    this.selectedTaskCategoryId = categoryId;
    
    console.log('Opening task modal:', {
      taskId: this.selectedTaskId,
      categoryId: this.selectedTaskCategoryId,
      userId: userId,
      recordCategoryId: record.categoryId
    });
    
    this.showTaskModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeTaskModal() {
    this.showTaskModal = false;
    document.body.style.overflow = 'auto';
    
    // Reload logged hours to reflect any changes made in the modal
    this.loadLoggedHours();
  }

  // Handle task updated event from modal
  onTaskUpdated(task: any) {
    console.log('Task updated from modal:', task);
    // Reload logged hours to reflect changes
    this.loadLoggedHours();
  }

  // Handle task paused event from modal
  onTaskPaused(taskId: number) {
    console.log('Task paused from modal:', taskId);
  }

  // Handle task resumed event from modal
  onTaskResumed(taskId: number) {
    console.log('Task resumed from modal:', taskId);
  }

  // Handle task stopped event from modal
  onTaskStopped(taskId: number) {
    console.log('Task stopped from modal:', taskId);
    // Reload logged hours to reflect changes
    this.loadLoggedHours();
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