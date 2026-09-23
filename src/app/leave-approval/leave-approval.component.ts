import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Router, ActivatedRoute } from '@angular/router';
import { Api } from '../services/api';
import { SessionService } from '../services/session.service';
import { ApprovalWorkflowService } from '../services/approval-workflow.service';
import { EmployeeExitRequest, ApprovalStep, DepartmentApproval, MyApprovalRequest, EmployeeApprovalInboxRequest } from '../models/employeeExit.model';
import { CraneLoaderComponent } from '../shared/crane-loader/crane-loader.component';

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
  approvalID?: number;
  exitID?: number;
  currentStepName?: string;
  profileImageBase64?: string;
}

@Component({
  selector: 'app-leave-approval',
  standalone: true,
  imports: [CommonModule, FormsModule, CraneLoaderComponent],
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
  statusFilter: string = 'Pending';
  typeFilter: string = 'all';
  dateFilter: string = 'all';
  employeeNameFilter: string = '';
  fromDateFilter: string = '';
  toDateFilter: string = '';
  // Holds the result after Search is clicked
  private _filteredPending: LeaveRequest[] | null = null;

  // Employee filter dropdown
  empMasterList: { idValue: string; description: string; nationality?: string }[] = [];
  filteredEmpList: { idValue: string; description: string; nationality?: string }[] = [];
  empFilterSearch: string = '';
  showEmpFilterDropdown: boolean = false;

  /**
   * How many rows one trip to the server brings back.
   *
   * Paging is TWO-LEVEL: the server hands over 500 rows at a time, and the
   * table shows 100 of them per page. Pages 1–5 are therefore free — they are
   * slices of a batch already in memory — and only page 6 costs a request, for
   * rows 501–1000. With 2,400 records that is 5 requests instead of 24.
   *
   * Every page-size option divides 500 exactly, so a page never straddles two
   * batches and a single slice is always enough.
   */
  readonly BATCH_SIZE = 500;

  // Pagination — pending approvals inbox
  inboxPageNo   = 1;      // display page, 1-based, across the whole result set
  inboxPageSize = 100;    // rows shown per page
  inboxTotalCount = 0;
  inboxTotalPages = 0;
  /** The 500 rows currently held, and which block of 500 they are. 0 = none. */
  private inboxBatch: LeaveRequest[] = [];
  private inboxBatchNo = 0;

  // Pagination — my submitted requests (same two-level scheme)
  myPageNo   = 1;
  myPageSize = 100;
  myTotalCount = 0;
  myTotalPages = 0;
  private myBatch: LeaveRequest[] = [];
  private myBatchNo = 0;

  /** Offered in the "Per page" selector. Every one divides BATCH_SIZE exactly. */
  readonly PAGE_SIZES = [100, 250, 500];

  /** Which block of BATCH_SIZE rows holds the first row of `page`. */
  private batchNoFor(page: number, pageSize: number): number {
    return Math.floor(((page - 1) * pageSize) / this.BATCH_SIZE) + 1;
  }

  /** Where that page starts inside its batch. */
  private offsetInBatch(page: number, pageSize: number): number {
    return ((page - 1) * pageSize) % this.BATCH_SIZE;
  }

  /** A restored/stored size is only honoured if it is still a valid option. */
  private sanePageSize(value: any): number {
    const n = Number(value);
    return this.PAGE_SIZES.includes(n) ? n : 100;
  }

  /**
   * Per-page changed. totalPages is in display rows, so it has to be recomputed
   * before anything reads it — inboxGoToPage guards against `page > totalPages`
   * and would bounce off a stale value. Back to page 1, which is always batch 1.
   */
  inboxPageSizeChanged(): void {
    this.inboxPageSize = this.sanePageSize(this.inboxPageSize);
    this.inboxTotalPages = Math.ceil(this.inboxTotalCount / this.inboxPageSize) || 0;
    this.inboxPageNo = 1;
    if (this.inboxBatchNo === 1) { this.showInboxPage(); } else { this.loadPendingApprovals(); }
  }

  myPageSizeChanged(): void {
    this.myPageSize = this.sanePageSize(this.myPageSize);
    this.myTotalPages = Math.ceil(this.myTotalCount / this.myPageSize) || 0;
    this.myPageNo = 1;
    if (this.myBatchNo === 1) { this.showMyPage(); } else { this.loadMyRequests(); }
  }

  // Filter panel visibility — OPEN by default so the filters are visible as
  // soon as the page loads (users shouldn't have to discover the Filter
  // button first). The toggle still collapses them, and that choice is
  // preserved in session state when navigating to a detail view and back.
  showPendingFilters = true;
  showMyRequestsFilters = true;

  togglePendingFilters(): void {
    this.showPendingFilters = !this.showPendingFilters;
  }

  toggleMyRequestsFilters(): void {
    this.showMyRequestsFilters = !this.showMyRequestsFilters;
  }

  // Loading states
  isLoadingPending = false;
  isLoadingMyRequests = false;

  // Current user info
  currentUser: any = null;

  constructor(
    private api: Api,
    private sessionService: SessionService,
    private approvalWorkflowService: ApprovalWorkflowService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  // 'Submitted' status option visible to ADMINISTRATION and OPERATIONS dept users, and HODs
  canSeeSubmittedFilter = false;

  ngOnInit(): void {
    this.currentUser = this.sessionService.getCurrentUser();

    const userDept = (this.currentUser?.department || this.currentUser?.empDept || '').toString().toUpperCase().trim();
    const hodFlag  = (this.currentUser?.isHOD || '').toString().toUpperCase();
    this.canSeeSubmittedFilter = userDept === 'ADMINISTRATION' || userDept === 'OPERATIONS' || hodFlag === 'H';

    // Load the employee list for the filter dropdown. GetEmployeeListAll so
    // Worker requests can be filtered by their employee too — the master list
    // excludes LABOUR.
    this.api.GetEmployeeListAll().subscribe({
      next: (res: any) => {
        const data = res?.data || res || [];
        this.empMasterList = Array.isArray(data) ? data : [];
        this.filteredEmpList = [...this.empMasterList];
      },
      error: () => {}
    });

    // Restore list state (filters/page) when returning from a record view
    const savedState = this.restoreListState();

    // Check for tab parameter in URL
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'] || savedState?.activeTab;
      if (tab === 'myRequests') {
        this.activeTab = 'myRequests';
        this.loadMyRequests();
      } else {
        this.activeTab = 'pending';
        this.loadPendingApprovals();
      }
    });
  }

  // ── List state persistence (survive navigation to record view) ──
  private readonly LIST_STATE_KEY = 'leaveApprovalListState';

  private saveListState(): void {
    const state = {
      activeTab: this.activeTab,
      statusFilter: this.statusFilter,
      typeFilter: this.typeFilter,
      employeeNameFilter: this.employeeNameFilter,
      empFilterSearch: this.empFilterSearch,
      fromDateFilter: this.fromDateFilter,
      toDateFilter: this.toDateFilter,
      inboxPageNo: this.inboxPageNo,
      inboxPageSize: this.inboxPageSize,
      showPendingFilters: this.showPendingFilters,
      myFromDate: this.myFromDate,
      myToDate: this.myToDate,
      myTypeFilter: this.myTypeFilter,
      myStatusFilter: this.myStatusFilter,
      myPageNo: this.myPageNo,
      myPageSize: this.myPageSize,
      showMyRequestsFilters: this.showMyRequestsFilters,
    };
    try { sessionStorage.setItem(this.LIST_STATE_KEY, JSON.stringify(state)); } catch {}
  }

  private restoreListState(): any {
    const raw = sessionStorage.getItem(this.LIST_STATE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(this.LIST_STATE_KEY);   // consume once
    try {
      const s = JSON.parse(raw);
      this.statusFilter          = s.statusFilter ?? this.statusFilter;
      this.typeFilter            = s.typeFilter   ?? this.typeFilter;
      this.employeeNameFilter    = s.employeeNameFilter ?? '';
      this.empFilterSearch       = s.empFilterSearch    ?? '';
      this.fromDateFilter        = s.fromDateFilter     ?? '';
      this.toDateFilter          = s.toDateFilter       ?? '';
      this.inboxPageNo           = s.inboxPageNo  || 1;
      this.inboxPageSize         = this.sanePageSize(s.inboxPageSize);
      this.showPendingFilters    = !!s.showPendingFilters;
      this.myFromDate            = s.myFromDate   ?? '';
      this.myToDate              = s.myToDate     ?? '';
      this.myTypeFilter          = s.myTypeFilter   ?? 'all';
      this.myStatusFilter        = s.myStatusFilter ?? 'all';
      this.myPageNo              = s.myPageNo   || 1;
      this.myPageSize            = this.sanePageSize(s.myPageSize);
      this.showMyRequestsFilters = !!s.showMyRequestsFilters;
      return s;
    } catch {
      return null;
    }
  }

  switchTab(tab: 'pending' | 'myRequests'): void {
    this.activeTab = tab;
    this.typeFilter = 'all';
    this.statusFilter = tab === 'pending' ? 'Pending' : 'all';
    this.employeeNameFilter = '';
    this.fromDateFilter = '';
    this.toDateFilter = '';
    if (tab === 'pending') {
      this._filteredPending = null;
      this.loadPendingApprovals();
    } else if (tab === 'myRequests') {
      this.myFromDate = '';
      this.myToDate = '';
      this.myStatusFilter = 'all';
      this.myTypeFilter = 'all';
      this.myPageNo = 1;
      this.loadMyRequests();
    }
  }

  onTypeFilterChange(value: any): void {
    this.typeFilter = value;
    // Back to page 1 on both: a new filter is a different result set, and
    // staying on page 7 of it would fetch a batch of rows nobody asked for.
    if (this.activeTab === 'pending') {
      this.inboxPageNo = 1;
      this.loadPendingApprovals();
    } else {
      this.myPageNo = 1;
      this.loadMyRequests();
    }
  }

  clearPendingFilters(): void {
    this.employeeNameFilter = '';
    this.empFilterSearch = '';
    this.filteredEmpList = [...this.empMasterList];
    this.fromDateFilter = '';
    this.toDateFilter = '';
    this.statusFilter = 'Pending';
    this.typeFilter = 'all';
    this._filteredPending = null;
    this.inboxPageNo = 1;
    this.loadPendingApprovals();
  }

  applyPendingFilters(): void {
    this.inboxPageNo = 1;
    this.loadPendingApprovals();
  }

  onEmpFilterSearch(): void {
    const term = this.empFilterSearch.toLowerCase();
    this.filteredEmpList = this.empMasterList.filter(e =>
      e.description.toLowerCase().includes(term) ||
      e.idValue.toLowerCase().includes(term)
    );
    // If user clears the search, also clear the filter value
    if (!this.empFilterSearch.trim()) {
      this.employeeNameFilter = '';
    }
  }

  selectFilterEmployee(emp: { idValue: string; description: string }): void {
    this.empFilterSearch = emp.description;
    this.employeeNameFilter = emp.description;
    this.showEmpFilterDropdown = false;
  }

  onEmpFilterBlur(): void {
    // Delay so mousedown on option fires before blur closes the dropdown
    setTimeout(() => { this.showEmpFilterDropdown = false; }, 200);
  }

  /**
   * Fetch the batch that page `inboxPageNo` falls in, then show that page.
   * Always goes to the server — callers are the ones that changed something
   * (filters, tab, first load). Page moves within a loaded batch go through
   * inboxGoToPage, which does not call this.
   */
  loadPendingApprovals(): void {
    if (!this.currentUser) return;

    this.isLoadingPending = true;
    this._filteredPending = null;

    const batchNo = this.batchNoFor(this.inboxPageNo, this.inboxPageSize);

    // Map status filter → API code
    let statusParam: string | undefined;
    if (this.statusFilter === 'Submitted') statusParam = 'S';
    else if (this.statusFilter === 'Pending')  statusParam = 'P';
    else if (this.statusFilter === 'Approved') statusParam = 'A';
    else if (this.statusFilter === 'Rejected') statusParam = 'R';

    // Map form type filter → API code
    let typeParam: string | undefined;
    if (this.typeFilter === 'Emergency') typeParam = 'E';
    else if (this.typeFilter === 'BYOD')   typeParam = 'B';
    else if (this.typeFilter === 'Rejoin') typeParam = 'R';

    const requestParams: EmployeeApprovalInboxRequest = {
      approverId: this.currentUser.empId || this.currentUser.employeeId,
      formType:   typeParam   || undefined,
      status:     statusParam || undefined,
      employeeId: this.employeeNameFilter ? this.empMasterList.find(e => e.description === this.employeeNameFilter)?.idValue || undefined : undefined,
      fromDate:   this.fromDateFilter ? new Date(this.fromDateFilter) : null,
      toDate:     this.toDateFilter   ? new Date(this.toDateFilter)   : null,
      // the SERVER pages in blocks of 500 — not in display pages
      pageNo:     batchNo,
      pageSize:   this.BATCH_SIZE,
    };

    this.api.GetExitApprovalList(requestParams).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.inboxBatch = response.data.map((item: any) => ({
            id: `REQ${item.formId}`,
            exitId: item.formId,
            exitID: item.formId,
            approvalID: item.approvalId,
            employeeName: item.employeeName || '',
            employeeId: item.employeeId || '',
            department: item.department || '',
            leaveType: this.mapFormTypeToLabel(item.formType),
            requestDate: item.requestDate,
            departureDate: item.actionDate,
            daysRequested: 0,
            status: this.mapStatusToLabel(item.status),
            approvedDate: item.approvalDate ? new Date(item.approvalDate) : undefined,
            currentStepName: item.approverRole || 'Pending',
            canApprove: true,
            reason: '',
            profileImageBase64: item.profileImageBase64 || null
          }));
          this.inboxBatchNo = batchNo;
          this.inboxTotalCount = response.totalCount || 0;
          // pages are counted in DISPLAY rows, not in batches — response.totalPages
          // is the server's own batch count and would say "1" for 500 records
          this.inboxTotalPages = Math.ceil(this.inboxTotalCount / this.inboxPageSize) || 0;
          this.showInboxPage();
        } else {
          this.resetInboxBatch();
        }
        this.isLoadingPending = false;
      },
      error: (error) => {
        console.error('Error fetching pending approvals:', error);
        this.isLoadingPending = false;
        this.resetInboxBatch();
      }
    });
  }

  private resetInboxBatch(): void {
    this.inboxBatch = [];
    this.inboxBatchNo = 0;
    this.pendingApprovals = [];
    this.inboxTotalCount = 0;
    this.inboxTotalPages = 0;
  }

  /** Slice the loaded batch down to the current display page. No API call. */
  private showInboxPage(): void {
    const from = this.offsetInBatch(this.inboxPageNo, this.inboxPageSize);
    this.pendingApprovals = this.inboxBatch.slice(from, from + this.inboxPageSize);
  }

  loadMyRequests(): void {
    if (!this.currentUser) return;

    this.isLoadingMyRequests = true;

    const batchNo = this.batchNoFor(this.myPageNo, this.myPageSize);

    // Map status filter → API code
    let statusParam: string | undefined;
    if (this.myStatusFilter === 'pending')   statusParam = 'P';
    else if (this.myStatusFilter === 'approved')  statusParam = 'A';
    else if (this.myStatusFilter === 'rejected')  statusParam = 'R';
    else if (this.myStatusFilter === 'submitted') statusParam = 'S';

    // Map form type filter → API code
    let typeParam: string | undefined;
    if (this.myTypeFilter === 'EXIT')   typeParam = 'E';
    else if (this.myTypeFilter === 'BYOD')   typeParam = 'B';
    else if (this.myTypeFilter === 'REJOIN') typeParam = 'R';

    const requestParams: MyApprovalRequest = {
      // The API reads this as the CREATOR of the form, not its subject: this
      // tab lists what I filed, including forms I raised for somebody else.
      employeeId: this.currentUser.empId || this.currentUser.employeeId,
      status:     statusParam || undefined,
      formType:   typeParam   || undefined,
      fromDate:   this.myFromDate || undefined,
      toDate:     this.myToDate   || undefined,
      // the SERVER pages in blocks of 500 — not in display pages
      pageNo:     batchNo,
      pageSize:   this.BATCH_SIZE,
    };

    this.api.GetMySubmittedRequests(requestParams).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.myBatch = response.data.map((item: any) => ({
            id:              `REQ${item.formId}`,
            exitId:          item.formId,
            exitID:          item.formId,
            employeeName:    item.employeeName || '',
            employeeId:      item.employeeId   || '',
            department:      item.department   || '',
            leaveType:       this.mapFormTypeToLabel(item.formType),
            requestDate:     item.submittedDate,
            departureDate:   item.actionDate,
            daysRequested:   item.duration || 0,
            reason:          item.reason   || '',
            status:          this.mapMyStatusToLabel(item.status),
            currentStepName: '',
            priority:        'Medium'
          }));
          this.myBatchNo = batchNo;
          this.myTotalCount = response.totalCount || 0;
          // counted in DISPLAY rows — response.totalPages counts batches
          this.myTotalPages = Math.ceil(this.myTotalCount / this.myPageSize) || 0;
          this.showMyPage();
        } else {
          this.resetMyBatch();
        }
        this.isLoadingMyRequests = false;
      },
      error: (error) => {
        console.error('Error fetching my requests:', error);
        this.isLoadingMyRequests = false;
        this.resetMyBatch();
      }
    });
  }

  private resetMyBatch(): void {
    this.myBatch = [];
    this.myBatchNo = 0;
    this.myRequests = [];
    this.myTotalCount = 0;
    this.myTotalPages = 0;
  }

  /** Slice the loaded batch down to the current display page. No API call. */
  private showMyPage(): void {
    const from = this.offsetInBatch(this.myPageNo, this.myPageSize);
    this.myRequests = this.myBatch.slice(from, from + this.myPageSize);
  }

  // ── My Requests pagination ──────────────────────────────────
  /**
   * Only fetches when the page falls outside the 500 rows already held;
   * otherwise it is a slice of what is in memory.
   */
  myGoToPage(page: number): void {
    if (page < 1 || page > this.myTotalPages) return;
    this.myPageNo = page;
    if (this.batchNoFor(page, this.myPageSize) === this.myBatchNo) {
      this.showMyPage();
    } else {
      this.loadMyRequests();
    }
  }

  myNextPage():  void { this.myGoToPage(this.myPageNo + 1); }
  myPrevPage():  void { this.myGoToPage(this.myPageNo - 1); }
  myFirstPage(): void { this.myGoToPage(1); }
  myLastPage():  void { this.myGoToPage(this.myTotalPages); }

  getMyPageRange(): string {
    if (this.myTotalCount === 0) return '0';
    const start = (this.myPageNo - 1) * this.myPageSize + 1;
    const end   = Math.min(this.myPageNo * this.myPageSize, this.myTotalCount);
    return `${start}–${end}`;
  }

  getMyPageNumbers(): number[] {
    const pages: number[] = [];
    const max = 5;
    if (this.myTotalPages <= max) {
      for (let i = 1; i <= this.myTotalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, this.myPageNo - 2);
      let end   = Math.min(this.myTotalPages, this.myPageNo + 2);
      if (this.myPageNo <= 3)                       end   = max;
      else if (this.myPageNo >= this.myTotalPages - 2) start = this.myTotalPages - max + 1;
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  }

  /** Row number continues across pages instead of restarting at 1. */
  myRowNumber(i: number): number {
    return (this.myPageNo - 1) * this.myPageSize + i + 1;
  }

  private mapMyStatusToLabel(status: string): string {
    const s = (status || '').trim().toUpperCase();
    if (s === 'A') return 'Approved';
    if (s === 'R') return 'Rejected';
    if (s === 'P' || s === 'PENDING') return 'Pending';
    if (s === 'S') return 'Submitted';
    return status || 'Submitted';
  }

  // My Requests filters
  myFromDate: string = '';
  myToDate: string = '';
  myStatusFilter: string = 'all';
  myTypeFilter: string = 'all';

  clearMyRequestFilters(): void {
    this.myFromDate = '';
    this.myToDate = '';
    this.myStatusFilter = 'all';
    this.myTypeFilter = 'all';
    this.myPageNo = 1;
    this.loadMyRequests();
  }

  /**
   * Search button. Back to page 1 first — a new filter produces a different
   * result set, and asking for page 3 of it would land on rows the user never
   * scrolled past (or on nothing at all).
   */
  applyMyRequestFilters(): void {
    this.myPageNo = 1;
    this.loadMyRequests();
  }

  getEmployeeAvatar(request: LeaveRequest): string | null {
    const b64 = request.profileImageBase64;
    if (!b64) return null;
    return b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
  }

  viewMyRequestDetails(request: LeaveRequest): void {
    this.saveListState();
    if (request.leaveType === 'BYOD') {
      this.router.navigate(['/byod-form'], { queryParams: { byodId: request.exitID } });
      return;
    }
    if (request.leaveType === 'Rejoin') {
      this.router.navigate(['/rejoining-form'], { queryParams: { rejoinId: request.exitID } });
      return;
    }
    const formType = request.leaveType === 'Emergency' ? 'E' :
      request.leaveType === 'Resignation' ? 'R' : 'P';
    this.router.navigate(['/exit-form'], { queryParams: { type: formType, exitID: request.exitID } });
  }

  private mapFormTypeToLabel(formType: string): string {
    switch ((formType || '').toUpperCase()) {
      case 'EXIT':   return 'Emergency';
      case 'BYOD':   return 'BYOD';
      case 'REJOIN': return 'Rejoin';
      default:       return formType || '';
    }
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
    switch ((status || '').trim().toUpperCase()) {
      case 'S': return 'Submitted';
      case 'P': return 'Pending';
      case 'I': return 'Pending';
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

    if (this.employeeNameFilter.trim()) {
      const term = this.employeeNameFilter.trim().toLowerCase();
      filtered = filtered.filter(r =>
        r.employeeName.toLowerCase().includes(term) ||
        r.employeeId.toLowerCase().includes(term)
      );
    }

    if (this.typeFilter !== 'all') {
      filtered = filtered.filter(r => r.leaveType.toLowerCase() === this.typeFilter.toLowerCase());
    }

    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status.toLowerCase() === this.statusFilter.toLowerCase());
    }

    if (this.fromDateFilter) {
      const from = new Date(this.fromDateFilter);
      filtered = filtered.filter(r => r.requestDate && new Date(r.requestDate) >= from);
    }

    if (this.toDateFilter) {
      const to = new Date(this.toDateFilter);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => r.requestDate && new Date(r.requestDate) <= to);
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

  /**
   * The key must include the FORM TYPE, not just the id.
   *
   * `item.id` is `REQ<formId>`, and formId is only unique WITHIN a form type —
   * each of TS_EMPLOYEE_EXIT, TS_EMPLOYEE_BYOD and TS_EMPLOYEE_REJOINING has
   * its own sequence. They already collide in UAT: BYOD 81 and REJOIN 81 both
   * exist, and AAS2 and ADS3373 approve both. When two rows share a trackBy
   * key, *ngFor throws a duplicate-key error and the whole table fails to
   * render — which looks exactly like "the listing is broken".
   *
   * It gets likelier the bigger the page, so this has to be right before the
   * page size goes up to 500.
   */
  trackByRequestId(index: number, item: LeaveRequest): string {
    return `${item.leaveType}#${item.id}`;
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
    if (request.currentStepName) return request.currentStepName;
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
      case 'Emergency': return 'Exit Form';
      case 'Planned':   return 'Planned Leave';
      case 'Resignation': return 'Resignation';
      case 'BYOD':      return 'BYOD';
      case 'Rejoin':    return 'Rejoin';
      default:          return String(leaveType);
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
    const source = this._filteredPending ?? this.pendingApprovals;
    return source.filter(r => r.canApprove);
  }

  /**
   * Get all requests (for viewing purposes)
   */
  getAllRequests(): LeaveRequest[] {
    return this.pendingApprovals;
  }

  // ── Inbox pagination ────────────────────────────────────────
  /**
   * Only fetches when the page falls outside the 500 rows already held;
   * otherwise it is a slice of what is in memory.
   */
  inboxGoToPage(page: number): void {
    if (page < 1 || page > this.inboxTotalPages) return;
    this.inboxPageNo = page;
    if (this.batchNoFor(page, this.inboxPageSize) === this.inboxBatchNo) {
      this.showInboxPage();
    } else {
      this.loadPendingApprovals();
    }
  }

  inboxNextPage():  void { this.inboxGoToPage(this.inboxPageNo + 1); }
  inboxPrevPage():  void { this.inboxGoToPage(this.inboxPageNo - 1); }
  inboxFirstPage(): void { this.inboxGoToPage(1); }
  inboxLastPage():  void { this.inboxGoToPage(this.inboxTotalPages); }

  getInboxPageRange(): string {
    if (this.inboxTotalCount === 0) return '0';
    const start = (this.inboxPageNo - 1) * this.inboxPageSize + 1;
    const end   = Math.min(this.inboxPageNo * this.inboxPageSize, this.inboxTotalCount);
    return `${start}–${end}`;
  }

  getInboxPageNumbers(): number[] {
    const pages: number[] = [];
    const max = 5;
    if (this.inboxTotalPages <= max) {
      for (let i = 1; i <= this.inboxTotalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, this.inboxPageNo - 2);
      let end   = Math.min(this.inboxTotalPages, this.inboxPageNo + 2);
      if (this.inboxPageNo <= 3)                          end   = max;
      else if (this.inboxPageNo >= this.inboxTotalPages - 2) start = this.inboxTotalPages - max + 1;
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  }

  /**
   * Navigate to detailed view for approval
   */
  viewRequestDetails(request: LeaveRequest): void {
    this.saveListState();
    sessionStorage.setItem('returnUrl', '/leave-approval');

    if (request.leaveType === 'BYOD') {
      this.router.navigate(['/byod-form'], {
        queryParams: { byodId: request.exitID, approvalID: request.approvalID, approverCode: request.currentStepName }
      });
      return;
    }
    if (request.leaveType === 'Rejoin') {
      this.router.navigate(['/rejoining-form'], {
        queryParams: { rejoinId: request.exitID, approvalID: request.approvalID, approverCode: request.currentStepName }
      });
      return;
    }

    const formType = request.leaveType === 'Emergency' ? 'E' :
      request.leaveType === 'Resignation' ? 'R' : 'P';

    this.router.navigate(['/exit-form'], {
      queryParams: { type: formType, exitID: request.exitID, approvalID: request.approvalID }
    });
  }

}
