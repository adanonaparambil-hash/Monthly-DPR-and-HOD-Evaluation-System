import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AiReportResult {
  role: string;
  scopeLabel: string;
  reportMarkdown: string;
  generatedDate: string;
  fromCache: boolean;
}

/** Authoritative role/scope for the logged-in user (JWT-derived, server-side). */
export interface AiUserCtx {
  empid: string;
  role: string;          // 'E' | 'H' | 'C'
  deptId: number | null;
  name: string;
}

export interface AiDept {
  departmentId: number;
  deptName: string;
}

/** Optional, role-gated filters for GenerateReport. */
export interface AiReportOptions {
  regenerate?: boolean;
  dateFrom?: string | null;   // YYYY-MM-DD
  dateTo?: string | null;     // YYYY-MM-DD
  deptId?: number | null;
}

/**
 * Generates the role-scoped AI insight report via our own API
 * (POST /api/AI/GenerateReport). The API decides the scope + prompt from the
 * JWT — CED = all departments (or one, if drilled), HOD = own department,
 * Employee = own data. Date range / department are honoured per role.
 */
@Injectable({ providedIn: 'root' })
export class AiReportService {
  private readonly base = environment.apiBaseUrl;
  constructor(private http: HttpClient) {}

  generate(opts: AiReportOptions = {}): Observable<AiReportResult> {
    return this.http
      .post<AiReportResult>(`${this.base}/api/AI/GenerateReport`, {
        regenerate: opts.regenerate ?? false,
        dateFrom: opts.dateFrom ?? null,
        dateTo: opts.dateTo ?? null,
        deptId: opts.deptId ?? null
      })
      .pipe(timeout(130000)); // reports can take 20-40s; allow generous headroom
  }

  /** Who am I (role + dept), decided server-side from the JWT. */
  validate(): Observable<AiUserCtx> {
    return this.http.get<AiUserCtx>(`${this.base}/api/AI/ValidateToken`).pipe(timeout(20000));
  }

  /** Department list for the CED department drill-down. */
  departments(): Observable<{ data: AiDept[] }> {
    return this.http.get<{ data: AiDept[] }>(`${this.base}/api/AI/Departments`).pipe(timeout(20000));
  }
}
