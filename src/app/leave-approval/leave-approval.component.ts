import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Router } from '@angular/router';
import { Api } from '../services/api';
import { SessionService } from '../services/session.service';
import { ApprovalWorkflowService } from '../services/approval-workflow.service';
import { EmployeeExitRequest, ApprovalStep, DepartmentApproval, MyApprovalRequest } from '../models/employeeExit.model';

interface LeaveRequest {
  id: string;
  exitId?: number;
  employeeName: string;
  employeeId: string;
  department: string;
  leaveType: string;
  requestDate: any;
  departureDate: any;
  returnDate?: any;
  daysRequested: number;
  reason: string;
  status: string;
  approverName?: string;
  approverComments?: string;
  approvedDate?: Date;
  priority?: string;
  approvalWorkflow?: ApprovalStep[];
  departmentApprovals?: DepartmentApproval[];
  currentApprovalStep?: number;
  overallStatus?: string;
  canApprove?: boolean;
  myApprovalStep?: ApprovalStep;
}

@Component({
  selector: 'app-leave-approval',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './leave-approval.component.html',
  styleUrls: ['./leave-approval.component.css'],
  animations: [
    trigger('slideInUp', [
      state('in', style({ transform: 'translateY(0)', opacity: 1 })),
      transition('void => *', [
        style({ transform: 'translateY(30px)', opacity: 0 }),
        animate('0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)')
      ])
    ]),
    trigger('fadeInUp', [
      state('in', style({ transform: 'translateY(0)', opacity: 1 })),
      transition('void => *', [
        style({ transform: 'translateY(20px)', opacity: 0 }),
        animate('0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)')
      ])
    ]),
    trigger('tabTransition', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('0.3s ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ])
    ])
  ]
})
export class LeaveApprovalComponent implements OnInit {
  activeTab: 'pending' | 'myRequests' = 'pending';

  // Pending approvals data
  pendingApprovals: LeaveRequest[] = [];

  // My requests data
  myRequests: LeaveRequest[] = [];

  // Filters
  statusFilter: string = 'all';
  typeFilter: string = 'all';
  dateFilter: string = 'all';

  // Loading states
  isLoadingPending = false;
  isLoadingMyRequests = false;

  // Current user info
  currentUser: any = null;

  constructor(
    private api: Api,
    private sessionService: SessionService,
    private approvalWorkflowService: ApprovalWorkflowService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.currentUser = this.sessionService.getCurrentUser();
    this.loadPendingApprovals();
    this.loadMyRequests();
  }

  switchTab(tab: 'pending' | 'myRequests'): void {
    this.activeTab = tab;
    if (tab === 'pending' && this.pendingApprovals.length === 0) {
      this.loadPendingApprovals();
    } else if (tab === 'myRequests' && this.myRequests.length === 0) {
      this.loadMyRequests();
    }
  }

  loadPendingApprovals(): void {
    this.isLoadingPending = true;

    // Mock data with comprehensive approval workflow
    setTimeout(() => {
      this.pendingApprovals = [
        {
          id: 'REQ001',
          employeeName: 'John Smith',
          employeeId: 'EMP001',
          department: 'IT Department',
          leaveType: 'Emergency',
          requestDate: new Date('2024-12-10'),
          departureDate: new Date('2024-12-15'),
          returnDate: new Date('2024-12-20'),
          daysRequested: 5,
          reason: 'Family emergency - need to travel urgently',
          status: 'Pending',
          priority: 'High',
          overallStatus: 'PENDING',
          currentApprovalStep: 1,
          canApprove: true,
          approvalWorkflow: [
            {
              stepId: 1,
              stepName: 'Responsible Person Approval',
              approverType: 'RESPONSIBLE_PERSON',
              approverIds: ['EMP123'],
              approverNames: ['Mike Johnson'],
              status: 'PENDING',
              isRequired: true,
              order: 1
            },
            {
              stepId: 2,
              stepName: 'HOD Approval',
              approverType: 'HOD',
              approverIds: ['HOD001'],
              approverNames: ['IT HOD'],
              status: 'PENDING',
              isRequired: true,
              order: 2
            },
            {
              stepId: 3,
              stepName: 'IT Department Approval',
              approverType: 'DEPARTMENT',
              approverIds: ['it'],
              approverNames: ['IT'],
              status: 'PENDING',
              isRequired: true,
              order: 3
            },
            {
              stepId: 4,
              stepName: 'Admin Final Approval',
              approverType: 'DEPARTMENT',
              approverIds: ['admin'],
              approverNames: ['Admin'],
              status: 'PENDING',
              isRequired: true,
              order: 4
            }
          ],
          myApprovalStep: {
            stepId: 1,
            stepName: 'Responsible Person Approval',
            approverType: 'RESPONSIBLE_PERSON',
            approverIds: ['EMP123'],
            approverNames: ['Mike Johnson'],
            status: 'PENDING',
            isRequired: true,
            order: 1
          }
        },
        {
          id: 'REQ002',
          employeeName: 'Sarah Johnson',
          employeeId: 'EMP002',
          department: 'HR Department',
          leaveType: 'Planned',
          requestDate: new Date('2024-12-08'),
          departureDate: new Date('2024-12-25'),
          returnDate: new Date('2025-01-05'),
          daysRequested: 11,
          reason: 'Annual vacation with family',
          status: 'Pending',
          priority: 'Medium',
          overallStatus: 'IN_PROGRESS',
          currentApprovalStep: 2,
          canApprove: true,
          approvalWorkflow: [
            {
              stepId: 1,
              stepName: 'Responsibilities Handover Approval',
              approverType: 'RESPONSIBLE_PERSON',
              approverIds: ['EMP456'],
              approverNames: ['Tom Wilson'],
              status: 'APPROVED',
              approvedBy: 'Tom Wilson',
              approvedDate: '2024-12-09T10:30:00Z',
              comments: 'Handover completed successfully',
              isRequired: true,
              order: 1
            },
            {
              stepId: 2,
              stepName: 'Project Manager / Site Incharge Approval',
              approverType: 'PROJECT_MANAGER',
              approverIds: ['PM001'],
              approverNames: ['Project Manager'],
              status: 'PENDING',
              isRequired: true,
              order: 2
            },
            {
              stepId: 3,
              stepName: 'HOD Approval',
              approverType: 'HOD',
              approverIds: ['HOD002'],
              approverNames: ['HR HOD'],
              status: 'PENDING',
              isRequired: true,
              order: 3
            }
          ],
          myApprovalStep: {
            stepId: 2,
            stepName: 'Project Manager / Site Incharge Approval',
            approverType: 'PROJECT_MANAGER',
            approverIds: ['PM001'],
            approverNames: ['Project Manager'],
            status: 'PENDING',
            isRequired: true,
            order: 2
          }
        },
        {
          id: 'REQ003',
          employeeName: 'David Brown',
          employeeId: 'EMP003',
          department: 'Finance Department',
          leaveType: 'Resignation',
          requestDate: new Date('2024-12-12'),
          departureDate: new Date('2025-01-15'),
          returnDate: new Date('2025-01-15'),
          daysRequested: 30,
          reason: 'Career change - joining new company',
          status: 'Pending',
          priority: 'High',
          overallStatus: 'PENDING',
          currentApprovalStep: 1,
          canApprove: false,
          approvalWorkflow: [
            {
              stepId: 1,
              stepName: 'Responsibilities Handover Approval',
              approverType: 'RESPONSIBLE_PERSON',
              approverIds: ['EMP789'],
              approverNames: ['Lisa Chen'],
              status: 'PENDING',
              isRequired: true,
              order: 1
            },
            {
              stepId: 2,
              stepName: 'Project Manager / Site Incharge Approval',
              approverType: 'PROJECT_MANAGER',
              approverIds: ['PM002'],
              approverNames: ['Finance PM'],
              status: 'PENDING',
              isRequired: true,
              order: 2
            }
          ]
        }
      ];
      this.isLoadingPending = false;
    }, 1000);
  }

  loadMyRequests(): void {
    if (!this.currentUser) return;

    this.isLoadingMyRequests = true;

    // Map filters to API parameters
    let statusParam = '';
    if (this.statusFilter === 'pending') statusParam = 'P';
    else if (this.statusFilter === 'approved') statusParam = 'A';
    else if (this.statusFilter === 'rejected') statusParam = 'R';

    let typeParam = '';
    if (this.typeFilter === 'emergency') typeParam = 'E';
    else if (this.typeFilter === 'planned') typeParam = 'P';
    else if (this.typeFilter === 'resignation') typeParam = 'R';

    const requestParams: MyApprovalRequest = {
      employeeId: this.currentUser.empId || this.currentUser.employeeId,
      status: statusParam,
      formType: typeParam
    };

    this.api.GetMySubmittedRequests(requestParams).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.myRequests = response.data.map((item: any) => ({
            id: `REQ${item.exitId}`,
            exitId: item.exitId,
            employeeName: this.currentUser.name || '',
            employeeId: this.currentUser.empId || this.currentUser.employeeId,
            department: this.currentUser.department || '',
            leaveType: this.mapTypeToLabel(item.type),
            requestDate: item.submittedDate,
            departureDate: item.departureDate,
            daysRequested: item.duration,
            reason: item.reason,
            status: this.mapStatusToLabel(item.status),
            priority: 'Medium' // Default priority as it's not in the response
          }));
        } else {
          this.myRequests = [];
        }
        this.isLoadingMyRequests = false;
      },
      error: (error) => {
        console.error('Error fetching my requests:', error);
        this.isLoadingMyRequests = false;
        this.myRequests = [];
      }
    });
  }

  private mapTypeToLabel(type: string): string {
    switch (type) {
      case 'E': return 'Emergency';
      case 'P': return 'Planned';
      case 'R': return 'Resignation';
      default: return type;
    }
  }

  private mapStatusToLabel(status: string): string {
    switch (status) {
      case 'P': return 'Pending';
      case 'A': return 'Approved';
      case 'R': return 'Rejected';
      default: return status;
    }
  }

  approveRequest(request: LeaveRequest): void {
    const comments = prompt('Enter approval comments (optional):');

    // Update request status
    request.status = 'Approved';
    request.approverName = this.currentUser?.name || 'Current User';
    request.approverComments = comments || 'Approved';
    request.approvedDate = new Date();

    // Here you would make an API call to update the request
    console.log('Approved request:', request);

    // Remove from pending list
    this.pendingApprovals = this.pendingApprovals.filter(r => r.id !== request.id);
  }

  rejectRequest(request: LeaveRequest): void {
    const comments = prompt('Enter rejection reason:');

    if (comments) {
      // Update request status
      request.status = 'Rejected';
      request.approverName = this.currentUser?.name || 'Current User';
      request.approverComments = comments;
      request.approvedDate = new Date();

      // Here you would make an API call to update the request
      console.log('Rejected request:', request);

      // Remove from pending list
      this.pendingApprovals = this.pendingApprovals.filter(r => r.id !== request.id);
    }
  }

  getFilteredPendingApprovals(): LeaveRequest[] {
    let filtered = [...this.pendingApprovals];

    if (this.typeFilter !== 'all') {
      filtered = filtered.filter(r => r.leaveType.toLowerCase() === this.typeFilter);
    }

    if (this.dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      switch (this.dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(r => r.requestDate >= filterDate);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(r => r.requestDate >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(r => r.requestDate >= filterDate);
          break;
      }
    }

    return filtered;
  }

  getFilteredMyRequests(): LeaveRequest[] {
    // With API integration, filtering is done server-side
    // But we keep this for consistency or minor local filtering if needed
    return this.myRequests;
  }

  getPriorityClass(priority: any): string {
    if (!priority) return 'priority-medium';
    switch (String(priority).toLowerCase()) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-medium';
    }
  }

  getStatusClass(status: any): string {
    if (!status) return 'status-pending';
    switch (String(status).toLowerCase()) {
      case 'approved': return 'status-approved';
      case 'rejected': return 'status-rejected';
      case 'pending': return 'status-pending';
      default: return 'status-pending';
    }
  }

  getTypeClass(type: any): string {
    if (!type) return 'type-planned';
    return String(type).toLowerCase() === 'emergency' ? 'type-emergency' : 'type-planned';
  }

  formatDate(date: any): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  calculateDaysBetween(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  refreshData(): void {
    if (this.activeTab === 'pending') {
      this.loadPendingApprovals();
    } else {
      this.loadMyRequests();
    }
  }

  trackByRequestId(index: number, item: LeaveRequest): string {
    return item.id;
  }

  /**
   * Approve a specific workflow step
   */
  approveWorkflowStep(request: LeaveRequest, stepId: number, comments?: string): void {
    if (!request.approvalWorkflow || !request.myApprovalStep) return;

    const step = request.approvalWorkflow.find(s => s.stepId === stepId);
    if (!step) return;

    // Update the step status
    step.status = 'APPROVED';
    step.approvedBy = this.currentUser?.name || 'Current User';
    step.approvedDate = new Date().toISOString();
    step.comments = comments || 'Approved';

    // Find next pending step
    const nextStep = request.approvalWorkflow.find(s => s.status === 'PENDING');
    if (nextStep) {
      request.currentApprovalStep = nextStep.stepId;
      request.overallStatus = 'IN_PROGRESS';
    } else {
      // All steps approved
      request.overallStatus = 'APPROVED';
      request.status = 'Approved';
    }

    // Remove from pending if user can no longer approve
    if (!this.canUserApproveRequest(request)) {
      request.canApprove = false;
    }

    console.log(`Approved step ${step.stepName} for request ${request.id}`);
  }

  /**
   * Reject a specific workflow step
   */
  rejectWorkflowStep(request: LeaveRequest, stepId: number, comments: string): void {
    if (!request.approvalWorkflow || !request.myApprovalStep) return;

    const step = request.approvalWorkflow.find(s => s.stepId === stepId);
    if (!step) return;

    // Update the step status
    step.status = 'REJECTED';
    step.approvedBy = this.currentUser?.name || 'Current User';
    step.approvedDate = new Date().toISOString();
    step.comments = comments;

    // Update overall status
    request.overallStatus = 'REJECTED';
    request.status = 'Rejected';
    request.canApprove = false;

    console.log(`Rejected step ${step.stepName} for request ${request.id}`);
  }

  /**
   * Check if current user can approve a request
   */
  canUserApproveRequest(request: LeaveRequest): boolean {
    if (!request.approvalWorkflow || !this.currentUser) return false;

    const currentStep = request.approvalWorkflow.find(s => s.status === 'PENDING');
    if (!currentStep) return false;

    // Check if user is in the approver list for current step
    return currentStep.approverIds.includes(this.currentUser.empId || this.currentUser.employeeId) ||
      this.isUserDepartmentApprover(currentStep, this.currentUser);
  }

  /**
   * Check if user is a department approver
   */
  private isUserDepartmentApprover(step: ApprovalStep, user: any): boolean {
    if (step.approverType !== 'DEPARTMENT') return false;

    const userDept = (user.department || user.empDept || '').toLowerCase();
    const stepDept = step.approverIds[0];

    return userDept.includes(stepDept) ||
      user.role?.toLowerCase().includes('admin') ||
      user.role?.toLowerCase().includes('hod');
  }

  /**
   * Get approval status text
   */
  getApprovalStatusText(status: string): string {
    return this.approvalWorkflowService.getApprovalStatusText(status);
  }

  /**
   * Get approval status CSS class
   */
  getApprovalStatusClass(status: string): string {
    return this.approvalWorkflowService.getApprovalStatusClass(status);
  }

  /**
   * Get workflow progress percentage
   */
  getWorkflowProgress(request: LeaveRequest): number {
    if (!request.approvalWorkflow) return 0;
    return this.approvalWorkflowService.getWorkflowProgress(request.approvalWorkflow);
  }

  /**
   * Get current approval step name
   */
  getCurrentStepName(request: LeaveRequest): string {
    if (!request.approvalWorkflow) return 'Unknown';

    const currentStep = request.approvalWorkflow.find(s => s.status === 'PENDING');
    return currentStep ? currentStep.stepName : 'Completed';
  }

  /**
   * Show approval dialog
   */
  showApprovalDialog(request: LeaveRequest, approve: boolean): void {
    const action = approve ? 'approve' : 'reject';
    const title = approve ? 'Approve Request' : 'Reject Request';
    const confirmText = approve ? 'Approve' : 'Reject';

    const comments = prompt(`${title}\n\nEmployee: ${request.employeeName}\nType: ${request.leaveType}\nReason: ${request.reason}\n\nEnter your comments:`);

    if (comments !== null) {
      if (approve) {
        this.approveWorkflowStep(request, request.myApprovalStep?.stepId || 0, comments);
      } else {
        if (comments.trim()) {
          this.rejectWorkflowStep(request, request.myApprovalStep?.stepId || 0, comments);
        } else {
          alert('Comments are required for rejection.');
          return;
        }
      }
    }
  }

  /**
   * Get form type display text
   */
  getFormTypeText(leaveType: any): string {
    if (!leaveType) return 'N/A';
    switch (String(leaveType)) {
      case 'Emergency': return 'Emergency Exit';
      case 'Planned': return 'Planned Leave';
      case 'Resignation': return 'Resignation';
      default: return String(leaveType);
    }
  }

  /**
   * Format date for display
   */
  formatApprovalDate(dateString?: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Get pending approvals count for current user
   */
  getPendingApprovalsCount(): number {
    return this.pendingApprovals.filter(r => r.canApprove).length;
  }

  /**
   * Get requests that need current user's approval
   */
  getMyPendingApprovals(): LeaveRequest[] {
    return this.pendingApprovals.filter(r => r.canApprove);
  }

  /**
   * Get all requests (for viewing purposes)
   */
  getAllRequests(): LeaveRequest[] {
    return this.pendingApprovals;
  }

  /**
   * Navigate to detailed view for approval
   */
  viewRequestDetails(request: LeaveRequest): void {
    // Store the request data in session storage for the emergency exit form to access
    sessionStorage.setItem('approvalRequestData', JSON.stringify(request));
    sessionStorage.setItem('approvalMode', 'true');
    sessionStorage.setItem('returnUrl', '/leave-approval');

    // Navigate to emergency exit form with approval mode
    const formType = request.leaveType === 'Emergency' ? 'E' :
      request.leaveType === 'Resignation' ? 'R' : 'P';

    this.router.navigate(['/exit-form'], {
      queryParams: {
        type: formType,
        mode: 'approval',
        requestId: request.id
      }
    });
  }

  /**
   * Navigate to view my own request details
   */
  viewMyRequestDetails(request: LeaveRequest): void {
    // Store the request data in session storage for viewing
    sessionStorage.setItem('approvalRequestData', JSON.stringify(request));
    sessionStorage.setItem('approvalMode', 'view'); // View mode instead of approval mode
    sessionStorage.setItem('returnUrl', '/leave-approval');

    // Navigate to emergency exit form with view mode
    const formType = request.leaveType === 'Emergency' ? 'E' :
      request.leaveType === 'Resignation' ? 'R' : 'P';

    this.router.navigate(['/exit-form'], {
      queryParams: {
        type: formType,
        mode: 'view',
        exitId: request.exitId || request.id
      }
    });
  }


}