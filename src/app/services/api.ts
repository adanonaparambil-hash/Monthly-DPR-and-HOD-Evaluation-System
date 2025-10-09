import { Injectable } from '@angular/core';
import { HttpClient,HttpParams  } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DPRReview, DPRKPI,ProofhubTaskDto , DPRMonthlyReviewListingRequest } from '../models/task.model';
import { EmployeeDocumentUpload,EmployeeProfileUpdateDto,DropDownMasterDto,DropDownChildDto } from '../models/common.model';

@Injectable({
  providedIn: 'root'
})

export class Api {
  private readonly apiUrl = `${environment.apiBaseUrl}/api`;

  constructor(private http: HttpClient) {}



  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/Login/UserLogin`, { username, password });
  }


  setpassword(username: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/Login/setpassword`, { username, password });
  }


  insertDpr(review: DPRReview): Observable<any> {

    return this.http.post(`${this.apiUrl}/DPRReview/InsertDPREmployeeReviewDetails`, review);
  }

  updateDPRReview(review: DPRReview): Observable<any> {
    return this.http.post(`${this.apiUrl}/DPRReview/HODReviewUpdate`, review);
  }


  GetDPREmployeeReviewDetails(dprId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/DPRReview/GetDPREmployeeReviewDetails/${dprId}`);
  }


 GetUserProofhubTasks(email: string, startDate: string, endDate: string): Observable<any> {

  const params = new HttpParams()
    .set('email', email)
    .set('startDate', startDate) 
    .set('endDate', endDate);    

  return this.http.get(`${this.apiUrl}/proofhubtask/GetUserProofhubTasks`, { params });
}

  GetActiveKPIs(department?: string): Observable<any> {
    let params = '';
    if (department) {
      params = `?department=${department}`;
    }
    return this.http.get(`${this.apiUrl}/DPRReview/GetActiveKPIs${params}`);
  }


  
  summarizeTasks(tasks: ProofhubTaskDto[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/ProofhubTask/SummarizeTasks`, tasks);

  }


  GetMonthlyReviewListing(listingRequest: DPRMonthlyReviewListingRequest []): Observable<any> {
    return this.http.post(`${this.apiUrl}/DPRReview/GetMonthlyReviewListing`, listingRequest);

  }

  uploadDocument(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/Login/UploadDocument`, formData); 
  }

  updateProfile(profile: EmployeeProfileUpdateDto): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/Login/UpdateProfile`, profile);
  }


  
  GetEmployeeProfile(empId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/Login/GetEmployeeProfile/${empId}`);
  }


  
  GetHodMasterList(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Login/GetHodMasterList`);
  }


  sendOtp(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/Login/SendEmailOTP`, { email });
  }

  
  verifyOtp(email: string, otp: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/Login/VerifyEmailOTP`, { email, otp },{ withCredentials: true });
  }
  
  ResendOtp(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/Login/ResendEmailOTP`, { email });
  }

  getDropDownValues(dropMasterId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/General/GetDropDownValues/${dropMasterId}`);
  }

  upsertDropMaster(masterDto: DropDownMasterDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/General/UpsertDropMaster`, masterDto);
  }

  upsertDropChildValue(childDto: DropDownChildDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/General/UpsertDropChildValue`, childDto);
  }

}

