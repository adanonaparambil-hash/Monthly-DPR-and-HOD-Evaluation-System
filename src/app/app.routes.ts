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
import { WirReportGuard } from './guards/wir-report.guard';
import { MirReportGuard } from './guards/mir-report.guard';
import { QtbtReportGuard } from './guards/qtbt-report.guard';
import { NcrReportGuard } from './guards/ncr-report.guard';
import { NcrRespondReportGuard } from './guards/ncr-respond-report.guard';
import { NcrClosureReportGuard } from './guards/ncr-closure-report.guard';
import { SorReportGuard } from './guards/sor-report.guard';
import { QaqcWeeklyGuard } from './guards/qaqc-weekly.guard';
import { CedDprAnalyticsGuard } from './guards/ced-dpr-analytics.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', loadComponent: () => import('./login/login.component').then(m => m.LoginComponent) },

  { path: 'employee-dashboard-demo', loadComponent: () => import('./employee-dashboard/employee-dashboard').then(m => m.EmployeeDashboard) },
  { path: 'dpr-employee-dashboard-demo', loadComponent: () => import('./dpr-employee-dashboard/dpr-employee-dashboard.component').then(m => m.DprEmployeeDashboardComponent) },
  { path: 'dpr-hod-dashboard-demo',      loadComponent: () => import('./dpr-hod-dashboard/dpr-hod-dashboard.component').then(m => m.DprHodDashboardComponent) },
  { path: 'hod-dashboard-demo',      loadComponent: () => import('./hod-dashboard/hod-dashboard').then(m => m.HodDashboard) },
  { path: 'ced-dashboard-demo',      loadComponent: () => import('./ced-dashboard/ced-dashboard').then(m => m.CedDashboard) },
  { path: 'ced-dashboard-new-demo',  loadComponent: () => import('./ced-dashboard-new/ced-dashboard-new.component').then(m => m.CedDashboardNewComponent) },
  { path: 'exit-flow-config-demo',   loadComponent: () => import('./exit-approval-flow-config/exit-flow-config-page.component').then(m => m.ExitFlowConfigPageComponent) },

  {
    path: '',
    component: layout,
    canActivate: [AuthGuard],
    children: [
      { path: 'dashboard',           loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'employee-dashboard',  loadComponent: () => import('./employee-dashboard/employee-dashboard').then(m => m.EmployeeDashboard) },
      { path: 'dpr-employee-dashboard', loadComponent: () => import('./dpr-employee-dashboard/dpr-employee-dashboard.component').then(m => m.DprEmployeeDashboardComponent) },
      { path: 'dpr-hod-dashboard',      loadComponent: () => import('./dpr-hod-dashboard/dpr-hod-dashboard.component').then(m => m.DprHodDashboardComponent) },
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
      // Employee-type approval flow: the type picker + chain preview, and the
      // configuration modal. Standalone page so both procedures can be used
      // without changing the exit form itself.
      { path: 'exit-flow-config',    loadComponent: () => import('./exit-approval-flow-config/exit-flow-config-page.component').then(m => m.ExitFlowConfigPageComponent) },
      // Finance — supplier payment reports, read from the ADK2026 (Axpert)
      // schema. The MENU is granted per user in the menu master (121/122/123);
      // these routes stay reachable by URL to anyone signed in, so the API is
      // the real gate.
      { path: 'supplier-payment-forecast', loadComponent: () => import('./finance-reports/supplier-payment-forecast.component').then(m => m.SupplierPaymentForecastComponent) },
      { path: 'supplier-overdue-aging',    loadComponent: () => import('./finance-reports/supplier-overdue-aging.component').then(m => m.SupplierOverdueAgingComponent) },
      { path: 'rejoining-form',      loadComponent: () => import('./rejoining-form/rejoining-form').then(m => m.RejoiningForm) },
      { path: 'leave-approval',      loadComponent: () => import('./leave-approval/leave-approval.component').then(m => m.LeaveApprovalComponent) },
      { path: 'form-requests',       loadComponent: () => import('./leave-approval/leave-approval.component').then(m => m.LeaveApprovalComponent), data: { view: 'myRequests' } },
      { path: 'leave-inbox',         loadComponent: () => import('./leave-records/leave-records.component').then(m => m.LeaveRecordsComponent), data: { mode: 'inbox' } },
      { path: 'leave-report',        loadComponent: () => import('./leave-records/leave-records.component').then(m => m.LeaveRecordsComponent), data: { mode: 'report' } },
      { path: 'dpr-approval',        loadComponent: () => import('./dpr-approval/dpr-approval.component').then(m => m.DprApprovalComponent) },
      { path: 'chat',                loadComponent: () => import('./chat/chat.component').then(m => m.ChatComponent) },
      { path: 'my-task',             loadComponent: () => import('./my-task/my-task.component').then(m => m.MyTaskComponent) },
      { path: 'my-logged-hours',     loadComponent: () => import('./my-logged-hours/my-logged-hours').then(m => m.MyLoggedHoursComponent) },
      { path: 'log-analytics',       loadComponent: () => import('./log-analytics/log-analytics.component').then(m => m.LogAnalyticsComponent), canActivate: [LogAnalyticsGuard] },
      { path: 'ced-dpr-analytics',   loadComponent: () => import('./ced-dpr-analytics/ced-dpr-analytics.component').then(m => m.CedDprAnalyticsComponent), canActivate: [CedDprAnalyticsGuard] },
      { path: 'notice-management',   loadComponent: () => import('./notice-management/notice-management.component').then(m => m.NoticeManagementComponent) },
      { path: 'hod-master',          loadComponent: () => import('./hod-master/hod-master.component').then(m => m.HodMasterComponent) },
      { path: 'employee-master',     loadComponent: () => import('./employee-master/employee-master.component').then(m => m.EmployeeMasterComponent) },
      { path: 'leave-application',   loadComponent: () => import('./leave-application/leave-application.component').then(m => m.LeaveApplicationComponent) },
      { path: 'employee-directory',  loadComponent: () => import('./employee-directory/employee-directory.component').then(m => m.EmployeeDirectoryComponent) },
      { path: 'menu-management',     loadComponent: () => import('./menu-management/menu-management.component').then(m => m.MenuManagementComponent) },
      { path: 'byod-form',           loadComponent: () => import('./byod-form/byod-form.component').then(m => m.ByodFormComponent) },
      { path: 'ot-request',          loadComponent: () => import('./ot-request/ot-request.component').then(m => m.OtRequestComponent) },
      { path: 'ot-approvals',        loadComponent: () => import('./ot-approvals/ot-approvals.component').then(m => m.OtApprovalsComponent) },
      { path: 'wir-reports',         loadComponent: () => import('./wir-report/wir-report.component').then(m => m.WirReportComponent), canActivate: [WirReportGuard] },
      { path: 'mir-reports',         loadComponent: () => import('./mir-report/mir-report.component').then(m => m.MirReportComponent), canActivate: [MirReportGuard] },
      { path: 'qtbt-reports',        loadComponent: () => import('./qtbt-report/qtbt-report.component').then(m => m.QtbtReportComponent), canActivate: [QtbtReportGuard] },
      { path: 'ncr-reports',         loadComponent: () => import('./ncr-report/ncr-report.component').then(m => m.NcrReportComponent), canActivate: [NcrReportGuard] },
      { path: 'ncr-respond-reports', loadComponent: () => import('./ncr-respond-report/ncr-respond-report.component').then(m => m.NcrRespondReportComponent), canActivate: [NcrRespondReportGuard] },
      { path: 'ncr-closure-reports', loadComponent: () => import('./ncr-closure-report/ncr-closure-report.component').then(m => m.NcrClosureReportComponent), canActivate: [NcrClosureReportGuard] },
      { path: 'sor-reports',         loadComponent: () => import('./sor-report/sor-report.component').then(m => m.SorReportComponent), canActivate: [SorReportGuard] },
      { path: 'qaqc-weekly',        loadComponent: () => import('./qaqc-weekly-dashboard/qaqc-weekly-dashboard.component').then(m => m.QaqcWeeklyDashboardComponent), canActivate: [QaqcWeeklyGuard] },
      {
        path: 'purchase-dashboard',
        loadComponent: () => import('./purchase-dashboard/purchase-dashboard.component').then(m => m.PurchaseDashboardComponent),
        canActivate: [PurchaseDashboardGuard]
      },
    ]
  },

  { path: '**', redirectTo: 'login' },
];
