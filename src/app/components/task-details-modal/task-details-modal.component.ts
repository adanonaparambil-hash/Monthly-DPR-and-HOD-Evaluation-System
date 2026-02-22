import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
  @Input() isViewOnly: boolean = false; // View-only mode for "Assigned to Others"
  
  // Output events
  @Output() closeModal = new EventEmitter<void>();
  @Output() taskUpdated = new EventEmitter<any>();
  @Output() taskPaused = new EventEmitter<number>();
  @Output() taskResumed = new EventEmitter<number>();
  @Output() taskStopped = new EventEmitter<number>();
  
  // Task data
  selectedTaskId = '';
  selectedTaskCategory = '';
  selectedTaskRunningTimer = '00:00:00';
  selectedTaskTotalHours = '0h';
  selectedTaskProgress = 0;
  selectedTaskDetailStatus = 'not-started';
  
  // Editable fields
  editableTaskTitle = '';
  editableTaskDescription = '';
  dailyRemarks = '';
  
  // Metadata fields
  selectedTaskStartDate = '';
  selectedTaskEndDate = '';
  selectedTaskEstimatedHours: number = 0;
  selectedProjectId: string = '';
  selectedAssigneeId: string = '';
  
  // Custom fields
  selectedCustomFields: CustomField[] = [];
  availableCustomFields: CustomField[] = [];
  tempSelectedFields: string[] = [];
  showAddFieldModal = false;
  validationErrors: string[] = []; // Track fields with validation errors
  
  // Files
  uploadedFiles: UploadedFile[] = [];
  
  // Comments and Activity
  activeSidebarTab: 'comments' | 'history' = 'comments';
  taskComments: TaskCommentDto[] = [];
  activityLogs: TaskActivityDto[] = [];
  newComment = '';
  
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
    
    // Load common data regardless of taskId
    this.loadCustomFields();
    this.loadProjectsList();
    this.loadEmployeeMasterList();
    
    // If taskId is provided and not 0, load existing task details
    if (this.taskId && this.taskId > 0 && this.userId && this.categoryId) {
      console.log('Loading existing task details...');
      this.loadTaskDetails();
      this.loadTaskFiles(this.taskId);
      this.loadComments(this.taskId);
      this.loadActivity(this.taskId);
    } else if (this.categoryId && this.userId) {
      // New task - just show empty form with category info
      console.log('New task mode - showing empty form for categoryId:', this.categoryId);
      this.selectedTaskDetailStatus = 'not-started';
      this.editableTaskTitle = '';
      this.editableTaskDescription = '';
      this.dailyRemarks = '';
      this.selectedTaskProgress = 0;
      this.taskProgress = 0;
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
          this.selectedTaskEstimatedHours = taskDetails.estimtedHours || taskDetails.estimatedHours || 0;
          this.selectedProjectId = taskDetails.projectId ? taskDetails.projectId.toString() : '';
          
          // Bind assignee - API returns 'assignee' field (could be userId or employeeId)
          // Convert to string to match employeeMasterList idValue format
          const assigneeValue = taskDetails.assignee || taskDetails.assigneeId || taskDetails.userId || '';
          this.selectedAssigneeId = assigneeValue ? assigneeValue.toString() : '';
          
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
          
          // Start timer if task is running
          if (this.selectedTaskDetailStatus === 'running') {
            const runningSeconds = (taskDetails.todayTotalMinutes || 0) * 60;
            this.startTimer(runningSeconds);
          }
          
          console.log('=== Task details loaded successfully ===');
          this.cdr.detectChanges();
        } else {
          console.error('API response invalid:', {
            hasResponse: !!response,
            hasSuccess: response?.success,
            hasData: !!response?.data
          });
        }
      },
      error: (error: any) => {
        console.error('=== getTaskById API ERROR ===');
        console.error('Error loading task details:', error);
        console.error('Error status:', error?.status);
        console.error('Error message:', error?.message);
        this.toasterService.showError('Error', 'Failed to load task details');
      }
    });
  }

  // Load custom fields from API
  loadCustomFields() {
    this.api.getCustomFields().subscribe({
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
    
    // Map status from component format to API format
    const statusMap: { [key: string]: string } = {
      'not-started': 'NOT STARTED',
      'running': 'RUNNING',
      'pause': 'PAUSED',
      'paused': 'PAUSED',
      'completed': 'COMPLETED',
      'not-closed': 'CLOSED'
    };
    
    const apiStatus = statusMap[this.selectedTaskDetailStatus] || 'NOT STARTED';
    
    // Prepare assignees array - filter out empty values
    const assignees = this.selectedAssigneeId ? [this.selectedAssigneeId] : [];
    
    const taskSaveRequest: TaskSaveDto = {
      taskId: this.taskId,
      categoryId: this.categoryId,
      taskTitle: this.editableTaskTitle?.trim() || '',
      description: this.editableTaskDescription?.trim() || '',
      projectId: parseInt(this.selectedProjectId) || 0,
      departmentId: 0, // Will be set by backend based on category
      targetDate: this.selectedTaskEndDate || undefined,
      startDate: this.selectedTaskStartDate || undefined,
      progress: this.taskProgress || 0,
      estimatedHours: this.selectedTaskEstimatedHours || 0,
      status: apiStatus,
      createdBy: userId,
      assignees: assignees,
      customFields: this.selectedCustomFields.map(field => ({
        fieldId: field.fieldId || 0,
        value: field.value?.toString() || ''
      }))
    };
    
    console.log('Task save request:', taskSaveRequest);
    console.log('Calling saveTaskBulk API...');

    this.api.saveTaskBulk(taskSaveRequest).subscribe({
      next: (response: any) => {
        console.log('=== saveTaskBulk API Response ===');
        console.log('Response:', response);
        
        if (response && response.success) {
          this.toasterService.showSuccess('Success', 'Task updated successfully');
          this.taskUpdated.emit(taskSaveRequest);
          console.log('Task saved successfully');
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

  // Task control methods
  pauseTaskFromModal() {
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
    Swal.fire({
      title: 'Stop Task?',
      text: 'Are you sure you want to stop this task?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, stop it',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // Call executeTimer API with STOP action
        const timerRequest = {
          taskId: this.taskId,
          userId: this.userId,
          action: 'STOP'
        };
        
        this.api.executeTimer(timerRequest).subscribe({
          next: (response: any) => {
            if (response && response.success) {
              this.stopTimer();
              this.selectedTaskDetailStatus = 'not-closed';
              this.toasterService.showSuccess('Task Stopped', 'Task timer has been stopped successfully!');
              
              // Reload task details to get updated data
              this.loadTaskDetails();
              
              // Emit event to parent component
              this.taskStopped.emit(this.taskId);
              
              // Keep modal open - don't call this.close()
            } else {
              this.toasterService.showError('Stop Failed', response?.message || 'Failed to stop task');
            }
          },
          error: (error: any) => {
            console.error('Error stopping task:', error);
            this.toasterService.showError('Error', 'Failed to stop task');
          }
        });
      }
    });
  }

  // Add comment
  addComment() {
    if (!this.newComment.trim()) return;

    const commentData: TaskCommentDto = {
      commentId: 0,
      taskId: this.taskId,
      userId: this.userId,
      comments: this.newComment,
      submittedOn: new Date().toISOString(),
      empName: '',
      profileImage: undefined,
      profileImageBase64: undefined
    };

    this.api.saveComment(commentData).subscribe({
      next: (response: any) => {
        if (response && response.success) {
          this.toasterService.showSuccess('Success', 'Comment added');
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

  // Submit daily remarks
  submitDailyRemarks() {
    if (!this.dailyRemarks.trim()) {
      this.toasterService.showError('Error', 'Please enter daily remarks');
      return;
    }

    // Save the task with daily remarks
    this.saveTaskChanges();
    
    // Show success message
    this.toasterService.showSuccess('Success', 'Daily remarks submitted');
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
  }

  hideProjectDropdown() {
    setTimeout(() => {
      this.isProjectDropdownVisible = false;
    }, 200);
  }

  showAssigneeDropdown() {
    if (this.isViewOnly) return; // Prevent dropdown in view-only mode
    this.isAssigneeDropdownVisible = true;
  }

  hideAssigneeDropdown() {
    setTimeout(() => {
      this.isAssigneeDropdownVisible = false;
    }, 200);
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
    if (!this.assigneeSearchTerm) return this.employeeMasterList;
    return this.employeeMasterList.filter(e => 
      e.description?.toLowerCase().includes(this.assigneeSearchTerm.toLowerCase())
    );
  }

  selectProject(project: any) {
    this.selectedProjectId = project.projectId?.toString() || '';
    this.projectSearchTerm = '';
    this.isProjectDropdownVisible = false;
  }

  selectAssignee(employee: any) {
    this.selectedAssigneeId = employee.idValue?.toString() || '';
    this.assigneeSearchTerm = '';
    this.isAssigneeDropdownVisible = false;
  }

  isProjectSelected(project: any): boolean {
    return this.selectedProjectId === project.projectId?.toString();
  }

  isAssigneeSelected(employee: any): boolean {
    return this.selectedAssigneeId?.toString() === employee.idValue?.toString();
  }

  getProjectDisplayName(): string {
    if (!this.selectedProjectId) {
      return 'Select project...';
    }
    const project = this.projectsList.find(p => p.projectId?.toString() === this.selectedProjectId);
    return project?.projectName || 'Select project...';
  }

  getAssigneeDisplayName(): string {
    if (!this.selectedAssigneeId) {
      return 'Select assignee...';
    }
    const selected = this.employeeMasterList.find(emp => emp.idValue?.toString() === this.selectedAssigneeId?.toString());
    return selected ? selected.description : 'Select assignee...';
  }

  // Sidebar tab management
  setActiveSidebarTab(tab: 'comments' | 'history') {
    this.activeSidebarTab = tab;
  }

  // Utility methods
  mapTaskStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      'NOT STARTED': 'not-started',
      'RUNNING': 'running',
      'PAUSED': 'pause',
      'COMPLETED': 'completed',
      'CLOSED': 'not-closed'
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
    if (description.includes('started') || description.includes('play')) return 'fa-play';
    if (description.includes('paused')) return 'fa-pause';
    if (description.includes('stopped') || description.includes('completed')) return 'fa-stop';
    if (description.includes('comment')) return 'fa-comment';
    if (description.includes('file') || description.includes('upload')) return 'fa-file';
    if (description.includes('updated') || description.includes('changed')) return 'fa-edit';
    return 'fa-circle';
  }

  getActivityColorFromDescription(description: string): string {
    if (description.includes('started') || description.includes('play')) return '#10b981';
    if (description.includes('paused')) return '#f59e0b';
    if (description.includes('stopped') || description.includes('completed')) return '#ef4444';
    if (description.includes('comment')) return '#3b82f6';
    if (description.includes('file') || description.includes('upload')) return '#8b5cf6';
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

  // Close modal
  close() {
    this.closeModal.emit();
  }
}
