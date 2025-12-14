import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Api } from '../services/api';
import { SessionService } from '../services/session.service';

interface LeaveRequest {
  id: string;
  employeeName: string;
  employeeId: string;
  department: string;
  leaveType: 'Emergency' | 'Planned';
  requestDate: Date;
  departureDate: Date;
  returnDate: Date;
  daysRequested: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approverName?: string;
  approverComments?: string;
  approvedDate?: Date;
  priority: 'High' | 'Medium' | 'Low';
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
    private sessionService: SessionService
  ) {}

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
    
    // Mock data for now - replace with actual API call
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
          priority: 'High'
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
          priority: 'Medium'
        }
      ];
      this.isLoadingPending = false;
    }, 1000);
  }

  loadMyRequests(): void {
    this.isLoadingMyRequests = true;
    
    // Mock data for now - replace with actual API call
    setTimeout(() => {
      this.myRequests = [
        {
          id: 'REQ003',
          employeeName: this.currentUser?.name || 'Current User',
          employeeId: this.currentUser?.employeeId || 'EMP003',
          department: this.currentUser?.department || 'Current Department',
          leaveType: 'Planned',
          requestDate: new Date('2024-11-20'),
          departureDate: new Date('2024-12-01'),
          returnDate: new Date('2024-12-10'),
          daysRequested: 9,
          reason: 'Personal vacation',
          status: 'Approved',
          approverName: 'Manager Name',
          approverComments: 'Approved for planned vacation',
          approvedDate: new Date('2024-11-22'),
          priority: 'Medium'
        },
        {
          id: 'REQ004',
          employeeName: this.currentUser?.name || 'Current User',
          employeeId: this.currentUser?.employeeId || 'EMP003',
          department: this.currentUser?.department || 'Current Department',
          leaveType: 'Emergency',
          requestDate: new Date('2024-12-12'),
          departureDate: new Date('2024-12-18'),
          returnDate: new Date('2024-12-22'),
          daysRequested: 4,
          reason: 'Medical emergency',
          status: 'Pending',
          priority: 'High'
        }
      ];
      this.isLoadingMyRequests = false;
    }, 1000);
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
    let filtered = [...this.myRequests];
    
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status.toLowerCase() === this.statusFilter);
    }
    
    if (this.typeFilter !== 'all') {
      filtered = filtered.filter(r => r.leaveType.toLowerCase() === this.typeFilter);
    }
    
    return filtered;
  }

  getPriorityClass(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-medium';
    }
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved': return 'status-approved';
      case 'rejected': return 'status-rejected';
      case 'pending': return 'status-pending';
      default: return 'status-pending';
    }
  }

  getTypeClass(type: string): string {
    return type.toLowerCase() === 'emergency' ? 'type-emergency' : 'type-planned';
  }

  formatDate(date: Date): string {
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
}