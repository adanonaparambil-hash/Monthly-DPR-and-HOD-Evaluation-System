export interface EmployeeExitResponsibility {
  activities: string;
  project: string;
  rpersonPhone: string;
  rpersonEmail: string;
  rpersonEmpId: string;
  remarks: string;
}


export interface EmployeeExitRequest {
  exitId?: number;
  employeeId: string;
  formType: string;
  dateOfDeparture: string;
  dateArrival: string;
  flightTime: string;
  responsibilitiesHanded: string;
  noOfDaysApproved: number;
  depHod: string;
  projectSiteIncharge: string;
  reasonForLeave: string;
  approvalStatus: string;
  category: string;
  lastWorkingDate :string;
  NoticePeriod : number;
  declaration1?: string;
  declaration2?: string;
  declaration3?: string;
  declaration4?: string;
  responsibilities: EmployeeExitResponsibility[];
}