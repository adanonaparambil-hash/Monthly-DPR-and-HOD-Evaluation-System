import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../services/api';

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

  // Employee profile data
  employeeProfile: any = null;
  isLoadingProfile = false;
  profileImage: string = 'assets/images/default-avatar.png';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private api: Api
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
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const empId = currentUser?.empId || currentUser?.userId || currentUser?.id || '';
    if (empId) {
      this.loadEmployeeProfile(empId);
    }
  }

  loadEmployeeProfile(empId: string): void {
    this.isLoadingProfile = true;
    this.api.GetEmployeeProfile(empId).subscribe({
      next: (res: any) => {
        this.isLoadingProfile = false;
        if (res?.success && res?.data) {
          const d = res.data;
          this.employeeProfile = d;

          // Set profile image
          if (d.profileImageBase64) {
            this.profileImage = d.profileImageBase64.startsWith('data:')
              ? d.profileImageBase64
              : `data:image/jpeg;base64,${d.profileImageBase64}`;
          }

          // Patch form fields
          this.rejoiningForm.patchValue({
            employeeId: d.empId || '',
            employeeName: d.employeeName || '',
            department: d.department || '',
            designation: d.designation || '',
            email: d.email || '',
            contactNumber: (d.phone || '').replace(/\D/g, '').slice(-10)
          });
        }
      },
      error: (err: any) => {
        this.isLoadingProfile = false;
        console.error('Failed to load employee profile', err);
      }
    });
  }

  onSubmit(): void {
    if (this.rejoiningForm.valid) {
      this.isSubmitting = true;
      setTimeout(() => {
        console.log('Rejoining Form Data:', this.rejoiningForm.value);
        this.isSubmitting = false;
        this.submitSuccess = true;
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
      this.rejoiningForm.get(key)?.markAsTouched();
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
      employeeId: 'Employee ID', employeeName: 'Employee Name',
      department: 'Department', designation: 'Designation',
      previousExitDate: 'Previous Exit Date', rejoiningDate: 'Rejoining Date',
      reasonForRejoining: 'Reason for Rejoining', previousSalary: 'Previous Salary',
      expectedSalary: 'Expected Salary', contactNumber: 'Contact Number',
      email: 'Email Address', emergencyContact: 'Emergency Contact',
      medicalClearance: 'Medical Clearance', agreementAccepted: 'Agreement'
    };
    return labels[fieldName] || fieldName;
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  onAvatarError(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/images/default-avatar.png';
  }

  // Converts "08-SEP-2025" or any parseable date string to "yyyy-MM-dd" for <input type="date">
  parseToInputDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }

  getSkillsArray(): string[] {
    return this.employeeProfile?.skillset
      ? this.employeeProfile.skillset.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];
  }
}
