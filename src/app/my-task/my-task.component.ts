import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Theme } from '../services/theme';
import { Api } from '../services/api';
import { AuthService } from '../services/auth.service';

interface Task {
  id: number;
  title: string;
  description: string;
  status: 'NOT STARTED' | 'IN PROGRESS' | 'COMPLETED' | 'PENDING' | 'ON HOLD';
  category: string;
  loggedHours: string;
  totalHours: string;
  startDate: string;
  assignee: string;
  progress: number;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  isFavorite?: boolean;
}

interface NewTask {
  name: string;
  description: string;
  assignee: string;
  type: 'single' | 'continuous';
  date: string;
  estimatedHours: number;
  subtasks: Subtask[];
}

interface Subtask {
  id: number;
  name: string;
  completed: boolean;
  estimatedHours: number;
  isRunning: boolean;
  timeSpent: number;
}

interface Assignee {
  id: string;
  name: string;
  role: string;
}

interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'textarea' | 'date';
  description: string;
  options?: string[];
  value?: any;
  fieldId?: number;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: Date;
  url?: string;
}

interface ActivityLog {
  id: string;
  type: 'timer_start' | 'timer_pause' | 'timer_stop' | 'status_change' | 'comment' | 'file_upload' | 'subtask_complete' | 'task_update';
  description: string;
  timestamp: Date;
  user: string;
  duration?: string;
  details?: any;
}

interface SubtaskDetailed {
  id: number;
  name: string;
  completed: boolean;
  estimatedHours: number;
  isRunning: boolean;
  timeSpent: number;
  startTime?: Date;
  totalLoggedTime: number;
}

interface TaskCategory {
  categoryId: number;
  categoryName: string;
  departmentId: number;
  departmentName?: string;
  sequenceNumber?: number;
  isEditing?: boolean;
}

interface TaskCategoryResponse {
  success: boolean;
  message: string;
  data: {
    favouriteList: TaskCategory[];
    departmentList: TaskCategory[];
    allDepartmentList: TaskCategory[];
  };
}

@Component({
  selector: 'app-my-task',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './my-task.component.html',
  styleUrls: ['./my-task.component.css', './task-modal-new.css', './task-details-modal.css', './task-modal-glassmorphism.css']
})
export class MyTaskComponent implements OnInit, OnDestroy {
  isDarkMode = false;

  // Active task state
  hasActiveTask = true; // Set to false when no active task
  activeTask: Task | null = null; // Currently active task

  // Timer and stats
  activeTaskTimer = '00:42:15';
  punchedHours = '04:20:00';
  runningTime = '02:15:45';

  // Legacy properties for backward compatibility
  activeTaskCategory = 'DEVELOPMENT';
  activeTaskStartDate = '2024-01-15';
  activeTaskAssignee = 'John Doe';

  // Break management
  isOnBreak = false;
  breakStatus = 'Working';
  nextBreakCountdown = '1:23:45';

  // Break Tracker
  selectedBreakType: 'lunch' | 'coffee' | 'quick' | null = null;
  breakRemarks = '';
  isBreakRunning = false;
  isBreakPaused = false;
  breakTimerDisplay = '00:00:00';
  breakTimerCaption = 'Select break type to start';
  breakStartTime: Date | null = null;
  breakElapsedSeconds = 0;
  breakTimerInterval: any = null;

  // Tab management
  activeTab = 'MY TASKS';
  myTasksCount = 13;
  assignedToOthersCount = 8;
  searchTerm = '';

  // Pagination
  currentPage = 1;
  totalPages = 2;
  currentPageTasks = 3;
  totalTasks = 12;

  // Modal state
  showCreateTaskModal = false;
  showTaskDetailsModal = false;
  showSelectTaskModal = false;
  showCustomFieldsModal = false;
  showAddFieldModal = false;
  showManageTasksModal = false; // New modal for managing task categories
  selectedTask: Task | null = null;
  selectTaskActiveTab: 'favorites' | 'myDepartment' | 'all' = 'favorites';

  // Task Categories Management
  taskCategories: TaskCategory[] = [];
  favouriteList: TaskCategory[] = [];
  departmentList: TaskCategory[] = [];
  allDepartmentList: TaskCategory[] = [];
  newTaskCategory: TaskCategory = { categoryId: 0, categoryName: '', departmentId: 0, departmentName: '', sequenceNumber: 0 };
  isAddingNewCategory = false;
  selectedDepartmentFilter = 'ALL'; // Department filter
  selectedCategoryId: number | null = null; // Store selected category ID for logging hours

  // Department Master List from API
  departmentMasterList: any[] = [];

  // Get departments for filter dropdown
  getDepartments(): string[] {
    if (this.departmentMasterList.length > 0) {
      const deptNames = this.departmentMasterList.map(dept => dept.deptName);
      return ['ALL', ...deptNames];
    }
    // Fallback to task categories if API hasn't loaded yet
    const departments = this.allDepartmentList.map(cat => cat.departmentName || 'Unknown');
    return ['ALL', ...Array.from(new Set(departments)).sort()];
  }

  // Get filtered task categories based on selected department
  getFilteredCategories(): TaskCategory[] {
    if (this.selectedDepartmentFilter === 'ALL') {
      return this.allDepartmentList;
    }
    return this.allDepartmentList.filter(cat => cat.departmentName === this.selectedDepartmentFilter);
  }

  // Files tab only (subtasks tab removed)
  activeSubtaskTab: 'files' = 'files';
  uploadedFiles: UploadedFile[] = [];

  // Activity and History
  activeSidebarTab: 'comments' | 'history' = 'comments';
  activityLogs: ActivityLog[] = [];
  detailedSubtasks: SubtaskDetailed[] = [];

  // Selected task additional properties
  selectedTaskProject = 'marketing-q4';
  selectedTaskBudget = 1250.00;
  selectedTaskEndDate = '2023-11-05';
  selectedTaskStatus: 'continuous' | 'closed' = 'continuous';
  selectedTaskPriority = 'medium';
  selectedTaskEstimatedHours = 40;
  selectedTaskDetailStatus = 'running';
  selectedTaskDepartment = 'engineering';
  selectedTaskClient = 'Acme Corporation';
  editMode = false;

  // Editable task fields
  editableTaskTitle = 'Initial Design Sprint: UI Component Library';
  editableTaskDescription = 'The primary goal of this phase is to establish a cohesive UI component library for the new marketing dashboard. This includes defining color tokens, typography scales, and building core components like buttons, inputs, and navigation patterns. All assets should be documented in Figma and exported for the frontend team.';
  dailyRemarks = ''; // Daily remarks field

  // New task form data
  newTask: NewTask = {
    name: '',
    description: '',
    assignee: '',
    type: 'single',
    date: '',
    estimatedHours: 0,
    subtasks: []
  };

  // Custom Fields - Project Metadata Fields
  selectedCustomFields: CustomField[] = [];
  availableCustomFields: CustomField[] = []; // Will be loaded from API

  // Temporary selection for the add field modal
  tempSelectedFields: string[] = [];

  // Available assignees
  assignees: Assignee[] = [
    { id: 'me', name: 'Myself', role: 'Self' },
    { id: 'john', name: 'John Doe', role: 'Developer' },
    { id: 'sarah', name: 'Sarah Smith', role: 'Designer' },
    { id: 'alex', name: 'Alex Johnson', role: 'HOD' }
  ];

  // Employee Master List from API
  employeeMasterList: any[] = [];
  selectedAssigneeId: string = '';

  // Projects List from API
  projectsList: any[] = [];
  selectedProjectId: string = '';

  // Project dropdown state
  projectSearchTerm: string = '';
  isProjectDropdownVisible: boolean = false;

  // Assignee dropdown state
  assigneeSearchTerm: string = '';
  isAssigneeDropdownVisible: boolean = false;

  // Sample tasks data
  tasks: Task[] = [
    {
      id: 1,
      title: 'UI Design Refactor',
      description: 'Updating the component library with fresh variant designs',
      status: 'IN PROGRESS',
      category: 'DEVELOPMENT',
      loggedHours: '12h',
      totalHours: '12.5h',
      startDate: '2024-01-10',
      assignee: 'John Doe',
      progress: 75,
      isFavorite: true
    },
    {
      id: 2,
      title: 'Backend API Audit',
      description: 'Security review of authentication endpoints',
      status: 'PENDING',
      category: 'SECURITY',
      loggedHours: '0.0h',
      totalHours: '0.0h',
      startDate: '2024-01-12',
      assignee: 'Sarah Wilson',
      progress: 0
    },
    {
      id: 3,
      title: 'QA Testing Sprint',
      description: 'Manual testing for mobile responsiveness',
      status: 'ON HOLD',
      category: 'QUALITY ASSURANCE',
      loggedHours: '21h',
      totalHours: '4.2h',
      startDate: '2024-01-08',
      assignee: 'Mike Johnson',
      progress: 45
    },
    {
      id: 4,
      title: 'Database Optimization',
      description: 'Optimize query performance and indexing',
      status: 'NOT STARTED',
      category: 'DEVELOPMENT',
      loggedHours: '0.0h',
      totalHours: '8.0h',
      startDate: '2024-01-15',
      assignee: 'Alex Brown',
      progress: 0
    },
    {
      id: 5,
      title: 'User Documentation',
      description: 'Create comprehensive user guides and API documentation',
      status: 'IN PROGRESS',
      category: 'DOCUMENTATION',
      loggedHours: '6.5h',
      totalHours: '15.0h',
      startDate: '2024-01-09',
      assignee: 'Emily Davis',
      progress: 30
    },
    {
      id: 6,
      title: 'Code Review Guidelines',
      description: 'Establish coding standards and review processes',
      status: 'NOT STARTED',
      category: 'DOCUMENTATION',
      loggedHours: '0.0h',
      totalHours: '6.0h',
      startDate: '2024-01-20',
      assignee: 'Sarah Wilson',
      progress: 0
    }
  ];

  // Progress Circle 3D Properties
  taskProgress = 75;
  isDraggingProgress = false;
  isProgressAnimating = false;
  isProgressChanging = false;
  private progressCircle3DElement: HTMLElement | null = null;

  // Math functions for handle position
  Math = Math;

  constructor(
    private themeService: Theme,
    private api: Api,
    private authService: AuthService
  ) { }

  ngOnInit() {
    // Subscribe to theme changes
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    // Initialize component
    this.initializeDetailedSubtasks();
    this.initializeActivityLogs();

    // Set active task if there's one in progress
    const inProgressTask = this.tasks.find(t => t.status === 'IN PROGRESS');
    if (inProgressTask) {
      this.activeTask = inProgressTask;
      this.hasActiveTask = true;
    } else {
      this.activeTask = null;
      this.hasActiveTask = false;
    }

    // Load employee master list for assignee dropdown
    this.loadEmployeeMasterList();

    // Load projects list for project dropdown
    this.loadProjectsList();

    // Load custom fields from API
    this.loadCustomFields();

    // Load task categories from API
    this.loadTaskCategories();

    // Load department list for filter dropdown
    this.loadDepartmentList();

    // Set logged-in user as default assignee
    this.setLoggedInUserAsDefaultAssignee();
  }

  // Load Employee Master List from API
  loadEmployeeMasterList(): void {
    this.api.GetEmployeeMasterList().subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.employeeMasterList = response.data.map((emp: any) => ({
            idValue: emp.idValue || emp.empId || emp.id || emp.employeeId,
            description: emp.description || emp.employeeName || emp.name,
            email: emp.email || emp.Email || emp.emailId || emp.EmailId,
            phoneNumber: emp.phoneNumber || emp.PhoneNumber || emp.phone || emp.Phone
          }));
          console.log('Employee Master List loaded for assignee dropdown:', this.employeeMasterList.length, 'employees');

          // Set default assignee after list is loaded
          this.setLoggedInUserAsDefaultAssignee();
        } else if (response && Array.isArray(response)) {
          // Handle direct array response
          this.employeeMasterList = response.map((emp: any) => ({
            idValue: emp.idValue || emp.empId || emp.id || emp.employeeId,
            description: emp.description || emp.employeeName || emp.name,
            email: emp.email || emp.Email || emp.emailId || emp.EmailId,
            phoneNumber: emp.phoneNumber || emp.PhoneNumber || emp.phone || emp.Phone
          }));
          console.log('Employee Master List loaded (direct array):', this.employeeMasterList.length, 'employees');

          // Set default assignee after list is loaded
          this.setLoggedInUserAsDefaultAssignee();
        }
      },
      error: (error: any) => {
        console.error('Error loading employee master list:', error);
        // Keep using default assignees if API fails
      }
    });
  }

  // Load Projects List from API
  loadProjectsList(): void {
    this.api.getProjects().subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.projectsList = response.data.map((project: any) => ({
            projectId: project.projectId || project.ProjectId || project.id,
            projectName: project.projectName || project.ProjectName || project.name,
            departmentId: project.departmentId || project.DepartmentId,
            isActive: project.isActive || project.IsActive
          }));
          console.log('Projects List loaded:', this.projectsList.length, 'projects');

          // Auto-select first project if none selected
          if (this.projectsList.length > 0 && !this.selectedProjectId) {
            this.selectedProjectId = this.projectsList[0].projectId?.toString() || '';
          }
        } else if (response && Array.isArray(response)) {
          // Handle direct array response
          this.projectsList = response.map((project: any) => ({
            projectId: project.projectId || project.ProjectId || project.id,
            projectName: project.projectName || project.ProjectName || project.name,
            departmentId: project.departmentId || project.DepartmentId,
            isActive: project.isActive || project.IsActive
          }));
          console.log('Projects List loaded (direct array):', this.projectsList.length, 'projects');

          // Auto-select first project if none selected
          if (this.projectsList.length > 0 && !this.selectedProjectId) {
            this.selectedProjectId = this.projectsList[0].projectId?.toString() || '';
          }
        }
      },
      error: (error: any) => {
        console.error('Error loading projects list:', error);
        // Keep empty list if API fails
      }
    });
  }

  // Load Custom Fields from API
  loadCustomFields(): void {
    this.api.getCustomFields().subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.availableCustomFields = response.data.map((field: any) => ({
            key: field.fieldName?.toLowerCase().replace(/\s+/g, '_') || `field_${field.fieldId}`,
            label: field.fieldName || 'Custom Field',
            type: this.mapFieldType(field.fieldType),
            description: `${field.fieldName} field`,
            options: field.options || [],
            fieldId: field.fieldId
          }));
          console.log('Custom Fields loaded:', this.availableCustomFields.length, 'fields');
        } else if (response && Array.isArray(response)) {
          // Handle direct array response
          this.availableCustomFields = response.map((field: any) => ({
            key: field.fieldName?.toLowerCase().replace(/\s+/g, '_') || `field_${field.fieldId}`,
            label: field.fieldName || 'Custom Field',
            type: this.mapFieldType(field.fieldType),
            description: `${field.fieldName} field`,
            options: field.options || [],
            fieldId: field.fieldId
          }));
          console.log('Custom Fields loaded (direct array):', this.availableCustomFields.length, 'fields');
        }
      },
      error: (error: any) => {
        console.error('Error loading custom fields:', error);
        // Keep default fields if API fails
      }
    });
  }

  // Map API field type to component field type
  mapFieldType(apiFieldType: string): 'text' | 'number' | 'dropdown' | 'textarea' | 'date' {
    const typeMap: { [key: string]: 'text' | 'number' | 'dropdown' | 'textarea' | 'date' } = {
      'Text': 'text',
      'Dropdown': 'dropdown',
      'Number': 'number',
      'Textarea': 'textarea',
      'Date': 'date'
    };
    return typeMap[apiFieldType] || 'text';
  }

  // Load Task Categories from API
  loadTaskCategories(): void {
    // Get user ID from session/localStorage
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const userId = currentUser.empId || currentUser.employeeId || '1';
    
    this.api.getUserTaskCategories(userId).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          // Map API response to TaskCategory interface with sequenceNumber
          this.favouriteList = (response.data.favouriteList || []).map((cat: any) => ({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            departmentId: cat.departmentId,
            departmentName: cat.departmentName,
            sequenceNumber: cat.eSTIMATEDHOURS || cat.estimatedHours || 0,
            isEditing: false
          }));
          
          this.departmentList = (response.data.departmentList || []).map((cat: any) => ({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            departmentId: cat.departmentId,
            departmentName: cat.departmentName,
            sequenceNumber: cat.eSTIMATEDHOURS || cat.estimatedHours || 0,
            isEditing: false
          }));
          
          this.allDepartmentList = (response.data.allDepartmentList || []).map((cat: any) => ({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            departmentId: cat.departmentId,
            departmentName: cat.departmentName,
            sequenceNumber: cat.eSTIMATEDHOURS || cat.estimatedHours || 0,
            isEditing: false
          }));
          
          this.taskCategories = [...this.allDepartmentList];
          console.log('Task Categories loaded for user:', userId, 
            'Favorites:', this.favouriteList.length, 
            'Department:', this.departmentList.length, 
            'All:', this.allDepartmentList.length);
          
          // Debug: Log first category to see structure
          if (this.allDepartmentList.length > 0) {
            console.log('Sample category with sequenceNumber:', this.allDepartmentList[0]);
          }
        } else if (response && response.data) {
          // Handle direct data response
          this.favouriteList = (response.data.favouriteList || []).map((cat: any) => ({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            departmentId: cat.departmentId,
            departmentName: cat.departmentName,
            sequenceNumber: cat.eSTIMATEDHOURS || cat.estimatedHours || 0,
            isEditing: false
          }));
          
          this.departmentList = (response.data.departmentList || []).map((cat: any) => ({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            departmentId: cat.departmentId,
            departmentName: cat.departmentName,
            sequenceNumber: cat.eSTIMATEDHOURS || cat.estimatedHours || 0,
            isEditing: false
          }));
          
          this.allDepartmentList = (response.data.allDepartmentList || []).map((cat: any) => ({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            departmentId: cat.departmentId,
            departmentName: cat.departmentName,
            sequenceNumber: cat.eSTIMATEDHOURS || cat.estimatedHours || 0,
            isEditing: false
          }));
          
          this.taskCategories = [...this.allDepartmentList];
          console.log('Task Categories loaded (direct data) for user:', userId, this.allDepartmentList.length);
          
          // Debug: Log first category to see structure
          if (this.allDepartmentList.length > 0) {
            console.log('Sample category with sequenceNumber:', this.allDepartmentList[0]);
          }
        }
      },
      error: (error: any) => {
        console.error('Error loading task categories:', error);
        // Keep empty lists if API fails
      }
    });
  }

  // Load Department List from API for filter dropdown
  loadDepartmentList(): void {
    this.api.getDepartmentList().subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.departmentMasterList = response.data.map((dept: any) => ({
            departmentId: dept.departmentId || dept.DepartmentId || 0,
            deptCode: dept.deptCode || dept.DeptCode || '',
            deptName: dept.deptName || dept.DeptName || 'Unknown',
            status: dept.status || dept.Status || 'Y',
            createdBy: dept.createdBy || dept.CreatedBy || '',
            createdOn: dept.createdOn || dept.CreatedOn || ''
          }));
          console.log('Department List loaded for filter:', this.departmentMasterList.length, 'departments');
        } else if (response && Array.isArray(response)) {
          // Handle direct array response
          this.departmentMasterList = response.map((dept: any) => ({
            departmentId: dept.departmentId || dept.DepartmentId || 0,
            deptCode: dept.deptCode || dept.DeptCode || '',
            deptName: dept.deptName || dept.DeptName || 'Unknown',
            status: dept.status || dept.Status || 'Y',
            createdBy: dept.createdBy || dept.CreatedBy || '',
            createdOn: dept.createdOn || dept.CreatedOn || ''
          }));
          console.log('Department List loaded (direct array):', this.departmentMasterList.length, 'departments');
        } else if (response && response.data && Array.isArray(response.data)) {
          // Handle response.data as array
          this.departmentMasterList = response.data.map((dept: any) => ({
            departmentId: dept.departmentId || dept.DepartmentId || 0,
            deptCode: dept.deptCode || dept.DeptCode || '',
            deptName: dept.deptName || dept.DeptName || 'Unknown',
            status: dept.status || dept.Status || 'Y',
            createdBy: dept.createdBy || dept.CreatedBy || '',
            createdOn: dept.createdOn || dept.CreatedOn || ''
          }));
          console.log('Department List loaded (response.data array):', this.departmentMasterList.length, 'departments');
        }
      },
      error: (error: any) => {
        console.error('Error loading department list:', error);
        // Keep empty list if API fails
      }
    });
  }

  // Assignee Searchable Dropdown Methods
  showAssigneeDropdown(): void {
    this.isAssigneeDropdownVisible = true;
  }

  hideAssigneeDropdown(): void {
    setTimeout(() => {
      this.isAssigneeDropdownVisible = false;
    }, 200);
  }

  onAssigneeSearchInputChange(event: any): void {
    this.assigneeSearchTerm = event.target?.value || '';
  }

  getFilteredAssignees(): any[] {
    const list = this.employeeMasterList || [];
    if (!this.assigneeSearchTerm || this.assigneeSearchTerm.trim() === '') {
      return list;
    }

    const searchLower = this.assigneeSearchTerm.toLowerCase().trim();
    return list.filter((employee: any) => {
      const description = (employee.description || '').toLowerCase();
      const idValue = (employee.idValue || '').toLowerCase();
      return description.includes(searchLower) || idValue.includes(searchLower);
    });
  }

  selectAssignee(employee: any): void {
    this.selectedAssigneeId = employee.idValue || '';
    this.assigneeSearchTerm = '';
    this.isAssigneeDropdownVisible = false;
  }

  isAssigneeSelected(employee: any): boolean {
    return this.selectedAssigneeId === employee.idValue;
  }

  getAssigneeDisplayName(): string {
    if (!this.selectedAssigneeId) {
      // If no selection and list is loaded, show first employee as default
      if (this.employeeMasterList.length > 0) {
        return this.employeeMasterList[0].description || 'Select assignee...';
      }
      return 'Select assignee...';
    }
    const selected = this.employeeMasterList.find(emp => emp.idValue === this.selectedAssigneeId);
    return selected ? selected.description : 'Select assignee...';
  }

  // Project Searchable Dropdown Methods
  showProjectDropdown(): void {
    this.isProjectDropdownVisible = true;
  }

  hideProjectDropdown(): void {
    setTimeout(() => {
      this.isProjectDropdownVisible = false;
    }, 200);
  }

  onProjectSearchInputChange(event: any): void {
    this.projectSearchTerm = event.target?.value || '';
  }

  getFilteredProjects(): any[] {
    const list = this.projectsList || [];
    if (!this.projectSearchTerm || this.projectSearchTerm.trim() === '') {
      return list;
    }

    const searchLower = this.projectSearchTerm.toLowerCase().trim();
    return list.filter((project: any) => {
      const projectName = (project.projectName || '').toLowerCase();
      const projectId = (project.projectId || '').toString().toLowerCase();
      return projectName.includes(searchLower) || projectId.includes(searchLower);
    });
  }

  selectProject(project: any): void {
    this.selectedProjectId = project.projectId ? project.projectId.toString() : '';
    this.projectSearchTerm = '';
    this.isProjectDropdownVisible = false;
  }

  isProjectSelected(project: any): boolean {
    return this.selectedProjectId === project.projectId?.toString();
  }

  getProjectDisplayName(): string {
    if (!this.selectedProjectId) {
      // If no selection and list is loaded, show first project as default
      if (this.projectsList.length > 0) {
        return this.projectsList[0].projectName || 'Select project...';
      }
      return 'Select project...';
    }
    const selected = this.projectsList.find(proj => proj.projectId?.toString() === this.selectedProjectId);
    return selected ? selected.projectName : 'Select project...';
  }

  // Set logged-in user as default assignee
  setLoggedInUserAsDefaultAssignee(): void {
    const currentUser = this.authService.getUser();

    if (currentUser && this.employeeMasterList.length > 0) {
      // Try to find the logged-in user in the employee master list
      // Check various possible field names for employee ID
      const userEmployeeId = currentUser.empId ||
        currentUser.employeeId ||
        currentUser.idValue ||
        currentUser.id ||
        currentUser.EmpId ||
        currentUser.EmployeeId;

      if (userEmployeeId) {
        // Find the employee in the list
        const loggedInEmployee = this.employeeMasterList.find(emp =>
          emp.idValue === userEmployeeId ||
          emp.idValue === String(userEmployeeId)
        );

        if (loggedInEmployee) {
          this.selectedAssigneeId = loggedInEmployee.idValue;
          console.log('Default assignee set to logged-in user:', loggedInEmployee.description);
        } else {
          console.log('Logged-in user not found in employee master list. User ID:', userEmployeeId);
        }
      } else {
        console.log('Could not determine employee ID from current user:', currentUser);
      }
    }
  }

  initializeDetailedSubtasks() {
    this.detailedSubtasks = [
      {
        id: 1,
        name: 'Database Schema Migration',
        completed: true,
        estimatedHours: 4,
        isRunning: false,
        timeSpent: 0,
        totalLoggedTime: 4.33
      },
      {
        id: 2,
        name: 'Implement PKCE logic for Mobile Flow',
        completed: false,
        estimatedHours: 6,
        isRunning: true,
        timeSpent: 0,
        startTime: new Date(),
        totalLoggedTime: 2.25
      }
    ];
  }

  initializeActivityLogs() {
    this.activityLogs = [
      {
        id: '1',
        type: 'timer_start',
        description: 'Started working on "Implement PKCE logic for Mobile Flow"',
        timestamp: new Date('2024-01-20T10:00:00'),
        user: 'Alex Chen',
        details: { subtaskId: 2, subtaskName: 'Implement PKCE logic for Mobile Flow' }
      },
      {
        id: '2',
        type: 'status_change',
        description: 'Changed task status from "Pending" to "In Progress"',
        timestamp: new Date('2024-01-20T09:45:00'),
        user: 'Marcus Thorne'
      },
      {
        id: '3',
        type: 'subtask_complete',
        description: 'Completed subtask "Database Schema Migration"',
        timestamp: new Date('2024-01-20T08:30:00'),
        user: 'Alex Chen',
        duration: '4h 20m',
        details: { subtaskId: 1, subtaskName: 'Database Schema Migration' }
      },
      {
        id: '4',
        type: 'timer_stop',
        description: 'Stopped timer for "Database Schema Migration"',
        timestamp: new Date('2024-01-19T17:30:00'),
        user: 'Alex Chen',
        duration: '1h 50m',
        details: { subtaskId: 1, subtaskName: 'Database Schema Migration' }
      },
      {
        id: '5',
        type: 'comment',
        description: 'Added comment: "Working on the token introspection endpoints now. Should be ready for review by EOD."',
        timestamp: new Date('2024-01-19T15:20:00'),
        user: 'Alex Chen'
      },
      {
        id: '6',
        type: 'file_upload',
        description: 'Uploaded file "oauth2-flow-diagram.pdf"',
        timestamp: new Date('2024-01-19T14:15:00'),
        user: 'Alex Chen',
        details: { fileName: 'oauth2-flow-diagram.pdf', fileSize: '2.4 MB' }
      },
      {
        id: '7',
        type: 'timer_start',
        description: 'Started working on "Database Schema Migration"',
        timestamp: new Date('2024-01-19T14:00:00'),
        user: 'Alex Chen',
        details: { subtaskId: 1, subtaskName: 'Database Schema Migration' }
      },
      {
        id: '8',
        type: 'task_update',
        description: 'Updated task description and added custom fields',
        timestamp: new Date('2024-01-19T09:30:00'),
        user: 'Marcus Thorne'
      },
      {
        id: '9',
        type: 'timer_pause',
        description: 'Paused timer for current task',
        timestamp: new Date('2024-01-18T16:45:00'),
        user: 'Alex Chen',
        duration: '2h 15m'
      },
      {
        id: '10',
        type: 'status_change',
        description: 'Changed task priority from "Medium" to "High"',
        timestamp: new Date('2024-01-18T14:20:00'),
        user: 'Marcus Thorne'
      }
    ];
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  getFilteredTasks(): Task[] {
    if (!this.searchTerm) {
      return this.tasks;
    }
    return this.tasks.filter(task =>
      task.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      task.category.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  getCategoryClass(category: string): string {
    switch (category) {
      case 'DEVELOPMENT': return 'development';
      case 'SECURITY': return 'security';
      case 'QUALITY ASSURANCE': return 'qa';
      case 'DESIGN': return 'design';
      case 'DOCUMENTATION': return 'documentation';
      default: return 'default';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'NOT STARTED': return 'not-started';
      case 'IN PROGRESS': return 'in-progress';
      case 'PENDING': return 'pending';
      case 'ON HOLD': return 'on-hold';
      case 'COMPLETED': return 'completed';
      default: return 'default';
    }
  }

  getProgressOffset(percentage: number): number {
    const circumference = 2 * Math.PI * 16; // radius is 16
    return circumference - (percentage / 100) * circumference;
  }

  startTask(taskId: number) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      const oldStatus = task.status;
      task.status = 'IN PROGRESS';

      // Set as active task and show in header
      this.activeTask = task;
      this.hasActiveTask = true;

      // Log activity
      this.logTaskAction('status_change', {
        oldStatus,
        newStatus: 'IN PROGRESS',
        taskTitle: task.title
      });

      console.log('Task started and set as active:', task.title);
    }
  }

  pauseTask(taskId: number) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      const oldStatus = task.status;
      task.status = 'PENDING';

      // Keep task in header but pause timer
      // Don't clear activeTask - user can still see paused task details

      // Log activity
      this.logTaskAction('status_change', {
        oldStatus,
        newStatus: 'PENDING',
        taskTitle: task.title
      });

      console.log('Task paused:', task.title);
    }
  }

  stopTask(taskId: number) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      const oldStatus = task.status;
      task.status = 'NOT STARTED';

      // Clear active task from header
      if (this.activeTask?.id === taskId) {
        this.activeTask = null;
        this.hasActiveTask = false;
      }

      // Log activity
      this.logTaskAction('status_change', {
        oldStatus,
        newStatus: 'NOT STARTED',
        taskTitle: task.title
      });

      console.log('Task stopped and removed from header:', task.title);
    }
  }

  deleteTask(taskId: number) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task && task.status === 'NOT STARTED') {
      // Show confirmation dialog
      if (confirm(`Are you sure you want to delete the task "${task.title}"? This action cannot be undone.`)) {
        // Remove task from the array
        this.tasks = this.tasks.filter(t => t.id !== taskId);

        // Update task counts
        this.updateTaskCounts();

        // Log activity
        this.logTaskAction('task_delete', {
          taskTitle: task.title,
          taskId: taskId
        });

        console.log(`Task "${task.title}" has been deleted.`);
      }
    }
  }

  updateTaskCounts() {
    // Update the task counts based on current tasks
    // For now, we'll assume all tasks in the list are "MY TASKS"
    // In a real application, you might have a property to distinguish between "MY TASKS" and "ASSIGNED TO OTHERS"
    this.myTasksCount = this.tasks.length;
    // assignedToOthersCount would be calculated based on different criteria
  }

  // Modal methods
  openCreateTaskModal() {
    this.showSelectTaskModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeCreateTaskModal() {
    this.showCreateTaskModal = false;
    document.body.style.overflow = 'auto';
    this.resetForm();
  }

  // Break management methods
  toggleBreak() {
    this.isOnBreak = !this.isOnBreak;
    this.breakStatus = this.isOnBreak ? 'On Break' : 'Working';

    if (this.isOnBreak) {
      // Start break timer
      this.startBreakTimer();
      console.log('Break started');
    } else {
      // End break and resume work
      this.endBreakTimer();
      console.log('Break ended, resuming work');
    }
  }

  private startBreakTimer() {
    // In a real application, you would start a break timer here
    // For now, we'll just update the status
    this.nextBreakCountdown = 'On Break';
  }

  private endBreakTimer() {
    // Reset break countdown
    this.nextBreakCountdown = '1:23:45';
  }

  // Break Tracker Methods
  selectBreakType(type: 'lunch' | 'coffee' | 'quick') {
    this.selectedBreakType = type;
    if (!this.isBreakRunning) {
      this.updateBreakCaption();
    }
  }

  startBreak() {
    if (!this.selectedBreakType) return;

    this.isBreakRunning = true;
    this.isBreakPaused = false;
    this.breakStartTime = new Date();
    this.breakElapsedSeconds = 0;
    this.updateBreakCaption();

    this.breakTimerInterval = setInterval(() => {
      if (!this.isBreakPaused) {
        this.breakElapsedSeconds++;
        this.updateBreakTimerDisplay();
      }
    }, 1000);
  }

  pauseBreak() {
    this.isBreakPaused = true;
    this.updateBreakCaption();
  }

  resumeBreak() {
    this.isBreakPaused = false;
    this.updateBreakCaption();
  }

  stopBreak() {
    if (this.breakTimerInterval) {
      clearInterval(this.breakTimerInterval);
      this.breakTimerInterval = null;
    }

    // Log the break (in real app, save to backend)
    console.log('Break ended:', {
      type: this.selectedBreakType,
      duration: this.breakElapsedSeconds,
      remarks: this.breakRemarks
    });

    // Reset
    this.isBreakRunning = false;
    this.isBreakPaused = false;
    this.breakElapsedSeconds = 0;
    this.breakTimerDisplay = '00:00:00';
    this.breakRemarks = '';
    this.selectedBreakType = null;
    this.updateBreakCaption();
  }

  private updateBreakTimerDisplay() {
    const hours = Math.floor(this.breakElapsedSeconds / 3600);
    const minutes = Math.floor((this.breakElapsedSeconds % 3600) / 60);
    const seconds = this.breakElapsedSeconds % 60;

    this.breakTimerDisplay =
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private updateBreakCaption() {
    if (!this.selectedBreakType && !this.isBreakRunning) {
      this.breakTimerCaption = 'Select break type to start';
    } else if (this.selectedBreakType && !this.isBreakRunning) {
      const typeNames = {
        lunch: 'Lunch Break',
        coffee: 'Coffee Break',
        quick: 'Quick Break'
      };
      this.breakTimerCaption = `Ready to start ${typeNames[this.selectedBreakType]}`;
    } else if (this.isBreakRunning && this.isBreakPaused) {
      this.breakTimerCaption = 'Break paused';
    } else if (this.isBreakRunning) {
      const typeNames = {
        lunch: 'Lunch',
        coffee: 'Coffee',
        quick: 'Quick'
      };
      this.breakTimerCaption = `${typeNames[this.selectedBreakType!]} break in progress`;
    }
  }

  getBreakStatusCaption(): string {
    if (!this.selectedBreakType && !this.isBreakRunning) {
      return 'Choose your break type above';
    } else if (this.selectedBreakType && !this.isBreakRunning) {
      return 'Click Start when ready';
    } else if (this.isBreakRunning && this.isBreakPaused) {
      return 'Break timer paused';
    } else if (this.isBreakRunning) {
      return 'Enjoy your break! 😊';
    }
    return '';
  }

  closeSelectTaskModal() {
    this.showSelectTaskModal = false;
    document.body.style.overflow = 'auto';
  }

  // Manage Tasks Modal Methods
  openManageTasksModal() {
    this.showManageTasksModal = true;
    this.isAddingNewCategory = false;
    document.body.style.overflow = 'hidden';
  }

  closeManageTasksModal() {
    this.showManageTasksModal = false;
    this.isAddingNewCategory = false;
    this.cancelAllEdits();
    document.body.style.overflow = 'auto';
  }

  // Start editing a task category
  startEditCategory(category: TaskCategory) {
    // Cancel other edits first
    this.taskCategories.forEach(cat => cat.isEditing = false);
    category.isEditing = true;
    
    // Debug: Log the category being edited
    console.log('Editing category:', {
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      departmentId: category.departmentId,
      departmentName: category.departmentName,
      sequenceNumber: category.sequenceNumber
    });
  }

  // Save edited category
  saveCategory(category: TaskCategory) {
    if (category.categoryName.trim() && category.departmentId) {
      // Get current user
      const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
      const userId = currentUser.empId || currentUser.employeeId || '1';

      // Prepare API request
      const request: any = {
        categoryId: category.categoryId,
        categoryName: category.categoryName.trim(),
        departmentId: category.departmentId,
        createdBy: userId,
        estimatedHours: category.sequenceNumber || 0
      };

      // Call API to update category
      this.api.saveTaskCategory(request).subscribe({
        next: (response: any) => {
          if (response && response.success) {
            category.isEditing = false;
            console.log('Category updated successfully:', response);
            
            // Reload task categories to get fresh data
            this.loadTaskCategories();
          } else {
            console.error('Failed to update category:', response?.message);
            alert('Failed to update category: ' + (response?.message || 'Unknown error'));
          }
        },
        error: (error: any) => {
          console.error('Error updating category:', error);
          alert('Error updating category. Please try again.');
        }
      });
    }
  }

  // Cancel editing
  cancelEdit(category: TaskCategory) {
    category.isEditing = false;
    // Reload original data from API to discard changes
    this.loadTaskCategories();
  }

  // Cancel all edits
  cancelAllEdits() {
    this.taskCategories.forEach(cat => cat.isEditing = false);
  }

  // Delete category
  deleteCategory(categoryId: number) {
    if (confirm('Are you sure you want to delete this task category?')) {
      this.allDepartmentList = this.allDepartmentList.filter(cat => cat.categoryId !== categoryId);
      this.taskCategories = [...this.allDepartmentList];
      console.log('Category deleted:', categoryId);
      // In real app, make API call to delete
    }
  }

  // Show add new category form
  showAddCategoryForm() {
    this.isAddingNewCategory = true;
    this.newTaskCategory = { categoryId: 0, categoryName: '', departmentId: 0, departmentName: '' };
    this.cancelAllEdits();
  }

  // Cancel adding new category
  cancelAddCategory() {
    this.isAddingNewCategory = false;
    this.newTaskCategory = { categoryId: 0, categoryName: '', departmentId: 0, departmentName: '', sequenceNumber: 0 };
  }

  // Handle department dropdown change
  onDepartmentChange(departmentId: number, category: TaskCategory): void {
    const selectedDept = this.departmentMasterList.find(dept => dept.departmentId === departmentId);
    if (selectedDept) {
      category.departmentId = departmentId;
      category.departmentName = selectedDept.deptName;
      console.log('Department changed:', selectedDept.deptName);
    }
  }

  // Save new category
  saveNewCategory() {
    if (this.newTaskCategory.categoryName.trim() && this.newTaskCategory.departmentId) {
      // Get current user
      const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
      const userId = currentUser.empId || currentUser.employeeId || '1';

      // Prepare API request
      const request: any = {
        categoryName: this.newTaskCategory.categoryName.trim(),
        departmentId: this.newTaskCategory.departmentId,
        createdBy: userId,
        estimatedHours: this.newTaskCategory.sequenceNumber || 0
      };

      // Call API to create category
      this.api.saveTaskCategory(request).subscribe({
        next: (response: any) => {
          if (response && response.success) {
            console.log('Category created successfully:', response);
            
            // Reset form
            this.isAddingNewCategory = false;
            this.newTaskCategory = { categoryId: 0, categoryName: '', departmentId: 0, departmentName: '', sequenceNumber: 0 };
            
            // Reload task categories to get fresh data
            this.loadTaskCategories();
          } else {
            console.error('Failed to create category:', response?.message);
            alert('Failed to create category: ' + (response?.message || 'Unknown error'));
          }
        },
        error: (error: any) => {
          console.error('Error creating category:', error);
          alert('Error creating category. Please try again.');
        }
      });
    }
  }

  setSelectTaskTab(tab: 'favorites' | 'myDepartment' | 'all') {
    this.selectTaskActiveTab = tab;
  }

  // Get count of favorite/pinned tasks
  getFavoritesCount(): number {
    return this.favouriteList.length;
  }

  // Get count of tasks in user's department
  getMyDepartmentTasksCount(): number {
    return this.departmentList.length;
  }

  // Get count of all department tasks
  getAllDepartmentTasksCount(): number {
    return this.allDepartmentList.length;
  }

  // Get favorite task categories
  getFavouriteTaskList(): TaskCategory[] {
    return this.favouriteList;
  }

  // Get department task categories
  getDepartmentTaskList(): TaskCategory[] {
    return this.departmentList;
  }

  // Get all department task categories
  getAllDepartmentTaskList(): TaskCategory[] {
    return this.allDepartmentList;
  }

  // Select a task category
  selectTask(category: TaskCategory): void {
    this.newTaskCategory = category;
    this.selectedCategoryId = category.categoryId;
    console.log('Selected task category:', category);
  }

  openTaskDetailsModal(task: Task) {
    this.selectedTask = task;
    this.showTaskDetailsModal = true;
    // Prevent body scroll and ensure modal appears above everything
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'relative';
    document.body.style.zIndex = '1';
  }

  closeTaskDetailsModal() {
    this.showTaskDetailsModal = false;
    this.selectedTask = null;
    // Restore body scroll
    document.body.style.overflow = 'auto';
    document.body.style.position = '';
    document.body.style.zIndex = '';
  }

  // Save task changes method
  saveTaskChanges() {
    if (this.selectedTask) {
      // Update the selected task with current values
      this.selectedTask.title = this.editableTaskTitle;
      this.selectedTask.description = this.editableTaskDescription;
      this.selectedTask.progress = this.taskProgress;

      // Log the save action
      this.logTaskAction('task_saved', {
        taskTitle: this.selectedTask.title,
        progress: this.taskProgress
      });

      // Show success feedback (you can add a toast notification here)
      console.log('Task changes saved successfully:', this.selectedTask);

      // Optional: Close modal after saving
      // this.closeTaskDetailsModal();
    }
  }

  // Task timer controls for details modal
  pauseSelectedTask() {
    if (this.selectedTask) {
      this.selectedTask.status = 'PENDING';
    }
  }

  stopSelectedTask() {
    if (this.selectedTask) {
      this.selectedTask.status = 'NOT STARTED';
    }
  }

  editSelectedTaskTime() {
    // Implement time editing functionality
    console.log('Edit time for task:', this.selectedTask?.title);
  }

  // New methods for task status and edit mode
  setTaskStatus(status: 'continuous' | 'closed') {
    this.selectedTaskStatus = status;
    if (this.selectedTask) {
      this.selectedTask.status = status === 'continuous' ? 'IN PROGRESS' : 'COMPLETED';
    }
  }

  toggleEditMode() {
    this.editMode = !this.editMode;
    console.log('Edit mode toggled:', this.editMode);
  }

  resetForm() {
    this.newTask = {
      name: '',
      description: '',
      assignee: '',
      type: 'single',
      date: '',
      estimatedHours: 0,
      subtasks: []
    };
  }

  addSubtask() {
    const newSubtask: Subtask = {
      id: Date.now(),
      name: '',
      completed: false,
      estimatedHours: 0,
      isRunning: false,
      timeSpent: 0
    };
    this.newTask.subtasks.push(newSubtask);
  }

  removeSubtask(index: number) {
    this.newTask.subtasks.splice(index, 1);
  }

  startSubtaskTimer(subtaskId: number) {
    const subtask = this.newTask.subtasks.find(s => s.id === subtaskId);
    if (subtask) {
      subtask.isRunning = true;
      // Stop other running subtasks
      this.newTask.subtasks.forEach(s => {
        if (s.id !== subtaskId) {
          s.isRunning = false;
        }
      });
    }
  }

  pauseSubtaskTimer(subtaskId: number) {
    const subtask = this.newTask.subtasks.find(s => s.id === subtaskId);
    if (subtask) {
      subtask.isRunning = false;
    }
  }

  stopSubtaskTimer(subtaskId: number) {
    const subtask = this.newTask.subtasks.find(s => s.id === subtaskId);
    if (subtask) {
      subtask.isRunning = false;
      subtask.timeSpent = 0;
    }
  }

  saveAsDraft() {
    console.log('Save as draft:', this.newTask);
  }

  createTask() {
    console.log('Create task:', this.newTask);
    this.closeCreateTaskModal();
  }

  updateProgress(event: any) {
    if (this.selectedTask) {
      this.selectedTask.progress = parseInt(event.target.value);
    }
  }

  // Custom Fields Methods
  openCustomFieldsModal() {
    this.showCustomFieldsModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeCustomFieldsModal() {
    this.showCustomFieldsModal = false;
    document.body.style.overflow = 'auto';
  }

  // Add Field Modal Methods
  openAddFieldModal() {
    // Initialize temp selection with already selected fields
    this.tempSelectedFields = this.selectedCustomFields.map(f => f.key);
    this.showAddFieldModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeAddFieldModal() {
    this.showAddFieldModal = false;
    this.tempSelectedFields = [];
    document.body.style.overflow = 'auto';
  }

  isFieldSelected(fieldKey: string): boolean {
    return this.selectedCustomFields.some(field => field.key === fieldKey);
  }

  toggleFieldSelection(fieldKey: string) {
    const index = this.tempSelectedFields.indexOf(fieldKey);
    if (index > -1) {
      this.tempSelectedFields.splice(index, 1);
    } else {
      this.tempSelectedFields.push(fieldKey);
    }
  }

  isFieldChecked(fieldKey: string): boolean {
    return this.tempSelectedFields.includes(fieldKey);
  }

  applySelectedFields() {
    // Add newly selected fields
    this.tempSelectedFields.forEach(fieldKey => {
      if (!this.isFieldSelected(fieldKey)) {
        const field = this.availableCustomFields.find(f => f.key === fieldKey);
        if (field) {
          const newField = { ...field, value: field.type === 'number' ? 0 : '' };
          this.selectedCustomFields.push(newField);
        }
      }
    });

    // Remove unselected fields
    this.selectedCustomFields = this.selectedCustomFields.filter(field =>
      this.tempSelectedFields.includes(field.key)
    );

    this.closeAddFieldModal();
    console.log('Applied fields:', this.selectedCustomFields);
  }

  selectCustomField(field: CustomField) {
    if (!this.isFieldSelected(field.key)) {
      const newField = { ...field, value: field.type === 'number' ? 0 : '' };
      this.selectedCustomFields.push(newField);
    }
  }

  removeCustomField(fieldKey: string) {
    this.selectedCustomFields = this.selectedCustomFields.filter(field => field.key !== fieldKey);
  }

  applyCustomFields() {
    this.closeCustomFieldsModal();
    // Custom fields are already added to selectedCustomFields array
    console.log('Applied custom fields:', this.selectedCustomFields);
  }

  getFieldIcon(type: string): string {
    switch (type) {
      case 'text': return 'font';
      case 'number': return 'hashtag';
      case 'dropdown': return 'list';
      case 'textarea': return 'align-left';
      default: return 'tag';
    }
  }

  // Files Tab Method (subtasks tab removed)
  setActiveSubtaskTab(tab: 'files') {
    this.activeSubtaskTab = tab;
  }

  // Sidebar Tab Methods
  setActiveSidebarTab(tab: 'comments' | 'history') {
    this.activeSidebarTab = tab;
  }

  // Detailed Subtask Timer Methods
  startSubtaskDetailedTimer(subtaskId: number) {
    const subtask = this.detailedSubtasks.find(s => s.id === subtaskId);
    if (subtask && !subtask.isRunning) {
      // Stop other running subtasks
      this.detailedSubtasks.forEach(s => {
        if (s.id !== subtaskId && s.isRunning) {
          this.pauseSubtaskDetailedTimer(s.id);
        }
      });

      subtask.isRunning = true;
      subtask.startTime = new Date();

      // Add activity log
      this.addActivityLog({
        type: 'timer_start',
        description: `Started working on "${subtask.name}"`,
        user: 'Alex Chen',
        details: { subtaskId: subtask.id, subtaskName: subtask.name }
      });
    }
  }

  pauseSubtaskDetailedTimer(subtaskId: number) {
    const subtask = this.detailedSubtasks.find(s => s.id === subtaskId);
    if (subtask && subtask.isRunning && subtask.startTime) {
      const duration = (new Date().getTime() - subtask.startTime.getTime()) / (1000 * 60 * 60); // hours
      subtask.isRunning = false;
      subtask.timeSpent += duration;
      subtask.totalLoggedTime += duration;

      // Add activity log
      this.addActivityLog({
        type: 'timer_pause',
        description: `Paused timer for "${subtask.name}"`,
        user: 'Alex Chen',
        duration: this.formatDuration(duration),
        details: { subtaskId: subtask.id, subtaskName: subtask.name }
      });

      subtask.startTime = undefined;
    }
  }

  stopSubtaskDetailedTimer(subtaskId: number) {
    const subtask = this.detailedSubtasks.find(s => s.id === subtaskId);
    if (subtask) {
      if (subtask.isRunning && subtask.startTime) {
        const duration = (new Date().getTime() - subtask.startTime.getTime()) / (1000 * 60 * 60); // hours
        subtask.totalLoggedTime += duration;
      }

      subtask.isRunning = false;
      subtask.timeSpent = 0;
      subtask.startTime = undefined;

      // Add activity log
      this.addActivityLog({
        type: 'timer_stop',
        description: `Stopped timer for "${subtask.name}"`,
        user: 'Alex Chen',
        details: { subtaskId: subtask.id, subtaskName: subtask.name }
      });
    }
  }

  toggleSubtaskCompletion(subtaskId: number) {
    const subtask = this.detailedSubtasks.find(s => s.id === subtaskId);
    if (subtask) {
      subtask.completed = !subtask.completed;

      if (subtask.completed && subtask.isRunning) {
        this.stopSubtaskDetailedTimer(subtaskId);
      }

      // Add activity log
      this.addActivityLog({
        type: 'subtask_complete',
        description: subtask.completed ? `Completed subtask "${subtask.name}"` : `Reopened subtask "${subtask.name}"`,
        user: 'Alex Chen',
        duration: subtask.completed ? this.formatDuration(subtask.totalLoggedTime) : undefined,
        details: { subtaskId: subtask.id, subtaskName: subtask.name }
      });
    }
  }

  // Comment Methods
  newComment = '';

  addComment() {
    if (this.newComment.trim()) {
      // Log the comment activity
      this.logTaskAction('comment_added', {
        comment: this.newComment.trim(),
        taskTitle: this.selectedTask?.title
      });

      // Clear the input
      this.newComment = '';
    }
  }

  // Activity Log Methods
  addActivityLog(activity: Omit<ActivityLog, 'id' | 'timestamp'>) {
    const newActivity: ActivityLog = {
      ...activity,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date()
    };

    this.activityLogs.unshift(newActivity);
  }

  // Enhanced activity logging for task actions
  logTaskAction(action: string, details?: any) {
    let description = '';
    let type: ActivityLog['type'] = 'task_update';

    switch (action) {
      case 'status_change':
        description = `Changed task status to "${details.newStatus}"`;
        type = 'status_change';
        break;
      case 'progress_update':
        description = `Updated task progress to ${details.progress}%`;
        type = 'task_update';
        break;
      case 'timer_start':
        description = 'Started task timer';
        type = 'timer_start';
        break;
      case 'timer_pause':
        description = 'Paused task timer';
        type = 'timer_pause';
        break;
      case 'timer_stop':
        description = 'Stopped task timer';
        type = 'timer_stop';
        break;
      case 'comment_added':
        description = `Added comment: "${details.comment}"`;
        type = 'comment';
        break;
      default:
        description = `Performed action: ${action}`;
    }

    this.addActivityLog({
      type,
      description,
      user: 'Current User', // In real app, get from auth service
      details
    });
  }

  formatDuration(hours: number): string {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    if (h === 0) {
      return `${m}m`;
    } else if (m === 0) {
      return `${h}h`;
    } else {
      return `${h}h ${m}m`;
    }
  }

  formatHours(hours: number): string {
    return `${hours.toFixed(2)}h`;
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case 'timer_start': return 'fa-play-circle';
      case 'timer_pause': return 'fa-pause-circle';
      case 'timer_stop': return 'fa-stop-circle';
      case 'status_change': return 'fa-exchange-alt';
      case 'comment': return 'fa-comment';
      case 'file_upload': return 'fa-file-upload';
      case 'subtask_complete': return 'fa-check-circle';
      case 'task_update': return 'fa-edit';
      default: return 'fa-info-circle';
    }
  }

  getActivityColor(type: string): string {
    switch (type) {
      case 'timer_start': return '#10b981';
      case 'timer_pause': return '#f59e0b';
      case 'timer_stop': return '#ef4444';
      case 'status_change': return '#3b82f6';
      case 'comment': return '#8b5cf6';
      case 'file_upload': return '#06b6d4';
      case 'subtask_complete': return '#059669';
      case 'task_update': return '#6b7280';
      default: return '#9ca3af';
    }
  }

  getRelativeTime(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return timestamp.toLocaleDateString();
  }

  // File Upload Methods
  triggerFileUpload() {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.handleFiles(files);
      // Clear the input
      event.target.value = '';
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFiles(files);
    }
  }

  private handleFiles(files: FileList) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
        continue;
      }

      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/jpg',
        'image/png'
      ];

      if (!allowedTypes.includes(file.type)) {
        alert(`File "${file.name}" is not supported. Please upload PDF, DOC, DOCX, XLS, XLSX, JPG, or PNG files.`);
        continue;
      }

      const uploadedFile: UploadedFile = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadDate: new Date(),
        url: URL.createObjectURL(file)
      };

      this.uploadedFiles.push(uploadedFile);
    }
  }

  getFileIcon(fileType: string): string {
    if (fileType.includes('pdf')) return 'file-pdf';
    if (fileType.includes('word') || fileType.includes('document')) return 'file-word';
    if (fileType.includes('excel') || fileType.includes('sheet')) return 'file-excel';
    if (fileType.includes('image')) return 'file-image';
    return 'file';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  downloadFile(file: UploadedFile) {
    if (file.url) {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  removeFile(index: number) {
    const file = this.uploadedFiles[index];
    if (file.url) {
      URL.revokeObjectURL(file.url);
    }
    this.uploadedFiles.splice(index, 1);
  }

  // Getter for favorite tasks for the HTML template
  get favouriteTaskList(): Task[] {
    return this.tasks.filter(t => t.isFavorite);
  }

  // Progress Circle 3D Methods - Circular Drag Functionality
  startProgressDrag(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingProgress = true;
    this.isProgressAnimating = false;

    // Store the progress circle element
    this.progressCircle3DElement = (event.currentTarget as HTMLElement);

    // Add global mouse event listeners
    const boundOnDrag = this.onProgressDrag.bind(this);
    const boundEndDrag = this.endProgressDrag.bind(this);

    document.addEventListener('mousemove', boundOnDrag);
    document.addEventListener('mouseup', boundEndDrag);

    // Store bound functions for cleanup
    (this.progressCircle3DElement as any)._boundOnDrag = boundOnDrag;
    (this.progressCircle3DElement as any)._boundEndDrag = boundEndDrag;

    // Update progress immediately on click
    this.updateProgressFromEvent(event);
  }

  onProgressDrag(event: MouseEvent) {
    if (!this.isDraggingProgress || !this.progressCircle3DElement) return;

    this.updateProgressFromEvent(event);
  }

  private updateProgressFromEvent(event: MouseEvent) {
    if (!this.progressCircle3DElement) return;

    const rect = this.progressCircle3DElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate angle from center
    const deltaX = event.clientX - centerX;
    const deltaY = event.clientY - centerY;
    let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    // Normalize angle to 0-360 degrees, starting from top (-90 degrees offset)
    angle = (angle + 90 + 360) % 360;

    // Convert angle to percentage
    const newProgress = Math.round((angle / 360) * 100);

    // Clamp between 0 and 100
    const oldProgress = this.taskProgress;
    this.taskProgress = Math.max(0, Math.min(100, newProgress));

    // Always animate when dragging to show smooth value changes
    if (this.isDraggingProgress) {
      this.isProgressAnimating = true;
    } else if (Math.abs(oldProgress - this.taskProgress) > 1) {
      this.isProgressAnimating = true;
      setTimeout(() => {
        this.isProgressAnimating = false;
      }, 300);
    }
  }

  endProgressDrag() {
    if (this.isDraggingProgress && this.progressCircle3DElement) {
      this.isDraggingProgress = false;

      // Remove global event listeners using stored bound functions
      const boundOnDrag = (this.progressCircle3DElement as any)._boundOnDrag;
      const boundEndDrag = (this.progressCircle3DElement as any)._boundEndDrag;

      if (boundOnDrag) {
        document.removeEventListener('mousemove', boundOnDrag);
      }
      if (boundEndDrag) {
        document.removeEventListener('mouseup', boundEndDrag);
      }

      // Clean up stored functions
      delete (this.progressCircle3DElement as any)._boundOnDrag;
      delete (this.progressCircle3DElement as any)._boundEndDrag;

      // Add completion animation for both progress circle and premium 3D bar
      this.isProgressAnimating = true;
      this.isProgressChanging = true;
      setTimeout(() => {
        this.isProgressAnimating = false;
        this.isProgressChanging = false;
      }, 600);

      // Update selected task progress if available
      if (this.selectedTask) {
        const oldProgress = this.selectedTask.progress;
        this.selectedTask.progress = this.taskProgress;

        // Log progress update activity
        this.logTaskAction('progress_update', {
          oldProgress,
          progress: this.taskProgress,
          taskTitle: this.selectedTask.title
        });
      }

      // Here you could emit an event or call an API to save the progress
      console.log('Progress updated to:', this.taskProgress + '%');

      this.progressCircle3DElement = null;
    }
  }

  // Manual Progress Input Methods
  onManualProgressChange(event: any) {
    const value = parseInt(event.target.value);
    if (!isNaN(value)) {
      const oldProgress = this.taskProgress;
      this.taskProgress = Math.max(0, Math.min(100, value));

      // Update the input field to reflect the clamped value
      event.target.value = this.taskProgress;

      // Log progress change
      if (Math.abs(this.taskProgress - oldProgress) >= 1) {
        this.logTaskAction('progress_update', {
          oldProgress,
          progress: this.taskProgress,
          taskTitle: this.selectedTask?.title || 'Current Task'
        });
      }

      // Update selected task progress if available
      if (this.selectedTask) {
        this.selectedTask.progress = this.taskProgress;
      }

      // Add animation effects for both progress circle and premium 3D bar
      this.isProgressAnimating = true;
      this.isProgressChanging = true;
      setTimeout(() => {
        this.isProgressAnimating = false;
        this.isProgressChanging = false;
      }, 800);
    }
  }

  setQuickProgress(value: number) {
    const oldProgress = this.taskProgress;
    this.taskProgress = value;

    // Log progress change
    this.logTaskAction('progress_update', {
      oldProgress,
      progress: this.taskProgress,
      taskTitle: this.selectedTask?.title || 'Current Task'
    });

    // Update selected task progress if available
    if (this.selectedTask) {
      this.selectedTask.progress = this.taskProgress;
    }

    // Add animation effects for both progress circle and premium 3D bar
    this.isProgressAnimating = true;
    this.isProgressChanging = true;
    setTimeout(() => {
      this.isProgressAnimating = false;
      this.isProgressChanging = false;
    }, 1000);
  }

  ngOnDestroy() {
    // Clean up break timer interval
    if (this.breakTimerInterval) {
      clearInterval(this.breakTimerInterval);
      this.breakTimerInterval = null;
    }
  }
}