import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Api } from '../services/api';
import { DropdownOption } from '../models/common.model';
import { SessionService } from '../services/session.service';

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
  currentUser: any = null;

  constructor(private fb: FormBuilder, private api: Api, private sessionService: SessionService) {
    this.initializeForm();
  }

  ngOnInit() {
    // Get current user from session
    this.currentUser = this.sessionService.getCurrentUser();
    
    // Debug: Check what's in localStorage
    console.log('All localStorage keys:', Object.keys(localStorage));
    console.log('current_user from localStorage:', localStorage.getItem('current_user'));
    console.log('access_token from localStorage:', localStorage.getItem('access_token'));
    
    // Pre-populate form with session data
    this.populateFormFromSession();
    
    // Test API connectivity first
    console.log('Testing API connectivity...');
    console.log('API base URL:', this.api);
    
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

  // Populate form with session data
  populateFormFromSession(): void {
    console.log('Current user from session:', this.currentUser);
    
    if (this.currentUser) {
      const formData = {
        employeeName: this.currentUser.employeeName || this.currentUser.name || '',
        employeeId: this.currentUser.empId || this.currentUser.employeeId || '',
        department: this.currentUser.department || ''
      };
      
      console.log('Populating form with data:', formData);
      this.exitForm.patchValue(formData);
    } else {
      console.warn('No current user found in session');
    }
  }

  // Load HOD Master List from API
  loadHodMasterList(): void {
    console.log('Loading HOD master list...');
    this.api.GetHodMasterList().subscribe({
      next: (response: any) => {
        console.log('HOD API Response:', response);
        if (response && response.success && response.data && Array.isArray(response.data)) {
          this.hodList = response.data;
          console.log('HOD List loaded successfully:', this.hodList.length, 'items');
          console.log('First HOD item:', this.hodList[0]);
        } else {
          console.warn('Invalid HOD API response structure:', response);
          this.hodList = [];
        }
      },
      error: (error) => {
        console.error('Error fetching HOD master list:', error);
        console.error('Error details:', error.message, error.status);
        
        // Provide fallback data for testing
        console.log('Using fallback HOD data for testing...');
        this.hodList = [
          { idValue: 'hod1', description: 'John Doe - Engineering HOD' },
          { idValue: 'hod2', description: 'Jane Smith - HR HOD' },
          { idValue: 'hod3', description: 'Mike Johnson - Finance HOD' },
          { idValue: 'hod4', description: 'Sarah Wilson - Admin HOD' }
        ];
        console.log('Fallback HOD list loaded:', this.hodList.length, 'items');
      }
    });
  }
}
