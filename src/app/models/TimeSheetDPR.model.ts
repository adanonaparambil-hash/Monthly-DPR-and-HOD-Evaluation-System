export interface CustomFieldDto {
  fieldId: number;
  fieldName: string;
  fieldType: string;
  options: string[];
}

export interface CustomMappedFieldDto {
  fieldId: number;
  fieldName: string;
  fieldType: string;
  isMapped: 'Y' | 'N';
  options: string[];
}

export interface CustomFieldInputDto {
  fieldId: number;
  value: string;
}

export interface TaskSaveDto {
  taskId?: number;
  categoryId: number;
  taskTitle: string;
  description: string;
  projectId: number;
  departmentId: number;
  targetDate?: string | Date;
  startDate?: string | Date;
  progress: number;
  estimatedHours: number;
  status: string;
  createdBy: string;
  assignees: string[];
  customFields: CustomFieldInputDto[];
}

export interface TaskSaveResponseDto {
  taskId: number;
  message: string;
  success: boolean;
}



export interface TaskTimerActionDto {
  taskId: number;
  userId: string;
  action: string; // START | PAUSE | RESUME | STOP
}

export interface TaskTimerResponseDto {
  success: boolean;
  message: string;
}

export interface TaskCommentDto {
  commentId: number;
  taskId: number;
  userId: string;
  comments: string;
  submittedOn: string | Date;
  empName: string;
  profileImage?: string; // base64
  profileImageBase64?: string;
}

export interface TaskActivityDto {
  activityId: number;
  taskId: number;
  moduleName: string;
  recordId?: number;
  actionType: string;
  actionBy: string;
  actionDate: string | Date;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
}


export interface TaskFileUploadDto {
  fileId: number;
  taskId: number;
  fileName: string;
  fileType: string;
  fileContent?: string; // base64
  uploadedBy: string;
  uploadedOn: string | Date;
}

export interface TimeSheetFileUploadRequest {
  taskId: number;
  userId: string;
  file: File;
}

export interface TaskFileDto {
  fileId: number;
  taskId: number;
  fileName: string;
  fileType: string;
  fileSizeKb: number;
  uploadedBy: string;
  uploadedOn: string | Date;
}


export interface AutoPauseUserDto {
  empId: string;
  employeeName: string;
  email: string;
  taskId: number;
  timeLogId: number;
  startTime: string | Date;
}

export interface TaskCategoryDto {
  categoryId: number;
  categoryName: string;
  departmentId: number;
  eSTIMATEDHOURS : number;
  departmentName: string;
}

export interface UserTaskCategoriesDto {
  favouriteList: TaskCategoryDto[];
  departmentList: TaskCategoryDto[];
}

export interface ToggleFavouriteCategoryRequest {
  userId: string;
  categoryId: number;
  isFavourite: 'Y' | 'N';
}

export interface TaskCategoryRequest {
  categoryId?: number;
  categoryName: string;
  departmentId: number;
  createdBy: string;
  estimatedHours : number;
}


export interface DepartmentDto {
  departmentId: number;
  deptCode: string;
  deptName: string;
  status: string;
  createdBy: string;
  createdOn: string | Date;
}

export interface ProjectDto {
  projectId: number;
  projectName: string;
  departmentId: number;
  isActive: string;
  createdBy: string;
  createdOn: string | Date;
}

export interface UserBreakRequest {
  userId: string;
  action: string; // START | END
  remarks?: string;
  reason?: string;
}

export interface ActiveTaskDto {
  taskId: number;
  taskCategory: string;
  taskTitle: string;
  description: string;
  startDate?: string | Date;
  LastStartTime?: string | Date;

  todayLoggedHours: number;
  totalLoggedHours: number;

  progress: number;
  status: string;

  assignedById: string;
  assignedByName: string;
  assignedByImage?: string;
  assignedByImageBase64?: string;

  assigneeId: string;
  assigneeName: string;
  assigneeImage?: string;
  assigneeImageBase64?: string;
}

export interface ActiveTaskListResponse {
  todayTotalHours: number;
  lastPunchTime: string;

  breakStatus: string;
  breakStart?: string | Date;
  breakRemarks?: string;
  breakReason?: string;
  breakId?: number;

  myTasks: ActiveTaskDto[];
  assignedByMe: ActiveTaskDto[];
}


export interface PendingApprovalUserDto {
  employeeId: string;
  employeeName: string;
  designation: string;
  pendingLogCount: number;
  lastActivityDate?: string | Date;
  employeeImage?: string;
  employeeImageBase64?: string;
}


export interface TaskFieldMappingRequest {
  categoryId: number;
  fieldIds: number[];
  userId: string;
}

export interface DeleteTaskRequest {
  taskId: number;
  userId: string;
}

export interface TaskBulkApprovalRequest {
  taskId: number;
  userId: string;
  approverId: string;
  approvalIds: number[];
  action: string;
  fullApprove: string;
}

export interface UserDailyLogHistoryRequest {
  userId: string;
  fromDate?: string;      
  toDate?: string;        
  projectId?: number;
  categoryId?: number;
}

export interface UserDailyLogHistoryResponse {
  taskId: number;
  taskTitle: string;
  description: string;
  categoryName: string;
  projectName: string;
  userId: string;
  loggedBy: string;
  logDate: string;
  duration: string;
  dailyComment: string;
}