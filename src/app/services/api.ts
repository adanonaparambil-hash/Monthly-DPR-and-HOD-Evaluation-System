import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})

export class Api {
  private readonly apiUrl = `${environment.apiBaseUrl}/api`;

  constructor(private http: HttpClient) {}

  // Example: get all employees
  getEmployees(): Observable<any> {
    return this.http.get(`${this.apiUrl}/WeatherForecast/GetWeatherForecast`);
  }

  // Example: login
  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/Login/UserLogin`, { username, password });
  }

  // Example: set new password
  setpassword(username: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/Login/setpassword`, { username, password });
  }

}
