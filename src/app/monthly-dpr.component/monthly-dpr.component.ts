import { Component } from '@angular/core';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { DPRTask, DPRKPI, DPRReview, ProofhubTaskDto, DPRComment } from '../models/task.model';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { Api } from '../services/api';
import Swal from 'sweetalert2';
import { ToastrService } from 'ngx-toastr';
import { DropdownOption  } from '../models/common.model';
import { ActivatedRoute } from '@angular/router';



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
      kpiDescription: '',
      kpiValue: 0,
      remarks: '',
      kpiId: 0,
      dprId: 0,
      employeeId: '',
      kpiMasterId: 0,
    },
  ];

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

    constructor(private api: Api,private toastr: ToastrService, private route: ActivatedRoute) {}

  ngOnInit() {

    this.dprid = Number(this.route.snapshot.paramMap.get('id'));

    this.setPreviousMonthYear();

    this.loadKPIs();

    const user = JSON.parse(localStorage.getItem('current_user') || '{}');
    if (user) {
      this.empId = user.empId || '';
      this.empName = user.employeeName || '';
      this.designation = user.designation || '';
      this.department = user.department || '';
      this.EmailID = user.email || '';
    }

    this.loadHodMasterList();

    this.getUserProofhubTasks();

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
    this.kpis.push({
      kpiDescription: 'KPI name',
      kpiValue: 0,
      remarks: 'Remarks',
      kpiId: 0,
      dprId: 0,
      employeeId: '',
      kpiMasterId: 0,
    });
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
        }
      });
    } else {
      this.toastr.warning('At least one KPI is required', 'Warning');
    }
  }

  closeModal() {
    this.showModal = false;
    this.summaryText = '';
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
    
    if (this.ApprovalStatus =="R"){
        this.ConfirmationMessage =   'Do you want to rework the review details?';
    }
    else{
      this.ConfirmationMessage =   'Do you want to approve the review details?';
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
          dprid: 4
        };

        this.api.updateDPRReview(review).subscribe({
          next: (res: any) => {
            if (res.success) {
              this.toastr.success(res.message, 'Success');
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


    if (this.ApprovalStatus =="S"){
   
        this.ConfirmationMessage =   'Do you want to submit the review details?';

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
    }
    else{
      this.ConfirmationMessage =   'Do you want to save the review details?';
    } 
    

    const review: DPRReview = {
      employeeId: this.empId,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      workedHours: Number(this.WorkedHours),
      achievements: this.achievements || '',
      challenges: this.challenges || '',
      supportNeeded: this.supportNeeded || '',
      status: this.ApprovalStatus || '',
      hodId: this.reportingTo || '',
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
        kpiDescription: t.kpiDescription,
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

          this.kpis = response.data.map((item: any) => ({
            kpiMasterId: item.kpiid,
            kpiDescription: item.kpiname,
            kpiValue: 0,
            remarks: '',
            kpiId: 0,
            dprId: 0,
            employeeId: this.empId,
          }));
        } else {
          this.kpis = [];
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
      Swal.fire({
        icon: 'error',
        title: 'Operation Failed',
        text: 'Please select at least one task!',
      });

      return;
    }

    this.api.summarizeTasks(selectedTasks).subscribe({
      next: (res) => {
        this.summaryText = res.summary;
      },
      error: (err) => {
        console.error(err);
        alert('Error generating summary');
      },
    });
  }

  GetDPREmployeeReviewDetails(dprId: number) {
    this.api.GetDPREmployeeReviewDetails(dprId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const dpr = res.data as DPRReview;

          this.WorkedHours = dpr.workedHours ?? 0;
          this.achievements = dpr.achievements ?? '';
          this.challenges = dpr.challenges ?? '';
          this.supportNeeded = dpr.supportNeeded ?? '';
          this.quality = dpr.scoreQuality ?? 0;
          this.timeliness = dpr.scoreTimeliness ?? 0;
          this.initiative = dpr.scoreInitiative ?? 0;
          this.overallScore = dpr.scoreOverall ?? 0;
          this.reportingTo = dpr.hodId ?? '';
          this.tasks = dpr.tasksList?.length ? dpr.tasksList : [];
          this.kpis = dpr.kpiList?.length ? dpr.kpiList : [];
          this.remarksHistory = dpr.commentsList?.length ? dpr.commentsList : [];

          console.log('Loaded DPR details:', dpr);
        } else {
          console.warn('No DPR data found');
          this.tasks = [];
          this.kpis = [];
          this.remarksHistory = [];
        }
      },
      error: (err) => {
        console.error(err);
        // alert('Error loading DPR');
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
      this.toastr.warning('Actual hours exceed Worked Hours.', 'error');
    }
  }

}


