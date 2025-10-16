import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-employee-exit-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './employee-exit-form.component.html',
  styleUrls: ['./employee-exit-form.component.css']
})
export class EmployeeExitFormComponent implements OnInit {
  exitForm!: FormGroup;

  constructor(private fb: FormBuilder) {
    this.initializeForm();
  }

  ngOnInit() {
    // Component initialization
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
}
