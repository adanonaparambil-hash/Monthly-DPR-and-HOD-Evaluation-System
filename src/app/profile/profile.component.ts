import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="profile-page">
      <div class="header-section">
        <h1>My Profile</h1>
        <p>Manage your profile information</p>
      </div>
      <div class="content-section">
        <p>Profile management functionality will be implemented here.</p>
      </div>
    </div>
  `,
  styles: [`
    .profile-page {
      padding: 20px;
      background: #f4f6f9;
      min-height: 100vh;
    }
    .header-section {
      background: white;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header-section h1 {
      margin: 0 0 10px 0;
      color: #3d532d;
    }
    .content-section {
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
  `]
})
export class ProfileComponent {
  constructor() {}
}