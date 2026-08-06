import { Component, ViewChild, ElementRef } from '@angular/core';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { DPRReview, DPRComment } from '../models/task.model';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { Api } from '../services/api';
import Swal from 'sweetalert2';
import { ToastrService } from 'ngx-toastr';
import { DropdownOption, Notification, SendEmailRequest } from '../models/common.model';
import { ActivatedRoute, Router } from '@angular/router';
import { AvatarUtil } from '../utils/avatar.util';
import { CraneLoaderComponent } from '../shared/crane-loader/crane-loader.component';



@Component({
  selector: 'app-monthly-dpr',
  standalone: true,
  imports: [FormsModule, CommonModule, CraneLoaderComponent],
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
    trigger('pulseAnimation', [
      transition('* => *', [
        animate('0.6s ease-in-out', style({ transform: 'scale(1.05)' })),
        animate('0.6s ease-in-out', style({ transform: 'scale(1)' })),
      ]),
    ]),
    // Department-ranking collapse. Animating max-height rather than height so the
    // list can be any length without the closed value needing to be measured.
    trigger('rankExpand', [
      transition(':enter', [
        style({ maxHeight: '0px', opacity: 0, overflow: 'hidden' }),
        animate('0.32s cubic-bezier(.25,.8,.25,1)',
                style({ maxHeight: '1400px', opacity: 1 })),
      ]),
      transition(':leave', [
        style({ overflow: 'hidden' }),
        animate('0.24s cubic-bezier(.4,0,.2,1)',
                style({ maxHeight: '0px', opacity: 0 })),
      ]),
    ]),
  ],
})
export class MonthlyDprComponent {
  monthYear = '';

  EmailID = '';

  
  
  showHodEvaluation = true;
  showManagementRemarks = true;
  showRemarksHistory = true;
  
  
  

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

  // ── Header profile (display only) ─────────────────────────────────────────
  // Loaded from Login/GetEmployeeProfile for whichever employee this review
  // belongs to — NOT the signed-in user. When an HOD opens a team member's MPR
  // the header has to show that member's photo and details.
  profileImage = AvatarUtil.DEFAULT_AVATAR;
  dateOfJoining = '';
  totalExperience = '';
  employeeEmail = '';
  employeePhone = '';
  employeeLocation = '';

  // ── Monthly work summary (replaces the old Task Details table) ─────────────
  // AI-drafted from that month's DPR entries, then freely editable. What is saved
  // is whatever the employee leaves in the box, not the AI's original.
  monthlyInsight = '';
  isGeneratingInsight = false;
  /** Provenance line shown under the box: how much real data backed the draft. */
  insightMeta: { entries: number; tasks: number; days: number; hours: number; period: string } | null = null;

  @ViewChild('summaryBox') summaryBox?: ElementRef<HTMLTextAreaElement>;

  /** Same floor the submit validation enforces, surfaced in the UI so the rule is
   *  visible while typing instead of only as a toast after pressing Submit. */
  readonly insightMinChars = 50;

  /** Set for ~1s after a fresh draft lands, to run the reveal animation. */
  insightRevealing = false;

  /**
   * True once Worked Hours has been filled from the AI's DPR total.
   *
   * Worked Hours has two possible sources and they must not fight:
   *   - ProofHub logged hours (async, fires during init)
   *   - the DPR total returned with the AI summary (user-triggered)
   * The DPR total is the authoritative one for this review, so once it lands the
   * ProofHub response must not overwrite it.
   */
  workedHoursFromAi = false;

  /** The employee chose "write it myself", so the empty-state overlay steps aside
   *  even though the box is still blank. */
  writingOwnSummary = false;

  get hasInsight(): boolean { return (this.monthlyInsight || '').trim().length > 0; }

  get insightChars(): number { return (this.monthlyInsight || '').length; }

  /**
   * The summary split into individual points.
   *
   * The AI now returns a bullet list ('- ' per line) rather than prose, so this
   * turns the stored text into renderable items. Tolerant on purpose: the field
   * stays freely editable, so a person may type plain lines with no marker, use
   * '*' or a bullet glyph, or leave blank lines between points. Anything on its
   * own line counts as a point and the leading marker is stripped for display.
   *
   * Reading order is preserved — the model is told to put the largest effort
   * first, and re-sorting here would throw that away.
   */
  get insightPoints(): string[] {
    return (this.monthlyInsight || '')
      .split(/\r?\n/)
      // The marker must be followed by whitespace. Without that requirement a line
      // like "-5 hours variance recorded" has its hyphen stripped and displays as
      // "5 hours variance" — a silently inverted number. Leaving an unstripped
      // marker on the rare "-Text" line is cosmetic; changing a figure is not.
      .map(l => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, '').trim())
      .filter(l => l.length > 0);
  }

  get insightPointCount(): number { return this.insightPoints.length; }

  /**
   * Keeps the list going while typing: Enter on a line that starts with '- '
   * inserts the next '- ' automatically. Without this, editing an AI list means
   * retyping the marker on every line and people simply stop bothering, which
   * leaves a half-list-half-prose field.
   *
   * Enter on an EMPTY bullet ends the list instead of adding another, matching
   * how every editor behaves.
   */
  onSummaryKeydown(ev: KeyboardEvent): void {
    if (ev.key !== 'Enter' || ev.shiftKey) return;

    const ta = ev.target as HTMLTextAreaElement;
    const pos = ta.selectionStart ?? 0;
    if (pos !== (ta.selectionEnd ?? 0)) return;      // a selection: leave it alone

    const lineStart = ta.value.lastIndexOf('\n', pos - 1) + 1;
    const line = ta.value.slice(lineStart, pos);
    const marker = line.match(/^(\s*[-*]\s)/);
    if (!marker) return;

    ev.preventDefault();

    if (line.trim() === marker[1].trim()) {
      // Empty bullet: delete just the marker and leave the caret on that now-blank
      // line. No '\n' is added here — slice(0, lineStart) already ends with the
      // newline that starts this line, so adding one produced an extra blank line
      // on every press.
      this.monthlyInsight = ta.value.slice(0, lineStart) + ta.value.slice(pos);
      setTimeout(() => ta.setSelectionRange(lineStart, lineStart), 0);
      return;
    }

    const insert = '\n' + marker[1];
    this.monthlyInsight = ta.value.slice(0, pos) + insert + ta.value.slice(pos);
    setTimeout(() => ta.setSelectionRange(pos + insert.length, pos + insert.length), 0);
  }

  get insightWords(): number {
    const t = (this.monthlyInsight || '').trim();
    return t ? t.split(/\s+/).length : 0;
  }

  /** 0-100, how close the text is to the minimum length. */
  get insightProgress(): number {
    const pct = (this.insightChars / this.insightMinChars) * 100;
    return pct > 100 ? 100 : Math.round(pct);
  }

  /** True while there IS text but not yet enough of it — the state the old UI gave
   *  no warning about until Submit was pressed. */
  get insightTooShort(): boolean {
    const n = (this.monthlyInsight || '').trim().length;
    return n > 0 && n < this.insightMinChars;
  }

  /** Overlay covers the box only when there is nothing to read and the employee has
   *  not asked to type. Read-only viewers see a different, non-actionable state —
   *  the old placeholder told them to "press the Generate button" when that button
   *  is inside @if (canEditFields) and therefore absent for them. */
  get showInsightEmptyState(): boolean {
    return !this.hasInsight && !this.isGeneratingInsight && !this.writingOwnSummary;
  }

  /** Dismiss the empty state and put the cursor in the box. */
  startWritingSummary(): void {
    if (!this.canEditFields) return;
    this.writingOwnSummary = true;
    setTimeout(() => this.summaryBox?.nativeElement?.focus(), 0);
  }

  /** Called when a fresh AI draft arrives — plays the reveal, then clears the flag
   *  so re-rendering later does not replay it. */
  playInsightReveal(): void {
    this.writingOwnSummary = false;
    this.insightRevealing = true;
    setTimeout(() => this.insightRevealing = false, 1100);
  }

  achievements = '';
  challenges = '';
  supportNeeded = '';

  quality = 0;
  timeliness = 0;
  initiative = 0;
  problemSolving = 0;
  teamWork = 0;
  communication = 0;
  hodRating = 0; // HOD's manual rating (1-5)
  overallScore = 0; // Final rating, entered by the HOD (1-100)
  dprid = 0;
  

  // Overall Rating System Properties
  hodEvaluationAverage = 0;
  productivityScore = 0;
  showOverallRating = false;

  // ── Department ranking panel (HOD Evaluation section) ─────────────────────
  // Fetched ONCE when the section opens, then re-ranked locally on every
  // keystroke by rankedList. Deliberately not a request per keystroke: typing
  // "85" would fire two, and a slow one landing after a fast one would show a
  // stale order — the same out-of-order failure we hit on the purchase dashboard.
  deptRanking: any[] = [];
  rankingLoading = false;
  rankingLoaded = false;

  /** HOD of the department can edit; CED can look but not touch. */
  get canViewDeptRanking(): boolean {
    if (this.isCed) return true;
    return this.isHod && !this.isHodViewingOwnDpr;
  }

  /**
   * The fetched list with THIS employee's provisional score slotted in, re-sorted.
   *
   * Pure getter, so it recomputes on every change-detection pass — that is what
   * makes the panel reorder live as the HOD types, with no API call and no
   * possibility of a stale response winning.
   */
  get rankedList(): any[] {
    const provisional = Number(this.overallScore) || 0;

    // Drop any stored row for this employee — the value being typed supersedes it.
    const others = (this.deptRanking || []).filter(r => r.empId !== this.empId);

    const combined = [
      ...others.map(r => ({
        empId: r.empId,
        employeeName: r.employeeName,
        designation: r.designation,
        score: Number(r.overallScore) || 0,
        // The four criteria as stored for that employee.
        ips:  Number(r.scoreInitiative) || 0,
        tc:   Number(r.scoreTeamWork)   || 0,
        qual: Number(r.scoreQuality)    || 0,
        time: Number(r.scoreTimeliness) || 0,
        image: r.profileImageBase64 || AvatarUtil.DEFAULT_AVATAR,
        isCurrent: false
      })),
      {
        empId: this.empId,
        employeeName: this.empName || 'This employee',
        designation: this.designation,
        score: provisional,
        // Live values for the row being edited, so the criteria move with the
        // inputs exactly as the overall score does.
        ips:  Number(this.initiative)  || 0,
        tc:   Number(this.teamWork)    || 0,
        qual: Number(this.quality)     || 0,
        time: Number(this.timeliness)  || 0,
        image: this.profileImage,
        isCurrent: true
      }
    ];

    combined.sort((a, b) =>
      b.score - a.score || (a.employeeName || '').localeCompare(b.employeeName || ''));

    return combined.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  /** Where the employee under review currently sits. */
  get currentRankPosition(): number {
    return this.rankedList.find(r => r.isCurrent)?.rank ?? 0;
  }

  get rankedTotal(): number {
    return this.rankedList.length;
  }

  /**
   * One fetch for the panel. Uses the review's own month/year so the comparison
   * is against the same period, and the signed-in HOD's id to resolve which
   * department(s) to include.
   */
  loadDeptRanking(): void {
    if (this.rankingLoaded || this.rankingLoading) return;
    if (!this.canViewDeptRanking) return;

    const user = JSON.parse(localStorage.getItem('current_user') || '{}');
    const hodId = user.empId || '';
    const { month, year } = this.getReviewMonthYear();

    if (!hodId || !month || !year) return;

    this.rankingLoading = true;
    this.api.getDeptMprRanking(hodId, month, year).subscribe({
      next: (res: any) => {
        this.deptRanking = (res?.success && Array.isArray(res.data)) ? res.data : [];
        this.rankingLoading = false;
        this.rankingLoaded = true;
      },
      error: (err: any) => {
        console.error('Error loading department MPR ranking:', err);
        this.deptRanking = [];
        this.rankingLoading = false;
        this.rankingLoaded = true;   // don't retry in a loop
      }
    });
  }

  /** Parse the review's month/year from the monthYear label the screen already holds. */
  private getReviewMonthYear(): { month: number; year: number } {
    const months = ['january','february','march','april','may','june',
                    'july','august','september','october','november','december'];
    const parts = (this.monthYear || '').trim().split(/[\s\-\/]+/);
    let month = 0, year = 0;
    for (const p of parts) {
      const idx = months.indexOf(p.toLowerCase());
      if (idx >= 0) month = idx + 1;
      else if (/^\d{4}$/.test(p)) year = Number(p);
    }
    return { month, year };
  }

  /**
   * Band class for every NEW MPR element (ranking rows, result card, band scale).
   *
   * Deliberately NOT getRatingClass(). That returns 'rating-average' etc., and the
   * global .rating-* rules near the top of this stylesheet carry
   * `background: linear-gradient(...)` AND `border: 3px solid ...` for the old
   * badge widget. Any new element given one of those class names inherited both —
   * which is why the score chip, the band heading and the progress bars all
   * rendered as near-black boxes: a 3px dark border on a 7px-tall bar is the bar.
   *
   * These own names collide with nothing, so the palette below is the only thing
   * painting them. Same thresholds as getRatingClass, which is untouched and still
   * used by every pre-existing widget (and by APR).
   */
  rankBandClass(score: number): string {
    const s = Number(score) || 0;
    if (s >= 90) return 'mpr-b-top';
    if (s >= 70) return 'mpr-b-good';
    if (s >= 50) return 'mpr-b-avg';
    if (s >= 30) return 'mpr-b-below';
    return 'mpr-b-poor';
  }

  /** Ranking panel collapse. Open by default; the HOD can fold it away once the
   *  department has enough approved reviews to make the list long. */
  rankOpen = true;
  toggleRanking(): void { this.rankOpen = !this.rankOpen; }

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

  // Table action buttons (Add/Delete for the Task Details table)
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

    // HOD should only see management remarks when coming from evaluation sources
    // Hide when coming directly from MPR Entry menu (no 'from' param or from='direct')
    if (this.isHod) {
      const isDirectEntry = !this.navigationSource || this.navigationSource === 'direct';
      return !isDirectEntry; // Show only when NOT direct entry
    }

    return false;
  }



  // Remarks History section visibility
  get showRemarksHistorySection(): boolean {
    // HOD should only see remarks history when coming from evaluation sources
    // Hide when coming directly from MPR Entry menu
    if (this.isHod) {
      const isDirectEntry = !this.navigationSource || this.navigationSource === 'direct';
      return !isDirectEntry && this.canViewRemarksHistory; // Show only when NOT direct entry
    }

    return this.canViewRemarksHistory;
  }

  hodList: DropdownOption[] = [];



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
    // Calculate individual evaluation scores (all values are out of 100)
    const qualityScore = this.quality || 0;
    const timelinessScore = this.timeliness || 0;
    const initiativeScore = this.initiative || 0;
    const problemSolvingScore = this.problemSolving || 0;
    const teamWorkScore = this.teamWork || 0;
    const communicationScore = this.communication || 0;
    const hodRatingValue = this.hodRating || 0;

    // Calculate HOD Evaluation Average for display purposes only
    const hodScores = [
      qualityScore,
      timelinessScore,
      initiativeScore,
      problemSolvingScore,
      teamWorkScore,
      communicationScore
    ].filter(score => score > 0);

    this.hodEvaluationAverage = hodScores.length > 0
      ? Math.round((hodScores.reduce((sum, score) => sum + score, 0) / hodScores.length) * 100) / 100
      : 0;

    // Calculate Productivity Score (out of 5)
    this.calculateProductivityScore();

    // overallScore is NO LONGER derived. The HOD types the final score directly,
    // so the old weighted formula (70% HOD rating + 5% x six criteria) is gone —
    // computing it here would immediately overwrite whatever they entered.
    //
    // The four criteria are still captured and still shown in the breakdown; they
    // just no longer feed the final number.
    //
    // hodEvaluationAverage above is display-only and unchanged.

    this.showOverallRating =
      this.hodEvaluationAverage > 0 || this.productivityScore > 0 || this.overallScore > 0;
  }

  // ── HOD Evaluation: combined criteria ─────────────────────────────────────
  // The screen now shows four inputs instead of six. Each combined input drives
  // TWO existing columns so nothing in the database or in SP_DPR_UPDATE_HODREVIEW
  // has to change — and the Annual Appraisal, which writes the same six columns
  // through the same procedure, is completely unaffected.
  //
  //   Initiative & Problem Solving -> scoreInitiative + scoreProblemSolving
  //   Teamwork & Communication    -> scoreTeamWork   + scoreCommunication
  //
  // Reopening an older review shows `initiative` / `teamWork` (one of each pair),
  // as agreed — the paired value is only rewritten if the HOD edits the field.

  /** Initiative & Problem Solving changed — mirror onto the problem-solving column. */
  onInitiativeProblemSolvingChange(): void {
    this.problemSolving = this.initiative;
    this.calculateOverallRating();
  }

  /** Teamwork & Communication changed — mirror onto the communication column. */
  onTeamworkCommunicationChange(): void {
    this.communication = this.teamWork;
    this.calculateOverallRating();
  }

  /**
   * Final score typed by the HOD.
   *
   * hodRating is kept in step with it because SP_DPR_UPDATE_HODREVIEW still takes
   * p_hodrating and the column is still read elsewhere; the separate HOD Rating
   * input has been removed from the screen.
   */
  onOverallScoreChange(): void {
    this.hodRating = this.overallScore;
    this.calculateOverallRating();
  }

  calculateProductivityScore(): void {
    
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

  // Get CSS class for productivity badge based on percentage

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



  // Track navigation source
  private navigationSource: string = '';

  constructor(private api: Api, private toastr: ToastrService, private route: ActivatedRoute, private router: Router) { }

  ngOnInit() {

    this.dprid = Number(this.route.snapshot.paramMap.get('id'));
    this.isReadOnlyMode = (this.route.snapshot.queryParamMap.get('readonly') || '') === '1';
    this.navigationSource = this.route.snapshot.queryParamMap.get('from') || '';

    // Set a default title immediately (will be updated when data loads)
    if (!sessionStorage.getItem('currentMPRMonthYear')) {
      sessionStorage.setItem('currentMPRMonthYear', 'Loading...');
      window.dispatchEvent(new CustomEvent('mprMonthYearUpdated'));
    }

    

    const user = JSON.parse(localStorage.getItem('current_user') || '{}');
    if (user) {
      this.empId = user.empId || '';
      this.empName = user.employeeName || '';
      this.designation = user.designation || '';
      this.department = user.department || '';
      this.EmailID = user.email || '';

      // Own new MPR — header shows the signed-in user.
      this.loadEmployeeProfile(this.empId);

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

    // Initial calculation of overall rating
    setTimeout(() => {
      this.calculateOverallRating();
    }, 1000);

  }



  /**
   * Pull the header's photo and profile details for one employee.
   *
   * Display only — nothing here feeds the review payload, so it cannot change
   * what gets saved. Every assignment keeps the existing value on the right of
   * the ?? / || so a sparse profile record can never blank out details already
   * populated from the session or from the loaded DPR.
   *
   * Failures are logged and swallowed: a missing photo must not stop someone
   * filling in their review.
   */
  private loadEmployeeProfile(empId: string): void {
    if (!empId) return;

    this.api.GetEmployeeProfile(empId).subscribe({
      next: (res: any) => {
        if (!res?.success || !res?.data) return;
        const d = res.data;

        this.empName     = d.employeeName || this.empName;
        this.designation = d.designation  || this.designation;
        this.department  = d.department   || this.department;

        // GetEmployeeProfile returns RAW base64 with no data: prefix (unlike the
        // login response). AvatarUtil adds it and falls back to the default avatar.
        this.profileImage = AvatarUtil.processProfileImage(d.profileImageBase64) || this.profileImage;

        this.dateOfJoining    = d.doj || d.joinDate || this.dateOfJoining;
        this.employeeEmail    = d.email    || this.employeeEmail;
        this.employeePhone    = d.phone    || this.employeePhone;
        this.employeeLocation = d.location || this.employeeLocation;

        const expInd    = Number(d.experienceInd)    || 0;
        const expAbroad = Number(d.experienceAbroad) || 0;
        const totalYrs  = expInd + expAbroad;
        if (totalYrs > 0) {
          const yrs = Math.floor(totalYrs);
          const mos = Math.round((totalYrs - yrs) * 12);
          this.totalExperience = mos > 0 ? `${yrs} yrs ${mos} mos` : `${yrs} yrs`;
        }
      },
      error: (err: any) => console.error('Error loading employee profile:', err)
    });
  }

  onAvatarError(event: Event) {
    AvatarUtil.handleImageError(event);
  }

  // ── Monthly work summary ──────────────────────────────────────────────────

  /**
   * Ask the API to draft the month's work summary from this employee's DPR
   * entries (POST api/AI/MprInsight — Claude server-side, not the old n8n
   * webhook).
   *
   * Never called automatically on load: a saved summary is shown as-is, so
   * reopening a review costs nothing and cannot overwrite the employee's edits.
   * The user presses the button.
   *
   * Overwriting existing text is confirmed first — the whole value of this field
   * is that people rewrite it, and silently discarding that would be the one
   * unforgivable bug here.
   */
  generateMonthlyInsight(): void {
    if (this.isGeneratingInsight) return;

    if (!this.canEditFields) {
      this.toastr.info('This review is read-only.', 'Cannot Edit');
      return;
    }

    const { month, year } = this.parseMonthYear();
    if (!month || !year) {
      this.toastr.warning('Could not determine the review month.', 'Validation Failed');
      return;
    }

    const run = () => {
      this.isGeneratingInsight = true;

      this.api.getMprInsight({ empId: this.empId, month, year }).subscribe({
        next: (res: any) => {
          this.isGeneratingInsight = false;

          const d = res?.data;
          if (!res?.success || !d) {
            this.toastr.error(res?.message || 'Could not generate the summary.', 'Error');
            return;
          }

          this.monthlyInsight = d.insight || '';
          this.insightMeta = {
            entries: d.sourceEntryCount ?? 0,
            tasks: d.distinctTasks ?? 0,
            days: d.daysLogged ?? 0,
            hours: d.totalHours ?? 0,
            period: d.periodLabel || ''
          };

          // Bind the DPR total into the header's Worked Hours.
          // These are the hours the employee actually logged in their daily DPRs
          // for this month, which is what the review is meant to report. Up to now
          // the field was filled from ProofHub instead, and the DPR total was only
          // shown as a chip under the summary.
          //
          // Guarded on entries > 0: when no DPR data was found the API returns 0,
          // and writing that would wipe a figure the user can see but cannot type
          // back (the input is disabled).
          if ((d.sourceEntryCount ?? 0) > 0 && d.totalHours != null) {
            this.WorkedHours = Math.round(Number(d.totalHours));
            // Stops the in-flight ProofHub response from overwriting this. Generate
            // is a click, so ProofHub has normally answered long before — but if it
            // is slow, the later response would silently win.
            this.workedHoursFromAi = true;
            this.calculateProductivityScore();
          }

          this.playInsightReveal();

          if ((d.sourceEntryCount ?? 0) === 0) {
            // The API returns a plain "nothing was logged" line rather than
            // inventing prose. Say so, so the blank box is not mistaken for a bug.
            this.toastr.warning(
              `No DPR entries found for ${d.periodLabel}. Please write your summary manually.`,
              'No Data Found');
          } else {
            this.toastr.success(
              `Drafted from ${d.sourceEntryCount} DPR entries across ${d.distinctTasks} task(s). Please review and edit.`,
              'Summary Generated');
          }
        },
        error: (err: any) => {
          this.isGeneratingInsight = false;
          console.error('MPR insight failed:', err);
          this.toastr.error('Could not reach the summary service. Please try again.', 'Error');
        }
      });
    };

    if (this.monthlyInsight && this.monthlyInsight.trim().length > 0) {
      Swal.fire({
        title: 'Replace your summary?',
        text: 'This will overwrite what is currently in the box, including any edits you have made.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, regenerate',
        cancelButtonText: 'Keep mine',
      }).then(result => { if (result.isConfirmed) run(); });
    } else {
      run();
    }
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















  SubmitReview() {
    this.ApprovalStatus = 'S';
    this.saveEmployeeDetails();
  }

  saveDraft() {
    // Validation for Save Draft
    if (!this.reportingTo) {
      this.toastr.warning('Please specify the Reporting To field before saving.', 'Validation Failed');
      return;
    }

    // A draft may be saved with an empty summary — the whole point of a draft is
    // to come back to it. Submit is where the summary becomes mandatory.

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
          scoreOverall: Number(this.overallScore), // Final score entered by the HOD (1-100)
          remarks: this.managementRemarks,
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
      this.ConfirmationMessageOnSubmit = 'Yes, Submit it!';

      // Validation 1: Reporting To is required
      if (!this.reportingTo) {
        this.toastr.warning('Please specify the Reporting To field before submitting.', 'Validation Failed');
        return;
      }

      // Validation 2: the monthly work summary must be filled in.
      // Replaces the old per-task checks (at least one task / all tasks complete /
      // hours within Worked Hours) now that the task table is gone — the summary
      // is the single record of what was done this month.
      if (!this.monthlyInsight || this.monthlyInsight.trim().length === 0) {
        this.toastr.warning('Please add your monthly work summary before submitting.', 'Validation Failed');
        return;
      }

      if (this.monthlyInsight.trim().length < 50) {
        this.toastr.warning('Please give a little more detail in your monthly work summary.', 'Validation Failed');
        return;
      }
    }
    else {
      this.ConfirmationMessage = 'Do you want to save the review details?';
      this.ConfirmationMessageOnSubmit = 'Yes, Save it!';
    }


    // Get month and year from header instead of current date
    const { month, year } = this.parseMonthYear();

    const review: DPRReview = {
      employeeId: this.empId,
      month: month,
      year: year,
      // Monthly Performance Review. SP_INSERT_DPR_REVIEW branches on p_form_type
      // into two separate MERGE statements ('M' vs 'A'), so this decides which
      // record the save lands on. It was previously omitted, leaving MPR reliant
      // on whatever the procedure does with a NULL — while apr.component has
      // always sent 'A' explicitly. Sending it makes the two symmetric and stops
      // an implicit default from deciding where monthly data goes.
      formType: 'M',
      workedHours: Number(this.WorkedHours),
      achievements: this.achievements || '',
      challenges: this.challenges || '',
      supportNeeded: this.supportNeeded || '',
      status: this.ApprovalStatus || '',
      hodId: this.reportingTo || '',
      dprid: this.dprid || 0,
      totalEstimatedhours: Number(this.TotalEstimatedhours),
      // tasksList is deliberately not sent: the Task Details table has been
      // replaced by the AI-drafted monthly summary below. The field still exists
      // on DPRReview because APR uses it.
      monthlyInsight: this.monthlyInsight || '',
    };

    Swal.fire({
      title: 'Are you sure?',
      text: this.ConfirmationMessage,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.ConfirmationMessageOnSubmit,
      cancelButtonText: 'No, cancel!',
    }).then((result) => {

      if (result.isConfirmed) {

        this.api.insertDpr(review).subscribe({
          next: (res) => {

            if (res.success) {

              this.toastr.success(res.message, 'Success');


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
                // For draft saves, also navigate to past reports
                console.log('Draft saved successfully');
                setTimeout(() => {
                  this.router.navigate(['/past-reports']);
                }, 1500); // Small delay to show success message
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

        // The rows are only needed to total the hours now that the task table is
        // gone, so they stay local instead of being held on the component.
        // WorkedHours and TotalEstimatedhours are still used — WorkedHours in the
        // header, TotalEstimatedhours by calculateProductivityScore() and the
        // save payload — so this method must keep running.
        const rows: any[] = (res.data || []);

        // Do not clobber a figure the AI summary already supplied from the real
        // DPR entries — that total is the one this review reports, and the field
        // is disabled so the user could not restore it by hand.
        if (!this.workedHoursFromAi) {
          this.WorkedHours = Math.round(rows.reduce(
            (sum: number, t: any) => sum + (Number(t.loggeD_HOURS) || 0), 0));
        }

        this.TotalEstimatedhours = Math.round(rows.reduce(
          (sum: number, t: any) => sum + (Number(t.estimateD_HOURS) || 0), 0));
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
    
    // Update header immediately
    this.updateHeaderTitle();
  }

  // Helper method to update the header title
  private updateHeaderTitle(): void {
    if (this.monthYear) {
      sessionStorage.setItem('currentMPRMonthYear', this.monthYear);
      // Trigger a custom event to notify the layout component
      window.dispatchEvent(new CustomEvent('mprMonthYearUpdated', { detail: this.monthYear }));
    }
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

          // Existing review — the header must follow the review's OWNER, which is
          // not the signed-in user when an HOD or CED is viewing someone's MPR.
          this.loadEmployeeProfile(this.empId);


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
          this.overallScore = dpr.scoreOverall ?? 0; // Final score entered by the HOD (1-100)
          this.reportingTo = dpr.hodId ?? '';
          this.currentStatus = dpr.status ?? 'D'; // Set current status from API response
          this.TotalEstimatedhours = dpr.totalEstimatedhours ?? 0;
          // Saved summary wins. Only an empty one triggers a fresh AI draft, so
          // reopening a review never overwrites what the employee wrote, and never
          // spends a Claude call it does not need.
          this.monthlyInsight = dpr.monthlyInsight ?? '';

          
          
          // Set monthYear from DPR data if available
          if (dpr.month && dpr.year) {
            const monthNames = [
              'January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December'
            ];
            this.monthYear = `${monthNames[dpr.month - 1]} ${dpr.year}`;
            
            // Update header immediately
            this.updateHeaderTitle();
          }

          // Check if HOD is viewing their own DPR
          const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
          const currentUserId = currentUser.empId || '';
          this.isHodViewingOwnDpr = this.isHod && (currentUserId === this.empId);

          // Ranking panel needs empId, monthYear and isHodViewingOwnDpr resolved
          // first, so this is the earliest safe point. One call, then local re-rank.
          this.loadDeptRanking();

          // KPI section removed from MPR — dpr.kpiList is ignored here on purpose.
          // The field still exists on DPRReview because the Annual Appraisal (APR)
          // continues to use it.

          this.remarksHistory = dpr.commentsList?.length ? dpr.commentsList : [];

          // Calculate overall rating after loading all data
          this.calculateOverallRating();

          console.log('Loaded DPR details:', dpr);
        } else {
          console.warn('No DPR data found - loading ProofHub tasks for new DPR');
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



  // getHoursUtilizationPercentage() and canAddMoreTasksBasedOnHours() lived here.
  // Both derived from the per-task hours in the Task Details table and neither was
  // referenced from the template or anywhere else, so they went with the table.



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
    const evaluationFormLink = `${baseUrl}/AdrakMPRUI/monthly-dpr/${dprId}?readonly=1`;

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
    const evaluationFormLink = `${baseUrl}/AdrakMPRUI/monthly-dpr/${dprId}?readonly=1`;
    const employeeDprEditLink = `${baseUrl}/AdrakMPRUI/monthly-dpr/${dprId}`;

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

    // Remarks are NOT mandatory before Approve or ReWork — nothing validates them.
    // The email templates cannot branch (the engine is a flat regex replace), so an
    // empty value would render an empty "Remarks" panel. On a ReWork that is worse
    // than cosmetic: the employee is told to revise the review with no guidance at
    // all, and cannot tell whether the HOD left it blank or the mail broke. So the
    // fallback text is supplied here, worded per outcome.
    const typedRemarks = (this.managementRemarks || '').trim();
    const remarksForEmail = typedRemarks || (this.ApprovalStatus === 'R'
      ? 'No specific remarks were recorded. Please contact your HOD to confirm what needs revising before you resubmit.'
      : 'No additional remarks were added.');

    const emailRequest: SendEmailRequest = {
      templateKey: templateKey,
      toEmail: this.empId,
      placeholders: {
        '[EmployeeName]': this.empName,
        '[EmployeeID]': this.empId,
        '[HODName]': hodName,
        '[MonthYear]': this.monthYear,
        '[EvaluationFormLink]': evaluationFormLink,
        '[HODRemarks]': remarksForEmail,
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


