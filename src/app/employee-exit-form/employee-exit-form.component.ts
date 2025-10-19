import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Api } from '../services/api';
import { DropdownOption } from '../models/common.model';

@Component({
  selector: 'app-employee-exit-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './employee-exit-form.component.html',
  styleUrls: ['./employee-exit-form.component.css']
})
export class EmployeeExitFormComponent implements OnInit {
  exitForm!: FormGroup;
  hodList: DropdownOption[] = [];

  constructor(private fb: FormBuilder, private api: Api) {
    this.initializeForm();
  }

  ngOnInit() {
    // Load HOD master list
    this.loadHodMasterList();
  }

  initializeForm() {
    this.exitForm = this.fb.group({
      employeeName: ['', Validators.required],
      employeeId: ['', Validators.required],
      department: ['', Validators.required],
      plannedLeaveDate: ['', Validators.required],
      returnDate: ['', Validators.required],
      reason: ['', Validators.required],
      hodName: ['', Validators.required]
    });
  }

  submitForm() {
    if (this.exitForm.valid) {
      console.log('Employee Exit Form submitted:', this.exitForm.value);
    }
  }

  // Load HOD Master List from API
  loadHodMasterList(): void {
    this.api.GetHodMasterList().subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          this.hodList = response.data;
        } else {
          console.warn('No HOD records found or API call failed');
        }
      },
      error: (error) => {
        console.error('Error fetching HOD master list:', error);
      }
    });
  }
}
