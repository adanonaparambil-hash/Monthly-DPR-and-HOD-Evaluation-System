import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ServiceResponse, MastersDto, TaskSearchRequest, TaskSearchResult, TaskDetailDto
} from '../models/proofhub-task.model';

@Injectable({
  providedIn: 'root'
})
export class ProofhubTaskService {
  private readonly base = `${environment.apiBaseUrl}/api/ProofhubTask`;

  constructor(private http: HttpClient) {}

  /** dropdowns (projects + todolists + creators). pass projectId to scope todolists */
  getMasters(projectId?: number): Observable<ServiceResponse<MastersDto>> {
    let params = new HttpParams();
    if (projectId != null) params = params.set('projectId', projectId);
    return this.http.get<ServiceResponse<MastersDto>>(`${this.base}/GetMasters`, { params });
  }

  /** filtered, paged listing */
  searchTasks(req: TaskSearchRequest): Observable<ServiceResponse<TaskSearchResult>> {
    let params = new HttpParams();
    if (req.title)             params = params.set('title', req.title);
    if (req.projectId != null) params = params.set('projectId', req.projectId);
    if (req.listId != null)    params = params.set('listId', req.listId);
    if (req.createdBy != null) params = params.set('createdBy', req.createdBy);
    if (req.dateFrom)          params = params.set('dateFrom', req.dateFrom);
    if (req.dateTo)            params = params.set('dateTo', req.dateTo);
    params = params.set('page', req.page ?? 1);
    params = params.set('pageSize', req.pageSize ?? 500);
    return this.http.get<ServiceResponse<TaskSearchResult>>(`${this.base}/Search`, { params });
  }

  /** full detail for the modal */
  getTaskDetail(taskId: string | number): Observable<ServiceResponse<TaskDetailDto>> {
    return this.http.get<ServiceResponse<TaskDetailDto>>(`${this.base}/${taskId}/Detail`);
  }
  
}
