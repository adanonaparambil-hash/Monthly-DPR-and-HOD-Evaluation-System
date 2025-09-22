// src/app/models/task.model.ts

export interface DPRReview  {
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
  
  dprid?: number;
  commentsList?: DPRComment[];
  kpiList?: DPRKPI[];
  
}


export interface DPRTask {
  taskName: string;
  description: string;
  estimatedHours: number;
  actualHours: number;
  productivity: number;
  selected: boolean;
  dprid?: number;
}


export interface DPRComment {
  commentId?: number;
  dprId?: number;
  hodId?: string;
  commentText: string;
  commentType: string;
  dprid?: number;
  CREATEDAT? : Date;
}


export interface DPRKPI {
  kpiId: number;
  dprId: number;
  employeeId: string;
  kpiMasterId: number;
  kpiValue: number | null; 
  remarks: string;
  kpiDescription: string;
  dprid?: number;
}


export interface ProofhubTaskDto {
  TASK_ID?: number;
  PROJECT_ID?: number;
  TODOLIST_ID?: number;
  TASK_TITLE?: string;
  ASSIGNED_TO?: number;
  TASK_DESCRIPTION?: string;
  START_DATE?: Date;  
  DUE_DATE?: Date;    
  ESTIMATED_HOURS?: number;
  ESTIMATED_MINUTES?: number;
  LOGGED_HOURS?: number;
  LOGGED_MINUTES?: number;
  COMPLETED?: string;  
  PROGRESS?: number;   
  PROJECT_DESCRIPTION?: string;
  TODO_DESCRIPTION?: string;
  selected?: boolean;
}
