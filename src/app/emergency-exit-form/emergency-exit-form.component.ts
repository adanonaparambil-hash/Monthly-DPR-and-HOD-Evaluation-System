import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../services/api';
import { DropdownOption, ExitEmpProfileDetails } from '../models/common.model';
import {
  EmployeeExitRequest,
  EmployeeExitResponsibility,
  ApprovalStep,
  DepartmentApproval,
  EmployeeExitApprovalWorkflow,
  UpdateExitApprovalRequest
} from '../models/employeeExit.model';
import { SessionService } from '../services/session.service';
import { ToastrService } from 'ngx-toastr';
import { ApprovalWorkflowService } from '../services/approval-workflow.service';
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

  // Approval mode flags
  isApprovalMode: boolean = false;
  isViewMode: boolean = false;
  approvalRequestData: any = null;
  approvalID: number | null = null;
  returnUrl: string = '';
  actionTaken: boolean = false; // Flag to track if approval/rejection action has been taken

  // Employee profile data
  employeeProfileData: ExitEmpProfileDetails = {};

  // Employee photo
  employeePhoto: string = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format';

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

      // Add one default responsibility row for Emergency forms
      if (this.formType === 'E') {
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

          // Format dates for input fields
          const formatDateForInput = (dateString: string): string => {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toISOString().split('T')[0];
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
              order: history.approvalLevel || index + 1
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
        if (response && response.success && response.data) {
          const profile = response.data;

          // Update photo using helper
          this.setEmployeePhotoFromData(profile);

          // If no photo in exit details response, try the general profile API
          if (this.employeePhoto === 'assets/images/default-avatar.png' || !this.employeePhoto) {
            this.api.GetEmployeeProfile(empId).subscribe({
              next: (profResponse: any) => {
                if (profResponse && profResponse.success && profResponse.data) {
                  this.setEmployeePhotoFromData(profResponse.data);
                }
              }
            });
          }

          // Patch profile info
          this.exitForm.patchValue({
            employeeName: profile.employeeName || profile.empName || profile.name || this.exitForm.get('employeeName')?.value || '',
            employeeId: profile.employeeId || profile.employeeID || profile.empId || this.exitForm.get('employeeId')?.value || '',
            department: profile.empDept || profile.department || this.exitForm.get('department')?.value || '',
            emailId: profile.email || this.exitForm.get('emailId')?.value || '',
            address: profile.address || '',
            district: profile.district || '',
            place: profile.place || '',
            state: profile.state || '',
            postOffice: profile.postOffice || '',
            nation: profile.nationality || profile.nation || '',
            telephoneMobile: profile.phone || '',
            telephoneLandline: profile.telephoneNo || profile.telephone || ''
          });

          console.log('Employee details loaded by ID:', empId);
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
      responsibilitiesHandedOverTo: [''], // Text input for planned leave
      responsibilitiesHandedOverToId: [''], // ID of the person for planned leave

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

            // Fallback to session photo if still not set
            if ((this.employeePhoto === 'assets/images/default-avatar.png' || !this.employeePhoto) && this.currentUser.photo) {
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
            });

            console.log('Employee profile loaded successfully');
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
    this.employeePhoto = 'assets/images/default-avatar.png';
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
      this.showValidationErrors(); // Show specific validation errors
      this.toastr.error('Please fill in all required fields before submitting.', 'Validation Error');
      return;
    }

    if (!this.allDeclarationsChecked()) {
      this.toastr.error('Please check all declaration checkboxes before submitting.', 'Validation Error');
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

  private prepareExitRequest(): EmployeeExitRequest {
    const formValue = this.exitForm.getRawValue(); // Use getRawValue to get disabled field values

    // Prepare responsibilities array for Emergency forms only
    const responsibilities: EmployeeExitResponsibility[] = [];
    if (this.formType === 'E' && formValue.responsibilities) {
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
      return d.toISOString().split('T')[0]; // YYYY-MM-DD format
    };

    const exitRequest: EmployeeExitRequest = {
      employeeId: formValue.employeeId || '',
      employeeName: formValue.employeeName || '',
      emailId: formValue.emailId || '',
      formType: this.formType, // 'E' for Emergency, 'P' for Planned, 'R' for Resignation
      dateOfDeparture: formatDate(formValue.dateOfDeparture),
      dateArrival: formValue.dateOfArrival ? formatDate(formValue.dateOfArrival) : undefined,
      flightTime: formValue.flightTime || '',
      responsibilitiesHanded: (this.formType === 'P' || this.formType === 'R') ? (formValue.responsibilitiesHandedOverToId || formValue.responsibilitiesHandedOverTo || '') : '',
      noOfDaysApproved: parseInt(formValue.noOfDaysApproved) || 0,
      depHod: formValue.hodName || '',
      projectSiteIncharge: formValue.projectManagerName || '', // Fix: use projectManagerName from form
      reasonForLeave: formValue.reasonForEmergency || '',
      approvalStatus: 'P',
      category: this.mapCategoryToBackend(formValue.category || ''), // Map Staff/Worker to S/W
      lastWorkingDate: this.formType === 'R' ? formatDate(formValue.dateOfDeparture) : undefined,
      NoticePeriod: this.formType === 'R' ? parseInt(formValue.noOfDaysApproved) || 0 : 0,
      declaration1: formValue.decInfoAccurate ? 'Y' : 'N',
      declaration2: formValue.decHandoverComplete ? 'Y' : 'N',
      declaration3: formValue.decReturnAssets ? 'Y' : 'N',
      declaration4: formValue.decUnderstandReturn ? 'Y' : 'N',
      responsibilities: responsibilities
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
      department: this.exitForm.get('department')?.value
    });

    // Only disable employeeId and department - keep employeeName and emailId editable
    this.exitForm.get('employeeId')?.disable();
    this.exitForm.get('department')?.disable();

    // Keep employeeName and emailId enabled for user input
    this.exitForm.get('employeeName')?.enable();
    this.exitForm.get('emailId')?.enable();

    // Mark disabled fields as valid even when disabled
    this.exitForm.get('employeeId')?.setErrors(null);
    this.exitForm.get('department')?.setErrors(null);

    console.log('Form values after disabling:', {
      employeeName: this.exitForm.get('employeeName')?.value,
      employeeId: this.exitForm.get('employeeId')?.value,
      department: this.exitForm.get('department')?.value
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
      this.exitForm.get('responsibilitiesHandedOverTo')?.clearValidators();

    } else if (this.formType === 'P') {
      // Planned leave specific fields are required
      this.exitForm.get('category')?.setValidators([Validators.required]);
      this.exitForm.get('projectManagerName')?.setValidators([Validators.required]);
      this.exitForm.get('responsibilitiesHandedOverTo')?.setValidators([Validators.required]);

    } else if (this.formType === 'R') {
      // Resignation specific fields are required (reuse existing fields)
      this.exitForm.get('category')?.setValidators([Validators.required]);
      this.exitForm.get('projectManagerName')?.setValidators([Validators.required]);
      this.exitForm.get('responsibilitiesHandedOverTo')?.setValidators([Validators.required]);
    }

    // Update validity after changing validators
    Object.keys(this.exitForm.controls).forEach(key => {
      this.exitForm.get(key)?.updateValueAndValidity();
    });
  }

  loadHodMasterList(): void {
    this.api.GetHodMasterList().subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.hodList = response.data.map((hod: any) => ({
            idValue: hod.idValue || hod.empId || hod.id || hod.employeeId,
            description: hod.description || hod.employeeName || hod.name
          }));
          console.log('HOD List loaded:', this.hodList);
        }
      },
      error: (error: any) => {
        console.error('Error loading HOD master list:', error);
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
            description: emp.description || emp.employeeName || emp.name
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
              description: emp.description || emp.employeeName || emp.name
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
          if (response && response.success && response.data) {
            // Update form with employee details
            this.exitForm.patchValue({
              employeeName: response.data.employeeName || '',
              employeeId: response.data.empId || '',
              department: response.data.department || '',
              emailId: response.data.email || ''
            });
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
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
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
        responsibilitiesHandedOverTo: request.responsibilitiesHanded || request.responsibilitiesHandedOverTo || '',
        responsibilitiesHandedOverToId: request.responsibilitiesHandedToId || request.responsibilitiesHandedOverToId || '',
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

    // Reset responsibilities section to open state
    this.isResponsibilitiesSectionOpen = true;

    // Reset form with identity fields cleared
    this.exitForm.reset({
      formType: this.formType,
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
      requiredFields.push('category', 'responsibilitiesHandedOverTo', 'projectManagerName');
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
      
      // Check projectManagerName (stores ID) - should have a value
      const projectManagerValue = formValue.projectManagerName || rawFormValue.projectManagerName;
      if (!projectManagerValue) {
        console.log('Validation failed: projectManagerName missing for P/R form');
        console.log('projectManagerName value:', projectManagerValue);
        return false;
      }
      
      // Check responsibilitiesHandedOverTo - should have a value (name or ID)
      const responsibilitiesValue = formValue.responsibilitiesHandedOverTo || rawFormValue.responsibilitiesHandedOverTo;
      if (!responsibilitiesValue) {
        console.log('Validation failed: responsibilitiesHandedOverTo missing for P/R form');
        console.log('responsibilitiesHandedOverTo value:', responsibilitiesValue);
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
    Object.keys(this.exitForm.controls).forEach(key => {
      this.exitForm.get(key)?.markAsTouched();
    });
  }

  /**
   * Show specific validation errors for debugging
   */
  showValidationErrors(): void {
    console.log('=== VALIDATION ERRORS ===');
    const formValue = this.exitForm.value;
    const rawFormValue = this.exitForm.getRawValue();
    
    const requiredFields = ['employeeName', 'employeeId', 'department', 'dateOfDeparture', 'noOfDaysApproved', 'reasonForEmergency', 'hodName'];
    
    if (this.formType === 'P' || this.formType === 'R') {
      requiredFields.push('category', 'projectManagerName', 'responsibilitiesHandedOverTo');
    }
    
    requiredFields.forEach(field => {
      const value = rawFormValue[field] || formValue[field];
      const control = this.exitForm.get(field);
      
      if (!value || (field === 'noOfDaysApproved' && value < 1)) {
        console.log(`❌ ${field}: "${value}" (missing or invalid)`);
        console.log(`   Control status: ${control?.status}, Errors:`, control?.errors);
      } else {
        console.log(`✅ ${field}: "${value}"`);
      }
    });
    
    console.log('=== END VALIDATION ERRORS ===');
  }

  allDeclarationsChecked(): boolean {
    const formValue = this.exitForm.value;
    return formValue.decInfoAccurate &&
      formValue.decHandoverComplete &&
      formValue.decReturnAssets &&
      formValue.decUnderstandReturn;
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
    const totalSteps = this.approvalWorkflow.length;
    const completedSteps = this.approvalWorkflow.filter(step => step.status === 'APPROVED').length;
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
      
      // Initialize responsibilities section for Emergency forms
      setTimeout(() => {
        this.ensureResponsibilitiesSectionInitialized();
      }, 100);
      
      // Update URL without navigation
      window.history.replaceState({}, '', `/exit-form?type=${newType}`);
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
      
      // Update Responsibilities input field
      const respInputElement = document.getElementById('responsibilitiesHandedOverTo') as HTMLInputElement;
      if (respInputElement) {
        respInputElement.value = this.getResponsibilitiesHandoverDisplayName();
      }
    }, 100);
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

  /**
   * Get the display name for responsibilities handed over to from the stored ID
   */
  getResponsibilitiesHandoverDisplayName(): string {
    // First try to get from the ID field
    const selectedId = this.exitForm.get('responsibilitiesHandedOverToId')?.value;
    if (selectedId) {
      const selectedEmp = this.employeeMasterList.find(emp => emp.idValue === selectedId);
      if (selectedEmp) {
        return selectedEmp.description || '';
      }
    }
    
    // Fallback to the text field - check if it's an ID or name
    const textValue = this.exitForm.get('responsibilitiesHandedOverTo')?.value;
    if (textValue) {
      // Check if the text value is actually an ID by looking it up
      const empById = this.employeeMasterList.find(emp => emp.idValue === textValue);
      if (empById) {
        return empById.description || '';
      }
      // If not found by ID, assume it's already a name
      return textValue;
    }
    
    return '';
  }

  // Planned Leave dropdown methods
  plannedSearchTerm: string = '';
  isPlannedDropdownOpen: boolean = false;

  onPlannedSearchInputChange(event: any): void {
    this.plannedSearchTerm = event.target?.value || '';
    // Clear the selected value when user starts typing to search
    if (this.plannedSearchTerm !== this.getResponsibilitiesHandoverDisplayName()) {
      // User is typing something different, clear the selection
      this.exitForm.patchValue({
        responsibilitiesHandedOverTo: '', // Clear the stored name
        responsibilitiesHandedOverToId: '' // Clear the stored ID
      });
    }
  }

  showPlannedDropdown(): void {
    // Initialize search term with current display value for better UX
    this.plannedSearchTerm = this.getResponsibilitiesHandoverDisplayName();
    this.isPlannedDropdownOpen = true;
  }

  hidePlannedDropdown(): void {
    setTimeout(() => {
      this.isPlannedDropdownOpen = false;
    }, 200);
  }

  isPlannedDropdownVisible(): boolean {
    return this.isPlannedDropdownOpen;
  }

  // Generic method for filtering employees (used by Responsibilities Handed Over To dropdown)
  getFilteredEmployees(searchTerm: string): DropdownOption[] {
    const list = this.employeeMasterList || [];
    if (!searchTerm || searchTerm.trim() === '') return list;
    
    return list.filter(emp =>
      emp.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  selectPlannedEmployee(employee: DropdownOption): void {
    this.exitForm.patchValue({
      responsibilitiesHandedOverTo: employee.description, // Store the name for display
      responsibilitiesHandedOverToId: employee.idValue    // Store the ID for backend
    });
    this.plannedSearchTerm = employee.description || ''; // Update search term to show selected name
    this.isPlannedDropdownOpen = false;
    
    // Update the input field value immediately
    const inputElement = document.getElementById('responsibilitiesHandedOverTo') as HTMLInputElement;
    if (inputElement) {
      inputElement.value = employee.description || '';
    }
  }

  isPlannedEmployeeSelected(employee: DropdownOption): boolean {
    const selectedName = this.exitForm.get('responsibilitiesHandedOverTo')?.value;
    const selectedId = this.exitForm.get('responsibilitiesHandedOverToId')?.value;
    return selectedName === employee.description || selectedId === employee.idValue;
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
      responsiblePersonId: employee.idValue
    });
    this.dropdownVisibility[index] = false;
  }

  isEmployeeSelected(index: number, employee: DropdownOption): boolean {
    const responsibilityGroup = this.responsibilitiesFormArray.at(index) as FormGroup;
    return responsibilityGroup.get('responsiblePersonName')?.value === employee.description;
  }

  ensureResponsibilitiesSectionInitialized(): void {
    if (this.formType === 'E') {
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
    // Only show action buttons when:
    // 1. User is in approval mode (came from approval listing)
    // 2. There is an approvalID (specific approval request)
    // 3. User has permission to take action on this request
    // 4. No action has been taken yet
    return this.isApprovalMode && !!this.approvalID && !this.isViewMode && !this.actionTaken;
  }

  /**
   * Check if the current user is the assigned approver for this step
   */
  isCurrentUserApprover(): boolean {
    if (!this.currentUser || !this.approvalWorkflow) {
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

  private performApproval(): void {
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

    const request: UpdateExitApprovalRequest = {
      approvalId: this.approvalID || undefined,
      exitId: parseInt(exitId),
      approverId: approverId,
      status: 'A',
      remarks: this.approvalRemarks?.trim() || undefined // Allow empty remarks for approval
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
      remarks: this.approvalRemarks.trim()
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
    console.log('Approval workflow length:', this.approvalWorkflow.length);
    this.approvalWorkflow.forEach((step, index) => {
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
    
    const approvedSteps = this.approvalWorkflow.filter(step => step.status === 'APPROVED').length;
    return Math.round((approvedSteps / this.approvalWorkflow.length) * 100);
  }

  /**
   * Get line status for timeline
   */
  getLineStatus(index: number): string {
    if (!this.approvalWorkflow || index >= this.approvalWorkflow.length - 1) {
      return 'pending';
    }
    
    const currentStep = this.approvalWorkflow[index];
    const nextStep = this.approvalWorkflow[index + 1];
    
    if (currentStep.status === 'APPROVED') {
      return nextStep.status === 'APPROVED' ? 'completed' : 'active';
    }
    
    return 'pending';
  }

  /**
   * Get approved count for progress display
   */
  getApprovedCount(): number {
    if (!this.approvalWorkflow) return 0;
    return this.approvalWorkflow.filter(step => step.status === 'APPROVED').length;
  }

  /**
   * Get the approval workflow to display - static for new forms, dynamic for existing ones
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
    
    // Otherwise show the dynamic approval workflow
    return this.approvalWorkflow;
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
   * Refresh approval workflow data
   */
  refreshApprovalWorkflow(): void {
    const exitId = this.route.snapshot.queryParams['exitID'] || this.route.snapshot.queryParams['requestId'];
    if (exitId) {
      console.log('Refreshing approval workflow for exitId:', exitId);
      this.loadSavedExitData(parseInt(exitId));
    }
  }
}