import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AiAnswer {
  answer: string;
}


@Injectable({ providedIn: 'root' })
export class AiAssistantService {

  constructor(private http: HttpClient) {}

  ask(message: string, sessionId: string): Observable<AiAnswer> {
    // Calls OUR .NET API only — the API proxies to n8n server-side.
    // Works identically for web and future mobile apps; n8n is never
    // exposed to clients.
    return this.http
      .post<AiAnswer>(`${environment.apiBaseUrl}/api/AI/Chat`, { message, sessionId })
      .pipe(timeout(60000)); // LLM calls can take 10-20s; fail after 60s
  }
}
