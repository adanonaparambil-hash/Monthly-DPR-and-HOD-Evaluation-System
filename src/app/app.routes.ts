import { Routes } from '@angular/router';

// PERF — every route below is LAZY (`loadComponent`), not a static import.
//
// It used to import all 27 page components at the top of this file, which made
// them one eager bundle: main.js was 5.64 MB (787 kB gzipped) and the browser
// had to download and parse ALL of it — every dashboard, every form, jspdf,
// html2canvas, xlsx, sweetalert2 — before the first screen could paint. That,
// not the database, is what made the CED dashboard slow to appear on first
// load (its three API calls together take ~150 ms server-side).
//
// With loadComponent, Angular emits one small chunk per page and fetches only
// the chunk being navigated to. Keep it this way: adding a static
// `import { X } from './x'` here and using `component: X` pulls that page —
// and everything it imports — back into the initial bundle.
//
// Only `layout` stays eager: it is the shell that hosts every child route, so
// it is needed immediately anyway.
import { layout } from './layout/layout';
import { AuthGuard } from './guards/auth.guard';
import { PurchaseDashboardGuard } from './guards/purchase-dashboard.guard';
import { LogAnalyticsGuard } from './guards/log-analytics.guard';
import { CedDprAnalyticsGuard } from './guards/ced-dpr-analytics.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', loadComponent: () => import('./login/login.component').then(m => m.LoginComponent) },

  { path: 'employee-dashboard-demo', loadComponent: () => import('./employee-dashboard/employee-dashboard').then(m => m.EmployeeDashboard) },
  { path: 'hod-dashboard-demo',      loadComponent: () => import('./hod-dashboard/hod-dashboard').then(m => m.HodDashboard) },
  { path: 'ced-dashboard-demo',      loadComponent: () => import('./ced-dashboard/ced-dashboard').then(m => m.CedDashboard) },
  { path: 'ced-dashboard-new-demo',  loadComponent: () => import('./ced-dashboard-new/ced-dashboard-new.component').then(m => m.CedDashboardNewComponent) },

  {
    path: '',
    component: layout,
    canActivate: [AuthGuard],
    children: [
      { path: 'dashboard',           loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'employee-dashboard',  loadComponent: () => import('./employee-dashboard/employee-dashboard').then(m => m.EmployeeDashboard) },
      { path: 'hod-dashboard',       loadComponent: () => import('./hod-dashboard/hod-dashboard').then(m => m.HodDashboard) },
      { path: 'ced-dashboard',       loadComponent: () => import('./ced-dashboard-new/ced-dashboard-new.component').then(m => m.CedDashboardNewComponent) },
      { path: 'ced-dashboard-old',   loadComponent: () => import('./ced-dashboard/ced-dashboard').then(m => m.CedDashboard) },
      { path: 'ced-dashboard-new',   loadComponent: () => import('./ced-dashboard-new/ced-dashboard-new.component').then(m => m.CedDashboardNewComponent) },
      { path: 'monthly-dpr',         loadComponent: () => import('./monthly-dpr.component/monthly-dpr.component').then(m => m.MonthlyDprComponent) },
      { path: 'monthly-dpr/:id',     loadComponent: () => import('./monthly-dpr.component/monthly-dpr.component').then(m => m.MonthlyDprComponent) },
      { path: 'past-reports',        loadComponent: () => import('./past-reports/past-reports.component').then(m => m.PastReportsComponent) },
      { path: 'apr',                 loadComponent: () => import('./apr.component/apr.component').then(m => m.AprComponent) },
      { path: 'apr/:id',             loadComponent: () => import('./apr.component/apr.component').then(m => m.AprComponent) },
      { path: 'apr-past-reports',    loadComponent: () => import('./apr-past-reports/apr-past-reports.component').then(m => m.AprPastReportsComponent) },
      { path: 'profile',             loadComponent: () => import('./profile/profile.component').then(m => m.ProfileComponent) },
      { path: 'exit-form',           loadComponent: () => import('./emergency-exit-form/emergency-exit-form.component').then(m => m.EmergencyExitFormComponent) },
      { path: 'rejoining-form',      loadComponent: () => import('./rejoining-form/rejoining-form').then(m => m.RejoiningForm) },
      { path: 'leave-approval',      loadComponent: () => import('./leave-approval/leave-approval.component').then(m => m.LeaveApprovalComponent) },
      { path: 'dpr-approval',        loadComponent: () => import('./dpr-approval/dpr-approval.component').then(m => m.DprApprovalComponent) },
      { path: 'chat',                loadComponent: () => import('./chat/chat.component').then(m => m.ChatComponent) },
      { path: 'my-task',             loadComponent: () => import('./my-task/my-task.component').then(m => m.MyTaskComponent) },
      { path: 'my-logged-hours',     loadComponent: () => import('./my-logged-hours/my-logged-hours').then(m => m.MyLoggedHoursComponent) },
      { path: 'log-analytics',       loadComponent: () => import('./log-analytics/log-analytics.component').then(m => m.LogAnalyticsComponent), canActivate: [LogAnalyticsGuard] },
      { path: 'ced-dpr-analytics',   loadComponent: () => import('./ced-dpr-analytics/ced-dpr-analytics.component').then(m => m.CedDprAnalyticsComponent), canActivate: [CedDprAnalyticsGuard] },
      { path: 'notice-management',   loadComponent: () => import('./notice-management/notice-management.component').then(m => m.NoticeManagementComponent) },
      { path: 'hod-master',          loadComponent: () => import('./hod-master/hod-master.component').then(m => m.HodMasterComponent) },
      { path: 'employee-master',     loadComponent: () => import('./employee-master/employee-master.component').then(m => m.EmployeeMasterComponent) },
      { path: 'byod-form',           loadComponent: () => import('./byod-form/byod-form.component').then(m => m.ByodFormComponent) },
      {
        path: 'purchase-dashboard',
        loadComponent: () => import('./purchase-dashboard/purchase-dashboard.component').then(m => m.PurchaseDashboardComponent),
        canActivate: [PurchaseDashboardGuard]
      },
    ]
  },

  { path: '**', redirectTo: 'login' },
];
