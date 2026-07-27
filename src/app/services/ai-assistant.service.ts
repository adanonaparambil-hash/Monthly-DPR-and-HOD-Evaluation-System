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
    // Calls OUR .NET API only — the API calls Claude server-side.
    // Works identically for web and future mobile apps; the LLM key is
    // never exposed to clients.
    // The API's own Claude call times out at 90s, so the frontend must
    // wait LONGER than that — otherwise we show "unavailable" while the
    // backend is still finishing (exactly what happened with CED's large
    // company-wide payload at the old 60s limit).
    return this.http
      .post<AiAnswer>(`${environment.apiBaseUrl}/api/AI/Chat`, { message, sessionId })
      .pipe(timeout(120000)); // > backend's 90s Claude timeout + overhead
  }
}
