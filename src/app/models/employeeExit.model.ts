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
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedDate?: string;
  comments?: string;
  isRequired: boolean;
  order: number;
}

export interface DepartmentApproval {
  departmentId: string;
  departmentName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
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
}