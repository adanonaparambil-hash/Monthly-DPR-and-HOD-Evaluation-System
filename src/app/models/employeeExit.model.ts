export interface EmployeeExitResponsibility {
  activities: string;
  project: string;
  rpersonPhone: string;
  rpersonEmail: string;
  rpersonEmpId: string;
  remarks: string;
}

export interface ApprovalStep {
  stepId: number;
  stepName: string;
  approverType: 'RESPONSIBLE_PERSON' | 'PROJECT_MANAGER' | 'HOD' | 'DEPARTMENT';
  approverIds: string[]; // Multiple approvers for responsible persons
  approverNames: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS';
  approvedBy?: string;
  approvedDate?: string;
  comments?: string;
  isRequired: boolean;
  order: number;
}

export interface DepartmentApproval {
  departmentId: string;
  departmentName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS';
  approverName?: string;
  approvedDate?: string;
  comments?: string;
  items: DepartmentApprovalItem[];
}

export interface DepartmentApprovalItem {
  itemName: string;
  itemType: 'checkbox' | 'text' | 'number';
  value?: any;
  isCleared: boolean;
  comments?: string;
}

export interface EmployeeExitApprovalWorkflow {
  exitId?: number;
  approvalWorkflow: ApprovalStep[];
  departmentApprovals: DepartmentApproval[];
  currentApprovalStep: number;
  overallStatus: 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';
  submittedDate?: string;
  completedDate?: string;
}

export interface EmployeeExitRequest {
  exitId?: number;
  employeeId: string;
  employeeName?: string;
  emailId?: string;
  formType?: string;
  dateOfDeparture?: string;
  dateArrival?: string;
  flightTime?: string;
  responsibilitiesHanded?: string;
  noOfDaysApproved?: number;
  depHod?: string;
  projectSiteIncharge?: string;
  reasonForLeave?: string;
  approvalStatus?: string;
  category?: string;
  lastWorkingDate?: string;
  NoticePeriod?: number;
  declaration1?: string;
  declaration2?: string;
  declaration3?: string;
  declaration4?: string;
  responsibilities?: EmployeeExitResponsibility[];
  ExitApprovalDetails?: ExitApprovalDetailDto[];
}

export interface MyApprovalRequest {
  employeeId?: string;
  status?: string;
  formType?: string
}


export interface EmployeeApprovalInboxRequest {
  ApproverEmployeeId?: string;
  FormType?: string
}


export interface ExitApprovalDetailDto {
  approverRole?: string;

  approvalStatusCode?: string;

  approvalStatus?: string;

  remarks?: string;

  department?: string;

  approvalDate?: string;

  approvalLevel?: number;

  exitId?: number;

  approvedId?: string;

  employeeName?: string;

  email?: string;

  phoneNumber?: string;
}

export interface UpdateExitApprovalRequest {
  approvalId?: number;
  exitId?: number;
  approverId?: number;
  status?: string;
  remarks?: string;
}
