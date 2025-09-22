import { Injectable } from '@angular/core';
import { HttpClient,HttpParams  } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DPRReview, DPRKPI } from '../models/task.model';

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
    return this.http.post(`${this.apiUrl}/InsertDPREmployeeReviewDetails`, review);
  }

  updateDPRReview(review: DPRReview): Observable<any> {
    return this.http.post(`${this.apiUrl}/HODReviewUpdate`, review);
  }


  GetDPREmployeeReviewDetails(dprId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/GetDPREmployeeReviewDetails/${dprId}`);
  }


  GetUserProofhubTasks(email: string, startDate: Date, endDate: Date): Observable<any> {
    const params = new HttpParams()
      .set('email', email)
      .set('startDate', startDate.toISOString()) 
      .set('endDate', endDate.toISOString());   

    return this.http.get(`${this.apiUrl}/GetUserProofhubTasks`, { params });
  }



}
