import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { ActivatedRoute } from '@angular/router';
import { Api } from '../services/api';
import { DropdownOption, ExitEmpProfileDetails } from '../models/common.model';
import { EmployeeExitRequest, EmployeeExitResponsibility } from '../models/employeeExit.model';
import { SessionService } from '../services/session.service';
import { ToastrService } from 'ngx-toastr';
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

  // Form type flag: 'E' for Emergency, 'P' for Planned Leave
  @Input() formType: 'E' | 'P' = 'E';

  // Employee profile data
  employeeProfileData: ExitEmpProfileDetails = {};

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
      name: 'CWH',
      status: 'pending',
      items: [
        { label: 'Staff-CWH', type: 'checkbox' },
        { label: 'Worker-Site/CWH', type: 'checkbox' },
        { label: 'Tool Box Kit', type: 'text' },
        { label: 'Liabilities if any', type: 'text' }
      ]
    },
    {
      id: 2,
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
      name: 'Facility Management/Transport',
      status: 'pending',
      items: [
        { label: 'Accommodation Key', type: 'checkbox' },
        { label: 'Company Car', type: 'checkbox' },
        { label: 'Make/Model', type: 'text' },
        { label: 'Car Km', type: 'number' },
        { label: 'Liabilities if any', type: 'text' }
      ]
    },
    {
      id: 5,
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
      id: 6,
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

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private api: Api,
    private route: ActivatedRoute,
    private sessionService: SessionService,
    private toastr: ToastrService
  ) {
    this.initializeForm();
  }

  ngOnInit() {
    try {
      // Get current user from session first
      this.currentUser = this.sessionService.getCurrentUser();
      
      // Debug: Log all available user properties
      this.debugUserProperties();

      // Add one default responsibility row
      this.addResponsibility();
      
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

      // Load master lists
      this.loadHodMasterList();
      this.loadProjectManagerList();
      this.loadEmployeeMasterList();

      // Disable employee information fields (always disabled)
      this.disableEmployeeInfoFields();

      // Ensure all cards are visible from the start
      setTimeout(() => {
        this.ensureAllCardsVisible();
      }, 100);

      console.log('Departments initialized:', this.departments.length); // Debug log
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
      if (typeParam === 'P' || typeParam === 'E') {
        this.formType = typeParam;
        console.log('Form type set to:', this.formType); // Debug log
      } else {
        // Default to Emergency if no valid type is provided
        this.formType = 'E';
        console.log('Form type defaulted to Emergency'); // Debug log
      }

      // Update form validations and steps when form type changes
      this.totalSteps = this.formType === 'P' ? 2 : 4;
      this.updateFormValidations();

      // Re-populate form with session data after form type change
      this.populateFormFromSession();

      // Load employee details for the new form type
      this.loadEmployeeDetails();
    });
  }

  // Clear form data and validation errors when switching form types
  clearFormAndReset() {
    this.currentStep = 1;
    
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
    this.addResponsibility();
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

      // Project Manager / Site Incharge (for Planned Leave)
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
      
      // Disable employee information fields since they come from session
      this.disableEmployeeInfoFields();
    } else {
      console.warn('Emergency Exit Form - No current user found in session');
    }
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
    console.log('NextStep called - Current step:', this.currentStep, 'Form type:', this.formType);
    const isValid = this.validateCurrentStep();
    console.log('Validation result:', isValid);
    
    if (!isValid) {
      // Show user-friendly message about what's missing
      this.showValidationErrors();
      return;
    }

    if (isValid) {
      // For Planned Leave: Step 1 -> Step 3 (Final Review)
      if (this.formType === 'P' && this.currentStep === 1) {
        this.currentStep = 3; // Go to final review step
        console.log('Planned Leave: Moving from Step 1 to Step 3 (Final Review)');
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
    if (this.currentStep > 1) {
      // For Planned Leave, go back from Step 3 (Final Review) to Step 1
      if (this.formType === 'P' && this.currentStep === 3) {
        this.currentStep = 1; // Go back to step 1
      } 
      // For Planned Leave, go back from Step 4 (Approvals) to Step 3 (Final Review)
      else if (this.formType === 'P' && this.currentStep === 4) {
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

    // Add planned leave specific validations
    if (this.formType === 'P') {
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

  getStepDescription(): string {
    if (this.formType === 'P') {
      switch (this.currentStep) {
        case 1: return 'Review your profile information and provide travel details and leave information';
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
    
    // Debug: Check which fields are invalid
    if (!this.exitForm.valid) {
      console.log('Invalid fields:');
      Object.keys(this.exitForm.controls).forEach(key => {
        const control = this.exitForm.get(key);
        if (control && control.invalid) {
          console.log(`- ${key}:`, control.errors);
        }
      });
      
      // Also check responsibilities array for Emergency forms
      if (this.formType === 'E') {
        const responsibilities = this.exitForm.get('responsibilities') as FormArray;
        if (responsibilities) {
          responsibilities.controls.forEach((respControl, index) => {
            if (respControl.invalid) {
              console.log(`- Responsibility ${index + 1}:`, respControl.errors);
              Object.keys((respControl as FormGroup).controls).forEach(fieldKey => {
                const fieldControl = respControl.get(fieldKey);
                if (fieldControl && fieldControl.invalid) {
                  console.log(`  - ${fieldKey}:`, fieldControl.errors);
                }
              });
            }
          });
        }
      }
      
      this.markAllFieldsAsTouched();
      
      // Check if this is a validation issue with form type specific fields
      if (!this.validateFormForCurrentType()) {
        return;
      }
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
    const formTypeText = this.formType === 'E' ? 'Emergency Exit' : 'Planned Leave';
    
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
      
      // Call API
      this.api.InsertEmployeeExit(exitRequest).subscribe({
        next: (response: any) => {
          console.log('Form submitted successfully:', response);
          this.isSubmitting = false;
          
          if (response && response.success) {
            // Show success message
            this.toastr.success('Form submitted successfully! Your request is now being processed.', 'Submission Successful');
            
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
    
    // Prepare responsibilities array for Emergency forms
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
      formType: this.formType, // 'E' for Emergency, 'P' for Planned
      dateOfDeparture: formatDate(formValue.dateOfDeparture),
      dateArrival: formatDate(formValue.dateOfArrival),
      flightTime: formValue.flightTime || '',
      responsibilitiesHanded: this.formType === 'P' ? (formValue.responsibilitiesHandedOverToId || formValue.responsibilitiesHandedOverTo || '') : '',
      noOfDaysApproved: parseInt(formValue.noOfDaysApproved) || 0,
      depHod: formValue.hodName || '',
      projectSiteIncharge: formValue.projectManagerName || '',
      reasonForLeave: formValue.reasonForEmergency || '',
      approvalStatus: 'P',
      category: formValue.category || '',
      declaration1: formValue.decInfoAccurate ? 'Y' : 'N',
      declaration2: formValue.decHandoverComplete ? 'Y' : 'N',
      declaration3: formValue.decReturnAssets ? 'Y' : 'N',
      declaration4: formValue.decUnderstandReturn ? 'Y' : 'N',
      responsibilities: responsibilities
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
      // Emergency form - only planned leave fields are not required
      this.exitForm.get('category')?.clearValidators();
      this.exitForm.get('projectManagerName')?.clearValidators();
      this.exitForm.get('responsibilitiesHandedOverTo')?.clearValidators();
      
    } else if (this.formType === 'P') {
      // Planned leave specific fields are required
      this.exitForm.get('category')?.setValidators([Validators.required]);
      this.exitForm.get('projectManagerName')?.setValidators([Validators.required]);
      this.exitForm.get('responsibilitiesHandedOverTo')?.setValidators([Validators.required]);
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

    // Planned leave specific fields
    if (this.formType === 'P') {
      if (!formValue.category) missingFields.push('Category (Staff/Worker)');
      if (!formValue.projectManagerName) missingFields.push('Project Manager');
      if (!formValue.responsibilitiesHandedOverTo) missingFields.push('Responsibilities Handed Over To');
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
    this.currentStep = 1;
    this.formSubmitted = false;
    this.departments.forEach(dept => {
      dept.status = 'pending';
      dept.approvedDate = undefined;
      dept.comments = undefined;
    });
    this.responsibilitiesFormArray.clear();
    this.addResponsibility();
    
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
    console.log('Emergency Exit Form - Loading HOD master list...');
    this.api.GetHodMasterList().subscribe({
      next: (response: any) => {
        console.log('Emergency Exit Form - HOD API Response:', response);
        if (response && response.success && response.data && Array.isArray(response.data)) {
          this.hodList = response.data;
          console.log('Emergency Exit Form - HOD List loaded successfully:', this.hodList.length, 'items');
        } else {
          console.warn('Emergency Exit Form - Invalid HOD API response:', response);
          this.hodList = [];
        }
      },
      error: (error) => {
        console.error('Emergency Exit Form - Error fetching HOD master list:', error);
        
        // Provide fallback data for testing
        console.log('Emergency Exit Form - Using fallback HOD data...');
        this.hodList = [
          { idValue: 'hod1', description: 'John Doe - Engineering HOD' },
          { idValue: 'hod2', description: 'Jane Smith - HR HOD' },
          { idValue: 'hod3', description: 'Mike Johnson - Finance HOD' },
          { idValue: 'hod4', description: 'Sarah Wilson - Admin HOD' }
        ];
        console.log('Emergency Exit Form - Fallback HOD list loaded:', this.hodList.length, 'items');
      }
    });
  }

  // Load Project Manager Master List from API
  loadProjectManagerList(): void {
    console.log('Emergency Exit Form - Loading Project Manager list...');
    this.api.GetProjectManagerList().subscribe({
      next: (response: any) => {
        console.log('Emergency Exit Form - Project Manager API Response:', response);
        if (response && response.success && response.data && Array.isArray(response.data)) {
          this.projectManagerList = response.data;
          console.log('Emergency Exit Form - Project Manager List loaded successfully:', this.projectManagerList.length, 'items');
        } else {
          console.warn('Emergency Exit Form - Invalid Project Manager API response:', response);
          this.projectManagerList = [];
        }
      },
      error: (error) => {
        console.error('Emergency Exit Form - Error fetching Project Manager list:', error);
        // Provide fallback data for testing
        console.log('Emergency Exit Form - Using fallback Project Manager data...');
        this.projectManagerList = [
          { idValue: 'pm1', description: 'John Smith - Project Manager' },
          { idValue: 'pm2', description: 'Sarah Johnson - Site Incharge' },
          { idValue: 'pm3', description: 'Mike Davis - Project Lead' }
        ];
        console.log('Emergency Exit Form - Fallback Project Manager list loaded:', this.projectManagerList.length, 'items');
      }
    });
  }

  // Load Employee Master List from API
  loadEmployeeMasterList(): void {
    console.log('Emergency Exit Form - Loading Employee master list...');
    this.api.GetEmployeeMasterList().subscribe({
      next: (response: any) => {
        console.log('Emergency Exit Form - Employee Master API Response:', response);
        if (response && response.success && response.data && Array.isArray(response.data)) {
          this.employeeMasterList = response.data;
          console.log('Emergency Exit Form - Employee Master List loaded successfully:', this.employeeMasterList.length, 'items');
        } else {
          console.warn('Emergency Exit Form - Invalid Employee Master API response:', response);
          this.employeeMasterList = [];
        }
      },
      error: (error) => {
        console.error('Emergency Exit Form - Error fetching Employee master list:', error);
        
        // Provide fallback data for testing
        console.log('Emergency Exit Form - Using fallback Employee Master data...');
        this.employeeMasterList = [
          { idValue: 'ADS3239', description: 'PRABIN BABY | ADS3239' },
          { idValue: 'ADS3121', description: 'SAJITH THANKAMONY HARIHARAN | ADS3121' },
          { idValue: 'ADS3456', description: 'JOHN DOE | ADS3456' },
          { idValue: 'ADS3789', description: 'JANE SMITH | ADS3789' }
        ];
        console.log('Emergency Exit Form - Fallback Employee Master list loaded:', this.employeeMasterList.length, 'items');
      }
    });
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
    return this.formType === 'P' ? 'Employee Exit Form - For Planned Leave' : 'Emergency Exit Form';
  }

  // Check if current step should be displayed based on form type
  shouldShowStep(step: number): boolean {
    if (this.formType === 'P' && step === 2) {
      return false; // Hide step 2 for planned leave
    }
    return true;
  }

  // Get display step number (for planned leave, step 3 shows as step 2, step 4 shows as step 3)
  getDisplayStepNumber(step: number): number {
    if (this.formType === 'P') {
      if (step === 3) return 2; // Final review shows as Step 2
      if (step === 4) return 3; // Approvals step shows as Step 3
    }
    return step;
  }

  // Get total display steps
  getTotalDisplaySteps(): number {
    return this.formType === 'P' ? 3 : 4;
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
    if (this.formType === 'P') {
      return this.currentStep === 4; // Final step for planned leave
    } else {
      return this.currentStep === 4; // Final step for emergency
    }
  }

  // Check if we should show the Next button
  shouldShowNextButton(): boolean {
    if (this.formType === 'P') {
      return this.currentStep === 1; // Show only on Step 1 for planned leave
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

    if (this.formType === 'P') {
      // Add validators for planned leave fields
      categoryControl?.setValidators([Validators.required]);
      responsibilitiesHandedOverToControl?.setValidators([Validators.required]);
      projectManagerNameControl?.setValidators([Validators.required]);

      // Remove contact details requirements for planned leave
      addressControl?.clearValidators();
      telephoneMobileControl?.clearValidators();
      emailIdControl?.clearValidators();
    } else {
      // Remove validators for planned leave fields
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

  // Dropdown visibility management
  private dropdownVisibility: { [key: number]: boolean } = {};
  private searchTerms: { [key: number]: string } = {};
  
  // Planned leave dropdown management
  private plannedDropdownVisible: boolean = false;
  plannedSearchTerm: string = '';

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

  getEmployeeName(description: string): string {
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

}


