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
  projectManagerList: DropdownOption[] = [];
  employeeMasterList: DropdownOption[] = [];
  currentUser: any = null;

  // Searchable dropdown properties
  isDropdownVisible = false;
  searchTerm = '';

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
    
    // Load master lists
    this.loadHodMasterList();
    this.loadProjectManagerList();
    this.loadEmployeeMasterList();
  }

  initializeForm() {
    this.exitForm = this.fb.group({
      employeeName: ['', Validators.required],
      employeeId: ['', Validators.required],
      department: ['', Validators.required],
      plannedLeaveDate: ['', Validators.required],
      returnDate: ['', Validators.required],
      reason: ['', Validators.required],
      hodName: ['', Validators.required],
      projectManagerName: ['', Validators.required],
      responsibilitiesHandedOverTo: ['', Validators.required],
      responsibilitiesHandedOverToId: [''] // Store the employee ID
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

  // Load Project Manager Master List from API
  loadProjectManagerList(): void {
    console.log('Employee Exit Form - Loading Project Manager list...');
    this.api.GetProjectManagerList().subscribe({
      next: (response: any) => {
        console.log('Employee Exit Form - Project Manager API Response:', response);
        if (response && response.success && response.data && Array.isArray(response.data)) {
          this.projectManagerList = response.data;
          console.log('Employee Exit Form - Project Manager List loaded successfully:', this.projectManagerList.length, 'items');
        } else {
          console.warn('Employee Exit Form - Invalid Project Manager API response:', response);
          this.projectManagerList = [];
        }
      },
      error: (error) => {
        console.error('Employee Exit Form - Error fetching Project Manager list:', error);
        // Provide fallback data for testing
        console.log('Employee Exit Form - Using fallback Project Manager data...');
        this.projectManagerList = [
          { idValue: 'pm1', description: 'John Smith - Project Manager' },
          { idValue: 'pm2', description: 'Sarah Johnson - Site Incharge' },
          { idValue: 'pm3', description: 'Mike Davis - Project Lead' },
          { idValue: 'pm4', description: 'Lisa Brown - Senior Project Manager' }
        ];
        console.log('Employee Exit Form - Fallback Project Manager list loaded:', this.projectManagerList.length, 'items');
      }
    });
  }

  // Load Employee Master List from API
  loadEmployeeMasterList(): void {
    console.log('Employee Exit Form - Loading Employee master list...');
    this.api.GetEmployeeMasterList().subscribe({
      next: (response: any) => {
        console.log('Employee Exit Form - Employee API Response:', response);
        if (response && response.success && response.data && Array.isArray(response.data)) {
          this.employeeMasterList = response.data;
          console.log('Employee Exit Form - Employee List loaded successfully:', this.employeeMasterList.length, 'items');
        } else {
          console.warn('Employee Exit Form - Invalid Employee API response:', response);
          this.employeeMasterList = [];
        }
      },
      error: (error) => {
        console.error('Employee Exit Form - Error fetching Employee list:', error);
        // Provide fallback data for testing
        console.log('Employee Exit Form - Using fallback Employee data...');
        this.employeeMasterList = [
          { idValue: 'emp1', description: 'Alice Johnson - Software Engineer' },
          { idValue: 'emp2', description: 'Bob Smith - Senior Developer' },
          { idValue: 'emp3', description: 'Carol Davis - Team Lead' },
          { idValue: 'emp4', description: 'David Wilson - Project Coordinator' },
          { idValue: 'emp5', description: 'Emma Brown - Business Analyst' }
        ];
        console.log('Employee Exit Form - Fallback Employee list loaded:', this.employeeMasterList.length, 'items');
      }
    });
  }

  // Searchable dropdown methods for Responsibilities Handed Over To
  onSearchInputChange(event: any): void {
    this.searchTerm = event.target.value;
    this.isDropdownVisible = true;
  }

  showDropdown(): void {
    this.isDropdownVisible = true;
  }

  hideDropdown(): void {
    // Delay hiding to allow for item selection
    setTimeout(() => {
      this.isDropdownVisible = false;
    }, 200);
  }

  getFilteredEmployees(searchTerm: string): DropdownOption[] {
    if (!searchTerm) {
      return this.employeeMasterList;
    }
    
    const term = searchTerm.toLowerCase();
    return this.employeeMasterList.filter(employee => 
      employee.description?.toLowerCase().includes(term) ||
      employee.idValue?.toLowerCase().includes(term)
    );
  }

  selectEmployee(employee: DropdownOption): void {
    this.exitForm.patchValue({
      responsibilitiesHandedOverTo: employee.description,
      responsibilitiesHandedOverToId: employee.idValue
    });
    this.isDropdownVisible = false;
    this.searchTerm = employee.description || '';
  }

  isEmployeeSelected(employee: DropdownOption): boolean {
    return this.exitForm.get('responsibilitiesHandedOverToId')?.value === employee.idValue;
  }

  getEmployeeName(description: string): string {
    // Extract name from "Name - Title" format
    const parts = description.split(' - ');
    return parts[0] || description;
  }

  shouldUseSmallDropdown(searchTerm: string): boolean {
    return this.getFilteredEmployees(searchTerm).length <= 5;
  }
}
