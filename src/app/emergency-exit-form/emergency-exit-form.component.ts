import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { ActivatedRoute } from '@angular/router';
import { Api } from '../services/api';
import { DropdownOption, ExitEmpProfileDetails } from '../models/common.model';
import { SessionService } from '../services/session.service';

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
    private sessionService: SessionService
  ) {
    this.initializeForm();
  }

  ngOnInit() {
    try {
      // Set form type based on URL parameter or input
      this.setFormType();

      // Adjust total steps based on form type
      this.totalSteps = this.formType === 'P' ? 2 : 4; // Planned leave: Step 1 (all info) -> Step 2 (approvals)

      this.addResponsibility(); // Add one default responsibility row
      // Ensure all departments are visible by default
      this.departments.forEach(dept => {
        if (!dept.status) {
          dept.status = 'pending';
        }
      });
      // Get current user from session and populate form
      this.currentUser = this.sessionService.getCurrentUser();
      this.populateFormFromSession();

      // Load master lists
      this.loadHodMasterList();
      this.loadProjectManagerList();

      // Load employee details for both Emergency and Planned Leave forms
      this.loadEmployeeDetails();

      // Update form validations based on form type
      this.updateFormValidations();

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

      // Clear form and reset to step 1 when form type changes
      this.clearFormAndReset();

      // Update form validations and steps when form type changes
      this.totalSteps = this.formType === 'P' ? 2 : 4;
      this.updateFormValidations();

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

      // Contact Details
      address: ['', Validators.required],
      district: [''],
      telephoneMobile: ['', Validators.required],
      place: [''],
      state: [''],
      telephoneLandline: [''],
      postOffice: [''],
      nation: [''],
      emailId: ['', [Validators.required, Validators.email]],

      // Reason (Emergency or Planned Leave specific)
      reasonForEmergency: ['', Validators.required],

      // Planned Leave specific fields
      category: [''], // Staff or Worker
      responsibilitiesHandedOverTo: [''], // Text input for planned leave

      // HOD Information
      hodName: ['', Validators.required],
      hodSignature: [''],

      // Project Manager / Site Incharge (for Planned Leave)
      projectManagerName: [''],

      // Responsibilities (FormArray)
      responsibilities: this.fb.array([]),

      // Department approvals will be handled separately
      departmentApprovals: this.fb.group({}),

      // Final signatures
      employeeSignature: [''],
      hrSignature: [''],
      employeeSignatureDate: [''],
      hrSignatureDate: [''],
      digitalSignature: [''],

      // Travel documents
      travelDocumentsHandedOver: [false],

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
      const formData = {
        employeeName: this.currentUser.employeeName || this.currentUser.name || '',
        employeeId: this.currentUser.empId || this.currentUser.employeeId || '',
        department: this.currentUser.department || '',
        emailId: this.currentUser.email || ''
      };
      
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
      responsiblePersonPhone: ['', Validators.required],
      responsiblePersonEmail: ['', [Validators.required, Validators.email]],
      digitalSignature: [''],
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

    if (isValid) {
      // For Planned Leave, go directly from Step 1 to Step 3 (approvals)
      if (this.formType === 'P' && this.currentStep === 1) {
        this.currentStep = 3; // Skip to step 3 (approvals) - displays as Step 2
        console.log('Planned Leave: Moving from Step 1 to Step 3');
      } else if (this.formType === 'E' && this.currentStep < 4) {
        this.currentStep++;
        console.log('Emergency: Moving to step', this.currentStep);
      } else if (this.formType === 'P' && this.currentStep === 3) {
        this.currentStep = 4; // Go to final step for planned leave
        console.log('Planned Leave: Moving from Step 3 to Step 4');
      }

      // Ensure all department cards are visible when reaching step 3
      if (this.currentStep === 3) {
        this.cdr.detectChanges(); // Force change detection
        setTimeout(() => {
          this.ensureAllCardsVisible();
        }, 100);
      }
    } else {
      console.log('Validation failed, not moving to next step');
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      // For Planned Leave, go back from Step 3 (approvals) to Step 1
      if (this.formType === 'P' && this.currentStep === 3) {
        this.currentStep = 1; // Go back to step 1
      } else if (this.formType === 'P' && this.currentStep === 4) {
        this.currentStep = 3; // Go back to approvals step
      } else {
        this.currentStep--;
      }
    }
  }

  goToStep(step: number) {
    if (step >= 1 && step <= this.totalSteps) {
      this.currentStep = step;
      // Ensure all department cards are visible when going to step 3
      if (step === 3) {
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
        return true; // Department approvals are handled by HODs
      case 4:
        return true; // Final review
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

    // Add contact details validation only for Emergency form
    if (this.formType === 'E') {
      requiredFields.push('address', 'telephoneMobile', 'emailId');
    }

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
    if (responsibilities.length === 0) {
      return false;
    }

    for (let i = 0; i < responsibilities.length; i++) {
      const group = responsibilities.at(i) as FormGroup;
      if (group.invalid) {
        Object.keys(group.controls).forEach(key => {
          group.get(key)?.markAsTouched();
        });
        return false;
      }
    }
    return true;
  }

  getStepTitle(): string {
    if (this.formType === 'P') {
      switch (this.currentStep) {
        case 1: return 'Employee Information';
        case 3: return 'Department Approvals';
        case 4: return 'Final Review & Submit';
        default: return 'Employee Exit Form - Planned Leave';
      }
    } else {
      switch (this.currentStep) {
        case 1: return 'Employee Information';
        case 2: return 'Responsibility Handover';
        case 3: return 'Department Approvals';
        case 4: return 'Final Review & Submit';
        default: return 'Emergency Exit Form';
      }
    }
  }

  getStepDescription(): string {
    if (this.formType === 'P') {
      switch (this.currentStep) {
        case 1: return 'Please fill in your personal information, travel details, and leave information';
        case 3: return 'Department HODs and Project Manager will review and approve';
        case 4: return 'Review all information and submit the form';
        default: return '';
      }
    } else {
      switch (this.currentStep) {
        case 1: return 'Please fill in your personal and travel information';
        case 2: return 'List all responsibilities to be handed over';
        case 3: return 'Department HODs will review and approve';
        case 4: return 'Review all information and submit the form';
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
    if (this.exitForm.valid && this.getAllApprovalStatus() === 'approved') {
      this.isSubmitting = true;

      // Simulate API call
      setTimeout(() => {
        this.isSubmitting = false;
        this.formSubmitted = true;
        console.log('Form submitted:', this.exitForm.value);
      }, 2000);
    }
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
      if (field.errors['email']) return 'Please enter a valid email';
      if (field.errors['min']) return 'Value must be greater than 0';
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
    // Since GetProjectManagerList API doesn't exist, use fallback data
    console.warn('GetProjectManagerList API not available, using fallback data');
    this.projectManagerList = [
      { idValue: 'pm1', description: 'John Smith - Project Manager' },
      { idValue: 'pm2', description: 'Sarah Johnson - Site Incharge' },
      { idValue: 'pm3', description: 'Mike Davis - Project Lead' }
    ];
    console.log('Emergency Exit Form - Project Manager list loaded:', this.projectManagerList.length, 'items');
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
      if (step === 3) return 2; // Approvals step shows as Step 2
      if (step === 4) return 3; // Final review shows as Step 3
    }
    return step;
  }

  // Get total display steps
  getTotalDisplaySteps(): number {
    return this.formType === 'P' ? 2 : 4;
  }

  // Disable employee information fields (they should always be read-only)
  disableEmployeeInfoFields(): void {
    console.log('Disabling employee information fields');
    this.exitForm.get('employeeName')?.disable();
    this.exitForm.get('employeeId')?.disable();
    this.exitForm.get('department')?.disable();
    
    // Mark these fields as valid even when disabled
    this.exitForm.get('employeeName')?.setErrors(null);
    this.exitForm.get('employeeId')?.setErrors(null);
    this.exitForm.get('department')?.setErrors(null);
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
      return this.currentStep === 1 || this.currentStep === 3; // Show on Step 1 and Step 3 (approvals)
    } else {
      return this.currentStep < 4; // Show on all steps except final for emergency
    }
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
      
      // Map session data to employee profile format
      this.employeeProfileData = {
        empId: currentUser.empId || currentUser.employeeId || '',
        employeeName: currentUser.employeeName || currentUser.name || '',
        empDept: currentUser.department || currentUser.empDept || '',
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

}


