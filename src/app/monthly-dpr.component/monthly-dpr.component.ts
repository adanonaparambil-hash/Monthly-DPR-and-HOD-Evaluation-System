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
  dprid = 0;



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
      START_DATE: '',
      DUE_DATE: '',
      ESTIMATED_HOURS: '',
      LOGGED_HOURS: ''
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

    this.loadKPIs();

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
    this.dprid = 4; 
    const review: DPRReview = {
      employeeId: this.empId,
      status: this.ApprovalStatus,       
      hodId: 'Vinod',               
      scoreQuality: Number (+this.quality),
      scoreTimeliness: Number(+this.timeliness),
      scoreInitiative: Number(+this.initiative),
      scoreOverall: Number(+this.overallScore),
      remarks: this.managementRemarks,
      dprid: this.dprid,         

      kpiList: this.kpis.map(t => ({       
          kpiId: Number(t.kpiId),
          dprId: Number(this.dprid),
          employeeId: t.employeeId,
          kpiMasterId: Number(t.kpiMasterId),
          kpiValue: Number(t.kpiValue),
          remarks: t.remarks,
          kpiDescription: t.kpiDescription
      })),
      
    };

    this.api.updateDPRReview(review).subscribe({
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
        alert(JSON.stringify(err.error));
      }
    });
  
  }


 saveEmployeeDetails() {


    const review: DPRReview = {
      
    employeeId: this.empId,                
    month: new Date().getMonth() + 1,      
    year: new Date().getFullYear(),        
    workedHours: Number(this.WorkedHours), 
    achievements: this.achievements || '', 
    challenges: this.challenges || '',     
    supportNeeded: this.supportNeeded || '', 
    status: this.ApprovalStatus || '', 
    hodId: this.reportingTo || 'Vinod',     
    tasksList: this.tasks.map(t => ({       
      taskName: t.taskName,
      description: t.description,
      actualHours: Number(t.actualHours),
      estimatedHours: Number(t.estimatedHours),
      productivity: Number(t.productivity)
    })),
      
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
      console.log('Full error response:', err);
      Swal.fire({
        icon: 'error',
        title: 'Validation Failed',
        text: JSON.stringify(err.error) 
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

  const startDateString = startDate.toISOString().split('T')[0];  // '2025-08-01'
  const endDateString = endDate.toISOString().split('T')[0];      // '2025-08-31'

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
        selected: false
      }));


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

  


  calculateProductivity(task: any) {
    if (task.estimatedHours && task.actualHours) {
      task.productivity = ((task.actualHours / task.estimatedHours) * 100).toFixed(2);
    } else {
      task.productivity = 0;
    }
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
          employeeId: this.empId                      
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
  
    const selectedTasks = this.Proofhubtasks.filter(t => t.selected);

    if (selectedTasks.length === 0) {

      alert('Please select at least one task!');
      return;

    }

    
    const summary = selectedTasks
      .map((t, i) => `${i + 1}. ${t.TASK_TITLE} - ${t.TASK_DESCRIPTION} (Hours: ${t.LOGGED_HOURS}/${t.ESTIMATED_HOURS}%)`)
      .join('\n');

   
    this.summaryText = 
      "AI Summary of selected tasks:\n\n" + 
      summary + "\n\n" + 
      "👉 Key highlights: Efficient work distribution, good productivity, and timely delivery.";
  }




}

