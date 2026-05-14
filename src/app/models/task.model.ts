// src/app/models/task.model.ts

export interface DPRReview {
  // ── Core ──────────────────────────────────────────────────────
  employeeId: string;
  month?: number;
  year?: number;
  remarks?: string;
  formType?: string;
  status?: string;
  hodId?: string;
  dprid?: number;

  // ── Monthly DPR ───────────────────────────────────────────────
  workedHours?: number;
  achievements?: string;
  challenges?: string;
  supportNeeded?: string;
  totalEstimatedhours?: number;
  tasksList?: DPRTask[];
  commentsList?: DPRComment[];
  kpiList?: DPRKPI[];

  // ── Annual Appraisal — Work Summary ───────────────────────────
  appraisalPeriod?: string;
  keyResponsibilities?: string;
  deliverablesOutcomes?: string;

  // ── Annual Appraisal — Self Appraisal ─────────────────────────
  saQuality?: number;
  saTimeliness?: number;
  saInitiative?: number;
  saCommunication?: number;
  saTeamwork?: number;
  saProblemSolving?: number;
  saAdaptability?: number;
  saLearning?: number;
  saGoalAlignment?: number;
  saOverallSelf?: number;
  saTotal?: number;
  saComments?: string;

  // ── Annual Appraisal — Achievements ───────────────────────────
  annualAchievements?: string;
  annualChallenges?: string;

  // ── Annual Appraisal — Training ───────────────────────────────
  trainingCompleted?: string;
  skillsDeveloped?: string;
  trainingNeeded?: string;

  // ── Annual Appraisal — Career Goals ───────────────────────────
  careerGoalType?: string;
  careerGoals?: string;
  supportNeededAnnual?: string;

  // ── HOD Evaluation ────────────────────────────────────────────
  scoreQuality?: number;
  scoreTimeliness?: number;
  scoreInitiative?: number;
  scoreCommunication?: number;
  scoreTeamWork?: number;
  scoreProblemSolving?: number;
  hodrating?: number;
  scoreOverall?: number;
  overallValue?: string;

  // ── HOD Remarks ───────────────────────────────────────────────
  hodRecommendation?: string;
  hodRemarks?: string;
  hodReviewedAt?: Date;

  // ── Reviewers (up to 3) ───────────────────────────────────────
  reviewer1Id?: string;
  reviewer2Id?: string;
  reviewer3Id?: string;
  // HOD Evaluation reviewers (up to 3)
  hodReviewer1Id?: string;
  hodReviewer2Id?: string;
  hodReviewer3Id?: string;

  // ── Extra ─────────────────────────────────────────────────────
  employeename?: string;
  designation?: string;
  department?: string;
  emailid?: string;
  attendanceScore?: number;
  reviewAssessmentList?: ReviewAssessment[];
}


export interface ReviewAssessment {
  reviewAssessmentId: number;
  dprId: number;
  reviewerId?: string;
  raQuality?: number;
  raTimeliness?: number;
  raInitiative?: number;
  raCommunication?: number;
  raTeamwork?: number;
  raProblemSolving?: number;
  raAdaptability?: number;
  raLearning?: number;
  raGoalAlignment?: number;
  raOverallReview?: number;
  raTotal?: number;
  raComments?: string;
  status?: string;
  userType?: string;
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

export interface AppraisalAccessRequest {
  userId: string;
  year: number;
  actionType: 'SUBMIT' | 'APPROVAL';
}

export interface AppraisalAccessResult {
  status:    string;
  message:   string;
  dprId:     number | null;
  eventDate: string | null;
  isAllowed: number;   // 1 = allowed | 0 = blocked
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
  row_num?: number;
  page_number?: number;
  items_per_page?: number;
  department?: string;
  formType?: string;
  reviewerId?: string;   // filter APRs where this user is a reviewer
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



export interface EmpDashBoard {
  TaskCompleted?: number;
  ProductivityScore?: number;
  HoursThisMonth?: number;
  HODRating?: number;
  QualityScore?: number;
  TimelinessScore?: number;
  InitiativeScore?: number;
  CommunicationScore?: number;
  TeamWorkScore?: number;
  ProblemSolvingScore?: number;
  CompletedTasks?: number;
  ProgressTasks?: number;
  PendingTasks?: number;

  ProductivityScorePercentage?: number;
  HoursThisMonthPercentage?: number;
  HODRatingPercentage?: number;
  TaskCompletedPercentage?: number;

  hoursLoggedEstimateGraphs?: HoursLoggedEstimateGraph[];
  MonthlyPerformanceTrend?: MonthlyPerformanceTrend[];
}

export interface HoursLoggedEstimateGraph {
  ActualHours?: number;
  EstimatedHours?: number;
  Month?: number;
  Year?: number;
}

export interface MonthlyPerformanceTrend {
  Performance?: number;
}


export interface EmployeeApprovalDto {
  approvalId: number;
  taskId: number;
  logDate: string;
  project: string;
  taskTitle: string;
  taskDescription: string;
  category: string;
  hours: number;
  status: string;
  dailyRemarks: string;
}

