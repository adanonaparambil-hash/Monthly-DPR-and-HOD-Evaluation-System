import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';

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
  
  // Form data
  departments: Department[] = [
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

  constructor(private fb: FormBuilder) {
    this.initializeForm();
  }

  ngOnInit() {
    try {
      this.addResponsibility(); // Add one default responsibility row
    } catch (error) {
      console.error('Error initializing emergency exit form:', error);
    }
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
      
      // Reason
      reasonForEmergency: ['', Validators.required],
      
      // HOD Information
      hodName: ['', Validators.required],
      hodSignature: [''],
      
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
    if (this.currentStep < this.totalSteps) {
      if (this.validateCurrentStep()) {
        this.currentStep++;
      }
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  goToStep(step: number) {
    if (step >= 1 && step <= this.totalSteps) {
      this.currentStep = step;
    }
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
    const requiredFields = ['employeeName', 'employeeId', 'department', 'dateOfDeparture', 
                           'noOfDaysApproved', 'address', 'telephoneMobile', 'emailId', 
                           'reasonForEmergency', 'hodName'];
    
    for (const field of requiredFields) {
      const control = this.exitForm.get(field);
      if (!control || !control.value || control.invalid) {
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
          group.get(key)?.markAsTouched();
        });
        return false;
      }
    }
    return true;
  }

  getStepTitle(): string {
    switch (this.currentStep) {
      case 1: return 'Employee Information';
      case 2: return 'Responsibility Handover';
      case 3: return 'Department Approvals';
      case 4: return 'Final Review & Submit';
      default: return 'Emergency Exit Form';
    }
  }

  getStepDescription(): string {
    switch (this.currentStep) {
      case 1: return 'Please fill in your personal and travel information';
      case 2: return 'List all responsibilities to be handed over';
      case 3: return 'Department HODs will review and approve';
      case 4: return 'Review all information and submit the form';
      default: return '';
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
}