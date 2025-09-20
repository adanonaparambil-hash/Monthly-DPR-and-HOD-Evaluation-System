// src/app/models/task.model.ts

export interface Task {
  name: string;
  description: string;
  estimatedHours: number;
  actualHours: number;
  productivity: number;
}

export interface KPI {
  name: string;
  value: string;
  remarks: string;
}


export interface DPRDetails {
  employeeId: string;
  month: number;
  year: number;
  workedHours: number;
  achievements: string;
  challenges: string;
  supportNeeded: string;
  status: string;
  hodId: string;
  scoreQuality: number;
  scoreTimeliness: number;
  scoreInitiative: number;
  scoreOverall: number;
  tasksList: DPRTask[];
  commentsList: DPRComment[];
  kpiList: DPRKPI[];
}


export interface DPRTask {
  taskName: string;
  description: string;
  estimatedHours: number;
  actualHours: number;
  productivity: number;
}


export interface DPRComment {
  commentId: number;
  dprId: number;
  hodId: string;
  commentText: string;
  commentType: string;
}


export interface DPRKPI {
  kpiId: number;
  dprId: number;
  employeeId: string;
  kpiMasterId: number;
  kpiValue: number | null; 
  remarks: string;
  kpiDescription: string;
}
