

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
}

export interface DropdownOption {
  idValue: string;
  description : string;
}