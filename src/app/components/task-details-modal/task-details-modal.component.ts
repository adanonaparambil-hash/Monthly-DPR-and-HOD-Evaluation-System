import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api } from '../../services/api';
import { ToasterService } from '../../services/toaster.service';
import { TaskCommentDto, TaskActivityDto, TaskSaveDto } from '../../models/TimeSheetDPR.model';
import Swal from 'sweetalert2';

interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'textarea' | 'date';
  description: string;
  options?: string[];
  value?: any;
  fieldId?: number;
  isMapped?: 'Y' | 'N';
  isMandatory?: 'Y' | 'N';
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: Date;
  url?: string;
}

@Component({
  selector: 'app-task-details-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-details-modal.component.html',
  styleUrls: ['./task-details-modal.component.css']
})
export class TaskDetailsModalComponent implements OnInit, OnDestroy {
  // Input properties
  @Input() taskId!: number;
  @Input() userId!: string;
  @Input() categoryId!: number;
  @Input() categoryName?: string; // Category name for new tasks
  @Input() estimatedHours?: number; // Estimated hours from category
  @Input() isViewOnly: boolean = false; // View-only mode for "Assigned to Others"
  
  // Output events
  @Output() closeModal = new EventEmitter<void>();
  @Output() taskUpdated = new EventEmitter<any>();
  @Output() taskPaused = new EventEmitter<number>();
  @Output() taskResumed = new EventEmitter<number>();
  @Output() taskStopped = new EventEmitter<number>();
  @Output() showLogTime = new EventEmitter<any>(); // Emits log time data to parent for rendering outside stacking context
  
  // AUTO CLOSED tasks blocking
  autoClosedTaskCount = 0;
  isBlockedByAutoClosedTasks = false;

  // Loading state
  isLoading = false;

  // Log Time popup (shown when session user opens their own AUTO CLOSED task)
  showLogTimePopup = false;
  logTimeDate = '';
  logTimeStartTime = '';
  logTimeEndTime = '';
  logTimeTotalMinutes = 0;
  logTimeTotalDisplay = '00:00';
  isEditingLogTime = false;
  logTimeEditValue = '';
  logTimeTimeLogId = 0; // timeLogID from API response
  
  // Task data
  selectedTaskId = '';
  selectedTaskCategory = '';
  selectedTaskRunningTimer = '00:00:00';
  selectedTaskTotalHours = '0h';
  selectedTaskProgress = 0;
  selectedTaskDetailStatus = 'not-started';
  previousTaskStatus = 'not-started'; // Track previous status for dropdown changes
  
  // Editable fields
  editableTaskTitle = '';
  editableTaskDescription = '';
  dailyRemarks = '';
  dailyCount: number = 0;

  // Metadata fields
  selectedTaskStartDate = '';
  selectedTaskEndDate = '';
  selectedTaskCount: number = 0;
  selectedTaskEstimatedHours: number = 0;
  estimatedHoursDisplay: string = ''; // HH:MM display format
  selectedProjectId: string = '';
  selectedAssigneeId: string = '';         // kept for legacy read (single, e.g. view-only)
  selectedAssigneeIds: string[] = [];      // multi-select assignee IDs
  originalAssigneeIds: string[] = [];      // assignees present when the task loaded (to detect newly added ones)
  private originalTaskSnapshot: any = null; // snapshot of all editable fields at load (for the change summary)
  selectedCreatedById: string = '';        // Assigned By (single select) → maps to createdBy
  createdBySearchTerm: string = '';
  isCreatedByDropdownVisible: boolean = false;
  
  // Custom fields
  selectedCustomFields: CustomField[] = [];
  availableCustomFields: CustomField[] = [];
  tempSelectedFields: string[] = [];
  showAddFieldModal = false;
  validationErrors: string[] = []; // Track fields with validation errors
  
  // Files
  uploadedFiles: UploadedFile[] = [];
  
  // Comments and Activity
  activeSidebarTab: 'comments' | 'history' | 'timelog' = 'comments';
  taskComments: TaskCommentDto[] = [];
  activityLogs: TaskActivityDto[] = [];
  newComment = '';

  // @mention support in the comment box
  showMentionDropdown = false;
  mentionSearchTerm = '';
  private mentionStartPos = -1;
  mentionedUsers: { id: string; name: string }[] = [];

  // Time Distribution (timeLogSummary and assignees from GetTaskById)
  timeLogSummary: any[] = [];
  taskAssignees: any[] = [];
  apiTeamStatus: string = ''; // teamStatus field from GetTaskById response
  activeTimeTab: 'team' | 'log' = 'team';
  
  // Dropdowns
  projectsList: any[] = [];
  employeeMasterList: any[] = [];
  projectSearchTerm: string = '';
  assigneeSearchTerm: string = '';
  isProjectDropdownVisible: boolean = false;
  isAssigneeDropdownVisible: boolean = false;
  
  // Progress control
  taskProgress = 0;
  isDraggingProgress = false;
  isProgressAnimating = false;
  isProgressChanging = false;
  
  // Timer management
  private timerInterval: any = null;
  private timerStartTime: Date | null = null;
  private timerElapsedSeconds = 0;

  constructor(
    private api: Api,
    private toasterService: ToasterService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    console.log('TaskDetailsModalComponent ngOnInit called with:', {
      taskId: this.taskId,
      userId: this.userId,
      categoryId: this.categoryId
    });
    
    // Set Assigned By and Assignee to logged-in user by default
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const loggedInId = (currentUser.empId || currentUser.employeeId || this.userId || '').toString();
    this.selectedCreatedById = loggedInId;
    
    // Check AUTO CLOSED tasks count
    this.checkAutoClosedTasksCount();
    
    // Load common data regardless of taskId
    this.loadCustomFields();
    this.loadProjectsList();
    this.loadEmployeeMasterList();
    
    // If taskId is provided and not 0, load existing task details
    // categoryId can be 0 — backend handles it gracefully
    if (this.taskId && this.taskId > 0 && this.userId) {
      console.log('Loading existing task details...');
      this.isLoading = true;
      this.loadTaskDetails();
      this.loadTaskFiles(this.taskId);
      this.loadComments(this.taskId);
      this.loadActivity(this.taskId);
    } else if (this.categoryId && this.userId) {
      // New task - just show empty form with category info
      console.log('New task mode - showing empty form for categoryId:', this.categoryId, 'estimatedHours:', this.estimatedHours);
      this.selectedTaskDetailStatus = 'not-started';
      this.selectedTaskCategory = this.categoryName || ''; // Set category name for new tasks
      this.selectedTaskEstimatedHours = this.estimatedHours || 0; // Set estimated hours from category
      this.estimatedHoursDisplay = this.minutesToHHMM(this.selectedTaskEstimatedHours);
      this.selectedTaskCount = 0;
      this.editableTaskTitle = '';
      this.editableTaskDescription = '';
      this.dailyRemarks = '';
      this.dailyCount = 0;
      this.selectedTaskProgress = 0;
      this.taskProgress = 0;
      // Pre-populate both Assigned By and Assignee with the logged-in user
      if (loggedInId) {
        this.selectedAssigneeIds = [loggedInId];
        this.originalAssigneeIds = [loggedInId];
      }
    } else {
      console.error('Missing required inputs:', {
        hasTaskId: !!this.taskId,
        hasUserId: !!this.userId,
        hasCategoryId: !!this.categoryId
      });
    }
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  // Load task details from API
  loadTaskDetails() {
    console.log('=== loadTaskDetails START ===');
    console.log('Loading task details for:', { taskId: this.taskId, userId: this.userId, categoryId: this.categoryId });
    console.log('Calling API: getTaskById');
    
    this.api.getTaskById(this.taskId, this.userId, this.categoryId).subscribe({
      next: (response: any) => {
        console.log('=== getTaskById API Response ===');
        console.log('Full response:', response);
        console.log('Response success:', response?.success);
        console.log('Response data:', response?.data);
        
        if (response && response.success && response.data) {
          const taskDetails = response.data;
          console.log('Task details data:', taskDetails);
          
          // Map task data with correct field names from API
          this.selectedTaskId = taskDetails.taskId?.toString() || '';
          this.selectedTaskCategory = taskDetails.categoryName || '';
          this.editableTaskTitle = taskDetails.taskTitle || '';
          this.editableTaskDescription = taskDetails.taskDescription || taskDetails.description || '';
          
          console.log('Bound description:', this.editableTaskDescription);
          
          this.selectedTaskProgress = taskDetails.progressPercentage || taskDetails.progress || 0;
          this.taskProgress = taskDetails.progressPercentage || taskDetails.progress || 0;
          
          // Format timers - API returns minutes, convert to seconds for formatTime
          const todaySeconds = (taskDetails.todayTotalMinutes || 0) * 60;
          const totalSeconds = (taskDetails.totalTimeMinutes || 0) * 60;
          this.selectedTaskRunningTimer = this.formatTime(todaySeconds);
          this.selectedTaskTotalHours = this.formatTime(totalSeconds);
          
          // Bind Project Metadata fields
          this.selectedTaskStartDate = taskDetails.startDate ? this.formatDateForInput(taskDetails.startDate) : '';
          this.selectedTaskEndDate = taskDetails.targetDate ? this.formatDateForInput(taskDetails.targetDate) : '';
          this.selectedTaskCount = taskDetails.count || 0;
          this.selectedTaskEstimatedHours = taskDetails.estimtedHours || taskDetails.estimatedHours || 0;
          this.estimatedHoursDisplay = this.minutesToHHMM(this.selectedTaskEstimatedHours);
          this.selectedProjectId = taskDetails.projectId ? taskDetails.projectId.toString() : '';
          
          // Bind Assigned By from createdBy in the API response
          if (taskDetails.createdBy) {
            this.selectedCreatedById = taskDetails.createdBy.toString();
          }

          // Bind Assigned To (multi-select) from the assignees list in the API response
          if (taskDetails.assignees && Array.isArray(taskDetails.assignees) && taskDetails.assignees.length > 0) {
            this.selectedAssigneeIds = taskDetails.assignees
              .map((a: any) => (a.userId || '').toString())
              .filter((id: string) => id !== '');
            this.selectedAssigneeId = this.selectedAssigneeIds[0] || '';
          } else {
            // Fallback to legacy single-assignee fields
            const assigneeValue = taskDetails.assignee || taskDetails.assigneeId || taskDetails.userId || '';
            this.selectedAssigneeId = assigneeValue ? assigneeValue.toString() : '';
            this.selectedAssigneeIds = this.selectedAssigneeId ? [this.selectedAssigneeId] : [];
          }

          // Snapshot the assignees that already existed on the task, so on save we
          // only notify users who are newly added (first time assigned).
          this.originalAssigneeIds = [...this.selectedAssigneeIds];

          // Bind assignees list for Time Distribution tab
          this.taskAssignees = (taskDetails.assignees && Array.isArray(taskDetails.assignees))
            ? taskDetails.assignees
            : [];

          // Bind teamStatus directly from API response for the header badge
          this.apiTeamStatus = (taskDetails.teamStatus || taskDetails.TeamStatus || '').toString().toUpperCase();

          // Bind Time Distribution from timeLogSummary (latest first)
          this.timeLogSummary = (taskDetails.timeLogSummary && Array.isArray(taskDetails.timeLogSummary))
            ? [...taskDetails.timeLogSummary].sort((a: any, b: any) =>
                new Date(b.logDate || 0).getTime() - new Date(a.logDate || 0).getTime())
            : [];
          
          this.dailyRemarks = taskDetails.dailyRemarks || '';
          
          console.log('Assignee binding:', {
            apiAssignee: taskDetails.assignee,
            apiAssigneeId: taskDetails.assigneeId,
            apiUserId: taskDetails.userId,
            selectedAssigneeId: this.selectedAssigneeId,
            employeeMasterListLength: this.employeeMasterList.length,
            displayName: this.getAssigneeDisplayName()
          });
          
          // Trigger change detection after employee list loads
          if (this.employeeMasterList.length > 0) {
            this.cdr.detectChanges();
          }
          
          // Map status
          this.selectedTaskDetailStatus = this.mapTaskStatus(taskDetails.status);
          this.previousTaskStatus = this.selectedTaskDetailStatus; // Track previous status

          // Show Log Time popup if session user === task userId AND status is AUTO CLOSED
          this.checkAndShowLogTimePopup(taskDetails);
          
          // Map custom fields if available
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
                  value: field.savedValue || field.value || '',
                  fieldId: field.fieldId,
                  isMapped: field.isMapped || 'N',
                  isMandatory: field.isMandatory || 'N'
                };
              });
          }
          
          // Snapshot all editable fields now (after everything is bound) so we can
          // build a before/after change summary when the user saves.
          this.captureTaskSnapshot();

          // Start timer if task is running
          if (this.selectedTaskDetailStatus === 'running') {
            const runningSeconds = (taskDetails.todayTotalMinutes || 0) * 60;
            this.startTimer(runningSeconds);
          }

          console.log('=== Task details loaded successfully ===');
          this.isLoading = false;
          this.cdr.detectChanges();
        } else {
          console.error('API response invalid:', {
            hasResponse: !!response,
            hasSuccess: response?.success,
            hasData: !!response?.data
          });
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      },
      error: (error: any) => {
        console.error('=== getTaskById API ERROR ===');
        console.error('Error loading task details:', error);
        console.error('Error status:', error?.status);
        console.error('Error message:', error?.message);
        this.isLoading = false;
        this.cdr.detectChanges();
        this.toasterService.showError('Error', 'Failed to load task details');
      }
    });
  }

  // Load custom fields from API
  loadCustomFields() {
    this.api.getCustomFields(this.userId).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.availableCustomFields = response.data.map((field: any) => ({
            key: field.fieldName?.toLowerCase().replace(/\s+/g, '_') || `field_${field.fieldId}`,
            label: field.fieldName || 'Custom Field',
            type: this.mapFieldType(field.fieldType),
            description: `${field.fieldName} field`,
            options: field.options || [],
            fieldId: field.fieldId,
            isMapped: field.isMapped || 'N',
            isMandatory: field.isMandatory || 'N'
          }));
        }
      },
      error: (error: any) => {
        console.error('Error loading custom fields:', error);
      }
    });
  }

  // Load projects list
  loadProjectsList() {
    this.api.getProjects().subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.projectsList = response.data;
        }
      },
      error: (error: any) => {
        console.error('Error loading projects:', error);
      }
    });
  }

  // Load employee master list
  loadEmployeeMasterList() {
    this.api.GetEmployeeMasterList().subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.employeeMasterList = response.data;
          console.log('Employee master list loaded:', this.employeeMasterList.length, 'employees');
          console.log('Current selectedAssigneeId:', this.selectedAssigneeId);
          
          // Log sample employee data to verify idValue format
          if (this.employeeMasterList.length > 0) {
            console.log('Sample employee data:', this.employeeMasterList[0]);
            
            // Try to find the matching employee
            if (this.selectedAssigneeId) {
              const matchedEmployee = this.employeeMasterList.find(emp => 
                emp.idValue?.toString() === this.selectedAssigneeId?.toString()
              );
              console.log('Matched employee for assignee:', matchedEmployee);
              
              if (!matchedEmployee) {
                console.warn('No matching employee found for assigneeId:', this.selectedAssigneeId);
                console.log('Available idValues:', this.employeeMasterList.slice(0, 5).map(e => e.idValue));
              }
            }
          }
          
          console.log('Assignee display name after list load:', this.getAssigneeDisplayName());
          
          // Force change detection to update the display
          this.cdr.detectChanges();
        }
      },
      error: (error: any) => {
        console.error('Error loading employees:', error);
      }
    });
  }

  // Load task files
  loadTaskFiles(taskId: number) {
    this.uploadedFiles = [];
    
    this.api.getTaskFiles(taskId).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.uploadedFiles = response.data.map((file: any) => ({
            id: file.fileId?.toString() || '',
            name: file.fileName || 'Unknown File',
            size: file.fileSizeKb ? file.fileSizeKb * 1024 : 0,
            type: file.fileType || 'application/octet-stream',
            uploadDate: file.uploadedOn ? new Date(file.uploadedOn) : new Date(),
            url: file.fileContentBase64 || file.fileContent || undefined
          }));
        }
      },
      error: (error: any) => {
        console.error('Error loading task files:', error);
      }
    });
  }

  // Load comments
  loadComments(taskId: number) {
    this.taskComments = [];
    
    this.api.getComments(taskId).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.taskComments = response.data;
        }
      },
      error: (error: any) => {
        console.error('Error loading comments:', error);
      }
    });
  }

  // Load activity
  loadActivity(taskId: number) {
    this.activityLogs = [];
    
    this.api.getActivity(taskId).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          // Sort by date descending (latest first)
          this.activityLogs = response.data.sort((a: any, b: any) => {
            const dateA = new Date(a.actionDate || a.timestamp || 0).getTime();
            const dateB = new Date(b.actionDate || b.timestamp || 0).getTime();
            return dateB - dateA; // Descending order (latest first)
          });
        }
      },
      error: (error: any) => {
        console.error('Error loading activity:', error);
      }
    });
  }

  // Validate mandatory custom fields when status is Closed or Completed
  validateMandatoryFields(): { isValid: boolean; missingFields: string[]; missingFieldKeys: string[] } {
    const missingFields: string[] = [];
    const missingFieldKeys: string[] = [];
    
    console.log('=== Validating Mandatory Fields ===');
    console.log('Current status:', this.selectedTaskDetailStatus);
    console.log('Status type:', typeof this.selectedTaskDetailStatus);
    console.log('Selected custom fields count:', this.selectedCustomFields.length);
    console.log('Selected custom fields:', JSON.stringify(this.selectedCustomFields, null, 2));
    
    // Check if status is Closed or Completed (case-insensitive and trimmed)
    const currentStatus = (this.selectedTaskDetailStatus || '').toLowerCase().trim();
    const statusRequiringValidation = ['not-closed', 'closed', 'completed'];
    
    console.log('Normalized status:', currentStatus);
    console.log('Statuses requiring validation:', statusRequiringValidation);
    console.log('Does status require validation?', statusRequiringValidation.includes(currentStatus));
    
    if (!statusRequiringValidation.includes(currentStatus)) {
      console.log('Status does not require validation. Skipping...');
      return { isValid: true, missingFields: [], missingFieldKeys: [] };
    }
    
    console.log('Status requires validation. Checking mandatory fields...');
    
    // Check each custom field
    this.selectedCustomFields.forEach((field, index) => {
      console.log(`\n[Field ${index + 1}] Checking field:`, {
        label: field.label,
        key: field.key,
        isMandatory: field.isMandatory,
        value: field.value,
        type: field.type
      });
      
      // Trim isMandatory value to handle trailing spaces from API
      const isMandatory = (field.isMandatory || '').trim().toUpperCase();
      
      if (isMandatory === 'Y') {
        const value = field.value;
        const isEmpty = value === null || value === undefined || value === '' || 
                       (typeof value === 'string' && value.trim() === '');
        
        if (isEmpty) {
          console.log(`  ❌ Field "${field.label}" is mandatory but empty!`);
          missingFields.push(field.label);
          missingFieldKeys.push(field.key);
        } else {
          console.log(`  ✓ Field "${field.label}" is mandatory and has value:`, value);
        }
      } else {
        console.log(`  ℹ Field "${field.label}" is not mandatory (isMandatory: ${field.isMandatory} -> normalized: ${isMandatory})`);
      }
    });
    
    console.log('\n=== Validation Summary ===');
    console.log('Missing fields:', missingFields);
    console.log('Missing field keys:', missingFieldKeys);
    console.log('Validation result:', missingFields.length === 0 ? '✓ VALID' : '❌ INVALID');
    
    return {
      isValid: missingFields.length === 0,
      missingFields: missingFields,
      missingFieldKeys: missingFieldKeys
    };
  }

  // Check if a field has validation error
  hasFieldError(fieldKey: string): boolean {
    return this.validationErrors.includes(fieldKey);
  }

  // Clear validation errors
  clearValidationErrors() {
    this.validationErrors = [];
  }

  // Save task changes
  saveTaskChanges() {
    console.log('=== saveTaskChanges START ===');
    
    // Clear previous validation errors
    this.clearValidationErrors();
    
    // Validate Assignee is selected (mandatory)
    if (!this.selectedAssigneeIds || this.selectedAssigneeIds.length === 0) {
      this.toasterService.showError(
        'Validation Error', 
        'Assigned To is mandatory. Please select at least one assignee.'
      );
      return;
    }
    
    // Daily Remarks is mandatory only when the logged-in user is an assignee.
    // If the user is only in "Assigned By" (they created the task for someone else),
    // they are not required to fill daily remarks.
    const currentUserForValidation = JSON.parse(localStorage.getItem('current_user') || '{}');
    const loggedInIdForValidation = (currentUserForValidation.empId || currentUserForValidation.employeeId || this.userId || '').toString();
    const loggedInUserIsAssignee = this.selectedAssigneeIds.some(id => id.toString() === loggedInIdForValidation);

    if (loggedInUserIsAssignee &&
        (this.selectedTaskDetailStatus === 'not-closed' || this.selectedTaskDetailStatus === 'completed') &&
        !this.dailyRemarks.trim()) {
      this.toasterService.showError(
        'Validation Error',
        'Daily Remarks is mandatory when closing or completing a task'
      );
      return;
    }
    
    // Validate mandatory fields if status is Closed or Completed
    const validation = this.validateMandatoryFields();
    if (!validation.isValid) {
      // Set validation errors to highlight fields
      this.validationErrors = validation.missingFieldKeys;
      
      const fieldsList = validation.missingFields.join(', ');
      this.toasterService.showError(
        'Validation Error', 
        `Please fill in the following mandatory fields: ${fieldsList}`
      );
      return;
    }
    
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const userId = currentUser.empId || currentUser.employeeId || this.userId;
    
    console.log('Current user:', { userId, currentUser });
    
    // Proceed directly to save task with dailyRemarks included
    this.proceedWithTaskSave(userId);
  }
  
  // Proceed with task save
  private proceedWithTaskSave(userId: string) {
    // Map status from component format to API format
    const statusMap: { [key: string]: string } = {
      'not-started': 'NOT STARTED',
      'running': 'RUNNING',
      'pause': 'PAUSED',
      'paused': 'PAUSED',
      'completed': 'COMPLETED',
      'not-closed': 'CLOSED',
      're-open': 'RE OPEN',
      'auto-closed': 'AUTO CLOSED'
    };
    
    const apiStatus = statusMap[this.selectedTaskDetailStatus] || 'NOT STARTED';
    
    // When status is Closed or Completed, add dailyCount to the existing count
    const isClosingStatus = this.selectedTaskDetailStatus === 'not-closed' || 
                            this.selectedTaskDetailStatus === 'completed';
    const computedCount = isClosingStatus
      ? (this.selectedTaskCount || 0) + (this.dailyCount || 0)
      : (this.selectedTaskCount || 0);
    
    // Prepare assignees array - use multi-select list
    const assignees = this.selectedAssigneeIds.filter(id => id && id.trim() !== '');

    // Build a human-readable summary of everything the user changed in this edit
    const taskChangesSummary = this.buildTaskChangesSummary(userId);
    
    // Format dates properly for API (YYYY-MM-DD format)
    const formatDateForApi = (date: string | Date | undefined): string | undefined => {
      if (!date) return undefined;
      if (typeof date === 'string') {
        // If already a string, check if it's in the right format
        if (date.match(/^\d{4}-\d{2}-\d{2}/)) return date;
        // Try to parse and reformat
        const parsed = new Date(date);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      } else if (date instanceof Date) {
        return date.toISOString().split('T')[0];
      }
      return undefined;
    };
    
    const taskSaveRequest: TaskSaveDto = {
      taskId: this.taskId,
      categoryId: this.categoryId,
      taskTitle: this.editableTaskTitle?.trim() || '',
      description: this.editableTaskDescription?.trim() || '',
      projectId: parseInt(this.selectedProjectId) || 0,
      departmentId: 0, // Will be set by backend based on category
      count: computedCount,
      targetDate: formatDateForApi(this.selectedTaskEndDate),
      startDate: formatDateForApi(this.selectedTaskStartDate),
      progress: this.taskProgress || 0,
      estimatedHours: this.selectedTaskEstimatedHours || 0,
      status: apiStatus,
      createdBy: this.selectedCreatedById || userId,
      assignees: assignees,
      customFields: this.selectedCustomFields.map(field => ({
        fieldId: field.fieldId || 0,
        value: field.value?.toString() || ''
      })),
      dailyRemarks: this.dailyRemarks?.trim() || '',
      dailyCount: this.dailyCount || 0,
      taskChanges: taskChangesSummary,
      userID: userId
    };
    
    console.log('Task save request:', taskSaveRequest);
    console.log('Calling saveTaskBulk API...');

    this.api.saveTaskBulk(taskSaveRequest).subscribe({
      next: (response: any) => {
        console.log('=== saveTaskBulk API Response ===');
        console.log('Response:', response);
        
        if (response && response.success) {
          // Check if this was a new task (first time save)
          const isNewTask = this.taskId === 0;
          
          this.toasterService.showSuccess('Success', 'Task updated successfully');
          
          // Recheck AUTO CLOSED count after saving task
          this.checkAutoClosedTasksCount();
          
          // Check if we need to call saveTaskFieldMapping
          // For ANY save (new or existing task): call for every newly added assignee
          // who was not previously mapped (not in originalAssigneeIds at load time).
          const sessionUserId = userId;

          // Collect field IDs that are currently mapped for this category
          const fieldIds = this.selectedCustomFields
            .filter(field => field.fieldId && field.fieldId > 0)
            .map(field => field.fieldId!);

          if (fieldIds.length > 0) {
            // Determine which assignees are truly NEW (not in the snapshot taken at load)
            const newlyAddedAssignees = this.selectedAssigneeIds.filter(id =>
              id &&
              id.trim() !== '' &&
              !this.originalAssigneeIds.includes(id)
            );

            // For a brand-new task (taskId === 0) all assignees are new
            const assigneesToMap = isNewTask
              ? this.selectedAssigneeIds.filter(id => id && id.trim() !== '')
              : newlyAddedAssignees;

            if (assigneesToMap.length > 0) {
              console.log(`saveTaskFieldMapping → calling for ${assigneesToMap.length} new assignee(s):`, assigneesToMap);
              assigneesToMap.forEach(assigneeUserId => {
                const fieldMappingRequest: any = {
                  categoryId: this.categoryId,
                  fieldIds: fieldIds,
                  userId: assigneeUserId
                };
                console.log('Field mapping request for user', assigneeUserId, ':', fieldMappingRequest);
                this.api.saveTaskFieldMapping(fieldMappingRequest).subscribe({
                  next: (mappingResponse: any) => {
                    if (mappingResponse && mappingResponse.success) {
                      console.log('Field mapping saved for user:', assigneeUserId);
                    } else {
                      console.warn('Field mapping failed for user:', assigneeUserId, mappingResponse?.message);
                    }
                  },
                  error: (mappingError: any) => {
                    console.error('Error saving field mapping for user:', assigneeUserId, mappingError);
                  }
                });
              });
            } else {
              console.log('saveTaskFieldMapping → no new assignees to map, skipping.');
            }
          }
          
          // Notify users who were newly added as assignees (first time assigned)
          const savedTaskId = response?.data?.taskId || response?.data?.id || this.taskId;
          this.notifyNewlyAddedAssignees(savedTaskId, sessionUserId, taskSaveRequest.taskTitle);

          // Emit task updated event to parent component to refresh listing
          this.taskUpdated.emit(taskSaveRequest);
          console.log('Task saved successfully - emitting taskUpdated event');
          
          // Always close modal after successful save
          console.log('Closing modal after save');
          this.close();
        } else {
          const errorMessage = response?.message || 'Failed to update task';
          this.toasterService.showError('Error', errorMessage);
          console.error('Save failed:', errorMessage);
        }
      },
      error: (error: any) => {
        console.error('=== saveTaskBulk API ERROR ===');
        console.error('Error details:', error);
        console.error('Error status:', error?.status);
        console.error('Error message:', error?.message);
        console.error('Error response:', error?.error);
        
        const errorMessage = error?.error?.message || error?.message || 'Failed to update task';
        this.toasterService.showError('Error', errorMessage);
      }
    });
  }

  /**
   * Send an in-app notification to every assignee who was newly added during this
   * save (present in the current list but not in the snapshot taken when the task
   * loaded). The session user is skipped — no need to notify yourself. Clicking the
   * notification opens the task via the /my-task?taskId=... link.
   */
  private notifyNewlyAddedAssignees(taskId: number, sessionUserId: string, taskTitle: string) {
    if (!taskId) return;

    const newlyAdded = this.selectedAssigneeIds.filter(id =>
      id &&
      !this.originalAssigneeIds.includes(id) &&
      id !== sessionUserId
    );

    if (newlyAdded.length === 0) return;

    const assignedByName = this.getCreatedByDisplayName();
    const title = (taskTitle || '').trim() || `Task #${taskId}`;

    newlyAdded.forEach(assigneeId => {
      const notification = {
        userId: assigneeId,
        title: 'New Task Assigned',
        message: `You have been assigned to the task "${title}" by ${assignedByName}. Click to view.`,
        link: `/my-task?taskId=${taskId}`,
        isRead: false
      };

      this.api.createNotification(notification).subscribe({
        next: (res: any) => console.log('Assignment notification sent to', assigneeId, res),
        error: (err: any) => console.error('Failed to send assignment notification to', assigneeId, err)
      });
    });

    // Update the snapshot so a subsequent save in the same session won't re-notify
    this.originalAssigneeIds = [...this.selectedAssigneeIds];
  }

  // ── Task change tracking (for the Activity Log "taskChanges" summary) ─────

  /** Snapshot every editable field at load time so we can diff against it on save */
  private captureTaskSnapshot() {
    this.originalTaskSnapshot = {
      title: this.editableTaskTitle || '',
      description: this.editableTaskDescription || '',
      status: this.selectedTaskDetailStatus,
      progress: this.taskProgress || 0,
      projectId: (this.selectedProjectId || '').toString(),
      startDate: this.selectedTaskStartDate || '',
      targetDate: this.selectedTaskEndDate || '',
      estimatedMinutes: this.selectedTaskEstimatedHours || 0,
      createdById: (this.selectedCreatedById || '').toString(),
      assigneeIds: [...this.selectedAssigneeIds],
      customFields: this.selectedCustomFields.map(f => ({
        key: f.key,
        label: f.label,
        value: (f.value ?? '').toString()
      }))
    };
  }

  /** Project name for a given id (for readable change text) */
  private getProjectNameById(projectId: string): string {
    if (!projectId) return '(none)';
    const p = this.projectsList.find(pr => pr.projectId?.toString() === projectId.toString());
    return p?.projectName || projectId.toString();
  }

  /** Employee name for a given id */
  private getEmpNameById(empId: string): string {
    if (!empId) return '(none)';
    const e = this.employeeMasterList.find(emp => emp.idValue?.toString() === empId.toString());
    return e?.description || empId.toString();
  }

  /** Render a custom-field value for display (maps dropdown index → option text) */
  private displayFieldValue(field: any, val: any): string {
    if (val === null || val === undefined || val.toString().trim() === '') return '(empty)';
    if (field?.type === 'dropdown' && Array.isArray(field.options) && field.options.length) {
      const idx = parseInt(val, 10);
      if (!isNaN(idx) && field.options[idx] !== undefined) return field.options[idx];
    }
    return val.toString();
  }

  /**
   * Compare the current modal state against the snapshot taken at load and
   * produce a single readable summary of what changed. Sent as `taskChanges`
   * and shown in the Activity Log.
   */
  private buildTaskChangesSummary(userId: string): string {
    const sessionUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const who = sessionUser.employeeName || sessionUser.empName || userId || 'User';
    const snap = this.originalTaskSnapshot;

    // New task (no snapshot to diff against)
    if (!snap) {
      return `${who} created the task.`;
    }

    const changes: string[] = [];

    if ((this.editableTaskTitle || '') !== snap.title) {
      changes.push(`Title changed from "${snap.title || '(empty)'}" to "${this.editableTaskTitle || '(empty)'}"`);
    }
    if ((this.editableTaskDescription || '') !== snap.description) {
      changes.push('Description updated');
    }
    if (this.selectedTaskDetailStatus !== snap.status) {
      changes.push(`Status changed from "${this.getStatusDisplayText(snap.status)}" to "${this.getStatusDisplayText(this.selectedTaskDetailStatus)}"`);
    }
    if ((this.taskProgress || 0) !== (snap.progress || 0)) {
      changes.push(`Progress changed from ${snap.progress || 0}% to ${this.taskProgress || 0}%`);
    }
    if ((this.selectedProjectId || '').toString() !== (snap.projectId || '')) {
      changes.push(`Project changed from "${this.getProjectNameById(snap.projectId)}" to "${this.getProjectNameById(this.selectedProjectId)}"`);
    }
    if ((this.selectedTaskStartDate || '') !== (snap.startDate || '')) {
      changes.push(`Start Date changed from "${snap.startDate || '(none)'}" to "${this.selectedTaskStartDate || '(none)'}"`);
    }
    if ((this.selectedTaskEndDate || '') !== (snap.targetDate || '')) {
      changes.push(`Target Date changed from "${snap.targetDate || '(none)'}" to "${this.selectedTaskEndDate || '(none)'}"`);
    }
    if ((this.selectedTaskEstimatedHours || 0) !== (snap.estimatedMinutes || 0)) {
      changes.push(`Estimated Hours changed from ${this.minutesToHHMM(snap.estimatedMinutes) || '0:00'} to ${this.minutesToHHMM(this.selectedTaskEstimatedHours) || '0:00'}`);
    }
    if ((this.selectedCreatedById || '').toString() !== (snap.createdById || '')) {
      changes.push(`Assigned By changed from "${this.getEmpNameById(snap.createdById)}" to "${this.getEmpNameById(this.selectedCreatedById)}"`);
    }

    // Assignees added / removed
    const added = this.selectedAssigneeIds.filter(id => !snap.assigneeIds.includes(id));
    const removed = snap.assigneeIds.filter((id: string) => !this.selectedAssigneeIds.includes(id));
    if (added.length) {
      changes.push(`Assignee(s) added: ${added.map(id => this.getEmpNameById(id)).join(', ')}`);
    }
    if (removed.length) {
      changes.push(`Assignee(s) removed: ${removed.map((id: string) => this.getEmpNameById(id)).join(', ')}`);
    }

    // Custom fields: changed / added
    const snapByKey: { [k: string]: any } = {};
    (snap.customFields || []).forEach((f: any) => { snapByKey[f.key] = f; });
    this.selectedCustomFields.forEach(f => {
      const curRaw = (f.value ?? '').toString();
      const old = snapByKey[f.key];
      if (!old) {
        changes.push(`Field "${f.label}" added with value "${this.displayFieldValue(f, curRaw)}"`);
      } else if ((old.value || '') !== curRaw) {
        changes.push(`Field "${f.label}" changed from "${this.displayFieldValue(f, old.value)}" to "${this.displayFieldValue(f, curRaw)}"`);
      }
    });
    // Custom fields removed
    (snap.customFields || []).forEach((of: any) => {
      if (!this.selectedCustomFields.some(f => f.key === of.key)) {
        changes.push(`Field "${of.label}" removed`);
      }
    });

    // Daily remarks (a per-save note)
    if ((this.dailyRemarks || '').trim()) {
      changes.push(`Daily remarks added: "${this.dailyRemarks.trim()}"`);
    }

    if (changes.length === 0) {
      return `${who} saved the task with no field changes.`;
    }

    return `${who} updated the task — ${changes.join('; ')}.`;
  }

  // Timer management
  startTimer(initialSeconds: number = 0) {
    this.timerElapsedSeconds = initialSeconds;
    this.timerStartTime = new Date();
    
    this.timerInterval = setInterval(() => {
      this.timerElapsedSeconds++;
      this.selectedTaskRunningTimer = this.formatTime(this.timerElapsedSeconds);
      this.cdr.detectChanges();
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // Handle status dropdown change
  onStatusChange(newStatus: string) {
    console.log('Status changed to:', newStatus);
    console.log('Previous status was:', this.previousTaskStatus);
    
    // Block changing to 'running' status if AUTO CLOSED tasks exist
    if (newStatus === 'running' && this.isBlockedByAutoClosedTasks) {
      Swal.fire({
        icon: 'warning',
        title: 'AUTO CLOSED Tasks Pending',
        html: `You have <strong>${this.autoClosedTaskCount}</strong> AUTO CLOSED task(s) that need to be closed.<br><br>Please close them before starting any tasks.`,
        confirmButtonText: 'OK',
        confirmButtonColor: '#dc2626'
      });
      // Revert status change
      this.loadTaskDetails();
      return;
    }
    
    // Block changing to 'pause' status if AUTO CLOSED tasks exist
    if ((newStatus === 'pause' || newStatus === 'paused') && this.isBlockedByAutoClosedTasks) {
      Swal.fire({
        icon: 'warning',
        title: 'AUTO CLOSED Tasks Pending',
        html: `You have <strong>${this.autoClosedTaskCount}</strong> AUTO CLOSED task(s) that need to be closed.<br><br>Please close them before pausing any tasks.`,
        confirmButtonText: 'OK',
        confirmButtonColor: '#dc2626'
      });
      // Revert status change
      this.loadTaskDetails();
      return;
    }
    
    // Handle CLOSED status change - pause first ONLY if task WAS running
    if (newStatus === 'not-closed') {
      // Check PREVIOUS status to see if task was RUNNING before dropdown change
      if (this.previousTaskStatus === 'running') {
        console.log('Task WAS RUNNING - calling executeTimer with PAUSED before closing');
        
        // Call executeTimer API with PAUSED action
        const timerRequest = {
          taskId: this.taskId,
          userId: this.userId,
          action: 'PAUSED'
        };
        
        this.api.executeTimer(timerRequest).subscribe({
          next: (response: any) => {
            if (response && response.success) {
              console.log('ExecuteTimer PAUSED called successfully, now changing to CLOSED');
              this.stopTimer();
              
              // Set status to CLOSED (not-closed)
              this.selectedTaskDetailStatus = 'not-closed';
              this.previousTaskStatus = 'not-closed'; // Update previous status
              
              this.toasterService.showInfo('Task Status Changed', 'Task paused and status changed to Closed');
              
              // Emit event to parent component to refresh task list
              this.taskStopped.emit(this.taskId);
              
              // Recheck AUTO CLOSED count after stopping
              this.checkAutoClosedTasksCount();
              
              // Trigger change detection to show Daily Remarks section
              this.cdr.detectChanges();
            } else {
              this.toasterService.showError('Status Change Failed', 'Failed to pause task before closing');
              console.error('Failed to execute timer pause:', response?.message);
              // Revert status on failure
              this.loadTaskDetails();
            }
          },
          error: (error: any) => {
            console.error('Error executing timer pause before closing:', error);
            this.toasterService.showError('Error', 'Failed to pause task before closing');
            // Revert status on failure
            this.loadTaskDetails();
          }
        });
      } else {
        // Task was NOT running (already paused, not started, etc.) - just change status to CLOSED
        console.log('Task was not running - changing status to CLOSED without calling executeTimer');
        this.stopTimer();
        this.selectedTaskDetailStatus = 'not-closed';
        this.previousTaskStatus = 'not-closed'; // Update previous status
        this.toasterService.showInfo('Task Status Changed', 'Task status changed to Closed');
        
        // Emit event to parent component to refresh task list
        this.taskStopped.emit(this.taskId);
        
        // Recheck AUTO CLOSED count after stopping
        this.checkAutoClosedTasksCount();
        
        // Trigger change detection to show Daily Remarks section
        this.cdr.detectChanges();
      }
      return;
    }
    
    // Only call executeTimer for RUNNING and PAUSE status changes
    if (newStatus === 'running') {
      // Call executeTimer with START action
      const timerRequest = {
        taskId: this.taskId,
        userId: this.userId,
        action: 'START'
      };
      
      this.api.executeTimer(timerRequest).subscribe({
        next: (response: any) => {
          if (response && response.success) {
            this.selectedTaskDetailStatus = 'running';
            this.previousTaskStatus = 'running'; // Update previous status
            this.toasterService.showSuccess('Task Started', 'Task timer has been started successfully!');
            
            // Recheck AUTO CLOSED count after starting
            this.checkAutoClosedTasksCount();
            
            // Emit event to parent component
            this.taskResumed.emit(this.taskId);
            
            // Trigger change detection
            this.cdr.detectChanges();
          } else {
            this.toasterService.showError('Start Failed', response?.message || 'Failed to start task');
            // Revert on failure
            this.loadTaskDetails();
          }
        },
        error: (error: any) => {
          console.error('Error starting task:', error);
          this.toasterService.showError('Error', 'Failed to start task');
          // Revert on failure
          this.loadTaskDetails();
        }
      });
    } else if (newStatus === 'pause' || newStatus === 'paused') {
      // Call executeTimer with PAUSED action
      const timerRequest = {
        taskId: this.taskId,
        userId: this.userId,
        action: 'PAUSED'
      };
      
      this.api.executeTimer(timerRequest).subscribe({
        next: (response: any) => {
          if (response && response.success) {
            this.stopTimer();
            this.selectedTaskDetailStatus = 'pause';
            this.previousTaskStatus = 'pause'; // Update previous status
            this.toasterService.showSuccess('Task Paused', 'Task timer has been paused successfully!');
            
            // Recheck AUTO CLOSED count after pausing
            this.checkAutoClosedTasksCount();
            
            // Emit event to parent component
            this.taskPaused.emit(this.taskId);
            
            // Trigger change detection
            this.cdr.detectChanges();
          } else {
            this.toasterService.showError('Pause Failed', response?.message || 'Failed to pause task');
            // Revert on failure
            this.loadTaskDetails();
          }
        },
        error: (error: any) => {
          console.error('Error pausing task:', error);
          this.toasterService.showError('Error', 'Failed to pause task');
          // Revert on failure
          this.loadTaskDetails();
        }
      });
    } else if (newStatus === 'completed') {
      // Handle COMPLETED status - pause timer first if task WAS running
      if (this.previousTaskStatus === 'running') {
        console.log('Task WAS RUNNING - calling executeTimer with PAUSED before marking as completed');

        const timerRequest = {
          taskId: this.taskId,
          userId: this.userId,
          action: 'PAUSED'
        };

        this.api.executeTimer(timerRequest).subscribe({
          next: (response: any) => {
            if (response && response.success) {
              console.log('ExecuteTimer PAUSED called successfully, now marking as completed');
              this.stopTimer();

              this.selectedTaskDetailStatus = 'completed';
              this.previousTaskStatus = 'completed';

              this.toasterService.showInfo('Task Status Changed', 'Task paused and status changed to Completed');

              // Emit event to parent component
              this.taskPaused.emit(this.taskId);

              // Recheck AUTO CLOSED count
              this.checkAutoClosedTasksCount();

              this.cdr.detectChanges();
            } else {
              this.toasterService.showError('Status Change Failed', 'Failed to pause task before completing');
              console.error('Failed to execute timer pause:', response?.message);
              this.loadTaskDetails();
            }
          },
          error: (error: any) => {
            console.error('Error executing timer pause before completing:', error);
            this.toasterService.showError('Error', 'Failed to pause task before completing');
            this.loadTaskDetails();
          }
        });
      } else {
        // Task was not running - just change status to completed
        console.log('Task was not running - changing status to COMPLETED without calling executeTimer');
        this.stopTimer();
        this.selectedTaskDetailStatus = 'completed';
        this.previousTaskStatus = 'completed';
        this.toasterService.showInfo('Task Status Changed', 'Task status changed to Completed');
        this.cdr.detectChanges();
      }
    } else {
      // For other status changes (not-started, etc.), just update the status without calling executeTimer
      this.selectedTaskDetailStatus = newStatus;
      this.previousTaskStatus = newStatus; // Update previous status
      this.toasterService.showInfo('Status Changed', `Task status changed to ${newStatus}`);
      this.cdr.detectChanges();
    }
  }

  // Task control methods
  startTaskFromModal() {
    // Check if blocked by AUTO CLOSED tasks
    if (this.isBlockedByAutoClosedTasks) {
      Swal.fire({
        icon: 'warning',
        title: 'AUTO CLOSED Tasks Pending',
        html: `You have <strong>${this.autoClosedTaskCount}</strong> AUTO CLOSED task(s) that need to be closed.<br><br>Please close them before starting any new tasks.`,
        confirmButtonText: 'OK',
        confirmButtonColor: '#dc2626'
      });
      return;
    }
    
    // Call executeTimer API with START action
    const timerRequest = {
      taskId: this.taskId,
      userId: this.userId,
      action: 'START'
    };
    
    this.api.executeTimer(timerRequest).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          this.selectedTaskDetailStatus = 'running';
          this.toasterService.showSuccess('Task Started', 'Task timer has been started successfully!');
          
          // Reload task details to get updated data
          this.loadTaskDetails();
          
          // Recheck AUTO CLOSED count after starting
          this.checkAutoClosedTasksCount();
          
          // Emit event to parent component (reuse taskResumed event)
          this.taskResumed.emit(this.taskId);
        } else {
          this.toasterService.showError('Start Failed', response?.message || 'Failed to start task');
        }
      },
      error: (error: any) => {
        console.error('Error starting task:', error);
        this.toasterService.showError('Error', 'Failed to start task');
      }
    });
  }

  pauseTaskFromModal() {
    // Check if blocked by AUTO CLOSED tasks
    if (this.isBlockedByAutoClosedTasks) {
      Swal.fire({
        icon: 'warning',
        title: 'AUTO CLOSED Tasks Pending',
        html: `You have <strong>${this.autoClosedTaskCount}</strong> AUTO CLOSED task(s) that need to be closed.<br><br>Please close them before pausing any tasks.`,
        confirmButtonText: 'OK',
        confirmButtonColor: '#dc2626'
      });
      return;
    }
    
    // Call executeTimer API with PAUSED action
    const timerRequest = {
      taskId: this.taskId,
      userId: this.userId,
      action: 'PAUSED'
    };
    
    this.api.executeTimer(timerRequest).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          this.stopTimer();
          this.selectedTaskDetailStatus = 'pause';
          this.toasterService.showSuccess('Task Paused', 'Task timer has been paused successfully!');
          
          // Reload task details to get updated data
          this.loadTaskDetails();
          
          // Recheck AUTO CLOSED count after pausing
          this.checkAutoClosedTasksCount();
          
          // Emit event to parent component
          this.taskPaused.emit(this.taskId);
        } else {
          this.toasterService.showError('Pause Failed', response?.message || 'Failed to pause task');
        }
      },
      error: (error: any) => {
        console.error('Error pausing task:', error);
        this.toasterService.showError('Error', 'Failed to pause task');
      }
    });
  }

  resumeTaskFromModal() {
    // Check if blocked by AUTO CLOSED tasks
    if (this.isBlockedByAutoClosedTasks) {
      Swal.fire({
        icon: 'warning',
        title: 'AUTO CLOSED Tasks Pending',
        html: `You have <strong>${this.autoClosedTaskCount}</strong> AUTO CLOSED task(s) that need to be closed.<br><br>Please close them before resuming any tasks.`,
        confirmButtonText: 'OK',
        confirmButtonColor: '#dc2626'
      });
      return;
    }
    
    // Call executeTimer API with START action
    const timerRequest = {
      taskId: this.taskId,
      userId: this.userId,
      action: 'START'
    };
    
    this.api.executeTimer(timerRequest).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          this.selectedTaskDetailStatus = 'running';
          this.toasterService.showSuccess('Task Resumed', 'Task timer has been resumed successfully!');
          
          // Reload task details to get updated data
          this.loadTaskDetails();
          
          // Recheck AUTO CLOSED count after resuming
          this.checkAutoClosedTasksCount();
          
          // Emit event to parent component
          this.taskResumed.emit(this.taskId);
        } else {
          this.toasterService.showError('Resume Failed', response?.message || 'Failed to resume task');
        }
      },
      error: (error: any) => {
        console.error('Error resuming task:', error);
        this.toasterService.showError('Error', 'Failed to resume task');
      }
    });
  }

  stopTaskFromModal() {
    // If task is currently RUNNING, pause it first before changing to CLOSED
    if (this.selectedTaskDetailStatus === 'running') {
      console.log('Task is RUNNING - pausing before closing');
      
      // Call executeTimer API with PAUSED action
      const timerRequest = {
        taskId: this.taskId,
        userId: this.userId,
        action: 'PAUSED'
      };
      
      this.api.executeTimer(timerRequest).subscribe({
        next: (response: any) => {
          if (response && response.success) {
            console.log('Task paused successfully, now changing to CLOSED');
            this.stopTimer();
            this.selectedTaskDetailStatus = 'not-closed';
            this.toasterService.showInfo('Task Status Changed', 'Task paused and status changed to Closed');
            
            // Emit event to parent component to refresh task list
            this.taskStopped.emit(this.taskId);
            
            // Recheck AUTO CLOSED count after stopping
            this.checkAutoClosedTasksCount();
          } else {
            this.toasterService.showError('Pause Failed', 'Failed to pause task before closing');
            console.error('Failed to pause task:', response?.message);
          }
        },
        error: (error: any) => {
          console.error('Error pausing task before closing:', error);
          this.toasterService.showError('Error', 'Failed to pause task before closing');
        }
      });
    } else {
      // Task is not running, just change status to CLOSED
      this.stopTimer();
      this.selectedTaskDetailStatus = 'not-closed';
      this.toasterService.showInfo('Task Status Changed', 'Task status changed to Closed');
      
      // Emit event to parent component to refresh task list
      this.taskStopped.emit(this.taskId);
      
      // Recheck AUTO CLOSED count after stopping
      this.checkAutoClosedTasksCount();
    }
  }

  // Add comment
  addComment() {
    // Don't submit while the mention dropdown is open (Enter is used to pick)
    if (this.showMentionDropdown) return;
    if (!this.newComment.trim()) return;

    const sessionUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const sessionUserId = sessionUser.empId || sessionUser.employeeId || this.userId;

    // Capture text + mentions before we clear the box
    const commentText = this.newComment;

    const commentData: TaskCommentDto = {
      commentId: 0,
      taskId: this.taskId,
      userId: sessionUserId,
      comments: commentText,
      submittedOn: new Date().toISOString(),
      empName: '',
      profileImage: undefined,
      profileImageBase64: undefined
    };

    this.api.saveComment(commentData).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          this.toasterService.showSuccess('Success', 'Comment added');
          // Notify any users that were @mentioned in this comment
          this.notifyMentionedUsers(commentText, sessionUserId);
          this.newComment = '';
          this.loadComments(this.taskId);
        }
      },
      error: (error: any) => {
        console.error('Error adding comment:', error);
        this.toasterService.showError('Error', 'Failed to add comment');
      }
    });
  }

  // ── @mention in comments ─────────────────────────────────────────────────

  /** Enter submits the comment; Shift+Enter inserts a new line */
  onCommentEnter(event: any) {
    if (event.shiftKey) return;           // allow multi-line with Shift+Enter
    if (this.showMentionDropdown) {       // Enter shouldn't submit mid-mention
      event.preventDefault();
      return;
    }
    event.preventDefault();
    this.addComment();
  }

  /** Detect an in-progress "@..." token at the cursor and open the user dropdown */
  onCommentInput(event: any) {
    const input = event.target as HTMLInputElement;
    const value = input.value ?? '';
    const cursorPos = input.selectionStart ?? value.length;
    this.newComment = value;

    const textBeforeCursor = value.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex >= 0) {
      const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
      const term = textBeforeCursor.substring(atIndex + 1);
      // Valid mention: '@' at start or after whitespace, and no space typed yet
      if ((atIndex === 0 || /\s/.test(charBefore)) && !/\s/.test(term)) {
        this.mentionStartPos = atIndex;
        this.mentionSearchTerm = term;
        this.showMentionDropdown = true;
        return;
      }
    }
    this.closeMentionDropdown();
  }

  /** Employees matching the text typed after '@' (capped for performance) */
  getFilteredMentionList() {
    const term = this.mentionSearchTerm.toLowerCase();
    const list = !term
      ? this.employeeMasterList
      : this.employeeMasterList.filter(e => e.description?.toLowerCase().includes(term));
    return list.slice(0, 50);
  }

  /** Replace the in-progress "@token" with the chosen user's name and remember them */
  selectMention(employee: any) {
    const name = (employee.description || '').toString();
    const id = (employee.idValue || '').toString();
    if (this.mentionStartPos < 0) {
      this.closeMentionDropdown();
      return;
    }

    const before = this.newComment.substring(0, this.mentionStartPos);
    const afterStart = this.mentionStartPos + 1 + this.mentionSearchTerm.length;
    const after = this.newComment.substring(afterStart);
    this.newComment = `${before}@${name} ${after}`;

    if (id && !this.mentionedUsers.some(u => u.id === id)) {
      this.mentionedUsers.push({ id, name });
    }
    this.closeMentionDropdown();
  }

  hideMentionDropdown() {
    // Delay so a click/mousedown on a list item registers before we hide
    setTimeout(() => this.closeMentionDropdown(), 200);
  }

  private closeMentionDropdown() {
    this.showMentionDropdown = false;
    this.mentionSearchTerm = '';
    this.mentionStartPos = -1;
  }

  /** Send a notification to each user @mentioned in the submitted comment */
  private notifyMentionedUsers(commentText: string, sessionUserId: string) {
    if (!this.mentionedUsers.length) {
      return;
    }

    const sessionUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const fromName = sessionUser.employeeName || sessionUser.empName || sessionUserId;
    const title = (this.editableTaskTitle || '').trim() || `Task #${this.taskId}`;

    // Only notify users still present in the text, not yourself, and de-duped
    const toNotify = this.mentionedUsers.filter(u =>
      u.id && u.id !== sessionUserId && commentText.includes(`@${u.name}`)
    );

    toNotify.forEach(u => {
      const notification = {
        userId: u.id,
        title: 'You were mentioned in a comment',
        message: `${fromName} mentioned you in a comment on the task "${title}". Click to view.`,
        link: `/my-task?taskId=${this.taskId}`,
        isRead: false
      };
      this.api.createNotification(notification).subscribe({
        next: (res: any) => console.log('Mention notification sent to', u.id, res),
        error: (err: any) => console.error('Failed to send mention notification to', u.id, err)
      });
    });

    this.mentionedUsers = [];
  }

  // File upload methods
  triggerFileUpload() {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.uploadFiles(files);
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
      this.uploadFiles(files);
    }
  }

  uploadFiles(files: FileList) {
    // Upload each file to the API
    Array.from(files).forEach(file => {
      const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
      const userId = currentUser.empId || currentUser.employeeId || this.userId;
      
      this.api.uploadTimeSheetFile(this.taskId, userId, file).subscribe({
        next: (response: any) => {
          if (response && response.success) {
            this.toasterService.showSuccess('Success', `File "${file.name}" uploaded successfully`);
            // Reload the files list
            this.loadTaskFiles(this.taskId);
          } else {
            this.toasterService.showError('Error', `Failed to upload file "${file.name}"`);
          }
        },
        error: (error: any) => {
          console.error('Error uploading file:', error);
          this.toasterService.showError('Error', `Failed to upload file "${file.name}"`);
        }
      });
    });
  }

  downloadFile(file: UploadedFile) {
    // Download file using the base64 content or URL
    if (file.url) {
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      link.click();
      this.toasterService.showSuccess('Success', 'File download started');
    } else {
      this.toasterService.showError('Error', 'File content not available');
    }
  }

  deleteFile(file: UploadedFile) {
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const userId = currentUser.empId || currentUser.employeeId || this.userId;
    
    // Show SweetAlert confirmation dialog
    Swal.fire({
      title: 'Delete File?',
      text: `Are you sure you want to delete "${file.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.api.deleteTaskFile(parseInt(file.id), userId).subscribe({
          next: (response: any) => {
            if (response && response.success) {
              this.toasterService.showSuccess('Success', 'File deleted successfully');
              // Reload the files list
              this.loadTaskFiles(this.taskId);
            } else {
              this.toasterService.showError('Error', 'Failed to delete file');
            }
          },
          error: (error: any) => {
            console.error('Error deleting file:', error);
            this.toasterService.showError('Error', 'Failed to delete file');
          }
        });
      }
    });
  }

  // Progress control
  startProgressDrag(event: MouseEvent) {
    if (this.isViewOnly) return; // Prevent dragging in view-only mode
    this.isDraggingProgress = true;
  }

  onProgressDrag(event: MouseEvent) {
    if (this.isDraggingProgress && !this.isViewOnly) {
      // Calculate progress based on mouse position
      // Implementation here
    }
  }

  endProgressDrag() {
    this.isDraggingProgress = false;
  }

  onManualProgressChange(event: any) {
    if (this.isViewOnly) return; // Prevent changes in view-only mode
    this.selectedTaskProgress = this.taskProgress;
    this.isProgressChanging = true;
    setTimeout(() => {
      this.isProgressChanging = false;
    }, 300);
  }

  setQuickProgress(value: number) {
    if (this.isViewOnly) return; // Prevent changes in view-only mode
    this.taskProgress = value;
    this.selectedTaskProgress = value;
  }

  getProgressLabel(): string {
    const p = this.selectedTaskProgress;
    if (p === 0)   return 'Just getting started';
    if (p <= 25)   return 'Making progress';
    if (p <= 50)   return 'Halfway there';
    if (p <= 75)   return 'Almost done';
    if (p < 100)   return 'Final stretch';
    return 'Completed!';
  }

  // Custom fields management
  openAddFieldModal() {
    this.showAddFieldModal = true;
    this.tempSelectedFields = [];
  }

  closeAddFieldModal() {
    this.showAddFieldModal = false;
    this.tempSelectedFields = [];
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

  isFieldMapped(fieldKey: string): boolean {
    return this.selectedCustomFields.some(f => f.key === fieldKey && f.isMapped === 'Y');
  }

  applySelectedFields() {
    // Get the field IDs of the newly selected fields
    const newFieldIds: number[] = [];
    
    this.tempSelectedFields.forEach(fieldKey => {
      const field = this.availableCustomFields.find(f => f.key === fieldKey);
      if (field && !this.selectedCustomFields.some(f => f.key === fieldKey)) {
        // Add to local array
        this.selectedCustomFields.push({ ...field, value: '', isMapped: 'Y' });
        // Collect field ID for API call
        if (field.fieldId) {
          newFieldIds.push(field.fieldId);
        }
      }
    });
    
    // If there are new fields to map, call the API
    if (newFieldIds.length > 0) {
      const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
      const userId = currentUser.empId || currentUser.employeeId || this.userId;
      
      const request = {
        categoryId: this.categoryId,
        fieldIds: newFieldIds,
        userId: userId
      };
      
      this.api.saveTaskFieldMapping(request).subscribe({
        next: (response: any) => {
          if (response && response.success) {
            this.toasterService.showSuccess('Success', 'Fields added successfully');
            // Reload custom fields to get updated mapping
            this.loadCustomFields();
          } else {
            this.toasterService.showError('Error', 'Failed to add fields');
          }
        },
        error: (error: any) => {
          console.error('Error saving field mapping:', error);
          this.toasterService.showError('Error', 'Failed to add fields');
        }
      });
    }
    
    this.closeAddFieldModal();
  }

  removeCustomField(fieldKey: string) {
    // Remove from local array
    this.selectedCustomFields = this.selectedCustomFields.filter(f => f.key !== fieldKey);
    
    // Note: If you want to remove the mapping from the API as well,
    // you would need to call an API endpoint here
    // For now, this just removes it from the current view
  }

  // Dropdown methods
  showProjectDropdown() {
    if (this.isViewOnly) return; // Prevent dropdown in view-only mode
    this.isProjectDropdownVisible = true;
    // If a project is already selected, show its name in search term for editing
    // Otherwise, keep it empty for new search
    if (this.selectedProjectId) {
      const selectedProject = this.projectsList.find(p => p.projectId?.toString() === this.selectedProjectId);
      this.projectSearchTerm = selectedProject?.projectName || '';
    } else {
      this.projectSearchTerm = '';
    }
  }

  hideProjectDropdown() {
    setTimeout(() => {
      this.isProjectDropdownVisible = false;
      this.projectSearchTerm = ''; // Clear search term when closing dropdown
    }, 200);
  }

  showAssigneeDropdown() {
    if (this.isViewOnly) return;
    this.isAssigneeDropdownVisible = true;
    // Don't reset the search term here — user may already be typing
  }

  hideAssigneeDropdown() {
    this.isAssigneeDropdownVisible = false;
    this.assigneeSearchTerm = '';
  }

  toggleAssigneeDropdown(event: MouseEvent) {
    event.stopPropagation();
    if (this.isViewOnly) return;
    if (this.isAssigneeDropdownVisible) {
      this.hideAssigneeDropdown();
    } else {
      this.isAssigneeDropdownVisible = true;
      this.assigneeSearchTerm = '';
    }
  }

  /** Close dropdowns when clicking anywhere outside the component */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.multi-assignee-dropdown')) {
      this.isAssigneeDropdownVisible = false;
      this.assigneeSearchTerm = '';
    }
    if (!target.closest('.created-by-dropdown')) {
      this.isCreatedByDropdownVisible = false;
      this.createdBySearchTerm = '';
    }
  }

  // Check if Start Date should be disabled
  isStartDateDisabled(): boolean {
    return this.selectedTaskDetailStatus !== 'not-started';
  }

  onProjectSearchInputChange(event: any) {
    this.projectSearchTerm = event.target.value;
  }

  onAssigneeSearchInputChange(event: any) {
    this.assigneeSearchTerm = event.target.value;
  }

  getFilteredProjects() {
    if (!this.projectSearchTerm) return this.projectsList;
    return this.projectsList.filter(p =>
      p.projectName?.toLowerCase().includes(this.projectSearchTerm.toLowerCase())
    );
  }

  getFilteredAssignees() {
    const list = this.assigneeSearchTerm
      ? this.employeeMasterList.filter(e =>
          e.description?.toLowerCase().includes(this.assigneeSearchTerm.toLowerCase())
        )
      : this.employeeMasterList;
    // Exclude already-selected assignees and inactive employees (isActive === 'N') from the dropdown list
    return list.filter(e =>
      !this.selectedAssigneeIds.includes(e.idValue?.toString() || '') &&
      (e.isActive || '').toString().toUpperCase() !== 'N'
    );
  }

  selectProject(project: any) {
    this.selectedProjectId = project.projectId?.toString() || '';
    this.projectSearchTerm = '';
    this.isProjectDropdownVisible = false;
  }

  selectAssignee(employee: any, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const id = employee.idValue?.toString() || '';
    if (id && !this.selectedAssigneeIds.includes(id)) {
      this.selectedAssigneeIds = [...this.selectedAssigneeIds, id];
    }
    this.assigneeSearchTerm = '';
    // Keep dropdown open so user can add more
  }

  removeAssignee(id: string) {
    // Check if this assignee is currently RUNNING — block removal if so
    const assignee = this.taskAssignees.find(
      (a: any) => (a.userId || '').toString().trim().toUpperCase() === id.toString().trim().toUpperCase()
    );
    if (assignee && (assignee.status || '').toUpperCase().trim() === 'RUNNING') {
      const name = assignee.userName || id;
      Swal.fire({
        icon: 'warning',
        title: 'Cannot Remove Assignee',
        html: `<strong>${name}</strong> is currently running this task.<br>Please wait until they stop or pause before removing them.`,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'OK'
      });
      return;
    }
    this.selectedAssigneeIds = this.selectedAssigneeIds.filter(a => a !== id);
  }

  isProjectSelected(project: any): boolean {
    return this.selectedProjectId === project.projectId?.toString();
  }

  isAssigneeSelected(employee: any): boolean {
    return this.selectedAssigneeIds.includes(employee.idValue?.toString() || '');
  }

  getAssigneeName(id: string): string {
    const emp = this.employeeMasterList.find(e => e.idValue?.toString() === id);
    return emp?.description || id;
  }

  isAssigneeActive(id: string): boolean {
    // Check isActive from taskAssignees (API response) — this is the source of truth
    // Note: API returns "Y " or "N " with possible trailing space, so always trim
    const assignee = this.taskAssignees.find(
      (a: any) => (a.userId || '').toString().trim().toUpperCase() === id.toString().trim().toUpperCase()
    );
    if (assignee) {
      return (assignee.isActive || '').toString().trim().toUpperCase() !== 'N';
    }
    // If not in taskAssignees (e.g. newly added this session), default to visible
    return true;
  }

  getProjectDisplayName(): string {
    if (!this.selectedProjectId) return 'Select project...';
    const project = this.projectsList.find(p => p.projectId?.toString() === this.selectedProjectId);
    return project?.projectName || 'Select project...';
  }

  getAssigneeDisplayName(): string {
    if (!this.selectedAssigneeIds || this.selectedAssigneeIds.length === 0) return 'Select assignee...';
    return this.selectedAssigneeIds
      .map(id => this.getAssigneeName(id))
      .join(', ');
  }

  // ── Assigned By (single select, defaults to logged-in user) ──────────────

  showCreatedByDropdown() {
    if (this.isViewOnly) return;
    this.isCreatedByDropdownVisible = true;
    // Pre-fill the search box with the currently selected user's name so it
    // stays visible on focus (same behavior as the Project dropdown)
    if (this.selectedCreatedById) {
      const emp = this.employeeMasterList.find(e => e.idValue?.toString() === this.selectedCreatedById);
      this.createdBySearchTerm = emp?.description || '';
    } else {
      this.createdBySearchTerm = '';
    }
  }

  hideCreatedByDropdown() {
    setTimeout(() => {
      this.isCreatedByDropdownVisible = false;
      this.createdBySearchTerm = '';
    }, 200);
  }

  onCreatedBySearchInputChange(event: any) {
    this.createdBySearchTerm = event.target.value;
  }

  getFilteredCreatedByList() {
    if (!this.createdBySearchTerm) return this.employeeMasterList;
    return this.employeeMasterList.filter(e =>
      e.description?.toLowerCase().includes(this.createdBySearchTerm.toLowerCase())
    );
  }

  selectCreatedBy(employee: any) {
    this.selectedCreatedById = employee.idValue?.toString() || '';
    this.createdBySearchTerm = '';
    this.isCreatedByDropdownVisible = false;
  }

  isCreatedBySelected(employee: any): boolean {
    return this.selectedCreatedById === employee.idValue?.toString();
  }

  getCreatedByDisplayName(): string {
    if (!this.selectedCreatedById) return 'Select user...';
    const emp = this.employeeMasterList.find(e => e.idValue?.toString() === this.selectedCreatedById);
    return emp?.description || this.selectedCreatedById;
  }

  // Sidebar tab management
  setActiveSidebarTab(tab: 'comments' | 'history' | 'timelog') {
    this.activeSidebarTab = tab;
  }

  // ── Time Distribution helpers (timeLogSummary) ──────────────────────────

  // Total hours across all time log entries
  getTimeLogTotalHours(): number {
    return this.timeLogSummary.reduce((sum, log) => sum + (log.totalHours || 0), 0);
  }

  // Number of distinct users in the time log summary
  getTimeLogUserCount(): number {
    return new Set(this.timeLogSummary.map(log => log.userId)).size;
  }

  // Bar width (%) of an entry relative to the highest entry
  getTimeLogBarWidth(hours: number): number {
    const max = Math.max(...this.timeLogSummary.map(log => log.totalHours || 0), 0);
    if (max <= 0) return 0;
    return Math.max(Math.round(((hours || 0) / max) * 100), 2);
  }

  // Format decimal hours as "Xh Ym" (e.g. 11.62 -> "11h 37m")
  formatDecimalHours(hours: number): string {
    if (!hours || hours <= 0) return '0m';
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  // Format log date as "May 06, 2026"
  formatLogDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  // CSS class for assignee status pill in Time Distribution tab
  getAssigneeStatusClass(status: string): string {
    const s = (status || '').toUpperCase().trim();
    if (s === 'RUNNING')     return 'status-pill running';
    if (s === 'PAUSED')      return 'status-pill paused';
    if (s === 'COMPLETED')   return 'status-pill completed';
    if (s === 'CLOSED')      return 'status-pill closed';
    if (s === 'AUTO CLOSED') return 'status-pill auto-closed';
    if (s === 'IN PROGRESS') return 'status-pill in-progress';
    if (s === 'RE OPEN')     return 'status-pill re-open';
    return 'status-pill not-started';
  }

  // Total hours across all assignees (for summary card in Time Distribution)
  getAssigneesTotalHours(): number {
    return this.taskAssignees.reduce((sum, a) => sum + (a.totalHours || 0), 0);
  }

  // Bar width (%) of an assignee's hours relative to the highest among all assignees
  getAssigneeBarWidth(hours: number): number {
    const max = Math.max(...this.taskAssignees.map(a => a.totalHours || 0), 0);
    if (max <= 0) return 0;
    return Math.max(Math.round(((hours || 0) / max) * 100), 2);
  }

  // Returns true only if the session user is in the Assigned To list.
  // Timer controls (Start/Pause/Resume) should be hidden when this returns false.
  isCurrentUserAssignee(): boolean {
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const sessionId = (currentUser.empId || currentUser.employeeId || this.userId || '').toString().trim().toUpperCase();
    if (!sessionId) return false;
    return this.selectedAssigneeIds.some(id => (id || '').toString().trim().toUpperCase() === sessionId);
  }

  // Overall team status — shown in header; uses API-provided teamStatus when available
  getTeamStatus(): string {
    // Prefer the value from GetTaskById response (TeamStatus column)
    if (this.apiTeamStatus) return this.apiTeamStatus;

    // Fallback: derive from assignee statuses
    if (!this.taskAssignees || this.taskAssignees.length === 0) return '';
    const statuses = this.taskAssignees.map(a => (a.status || '').toUpperCase());
    if (statuses.every(s => s === 'CLOSED'))                    return 'CLOSED';
    if (statuses.every(s => s === 'COMPLETED'))                  return 'COMPLETED';
    if (statuses.some(s => s === 'RUNNING'))                     return 'RUNNING';
    if (statuses.some(s => s === 'PAUSED'))                      return 'PAUSED';
    if (statuses.every(s => s === 'NOT STARTED' || s === ''))    return 'NOT STARTED';
    return 'IN PROGRESS';
  }

  // CSS class for the team-status badge in the header
  getTeamStatusClass(): string {
    const s = this.getTeamStatus();
    if (s === 'RUNNING')     return 'team-status-badge team-running';
    if (s === 'PAUSED')      return 'team-status-badge team-paused';
    if (s === 'COMPLETED')   return 'team-status-badge team-completed';
    if (s === 'CLOSED')      return 'team-status-badge team-closed';
    if (s === 'IN PROGRESS') return 'team-status-badge team-in-progress';
    return 'team-status-badge team-not-started';
  }

  // Utility methods
  mapTaskStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      'NOT STARTED': 'not-started',
      'RUNNING': 'running',
      'PAUSED': 'pause',
      'COMPLETED': 'completed',
      'CLOSED': 'not-closed',
      'RE OPEN': 're-open',
      'AUTO CLOSED': 'auto-closed'
    };
    return statusMap[status] || 'not-started';
  }

  // Map API field type to component field type (case-insensitive)
  mapFieldType(apiFieldType: string): 'text' | 'number' | 'dropdown' | 'textarea' | 'date' {
    if (!apiFieldType) return 'text';
    
    // Convert to uppercase for case-insensitive comparison
    const normalizedType = apiFieldType.toUpperCase();
    
    const typeMap: { [key: string]: 'text' | 'number' | 'dropdown' | 'textarea' | 'date' } = {
      'TEXT': 'text',
      'DROPDOWN': 'dropdown',
      'NUMBER': 'number',
      'TEXTAREA': 'textarea',
      'DATE': 'date'
    };
    
    return typeMap[normalizedType] || 'text';
  }

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  formatHours(hours: number): string {
    return `${hours.toFixed(1)}h`;
  }

  // Format minutes to time display (e.g., "14h 54m" or "45m")
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
  // Convert minutes to HH:MM display string
  minutesToHHMM(minutes: number): string {
    if (!minutes || minutes <= 0) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  // Convert HH:MM string to total minutes
  hhmmToMinutes(timeStr: string): number {
    if (!timeStr || timeStr.trim() === '') return 0;
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + Math.min(m, 59);
  }

  // Handle estimated hours display input change
  onEstimatedHoursInput(): void {
    let input = this.estimatedHoursDisplay.replace(/[^0-9:]/g, '');
    if (!input.includes(':') && input.length >= 2) {
      input = input.substring(0, 2) + ':' + input.substring(2);
    }
    if (input.length > 6) input = input.substring(0, 6);
    this.estimatedHoursDisplay = input;
    if (input.includes(':') && input.split(':')[1].length > 0) {
      this.selectedTaskEstimatedHours = this.hhmmToMinutes(input);
    }
  }

  formatDateForInput(dateString: string | Date): string {
    if (!dateString) return '';
    try {
      // Convert Date object to string if needed
      const dateStr = dateString instanceof Date ? dateString.toISOString() : dateString;
      
      // Extract just the date part (YYYY-MM-DD) to avoid timezone issues
      // If the date string is like "2024-03-15T00:00:00", extract "2024-03-15"
      const datePart = dateStr.split('T')[0];
      
      // Validate the date format
      if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return datePart;
      }
      
      // Fallback: try to parse as Date object
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      
      // Use UTC methods to avoid timezone shifts
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (e) {
      return '';
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getFileIcon(fileType: string): string {
    if (fileType.includes('pdf')) return 'file-pdf';
    if (fileType.includes('word') || fileType.includes('doc')) return 'file-word';
    if (fileType.includes('excel') || fileType.includes('sheet')) return 'file-excel';
    if (fileType.includes('image') || fileType.includes('jpg') || fileType.includes('png')) return 'file-image';
    return 'file';
  }

  getFieldIcon(fieldType: string): string {
    const iconMap: { [key: string]: string } = {
      'text': 'font',
      'number': 'hashtag',
      'dropdown': 'list',
      'textarea': 'align-left',
      'date': 'calendar'
    };
    return iconMap[fieldType] || 'question';
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  getTimeAgo(dateString: string | Date): string {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    // Return exact date and time in a readable format
    // Format: "Jan 15, 2024 at 2:30 PM"
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    
    return date.toLocaleString('en-US', options).replace(',', ' at');
  }

  getActivityIconFromDescription(description: string): string {
    const desc = description.toLowerCase();
    if (desc.includes('started') || desc.includes('play')) return 'fa-play';
    if (desc.includes('paused')) return 'fa-pause';
    if (desc.includes('stopped') || desc.includes('completed')) return 'fa-stop';
    if (desc.includes('approved')) return 'fa-check-circle';
    if (desc.includes('comment')) return 'fa-comment';
    if (desc.includes('file') || desc.includes('upload')) return 'fa-file';
    if (desc.includes('updated') || desc.includes('changed')) return 'fa-edit';
    return 'fa-circle';
  }

  getActivityColorFromDescription(description: string): string {
    const desc = description.toLowerCase();
    if (desc.includes('started') || desc.includes('play')) return '#10b981';
    if (desc.includes('paused')) return '#f59e0b';
    if (desc.includes('stopped') || desc.includes('completed')) return '#ef4444';
    if (desc.includes('approved')) return '#059669';
    if (desc.includes('comment')) return '#3b82f6';
    if (desc.includes('file') || desc.includes('upload')) return '#8b5cf6';
    return '#6b7280';
  }

  // Check if comment belongs to the task owner (modal's userId)
  // LEFT side = task owner's comments
  // RIGHT side = all other users' comments
  isOwnComment(comment: TaskCommentDto): boolean {
    // Use the modal's userId (task owner) instead of session userId
    const taskOwnerUserId = this.userId;
    
    // Check by userId if available
    if (comment.userId) {
      return comment.userId === taskOwnerUserId;
    }
    
    // Fallback: if no userId in comment, return false (show on right side)
    return false;
  }

  /**
   * Render a comment for display: HTML-escape the text, then highlight any
   * "@<employee name>" mentions as a styled chip. Bound via [innerHTML].
   */
  formatCommentText(text: string): string {
    if (!text) return '';

    const escapeHtml = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    let html = escapeHtml(text);

    // Match longest names first so a full name wins over a shorter prefix
    const names = this.employeeMasterList
      .map(e => (e.description || '').toString())
      .filter(n => n)
      .sort((a, b) => b.length - a.length);

    for (const name of names) {
      const token = '@' + escapeHtml(name);
      if (html.includes(token)) {
        // Show just the readable name (drop the " | IDxx" suffix) in the chip
        const display = escapeHtml('@' + name.split('|')[0].trim());
        html = html.split(token).join(`<span class="comment-mention">${display}</span>`);
      }
    }

    return html;
  }

  // Close modal
  close() {
    this.closeModal.emit();
  }

  // Get status display text
  getStatusDisplayText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'not-started': 'Not Started',
      'running': 'Running',
      'pause': 'Paused',
      'paused': 'Paused',
      'not-closed': 'Closed',
      'completed': 'Completed',
      'auto-closed': 'Auto Closed',
      're-open': 'Re Open'
    };
    return statusMap[status] || status;
  }

  // Check AUTO CLOSED tasks count from API
  checkAutoClosedTasksCount() {
    // Always check against the session (logged-in) user, not the task owner's userId
    const sessionUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const sessionUserId = (sessionUser.empId || sessionUser.employeeId || this.userId || '').toString().trim();

    if (!sessionUserId) {
      console.warn('No user ID found for AUTO CLOSED check');
      return;
    }
    
    this.api.GetAutoClosedTaskCount(sessionUserId).subscribe({
      next: (response: any) => {
        console.log('AUTO CLOSED task count response (Task Modal):', response);
        
        if (response && response.success) {
          this.autoClosedTaskCount = response.data || 0;
          this.isBlockedByAutoClosedTasks = this.autoClosedTaskCount > 0;
          
          console.log('AUTO CLOSED count (Task Modal):', this.autoClosedTaskCount, 'Blocked:', this.isBlockedByAutoClosedTasks);
          
          if (this.isBlockedByAutoClosedTasks) {
            console.warn(`User is blocked from starting tasks due to ${this.autoClosedTaskCount} AUTO CLOSED task(s)`);
          }
        }
      },
      error: (error: any) => {
        console.error('Error checking AUTO CLOSED task count:', error);
        // On error, don't block the user
        this.autoClosedTaskCount = 0;
        this.isBlockedByAutoClosedTasks = false;
      }
    });
  }

  // ===== Log Time Popup =====

  checkAndShowLogTimePopup(taskDetails: any) {
    // Only show when timeLogStatus is 'AUTO CLOSED'
    const timeLogStatus = (taskDetails.timeLogStatus || '').toUpperCase().trim();
    if (timeLogStatus !== 'AUTO CLOSED') return;

    // Get the logged-in session user
    const sessionUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const sessionUserId = (sessionUser.empId || sessionUser.employeeId || '').toString().trim();

    if (!sessionUserId) return;

    // Check if session user matches timeLogUserId (the user whose time log is AUTO CLOSED)
    const timeLogUserId = (taskDetails.timeLogUserId || '').toString().trim();

    // Also check if session user is in the assignees array with AUTO CLOSED status
    const assignees: any[] = taskDetails.assignees || [];
    const userAssignee = assignees.find(
      (a: any) => (a.userId || '').toString().trim().toUpperCase() === sessionUserId.toUpperCase()
    );

    // Show popup only if session user is the one whose time log is AUTO CLOSED
    // Either via timeLogUserId match OR via assignee status being AUTO CLOSED
    const isTimeLogOwner = timeLogUserId && timeLogUserId.toUpperCase() === sessionUserId.toUpperCase();
    const isAssigneeAutoClose = userAssignee && (userAssignee.status || '').toUpperCase().trim() === 'AUTO CLOSED';

    if (!isTimeLogOwner && !isAssigneeAutoClose) return;

    // Store timeLogID for the submit call
    this.logTimeTimeLogId = taskDetails.timeLogID || taskDetails.timeLogId || 0;

    // Bind LOG DATE from timeLogDate
    const logDateRaw = taskDetails.timeLogDate;
    if (logDateRaw) {
      const d = new Date(logDateRaw);
      this.logTimeDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else {
      this.logTimeDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // Bind START TIME from timeLogStartDate
    const startRaw = taskDetails.timeLogStartDate;
    if (startRaw) {
      const s = new Date(startRaw);
      this.logTimeStartTime = s.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } else {
      this.logTimeStartTime = '09:00 AM';
    }

    // Bind END TIME from timeLogEndDate
    const endRaw = taskDetails.timeLogEndDate;
    if (endRaw) {
      const e = new Date(endRaw);
      this.logTimeEndTime = e.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } else {
      this.logTimeEndTime = '11:30 AM';
    }

    // Bind TOTAL TIME from timeLogHours (value is in minutes)
    const totalMins = taskDetails.timeLogHours || 0;
    this.logTimeTotalMinutes = Math.round(totalMins);
    const h = Math.floor(this.logTimeTotalMinutes / 60);
    const m = this.logTimeTotalMinutes % 60;
    this.logTimeTotalDisplay = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.logTimeEditValue = this.logTimeTotalDisplay;
    this.isEditingLogTime = false;

    // Emit to parent so it renders outside the stacking context
    this.showLogTime.emit({
      taskId: this.taskId,
      userId: this.userId,
      date: this.logTimeDate,
      startTime: this.logTimeStartTime,
      endTime: this.logTimeEndTime,
      totalMinutes: this.logTimeTotalMinutes,
      totalDisplay: this.logTimeTotalDisplay,
      timeLogId: this.logTimeTimeLogId,
      status: taskDetails.timeLogStatus || 'AUTO CLOSED'
    });
  }

  onLogTimeStartEndChange() {
    // Recalculate total from start/end time
    try {
      const parseTime = (t: string) => {
        const [time, period] = t.trim().split(' ');
        let [h, m] = time.split(':').map(Number);
        if (period?.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (period?.toUpperCase() === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      };
      const startMins = parseTime(this.logTimeStartTime);
      const endMins = parseTime(this.logTimeEndTime);
      const diff = endMins - startMins;
      if (diff > 0) {
        this.logTimeTotalMinutes = diff;
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        this.logTimeTotalDisplay = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        this.logTimeEditValue = this.logTimeTotalDisplay;
      }
    } catch (e) {}
    this.cdr.detectChanges();
  }

  startEditLogTime() {
    this.isEditingLogTime = true;
    this.logTimeEditValue = this.logTimeTotalDisplay;
  }

  confirmEditLogTime() {
    const parts = this.logTimeEditValue.split(':');
    if (parts.length === 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m) && m >= 0 && m <= 59) {
        this.logTimeTotalMinutes = h * 60 + m;
        this.logTimeTotalDisplay = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
    this.isEditingLogTime = false;
    this.cdr.detectChanges();
  }

  closeLogTimePopup() {
    this.showLogTimePopup = false;
  }

  submitLogTime() {
    if (!this.logTimeTotalMinutes || this.logTimeTotalMinutes <= 0) {
      this.toasterService.showError('Invalid Time', 'Please enter a valid duration');
      return;
    }

    if (!this.logTimeTimeLogId) {
      this.toasterService.showError('Error', 'Time log ID not found');
      return;
    }

    const sessionUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const sessionUserId = sessionUser.empId || sessionUser.employeeId || this.userId;

    const request = {
      timeLogId: this.logTimeTimeLogId,
      newMinutes: this.logTimeTotalMinutes,
      userId: sessionUserId
    };

    this.api.decreaseTimeLog(request).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          this.toasterService.showSuccess('Success', 'Time logged successfully');
          this.showLogTime.emit(null); // signal parent to close popup
          this.loadTaskDetails();
        } else {
          this.toasterService.showError('Error', response?.message || 'Failed to log time');
        }
      },
      error: () => {
        this.toasterService.showError('Error', 'Failed to log time');
      }
    });
  }
}
