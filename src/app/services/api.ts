import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { DPRReview, EmpDashBoard, ProofhubTaskDto, DPRMonthlyReviewListingRequest } from '../models/task.model';
import { EmployeeDocumentUpload, EmployeeProfileUpdateDto, DropDownMasterDto, DropDownChildDto, Notification, ClearNotificationRequest, SendEmailRequest, ExitEmpProfileDetails } from '../models/common.model';
import { HODDepartmentDashboard } from '../models/dashBoard.model';
import { EmployeeExitRequest, MyApprovalRequest, EmployeeApprovalInboxRequest, UpdateExitApprovalRequest } from '../models/employeeExit.model';
import { TaskSaveDto,DeleteTaskRequest,TaskTimerActionDto,TaskCommentDto,ToggleFavouriteCategoryRequest,TaskCategoryRequest,UserBreakRequest,TaskFieldMappingRequest,TaskBulkApprovalRequest,UserDailyLogHistoryRequest } from '../models/TimeSheetDPR.model';


@Injectable({
  providedIn: 'root'
})

export class Api {
  private readonly apiUrl = `${environment.apiBaseUrl}/api`;

  constructor(private http: HttpClient) { }

  // Handle HTTP errors, especially session expiry and 431 errors
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    if (error.status === 401) {
      // Session expired - will be handled by AuthInterceptor
      console.log('API call failed due to session expiry');
    } else if (error.status === 431) {
      // Request header fields too large - will be handled by AuthInterceptor
      console.log('API call failed due to large headers (431)');
    }
    return throwError(() => error);
  }



  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/Login/UserLogin`, { username, password })
      .pipe(catchError(this.handleError));
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


  GetMonthlyReviewListing(listingRequest: DPRMonthlyReviewListingRequest): Observable<any> {
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

  GetProjectManagerList(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Login/GetProjectManagerList`);
  }


  sendOtp(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/Login/SendEmailOTP`, { email }, { withCredentials: true });
  }


  verifyOtp(email: string, otp: string): Observable<any> {

    const request = {
      Email: email,
      Otp: otp
    };

    return this.http.post(`${this.apiUrl}/Login/VerifyEmailOTP`, request, { withCredentials: true });
  }

  ResendOtp(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/Login/ResendEmailOTP`, { email }, { withCredentials: true });
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

  // Notification API Methods
  getUserNotifications(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/General/GetUserNotifications/${userId}`);
  }

  GetUnreadNotificationCount(userId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/General/GetUnreadNotificationCount/${userId}`, {});
  }

  createNotification(notification: Partial<Notification>): Observable<any> {
    return this.http.post(`${this.apiUrl}/General/UpsertNotification`, notification);
  }


  markNotificationAsRead(request: ClearNotificationRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/General/MarkAsReadNotification`, request);
  }

  deleteNotification(request: ClearNotificationRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/General/ClearNotification`, request);
  }


  SendEmail(notification: Partial<SendEmailRequest>): Observable<any> {
    return this.http.post(`${this.apiUrl}/General/SendEmail`, notification);
  }


  GetExitEmployeeDetails(empId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/EmpExitForm/GetExitEmployeeDetails/${empId}`);
  }

  GetEmployeeDashBoardDetails(empId: string, month: number, year: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/DashBoard/GetEmployeeDashBoardDetails/${empId}/${month}/${year}`);
  }

  GetHODDashBoardDetails(empId: string, month: number, year: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/DashBoard/GetHODDashBoardDetails/${empId}/${month}/${year}`);
  }


  GetCEDDepartmentWiseDashBoardDetails(month: number, year: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/DashBoard/GetCEDDepartmentWiseDashBoardDetails/${month}/${year}`);
  }


  GetEmployeeDetailsForcedDashboard(month: number, year: number, statusCondition: string, department: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/DashBoard/GetEmployeeDetailsForcedDashboard/${month}/${year}/${statusCondition}/${department}`);
  }

  GetDepartmentList(): Observable<any> {
    return this.http.get(`${this.apiUrl}/General/GetDepartmentList`);
  }


  GetTodaysBirthdaysAndQuotes(): Observable<any> {
    return this.http.get(`${this.apiUrl}/General/GetTodaysBirthdaysAndQuotes`);
  }


  GetEmployeeMasterList(): Observable<any> {
    return this.http.get(`${this.apiUrl}/General/GetEmployeeMasterList`);
  }


  InsertEmployeeExit(EmployeeExitRequest: EmployeeExitRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/EmpExitForm/InsertEmployeeExit`, EmployeeExitRequest);
  }


  GetMySubmittedRequests(MyApprovalRequest: MyApprovalRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/EmpExitForm/GetMySubmittedRequests`, MyApprovalRequest);
  }

  GetExitApprovalList(request: EmployeeApprovalInboxRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/EmpExitForm/GetExitApprovalList`, request);
  }


  GetEmployeeExitSavedInfo(exitId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/EmpExitForm/GetEmployeeExitSavedInfo/${exitId}`);
  }


  UpdateExitApproval(updateExitApprovalRequest: UpdateExitApprovalRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/EmpExitForm/UpdateExitApproval`, updateExitApprovalRequest);
  }


  GetIssuedAssets(empId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/EmpExitForm/GetIssuedAssets/${empId}`);
  }


  //-------------------------------- TimeSheet --------------------------------


   /* ===================== CUSTOM FIELDS ===================== */

  getCustomFields(): Observable<any> {
    return this.http.get(`${this.apiUrl}/DailyTimeSheet/GetCustomFields`);
  }

  /* ===================== TASK ===================== */

  saveTaskBulk(request: TaskSaveDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/DailyTimeSheet/SaveTaskBulk`, request);
  }

  executeTimer(request: TaskTimerActionDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/DailyTimeSheet/ExecuteTimer`, request);
  }

  /* ===================== COMMENTS ===================== */

  saveComment(request: TaskCommentDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/DailyTimeSheet/SaveComment`, request);
  }

  getComments(taskId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/DailyTimeSheet/GetComments/${taskId}`);
  }

  /* ===================== ACTIVITY ===================== */

  getActivity(taskId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/DailyTimeSheet/GetActivity/${taskId}`);
  }

  /* ===================== FILE UPLOAD ===================== */

  uploadTimeSheetFile(
    taskId: number,
    userId: string,
    file: File
  ): Observable<any> {

    const formData = new FormData();
    formData.append('taskId', taskId.toString());
    formData.append('userId', userId);
    formData.append('file', file);

    return this.http.post(
      `${this.apiUrl}/DailyTimeSheet/UploadFileTimeSheetFile`,
      formData
    );
  }

  getTaskFiles(taskId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/DailyTimeSheet/GetTaskFiles/${taskId}`);
  }

  /* ===================== TASK CATEGORY ===================== */

  getUserTaskCategories(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/DailyTimeSheet/GetUserTaskCategories/${userId}`);
  }

  toggleFavouriteCategory(request: ToggleFavouriteCategoryRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/DailyTimeSheet/ToggleFavourite`, request);
  }

  saveTaskCategory(request: TaskCategoryRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/DailyTimeSheet/SaveTaskCategory`, request);
  }

  /* ===================== MASTER DATA ===================== */

  getDepartmentList(): Observable<any> {
    return this.http.get(`${this.apiUrl}/DailyTimeSheet/GetDepartmentList`);
  }

  getProjects(): Observable<any> {
    return this.http.get(`${this.apiUrl}/DailyTimeSheet/GetProjects`);
  }

  getEmployeesByDepartment(departmentId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/DailyTimeSheet/GetByDepartment/${departmentId}`);
  }

  /* ===================== BREAK ===================== */

  userBreak(request: UserBreakRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/DailyTimeSheet/UserBreak`, request);
  }

  /* ===================== ACTIVE TASKS ===================== */

  getActiveTaskList(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/DailyTimeSheet/ActiveTaskList/${userId}`);
  }

  /* ===================== APPROVAL ===================== */

  getPendingApprovalUsers(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/DailyTimeSheet/PendingApprovalUsers/${userId}`);
  }

  /* ===================== FIELD MAPPING ===================== */

  saveTaskFieldMapping(request: TaskFieldMappingRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/DailyTimeSheet/SaveMapping`, request);
  }



  getTaskById(taskId: number, userId: string, categoryId: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/DailyTimeSheet/GetTaskById/${taskId}/${userId}/${categoryId}`
    );
  }

  deleteTask(request: DeleteTaskRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/DailyTimeSheet/DeleteTask`, request);
  }


  deleteTaskFile(fileId: number, userId: string) {
    const body = {
      fileId: fileId,
      userId: userId
    };

    return this.http.post<any>(
      `${this.apiUrl}/DailyTimeSheet/DeleteTaskFile`,
      body
    );
  }


  getCustomMappedFields(userId: string, categoryId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/DailyTimeSheet/GetCustomMappedFields/${categoryId}/${userId}`);
  }


  getDepartmentTaskCategories(department: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/DailyTimeSheet/GetDepartmentTaskCategories/${department}`);
  }

  bulkTaskApproval(request: TaskBulkApprovalRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/DailyTimeSheet/BulkTaskApproval`, request);
  }

  GetEmployeeApprovalListPaged(employeeId: string, pageNo: number, pageSize: number, fromDate: string | null, toDate: string | null, projectId: number, categoryId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/DailyTimeSheet/GetEmployeeApprovalListPaged/${employeeId}/${pageNo}/${pageSize}/${fromDate ?? ''}/${toDate ?? ''}/${projectId ?? 0}/${categoryId}`);
  }

  getUserDailyLogHistory(request: UserDailyLogHistoryRequest) {
      return this.http.post<any>(
      `${this.apiUrl}/DailyTimeSheet/GetUserDailyLogHistory`,
      request
    );
 }

 
 getOpenBreaks(): Observable<any> {
   return this.http.get(`${this.apiUrl}/DailyTimeSheet/GetOpenBreaks`);
  }
  

  getByDepartment(departmentId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/EmpExitForm/GetByDepartment/${departmentId}`);
  }




  saveCustomField(fieldData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/DailyTimeSheet/SaveCustomField`, fieldData);
  }

  updateCustomField(fieldData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/DailyTimeSheet/UpdateCustomField`, fieldData);
  }

  deleteCustomField(fieldId: number, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/DailyTimeSheet/DeleteCustomField`, { fieldId, userId });
  }

  



}
