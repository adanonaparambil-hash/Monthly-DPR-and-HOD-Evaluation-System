import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Theme } from '../services/theme';
import { Api } from '../services/api';
import { AuthService } from '../services/auth.service';
import { ToasterService } from '../services/toaster.service';
import { ToasterComponent } from '../components/toaster/toaster.component';
import { TaskDetailsModalComponent } from '../components/task-details-modal/task-details-modal.component';
import { SessionService } from '../services/session.service';
import { TaskSaveDto, ActiveTaskListResponse, ActiveTaskDto, TaskCommentDto, TaskActivityDto } from '../models/TimeSheetDPR.model';
import { AvatarUtil } from '../utils/avatar.util';
import Swal from 'sweetalert2';

interface Task {
  id: number;
  title: string;
  description: string;
  status: 'NOT STARTED' | 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'CLOSED' | 'AUTO CLOSED';
  category: string;
  categoryId?: number; // Add categoryId property
  loggedHours: string;
  totalHours: string;
  startDate: string;
  assignee: string;
  assigneeId?: string; // Add assigneeId property
  assigneeImage?: string;
  progress: number;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  isFavorite?: boolean;
}

interface NewTask {
  name: string;
  description: string;
  assignee: string;
  assignees: string[]; // Multiple assignees
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
  isMapped?: 'Y' | 'N';
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
  isFavourite?: 'Y' | 'N';
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
  imports: [CommonModule, FormsModule, DatePipe, ToasterComponent, TaskDetailsModalComponent],
  templateUrl: './my-task.component.html',
  styleUrls: ['./my-task.component.css', './task-modal-new.css', './task-details-modal.css', './task-modal-glassmorphism.css']
})
export class MyTaskComponent implements OnInit, OnDestroy {
  isDarkMode = false;
  
  // Avatar utility for template access
  AvatarUtil = AvatarUtil;

  // Active task state
  hasActiveTask = false;
  activeTask: Task | null = null;

  // Timer and stats - will be updated from API
  activeTaskTimer = '00:00:00';
  punchedHours = '00:00:00';
  runningTime = '00:00:00';
  todayTotalHours = 0;
  lastPunchTime = '';

  
  // Active task timer management
  activeTaskTimerInterval: any = null;
  activeTaskElapsedSeconds = 0;
  activeTaskStartTime: Date | null = null;
  // Break management
  isOnBreak = false;
  breakStatus = 'NONE';
  breakReason: string | null = null;
  breakRemarks = '';
  breakId: number | null = null;
  
  // Break Tracker
  selectedBreakType: 'lunch' | 'coffee' | 'quick' | null = null;
  isBreakRunning = false;
  isBreakPaused = false;
  breakTimerDisplay = '00:00:00';
  breakTimerCaption = 'Select break type to start';
  breakStartTime: Date | null = null;
  breakElapsedSeconds = 0;
  breakTimerInterval: any = null;

  // Task lists from API
  myTasksList: ActiveTaskDto[] = [];
  assignedByMeList: ActiveTaskDto[] = [];

  // Tab management
  activeTab = 'MY TASKS';
  myTasksCount = 13;
  assignedToOthersCount = 8;
  searchTerm = '';

  // Pagination
  currentPage = 1;
  totalPages = 1;
  currentPageTasks = 0;
  totalTasks = 0;

  // Modal state
  showCreateTaskModal = false;
  showTaskDetailsModal = false;
  showSelectTaskModal = false;
  showCustomFieldsModal = false;
  showAddFieldModal = false;
  showManageTasksModal = false; // New modal for managing task categories
  selectedTask: Task | null = null;
  
  // Properties for standalone task details modal
  selectedTaskIdForModal: number = 0;
  selectedUserIdForModal: string = '';
  selectedCategoryIdForModal: number = 0;
  
  selectTaskActiveTab: 'favorites' | 'myDepartment' | 'all' = 'favorites';
  selectTaskSearchTerm = ''; // Search term for Select Task modal

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
  activityLogs: TaskActivityDto[] = []; // Activity logs from API
  detailedSubtasks: SubtaskDetailed[] = [];
  taskComments: TaskCommentDto[] = []; // Comments from API

  // Selected task additional properties
  selectedTaskProject = 'marketing-q4';
  selectedTaskBudget = 1250.00;
  selectedTaskStartDate = '';
  selectedTaskEndDate = '2023-11-05';
  selectedTaskStatus: 'continuous' | 'closed' = 'continuous';
  selectedTaskPriority = 'medium';
  selectedTaskEstimatedHours: number = 40;
  selectedTaskDetailStatus = 'running';
  selectedTaskDepartment = 'engineering';
  selectedTaskClient = 'Acme Corporation';
  editMode = false;
  
  // Task details from API
  selectedTaskId = '';
  selectedTaskCategory = '';
  selectedTaskRunningTimer = '00:00:00';
  selectedTaskTotalHours = '0h';
  selectedTaskProgress = 0;

  // Editable task fields
  editableTaskTitle = 'Initial Design Sprint: UI Component Library';
  editableTaskDescription = 'The primary goal of this phase is to establish a cohesive UI component library for the new marketing dashboard. This includes defining color tokens, typography scales, and building core components like buttons, inputs, and navigation patterns. All assets should be documented in Figma and exported for the frontend team.';
  dailyRemarks = ''; // Daily remarks field

  // New task form data
  newTask: NewTask = {
    name: '',
    description: '',
    assignee: '',
    assignees: [], // Multiple assignees
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
  // Sample tasks data - will be populated from API
  tasks: Task[] = [];

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
    private authService: AuthService,
    private sessionService: SessionService,
    private toasterService: ToasterService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    // Subscribe to theme changes
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    // Initialize component
    this.initializeDetailedSubtasks();

    // Initialize with no active task - will be set by loadActiveTasks()
    this.activeTask = null;
    this.hasActiveTask = false;

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

    // Load active tasks from API - this will set the active task if one is running
    this.loadActiveTasks();
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
        } else if (response && Array.isArray(response)) {
          // Handle direct array response
          this.projectsList = response.map((project: any) => ({
            projectId: project.projectId || project.ProjectId || project.id,
            projectName: project.projectName || project.ProjectName || project.name,
            departmentId: project.departmentId || project.DepartmentId,
            isActive: project.isActive || project.IsActive
          }));
          console.log('Projects List loaded (direct array):', this.projectsList.length, 'projects');
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

  // Load Task Files from API
  loadTaskFiles(taskId: number): void {
    // Clear existing files
    this.uploadedFiles = [];
    
    this.api.getTaskFiles(taskId).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.uploadedFiles = response.data.map((file: any) => ({
            id: file.fileId?.toString() || '',
            name: file.fileName || 'Unknown File',
            size: file.fileSizeKb ? file.fileSizeKb * 1024 : 0, // Convert KB to bytes
            type: file.fileType || 'application/octet-stream',
            uploadDate: file.uploadedOn ? new Date(file.uploadedOn) : new Date(),
            url: file.fileContentBase64 || file.fileContent || undefined
          }));
          console.log('Task files loaded:', this.uploadedFiles.length, 'files for task', taskId);
        } else if (response && Array.isArray(response.data)) {
          // Handle direct array response
          this.uploadedFiles = response.data.map((file: any) => ({
            id: file.fileId?.toString() || '',
            name: file.fileName || 'Unknown File',
            size: file.fileSizeKb ? file.fileSizeKb * 1024 : 0,
            type: file.fileType || 'application/octet-stream',
            uploadDate: file.uploadedOn ? new Date(file.uploadedOn) : new Date(),
            url: file.fileContentBase64 || file.fileContent || undefined
          }));
          console.log('Task files loaded (direct array):', this.uploadedFiles.length, 'files');
        }
      },
      error: (error: any) => {
        console.error('Error loading task files:', error);
        // Keep empty array if API fails
        this.uploadedFiles = [];
      }
    });
  }

  // Load Task Comments from API
  loadComments(taskId: number): void {
    // Clear existing comments
    this.taskComments = [];
    
    this.api.getComments(taskId).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.taskComments = response.data.map((comment: any) => ({
            commentId: comment.commentId || 0,
            taskId: comment.taskId || taskId,
            userId: comment.userId || '',
            comments: comment.comments || '',
            submittedOn: comment.submittedOn || new Date().toISOString(),
            empName: comment.empName || 'Unknown User',
            profileImage: comment.profileImage || undefined,
            profileImageBase64: comment.profileImageBase64 || undefined
          }));
          console.log('Task comments loaded:', this.taskComments.length, 'comments for task', taskId);
        } else if (response && Array.isArray(response.data)) {
          // Handle direct array response
          this.taskComments = response.data.map((comment: any) => ({
            commentId: comment.commentId || 0,
            taskId: comment.taskId || taskId,
            userId: comment.userId || '',
            comments: comment.comments || '',
            submittedOn: comment.submittedOn || new Date().toISOString(),
            empName: comment.empName || 'Unknown User',
            profileImage: comment.profileImage || undefined,
            profileImageBase64: comment.profileImageBase64 || undefined
          }));
          console.log('Task comments loaded (direct array):', this.taskComments.length, 'comments');
        }
      },
      error: (error: any) => {
        console.error('Error loading task comments:', error);
        // Keep empty array if API fails
        this.taskComments = [];
      }
    });
  }

  // Load Task Activity from API
  loadActivity(taskId: number): void {
    // Clear existing activity logs
    this.activityLogs = [];
    
    this.api.getActivity(taskId).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.activityLogs = response.data.map((activity: any) => {
            // Get employee name from ID if available
            const employeeName = activity.actionBy ? this.getEmployeeName(activity.actionBy) : '';
            
            return {
              activityId: activity.activityId || 0,
              taskId: activity.taskId || taskId,
              moduleName: activity.moduleName || '',
              recordId: activity.recordId || undefined,
              actionType: activity.actionType || '',
              actionBy: employeeName || activity.actionBy || '',
              actionDate: activity.actionDate || new Date().toISOString(),
              fieldName: activity.fieldName || undefined,
              oldValue: activity.oldValue || undefined,
              newValue: activity.newValue || undefined,
              description: activity.description || ''
            };
          });
          console.log('Task activity loaded:', this.activityLogs.length, 'activities for task', taskId);
        } else if (response && Array.isArray(response.data)) {
          // Handle direct array response
          this.activityLogs = response.data.map((activity: any) => {
            // Get employee name from ID if available
            const employeeName = activity.actionBy ? this.getEmployeeName(activity.actionBy) : '';
            
            return {
              activityId: activity.activityId || 0,
              taskId: activity.taskId || taskId,
              moduleName: activity.moduleName || '',
              recordId: activity.recordId || undefined,
              actionType: activity.actionType || '',
              actionBy: employeeName || activity.actionBy || '',
              actionDate: activity.actionDate || new Date().toISOString(),
              fieldName: activity.fieldName || undefined,
              oldValue: activity.oldValue || undefined,
              newValue: activity.newValue || undefined,
              description: activity.description || ''
            };
          });
          console.log('Task activity loaded (direct array):', this.activityLogs.length, 'activities');
        }
      },
      error: (error: any) => {
        console.error('Error loading task activity:', error);
        // Keep empty array if API fails
        this.activityLogs = [];
      }
    });
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
            isFavourite: 'Y',  // Items in favouriteList are favorites
            isEditing: false
          }));
          
          this.departmentList = (response.data.departmentList || []).map((cat: any) => ({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            departmentId: cat.departmentId,
            departmentName: cat.departmentName,
            sequenceNumber: cat.eSTIMATEDHOURS || cat.estimatedHours || 0,
            isFavourite: cat.isFavourite || 'N',
            isEditing: false
          }));
          
          this.allDepartmentList = (response.data.allDepartmentList || []).map((cat: any) => ({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            departmentId: cat.departmentId,
            departmentName: cat.departmentName,
            sequenceNumber: cat.eSTIMATEDHOURS || cat.estimatedHours || 0,
            isFavourite: cat.isFavourite || 'N',
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
            isFavourite: 'Y',  // Items in favouriteList are favorites
            isEditing: false
          }));
          
          this.departmentList = (response.data.departmentList || []).map((cat: any) => ({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            departmentId: cat.departmentId,
            departmentName: cat.departmentName,
            sequenceNumber: cat.eSTIMATEDHOURS || cat.estimatedHours || 0,
            isFavourite: cat.isFavourite || 'N',
            isEditing: false
          }));
          
          this.allDepartmentList = (response.data.allDepartmentList || []).map((cat: any) => ({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            departmentId: cat.departmentId,
            departmentName: cat.departmentName,
            sequenceNumber: cat.eSTIMATEDHOURS || cat.estimatedHours || 0,
            isFavourite: cat.isFavourite || 'N',
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

  // Load Active Tasks from API
  loadActiveTasks(): void {
    // Get user ID from session/localStorage
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '1';
    
    this.api.getActiveTaskList(userId).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          const data = response.data;
          
          // Update stats from API
          this.todayTotalHours = data.todayTotalHours || 0;
          this.lastPunchTime = data.lastPunchTime || '';
          
          // Format times for display
          this.punchedHours = this.formatMinutesToTime(this.todayTotalHours);
          this.runningTime = this.formatMinutesToTime(this.todayTotalHours);
          
          // Update break info from API
          this.breakStatus = data.breakStatus || 'NONE';
          this.breakReason = data.breakReason || null;
          this.breakRemarks = data.breakRemarks || '';
          this.breakId = data.breakId || null;
          
          // Set selected break type based on breakReason
          if (this.breakReason) {
            const reasonLower = this.breakReason.toLowerCase();
            if (reasonLower.includes('lunch')) {
              this.selectedBreakType = 'lunch';
            } else if (reasonLower.includes('coffee')) {
              this.selectedBreakType = 'coffee';
            } else if (reasonLower.includes('quick')) {
              this.selectedBreakType = 'quick';
            }
          }
          
          // Initialize break timer from API data
          this.initializeBreakTimerFromAPI(data.breakStart);
          
          // Update myTasksList from API
          this.myTasksList = data.myTasks || [];
          this.assignedByMeList = data.assignedByMe || [];
          
          // Update task counts
          this.myTasksCount = this.myTasksList.length;
          this.assignedToOthersCount = this.assignedByMeList.length;
          
          // Update pagination based on actual data
          this.totalTasks = this.tasks.length;
          this.currentPageTasks = this.tasks.length;
          this.totalPages = Math.ceil(this.totalTasks / 10) || 1;
          
          // Convert ActiveTaskDto to Task format for display
          this.tasks = this.convertActiveTasksToTasks([...this.myTasksList, ...this.assignedByMeList]);
          
          // Sort tasks: RUNNING tasks first, then others
          this.tasks.sort((a, b) => {
            if (a.status === 'RUNNING' && b.status !== 'RUNNING') return -1;
            if (a.status !== 'RUNNING' && b.status === 'RUNNING') return 1;
            return 0;
          });
          
          // Find and set the active task - Priority: RUNNING > PAUSED > CLOSED > Any task > None
          const runningTask = this.tasks.find(t => t.status === 'RUNNING');
          if (runningTask) {
            this.activeTask = runningTask;
            this.hasActiveTask = true;
            console.log('Active RUNNING task found:', runningTask.title || runningTask.category);
            // Start the timer for the running task
            this.startActiveTaskTimer();
          } else {
            // No running task found, stop the timer interval
            if (this.activeTaskTimerInterval) {
              clearInterval(this.activeTaskTimerInterval);
              this.activeTaskTimerInterval = null;
            }
            
            const pausedTask = this.tasks.find(t => t.status === 'PAUSED');
            if (pausedTask) {
              this.activeTask = pausedTask;
              this.hasActiveTask = true;
              console.log('Active PAUSED task found:', pausedTask.title || pausedTask.category);
              
              // Initialize timer display with today's logged hours for paused task
              const taskData = [...this.myTasksList, ...this.assignedByMeList].find(t => t.taskId === pausedTask.id);
              if (taskData && taskData.todayLoggedHours) {
                this.activeTaskElapsedSeconds = Math.floor(taskData.todayLoggedHours * 60);
                this.updateActiveTaskTimerDisplay();
                console.log('Paused task timer initialized:', this.activeTaskTimer);
              }
            } else {
              const closedTask = this.tasks.find(t => t.status === 'CLOSED');
              if (closedTask) {
                this.activeTask = closedTask;
                this.hasActiveTask = true;
                console.log('Active CLOSED task found:', closedTask.title || closedTask.category);
                
                // Initialize timer display with today's logged hours for closed task
                const taskData = [...this.myTasksList, ...this.assignedByMeList].find(t => t.taskId === closedTask.id);
                if (taskData && taskData.todayLoggedHours) {
                  this.activeTaskElapsedSeconds = Math.floor(taskData.todayLoggedHours * 60);
                  this.updateActiveTaskTimerDisplay();
                  console.log('Closed task timer initialized:', this.activeTaskTimer);
                }
              } else if (this.tasks.length > 0) {
                this.activeTask = this.tasks[0];
                this.hasActiveTask = true;
                console.log('Showing first available task:', this.activeTask.title || this.activeTask.category);
                
                // Initialize timer display with today's logged hours
                const taskData = [...this.myTasksList, ...this.assignedByMeList].find(t => t.taskId === this.activeTask?.id);
                if (taskData && taskData.todayLoggedHours) {
                  this.activeTaskElapsedSeconds = Math.floor(taskData.todayLoggedHours * 60);
                  this.updateActiveTaskTimerDisplay();
                  console.log('First task timer initialized:', this.activeTaskTimer);
                }
              } else {
                this.activeTask = null;
                this.hasActiveTask = false;
                console.log('No tasks found in list');
              }
            }
          }
          
          console.log('Active tasks loaded:', 
            'My Tasks:', this.myTasksList.length, 
            'Assigned By Me:', this.assignedByMeList.length,
            'Break Status:', this.breakStatus,
            'Break Reason:', this.breakReason,
            'Break Id:', this.breakId,
            'Has Active Task:', this.hasActiveTask);
        } else if (response && response.data) {
          // Handle direct data response
          const data = response.data;
          
          // Update stats from API
          this.todayTotalHours = data.todayTotalHours || 0;
          this.lastPunchTime = data.lastPunchTime || '';
          
          // Format times for display
          this.punchedHours = this.formatMinutesToTime(this.todayTotalHours);
          this.runningTime = this.formatMinutesToTime(this.todayTotalHours);
          
          // Update break info from API
          this.breakStatus = data.breakStatus || 'NONE';
          this.breakReason = data.breakReason || null;
          this.breakRemarks = data.breakRemarks || '';
          this.breakId = data.breakId || null;
          
          // Set selected break type based on breakReason
          if (this.breakReason) {
            const reasonLower = this.breakReason.toLowerCase();
            if (reasonLower.includes('lunch')) {
              this.selectedBreakType = 'lunch';
            } else if (reasonLower.includes('coffee')) {
              this.selectedBreakType = 'coffee';
            } else if (reasonLower.includes('quick')) {
              this.selectedBreakType = 'quick';
            }
          }
          
          // Initialize break timer from API data
          this.initializeBreakTimerFromAPI(data.breakStart);
          
          // Update task lists from API
          this.myTasksList = data.myTasks || [];
          this.assignedByMeList = data.assignedByMe || [];
          
          // Update task counts
          this.myTasksCount = this.myTasksList.length;
          this.assignedToOthersCount = this.assignedByMeList.length;
          
          // Update pagination based on actual data
          this.totalTasks = this.tasks.length;
          this.currentPageTasks = this.tasks.length;
          this.totalPages = Math.ceil(this.totalTasks / 10) || 1;
          
          // Convert ActiveTaskDto to Task format for display
          this.tasks = this.convertActiveTasksToTasks([...this.myTasksList, ...this.assignedByMeList]);
          
          // Sort tasks: RUNNING tasks first, then others
          this.tasks.sort((a, b) => {
            if (a.status === 'RUNNING' && b.status !== 'RUNNING') return -1;
            if (a.status !== 'RUNNING' && b.status === 'RUNNING') return 1;
            return 0;
          });
          
          // Find and set the active task - Priority: RUNNING > PAUSED > CLOSED > Any task > None
          const runningTask = this.tasks.find(t => t.status === 'RUNNING');
          if (runningTask) {
            this.activeTask = runningTask;
            this.hasActiveTask = true;
            console.log('Active RUNNING task found:', runningTask.title || runningTask.category);
            // Start the timer for the running task
            this.startActiveTaskTimer();
          } else {
            // No running task found, stop the timer interval
            if (this.activeTaskTimerInterval) {
              clearInterval(this.activeTaskTimerInterval);
              this.activeTaskTimerInterval = null;
            }
            
            const pausedTask = this.tasks.find(t => t.status === 'PAUSED');
            if (pausedTask) {
              this.activeTask = pausedTask;
              this.hasActiveTask = true;
              console.log('Active PAUSED task found:', pausedTask.title || pausedTask.category);
              
              // Initialize timer display with today's logged hours for paused task
              const taskData = [...this.myTasksList, ...this.assignedByMeList].find(t => t.taskId === pausedTask.id);
              if (taskData && taskData.todayLoggedHours) {
                this.activeTaskElapsedSeconds = Math.floor(taskData.todayLoggedHours * 60);
                this.updateActiveTaskTimerDisplay();
                console.log('Paused task timer initialized:', this.activeTaskTimer);
              }
            } else {
              const closedTask = this.tasks.find(t => t.status === 'CLOSED');
              if (closedTask) {
                this.activeTask = closedTask;
                this.hasActiveTask = true;
                console.log('Active CLOSED task found:', closedTask.title || closedTask.category);
                
                // Initialize timer display with today's logged hours for closed task
                const taskData = [...this.myTasksList, ...this.assignedByMeList].find(t => t.taskId === closedTask.id);
                if (taskData && taskData.todayLoggedHours) {
                  this.activeTaskElapsedSeconds = Math.floor(taskData.todayLoggedHours * 60);
                  this.updateActiveTaskTimerDisplay();
                  console.log('Closed task timer initialized:', this.activeTaskTimer);
                }
              } else if (this.tasks.length > 0) {
                this.activeTask = this.tasks[0];
                this.hasActiveTask = true;
                console.log('Showing first available task:', this.activeTask.title || this.activeTask.category);
                
                // Initialize timer display with today's logged hours
                const taskData = [...this.myTasksList, ...this.assignedByMeList].find(t => t.taskId === this.activeTask?.id);
                if (taskData && taskData.todayLoggedHours) {
                  this.activeTaskElapsedSeconds = Math.floor(taskData.todayLoggedHours * 60);
                  this.updateActiveTaskTimerDisplay();
                  console.log('First task timer initialized:', this.activeTaskTimer);
                }
              } else {
                this.activeTask = null;
                this.hasActiveTask = false;
                console.log('No tasks found in list');
              }
            }
          }
          
          console.log('Active tasks loaded (direct response):', 
            'My Tasks:', this.myTasksList.length, 
            'Assigned By Me:', this.assignedByMeList.length,
            'Has Active Task:', this.hasActiveTask);
        }
      },
      error: (error: any) => {
        console.error('Error loading active tasks:', error);
        // Keep existing data if API fails
      }
    });
  }

  // Convert ActiveTaskDto to Task interface for display
  convertActiveTasksToTasks(activeTasks: ActiveTaskDto[]): Task[] {
    console.log('Converting active tasks to display format. Total tasks:', activeTasks.length);
    
    return activeTasks.map((task, index) => {
      // Use API status directly
      
      // Determine assignee name - use assignedByName (who created/assigned the task)
      const assigneeName = task.assignedByName || task.assigneeName || '';
      const assigneeId = task.assignedById || task.assigneeId || '';
      const assigneeImage = task.assignedByImageBase64 || task.assigneeImageBase64 || undefined;
      
      // Log first 3 tasks for debugging
      if (index < 3) {
        console.log(`Task ${index + 1}:`, {
          taskId: task.taskId,
          title: task.taskTitle,
          apiStatus: task.status,
          mappedstatus: task.status as any,
          category: task.taskCategory,
          assignedById: task.assignedById,
          assignedByName: task.assignedByName,
          assigneeId: task.assigneeId,
          assigneeName: task.assigneeName,
          finalAssignee: assigneeName
        });
      }
      
      return {
        id: task.taskId,
        title: task.taskTitle || '',
        description: task.description || '',
        status: task.status as any,
        category: task.taskCategory || 'General',
        loggedHours: this.formatMinutesToTime(task.todayLoggedHours),
        totalHours: this.formatMinutesToTime(task.totalLoggedHours),
        startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
        assignee: assigneeName || 'Unassigned',
        assigneeId: assigneeId,
        assigneeImage: assigneeImage,
        progress: task.progress || 0,
        isFavorite: false
      };
    });
  }

  // Map API status to Task status
  mapApiStatusToTaskStatus(apiStatus: string): 'NOT STARTED' | 'IN PROGRESS' | 'COMPLETED' | 'PENDING' | 'ON HOLD' {
    if (!apiStatus) {
      console.warn('Empty status received from API, defaulting to NOT STARTED');
      return 'NOT STARTED';
    }
    
    const normalizedStatus = apiStatus.toUpperCase().trim();
    
    const statusMap: { [key: string]: 'NOT STARTED' | 'IN PROGRESS' | 'COMPLETED' | 'PENDING' | 'ON HOLD' } = {
      'NOT STARTED': 'NOT STARTED',
      'NOTSTARTED': 'NOT STARTED',
      'NOT_STARTED': 'NOT STARTED',
      'IN PROGRESS': 'IN PROGRESS',
      'INPROGRESS': 'IN PROGRESS',
      'IN_PROGRESS': 'IN PROGRESS',
      'PROGRESS': 'IN PROGRESS',
      'RUNNING': 'IN PROGRESS',
      'STARTED': 'IN PROGRESS',
      'COMPLETED': 'COMPLETED',
      'COMPLETE': 'COMPLETED',
      'PENDING': 'PENDING',
      'PAUSED': 'PENDING',
      'PAUSE': 'PENDING',
      'ON HOLD': 'ON HOLD',
      'ONHOLD': 'ON HOLD',
      'ON_HOLD': 'ON HOLD',
      'HOLD': 'ON HOLD',
      'CLOSED': 'COMPLETED',
      'STOPPED': 'NOT STARTED',
      'STOP': 'NOT STARTED'
    };
    
    const mappedStatus = statusMap[normalizedStatus];
    
    if (!mappedStatus) {
      console.warn(`Unknown status received from API: "${apiStatus}", defaulting to NOT STARTED`);
      return 'NOT STARTED';
    }
    
    console.log(`Status mapping: "${apiStatus}" -> "${mappedStatus}"`);
    return mappedStatus;
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

  // Get employee name by ID for display
  getEmployeeName(employeeId: string): string {
    const emp = this.employeeMasterList.find(e => e.idValue === employeeId);
    return emp ? emp.description : employeeId;
  }

  // Multi-Select Assignee Methods
  toggleAssigneeSelection(employeeId: string): void {
    const index = this.newTask.assignees.indexOf(employeeId);
    if (index > -1) {
      // Remove if already selected
      this.newTask.assignees.splice(index, 1);
    } else {
      // Add if not selected
      this.newTask.assignees.push(employeeId);
    }
    console.log('Selected assignees:', this.newTask.assignees);
  }

  isAssigneeSelectedInMulti(employeeId: string): boolean {
    return this.newTask.assignees.includes(employeeId);
  }

  getSelectedAssigneesDisplay(): string {
    if (this.newTask.assignees.length === 0) {
      return 'Select assignees...';
    }
    if (this.newTask.assignees.length === 1) {
      const emp = this.employeeMasterList.find(e => e.idValue === this.newTask.assignees[0]);
      return emp ? emp.description : '1 selected';
    }
    return `${this.newTask.assignees.length} assignees selected`;
  }

  removeAssignee(employeeId: string): void {
    const index = this.newTask.assignees.indexOf(employeeId);
    if (index > -1) {
      this.newTask.assignees.splice(index, 1);
    }
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

  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  getFilteredTasks(): Task[] {
    // First filter by active tab
    let tasksToFilter: Task[] = [];
    
    if (this.activeTab === 'MY TASKS') {
      // Convert myTasksList to Task format
      tasksToFilter = this.convertActiveTasksToTasks(this.myTasksList);
    } else if (this.activeTab === 'ASSIGNED TO OTHERS') {
      // Convert assignedByMeList to Task format
      tasksToFilter = this.convertActiveTasksToTasks(this.assignedByMeList);
    } else {
      // Fallback to all tasks
      tasksToFilter = this.tasks;
    }
    
    // Apply search filter if search term exists
    if (this.searchTerm) {
      tasksToFilter = tasksToFilter.filter(task =>
        task.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        task.category.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
    
    // Sort tasks: RUNNING tasks first, then others
    tasksToFilter.sort((a, b) => {
      if (a.status === 'RUNNING' && b.status !== 'RUNNING') return -1;
      if (a.status !== 'RUNNING' && b.status === 'RUNNING') return 1;
      return 0;
    });
    
    return tasksToFilter;
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
      case 'RUNNING': return 'in-progress';
      case 'PAUSED': return 'pending';
      case 'CLOSED': return 'on-hold';
      case 'COMPLETED': return 'completed';
      case 'AUTO CLOSED': return 'auto-closed';
      default: return 'default';
    }
  }

  getProgressOffset(percentage: number): number {
    const circumference = 2 * Math.PI * 16; // radius is 16
    return circumference - (percentage / 100) * circumference;
  }
  
  // Get progress offset for top progress circle (radius 54)
  getTopProgressOffset(): number {
    const circumference = 2 * Math.PI * 54; // radius is 54
    return circumference - (this.taskProgress / 100) * circumference;
  }
  
  // Get stroke-dasharray for top progress circle
  getTopProgressDasharray(): number {
    return 2 * Math.PI * 54; // circumference = 2 * π * r
  }

  startTask(taskId: number) {
    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    if (!userId) {
      this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
      return;
    }
    
    // Prepare timer action request
    const timerRequest: any = {
      taskId: taskId,
      userId: userId,
      action: 'START'
    };
    
    console.log('Starting task with request:', timerRequest);
    
    // Call API to start timer
    this.api.executeTimer(timerRequest).subscribe({
      next: (response: any) => {
        console.log('Start task API response:', response);
        
        if (response && response.success) {
          console.log('Task started successfully');
          
          // Reset break tracker when starting a task
          this.resetBreakTracker();
          
          // Show success toaster
          this.toasterService.showSuccess('Task Started', 'Task timer has been started successfully!');
          
          // Reload active tasks to get latest updates
          this.loadActiveTasks();
        } else {
          console.error('Failed to start task:', response?.message);
          this.toasterService.showError('Start Failed', response?.message || 'Failed to start task. Please try again.');
        }
      },
      error: (error: any) => {
        console.error('Error starting task:', error);
        const errorMessage = error?.error?.message || error?.message || 'An error occurred while starting the task.';
        this.toasterService.showError('Error', errorMessage);
      }
    });
  }

  pauseTask(taskId: number) {
    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    if (!userId) {
      this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
      return;
    }
    
    // Pause the active task timer if this is the active task
    if (this.activeTask && this.activeTask.id === taskId) {
      this.pauseActiveTaskTimer();
    }
    
    // Prepare timer action request
    const timerRequest: any = {
      taskId: taskId,
      userId: userId,
      action: 'PAUSED'
    };
    
    console.log('Pausing task with request:', timerRequest);
    
    // Call API to pause timer
    this.api.executeTimer(timerRequest).subscribe({
      next: (response: any) => {
        console.log('Pause task API response:', response);
        
        if (response && response.success) {
          console.log('Task paused successfully');
          
          // Show success toaster
          this.toasterService.showSuccess('Task Paused', 'Task timer has been paused successfully!');
          
          // Reload active tasks to get latest updates
          this.loadActiveTasks();
        } else {
          console.error('Failed to pause task:', response?.message);
          this.toasterService.showError('Pause Failed', response?.message || 'Failed to pause task. Please try again.');
        }
      },
      error: (error: any) => {
        console.error('Error pausing task:', error);
        const errorMessage = error?.error?.message || error?.message || 'An error occurred while pausing the task.';
        this.toasterService.showError('Error', errorMessage);
      }
    });
  }

  stopTask(taskId: number) {
    // Find the task from the listing
    const taskToStop = [...this.myTasksList, ...this.assignedByMeList].find(t => t.taskId === taskId);
    
    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    if (!userId) {
      this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
      return;
    }
    
    // Prepare timer action request
    const timerRequest: any = {
      taskId: taskId,
      userId: userId,
      action: 'STOP'
    };
    
    console.log('Stopping task with request:', timerRequest);
    
    // Call API to stop timer
    this.api.executeTimer(timerRequest).subscribe({
      next: (response: any) => {
        console.log('Stop task API response:', response);
        
        if (response && response.success) {
          console.log('Task stopped successfully');
          
          // Show success toaster
          this.toasterService.showSuccess('Task Stopped', 'Task timer has been stopped successfully!');
          
          // Open the task details modal with status set to CLOSED
          this.openTaskDetailsModalWithClosedStatus(taskToStop || { id: taskId, category: '', title: '' });
          
          // Reload active tasks to get latest updates
          this.loadActiveTasks();
        } else {
          console.error('Failed to stop task:', response?.message);
          this.toasterService.showError('Stop Failed', response?.message || 'Failed to stop task. Please try again.');
        }
      },
      error: (error: any) => {
        console.error('Error stopping task:', error);
        const errorMessage = error?.error?.message || error?.message || 'An error occurred while stopping the task.';
        this.toasterService.showError('Error', errorMessage);
      }
    });
  }

  // Helper method to open task details modal with CLOSED status
  private openTaskDetailsModalWithClosedStatus(task: any) {
    // Create a task object compatible with openTaskDetailsModal
    const taskObj: Task = {
      id: task.id || task.taskId,
      title: task.title || task.taskTitle || '',
      description: task.description || task.taskDescription || '',
      status: 'CLOSED',
      category: task.category || task.taskCategory || '',
      categoryId: task.categoryId,
      loggedHours: task.todayLoggedHours ? this.formatMinutesToTime(task.todayLoggedHours * 60) : '00:00:00',
      totalHours: task.totalTimeHours ? this.formatMinutesToTime(task.totalTimeHours * 60) : '00:00:00',
      startDate: task.startDate || '',
      assignee: task.assignee || '',
      assigneeImage: task.assigneeImage,
      progress: task.progress || 0,
      priority: task.priority as 'HIGH' | 'MEDIUM' | 'LOW'
    };
    
    // Open the modal
    this.selectedTask = taskObj;
    this.selectedTaskStatus = 'closed';
    this.selectedTaskDetailStatus = 'not-closed';
    this.showTaskDetailsModal = true;
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'relative';
    document.body.style.zIndex = '1';
    
    // Get category ID
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    let categoryId = task.categoryId || this.getCategoryIdFromTask(taskObj);
    
    // Load task details from API
    this.api.getTaskById(taskObj.id, userId, categoryId || 0).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          const taskDetails = response.data;
          
          // Bind all values from API response
          this.selectedTaskId = taskDetails.taskId?.toString() || taskObj.id?.toString() || '';
          this.selectedTaskCategory = taskDetails.categoryName || taskObj.category;
          this.editableTaskTitle = taskDetails.taskTitle || taskObj.title;
          this.editableTaskDescription = taskDetails.taskDescription || taskObj.description || '';
          this.selectedTaskProgress = taskDetails.progressPercentage || taskDetails.progress || 0;
          this.taskProgress = this.selectedTaskProgress;
          
          // Format timers
          this.selectedTaskRunningTimer = this.formatMinutesToTime(taskDetails.todayTotalMinutes || 0);
          this.selectedTaskTotalHours = this.formatMinutesToTime(taskDetails.totalTimeMinutes || 0);
          
          // Set status to CLOSED
          this.selectedTaskDetailStatus = 'not-closed';
          this.dailyRemarks = taskDetails.dailyRemarks || '';
          
          // Bind Project Metadata fields
          this.selectedProjectId = taskDetails.projectId ? taskDetails.projectId.toString() : '';
          this.selectedTaskStartDate = taskDetails.startDate ? this.formatDateForInput(taskDetails.startDate) : '';
          this.selectedTaskEndDate = taskDetails.targetDate ? this.formatDateForInput(taskDetails.targetDate) : '';
          this.selectedTaskEstimatedHours = taskDetails.estimtedHours || taskDetails.estimatedHours || 0;
          
          // Update selected task object
          if (this.selectedTask) {
            this.selectedTask.progress = this.selectedTaskProgress;
            this.selectedTask.status = 'CLOSED';
          }
          
          // Load task files and comments
          this.loadTaskFiles(taskObj.id);
          this.loadComments(taskObj.id);
        }
      },
      error: (error: any) => {
        console.error('Error fetching task details:', error);
        // Set basic values
        this.selectedTaskId = taskObj.id?.toString() || '';
        this.selectedTaskCategory = taskObj.category;
        this.editableTaskTitle = taskObj.title;
        this.editableTaskDescription = taskObj.description || '';
        this.selectedTaskProgress = taskObj.progress || 0;
        this.taskProgress = this.selectedTaskProgress;
        this.selectedTaskRunningTimer = taskObj.loggedHours;
        this.selectedTaskTotalHours = taskObj.totalHours;
        this.selectedTaskDetailStatus = 'not-closed';
      }
    });
  }

  deleteTask(taskId: number) {
    // Show SweetAlert confirmation dialog
    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to delete this task? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280'
    }).then((result) => {
      if (result.isConfirmed) {
        // Get current user
        const currentUser = this.sessionService.getCurrentUser();
        const userId = currentUser?.empId || currentUser?.employeeId || '';
        
        if (!userId) {
          this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
          return;
        }
        
        // Prepare delete request
        const deleteRequest: any = {
          taskId: taskId,
          userId: userId
        };
        
        console.log('Deleting task with request:', deleteRequest);
        
        // Call API to delete task
        this.api.deleteTask(deleteRequest).subscribe({
          next: (response: any) => {
            console.log('Delete task API response:', response);
            
            if (response && response.success) {
              console.log('Task deleted successfully');
              
              // Show success toaster
              this.toasterService.showSuccess('Task Deleted', 'Task has been deleted successfully!');
              
              // Reload active tasks to refresh the list
              this.loadActiveTasks();
            } else {
              console.error('Failed to delete task:', response?.message);
              this.toasterService.showError('Delete Failed', response?.message || 'Failed to delete task. Please try again.');
            }
          },
          error: (error: any) => {
            console.error('Error deleting task:', error);
            const errorMessage = error?.error?.message || error?.message || 'An error occurred while deleting the task.';
            this.toasterService.showError('Error', errorMessage);
          }
        });
      }
    });
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
    
    // Load task categories when modal opens
    this.loadTaskCategories();
    
    // Clear search term
    this.selectTaskSearchTerm = '';
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

  // Start the live timer for active task
  private startActiveTaskTimer() {
    // Safety check: Stop break timer if it's running
    if (this.breakTimerInterval) {
      clearInterval(this.breakTimerInterval);
      this.breakTimerInterval = null;
      console.log('Break timer stopped because task timer is starting');
    }
    
    // Clear any existing task timer
    if (this.activeTaskTimerInterval) {
      clearInterval(this.activeTaskTimerInterval);
      this.activeTaskTimerInterval = null;
    }

    // Get the current logged time from the active task
    if (this.activeTask) {
      const taskData = [...this.myTasksList, ...this.assignedByMeList].find(t => t.taskId === this.activeTask?.id);
      if (taskData && taskData.todayLoggedHours) {
        // Convert minutes to seconds
        this.activeTaskElapsedSeconds = Math.floor(taskData.todayLoggedHours * 60);
      } else {
        this.activeTaskElapsedSeconds = 0;
      }
    }

    // Set start time
    this.activeTaskStartTime = new Date();

    // Start the interval timer
    this.activeTaskTimerInterval = setInterval(() => {
      this.activeTaskElapsedSeconds++;
      this.updateActiveTaskTimerDisplay();
    }, 1000);

    console.log('Active task timer started');
  }

  // Pause the live timer for active task
  private pauseActiveTaskTimer() {
    if (this.activeTaskTimerInterval) {
      clearInterval(this.activeTaskTimerInterval);
      this.activeTaskTimerInterval = null;
    }
    
    // When pausing, update the display with current elapsed time from task data
    if (this.activeTask) {
      const taskData = [...this.myTasksList, ...this.assignedByMeList].find(t => t.taskId === this.activeTask?.id);
      if (taskData && taskData.todayLoggedHours) {
        // Convert minutes to seconds
        this.activeTaskElapsedSeconds = Math.floor(taskData.todayLoggedHours * 60);
        // Update the display to show the paused time
        this.updateActiveTaskTimerDisplay();
      }
    }
    
    console.log('Active task timer paused, showing elapsed time:', this.activeTaskTimer);
  }

  // Stop and reset the live timer for active task
  private stopActiveTaskTimer() {
    if (this.activeTaskTimerInterval) {
      clearInterval(this.activeTaskTimerInterval);
      this.activeTaskTimerInterval = null;
    }
    this.activeTaskElapsedSeconds = 0;
    this.activeTaskStartTime = null;
    this.updateActiveTaskTimerDisplay();
    console.log('Active task timer stopped');
  }

  // Update the timer display
  private updateActiveTaskTimerDisplay() {
    const hours = Math.floor(this.activeTaskElapsedSeconds / 3600);
    const minutes = Math.floor((this.activeTaskElapsedSeconds % 3600) / 60);
    const seconds = this.activeTaskElapsedSeconds % 60;

    this.activeTaskTimer =
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Trigger change detection to update the view
    this.cdr.detectChanges();
  }

  private startBreakTimer() {
    // In a real application, you would start a break timer here
    // For now, we'll just update the status
    this.breakTimerDisplay = '00:00:00';
    this.breakTimerCaption = 'Break started';
  }

  private endBreakTimer() {
    // Reset break countdown
    this.breakTimerDisplay = '00:00:00';
    this.breakTimerCaption = 'Break ended';
  }

  // Break Tracker Methods
  selectBreakType(type: 'lunch' | 'coffee' | 'quick') {
    this.selectedBreakType = type;
    if (!this.isBreakRunning) {
      this.updateBreakCaption();
    }
  }

  // Helper method to get break reason from selected break type
  private getBreakReasonFromType(): string {
    if (!this.selectedBreakType) {
      return '';
    }
    
    const breakReasons: { [key: string]: string } = {
      lunch: 'Lunch Break',
      coffee: 'Coffee Break',
      quick: 'Quick Break'
    };
    
    return breakReasons[this.selectedBreakType] || '';
  }

  startBreak() {
    if (!this.selectedBreakType) return;

    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    if (!userId) {
      this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
      return;
    }

    // Pause the active task timer when break starts
    if (this.activeTask && this.activeTask.status === 'RUNNING') {
      this.pauseActiveTaskTimer();
    }

    // Map break type to reason
    const breakReasons = {
      lunch: 'Lunch Break',
      coffee: 'Coffee Break',
      quick: 'Quick Break'
    };
    const reason = breakReasons[this.selectedBreakType];

    // Prepare break request
    const breakRequest: any = {
      userId: userId,
      action: 'START',
      reason: reason,
      remarks: this.breakRemarks || ''
    };

    console.log('Starting break with request:', breakRequest);

    // Call API to start break
    this.api.userBreak(breakRequest).subscribe({
      next: (response: any) => {
        console.log('Start break API response:', response);
        
        if (response && response.success) {
          console.log('Break started successfully');
          
          // Update local state
          this.isBreakRunning = true;
          this.isBreakPaused = false;
          this.breakStartTime = new Date();
          this.breakElapsedSeconds = 0;
          this.breakId = response.data?.breakId || null;
          this.breakReason = reason;
          this.updateBreakCaption();

          // Start local timer for display
          this.breakTimerInterval = setInterval(() => {
            if (!this.isBreakPaused) {
              this.breakElapsedSeconds++;
              this.updateBreakTimerDisplay();
            }
          }, 1000);
          
          // Show success toaster
          this.toasterService.showSuccess('Break Started', `${reason} has been started successfully!`);
          
          // Reload active tasks to update status
          this.loadActiveTasks();
        } else {
          console.error('Failed to start break:', response?.message);
          this.toasterService.showError('Start Failed', response?.message || 'Failed to start break. Please try again.');
        }
      },
      error: (error: any) => {
        console.error('Error starting break:', error);
        const errorMessage = error?.error?.message || error?.message || 'An error occurred while starting the break.';
        this.toasterService.showError('Error', errorMessage);
      }
    });
  }

  pauseBreak() {
    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    if (!userId) {
      this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
      return;
    }

    // Prepare break request with remarks and reason
    const breakRequest: any = {
      userId: userId,
      action: 'PAUSED',
      remarks: this.breakRemarks || '',
      reason: this.getBreakReasonFromType()
    };

    console.log('Pausing break with request:', breakRequest);

    // Call API to pause break
    this.api.userBreak(breakRequest).subscribe({
      next: (response: any) => {
        console.log('Pause break API response:', response);
        
        if (response && response.success) {
          console.log('Break paused successfully');
          
          // Update local state
          this.isBreakPaused = true;
          this.updateBreakCaption();
          
          // Show success toaster
          this.toasterService.showSuccess('Break Paused', 'Break has been paused successfully!');
          
          // Reload active tasks
          this.loadActiveTasks();
        } else {
          console.error('Failed to pause break:', response?.message);
          this.toasterService.showError('Pause Failed', response?.message || 'Failed to pause break. Please try again.');
        }
      },
      error: (error: any) => {
        console.error('Error pausing break:', error);
        const errorMessage = error?.error?.message || error?.message || 'An error occurred while pausing the break.';
        this.toasterService.showError('Error', errorMessage);
      }
    });
  }

  resumeBreak() {
    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    if (!userId) {
      this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
      return;
    }

    // Prepare break request with remarks and reason
    const breakRequest: any = {
      userId: userId,
      action: 'RESUME',
      remarks: this.breakRemarks || '',
      reason: this.getBreakReasonFromType()
    };

    console.log('Resuming break with request:', breakRequest);

    // Call API to resume break
    this.api.userBreak(breakRequest).subscribe({
      next: (response: any) => {
        console.log('Resume break API response:', response);
        
        if (response && response.success) {
          console.log('Break resumed successfully');
          
          // Update local state
          this.isBreakPaused = false;
          this.updateBreakCaption();
          
          // Show success toaster
          this.toasterService.showSuccess('Break Resumed', 'Break has been resumed successfully!');
          
          // Reload active tasks
          this.loadActiveTasks();
        } else {
          console.error('Failed to resume break:', response?.message);
          this.toasterService.showError('Resume Failed', response?.message || 'Failed to resume break. Please try again.');
        }
      },
      error: (error: any) => {
        console.error('Error resuming break:', error);
        const errorMessage = error?.error?.message || error?.message || 'An error occurred while resuming the break.';
        this.toasterService.showError('Error', errorMessage);
      }
    });
  }

  stopBreak() {
    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    if (!userId) {
      this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
      return;
    }

    // Prepare break request with remarks and reason
    const breakRequest: any = {
      userId: userId,
      action: 'STOP',
      remarks: this.breakRemarks || '',
      reason: this.getBreakReasonFromType()
    };

    console.log('Stopping break with request:', breakRequest);

    // Call API to stop break
    this.api.userBreak(breakRequest).subscribe({
      next: (response: any) => {
        console.log('Stop break API response:', response);
        
        if (response && response.success) {
          console.log('Break stopped successfully');
          
          // Clear timer
          if (this.breakTimerInterval) {
            clearInterval(this.breakTimerInterval);
            this.breakTimerInterval = null;
          }

          // Reset all break state
          this.isBreakRunning = false;
          this.isBreakPaused = false;
          this.breakElapsedSeconds = 0;
          this.breakTimerDisplay = '00:00:00';
          this.breakRemarks = '';
          this.selectedBreakType = null;
          this.breakId = null;
          this.breakReason = null;
          this.updateBreakCaption();
          
          // Show success toaster
          this.toasterService.showSuccess('Break Ended', 'Break has been ended successfully!');
          
          // Reload active tasks
          this.loadActiveTasks();
        } else {
          console.error('Failed to stop break:', response?.message);
          this.toasterService.showError('Stop Failed', response?.message || 'Failed to stop break. Please try again.');
        }
      },
      error: (error: any) => {
        console.error('Error stopping break:', error);
        const errorMessage = error?.error?.message || error?.message || 'An error occurred while stopping the break.';
        this.toasterService.showError('Error', errorMessage);
      }
    });
  }

  // Helper method to reset break tracker state
  private resetBreakTracker() {
    console.log('Resetting break tracker');
    
    // Clear timer interval if running
    if (this.breakTimerInterval) {
      clearInterval(this.breakTimerInterval);
      this.breakTimerInterval = null;
    }

    // Reset all break state variables
    this.isBreakRunning = false;
    this.isBreakPaused = false;
    this.breakElapsedSeconds = 0;
    this.breakTimerDisplay = '00:00:00';
    this.breakRemarks = '';
    this.selectedBreakType = null;
    this.breakId = null;
    this.breakReason = null;
    this.breakStartTime = null;
    this.isOnBreak = false;
    this.breakStatus = 'NONE';
    
    // Update caption to default
    this.updateBreakCaption();
  }

  // Helper method to initialize break timer from API data
  private initializeBreakTimerFromAPI(breakStart: string | Date) {
    console.log('=== Initializing break timer from API ===');
    console.log('Break status:', this.breakStatus);
    console.log('Break start:', breakStart);
    
    // Check for both 'RUNNING' and 'OPEN' status
    if ((this.breakStatus === 'RUNNING' || this.breakStatus === 'OPEN') && breakStart) {
      console.log('>>> Starting RUNNING/OPEN break timer');
      // Calculate elapsed time from breakStart
      const breakStartTime = new Date(breakStart);
      const now = new Date();
      const elapsedMilliseconds = now.getTime() - breakStartTime.getTime();
      const elapsedSeconds = Math.max(0, Math.floor(elapsedMilliseconds / 1000)); // Ensure never negative
      
      console.log('Calculated elapsed seconds:', elapsedSeconds, 'from', breakStartTime, 'to', now);
      
      // Set break state
      this.isBreakRunning = true;
      this.isBreakPaused = false;
      this.breakStartTime = breakStartTime;
      this.breakElapsedSeconds = elapsedSeconds;
      
      // Update display
      this.updateBreakTimerDisplay();
      this.updateBreakCaption();
      
      console.log('Break state set:', {
        isBreakRunning: this.isBreakRunning,
        breakTimerDisplay: this.breakTimerDisplay
      });
      
      // Start the timer interval if not already running
      if (!this.breakTimerInterval) {
        this.breakTimerInterval = setInterval(() => {
          if (!this.isBreakPaused) {
            this.breakElapsedSeconds++;
            this.updateBreakTimerDisplay();
          }
        }, 1000);
        console.log('Break timer interval started');
      }
    } else if (this.breakStatus === 'PAUSED' && breakStart) {
      console.log('>>> Starting PAUSED break timer');
      // Break is paused
      const breakStartTime = new Date(breakStart);
      const now = new Date();
      const elapsedMilliseconds = now.getTime() - breakStartTime.getTime();
      const elapsedSeconds = Math.max(0, Math.floor(elapsedMilliseconds / 1000)); // Ensure never negative
      
      this.isBreakRunning = true;
      this.isBreakPaused = true;
      this.breakStartTime = breakStartTime;
      this.breakElapsedSeconds = elapsedSeconds;
      
      // Update display
      this.updateBreakTimerDisplay();
      this.updateBreakCaption();
      
      // Stop the timer interval
      if (this.breakTimerInterval) {
        clearInterval(this.breakTimerInterval);
        this.breakTimerInterval = null;
      }
    } else {
      console.log('>>> No active break, resetting');
      // No active break - reset break tracker
      if (this.breakStatus === 'NONE') {
        this.isBreakRunning = false;
        this.isBreakPaused = false;
        this.breakElapsedSeconds = 0;
        this.breakTimerDisplay = '00:00:00';
        this.selectedBreakType = null;
        
        // Stop timer if running
        if (this.breakTimerInterval) {
          clearInterval(this.breakTimerInterval);
          this.breakTimerInterval = null;
        }
        
        this.updateBreakCaption();
      }
    }
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
    this.favouriteList.forEach(cat => cat.isEditing = false);
    this.departmentList.forEach(cat => cat.isEditing = false);
    this.allDepartmentList.forEach(cat => cat.isEditing = false);
    
    // Close add form if open
    this.isAddingNewCategory = false;
    
    // Enable editing for this category
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

  // Get filtered favorite task categories based on search
  getFilteredFavouriteTaskList(): TaskCategory[] {
    if (!this.selectTaskSearchTerm || this.selectTaskSearchTerm.trim() === '') {
      return this.favouriteList;
    }
    
    const searchLower = this.selectTaskSearchTerm.toLowerCase().trim();
    return this.favouriteList.filter(task => 
      task.categoryName.toLowerCase().includes(searchLower) ||
      task.departmentName?.toLowerCase().includes(searchLower)
    );
  }

  // Get department task categories
  getDepartmentTaskList(): TaskCategory[] {
    return this.departmentList;
  }

  // Get filtered department task categories based on search
  getFilteredDepartmentTaskList(): TaskCategory[] {
    if (!this.selectTaskSearchTerm || this.selectTaskSearchTerm.trim() === '') {
      return this.departmentList;
    }
    
    const searchLower = this.selectTaskSearchTerm.toLowerCase().trim();
    return this.departmentList.filter(task => 
      task.categoryName.toLowerCase().includes(searchLower) ||
      task.departmentName?.toLowerCase().includes(searchLower)
    );
  }

  // Get all department task categories
  getAllDepartmentTaskList(): TaskCategory[] {
    return this.allDepartmentList;
  }

  // Get filtered all department task categories based on search
  getFilteredAllDepartmentTaskList(): TaskCategory[] {
    if (!this.selectTaskSearchTerm || this.selectTaskSearchTerm.trim() === '') {
      return this.allDepartmentList;
    }
    
    const searchLower = this.selectTaskSearchTerm.toLowerCase().trim();
    return this.allDepartmentList.filter(task => 
      task.categoryName.toLowerCase().includes(searchLower) ||
      task.departmentName?.toLowerCase().includes(searchLower)
    );
  }

  // Toggle favourite status of a task category
  toggleFavourite(category: TaskCategory, event: Event): void {
    event.stopPropagation(); // Prevent task selection when clicking star
    
    // Get current user
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const userId = currentUser.empId || currentUser.employeeId || '1';
    
    // Determine new favourite status (toggle)
    const newFavouriteStatus: 'Y' | 'N' = category.isFavourite === 'Y' ? 'N' : 'Y';
    
    // Prepare API request
    const request: any = {
      userId: userId,
      categoryId: category.categoryId,
      isFavourite: newFavouriteStatus
    };
    
    console.log('Toggling favourite:', {
      categoryName: category.categoryName,
      currentStatus: category.isFavourite,
      newStatus: newFavouriteStatus
    });
    
    // Call API to toggle favourite
    this.api.toggleFavouriteCategory(request).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          console.log('Favourite toggled successfully:', response);
          
          // Check if the message indicates it's already in favourites (even with success: true)
          const message = response?.message || '';
          if (message.toLowerCase().includes('already') && message.toLowerCase().includes('favourite')) {
            this.toasterService.showWarning('Already Added', `${category.categoryName} is already in your favourites!`);
          } else {
            // Show success toaster based on action
            if (newFavouriteStatus === 'Y') {
              this.toasterService.showSuccess('Success', `${category.categoryName} added to favourites!`);
            } else {
              this.toasterService.showSuccess('Success', `${category.categoryName} removed from favourites!`);
            }
          }
          
          // Reload task categories to update all lists
          this.loadTaskCategories();
        } else {
          console.error('Failed to toggle favourite:', response?.message);
          
          // Check if the message indicates it's already in favourites
          const message = response?.message || '';
          if (message.toLowerCase().includes('already') && message.toLowerCase().includes('favourite')) {
            this.toasterService.showWarning('Already Added', `${category.categoryName} is already in your favourites!`);
          } else {
            this.toasterService.showError('Error', 'Failed to update favourite status: ' + (message || 'Unknown error'));
          }
        }
      },
      error: (error: any) => {
        console.error('Error toggling favourite:', error);
        
        // Check if error response contains "already in favourites" message
        const errorMessage = error?.error?.message || error?.message || '';
        if (errorMessage.toLowerCase().includes('already') && errorMessage.toLowerCase().includes('favourite')) {
          this.toasterService.showWarning('Already Added', `${category.categoryName} is already in your favourites!`);
        } else {
          this.toasterService.showError('Error', 'Error updating favourite status. Please try again.');
        }
      }
    });
  }

  // Check if a category is favourited
  isFavourited(category: TaskCategory): boolean {
    return category.isFavourite === 'Y';
  }

  // Select a task category - opens task details modal
  selectTask(category: TaskCategory): void {
    this.newTaskCategory = category;
    this.selectedCategoryId = category.categoryId;
    console.log('Selected task category:', category);
    
    // Get current user from session
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    if (!userId) {
      this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
      return;
    }
    
    // Check if there's an existing task for this category in myTasksList
    // Match by taskCategory name since ActiveTaskDto doesn't have categoryId
    const existingTask = this.myTasksList.find(t => t.taskCategory === category.categoryName);
    
    if (existingTask) {
      // Open task details modal for existing task
      console.log('Found existing task for category, opening modal with taskId:', existingTask.taskId);
      
      // Set properties for standalone modal component
      this.selectedTaskIdForModal = existingTask.taskId;
      this.selectedUserIdForModal = userId;
      this.selectedCategoryIdForModal = category.categoryId;
    } else {
      // No existing task - pass taskId as 0 to indicate new task
      console.log('No existing task found, opening modal for new task with categoryId:', category.categoryId);
      
      // Set properties for standalone modal component
      this.selectedTaskIdForModal = 0; // 0 indicates new task
      this.selectedUserIdForModal = userId;
      this.selectedCategoryIdForModal = category.categoryId;
    }
    
    // Hide the Select Task modal
    this.showSelectTaskModal = false;
    
    // Show the task details modal
    this.showTaskDetailsModal = true;
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  // Add task to My Tasks list
  addTaskToMyList(category: TaskCategory): void {
    console.log('Adding task to My Tasks:', category.categoryName);
    
    // Get current user from session
    const currentUser = this.sessionService.getCurrentUser();
    const createdBy = currentUser?.empId || currentUser?.id || currentUser?.employeeId || '';
    
    if (!createdBy) {
      this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
      return;
    }
    
    // Create the task save request payload
    const taskSaveRequest: TaskSaveDto = {
      taskId: 0, // New task
      categoryId: category.categoryId,
      taskTitle: '',
      description: '', // Empty description for new task from category
      projectId: 0, // Default project
      departmentId: category.departmentId || 0,
      targetDate: undefined,
      startDate: undefined, // No start date, will be set when user starts the task
      progress: 0, // Not started
      status: 'NOT STARTED', // Initial status
      createdBy: createdBy,
      assignees: [createdBy], // Assign to self by default
      customFields: [], // Empty custom fields
      estimatedHours: 0
    };
    
    // Call the API to save the task
    this.api.saveTaskBulk(taskSaveRequest).subscribe({
      next: (response: any) => {
        console.log('Task saved successfully:', response);
        
        // Show success toaster message at top right
        this.toasterService.showSuccess(
          'Task Added',
          `"${category.categoryName}" has been successfully added to your tasks!`
        );
        
        // Add the new task to the My Tasks list
        // If the API returns the created task, use that; otherwise create a local task
        const newTask: Task = {
          id: response?.taskId || Date.now(),
          title: '',
          description: '',
          status: 'NOT STARTED',
          category: category.categoryName,
          loggedHours: '0.0h',
          totalHours: '0.0h',
          startDate: '', // Empty start date
          assignee: currentUser?.employeeName || currentUser?.name || 'Myself',
          progress: 0,
          isFavorite: false
        };
        
        // Add to the beginning of the tasks array
        this.tasks.unshift(newTask);
        
        // Update task counts
        this.myTasksCount = this.tasks.filter(t => t.status !== 'COMPLETED').length;
        
        // Refresh the task list
        this.tasks = [...this.tasks];
        
        console.log('Task added to My Tasks list:', newTask);
        
        // NOTE: Modal stays open to allow adding more tasks
      },
      error: (error: any) => {
        console.error('Error saving task:', error);
        this.toasterService.showError(
          'Error',
          'Failed to add task. Please try again.'
        );
      }
    });
  }

  openTaskDetailsModal(task: Task) {
    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    // Get category ID from the task directly or from lookup
    let categoryId = task.categoryId || this.getCategoryIdFromTask(task);
    
    console.log('Opening task details modal:', {
      taskId: task.id,
      userId: userId,
      categoryId: categoryId
    });
    
    // Set properties for standalone modal component
    this.selectedTaskIdForModal = task.id;
    this.selectedUserIdForModal = userId;
    this.selectedCategoryIdForModal = categoryId || 0;
    
    // Show the modal
    this.showTaskDetailsModal = true;
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }
  
  // Helper method to get category ID from task
  private getCategoryIdFromTask(task: Task): number {
    // Try to find the category ID from the task categories list
    const category = this.allDepartmentList.find(cat => cat.categoryName === task.category);
    if (category) {
      return category.categoryId;
    }
    
    // Try from favourites list
    const favCategory = this.favouriteList.find(cat => cat.categoryName === task.category);
    if (favCategory) {
      return favCategory.categoryId;
    }
    
    // Try from department list
    const deptCategory = this.departmentList.find(cat => cat.categoryName === task.category);
    if (deptCategory) {
      return deptCategory.categoryId;
    }
    
    // Try to find from myTasksList or assignedByMeList
    const taskData = [...this.myTasksList, ...this.assignedByMeList].find(t => t.taskId === task.id);
    if (taskData && taskData.taskCategory) {
      // Find category ID by category name
      const cat = this.allDepartmentList.find(c => c.categoryName === taskData.taskCategory);
      if (cat) return cat.categoryId;
    }
    
    console.warn('Could not find category ID for task:', task.category);
    return 0;
  }
  
  // Helper method to map UI status values to backend status values
  private mapUIStatusToBackendStatus(uiStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'pause': 'PAUSED',
      'running': 'RUNNING',
      'not-started': 'NOT STARTED',
      'not-closed': 'NOT CLOSED',
      'completed': 'COMPLETED',
      'closed': 'CLOSED'
    };
    
    const normalizedStatus = uiStatus?.toLowerCase().trim() || 'not-started';
    const mappedStatus = statusMap[normalizedStatus];
    
    if (mappedStatus) {
      console.log(`Status mapping: UI "${uiStatus}" -> Backend "${mappedStatus}"`);
      return mappedStatus;
    }
    
    // If no mapping found, uppercase the status
    console.warn(`No status mapping found for "${uiStatus}", using uppercase`);
    return uiStatus?.toUpperCase() || 'NOT STARTED';
  }
  
  // Helper method to bind data from task list when API fails
  private bindTaskListData(task: Task) {
    this.selectedTaskId = task.id?.toString() || '';
    this.selectedTaskCategory = task.category;
    this.editableTaskTitle = task.title;
    this.editableTaskDescription = task.description || '';
    this.selectedTaskProgress = task.progress || 0;
    this.taskProgress = this.selectedTaskProgress;
    this.selectedTaskRunningTimer = task.loggedHours;
    this.selectedTaskTotalHours = task.totalHours;
    
    // Bind metadata fields from task object
    this.selectedTaskStartDate = task.startDate || '';
    this.selectedTaskEndDate = ''; // Not available in task list
    this.selectedProjectId = ''; // Not available in task list
    this.selectedTaskEstimatedHours = 0; // Not available in task list
    
    console.log('Fallback: Bound task data from task list');
  }

  closeTaskDetailsModal() {
    this.showTaskDetailsModal = false;
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }
  
  // Handle task updated event from modal
  onTaskUpdatedFromModal(taskData: any) {
    console.log('Task updated from modal:', taskData);
    // Reload active tasks to refresh the list
    this.loadActiveTasks();
  }
  
  // Handle task paused event from modal
  onTaskPausedFromModal(taskId: number) {
    console.log('Task paused from modal:', taskId);
    // Reload active tasks to refresh the listing
    this.loadActiveTasks();
  }
  
  // Handle task resumed event from modal
  onTaskResumedFromModal(taskId: number) {
    console.log('Task resumed from modal:', taskId);
    // Reload active tasks to refresh the listing
    this.loadActiveTasks();
  }
  
  // Handle task stopped event from modal
  onTaskStoppedFromModal(taskId: number) {
    console.log('Task stopped from modal:', taskId);
    // Reload active tasks to refresh the listing
    this.loadActiveTasks();
    // Keep modal open - don't close it
  }

  // Save task changes method
  saveTaskChanges() {
    if (!this.selectedTask) {
      this.toasterService.showError('Error', 'No task selected');
      return;
    }
    
    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    if (!userId) {
      this.toasterService.showError('Error', 'Unable to identify current user');
      return;
    }
    
    // Validate required fields
    if (!this.editableTaskTitle || this.editableTaskTitle.trim() === '') {
      this.toasterService.showError('Validation Error', 'Task title is required');
      return;
    }
    
    // Get category ID
    const categoryId = this.selectedTask.categoryId || this.getCategoryIdFromTask(this.selectedTask) || 0;
    
    // Convert estimated hours to number
    const estimatedHoursValue = parseFloat(this.selectedTaskEstimatedHours?.toString() || '0') || 0;
    
    console.log('Estimated Hours Debug:', {
      raw: this.selectedTaskEstimatedHours,
      type: typeof this.selectedTaskEstimatedHours,
      converted: estimatedHoursValue
    });
    
    // Build the save request with all fields from the modal
    const saveRequest: TaskSaveDto = {
      taskId: parseInt(this.selectedTaskId) || this.selectedTask.id,
      categoryId: categoryId,
      taskTitle: this.editableTaskTitle.trim(),
      description: this.editableTaskDescription?.trim() || '',
      projectId: parseInt(this.selectedProjectId) || 0,
      departmentId: 0, // Will be derived from category on backend
      targetDate: this.selectedTaskEndDate || undefined,
      startDate: this.selectedTaskStartDate || undefined,
      progress: this.taskProgress,
      estimatedHours: estimatedHoursValue,
      status: this.mapUIStatusToBackendStatus(this.selectedTaskDetailStatus),
      createdBy: userId,
      assignees: [this.selectedTask.assigneeId || userId],
      customFields: this.selectedCustomFields.map(field => {
        let fieldValue = field.value?.toString() || '';
        
        // For dropdown fields, ensure we're sending the selected value
        if (field.type === 'dropdown' && field.value) {
          // The value is already the selected option from the dropdown
          fieldValue = field.value.toString();
        }
        
        return {
          fieldId: field.fieldId || 0,
          value: fieldValue
        };
      })
    };
    
    console.log('Saving task changes:', saveRequest);
    
    // Call SaveTaskBulk API
    this.api.saveTaskBulk(saveRequest).subscribe({
      next: (response: any) => {
        console.log('Task saved successfully:', response);
        
        if (response && response.success) {
          this.toasterService.showSuccess('Task Saved', 'Your changes have been saved successfully!');
          
          // Update local task object
          if (this.selectedTask) {
            this.selectedTask.title = this.editableTaskTitle;
            this.selectedTask.description = this.editableTaskDescription;
            this.selectedTask.progress = this.taskProgress;
          }
          
          // Reload active tasks to reflect changes
          this.loadActiveTasks();
          
          // Optionally reload task details
          if (this.selectedTask) {
            const categoryIdForReload = this.selectedTask.categoryId || this.getCategoryIdFromTask(this.selectedTask);
            this.api.getTaskById(this.selectedTask.id, userId, categoryIdForReload || 0).subscribe({
              next: (taskResponse: any) => {
                if (taskResponse && taskResponse.success && taskResponse.data) {
                  console.log('Task details reloaded after save');
                }
              },
              error: (error: any) => {
                console.error('Error reloading task details:', error);
              }
            });
          }
        } else {
          this.toasterService.showError('Save Failed', response?.message || 'Failed to save task. Please try again.');
        }
      },
      error: (error: any) => {
        console.error('Error saving task:', error);
        const errorMessage = error?.error?.message || error?.message || 'An error occurred while saving the task.';
        this.toasterService.showError('Error', errorMessage);
      }
    });
  }

  // Task timer controls for details modal
  pauseSelectedTask() {
    if (this.selectedTask) {
      this.selectedTask.status = 'PAUSED';
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
      this.selectedTask.status = status === 'continuous' ? 'RUNNING' : 'COMPLETED';
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
      assignees: [], // Clear multi-select assignees
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
    // Validate required fields
    if (!this.newTask.name || this.newTask.assignees.length === 0) {
      alert('Please fill in all required fields (Task Name and at least one Assignee)');
      return;
    }

    console.log('Create task with multiple assignees:', {
      ...this.newTask,
      assigneeCount: this.newTask.assignees.length,
      assigneeIds: this.newTask.assignees
    });

    // TODO: Implement API call to create task with multiple assignees
    // The backend should handle creating task entries for each assignee
    
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
    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    if (!userId) {
      this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
      return;
    }

    // Get category ID from selected task
    if (!this.selectedTask) {
      this.toasterService.showError('Error', 'No task selected');
      return;
    }
    
    const categoryId = this.selectedTask.categoryId || this.getCategoryIdFromTask(this.selectedTask);
    
    if (!categoryId) {
      this.toasterService.showError('Error', 'No task category selected');
      return;
    }

    // Load custom mapped fields from API
    this.api.getCustomMappedFields(userId, categoryId).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.availableCustomFields = response.data.map((field: any) => ({
            key: field.fieldName?.toLowerCase().replace(/\s+/g, '_') || `field_${field.fieldId}`,
            label: field.fieldName || 'Custom Field',
            type: this.mapFieldType(field.fieldType),
            description: `${field.fieldName} field`,
            options: field.options || [],
            fieldId: field.fieldId,
            isMapped: field.isMapped || 'N'
          }));
          
          // Initialize temp selection with already mapped fields (isMapped: 'Y')
          this.tempSelectedFields = this.availableCustomFields
            .filter(f => f.isMapped === 'Y')
            .map(f => f.key);
          
          console.log('Custom Mapped Fields loaded:', this.availableCustomFields.length, 'fields');
          console.log('Already mapped fields:', this.tempSelectedFields);
          
          // Show modal
          this.showAddFieldModal = true;
          document.body.style.overflow = 'hidden';
        } else if (response && Array.isArray(response)) {
          // Handle direct array response
          this.availableCustomFields = response.map((field: any) => ({
            key: field.fieldName?.toLowerCase().replace(/\s+/g, '_') || `field_${field.fieldId}`,
            label: field.fieldName || 'Custom Field',
            type: this.mapFieldType(field.fieldType),
            description: `${field.fieldName} field`,
            options: field.options || [],
            fieldId: field.fieldId,
            isMapped: field.isMapped || 'N'
          }));
          
          // Initialize temp selection with already mapped fields
          this.tempSelectedFields = this.availableCustomFields
            .filter(f => f.isMapped === 'Y')
            .map(f => f.key);
          
          console.log('Custom Mapped Fields loaded (direct array):', this.availableCustomFields.length, 'fields');
          
          // Show modal
          this.showAddFieldModal = true;
          document.body.style.overflow = 'hidden';
        }
      },
      error: (error: any) => {
        console.error('Error loading custom mapped fields:', error);
        this.toasterService.showError('Error', 'Failed to load custom fields. Please try again.');
      }
    });
  }

  closeAddFieldModal() {
    this.showAddFieldModal = false;
    this.tempSelectedFields = [];
    document.body.style.overflow = 'auto';
  }

  isFieldSelected(fieldKey: string): boolean {
    return this.selectedCustomFields.some(field => field.key === fieldKey);
  }

  isFieldMapped(fieldKey: string): boolean {
    const field = this.availableCustomFields.find(f => f.key === fieldKey);
    return field?.isMapped === 'Y';
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
    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    if (!userId) {
      this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
      return;
    }

    // Get category ID from selected task
    if (!this.selectedTask) {
      this.toasterService.showError('Error', 'No task selected');
      return;
    }
    
    const categoryId = this.selectedTask.categoryId || this.getCategoryIdFromTask(this.selectedTask);
    
    if (!categoryId) {
      this.toasterService.showError('Error', 'No task category selected');
      return;
    }

    // Get field IDs from temp selected fields
    const fieldIds: number[] = [];
    this.tempSelectedFields.forEach(fieldKey => {
      const field = this.availableCustomFields.find(f => f.key === fieldKey);
      if (field && field.fieldId) {
        fieldIds.push(field.fieldId);
      }
    });

    if (fieldIds.length === 0) {
      this.toasterService.showError('Error', 'No fields selected');
      return;
    }

    // Prepare request
    const request: any = {
      categoryId: categoryId,
      fieldIds: fieldIds,
      userId: userId
    };

    console.log('Saving task field mapping with request:', request);

    // Call API to save field mapping
    this.api.saveTaskFieldMapping(request).subscribe({
      next: (response: any) => {
        console.log('Save task field mapping API response:', response);
        
        if (response && response.success) {
          console.log('Task field mapping saved successfully');
          
          // Add newly selected fields to UI
          this.tempSelectedFields.forEach(fieldKey => {
            if (!this.isFieldSelected(fieldKey)) {
              const field = this.availableCustomFields.find(f => f.key === fieldKey);
              if (field) {
                const newField = { ...field, value: field.type === 'number' ? 0 : '' };
                this.selectedCustomFields.push(newField);
              }
            }
          });

          // Remove unselected fields from UI
          this.selectedCustomFields = this.selectedCustomFields.filter(field =>
            this.tempSelectedFields.includes(field.key)
          );

          // Show success toaster
          this.toasterService.showSuccess('Fields Updated', 'Task field mapping saved successfully!');
          
          // Close modal
          this.closeAddFieldModal();
          
          console.log('Applied fields:', this.selectedCustomFields);
        } else {
          console.error('Failed to save task field mapping:', response?.message);
          this.toasterService.showError('Save Failed', response?.message || 'Failed to save field mapping. Please try again.');
        }
      },
      error: (error: any) => {
        console.error('Error saving task field mapping:', error);
        const errorMessage = error?.error?.message || error?.message || 'An error occurred while saving field mapping.';
        this.toasterService.showError('Error', errorMessage);
      }
    });
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
    
    // Load activity when switching to history tab
    if (tab === 'history' && this.selectedTask) {
      this.loadActivity(this.selectedTask.id);
    }
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
    if (!this.newComment.trim()) {
      return;
    }

    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    if (!userId) {
      this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
      return;
    }

    // Get task ID from selected task
    const taskId = this.selectedTask?.id;
    if (!taskId) {
      this.toasterService.showError('Error', 'No task selected');
      return;
    }

    // Prepare comment DTO
    const commentDto: TaskCommentDto = {
      commentId: 0, // 0 for new comment
      taskId: taskId,
      userId: userId,
      comments: this.newComment.trim(),
      submittedOn: new Date().toISOString(),
      empName: currentUser?.employeeName || currentUser?.name || '',
      profileImage: currentUser?.profileImage || undefined,
      profileImageBase64: currentUser?.profileImageBase64 || undefined
    };

    // Call API to save comment
    this.api.saveComment(commentDto).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          // Log the comment activity
          this.logTaskAction('comment_added', {
            comment: this.newComment.trim(),
            taskTitle: this.selectedTask?.title
          });

          // Clear the input
          this.newComment = '';
          
          // Show success message
          this.toasterService.showSuccess('Comment Added', 'Your comment has been saved successfully');
          
          // Reload comments to show the new comment
          if (taskId) {
            this.loadComments(taskId);
          }
          
          console.log('Comment saved successfully:', response);
        } else {
          this.toasterService.showError('Failed', response?.message || 'Failed to save comment');
        }
      },
      error: (error: any) => {
        console.error('Error saving comment:', error);
        this.toasterService.showError('Error', 'Failed to save comment. Please try again.');
      }
    });
  }

  // Helper method to get initials from name
  getInitials(name: string): string {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  // Helper method to get relative time (e.g., "2h ago", "45m ago")
  getTimeAgo(date: string | Date): string {
    const now = new Date();
    const commentDate = new Date(date);
    const diffMs = now.getTime() - commentDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    // Format as date if older than 7 days
    return commentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Helper method to get activity icon based on description
  getActivityIconFromDescription(description: string): string {
    const desc = description.toLowerCase();
    if (desc.includes('timer started') || desc.includes('timer start')) return 'fa-play';
    if (desc.includes('timer paused') || desc.includes('timer pause')) return 'fa-pause';
    if (desc.includes('timer stopped') || desc.includes('timer stop')) return 'fa-stop';
    if (desc.includes('file uploaded') || desc.includes('file upload')) return 'fa-file-upload';
    if (desc.includes('comment added') || desc.includes('comment')) return 'fa-comment';
    if (desc.includes('task created') || desc.includes('created')) return 'fa-plus-circle';
    if (desc.includes('auto-paused')) return 'fa-pause-circle';
    if (desc.includes('status change') || desc.includes('updated')) return 'fa-edit';
    return 'fa-circle';
  }

  // Helper method to get activity color based on description
  getActivityColorFromDescription(description: string): string {
    const desc = description.toLowerCase();
    if (desc.includes('timer started') || desc.includes('timer start')) return '#10b981'; // green
    if (desc.includes('timer paused') || desc.includes('timer pause')) return '#f59e0b'; // orange
    if (desc.includes('timer stopped') || desc.includes('timer stop')) return '#ef4444'; // red
    if (desc.includes('file uploaded') || desc.includes('file upload')) return '#3b82f6'; // blue
    if (desc.includes('comment added') || desc.includes('comment')) return '#8b5cf6'; // purple
    if (desc.includes('task created') || desc.includes('created')) return '#10b981'; // green
    if (desc.includes('auto-paused')) return '#f59e0b'; // orange
    if (desc.includes('status change') || desc.includes('updated')) return '#6366f1'; // indigo
    return '#6b7280'; // gray
  }

  // Activity Log Methods
  addActivityLog(activity: any) {
    // Activity logs are now loaded from API via loadActivity()
    // This method is kept for backward compatibility but does nothing
    console.log('Activity log action (will be synced from API):', activity);
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
    // Always display in hours format (e.g., 0.5h, 1.5h, 2.0h)
    return hours.toFixed(1) + 'h';
  }
  // Format minutes from backend - if < 60 show as minutes, else convert to HH:MM
  formatMinutesToTime(minutes: number): string {
    if (!minutes || minutes === 0) {
      return '0m';
    }
    
    if (minutes < 60) {
      return Math.round(minutes) + 'm';
    }
    
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    // Format as "Xh Ym" (e.g., "14h 54m")
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
  }

  // Format date string for input field (YYYY-MM-DD format)
  formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  }

  // Get formatted timer for active task (HH:MM:SS format for display)
  getActiveTaskTimer(): string {
    // Return the live timer value that's being updated by the interval
    return this.activeTaskTimer;
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
    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    // Get taskId from selected task
    const taskId = this.selectedTask ? parseInt(this.selectedTaskId) || this.selectedTask.id : 0;
    
    if (!taskId) {
      this.toasterService.showError('Cannot upload file', 'No task selected');
      return;
    }
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        this.toasterService.showError('File too large', `File "${file.name}" exceeds 10MB limit`);
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
        this.toasterService.showError('Invalid file type', `File "${file.name}" is not supported`);
        continue;
      }

      // Show uploading status
      this.toasterService.showSuccess('Uploading', `Uploading ${file.name}...`);

      // Call upload API
      this.api.uploadTimeSheetFile(taskId, userId, file).subscribe({
        next: (response: any) => {
          console.log('File uploaded successfully:', response);
          
          // Add to uploaded files list
          const uploadedFile: UploadedFile = {
            id: response.fileId || Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: file.name,
            size: file.size,
            type: file.type,
            uploadDate: new Date(),
            url: response.fileUrl || URL.createObjectURL(file)
          };
          
          this.uploadedFiles.push(uploadedFile);
          this.toasterService.showSuccess('Upload complete', `${file.name} uploaded successfully`);
        },
        error: (error: any) => {
          console.error('Error uploading file:', error);
          this.toasterService.showError('Upload failed', `Failed to upload ${file.name}`);
        }
      });
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

  deleteFile(file: UploadedFile) {
    // Show confirmation dialog with higher z-index to appear above modal
    Swal.fire({
      title: 'Delete File?',
      text: `Are you sure you want to delete "${file.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      customClass: {
        container: 'swal-high-z-index'
      },
      backdrop: true
    }).then((result) => {
      if (result.isConfirmed) {
        // Get current user
        const currentUser = this.sessionService.getCurrentUser();
        const userId = currentUser?.empId || currentUser?.employeeId || '';
        
        // Convert file.id to number
        const fileId = parseInt(file.id, 10);
        
        if (!fileId || isNaN(fileId)) {
          this.toasterService.showError('Error', 'Invalid file ID');
          return;
        }
        
        // Call API to delete file
        this.api.deleteTaskFile(fileId, userId).subscribe({
          next: (response: any) => {
            if (response && response.success) {
              // Remove file from local array
              const index = this.uploadedFiles.findIndex(f => f.id === file.id);
              if (index > -1) {
                if (this.uploadedFiles[index].url) {
                  URL.revokeObjectURL(this.uploadedFiles[index].url);
                }
                this.uploadedFiles.splice(index, 1);
              }
              
              this.toasterService.showSuccess('File Deleted', 'File deleted successfully');
              console.log('File deleted:', file.name);
            } else {
              this.toasterService.showError('Delete Failed', response?.message || 'Failed to delete file');
            }
          },
          error: (error: any) => {
            console.error('Error deleting file:', error);
            this.toasterService.showError('Error', 'Failed to delete file. Please try again.');
          }
        });
      }
    });
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

  // Close dropdowns when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    
    // Check if click is outside assignee dropdown
    if (this.isAssigneeDropdownVisible) {
      const assigneeWrapper = target.closest('.multi-select-wrapper');
      if (!assigneeWrapper) {
        this.isAssigneeDropdownVisible = false;
      }
    }
    
    // Check if click is outside project dropdown
    if (this.isProjectDropdownVisible) {
      const projectWrapper = target.closest('.searchable-dropdown-wrapper');
      if (!projectWrapper) {
        this.isProjectDropdownVisible = false;
      }
    }
  }

  // Pause active task from header
  pauseActiveTask() {
    if (!this.activeTask) {
      this.toasterService.showError('Error', 'No active task to pause');
      return;
    }

    // Pause the live timer
    this.pauseActiveTaskTimer();

    // Call the existing pauseTask method
    this.pauseTask(this.activeTask.id);
  }

  // Resume the live timer for active task
  private resumeActiveTaskTimer() {
    // Safety check: Stop break timer if it's running
    if (this.breakTimerInterval) {
      clearInterval(this.breakTimerInterval);
      this.breakTimerInterval = null;
      console.log('Break timer stopped because task timer is resuming');
    }

    // Clear any existing task timer
    if (this.activeTaskTimerInterval) {
      clearInterval(this.activeTaskTimerInterval);
      this.activeTaskTimerInterval = null;
    }

    // Set start time
    this.activeTaskStartTime = new Date();

    // Start the interval timer
    this.activeTaskTimerInterval = setInterval(() => {
      this.activeTaskElapsedSeconds++;
      this.updateActiveTaskTimerDisplay();
    }, 1000);

    console.log('Active task timer resumed');
  }

  // Resume active task from header
  resumeActiveTask() {
    if (!this.activeTask) {
      this.toasterService.showError('Error', 'No active task to resume');
      return;
    }

    // Resume the live timer
    this.resumeActiveTaskTimer();

    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    if (!userId) {
      this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
      return;
    }
    
    // Prepare timer action request
    const timerRequest: any = {
      taskId: this.activeTask.id,
      userId: userId,
      action: 'START'
    };
    
    console.log('Resuming active task with request:', timerRequest);
    
    // Call API to start/resume timer
    this.api.executeTimer(timerRequest).subscribe({
      next: (response: any) => {
        console.log('Resume active task API response:', response);
        
        if (response && response.success) {
          console.log('Active task resumed successfully');
          
          // Reset break tracker when resuming a task
          this.resetBreakTracker();
          
          // Show success toaster
          this.toasterService.showSuccess('Task Resumed', 'Task timer has been resumed successfully!');
          
          // Reload active tasks to get latest updates
          this.loadActiveTasks();
        } else {
          console.error('Failed to resume active task:', response?.message);
          this.toasterService.showError('Resume Failed', response?.message || 'Failed to resume task. Please try again.');
        }
      },
      error: (error: any) => {
        console.error('Error resuming active task:', error);
        const errorMessage = error?.error?.message || error?.message || 'An error occurred while resuming the task.';
        this.toasterService.showError('Error', errorMessage);
      }
    });
  }

  // Stop active task from header
  stopActiveTask() {
    if (!this.activeTask) {
      this.toasterService.showError('Error', 'No active task to stop');
      return;
    }

    // Stop the live timer
    this.stopActiveTaskTimer();

    // Save active task to local variable to avoid null issues
    const taskToStop = this.activeTask;
    
    // Open the task details modal with status set to CLOSED
    this.selectedTask = taskToStop;
    this.selectedTaskStatus = 'closed';
    this.selectedTaskDetailStatus = 'not-closed';
    
    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    // Get category ID
    let categoryId = taskToStop.categoryId || this.getCategoryIdFromTask(taskToStop);
    
    // Show the modal
    this.showTaskDetailsModal = true;
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'relative';
    document.body.style.zIndex = '1';
    
    // Load task details from API
    this.api.getTaskById(taskToStop.id, userId, categoryId || 0).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          const taskDetails = response.data;
          
          // Bind all values from API response
          this.selectedTaskId = taskDetails.taskId?.toString() || taskToStop.id?.toString() || '';
          this.selectedTaskCategory = taskDetails.categoryName || taskToStop.category;
          this.editableTaskTitle = taskDetails.taskTitle || taskToStop.title;
          this.editableTaskDescription = taskDetails.taskDescription || taskToStop.description || '';
          this.selectedTaskProgress = taskDetails.progressPercentage || taskDetails.progress || 0;
          this.taskProgress = this.selectedTaskProgress;
          
          // Format timers
          this.selectedTaskRunningTimer = this.formatMinutesToTime(taskDetails.todayTotalMinutes || 0);
          this.selectedTaskTotalHours = this.formatMinutesToTime(taskDetails.totalTimeMinutes || 0);
          
          // Set status to CLOSED
          this.selectedTaskDetailStatus = 'not-closed';
          this.dailyRemarks = taskDetails.dailyRemarks || '';
          
          // Bind Project Metadata fields
          this.selectedProjectId = taskDetails.projectId ? taskDetails.projectId.toString() : '';
          this.selectedTaskStartDate = taskDetails.startDate ? this.formatDateForInput(taskDetails.startDate) : '';
          this.selectedTaskEndDate = taskDetails.targetDate ? this.formatDateForInput(taskDetails.targetDate) : '';
          this.selectedTaskEstimatedHours = taskDetails.estimtedHours || taskDetails.estimatedHours || 0;
          
          // Load and bind custom fields from API response
          if (taskDetails.customFields && Array.isArray(taskDetails.customFields)) {
            this.selectedCustomFields = taskDetails.customFields
              .filter((field: any) => field.isMapped === 'Y')
              .map((field: any) => {
                // Parse options string to array
                let optionsArray: string[] = [];
                if (field.options && typeof field.options === 'string') {
                  optionsArray = field.options.split(',').map((opt: string) => opt.trim());
                } else if (Array.isArray(field.options)) {
                  optionsArray = field.options;
                }
                
                return {
                  key: field.fieldName?.toLowerCase().replace(/\s+/g, '_') || `field_${field.fieldId}`,
                  label: field.fieldName || 'Custom Field',
                  type: this.mapFieldType(field.fieldType),
                  description: `${field.fieldName} field`,
                  options: optionsArray,
                  fieldId: field.fieldId,
                  isMapped: field.isMapped,
                  value: field.savedValue || ''
                };
              });
            
            console.log('Custom fields loaded from stopped task:', this.selectedCustomFields.length, 'fields');
          } else {
            this.selectedCustomFields = [];
          }
          
          // Update selected task object
          if (this.selectedTask) {
            this.selectedTask.progress = this.selectedTaskProgress;
            this.selectedTask.status = 'CLOSED';
          }
          
          // Load task files and comments
          this.loadTaskFiles(taskToStop.id);
          this.loadComments(taskToStop.id);
        }
      },
      error: (error: any) => {
        console.error('Error fetching task details:', error);
        // Fallback to binding from task list data
        this.bindTaskListData(taskToStop);
        this.selectedTaskDetailStatus = 'not-closed';
      }
    });
  }

  // Pause task from modal
  pauseTaskFromModal() {
    if (!this.selectedTask) {
      this.toasterService.showError('Error', 'No task selected');
      return;
    }

    console.log('Pausing task from modal:', this.selectedTask.id);
    
    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    if (!userId) {
      this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
      return;
    }
    
    // Prepare timer action request
    const timerRequest: any = {
      taskId: this.selectedTask.id,
      userId: userId,
      action: 'PAUSED'
    };
    
    console.log('Pausing task with request:', timerRequest);
    
    // Call API to pause timer
    this.api.executeTimer(timerRequest).subscribe({
      next: (response: any) => {
        console.log('Pause task API response:', response);
        
        if (response && response.success) {
          console.log('Task paused successfully');
          
          // Update local status immediately for UI feedback
          this.selectedTaskDetailStatus = 'pause';
          console.log('Status updated to pause, current value:', this.selectedTaskDetailStatus);
          
          // Force Angular change detection
          this.cdr.detectChanges();
          
          // Show success toaster
          this.toasterService.showSuccess('Task Paused', 'Task timer has been paused successfully!');
          
          // Reload active tasks to get latest updates
          this.loadActiveTasks();
          
          // Reload task details to update the modal
          if (this.selectedTask) {
            const categoryId = this.selectedTask.categoryId || this.getCategoryIdFromTask(this.selectedTask);
            this.api.getTaskById(this.selectedTask.id, userId, categoryId || 0).subscribe({
              next: (taskResponse: any) => {
                if (taskResponse && taskResponse.success && taskResponse.data) {
                  const taskDetails = taskResponse.data;
                  const apiStatus = taskDetails.status?.toUpperCase() || '';
                  if (apiStatus === 'PAUSED') {
                    this.selectedTaskDetailStatus = 'pause';
                  }
                  console.log('Task details reloaded, status:', this.selectedTaskDetailStatus);
                  // Force change detection again after API reload
                  this.cdr.detectChanges();
                }
              },
              error: (error: any) => {
                console.error('Error reloading task details:', error);
              }
            });
          }
        } else {
          console.error('Failed to pause task:', response?.message);
          this.toasterService.showError('Pause Failed', response?.message || 'Failed to pause task. Please try again.');
        }
      },
      error: (error: any) => {
        console.error('Error pausing task:', error);
        const errorMessage = error?.error?.message || error?.message || 'An error occurred while pausing the task.';
        this.toasterService.showError('Error', errorMessage);
      }
    });
  }

  // Resume task from modal
  resumeTaskFromModal() {
    if (!this.selectedTask) {
      this.toasterService.showError('Error', 'No task selected');
      return;
    }

    console.log('Resuming task from modal:', this.selectedTask.id);
    
    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    if (!userId) {
      this.toasterService.showError('Error', 'Unable to identify current user. Please log in again.');
      return;
    }
    
    // Prepare timer action request
    const timerRequest: any = {
      taskId: this.selectedTask.id,
      userId: userId,
      action: 'START'
    };
    
    console.log('Resuming task with request:', timerRequest);
    
    // Call API to start/resume timer
    this.api.executeTimer(timerRequest).subscribe({
      next: (response: any) => {
        console.log('Resume task API response:', response);
        
        if (response && response.success) {
          console.log('Task resumed successfully');
          
          // Reset break tracker when resuming a task
          this.resetBreakTracker();
          
          // Update local status immediately for UI feedback
          this.selectedTaskDetailStatus = 'running';
          
          // Force Angular change detection
          this.cdr.detectChanges();
          
          // Show success toaster
          this.toasterService.showSuccess('Task Resumed', 'Task timer has been resumed successfully!');
          
          // Reload active tasks to get latest updates
          this.loadActiveTasks();
          
          // Reload task details to update the modal
          if (this.selectedTask) {
            const categoryId = this.selectedTask.categoryId || this.getCategoryIdFromTask(this.selectedTask);
            this.api.getTaskById(this.selectedTask.id, userId, categoryId || 0).subscribe({
              next: (taskResponse: any) => {
                if (taskResponse && taskResponse.success && taskResponse.data) {
                  const taskDetails = taskResponse.data;
                  const apiStatus = taskDetails.status?.toUpperCase() || '';
                  if (apiStatus === 'RUNNING') {
                    this.selectedTaskDetailStatus = 'running';
                  }
                  console.log('Task details reloaded, status:', this.selectedTaskDetailStatus);
                  // Force change detection again after API reload
                  this.cdr.detectChanges();
                }
              },
              error: (error: any) => {
                console.error('Error reloading task details:', error);
              }
            });
          }
        } else {
          console.error('Failed to resume task:', response?.message);
          this.toasterService.showError('Resume Failed', response?.message || 'Failed to resume task. Please try again.');
        }
      },
      error: (error: any) => {
        console.error('Error resuming task:', error);
        const errorMessage = error?.error?.message || error?.message || 'An error occurred while resuming the task.';
        this.toasterService.showError('Error', errorMessage);
      }
    });
  }

  // Stop task from modal
  stopTaskFromModal() {
    if (!this.selectedTask) {
      this.toasterService.showError('Error', 'No task selected');
      return;
    }

    console.log('Stopping task from modal:', this.selectedTask.id);
    
    // Call the existing stopTask method
    this.stopTask(this.selectedTask.id);
    
    // Close the modal after stopping
    setTimeout(() => {
      this.closeTaskDetailsModal();
    }, 1000);
  }
}
