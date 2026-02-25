import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Theme } from '../services/theme';
import { Api } from '../services/api';
import { TaskDetailsModalComponent } from '../components/task-details-modal/task-details-modal.component';
import { ToasterComponent } from '../components/toaster/toaster.component';
import { ToasterService } from '../services/toaster.service';
import Swal from 'sweetalert2';

interface LoggedHour {
  id: string;
  taskId?: string;
  title: string;
  description: string;
  dailyComment?: string;  // Added for daily comment column
  projectName?: string;   // Added for project name column
  category: string;
  categoryId?: number;  // Added for modal
  userId?: string;  // Added for view-only mode check
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
  customFields?: { [key: string]: any };  // Dynamic custom fields from API
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

interface Employee {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  departmentId: number;
  departmentName: string;
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
  styleUrls: ['./my-logged-hours.css', './manage-fields-ultra.css', './manage-fields-modern-v2.css']
})
export class MyLoggedHoursComponent implements OnInit {
  isDarkMode = false;
  
  // Filter properties - Updated with API integration
  fromDate = '';
  toDate = '';
  selectedProject: string | number = 'all';
  selectedDepartment: string | number = 'all';
  selectedEmployee: string | number = 'all';
  selectedCategory: string | number = 'all';
  tableSearchTerm = '';  // Client-side table search

  // API data
  projects: Project[] = [];
  departments: Department[] = [];
  employees: Employee[] = [];
  taskCategories: TaskCategory[] = [];
  
  // Loading state
  isLoadingData = false;

  // Role flags from session
  isHOD = false;  // Flag to check if user is HOD

  // Pagination properties
  currentPage = 1;
  pageSize = 500;
  totalRecords = 0;
  hasMoreRecords = false;

  // Task Details Modal
  showTaskModal = false;
  selectedTaskId: number = 0;
  selectedTaskCategoryId: number = 0;
  currentUserId: string = '';
  isTaskModalViewOnly: boolean = false; // View-only mode for other users' tasks

  // Break History Modal
  showBreakHistoryModal = false;
  openBreaks: any[] = [];
  isLoadingBreaks = false;

  // Day Log History Modal
  showDayLogHistoryModal = false;
  dayLogHistory: any[] = [];
  isLoadingDayLogs = false;
  selectedRecordForDayLog: LoggedHour | null = null;

  // Manage Fields Modal
  showManageFieldsModal = false;
  customFields: any[] = [];
  isLoadingFields = false;
  
  // Add Field Modal (Separate)
  showAddFieldModal = false;
  editingField = false;
  currentField: any = {
    fieldName: '',
    fieldType: '',
    isActive: true,
    isMandatory: false
  };
  currentFieldOptions: any[] = [{ optionValue: '', isActive: true }];
  
  // Legacy properties (kept for compatibility)
  showAddFieldForm = false;
  newField: any = {
    fieldName: '',
    fieldType: '',
    options: '',
    isRequired: false,
    isSearchable: false
  };
  originalFieldData: any = null;

  // Column management
  showColumnModal = false;
  showCustomFieldsModal = false;  // New modal for custom fields
  availableCustomFields: string[] = [];  // List of all custom field names from API
  selectedCustomFields: string[] = [];  // User-selected custom fields to display
  
  // Mapping of column keys to API field names
  columnToApiFieldMap: { [key: string]: string } = {
    'taskId': 'TaskId',
    'title': 'TaskTitle',
    'description': 'Description',
    'dailyComment': 'DailyComment',
    'projectName': 'ProjectName',
    'category': 'CategoryName',
    'type': 'Type',
    'process': 'Process',
    'assignedTo': 'AssignedTo',
    'assignedBy': 'AssignedBy',
    'department': 'Department',
    'project': 'ProjectName',
    'workPlace': 'WorkPlace',
    'trade': 'Trade',
    'stage': 'Stage',
    'section': 'Section',
    'startDate': 'StartDate',
    'targetDate': 'TargetDate',
    'timeTaken': 'TimeTaken',
    'progress': 'Progress',
    'status': 'Status',
    'instruction': 'Instruction',
    'count': 'Count',
    'unit': 'Unit',
    'remarks': 'Remarks',
    'folderPath': 'FolderPath',
    'documentLink': 'DocumentLink',
    'priority': 'Priority',
    'loggedBy': 'LoggedBy',
    'duration': 'Duration',
    'date': 'LogDate'  // Added log date mapping
  };
  
  availableColumns: ColumnDefinition[] = [
    { key: 'taskId', label: 'Task ID', visible: false, width: '120px', type: 'text' },
    { key: 'title', label: 'Task Title', visible: true, width: '250px', type: 'text', required: true },
    { key: 'description', label: 'Description', visible: true, width: '150px', type: 'text', required: true },
    { key: 'dailyComment', label: 'Daily Comment', visible: true, width: '150px', type: 'text' },
    { key: 'projectName', label: 'Project Name', visible: true, width: '180px', type: 'text' },
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
    private api: Api,
    private toasterService: ToasterService
  ) {}

  ngOnInit() {
    // Subscribe to theme changes
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
    
    // Get current user data from session
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    this.currentUserId = currentUser.empId || currentUser.employeeId || '';
    
    // Check if user is HOD
    const hodFlag = (currentUser.isHOD || '').toString().toUpperCase();
    this.isHOD = hodFlag === 'H';
    console.log('User is HOD:', this.isHOD, 'HOD Flag:', hodFlag);
    
    // Debug: Log the entire user object to see what fields are available
    console.log('Current user from session:', currentUser);
    console.log('Available department fields:', {
      deptId: currentUser.deptId,
      department: currentUser.department,
      departmentID: currentUser.departmentID
    });
    
    // Set default date range (1st of current month to today)
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    this.fromDate = this.formatDateForInput(firstDayOfMonth);
    this.toDate = this.formatDateForInput(today);
    
    // Load dropdown data from API first
    this.initializeDropdowns();
  }

  // Initialize all dropdowns before loading data
  initializeDropdowns() {
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const userDepartmentId = currentUser.departmentID;
    const userEmployeeCode = currentUser.empId || currentUser.employeeId || currentUser.employeeCode;
    
    console.log('Initializing with session values:', {
      departmentId: userDepartmentId,
      employeeCode: userEmployeeCode
    });
    
    // Load projects and departments
    Promise.all([
      this.loadProjectsAsync(),
      this.loadDepartmentsAsync()
    ]).then(() => {
      console.log('Dropdowns loaded successfully');
      
      // Set department from session after departments are loaded
      if (userDepartmentId) {
        console.log('Setting department from session:', userDepartmentId);
        this.selectedDepartment = userDepartmentId;
        
        // Load employees and categories for the selected department
        Promise.all([
          this.loadEmployeesByDepartmentAsync(Number(userDepartmentId)),
          this.loadDepartmentTaskCategoriesAsync(Number(userDepartmentId))
        ]).then(() => {
          console.log('Department-specific dropdowns loaded');
          
          // Set employee from session after employees are loaded
          if (userEmployeeCode) {
            // Find the employee in the loaded list
            const employee = this.employees.find(emp => 
              emp.employeeCode === userEmployeeCode || 
              emp.employeeId === userEmployeeCode
            );
            
            if (employee) {
              this.selectedEmployee = employee.employeeCode;
              console.log('Auto-selected employee from session:', employee.employeeCode);
            } else {
              console.log('Employee not found in department list, using employeeCode:', userEmployeeCode);
              this.selectedEmployee = userEmployeeCode;
            }
          }
          
          // Now load the logged hours data with the selected filters
          this.loadLoggedHours();
        });
      } else {
        console.log('No department ID found in session');
        // If no department in session, load all categories
        this.loadAllTaskCategoriesAsync().then(() => {
          // Set employee from session if available
          if (userEmployeeCode) {
            this.selectedEmployee = userEmployeeCode;
            console.log('Set employee from session (no department):', userEmployeeCode);
          }
          
          // Now load the logged hours data
          this.loadLoggedHours();
        });
      }
    });
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

  loadEmployeesByDepartment(departmentId: number) {
    console.log('Loading employees for department:', departmentId);
    
    this.api.getEmployeesByDepartment(departmentId).subscribe({
      next: (response) => {
        console.log('getEmployeesByDepartment API Response:', response);
        
        if (response.success && response.data) {
          this.employees = response.data;
          console.log('Loaded employees:', this.employees.length);
          
          // Auto-select current user's employee code (empId)
          const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
          const currentEmpId = currentUser.empId || currentUser.employeeId;
          
          if (currentEmpId) {
            // Find the employee in the list by matching employeeCode with empId
            const currentEmployee = this.employees.find(emp => 
              emp.employeeCode === currentEmpId || 
              emp.employeeCode === String(currentEmpId)
            );
            
            if (currentEmployee) {
              this.selectedEmployee = currentEmployee.employeeCode;
              console.log('Auto-selected employee:', currentEmployee.employeeName, 'Code:', currentEmployee.employeeCode);
            } else {
              console.log('Current user not found in employee list. EmpId:', currentEmpId);
            }
          }
        } else {
          console.warn('API response success is false or no data:', response);
          this.employees = [];
        }
      },
      error: (error) => {
        console.error('Error loading employees:', error);
        this.employees = [];
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
    
    // Reset employee and task category selections
    this.selectedEmployee = 'all';
    this.selectedCategory = 'all';
    this.employees = [];
    this.taskCategories = [];
    
    // If "All Departments" is selected, don't load employees or categories
    if (this.selectedDepartment === 'all') {
      return;
    }
    
    // Load employees for the selected department
    this.loadEmployeesByDepartment(Number(this.selectedDepartment));
    
    // Load task categories for the selected department
    this.loadDepartmentTaskCategories(Number(this.selectedDepartment));
  }

  // Apply filters - called when user clicks Apply button
  applyFilters() {
    console.log('Applying filters...');
    this.resetAndReload();
  }

  // Async versions of dropdown loading methods that return Promises
  loadProjectsAsync(): Promise<void> {
    return new Promise((resolve) => {
      this.api.getProjects().subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.projects = response.data;
            console.log('Loaded projects:', this.projects.length);
          }
          resolve();
        },
        error: (error) => {
          console.error('Error loading projects:', error);
          resolve();
        }
      });
    });
  }

  loadDepartmentsAsync(): Promise<void> {
    return new Promise((resolve) => {
      this.api.getDepartmentList().subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.departments = response.data.filter((dept: Department) => dept.status === 'Y');
            console.log('Loaded departments:', this.departments.length);
          }
          resolve();
        },
        error: (error) => {
          console.error('Error loading departments:', error);
          resolve();
        }
      });
    });
  }

  loadEmployeesByDepartmentAsync(departmentId: number): Promise<void> {
    return new Promise((resolve) => {
      this.api.getEmployeesByDepartment(departmentId).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.employees = response.data;
            console.log('Loaded employees:', this.employees.length);
          }
          resolve();
        },
        error: (error) => {
          console.error('Error loading employees:', error);
          resolve();
        }
      });
    });
  }

  loadDepartmentTaskCategoriesAsync(departmentId: number): Promise<void> {
    return new Promise((resolve) => {
      this.api.getDepartmentTaskCategories(departmentId).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const allCategories = [
              ...(response.data.favouriteList || []),
              ...(response.data.departmentList || []),
              ...(response.data.allDepartmentList || [])
            ];
            const uniqueCategories = allCategories.filter((category, index, self) =>
              index === self.findIndex((c) => c.categoryId === category.categoryId)
            );
            this.taskCategories = uniqueCategories;
            console.log('Loaded task categories:', this.taskCategories.length);
          }
          resolve();
        },
        error: (error) => {
          console.error('Error loading task categories:', error);
          resolve();
        }
      });
    });
  }

  loadAllTaskCategoriesAsync(): Promise<void> {
    return new Promise((resolve) => {
      const userId = this.currentUserId;
      if (!userId) {
        console.warn('No user ID available to load task categories');
        resolve();
        return;
      }
      
      this.api.getUserTaskCategories(userId).subscribe({
        next: (response: any) => {
          if (response.success && response.data) {
            const allCategories = [
              ...(response.data.favouriteList || []),
              ...(response.data.departmentList || []),
              ...(response.data.allDepartmentList || [])
            ];
            const uniqueCategories = allCategories.filter((category: any, index: number, self: any[]) =>
              index === self.findIndex((c: any) => c.categoryId === category.categoryId)
            );
            this.taskCategories = uniqueCategories;
            console.log('Loaded task categories:', this.taskCategories.length);
          }
          resolve();
        },
        error: (error: any) => {
          console.error('Error loading task categories:', error);
          resolve();
        }
      });
    });
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

  loadLoggedHours() {
    console.log('Loading logged hours from API');
    this.isLoadingData = true;
    
    // Get current user
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const currentUserId = currentUser.empId || currentUser.employeeId || '';
    
    // Determine userId based on employee and department selection
    let userId = undefined;
    
    // Only set userId if a specific employee is selected AND department is not "all"
    if (this.selectedEmployee !== 'all' && this.selectedDepartment !== 'all') {
      userId = this.selectedEmployee; // selectedEmployee is the employeeCode
      console.log('Filtering by selected employee code:', userId);
    } else if (this.selectedDepartment === 'all' || this.selectedEmployee === 'all') {
      // If "All Departments" or "All Employees" is selected, userId should be null
      userId = undefined;
      console.log('All Departments or All Employees selected - userId is null');
    }
    
    // Build request object
    const request: any = {
      fromDate: this.fromDate || undefined,
      toDate: this.toDate || undefined,
      projectId: this.selectedProject !== 'all' ? Number(this.selectedProject) : undefined,
      categoryId: this.selectedCategory !== 'all' ? Number(this.selectedCategory) : undefined,
      pageNumber: this.currentPage,
      pageSize: this.pageSize,
      isExport: 'N'  // Always 'N' for normal data loading
    };
    
    // Only add userId if it's defined (specific employee selected)
    if (userId) {
      request.userId = userId;
    }
    
    // Only add departmentId if a specific department is selected
    if (this.selectedDepartment !== 'all') {
      request.departmentId = Number(this.selectedDepartment);
    }
    
    // Only add employeeId if a specific employee is selected (not "All Employees")
    if (this.selectedEmployee !== 'all') {
      request.employeeId = this.selectedEmployee;
    }
    
    console.log('getUserDailyLogHistory request:', request);
    
    this.api.getUserDailyLogHistory(request).subscribe({
      next: (response) => {
        console.log('getUserDailyLogHistory API Response:', response);
        
        if (response && response.success && response.data) {
          // Map API response to LoggedHour interface
          const newRecords = response.data.map((log: any, index: number) => ({
            id: `${log.taskId}-${index}`,
            taskId: `TSK-${log.taskId}`,
            title: log.taskTitle || 'Untitled Task',
            description: log.description || 'No description',
            dailyComment: log.dailyComment || '',
            projectName: log.projectName || '',
            category: log.categoryName || 'Uncategorized',
            categoryId: log.categoryId ?? 0,
            userId: log.userId || log.empId || log.employeeId || '', // Capture userId from API
            duration: log.duration || '00:00',
            date: log.logDate ? log.logDate.split('T')[0] : '',
            project: log.projectName || 'No Project',
            loggedBy: log.loggedBy || '',
            customFields: log.customFields || {}  // Store custom fields
          }));
          
          // Extract all unique custom field names from the response
          this.extractCustomFieldNames(response.data);
          
          // If it's the first page, replace the data; otherwise, append
          if (this.currentPage === 1) {
            this.loggedHours = newRecords;
          } else {
            this.loggedHours = [...this.loggedHours, ...newRecords];
          }
          
          // Update pagination info
          this.totalRecords = response.totalRecords || this.loggedHours.length;
          this.hasMoreRecords = newRecords.length === this.pageSize;
          
          console.log('Loaded logged hours:', this.loggedHours.length, 'records, Page:', this.currentPage);
        } else if (response && Array.isArray(response.data)) {
          // Handle direct array response
          const newRecords = response.data.map((log: any, index: number) => ({
            id: `${log.taskId}-${index}`,
            taskId: `TSK-${log.taskId}`,
            title: log.taskTitle || 'Untitled Task',
            description: log.description || 'No description',
            dailyComment: log.dailyComment || '',
            projectName: log.projectName || '',
            category: log.categoryName || 'Uncategorized',
            categoryId: log.categoryId ?? 0,
            userId: log.userId || log.empId || log.employeeId || '', // Capture userId from API
            duration: log.duration || '00:00',
            date: log.logDate ? log.logDate.split('T')[0] : '',
            project: log.projectName || 'No Project',
            loggedBy: log.loggedBy || '',
            customFields: log.customFields || {}  // Store custom fields
          }));
          
          // Extract all unique custom field names from the response
          this.extractCustomFieldNames(response.data);
          
          // If it's the first page, replace the data; otherwise, append
          if (this.currentPage === 1) {
            this.loggedHours = newRecords;
          } else {
            this.loggedHours = [...this.loggedHours, ...newRecords];
          }
          
          this.hasMoreRecords = newRecords.length === this.pageSize;
          
          console.log('Loaded logged hours (direct array):', this.loggedHours.length, 'records');
        } else {
          console.warn('No logged hours data found');
          if (this.currentPage === 1) {
            this.loggedHours = [];
          }
          this.hasMoreRecords = false;
        }
        
        this.isLoadingData = false;
      },
      error: (error) => {
        console.error('Error loading logged hours:', error);
        if (this.currentPage === 1) {
          this.loggedHours = [];
        }
        this.hasMoreRecords = false;
        this.isLoadingData = false;
      }
    });
  }

  // Load next page of records
  loadNextPage() {
    if (!this.hasMoreRecords || this.isLoadingData) {
      return;
    }
    
    this.currentPage++;
    this.loadLoggedHours();
  }

  // Reset pagination and reload
  resetAndReload() {
    this.currentPage = 1;
    this.hasMoreRecords = false;
    this.loadLoggedHours();
  }

  // Group logged hours by date
  getGroupedLoggedHours(): { date: string; displayDate: string; displayDay: string; records: LoggedHour[] }[] {
    // First, filter records based on search term
    let filteredRecords = this.loggedHours;
    
    if (this.tableSearchTerm && this.tableSearchTerm.trim()) {
      const searchLower = this.tableSearchTerm.toLowerCase().trim();
      filteredRecords = this.loggedHours.filter(record => {
        // Search in multiple fields
        const searchableText = [
          record.title,
          record.description,
          record.category,
          record.projectName,
          record.dailyComment,
          record.loggedBy,
          record.taskId,
          // Also search in custom fields
          ...Object.values(record.customFields || {}).map(v => String(v))
        ].join(' ').toLowerCase();
        
        return searchableText.includes(searchLower);
      });
    }
    
    // Group filtered records by date
    const grouped = filteredRecords.reduce((acc, record) => {
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

  // Clear table search
  clearTableSearch() {
    this.tableSearchTerm = '';
  }

  // Handle table search change
  onTableSearchChange() {
    // This method can be used for debouncing if needed in the future
    // For now, the filtering happens automatically through getGroupedLoggedHours()
  }

  // Get filtered records count
  getFilteredRecordsCount(): number {
    if (!this.tableSearchTerm || !this.tableSearchTerm.trim()) {
      return this.loggedHours.length;
    }
    
    const searchLower = this.tableSearchTerm.toLowerCase().trim();
    return this.loggedHours.filter(record => {
      const searchableText = [
        record.title,
        record.description,
        record.category,
        record.projectName,
        record.dailyComment,
        record.loggedBy,
        record.taskId,
        ...Object.values(record.customFields || {}).map(v => String(v))
      ].join(' ').toLowerCase();
      
      return searchableText.includes(searchLower);
    }).length;
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
    // Generate a consistent color class based on category name
    return `category-color-${this.getCategoryColorIndex(category)}`;
  }

  // Generate a consistent color index (0-11) based on category name
  getCategoryColorIndex(category: string): number {
    if (!category) return 0;
    
    // Simple hash function to generate consistent index
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Return a number between 0 and 11 (12 different colors)
    return Math.abs(hash) % 12;
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
    console.log('Exporting report from', this.fromDate, 'to', this.toDate);
    
    // Get current user
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const currentUserId = currentUser.empId || currentUser.employeeId || '';
    
    // Determine userId based on employee and department selection
    let userId = undefined;
    
    // Only set userId if a specific employee is selected AND department is not "all"
    if (this.selectedEmployee !== 'all' && this.selectedDepartment !== 'all') {
      userId = this.selectedEmployee;
    } else if (this.selectedDepartment === 'all' || this.selectedEmployee === 'all') {
      userId = undefined;
    }
    
    // Get all visible column names mapped to API field names
    const allColumns = this.getAllVisibleColumns();
    const selectedColumns = allColumns.map(col => {
      // For custom field columns, extract the actual field name and capitalize first letter
      if (col.key.startsWith('customField_')) {
        const fieldName = col.key.replace('customField_', '');
        return this.capitalizeFirstLetter(fieldName);
      }
      // For standard columns, map to API field names (already capitalized in map)
      return this.columnToApiFieldMap[col.key] || this.capitalizeFirstLetter(col.key);
    }).filter(fieldName => fieldName); // Remove any undefined values
    
    // Always include LogDate if not already present
    if (!selectedColumns.includes('LogDate')) {
      selectedColumns.push('LogDate');
    }
    
    // Build export request object
    const exportRequest: any = {
      fromDate: this.fromDate || undefined,
      toDate: this.toDate || undefined,
      projectId: this.selectedProject !== 'all' ? Number(this.selectedProject) : undefined,
      categoryId: this.selectedCategory !== 'all' ? Number(this.selectedCategory) : undefined,
      pageNumber: 0,  // Always 0 for export
      pageSize: 0,    // Always 0 for export
      isExport: 'Y',  // 'Y' for export
      selectedColumns: selectedColumns  // Array of API field names with first letter capitalized
    };
    
    // Only add userId if it's defined (specific employee selected)
    if (userId) {
      exportRequest.userId = userId;
    }
    
    // Only add departmentId if a specific department is selected
    if (this.selectedDepartment !== 'all') {
      exportRequest.departmentId = Number(this.selectedDepartment);
    }
    
    // Only add employeeId if a specific employee is selected (not "All Employees")
    if (this.selectedEmployee !== 'all') {
      exportRequest.employeeId = this.selectedEmployee;
    }
    
    console.log('Export request:', exportRequest);
    console.log('Selected columns (API field names):', selectedColumns);
    
    // Show loading state
    this.toasterService.showInfo('Export', 'Preparing your report...');
    
    // Call export API
    this.api.exportUserDailyLogHistory(exportRequest).subscribe({
      next: (blob: Blob) => {
        console.log('Export successful, downloading file...');
        
        // Create a download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Generate filename with date range
        const fromDateStr = this.fromDate ? this.fromDate.replace(/-/g, '') : 'start';
        const toDateStr = this.toDate ? this.toDate.replace(/-/g, '') : 'end';
        link.download = `LoggedHours_${fromDateStr}_to_${toDateStr}.xlsx`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        this.toasterService.showSuccess('Export Complete', 'Your report has been downloaded successfully');
      },
      error: (error: any) => {
        console.error('Error exporting report:', error);
        this.toasterService.showError('Export Failed', 'Failed to export report. Please try again.');
      }
    });
  }

  // Helper function to capitalize first letter only
  capitalizeFirstLetter(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
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
    
    // Get current user for comparison
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const currentUserId = currentUser.empId || currentUser.employeeId || '';
    
    // Use the record's userId for the API call (not the session userId)
    const recordUserId = record.userId || currentUserId;
    this.currentUserId = recordUserId;
    
    // Use categoryId from API response if valid (not 0, null, undefined)
    // Otherwise fall back to finding it from taskCategories array
    let categoryId = record.categoryId;
    if (!categoryId || categoryId === 0) {
      // Try to find categoryId from taskCategories array by matching category name
      const category = this.taskCategories.find(cat => cat.categoryName === record.category);
      categoryId = category?.categoryId || 0;
    }
    this.selectedTaskCategoryId = categoryId;
    
    // Check if the record's userId matches the current logged-in user
    // If they don't match, enable view-only mode
    this.isTaskModalViewOnly = (recordUserId !== '' && recordUserId !== currentUserId);
    
    console.log('Opening task modal:', {
      taskId: this.selectedTaskId,
      categoryId: this.selectedTaskCategoryId,
      currentUserId: currentUserId,
      recordUserId: recordUserId,
      isViewOnly: this.isTaskModalViewOnly,
      recordCategoryId: record.categoryId
    });
    
    this.showTaskModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeTaskModal() {
    this.showTaskModal = false;
    this.isTaskModalViewOnly = false; // Reset view-only mode
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

  // Break History Modal Methods
  openBreakHistoryModal() {
    console.log('Opening Break History modal...');
    this.showBreakHistoryModal = true;
    this.loadBreakHistory();
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  closeBreakHistoryModal() {
    this.showBreakHistoryModal = false;
    
    // Restore body scroll
    document.body.style.overflow = '';
  }

  loadBreakHistory() {
    this.isLoadingBreaks = true;
    
    this.api.getOpenBreaks().subscribe({
      next: (response: any) => {
        console.log('Break history response:', response);
        
        if (response && response.success && response.data) {
          this.openBreaks = response.data;
          console.log('Loaded open breaks:', this.openBreaks.length);
        } else {
          this.openBreaks = [];
        }
        
        this.isLoadingBreaks = false;
      },
      error: (error: any) => {
        console.error('Error loading break history:', error);
        this.openBreaks = [];
        this.isLoadingBreaks = false;
      }
    });
  }

  refreshBreakHistory() {
    console.log('Refreshing break history...');
    this.loadBreakHistory();
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  formatBreakTime(dateTime: string | Date): string {
    const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  formatDuration(minutes: number): string {
    if (minutes < 1) {
      return 'Just started';
    }
    
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  // Day Log History Modal Methods
  openDayLogHistoryModal(record: LoggedHour, event: Event) {
    event.stopPropagation(); // Prevent opening task modal
    console.log('Opening Day Log History modal for record:', record);
    
    this.selectedRecordForDayLog = record;
    this.showDayLogHistoryModal = true;
    this.loadDayLogHistory(record);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  closeDayLogHistoryModal() {
    this.showDayLogHistoryModal = false;
    this.selectedRecordForDayLog = null;
    this.dayLogHistory = [];
    
    // Restore body scroll
    document.body.style.overflow = '';
  }

  loadDayLogHistory(record: LoggedHour) {
    this.isLoadingDayLogs = true;
    
    // Extract taskId (remove 'TSK-' prefix if present)
    const taskIdStr = record.taskId?.replace('TSK-', '') || '0';
    const taskId = parseInt(taskIdStr, 10);
    
    // Get userId from record or current user
    const userId = record.userId || this.currentUserId;
    
    // Get logDate from record
    const logDate = record.date;
    
    console.log('Loading day log history with params:', {
      userId,
      taskId,
      logDate
    });
    
    const request = {
      userId: userId,
      taskId: taskId,
      logDate: logDate
    };
    
    this.api.getUserTaskDayLogHistory(request).subscribe({
      next: (response: any) => {
        console.log('Day log history response:', response);
        
        if (response && response.success && response.data) {
          this.dayLogHistory = response.data;
          console.log('Loaded day log history:', this.dayLogHistory.length, 'entries');
        } else {
          this.dayLogHistory = [];
          console.warn('No day log history data found');
        }
        
        this.isLoadingDayLogs = false;
      },
      error: (error: any) => {
        console.error('Error loading day log history:', error);
        this.dayLogHistory = [];
        this.isLoadingDayLogs = false;
        this.toasterService.showError('Error', 'Failed to load day log history');
      }
    });
  }

  formatLogDate(dateTime: string | Date): string {
    if (!dateTime) return 'N/A';
    
    const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
    
    // Format as: Feb 24, 2026 1:40 PM
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  formatLogDateOnly(dateTime: string | Date): string {
    if (!dateTime) return 'N/A';
    
    const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
    
    // Format as: Feb 24, 2026 (date only, no time)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatTimeOnly(timeString: string | Date): string {
    if (!timeString) return 'N/A';
    
    const date = typeof timeString === 'string' ? new Date(timeString) : timeString;
    
    // Format as: 1:40 PM (time only)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  canEditLog(log: any): boolean {
    // User can only edit their own logs
    // Compare logged-in user ID with the log's user ID
    return log.userId === this.currentUserId;
  }

  editDayLog(log: any) {
    console.log('Edit day log:', log);
    
    const currentMinutes = log.minutesSpent || 0;
    
    // Show SweetAlert with input for new minutes
    Swal.fire({
      title: 'Edit Time Log',
      html: `
        <div style="text-align: left; margin-bottom: 15px;">
          <p style="margin-bottom: 10px;"><strong>Current Duration:</strong> ${log.duration} (${currentMinutes} minutes)</p>
          <p style="margin-bottom: 10px; color: #666;">You can only reduce the time, not increase it.</p>
        </div>
        <input id="swal-input-minutes" class="swal2-input" type="number" 
               placeholder="Enter new minutes" 
               min="0" 
               max="${currentMinutes}" 
               value="${currentMinutes}"
               style="width: 80%; margin: 10px auto;">
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Update',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#6b7280',
      preConfirm: () => {
        const input = document.getElementById('swal-input-minutes') as HTMLInputElement;
        const newMinutes = parseInt(input.value, 10);
        
        // Validation
        if (isNaN(newMinutes) || newMinutes < 0) {
          Swal.showValidationMessage('Please enter a valid number of minutes');
          return false;
        }
        
        if (newMinutes > currentMinutes) {
          Swal.showValidationMessage(`You can only reduce time. Maximum is ${currentMinutes} minutes`);
          return false;
        }
        
        if (newMinutes === currentMinutes) {
          Swal.showValidationMessage('Please enter a different value');
          return false;
        }
        
        return newMinutes;
      }
    }).then((result) => {
      if (result.isConfirmed && result.value !== undefined) {
        const newMinutes = result.value;
        this.updateTimeLog(log, newMinutes);
      }
    });
  }

  updateTimeLog(log: any, newMinutes: number) {
    const request = {
      timeLogId: log.timeLogId,
      newMinutes: newMinutes,
      userId: log.userId
    };
    
    console.log('Updating time log with request:', request);
    
    // Show loading
    Swal.fire({
      title: 'Updating...',
      text: 'Please wait while we update the time log',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    this.api.decreaseTimeLog(request).subscribe({
      next: (response: any) => {
        console.log('Time log update response:', response);
        
        if (response && response.success) {
          Swal.fire({
            icon: 'success',
            title: 'Updated!',
            text: 'Time log has been updated successfully',
            confirmButtonColor: '#6366f1',
            timer: 2000
          });
          
          // Refresh the day log history modal
          if (this.selectedRecordForDayLog) {
            this.loadDayLogHistory(this.selectedRecordForDayLog);
          }
          
          // Refresh the main page listing
          this.applyFilters();
          
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: response?.message || 'Failed to update time log',
            confirmButtonColor: '#6366f1'
          });
        }
      },
      error: (error: any) => {
        console.error('Error updating time log:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'An error occurred while updating the time log',
          confirmButtonColor: '#6366f1'
        });
      }
    });
  }

  // Manage Fields Modal Methods
  openManageFieldsModal() {
    console.log('Opening Manage Fields modal...');
    this.showManageFieldsModal = true;
    this.loadCustomFields();
    document.body.style.overflow = 'hidden';
  }

  closeManageFieldsModal() {
    this.showManageFieldsModal = false;
    this.clearNewField();
    document.body.style.overflow = '';
  }

  loadCustomFields() {
    this.isLoadingFields = true;
    
    this.api.getAllFieldsAsync().subscribe({
      next: (response: any) => {
        console.log('Custom fields response:', response);
        
        if (response && response.success && response.data) {
          // Map the API response to our field structure
          this.customFields = response.data.map((field: any) => ({
            fieldId: field.fieldId,
            fieldName: field.fieldName,
            fieldType: field.fieldType,
            isActive: field.isActive === 'Y',
            isMandatory: field.isMandatory?.trim() === 'Y',
            options: field.options && field.options.length > 0 
              ? field.options
                  .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
                  .map((opt: any) => opt.optionValue)
                  .join(', ')
              : '',
            optionsArray: field.options || [],
            isEditing: false
          }));
          console.log('Loaded custom fields:', this.customFields.length);
        } else {
          this.customFields = [];
        }
        
        this.isLoadingFields = false;
      },
      error: (error: any) => {
        console.error('Error loading custom fields:', error);
        this.customFields = [];
        this.isLoadingFields = false;
      }
    });
  }

  isNewFieldValid(): boolean {
    if (!this.newField.fieldName || !this.newField.fieldType) {
      return false;
    }
    
    if (this.newField.fieldType === 'Dropdown' && !this.newField.options) {
      return false;
    }
    
    return true;
  }

  createField() {
    if (!this.isNewFieldValid()) {
      this.toasterService.showError('Validation Error', 'Please fill in all required fields');
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const userId = currentUser.empId || currentUser.employeeId || '';

    const fieldData = {
      fieldName: this.newField.fieldName.trim(),
      fieldType: this.newField.fieldType,
      options: this.newField.fieldType === 'Dropdown' ? this.newField.options : '',
      createdBy: userId
    };

    console.log('Creating field:', fieldData);

    this.api.saveCustomField(fieldData).subscribe({
      next: (response: any) => {
        console.log('Field created:', response);
        
        if (response && response.success) {
          this.toasterService.showSuccess('Success', 'Custom field created successfully');
          this.clearNewField();
          this.loadCustomFields();
        } else {
          this.toasterService.showError('Error', response?.message || 'Failed to create field');
        }
      },
      error: (error: any) => {
        console.error('Error creating field:', error);
        this.toasterService.showError('Error', 'Failed to create custom field');
      }
    });
  }

  clearNewField() {
    this.newField = {
      fieldName: '',
      fieldType: '',
      options: '',
      isRequired: false,
      isSearchable: false
    };
  }

  toggleAddFieldForm() {
    this.showAddFieldForm = !this.showAddFieldForm;
    if (!this.showAddFieldForm) {
      this.clearNewField();
    }
  }

  // New Add Field Modal Methods
  openAddFieldModal() {
    this.editingField = false;
    this.currentField = {
      fieldName: '',
      fieldType: '',
      isActive: true,
      isMandatory: false
    };
    this.currentFieldOptions = [{ optionValue: '', isActive: true }];
    this.showAddFieldModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeAddFieldModal() {
    this.showAddFieldModal = false;
    this.editingField = false;
    this.currentField = {
      fieldName: '',
      fieldType: '',
      isActive: true,
      isMandatory: false
    };
    this.currentFieldOptions = [{ optionValue: '', isActive: true }];
    document.body.style.overflow = '';
  }

  editFieldInModal(field: any) {
    this.editingField = true;
    this.currentField = { 
      ...field,
      // Store the original optionsArray for editing
      optionsArray: field.optionsArray || []
    };
    
    // Parse options for dropdown (case-insensitive check)
    if (field.fieldType?.toUpperCase() === 'DROPDOWN') {
      if (field.optionsArray && field.optionsArray.length > 0) {
        // Use the optionsArray from API response
        this.currentFieldOptions = field.optionsArray
          .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
          .map((opt: any) => ({
            optionId: opt.optionId,
            optionValue: opt.optionValue,
            isActive: opt.isActive === 'Y',
            sortOrder: opt.sortOrder
          }));
      } else if (field.options) {
        // Fallback to parsing the comma-separated string
        this.currentFieldOptions = field.options.split(',').map((opt: string, index: number) => ({
          optionValue: opt.trim(),
          isActive: true,
          sortOrder: index + 1
        }));
      } else {
        this.currentFieldOptions = [{ optionValue: '', isActive: true }];
      }
    } else {
      this.currentFieldOptions = [{ optionValue: '', isActive: true }];
    }
    
    this.showAddFieldModal = true;
    document.body.style.overflow = 'hidden';
  }

  isCurrentFieldValid(): boolean {
    if (!this.currentField.fieldName || !this.currentField.fieldType) {
      return false;
    }
    
    if (this.currentField.fieldType?.toUpperCase() === 'DROPDOWN') {
      const validOptions = this.currentFieldOptions.filter(opt => opt.optionValue && opt.optionValue.trim());
      if (validOptions.length === 0) {
        return false;
      }
    }
    
    return true;
  }

  saveCurrentField() {
    if (!this.isCurrentFieldValid()) {
      this.toasterService.showError('Validation Error', 'Please fill in all required fields');
      return;
    }

    // Get logged-in user from session
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const userId = currentUser.empId || currentUser.employeeId || '';

    if (!userId) {
      this.toasterService.showError('Error', 'User session not found');
      return;
    }

    // Prepare options array for dropdown (only if fieldType is DROPDOWN)
    let optionsData: any[] = [];
    if (this.currentField.fieldType?.toUpperCase() === 'DROPDOWN') {
      optionsData = this.currentFieldOptions
        .filter(opt => opt.optionValue && opt.optionValue.trim())
        .map((opt, index) => ({
          optionId: this.editingField && opt.optionId ? opt.optionId : 0,
          optionValue: opt.optionValue.trim(),
          isActive: opt.isActive ? 'Y' : 'N',
          sortOrder: opt.sortOrder || (index + 1)
        }));
    }

    // Prepare field data according to API requirements
    const fieldData = {
      fieldId: this.editingField && this.currentField.fieldId ? this.currentField.fieldId : 0,
      fieldName: this.currentField.fieldName.trim(),
      fieldType: this.currentField.fieldType.toUpperCase(), // TEXT, NUMBER, DATE, DROPDOWN
      isMandatory: this.currentField.isMandatory ? 'Y' : 'N',
      isActive: this.currentField.isActive ? 'Y' : 'N',
      userId: userId, // Logged-in user's empId
      options: optionsData // Only for dropdown, empty array for others
    };

    console.log(this.editingField ? 'Updating field:' : 'Creating field:', fieldData);

    // Call the saveCustomField API (handles both create and update)
    this.api.saveCustomField(fieldData).subscribe({
      next: (response: any) => {
        console.log('Field saved:', response);
        
        if (response && response.success) {
          this.toasterService.showSuccess('Success', 
            this.editingField ? 'Field updated successfully' : 'Field created successfully');
          this.closeAddFieldModal();
          this.loadCustomFields();
        } else {
          this.toasterService.showError('Error', response?.message || 'Failed to save field');
        }
      },
      error: (error: any) => {
        console.error('Error saving field:', error);
        this.toasterService.showError('Error', 'Failed to save field. Please try again.');
      }
    });
  }

  addOption() {
    this.currentFieldOptions.push({ optionValue: '', isActive: true });
  }

  removeOption(index: number) {
    if (this.currentFieldOptions.length > 1) {
      this.currentFieldOptions.splice(index, 1);
    }
  }

  getOptionsCount(): number {
    return this.currentFieldOptions.filter(opt => opt.optionValue && opt.optionValue.trim()).length;
  }

  editField(field: any) {
    // Store original data for cancel
    this.originalFieldData = { ...field };
    field.isEditing = true;
  }

  cancelEdit(field: any) {
    if (this.originalFieldData) {
      // Restore original data
      Object.assign(field, this.originalFieldData);
      this.originalFieldData = null;
    }
    field.isEditing = false;
  }

  saveField(field: any) {
    if (!field.fieldName || !field.fieldType) {
      this.toasterService.showError('Validation Error', 'Field name and type are required');
      return;
    }

    if (field.fieldType === 'Dropdown' && !field.options) {
      this.toasterService.showError('Validation Error', 'Dropdown options are required');
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const userId = currentUser.empId || currentUser.employeeId || '';

    const fieldData = {
      fieldId: field.fieldId,
      fieldName: field.fieldName.trim(),
      fieldType: field.fieldType,
      options: field.fieldType === 'Dropdown' ? field.options : '',
      createdBy: userId
    };

    console.log('Updating field:', fieldData);

    this.api.updateCustomField(fieldData).subscribe({
      next: (response: any) => {
        console.log('Field updated:', response);
        
        if (response && response.success) {
          this.toasterService.showSuccess('Success', 'Field updated successfully');
          field.isEditing = false;
          this.originalFieldData = null;
          this.loadCustomFields();
        } else {
          this.toasterService.showError('Error', response?.message || 'Failed to update field');
        }
      },
      error: (error: any) => {
        console.error('Error updating field:', error);
        this.toasterService.showError('Error', 'Failed to update field');
      }
    });
  }

  deleteField(field: any) {
    Swal.fire({
      title: 'Delete Field?',
      text: `Are you sure you want to delete "${field.fieldName}"? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
        const userId = currentUser.empId || currentUser.employeeId || '';

        this.api.deleteCustomField(field.fieldId, userId).subscribe({
          next: (response: any) => {
            console.log('Field deleted:', response);
            
            if (response && response.success) {
              this.toasterService.showSuccess('Success', 'Field deleted successfully');
              this.loadCustomFields();
            } else {
              this.toasterService.showError('Error', response?.message || 'Failed to delete field');
            }
          },
          error: (error: any) => {
            console.error('Error deleting field:', error);
            this.toasterService.showError('Error', 'Failed to delete field');
          }
        });
      }
    });
  }

  getFieldTypeIcon(fieldType: string): string {
    const iconMap: { [key: string]: string } = {
      'Text': 'fas fa-font',
      'Number': 'fas fa-hashtag',
      'Date': 'fas fa-calendar',
      'Dropdown': 'fas fa-list'
    };
    return iconMap[fieldType] || 'fas fa-question';
  }

  // Custom Fields Column Management
  extractCustomFieldNames(data: any[]) {
    const fieldNamesSet = new Set<string>();
    
    data.forEach(log => {
      if (log.customFields && typeof log.customFields === 'object') {
        Object.keys(log.customFields).forEach(fieldName => {
          // Only add non-empty field names
          if (fieldName && fieldName.trim()) {
            fieldNamesSet.add(fieldName);
          }
        });
      }
    });
    
    this.availableCustomFields = Array.from(fieldNamesSet).sort();
    console.log('Extracted custom field names:', this.availableCustomFields);
  }

  openCustomFieldsModal() {
    this.showCustomFieldsModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeCustomFieldsModal() {
    this.showCustomFieldsModal = false;
    document.body.style.overflow = 'auto';
  }

  toggleCustomField(fieldName: string) {
    const index = this.selectedCustomFields.indexOf(fieldName);
    if (index > -1) {
      // Remove from selected
      this.selectedCustomFields.splice(index, 1);
    } else {
      // Add to selected
      this.selectedCustomFields.push(fieldName);
    }
  }

  isCustomFieldSelected(fieldName: string): boolean {
    return this.selectedCustomFields.includes(fieldName);
  }

  applyCustomFieldChanges() {
    console.log('Applied custom fields:', this.selectedCustomFields);
    this.closeCustomFieldsModal();
  }

  getCustomFieldValue(record: LoggedHour, fieldName: string): string {
    if (!record.customFields || !record.customFields[fieldName]) {
      return '-';
    }
    const value = record.customFields[fieldName];
    return value !== null && value !== undefined && value !== '' ? value.toString() : '-';
  }

  getAllVisibleColumns(): ColumnDefinition[] {
    // Get standard visible columns
    const standardColumns = this.getVisibleColumns();
    
    // Add custom field columns
    const customFieldColumns: ColumnDefinition[] = this.selectedCustomFields.map(fieldName => ({
      key: `customField_${fieldName}`,
      label: fieldName,
      visible: true,
      width: '150px',
      type: 'text',
      required: false
    }));
    
    // Insert custom fields before the last column (duration)
    const lastColumn = standardColumns[standardColumns.length - 1];
    const columnsWithoutLast = standardColumns.slice(0, -1);
    
    return [...columnsWithoutLast, ...customFieldColumns, lastColumn];
  }

  getGridTemplateColumnsWithCustomFields(): string {
    const allColumns = this.getAllVisibleColumns();
    
    return allColumns.map(col => {
      // Handle custom field columns
      if (col.key.startsWith('customField_')) {
        return '150px';
      }
      
      // Set specific widths for different column types
      switch (col.key) {
        case 'title':
          return '300px';
        case 'description':
          return '350px';
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

  getColumnValueWithCustomFields(record: LoggedHour, column: ColumnDefinition): any {
    // Check if it's a custom field column
    if (column.key.startsWith('customField_')) {
      const fieldName = column.key.replace('customField_', '');
      return this.getCustomFieldValue(record, fieldName);
    }
    
    // Otherwise use the standard column value getter
    return this.getColumnValue(record, column.key);
  }
}