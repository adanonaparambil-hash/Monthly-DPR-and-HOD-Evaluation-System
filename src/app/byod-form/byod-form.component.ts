import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Api } from '../services/api';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-byod-form',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './byod-form.component.html',
  styleUrl: './byod-form.component.css'
})
export class ByodFormComponent implements OnInit {
  byodForm: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  isLoadingProfile = true;
  isLoadingHods = true;
  hodList: { idValue: string; description: string }[] = [];

  profile: any = null;
  profileImageSrc: string | null = null;

  constructor(
    private fb: FormBuilder,
    private api: Api,
    private auth: AuthService
  ) {
    this.byodForm = this.fb.group({
      idNo:              ['', Validators.required],
      name:              ['', [Validators.required, Validators.minLength(2)]],
      doj:               ['', Validators.required],
      department:        ['', Validators.required],
      designation:       ['', Validators.required],
      hodId:             ['', Validators.required],
      agreementAccepted: [false, Validators.requiredTrue]
    });
  }

  ngOnInit(): void {
    // Load HOD list
    this.api.GetHodMasterList().subscribe({
      next: (res: any) => {
        if (res?.success && res?.data) this.hodList = res.data;
        this.isLoadingHods = false;
      },
      error: () => { this.isLoadingHods = false; }
    });

    // Load employee profile
    const user = this.auth.getUser();
    const empId = user?.empId || user?.userId || user?.id || '';
    if (empId) {
      this.api.GetEmployeeProfile(empId).subscribe({
        next: (res: any) => {
          if (res?.success && res?.data) {
            this.profile = res.data;
            this.profileImageSrc = res.data.profileImageBase64
              ? `data:image/jpeg;base64,${res.data.profileImageBase64}`
              : null;
            // Patch form with API values
            this.byodForm.patchValue({
              idNo:        res.data.empId        || '',
              name:        res.data.employeeName || '',
              doj:         this.parseDoj(res.data.doj),
              department:  res.data.department   || '',
              designation: res.data.designation  || ''
            });
            // Disable the auto-filled fields
            ['idNo','name','doj','department','designation'].forEach(f =>
              this.byodForm.get(f)?.disable()
            );
          }
          this.isLoadingProfile = false;
        },
        error: () => { this.isLoadingProfile = false; }
      });
    } else {
      this.isLoadingProfile = false;
    }
  }

  /** Convert "08-SEP-2025" → "2025-09-08" for date input */
  private parseDoj(doj: string): string {
    if (!doj) return '';
    const months: Record<string, string> = {
      JAN:'01', FEB:'02', MAR:'03', APR:'04', MAY:'05', JUN:'06',
      JUL:'07', AUG:'08', SEP:'09', OCT:'10', NOV:'11', DEC:'12'
    };
    const parts = doj.split('-');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return `${y}-${months[m.toUpperCase()] || '01'}-${d.padStart(2,'0')}`;
    }
    return '';
  }

  get selectedHodName(): string {
    const id = this.byodForm.get('hodId')?.value;
    return this.hodList.find(h => h.idValue === id)?.description || '';
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString('en-GB');
  }

  isInvalid(f: string): boolean {
    const c = this.byodForm.get(f);
    return !!(c && c.invalid && c.touched);
  }

  onSubmit(): void {
    if (this.byodForm.invalid) { this.byodForm.markAllAsTouched(); return; }
    this.isSubmitting = true;
    setTimeout(() => { this.isSubmitting = false; this.submitSuccess = true; }, 1600);
  }

  reset(): void { this.submitSuccess = false; this.byodForm.reset(); }
}
