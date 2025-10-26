// src/app/models/task.model.ts

export interface DPRReview {
  employeeId: string;
  month?: number;
  year?: number;
  workedHours?: number;
  achievements?: string;
  challenges?: string;
  supportNeeded?: string;
  status?: string;
  hodId?: string;
  scoreQuality?: number;
  scoreTimeliness?: number;
  scoreInitiative?: number;
  scoreOverall?: number;
  tasksList?: DPRTask[];
  commentsList?: DPRComment[];
  kpiList?: DPRKPI[];
  dprid?: number;
  remarks?: string;
  employeename?: string;
  designation?: string;
  department?: string;
  emailid?: string;
}


export interface DPRTask {
  taskName?: string;
  description?: string;
  estimatedHours?: number;
  actualHours: number;
  productivity?: number;
  selected?: boolean;
  dprid?: number;
}


export interface DPRComment {
  commentId?: number;
  dprId?: number;
  hodId?: string;
  commentText?: string;
  commentType?: string;
  dprid?: number;
  createdat?: Date;
}


export interface DPRKPI {
  kpiId?: number;
  dprId?: number;
  employeeId?: string;
  kpiMasterId?: number;
  kpiValue?: number | string | null;
  remarks?: string;
  description?: string;
  placeholdervalue?: string;
}


export interface ProofhubTaskDto {
  TASK_ID?: string;
  PROJECT_ID?: string;
  TODOLIST_ID?: string;
  TASK_TITLE?: string;
  ASSIGNED_TO?: string;
  TASK_DESCRIPTION?: string;
  START_DATE?: string;
  DUE_DATE?: string;
  ESTIMATED_HOURS?: string;
  ESTIMATED_MINUTES?: string;
  LOGGED_HOURS?: string;
  LOGGED_MINUTES?: string;
  COMPLETED?: string;
  PROGRESS?: string;
  PROJECT_DESCRIPTION?: string;
  TODO_DESCRIPTION?: string;
  selected?: boolean;
}



export interface KPI {
  kpiId?: number;
  kpiName?: string;
  kpiValue?: number;
  remarks?: string;
}



export interface DPRMonthlyReviewListing {
  dprId?: number;
  employeeName?: string;
  month?: number;
  year?: number;
  workedHours?: number;
  achievements?: string;
  challenges?: string;
  supportNeeded?: string;
  status?: string;
  hodId?: string;
  scoreQuality?: number;
  scoreTimeliness?: number;
  scoreInitiative?: number;
  scoreOverall?: number;
  createdAt?: Date;
  updatedAt?: Date;
}



export interface DPRMonthlyReviewListingRequest {
  dprId?: number;
  employeeName?: string;
  month?: number;
  year?: number;
  status?: string;
  hodName?: string;
  employeeId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}


export interface ClearNotificationRequest {
  notificationId?: number;  
  userId: string;           
  actionType: string;       
}


export interface ExitEmpProfileDetails {
  empId?: string;
  employeeName?: string;
  empDept?: string;
  actProfession?: string;
  phone?: string;
  email?: string;
  address?: string;
  depHodId?: string;
  district?: string;
  place?: string;
  state?: string;
  postOffice?: string;
  nationality?: string;
  telephoneNo?: string;
}
