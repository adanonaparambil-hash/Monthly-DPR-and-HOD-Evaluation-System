

export interface ServiceResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface EmployeeDocumentUpload {
  empId: string;
  docName: string;
  docType: string;
  docCategory: string;
  uploadedBy: string;
  fileData: number[];  
}


export interface EmployeeProfileUpdateDto {
  empId?: string;
  employeeName?: string;
  department?: string;
  designation?: string;
  phone?: string;
  email?: string;
  careerSummary?: string;
  experienceInd?: number;
  experienceAbroad?: number;
  qualification?: string;
  skillset?: string;
  dobDate?: string;
  doj?: string;        
  dob?: string;
  location?: string;
  ProfileImageBase64?: string; 
  address?: string; 
  telephone?: string; 
  nation?: string; 
  postOffice?: string; 
  state?: string; 
  district?: string; 
  place?: string; 

}

export interface DropdownOption {
  idValue?: string;
  description?: string;
  email?: string;
  phoneNumber?: string;
}

export interface DropDownMasterDto {
  dropMasterId?: number;
  dropMasterName?: string;
  description?: string;
}

export interface DropDownChildDto {
  dropChildId?: number;
  dropMasterId?: number;
  dropValue?: string;
  sortOrder?: number | null;
  isActive: string;
}

export interface DropDownValue {
  dropChildId?: number;
  dropValue?: string;
  sortOrder?: number | null;
}

export interface Notification {
  id?: number;
  userId?: string;
  title?: string;
  message?: string;
  link?: string;
  isRead?: boolean;
  createdAt?: string;
  unreadCount?: number;
}

export interface ClearNotificationRequest {
  notificationId?: number;  
  userId?: string;           
  actionType?: string;       
}


export interface SendEmailRequest {
  templateKey?: string;                   
  toEmail?: string;                       
  placeholders?: { [key: string]: string }; 
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
