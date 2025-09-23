import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { MonthlyDprComponent } from './monthly-dpr.component/monthly-dpr.component';
import { PastReportsComponent } from './past-reports/past-reports.component';
import { ProfileComponent } from './profile/profile.component';
import { EmployeeDashboard } from './employee-dashboard/employee-dashboard';
import { HodDashboard } from './hod-dashboard/hod-dashboard';
import { layout } from './layout/layout';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'employee-dashboard-demo', component: EmployeeDashboard },
  { path: 'hod-dashboard-demo', component: HodDashboard },
  {
    path: '',
    component: layout,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'employee-dashboard', component: EmployeeDashboard },
      { path: 'hod-dashboard', component: HodDashboard },
      { path: 'monthly-dpr', component: MonthlyDprComponent },
      { path: 'past-reports', component: PastReportsComponent },
      { path: 'profile', component: ProfileComponent },
    ]
  },
  { path: '**', redirectTo: 'login' },
];
