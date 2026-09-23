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
  /** The employee the form is FOR — the ID No. picked on the form (defaults to
   *  the signed-in user). Bound to p_employee_id. */
  employeeId: string;
  /** The signed-in user who filed the form — may differ from employeeId when a
   *  form is raised on someone's behalf. Bound to p_created_by. */
  createdBy?: string;
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
  /**
   * Worker category only. Those forms ask for a Site Admin and a Camp Boss
   * instead of an HOD, so depHod is empty on them and these carry the EMPIDs.
   * Empty for Staff and Omani. Also returned when a saved form is read back.
   */
  siteAdmin?: string;
  campBoss?: string;
  projectSiteIncharge?: string;
  reasonForLeave?: string;
  approvalStatus?: string;
  category?: string;
  /**
   * Which approval chain the form is filed under -> TS_EMPLOYEE_EXIT.APPROVAL_TYPE.
   * Derived from Category: Staff resolves to 'STAFF', while Worker and Omani take
   * the Employee type picked in the "Current Approval Flow" card. Matches
   * TM_EMP_TYPE_MASTER.TYPE_CODE.
   *
   * Honoured on the FIRST save only — the procedure keeps the stored value on a
   * resubmit, so the chain cannot be switched after approvals have started.
   */
  approvalType?: string;
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
  toDate?: string;
  /** Paging for My Submitted Requests. Omit and the API falls back to page 1 / 500. */
  pageNo?: number;
  pageSize?: number;
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
  pageNo?: number;
  pageSize?: number;
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
  pdfBase64?: string;  // base64 PDF attached when Admin (final) approver approves
}

export interface IssuedAsset {
  tagNo: string;
  category: string;
  empId: string;
  allocationDate: string;
  model: string;
  manufacture: string;
  engNo?: string;

  // BYOD records (recType 'BYOD') carry these instead of tag/model
  recType?: string | null;      // 'BYOD' | null (normal asset)
  branchName?: string | null;
  byodHdrId?: string | null;
  docDate?: string | null;      // DD-MM-YYYY
  startDate?: string | null;    // DD-MM-YYYY
  endDate?: string | null;      // DD-MM-YYYY
  noOfMonths?: number | null;
  amount?: number | null;
  amtPerMonth?: number | null;
  lap?: string | null;          // e.g. 'Laptop 1'
  con?: string | null;          // e.g. 'DUE'
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


// ═══════════════════════════════════════════════════════════════════════════
// EMP-TYPE DRIVEN APPROVAL FLOW  (TM_EMP_TYPE_MASTER)
// Backed by PKG_EXITFORM.SP_GET_EMP_TYPE_APPROVAL_FLOW /
// SP_GET_EXIT_FLOW_CONFIG_HOD / SP_SAVE_EXIT_FLOW_CONFIG.
//
// The only approval-flow types in the UI: the older SP_GET_EXIT_APPROVAL_FLOWS
// pair was removed along with that procedure.
// ═══════════════════════════════════════════════════════════════════════════

/** One selectable employee type. levelCount 0 = nothing configured yet. */
export interface EmpType {
  typeId?: number | null;
  typeCode?: string | null;
  typeName?: string | null;
  levelCount?: number | null;
  isSelected?: string | null;      // 'Y' when it is the requested type
}

/** One (level, role, person) row of the chosen type's chain, already ordered. */
export interface EmpTypeFlowStep {
  flowId?: number | null;
  empType?: string | null;
  empTypeName?: string | null;
  approvalLevel?: number | null;
  roleCode?: string | null;
  departmentId?: string | null;
  isAnyOneAllowed?: string | null;
  /** 'Y' for HOD / PROJECT_MANAGER / HANDOVER — the person is named on the
   *  form, so an empty employeeId here is correct, not a misconfiguration. */
  isFormSelected?: string | null;

  deptPersonId?: number | null;
  employeeId?: string | null;
  employeeName?: string | null;
  designation?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  isHead?: string | null;
  approverCount?: number | null;
}

export interface EmpTypeApprovalFlowResult {
  types: EmpType[];
  steps: EmpTypeFlowStep[];
}

/** Configuration modal — cursor 1. */
export interface FlowConfigType {
  typeId?: number | null;
  typeCode?: string | null;
  typeName?: string | null;
  isActive?: string | null;
  createdBy?: string | null;
  createdOn?: string | null;
  levelCount?: number | null;
  approverCount?: number | null;
}

/** Configuration modal — cursor 2. Every FLOW_MASTER column. */
export interface FlowConfigLevel {
  flowId?: number | null;
  empType?: string | null;
  departmentId?: string | null;
  approvalLevel?: number | null;
  roleCode?: string | null;
  isAnyOneAllowed?: string | null;
  isActive?: string | null;
  formType?: string | null;
  createdBy?: string | null;
  createdOn?: string | null;
  isFormSelected?: string | null;
  /** 0 = a level nobody can approve. */
  personCount?: number | null;
}

/** Configuration modal — cursor 3. Every DEPARTMENT_PERSONS column. */
export interface FlowConfigApprover {
  deptPersonId?: number | null;
  empType?: string | null;
  departmentId?: string | null;
  roleCode?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  designation?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  isHead?: string | null;
  isNational?: string | null;
  isActive?: string | null;
  formType?: string | null;
  createdBy?: string | null;
  createdOn?: string | null;
  /** 'N' = sits on a role with no active level, so never asked to approve. */
  hasLevel?: string | null;
}

/** Configuration modal — cursor 4. */
export interface FlowConfigRole {
  roleCode?: string | null;
  isFormSelected?: string | null;
}

export interface FlowConfigResult {
  types: FlowConfigType[];
  levels: FlowConfigLevel[];
  approvers: FlowConfigApprover[];
  roles: FlowConfigRole[];
}

/**
 * The modal's single write. id null/0 creates, otherwise updates.
 * A TYPE can only be created, never edited.
 * There is no delete anywhere — send isActive: 'N'.
 */
export interface SaveFlowConfigRequest {
  entity: 'TYPE' | 'LEVEL' | 'APPROVER';
  id?: number | null;
  formType?: string | null;

  // TYPE
  typeCode?: string | null;
  typeName?: string | null;

  // LEVEL + APPROVER
  empType?: string | null;
  departmentId?: string | null;
  roleCode?: string | null;

  // LEVEL
  approvalLevel?: number | null;
  isAnyOneAllowed?: string | null;

  // APPROVER
  employeeId?: string | null;
  isHead?: string | null;
  isNational?: string | null;

  isActive?: string | null;
}
