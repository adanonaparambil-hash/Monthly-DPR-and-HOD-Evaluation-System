import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Api } from '../services/api';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <div class="dashboard-header">
        <h1>Welcome to Dashboard</h1>
        <!-- <button class="logout-btn" (click)="logout()">Logout</button> -->
      </div>
      <div class="dashboard-content">
        <p>You have successfully logged in!</p>
        <p>This is a placeholder dashboard component.</p>
        <div *ngIf="employees?.length">
          <h3>Employees</h3>
          <ul>
            <li *ngFor="let e of employees">{{ e.name || (e | json) }}</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #485E2B 0%, #bfa946 100%);
      padding: 2rem;
    }
    
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }
    
    .dashboard-header h1 {
      color: white;
      margin: 0;
    }
    
    .dashboard-content {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 2rem;
      color: white;
    }
  `]
})
export class DashboardComponent implements OnInit {
  employees: any[] = [];

  constructor(private router: Router, private api: Api) {}

  ngOnInit(): void {
    
    this.api.getEmployees().subscribe({
      next: (data) => {
        this.employees = Array.isArray(data) ? data : (data?.employees || []);
        console.log('Employees', data);
      },
      error: (err) => {
        console.error('Failed to load employees', err);
      }
    });

    console.log("access_token" + localStorage.getItem('access_token'));

  }

}
