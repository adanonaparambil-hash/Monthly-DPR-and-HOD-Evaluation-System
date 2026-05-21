import { Component } from '@angular/core';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { DPRTask, DPRKPI, DPRReview, ProofhubTaskDto, DPRComment, ReviewAssessment, AppraisalAccessRequest, AppraisalAccessResult } from '../models/task.model';
import { CommonModule, Location } from '@angular/common';
import { NgModule } from '@angular/core';
import { Api } from '../services/api';
import Swal from 'sweetalert2';
import { ToastrService } from 'ngx-toastr';
import { DropdownOption, Notification, SendEmailRequest } from '../models/common.model';
import { ActivatedRoute, Router } from '@angular/router';
import { AvatarUtil } from '../utils/avatar.util';



@Component({
  selector: 'app-apr',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './apr.component.html',
  styleUrl: './apr.component.css',
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
    trigger('pulseAnimation', [
      transition('* => *', [
        animate('0.6s ease-in-out', style({ transform: 'scale(1.05)' })),
        animate('0.6s ease-in-out', style({ transform: 'scale(1)' })),
      ]),
    ]),
  ],
})
export class AprComponent {
  // Annual Performance Review component
  monthYear = '';

  EmailID = '';

  showTaskDetails = true;
  showKpiPerformance = true;
  showHodEvaluation = true;
  showManagementRemarks = true;
  showRemarksHistory = true;

  // HOD Evaluation inputs
  hodRecommendation: 'increment' | 'promotion' | 'no_change' | '' = '';
  hodRemarks = '';
  summaryText = '';
  showModal = false;
  isGeneratingSummary = false;

  managementRemarks = '';

  ApprovalStatus = '';

  ConfirmationMessage = '';

  ConfirmationMessageOnSubmit = '';

  empId = '';
  empName = '';
  designation = '';
  department = '';
  reportingTo = '';
  WorkedHours = 0;
  TotalEstimatedhours = 0;

  // Profile display fields
  profileImage = AvatarUtil.DEFAULT_AVATAR;
  dateOfJoining = '';
  totalExperience = '';
  employmentType = '';
  appraisalPeriod = '';

  // Reviewers — up to 3 selected employees
  selectedReviewers: string[] = [];   // array of empId strings — employee-chosen (userType 'S')
  reviewerDropdownOpen = false;
  reviewerSearchTerm = '';
  employeeList: any[] = [];           // full employee list for reviewer selection

  // HOD Evaluation reviewers — up to 3 (userType 'H')
  selectedHodReviewers: string[] = [];
  hodReviewerDropdownOpen = false;
  hodReviewerSearchTerm = '';

  // CED-assigned reviewers (userType 'C')
  selectedCedReviewers: string[] = [];

  // CED — assign reviewers modal
  cedAssignModalOpen = false;
  cedAssignSearchTerm = '';
  cedSelectedReviewers: string[] = [];  // working copy while modal is open

  // Reviewer Assessment — when logged-in user is one of the selected reviewers
  isReviewer = false;
  myReviewerUserType = 'S'; // 'S' = self-appraisal reviewer, 'H' = HOD evaluation reviewer
  myReviewAssessmentId = 0;
  myReviewAssessmentStatus = ''; // 'P' = pending (assigned, not yet reviewed), 'S' = submitted
  raQuality = 0;
  raTimeliness = 0;
  raInitiative = 0;
  raCommunication = 0;
  raTeamwork = 0;
  raProblemSolving = 0;
  raAdaptability = 0;
  raLearning = 0;
  raGoalAlignment = 0;
  raOverallReview = 0;
  raComments = '';
  showReviewerAssessment = true;
  activeAppraisalTab: 'self' | 'reviewer' | 'reviews' = 'self'; // tab inside the unified appraisal card
  selectedReviewerIndex = 0; // which reviewer is selected in the reviews master-detail
  reviewAssessmentList: any[] = [];

  achievements = '';
  challenges = '';
  supportNeeded = '';

  // Self-appraisal (sa* — matches C# field names)
  saQuality = 0;
  saTimeliness = 0;
  saInitiative = 0;
  saCommunication = 0;
  saTeamwork = 0;
  saProblemSolving = 0;
  saAdaptability = 0;
  saLearning = 0;
  saGoalAlignment = 0;
  saOverallSelf = 0;
  saComments = '';

  // Work summary
  keyResponsibilities = '';
  deliverablesOutcomes = '';

  // Training & development
  trainingCompleted = '';
  skillsDeveloped = '';
  trainingNeeded = '';

  // Career goals
  careerGoals = '';
  supportNeededAnnual = '';

  // Annual achievements
  annualAchievements = '';
  annualChallenges = '';

  // Section collapse state
  showWorkSummary = true;
  showSelfAppraisal = true;
  showAchievements = true;
  showTraining = true;
  showCareerGoals = true;

  quality = 0;
  timeliness = 0;
  initiative = 0;
  problemSolving = 0;
  teamWork = 0;
  communication = 0;
  hodRating = 0; // HOD's manual rating (1-5)
  overallScore = 0; // System-generated final rating (20-100 scale for display)
  dprid = 0;
  hoursExceeded: boolean = false;

  // Timesheet Accuracy Report — CED only
  timesheetAccuracyReport: any = null;

  // ProofHub Accuracy Report — CED only
  proofhubAccuracyReport: any = null;

  // Overall Rating System Properties
  hodEvaluationAverage = 0;
  reviewerAvg100Display = 0;   // reviewer 50% component (0–100 scale) — for display in breakdown
  submittedReviewerCount = 0;  // how many reviewers have submitted (status 'S')
  totalReviewerCount = 0;      // total assigned reviewers across all groups
  attendanceScore = 0;         // attendance score from API (1–100), contributes 10% to overall
  productivityScore = 0;
  showOverallRating = false;

  // Role and mode flags
  userType: 'E' | 'H' | 'C' = 'E';
  isReadOnlyMode: boolean = false;
  currentStatus: string = 'D'; // D, R, S, A
  isHodViewingOwnDpr: boolean = false; // Track if HOD is viewing their own DPR
  loggedInEmpId: string = ''; // Logged-in user's empId (set in ngOnInit)

  get isEmployee(): boolean { return this.userType === 'E'; }
  get isHod(): boolean { return this.userType === 'H'; }
  get isCed(): boolean { return this.userType === 'C'; }

  // Universal: logged-in user IS the Reporting Manager (hodId) of this DPR
  // Role-agnostic — works for HOD, CED, or any user type
  get isLoggedInUserTheRM(): boolean {
    return !!this.loggedInEmpId && this.reportingTo === this.loggedInEmpId;
  }

  // True when the logged-in HOD is the RM — kept for HOD-specific logic (e.g. not own DPR)
  get isHodTheReportingManager(): boolean {
    return this.isHod && !this.isHodViewingOwnDpr && this.isLoggedInUserTheRM;
  }

  // True when CED is the RM — for CED-specific edit/submit (status P only)
  get isCedActingAsHod(): boolean {
    return this.isCed && this.currentStatus === 'P' && this.isLoggedInUserTheRM;
  }

  // Status-based access control for Employees
  get canEditEmployeeFields(): boolean {
    if (!this.isEmployee) return false;
    return this.currentStatus === 'D' || this.currentStatus === 'R';
  }

  get canViewEmployeeFields(): boolean {
    return this.isEmployee && (this.currentStatus === 'S' || this.currentStatus === 'P' || this.currentStatus === 'A');
  }

  // Reporting Manager Evaluation — editable when logged-in user is the RM and status is P
  // (works for any role: HOD, CED, or otherwise)
  get canEditHodEvaluation(): boolean {
    if (this.isCed) return this.isCedActingAsHod;
    if (this.isHod && this.isHodViewingOwnDpr) return false; // HOD can't evaluate their own DPR
    // Any user who is the RM: editable at status P or S
    if (this.isLoggedInUserTheRM) return this.currentStatus === 'P' || this.currentStatus === 'S';
    return false;
  }

  get canViewHodEvaluation(): boolean {
    if (this.isCed) return true; // CED always sees it
    return this.isLoggedInUserTheRM; // Any RM can view
  }

  // Management Remarks visibility - CED should NOT see this
  get canViewManagementRemarks(): boolean {
    return this.isHod && !this.isCed;
  }

  get canEditManagementRemarks(): boolean {
    return this.isHod && (this.currentStatus === 'S' || this.currentStatus === 'P');
  }

  // Remarks History visibility
  get canViewRemarksHistory(): boolean {
    if (this.isCed) return true;
    if (this.isHod) return true;
    if (this.isEmployee) return this.currentStatus === 'R' || this.currentStatus === 'A';
    return false;
  }

  // Button visibility — Submit + Cancel for employee/own DPR
  get showEmployeeButtons(): boolean {
    if (this.isReviewer && !this.isEmployee && !this.isHod) return false;
    if (this.isEmployee) return this.currentStatus === 'D' || this.currentStatus === 'R';
    if (this.isHod && this.isHodViewingOwnDpr) return this.currentStatus === 'D' || this.currentStatus === 'R';
    return false;
  }

  // Show Submit button when logged-in user is the RM and status is P (any role)
  get showHodButtons(): boolean {
    if (this.isHodViewingOwnDpr) return false; // HOD never submits their own DPR as RM
    return this.isLoggedInUserTheRM && this.currentStatus === 'P';
  }

  // Table action buttons
  get showTableActions(): boolean {
    if (this.isCed) return false;
    if (this.isEmployee) return this.currentStatus === 'D' || this.currentStatus === 'R';
    if (this.isHod && this.isHodViewingOwnDpr) return this.currentStatus === 'D' || this.currentStatus === 'R';
    if (this.isHod && !this.isHodViewingOwnDpr) return false;
    return false;
  }

  // Field editability
  get canEditFields(): boolean {
    if (this.isCed) return false;
    if (this.isEmployee) return this.currentStatus === 'D' || this.currentStatus === 'R';
    if (this.isHod && this.isHodViewingOwnDpr) return this.currentStatus === 'D' || this.currentStatus === 'R';
    if (this.isHod && !this.isHodViewingOwnDpr) return false;
    return false;
  }

  // Reviewer Assessment — editable when the logged-in user is a reviewer, APR is submitted,
  // and the reviewer has not yet submitted their assessment (status 'P' or blank = pending)
  get canEditReviewerAssessment(): boolean {
    if (!this.isReviewer) return false;
    if (this.currentStatus !== 'S' && this.currentStatus !== 'P' && this.currentStatus !== 'A') return false;
    // Block once the reviewer has submitted their assessment
    if (this.myReviewAssessmentStatus === 'S') return false;
    // Allow editing when pending (P) or not yet started ('')
    return this.myReviewAssessmentStatus === 'P' || this.myReviewAssessmentStatus === '';
  }

  // Whether the reviewer has already submitted their assessment
  get reviewerAssessmentSubmitted(): boolean {
    return this.isReviewer && this.myReviewAssessmentStatus === 'S';
  }

  // Get all reviewer assessments that have ratings (for CED/HOD view)
  // Shows any entry with a reviewerId and at least one rating — regardless of status or userType
  get submittedReviewerAssessments(): any[] {
    return this.reviewAssessmentList.filter((ra: any) =>
      ra.reviewerId &&
      (ra.raQuality || ra.raTimeliness || ra.raInitiative || ra.raCommunication ||
       ra.raTeamwork || ra.raProblemSolving || ra.raAdaptability || ra.raLearning ||
       ra.raGoalAlignment || ra.raOverallReview)
    );
  }

  // Get reviewer name by ID
  getReviewerNameById(reviewerId: string): string {
    const emp = this.employeeList.find(e => (e.empId || e.idValue) === reviewerId);
    return emp ? (emp.employeeName || emp.description || reviewerId) : reviewerId;
  }

  // Get a specific reviewer assessment rating by key
  getReviewerRating(assessment: any, saKey: string): number {
    const raKeyMap: Record<string, string> = {
      saQuality:       'raQuality',
      saTimeliness:    'raTimeliness',
      saInitiative:    'raInitiative',
      saCommunication: 'raCommunication',
      saTeamwork:      'raTeamwork',
      saProblemSolving:'raProblemSolving',
      saAdaptability:  'raAdaptability',
      saLearning:      'raLearning',
      saGoalAlignment: 'raGoalAlignment',
      saOverallSelf:   'raOverallReview',
    };
    const raKey = raKeyMap[saKey];
    return raKey ? (assessment[raKey] || 0) : 0;
  }

  // Show reviewer assessment section:
  // - Any user in the reviewer list — any status after Draft
  // - HOD who is NOT the RM of this DPR — show their reviewer assessment section
  get showReviewerAssessmentSection(): boolean {
    if (this.isReviewer && this.currentStatus !== 'D') return true;
    if (this.isHod && !this.isHodViewingOwnDpr && !this.isHodTheReportingManager) {
      return this.currentStatus !== 'D';
    }
    return false;
  }

  // CED — assign reviewers: visible when CED views any APR
  get showCedAssignReviewers(): boolean {
    return this.isCed;
  }

  // HOD Evaluation section visibility
  // Rule: show when logged-in user IS the RM (hodId === loggedInEmpId) AND status is 'P'
  // CED: always sees it (read-only view of all data)
  // Employee: only when approved (read-only)
  get showHodEvaluationSection(): boolean {
    if (this.isEmployee && !this.isLoggedInUserTheRM) return this.currentStatus === 'A';
    if (this.isCed) return true; // CED always sees it
    if (this.isHodViewingOwnDpr) return false; // Never evaluate your own DPR
    // Any user who is the RM: show when status is P (editable) or S/A (read-only after submission)
    if (this.isLoggedInUserTheRM) return this.currentStatus === 'P' || this.currentStatus === 'S' || this.currentStatus === 'A';
    return false;
  }

  // Management Remarks section visibility
  get showManagementRemarksSection(): boolean {
    if (this.isEmployee) return false; // Employee never sees management remarks
    if (this.isCed) return false; // CED should not see management remarks

    // HOD should only see management remarks when coming from evaluation sources
    // Hide when coming directly from APR Entry menu (no 'from' param or from='direct')
    if (this.isHod) {
      const isDirectEntry = !this.navigationSource || this.navigationSource === 'direct';
      return !isDirectEntry; // Show only when NOT direct entry
    }

    return false;
  }



  // Remarks History section visibility
  get showRemarksHistorySection(): boolean {
    // HOD should only see remarks history when coming from evaluation sources
    // Hide when coming directly from APR Entry menu
    if (this.isHod) {
      const isDirectEntry = !this.navigationSource || this.navigationSource === 'direct';
      return !isDirectEntry && this.canViewRemarksHistory; // Show only when NOT direct entry
    }

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




  calculateOverallRating(): void {
    const qualityScore        = this.quality        || 0;
    const timelinessScore     = this.timeliness     || 0;
    const initiativeScore     = this.initiative     || 0;
    const problemSolvingScore = this.problemSolving || 0;
    const teamWorkScore       = this.teamWork       || 0;
    const communicationScore  = this.communication  || 0;
    const hodRatingValue      = this.hodRating      || 0;

    // ── HOD Evaluation component (40% of final score) ──────────
    // Average of all non-zero HOD scores (6 competencies + overall HOD rating), on 1–100 scale
    const hodScores = [
      qualityScore, timelinessScore, initiativeScore,
      problemSolvingScore, teamWorkScore, communicationScore,
      hodRatingValue
    ].filter(s => s > 0);

    this.hodEvaluationAverage = hodScores.length > 0
      ? Math.round((hodScores.reduce((a, b) => a + b, 0) / hodScores.length) * 100) / 100
      : 0;

    // ── Reviewer Assessment component (60% of final score) ─────
    // Filter ONLY by status === 'S' (submitted). Do NOT filter by raTotal.
    // Submitted reviewers always have their scores — divide by submitted count only.
    const submittedReviews = (this.reviewAssessmentList || [])
      .filter((ra: any) => ra.status === 'S');

    const reviewerAvg100 = submittedReviews.length > 0
      ? (submittedReviews.reduce((sum: number, ra: any) => sum + (ra.raTotal || 0), 0)
          / submittedReviews.length)   // average raTotal (out of 50) — divided by submitted count only
        / 50 * 100                     // normalise to 100
      : 0;

    // Store for display in breakdown panel
    this.reviewerAvg100Display = Math.round(reviewerAvg100 * 100) / 100;
    this.submittedReviewerCount = submittedReviews.length;
    this.totalReviewerCount = this.selectedReviewers.length + this.selectedHodReviewers.length;

    this.calculateProductivityScore();

    // ── Final weighted score ────────────────────────────────────
    // HOD Evaluation = 40%,  Reviewer Assessments = 50%,  Attendance = 10%
    // Only compute if at least one component has data
    const attendanceVal = this.attendanceScore || 0;  // 1–100 from API

    const hasHod        = this.hodEvaluationAverage > 0;
    const hasReviewers  = reviewerAvg100 > 0;
    const hasAttendance = attendanceVal > 0;

    if (hasHod || hasReviewers || hasAttendance) {
      const hodWeight        = 0.40;
      const reviewerWeight   = 0.50;
      const attendanceWeight = 0.10;

      this.overallScore = Math.round(
        (hasHod        ? this.hodEvaluationAverage * hodWeight        : 0) +
        (hasReviewers  ? reviewerAvg100            * reviewerWeight   : 0) +
        (hasAttendance ? attendanceVal             * attendanceWeight : 0)
      );
    } else {
      this.overallScore = 0;
    }

    this.showOverallRating =
      this.hodEvaluationAverage > 0 || reviewerAvg100 > 0 || this.hodRating > 0 || attendanceVal > 0;
  }

  calculateProductivityScore(): void {
    //const totalActualHours = this.tasks.reduce((sum, task) => sum + (Number(task.actualHours) || 0), 0);
    const totalActualHours = this.TotalEstimatedhours;
    const workedHours = this.WorkedHours || 0;

    if (workedHours === 0 || totalActualHours === 0) {
      this.productivityScore = 0;
      return;
    }

    // Calculate productivity as a percentage
    const productivityPercentage = Math.min((totalActualHours / workedHours) * 100, 100);

    console.log("totalActualHours" + totalActualHours);
    console.log("workedHours" + workedHours);
    console.log("productivityPercentage" + productivityPercentage);

    // Convert to 5-point scale
    if (productivityPercentage >= 90) this.productivityScore = 5;       // Excellent (4.5-5.0)
    else if (productivityPercentage >= 80) this.productivityScore = 4;  // Good (3.5-4.4)
    else if (productivityPercentage >= 70) this.productivityScore = 3;  // Average (2.5-3.4)
    else if (productivityPercentage >= 50) this.productivityScore = 2;  // Below Average (1.5-2.4)
    else this.productivityScore = 1;                                    // Poor (1.0-1.4)
  }


  getRatingClass(rating: number): string {
    if (rating >= 90) return 'rating-excellent';  // 4.5-5.0 range (90-100 on display scale)
    if (rating >= 70) return 'rating-good';       // 3.5-4.4 range (70-89 on display scale)
    if (rating >= 50) return 'rating-average';    // 2.5-3.4 range (50-69 on display scale)
    if (rating >= 30) return 'rating-below-average'; // 1.5-2.4 range (30-49 on display scale)
    return 'rating-poor';                          // 1.0-1.4 range (20-29 on display scale)
  }


  getRatingText(rating: number): string {
    if (rating >= 90) return 'Excellent';
    if (rating >= 70) return 'Good';
    if (rating >= 50) return 'Average';
    if (rating >= 30) return 'Below Average';
    return 'Poor';
  }


  getRatingDescription(rating: number): string {
    if (rating >= 90) return 'Outstanding performance with exceptional quality and productivity.';
    if (rating >= 70) return 'Strong performance meeting and exceeding expectations.';
    if (rating >= 50) return 'Satisfactory performance meeting basic requirements.';
    if (rating >= 30) return 'Performance needs improvement to meet expectations.';
    return 'Significant improvement required in multiple areas.';
  }

  // Calculate productivity percentage for individual task based on worked hours
  calculateTaskProductivity(actualHours: number): number {
    if (!this.WorkedHours || this.WorkedHours === 0 || !actualHours) {
      return 0;
    }
    const productivity = (actualHours / this.WorkedHours) * 100;
    return Math.round(productivity * 10) / 10; // Round to 1 decimal place
  }

  // Get CSS class for productivity badge based on percentage
  getProductivityClass(actualHours: number): string {
    const productivity = this.calculateTaskProductivity(actualHours);
    if (productivity >= 80) return 'productivity-excellent';
    if (productivity >= 60) return 'productivity-good';
    if (productivity >= 40) return 'productivity-average';
    if (productivity >= 20) return 'productivity-low';
    return 'productivity-very-low';
  }

  // Validation method for rating inputs
  validateRatingInput(fieldName: string, event: any): void {
    const inputValue = event.target.value;
    const inputElement = event.target;

    // Remove any existing validation classes
    inputElement.classList.remove('invalid-input', 'valid-input');

    // Skip validation if field is empty (allow user to clear field)
    if (inputValue === '' || inputValue === null || inputValue === undefined) {
      (this as any)[fieldName] = null;
      this.calculateOverallRating();
      return;
    }

    // Allow partial input while typing (e.g., "4.", "0.5", etc.)
    // Only validate when input looks complete
    if (inputValue.endsWith('.') || inputValue === '0' || inputValue === '0.') {
      // User is still typing, don't validate yet
      return;
    }

    const value = parseFloat(inputValue);

    // Check if value is not a number (but allow partial decimal input)
    if (isNaN(value)) {
      // Don't clear immediately, just mark as invalid visually
      inputElement.classList.add('invalid-input');
      return;
    }

    // Only clear values that are clearly out of range
    if (value > 100) {
      // Clear the field only for values clearly above 100
      (this as any)[fieldName] = null;
      event.target.value = '';
      inputElement.classList.add('invalid-input');
      this.toastr.warning('Rating cannot exceed 100. Please enter a value between 1 and 100.', 'Invalid Rating');
      this.calculateOverallRating();
      return;
    }

    if (value < 1 && inputValue.length > 2) {
      // Only clear if user has typed enough and value is clearly below 1
      (this as any)[fieldName] = null;
      event.target.value = '';
      inputElement.classList.add('invalid-input');
      this.toastr.warning('Rating cannot be less than 1. Please enter a value between 1 and 100.', 'Invalid Rating');
      this.calculateOverallRating();
      return;
    }

    // If value is valid, accept it (don't auto-round while typing)
    if (value >= 1 && value <= 100) {
      (this as any)[fieldName] = value;
      inputElement.classList.add('valid-input');
      this.calculateOverallRating();
    }
  }

  // Final validation when user finishes typing (on blur)
  finalizeRatingInput(fieldName: string, event: any): void {
    const inputValue = event.target.value;
    const inputElement = event.target;

    if (inputValue === '' || inputValue === null || inputValue === undefined) {
      return;
    }

    const value = parseFloat(inputValue);

    if (!isNaN(value) && value >= 1 && value <= 100) {
      // Round to whole number for final value (since we're using 1-100 scale)
      const roundedValue = Math.round(value);
      (this as any)[fieldName] = roundedValue;

      // Update the input field to show the rounded value if different
      if (roundedValue !== value) {
        event.target.value = roundedValue.toString();
        this.toastr.info(`Value rounded to ${roundedValue}`, 'Value Adjusted');
      }

      inputElement.classList.remove('invalid-input');
      inputElement.classList.add('valid-input');
      this.calculateOverallRating();
    }
  }



  // Access control — set when validateAppraisalAccess blocks the user
  accessBlocked = false;
  accessBlockedMessage = '';

  // Track navigation source
  private navigationSource: string = '';

  constructor(private api: Api, private toastr: ToastrService, private route: ActivatedRoute, private router: Router, private location: Location) { }

  // ── Action methods (declared early so template compiler resolves them) ──
  saveDraft(): void {
    if (!this.reportingTo) {
      this.toastr.warning('Please select a Reporting Manager before saving.', 'Validation Failed');
      return;
    }
    this.ApprovalStatus = 'D';
    this.saveEmployeeDetails();
  }

  SubmitReview(): void {
    // HOD submitting → 'S' (pending HOD review of others' APRs)
    // HOD is the RM → 'S'; CED acting as HOD → 'S'; Employee/own submit → 'P'
    const isHodAction = this.isHodTheReportingManager || this.isCedActingAsHod;
    const status = isHodAction ? 'S' : 'P';
    // actionType: employee/own submit = 'SUBMIT', HOD-as-RM/CED-as-HOD submit = 'APPROVAL'
    const actionType: 'SUBMIT' | 'APPROVAL' = isHodAction ? 'APPROVAL' : 'SUBMIT';

    this.checkAppraisalAccess(actionType).then(allowed => {
      if (!allowed) return;
      this.ApprovalStatus = status;
      this.saveEmployeeDetails();
    });
  }

  closeModal(): void {
    this.showModal = false;
    this.summaryText = '';
    this.isGeneratingSummary = false;
  }

  generateSummary(): void {
    const selectedTasks = this.Proofhubtasks.filter((t) => t.selected);
    if (selectedTasks.length === 0) {
      this.toastr.error('Please select at least one task!.', 'error');
      return;
    }
    this.summaryText = '';
    this.isGeneratingSummary = true;
    this.api.summarizeTasks(selectedTasks).subscribe({
      next: (res) => { this.summaryText = res.summary; this.isGeneratingSummary = false; },
      error: (err) => { console.error(err); this.toastr.error('Error generating summary', 'Error'); this.isGeneratingSummary = false; },
    });
  }

  copySummaryToClipboard(event?: Event): void {
    if (event) { event.preventDefault(); event.stopPropagation(); (event.target as HTMLElement)?.blur(); }
    if (this.summaryText) {
      const cleanedText = this.cleanSummaryText(this.summaryText);
      navigator.clipboard.writeText(cleanedText).then(
        () => this.toastr.success('Summary copied to clipboard!', 'Success'),
        () => this.fallbackCopyTextToClipboard(cleanedText)
      );
    }
  }

  goBack(): void {
    this.location.back();
  }

  /**
   * Calls validateAppraisalAccess and returns true if the action is allowed.
   * Shows a SweetAlert with the backend message if blocked.
   */
  private checkAppraisalAccess(actionType: 'SUBMIT' | 'APPROVAL'): Promise<boolean> {
    const year = new Date().getFullYear() - 1; // APR is always for the previous year
    // Always use the logged-in user's empId — this.empId gets overwritten with the
    // employee's ID when HOD/CED opens someone else's DPR
    const request: AppraisalAccessRequest = {
      userId:     this.loggedInEmpId || this.empId,
      year,
      actionType,
    };
    return new Promise(resolve => {
      this.api.validateAppraisalAccess(request).subscribe({
        next: (res: any) => {
          const data = res?.data as AppraisalAccessResult;
          if (res?.success && data?.isAllowed === 1) {
            resolve(true);
          } else {
            const msg = data?.message || res?.message || 'You are not allowed to perform this action.';
            Swal.fire({
              title: 'Access Restricted',
              text: msg,
              icon: 'warning',
              confirmButtonText: 'OK',
            });
            resolve(false);
          }
        },
        error: () => {
          // On API error, allow the action to proceed (fail-open)
          resolve(true);
        },
      });
    });
  }

  ngOnInit() {

    this.dprid = Number(this.route.snapshot.paramMap.get('id'));
    this.isReadOnlyMode = (this.route.snapshot.queryParamMap.get('readonly') || '') === '1';
    this.navigationSource = this.route.snapshot.queryParamMap.get('from') || '';

    // Set a default title immediately (will be updated when data loads)
    if (!sessionStorage.getItem('currentAPRMonthYear')) {
      sessionStorage.setItem('currentAPRMonthYear', 'Loading...');
      window.dispatchEvent(new CustomEvent('aprMonthYearUpdated'));
    }

    const user = JSON.parse(localStorage.getItem('current_user') || '{}');
    if (user) {
      this.empId = user.empId || '';
      this.empName = user.employeeName || '';
      this.designation = user.designation || '';
      this.department = user.department || '';
      this.EmailID = user.email || '';

      // Profile display fields — pre-fill from session, then enrich from API
      this.profileImage = AvatarUtil.processProfileImage(user.profileImageBase64);
      this.dateOfJoining = user.dateOfJoining || user.joiningDate || '';
      this.totalExperience = user.totalExperience || user.experience || '';
      this.employmentType = user.employmentType || user.empType || 'Full-time';

      // Determine userType from session (default Employee)
      const code = ((user.isHOD || user.role || user.userType || '') as string).toString().toUpperCase();
      if (code === 'H') {
        this.userType = 'H';
      } else if (code === 'C') {
        this.userType = 'C';
      } else {
        this.userType = 'E';
      }

      this.loggedInEmpId = user.empId || '';

      // Load full profile from API to enrich profile fields
      if (!this.dprid && this.empId) {
        this.loadEmployeeProfile(this.empId);
      }
    }

    // Load employee list for reviewer selection FIRST, then load DPR details
    // so that reviewer names resolve correctly when chips are rendered
    this.api.getEmployeeMasterList().subscribe({
      next: (res: any) => {
        if (res?.success && res?.data) {
          this.employeeList = res.data;
        }
        // Load DPR details after employee list is ready so getReviewerName() works
        this.GetDPREmployeeReviewDetails(this.dprid);
      },
      error: () => {
        // Still load DPR even if employee list fails
        this.GetDPREmployeeReviewDetails(this.dprid);
      }
    });

    // For new APR entry (no dprid), validate the user is allowed to submit this year
    if (!this.dprid && !this.isReadOnlyMode) {
      this.checkAppraisalAccess('SUBMIT').then(allowed => {
        if (!allowed) {
          // Block the form — navigate back after the alert is dismissed
          setTimeout(() => this.router.navigate(['/apr-past-reports']), 300);
        }
      });
    }

    if (!this.dprid) {
      this.loadKPIs();
    }

    this.loadHodMasterList();

    setTimeout(() => {
      this.calculateOverallRating();
    }, 1000);

  }

  private loadEmployeeProfile(empId: string): void {
    this.api.GetEmployeeProfile(empId).subscribe({
      next: (res: any) => {
        if (res?.success && res?.data) {
          const d = res.data;
          this.empName        = d.employeeName  || this.empName;
          this.designation    = d.designation   || this.designation;
          this.department     = d.department    || this.department;
          this.profileImage   = AvatarUtil.processProfileImage(d.profileImageBase64) || this.profileImage;
          this.dateOfJoining  = d.doj           || d.joinDate || this.dateOfJoining;
          this.employmentType = d.employmentType || this.employmentType || 'Full-time';

          // Compute total experience from experienceInd + experienceAbroad (years)
          const expInd    = Number(d.experienceInd)    || 0;
          const expAbroad = Number(d.experienceAbroad) || 0;
          const totalYrs  = expInd + expAbroad;
          if (totalYrs > 0) {
            const yrs = Math.floor(totalYrs);
            const mos = Math.round((totalYrs - yrs) * 12);
            this.totalExperience = mos > 0 ? `${yrs} yrs ${mos} mos` : `${yrs} yrs`;
          }
        }
      },
      error: (err: any) => console.error('Error loading employee profile:', err)
    });
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

  toggleWorkSummary() { this.showWorkSummary = !this.showWorkSummary; }
  toggleSelfAppraisal() { this.showSelfAppraisal = !this.showSelfAppraisal; }
  toggleAchievements() { this.showAchievements = !this.showAchievements; }
  toggleTraining() { this.showTraining = !this.showTraining; }
  toggleCareerGoals() { this.showCareerGoals = !this.showCareerGoals; }
  toggleReviewerAssessment() { this.showReviewerAssessment = !this.showReviewerAssessment; }

  // ── CED Assign Reviewers modal ────────────────────────────────
  openCedAssignModal(): void {
    // Pre-populate with CED-assigned reviewers only
    this.cedSelectedReviewers = [...this.selectedCedReviewers];
    this.cedAssignSearchTerm = '';
    this.cedAssignModalOpen = true;
    document.body.classList.add('modal-open');
  }

  closeCedAssignModal(): void {
    this.cedAssignModalOpen = false;
    this.cedAssignSearchTerm = '';
    document.body.classList.remove('modal-open');
  }

  get cedFilteredEmployeeList(): any[] {
    const term = this.cedAssignSearchTerm.toLowerCase().trim();
    // Exclude the appraisee, already-selected CED reviewers, and reviewers from other groups
    const allAssigned = new Set([
      this.empId,
      ...this.cedSelectedReviewers,
      ...this.selectedReviewers,
      ...this.selectedHodReviewers,
    ]);
    return this.employeeList.filter(e => {
      const id   = e.empId || e.idValue || '';
      const name = (e.employeeName || e.description || '').toLowerCase();
      return !allAssigned.has(id) && (term === '' || name.includes(term));
    });
  }

  isCedReviewerSelected(empId: string): boolean {
    return this.cedSelectedReviewers.includes(empId);
  }

  toggleCedReviewerSelection(empId: string): void {
    const idx = this.cedSelectedReviewers.indexOf(empId);
    if (idx > -1) {
      this.cedSelectedReviewers.splice(idx, 1);
    } else {
      this.cedSelectedReviewers.push(empId);   // no limit for CED
    }
  }

  removeCedReviewer(empId: string): void {
    this.cedSelectedReviewers = this.cedSelectedReviewers.filter(id => id !== empId);
  }

  submitCedAssignment(): void {
    if (this.cedSelectedReviewers.length === 0) {
      this.toastr.warning('Please select at least one reviewer.', 'No Reviewers Selected');
      return;
    }

    // Snapshot existing CED reviewer IDs before updating
    const existingCedIds = new Set(this.selectedCedReviewers);

    // CED-assigned reviewers use userType 'C' — stored separately from employee-chosen ('S')
    this.selectedCedReviewers = [...this.cedSelectedReviewers];
    this.closeCedAssignModal();

    // Use the single full payload builder — preserves all fields and all other reviewers
    const review = this.buildFullPayload(this.currentStatus);

    this.api.insertDpr(review).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.toastr.success('Reviewers assigned successfully.', 'Saved');
          // Send emails only to newly added CED reviewers
          const dprId = res.data || this.dprid;
          const newCedReviewers = this.selectedCedReviewers.filter(id => !existingCedIds.has(id));
          this.sendEmailToReviewers(dprId, newCedReviewers);
        } else {
          this.toastr.warning(res.message, 'Warning');
        }
      },
      error: () => this.toastr.error('Failed to assign reviewers.', 'Error'),
    });
  }

  onAvatarError(event: Event) {
    AvatarUtil.handleImageError(event);
  }

  // ── Reviewer multi-select helpers ────────────────────────────
  get filteredEmployeeList(): any[] {
    const term = this.reviewerSearchTerm.toLowerCase().trim();
    // Exclude the appraisee and anyone already assigned in any reviewer group
    const allAssigned = new Set([
      this.empId,
      ...this.selectedReviewers,
      ...this.selectedCedReviewers,
      ...this.selectedHodReviewers,
    ]);
    return this.employeeList.filter(e => {
      const id   = e.empId || e.idValue || '';
      const name = (e.employeeName || e.description || '').toLowerCase();
      return !allAssigned.has(id) && (term === '' || name.includes(term));
    });
  }

  isReviewerSelected(empId: string): boolean {
    return this.selectedReviewers.includes(empId);
  }

  toggleReviewer(empId: string): void {
    if (!this.canEditFields) return;
    const idx = this.selectedReviewers.indexOf(empId);
    if (idx > -1) {
      this.selectedReviewers.splice(idx, 1);
    } else if (this.selectedReviewers.length < 3) {
      this.selectedReviewers.push(empId);
    }
  }

  removeReviewer(empId: string): void {
    this.selectedReviewers = this.selectedReviewers.filter(id => id !== empId);
  }

  getReviewerName(empId: string): string {
    const emp = this.employeeList.find(e => (e.empId || e.idValue) === empId);
    return emp ? (emp.employeeName || emp.description || empId) : empId;
  }

  toggleReviewerDropdown(): void {
    if (!this.canEditFields) return;
    this.reviewerDropdownOpen = !this.reviewerDropdownOpen;
    if (this.reviewerDropdownOpen) this.reviewerSearchTerm = '';
  }

  closeReviewerDropdown(): void {
    this.reviewerDropdownOpen = false;
  }

  // ── HOD Evaluation reviewer helpers ──────────────────────────
  get filteredHodReviewerList(): any[] {
    const term = this.hodReviewerSearchTerm.toLowerCase().trim();
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const currentEmpId = currentUser.empId || '';
    // Exclude the HOD themselves and anyone already assigned in any reviewer group
    const allAssigned = new Set([
      currentEmpId,
      this.empId,
      ...this.selectedHodReviewers,
      ...this.selectedReviewers,
      ...this.selectedCedReviewers,
    ]);
    return this.employeeList.filter(e => {
      const id   = e.empId || e.idValue || '';
      const name = (e.employeeName || e.description || '').toLowerCase();
      return !allAssigned.has(id) && (term === '' || name.includes(term));
    });
  }

  isHodReviewerSelected(empId: string): boolean {
    return this.selectedHodReviewers.includes(empId);
  }

  toggleHodReviewer(empId: string): void {
    if (!this.canEditHodEvaluation) return;
    const idx = this.selectedHodReviewers.indexOf(empId);
    if (idx > -1) {
      this.selectedHodReviewers.splice(idx, 1);
    } else if (this.selectedHodReviewers.length < 3) {
      this.selectedHodReviewers.push(empId);
    }
  }

  removeHodReviewer(empId: string): void {
    this.selectedHodReviewers = this.selectedHodReviewers.filter(id => id !== empId);
  }

  toggleHodReviewerDropdown(event: MouseEvent): void {
    if (!this.canEditHodEvaluation) return;
    this.hodReviewerDropdownOpen = !this.hodReviewerDropdownOpen;
    if (this.hodReviewerDropdownOpen) {
      this.hodReviewerSearchTerm = '';
    }
  }

  closeHodReviewerDropdown(): void {
    this.hodReviewerDropdownOpen = false;
  }

  // Self-appraisal reflection statements
  readonly selfAppraisalStatements = [
    { key: 'saQuality',       label: 'I consistently delivered work that met or exceeded the expected quality standard.',                    area: 'Quality & output' },
    { key: 'saTimeliness',    label: 'I met my deadlines and honoured commitments throughout the appraisal year.',                          area: 'Timeliness & reliability' },
    { key: 'saInitiative',    label: 'I took initiative and went beyond my core responsibilities without being asked.',                      area: 'Initiative & ownership' },
    { key: 'saCommunication', label: 'I communicated clearly and kept my manager and team informed on progress and issues.',                 area: 'Communication' },
    { key: 'saTeamwork',      label: 'I actively supported my teammates and contributed to a positive team environment.',                    area: 'Teamwork & collaboration' },
    { key: 'saProblemSolving',label: 'I identified problems early, analysed them effectively, and resolved them with minimal escalation.',   area: 'Problem solving' },
    { key: 'saAdaptability',  label: 'I adapted well to changes in priorities, processes, or team structure during the year.',               area: 'Adaptability' },
    { key: 'saLearning',      label: 'I actively pursued learning opportunities and applied new knowledge to my work.',                      area: 'Learning & growth' },
    { key: 'saGoalAlignment', label: 'My work was consistently aligned with the department\'s objectives and organisational goals.',         area: 'Goal alignment' },
    { key: 'saOverallSelf',   label: 'Overall, I am satisfied with my performance and contribution this appraisal year.',                   area: 'Overall self-assessment' },
  ];

  getSelfRating(key: string): number {
    return (this as any)[key] || 0;
  }

  setSelfRating(key: string, value: number): void {
    if (this.canEditFields) {
      (this as any)[key] = value;
    }
  }

  /**
   * Returns the statement label rewritten in third-person when a reviewer
   * is reading it about someone else.
   * e.g. "I consistently delivered..." → "Alex consistently delivered..."
   * The 10th statement (saOverallSelf) gets a completely different reviewer sentence.
   */
  getStatementLabel(label: string, forReviewer: boolean): string {
    if (!forReviewer) return label;
    const first = this.empName?.split(' ')[0] || 'They';

    // 10th statement — use a dedicated reviewer-specific sentence
    if (label.startsWith('Overall, I am satisfied')) {
      return `Overall performance and contributions made by ${first} during this appraisal year are appreciated and recognized.`;
    }

    return label
      // "Overall, I am" → "Overall, [Name] is"
      .replace(/^Overall, I am\b/, `Overall, ${first} is`)
      // Leading "My " → "Their "
      .replace(/^My\b/, 'Their')
      // Leading "I " → "[Name] "
      .replace(/^I\b/, first)
      // Mid-sentence " my " → " their "
      .replace(/\bmy\b/g, 'their')
      // Mid-sentence " I " → " they "  (e.g. "and I resolved")
      .replace(/\bI\b/g, 'they');
  }

  get selfAppraisalAnsweredCount(): number {
    return this.selfAppraisalStatements.filter(s => this.getSelfRating(s.key) > 0).length;
  }

  get selfAppraisalTotal(): number {
    return this.selfAppraisalStatements.reduce((sum, s) => sum + this.getSelfRating(s.key), 0);
  }

  // ── Reviewer Assessment helpers ──────────────────────────────
  // Maps the same statement keys to ra* fields
  private readonly raKeyMap: Record<string, string> = {
    saQuality:       'raQuality',
    saTimeliness:    'raTimeliness',
    saInitiative:    'raInitiative',
    saCommunication: 'raCommunication',
    saTeamwork:      'raTeamwork',
    saProblemSolving:'raProblemSolving',
    saAdaptability:  'raAdaptability',
    saLearning:      'raLearning',
    saGoalAlignment: 'raGoalAlignment',
    saOverallSelf:   'raOverallReview',
  };

  getRaRating(saKey: string): number {
    const raKey = this.raKeyMap[saKey];
    return raKey ? ((this as any)[raKey] || 0) : 0;
  }

  setRaRating(saKey: string, value: number): void {
    if (!this.canEditReviewerAssessment) return;
    const raKey = this.raKeyMap[saKey];
    if (raKey) (this as any)[raKey] = value;
  }

  get raAnsweredCount(): number {
    return this.selfAppraisalStatements.filter(s => this.getRaRating(s.key) > 0).length;
  }

  get raTotal(): number {
    return this.selfAppraisalStatements.reduce((sum, s) => sum + this.getRaRating(s.key), 0);
  }

  // ── Build reviewAssessmentList for DPR save payload ─────────
  // Strategy:
  //   1. Start with ALL existing entries from the backend (reviewAssessmentList).
  //      This ensures no other reviewer's data is ever dropped.
  //   2. If the logged-in user is a reviewer, update their entry in-place with
  //      current in-memory ratings (so unsaved edits are included).
  //   3. Add placeholder 'P' entries for any reviewer in selectedReviewers /
  //      selectedHodReviewers that has no backend record yet.
  buildReviewAssessmentList(): ReviewAssessment[] {
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const currentEmpId = currentUser.empId || '';

    // Deep-clone all existing backend entries so we never mutate the source array
    const list: ReviewAssessment[] = this.reviewAssessmentList.map(ra => ({ ...ra }));

    // Helper: find index in the working list by reviewerId
    const findIdx = (reviewerId: string): number =>
      list.findIndex((ra: any) => ra.reviewerId === reviewerId);

    // ── Step 1: merge current reviewer's in-memory ratings ──────
    if (this.isReviewer && currentEmpId) {
      const idx = findIdx(currentEmpId);
      const inMemory: ReviewAssessment = {
        reviewAssessmentId: this.myReviewAssessmentId || 0,
        dprId:              this.dprid || 0,
        reviewerId:         currentEmpId,
        userType:           this.myReviewerUserType || 'S',
        status:             this.myReviewAssessmentStatus || 'P',
        raQuality:          this.raQuality,
        raTimeliness:       this.raTimeliness,
        raInitiative:       this.raInitiative,
        raCommunication:    this.raCommunication,
        raTeamwork:         this.raTeamwork,
        raProblemSolving:   this.raProblemSolving,
        raAdaptability:     this.raAdaptability,
        raLearning:         this.raLearning,
        raGoalAlignment:    this.raGoalAlignment,
        raOverallReview:    this.raOverallReview,
        raTotal:            this.raTotal,
        raComments:         this.raComments,
      };
      if (idx > -1) {
        // Update existing entry — keep reviewAssessmentId from backend
        list[idx] = {
          ...list[idx],
          ...inMemory,
          reviewAssessmentId: list[idx].reviewAssessmentId || inMemory.reviewAssessmentId,
        };
      } else {
        // No backend record yet — add new entry
        list.push(inMemory);
      }
    }

    // ── Step 2: ensure placeholder entries exist for all assigned reviewers ──
    // (only adds if not already present — never overwrites existing data)
    for (const id of this.selectedReviewers) {
      if (findIdx(id) === -1) {
        list.push({
          reviewAssessmentId: 0,
          dprId:     this.dprid || 0,
          reviewerId: id,
          userType:  'S',
          status:    'P',
        });
      }
    }

    for (const id of this.selectedCedReviewers) {
      if (findIdx(id) === -1) {
        list.push({
          reviewAssessmentId: 0,
          dprId:     this.dprid || 0,
          reviewerId: id,
          userType:  'C',
          status:    'P',
        });
      }
    }

    for (const id of this.selectedHodReviewers) {
      if (findIdx(id) === -1) {
        list.push({
          reviewAssessmentId: 0,
          dprId:     this.dprid || 0,
          reviewerId: id,
          userType:  'H',
          status:    'P',
        });
      }
    }
    return list;
  }

  // ── Single source of truth for the DPR save payload ────────
  // Every save path (employee, HOD, reviewer, CED) calls this.
  // overrideStatus: pass a specific status to use instead of this.ApprovalStatus
  //                 (e.g. reviewer submitting uses this.currentStatus, not 'S')
  private buildFullPayload(overrideStatus?: string): DPRReview {
    const { month } = this.parseMonthYear();
    const year = new Date().getFullYear() - 1;

    // Always recalculate before building the payload so scoreOverall is up-to-date.
    // This covers both HOD submission and reviewer assessment submission paths.
    this.calculateOverallRating();
    return {
      employeeId:           this.empId,
      month,
      year,
      dprid:                this.dprid || 0,
      formType:             'A',
      status:               overrideStatus ?? this.ApprovalStatus ?? this.currentStatus,
      hodId:                this.reportingTo || '',
      appraisalPeriod:      this.appraisalPeriod || '',
      workedHours:          Number(this.WorkedHours),
      totalEstimatedhours:  Number(this.TotalEstimatedhours),
      // Work summary
      keyResponsibilities:  this.keyResponsibilities,
      deliverablesOutcomes: this.deliverablesOutcomes,
      // Self-appraisal
      saQuality:            this.saQuality,
      saTimeliness:         this.saTimeliness,
      saInitiative:         this.saInitiative,
      saCommunication:      this.saCommunication,
      saTeamwork:           this.saTeamwork,
      saProblemSolving:     this.saProblemSolving,
      saAdaptability:       this.saAdaptability,
      saLearning:           this.saLearning,
      saGoalAlignment:      this.saGoalAlignment,
      saOverallSelf:        this.saOverallSelf,
      saTotal:              this.selfAppraisalTotal,
      saComments:           this.saComments,
      // Achievements
      achievements:         this.annualAchievements || '',
      challenges:           this.annualChallenges   || '',
      supportNeeded:        this.supportNeeded       || '',
      annualAchievements:   this.annualAchievements,
      annualChallenges:     this.annualChallenges,
      // Training
      trainingCompleted:    this.trainingCompleted,
      skillsDeveloped:      this.skillsDeveloped,
      trainingNeeded:       this.trainingNeeded,
      // Career goals
      careerGoals:          this.careerGoals,
      supportNeededAnnual:  this.supportNeededAnnual,
      // HOD evaluation
      scoreQuality:         Number(this.quality)       || undefined,
      scoreTimeliness:      Number(this.timeliness)    || undefined,
      scoreInitiative:      Number(this.initiative)    || undefined,
      scoreProblemSolving:  Number(this.problemSolving)|| undefined,
      scoreTeamWork:        Number(this.teamWork)      || undefined,
      scoreCommunication:   Number(this.communication) || undefined,
      hodrating:            Number(this.hodRating)     || undefined,
      scoreOverall:         Number(this.overallScore)  || undefined,
      overallValue:         this.overallScore > 0 ? this.getRatingText(this.overallScore) : undefined,
      hodRecommendation:    this.hodRecommendation     || undefined,
      hodRemarks:           this.hodRemarks            || undefined,
      // Reviewer IDs
      reviewer1Id:          this.selectedReviewers[0]    || undefined,
      reviewer2Id:          this.selectedReviewers[1]    || undefined,
      reviewer3Id:          this.selectedReviewers[2]    || undefined,
      hodReviewer1Id:       this.selectedHodReviewers[0] || undefined,
      hodReviewer2Id:       this.selectedHodReviewers[1] || undefined,
      hodReviewer3Id:       this.selectedHodReviewers[2] || undefined,
      // Full review assessment list — always all entries, never partial
      reviewAssessmentList: this.buildReviewAssessmentList(),
      // Tasks & KPIs
      tasksList: this.tasks.map(t => ({
        taskName:      t.taskName,
        description:   t.description,
        actualHours:   Number(t.actualHours),
      })),
      kpiList: this.kpis.map(t => ({
        kpiId:       Number(t.kpiId),
        dprId:       Number(this.dprid),
        employeeId:  t.employeeId,
        kpiMasterId: t.kpiMasterId,
        kpiValue:    Number(t.kpiValue),
        remarks:     t.remarks,
        description: t.description,
      })),
    };
  }

  submitReviewerAssessment(): void {
    if (!this.isReviewer) return;
    if (this.raAnsweredCount < this.selfAppraisalStatements.length) {
      this.toastr.warning(
        `Please rate all ${this.selfAppraisalStatements.length} statements before submitting. (${this.raAnsweredCount} of ${this.selfAppraisalStatements.length} answered)`,
        'Incomplete Assessment'
      );
      return;
    }
    this.checkAppraisalAccess('APPROVAL').then(allowed => {
      if (!allowed) return;
      this._doSaveReviewerAssessment('S');
    });
  }

  private _doSaveReviewerAssessment(assessmentStatus: string): void {
    if (!this.isReviewer) return;
    if (this.raAnsweredCount < this.selfAppraisalStatements.length) {
      this.toastr.warning(
        `Please rate all ${this.selfAppraisalStatements.length} statements before saving. (${this.raAnsweredCount} of ${this.selfAppraisalStatements.length} answered)`,
        'Incomplete Assessment'
      );
      return;
    }

    // Stamp the reviewer's status in-memory so buildReviewAssessmentList picks it up
    this.myReviewAssessmentStatus = assessmentStatus;

    // Also update the reviewer's entry in reviewAssessmentList in-memory NOW,
    // so calculateOverallRating() inside buildFullPayload sees the correct status
    // and raTotal before the payload is built and sent to the API.
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const currentEmpId = currentUser.empId || '';
    const preIdx = this.reviewAssessmentList.findIndex((ra: any) => ra.reviewerId === currentEmpId);
    const preEntry = {
      reviewAssessmentId: this.myReviewAssessmentId || 0,
      dprId:              this.dprid,
      reviewerId:         currentEmpId,
      userType:           this.myReviewerUserType,
      status:             assessmentStatus,
      raQuality:          this.raQuality,
      raTimeliness:       this.raTimeliness,
      raInitiative:       this.raInitiative,
      raCommunication:    this.raCommunication,
      raTeamwork:         this.raTeamwork,
      raProblemSolving:   this.raProblemSolving,
      raAdaptability:     this.raAdaptability,
      raLearning:         this.raLearning,
      raGoalAlignment:    this.raGoalAlignment,
      raOverallReview:    this.raOverallReview,
      raTotal:            this.raTotal,
      raComments:         this.raComments,
    };
    if (preIdx > -1) {
      this.reviewAssessmentList[preIdx] = preEntry;
    } else {
      this.reviewAssessmentList.push(preEntry);
    }

    // Use the single full payload builder — preserves all fields and all other reviewers.
    // calculateOverallRating() is called inside buildFullPayload so scoreOverall is fresh.
    const review = this.buildFullPayload(this.currentStatus);

    const isSubmit = assessmentStatus === 'P';
    Swal.fire({
      title: isSubmit ? 'Submit Assessment?' : 'Save Assessment?',
      text:  isSubmit
        ? 'Once submitted, you will not be able to edit your assessment. Proceed?'
        : 'Save your reviewer assessment?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: isSubmit ? 'Yes, Submit!' : 'Yes, Save it!',
      cancelButtonText: 'Cancel',
    }).then(result => {
      if (result.isConfirmed) {
        this.api.insertDpr(review).subscribe({
          next: (res: any) => {
            if (res.success) {
              this.toastr.success(
                isSubmit ? 'Reviewer assessment submitted successfully.' : 'Reviewer assessment saved.',
                isSubmit ? 'Submitted' : 'Saved'
              );
              // Update reviewAssessmentId from API response if returned
              if (res.data?.reviewAssessmentId) {
                this.myReviewAssessmentId = res.data.reviewAssessmentId;
                // Patch the id into the already-updated list entry
                const savedIdx = this.reviewAssessmentList.findIndex(
                  (ra: any) => ra.reviewerId === currentEmpId
                );
                if (savedIdx > -1) {
                  this.reviewAssessmentList[savedIdx].reviewAssessmentId = this.myReviewAssessmentId;
                }
              }

              // Recalculate overall score to keep UI in sync (scoreOverall already sent to DB)
              this.calculateOverallRating();

              if (isSubmit) {
                setTimeout(() => { this.router.navigate(['/apr-past-reports']); }, 1500);
              }
            } else {
              // Revert status on failure — restore the pre-entry status to 'P'
              this.myReviewAssessmentStatus = 'P';
              const revertIdx = this.reviewAssessmentList.findIndex(
                (ra: any) => ra.reviewerId === currentEmpId
              );
              if (revertIdx > -1) {
                this.reviewAssessmentList[revertIdx].status = 'P';
              }
              this.calculateOverallRating();
              this.toastr.warning(res.message, 'Warning');
            }
          },
          error: () => {
            this.myReviewAssessmentStatus = 'P';
            const revertIdx = this.reviewAssessmentList.findIndex(
              (ra: any) => ra.reviewerId === currentEmpId
            );
            if (revertIdx > -1) {
              this.reviewAssessmentList[revertIdx].status = 'P';
            }
            this.calculateOverallRating();
            this.toastr.error('Failed to save reviewer assessment.', 'Error');
          },
        });
      } else {
        // User cancelled — revert status
        this.myReviewAssessmentStatus = 'P';
        const revertIdx = this.reviewAssessmentList.findIndex(
          (ra: any) => ra.reviewerId === currentEmpId
        );
        if (revertIdx > -1) {
          this.reviewAssessmentList[revertIdx].status = 'P';
        }
        this.calculateOverallRating();
      }    });
  }

  addNewTask() {
    // Calculate current total actual hours
    const totalActualHours = this.tasks.reduce(
      (sum, task) => sum + (Number(task.actualHours) || 0),
      0
    );

    // Check if worked hours is set
    if (!this.WorkedHours || this.WorkedHours === 0) {
      this.toastr.warning('Please set Worked Hours before adding tasks.', 'Validation Failed');
      return;
    }

    // Check if total hours have reached or exceeded 100% of worked hours
    if (totalActualHours >= this.WorkedHours) {
      const percentage = Math.round((totalActualHours / this.WorkedHours) * 100);
      this.toastr.warning(
        `You have already allocated ${percentage}% (${totalActualHours}/${this.WorkedHours} hours) of your worked hours. Cannot add more tasks.`,
        'Hours Limit Reached'
      );
      return;
    }

    // Validate existing hours before adding new task
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

    // Show remaining hours info
    const remainingHours = this.WorkedHours - totalActualHours;
    this.toastr.info(
      `You have ${remainingHours} hours remaining out of ${this.WorkedHours} worked hours.`,
      'Task Added'
    );

    // Recalculate overall rating when task is added
    this.calculateOverallRating();

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
          this.calculateOverallRating(); // Recalculate overall rating after deletion
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

  HODReviewUpdate() {

    if (this.ApprovalStatus == "R") {
      this.ConfirmationMessage = 'Do you want to ReWork the review details?';
      this.ConfirmationMessageOnSubmit = 'Yes, ReWork it!';
    }
    else {
      this.ConfirmationMessage = 'Do you want to approve the review details?';
      this.ConfirmationMessageOnSubmit = 'Yes, Approve it!';
    }


    Swal.fire({
      title: 'Are you sure?',
      text: this.ConfirmationMessage,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.ConfirmationMessageOnSubmit,
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
          scoreProblemSolving: Number(this.problemSolving),
          scoreTeamWork: Number(this.teamWork),
          scoreCommunication: Number(this.communication),
          hodrating: Number(this.hodRating),
          scoreOverall: Number(this.overallScore),
          remarks: this.managementRemarks,
          hodRecommendation: this.hodRecommendation,
          hodRemarks: this.hodRemarks,
          dprid: this.dprid,
          overallValue: this.getRatingText(this.overallScore),
        };

        console.log("DPR Log" + review);

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

              // Navigate to APR past reports page after successful approval/pushback
              setTimeout(() => {
                this.router.navigate(['/apr-past-reports']);
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

    if (this.ApprovalStatus === 'S' || this.ApprovalStatus === 'P') {
      this.ConfirmationMessage = 'Do you want to submit the appraisal?';
      this.ConfirmationMessageOnSubmit = 'Yes, Submit it!';

      // RM submit validation — must have selected exactly 3 evaluation reviewers
      // Applies to any user who is the RM (HOD or CED acting as RM)
      if (this.ApprovalStatus === 'S' && (this.isHodTheReportingManager || this.isCedActingAsHod)) {
        if (this.selectedHodReviewers.length < 3) {
          this.toastr.warning('Please select exactly 3 Evaluation Reviewers before submitting.', 'Validation Failed');
          return;
        }
      }

      // APR Submit validations — only for employee/own submission (P), not HOD (S) or CED-as-HOD (S)
      if (this.ApprovalStatus === 'P' && !this.isCedActingAsHod) {
        if (!this.reportingTo) {
          this.toastr.warning('Please select a Reporting Manager before submitting.', 'Validation Failed');
          return;
        }

        if (!this.keyResponsibilities || this.keyResponsibilities.trim() === '') {
          this.toastr.warning('Please fill in Key Responsibilities in the Work Summary section.', 'Validation Failed');
          return;
        }

        if (!this.deliverablesOutcomes || this.deliverablesOutcomes.trim() === '') {
          this.toastr.warning('Please fill in Deliverables & Outcomes in the Work Summary section.', 'Validation Failed');
          return;
        }

        const answeredCount = this.selfAppraisalAnsweredCount;
        if (answeredCount < this.selfAppraisalStatements.length) {
          this.toastr.warning(
            `Please complete all ${this.selfAppraisalStatements.length} self-appraisal statements. (${answeredCount} of ${this.selfAppraisalStatements.length} answered)`,
            'Validation Failed'
          );
          return;
        }

        if (!this.annualAchievements || this.annualAchievements.trim() === '') {
          this.toastr.warning('Please fill in Key Achievements & Highlights in the Achievements section.', 'Validation Failed');
          return;
        }

        if (!this.annualChallenges || this.annualChallenges.trim() === '') {
          this.toastr.warning('Please fill in Challenges Faced in the Achievements section.', 'Validation Failed');
          return;
        }

        if (!this.skillsDeveloped || this.skillsDeveloped.trim() === '') {
          this.toastr.warning('Please fill in Skills Developed in the Training & Development section.', 'Validation Failed');
          return;
        }

        if (this.selectedReviewers.length < 3) {
          this.toastr.warning('Please select exactly 3 Self-Appraisal Reviewers before submitting.', 'Validation Failed');
          return;
        }
      }

    } else if (this.ApprovalStatus === 'A') {
      this.ConfirmationMessage = 'Do you want to approve this appraisal?';
      this.ConfirmationMessageOnSubmit = 'Yes, Approve it!';

    } else if (this.ApprovalStatus === 'R') {
      this.ConfirmationMessage = 'Do you want to send this appraisal back for rework?';
      this.ConfirmationMessageOnSubmit = 'Yes, Send for Rework!';

    } else {
      this.ConfirmationMessage = 'Do you want to save the review details?';
      this.ConfirmationMessageOnSubmit = 'Yes, Save it!';
    }


    // For APR: year saved = previous year (the year being appraised)
    // e.g. submitting in 2026 → saves year = 2025
    const review = this.buildFullPayload();

    Swal.fire({
      title: 'Are you sure?',
      text: this.ConfirmationMessage,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.ConfirmationMessageOnSubmit,
      cancelButtonText: 'No, cancel!',
    }).then((result) => {

      if (result.isConfirmed) {

        // Snapshot reviewer IDs already in the backend before this save
        // so we can detect newly added ones after success
        const existingReviewerIds = new Set(
          (this.reviewAssessmentList || [])
            .filter((ra: any) => ra.reviewAssessmentId > 0 && ra.reviewerId)
            .map((ra: any) => ra.reviewerId as string)
        );

        this.api.insertDpr(review).subscribe({
          next: (res) => {

            if (res.success) {

              this.toastr.success(res.message, 'Success');

              if ((this.ApprovalStatus === 'S' || this.ApprovalStatus === 'P') && res.success) {
                const dprId = res.data || this.dprid;
                try {
                  this.sendNotificationToHOD(dprId);
                  this.sendNotificationToEmployee(dprId, true);

                  // Send emails to newly added reviewers (all three groups)
                  const allNewReviewers = [
                    ...this.selectedReviewers,
                    ...this.selectedCedReviewers,
                    ...this.selectedHodReviewers,
                  ].filter(id => !existingReviewerIds.has(id));
                  this.sendEmailToReviewers(dprId, allNewReviewers);
                } catch (error) {
                  console.error('Error sending notifications:', error);
                }
                setTimeout(() => { this.router.navigate(['/apr-past-reports']); }, 1500);

              } else if ((this.ApprovalStatus === 'A' || this.ApprovalStatus === 'R') && res.success) {
                const dprId = res.data || this.dprid;
                try {
                  this.sendNotificationToEmployee(dprId, false);
                } catch (error) {
                  console.error('Error sending notification:', error);
                }
                setTimeout(() => { this.router.navigate(['/apr-past-reports']); }, 1500);

              } else if (this.ApprovalStatus === 'D' && res.success) {
                setTimeout(() => { this.router.navigate(['/apr-past-reports']); }, 1500);
              }

            }
            else {
              this.toastr.warning(res.message, 'Warning');
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

    this.getUserProofhubTasks();


    this.Proofhubtasks.forEach((task) => {
      task.selected = false;
    });


  }

  getUserProofhubTasks() {
    const email = this.EmailID || '';
    const today = new Date();

    const prevMonth = today.getMonth() - 1;
    const prevYear = prevMonth < 0 ? today.getFullYear() - 1 : today.getFullYear();
    const monthIndex = prevMonth < 0 ? 11 : prevMonth;
    const startDate = new Date(prevYear, monthIndex, 1);
    const endDate = new Date(prevYear, monthIndex + 1, 0);

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

        this.WorkedHours = Math.round(this.Proofhubtasks.reduce(
          (sum, task) => sum + (Number(task.LOGGED_HOURS) || 0), 0));

        this.TotalEstimatedhours = Math.round(this.Proofhubtasks.reduce(
          (sum, task) => sum + (Number(task.ESTIMATED_HOURS) || 0), 0));


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

    // Financial year: Jan–Dec of the previous year
    // e.g. submitting in 2026 → appraisal period = Jan 2025 – Dec 2025
    const currentYear = new Date().getFullYear();
    this.appraisalPeriod = this.computeAppraisalPeriod(currentYear - 1);    this.updateHeaderTitle();
  }

  /** Returns "Jan YYYY – Dec YYYY" — the calendar/financial year */
  private computeAppraisalPeriod(year: number): string {
    return `Jan ${year} – Dec ${year}`;
  }

  // Helper method to update the header title
  private updateHeaderTitle(): void {
    if (this.monthYear) {
      // Show appraisalPeriod in the layout header if available, else fall back to monthYear
      const titleValue = this.appraisalPeriod || this.monthYear;
      sessionStorage.setItem('currentAPRMonthYear', titleValue);
      window.dispatchEvent(new CustomEvent('aprMonthYearUpdated', { detail: titleValue }));
    }
  }



  loadKPIs(resetKpis: boolean = true): void {
    console.log('Loading KPIs for department:', this.department, 'resetKpis:', resetKpis);
    this.api.GetActiveKPIs(this.department).subscribe(
      (response: any) => {
        if (response && response.success && response.data) {
          console.log('Loaded KPIs:', response.data);

          this.availableKPIs = response.data;

          // Only reset kpis array if explicitly requested (for new DPR creation)
          // When loading existing DPR, we don't want to reset as DPR data will populate it
          if (resetKpis) {
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
        } else {
          this.availableKPIs = [];
          if (resetKpis) {
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
        }
      },
      (error) => {
        console.error('Error loading KPIs:', error);
      }
    );
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

          // Load profile using the employee from this DPR record (not the logged-in user)
          if (this.empId) {
            this.loadEmployeeProfile(this.empId);
          }
          this.department = dpr.department || '';
          this.EmailID = dpr.emailid || '';


          this.WorkedHours = dpr.workedHours ?? 0;
          this.achievements = dpr.achievements ?? '';
          this.challenges = dpr.challenges ?? '';
          this.supportNeeded = dpr.supportNeeded ?? '';
          this.quality = dpr.scoreQuality ?? 0;
          this.timeliness = dpr.scoreTimeliness ?? 0;
          this.initiative = dpr.scoreInitiative ?? 0;
          this.problemSolving = dpr.scoreProblemSolving ?? 0;
          this.teamWork = dpr.scoreTeamWork ?? 0;
          this.communication = dpr.scoreCommunication ?? 0;
          this.hodRating = dpr.hodrating ?? 0; // HOD's manual rating (1-5)
          this.overallScore = dpr.scoreOverall ?? 0; // System-generated final score (20-100)
          this.attendanceScore = dpr.attendanceScore ?? 0; // Attendance score (1–100), 10% weight
          this.reportingTo = dpr.hodId ?? '';
          this.currentStatus = dpr.status ?? 'D'; // Set current status from API response
          this.tasks = dpr.tasksList?.length ? dpr.tasksList : [];
          this.TotalEstimatedhours = dpr.totalEstimatedhours ?? 0;
          // HOD evaluation
          this.hodRecommendation = (dpr.hodRecommendation as any) ?? '';
          this.hodRemarks        = dpr.hodRemarks ?? '';

          // Load reviewAssessmentList first — it is the source of truth
          this.reviewAssessmentList = dpr.reviewAssessmentList || [];

          // Populate reviewer dropdowns from reviewAssessmentList.
          // userType may be 'S' (employee-chosen), 'H' (HOD-chosen), 'C' (CED-assigned),
          // or 'R' (legacy — saved by reviewer before userType was tracked).
          // Treat 'S' and 'R' as employee-chosen; 'C' as CED-assigned; 'H' as HOD evaluation.
          const raListS = this.reviewAssessmentList
            .filter((ra: any) => (ra.userType === 'S' || ra.userType === 'R') && ra.reviewerId)
            .map((ra: any) => ra.reviewerId as string);

          const raListC = this.reviewAssessmentList
            .filter((ra: any) => ra.userType === 'C' && ra.reviewerId)
            .map((ra: any) => ra.reviewerId as string);

          const raListH = this.reviewAssessmentList
            .filter((ra: any) => ra.userType === 'H' && ra.reviewerId)
            .map((ra: any) => ra.reviewerId as string);

          this.selectedReviewers = raListS.length > 0
            ? raListS
            : [dpr.reviewer1Id, dpr.reviewer2Id, dpr.reviewer3Id]
                .filter((id): id is string => !!id);

          this.selectedCedReviewers = raListC;

          this.selectedHodReviewers = raListH.length > 0
            ? raListH
            : [dpr.hodReviewer1Id, dpr.hodReviewer2Id, dpr.hodReviewer3Id]
                .filter((id): id is string => !!id);

          // Detect if logged-in user is a reviewer (self-appraisal, CED-assigned, or HOD evaluation list)
          const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
          const currentEmpId = currentUser.empId || '';
          const isInSelfList = this.selectedReviewers.includes(currentEmpId);
          const isInCedList  = this.selectedCedReviewers.includes(currentEmpId);
          const isInHodList  = this.selectedHodReviewers.includes(currentEmpId);
          this.isReviewer = isInSelfList || isInCedList || isInHodList;
          // Determine reviewer type — priority: H > C > S
          if (isInHodList && !isInSelfList && !isInCedList) {
            this.myReviewerUserType = 'H';
          } else if (isInCedList && !isInSelfList) {
            this.myReviewerUserType = 'C';
          } else {
            this.myReviewerUserType = 'S';
          }

          if (this.isReviewer) {
            // Auto-switch to reviewer tab so they land on their assessment
            this.activeAppraisalTab = 'reviewer';
            // Find by reviewerId only — userType may vary depending on how it was saved
            const myAssessment = this.reviewAssessmentList.find(
              (ra: any) => ra.reviewerId === currentEmpId
            );
            if (myAssessment) {
              this.myReviewAssessmentId     = myAssessment.reviewAssessmentId || 0;
              this.myReviewAssessmentStatus = myAssessment.status || 'P';
              this.raQuality        = myAssessment.raQuality        ?? 0;
              this.raTimeliness     = myAssessment.raTimeliness     ?? 0;
              this.raInitiative     = myAssessment.raInitiative     ?? 0;
              this.raCommunication  = myAssessment.raCommunication  ?? 0;
              this.raTeamwork       = myAssessment.raTeamwork       ?? 0;
              this.raProblemSolving = myAssessment.raProblemSolving ?? 0;
              this.raAdaptability   = myAssessment.raAdaptability   ?? 0;
              this.raLearning       = myAssessment.raLearning       ?? 0;
              this.raGoalAlignment  = myAssessment.raGoalAlignment  ?? 0;
              this.raOverallReview  = myAssessment.raOverallReview  ?? 0;
              this.raComments       = myAssessment.raComments       ?? '';
            } else {
              // No existing assessment record — reviewer hasn't started yet
              this.myReviewAssessmentStatus = 'P';
            }
          }
          // Self-appraisal (sa* matches C# field names)
          this.saQuality        = dpr.saQuality ?? 0;
          this.saTimeliness     = dpr.saTimeliness ?? 0;
          this.saInitiative     = dpr.saInitiative ?? 0;
          this.saCommunication  = dpr.saCommunication ?? 0;
          this.saTeamwork       = dpr.saTeamwork ?? 0;
          this.saProblemSolving = dpr.saProblemSolving ?? 0;
          this.saAdaptability   = dpr.saAdaptability ?? 0;
          this.saLearning       = dpr.saLearning ?? 0;
          this.saGoalAlignment  = dpr.saGoalAlignment ?? 0;
          this.saOverallSelf    = dpr.saOverallSelf ?? 0;
          this.saComments       = dpr.saComments ?? '';
          // Work summary
          this.keyResponsibilities  = dpr.keyResponsibilities ?? '';
          this.deliverablesOutcomes = dpr.deliverablesOutcomes ?? '';
          // Annual achievements — fallback to achievements/challenges if annualAchievements is null
          this.annualAchievements = dpr.annualAchievements ?? dpr.achievements ?? '';
          this.annualChallenges   = dpr.annualChallenges   ?? dpr.challenges   ?? '';
          // Training
          this.trainingCompleted = dpr.trainingCompleted ?? '';
          this.skillsDeveloped   = dpr.skillsDeveloped ?? '';
          this.trainingNeeded    = dpr.trainingNeeded ?? '';
          // Career goals
          this.careerGoals         = dpr.careerGoals ?? '';
          this.supportNeededAnnual = dpr.supportNeededAnnual ?? '';

          // Load KPIs with the correct department from DPR data
          // Pass false to not reset kpis array - it will be populated from dpr.kpiList below
          this.loadKPIs(false);

          // Set monthYear from DPR data if available
          if (dpr.month && dpr.year) {
            const monthNames = [
              'January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December'
            ];
            this.monthYear = `${monthNames[dpr.month - 1]} ${dpr.year}`;
            // Use stored appraisalPeriod from API if available, else compute from year
            this.appraisalPeriod = dpr.appraisalPeriod || this.computeAppraisalPeriod(dpr.year - 1);

            // Update header immediately
            this.updateHeaderTitle();
          }

          // Check if HOD is viewing their own DPR
          const hodCheckUser = JSON.parse(localStorage.getItem('current_user') || '{}');
          const currentUserId = hodCheckUser.empId || '';
          this.isHodViewingOwnDpr = this.isHod && (currentUserId === this.empId);

          // Handle KPI data - if no existing data, initialize with one empty row
          if (dpr.kpiList?.length) {
            this.kpis = dpr.kpiList;
            console.log('Loaded KPIs from DPR:', this.kpis);
          } else {
            console.log('No KPIs in DPR, initializing empty row');
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

          // Store timesheet accuracy report (first entry) — CED only
          const tsReports = (dpr as any).timesheetAccuracyReports;
          this.timesheetAccuracyReport = (tsReports && tsReports.length > 0) ? tsReports[0] : null;

          // Store proofhub accuracy report (first entry) — CED only
          const phReports = (dpr as any).proofhubAccuracyReports;
          this.proofhubAccuracyReport = (phReports && phReports.length > 0) ? phReports[0] : null;

          // Calculate overall rating after loading all data
          this.calculateOverallRating();

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


  // Parse accuracy percentage string like "70.8%" → 70.8
  getPhAccuracyNum(): number {
    const raw = this.proofhubAccuracyReport?.accuracyPct || '0%';
    return parseFloat(raw.replace('%', '')) || 0;
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

    this.hoursExceeded = totalActualHours > this.WorkedHours;

    if (this.hoursExceeded) {
      const exceededBy = totalActualHours - this.WorkedHours;
      const percentage = Math.round((totalActualHours / this.WorkedHours) * 100);
      this.toastr.warning(
        `Total actual hours (${totalActualHours}) exceed worked hours (${this.WorkedHours}) by ${exceededBy} hours (${percentage}%). Please adjust task hours.`,
        'Hours Exceeded'
      );
    }

    // Recalculate overall rating when hours change
    this.calculateOverallRating();
  }

  // Helper method to get total actual hours
  getTotalActualHours(): number {
    return this.tasks.reduce(
      (sum, task) => sum + (Number(task.actualHours) || 0),
      0
    );
  }

  // Helper method to get remaining hours
  getRemainingHours(): number {
    const totalActualHours = this.getTotalActualHours();
    return Math.max(0, this.WorkedHours - totalActualHours);
  }

  // Helper method to get hours utilization percentage
  getHoursUtilizationPercentage(): number {
    if (!this.WorkedHours || this.WorkedHours === 0) return 0;
    const totalActualHours = this.getTotalActualHours();
    return Math.round((totalActualHours / this.WorkedHours) * 100);
  }

  // Helper method to check if can add more tasks based on hours
  canAddMoreTasksBasedOnHours(): boolean {
    const totalActualHours = this.getTotalActualHours();
    return totalActualHours < this.WorkedHours;
  }

  // Helper method to get hours status class for styling
  getHoursStatusClass(): string {
    const percentage = this.getHoursUtilizationPercentage();
    if (percentage > 100) return 'hours-exceeded';
    if (percentage === 100) return 'hours-full';
    if (percentage >= 80) return 'hours-high';
    if (percentage >= 50) return 'hours-medium';
    return 'hours-low';
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
      title: `New APR Submitted by ${this.empName}`,
      message: `${this.empName} (${this.empId}) has submitted the Annual Performance Review for ${this.monthYear}. Click to review.`,
      link: `/apr/${dprId}?readonly=1`,
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
      title = 'APR Submitted Successfully';
      message = `Your Annual Performance Review for ${this.monthYear} has been submitted successfully. Click to view.`;
    } else if (this.ApprovalStatus === 'A') {
      title = 'APR Approved';
      message = `Your Annual Performance Review for ${this.monthYear} has been approved by ${currentUser.employeeName || 'HOD'}.`;
    } else if (this.ApprovalStatus === 'R') {
      title = 'APR Requires Revision';
      message = `Your APR for ${this.monthYear} has been pushed back by ${currentUser.employeeName || 'HOD'} for revision.`;
    }

    console.log('Employee notification details:', { targetUserId, title, message });

    const employeeNotification: Partial<Notification> = {
      userId: targetUserId,
      title: title,
      message: message,
      link: `/apr/${dprId}?readonly=1`,
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

  /**
   * Send both an in-app notification AND an email to each newly added reviewer.
   * newReviewerIds: empIds that were NOT in the backend list before this save.
   */
  private sendEmailToReviewers(dprId: number, newReviewerIds: string[]): void {
    if (!newReviewerIds.length) return;

    const baseUrl = this.getBaseUrl();
    const reviewLink = `${baseUrl}/AdrakMPRUI/apr/${dprId}?from=pending-review`;
    const reviewLinkRelative = `/apr/${dprId}?from=pending-review`;

    for (const reviewerId of newReviewerIds) {
      const emp = this.employeeList.find((e: any) => (e.empId || e.idValue) === reviewerId);
      const reviewerName = emp ? (emp.employeeName || emp.description || reviewerId) : reviewerId;

      // ── In-app notification ──────────────────────────────────
      const notification: Partial<Notification> = {
        userId:  reviewerId,
        title:   `APR Review Assigned — ${this.empName}`,
        message: `You have been selected as a reviewer for ${this.empName}'s Annual Performance Review (${this.appraisalPeriod || this.monthYear}). Please open the appraisal to submit your assessment.`,
        link:    reviewLinkRelative,
        isRead:  false,
      };

      this.api.createNotification(notification).subscribe({
        next:  () => this._sendReviewerEmail(dprId, reviewerId, reviewerName, '', reviewLink),
        error: () => this._sendReviewerEmail(dprId, reviewerId, reviewerName, '', reviewLink),
      });
    }
  }

  private _sendReviewerEmail(
    dprId: number,
    reviewerId: string,
    reviewerName: string,
    reviewerEmail: string,
    reviewLink: string
  ): void {
    const emailRequest: SendEmailRequest = {
      templateKey: 'APR_SUBMISSION_HOD',
      toEmail: reviewerId,             // empId — same pattern as sendEmailToEmployee
      placeholders: {
        '[EmployeeName]':          this.empName,
        '[EmployeeID]':            this.empId,
        '[ManagerName]':           reviewerName,
        '[AppraisalPeriod]':       this.appraisalPeriod || this.monthYear,
        '[ManagerEvaluationLink]': reviewLink,
        '[ManagerRemarks]':        '',
        '[AppraisalEditLink]':     reviewLink,
      }
    };

    this.api.SendEmail(emailRequest).subscribe({
      next:  (res) => {
        if (res.success) console.log(`Reviewer email sent to ${reviewerId}`);
        else console.error(`Reviewer email failed for ${reviewerId}:`, res);
      },
      error: (err) => console.error(`Failed to send reviewer email to ${reviewerId}:`, err),
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
    const evaluationFormLink = `${baseUrl}/AdrakMPRUI/apr/${dprId}?readonly=1`;

    // Get HOD email from idValue and name from description
    const hodEmail = hodInfo.idValue || ''; // idValue contains the email address
    const hodName = hodInfo.description || 'HOD'; // description contains the display name

    if (!hodEmail) {
      console.error('HOD email not available, skipping email send');
      return;
    }

    const emailRequest: SendEmailRequest = {
      templateKey: 'APR_SUBMISSION_HOD',
      toEmail: hodEmail,
      placeholders: { 
        '[EmployeeName]': this.empName,
        '[EmployeeID]': this.empId,
        '[ManagerName]': hodName,
        '[AppraisalPeriod]': this.monthYear,
        '[ManagerEvaluationLink]': evaluationFormLink,
        '[ManagerRemarks]': this.managementRemarks || '',
        '[AppraisalEditLink]': evaluationFormLink
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
    const evaluationFormLink = `${baseUrl}/AdrakMPRUI/apr/${dprId}?readonly=1`;
    const employeeDprEditLink = `${baseUrl}/AdrakMPRUI/apr/${dprId}`;

    let templateKey = '';
    if (isSubmission) {
      templateKey = 'APR_SUBMISSION_EMPLOYEE';
    } else if (this.ApprovalStatus === 'A') {
      templateKey = 'APR_APPROVED';
    } else if (this.ApprovalStatus === 'R') {
      templateKey = 'APR_PUSHBACK';
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
        '[ManagerName]': hodName,
        '[AppraisalPeriod]': this.monthYear,
        '[ManagerEvaluationLink]': evaluationFormLink,
        '[ManagerRemarks]': this.managementRemarks || '',
        '[AppraisalEditLink]': this.ApprovalStatus === 'R' ? employeeDprEditLink : evaluationFormLink
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


