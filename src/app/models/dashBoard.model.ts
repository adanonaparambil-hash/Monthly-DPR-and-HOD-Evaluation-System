export interface HODEmployeePerformanceTrend {
  month?: number;
  year?: number;
  initiative?: number;
  quality?: number;
  timeliness?: number;
  overallPerformance?: number;
}

export interface HODEvaluationSummary {
  departmentName?: string;
  excellentCount?: number;
  excellentPercentage?: number;
  goodCount?: number;
  goodPercentage?: number;
  averageCount?: number;
  averagePercentage?: number;
  belowAverageCount?: number;
  belowAveragePercentage?: number;
  poorCount?: number;
  poorPercentage?: number;
  totalEvaluations?: number;
}

export interface HODDepartmentRanking {
  rank?: number;
  employeeId?: string;
  employeeName?: string;
  department?: string;
  rating?: number;
  profileImage?: string; // base64 string from backend
  profileImageBase64?: string; // alternative property name
}

export interface PendingEvaluation {
  dprid?: number;
  employeeId?: string;
  employeeName?: string;
  department?: string;
  submissionDate: string; // ISO string
  actionStatus?: string;
  profileImage?: string; // base64 string
  totalCount?: number;
}

export interface HODDepartmentDashboard {
  topPerformedMonth?: number;
  topPerformedYear?: number;
  departmentEmployeeCount?: number;
  pendingMPRs?: number;
  evaluatedMPRs?: number;
  topPerformerEmpid?: string;
  topPerformerEmployeeName?: string;
  topPerformerDepartment?: string;
  topPerformerRating?: number;
  topPerformerDprid?: number;
  performanceTrends: HODEmployeePerformanceTrend[];
  hodEvaluationSummary: HODEvaluationSummary[];
  hodDepartmentRankings: HODDepartmentRanking[];
  hodPendingEvaluations: PendingEvaluation[];
}
