import { Injectable } from '@angular/core';
import { HttpClient,HttpParams  } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DPRReview, DPRKPI,ProofhubTaskDto } from '../models/task.model';

@Injectable({
  providedIn: 'root'
})

export class Api {
  private readonly apiUrl = `${environment.apiBaseUrl}/api`;

  constructor(private http: HttpClient) {}


  getEmployees(): Observable<any> {
    return this.http.get(`${this.apiUrl}/WeatherForecast/GetWeatherForecast`);
  }


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
    return this.http.post(`${this.apiUrl}/api/ProofhubTask/SummarizeTasks`, tasks);

  }


}
