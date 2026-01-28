import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Api } from '../services/api';
import { EmployeeProfileUpdateDto, EmployeeDocumentUpload } from '../models/common.model';
import { ToasterService } from '../services/toaster.service';
import { ToasterComponent } from '../components/toaster/toaster.component';
import { AvatarUtil } from '../utils/avatar.util';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ToasterComponent],
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
    avatar: AvatarUtil.DEFAULT_AVATAR
  };
  originalProfile: any = {};

  constructor(private api: Api, private toasterService: ToasterService) { }

  ngOnInit(): void {
    const empId = this.user?.empId;
    if (empId) {
      this.loadEmployeeProfile(empId);
    } else {
      // Initialize with empty values if no user data is available
      this.userProfile = {
        ...this.userProfile,
        name: this.user?.employeeName || '',
        email: this.user?.email || '',
        department: this.user?.department || '',
        designation: this.user?.designation || '',
        empId: this.user?.empId || '',
        location: this.user?.location || ''
      };
    }
  }

  loadEmployeeProfile(empId: string) {
    // First clear any existing data to prevent showing previous user's data
    this.clearProfileData();

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
            phone: data.phone || '',  // Don't fallback to previous user data
            careerSummary: data.careerSummary || '',  // Don't fallback to previous user data
            experienceInd: data.experienceInd || 0,  // Don't fallback to previous user data
            experienceAbroad: data.experienceAbroad || 0,  // Don't fallback to previous user data
            qualification: data.qualification || '',  // Don't fallback to previous user data
            skillset: data.skillset || '',  // Don't fallback to previous user data
            joinDate: data.doj || this.user.doj || '',
            dobDate: data.dobDate || this.user.dobDate || '',
            address: data.address || '',  // Don't fallback to previous user data
            telephone: data.telephone || '',  // Don't fallback to previous user data
            nation: data.nation || '',  // Don't fallback to previous user data
            postOffice: data.postOffice || '',  // Don't fallback to previous user data
            state: data.state || '',  // Don't fallback to previous user data
            district: data.district || '',  // Don't fallback to previous user data
            place: data.place || '',  // Don't fallback to previous user data
            avatar: AvatarUtil.processProfileImage(
              data.profileImageBase64,
              this.user.photo
            )
          };

          // Store original profile for reset
          this.originalProfile = { ...this.userProfile };
        } else {
          console.warn('No profile data found:', response.message);
          // Initialize with basic user data only
          this.initializeBasicProfile();
        }
      },
      error: (err) => {
        console.error('Error loading profile:', err);
        this.toasterService.showError('Error', 'Failed to load profile data. Please try again.');
        // Initialize with basic user data only
        this.initializeBasicProfile();
      }
    });
  }

  private clearProfileData() {
    // Clear all profile data to prevent showing previous user's information
    this.userProfile = {
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
      avatar: AvatarUtil.DEFAULT_AVATAR
    };
  }

  private initializeBasicProfile() {
    // Initialize only with current user's basic information
    this.userProfile = {
      ...this.userProfile,
      name: this.user?.employeeName || '',
      email: this.user?.email || '',
      department: this.user?.department || '',
      designation: this.user?.designation || '',
      empId: this.user?.empId || '',
      location: this.user?.location || '',
      joinDate: this.user?.doj || ''
    };
    this.originalProfile = { ...this.userProfile };
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

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      this.toasterService.showError('Invalid File Type', 'Please select a valid image file (JPEG, PNG, or GIF).');
      return;
    }

    if (file.size > maxSize) {
      this.toasterService.showError('File Too Large', 'Please select an image smaller than 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append('empId', this.user.empId.toString());
    formData.append('docName', file.name);
    formData.append('docType', file.type);
    formData.append('docCategory', "PROFILE_PICTURE");
    formData.append('uploadedBy', this.userProfile.name);
    formData.append('fileData', file, file.name);

    this.api.uploadDocument(formData).subscribe({
      next: (res: any) => {
        console.log(res.message || 'Upload successful!');
        this.toasterService.showSuccess('Photo Updated!', 'Your profile photo has been updated successfully.');
        this.userProfile.avatar = URL.createObjectURL(file); // show preview
      },
      error: (err) => {
        console.error(err);
        this.toasterService.showError('Upload Failed', 'There was an error uploading your photo. Please try again.');
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
      address: this.userProfile.address,
      telephone: this.userProfile.telephone,
      nation: this.userProfile.nation,
      postOffice: this.userProfile.postOffice,
      state: this.userProfile.state,
      district: this.userProfile.district,
      place: this.userProfile.place,
    };

    this.api.updateProfile(profile).subscribe({
      next: (res) => {
        console.log(res.message || 'Profile updated successfully!');
        this.toasterService.showSuccess(
          'Profile Updated!',
          res.message || 'Your profile has been updated successfully.'
        );
        this.originalProfile = { ...this.userProfile };
        this.isEditing = false;
      },
      error: (err) => {
        console.error(err);
        this.toasterService.showError(
          'Update Failed',
          'There was an error updating your profile. Please try again.'
        );
      }
    });
  }

  resetProfile() {
    this.userProfile = { ...this.originalProfile };
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
    return 'N/A';
  }

  onAvatarError(event: Event): void {
    AvatarUtil.handleImageError(event);
  }
}
