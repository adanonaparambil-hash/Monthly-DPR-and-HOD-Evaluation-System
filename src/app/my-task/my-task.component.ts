import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Theme } from '../services/theme';

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
  type: 'text' | 'number' | 'dropdown' | 'textarea';
  description: string;
  options?: string[];
  value?: any;
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
  selectedTask: Task | null = null;
  selectTaskActiveTab: 'favorites' | 'all' = 'favorites';
  
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
  availableCustomFields: CustomField[] = [
    {
      key: 'instruction',
      label: 'Instruction',
      type: 'text',
      description: 'Detailed instructions for the task'
    },
    {
      key: 'stage',
      label: 'Stage',
      type: 'dropdown',
      description: 'Current stage of the task',
      options: ['Planning', 'Development', 'Testing', 'Review', 'Deployment']
    },
    {
      key: 'section',
      label: 'Section',
      type: 'dropdown',
      description: 'Task section or category',
      options: ['Frontend', 'Backend', 'Database', 'API', 'UI/UX', 'Documentation']
    },
    {
      key: 'trade',
      label: 'Trade',
      type: 'dropdown',
      description: 'Trade or specialization',
      options: ['Development', 'Design', 'Testing', 'DevOps', 'Analysis', 'Management']
    },
    {
      key: 'timeTaken',
      label: 'Time Taken',
      type: 'text',
      description: 'Actual time taken for the task'
    },
    {
      key: 'count',
      label: 'Count',
      type: 'number',
      description: 'Quantity or count related to the task'
    },
    {
      key: 'unit',
      label: 'Unit',
      type: 'dropdown',
      description: 'Unit of measurement',
      options: ['Hours', 'Days', 'Weeks', 'Items', 'Pages', 'Lines', 'Files']
    },
    {
      key: 'remarks',
      label: 'Remarks',
      type: 'textarea',
      description: 'Additional remarks or notes'
    },
    {
      key: 'type',
      label: 'Type',
      type: 'dropdown',
      description: 'Task type classification',
      options: ['Bug Fix', 'Feature', 'Enhancement', 'Maintenance', 'Research', 'Documentation']
    },
    {
      key: 'folderPath',
      label: 'Folder Path',
      type: 'text',
      description: 'File system path or folder location'
    },
    {
      key: 'documentLink',
      label: 'Document Link',
      type: 'text',
      description: 'Link to related documents'
    },
    {
      key: 'process',
      label: 'Process',
      type: 'text',
      description: 'Process or workflow name'
    },
    {
      key: 'workPlace',
      label: 'Work Place',
      type: 'dropdown',
      description: 'Location or workplace',
      options: ['Office', 'Remote', 'Client Site', 'Home', 'Co-working Space', 'Field']
    }
  ];
  
  // Temporary selection for the add field modal
  tempSelectedFields: string[] = [];

  // Available assignees
  assignees: Assignee[] = [
    { id: 'me', name: 'Myself', role: 'Self' },
    { id: 'john', name: 'John Doe', role: 'Developer' },
    { id: 'sarah', name: 'Sarah Smith', role: 'Designer' },
    { id: 'alex', name: 'Alex Johnson', role: 'HOD' }
  ];

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
      progress: 75
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

  constructor(private themeService: Theme) {}

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

  setSelectTaskTab(tab: 'favorites' | 'all') {
    this.selectTaskActiveTab = tab;
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
    switch(type) {
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