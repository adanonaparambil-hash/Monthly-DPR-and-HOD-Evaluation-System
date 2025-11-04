import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Api } from '../services/api';
import { EmployeeProfileUpdateDto,EmployeeDocumentUpload } from '../models/common.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'], // Fixed typo
  animations: [
    trigger('fadeInUp', [
      state('in', style({ transform: 'translateY(0)', opacity: 1 })),
      transition('void => *', [
        style({ transform: 'translateY(20px)', opacity: 0 }),
        animate('0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)')
      ])
    ]),
    trigger('scaleIn', [
      transition(':enter', [
        style({ transform: 'scale(0.9)', opacity: 0 }),
        animate('0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)', style({ transform: 'scale(1)', opacity: 1 }))
      ])
    ])
  ]
})
export class ProfileComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  animationState = 'in';
  isEditing = false;

  user: any = JSON.parse(localStorage.getItem('current_user') || '{}');
  userProfile: any = {};
  originalProfile: any = {};

  constructor(private api: Api) {}

  ngOnInit(): void {
    const empId = this.user?.empId;
    if (empId) {
      this.loadEmployeeProfile(empId);
    }
  }

  loadEmployeeProfile(empId: string) {
    this.api.GetEmployeeProfile(empId).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          const data = response.data;

          this.userProfile = {
            name: data.employeeName || this.user.employeeName || '',
            email: data.email || this.user.email || '',
            department: data.department || this.user.department || '',
            designation: data.designation || this.user.designation || '',
            empId: data.empId || this.user.empId || '',
            location: data.location || this.user.location || '',
            phone: data.phone || this.user.phone || '',
            careerSummary: data.careerSummary || this.user.careerSummary || '',
            experienceInd: data.experienceInd || this.user.experienceInd || 0,
            experienceAbroad: data.experienceAbroad || this.user.experienceAbroad || 0,
            qualification: data.qualification || this.user.qualification || '',
            skillset: data.skillset || this.user.skillset || '',
            joinDate: data.doj || this.user.doj || '',
            dobDate: data.dobDate || this.user.dobDate || '',
            address: data.address || this.user.address || '',
            telephone: data.telephone || this.user.telephone || '',
            nation: data.nation || this.user.nation || '',
            postOffice: data.postOffice || this.user.postOffice || '',
            state: data.state || this.user.state || '',
            district: data.district || this.user.district || '',
            place: data.place || this.user.place || '',
            avatar: data.profileImageBase64
              ? `data:image/jpeg;base64,${data.profileImageBase64}`
              : this.user.photo || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format'
          };

          // Store original profile for reset
          this.originalProfile = { ...this.userProfile };
        } else {
          console.warn('No profile data found:', response.message);
        }
      },
      error: (err) => {
        console.error('Error loading profile:', err);
      }
    });
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) {
      this.userProfile = { ...this.originalProfile };
    }
  }

  triggerFileUpload() {
    this.fileInput.nativeElement.click();
  }

 
  onFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('empId', this.user.empId.toString());
  formData.append('docName', file.name);
  formData.append('docType', file.type);
  formData.append('docCategory', "PROFILE_PICTURE");
  formData.append('uploadedBy', this.userProfile.name);
  formData.append('fileData', file, file.name); // ✅ send actual File

  this.api.uploadDocument(formData).subscribe({
    next: (res: any) => {
      console.log(res.message || 'Upload successful!');
      this.userProfile.avatar = URL.createObjectURL(file); // show preview
    },
    error: (err) => {
      console.error(err);
      alert('Upload failed!');
    }
  });
}



  saveProfile() {
    const profile: EmployeeProfileUpdateDto = {
      empId: this.userProfile.empId,
      employeeName: this.userProfile.name,
      department: this.userProfile.department,
      designation: this.userProfile.designation,
      phone: this.userProfile.phone,
      email: this.userProfile.email,
      careerSummary: this.userProfile.careerSummary,
      experienceInd: this.userProfile.experienceInd,
      experienceAbroad: this.userProfile.experienceAbroad,
      qualification: this.userProfile.qualification,
      location: this.userProfile.location,
      skillset: this.userProfile.skillset,
      dobDate: this.userProfile.dobDate,
      address : this.userProfile.address,
      telephone : this.userProfile.telephone,
      nation : this.userProfile.nation,
      postOffice : this.userProfile.postOffice,
      state : this.userProfile.state,
      district : this.userProfile.district,
      place : this.userProfile.place,
    };

    this.api.updateProfile(profile).subscribe({
      next: (res) => {
        console.log(res.message || 'Profile updated successfully!');
        alert(res.message || 'Profile updated successfully!');
        this.originalProfile = { ...this.userProfile };
        this.isEditing = false;
      },
      error: (err) => {
        console.error(err);
        alert('Error updating profile.');
      }
    });
  }

  resetProfile() {
    this.userProfile = { ...this.originalProfile };
  }
}
