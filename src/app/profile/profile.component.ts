import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Api } from '../services/api';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
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
export class ProfileComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  animationState = 'in';
  isEditing = false;

  user = JSON.parse(localStorage.getItem('current_user') || '{}');
  

  userProfile = {
    name: this.user.employeeName || '',
    email: this.user.email || '',
    department: this.user.department || '',
    position: this.user.designation || '',
    employeeId: this.user.empId || '',
    phone: '+1 (555) 123-4567',
    bio: 'Experienced executive leader with over 15 years in strategic management and organizational development.',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format',
    joinDate: '2020-01-15',
    location: 'New York, NY'
  };

  originalProfile = { ...this.userProfile };

   constructor(private api: Api) {}

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) {
      this.userProfile = { ...this.originalProfile };
    }
  }

  triggerFileUpload() {
    this.fileInput.nativeElement.click();
  }

  // onFileSelected(event: any) {
  //   const file = event.target.files[0];
  //   if (file) {
  //     const reader = new FileReader();
  //     reader.onload = (e: any) => {
  //       this.userProfile.avatar = e.target.result;
  //     };
  //     reader.readAsDataURL(file);
  //   }
  // }


  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const uploadRequest = {
      empId: this.user.empId || '',
      docName: file.name,
      docType: file.type,
      docCategory: 'PROFILE_PICTURE',
      uploadedBy: this.userProfile.name,
      fileData: file
    };

    this.api.uploadDocument(uploadRequest).subscribe({
      next: (res) => {
        console.log(res.message || 'Upload successful!');
        // Update the avatar preview immediately
        const reader = new FileReader();
        reader.onload = () => {
          this.userProfile.avatar = reader.result as string;
        };
        reader.readAsDataURL(file);
      },
      error: (err) => {
        console.error(err);
        console.log('Upload failed!');
      }
    });
  }

  saveProfile() {
    // Here you would typically save to a service/API
    console.log('Saving profile:', this.userProfile);
    this.originalProfile = { ...this.userProfile };
    this.isEditing = false;
    
    // Show success message (you can implement a toast service)
    alert('Profile saved successfully!');
  }

  resetProfile() {
    this.userProfile = { ...this.originalProfile };
  }
}