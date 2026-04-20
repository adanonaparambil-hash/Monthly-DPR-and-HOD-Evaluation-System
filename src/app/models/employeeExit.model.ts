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
  approvedId?: string;
  email?: string;
  phoneNumber?: string;
  photo?: string;
  profileImageBase64?: string;
  department?: string;
  showRemarks?: boolean;
  approvedDate?: string;
  comments?: string;
  isRequired: boolean;
  order: number;
  // Add these properties for the new logic
  approverCode?: string;
  approvalStatusCode?: string;
  isHead ?: string;
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
  responsibilitiesHandedOverToPhone?: string; // Phone number for planned/resignation forms
  responsibilitiesHandedOverToEmail?: string; // Email for planned/resignation forms
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
  baseurl?:string;
}

export interface MyApprovalRequest {
  employeeId?: string;
  status?: string;
  formType?: string;
  fromDate?: string;
  toDate?: string
}


// export interface EmployeeApprovalInboxRequest {
//   ApproverEmployeeId?: string;
//   FormType?: string
// }


export interface EmployeeApprovalInboxRequest {
  approverId?: string;
  formType?: string;     // 'E' | 'B' | 'R' | null
  fromDate?: Date | null;
  toDate?: Date | null;
  department?: string;
  status?: string;
  employeeId?: string;
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
  profileImageBase64?: string;
  ProfileImageBase64?: string; // Alternative field name for compatibility
}

export interface UpdateExitApprovalRequest {
  approvalId?: number;
  exitId?: number;
  approverId?: string; // Changed to string to match empId type
  status?: string;
  remarks?: string;
  baseurl?:string;
}

export interface IssuedAsset {
  tagNo: string;
  category: string;
  empId: string;
  allocationDate: string;
  model: string;
  manufacture: string;
  engNo?: string;
}

export interface IssuedAssetsResponse {
  success: boolean;
  message: string;
  data: IssuedAsset[];
}

export interface GroupedAssets {
  [category: string]: IssuedAsset[];
}


export interface EmployeeRejoiningDto {
  rejoinId?: number;

  employeeId: string;
  section?: string;
  labourCardExpiryDate?: string;

  emergencyContactName?: string;
  relation?: string;
  emergencyContactAddress?: string;
  emergencyContactPhone?: string;
  emergencyContactEmail?: string;

  leaveType?: string;
  dateOfDeparture?: string;
  approvedLeaveArrivalDate?: string;
  extensionDate?: string;
  joiningDate?: string;
  arrivedOn?: string;

  remarks?: string;

  passportNo?: string;
  passportDateOfIssue?: string;
  passportExpiryDate?: string;

  abDocNo?: string;
  passportReceivedBy?: string;
  passportFileRackNo?: string;

  status?: string;
  createdBy?: string;
  createdOn?: string;

  approvalId?: number;
  approvalRemarks?: string;
  baseurl?: string;
}


export interface EmployeeByodDto {
  byodId?: number;

  employeeId: string;
  userType: string;
  assetCode: string;

  dateOfPurchase?: string;
  yearsAsOnDate?: number;

  status?: string;
  category?: string;
  userExisting?: string;

  approvalId?: number;
  approvalRemarks?: string;

  hod?: string;
  createdBy?: string;
  createdOn?: string;
  baseurl?: string;
}
