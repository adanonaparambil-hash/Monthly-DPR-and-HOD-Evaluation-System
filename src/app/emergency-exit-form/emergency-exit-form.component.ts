import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../services/api';
import { DropdownOption, ExitEmpProfileDetails } from '../models/common.model';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  EmployeeExitRequest,
  EmployeeExitResponsibility,
  ApprovalStep,
  DepartmentApproval,
  EmployeeExitApprovalWorkflow,
  UpdateExitApprovalRequest,
  IssuedAsset,
  IssuedAssetsResponse,
  GroupedAssets
} from '../models/employeeExit.model';
import { SessionService } from '../services/session.service';
import { ToastrService } from 'ngx-toastr';
import { ApprovalWorkflowService } from '../services/approval-workflow.service';
import { AvatarUtil } from '../utils/avatar.util';
import Swal from 'sweetalert2';

interface Department {
  id: number;
  name: string;
  items: DepartmentItem[];
  hodName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'in-progress';
  approvedDate?: Date;
  comments?: string;
}

interface DepartmentItem {
  label: string;
  type: 'text' | 'checkbox' | 'number';
  value?: any;
  required?: boolean;
}

interface ResponsibilityHandover {
  project: string;
  activities: string;
  responsiblePersonName: string;
  responsiblePersonPhone: string;
  responsiblePersonEmail: string;
  signature: string;
  remarks: string;
}

@Component({
  selector: 'app-emergency-exit-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './emergency-exit-form.component.html',
  styleUrls: ['./emergency-exit-form.component.css'],
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
    trigger('stepTransition', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('0.5s ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('0.3s ease-in', style({ transform: 'translateX(-100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class EmergencyExitFormComponent implements OnInit {
  @ViewChild('signatureCanvas') signatureCanvas!: ElementRef<HTMLCanvasElement>;

  // Make Object available in template
  Object = Object;


  exitForm!: FormGroup;
  isSubmitting = false;
  formSubmitted = false;
  hodRemarks: string = '';
  hodDaysAllowed: number = 0;
  hodList: DropdownOption[] = [];
  projectManagerList: DropdownOption[] = [];
  employeeMasterList: DropdownOption[] = [];
  currentUser: any = null;
  
  // Approval status from backend
  approvalStatus: string = 'P'; // Default to Pending
  
  // Form type flag: 'E' for Emergency, 'P' for Planned Leave, 'R' for Resignation
  @Input() formType: 'E' | 'P' | 'R' = 'E';

  // Date calculation tracking
  wasAutoCalculated: boolean = false;
  private isCalculatingDays: boolean = false;

  // PDF export
  isPdfGenerating: boolean = false;

  // Approval mode flags
  isApprovalMode: boolean = false;
  isViewMode: boolean = false;
  approvalRequestData: any = null;
  approvalID: number | null = null;
  returnUrl: string = '';
  actionTaken: boolean = false; // Flag to track if approval/rejection action has been taken

  // IT Assets properties
  currentStage: string = '';
  issuedAssets: IssuedAsset[] = [];
  groupedAssets: GroupedAssets = {};
  isITAssetsSectionOpen: boolean = false;
  isLoadingAssets: boolean = false;

  // Employee profile data
  employeeProfileData: ExitEmpProfileDetails = {};

  // Employee photo
  employeePhoto: string = AvatarUtil.DEFAULT_AVATAR;

  // Employee designation
  employeeDesignation: string = '';
  employeeDoj: string = '';   // Date of Joining (ISO yyyy-mm-dd) from GetEmployeeProfile

  // Project Manager / Site Incharge approval
  pmRemarks: string = '';
  pmDaysAllowed: number = 0;

  // Form data
  departments: Department[] = [
    {
      id: 0,
      name: 'HOD Approval',
      status: 'pending',
      items: []
    },
    {
      id: 1,
      name: 'IT',
      status: 'pending',
      items: [
        { label: 'Mobile Phone', type: 'checkbox' },
        { label: 'Desktop', type: 'checkbox' },
        { label: 'Laptop', type: 'checkbox' },
        { label: 'Tab', type: 'checkbox' },
        { label: 'Liabilities if any', type: 'text' }
      ]
    },
    {
      id: 2,
      name: 'Audit',
      status: 'pending',
      items: [
        { label: 'Audit Clearance', type: 'checkbox' },
        { label: 'Document Verification', type: 'checkbox' },
        { label: 'Compliance Check', type: 'checkbox' },
        { label: 'Liabilities if any', type: 'text' }
      ]
    },
    {
      id: 3,
      name: 'Finance',
      status: 'pending',
      items: [
        { label: 'Petty Cash', type: 'number' },
        { label: 'Bank Liabilities', type: 'text' },
        { label: 'Liabilities if any', type: 'text' }
      ]
    },
    {
      id: 4,
      name: 'Facility Management',
      status: 'pending',
      items: [
        { label: 'Accommodation Key', type: 'checkbox' },
        { label: 'Office Key', type: 'checkbox' },
        { label: 'Access Card', type: 'checkbox' },
        { label: 'Liabilities if any', type: 'text' }
      ]
    },
    {
      id: 5,
      name: 'Transport',
      status: 'pending',
      items: [
        { label: 'Company Car', type: 'checkbox' },
        { label: 'Make/Model', type: 'text' },
        { label: 'Car Km', type: 'number' },
        { label: 'Liabilities if any', type: 'text' }
      ]
    },
    {
      id: 6,
      name: 'HR',
      status: 'pending',
      items: [
        { label: 'Medical Claims', type: 'text' },
        { label: 'Ticket', type: 'checkbox' },
        { label: 'Passport', type: 'checkbox' },
        { label: 'Punching Card', type: 'checkbox' },
        { label: 'Liabilities if any', type: 'text' }
      ]
    },
    {
      id: 7,
      name: 'Admin',
      status: 'pending',
      items: [
        { label: 'Sim Card', type: 'checkbox' },
        { label: 'Telephone Charges', type: 'number' },
        { label: 'Leave Settlement', type: 'text' },
        { label: 'Final Settlement', type: 'text' },
        { label: 'Liabilities if any', type: 'text' }
      ]
    }
  ];

  responsibilities: ResponsibilityHandover[] = [];

  // Approval workflow properties
  approvalWorkflow: ApprovalStep[] = [];
  departmentApprovals: DepartmentApproval[] = [];
  currentApprovalStep: ApprovalStep | null = null;
  workflowProgress: number = 0;

  // Static approval flow for new forms (when no ExitId exists)
  staticApprovalFlow: ApprovalStep[] = [
    {
      stepId: 1,
      stepName: 'Handover Verification',
      approverType: 'DEPARTMENT',
      approverIds: [],
      approverNames: ['Will be assigned after submission'],
      status: 'PENDING',
      approvedBy: undefined,
      approvedId: undefined,
      email: undefined,
      phoneNumber: undefined,
      photo: undefined,
      department: undefined,
      profileImageBase64: undefined,
      approvedDate: undefined,
      comments: undefined,
      isRequired: true,
      order: 1
    },
    {
      stepId: 2,
      stepName: 'HOD Approval',
      approverType: 'DEPARTMENT',
      approverIds: [],
      approverNames: ['Will be assigned after submission'],
      status: 'PENDING',
      approvedBy: undefined,
      approvedId: undefined,
      email: undefined,
      phoneNumber: undefined,
      photo: undefined,
      department: undefined,
      profileImageBase64: undefined,
      approvedDate: undefined,
      comments: undefined,
      isRequired: true,
      order: 2
    },
    {
      stepId: 3,
      stepName: 'IT Approval',
      approverType: 'DEPARTMENT',
      approverIds: [],
      approverNames: ['Will be assigned after submission'],
      status: 'PENDING',
      approvedBy: undefined,
      approvedId: undefined,
      email: undefined,
      phoneNumber: undefined,
      photo: undefined,
      department: undefined,
      profileImageBase64: undefined,
      approvedDate: undefined,
      comments: undefined,
      isRequired: true,
      order: 3
    },
    {
      stepId: 4,
      stepName: 'Audit Approval',
      approverType: 'DEPARTMENT',
      approverIds: [],
      approverNames: ['Will be assigned after submission'],
      status: 'PENDING',
      approvedBy: undefined,
      approvedId: undefined,
      email: undefined,
      phoneNumber: undefined,
      photo: undefined,
      department: undefined,
      profileImageBase64: undefined,
      approvedDate: undefined,
      comments: undefined,
      isRequired: true,
      order: 4
    },
    {
      stepId: 5,
      stepName: 'Finance Approval',
      approverType: 'DEPARTMENT',
      approverIds: [],
      approverNames: ['Will be assigned after submission'],
      status: 'PENDING',
      approvedBy: undefined,
      approvedId: undefined,
      email: undefined,
      phoneNumber: undefined,
      photo: undefined,
      department: undefined,
      profileImageBase64: undefined,
      approvedDate: undefined,
      comments: undefined,
      isRequired: true,
      order: 5
    },
    {
      stepId: 6,
      stepName: 'Facility Management',
      approverType: 'DEPARTMENT',
      approverIds: [],
      approverNames: ['Will be assigned after submission'],
      status: 'PENDING',
      approvedBy: undefined,
      approvedId: undefined,
      email: undefined,
      phoneNumber: undefined,
      photo: undefined,
      department: undefined,
      profileImageBase64: undefined,
      approvedDate: undefined,
      comments: undefined,
      isRequired: true,
      order: 6
    },
    {
      stepId: 7,
      stepName: 'Transport Approval',
      approverType: 'DEPARTMENT',
      approverIds: [],
      approverNames: ['Will be assigned after submission'],
      status: 'PENDING',
      approvedBy: undefined,
      approvedId: undefined,
      email: undefined,
      phoneNumber: undefined,
      photo: undefined,
      department: undefined,
      profileImageBase64: undefined,
      approvedDate: undefined,
      comments: undefined,
      isRequired: true,
      order: 7
    },
    {
      stepId: 8,
      stepName: 'HR Approval',
      approverType: 'DEPARTMENT',
      approverIds: [],
      approverNames: ['Will be assigned after submission'],
      status: 'PENDING',
      approvedBy: undefined,
      approvedId: undefined,
      email: undefined,
      phoneNumber: undefined,
      photo: undefined,
      department: undefined,
      profileImageBase64: undefined,
      approvedDate: undefined,
      comments: undefined,
      isRequired: true,
      order: 8
    },
    {
      stepId: 9,
      stepName: 'Admin Approval',
      approverType: 'DEPARTMENT',
      approverIds: [],
      approverNames: ['Will be assigned after submission'],
      status: 'PENDING',
      approvedBy: undefined,
      approvedId: undefined,
      email: undefined,
      phoneNumber: undefined,
      photo: undefined,
      department: undefined,
      profileImageBase64: undefined,
      approvedDate: undefined,
      comments: undefined,
      isRequired: true,
      order: 9
    }
  ];

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private api: Api,
    private route: ActivatedRoute,
    private router: Router,
    private sessionService: SessionService,
    private toastr: ToastrService,
    private approvalWorkflowService: ApprovalWorkflowService
  ) {
    this.initializeForm();
  }

  ngOnInit() {
    try {
      // Get current user from session first
      this.currentUser = this.sessionService.getCurrentUser();

      // Debug: Log all available user properties
      this.debugUserProperties();

      // Debug: Check if form is incorrectly in approval mode
      console.log('=== FORM MODE DEBUG ===');
      console.log('isApprovalMode:', this.isApprovalMode);
      console.log('approvalRequestData:', this.approvalRequestData);
      console.log('URL params will be checked in setFormType()');
      console.log('=== END DEBUG ===');

      // Add one default responsibility row for all form types
      if (this.formType === 'E' || this.formType === 'P' || this.formType === 'R') {
        this.addResponsibility();
      }

      // Keep responsibilities section open by default for all modes
      this.isResponsibilitiesSectionOpen = true;
      
      // Ensure responsibilities section is properly initialized
      this.ensureResponsibilitiesSectionInitialized();

      // Ensure all departments are visible by default
      this.departments.forEach(dept => {
        if (!dept.status) {
          dept.status = 'pending';
        }
      });

      // Set form type based on URL parameter or input (this will handle population)
      this.setFormType();

      // Update validators based on form type
      this.updateValidatorsForFormType();

      // Load master lists from API - Add delay to ensure component is ready
      setTimeout(() => {
        this.loadHodMasterList();
        this.loadEmployeeMasterList(); // Using this for both Project Manager and Responsibilities dropdowns
      }, 100);

      // Disable employee information fields (always disabled)
      this.disableEmployeeInfoFields();

      // Ensure other fields are enabled for regular form usage
      if (!this.isApprovalMode && !this.approvalRequestData) {
        this.enableFormFields();
      }

      console.log('Single screen form initialized for type:', this.formType);
      console.log('Final form disabled status check:', {
        employeeName: this.exitForm.get('employeeName')?.disabled,
        employeeId: this.exitForm.get('employeeId')?.disabled,
        department: this.exitForm.get('department')?.disabled,
        dateOfDeparture: this.exitForm.get('dateOfDeparture')?.disabled,
        hodName: this.exitForm.get('hodName')?.disabled,
        reasonForEmergency: this.exitForm.get('reasonForEmergency')?.disabled
      });

      // Setup date change listeners for auto-calculation
      this.setupDateChangeListeners();
      
      // Auto-fill phone and email fields after initialization
      setTimeout(() => {
        this.autoFillPhoneAndEmail();
      }, 500);
    } catch (error) {
      console.error('Error initializing emergency exit form:', error);
    }
  }

  // Debug method to log all user properties
  debugUserProperties(): void {
    if (this.currentUser) {
      console.log('=== DEBUG: All User Properties ===');
      console.log('Full user object:', this.currentUser);
      console.log('Available properties:', Object.keys(this.currentUser));

      // Check for department-related properties
      const departmentProps = Object.keys(this.currentUser).filter(key =>
        key.toLowerCase().includes('dept') || key.toLowerCase().includes('department')
      );
      console.log('Department-related properties:', departmentProps);

      // Log values of department-related properties
      departmentProps.forEach(prop => {
        console.log(`${prop}:`, this.currentUser[prop]);
      });

      console.log('=== END DEBUG ===');
    } else {
      console.warn('No current user found for debugging');
    }
  }

  setupDateChangeListeners(): void {
    // Only setup listeners for Emergency and Planned Leave forms (not Resignation)
    if (this.formType === 'E' || this.formType === 'P') {
      // Listen to changes in Date of Departure
      this.exitForm.get('dateOfDeparture')?.valueChanges.subscribe(() => {
        this.calculateDaysDifference();
      });

      // Listen to changes in Date of Arrival
      this.exitForm.get('dateOfArrival')?.valueChanges.subscribe(() => {
        this.calculateDaysDifference();
      });

      // Listen to manual changes in No. of Days field to prevent auto-override
      this.exitForm.get('noOfDaysApproved')?.valueChanges.subscribe((value) => {
        // If user manually changes the days field, stop auto-calculation
        if (value && !this.isCalculatingDays) {
          this.wasAutoCalculated = false;
        }
      });
    }
  }

  calculateDaysDifference(): void {
    // Only calculate for Emergency and Planned Leave forms
    if (this.formType !== 'E' && this.formType !== 'P') {
      return;
    }

    const departureDate = this.exitForm.get('dateOfDeparture')?.value;
    const arrivalDate = this.exitForm.get('dateOfArrival')?.value;

    if (departureDate && arrivalDate) {
      const departure = new Date(departureDate);
      const arrival = new Date(arrivalDate);

      // Calculate the difference in days
      const timeDifference = arrival.getTime() - departure.getTime();
      const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));

      // Only update if the difference is positive (arrival after departure)
      if (daysDifference > 0) {
        console.log(`Auto-calculating days: ${daysDifference} days between ${departureDate} and ${arrivalDate}`);
        
        // Set flag to prevent triggering manual change detection
        this.isCalculatingDays = true;
        
        // Update the number of days field without triggering validation
        this.exitForm.get('noOfDaysApproved')?.setValue(daysDifference, { emitEvent: false });
        
        // Mark that this was auto-calculated
        this.wasAutoCalculated = true;
        
        // Reset flag
        this.isCalculatingDays = false;
      } else if (daysDifference <= 0) {
        // If arrival date is before or same as departure date, clear the days field
        console.log('Arrival date must be after departure date');
        this.isCalculatingDays = true;
        this.exitForm.get('noOfDaysApproved')?.setValue('', { emitEvent: false });
        this.isCalculatingDays = false;
      }
    } else {
      // If either date is missing, clear the calculated days only if it was auto-calculated
      if (!departureDate || !arrivalDate) {
        const currentDays = this.exitForm.get('noOfDaysApproved')?.value;
        if (currentDays && this.wasAutoCalculated) {
          this.isCalculatingDays = true;
          this.exitForm.get('noOfDaysApproved')?.setValue('', { emitEvent: false });
          this.isCalculatingDays = false;
        }
      }
    }
  }

  setFormType() {
    // Read form type from route query parameters
    this.route.queryParams.subscribe(params => {
      const typeParam = params['type'];
      const modeParam = params['mode'];
      const requestId = params['requestId'] || params['exitID'];
      const approvalIDParam = params['approvalID'];
      this.approvalID = approvalIDParam ? parseInt(approvalIDParam) : null;

      console.log('=== SETFORMTYPE DEBUG ===');
      console.log('URL params:', { typeParam, modeParam, requestId, approvalIDParam });
      console.log('ApprovalID parsed:', this.approvalID);
      console.log('Current approval mode before processing:', this.isApprovalMode);

      if (typeParam === 'P' || typeParam === 'E' || typeParam === 'R') {
        this.formType = typeParam;
        console.log('Form type set to:', this.formType);
      } else {
        // Default to Emergency if no valid type is provided
        this.formType = 'E';
        console.log('Form type defaulted to Emergency');
      }

      // Determine mode and return URL based on presence of approvalID or requestId
      if (this.approvalID || requestId) {
        this.isApprovalMode = !!this.approvalID;
        this.isViewMode = !this.approvalID; // If we have an ID but not approvalID, it's typically view mode until data is assessed
        this.returnUrl = sessionStorage.getItem('returnUrl') || '/leave-approval';
        console.log('Mode Determined:', { isApprovalMode: this.isApprovalMode, isViewMode: this.isViewMode, returnUrl: this.returnUrl });
      } else {
        this.isApprovalMode = false;
        this.isViewMode = false;
        this.returnUrl = '';
      }

      console.log('Final approval mode after processing:', this.isApprovalMode);
      console.log('Final approvalID:', this.approvalID);
      console.log('Will show IT assets section:', this.shouldShowITAssetsSection());
      console.log('=== END SETFORMTYPE DEBUG ===');

      // Clear previous form state if we are going to a new entry or regular mode
      if (!modeParam && !requestId) {
        this.resetFormCompletely();
        
        // Re-initialize responsibilities section for Emergency forms after reset
        setTimeout(() => {
          this.ensureResponsibilitiesSectionInitialized();
        }, 100);
      }

      // Update form validations and steps when form type changes
      this.updateFormValidations();

      // Auto-fill phone and email for planned and resignation forms after validation update
      if ((this.formType === 'P' || this.formType === 'R') && !this.isApprovalMode && !this.isViewMode) {
        setTimeout(() => {
          this.autoFillPhoneAndEmail();
        }, 200);
      }

      // Check for exitID to load saved data (check multiple common names for better compatibility)
      const exitIdParam = params['exitID'] || params['exitId'] || params['requestId'];
      if (exitIdParam) {
        console.log('Loading saved data for exitId:', exitIdParam);
        this.loadSavedExitData(parseInt(exitIdParam));
      } else if (!this.isApprovalMode && !this.isViewMode) {
        // Reset approval status for new forms
        this.approvalStatus = 'P';
        
        // Re-populate form with session data after form type change
        this.populateFormFromSession();

        // Load employee details for the new form type
        this.loadEmployeeDetails();

        // Load master lists for non-approval mode
        this.loadHodMasterList();
        this.loadEmployeeMasterList(); // Using this for both Project Manager and Responsibilities dropdowns

        // Ensure fields are enabled for regular form usage
        this.enableFormFields();
        
        // Ensure responsibilities section is properly initialized
        setTimeout(() => {
          this.ensureResponsibilitiesSectionInitialized();
        }, 100);
      }
    });
  }

  loadSavedExitData(exitId: number): void {
    this.api.GetEmployeeExitSavedInfo(exitId).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          const data = response.data;
          console.log('Saved exit data fetched:', data);

          // Update form type if different
          if (data.formType && data.formType.trim() !== this.formType) {
            this.formType = data.formType.trim() as 'E' | 'P' | 'R';
            this.updateFormValidations();
          }

          // Set approval status from backend data
          this.approvalStatus = data.approvalStatus || 'P';
          console.log('Approval status loaded:', this.approvalStatus);

          // Extract currentStage from response
          this.currentStage = data.currentStage || '';
          console.log('Current stage loaded:', this.currentStage);

          // Load IT assets if current user can take action and stage is IT or TRANSPORT
          if ((this.currentStage === 'IT' || this.currentStage === 'TRANSPORT') && data.employeeId) {
            // Check if current user can take action based on the approval workflow
            // We need to wait for the approval workflow to be mapped first
            setTimeout(() => {
              if (this.canUserTakeAction()) {
                console.log('Loading assets for approval mode - CurrentStage:', this.currentStage, 'User can take action:', this.canUserTakeAction());
                this.loadITAssets(data.employeeId);
              } else {
                console.log('Not loading assets - CurrentStage:', this.currentStage, 'User cannot take action');
              }
            }, 100);
          } else {
            console.log('Not loading assets - CurrentStage:', this.currentStage, 'No employee ID or wrong stage');
          }

          // Format dates for input fields
          const formatDateForInput = (dateString: string): string => {
            if (!dateString) return '';
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
            if (/^\d{4}-\d{2}-\d{2}T/.test(dateString)) return dateString.substring(0, 10);
            const parts = dateString.split('-');
            if (parts.length === 3 && parts[0].length === 2) return `${parts[2]}-${parts[1]}-${parts[0]}`;
            const d = new Date(dateString);
            if (isNaN(d.getTime())) return '';
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          };

          // Bind data to form fields
          this.exitForm.patchValue({
            employeeName: data.employeeName || data.EmployeeName || data.name || this.exitForm.get('employeeName')?.value || '',
            employeeId: data.employeeId || data.employeeID || data.empId || '',
            formType: data.formType?.trim() || 'E',
            dateOfDeparture: formatDateForInput(data.dateOfDeparture),
            dateOfArrival: formatDateForInput(data.dateArrival),
            flightTime: data.flightTime || '',
            noOfDaysApproved: data.noOfDaysApproved || 0,
            hodName: data.depHod || '',
            projectManagerName: data.projectSiteIncharge || '', // Store the ID
            reasonForEmergency: data.reasonForLeave || '',
            category: this.mapCategoryFromBackend(data.category), // Map S/W to Staff/Worker
            responsibilitiesHandedOverTo: data.responsibilitiesHanded || '', // This might be name or ID
            responsibilitiesHandedOverToId: data.responsibilitiesHandedToId || data.responsibilitiesHandedOverToId || '', // Store the ID separately if available
            decInfoAccurate: data.declaration1 === 'Y',
            decHandoverComplete: data.declaration2 === 'Y',
            decReturnAssets: data.declaration3 === 'Y',
            decUnderstandReturn: data.declaration4 === 'Y'
          });

          // Bind responsibilities
          if (data.responsibilities && data.responsibilities.length > 0) {
            this.responsibilitiesFormArray.clear();
            data.responsibilities.forEach((resp: any) => {
              const responsibilityGroup = this.fb.group({
                project: [resp.project || '', Validators.required],
                activities: [resp.activities || '', Validators.required],
                responsiblePersonName: [resp.rpersonEmpId || '', Validators.required], // Fallback to ID if name not separate
                responsiblePersonId: [resp.rpersonEmpId || ''],
                responsiblePersonPhone: [resp.rpersonPhone || '', [Validators.required, Validators.pattern(/^[+]?[0-9\s\-()]{7,15}$/)]],
                responsiblePersonEmail: [resp.rpersonEmail || '', [Validators.required, Validators.email]],
                remarks: [resp.remarks || '']
              });
              this.responsibilitiesFormArray.push(responsibilityGroup);
            });
          }

          // Map approval status
          if (data.approvalListHistory) {
            this.approvalWorkflow = data.approvalListHistory.map((history: any, index: number) => ({
              stepId: index + 1,
              stepName: history.approverRole || 'Approver',
              approverType: 'DEPARTMENT',
              approverIds: [history.approvedId],
              approverNames: [history.employeeName],
              status: history.approvalStatusCode === 'A' ? 'APPROVED' : (history.approvalStatusCode === 'R' ? 'REJECTED' : (history.approvalStatusCode === 'I' ? 'IN_PROGRESS' : 'PENDING')),
              approvedBy: history.employeeName,
              approvedId: history.approvedId,
              email: history.email,
              phoneNumber: history.phoneNumber,
              photo: history.photo,
              department: history.department,
              profileImageBase64: this.processProfileImage(history.profileImageBase64 || history.ProfileImageBase64),
              approvedDate: history.approvalDate,
              comments: history.remarks || null, // Map remarks to comments
              isRequired: true,
              order: history.approvalLevel || index + 1,
              // Add these properties for the new logic
              approverCode: history.approverCode,
              approvalStatusCode: history.approvalStatusCode,
              isHead : history.isHead
            }));
            this.updateWorkflowProgress();
            
            // Debug the loaded approval workflow
            this.debugApprovalWorkflow();
            
            // Test image processing
            this.testImageProcessing();
          }

          // Fetch additional employee details (profile/image) using the employeeId from saved data
          if (data.employeeId) {
            this.loadEmployeeDetailsById(data.employeeId);
          }

          // Sync input field display values
          this.syncInputFieldValues();

          // Assess access control based on status and ownership
          const ownerId = data.employeeId || data.employeeID || data.empId;
          const status = data.approvalStatus || data.approvalStatus;
          const currentUserId = this.currentUser?.empId;

          console.log('Access Control Check:', { ownerId, status, currentUserId, isApprovalMode: this.isApprovalMode });

          // If in approval mode, we keep everything disabled except approval actions
          if (this.isApprovalMode) {
            this.isViewMode = false;
            setTimeout(() => this.disableAllFormFields(), 100);
          }
          // If not in approval mode, check if it's the owner and rejected
          else if (ownerId === currentUserId && status === 'R') {
            this.isViewMode = false;
            console.log('Owner accessed a rejected request - enabling form for editing');
            setTimeout(() => {
              this.enableFormFields();
              this.disableEmployeeInfoFields(); // Keep identity fields read-only
            }, 100);
          }
          // Default to read-only for all other cases where an ID is present
          else {
            this.isViewMode = true;
            console.log('Read-only view mode activated based on status/ownership');
            setTimeout(() => this.disableAllFormFields(), 100);
          }
        }
      },
      error: (error) => {
        console.error('Error loading saved exit info:', error);
        this.toastr.error('Failed to load saved request data.', 'Error');
      }
    });
  }

  loadEmployeeDetailsById(empId: string): void {
    this.api.GetExitEmployeeDetails(empId).subscribe({
      next: (response: any) => {
        console.log('GetExitEmployeeDetails API Response (by ID):', response);
        if (response && response.success && response.data) {
          const profile = response.data;
          console.log('Employee profile data:', profile);
          console.log('actProfession value (by ID):', profile.actProfession);

          // Capture designation from actProfession field
          this.employeeDesignation = profile.actProfession || '';
          console.log('employeeDesignation set to (by ID):', this.employeeDesignation);
          
          // Trigger change detection to update the UI
          this.cdr.detectChanges();

          // Update photo using helper
          this.setEmployeePhotoFromData(profile);

          // Capture Date of Joining if this response has it
          if (profile.doj) {
            this.employeeDoj = this.parseDojToIso(profile.doj);
          }

          // If no photo or DOJ in exit details response, try the general profile API
          if (!this.hasRealEmployeePhoto() || !this.employeeDoj) {
            this.api.GetEmployeeProfile(empId).subscribe({
              next: (profResponse: any) => {
                if (profResponse && profResponse.success && profResponse.data) {
                  if (!this.hasRealEmployeePhoto()) {
                    this.setEmployeePhotoFromData(profResponse.data);
                  }
                  if (!this.employeeDoj && profResponse.data.doj) {
                    this.employeeDoj = this.parseDojToIso(profResponse.data.doj);
                  }
                  this.cdr.detectChanges();
                }
              }
            });
          }

          // Patch profile info - using correct field names from API
          this.exitForm.patchValue({
            employeeName: profile.employeeName || profile.empName || profile.name || this.exitForm.get('employeeName')?.value || '',
            employeeId: profile.employeeId || profile.employeeID || profile.empId || this.exitForm.get('employeeId')?.value || '',
            department: profile.empDept || profile.department || this.exitForm.get('department')?.value || '', // Use empDept from API
            emailId: profile.email || this.exitForm.get('emailId')?.value || '',
            address: profile.address || '',
            district: profile.district || '',
            place: profile.place || '',
            state: profile.state || '',
            postOffice: profile.postOffice || '',
            nation: profile.nationality || profile.nation || '',
            telephoneMobile: profile.phone || '',
            telephoneLandline: profile.telephoneNo || profile.telephone || '',
            // Auto-fill phone and email for planned and resignation forms
            responsibilitiesHandedOverToPhone: (this.formType === 'P' || this.formType === 'R') ? (profile.phone || '') : '',
            responsibilitiesHandedOverToEmail: (this.formType === 'P' || this.formType === 'R') ? (profile.email || '') : ''
          });

          // Trigger change detection to update the UI
          this.cdr.detectChanges();

          console.log('Employee details loaded by ID:', empId);
          
          // Auto-fill phone and email fields after details are loaded
          setTimeout(() => {
            this.autoFillPhoneAndEmail();
          }, 100);
        }
      },
      error: (error) => {
        console.error('Error loading employee details by ID:', error);
      }
    });
  }

  initializeForm() {
    this.exitForm = this.fb.group({
      // Employee Information
      employeeName: ['', Validators.required],
      employeeId: ['', Validators.required],
      department: ['', Validators.required],
      designation: [''], // Display-only field for employee designation
      dateOfDeparture: ['', Validators.required],
      flightTime: [''],
      dateOfArrival: [''],
      noOfDaysApproved: ['', [Validators.required, Validators.min(1)]],

      // Contact Details (conditionally required)
      address: [''],
      district: [''],
      telephoneMobile: [''],
      place: [''],
      state: [''],
      telephoneLandline: [''],
      postOffice: [''],
      nation: [''],
      emailId: [''],

      // Reason (Emergency or Planned Leave specific)
      reasonForEmergency: ['', Validators.required],

      // Planned Leave specific fields
      category: [''], // Staff or Worker
      responsibilitiesHandedOverTo: [''], // Keep for backward compatibility
      responsibilitiesHandedOverToPhone: [''], // Phone number for planned/resignation
      responsibilitiesHandedOverToEmail: [''], // Email for planned/resignation

      // HOD Information
      hodName: ['', Validators.required],
      hodSignature: [''],

      // Project Manager / Site Incharge (for Planned Leave and Resignation)
      projectManagerName: [''],

      // Responsibilities (FormArray)
      responsibilities: this.fb.array([]),

      // Department approvals will be handled separately
      departmentApprovals: this.fb.group({}),

      // Declarations (must all be checked to submit)
      decInfoAccurate: [false, Validators.requiredTrue],
      decHandoverComplete: [false, Validators.requiredTrue],
      decReturnAssets: [false, Validators.requiredTrue],
      decUnderstandReturn: [false, Validators.requiredTrue]
    });
  }

  get responsibilitiesFormArray() {
    return this.exitForm.get('responsibilities') as FormArray;
  }

  // Populate form with session data
  populateFormFromSession(): void {
    console.log('Emergency Exit Form - Current user from session:', this.currentUser);

    if (this.currentUser) {
      // Try different possible property names for department
      const department = this.currentUser.department ||
        this.currentUser.empDept ||
        this.currentUser.dept ||
        this.currentUser.departmentName ||
        this.currentUser.empDepartment ||
        '';

      const formData = {
        employeeName: this.currentUser.employeeName || this.currentUser.name || '',
        employeeId: this.currentUser.empId || this.currentUser.employeeId || '',
        department: department,
        emailId: this.currentUser.email || this.currentUser.emailId || ''
      };

      console.log('Emergency Exit Form - Available user properties:', Object.keys(this.currentUser));
      console.log('Emergency Exit Form - Department value found:', department);
      console.log('Emergency Exit Form - Populating form with data:', formData);
      this.exitForm.patchValue(formData);

      // Load employee profile with photo
      this.loadEmployeeProfile();

      // Disable employee information fields since they come from session
      this.disableEmployeeInfoFields();
    } else {
      console.warn('Emergency Exit Form - No current user found in session');
    }
  }

  // Load employee profile with photo
  loadEmployeeProfile(): void {
    const empId = this.currentUser?.empId;
    if (empId) {
      this.api.GetEmployeeProfile(empId).subscribe({
        next: (response: any) => {
          if (response && response.success && response.data) {
            const data = response.data;

            // Set employee photo using helper
            this.setEmployeePhotoFromData(data);

            // Capture Date of Joining
            this.employeeDoj = this.parseDojToIso(data.doj || '');

            // Fallback to session photo if still not set
            if (!this.hasRealEmployeePhoto() && this.currentUser.photo) {
              this.employeePhoto = this.currentUser.photo;
            }

            // Update contact details from profile
            this.exitForm.patchValue({
              address: data.address || '',
              district: data.district || '',
              place: data.place || '',
              state: data.state || '',
              postOffice: data.postOffice || '',
              nation: data.nationality || data.nation || '',
              telephoneMobile: data.phone || '',
              telephoneLandline: data.telephoneNo || data.telephone || '',
              emailId: data.email || this.currentUser.email || '',
              department: data.empDept || data.department || '',
              // Auto-fill phone and email for planned and resignation forms
              responsibilitiesHandedOverToPhone: (this.formType === 'P' || this.formType === 'R') ? (data.phone || '') : '',
              responsibilitiesHandedOverToEmail: (this.formType === 'P' || this.formType === 'R') ? (data.email || this.currentUser.email || '') : ''
            });

            console.log('Employee profile loaded successfully');
            
            // Auto-fill phone and email fields after profile is loaded
            setTimeout(() => {
              this.autoFillPhoneAndEmail();
            }, 100);
          }
        },
        error: (err) => {
          console.error('Error loading employee profile:', err);
          // Keep default photo on error
        }
      });
    }
  }

  /**
   * Centralized helper to set employee photo from various data formats
   */
  setEmployeePhotoFromData(data: any): void {
    if (!data) return;

    const photoBase64 = data.profileImageBase64 || data.ProfileImageBase64;
    const photoUrl = data.photo || data.Photo;

    if (photoBase64) {
      this.employeePhoto = this.processProfileImage(photoBase64) || 'assets/images/default-avatar.png';
    } else if (photoUrl) {
      this.employeePhoto = photoUrl;
    } else {
      this.employeePhoto = 'assets/images/default-avatar.png';
    }
  }

  // Handle photo loading error
  onPhotoError(event: any): void {
    console.log('Photo loading failed, using default avatar');
    AvatarUtil.handleImageError(event);
    this.employeePhoto = AvatarUtil.DEFAULT_AVATAR;
  }

  /** True when a real (non-placeholder) employee photo is loaded */
  private hasRealEmployeePhoto(): boolean {
    return !!this.employeePhoto
      && this.employeePhoto !== 'assets/images/default-avatar.png'
      && this.employeePhoto !== AvatarUtil.DEFAULT_AVATAR;
  }

  /** Convert backend DOJ ("08-SEP-2025" or ISO) → "yyyy-mm-dd" */
  private parseDojToIso(doj: string): string {
    if (!doj) return '';
    if (/^\d{4}-\d{2}/.test(doj)) return doj.slice(0, 10);
    const months: Record<string, string> = {
      JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
      JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
    };
    const parts = doj.split('-');
    if (parts.length === 3 && months[parts[1]?.toUpperCase()]) {
      const [d, m, y] = parts;
      return `${y}-${months[m.toUpperCase()]}-${d.padStart(2, '0')}`;
    }
    const dt = new Date(doj);
    return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
  }

  /** DOJ formatted for display, e.g. "08 Sep 2025" */
  getDojDisplay(): string {
    if (!this.employeeDoj) return '';
    const dt = new Date(this.employeeDoj);
    if (isNaN(dt.getTime())) return this.employeeDoj;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** True when service is less than one year from DOJ to today */
  isDojLessThanOneYear(): boolean {
    if (!this.employeeDoj) return false;
    const doj = new Date(this.employeeDoj);
    if (isNaN(doj.getTime())) return false;
    const oneYearLater = new Date(doj);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    return new Date() < oneYearLater;
  }

  addResponsibility() {
    const responsibilityGroup = this.fb.group({
      project: ['', Validators.required],
      activities: ['', Validators.required],
      responsiblePersonName: ['', Validators.required],
      responsiblePersonId: [''], // Store the employee ID
      responsiblePersonPhone: ['', [Validators.required, Validators.pattern(/^[+]?[0-9\s\-()]{7,15}$/)]],
      responsiblePersonEmail: ['', [Validators.required, Validators.email]],
      remarks: ['']
    });

    this.responsibilitiesFormArray.push(responsibilityGroup);
  }

  removeResponsibility(index: number) {
    if (this.responsibilitiesFormArray.length > 1) {
      this.responsibilitiesFormArray.removeAt(index);
    }
  }

  submitForm() {
    console.log('Submit form called - Form Type:', this.formType);
    console.log('Form valid:', this.exitForm.valid);
    console.log('Form errors:', this.exitForm.errors);
    console.log('Form value:', this.exitForm.value);
    console.log('Raw form value:', this.exitForm.getRawValue());

    // Log individual field validation status
    Object.keys(this.exitForm.controls).forEach(key => {
      const control = this.exitForm.get(key);
      if (control && control.invalid) {
        console.log(`Field ${key} is invalid:`, control.errors);
      }
    });

    // Validate form for current type
    if (!this.validateFormForCurrentType()) {
      this.markAllFieldsAsTouched();
      this.showValidationErrors(); // Show specific validation errors with field names
      return;
    }

    if (!this.allDeclarationsChecked()) {
      this.showMissingDeclarations();
      return;
    }

    // Additional email and phone validation
    if (!this.validateEmailAndPhone()) {
      return;
    }

    // Show confirmation popup
    this.showSubmissionConfirmation();
  }

  private showSubmissionConfirmation(): void {
    const formTypeText = this.formType === 'E' ? 'Emergency Exit' : (this.formType === 'R' ? 'Resignation' : 'Planned Leave');

    Swal.fire({
      title: 'Confirm Submission',
      text: `Are you sure you want to submit this ${formTypeText} form? Once submitted, you cannot modify the information and it will be sent for approval.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, Submit',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.performFormSubmission();
      }
    });
  }

  private performFormSubmission(): void {
    this.isSubmitting = true;

    try {
      // Prepare data for API
      const exitRequest = this.prepareExitRequest();

      // Generate approval workflow
      this.generateApprovalWorkflow(exitRequest);

      // Create separate approval workflow object
      const approvalWorkflow: EmployeeExitApprovalWorkflow = {
        exitId: exitRequest.exitId,
        approvalWorkflow: this.approvalWorkflow,
        departmentApprovals: this.departmentApprovals,
        currentApprovalStep: 1,
        overallStatus: 'PENDING',
        submittedDate: new Date().toISOString()
      };

      // Call API with just the exit request (without approval workflow)
      this.api.InsertEmployeeExit(exitRequest).subscribe({
        next: (response: any) => {
          console.log('Form submitted successfully:', response);
          this.isSubmitting = false;

          if (response && response.success) {
            // Show success message
            this.toastr.success('Form submitted successfully! Your request is now being processed.', 'Submission Successful');

            // Update workflow progress
            this.updateWorkflowProgress();

            this.cdr.detectChanges();
            setTimeout(() => {
              this.ensureAllCardsVisible();
            }, 100);

            // Redirect to listing page after successful submission
            setTimeout(() => {
              const redirectRoute = this.getRedirectRoute();
              this.router.navigate([redirectRoute]);
            }, 2000); // Wait 2 seconds to show success message
          } else {
            this.toastr.error('Form submission failed: ' + (response?.message || 'Unknown error'), 'Submission Error');
          }
        },
        error: (error) => {
          console.error('Form submission error:', error);
          this.isSubmitting = false;
          this.toastr.error('Form submission failed. Please try again.', 'Network Error');
        }
      });
    } catch (error) {
      console.error('Error preparing form data:', error);
      this.isSubmitting = false;
      this.toastr.error('Error preparing form data. Please check your inputs.', 'Data Error');
    }
  }

    
  private getBaseUrl(): string {
    return window.location.origin + "/AdrakMPRUI/";
  }


  private prepareExitRequest(): EmployeeExitRequest {
    const formValue = this.exitForm.getRawValue(); // Use getRawValue to get disabled field values

    // Prepare responsibilities array for all form types that use responsibilities
    const responsibilities: EmployeeExitResponsibility[] = [];
    if ((this.formType === 'E' || this.formType === 'P' || this.formType === 'R') && formValue.responsibilities) {
      formValue.responsibilities.forEach((resp: any) => {
        responsibilities.push({
          activities: resp.activities || '',
          project: resp.project || '',
          rpersonPhone: resp.responsiblePersonPhone || '',
          rpersonEmail: resp.responsiblePersonEmail || '',
          rpersonEmpId: resp.responsiblePersonId || resp.responsiblePersonName || '', // Use ID if available, fallback to name
          remarks: resp.remarks || ''
        });
      });
    }

    // Format dates properly
    const formatDate = (date: any): string => {
      if (!date) return '';
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    };

    const exitRequest: EmployeeExitRequest = {
      exitId : this.route.snapshot.queryParams['exitID'] || this.route.snapshot.queryParams['exitId'] || 0,
      employeeId: formValue.employeeId || '',
      employeeName: formValue.employeeName || '',
      emailId: formValue.emailId || '',
      formType: this.formType, // 'E' for Emergency, 'P' for Planned, 'R' for Resignation
      dateOfDeparture: formatDate(formValue.dateOfDeparture),
      dateArrival: formValue.dateOfArrival ? formatDate(formValue.dateOfArrival) : undefined,
      flightTime: formValue.flightTime || '',
      responsibilitiesHanded: '', // No longer using single dropdown - using responsibilities array for all types
      noOfDaysApproved: parseInt(formValue.noOfDaysApproved) || 0,
      depHod: formValue.hodName || '',
      projectSiteIncharge: formValue.projectManagerName || '', // Fix: use projectManagerName from form
      reasonForLeave: formValue.reasonForEmergency || '',
      approvalStatus: 'P',
      category: this.mapCategoryToBackend(formValue.category || ''), // Map Staff/Worker to S/W
      responsibilitiesHandedOverToPhone: formValue.responsibilitiesHandedOverToPhone || '', // Phone number for P/R forms
      responsibilitiesHandedOverToEmail: formValue.responsibilitiesHandedOverToEmail || '', // Email for P/R forms
      lastWorkingDate: this.formType === 'R' ? formatDate(formValue.dateOfDeparture) : undefined,
      NoticePeriod: this.formType === 'R' ? parseInt(formValue.noOfDaysApproved) || 0 : 0,
      declaration1: formValue.decInfoAccurate ? 'Y' : 'N',
      declaration2: formValue.decHandoverComplete ? 'Y' : 'N',
      declaration3: formValue.decReturnAssets ? 'Y' : 'N',
      declaration4: formValue.decUnderstandReturn ? 'Y' : 'N',
      responsibilities: responsibilities,
      baseurl:this.getBaseUrl()
    };

    console.log('Prepared exit request:', exitRequest);
    return exitRequest;
  }

  // Disable employee information fields (they should always be read-only)
  disableEmployeeInfoFields(): void {
    console.log('Disabling employee information fields');
    console.log('Current form values before disabling:', {
      employeeName: this.exitForm.get('employeeName')?.value,
      employeeId: this.exitForm.get('employeeId')?.value,
      department: this.exitForm.get('department')?.value,
      designation: this.exitForm.get('designation')?.value
    });

    // Only disable employeeId, department, and designation - keep employeeName and emailId editable
    this.exitForm.get('employeeId')?.disable();
    this.exitForm.get('department')?.disable();
    this.exitForm.get('designation')?.disable();

    // Keep employeeName and emailId enabled for user input
    this.exitForm.get('employeeName')?.enable();
    this.exitForm.get('emailId')?.enable();

    // Mark disabled fields as valid even when disabled
    this.exitForm.get('employeeId')?.setErrors(null);
    this.exitForm.get('department')?.setErrors(null);
    this.exitForm.get('designation')?.setErrors(null);

    console.log('Form values after disabling:', {
      employeeName: this.exitForm.get('employeeName')?.value,
      employeeId: this.exitForm.get('employeeId')?.value,
      department: this.exitForm.get('department')?.value,
      designation: this.exitForm.get('designation')?.value
    });
  }

  /**
   * Enable all form fields except employee info fields (for regular form usage)
   */
  enableFormFields(): void {
    console.log('Enabling all form fields except employee info fields');
    Object.keys(this.exitForm.controls).forEach(key => {
      // Don't enable employeeId and department - they should always be disabled
      // But allow employeeName and emailId to be enabled for user input
      if (key !== 'employeeId' && key !== 'department') {
        this.exitForm.get(key)?.enable();
      }
    });
  }

  /**
   * Disable all form fields for view mode
   */
  disableAllFormFields(): void {
    console.log('Disabling all form fields for view mode');
    Object.keys(this.exitForm.controls).forEach(key => {
      this.exitForm.get(key)?.disable();
    });

    // Also disable responsibilities form array
    const responsibilities = this.exitForm.get('responsibilities') as FormArray;
    if (responsibilities) {
      responsibilities.controls.forEach(control => {
        control.disable();
      });
    }
  }

  shouldShowWorkflowSidebar(): boolean {
    // Always show workflow sidebar except when form is submitted
    return !this.formSubmitted;
  }

  // Placeholder methods - these would need to be implemented based on your requirements
  updateValidatorsForFormType(): void {
    // Contact details are NEVER required - they are display-only from profile
    this.exitForm.get('address')?.clearValidators();
    this.exitForm.get('telephoneMobile')?.clearValidators();
    this.exitForm.get('emailId')?.clearValidators();
    this.exitForm.get('telephoneLandline')?.clearValidators();
    this.exitForm.get('district')?.clearValidators();
    this.exitForm.get('place')?.clearValidators();
    this.exitForm.get('state')?.clearValidators();
    this.exitForm.get('postOffice')?.clearValidators();
    this.exitForm.get('nation')?.clearValidators();

    if (this.formType === 'E') {
      // Emergency form - only planned leave and resignation fields are not required
      this.exitForm.get('category')?.clearValidators();
      this.exitForm.get('projectManagerName')?.clearValidators();
      // Remove old single dropdown validators (no longer used)
      this.exitForm.get('responsibilitiesHandedOverTo')?.clearValidators();
      this.exitForm.get('responsibilitiesHandedOverToPhone')?.clearValidators();
      this.exitForm.get('responsibilitiesHandedOverToEmail')?.clearValidators();

    } else if (this.formType === 'P') {
      // Planned leave specific fields are required
      this.exitForm.get('category')?.setValidators([Validators.required]);
      this.exitForm.get('projectManagerName')?.clearValidators(); // Remove required validation
      // Add validators for phone and email fields
      this.exitForm.get('responsibilitiesHandedOverToPhone')?.setValidators([Validators.required, Validators.pattern(/^[+]?[0-9\s\-()]{7,15}$/)]);
      this.exitForm.get('responsibilitiesHandedOverToEmail')?.setValidators([Validators.required, Validators.email]);
      // Remove old single dropdown validators (now using responsibilities array)
      this.exitForm.get('responsibilitiesHandedOverTo')?.clearValidators();

    } else if (this.formType === 'R') {
      // Resignation specific fields are required (reuse existing fields)
      this.exitForm.get('category')?.setValidators([Validators.required]);
      this.exitForm.get('projectManagerName')?.clearValidators(); // Remove required validation
      // Add validators for phone and email fields
      this.exitForm.get('responsibilitiesHandedOverToPhone')?.setValidators([Validators.required, Validators.pattern(/^[+]?[0-9\s\-()]{7,15}$/)]);
      this.exitForm.get('responsibilitiesHandedOverToEmail')?.setValidators([Validators.required, Validators.email]);
      // Remove old single dropdown validators (now using responsibilities array)
      this.exitForm.get('responsibilitiesHandedOverTo')?.clearValidators();
    }

    // Update validity after changing validators
    Object.keys(this.exitForm.controls).forEach(key => {
      this.exitForm.get(key)?.updateValueAndValidity();
    });
  }

  loadHodMasterList(): void {
    console.log('Loading HOD master list...');
    this.api.GetHodMasterList().subscribe({
      next: (response: any) => {
        console.log('HOD API Response:', response);
        
        // Handle different possible response structures
        let dataArray = null;
        
        if (response && response.success && response.data) {
          // Standard success response with data property
          dataArray = response.data;
          console.log('Using response.data:', dataArray);
        } else if (response && Array.isArray(response)) {
          // Direct array response
          dataArray = response;
          console.log('Using direct array response:', dataArray);
        } else if (response && response.data && Array.isArray(response.data)) {
          // Response with data property (no success flag)
          dataArray = response.data;
          console.log('Using response.data (no success flag):', dataArray);
        } else if (response && typeof response === 'object') {
          // Try to find any array property in the response
          const keys = Object.keys(response);
          for (const key of keys) {
            if (Array.isArray(response[key])) {
              dataArray = response[key];
              console.log(`Using response.${key}:`, dataArray);
              break;
            }
          }
        }
        
        if (dataArray && Array.isArray(dataArray)) {
          console.log('Raw HOD data:', dataArray);
          this.hodList = dataArray.map((hod: any) => {
            const mapped = {
              idValue: hod.idValue || hod.empId || hod.id || hod.employeeId || hod.EmpId || hod.ID,
              description: hod.description || hod.employeeName || hod.name || hod.Name || hod.EmployeeName || `${hod.firstName || hod.FirstName || ''} ${hod.lastName || hod.LastName || ''}`.trim()
            };
            console.log('Mapping HOD:', hod, ' -> ', mapped);
            return mapped;
          });
          console.log('Final mapped HOD list:', this.hodList);
        } else {
          console.warn('Could not find array data in HOD response:', response);
          this.hodList = [];
        }
      },
      error: (error: any) => {
        console.error('Error loading HOD master list:', error);
        this.hodList = [];
      }
    });
  }

  loadProjectManagerList(): void {
    this.api.GetProjectManagerList().subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.projectManagerList = response.data.map((pm: any) => ({
            idValue: pm.idValue || pm.empId || pm.id || pm.employeeId,
            description: pm.description || pm.employeeName || pm.name
          }));
          console.log('Project Manager List loaded:', this.projectManagerList);
        }
      },
      error: (error: any) => {
        console.error('Error loading project manager list:', error);
      }
    });
  }

  loadEmployeeMasterList(): void {
    console.log('Loading employee master list...');
    this.api.GetEmployeeMasterList().subscribe({
      next: (response: any) => {
        console.log('Employee Master API Response:', response);
        if (response && response.success && response.data) {
          this.employeeMasterList = response.data.map((emp: any) => ({
            idValue: emp.idValue || emp.empId || emp.id || emp.employeeId,
            description: emp.description || emp.employeeName || emp.name,
            email: emp.email || emp.Email || emp.emailId || emp.EmailId,
            phoneNumber: emp.phoneNumber || emp.PhoneNumber || emp.phone || emp.Phone
          }));
          console.log('Employee Master List loaded:', this.employeeMasterList);
          
          // Trigger change detection to update display names
          this.cdr.detectChanges();
          
          // Sync input field values
          this.syncInputFieldValues();
        } else {
          console.warn('Employee Master API response structure unexpected:', response);
          // Try to handle different response structures
          if (response && Array.isArray(response)) {
            console.log('Employee Master Response is direct array, mapping...');
            this.employeeMasterList = response.map((emp: any) => ({
              idValue: emp.idValue || emp.empId || emp.id || emp.employeeId,
              description: emp.description || emp.employeeName || emp.name,
              email: emp.email || emp.Email || emp.emailId || emp.EmailId,
              phoneNumber: emp.phoneNumber || emp.PhoneNumber || emp.phone || emp.Phone
            }));
            console.log('Mapped Employee Master from direct array:', this.employeeMasterList);
          }
        }
      },
      error: (error: any) => {
        console.error('Error loading employee master list:', error);
      }
    });
  }

  loadEmployeeDetails(): void {
    const empId = this.currentUser?.empId;
    if (empId) {
      this.api.GetExitEmployeeDetails(empId).subscribe({
        next: (response: any) => {
          console.log('GetExitEmployeeDetails API Response:', response);
          
          // Handle different possible response structures
          let data = null;
          if (response && response.success && response.data) {
            data = response.data;
          } else if (response && !response.success && response) {
            // Sometimes API might return data directly without success wrapper
            data = response;
          }
          
          if (data) {
            console.log('Employee data:', data);
            console.log('Available fields:', Object.keys(data));
            console.log('actProfession value:', data.actProfession);
            
            // Capture designation from actProfession field
            this.employeeDesignation = data.actProfession || '';

            // Capture Date of Joining if this response has it
            if (data.doj) {
              this.employeeDoj = this.parseDojToIso(data.doj);
            }

            // Trigger change detection to update the UI
            this.cdr.detectChanges();

            // Update form with employee details - using correct field names from API
            this.exitForm.patchValue({
              employeeName: data.employeeName || '',
              employeeId: data.empId || '',
              department: data.empDept || data.department || '', // Use empDept from API
              emailId: data.email || '',
              hodName: data.depHoD || '',
              // Auto-fill phone and email for planned and resignation forms
              responsibilitiesHandedOverToPhone: (this.formType === 'P' || this.formType === 'R') ? (data.phone || '') : '',
              responsibilitiesHandedOverToEmail: (this.formType === 'P' || this.formType === 'R') ? (data.email || '') : ''
            });
            
            // Trigger change detection to update the UI
            this.cdr.detectChanges();
            
            // Auto-fill phone and email fields after details are loaded
            setTimeout(() => {
              this.autoFillPhoneAndEmail();
            }, 100);
          }
        },
        error: (error: any) => {
          console.error('Error loading employee details:', error);
        }
      });
    }
  }

  populateFormFromApprovalData(): void {
    if (this.approvalRequestData) {
      const request = this.approvalRequestData;

      // Set approval status from request data
      this.approvalStatus = request.approvalStatus || request.status || 'P';
      console.log('Approval status from request data:', this.approvalStatus);

      // Format date for input fields
      const formatDateForInput = (dateString: string): string => {
        if (!dateString) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
        if (/^\d{4}-\d{2}-\d{2}T/.test(dateString)) return dateString.substring(0, 10);
        const parts = dateString.split('-');
        if (parts.length === 3 && parts[0].length === 2) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      // Populate basic form fields - using flexible names to support both listing data and full saved data
      this.exitForm.patchValue({
        employeeName: request.employeeName || request.EmployeeName || request.name || '',
        employeeId: request.employeeId || request.employeeID || request.empId || '',
        department: request.department || '',
        dateOfDeparture: formatDateForInput(request.dateOfDeparture || request.departureDate),
        dateOfArrival: formatDateForInput(request.dateArrival || request.arrivalDate || request.returnDate),
        flightTime: request.flightTime || '',
        noOfDaysApproved: request.noOfDaysApproved || request.daysRequested || 0,
        reasonForEmergency: request.reasonForLeave || request.reason || '',
        hodName: request.depHod || request.hodName || '',
        projectManagerName: request.projectSiteIncharge || request.projectManagerName || '', // Store ID
        category: this.mapCategoryFromBackend(request.category || ''), // Map S/W to Staff/Worker
        responsibilitiesHandedOverToPhone: request.responsibilitiesHandedOverToPhone || request.phoneNumber || '',
        responsibilitiesHandedOverToEmail: request.responsibilitiesHandedOverToEmail || request.emailId || '',
        emailId: request.emailId || ''
      });

      // Disable all form fields for approval/view mode
      this.disableAllFormFields();

      // Also fetch extended details and photo if employeeId is available
      const empId = request.employeeId || request.employeeID || request.empId;
      if (empId) {
        this.loadEmployeeDetailsById(empId);
      }
    }
  }

  resetFormCompletely(): void {
    console.log('Resetting form completely for new entry');

    // Clear arrays
    this.responsibilitiesFormArray.clear();
    this.approvalWorkflow = [];

    // Reset flags
    this.formSubmitted = false;
    this.employeePhoto = 'assets/images/default-avatar.png';
    this.employeeDesignation = ''; // Reset designation
    this.employeeDoj = '';         // Reset date of joining

    // Reset responsibilities section to open state
    this.isResponsibilitiesSectionOpen = true;

    // Reset form with identity fields cleared
    this.exitForm.reset({
      formType: this.formType,
      hodName: '', // Explicitly set HOD to empty string
      noOfDaysApproved: 0,
      decInfoAccurate: false,
      decHandoverComplete: false,
      decReturnAssets: false,
      decUnderstandReturn: false
    });

    // Re-enable fields if they were disabled
    this.enableFormFields();
  }

  updateFormValidations(): void {
    this.updateValidatorsForFormType();
  }

  /**
   * Auto-fill phone and email fields for planned and resignation forms
   */
  autoFillPhoneAndEmail(): void {
    if (this.formType === 'P' || this.formType === 'R') {
      // Get current values from form or session
      const currentPhone = this.exitForm.get('telephoneMobile')?.value || 
                          this.currentUser?.phone || 
                          this.exitForm.get('responsibilitiesHandedOverToPhone')?.value || '';
      const currentEmail = this.exitForm.get('emailId')?.value || 
                          this.currentUser?.email || 
                          this.exitForm.get('responsibilitiesHandedOverToEmail')?.value || '';
      
      // Only update if fields are empty
      if (!this.exitForm.get('responsibilitiesHandedOverToPhone')?.value && currentPhone) {
        this.exitForm.patchValue({
          responsibilitiesHandedOverToPhone: currentPhone
        });
      }
      
      if (!this.exitForm.get('responsibilitiesHandedOverToEmail')?.value && currentEmail) {
        this.exitForm.patchValue({
          responsibilitiesHandedOverToEmail: currentEmail
        });
      }
      
      console.log('Auto-filled phone and email fields:', {
        formType: this.formType,
        phone: currentPhone,
        email: currentEmail
      });
    }
  }



  validateEmployeeInfo(): boolean {
    // Disabled fields (employee info) - check if they have values
    const disabledFields = ['employeeId', 'department'];
    for (const field of disabledFields) {
      const control = this.exitForm.get(field);
      if (!control || !control.value) {
        console.log('Validation failed for disabled field:', field, 'Value:', control?.value);
        return false;
      }
    }

    // Regular required fields that are editable (including employeeName and emailId)
    let requiredFields = ['employeeName', 'emailId', 'dateOfDeparture', 'noOfDaysApproved', 'reasonForEmergency', 'hodName'];

    // Add planned leave and resignation specific validations
    if (this.formType === 'P' || this.formType === 'R') {
      requiredFields.push('category', 'responsibilitiesHandedOverTo'); // Removed projectManagerName
    }

    for (const field of requiredFields) {
      const control = this.exitForm.get(field);
      if (!control || !control.value || control.invalid) {
        console.log('Validation failed for field:', field, 'Value:', control?.value, 'Invalid:', control?.invalid);
        control?.markAsTouched();
        return false;
      }
    }
    return true;
  }

  validateResponsibilities(): boolean {
    const responsibilities = this.responsibilitiesFormArray;

    if (responsibilities.length === 0) {
      return false;
    }

    for (let i = 0; i < responsibilities.length; i++) {
      const group = responsibilities.at(i) as FormGroup;

      if (group.invalid) {
        Object.keys(group.controls).forEach(key => {
          const control = group.get(key);
          if (control && control.invalid) {
            control.markAsTouched();
          }
        });
        return false;
      }
    }
    return true;
  }



  validateFormForCurrentType(): boolean {
    const formValue = this.exitForm.value;
    const rawFormValue = this.exitForm.getRawValue(); // Get disabled field values too

    console.log('=== VALIDATION DEBUG ===');
    console.log('Form Type:', this.formType);
    console.log('Form Values:', formValue);
    console.log('Raw Form Values:', rawFormValue);

    // Common required fields - mix of enabled and disabled fields
    if (!rawFormValue.employeeName) {
      console.log('Validation failed: employeeName missing');
      return false;
    }
    if (!rawFormValue.employeeId) {
      console.log('Validation failed: employeeId missing');
      return false;
    }
    if (!rawFormValue.department) {
      console.log('Validation failed: department missing');
      return false;
    }
    if (!formValue.dateOfDeparture) {
      console.log('Validation failed: dateOfDeparture missing');
      return false;
    }
    if (!formValue.noOfDaysApproved || formValue.noOfDaysApproved < 1) {
      console.log('Validation failed: noOfDaysApproved missing or invalid');
      return false;
    }
    if (!formValue.reasonForEmergency) {
      console.log('Validation failed: reasonForEmergency missing');
      return false;
    }
    if (!formValue.hodName) {
      console.log('Validation failed: hodName missing');
      return false;
    }

    // Planned leave and resignation specific fields
    if (this.formType === 'P' || this.formType === 'R') {
      if (!formValue.category) {
        console.log('Validation failed: category missing for P/R form');
        return false;
      }
      
      // Project Manager is now optional - no validation needed
      
      // Check phone number
      if (!formValue.responsibilitiesHandedOverToPhone) {
        console.log('Validation failed: responsibilitiesHandedOverToPhone missing for P/R form');
        return false;
      }
      
      // Check email
      if (!formValue.responsibilitiesHandedOverToEmail) {
        console.log('Validation failed: responsibilitiesHandedOverToEmail missing for P/R form');
        return false;
      }
      
      // Validate responsibilities for planned and resignation forms
      const responsibilitiesValid = this.validateResponsibilities();
      if (!responsibilitiesValid) {
        console.log('Validation failed: responsibilities invalid for P/R form');
        return false;
      }
    }

    // Emergency form - validate responsibilities
    if (this.formType === 'E') {
      const responsibilitiesValid = this.validateResponsibilities();
      if (!responsibilitiesValid) {
        console.log('Validation failed: responsibilities invalid for E form');
        return false;
      }
    }

    console.log('Validation passed for form type:', this.formType);
    console.log('=== END VALIDATION DEBUG ===');
    return true;
  }

  markAllFieldsAsTouched(): void {
    // Mark all main form controls as touched
    Object.keys(this.exitForm.controls).forEach(key => {
      this.exitForm.get(key)?.markAsTouched();
    });

    // Mark all responsibility form controls as touched for all form types that use responsibilities
    if (this.formType === 'E' || this.formType === 'P' || this.formType === 'R') {
      const responsibilities = this.responsibilitiesFormArray;
      responsibilities.controls.forEach(group => {
        const responsibilityGroup = group as FormGroup;
        Object.keys(responsibilityGroup.controls).forEach(key => {
          responsibilityGroup.get(key)?.markAsTouched();
        });
      });
    }
  }

  /**
   * Show specific validation errors for debugging and user feedback
   */
  showValidationErrors(): void {
    console.log('=== VALIDATION ERRORS ===');
    const formValue = this.exitForm.value;
    const rawFormValue = this.exitForm.getRawValue();
    
    const requiredFields = ['employeeName', 'employeeId', 'department', 'dateOfDeparture', 'noOfDaysApproved', 'reasonForEmergency', 'hodName'];
    
    if (this.formType === 'P' || this.formType === 'R') {
      requiredFields.push('category', 'responsibilitiesHandedOverToPhone', 'responsibilitiesHandedOverToEmail'); // Removed projectManagerName
    }
    
    const missingFields: string[] = [];
    const fieldLabels: { [key: string]: string } = {
      'employeeName': 'Employee Name',
      'employeeId': 'Employee ID',
      'department': 'Department/Site',
      'dateOfDeparture': this.formType === 'R' ? 'Last Working Date' : 'Date of Departure',
      'noOfDaysApproved': this.formType === 'R' ? 'Notice Period (Days)' : 'No. of Days Requested',
      'reasonForEmergency': this.formType === 'E' ? 'Reason for Emergency' : (this.formType === 'R' ? 'Reason for Resignation' : 'Reason for Planned Leave'),
      'hodName': 'HOD Name',
      'category': 'Category',
      'responsibilitiesHandedOverToPhone': 'Phone Number',
      'responsibilitiesHandedOverToEmail': 'Email ID'
    };
    
    requiredFields.forEach(field => {
      const value = rawFormValue[field] || formValue[field];
      const control = this.exitForm.get(field);
      
      if (!value || (field === 'noOfDaysApproved' && value < 1)) {
        console.log(`❌ ${field}: "${value}" (missing or invalid)`);
        console.log(`   Control status: ${control?.status}, Errors:`, control?.errors);
        missingFields.push(fieldLabels[field] || field);
      } else {
        console.log(`✅ ${field}: "${value}"`);
      }
    });

    // Check responsibilities for all form types that use them
    if (this.formType === 'E' || this.formType === 'P' || this.formType === 'R') {
      const responsibilities = this.responsibilitiesFormArray;
      if (responsibilities.length === 0) {
        missingFields.push('At least one Responsibility');
      } else {
        responsibilities.controls.forEach((group, index) => {
          const responsibilityGroup = group as FormGroup;
          const project = responsibilityGroup.get('project')?.value;
          const activities = responsibilityGroup.get('activities')?.value;
          const personName = responsibilityGroup.get('responsiblePersonName')?.value;
          const personPhone = responsibilityGroup.get('responsiblePersonPhone')?.value;
          const personEmail = responsibilityGroup.get('responsiblePersonEmail')?.value;

          if (!project) missingFields.push(`Responsibility ${index + 1}: Project`);
          if (!activities) missingFields.push(`Responsibility ${index + 1}: Activities`);
          if (!personName) missingFields.push(`Responsibility ${index + 1}: Responsible Person Name`);
          if (!personPhone) missingFields.push(`Responsibility ${index + 1}: Phone Number`);
          if (!personEmail) missingFields.push(`Responsibility ${index + 1}: Email ID`);
        });
      }
    }

    // Show user-friendly error message with specific missing fields
    if (missingFields.length > 0) {
      const errorMessage = `Please fill in the following required fields:\n\n• ${missingFields.join('\n• ')}`;
      this.toastr.error(errorMessage, 'Missing Required Fields', {
        timeOut: 10000, // Show for 10 seconds
        extendedTimeOut: 5000,
        enableHtml: true,
        closeButton: true
      });
    }
    
    console.log('=== END VALIDATION ERRORS ===');
  }

  allDeclarationsChecked(): boolean {
    const formValue = this.exitForm.value;
    return formValue.decInfoAccurate &&
      formValue.decHandoverComplete &&
      formValue.decReturnAssets &&
      formValue.decUnderstandReturn;
  }

  showMissingDeclarations(): void {
    const formValue = this.exitForm.value;
    const missingDeclarations: string[] = [];

    if (!formValue.decInfoAccurate) {
      missingDeclarations.push('I confirm that all information provided is accurate and complete');
    }
    if (!formValue.decHandoverComplete) {
      if (this.formType === 'E') {
        missingDeclarations.push('I have handed over all my responsibilities to the designated personnel');
      } else {
        const personName = this.exitForm.get('responsibilitiesHandedOverTo')?.value || 'the designated person';
        missingDeclarations.push(`I have properly handed over my responsibilities to ${personName}`);
      }
    }
    if (!formValue.decReturnAssets) {
      const timeText = this.formType === 'E' ? 'before departure' : 
                      (this.formType === 'P' ? 'before my planned departure' : 'before my last working day');
      missingDeclarations.push(`I will return all company assets (laptop, phone, keys, etc.) ${timeText}`);
    }
    if (!formValue.decUnderstandReturn) {
      if (this.formType === 'E') {
        missingDeclarations.push('I understand this is an emergency exit and I will return as per the approved dates');
      } else if (this.formType === 'P') {
        missingDeclarations.push('I understand this is a planned leave and I will return as per the approved schedule');
      } else {
        missingDeclarations.push('I understand this is a resignation and I will complete the full notice period as required');
      }
    }

    if (missingDeclarations.length > 0) {
      const errorMessage = `Please check the following declarations:\n\n• ${missingDeclarations.join('\n• ')}`;
      this.toastr.error(errorMessage, 'Missing Declarations', {
        timeOut: 10000,
        extendedTimeOut: 5000,
        enableHtml: true,
        closeButton: true
      });
    }
  }

  validateEmailAndPhone(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[+]?[0-9\s\-()]{7,15}$/;

    // Validate responsibility emails for Emergency forms
    if (this.formType === 'E') {
      const responsibilities = this.exitForm.value.responsibilities;
      if (responsibilities) {
        for (let i = 0; i < responsibilities.length; i++) {
          const resp = responsibilities[i];
          if (resp.responsiblePersonEmail && !emailRegex.test(resp.responsiblePersonEmail)) {
            this.toastr.error(`Please enter a valid email address for responsibility ${i + 1}.`, 'Validation Error');
            return false;
          }
          if (resp.responsiblePersonPhone && !phoneRegex.test(resp.responsiblePersonPhone)) {
            this.toastr.error(`Please enter a valid phone number for responsibility ${i + 1}.`, 'Validation Error');
            return false;
          }
        }
      }
    }

    return true;
  }

  generateApprovalWorkflow(exitRequest: EmployeeExitRequest): void {
    // Generate approval workflow based on form type
    this.approvalWorkflow = [];
    this.departmentApprovals = [];

    // This would typically call the approval workflow service
    // For now, just initialize empty arrays
    console.log('Generating approval workflow for:', exitRequest.formType);
  }

  updateWorkflowProgress(): void {
    // Calculate workflow progress based on completed steps
    // Use complete workflow data (including hidden steps) for accurate progress calculation
    const totalSteps = this.getAllApprovalWorkflowSteps().length;
    const completedSteps = this.getAllApprovalWorkflowSteps().filter(step => step.status === 'APPROVED').length;
    this.workflowProgress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  }

  ensureAllCardsVisible(): void {
    // Force all department cards to be visible immediately
    this.cdr.detectChanges();
    setTimeout(() => {
      const cards = document.querySelectorAll('.department-card');
      cards.forEach((card) => {
        const element = card as HTMLElement;
        element.style.display = 'block';
        element.style.opacity = '1';
        element.style.visibility = 'visible';
      });
    }, 50);
  }



  // Additional methods needed by the HTML template
  getContextualTitle(): string {
    if (this.isApprovalMode || this.approvalRequestData) {
      return this.formType === 'E' ? 'Emergency Exit Request' : (this.formType === 'R' ? 'Resignation Request' : 'Planned Leave Request');
    }
    return this.formType === 'E' ? 'Emergency Exit Form' : (this.formType === 'R' ? 'Resignation Form' : 'Planned Leave Form');
  }

  getContextualDescription(): string {
    if (this.isApprovalMode || this.approvalRequestData) {
      return 'Review and approve the request details below';
    }
    return this.formType === 'E' ? 'Submit your emergency exit request' : (this.formType === 'R' ? 'Submit your resignation request' : 'Submit your planned leave request');
  }

  getAllApprovalStatus(): string {
    return this.mapApprovalStatusToDisplay(this.approvalStatus);
  }

  /**
   * Map backend approval status codes to display format
   */
  mapApprovalStatusToDisplay(status: string): string {
    if (!status) return 'pending';
    
    switch (status.toUpperCase()) {
      case 'A': 
      case 'APPROVED': 
        return 'approved';
      case 'R': 
      case 'REJECTED': 
        return 'rejected';
      case 'P': 
      case 'PENDING': 
        return 'pending';
      case 'I': 
      case 'IN_PROGRESS': 
      case 'INPROGRESS': 
        return 'in-progress';
      default: 
        return status.toLowerCase();
    }
  }

  /**
   * Get the display text for approval status
   */
  getApprovalStatusText(): string {
    const status = this.mapApprovalStatusToDisplay(this.approvalStatus);
    switch (status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'pending': return 'Pending';
      case 'in-progress': return 'In Progress';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  switchFormType(newType: 'E' | 'P' | 'R'): void {
    if (this.isApprovalMode || this.isViewMode) return;
    if (this.formType !== newType) {
      this.formType = newType;
      this.updateFormValidations();
      
      // Auto-fill phone and email fields for planned and resignation forms
      setTimeout(() => {
        this.autoFillPhoneAndEmail();
      }, 100);
      
      // Setup date change listeners for the new form type
      this.setupDateChangeListeners();
      
      // Initialize responsibilities section for all form types that use it
      setTimeout(() => {
        this.ensureResponsibilitiesSectionInitialized();
      }, 100);
      
      // Update URL without navigation - preserve base URL in production
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('type', newType);
      window.history.replaceState({}, '', currentUrl.pathname + currentUrl.search);
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.exitForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.exitForm.get(fieldName);
    if (field && field.errors) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['email']) return 'Please enter a valid email';
      if (field.errors['min']) return `Minimum value is ${field.errors['min'].min}`;
    }
    return '';
  }

  trackByHodId(index: number, item: DropdownOption): any {
    return item.idValue;
  }

  returnToApprovalListing(): void {
    if (this.returnUrl) {
      this.router.navigateByUrl(this.returnUrl);
    } else {
      this.router.navigate(['/leave-approval']);
    }
  }

  /**
   * Get the appropriate redirect route after form submission based on user context
   */
  getRedirectRoute(): string {
    // You can customize this based on your application's routing structure
    // Check user role or other factors to determine the correct route
    if (this.currentUser?.role === 'employee') {
      return '/employee-dashboard';
    } else if (this.currentUser?.role === 'hod') {
      return '/hod-dashboard';
    } else if (this.currentUser?.role === 'ced') {
      return '/ced-dashboard';
    }
    
    // Default fallback routes
    return '/employee-dashboard'; // or '/dashboard' or whatever your main listing page is
  }

  // Project Manager dropdown methods
  pmSearchTerm: string = '';
  isPMDropdownOpen: boolean = false;

  onPMSearchInputChange(event: any): void {
    this.pmSearchTerm = event.target?.value || '';
    // Clear the selected value when user starts typing to search
    if (this.pmSearchTerm !== this.getProjectManagerDisplayName()) {
      // User is typing something different, clear the selection
      this.exitForm.patchValue({
        projectManagerName: '' // Clear the stored ID
      });
    }
  }

  showPMDropdown(): void {
    // Initialize search term with current display value for better UX
    this.pmSearchTerm = this.getProjectManagerDisplayName();
    this.isPMDropdownOpen = true;
  }

  hidePMDropdown(): void {
    setTimeout(() => {
      this.isPMDropdownOpen = false;
    }, 200);
  }

  isPMDropdownVisible(): boolean {
    return this.isPMDropdownOpen;
  }

  shouldUseSmallDropdown(searchTerm: string): boolean {
    return searchTerm.length > 2;
  }

  getFilteredProjectManagers(searchTerm: string): DropdownOption[] {
    // Use employeeMasterList for consistency with other dropdowns
    const list = this.employeeMasterList || [];
    if (!searchTerm || searchTerm.trim() === '') return list;
    
    return list.filter(pm =>
      pm.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  selectProjectManager(pm: DropdownOption): void {
    this.exitForm.patchValue({
      projectManagerName: pm.idValue // Save the ID instead of description
    });
    this.pmSearchTerm = pm.description || ''; // Update search term to show selected name
    this.isPMDropdownOpen = false;
    
    // Update the input field value immediately
    const inputElement = document.getElementById('projectManagerName') as HTMLInputElement;
    if (inputElement) {
      inputElement.value = pm.description || '';
    }
  }

  isPMSelected(pm: DropdownOption): boolean {
    return this.exitForm.get('projectManagerName')?.value === pm.idValue;
  }

  getEmployeeNameFromDescription(description: string): string {
    return description.split(' - ')[0] || description;
  }

  /**
   * Get the display name for responsible person from the stored ID
   */
  getResponsiblePersonDisplayName(index: number): string {
    const responsibilityGroup = this.responsibilitiesFormArray.at(index) as FormGroup;
    const selectedId = responsibilityGroup.get('responsiblePersonName')?.value;
    if (!selectedId) return '';
    
    // Try to find in employee master list
    const selectedEmployee = this.employeeMasterList.find(emp => emp.idValue === selectedId);
    if (selectedEmployee) {
      return selectedEmployee.description || '';
    }
    
    // If not found and it looks like an ID (not a name), return empty to show placeholder
    if (selectedId && !selectedId.includes(' - ') && selectedId.length < 10) {
      return '';
    }
    
    // If it's already a name/description, return as is
    return selectedId;
  }

  /**
   * Map category from backend format (S/W) to display format (Staff/Worker)
   */
  mapCategoryFromBackend(category: string): string {
    if (!category) return '';
    switch (category.toUpperCase()) {
      case 'S': return 'Staff';
      case 'W': return 'Worker';
      default: return category; // Return as-is if already in full form
    }
  }

  /**
   * Map category to backend format (Staff/Worker to S/W)
   */
  mapCategoryToBackend(category: string): string {
    if (!category) return '';
    switch (category) {
      case 'Staff': return 'S';
      case 'Worker': return 'W';
      default: return category; // Return as-is if already in short form
    }
  }

  /**
   * Sync input field display values after data loading
   */
  syncInputFieldValues(): void {
    setTimeout(() => {
      // Update Project Manager input field
      const pmInputElement = document.getElementById('projectManagerName') as HTMLInputElement;
      if (pmInputElement) {
        pmInputElement.value = this.getProjectManagerDisplayName();
      }

      // Update Responsible Person Name input fields
      this.syncResponsiblePersonDisplayNames();
    }, 100);
  }

  /**
   * Sync all responsible person input fields to show names instead of IDs
   */
  syncResponsiblePersonDisplayNames(): void {
    setTimeout(() => {
      this.responsibilitiesFormArray.controls.forEach((responsibilityGroup, index) => {
        const selectedId = responsibilityGroup.get('responsiblePersonName')?.value;
        if (selectedId) {
          // Find the employee in the master list
          const selectedEmployee = this.employeeMasterList.find(emp => emp.idValue === selectedId);
          if (selectedEmployee) {
            // Update the form control with the display name
            responsibilityGroup.patchValue({
              responsiblePersonName: selectedEmployee.description
            }, { emitEvent: false });
          }
        }
      });
    }, 200);
  }

  /**
   * Get the display name for project manager from the stored ID
   */
  getProjectManagerDisplayName(): string {
    const selectedId = this.exitForm.get('projectManagerName')?.value;
    if (!selectedId) return '';
    
    // First try to find in employee master list (since we're using that now)
    const selectedPM = this.employeeMasterList.find(emp => emp.idValue === selectedId);
    if (selectedPM) {
      return selectedPM.description || '';
    }
    
    // Fallback to project manager list if not found
    const selectedPMFromPMList = this.projectManagerList.find(emp => emp.idValue === selectedId);
    if (selectedPMFromPMList) {
      return selectedPMFromPMList.description || '';
    }
    
    // If still not found, return the ID itself
    return selectedId;
  }













  // Generic method for filtering employees (used by Responsibilities Handed Over To dropdown)
  getFilteredEmployees(searchTerm: string): DropdownOption[] {
    const list = this.employeeMasterList || [];
    if (!searchTerm || searchTerm.trim() === '') return list;
    
    return list.filter(emp =>
      emp.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }





  // Responsibility dropdown methods
  responsibilitySearchTerms: string[] = [];
  dropdownVisibility: boolean[] = [];

  isDropdownVisible(index: number): boolean {
    return this.dropdownVisibility[index] || false;
  }

  getSearchTerm(index: number): string {
    return this.responsibilitySearchTerms[index] || '';
  }

  showDropdown(index: number): void {
    this.dropdownVisibility[index] = true;
  }

  hideDropdown(index: number): void {
    setTimeout(() => {
      this.dropdownVisibility[index] = false;
    }, 200);
  }

  onSearchInputChange(event: any, index: number): void {
    this.responsibilitySearchTerms[index] = event.target?.value || '';
  }

  selectEmployee(index: number, employee: DropdownOption): void {
    const responsibilityGroup = this.responsibilitiesFormArray.at(index) as FormGroup;
    responsibilityGroup.patchValue({
      responsiblePersonName: employee.description,
      responsiblePersonId: employee.idValue,
      responsiblePersonPhone: employee.phoneNumber || '',
      responsiblePersonEmail: employee.email || ''
    });
    this.dropdownVisibility[index] = false;
  }

  isEmployeeSelected(index: number, employee: DropdownOption): boolean {
    const responsibilityGroup = this.responsibilitiesFormArray.at(index) as FormGroup;
    return responsibilityGroup.get('responsiblePersonName')?.value === employee.description;
  }

  ensureResponsibilitiesSectionInitialized(): void {
    if (this.formType === 'E' || this.formType === 'P' || this.formType === 'R') {
      // Ensure section is open by default
      this.isResponsibilitiesSectionOpen = true;
      
      // Add default responsibility if none exist
      if (this.responsibilitiesFormArray.length === 0) {
        this.addResponsibility();
      }
    }
  }

  toggleResponsibilitiesSection(): void {
    this.isResponsibilitiesSectionOpen = !this.isResponsibilitiesSectionOpen;
    console.log('Responsibilities section toggled:', this.isResponsibilitiesSectionOpen);
    
    // Force change detection and update DOM
    this.cdr.detectChanges();
    
    // Additional DOM update after a short delay to ensure proper rendering
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 50);
  }

  getCurrentTimestamp(): number {
    return Date.now();
  }

  canUserTakeAction(): boolean {
    // IMPORTANT: Only show "Your Action Required" when user comes with approvalID parameter
    if (!this.approvalID) {
      console.log('canUserTakeAction: No approvalID in query parameters - hiding action section');
      return false;
    }

    // Check if current user can take action based on GetEmployeeExitSavedInfo response
    if (!this.currentUser || !this.currentUser.empId) {
      return false;
    }

    if (this.getAllApprovalWorkflowSteps() && this.getAllApprovalWorkflowSteps().length > 0) {
      // Find the current stage approval in the workflow
      const currentStageApproval = this.getAllApprovalWorkflowSteps().find(approval => {
        const matches = approval.approverCode === this.currentStage &&
                       approval.approvalStatusCode === 'P' && // Pending status
                       approval.approvedId === this.currentUser.empId; // Current user is the assigned approver
        
    
        
        return matches;
      });

      const canTakeAction = !!currentStageApproval;
      return canTakeAction;
    }

    // Fallback to original logic if no workflow data available
    const fallbackResult = this.isApprovalMode && !!this.approvalID && !this.isViewMode && !this.actionTaken;
    return fallbackResult;
  }


  
  isCurrentUserApprover(): boolean {
    if (!this.currentUser || !this.getAllApprovalWorkflowSteps()) {
      return false;
    }

    // Find the current pending approval step
    const currentStep = this.approvalWorkflow.find(step => 
      step.status === 'PENDING' || step.status === 'IN_PROGRESS'
    );

    if (!currentStep) {
      return false;
    }

    // Check if current user is in the approver list for this step
    return currentStep.approverIds?.includes(this.currentUser.empId) || false;
  }

  approvalRemarks: string = '';

  approveRequest(): void {
    if (!this.approvalID) {
      this.toastr.error('Approval ID missing', 'Error');
      return;
    }

    // Show confirmation dialog
    Swal.fire({
      title: 'Confirm Approval',
      text: 'Are you sure you want to approve this request?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Approve',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.performApproval();
      }
    });
  }

  private async performApproval(): Promise<void> {
    // Get exitId from query parameters
    const exitId = this.route.snapshot.queryParams['exitID'] || this.route.snapshot.queryParams['exitId'] || this.route.snapshot.queryParams['requestId'];

    // Get approverId from current logged-in user
    const approverId = this.currentUser?.empId;

    if (!exitId) {
      this.toastr.error('Exit ID is missing', 'Error');
      this.isSubmitting = false;
      return;
    }

    if (!approverId) {
      this.toastr.error('Approver ID is missing', 'Error');
      this.isSubmitting = false;
      return;
    }

    // Generate PDF base64 when Admin (final) approver approves
    let pdfBase64: string | undefined;
    if (this.currentStage.toUpperCase() === 'ADMIN') {
      // Stamp the Admin's own step as approved locally BEFORE generating the
      // PDF, so the final approver's details appear in the workflow section
      // (the API call that records it happens right after this)
      const adminStep = this.approvalWorkflow?.find(s =>
        s.status !== 'APPROVED' && s.status !== 'REJECTED' &&
        ((s.approverCode || '').toUpperCase() === 'ADMIN'
          || (s.stepName || '').toUpperCase().includes('ADMIN'))
      ) || this.approvalWorkflow?.find(s => s.status !== 'APPROVED' && s.status !== 'REJECTED');

      if (adminStep) {
        adminStep.status = 'APPROVED';
        adminStep.approvedBy = this.currentUser?.employeeName || this.currentUser?.name
                            || adminStep.approverNames?.[0] || adminStep.approvedBy || '';
        adminStep.approvedId = this.currentUser?.empId
                            || adminStep.approverIds?.[0] || adminStep.approvedId || '';
        adminStep.approvedDate = new Date().toISOString();
        adminStep.comments = this.approvalRemarks?.trim() || adminStep.comments;
        adminStep.email = adminStep.email || this.currentUser?.email || this.currentUser?.emailId;
      }

      try {
        pdfBase64 = (await this.downloadAsPdf(true)) as string;
      } catch (pdfErr) {
        console.error('PDF generation failed during Admin approval:', pdfErr);
      }
    }

    const request: UpdateExitApprovalRequest = {
      approvalId: this.approvalID || undefined,
      exitId: parseInt(exitId),
      approverId: approverId,
      status: 'A',
      remarks: this.approvalRemarks?.trim() || undefined, // Allow empty remarks for approval,
      baseurl: this.getBaseUrl(),
      pdfBase64: pdfBase64
    };

    console.log('Approval request payload:', request);

    this.isSubmitting = true;
    this.api.UpdateExitApproval(request).subscribe({
      next: (response) => {
        if (response && response.success) {
          this.actionTaken = true; // Set flag to hide action buttons
          this.toastr.success('Request approved successfully', 'Approval Successful');
          
          // Redirect after a short delay to show success message
          setTimeout(() => {
            this.returnToApprovalListing();
          }, 2000);
        } else {
          this.toastr.error(response?.message || 'Failed to approve request', 'Error');
        }
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Error approving request:', error);
        this.toastr.error('An error occurred during approval', 'Error');
        this.isSubmitting = false;
      }
    });
  }

  rejectRequest(): void {
    if (!this.approvalID) {
      this.toastr.error('Approval ID missing', 'Error');
      return;
    }

    if (!this.approvalRemarks || !this.approvalRemarks.trim()) {
      this.toastr.warning('Please provide remarks for rejection', 'Remarks Required');
      return;
    }

    // Show confirmation dialog
    Swal.fire({
      title: 'Confirm Rejection',
      text: 'Are you sure you want to reject this request?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Reject',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.performRejection();
      }
    });
  }

  private performRejection(): void {
    // Get exitId from query parameters
    const exitId = this.route.snapshot.queryParams['exitID'] || this.route.snapshot.queryParams['exitId'] || this.route.snapshot.queryParams['requestId'];
    
    // Get approverId from current logged-in user
    const approverId = this.currentUser?.empId;

    if (!exitId) {
      this.toastr.error('Exit ID is missing', 'Error');
      this.isSubmitting = false;
      return;
    }

    if (!approverId) {
      this.toastr.error('Approver ID is missing', 'Error');
      this.isSubmitting = false;
      return;
    }

    if (!this.approvalRemarks || !this.approvalRemarks.trim()) {
      this.toastr.warning('Please provide remarks for rejection', 'Remarks Required');
      return;
    }

    const request: UpdateExitApprovalRequest = {
      approvalId: this.approvalID || undefined,
      exitId: parseInt(exitId),
      approverId: approverId,
      status: 'R',
      remarks: this.approvalRemarks.trim(),
      baseurl:this.getBaseUrl()
    };

    console.log('Rejection request payload:', request);

    this.isSubmitting = true;
    this.api.UpdateExitApproval(request).subscribe({
      next: (response) => {
        if (response && response.success) {
          this.actionTaken = true; // Set flag to hide action buttons
          this.toastr.success('Request rejected successfully', 'Rejection Successful');
          
          // Redirect after a short delay to show success message
          setTimeout(() => {
            this.returnToApprovalListing();
          }, 2000);
        } else {
          this.toastr.error(response?.message || 'Failed to reject request', 'Error');
        }
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Error rejecting request:', error);
        this.toastr.error('An error occurred during rejection', 'Error');
        this.isSubmitting = false;
      }
    });
  }

  // Additional missing properties and methods
  isResponsibilitiesSectionOpen: boolean = true; // Start open by default

  shouldShowProjectManagerStep(): boolean {
    return this.formType === 'P' || this.formType === 'R';
  }

  getStepStatus(step: string): string {
    return 'pending';
  }

  getStepStatusText(step: string): string {
    return 'Pending';
  }

  getStepDescription(step: string): string {
    return 'Step description';
  }

  downloadPDF(): void {
    // PDF download functionality
    console.log('Downloading PDF...');
  }

  resetForm(): void {
    this.exitForm.reset();
  }

  /**
   * Process profile image data to ensure proper base64 format
   */
  processProfileImage(imageData: string | null): string | null {
    if (!imageData) return null;
    
    // Remove any whitespace
    const cleanImageData = imageData.trim();
    
    // If it already has data URI prefix, return as is
    if (cleanImageData.startsWith('data:image')) {
      return cleanImageData;
    }
    
    // Add data URI prefix for base64 data
    // Try different image formats
    if (cleanImageData.length > 0) {
      return `data:image/jpeg;base64,${cleanImageData}`;
    }
    
    return null;
  }

  /**
   * Get the approver image with proper base64 handling
   */
  getApproverImage(step: ApprovalStep): string | null {
    // Try profileImageBase64 first
    if (step.profileImageBase64) {
      const processedImage = this.processProfileImage(step.profileImageBase64);
      if (processedImage) {
        return processedImage;
      }
    }
    
    // Fallback to photo field
    if (step.photo) {
      return step.photo;
    }
    
    return null;
  }

  /**
   * Handle approver image loading errors
   */
  onApproverImageError(event: any, step: ApprovalStep): void {
    console.log('Approver image loading failed for step:', step.stepName);
    console.log('Image source was:', event.target.src);
    console.log('Step data:', {
      profileImageBase64: step.profileImageBase64 ? 'Present (' + step.profileImageBase64.length + ' chars)' : 'Not present',
      photo: step.photo || 'Not present',
      approvedBy: step.approvedBy || (step.approverNames && step.approverNames[0]) || 'Not assigned'
    });
    
    // Hide the image element
    event.target.style.display = 'none';
    
    // Find the parent container and show fallback
    const container = event.target.closest('.approver-avatar');
    if (container) {
      const fallback = container.querySelector('.avatar-icon');
      if (fallback) {
        (fallback as HTMLElement).style.display = 'flex';
      }
    }
  }

  /**
   * Handle approver image loading success
   */
  onApproverImageLoad(event: any, step: ApprovalStep): void {
    console.log('Approver image loaded successfully for step:', step.stepName);
    
    // Hide any fallback icon
    const container = event.target.closest('.approver-avatar');
    if (container) {
      const fallback = container.querySelector('.avatar-icon');
      if (fallback) {
        (fallback as HTMLElement).style.display = 'none';
      }
    }
  }

  /**
   * Debug method to log approval workflow data
   */
  debugApprovalWorkflow(): void {
    console.log('=== APPROVAL WORKFLOW DEBUG ===');
    console.log('Approval workflow length:', this.getAllApprovalWorkflowSteps().length);
    this.getAllApprovalWorkflowSteps().forEach((step, index) => {
      console.log(`Step ${index + 1}:`, {
        stepName: step.stepName,
        status: step.status,
        approvedBy: step.approvedBy,
        hasProfileImageBase64: !!step.profileImageBase64,
        profileImageBase64Preview: step.profileImageBase64 ? step.profileImageBase64.substring(0, 50) + '...' : null,
        profileImageBase64Length: step.profileImageBase64?.length,
        hasPhoto: !!step.photo,
        photo: step.photo,
        email: step.email,
        phoneNumber: step.phoneNumber,
        comments: step.comments || 'No comments',
        hasComments: !!step.comments
      });
    });
    console.log('=== END DEBUG ===');
  }

  /**
   * Manually refresh images in the approval workflow
   */
  refreshApprovalImages(): void {
    console.log('Refreshing approval workflow images...');
    this.approvalWorkflow.forEach((step, index) => {
      if (step.profileImageBase64) {
        console.log(`Step ${index + 1} (${step.stepName}):`, {
          hasImage: !!step.profileImageBase64,
          imagePreview: step.profileImageBase64.substring(0, 50) + '...'
        });
      }
    });
    // Force change detection
    this.cdr.detectChanges();
  }

  /**
   * Test method to verify image processing
   */
  testImageProcessing(): void {
    const testBase64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/4QBaRXhpZgAATU0AKgAAA";
    console.log('Testing image processing:');
    console.log('Input:', testBase64);
    console.log('Output:', this.processProfileImage(testBase64));
    
    const testWithPrefix = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/4QBaRXhpZgAATU0AKgAAA";
    console.log('Input with prefix:', testWithPrefix);
    console.log('Output with prefix:', this.processProfileImage(testWithPrefix));
  }

  /**
   * Toggle remarks visibility for a step
   */
  toggleRemarks(step: ApprovalStep): void {
    step['showRemarks'] = !step['showRemarks'];
  }

  /**
   * Get approval progress percentage
   */
  getApprovalProgress(): number {
    if (!this.approvalWorkflow || this.approvalWorkflow.length === 0) {
      return 0;
    }
    
    const approvedSteps = this.getAllApprovalWorkflowSteps().filter(step => step.status === 'APPROVED').length;
    return Math.round((approvedSteps / this.getAllApprovalWorkflowSteps().length) * 100);
  }

  /**
   * Get line status for timeline
   */
  getLineStatus(index: number): string {
    const allSteps = this.getAllApprovalWorkflowSteps();
    if (!allSteps || index >= allSteps.length - 1) {
      return 'pending';
    }
    
    const currentStep = allSteps[index];
    const nextStep = allSteps[index + 1];
    
    if (currentStep.status === 'APPROVED') {
      return nextStep.status === 'APPROVED' ? 'completed' : 'active';
    }
    
    return 'pending';
  }

  /**
   * Get approved count for progress display
   */
  getApprovedCount(): number {
    if (!this.getAllApprovalWorkflowSteps()) return 0;
    return this.getAllApprovalWorkflowSteps().filter(step => step.status === 'APPROVED').length;
  }

  /**
   * Get the approval workflow to display - static for new forms, dynamic for existing ones
   * Filters based on isHead property when available
   */
  getDisplayApprovalWorkflow(): ApprovalStep[] {
    // Check if we have an ExitId (from URL parameters or loaded data)
    const exitId = this.route.snapshot.queryParams['exitID'] || 
                   this.route.snapshot.queryParams['exitId'] || 
                   this.route.snapshot.queryParams['requestId'];
    
    // If no ExitId and no dynamic approval workflow data, show static flow
    if (!exitId && (!this.approvalWorkflow || this.approvalWorkflow.length === 0)) {
      return this.staticApprovalFlow;
    }
    
    
    // Filter the dynamic approval workflow based on isHead property
    // Only show steps where isHead === 'Y', but keep all data intact
    if (this.approvalWorkflow && this.approvalWorkflow.length > 0) {
      return this.approvalWorkflow.filter((step: any) => {
        // If status is APPROVED, bypass isHead check and show the step
        if (step.status === 'APPROVED') {
          return true;
        }
        // For other statuses, check isHead property
        // If isHead property exists, only show steps where isHead === 'Y'
        // If isHead property doesn't exist, show all steps (backward compatibility)
        return !step.hasOwnProperty('isHead') || step.isHead === 'Y';
      });
    }
    
    // Fallback to original workflow if no filtering needed
    return this.approvalWorkflow;
  }

  // ── Co-approvers (other eligible users at the same step) ──────
  openCoApproversStep: any = null;

  /** Other eligible approvers at the same level, hidden by the isHead filter */
  getCoApprovers(step: any): any[] {
    if (!this.approvalWorkflow || this.approvalWorkflow.length === 0 || this.isShowingStaticFlow()) {
      return [];
    }
    return this.approvalWorkflow.filter((s: any) =>
      s !== step &&
      s.status !== 'APPROVED' &&
      s.hasOwnProperty('isHead') && s.isHead !== 'Y' &&
      (s.order === step.order || (s.stepName && s.stepName === step.stepName))
    );
  }

  toggleCoApprovers(step: any, event?: Event): void {
    if (event) { event.stopPropagation(); }
    this.openCoApproversStep = this.openCoApproversStep === step ? null : step;
  }

  /**
   * Check if we should show the static approval flow
   */
  isShowingStaticFlow(): boolean {
    const exitId = this.route.snapshot.queryParams['exitID'] || 
                   this.route.snapshot.queryParams['exitId'] || 
                   this.route.snapshot.queryParams['requestId'];
    
    return !exitId && (!this.approvalWorkflow || this.approvalWorkflow.length === 0);
  }

  /**
   * Get all approval workflow steps (including hidden ones)
   * Use this for internal processing that needs complete data
   */
  getAllApprovalWorkflowSteps(): ApprovalStep[] {
    return this.approvalWorkflow || [];
  }

  /**
   * Get visible workflow steps count for UI display
   */
  getVisibleWorkflowStepsCount(): number {
    return this.getDisplayApprovalWorkflow().length;
  }

  /**
   * Get total workflow steps count (including hidden)
   */
  getTotalWorkflowStepsCount(): number {
    return this.getAllApprovalWorkflowSteps().length;
  }

  /**
   * Refresh approval workflow data
   */
  refreshApprovalWorkflow(): void {
    const exitId = this.route.snapshot.queryParams['exitID'] || this.route.snapshot.queryParams['requestId'];
    if (exitId) {
      console.log('Refreshing approval workflow for exitId:', exitId);
      this.loadSavedExitData(parseInt(exitId));
    }
  }

  // IT Assets Methods

  /**
   * Load assets for the employee (IT assets or Transport vehicles)
   * Only called when user is in approval mode from "Requests Awaiting Your Approval" listing
   */
  loadITAssets(empId: string): void {
    console.log('Loading assets for employee:', empId, 'CurrentStage:', this.currentStage, 'ApprovalID:', this.approvalID);
    this.isLoadingAssets = true;
    this.api.GetIssuedAssets(empId).subscribe({
      next: (response: IssuedAssetsResponse) => {
        this.isLoadingAssets = false;
        if (response && response.success && response.data) {
          this.issuedAssets = response.data;
          this.groupAssetsByCategory();
          console.log('Assets loaded successfully:', this.issuedAssets.length, 'total assets');
          console.log('Filtered/Grouped Assets:', Object.keys(this.groupedAssets), 'categories');
          console.log('Final count for display:', this.getTotalAssetCount(), 'assets');
        } else {
          console.warn('No assets found or invalid response:', response);
          this.issuedAssets = [];
          this.groupedAssets = {};
        }
      },
      error: (error) => {
        this.isLoadingAssets = false;
        console.error('Error loading assets:', error);
        this.issuedAssets = [];
        this.groupedAssets = {};
      }
    });
  }

  /**
   * Group assets by category
   * For TRANSPORT stage, only show CAR category
   * For IT stage, show all categories EXCEPT CAR
   */
  groupAssetsByCategory(): void {
    this.groupedAssets = {};
    
    // Filter assets based on current stage
    let assetsToGroup = this.issuedAssets;
    if (this.currentStage === 'TRANSPORT') {
      // Only show CAR category for transport stage
      assetsToGroup = this.issuedAssets.filter(asset => 
        asset.category && asset.category.toUpperCase().includes('CAR')
      );
      console.log('Filtered assets for TRANSPORT stage (CAR only):', assetsToGroup.length, 'out of', this.issuedAssets.length);
    } else if (this.currentStage === 'IT') {
      // Show all categories EXCEPT CAR for IT stage
      assetsToGroup = this.issuedAssets.filter(asset => 
        !asset.category || !asset.category.toUpperCase().includes('CAR')
      );
      console.log('Filtered assets for IT stage (excluding CAR):', assetsToGroup.length, 'out of', this.issuedAssets.length);
    }
    
    assetsToGroup.forEach(asset => {
      const category = asset.category || 'OTHER';
      if (!this.groupedAssets[category]) {
        this.groupedAssets[category] = [];
      }
      this.groupedAssets[category].push(asset);
    });
  }

  /**
   * Toggle IT assets section
   */
  toggleITAssetsSection(): void {
    this.isITAssetsSectionOpen = !this.isITAssetsSectionOpen;
  }

  /**
   * Get category display name
   */
  getCategoryDisplayName(category: string): string {
    const categoryMap: { [key: string]: string } = {
      'DESKTOP': 'Desktop',
      'LAPTOP / NOTEBOOK': 'Laptop',
      'MONITOR': 'Monitor',
      'TAB': 'Tablet',
      'IP PHONE': 'IP Phone',
      'MOBILE': 'Mobile',
      'CAR': 'Company Car',
      'VEHICLE': 'Vehicle',
      'OTHER': 'Other'
    };
    return categoryMap[category] || category;
  }

  /**
   * Get category icon
   */
  getCategoryIcon(category: string): string {
    const iconMap: { [key: string]: string } = {
      'DESKTOP': 'fa-desktop',
      'LAPTOP / NOTEBOOK': 'fa-laptop',
      'MONITOR': 'fa-tv',
      'TAB': 'fa-tablet-alt',
      'IP PHONE': 'fa-phone',
      'MOBILE': 'fa-mobile-alt',
      'CAR': 'fa-car',
      'VEHICLE': 'fa-car',
      'OTHER': 'fa-cube'
    };
    return iconMap[category] || 'fa-cube';
  }

  /**
   * Get asset count for category
   */
  getAssetCount(category: string): number {
    return this.groupedAssets[category]?.length || 0;
  }

  /**
   * Get total asset count (filtered based on current stage)
   */
  getTotalAssetCount(): number {
    if (this.currentStage === 'TRANSPORT') {
      // Only count CAR assets for transport stage
      return this.issuedAssets.filter(asset => 
        asset.category && asset.category.toUpperCase().includes('CAR')
      ).length;
    } else if (this.currentStage === 'IT') {
      // Count all assets EXCEPT CAR for IT stage
      return this.issuedAssets.filter(asset => 
        !asset.category || !asset.category.toUpperCase().includes('CAR')
      ).length;
    }
    return this.issuedAssets.length;
  }

  /**
   * Get section title based on current stage
   */
  getAssetsSectionTitle(): string {
    if (this.currentStage === 'TRANSPORT') {
      return 'Review & Verify Vehicles';
    }
    return 'Review & Verify Assets';
  }

  /**
   * Get section icon based on current stage
   */
  getAssetsSectionIcon(): string {
    if (this.currentStage === 'TRANSPORT') {
      return 'fa-car';
    }
    return 'fa-laptop';
  }

  /**
   * Check if assets section should be shown
   * Only show when:
   * 1. currentStage is 'IT' or 'TRANSPORT'
   * 2. Current user can take action (based on GetEmployeeExitSavedInfo response)
   */
  shouldShowITAssetsSection(): boolean {
    // Check if current stage is IT or TRANSPORT
    if (this.currentStage !== 'IT' && this.currentStage !== 'TRANSPORT') {
      return false;
    } 

    // Check if current user can take action based on the approval workflow
    const canTakeAction = this.canUserTakeAction();
    return canTakeAction;
  }

  /**
   * Format allocation date
   */
  formatAllocationDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      // Handle different date formats
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        // Try parsing DD-MM-YYY format
        const parts = dateString.split('-');
        if (parts.length === 3) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // Month is 0-indexed
          const year = parseInt(parts[2]);
          const fullYear = year < 100 ? 2000 + year : year;
          const parsedDate = new Date(fullYear, month, day);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toLocaleDateString('en-GB');
          }
        }
        return dateString; // Return original if parsing fails
      }
      return date.toLocaleDateString('en-GB');
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return dateString;
    }
  }

  async downloadAsPdf(returnBase64 = false): Promise<string | void> {
    if (this.isPdfGenerating) return;
    this.isPdfGenerating = true;

    try {
      // ── Load assets ──────────────────────────────────────────────────────────
      const loadImg = async (src: string): Promise<string> => {
        try {
          const r = await fetch(src);
          const b = await r.blob();
          return await new Promise<string>(res => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result as string);
            fr.readAsDataURL(b);
          });
        } catch { return ''; }
      };

      const [logoDataUrl, empPhotoDataUrl] = await Promise.all([
        loadImg('assets/images/Logo_LoginScreen.png'),
        (this.employeePhoto && this.employeePhoto !== AvatarUtil.DEFAULT_AVATAR)
          ? loadImg(this.employeePhoto)
          : Promise.resolve(this.employeePhoto?.startsWith('data:') ? this.employeePhoto : ''),
      ]);

      // ── Constants ─────────────────────────────────────────────────────────────
      const pW = 210, pH = 297, margin = 8, cW = pW - margin * 2, footerH = 8;
      const maxY = pH - footerH - 4;
      const teal = [19, 130, 113] as [number, number, number];
      const dark = [27, 42, 56] as [number, number, number];

      // ── Form values ───────────────────────────────────────────────────────────
      const fv = this.exitForm.getRawValue();
      const formTypeLabel = this.formType === 'E' ? 'EMERGENCY EXIT FORM'
                          : this.formType === 'P' ? 'PLANNED LEAVE FORM'
                          : 'RESIGNATION FORM';
      const empNameRaw = (fv.employeeName || 'Employee').toUpperCase();
      const empId      = (fv.employeeId  || 'EMP').replace(/\s+/g, '');
      const typeFile   = this.formType === 'E' ? 'EmergencyExit'
                       : this.formType === 'R' ? 'Resignation' : 'PlannedLeave';
      const dateStr    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const hodDisplayName = this.hodList.find(h => h.idValue === fv.hodName)?.description || fv.hodName || '—';
      const responsibilities = this.responsibilitiesFormArray.getRawValue() as any[];

      const fmtDate = (d: string) => {
        if (!d) return '—';
        try {
          const dt = new Date(d);
          if (isNaN(dt.getTime())) return d;
          return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return d; }
      };

      // Normalize exotic whitespace (NBSP etc.) so splitTextToSize can wrap
      // inside the column instead of overflowing into the next one
      const clean = (v: any): string => {
        if (v === null || v === undefined) return '—';
        const s = String(v)
          .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
          .replace(/[\r\n\t]+/g, ' ')
          .replace(/ {2,}/g, ' ')
          .trim();
        return s || '—';
      };

      // ── PDF setup ─────────────────────────────────────────────────────────────
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let y = 0;

      const newPage = () => { pdf.addPage(); y = margin + 2; };

      const chk = (need: number) => { if (y + need > maxY) newPage(); };

      // Remove zero-width / bidi-control characters that break wrapping
      const stripInvisible = (s: string): string => {
        let out = '';
        for (const ch of s) {
          const c = ch.codePointAt(0) as number;
          if (c === 0x00AD || (c >= 0x200B && c <= 0x200F) ||
              (c >= 0x202A && c <= 0x202E) || (c >= 0x2060 && c <= 0x206F) ||
              c === 0xFEFF) continue;
          out += ch;
        }
        return out;
      };

      // Guaranteed-fit wrapper: measures with the CURRENT font and
      // hard-breaks any word longer than the column, so no produced
      // line can ever overflow into the next column
      const wrapText = (text: any, maxW: number): string[] => {
        const words = stripInvisible(clean(text)).split(' ').filter(w => w.length > 0);
        const lines: string[] = [];
        let cur = '';
        for (const w of words) {
          const test = cur ? cur + ' ' + w : w;
          if (pdf.getTextWidth(test) <= maxW) { cur = test; continue; }
          if (cur) lines.push(cur);
          if (pdf.getTextWidth(w) <= maxW) { cur = w; continue; }
          // single word wider than the column — break it by characters
          let chunk = '';
          for (const ch of w) {
            if (pdf.getTextWidth(chunk + ch) > maxW && chunk) { lines.push(chunk); chunk = ch; }
            else chunk += ch;
          }
          cur = chunk;
        }
        if (cur) lines.push(cur);
        return lines.length ? lines : ['—'];
      };

      // ── Section header ────────────────────────────────────────────────────────
      const secHeader = (title: string) => {
        chk(8);
        pdf.setFillColor(...teal);
        pdf.rect(margin, y, cW, 5.5, 'F');
        pdf.setFillColor(255, 255, 255);
        pdf.rect(margin, y, 2, 5.5, 'F');
        pdf.setFillColor(...teal);
        pdf.rect(margin + 0.5, y, 1.5, 5.5, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(255, 255, 255);
        pdf.text(title, margin + 4, y + 3.8);
        y += 7;
      };

      // ── Two-column field row ──────────────────────────────────────────────────
      const twoCol = (rows: { l: string; lv: string; r?: string; rv?: string }[]) => {
        const hw = (cW - 6) / 2;
        rows.forEach(row => {
          // measure with the same font that renders the values
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7.5);
          // rows without a right column get the full row width
          const lLines = wrapText(row.lv, row.r ? hw - 4 : cW - 5);
          const rLines = row.r ? wrapText(row.rv, hw - 4) : [];
          const rowH   = Math.max(lLines.length, rLines.length) * 3.2 + 6.5;
          chk(rowH);

          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, y, cW, rowH - 0.8, 'F');
          pdf.setDrawColor(226, 232, 240);
          pdf.setLineWidth(0.12);
          pdf.rect(margin, y, cW, rowH - 0.8, 'S');

          // left field
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(6);
          pdf.setTextColor(100, 116, 139);
          pdf.text(row.l, margin + 2.5, y + 3);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7.5);
          pdf.setTextColor(15, 23, 42);
          pdf.text(lLines, margin + 2.5, y + 6.5);

          // right field
          if (row.r) {
            const rx = margin + hw + 6;
            pdf.setFillColor(226, 232, 240);
            pdf.rect(margin + hw + 3, y + 0.8, 0.25, rowH - 2.3, 'F');
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(6);
            pdf.setTextColor(100, 116, 139);
            pdf.text(row.r, rx, y + 3);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(7.5);
            pdf.setTextColor(15, 23, 42);
            pdf.text(rLines, rx, y + 6.5);
          }
          y += rowH;
        });
        y += 0.5;
      };

      // ── Full-width text field ─────────────────────────────────────────────────
      const fullField = (label: string, value: string) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        const lines = wrapText(value, cW - 6);
        const fh = lines.length * 3.2 + 7;
        chk(fh);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6);
        pdf.setTextColor(100, 116, 139);
        pdf.text(label, margin, y + 3);

        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.12);
        pdf.roundedRect(margin, y + 5, cW, lines.length * 3.2 + 2, 1, 1, 'FD');

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(15, 23, 42);
        pdf.text(lines, margin + 2, y + 8);
        y += fh;
      };

      // ══════════════════════════════════════════════════════════════════════════
      // PAGE 1 HEADER
      // ══════════════════════════════════════════════════════════════════════════
      pdf.setFillColor(...dark);
      pdf.rect(0, 0, pW, 20, 'F');
      pdf.setFillColor(...teal);
      pdf.rect(0, 18.5, pW, 1.5, 'F');

      // Logo
      if (logoDataUrl) {
        try { pdf.addImage(logoDataUrl, 'PNG', margin, 3, 14, 12); } catch (_) {}
      }

      // Company info
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text('AL ADRAK TRADING AND CONTRACTING LLC', margin + 17, 9);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(165, 212, 206);
      pdf.text(formTypeLabel, margin + 17, 15);

      // Date top-right
      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(180, 220, 215);
      pdf.text(`Date: ${today}`, pW - margin, 9, { align: 'right' });

      // Employee name chip top-right
      const chipW = Math.min(pdf.getTextWidth(empNameRaw) + 6, 60);
      pdf.setFillColor(...teal);
      pdf.roundedRect(pW - margin - chipW, 13, chipW, 5, 1, 1, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text(empNameRaw, pW - margin - chipW / 2, 16.6, { align: 'center', maxWidth: chipW - 3 });

      y = 23;

      // ══════════════════════════════════════════════════════════════════════════
      // EMPLOYEE PHOTO + PERSONAL INFO
      // ══════════════════════════════════════════════════════════════════════════
      secHeader('1.  PERSONAL INFORMATION');

      // Photo placeholder on right
      const photoSize = 22;
      const photoX    = margin + cW - photoSize;
      const photoY    = y;
      if (empPhotoDataUrl) {
        try {
          pdf.addImage(empPhotoDataUrl, 'JPEG', photoX, photoY, photoSize, photoSize);
          pdf.setDrawColor(...teal);
          pdf.setLineWidth(0.5);
          pdf.rect(photoX, photoY, photoSize, photoSize, 'S');
        } catch (_) {}
      } else {
        pdf.setFillColor(226, 232, 240);
        pdf.rect(photoX, photoY, photoSize, photoSize, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6);
        pdf.setTextColor(148, 163, 184);
        pdf.text('PHOTO', photoX + photoSize / 2, photoY + photoSize / 2 + 1, { align: 'center' });
      }

      // Fields in left area (cW - photoSize - 6)
      const fieldsW = cW - photoSize - 6;
      const hw2 = (fieldsW - 4) / 2;
      const dojDisplay = this.getDojDisplay() || '—';
      const personalRows = [
        { l: 'Employee Name', lv: fv.employeeName || '—', r: 'Employee ID', rv: empId },
        { l: 'Department / Site', lv: fv.department || '—', r: 'Designation', rv: this.employeeDesignation || '—' },
        { l: 'HOD Name', lv: hodDisplayName, r: 'Date of Joining', rv: dojDisplay },
      ];

      if (this.formType === 'P' || this.formType === 'R') {
        personalRows[2] = { l: 'HOD Name', lv: hodDisplayName, r: 'Category', rv: fv.category || '—' };
        personalRows.push({ l: 'Project Manager / Site Incharge', lv: this.getProjectManagerDisplayName() || '—', r: 'Phone Number', rv: fv.responsibilitiesHandedOverToPhone || '—' });
        personalRows.push({ l: 'Email ID', lv: fv.responsibilitiesHandedOverToEmail || '—', r: 'Date of Joining', rv: dojDisplay });
      }

      const startPersonalY = y;
      personalRows.forEach(row => {
        // measure with the same font that renders the values
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        const lLines = wrapText(row.lv, hw2 - 4);
        const rLines = row.r ? wrapText(row.rv, hw2 - 4) : [];
        const rh = Math.max(lLines.length, rLines.length) * 3.2 + 6.5;
        chk(rh);

        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, y, fieldsW, rh - 0.8, 'F');
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.12);
        pdf.rect(margin, y, fieldsW, rh - 0.8, 'S');

        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
        pdf.text(row.l, margin + 2.5, y + 3);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(15, 23, 42);
        pdf.text(lLines, margin + 2.5, y + 6.5);

        if (row.r) {
          const rx = margin + hw2 + 5;
          pdf.setFillColor(226, 232, 240);
          pdf.rect(margin + hw2 + 2, y + 0.8, 0.25, rh - 2.3, 'F');
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
          pdf.text(row.r, rx, y + 3);
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(15, 23, 42);
          pdf.text(rLines, rx, y + 6.5);
        }
        y += rh;
      });

      // Ensure we clear the photo
      y = Math.max(y, startPersonalY + photoSize + 2);
      y += 1;

      // Service < 1 year attention notice (Emergency Exit only)
      if (this.formType === 'E' && this.isDojLessThanOneYear()) {
        chk(11);
        pdf.setFillColor(254, 242, 242);   // red-50
        pdf.setDrawColor(254, 202, 202);   // red-200
        pdf.setLineWidth(0.25);
        pdf.roundedRect(margin, y, cW, 9, 1, 1, 'FD');
        pdf.setFillColor(220, 38, 38);     // red-600 left bar
        pdf.rect(margin, y, 1.6, 9, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(185, 28, 28);     // red-700
        pdf.text('ATTENTION - SERVICE LESS THAN ONE YEAR', margin + 4, y + 3.6);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.3);
        pdf.setTextColor(127, 29, 29);     // red-900
        pdf.text('Employee joined less than one year ago. Security Deposit or Guarantor is MANDATORY for Emergency Exit.', margin + 4, y + 7);
        y += 11;
      }

      // ══════════════════════════════════════════════════════════════════════════
      // CONTACT DETAILS  (Emergency only)
      // ══════════════════════════════════════════════════════════════════════════
      if (this.formType === 'E') {
        secHeader('2.  CONTACT DETAILS');
        twoCol([
          { l: 'Address', lv: fv.address || '—' },
          { l: 'Place', lv: fv.place || '—', r: 'District', rv: fv.district || '—' },
          { l: 'State', lv: fv.state || '—', r: 'Post Office', rv: fv.postOffice || '—' },
          { l: 'Nation', lv: fv.nation || '—', r: 'Mobile Number', rv: fv.telephoneMobile || '—' },
          { l: 'Landline', lv: fv.telephoneLandline || '—', r: 'Email ID', rv: fv.emailId || '—' },
        ]);
      }

      // ══════════════════════════════════════════════════════════════════════════
      // TRAVEL / RESIGNATION INFORMATION
      // ══════════════════════════════════════════════════════════════════════════
      const s3 = this.formType === 'E' ? '3' : '2';
      const travelTitle = this.formType === 'R'
        ? `${s3}.  RESIGNATION INFORMATION` : `${s3}.  TRAVEL INFORMATION`;
      secHeader(travelTitle);

      if (this.formType !== 'R') {
        twoCol([
          { l: 'Date of Departure', lv: fmtDate(fv.dateOfDeparture), r: 'Date of Arrival', rv: fmtDate(fv.dateOfArrival) },
          { l: 'No. of Days Requested', lv: String(fv.noOfDaysApproved ?? '—'), r: 'Flight Time', rv: fv.flightTime || '—' },
        ]);
      } else {
        twoCol([
          { l: 'Last Working Date', lv: fmtDate(fv.dateOfDeparture), r: 'Notice Period (Days)', rv: String(fv.noOfDaysApproved ?? '—') },
        ]);
      }

      // ══════════════════════════════════════════════════════════════════════════
      // DETAILS SECTION
      // ══════════════════════════════════════════════════════════════════════════
      const s4 = this.formType === 'E' ? '4' : '3';
      const detailTitle = this.formType === 'E' ? `${s4}.  EMERGENCY DETAILS`
                        : this.formType === 'P' ? `${s4}.  LEAVE DETAILS`
                        : `${s4}.  RESIGNATION DETAILS`;
      secHeader(detailTitle);

      const reasonLabel = this.formType === 'E' ? 'Reason for Emergency'
                        : this.formType === 'P' ? 'Reason for Planned Leave'
                        : 'Reason for Resignation';
      fullField(reasonLabel, fv.reasonForEmergency || '');

      // ══════════════════════════════════════════════════════════════════════════
      // RESPONSIBILITIES HANDED OVER
      // ══════════════════════════════════════════════════════════════════════════
      const s5 = this.formType === 'E' ? '5' : '4';
      secHeader(`${s5}.  RESPONSIBILITIES HANDED OVER`);

      if (responsibilities.length === 0) {
        chk(8);
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7); pdf.setTextColor(148, 163, 184);
        pdf.text('No responsibilities recorded.', margin + 2, y + 4.5);
        y += 8;
      } else {
        responsibilities.forEach((resp: any, idx: number) => {
          chk(10);
          // sub-card header
          pdf.setFillColor(232, 246, 243);
          pdf.setDrawColor(...teal);
          pdf.setLineWidth(0.25);
          pdf.rect(margin, y, cW, 5.5, 'FD');
          pdf.setFillColor(...teal);
          pdf.rect(margin, y, 1.8, 5.5, 'F');
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(...teal);
          pdf.text(`  Responsibility ${idx + 1}`, margin + 3, y + 3.8);
          y += 7;

          twoCol([
            { l: 'Project', lv: resp.project || '—', r: 'Responsible Person', rv: resp.responsiblePersonName || '—' },
            { l: 'Phone Number', lv: resp.responsiblePersonPhone || '—', r: 'Email ID', rv: resp.responsiblePersonEmail || '—' },
          ]);
          fullField('Activities', resp.activities || '');
          if (resp.remarks) fullField('Remarks', resp.remarks);
          y += 1;
        });
      }

      // ══════════════════════════════════════════════════════════════════════════
      // DECLARATIONS
      // ══════════════════════════════════════════════════════════════════════════
      const s6 = this.formType === 'E' ? '6' : '5';
      secHeader(`${s6}.  DECLARATIONS`);

      const decItems = [
        { ok: !!fv.decInfoAccurate,      text: 'I confirm that all information provided is accurate and complete.' },
        { ok: !!fv.decHandoverComplete,  text: this.formType === 'E'
            ? 'I have handed over all my responsibilities to the designated personnel.'
            : 'I have properly handed over my responsibilities to the designated personnel.' },
        { ok: !!fv.decReturnAssets,      text: this.formType === 'E'
            ? 'I will return all company assets (laptop, phone, keys, tag, vehicle, etc.) before departure.'
            : this.formType === 'P'
            ? 'I will return all company assets before my planned departure.'
            : 'I will return all company assets before my last working day.' },
        { ok: !!fv.decUnderstandReturn,  text: this.formType === 'E'
            ? 'I understand this is an emergency exit and I will return as per the approved dates.'
            : this.formType === 'P'
            ? 'I understand this is a planned leave and I will return as per the approved schedule.'
            : 'I understand this is a resignation and I will complete the full notice period as required.' },
      ];

      decItems.forEach(dec => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        const lines = pdf.splitTextToSize(dec.text, cW - 13);
        const dh = lines.length * 3.2 + 6;
        chk(dh);

        pdf.setFillColor(dec.ok ? 240 : 248, dec.ok ? 253 : 250, dec.ok ? 244 : 252);
        pdf.setDrawColor(dec.ok ? 22 : 226, dec.ok ? 163 : 232, dec.ok ? 74 : 240);
        pdf.setLineWidth(0.12);
        pdf.roundedRect(margin, y, cW, dh - 0.8, 1, 1, 'FD');

        if (dec.ok) {
          pdf.setFillColor(22, 163, 74);
          pdf.roundedRect(margin + 2.5, y + 1.8, 3.5, 3.5, 0.4, 0.4, 'F');
          pdf.setDrawColor(255, 255, 255);
          pdf.setLineWidth(0.6);
          pdf.line(margin + 3.2, y + 3.8, margin + 4.0, y + 4.7);
          pdf.line(margin + 4.0, y + 4.7, margin + 5.4, y + 2.8);
        } else {
          pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.25);
          pdf.roundedRect(margin + 2.5, y + 1.8, 3.5, 3.5, 0.4, 0.4, 'S');
        }

        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(15, 23, 42);
        pdf.text(lines, margin + 8, y + 4);
        y += dh;
      });
      y += 1;

      // ══════════════════════════════════════════════════════════════════════════
      // APPROVAL WORKFLOW
      // ══════════════════════════════════════════════════════════════════════════
      if (this.approvalWorkflow && this.approvalWorkflow.length > 0) {
        const s7 = this.formType === 'E' ? '7' : '6';
        secHeader(`${s7}.  APPROVAL WORKFLOW`);

        const statusColor: Record<string, [number, number, number]> = {
          APPROVED:    [22, 163, 74],
          REJECTED:    [220, 38, 38],
          IN_PROGRESS: [234, 179, 8],
          PENDING:     [148, 163, 184],
        };

        this.approvalWorkflow.forEach((step, idx) => {
          const sc = statusColor[step.status] || statusColor['PENDING'];
          const pS = 10;
          const textMaxW = cW - pS - 10;
          const isActioned = step.status === 'APPROVED' || step.status === 'REJECTED';
          if (!isActioned) return;
          const contactLine = [step.email, step.phoneNumber].filter(Boolean).join('   |   ');
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(6.5);
          const remarksLines = step.comments
            ? wrapText('Remarks: ' + step.comments, textMaxW) : [];
          const boxH = Math.max(16, pS + 4)
                     + (contactLine ? 3.5 : 0)
                     + (isActioned && step.approvedDate ? 3.5 : 0)
                     + remarksLines.length * 3.2;
          chk(boxH + 2);

          pdf.setFillColor(250, 252, 252);
          pdf.setDrawColor(226, 232, 240);
          pdf.setLineWidth(0.15);
          pdf.roundedRect(margin, y, cW, boxH, 1.5, 1.5, 'FD');

          // Status bar left
          pdf.setFillColor(...sc);
          pdf.rect(margin, y, 2.5, boxH, 'F');

          // Approver photo — right side, vertically centred
          const pX = margin + cW - pS - 1.5;
          const pY = y + (boxH - pS) / 2;
          const imgB64 = step.profileImageBase64;
          const imgSrc = imgB64 ? (imgB64.startsWith('data:') ? imgB64 : `data:image/jpeg;base64,${imgB64}`) : '';
          if (imgSrc) {
            try {
              pdf.addImage(imgSrc, 'JPEG', pX, pY, pS, pS);
              pdf.setDrawColor(...sc); pdf.setLineWidth(0.35); pdf.rect(pX, pY, pS, pS, 'S');
            } catch (_) {
              pdf.setFillColor(232, 240, 248); pdf.rect(pX, pY, pS, pS, 'F');
            }
          } else {
            pdf.setFillColor(232, 240, 248); pdf.rect(pX, pY, pS, pS, 'F');
            pdf.setDrawColor(210, 220, 230); pdf.setLineWidth(0.2); pdf.rect(pX, pY, pS, pS, 'S');
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(4.5); pdf.setTextColor(160, 174, 192);
            pdf.text('NO\nPHOTO', pX + pS / 2, pY + pS / 2, { align: 'center' });
          }

          // Step name
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(15, 23, 42);
          pdf.text(step.stepName || `Step ${idx + 1}`, margin + 5, y + 5.5, { maxWidth: textMaxW });

          // Status badge — left of photo
          const stText = step.status || 'PENDING';
          const bW = pdf.getTextWidth(stText) + 5;
          pdf.setFillColor(...sc);
          pdf.roundedRect(pX - bW - 3, y + 2, bW, 5, 0.8, 0.8, 'F');
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(255, 255, 255);
          pdf.text(stText, pX - bW / 2 - 3, y + 5.5, { align: 'center' });

          const approverName = step.approvedBy || step.approverNames?.[0] || '—';
          const approverId   = step.approvedId || step.approverIds?.[0] || '';
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(15, 23, 42);
          pdf.text(`${approverName}${approverId ? '   ID: ' + approverId : ''}`, margin + 5, y + 10, { maxWidth: textMaxW });
          let infoY = y + 13.5;
          if (contactLine) {
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(71, 85, 105);
            pdf.text(contactLine, margin + 5, infoY, { maxWidth: textMaxW });
            infoY += 3.5;
          }
          if (isActioned && step.approvedDate) {
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.setTextColor(100, 116, 139);
            pdf.text('Date:', margin + 5, infoY);
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(15, 23, 42);
            pdf.text(fmtDate(step.approvedDate), margin + 16, infoY);
            infoY += 3.5;
          }
          if (remarksLines.length > 0) {
            pdf.setFont('helvetica', 'italic'); pdf.setFontSize(6.5); pdf.setTextColor(71, 85, 105);
            pdf.text(remarksLines, margin + 5, infoY);
          }
          y += boxH + 3;
        });
      }

      // ══════════════════════════════════════════════════════════════════════════
      // FOOTERS — stamp all pages after content is done
      // ══════════════════════════════════════════════════════════════════════════
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFillColor(...dark);
        pdf.rect(0, pH - footerH, pW, footerH, 'F');
        pdf.setFillColor(...teal);
        pdf.rect(0, pH - footerH, pW, 1.5, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6.5);
        pdf.setTextColor(255, 255, 255);
        pdf.text(`AL ADRAK TRADING AND CONTRACTING LLC   |   ${formTypeLabel}   |   ${empNameRaw}`, margin, pH - 2.5);
        pdf.text(`Page ${p} of ${totalPages}`, pW - margin, pH - 2.5, { align: 'right' });
      }

      if (returnBase64) {
        return pdf.output('datauristring').split(',')[1];
      }
      pdf.save(`${typeFile}_${empId}_${dateStr}.pdf`);
      this.toastr.success('PDF downloaded successfully.', 'Export Complete');
    } catch (err) {
      console.error('PDF generation error:', err);
      this.toastr.error('Failed to generate PDF. Please try again.', 'Export Failed');
    } finally {
      this.isPdfGenerating = false;
    }
  }
}
