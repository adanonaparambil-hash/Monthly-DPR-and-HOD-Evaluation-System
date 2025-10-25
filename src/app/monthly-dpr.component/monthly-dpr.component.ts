import { Component } from '@angular/core';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { DPRTask, DPRKPI, DPRReview, ProofhubTaskDto, DPRComment } from '../models/task.model';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { Api } from '../services/api';
import Swal from 'sweetalert2';
import { ToastrService } from 'ngx-toastr';
import { DropdownOption, Notification, SendEmailRequest } from '../models/common.model';
import { ActivatedRoute, Router } from '@angular/router';



@Component({
  selector: 'app-monthly-dpr',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './monthly-dpr.component.html',
  styleUrl: './monthly-dpr.component.css',
  animations: [
    trigger('fadeInUp', [
      transition('* => *', [
        query(
          ':enter',
          [
            style({ opacity: 0, transform: 'translateY(20px)' }),
            stagger(100, [
              animate('0.3s ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
            ]),
          ],
          { optional: true }
        ),
      ]),
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-20px)' }),
        animate('0.4s ease-out', style({ opacity: 1, transform: 'translateX(0)' })),
      ]),
    ]),
    trigger('scaleIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.9)' }),
        animate('0.3s ease-out', style({ opacity: 1, transform: 'scale(1)' })),
      ]),
    ]),
  ],
})
export class MonthlyDprComponent {
  monthYear = '';

  EmailID = '';

  showTaskDetails = true;
  showKpiPerformance = true;
  showHodEvaluation = true;
  showManagementRemarks = true;
  showRemarksHistory = true;
  summaryText = '';
  showModal = false;
  isGeneratingSummary = false;

  managementRemarks = '';

  ApprovalStatus = '';

  ConfirmationMessage = '';

  empId = '';
  empName = '';
  designation = '';
  department = '';
  reportingTo = '';
  WorkedHours = 0;

  achievements = '';
  challenges = '';
  supportNeeded = '';

  quality = 0;
  timeliness = 0;
  initiative = 0;
  overallScore = 0;
  dprid = 0;
  hoursExceeded: boolean = false;

  // Role and mode flags
  userType: 'E' | 'H' | 'C' = 'E';
  isReadOnlyMode: boolean = false;
  currentStatus: string = 'D'; // D, R, S, A
  isHodViewingOwnDpr: boolean = false; // Track if HOD is viewing their own DPR

  get isEmployee(): boolean { return this.userType === 'E'; }
  get isHod(): boolean { return this.userType === 'H'; }
  get isCed(): boolean { return this.userType === 'C'; }

  // Status-based access control for Employees
  get canEditEmployeeFields(): boolean {
    if (!this.isEmployee) return false;
    return this.currentStatus === 'D' || this.currentStatus === 'R';
  }

  get canViewEmployeeFields(): boolean {
    return this.isEmployee && (this.currentStatus === 'S' || this.currentStatus === 'A');
  }

  // Status-based access control for HOD
  get canEditHodEvaluation(): boolean {
    if (this.isEmployee) return false; // Employee can never edit HOD evaluation fields
    if (this.isCed) return false; // CED can never edit HOD evaluation fields
    if (this.isHod && this.isHodViewingOwnDpr) return false; // HOD can't edit their own evaluation
    if (this.isHod && !this.isHodViewingOwnDpr) return this.currentStatus === 'S'; // HOD can edit when reviewing others' DPRs
    return false;
  }

  get canViewHodEvaluation(): boolean {
    return (this.isHod || this.isCed) && (this.currentStatus === 'A' || this.currentStatus === 'R' || this.currentStatus === 'S');
  }

  // Management Remarks visibility - CED should NOT see this
  get canViewManagementRemarks(): boolean {
    return this.isHod && !this.isCed; // Only HOD can see, not CED
  }

  get canEditManagementRemarks(): boolean {
    return this.isHod && this.currentStatus === 'S';
  }

  // Remarks History visibility
  get canViewRemarksHistory(): boolean {
    if (this.isCed) return true; // CED can always see remarks history
    if (this.isHod) return true; // HOD can always see remarks history
    if (this.isEmployee) return this.currentStatus === 'R' || this.currentStatus === 'A'; // Employee when rework or approved
    return false;
  }

  // Button visibility for Employee (Save Draft, Submit)
  get showEmployeeButtons(): boolean {
    // Show for employees OR HOD viewing their own DPR
    if (this.isEmployee) return this.currentStatus === 'D' || this.currentStatus === 'R';
    if (this.isHod && this.isHodViewingOwnDpr) return this.currentStatus === 'D' || this.currentStatus === 'R';
    return false;
  }

  // Button visibility for HOD (Approve, Rework)
  get showHodButtons(): boolean {
    // Only show when HOD is reviewing someone else's DPR
    return this.isHod && !this.isHodViewingOwnDpr && this.currentStatus === 'S';
  }

  // Table action buttons (Add/Delete for tasks and KPIs)
  get showTableActions(): boolean {
    if (this.isCed) return false; // CED never sees action buttons
    if (this.isEmployee) return this.currentStatus === 'D' || this.currentStatus === 'R';
    if (this.isHod && this.isHodViewingOwnDpr) return this.currentStatus === 'D' || this.currentStatus === 'R'; // HOD can edit their own DPR
    if (this.isHod && !this.isHodViewingOwnDpr) return false; // HOD can't edit others' tables
    return false;
  }

  // Field editability for different roles and statuses
  get canEditFields(): boolean {
    if (this.isCed) return false; // CED can never edit anything
    if (this.isEmployee) return this.currentStatus === 'D' || this.currentStatus === 'R';
    if (this.isHod && this.isHodViewingOwnDpr) return this.currentStatus === 'D' || this.currentStatus === 'R'; // HOD can edit their own DPR
    if (this.isHod && !this.isHodViewingOwnDpr) return false; // HOD can't edit others' employee fields
    return false;
  }

  // HOD Evaluation section visibility
  get showHodEvaluationSection(): boolean {
    if (this.isEmployee) return this.currentStatus === 'A'; // Employee can see HOD evaluation only when approved
    if (this.isHod && this.isHodViewingOwnDpr) return false; // HOD doesn't evaluate their own DPR
    return this.isHod || this.isCed; // HOD and CED can see it for others' DPRs
  }

  // Management Remarks section visibility
  get showManagementRemarksSection(): boolean {
    if (this.isEmployee) return false; // Employee never sees management remarks
    if (this.isCed) return false; // CED should not see management remarks
    return this.isHod; // Only HOD can see management remarks
  }



  // Remarks History section visibility
  get showRemarksHistorySection(): boolean {
    return this.canViewRemarksHistory;
  }

  hodList: DropdownOption[] = [];

  tasks: DPRTask[] = [
    {
      taskName: '',
      description: '',
      estimatedHours: 0,
      actualHours: 0,
      productivity: 0,
      selected: false,
    },
  ];

  Proofhubtasks: ProofhubTaskDto[] = [
    {
      TASK_TITLE: '',
      TASK_DESCRIPTION: '',
      START_DATE: '',
      DUE_DATE: '',
      ESTIMATED_HOURS: '',
      LOGGED_HOURS: '',
    },
  ];

  kpis: DPRKPI[] = [
    {
      description: '',
      kpiValue: 0,
      remarks: '',
      kpiId: 0,
      dprId: 0,
      employeeId: '',
      kpiMasterId: 0,
      placeholdervalue: ''
    },
  ];

  availableKPIs: any[] = []; // Store all available KPIs from API

  remarksHistory: DPRComment[] = [
    {
      commentId: 0,
      hodId: 'John Smith (HOD)',
      commentText:
        'Employee has shown excellent performance this month with high quality deliverables.',
      commentType: 'APPROVE',
      createdat: new Date('2025-06-15 14:32'),
    },
  ];

  constructor(private api: Api, private toastr: ToastrService, private route: ActivatedRoute, private router: Router) { }

  ngOnInit() {

    this.dprid = Number(this.route.snapshot.paramMap.get('id'));
    this.isReadOnlyMode = (this.route.snapshot.queryParamMap.get('readonly') || '') === '1';

    // Don't set monthYear here - it will be set from DPR data or when creating new DPR

    this.loadKPIs();

    const user = JSON.parse(localStorage.getItem('current_user') || '{}');
    if (user) {
      this.empId = user.empId || '';
      this.empName = user.employeeName || '';
      this.designation = user.designation || '';
      this.department = user.department || '';
      this.EmailID = user.email || '';

      // Determine userType from session (default Employee)
      const code = ((user.isHOD || user.role || user.userType || '') as string).toString().toUpperCase();
      if (code === 'H') {
        this.userType = 'H';
      } else if (code === 'C') {
        this.userType = 'C';
      } else {
        this.userType = 'E';
      }
    }

    this.loadHodMasterList();

    // Load DPR details first, then decide if we need ProofHub tasks
    this.GetDPREmployeeReviewDetails(this.dprid);

  }



  toggleTaskDetails() {
    this.showTaskDetails = !this.showTaskDetails;
  }

  toggleKpiPerformance() {
    this.showKpiPerformance = !this.showKpiPerformance;
  }

  toggleHodEvaluation() {
    this.showHodEvaluation = !this.showHodEvaluation;
  }

  toggleManagementRemarks() {
    this.showManagementRemarks = !this.showManagementRemarks;
  }

  toggleRemarksHistory() {
    this.showRemarksHistory = !this.showRemarksHistory;
  }

  addNewTask() {

    this.validateActualHours();

    if (this.hoursExceeded) {
      return;
    }

    this.tasks.push({
      taskName: '',
      description: '',
      estimatedHours: 0,
      actualHours: 0,
      productivity: 0,
      selected: false,
    });

  }

  deleteTask(index: number) {
    if (this.tasks.length > 1) {
      Swal.fire({
        title: 'Are you sure?',
        text: 'Do you want to delete this task?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed) {
          this.tasks.splice(index, 1);
          this.validateActualHours(); // Recalculate hours after deletion
          this.toastr.success('Task deleted successfully', 'Success');
        }
      });
    } else {
      this.toastr.warning('At least one task is required', 'Warning');
    }
  }

  addNewKPI() {
    // Check if we can add more KPIs
    if (this.canAddMoreKPIs()) {
      this.kpis.push({
        kpiMasterId: 0,
        description: '',
        kpiValue: '',
        remarks: '',
        kpiId: 0,
        dprId: 0,
        employeeId: this.empId,
        placeholdervalue: '',
      });
    } else {
      this.toastr.info('All available KPIs have been added. No more KPIs can be added.', 'Maximum Reached');
    }
  }

  canAddMoreKPIs(): boolean {
    // Get count of selected KPIs (excluding unselected ones with kpiMasterId = 0)
    const selectedKPICount = this.kpis.filter(kpi => kpi.kpiMasterId && kpi.kpiMasterId !== 0).length;

    // Check if there are unselected rows that can still be used
    const unselectedRows = this.kpis.filter(kpi => !kpi.kpiMasterId || kpi.kpiMasterId === 0).length;

    // Can add more if: (selected KPIs + unselected rows) < total available KPIs
    return (selectedKPICount + unselectedRows) < this.availableKPIs.length;
  }

  get maxKPIsReached(): boolean {
    return !this.canAddMoreKPIs();
  }

  getRemainingKPICount(): number {
    const selectedKPICount = this.kpis.filter(kpi => kpi.kpiMasterId && kpi.kpiMasterId !== 0).length;
    return this.availableKPIs.length - selectedKPICount;
  }



  onKPISelectionChange(index: number, selectedKpiId: number) {
    if (selectedKpiId === 0) {
      // User selected "Select KPI" - reset the row
      this.kpis[index].kpiMasterId = 0;
      this.kpis[index].description = '';
      this.kpis[index].placeholdervalue = '';
      this.kpis[index].kpiValue = '';
      return;
    }

    const selectedKPI = this.availableKPIs.find(kpi => kpi.kpiid == selectedKpiId);

    if (selectedKPI) {
      this.kpis[index].kpiMasterId = selectedKPI.kpiid;
      this.kpis[index].description = selectedKPI.description; // Use description field from backend
      this.kpis[index].placeholdervalue = selectedKPI.placeholdervalue; // Set placeholder value
      // Clear the current value when KPI changes
      this.kpis[index].kpiValue = '';
    }
  }

  getPlaceholderForKPI(index: number): string {
    return this.kpis[index].placeholdervalue || 'Enter KPI value';
  }

  getKPINameById(kpiMasterId: number | undefined): string {
    if (!kpiMasterId || kpiMasterId === 0) return '';
    const kpi = this.availableKPIs.find(k => k.kpiid === kpiMasterId);
    return kpi ? (kpi.kpiname || '') : '';
  }

  getAvailableKPIsForRow(currentIndex: number): any[] {
    // Get all selected KPI IDs from other rows (excluding current row)
    const selectedKpiIds = this.kpis
      .map((kpi, index) => index !== currentIndex ? kpi.kpiMasterId : null)
      .filter(id => id !== null && id !== 0 && id !== undefined);

    // Filter out already selected KPIs
    return this.availableKPIs.filter(kpi => !selectedKpiIds.includes(kpi.kpiid));
  }

  deleteKPI(index: number) {
    if (this.kpis.length > 1) {
      Swal.fire({
        title: 'Are you sure?',
        text: 'Do you want to delete this KPI?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed) {
          this.kpis.splice(index, 1);
          this.toastr.success('KPI deleted successfully', 'Success');

          // Show info about remaining KPIs if applicable
          const remaining = this.getRemainingKPICount();
          if (remaining > 0) {
            this.toastr.info(`You can now add ${remaining} more KPI(s)`, 'KPIs Available');
          }
        }
      });
    } else {
      // If it's the last row, just reset it instead of deleting
      this.kpis[0] = {
        kpiMasterId: 0,
        description: '',
        kpiValue: '',
        remarks: '',
        kpiId: 0,
        dprId: 0,
        employeeId: this.empId,
        placeholdervalue: '',
      };
      this.toastr.info('KPI row has been reset', 'Info');
    }
  }

  closeModal() {
    this.showModal = false;
    this.summaryText = '';
    this.isGeneratingSummary = false;
  }

  SubmitReview() {
    this.ApprovalStatus = 'S';
    this.saveEmployeeDetails();
  }

  saveDraft() {
    this.ApprovalStatus = 'D';
    this.saveEmployeeDetails();
  }

  ApproveReview() {
    this.ApprovalStatus = 'A';
    this.HODReviewUpdate();
  }

  ReWorkReview() {
    this.ApprovalStatus = 'R';
    this.HODReviewUpdate();
  }

  HODReviewUpdate() {

    if (this.ApprovalStatus == "R") {
      this.ConfirmationMessage = 'Do you want to ReWork the review details?';
    }
    else {
      this.ConfirmationMessage = 'Do you want to approve the review details?';
    }


    Swal.fire({
      title: 'Are you sure?',
      text: this.ConfirmationMessage,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, submit it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {

        const review: DPRReview = {
          employeeId: this.empId,
          status: this.ApprovalStatus,
          hodId: this.reportingTo,
          scoreQuality: Number(this.quality),
          scoreTimeliness: Number(this.timeliness),
          scoreInitiative: Number(this.initiative),
          scoreOverall: Number(this.overallScore),
          remarks: this.managementRemarks,
          dprid: this.dprid
        };

        console.log("DPR Log" + review.dprid);

        this.api.updateDPRReview(review).subscribe({
          next: (res: any) => {
            if (res.success) {
              this.toastr.success(res.message, 'Success');

              // Try to send notification to employee after successful HOD review (non-blocking)
              const dprId = this.dprid;
              try {
                this.sendNotificationToEmployee(dprId, false);
              } catch (error) {
                console.error('Error sending employee notification:', error);
              }

              // Navigate to past reports page after successful approval/pushback
              setTimeout(() => {
                this.router.navigate(['/past-reports']);
              }, 1500); // Small delay to show success message

            } else {
              this.toastr.error(res.message, 'Error');
            }
            console.log(res);
          },
          error: (err) => {
            this.toastr.error('Something went wrong while updating the review.', 'Error');
            console.error(err);
          },
        });
      }
    });
  }

  saveEmployeeDetails() {


    if (this.ApprovalStatus == "S") {

      this.ConfirmationMessage = 'Do you want to submit the review details?';

      if (!this.reportingTo) {
        this.toastr.warning('Please specify the Reporting To field.', 'Validation Failed');
        return;
      }

      const hasIncompleteTasks = this.tasks.some(
        (task) => !task.taskName || !task.description || task.actualHours <= 0
      );

      if (hasIncompleteTasks) {
        this.toastr.warning('Please complete all task details. Each task must have a name, description, and actual hours.', 'Validation Failed');
        return;
      }

      const totalActualHours = this.tasks.reduce((sum, task) => sum + (Number(task.actualHours) || 0), 0);

      if (totalActualHours > this.WorkedHours) {
        this.toastr.warning('The sum of actual hours exceeds the Worked Hours. Please adjust your task hours.', 'Validation Failed');
        return;
      }

      if (this.tasks.length === 0) {
        this.toastr.warning('Please add at least one task with valid details.', 'Validation Failed');
        return;
      }

      // Check if at least one KPI is properly filled
      const validKPIs = this.kpis.filter(
        (kpi) => {
          if (!kpi.kpiMasterId || kpi.kpiMasterId === 0) return false;
          if (!kpi.kpiValue) return false;
          if (typeof kpi.kpiValue === 'string' && kpi.kpiValue.trim() === '') return false;
          if (typeof kpi.kpiValue === 'number' && kpi.kpiValue <= 0) return false;
          return true;
        }
      );

      if (validKPIs.length === 0) {
        this.toastr.warning('Please complete at least one KPI with selection and value.', 'Validation Failed');
        return;
      }
    }
    else {
      this.ConfirmationMessage = 'Do you want to save the review details?';
    }


    // Get month and year from header instead of current date
    const { month, year } = this.parseMonthYear();

    const review: DPRReview = {
      employeeId: this.empId,
      month: month,
      year: year,
      workedHours: Number(this.WorkedHours),
      achievements: this.achievements || '',
      challenges: this.challenges || '',
      supportNeeded: this.supportNeeded || '',
      status: this.ApprovalStatus || '',
      hodId: this.reportingTo || '',
      dprid: this.dprid || 0,
      tasksList: this.tasks.map((t) => ({
        taskName: t.taskName,
        description: t.description,
        actualHours: Number(t.actualHours),
      })),
      kpiList: this.kpis.map((t) => ({
        kpiId: Number(t.kpiId),
        dprId: Number(this.dprid),
        employeeId: t.employeeId,
        kpiMasterId: t.kpiMasterId,
        kpiValue: Number(t.kpiValue),
        remarks: t.remarks,
        description: t.description,
      })),
    };

    Swal.fire({
      title: 'Are you sure?',
      text: this.ConfirmationMessage,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, save it!',
      cancelButtonText: 'No, cancel!',
    }).then((result) => {

      if (result.isConfirmed) {

        this.api.insertDpr(review).subscribe({
          next: (res) => {
            this.toastr.success(res.message, 'Success');

            // Send notifications only after successful submission (not draft)
            if (this.ApprovalStatus === 'S' && res.success) {
              const dprId = res.data || this.dprid;

              // Try to send notifications (non-blocking)
              try {
                this.sendNotificationToHOD(dprId);
                this.sendNotificationToEmployee(dprId, true);
              } catch (error) {
                console.error('Error sending notifications:', error);
              }

              // Navigate to past reports page after successful submission
              setTimeout(() => {
                this.router.navigate(['/past-reports']);
              }, 1500); // Small delay to show success message
            } else if (this.ApprovalStatus === 'D' && res.success) {
              // For draft saves, show success but don't navigate
              console.log('Draft saved successfully');
            }
          },
          error: (err) => {
            this.toastr.error('Failed to save employee details.', 'Error');
          },
        });
      }
    });
  }

  GetProofHubTask() {
    this.showModal = true;

    this.Proofhubtasks.forEach((task) => {
      task.selected = false;
    });
  }

  getUserProofhubTasks() {
    const email = this.EmailID || '';
    const today = new Date();

    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const startDateString = startDate.toISOString().split('T')[0];
    const endDateString = endDate.toISOString().split('T')[0];

    this.api.GetUserProofhubTasks(email, startDateString, endDateString).subscribe({
      next: (res) => {
        console.log('Proofhub tasks response:', res);

        this.Proofhubtasks = (res.data || []).map((task: any) => ({
          TASK_ID: task.tasK_ID,
          TASK_TITLE: task.tasK_TITLE,
          TASK_DESCRIPTION: task.tasK_DESCRIPTION,
          START_DATE: task.starT_DATE,
          DUE_DATE: task.duE_DATE,
          ESTIMATED_HOURS: task.estimateD_HOURS,
          LOGGED_HOURS: task.loggeD_HOURS,
          selected: false,
          COMPLETED: task.completed,
        }));

        this.WorkedHours = this.Proofhubtasks.reduce(
          (sum, task) => sum + (Number(task.LOGGED_HOURS) || 0), 0);

      },
      error: (err) => {
        console.error('Error fetching tasks:', err);
      },
    });
  }

  setPreviousMonthYear(): void {
    const currentDate = new Date();
    currentDate.setMonth(currentDate.getMonth() - 1);

    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' };
    this.monthYear = currentDate.toLocaleDateString('en-US', options);
  }



  loadKPIs(): void {
    this.api.GetActiveKPIs(this.department).subscribe(
      (response: any) => {
        if (response && response.success && response.data) {
          console.log('Loaded KPIs:', response.data);

          this.availableKPIs = response.data;

          this.kpis = [
            {
              kpiMasterId: 0,
              description: '',
              kpiValue: '',
              remarks: '',
              kpiId: 0,
              dprId: 0,
              employeeId: this.empId,
              placeholdervalue: '',
            }
          ];
        } else {
          this.availableKPIs = [];
          this.kpis = [
            {
              kpiMasterId: 0,
              description: '',
              kpiValue: '',
              remarks: '',
              kpiId: 0,
              dprId: 0,
              employeeId: this.empId,
              placeholdervalue: '',
            }
          ];
        }
      },
      (error) => {
        console.error('Error loading KPIs:', error);
      }
    );
  }

  generateSummary() {
    const selectedTasks = this.Proofhubtasks.filter((t) => t.selected);

    if (selectedTasks.length === 0) {
      this.toastr.error('Please select at least one task!.', 'error');
      return;
    }

    // Clear existing summary text before generating new one
    this.summaryText = '';
    this.isGeneratingSummary = true;

    this.api.summarizeTasks(selectedTasks).subscribe({
      next: (res) => {
        this.summaryText = res.summary;
        this.isGeneratingSummary = false;
      },
      error: (err) => {
        console.error(err);
        this.toastr.error('Error generating summary', 'Error');
        this.isGeneratingSummary = false;
      },
    });
  }

  cleanSummaryText(text: string): string {
    if (!text) return '';

    // Remove common prefixes and formatting
    let cleanedText = text
      // Remove checkmark emojis and similar symbols
      .replace(/✅\s*/g, '')
      .replace(/☑️\s*/g, '')
      .replace(/✔️\s*/g, '')
      .replace(/🔸\s*/g, '')
      .replace(/•\s*/g, '')
      .replace(/▪\s*/g, '')
      .replace(/▫\s*/g, '')
      .replace(/◦\s*/g, '')
      // Remove "Summary:" prefix (case insensitive)
      .replace(/^summary:\s*/i, '')
      // Remove "AI Summary:" prefix (case insensitive)
      .replace(/^ai\s+summary:\s*/i, '')
      // Remove "Generated Summary:" prefix (case insensitive)
      .replace(/^generated\s+summary:\s*/i, '')
      // Remove "Task Summary:" prefix (case insensitive)
      .replace(/^task\s+summary:\s*/i, '')
      // Remove "Completed tasks include" prefix (case insensitive)
      .replace(/^completed\s+tasks\s+include\s*/i, '')
      // Remove any leading dashes or asterisks
      .replace(/^[-*]\s*/, '')
      // Remove multiple spaces and normalize whitespace
      .replace(/\s+/g, ' ')
      // Trim leading and trailing whitespace
      .trim();

    return cleanedText;
  }

  get cleanedSummaryText(): string {
    return this.cleanSummaryText(this.summaryText);
  }

  copySummaryToClipboard(event?: Event) {
    // Prevent default behavior and stop propagation to avoid modal jerking
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      // Prevent focus changes that might cause layout shifts
      (event.target as HTMLElement)?.blur();
    }

    if (this.summaryText) {
      // Clean the summary text before copying
      const cleanedText = this.cleanSummaryText(this.summaryText);

      navigator.clipboard.writeText(cleanedText).then(() => {
        // Show success message
        this.toastr.success('Summary copied to clipboard!', 'Success');

        // Add visual feedback to button without causing layout shifts
        const copyBtn = event?.target as HTMLElement;
        if (copyBtn) {
          const originalBg = copyBtn.style.backgroundColor;
          copyBtn.style.backgroundColor = '#d4edda';
          copyBtn.style.color = '#155724';
          setTimeout(() => {
            copyBtn.style.backgroundColor = originalBg;
            copyBtn.style.color = '#666';
          }, 1000);
        }
      }).catch(err => {
        console.error('Failed to copy text: ', err);
        // Fallback for older browsers
        this.fallbackCopyTextToClipboard(cleanedText);
      });
    }
  }

  // Fallback method for older browsers
  private fallbackCopyTextToClipboard(text: string) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this.toastr.success('Summary copied to clipboard!', 'Success');
      } else {
        this.toastr.error('Failed to copy summary', 'Error');
      }
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
      this.toastr.error('Failed to copy summary', 'Error');
    }

    document.body.removeChild(textArea);
  }

  GetDPREmployeeReviewDetails(dprId: number) {
    this.api.GetDPREmployeeReviewDetails(dprId).subscribe({
      next: (res) => {
        if (res.success && res.data) {

          const dpr = res.data as DPRReview;

          this.empId = dpr.employeeId || '';
          this.empName = dpr.employeename || '';
          this.designation = dpr.designation || '';
          this.department = dpr.department || '';
          this.EmailID = dpr.emailid || '';

          this.WorkedHours = dpr.workedHours ?? 0;
          this.achievements = dpr.achievements ?? '';
          this.challenges = dpr.challenges ?? '';
          this.supportNeeded = dpr.supportNeeded ?? '';
          this.quality = dpr.scoreQuality ?? 0;
          this.timeliness = dpr.scoreTimeliness ?? 0;
          this.initiative = dpr.scoreInitiative ?? 0;
          this.overallScore = dpr.scoreOverall ?? 0;
          this.reportingTo = dpr.hodId ?? '';
          this.currentStatus = dpr.status ?? 'D'; // Set current status from API response
          this.tasks = dpr.tasksList?.length ? dpr.tasksList : [];

          // Set monthYear from DPR data if available
          if (dpr.month && dpr.year) {
            const monthNames = [
              'January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December'
            ];
            this.monthYear = `${monthNames[dpr.month - 1]} ${dpr.year}`;
          }

          // Check if HOD is viewing their own DPR
          const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
          const currentUserId = currentUser.empId || '';
          this.isHodViewingOwnDpr = this.isHod && (currentUserId === this.empId);

          // Handle KPI data - if no existing data, initialize with one empty row
          if (dpr.kpiList?.length) {
            this.kpis = dpr.kpiList;
          } else {
            this.kpis = [
              {
                kpiMasterId: 0,
                description: '',
                kpiValue: '',
                remarks: '',
                kpiId: 0,
                dprId: 0,
                employeeId: this.empId,
                placeholdervalue: '',
              }
            ];
          }

          this.remarksHistory = dpr.commentsList?.length ? dpr.commentsList : [];

          console.log('Loaded DPR details:', dpr);
        } else {
          console.warn('No DPR data found - loading ProofHub tasks for new DPR');
          this.tasks = [];
          this.kpis = [
            {
              kpiMasterId: 0,
              description: '',
              kpiValue: '',
              remarks: '',
              kpiId: 0,
              dprId: 0,
              employeeId: this.empId,
              placeholdervalue: '',
            }
          ];
          this.remarksHistory = [];

          // For new DPR, set monthYear to previous month
          this.setPreviousMonthYear();

          // For new DPR, if HOD is accessing directly, they're creating their own DPR
          const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
          const currentUserId = currentUser.empId || '';
          this.isHodViewingOwnDpr = this.isHod && (currentUserId === this.empId);

          // Only load ProofHub tasks when creating a new DPR (no existing data)
          this.getUserProofhubTasks();
        }
      },
      error: (err) => {
        console.error('Error loading DPR details:', err);
        console.warn('Could not load existing DPR - treating as new DPR and loading ProofHub tasks');

        // For error case (new DPR), set monthYear to previous month
        this.setPreviousMonthYear();

        // For error case (new DPR), if HOD is accessing directly, they're creating their own DPR
        const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
        const currentUserId = currentUser.empId || '';
        this.isHodViewingOwnDpr = this.isHod && (currentUserId === this.empId);

        // If we can't load existing DPR data, treat as new DPR and load ProofHub tasks
        this.getUserProofhubTasks();
      },
    });
  }


  getRatingLabel(score: number): { text: string; color: string } {

    if (score >= 90) {
      return { text: "Excellent", color: "green" };
    } else if (score >= 75) {
      return { text: "Good", color: "blue" };
    } else if (score >= 50) {
      return { text: "Average", color: "orange" };
    } else if (score >= 25) {
      return { text: "Below Average", color: "darkorange" };
    } else {
      return { text: "Poor", color: "red" };
    }

  }


  loadHodMasterList(): void {
    this.api.GetHodMasterList().subscribe(
      (response: any) => {
        if (response && response.success && response.data) {
          this.hodList = response.data;
        } else {
          console.warn('No HOD records found or API call failed');
        }
      },
      (error) => {
        console.error('Error fetching HOD master list:', error);
      }
    );
  }


  validateActualHours() {
    const totalActualHours = this.tasks.reduce(
      (sum, task) => sum + (Number(task.actualHours) || 0),
      0
    );

    this.hoursExceeded = totalActualHours >= this.WorkedHours;

    if (this.hoursExceeded) {
      this.toastr.warning('Actual hours exceed Worked Hours.', 'warning');
    }
  }



  private getBaseUrl(): string {
    return window.location.origin;
  }

  private parseMonthYear(): { month: number, year: number } {
    // Parse monthYear string (e.g., "October 2024") to extract month and year
    if (!this.monthYear) {
      // Fallback to current date if monthYear is not set
      return {
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      };
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const parts = this.monthYear.split(' ');
    if (parts.length === 2) {
      const monthName = parts[0];
      const year = parseInt(parts[1]);
      const month = monthNames.indexOf(monthName) + 1;

      if (month > 0 && year > 0) {
        return { month, year };
      }
    }

    // Fallback to current date if parsing fails
    return {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear()
    };
  }

  private sendNotificationToHOD(dprId: number) {
    if (!this.reportingTo) return;

    const hodNotification: Partial<Notification> = {
      userId: this.reportingTo,
      title: `New DPR Submitted by ${this.empName}`,
      message: `${this.empName} (${this.empId}) has submitted the Monthly DPR for ${this.monthYear}. Click to review.`,
      link: `/monthly-dpr/${dprId}?readonly=1`,
      isRead: false
    };

    console.log('Sending HOD notification:', hodNotification);

    this.api.createNotification(hodNotification).subscribe({
      next: (response) => {
        if (response.success) {
          console.log('HOD notification sent successfully');
          // Send email to HOD
          this.sendEmailToHOD(dprId);
        } else {
          console.error('HOD notification failed:', response);
        }
      },
      error: (error) => {
        console.error('Error sending HOD notification:', error);
        console.error('Error details:', error.error);
      }
    });
  }

  private sendNotificationToEmployee(dprId: number, isSubmission: boolean = false) {
    console.log('sendNotificationToEmployee called with:', { dprId, isSubmission, ApprovalStatus: this.ApprovalStatus, empId: this.empId });

    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const targetUserId = this.empId;

    let title = '';
    let message = '';

    if (isSubmission) {
      title = 'DPR Submitted Successfully';
      message = `Your Monthly DPR for ${this.monthYear} has been submitted successfully. Click to view.`;
    } else if (this.ApprovalStatus === 'A') {
      title = 'DPR Approved';
      message = `Your Monthly DPR for ${this.monthYear} has been approved by ${currentUser.employeeName || 'HOD'}.`;
    } else if (this.ApprovalStatus === 'R') {
      title = 'DPR Requires Revision';
      message = `Your DPR for ${this.monthYear} has been pushed back by ${currentUser.employeeName || 'HOD'} for revision.`;
    }

    console.log('Employee notification details:', { targetUserId, title, message });

    const employeeNotification: Partial<Notification> = {
      userId: targetUserId,
      title: title,
      message: message,
      link: `/monthly-dpr/${dprId}?readonly=1`,
      isRead: false
    };

    console.log('Sending employee notification:', employeeNotification);

    this.api.createNotification(employeeNotification).subscribe({
      next: (response) => {
        if (response.success) {
          console.log('Employee notification sent successfully');
        } else {
          console.error('Employee notification failed:', response);
        }
        // Send email regardless of notification success/failure
        this.sendEmailToEmployee(dprId, isSubmission);
      },
      error: (error) => {
        console.error('Error sending employee notification:', error);
        console.error('Error details:', error.error);
        // Send email even if notification fails
        this.sendEmailToEmployee(dprId, isSubmission);
      }
    });
  }

  private sendEmailToHOD(dprId: number) {
    // Get HOD info from hodList
    const hodInfo = this.hodList.find(hod => hod.idValue === this.reportingTo);
    if (!hodInfo) {
      console.error('HOD information not found');
      return;
    }

    const baseUrl = this.getBaseUrl();
    const evaluationFormLink = `${baseUrl}/monthly-dpr/${dprId}?readonly=1`;

    // Get HOD email from idValue and name from description
    const hodEmail = hodInfo.idValue || ''; // idValue contains the email address
    const hodName = hodInfo.description || 'HOD'; // description contains the display name

    if (!hodEmail) {
      console.error('HOD email not available, skipping email send');
      return;
    }

    const emailRequest: SendEmailRequest = {
      templateKey: 'DPR_SUBMISSION_HOD',
      toEmail: hodEmail,
      placeholders: {
        '[EmployeeName]': this.empName,
        '[EmployeeID]': this.empId,
        '[HODName]': hodName,
        '[MonthYear]': this.monthYear,
        '[EvaluationFormLink]': evaluationFormLink,
        '[HODRemarks]': this.managementRemarks || '',
        '[EmployeeDprEditLink]': evaluationFormLink
      }
    };

    console.log('Sending email to HOD:', emailRequest);

    this.api.SendEmail(emailRequest).subscribe({
      next: (response) => {
        if (response.success) {
          console.log('Email sent to HOD successfully');
        } else {
          console.error('Failed to send email to HOD:', response);
        }
      },
      error: (error) => {
        console.error('Error sending email to HOD:', error);
        console.error('Error details:', error.error);
      }
    });
  }

  private sendEmailToEmployee(dprId: number, isSubmission: boolean = false) {
    console.log('sendEmailToEmployee called with:', { dprId, isSubmission, ApprovalStatus: this.ApprovalStatus, EmailID: this.EmailID });

    const baseUrl = this.getBaseUrl();
    const evaluationFormLink = `${baseUrl}/monthly-dpr/${dprId}?readonly=1`;
    const employeeDprEditLink = `${baseUrl}/monthly-dpr/${dprId}`;

    let templateKey = '';
    if (isSubmission) {
      templateKey = 'DPR_SUBMISSION_EMPLOYEE';
    } else if (this.ApprovalStatus === 'A') {
      templateKey = 'DPR_APPROVED';
    } else if (this.ApprovalStatus === 'R') {
      templateKey = 'DPR_PUSHBACK';
    }

    console.log('Template key determined:', templateKey);

    if (!templateKey) {
      console.error('No template key determined for email');
      return;
    }

    if (!this.EmailID) {
      console.error('Employee email not available, skipping email send. EmailID:', this.EmailID);
      return;
    }

    // Get HOD name from hodList
    const hodInfo = this.hodList.find(hod => hod.idValue === this.reportingTo);
    const hodName = hodInfo ? (hodInfo.description || 'HOD') : 'HOD';

    const emailRequest: SendEmailRequest = {
      templateKey: templateKey,
      toEmail: this.empId,
      placeholders: {
        '[EmployeeName]': this.empName,
        '[EmployeeID]': this.empId,
        '[HODName]': hodName,
        '[MonthYear]': this.monthYear,
        '[EvaluationFormLink]': evaluationFormLink,
        '[HODRemarks]': this.managementRemarks || '',
        '[EmployeeDprEditLink]': this.ApprovalStatus === 'R' ? employeeDprEditLink : evaluationFormLink
      }
    };

    console.log('Sending email to employee:', emailRequest);

    this.api.SendEmail(emailRequest).subscribe({
      next: (response) => {
        if (response.success) {
          console.log('Email sent to employee successfully');
        } else {
          console.error('Failed to send email to employee:', response);
        }
      },
      error: (error) => {
        console.error('Error sending email to employee:', error);
        console.error('Error details:', error.error);
      }
    });
  }

}


