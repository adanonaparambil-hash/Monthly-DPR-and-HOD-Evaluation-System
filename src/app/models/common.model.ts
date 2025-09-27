

export interface ServiceResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface EmployeeDocumentUpload {
  empId: number;
  docName: string;
  docType: string;
  docCategory: string;
  uploadedBy: string;
  fileData: File;   
}