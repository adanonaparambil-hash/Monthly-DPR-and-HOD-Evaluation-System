import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';

export interface DPRReport {
  id: number;
  employeeName: string;
  month: string;
  year: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  hodName: string;
  submittedDate?: string;
  approvedDate?: string;
}

export interface ReportFilters {
  employeeName?: string;
  month?: string;
  year?: string;
  status?: string;
  hodName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class Reports {
  private mockReports: DPRReport[] = [
    {
      id: 1,
      employeeName: 'John Smith',
      month: 'January',
      year: '2024',
      status: 'Approved',
      hodName: 'Sarah Johnson',
      submittedDate: '2024-01-31',
      approvedDate: '2024-02-02'
    },
    {
      id: 2,
      employeeName: 'Emma Davis',
      month: 'January',
      year: '2024',
      status: 'Pending',
      hodName: 'Michael Brown',
      submittedDate: '2024-01-31'
    },
    {
      id: 3,
      employeeName: 'David Wilson',
      month: 'February',
      year: '2024',
      status: 'Rejected',
      hodName: 'Sarah Johnson',
      submittedDate: '2024-02-29',
      approvedDate: '2024-03-02'
    },
    {
      id: 4,
      employeeName: 'Lisa Anderson',
      month: 'February',
      year: '2024',
      status: 'Approved',
      hodName: 'Robert Taylor',
      submittedDate: '2024-02-29',
      approvedDate: '2024-03-01'
    },
    {
      id: 5,
      employeeName: 'Mark Thompson',
      month: 'March',
      year: '2024',
      status: 'Approved',
      hodName: 'Sarah Johnson',
      submittedDate: '2024-03-31',
      approvedDate: '2024-04-01'
    }
  ];

  constructor() { }

  getReports(filters?: ReportFilters): Observable<DPRReport[]> {
    let filteredReports = [...this.mockReports];

    if (filters) {
      filteredReports = filteredReports.filter(report => {
        return (
          (!filters.employeeName || report.employeeName.toLowerCase().includes(filters.employeeName.toLowerCase())) &&
          (!filters.month || report.month === filters.month) &&
          (!filters.year || report.year === filters.year) &&
          (!filters.status || report.status === filters.status) &&
          (!filters.hodName || report.hodName.toLowerCase().includes(filters.hodName.toLowerCase()))
        );
      });
    }

    // Simulate API delay
    return of(filteredReports).pipe(delay(300));
  }

  getReportById(id: number): Observable<DPRReport | undefined> {
    const report = this.mockReports.find(r => r.id === id);
    return of(report).pipe(delay(200));
  }

  // Method to connect to your actual API
  // Replace this with your actual HTTP calls
  /*
  getReportsFromAPI(filters?: ReportFilters): Observable<DPRReport[]> {
    const params = new HttpParams();
    if (filters?.employeeName) params.set('employeeName', filters.employeeName);
    if (filters?.month) params.set('month', filters.month);
    if (filters?.year) params.set('year', filters.year);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.hodName) params.set('hodName', filters.hodName);
    
    return this.http.get<DPRReport[]>('/api/reports', { params });
  }
  */
}
