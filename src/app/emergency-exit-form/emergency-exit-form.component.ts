import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../services/api';
import { DropdownOption, ExitEmpProfileDetails } from '../models/common.model';
import { EmployeeExitRequest, EmployeeExitResponsibility, ApprovalStep, DepartmentApproval, EmployeeExitApprovalWorkflow } from '../models/employeeExit.model';
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

  // Form type flag: 'E' for Emergency, 'P' for Planned Leave, 'R' for Resignation
  @Input() formType: 'E' | 'P' | 'R' = 'E';

  // Approval mode flags
  isApprovalMode: boolean = false;
  isViewMode: boolean = false;
  approvalRequestData: any = null;
  returnUrl: string = '';

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
        this.loadProjectManagerList();
        this.loadEmployeeMasterList();
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
      const approvalID = params['approvalID'];

      console.log('=== SETFORMTYPE DEBUG ===');
      console.log('URL params:', { typeParam, modeParam, requestId, approvalID });
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
      if (approvalID || requestId) {
        this.isApprovalMode = !!approvalID;
        this.isViewMode = !approvalID; // If we have an ID but not approvalID, it's typically view mode until data is assessed
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
      }

      // Update form validations and steps when form type changes

      this.updateFormValidations();

      // Check for exitID to load saved data (check multiple common names for better compatibility)
      const exitIdParam = params['exitID'] || params['exitId'] || params['requestId'];
      if (exitIdParam) {
        console.log('Loading saved data for exitId:', exitIdParam);
        this.loadSavedExitData(parseInt(exitIdParam));
      } else if (!this.isApprovalMode && !this.isViewMode) {
        // Re-populate form with session data after form type change
        this.populateFormFromSession();

        // Load employee details for the new form type
        this.loadEmployeeDetails();

        // Load master lists for non-approval mode
        this.loadHodMasterList();
        this.loadProjectManagerList();
        this.loadEmployeeMasterList();

        // Ensure fields are enabled for regular form usage
        this.enableFormFields();
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
            projectManagerName: data.projectSiteIncharge || '',
            reasonForEmergency: data.reasonForLeave || '',
            category: data.category || '',
            responsibilitiesHandedOverTo: data.responsibilitiesHanded || '',
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
              approvedDate: history.approvalDate,
              comments: history.remarks,
              isRequired: true,
              order: history.approvalLevel || index + 1
            }));
            this.updateWorkflowProgress();
          }

          // Fetch additional employee details (profile/image) using the employeeId from saved data
          if (data.employeeId) {
            this.loadEmployeeDetailsById(data.employeeId);
          }

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
      this.employeePhoto = `data:image/jpeg;base64,${photoBase64}`;
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

    // Validate form for current type
    if (!this.validateFormForCurrentType()) {
      this.markAllFieldsAsTouched();
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
      dateArrival: formatDate(formValue.dateOfArrival),
      flightTime: formValue.flightTime || '',
      responsibilitiesHanded: (this.formType === 'P' || this.formType === 'R') ? (formValue.responsibilitiesHandedOverToId || formValue.responsibilitiesHandedOverTo || '') : '',
      noOfDaysApproved: parseInt(formValue.noOfDaysApproved) || 0,
      depHod: formValue.hodName || '',
      projectSiteIncharge: formValue.projectManagerName || '',
      reasonForLeave: formValue.reasonForEmergency || '',
      approvalStatus: 'P',
      category: formValue.category || '',
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
        }
      },
      error: (error: any) => {
        console.error('Error loading project manager list:', error);
      }
    });
  }

  loadEmployeeMasterList(): void {
    this.api.GetEmployeeMasterList().subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.employeeMasterList = response.data.map((emp: any) => ({
            idValue: emp.idValue || emp.empId || emp.id || emp.employeeId,
            description: emp.description || emp.employeeName || emp.name
          }));
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
        projectManagerName: request.projectSiteIncharge || request.projectManagerName || '',
        category: request.category || '',
        responsibilitiesHandedOverTo: request.responsibilitiesHanded || request.responsibilitiesHandedOverTo || '',
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

    // Common required fields - mix of enabled and disabled fields
    if (!rawFormValue.employeeName) return false;
    if (!rawFormValue.employeeId) return false;
    if (!rawFormValue.department) return false;
    if (!formValue.dateOfDeparture) return false;
    if (!formValue.noOfDaysApproved || formValue.noOfDaysApproved < 1) return false;
    if (!formValue.reasonForEmergency) return false;
    if (!formValue.hodName) return false;

    // Planned leave and resignation specific fields
    if (this.formType === 'P' || this.formType === 'R') {
      if (!formValue.category) return false;
      if (!formValue.projectManagerName) return false;
      if (!formValue.responsibilitiesHandedOverTo) return false;
    }

    // Emergency form - validate responsibilities
    if (this.formType === 'E') {
      return this.validateResponsibilities();
    }

    return true;
  }

  markAllFieldsAsTouched(): void {
    Object.keys(this.exitForm.controls).forEach(key => {
      this.exitForm.get(key)?.markAsTouched();
    });
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
    return 'pending';
  }

  switchFormType(newType: 'E' | 'P' | 'R'): void {
    if (this.isApprovalMode || this.isViewMode) return;
    if (this.formType !== newType) {
      this.formType = newType;
      this.updateFormValidations();
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

  // Project Manager dropdown methods
  pmSearchTerm: string = '';
  isPMDropdownOpen: boolean = false;

  onPMSearchInputChange(event: any): void {
    this.pmSearchTerm = event.target?.value || '';
  }

  showPMDropdown(): void {
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
    if (!searchTerm) return this.projectManagerList;
    return this.projectManagerList.filter(pm =>
      pm.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  selectProjectManager(pm: DropdownOption): void {
    this.exitForm.patchValue({
      projectManagerName: pm.description
    });
    this.isPMDropdownOpen = false;
  }

  isPMSelected(pm: DropdownOption): boolean {
    return this.exitForm.get('projectManagerName')?.value === pm.description;
  }

  getEmployeeNameFromDescription(description: string): string {
    return description.split(' - ')[0] || description;
  }

  // Planned Leave dropdown methods
  plannedSearchTerm: string = '';
  isPlannedDropdownOpen: boolean = false;

  onPlannedSearchInputChange(event: any): void {
    this.plannedSearchTerm = event.target?.value || '';
  }

  showPlannedDropdown(): void {
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

  getFilteredEmployees(searchTerm: string): DropdownOption[] {
    if (!searchTerm) return this.employeeMasterList;
    return this.employeeMasterList.filter(emp =>
      emp.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  selectPlannedEmployee(employee: DropdownOption): void {
    this.exitForm.patchValue({
      responsibilitiesHandedOverTo: employee.description,
      responsibilitiesHandedOverToId: employee.idValue
    });
    this.isPlannedDropdownOpen = false;
  }

  isPlannedEmployeeSelected(employee: DropdownOption): boolean {
    return this.exitForm.get('responsibilitiesHandedOverTo')?.value === employee.description;
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

  toggleResponsibilitiesSection(): void {
    // Toggle responsibilities section visibility if needed
  }

  getCurrentTimestamp(): number {
    return Date.now();
  }

  canUserTakeAction(): boolean {
    return this.isApprovalMode && !!this.approvalRequestData;
  }

  approvalRemarks: string = '';

  approveRequest(): void {
    if (this.approvalRemarks.trim()) {
      // Handle approval logic
      this.toastr.success('Request approved successfully', 'Approval Successful');
      this.returnToApprovalListing();
    }
  }

  rejectRequest(): void {
    if (this.approvalRemarks.trim()) {
      // Handle rejection logic
      this.toastr.success('Request rejected successfully', 'Rejection Successful');
      this.returnToApprovalListing();
    }
  }

  // Additional missing properties and methods
  isResponsibilitiesSectionOpen: boolean = true;

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
}