import { Component } from '@angular/core';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { DPRTask, DPRKPI,DPRReview,ProofhubTaskDto,DPRComment } from '../models/task.model';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { Api } from '../services/api';
import Swal from 'sweetalert2';
import { ToastrService } from 'ngx-toastr'; 



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

  monthYear =  "";

  showTaskDetails = true;
  showKpiDetails = true;
  showHodEvaluation = true;
  showManagementRemarks = true;
  showRemarksHistory = true;
  summaryText = '';
  showModal = false;

  managementRemarks = "";

  ApprovalStatus = '';

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



  tasks: DPRTask[] = [
    {
      taskName: '',
      description: '',
      estimatedHours: 0,
      actualHours: 0,
      productivity: 0,
      selected: false
    },
  ];

  Proofhubtasks: ProofhubTaskDto[] = [
    {
      TASK_TITLE: '',
      TASK_DESCRIPTION: '',
      START_DATE: new Date(),
      DUE_DATE: new Date(),
      ESTIMATED_HOURS: 0,
      LOGGED_HOURS: 0
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
      kpiMasterId: 0
    },
  ];


  remarksHistory: DPRComment[] = [{
      commentId: 0,
      hodId: "John Smith (HOD)",
      commentText: "Employee has shown excellent performance this month with high quality deliverables.",
      commentType: "APPROVE",
      CREATEDAT: new Date('2025-06-15 14:32'),
  }];

  

    constructor(private api: Api) {}
    
    // constructor(private api: Api,private toastr: ToastrService) {} 

  ngOnInit() {    

    this.setPreviousMonthYear();

    const user = JSON.parse(localStorage.getItem('current_user') || '{}');
    if (user) {
      this.empId = user.empId || '';
      this.empName = user.employeeName || '';
      this.designation = user.designation || '';
      this.department = user.department || '';
    }
  }

  toggleTaskDetails() {
    this.showTaskDetails = !this.showTaskDetails;
  }

  toggleKpiDetails() {
    this.showKpiDetails = !this.showKpiDetails;
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
    this.tasks.push({
      taskName: '',
      description: '',
      estimatedHours: 0,
      actualHours: 0,
      productivity: 0,
      selected: false
    });
  }

  addNewKPI() {
    this.kpis.push({
      kpiDescription: 'KPI name',
      kpiValue: 0,
      remarks: 'Remarks',
      kpiId: 0,
      dprId: 0,
      employeeId: '',
      kpiMasterId: 0
    });
  }

 

  closeModal() {
    this.showModal = false;
    this.summaryText = '';
  }

  generateSummary() {
    // 🔹 Filter selected tasks
    const selectedTasks = this.tasks.filter(t => t.selected);

    if (selectedTasks.length === 0) {
      // this.toastr.error('Please select at least one task!','Error');
      
      alert('Please select at least one task!');
      return;
    }

    // 🔹 Build a simple text (later send this to AI API)
    const summary = selectedTasks
      .map((t, i) => `${i + 1}. ${t.taskName} - ${t.description} (Hours: ${t.actualHours}/${t.estimatedHours}, Productivity: ${t.productivity}%)`)
      .join('\n');

    // 🔹 Stubbed AI response (later replace with OpenAI call)
    this.summaryText = 
      "AI Summary of selected tasks:\n\n" + 
      summary + "\n\n" + 
      "👉 Key highlights: Efficient work distribution, good productivity, and timely delivery.";
  }

 

  loadDpr(dprId: number) {
    
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
          this.tasks = dpr.tasksList ?? [];  
          this.kpis = dpr.kpiList ?? [];
          this.remarksHistory = dpr.commentsList ?? [];

        } 
      },
      error: (err) => {
        console.error(err);
        alert('Error loading DPR');
      }
    });

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

  private HODReviewUpdate() {
    const dprReview: DPRReview = {
      employeeId: this.empId,
      status: this.ApprovalStatus,       
      hodId: 'HOD01',               
      scoreQuality: +this.quality,
      scoreTimeliness: +this.timeliness,
      scoreInitiative: +this.initiative,
      scoreOverall: +this.overallScore,
      kpiList: this.kpis,            
    };

    this.api.updateDPRReview(dprReview).subscribe({
      next: (res: any) => {
        
        if(res.success){

          Swal.fire({
            icon: 'success',
            title: 'Operation successful',
            text: res.message,
          });

        }
        else{
            Swal.fire({
              icon: 'error',
              title: 'Oops...',
              text: 'Failed to update DPR: ' + res.message,
            });
        }
        
        console.log(res);
      },
      error: (err) => {
        
      }
    });
  
  }


 saveEmployeeDetails() {


    const review: DPRReview = {
      employeeId: this.empId,
      month: new Date().getMonth(),
      year: new Date().getFullYear(),
      workedHours: this.WorkedHours,
      achievements: this.achievements,
      challenges: this.challenges,
      supportNeeded: this.supportNeeded,
      status: this.ApprovalStatus,
      tasksList: this.tasks,
      
    };

    this.api.insertDpr(review).subscribe({
      next: (res) => {
        
        Swal.fire({
            icon: 'success',
            title: 'Operation successful',
            text: res.message,
        });

      },
      error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: err.message,
          });
      }
    });

  }


  GetProofHubTask() {
    this.showModal = true;

    this.getUserProofhubTasks();

  }

  getUserProofhubTasks() {

    const user = JSON.parse(localStorage.getItem('current_user') || '{}');
    if (user) {
      this.empId = user.empId || '';
      this.empName = user.employeeName || '';
      this.designation = user.designation || '';
      this.department = user.department || '';
      this.reportingTo = user.reportingTo || '';
    }

    const email = user.email || '';
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    this.api.GetUserProofhubTasks(email, startDate, endDate).subscribe({
      next: (res) => {
        // const response = res.data as ProofhubTaskDto;
        this.Proofhubtasks = res.data || [];  
      },
      error: (err) => {
        console.error('Error fetching tasks:', err);
      }
    });
  }

  setPreviousMonthYear(): void {
    const currentDate = new Date(); 
    currentDate.setMonth(currentDate.getMonth() - 1); 

    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' }; 
    this.monthYear = currentDate.toLocaleDateString('en-US', options); 
  }

}



