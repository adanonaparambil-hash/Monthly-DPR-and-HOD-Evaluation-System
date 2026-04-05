import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-rejoining-form',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './rejoining-form.html',
  styleUrl: './rejoining-form.css'
})
export class RejoiningForm implements OnInit {
  rejoiningForm: FormGroup;
  isSubmitting = false;
  submitSuccess = false;

  constructor(
    private fb: FormBuilder,
    private router: Router
  ) {
    this.rejoiningForm = this.fb.group({
      employeeId: ['', [Validators.required]],
      employeeName: ['', [Validators.required, Validators.minLength(2)]],
      department: ['', [Validators.required]],
      designation: ['', [Validators.required]],
      previousExitDate: ['', [Validators.required]],
      rejoiningDate: ['', [Validators.required]],
      reasonForRejoining: ['', [Validators.required, Validators.minLength(10)]],
      previousSalary: ['', [Validators.required, Validators.min(0)]],
      expectedSalary: ['', [Validators.required, Validators.min(0)]],
      contactNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      email: ['', [Validators.required, Validators.email]],
      emergencyContact: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      medicalClearance: [false, [Validators.requiredTrue]],
      agreementAccepted: [false, [Validators.requiredTrue]]
    });
  }

  ngOnInit(): void {
    // Auto-populate employee data if available
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    if (currentUser) {
      this.rejoiningForm.patchValue({
        employeeId: currentUser.employeeId || '',
        employeeName: currentUser.employeeName || '',
        email: currentUser.email || ''
      });
    }
  }

  onSubmit(): void {
    if (this.rejoiningForm.valid) {
      this.isSubmitting = true;
      
      // Simulate API call
      setTimeout(() => {
        console.log('Rejoining Form Data:', this.rejoiningForm.value);
        this.isSubmitting = false;
        this.submitSuccess = true;
        
        // Reset form after success
        setTimeout(() => {
          this.submitSuccess = false;
          this.rejoiningForm.reset();
        }, 3000);
      }, 2000);
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.rejoiningForm.controls).forEach(key => {
      const control = this.rejoiningForm.get(key);
      control?.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.rejoiningForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.rejoiningForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return `${this.getFieldLabel(fieldName)} is required`;
      if (field.errors['email']) return 'Please enter a valid email address';
      if (field.errors['pattern']) return 'Please enter a valid format';
      if (field.errors['minlength']) return `Minimum ${field.errors['minlength'].requiredLength} characters required`;
      if (field.errors['min']) return 'Value must be greater than 0';
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      employeeId: 'Employee ID',
      employeeName: 'Employee Name',
      department: 'Department',
      designation: 'Designation',
      previousExitDate: 'Previous Exit Date',
      rejoiningDate: 'Rejoining Date',
      reasonForRejoining: 'Reason for Rejoining',
      previousSalary: 'Previous Salary',
      expectedSalary: 'Expected Salary',
      contactNumber: 'Contact Number',
      email: 'Email Address',
      emergencyContact: 'Emergency Contact',
      medicalClearance: 'Medical Clearance',
      agreementAccepted: 'Agreement'
    };
    return labels[fieldName] || fieldName;
  }

  getCurrentDate(): string {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return today.toLocaleDateString('en-US', options);
  }
}
