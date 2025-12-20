import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../services/api';
import { DropdownOption, ExitEmpProfileDetails } from '../models/common.model';
import { EmployeeExitRequest, EmployeeExitResponsibility, ApprovalStep, DepartmentApproval } from '../models/employeeExit.model';
import { SessionService } from '../services/session.service';
import { ToastrService } from 'ngx-toastr';
import { ApprovalWorkflowService } from '../services/approval-workflow.service';
import Swal from 'sweetalert2';

interface Department {
  id: number;
  name: string;
  items: DepartmentItem[];
  hodName?: string;
  status: 'pending' | 'approved' | 'rejected';
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

  currentStep = 1;
  totalSteps = 4;
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

      // Populate form with session data first
      this.populateFormFromSession();

      // Set form type based on URL parameter or input (this will re-populate if needed)
      this.setFormType();

      // Update validators based on form type
      this.updateValidatorsForFormType();

      // Load master lists from API
      this.loadHodMasterList();
      this.loadProjectManagerList();
      this.loadEmployeeMasterList();

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
      const requestId = params['requestId'];
      
      console.log('=== SETFORMTYPE DEBUG ===');
      console.log('URL params:', { typeParam, modeParam, requestId });
      console.log('Current approval mode before processing:', this.isApprovalMode);
      
      if (typeParam === 'P' || typeParam === 'E' || typeParam === 'R') {
        this.formType = typeParam;
        console.log('Form type set to:', this.formType);
      } else {
        // Default to Emergency if no valid type is provided
        this.formType = 'E';
        console.log('Form type defaulted to Emergency');
      }

      // Check if this is approval mode or view mode
      if (modeParam === 'approval') {
        this.isApprovalMode = true;
        this.returnUrl = sessionStorage.getItem('returnUrl') || '/leave-approval';
        
        // Load approval request data
        const requestData = sessionStorage.getItem('approvalRequestData');
        if (requestData) {
          this.approvalRequestData = JSON.parse(requestData);
          console.log('Approval mode activated for request:', requestId);
          
          // Go directly to step 4 for approval from listing
          this.currentStep = 4;
          
          // Populate form with request data
          this.populateFormFromApprovalData();
        }
      } else if (modeParam === 'view') {
        this.isApprovalMode = false; // View mode, not approval mode
        this.returnUrl = sessionStorage.getItem('returnUrl') || '/leave-approval';
        
        // Load request data for viewing
        const requestData = sessionStorage.getItem('approvalRequestData');
        if (requestData) {
          this.approvalRequestData = JSON.parse(requestData);
          console.log('View mode activated for request:', requestId);
          
          // Start from step 1 to show complete form for viewing
          this.currentStep = 1;
          
          // Populate form with request data
          this.populateFormFromApprovalData();
        }
      } else {
        this.isApprovalMode = false;
        this.approvalRequestData = null;
        console.log('Regular form mode - no approval/view mode');
      }

      console.log('Final approval mode after processing:', this.isApprovalMode);
      console.log('=== END SETFORMTYPE DEBUG ===');

      // Update form validations and steps when form type changes
      // Planned Leave and Resignation use same structure (2 steps), Emergency uses 4 steps
      this.totalSteps = (this.formType === 'P' || this.formType === 'R') ? 2 : 4;
      this.updateFormValidations();

      if (!this.isApprovalMode) {
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

  // Switch form type using tabs
  switchFormType(newType: 'E' | 'P' | 'R') {
    if (this.formType !== newType) {
      this.formType = newType;
      console.log('Form type switched to:', this.formType);
      
      // Update form validations
      this.updateFormValidations();
      
      // Clear form data and reset
      this.clearFormAndReset();
      
      // Re-populate with session data
      this.populateFormFromSession();
      
      // Add responsibility for Emergency forms
      if (this.formType === 'E' && this.responsibilitiesFormArray.length === 0) {
        this.addResponsibility();
      }
      
      // Update URL without navigation
      window.history.replaceState({}, '', `/exit-form?type=${newType}`);
    }
  }

  // Clear form data and validation errors when switching form types
  clearFormAndReset() {
    // Store employee data before reset
    const employeeData = {
      employeeName: this.exitForm.get('employeeName')?.value,
      employeeId: this.exitForm.get('employeeId')?.value,
      department: this.exitForm.get('department')?.value,
      address: this.exitForm.get('address')?.value,
      district: this.exitForm.get('district')?.value,
      place: this.exitForm.get('place')?.value,
      state: this.exitForm.get('state')?.value,
      postOffice: this.exitForm.get('postOffice')?.value,
      nation: this.exitForm.get('nation')?.value,
      telephoneMobile: this.exitForm.get('telephoneMobile')?.value,
      telephoneLandline: this.exitForm.get('telephoneLandline')?.value,
      emailId: this.exitForm.get('emailId')?.value,
      hodName: this.exitForm.get('hodName')?.value
    };

    this.exitForm.reset();

    // Restore employee data
    this.exitForm.patchValue(employeeData);

    // Clear all validation errors
    Object.keys(this.exitForm.controls).forEach(key => {
      const control = this.exitForm.get(key);
      control?.setErrors(null);
      control?.markAsUntouched();
      control?.markAsPristine();
    });

    // Always disable employee information fields
    this.disableEmployeeInfoFields();
    
    // Enable other fields for regular form usage
    if (!this.isApprovalMode && !this.approvalRequestData) {
      this.enableFormFields();
    }

    // Reset department statuses
    this.departments.forEach(dept => {
      dept.status = 'pending';
      dept.approvedDate = undefined;
      dept.comments = undefined;
    });

    // Clear approval remarks
    this.hodRemarks = '';
    this.hodDaysAllowed = 0;
    this.pmRemarks = '';
    this.pmDaysAllowed = 0;

    // Reset responsibilities array
    this.responsibilitiesFormArray.clear();
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
            
            // Set employee photo
            if (data.profileImageBase64) {
              this.employeePhoto = `data:image/jpeg;base64,${data.profileImageBase64}`;
            } else if (this.currentUser.photo) {
              this.employeePhoto = this.currentUser.photo;
            }
            
            // Update contact details from profile
            this.exitForm.patchValue({
              address: data.address || '',
              district: data.district || '',
              place: data.place || '',
              state: data.state || '',
              postOffice: data.postOffice || '',
              nation: data.nation || '',
              telephoneMobile: data.phone || '',
              telephoneLandline: data.telephone || '',
              emailId: data.email || this.currentUser.email || ''
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

  // Handle photo loading error
  onPhotoError(event: any): void {
    console.log('Photo loading failed, using default avatar');
    event.target.src = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format';
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

  nextStep() {
    console.log('NextStep called - Current step:', this.currentStep, 'Form type:', this.formType, 'Approval mode:', this.isApprovalMode);
    
    // In approval mode or view mode, allow simple sequential navigation without validation
    if (this.isApprovalMode || this.approvalRequestData) {
      if (this.currentStep < 4) {
        this.currentStep++;
        console.log('Approval/View mode: Moving to step', this.currentStep);
      }
      return;
    }
    
    // Regular form mode - validate before proceeding
    const isValid = this.validateCurrentStep();
    console.log('Validation result:', isValid);
    
    if (!isValid) {
      // Show user-friendly message about what's missing
      this.showValidationErrors();
      return;
    }

    if (isValid) {
      // For Planned Leave and Resignation: Step 1 -> Step 3 (Final Review)
      if ((this.formType === 'P' || this.formType === 'R') && this.currentStep === 1) {
        this.currentStep = 3; // Go to final review step
        console.log('Planned Leave/Resignation: Moving from Step 1 to Step 3 (Final Review)');
      } 
      // For Emergency: Step 1 -> Step 2 -> Step 3 (Final Review)
      else if (this.formType === 'E' && this.currentStep < 3) {
        this.currentStep++;
        console.log('Emergency: Moving to step', this.currentStep);
      }
    } else {
      console.log('Validation failed, not moving to next step');
    }
  }

  previousStep() {
    console.log('PreviousStep called - Current step:', this.currentStep, 'Form type:', this.formType, 'Approval mode:', this.isApprovalMode);
    
    if (this.currentStep > 1) {
      // In approval mode or view mode, allow simple sequential navigation
      if (this.isApprovalMode || this.approvalRequestData) {
        this.currentStep--;
        console.log('Approval/View mode: Moving to step', this.currentStep);
        return;
      }
      
      // Regular form mode - use form-type-specific navigation
      // For Planned Leave and Resignation, go back from Step 3 (Final Review) to Step 1
      if ((this.formType === 'P' || this.formType === 'R') && this.currentStep === 3) {
        this.currentStep = 1; // Go back to step 1
      } 
      // For Planned Leave and Resignation, go back from Step 4 (Approvals) to Step 3 (Final Review)
      else if ((this.formType === 'P' || this.formType === 'R') && this.currentStep === 4) {
        this.currentStep = 3; // Go back to final review step
      } 
      // For Emergency, go back from Step 4 (Approvals) to Step 3 (Final Review)
      else if (this.formType === 'E' && this.currentStep === 4) {
        this.currentStep = 3; // Go back to final review step
      } else {
        this.currentStep--;
      }
    }
  }

  goToStep(step: number) {
    if (step >= 1 && step <= this.totalSteps) {
      this.currentStep = step;
      // Ensure all department cards are visible when going to step 4 (approvals)
      if (step === 4) {
        this.cdr.detectChanges(); // Force change detection
        setTimeout(() => {
          this.ensureAllCardsVisible();
        }, 100);
      }
    }
  }

  ensureAllCardsVisible() {
    // Force all department cards to be visible immediately
    this.cdr.detectChanges();
    setTimeout(() => {
      const cards = document.querySelectorAll('.department-card');
      console.log('Found cards:', cards.length); // Debug log
      cards.forEach((card, index) => {
        const element = card as HTMLElement;
        element.style.display = 'block !important';
        element.style.opacity = '1 !important';
        element.style.visibility = 'visible !important';
        element.style.position = 'relative !important';
        element.style.zIndex = '1 !important';
        console.log(`Card ${index} made visible`); // Debug log
      });
    }, 50);
  }

  validateCurrentStep(): boolean {
    switch (this.currentStep) {
      case 1:
        return this.validateEmployeeInfo();
      case 2:
        return this.validateResponsibilities();
      case 3:
        return true; // Final review step - no additional validation needed
      case 4:
        return true; // Department approvals are handled by HODs
      default:
        return true;
    }
  }

  validateEmployeeInfo(): boolean {
    // Disabled fields (employee info) - check if they have values
    const disabledFields = ['employeeName', 'employeeId', 'department'];
    for (const field of disabledFields) {
      const control = this.exitForm.get(field);
      if (!control || !control.value) {
        console.log('Validation failed for disabled field:', field, 'Value:', control?.value);
        return false;
      }
    }

    // Regular required fields that are editable
    let requiredFields = ['dateOfDeparture', 'noOfDaysApproved', 'reasonForEmergency', 'hodName'];

    // Contact details are NOT validated - they are display-only from profile

    // Add planned leave and resignation specific validations
    if (this.formType === 'P' || this.formType === 'R') {
      requiredFields.push('category', 'responsibilitiesHandedOverTo', 'projectManagerName');
    }

    console.log('Validating editable fields:', requiredFields);

    for (const field of requiredFields) {
      const control = this.exitForm.get(field);
      if (!control || !control.value || control.invalid) {
        console.log('Validation failed for field:', field, 'Value:', control?.value, 'Invalid:', control?.invalid);
        control?.markAsTouched();
        return false;
      }
    }
    console.log('All validations passed');
    return true;
  }

  validateResponsibilities(): boolean {
    const responsibilities = this.responsibilitiesFormArray;
    console.log('Validating responsibilities - Count:', responsibilities.length);
    
    if (responsibilities.length === 0) {
      console.log('No responsibilities found');
      return false;
    }

    for (let i = 0; i < responsibilities.length; i++) {
      const group = responsibilities.at(i) as FormGroup;
      console.log(`Responsibility ${i + 1} - Valid:`, group.valid, 'Value:', group.value);
      
      if (group.invalid) {
        console.log(`Responsibility ${i + 1} - Invalid fields:`);
        Object.keys(group.controls).forEach(key => {
          const control = group.get(key);
          if (control && control.invalid) {
            console.log(`  - ${key}:`, control.errors, 'Value:', control.value);
          }
          control?.markAsTouched();
        });
        return false;
      }
    }
    console.log('All responsibilities validation passed');
    return true;
  }

  showValidationErrors(): void {
    if (this.currentStep === 1) {
      this.toastr.error('Please fill in all required fields in Step 1 before proceeding.', 'Validation Error');
    } else if (this.currentStep === 2) {
      const responsibilities = this.responsibilitiesFormArray;
      const errors: string[] = [];
      
      for (let i = 0; i < responsibilities.length; i++) {
        const group = responsibilities.at(i) as FormGroup;
        if (group.invalid) {
          Object.keys(group.controls).forEach(key => {
            const control = group.get(key);
            if (control && control.invalid) {
              const fieldName = this.getResponsibilityFieldName(key);
              errors.push(`Responsibility ${i + 1} - ${fieldName}`);
            }
          });
        }
      }
      
      if (errors.length > 0) {
        this.toastr.error(`Please complete the following fields:\n\n${errors.join('\n')}`, 'Validation Error');
      } else {
        this.toastr.error('Please complete all responsibility information before proceeding.', 'Validation Error');
      }
    }
  }

  getResponsibilityFieldName(key: string): string {
    switch (key) {
      case 'project': return 'Project Name';
      case 'activities': return 'Activities Description';
      case 'responsiblePersonName': return 'Responsible Person Name';
      case 'responsiblePersonPhone': return 'Phone Number';
      case 'responsiblePersonEmail': return 'Email Address';
      case 'remarks': return 'Remarks';
      default: return key;
    }
  }

  getStepTitle(): string {
    if (this.formType === 'P') {
      switch (this.currentStep) {
        case 1: return 'Employee Information';
        case 3: return 'Final Review & Submit';
        case 4: return 'Department Approvals';
        default: return 'Employee Exit Form - Planned Leave';
      }
    } else if (this.formType === 'R') {
      switch (this.currentStep) {
        case 1: return 'Employee Information';
        case 3: return 'Final Review & Submit';
        case 4: return 'Department Approvals';
        default: return 'Employee Exit Form - Resignation';
      }
    } else {
      switch (this.currentStep) {
        case 1: return 'Employee Information';
        case 2: return 'Responsibility Handover';
        case 3: return 'Final Review & Submit';
        case 4: return 'Department Approvals';
        default: return 'Emergency Exit Form';
      }
    }
  }

  getStepDescriptionOld(): string {
    if (this.formType === 'P') {
      switch (this.currentStep) {
        case 1: return 'Review your profile information and provide travel details and leave information';
        case 3: return 'Review all information and submit the form';
        case 4: return 'Department HODs and Project Manager will review and approve your request';
        default: return '';
      }
    } else if (this.formType === 'R') {
      switch (this.currentStep) {
        case 1: return 'Review your profile information and provide resignation details';
        case 3: return 'Review all information and submit the form';
        case 4: return 'Department HODs and Project Manager will review and approve your request';
        default: return '';
      }
    } else {
      switch (this.currentStep) {
        case 1: return 'Review your profile information and provide travel details';
        case 2: return 'List all responsibilities to be handed over';
        case 3: return 'Review all information and submit the form';
        case 4: return 'Department HODs will review and approve your request';
        default: return '';
      }
    }
  }

  getDepartmentItemValue(deptId: number, itemLabel: string): any {
    // This would typically come from a service or stored form data
    return '';
  }

  updateDepartmentItem(deptId: number, itemLabel: string, event: any) {
    // Update the department item value
    const value = event.target ? (event.target.type === 'checkbox' ? event.target.checked : event.target.value) : event;
    // This would typically update a service or form data
    console.log(`Department ${deptId}, Item: ${itemLabel}, Value: ${value}`);
  }

  approveDepartment(deptId: number, approved: boolean, comments?: string) {
    const dept = this.departments.find(d => d.id === deptId);
    if (dept) {
      dept.status = approved ? 'approved' : 'rejected';
      dept.approvedDate = new Date();
      dept.comments = comments;
    }
  }

  approveHOD(approved: boolean) {
    const hodDept = this.departments.find(d => d.id === 0);
    if (hodDept) {
      hodDept.status = approved ? 'approved' : 'rejected';
      hodDept.approvedDate = new Date();
      if (approved) {
        hodDept.comments = `${this.hodDaysAllowed} days allowed. Remarks: ${this.hodRemarks}`;
      } else {
        hodDept.comments = `Rejected by HOD. Remarks: ${this.hodRemarks}`;
      }
    }
  }

  getAllApprovalStatus(): 'pending' | 'approved' | 'rejected' | 'partial' {
    const approved = this.departments.filter(d => d.status === 'approved').length;
    const rejected = this.departments.filter(d => d.status === 'rejected').length;
    const total = this.departments.length;

    if (rejected > 0) return 'rejected';
    if (approved === total) return 'approved';
    if (approved > 0) return 'partial';
    return 'pending';
  }

  getProgressPercentage(): number {
    const approved = this.departments.filter(d => d.status === 'approved').length;
    return (approved / this.departments.length) * 100;
  }

  allDeclarationsChecked(): boolean {
    return (
      !!this.exitForm.get('decInfoAccurate')?.value &&
      !!this.exitForm.get('decHandoverComplete')?.value &&
      !!this.exitForm.get('decReturnAssets')?.value &&
      !!this.exitForm.get('decUnderstandReturn')?.value
    );
  }

  submitForm() {
    console.log('Submit form called - Form Type:', this.formType);
    console.log('Form valid:', this.exitForm.valid);
    console.log('Form value:', this.exitForm.value);
    
    // Validate form for current type
    if (!this.validateFormForCurrentType()) {
      this.markAllFieldsAsTouched();
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
      
      // Add workflow to exit request
      exitRequest.approvalWorkflow = this.approvalWorkflow;
      exitRequest.departmentApprovals = this.departmentApprovals;
      exitRequest.currentApprovalStep = 1;
      exitRequest.overallStatus = 'PENDING';
      exitRequest.submittedDate = new Date().toISOString();
      
      // Call API
      this.api.InsertEmployeeExit(exitRequest).subscribe({
        next: (response: any) => {
          console.log('Form submitted successfully:', response);
          this.isSubmitting = false;
          
          if (response && response.success) {
            // Show success message
            this.toastr.success('Form submitted successfully! Your request is now being processed.', 'Submission Successful');
            
            // Update workflow progress
            this.updateWorkflowProgress();
            
            // Move to approval workflow step
            this.currentStep = 4;
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
      // Resignation specific fields (reuse existing fields)
      lastWorkingDate: this.formType === 'R' ? formatDate(formValue.dateOfDeparture) : '',
      NoticePeriod: this.formType === 'R' ? parseInt(formValue.noOfDaysApproved) || 0 : 0,
      declaration1: formValue.decInfoAccurate ? 'Y' : 'N',
      declaration2: formValue.decHandoverComplete ? 'Y' : 'N',
      declaration3: formValue.decReturnAssets ? 'Y' : 'N',
      declaration4: formValue.decUnderstandReturn ? 'Y' : 'N',
      responsibilities: responsibilities,
      // New workflow properties - will be set after generation
      approvalWorkflow: [],
      departmentApprovals: [],
      currentApprovalStep: 1,
      overallStatus: 'PENDING',
      submittedDate: new Date().toISOString()
    };

    console.log('Prepared exit request:', exitRequest);
    return exitRequest;
  }

  private validateEmailAndPhone(): boolean {
    const formValue = this.exitForm.value;
    
    // Skip contact details validation - they are display-only from profile
    // Only validate responsibility emails and phones for Emergency forms
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[+]?[0-9\s\-()]{7,15}$/; // More flexible phone pattern

    // Validate responsibility emails for Emergency forms
    if (this.formType === 'E' && formValue.responsibilities) {
      for (let i = 0; i < formValue.responsibilities.length; i++) {
        const resp = formValue.responsibilities[i];
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

    return true;
  }

  private updateValidatorsForFormType(): void {
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
      // dateOfDeparture and noOfDaysApproved are already required and will be used for lastWorkingDate and noticePeriod
    }
    
    // Update validity after changing validators
    Object.keys(this.exitForm.controls).forEach(key => {
      this.exitForm.get(key)?.updateValueAndValidity();
    });
  }

  private validateFormForCurrentType(): boolean {
    const formValue = this.exitForm.value;
    const missingFields: string[] = [];

    // Common required fields
    if (!formValue.employeeName) missingFields.push('Employee Name');
    if (!formValue.employeeId) missingFields.push('Employee ID');
    if (!formValue.department) missingFields.push('Department');
    if (!formValue.dateOfDeparture) missingFields.push('Date of Departure');
    if (!formValue.noOfDaysApproved || formValue.noOfDaysApproved < 1) missingFields.push('Number of Days');
    if (!formValue.reasonForEmergency) missingFields.push('Reason for Leave');
    if (!formValue.hodName) missingFields.push('HOD Name');

    // Contact details are NOT validated - they are display-only from profile

    // Planned leave and resignation specific fields
    if (this.formType === 'P' || this.formType === 'R') {
      if (!formValue.category) missingFields.push('Category (Staff/Worker)');
      if (!formValue.projectManagerName) missingFields.push('Project Manager');
      if (!formValue.responsibilitiesHandedOverTo) missingFields.push('Responsibilities Handed Over To');
      
      // Resignation uses existing dateOfDeparture and noOfDaysApproved fields with different labels
      // No additional validation needed as they are already validated above
    }

    // Emergency specific - check responsibilities
    if (this.formType === 'E') {
      if (!formValue.responsibilities || formValue.responsibilities.length === 0) {
        missingFields.push('At least one responsibility');
      } else {
        formValue.responsibilities.forEach((resp: any, index: number) => {
          if (!resp.project) missingFields.push(`Responsibility ${index + 1} - Project`);
          if (!resp.activities) missingFields.push(`Responsibility ${index + 1} - Activities`);
          if (!resp.responsiblePersonName) missingFields.push(`Responsibility ${index + 1} - Person Name`);
          if (!resp.responsiblePersonPhone) missingFields.push(`Responsibility ${index + 1} - Phone`);
          if (!resp.responsiblePersonEmail) missingFields.push(`Responsibility ${index + 1} - Email`);
        });
      }
    }

    if (missingFields.length > 0) {
      console.log('Missing required fields:', missingFields);
      this.toastr.error(`Please fill in the following required fields:\n\n${missingFields.join('\n')}`, 'Validation Error');
      return false;
    }

    return true;
  }

  private markAllFieldsAsTouched(): void {
    Object.keys(this.exitForm.controls).forEach(key => {
      const control = this.exitForm.get(key);
      if (control) {
        control.markAsTouched();
        if (control instanceof FormArray) {
          control.controls.forEach(arrayControl => {
            if (arrayControl instanceof FormGroup) {
              Object.keys(arrayControl.controls).forEach(nestedKey => {
                arrayControl.get(nestedKey)?.markAsTouched();
              });
            }
          });
        }
      }
    });
  }

  resetForm() {
    this.exitForm.reset();
    this.formSubmitted = false;
    this.departments.forEach(dept => {
      dept.status = 'pending';
      dept.approvedDate = undefined;
      dept.comments = undefined;
    });
    this.responsibilitiesFormArray.clear();
    
    // Add responsibility for Emergency forms
    if (this.formType === 'E') {
      this.addResponsibility();
    }
    
    // Re-populate form with session data
    this.populateFormFromSession();
    
    // Re-disable employee information fields
    this.disableEmployeeInfoFields();
  }

  downloadPDF() {
    // Implement PDF generation
    console.log('Downloading PDF...');
  }

  // Signature pad methods (simplified)
  startDrawing(event: MouseEvent) {
    // Implement signature drawing
    console.log('Start drawing signature');
  }

  draw(event: MouseEvent) {
    // Implement signature drawing
    console.log('Drawing signature');
  }

  stopDrawing() {
    // Implement signature drawing
    console.log('Stop drawing signature');
  }

  clearSignature() {
    // Clear signature canvas
    console.log('Clear signature');
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.exitForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.exitForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return 'This field is required';
      if (field.errors['email']) return 'Please enter a valid email address';
      if (field.errors['min']) return 'Value must be greater than 0';
      if (field.errors['pattern']) {
        if (fieldName.includes('Phone') || fieldName.includes('Mobile')) {
          return 'Please enter a valid phone number (7-15 digits, may include +, spaces, -, ())';
        }
        if (fieldName.includes('Landline')) {
          return 'Please enter a valid landline number';
        }
        return 'Please enter a valid format';
      }
      if (field.errors['requiredTrue']) return 'This declaration must be checked';
    }
    return '';
  }

  getCurrentTimestamp(): number {
    return Date.now();
  }

  // Load HOD Master List from API
  loadHodMasterList(): void {
    console.log('🔄 Loading HOD master list...');
    
    this.api.GetHodMasterList().subscribe(
      (response: any) => {
        console.log('✅ HOD API Response received:', response);
        
        if (response && response.success && response.data) {
          this.hodList = response.data;
          console.log('✅ HOD List loaded successfully:', this.hodList.length, 'items');
          console.log('📝 First HOD item:', this.hodList[0]);
        } else {
          console.warn('⚠️ No HOD records found or API call failed');
          console.log('📋 Response structure:', response);
          this.hodList = [];
        }
        
        // Force change detection
        this.cdr.detectChanges();
      },
      (error) => {
        console.error('❌ Error fetching HOD master list:', error);
        this.hodList = [];
        this.cdr.detectChanges();
      }
    );
  }

  // Load Project Manager Master List
  loadProjectManagerList(): void {
    console.log('🔄 Loading Project Manager list...');
    
    this.api.GetProjectManagerList().subscribe(
      (response: any) => {
        console.log('✅ PM API Response received:', response);
        
        if (response && response.success && response.data) {
          this.projectManagerList = response.data;
          console.log('✅ PM List loaded successfully:', this.projectManagerList.length, 'items');
        } else {
          console.warn('⚠️ No PM records found, trying Employee API as fallback');
          this.loadProjectManagerFromEmployeeAPI();
        }
      },
      (error) => {
        console.error('❌ PM API error, trying Employee API as fallback:', error);
        this.loadProjectManagerFromEmployeeAPI();
      }
    );
  }

  // Fallback: Load Project Managers from Employee API
  loadProjectManagerFromEmployeeAPI(): void {
    this.api.GetEmployeeMasterList().subscribe(
      (response: any) => {
        console.log('✅ Employee API Response for PM:', response);
        
        if (response && response.success && response.data) {
          this.projectManagerList = response.data;
          console.log('✅ PM List loaded from Employee API:', this.projectManagerList.length, 'items');
        } else {
          console.warn('⚠️ Employee API also failed for PM list');
          this.projectManagerList = [];
        }
      },
      (error) => {
        console.error('❌ Employee API error for PM list:', error);
        this.projectManagerList = [];
      }
    );
  }

  // Load Employee Master List from API
  loadEmployeeMasterList(): void {
    console.log('🔄 Loading Employee master list...');
    
    this.api.GetEmployeeMasterList().subscribe(
      (response: any) => {
        console.log('✅ Employee API Response received:', response);
        
        if (response && response.success && response.data) {
          this.employeeMasterList = response.data;
          console.log('✅ Employee List loaded successfully:', this.employeeMasterList.length, 'items');
        } else {
          console.warn('⚠️ No Employee records found or API call failed');
          this.employeeMasterList = [];
        }
      },
      (error) => {
        console.error('❌ Error fetching Employee master list:', error);
        this.employeeMasterList = [];
      }
    );
  }

  // Project Manager approval method
  approveProjectManager(approved: boolean) {
    // Find or create PM approval in departments array
    let pmDept = this.departments.find(d => d.id === -1);
    if (!pmDept) {
      pmDept = {
        id: -1,
        name: 'Project Manager / Site Incharge Approval',
        status: 'pending',
        items: []
      };
      this.departments.unshift(pmDept); // Add at the beginning
    }

    pmDept.status = approved ? 'approved' : 'rejected';
    pmDept.approvedDate = new Date();
    if (approved) {
      pmDept.comments = `${this.pmDaysAllowed} days allowed. Remarks: ${this.pmRemarks}`;
    } else {
      pmDept.comments = `Rejected by Project Manager. Remarks: ${this.pmRemarks}`;
    }
  }



  // Get form header title based on form type
  getFormHeaderTitle(): string {
    switch (this.formType) {
      case 'P': return 'Employee Exit Form - For Planned Leave';
      case 'R': return 'Employee Exit Form - For Resignation';
      case 'E':
      default: return 'Emergency Exit Form';
    }
  }

  // Check if current step should be displayed based on form type
  shouldShowStep(step: number): boolean {
    if ((this.formType === 'P' || this.formType === 'R') && step === 2) {
      return false; // Hide step 2 for planned leave and resignation
    }
    return true;
  }

  // Get display step number (for planned leave and resignation, step 3 shows as step 2, step 4 shows as step 3)
  getDisplayStepNumber(step: number): number {
    if (this.formType === 'P' || this.formType === 'R') {
      if (step === 3) return 2; // Final review shows as Step 2
      if (step === 4) return 3; // Approvals step shows as Step 3
    }
    return step;
  }

  // Get total display steps
  getTotalDisplaySteps(): number {
    return (this.formType === 'P' || this.formType === 'R') ? 3 : 4;
  }

  // Disable employee information fields (they should always be read-only)
  disableEmployeeInfoFields(): void {
    console.log('Disabling employee information fields');
    console.log('Current form values before disabling:', {
      employeeName: this.exitForm.get('employeeName')?.value,
      employeeId: this.exitForm.get('employeeId')?.value,
      department: this.exitForm.get('department')?.value
    });
    
    this.exitForm.get('employeeName')?.disable();
    this.exitForm.get('employeeId')?.disable();
    this.exitForm.get('department')?.disable();
    
    // Mark these fields as valid even when disabled
    this.exitForm.get('employeeName')?.setErrors(null);
    this.exitForm.get('employeeId')?.setErrors(null);
    this.exitForm.get('department')?.setErrors(null);
    
    console.log('Form values after disabling:', {
      employeeName: this.exitForm.get('employeeName')?.value,
      employeeId: this.exitForm.get('employeeId')?.value,
      department: this.exitForm.get('department')?.value
    });
  }

  // Check if current step is the last step
  isLastStep(): boolean {
    if (this.formType === 'P' || this.formType === 'R') {
      return this.currentStep === 4; // Final step for planned leave and resignation
    } else {
      return this.currentStep === 4; // Final step for emergency
    }
  }

  // Check if we should show the Next button
  shouldShowNextButton(): boolean {
    // In approval mode or view mode, show Next button for steps 1-3
    if (this.isApprovalMode || this.approvalRequestData) {
      return this.currentStep < 4;
    }
    
    // Regular form mode
    if (this.formType === 'P' || this.formType === 'R') {
      return this.currentStep === 1; // Show only on Step 1 for planned leave and resignation
    } else {
      return this.currentStep < 3; // Show on Steps 1 and 2 for emergency
    }
  }

  // Force refresh employee data from session
  refreshEmployeeDataFromSession(): void {
    console.log('Force refreshing employee data from session');
    this.currentUser = this.sessionService.getCurrentUser();
    this.debugUserProperties();
    this.populateFormFromSession();
    this.disableEmployeeInfoFields();
  }



  // Update form validations based on form type
  updateFormValidations() {
    const categoryControl = this.exitForm.get('category');
    const responsibilitiesHandedOverToControl = this.exitForm.get('responsibilitiesHandedOverTo');
    const projectManagerNameControl = this.exitForm.get('projectManagerName');
    const addressControl = this.exitForm.get('address');
    const telephoneMobileControl = this.exitForm.get('telephoneMobile');
    const emailIdControl = this.exitForm.get('emailId');

    if (this.formType === 'P' || this.formType === 'R') {
      // Add validators for planned leave and resignation fields
      categoryControl?.setValidators([Validators.required]);
      responsibilitiesHandedOverToControl?.setValidators([Validators.required]);
      projectManagerNameControl?.setValidators([Validators.required]);



      // Remove contact details requirements for planned leave and resignation
      addressControl?.clearValidators();
      telephoneMobileControl?.clearValidators();
      emailIdControl?.clearValidators();
    } else {
      // Remove validators for planned leave and resignation fields
      categoryControl?.clearValidators();
      responsibilitiesHandedOverToControl?.clearValidators();
      projectManagerNameControl?.clearValidators();

      // Add contact details requirements for emergency
      addressControl?.setValidators([Validators.required]);
      telephoneMobileControl?.setValidators([Validators.required]);
      emailIdControl?.setValidators([Validators.required, Validators.email]);
    }

    // Update validity
    categoryControl?.updateValueAndValidity();
    responsibilitiesHandedOverToControl?.updateValueAndValidity();
    projectManagerNameControl?.updateValueAndValidity();
    addressControl?.updateValueAndValidity();
    telephoneMobileControl?.updateValueAndValidity();
    emailIdControl?.updateValueAndValidity();
  }

  // Load employee details from API for both Emergency and Planned Leave forms
  loadEmployeeDetails(): void {
    // Get employee ID from session storage or local storage
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const empId = currentUser.empId || currentUser.employeeId;

    if (!empId) {
      console.error('Employee ID not found in session');
      // Fallback: try to get from session data directly
      this.loadEmployeeDetailsFromSession();
      return;
    }

    console.log('Loading employee details for empId:', empId);
    this.api.GetExitEmployeeDetails(empId).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.employeeProfileData = response.data as ExitEmpProfileDetails;
          this.bindEmployeeDataToForm();
          console.log('Employee details loaded successfully from API:', this.employeeProfileData);
        } else {
          console.warn('No employee details found from API, trying session data');
          this.loadEmployeeDetailsFromSession();
        }
      },
      error: (error) => {
        console.error('Error fetching employee details from API:', error);
        // Fallback to session data
        this.loadEmployeeDetailsFromSession();
      }
    });

    // Also load employee profile with photo
    this.loadEmployeeProfile();
  }

  // Fallback method to load employee details from session storage
  loadEmployeeDetailsFromSession(): void {
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    
    if (currentUser && (currentUser.empId || currentUser.employeeId)) {
      console.log('Loading employee details from session:', currentUser);
      console.log('Available properties in session:', Object.keys(currentUser));
      
      // Try different possible property names for department
      const department = currentUser.department || 
                        currentUser.empDept || 
                        currentUser.dept || 
                        currentUser.departmentName || 
                        '';
      
      // Map session data to employee profile format
      this.employeeProfileData = {
        empId: currentUser.empId || currentUser.employeeId || '',
        employeeName: currentUser.employeeName || currentUser.name || '',
        empDept: department,
        email: currentUser.email || currentUser.emailId || '',
        phone: currentUser.phone || currentUser.mobile || '',
        address: currentUser.address || '',
        district: currentUser.district || '',
        place: currentUser.place || '',
        state: currentUser.state || '',
        postOffice: currentUser.postOffice || '',
        nationality: currentUser.nationality || currentUser.nation || '',
        telephoneNo: currentUser.telephoneNo || currentUser.landline || '',
        depHodId: currentUser.hodId || currentUser.depHodId || ''
      };

      this.bindEmployeeDataToForm();
      console.log('Employee details loaded from session:', this.employeeProfileData);
    } else {
      console.error('No employee data found in session storage');
    }
  }

  // Bind employee profile data to form fields
  bindEmployeeDataToForm(): void {
    if (this.employeeProfileData) {
      console.log('Binding employee data to form:', this.employeeProfileData);
      
      // Patch form values with employee data
      const formData = {
        employeeName: this.employeeProfileData.employeeName || '',
        employeeId: this.employeeProfileData.empId || '',
        department: this.employeeProfileData.empDept || '',
        address: this.employeeProfileData.address || '',
        district: this.employeeProfileData.district || '',
        place: this.employeeProfileData.place || '',
        state: this.employeeProfileData.state || '',
        postOffice: this.employeeProfileData.postOffice || '',
        nation: this.employeeProfileData.nationality || '',
        telephoneMobile: this.employeeProfileData.phone || '',
        telephoneLandline: this.employeeProfileData.telephoneNo || '',
        emailId: this.employeeProfileData.email || '',
        hodName: this.employeeProfileData.depHodId || ''
      };

      console.log('Form data to be patched:', formData);
      console.log('Department value being set:', formData.department);
      this.exitForm.patchValue(formData);

      // Always disable employee information fields (they should not be editable)
      this.disableEmployeeInfoFields();

      // Verify the form values after patching
      console.log('Form values after patching:', {
        employeeName: this.exitForm.get('employeeName')?.value,
        employeeId: this.exitForm.get('employeeId')?.value,
        department: this.exitForm.get('department')?.value
      });

      // Force change detection to update the UI
      this.cdr.detectChanges();
    } else {
      console.warn('No employee profile data available to bind');
    }
  }

  // Handle employee selection from dropdown
  onEmployeeSelected(responsibilityIndex: number, selectedEmployeeId: string): void {
    const selectedEmployee = this.employeeMasterList.find(emp => emp.idValue === selectedEmployeeId);
    if (selectedEmployee) {
      const responsibilityGroup = this.responsibilitiesFormArray.at(responsibilityIndex) as FormGroup;
      
      // Update the responsible person name with the selected employee's description
      responsibilityGroup.patchValue({
        responsiblePersonName: selectedEmployee.description
      });
      
      console.log('Employee selected:', selectedEmployee);
      console.log('Updated responsibility at index', responsibilityIndex, 'with:', selectedEmployee.description);
    }
  }

  // Filter employees based on search term
  getFilteredEmployees(searchTerm: string): DropdownOption[] {
    if (!searchTerm || searchTerm.length < 2) {
      return this.employeeMasterList;
    }
    
    const term = searchTerm.toLowerCase();
    return this.employeeMasterList.filter(employee => 
      (employee.description || '').toLowerCase().includes(term) ||
      (employee.idValue || '').toLowerCase().includes(term)
    );
  }

  /**
   * Generate approval workflow based on form type and data
   */
  generateApprovalWorkflow(exitRequest: EmployeeExitRequest): void {
    const formValue = this.exitForm.getRawValue();
    
    // Generate approval workflow
    this.approvalWorkflow = this.approvalWorkflowService.generateApprovalWorkflow(this.formType, formValue);
    
    // Generate department approvals
    this.departmentApprovals = this.approvalWorkflowService.generateDepartmentApprovals();
    
    // Set current approval step
    this.currentApprovalStep = this.approvalWorkflowService.getCurrentApprovalStep(this.approvalWorkflow);
    
    console.log('Generated approval workflow:', this.approvalWorkflow);
    console.log('Generated department approvals:', this.departmentApprovals);
  }

  /**
   * Update workflow progress
   */
  updateWorkflowProgress(): void {
    this.workflowProgress = this.approvalWorkflowService.getWorkflowProgress(this.approvalWorkflow);
  }

  /**
   * Get approval status text for display
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
   * Check if workflow is complete
   */
  isWorkflowComplete(): boolean {
    return this.approvalWorkflowService.isWorkflowComplete(this.approvalWorkflow);
  }

  /**
   * Check if workflow is rejected
   */
  isWorkflowRejected(): boolean {
    return this.approvalWorkflowService.isWorkflowRejected(this.approvalWorkflow);
  }

  /**
   * Get overall workflow status
   */
  getOverallWorkflowStatus(): string {
    if (this.isWorkflowRejected()) {
      return 'REJECTED';
    } else if (this.isWorkflowComplete()) {
      return 'APPROVED';
    } else if (this.approvalWorkflow.some(step => step.status === 'APPROVED')) {
      return 'IN_PROGRESS';
    } else {
      return 'PENDING';
    }
  }

  /**
   * Simulate approval action (for demo purposes)
   */
  simulateApproval(stepId: number, approved: boolean, comments?: string): void {
    const step = this.approvalWorkflow.find(s => s.stepId === stepId);
    if (step) {
      if (approved) {
        this.approvalWorkflow = this.approvalWorkflowService.approveStep(
          this.approvalWorkflow, 
          stepId, 
          'current-user-id', 
          'Current User', 
          comments
        );
        this.toastr.success(`${step.stepName} approved successfully!`, 'Approval Success');
      } else {
        this.approvalWorkflow = this.approvalWorkflowService.rejectStep(
          this.approvalWorkflow, 
          stepId, 
          'current-user-id', 
          'Current User', 
          comments || 'Rejected'
        );
        this.toastr.error(`${step.stepName} rejected.`, 'Approval Rejected');
      }
      
      // Update current step and progress
      this.currentApprovalStep = this.approvalWorkflowService.getCurrentApprovalStep(this.approvalWorkflow);
      this.updateWorkflowProgress();
      this.cdr.detectChanges();
    }
  }

  /**
   * Simulate department approval
   */
  simulateDepartmentApproval(departmentId: string, approved: boolean, comments?: string): void {
    const department = this.departmentApprovals.find(d => d.departmentId === departmentId);
    if (department) {
      department.status = approved ? 'APPROVED' : 'REJECTED';
      department.approverName = 'Current User';
      department.approvedDate = new Date().toISOString();
      department.comments = comments || '';
      
      if (approved) {
        this.toastr.success(`${department.departmentName} clearance approved!`, 'Department Approval');
      } else {
        this.toastr.error(`${department.departmentName} clearance rejected.`, 'Department Rejection');
      }
      
      this.cdr.detectChanges();
    }
  }

  /**
   * Get pending approvals count
   */
  getPendingApprovalsCount(): number {
    return this.approvalWorkflow.filter(step => step.status === 'PENDING').length;
  }

  /**
   * Get approved steps count
   */
  getApprovedStepsCount(): number {
    return this.approvalWorkflow.filter(step => step.status === 'APPROVED').length;
  }

  /**
   * Get department approval progress
   */
  getDepartmentApprovalProgress(): number {
    const totalDepts = this.departmentApprovals.length;
    const approvedDepts = this.departmentApprovals.filter(d => d.status === 'APPROVED').length;
    return totalDepts > 0 ? Math.round((approvedDepts / totalDepts) * 100) : 0;
  }

  /**
   * Get approved departments count
   */
  getApprovedDepartmentsCount(): number {
    return this.departmentApprovals.filter(d => d.status === 'APPROVED').length;
  }

  /**
   * Track by function for HOD dropdown
   */
  trackByHodId(index: number, item: DropdownOption): any {
    return item.idValue;
  }

  /**
   * Get form type display text
   */
  getFormTypeText(leaveType: string): string {
    switch (leaveType) {
      case 'Emergency':
      case 'E': return 'Emergency Exit';
      case 'Planned':
      case 'P': return 'Planned Leave';
      case 'Resignation':
      case 'R': return 'Resignation';
      default: return leaveType;
    }
  }

  /**
   * Get contextual title based on mode and form type
   */
  getContextualTitle(): string {
    if (this.isApprovalMode && this.approvalRequestData) {
      const formTypeText = this.getFormTypeText(this.approvalRequestData.leaveType);
      return `${formTypeText} Review`;
    } else if (this.approvalRequestData) {
      const formTypeText = this.getFormTypeText(this.approvalRequestData.leaveType);
      return `${formTypeText} Status`;
    } else {
      return this.getFormHeaderTitle();
    }
  }

  /**
   * Get contextual description based on mode
   */
  getContextualDescription(): string {
    if (this.isApprovalMode) {
      return 'Review all details and approve the request';
    } else if (this.approvalRequestData) {
      return 'Track your request progress and status';
    } else {
      return 'Digital approval workflow system';
    }
  }

  /**
   * Populate form from approval request data
   */
  populateFormFromApprovalData(): void {
    if (!this.approvalRequestData) return;

    const request = this.approvalRequestData;
    
    // Format dates properly for form inputs
    const formatDateForInput = (dateString: string): string => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    };

    // Populate comprehensive form data
    this.exitForm.patchValue({
      // Employee Information
      employeeName: request.employeeName || '',
      employeeId: request.employeeId || '',
      department: request.department || '',
      
      // Travel Information
      dateOfDeparture: formatDateForInput(request.departureDate),
      dateOfArrival: formatDateForInput(request.returnDate),
      flightTime: request.flightTime || '',
      noOfDaysApproved: request.daysRequested || 0,
      
      // Reason and Category
      reasonForEmergency: request.reason || '',
      category: request.category || '',
      
      // HOD and Project Manager
      hodName: request.hodName || '',
      projectManagerName: request.projectManagerName || '',
      
      // Planned Leave/Resignation specific
      responsibilitiesHandedOverTo: request.responsibilitiesHandedOverTo || '',
      
      // Contact Information (if available)
      address: request.address || '',
      district: request.district || '',
      place: request.place || '',
      state: request.state || '',
      postOffice: request.postOffice || '',
      nation: request.nation || '',
      telephoneMobile: request.telephoneMobile || '',
      telephoneLandline: request.telephoneLandline || '',
      emailId: request.emailId || '',
      
      // Declarations (set to true if this is a submitted request)
      decInfoAccurate: true,
      decHandoverComplete: true,
      decReturnAssets: true,
      decUnderstandReturn: true
    });

    // Populate responsibilities for Emergency forms
    if (this.formType === 'E' && request.responsibilities && request.responsibilities.length > 0) {
      // Clear existing responsibilities
      this.responsibilitiesFormArray.clear();
      
      // Add responsibilities from request data
      request.responsibilities.forEach((resp: any) => {
        const responsibilityGroup = this.fb.group({
          project: [resp.project || '', Validators.required],
          activities: [resp.activities || '', Validators.required],
          responsiblePersonName: [resp.responsiblePersonName || '', Validators.required],
          responsiblePersonId: [resp.responsiblePersonId || ''],
          responsiblePersonPhone: [resp.responsiblePersonPhone || '', [Validators.required, Validators.pattern(/^[+]?[0-9\s\-()]{7,15}$/)]],
          responsiblePersonEmail: [resp.responsiblePersonEmail || '', [Validators.required, Validators.email]],
          remarks: [resp.remarks || '']
        });
        this.responsibilitiesFormArray.push(responsibilityGroup);
      });
    }

    // Set up approval workflow from request data
    if (request.approvalWorkflow) {
      this.approvalWorkflow = request.approvalWorkflow;
      this.currentApprovalStep = this.approvalWorkflowService.getCurrentApprovalStep(this.approvalWorkflow);
      this.updateWorkflowProgress();
    } else {
      // Generate workflow if not present
      this.generateApprovalWorkflow(request);
    }

    if (request.departmentApprovals) {
      this.departmentApprovals = request.departmentApprovals;
    } else {
      // Generate department approvals if not present
      this.departmentApprovals = this.approvalWorkflowService.generateDepartmentApprovals();
    }

    // Disable all form fields in approval/view mode
    if (this.isApprovalMode || this.approvalRequestData) {
      console.log('Disabling all form fields because isApprovalMode:', this.isApprovalMode, 'or approvalRequestData exists:', !!this.approvalRequestData);
      this.disableAllFormFields();
    } else {
      console.log('NOT disabling all form fields - regular form mode');
    }
    
    // Load employee photo for approval/view mode
    this.loadEmployeeProfile();
    
    console.log('Form populated from approval data:', request);
    console.log('Form values after population:', this.exitForm.value);
  }

  /**
   * Disable all form fields in approval mode
   */
  disableAllFormFields(): void {
    Object.keys(this.exitForm.controls).forEach(key => {
      this.exitForm.get(key)?.disable();
    });
  }

  /**
   * Enable all form fields except employee info fields (for regular form usage)
   */
  enableFormFields(): void {
    console.log('Enabling all form fields except employee info fields');
    Object.keys(this.exitForm.controls).forEach(key => {
      // Don't enable employee info fields - they should always be disabled
      if (key !== 'employeeName' && key !== 'employeeId' && key !== 'department') {
        this.exitForm.get(key)?.enable();
      }
    });
  }

  // Approval workflow helper methods
  canUserTakeAction(): boolean {
    // Only show actions if user is in approval mode (coming from approval listing)
    console.log('canUserTakeAction check:', {
      isApprovalMode: this.isApprovalMode,
      approvalRequestData: !!this.approvalRequestData,
      result: this.isApprovalMode
    });
    return this.isApprovalMode;
  }

  shouldShowWorkflowSidebar(): boolean {
    // Always show workflow sidebar except when form is submitted
    console.log('shouldShowWorkflowSidebar check:', {
      formSubmitted: this.formSubmitted,
      result: !this.formSubmitted
    });
    return !this.formSubmitted;
  }

  shouldShowProjectManagerStep(): boolean {
    // Only show PM step for planned leave and resignation when PM is selected
    return (this.formType === 'P' || this.formType === 'R') && 
           !!this.exitForm.get('projectManagerName')?.value;
  }

  // Get step status based on approval mode and form state
  getStepStatus(step: string): string {
    // If in approval mode, get actual status from data
    if (this.isApprovalMode && this.approvalRequestData) {
      // This would come from actual approval data
      // For now, return mock status
      return 'pending';
    }
    
    // For new form entry, all steps are pending
    return 'pending';
  }

  getStepStatusText(step: string): string {
    const status = this.getStepStatus(step);
    return status === 'completed' ? 'Completed' : 
           status === 'in-progress' ? 'In Progress' : 'Pending';
  }

  getStepDescription(step: string): string {
    const status = this.getStepStatus(step);
    
    switch(step) {
      case 'handover':
        return status === 'completed' ? 'Approved by User' : 'Awaiting submission';
      case 'hod':
        const hodName = this.exitForm.get('hodName')?.value || 'HOD';
        return status === 'completed' ? `Approved by ${hodName}` : 
               status === 'in-progress' ? `Awaiting approval from ${hodName}` : 
               `Next approver: ${hodName}`;
      case 'pm':
        const pmName = this.exitForm.get('projectManagerName')?.value || 'Project Manager';
        return status === 'completed' ? `Approved by ${pmName}` : 
               status === 'in-progress' ? `Awaiting approval from ${pmName}` : 
               `Next approver: ${pmName}`;
      case 'it':
        return status === 'completed' ? 'Approved by IT' : 'Awaiting IT approval';
      case 'audit':
        return status === 'completed' ? 'Approved by Audit' : 'Awaiting Audit approval';
      case 'finance':
        return status === 'completed' ? 'Approved by Finance' : 'Awaiting Finance approval';
      case 'facility':
        return status === 'completed' ? 'Approved by Facility Management' : 'Awaiting Facility Management approval';
      case 'transport':
        return status === 'completed' ? 'Approved by Transport' : 'Awaiting Transport approval';
      case 'hr':
        return status === 'completed' ? 'Approved by HR' : 'Awaiting HR approval';
      case 'admin':
        return status === 'completed' ? 'Approved by Admin' : 'Awaiting Admin approval';
      default:
        return 'Pending';
    }
  }

  getEmployeeName(): string {
    return this.exitForm.get('employeeName')?.value || 'Employee';
  }

  getSubmissionTime(): string {
    // This would come from actual data
    return '2 hours ago';
  }

  // HOD Step Methods
  getHODStepStatus(): string {
    // This would be determined by actual approval data
    return 'in-progress'; // completed, in-progress, pending
  }

  getHODStatusText(): string {
    const status = this.getHODStepStatus();
    return status === 'completed' ? 'Approved' : 
           status === 'in-progress' ? 'Pending' : 'Pending';
  }

  getHODApproverInfo(): string {
    const hodName = this.exitForm.get('hodName')?.value;
    const status = this.getHODStepStatus();
    
    if (status === 'completed') {
      return `Approved by ${hodName || 'HOD'}`;
    } else if (status === 'in-progress') {
      return `Awaiting approval from ${hodName || 'HOD'}`;
    } else {
      return `Next approver: ${hodName || 'HOD'}`;
    }
  }

  getHODStepTime(): string {
    const status = this.getHODStepStatus();
    return status === 'completed' ? '1 hour ago' : 
           status === 'in-progress' ? 'Current step' : '';
  }

  // Project Manager Step Methods
  getPMStepStatus(): string {
    const hodStatus = this.getHODStepStatus();
    if (hodStatus !== 'completed') return 'pending';
    // This would be determined by actual approval data
    return 'pending'; // completed, in-progress, pending
  }

  getPMStatusText(): string {
    const status = this.getPMStepStatus();
    return status === 'completed' ? 'Approved' : 
           status === 'in-progress' ? 'Pending' : 'Pending';
  }

  getPMApproverInfo(): string {
    const pmName = this.exitForm.get('projectManagerName')?.value;
    const status = this.getPMStepStatus();
    
    if (status === 'completed') {
      return `Approved by ${pmName || 'Project Manager'}`;
    } else if (status === 'in-progress') {
      return `Awaiting approval from ${pmName || 'Project Manager'}`;
    } else {
      return `Next approver: ${pmName || 'Project Manager'}`;
    }
  }

  getPMStepTime(): string {
    const status = this.getPMStepStatus();
    return status === 'completed' ? '30 minutes ago' : 
           status === 'in-progress' ? 'Current step' : '';
  }

  // Department Methods
  getActiveDepartments(): any[] {
    // Return only departments that are relevant for this form type
    return this.departments.filter(dept => dept.id > 0); // Exclude HOD (id: 0)
  }

  trackByDeptId(index: number, dept: any): number {
    return dept.id;
  }

  getDepartmentStepStatus(deptId: number): string {
    // This would be determined by actual approval data
    const dept = this.departments.find(d => d.id === deptId);
    return dept?.status === 'approved' ? 'completed' : 'pending';
  }

  getDepartmentStatusText(deptId: number): string {
    const status = this.getDepartmentStepStatus(deptId);
    return status === 'completed' ? 'Approved' : 'Pending';
  }

  getDepartmentApproverInfo(deptId: number): string {
    const dept = this.departments.find(d => d.id === deptId);
    const status = this.getDepartmentStepStatus(deptId);
    
    if (status === 'completed') {
      return `Approved by ${dept?.name} Department`;
    } else {
      return `Awaiting ${dept?.name} approval`;
    }
  }

  getDepartmentStepTime(deptId: number): string {
    const status = this.getDepartmentStepStatus(deptId);
    return status === 'completed' ? 'Completed' : '';
  }

  getDepartmentIcon(deptName: string): string {
    const iconMap: { [key: string]: string } = {
      'CWH': 'fas fa-building',
      'IT': 'fas fa-laptop',
      'Finance': 'fas fa-dollar-sign',
      'Facility Management/Transport': 'fas fa-car',
      'HR': 'fas fa-users',
      'Admin': 'fas fa-cog'
    };
    return iconMap[deptName] || 'fas fa-building';
  }

  isLastDepartment(deptId: number): boolean {
    const activeDepts = this.getActiveDepartments();
    return activeDepts[activeDepts.length - 1]?.id === deptId;
  }

  // Final Step Methods
  getFinalStepStatus(): string {
    // Check if all previous steps are completed
    const allDepartmentsApproved = this.getActiveDepartments()
      .every(dept => this.getDepartmentStepStatus(dept.id) === 'completed');
    
    if (allDepartmentsApproved && this.getHODStepStatus() === 'completed') {
      return 'completed';
    }
    return 'pending';
  }

  getFinalStatusText(): string {
    const status = this.getFinalStepStatus();
    return status === 'completed' ? 'Completed' : 'Pending';
  }

  getFinalApprovalInfo(): string {
    const status = this.getFinalStepStatus();
    return status === 'completed' ? 'All approvals completed' : 'All approvals required';
  }

  getFinalStepTime(): string {
    const status = this.getFinalStepStatus();
    return status === 'completed' ? 'Completed' : '';
  }

  /**
   * Return to approval listing
   */
  returnToApprovalListing(): void {
    // Clear session storage
    sessionStorage.removeItem('approvalRequestData');
    sessionStorage.removeItem('approvalMode');
    sessionStorage.removeItem('returnUrl');
    
    // Navigate back
    this.router.navigate([this.returnUrl]);
  }

  /**
   * Approve current step in approval mode
   */
  approveCurrentStep(comments?: string): void {
    if (!this.isApprovalMode || !this.currentApprovalStep) return;

    this.approvalWorkflow = this.approvalWorkflowService.approveStep(
      this.approvalWorkflow,
      this.currentApprovalStep.stepId,
      'current-user-id',
      'Current User',
      comments
    );

    // Update current step and progress
    this.currentApprovalStep = this.approvalWorkflowService.getCurrentApprovalStep(this.approvalWorkflow);
    this.updateWorkflowProgress();

    // Update session storage with new workflow state
    if (this.approvalRequestData) {
      this.approvalRequestData.approvalWorkflow = this.approvalWorkflow;
      sessionStorage.setItem('approvalRequestData', JSON.stringify(this.approvalRequestData));
    }

    this.toastr.success('Request approved successfully!', 'Approval Success');
    this.cdr.detectChanges();
  }

  /**
   * Reject current step in approval mode
   */
  rejectCurrentStep(comments: string): void {
    if (!this.isApprovalMode || !this.currentApprovalStep) return;

    this.approvalWorkflow = this.approvalWorkflowService.rejectStep(
      this.approvalWorkflow,
      this.currentApprovalStep.stepId,
      'current-user-id',
      'Current User',
      comments
    );

    // Update current step and progress
    this.currentApprovalStep = this.approvalWorkflowService.getCurrentApprovalStep(this.approvalWorkflow);
    this.updateWorkflowProgress();

    // Update session storage with new workflow state
    if (this.approvalRequestData) {
      this.approvalRequestData.approvalWorkflow = this.approvalWorkflow;
      sessionStorage.setItem('approvalRequestData', JSON.stringify(this.approvalRequestData));
    }

    this.toastr.error('Request rejected.', 'Approval Rejected');
    this.cdr.detectChanges();
  }

  /**
   * Check if all department approvals are complete
   */
  areAllDepartmentApprovalsComplete(): boolean {
    return this.departmentApprovals.every(d => d.status === 'APPROVED');
  }

  /**
   * Get workflow step by ID
   */
  getWorkflowStep(stepId: number): ApprovalStep | undefined {
    return this.approvalWorkflow.find(step => step.stepId === stepId);
  }

  /**
   * Format approval date for display
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

  // Dropdown visibility management
  private dropdownVisibility: { [key: number]: boolean } = {};
  private searchTerms: { [key: number]: string } = {};
  
  // Planned leave dropdown management
  private plannedDropdownVisible: boolean = false;
  plannedSearchTerm: string = '';

  // Project Manager dropdown management
  private pmDropdownVisible: boolean = false;
  pmSearchTerm: string = '';

  // Collapsible sections management
  isResponsibilitiesSectionOpen: boolean = true;

  // Approval actions
  approvalRemarks: string = '';

  showDropdown(index: number): void {
    this.dropdownVisibility[index] = true;
  }

  hideDropdown(index: number): void {
    // Add a small delay to allow for item selection
    setTimeout(() => {
      this.dropdownVisibility[index] = false;
    }, 200);
  }

  isDropdownVisible(index: number): boolean {
    return !!this.dropdownVisibility[index];
  }

  onSearchInputChange(event: any, index: number): void {
    const searchTerm = event.target.value;
    this.searchTerms[index] = searchTerm;
    this.dropdownVisibility[index] = true;
  }

  getSearchTerm(index: number): string {
    return this.searchTerms[index] || '';
  }

  selectEmployee(index: number, employee: DropdownOption): void {
    const responsibilityGroup = this.responsibilitiesFormArray.at(index) as FormGroup;
    
    // Update the form control with the employee's ID and description
    const employeeId = employee.idValue || '';
    const description = employee.description || '';
    responsibilityGroup.patchValue({
      responsiblePersonName: description,
      responsiblePersonId: employeeId // Store the ID separately
    });
    
    // Update search term and hide dropdown
    this.searchTerms[index] = description;
    this.dropdownVisibility[index] = false;
    
    console.log('Employee selected:', employee);
    console.log('Updated responsibility at index', index, 'with:', description);
  }

  isEmployeeSelected(index: number, employee: DropdownOption): boolean {
    const responsibilityGroup = this.responsibilitiesFormArray.at(index) as FormGroup;
    const currentValue = responsibilityGroup.get('responsiblePersonName')?.value;
    return currentValue === (employee.description || '');
  }

  getEmployeeNameFromDescription(description: string): string {
    // Extract name from description (format: "NAME | ID")
    const parts = description.split(' | ');
    return parts[0] || description;
  }

  // Always use consistent small dropdown height
  shouldUseSmallDropdown(searchTerm: string): boolean {
    return false; // Always use fixed height for consistency
  }

  // Planned leave dropdown methods
  showPlannedDropdown(): void {
    this.plannedDropdownVisible = true;
  }

  hidePlannedDropdown(): void {
    // Add a small delay to allow for item selection
    setTimeout(() => {
      this.plannedDropdownVisible = false;
    }, 200);
  }

  isPlannedDropdownVisible(): boolean {
    return this.plannedDropdownVisible;
  }

  onPlannedSearchInputChange(event: any): void {
    this.plannedSearchTerm = event.target.value;
    this.plannedDropdownVisible = true;
  }

  selectPlannedEmployee(employee: DropdownOption): void {
    // Update the form control with the employee's ID and description
    const employeeId = employee.idValue || '';
    const description = employee.description || '';
    this.exitForm.patchValue({
      responsibilitiesHandedOverTo: description,
      responsibilitiesHandedOverToId: employeeId // Store the ID separately
    });
    
    // Update search term and hide dropdown
    this.plannedSearchTerm = description;
    this.plannedDropdownVisible = false;
    
    console.log('Planned leave employee selected:', employee);
    console.log('Updated responsibilitiesHandedOverTo with:', description);
  }

  isPlannedEmployeeSelected(employee: DropdownOption): boolean {
    const currentValue = this.exitForm.get('responsibilitiesHandedOverTo')?.value;
    return currentValue === (employee.description || '');
  }

  // Project Manager dropdown methods
  showPMDropdown(): void {
    this.pmDropdownVisible = true;
  }

  hidePMDropdown(): void {
    // Add a small delay to allow for item selection
    setTimeout(() => {
      this.pmDropdownVisible = false;
    }, 200);
  }

  isPMDropdownVisible(): boolean {
    return this.pmDropdownVisible;
  }

  onPMSearchInputChange(event: any): void {
    this.pmSearchTerm = event.target.value;
    this.pmDropdownVisible = true;
  }

  getFilteredProjectManagers(searchTerm: string): DropdownOption[] {
    if (!searchTerm || searchTerm.length < 2) {
      return this.projectManagerList;
    }
    
    const term = searchTerm.toLowerCase();
    return this.projectManagerList.filter(pm => 
      (pm.description || '').toLowerCase().includes(term) ||
      (pm.idValue || '').toLowerCase().includes(term)
    );
  }

  selectProjectManager(pm: DropdownOption): void {
    // Update the form control with the PM's ID and description
    const pmId = pm.idValue || '';
    const description = pm.description || '';
    this.exitForm.patchValue({
      projectManagerName: description
    });
    
    // Update search term and hide dropdown
    this.pmSearchTerm = description;
    this.pmDropdownVisible = false;
    
    console.log('Project Manager selected:', pm);
    console.log('Updated projectManagerName with:', description);
  }

  isPMSelected(pm: DropdownOption): boolean {
    const currentValue = this.exitForm.get('projectManagerName')?.value;
    return currentValue === (pm.description || '');
  }

  /**
   * Toggle responsibilities section visibility
   */
  toggleResponsibilitiesSection(): void {
    this.isResponsibilitiesSectionOpen = !this.isResponsibilitiesSectionOpen;
  }

  /**
   * Approve the current request
   */
  approveRequest(): void {
    if (!this.approvalRemarks.trim()) {
      this.toastr.error('Please provide remarks for approval', 'Validation Error');
      return;
    }

    Swal.fire({
      title: 'Approve Request',
      text: `Are you sure you want to approve this ${this.getFormTypeText(this.formType)} request?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#22c55e',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Approve',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.performApproval(true);
      }
    });
  }

  /**
   * Reject the current request
   */
  rejectRequest(): void {
    if (!this.approvalRemarks.trim()) {
      this.toastr.error('Please provide remarks for rejection', 'Validation Error');
      return;
    }

    Swal.fire({
      title: 'Reject Request',
      text: `Are you sure you want to reject this ${this.getFormTypeText(this.formType)} request?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Reject',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.performApproval(false);
      }
    });
  }

  /**
   * Perform the approval/rejection action
   */
  private performApproval(approved: boolean): void {
    // Here you would typically call an API to update the approval status
    // For now, we'll simulate the action
    
    const action = approved ? 'approved' : 'rejected';
    const message = approved ? 'Request approved successfully!' : 'Request rejected successfully!';
    const icon = approved ? 'success' : 'error';

    // Simulate API call
    setTimeout(() => {
      this.toastr.success(message, 'Action Completed');
      
      // Navigate back to approval listing
      this.returnToApprovalListing();
    }, 1000);
  }

  /**
   * Get approval steps for the flow display
   */
  getApprovalSteps(): any[] {
    return [
      {
        title: 'Handover',
        status: 'completed',
        statusText: 'Completed'
      },
      {
        title: 'HOD Approval',
        status: 'in-progress',
        statusText: 'In Progress (You)'
      },
      {
        title: 'Audit Check',
        status: 'pending',
        statusText: 'Pending'
      },
      {
        title: 'Finance',
        status: 'pending',
        statusText: 'Pending'
      },
      {
        title: 'IT Clearance',
        status: 'pending',
        statusText: 'Pending'
      },
      {
        title: 'Facility',
        status: 'pending',
        statusText: 'Pending'
      },
      {
        title: 'HR Review',
        status: 'pending',
        statusText: 'Pending'
      }
    ];
  }

  /**
   * Get current stage number
   */
  getCurrentStageNumber(): number {
    return 2; // HOD Approval stage
  }

  /**
   * Get total number of stages
   */
  getTotalStages(): number {
    return 7;
  }

}


