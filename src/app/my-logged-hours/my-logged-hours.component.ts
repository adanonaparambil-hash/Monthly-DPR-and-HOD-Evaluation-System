import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Theme } from '../services/theme';
import { Api } from '../services/api';
import { TaskDetailsModalComponent } from '../components/task-details-modal/task-details-modal.component';
import { SessionService } from '../services/session.service';

interface LoggedHour {
  id: string;
  taskId: string;
  categoryId?: number | null; // Can be number, undefined, or null from API
  title: string;
  description: string;
  category: string;
  priority?: string;
  duration: string;
  date: string;
  project: string;
  dailyComment?: string;
  loggedBy?: string;
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

@Component({
  selector: 'app-my-logged-hours',
  standalone: true,
  imports: [CommonModule, FormsModule, TaskDetailsModalComponent],
  templateUrl: './my-logged-hours.component.html',
  styleUrls: ['./my-logged-hours.component.css']
})
export class MyLoggedHoursComponent implements OnInit {
  isDarkMode = false;

  // Filter properties - Updated with API integration
  fromDate = '2023-10-23';
  toDate = '2023-10-29';
  selectedProject: string | number = 'all';
  selectedDepartment: string | number = 'all';
  selectedTaskCategory: string | number = 'all';

  // API data
  projects: Project[] = [];
  departments: Department[] = [];
  taskCategories: TaskCategory[] = [];

  // Logged hours data from API
  loggedHours: LoggedHour[] = [];
  isLoadingData = false;

  // Task details modal properties
  showTaskDetailsModal = false;
  selectedTaskIdForModal: number = 0;
  selectedUserIdForModal: string = '';
  selectedCategoryIdForModal: number = 0;

  constructor(
    private themeService: Theme,
    private api: Api,
    private sessionService: SessionService
  ) {}

  ngOnInit() {
    // Subscribe to theme changes
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
    
    // Set default date range (last 7 days)
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    
    this.toDate = this.formatDateForInput(today);
    this.fromDate = this.formatDateForInput(lastWeek);
    
    // Load dropdown data from API
    this.loadProjects();
    this.loadDepartments();
    
    // Load logged hours data
    this.loadLoggedHours();
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
      categoryId: this.selectedTaskCategory !== 'all' ? Number(this.selectedTaskCategory) : undefined
    };
    
    console.log('getUserDailyLogHistory request:', request);
    
    this.api.getUserDailyLogHistory(request).subscribe({
      next: (response) => {
        console.log('getUserDailyLogHistory API Response:', response);
        
        if (response && response.success && response.data) {
          // Log first record to see all available fields
          if (response.data.length > 0) {
            console.log('First log record fields:', Object.keys(response.data[0]));
            console.log('First log record:', response.data[0]);
          }
          
          // Map API response to LoggedHour interface
          this.loggedHours = response.data.map((log: any, index: number) => {
            // Extract categoryId - it's directly in the response
            const extractedCategoryId = log.categoryId !== undefined ? log.categoryId : 
                                       log.CategoryId !== undefined ? log.CategoryId : 
                                       log.categoryID !== undefined ? log.categoryID : 
                                       log.CategoryID !== undefined ? log.CategoryID : null;
            
            if (index === 0) {
              console.log('=== CategoryId Extraction (response.data) ===');
              console.log('Raw API log object:', log);
              console.log('Extracted categoryId:', extractedCategoryId);
              console.log('Type:', typeof extractedCategoryId);
            }
            
            const mappedLog = {
              id: `${log.taskId}-${index}`,
              taskId: `TSK-${log.taskId}`,
              categoryId: extractedCategoryId, // Use extracted value directly (can be null)
              title: log.taskTitle || 'Untitled Task',
              description: log.description || log.dailyComment || 'No description',
              category: log.categoryName || 'Uncategorized',
              duration: log.duration || '00:00',
              date: log.logDate ? log.logDate.split('T')[0] : '',
              project: log.projectName || 'No Project',
              dailyComment: log.dailyComment || '',
              loggedBy: log.loggedBy || ''
            };
            
            if (index === 0) {
              console.log('Final mapped log:', mappedLog);
              console.log('Final categoryId value:', mappedLog.categoryId);
            }
            
            return mappedLog;
          });
          
          console.log('Loaded logged hours:', this.loggedHours.length, 'records');
          console.log('First logged hour with categoryId:', this.loggedHours[0]);
        } else if (response && Array.isArray(response.data)) {
          // Log first record to see all available fields
          if (response.data.length > 0) {
            console.log('First log record fields (direct array):', Object.keys(response.data[0]));
            console.log('First log record (direct array):', response.data[0]);
          }
          
          // Handle direct array response
          this.loggedHours = response.data.map((log: any, index: number) => {
            // Extract categoryId - it's directly in the response
            const extractedCategoryId = log.categoryId !== undefined ? log.categoryId : 
                                       log.CategoryId !== undefined ? log.CategoryId : 
                                       log.categoryID !== undefined ? log.categoryID : 
                                       log.CategoryID !== undefined ? log.CategoryID : null;
            
            if (index === 0) {
              console.log('=== CategoryId Extraction (direct array) ===');
              console.log('Raw API log object:', log);
              console.log('Extracted categoryId:', extractedCategoryId);
              console.log('Type:', typeof extractedCategoryId);
            }
            
            const mappedLog = {
              id: `${log.taskId}-${index}`,
              taskId: `TSK-${log.taskId}`,
              categoryId: extractedCategoryId, // Use extracted value directly (can be null)
              title: log.taskTitle || 'Untitled Task',
              description: log.description || log.dailyComment || 'No description',
              category: log.categoryName || 'Uncategorized',
              duration: log.duration || '00:00',
              date: log.logDate ? log.logDate.split('T')[0] : '',
              project: log.projectName || 'No Project',
              dailyComment: log.dailyComment || '',
              loggedBy: log.loggedBy || ''
            };
            
            if (index === 0) {
              console.log('Final mapped log:', mappedLog);
              console.log('Final categoryId value:', mappedLog.categoryId);
            }
            
            return mappedLog;
          });
          
          console.log('Loaded logged hours (direct array):', this.loggedHours.length, 'records');
          console.log('First logged hour with categoryId (direct array):', this.loggedHours[0]);
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

  onDepartmentChange() {
    console.log('Department changed to:', this.selectedDepartment);
    
    // Reset task category selection
    this.selectedTaskCategory = 'all';
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

  onProjectChange() {
    console.log('Project changed to:', this.selectedProject);
    // Reload logged hours with updated filter
    this.loadLoggedHours();
  }

  onTaskCategoryChange() {
    console.log('Task category changed to:', this.selectedTaskCategory);
    // Reload logged hours with updated filter
    this.loadLoggedHours();
  }

  onDateChange() {
    console.log('Date range changed:', this.fromDate, 'to', this.toDate);
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
    // This method is deprecated - use getGroupedLoggedHours() instead
    return [];
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

  // Open task details modal when clicking on a logged hour record
  openTaskDetailsModal(loggedHour: LoggedHour) {
    console.log('=== openTaskDetailsModal - My Logged Hours ===');
    console.log('Clicked record:', loggedHour);
    console.log('categoryId from record:', loggedHour.categoryId);
    console.log('categoryId type:', typeof loggedHour.categoryId);
    
    // Extract numeric task ID from the taskId string (e.g., "TSK-123" -> 123)
    const taskIdMatch = loggedHour.taskId.match(/\d+/);
    const taskId = taskIdMatch ? parseInt(taskIdMatch[0]) : 0;
    
    if (!taskId) {
      console.error('Invalid task ID:', loggedHour.taskId);
      return;
    }

    // Get current user
    const currentUser = this.sessionService.getCurrentUser();
    const userId = currentUser?.empId || currentUser?.employeeId || '';
    
    // PRIORITY: Use categoryId directly from the API response (GetUserDailyLogHistory)
    // This is the correct source of truth, not the header fields
    const categoryIdFromApi = loggedHour.categoryId;
    
    console.log('🔵 CategoryId from API response (loggedHour.categoryId):', categoryIdFromApi);
    console.log('🔵 Type:', typeof categoryIdFromApi);
    console.log('🔵 Full loggedHour object:', JSON.stringify(loggedHour));
    
    // DIRECTLY use the categoryId from API - with fallback to 0 only if null/undefined
    const finalCategoryId = categoryIdFromApi ?? 0;
    
    console.log('🟢 FINAL categoryId being passed to modal:', finalCategoryId);
    console.log('🟢 Type:', typeof finalCategoryId);
    
    // Set properties for standalone modal component
    this.selectedTaskIdForModal = taskId;
    this.selectedUserIdForModal = userId;
    this.selectedCategoryIdForModal = finalCategoryId;
    
    console.log('🟡 selectedCategoryIdForModal SET TO:', this.selectedCategoryIdForModal);
    console.log('🟡 Type:', typeof this.selectedCategoryIdForModal);
    
    // Show the modal
    this.showTaskDetailsModal = true;
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  // Helper method to get category ID from category name (fallback)
  private getCategoryIdFromName(categoryName: string): number {
    // Try to find the category ID from the task categories list
    const category = this.taskCategories.find(cat => cat.categoryName === categoryName);
    if (category) {
      return category.categoryId;
    }
    
    // If not found, return 0 (will need to be handled by the modal)
    console.warn('Category ID not found for:', categoryName);
    return 0;
  }

  // Close task details modal
  closeTaskDetailsModal() {
    this.showTaskDetailsModal = false;
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Reload logged hours to get latest updates
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
}