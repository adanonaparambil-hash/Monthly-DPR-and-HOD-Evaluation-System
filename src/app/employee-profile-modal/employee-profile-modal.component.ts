import { Component, OnInit, OnChanges, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Api } from '../services/api';

@Component({
  selector: 'app-employee-profile-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './employee-profile-modal.component.html',
  styleUrls: ['./employee-profile-modal.component.css'],
  animations: [
    trigger('modalAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('0.3s ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ]),
      transition(':leave', [
        animate('0.2s ease-in', style({ opacity: 0, transform: 'scale(0.8)' }))
      ])
    ]),
    trigger('backdropAnimation', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.3s ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('0.2s ease-in', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class EmployeeProfileModalComponent implements OnInit, OnChanges {
  @Input() employeeId: string = '';
  @Input() isVisible: boolean = false;
  @Output() closeModal = new EventEmitter<void>();

  userProfile: any = {
    name: '',
    email: '',
    department: '',
    designation: '',
    empId: '',
    location: '',
    phone: '',
    careerSummary: '',
    experienceInd: 0,
    experienceAbroad: 0,
    qualification: '',
    skillset: '',
    joinDate: '',
    dobDate: '',
    address: '',
    telephone: '',
    nation: '',
    postOffice: '',
    state: '',
    district: '',
    place: '',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format'
  };

  isLoading: boolean = false;

  constructor(private api: Api) { }

  ngOnInit(): void {
    if (this.employeeId && this.isVisible) {
      this.loadEmployeeProfile();
    }
  }

  ngOnChanges(): void {
    if (this.employeeId && this.isVisible) {
      this.loadEmployeeProfile();
    }
  }

  loadEmployeeProfile() {
    this.isLoading = true;
    this.api.GetEmployeeProfile(this.employeeId).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response && response.success && response.data) {
          const data = response.data;

          this.userProfile = {
            name: data.employeeName || '',
            email: data.email || '',
            department: data.department || '',
            designation: data.designation || '',
            empId: data.empId || '',
            location: data.location || '',
            phone: data.phone || '',
            careerSummary: data.careerSummary || '',
            experienceInd: data.experienceInd || 0,
            experienceAbroad: data.experienceAbroad || 0,
            qualification: data.qualification || '',
            skillset: data.skillset || '',
            joinDate: data.doj || '',
            dobDate: data.dobDate || '',
            address: data.address || '',
            telephone: data.telephone || '',
            nation: data.nation || '',
            postOffice: data.postOffice || '',
            state: data.state || '',
            district: data.district || '',
            place: data.place || '',
            avatar: data.profileImageBase64
              ? `data:image/jpeg;base64,${data.profileImageBase64}`
              : 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format'
          };
        } else {
          console.warn('No profile data found:', response.message);
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error loading profile:', err);
      }
    });
  }

  getProfileCompletionPercentage(): number {
    const fields = [
      'name', 'email', 'phone', 'department', 'designation', 
      'experienceInd', 'experienceAbroad', 'qualification', 
      'skillset', 'careerSummary', 'address', 'telephone', 
      'nation', 'state', 'district', 'place'
    ];
    
    const filledFields = fields.filter(field => 
      this.userProfile[field] && 
      this.userProfile[field].toString().trim() !== '' &&
      this.userProfile[field] !== 0
    ).length;
    
    return Math.round((filledFields / fields.length) * 100);
  }

  getSkillsArray(): string[] {
    if (!this.userProfile.skillset) return [];
    return this.userProfile.skillset.split(',').map((skill: string) => skill.trim()).filter((skill: string) => skill);
  }

  getFormattedJoinDate(): string {
    if (this.userProfile.joinDate) {
      const date = new Date(this.userProfile.joinDate);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return 'Not provided';
  }

  onCloseModal() {
    this.closeModal.emit();
  }

  onBackdropClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.onCloseModal();
    }
  }
}