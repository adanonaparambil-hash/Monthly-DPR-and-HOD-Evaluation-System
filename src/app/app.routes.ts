import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { MonthlyDprComponent } from './monthly-dpr.component/monthly-dpr.component';
import { PastReportsComponent } from './past-reports/past-reports.component';
import { ProfileComponent } from './profile/profile.component';
import { EmployeeDashboard } from './employee-dashboard/employee-dashboard';
import { HodDashboard } from './hod-dashboard/hod-dashboard';
import { CedDashboard } from './ced-dashboard/ced-dashboard';
import { CedDashboardNewComponent } from './ced-dashboard-new/ced-dashboard-new.component';
import { EmergencyExitFormComponent } from './emergency-exit-form/emergency-exit-form.component';
import { LeaveApprovalComponent } from './leave-approval/leave-approval.component';
import { DprApprovalComponent } from './dpr-approval/dpr-approval.component';
import { ChatComponent } from './chat/chat.component';
import { MyTaskComponent } from './my-task/my-task.component';
import { MyLoggedHoursComponent } from './my-logged-hours/my-logged-hours';

import { layout } from './layout/layout';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'employee-dashboard-demo', component: EmployeeDashboard },
  { path: 'hod-dashboard-demo', component: HodDashboard },
  { path: 'ced-dashboard-demo', component: CedDashboard },
  { path: 'ced-dashboard-new-demo', component: CedDashboardNewComponent },
  {
    path: '',
    component: layout,
    canActivate: [AuthGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'employee-dashboard', component: EmployeeDashboard },
      { path: 'hod-dashboard', component: HodDashboard },
      { path: 'ced-dashboard', component: CedDashboardNewComponent },
      { path: 'ced-dashboard-old', component: CedDashboard },
      { path: 'ced-dashboard-new', component: CedDashboardNewComponent },
      { path: 'monthly-dpr', component: MonthlyDprComponent },
      { path: 'monthly-dpr/:id', component: MonthlyDprComponent },
      { path: 'past-reports', component: PastReportsComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'exit-form', component: EmergencyExitFormComponent },
      { path: 'leave-approval', component: LeaveApprovalComponent },
      { path: 'dpr-approval', component: DprApprovalComponent },
      { path: 'chat', component: ChatComponent },
      { path: 'my-task', component: MyTaskComponent },
      { path: 'my-logged-hours', component: MyLoggedHoursComponent },
    ]
  },
  { path: '**', redirectTo: 'login' },
];
