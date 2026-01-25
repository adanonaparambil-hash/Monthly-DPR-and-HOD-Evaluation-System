import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface PendingUser {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  initials?: string;
  pendingLogs: number;
  lastActivity: string;
  isSelected?: boolean;
}

interface DPRLog {
  id: string;
  date: string;
  project: string;
  projectType: 'internal' | 'client';
  taskTitle: string;
  taskDescription: string;
  category: string;
  categoryType: 'security' | 'backend' | 'feature' | 'bugfix';
  hours: string;
  status: 'pending' | 'approved' | 'rejected';
  isSelected?: boolean;
}

@Component({
  selector: 'app-dpr-approval',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dpr-approval.component.html',
  styleUrls: ['./dpr-approval.component.css']
})
export class DprApprovalComponent implements OnInit {
  selectedUser: PendingUser | null = null;
  fromDate = '2023-10-23';
  toDate = '2023-10-29';
  selectedProject = 'all';
  selectedTaskTypes = 'all';
  selectAll = false;

  pendingUsers: PendingUser[] = [
    {
      id: '1',
      name: 'Sarah Miller',
      role: 'Front-end Developer',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC5_s6ycPEg7DHhmJ1VyqXY0Phb_qLONHqfeyKjAcW7NGcquu1lVCxyIQZi7se1eEB_J3DBduHaZGjy3OGJ_cXgLjDCoYDS_h3p07rnnSceQya5CrmhjvYDjqi35JniOlzoFJ-PhBcd2p_mvcA2UNs1peISG1MAlmMlTgG0_D1VqKT-_6mvpvUsz7-GqE6lI11cuMVa7jfp7lJ_Xzg3h7U_jwuxyn6fVGig92BW3lM5S4cO8QyEU4YzOSmNs-CCxgWma8PkdYrj0409',
      pendingLogs: 8,
      lastActivity: '2h ago',
      isSelected: true
    },
    {
      id: '2',
      name: 'David Chen',
      role: 'Backend Engineer',
      initials: 'DC',
      pendingLogs: 5,
      lastActivity: '4h ago'
    },
    {
      id: '3',
      name: 'Alex Johnson',
      role: 'Product Designer',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbgcr89zuRQM5tEBF4nOOC_Ufk-L6BFr_7mjbCil0oUrkHz4X6jyLZUJMa01HnXIbS8FeSrPa7uH9M63izeT79w-f5fS2s2AIU3vxDbt6j4ChexuqUzEjXymAkdn-8NQ1DZHqs5bKDhP1MZdSS86XQ5aHnMBXaQ_3dx-xgqPAwlcHY4STDOyXE8a6t-Dl--fOMBUkXZVtDYsZjvGisn6IUUVxTL_m37uKRqMouq4Qdx1vkOe9N55ggfOWHd6LZMqx8FzNyQM5ilFrw',
      pendingLogs: 12,
      lastActivity: '1d ago'
    },
    {
      id: '4',
      name: 'Maria Rodriguez',
      role: 'QA Engineer',
      initials: 'MR',
      pendingLogs: 3,
      lastActivity: '1d ago'
    }
  ];

  dprLogs: DPRLog[] = [
    {
      id: '1',
      date: 'Oct 26, 2023',
      project: 'Internal Tools',
      projectType: 'internal',
      taskTitle: 'Implement OAuth2 Authentication Flow',
      taskDescription: 'Refactored the token exchange logic and integrated PKCE.',
      category: 'Security',
      categoryType: 'security',
      hours: '04:20',
      status: 'pending'
    },
    {
      id: '2',
      date: 'Oct 25, 2023',
      project: 'Client Work',
      projectType: 'client',
      taskTitle: 'Database Schema Migration',
      taskDescription: 'User metadata expansion script testing.',
      category: 'Back-end',
      categoryType: 'backend',
      hours: '01:52',
      status: 'pending'
    },
    {
      id: '3',
      date: 'Oct 24, 2023',
      project: 'Internal Tools',
      projectType: 'internal',
      taskTitle: 'UI Polish - Dashboard Widgets',
      taskDescription: 'Adjusted spacing and added empty states.',
      category: 'Feature',
      categoryType: 'feature',
      hours: '08:15',
      status: 'pending'
    },
    {
      id: '4',
      date: 'Oct 24, 2023',
      project: 'Client Work',
      projectType: 'client',
      taskTitle: 'Critical Bug: Data Export',
      taskDescription: 'Hotfix deployed to production.',
      category: 'Bug Fix',
      categoryType: 'bugfix',
      hours: '07:30',
      status: 'pending'
    }
  ];

  ngOnInit() {
    // Set the first user as selected by default
    if (this.pendingUsers.length > 0) {
      this.selectedUser = this.pendingUsers[0];
    }
  }

  // TrackBy functions for performance
  trackByUserId(index: number, user: PendingUser): string {
    return user.id;
  }

  trackByLogId(index: number, log: DPRLog): string {
    return log.id;
  }

  selectUser(user: PendingUser) {
    // Reset previous selection
    this.pendingUsers.forEach(u => u.isSelected = false);
    
    // Set new selection
    user.isSelected = true;
    this.selectedUser = user;
  }

  toggleSelectAll() {
    this.selectAll = !this.selectAll;
    this.dprLogs.forEach(log => log.isSelected = this.selectAll);
  }

  toggleLogSelection(log: DPRLog) {
    log.isSelected = !log.isSelected;
    
    // Update select all checkbox
    this.selectAll = this.dprLogs.every(l => l.isSelected);
  }

  getSelectedLogsCount(): number {
    return this.dprLogs.filter(log => log.isSelected).length;
  }

  getTotalPendingUsers(): number {
    return this.pendingUsers.length;
  }

  getProjectBadgeClass(projectType: string): string {
    return projectType === 'internal' ? 'internal' : 'client';
  }

  getCategoryBadgeClass(categoryType: string): string {
    return categoryType;
  }

  getUserInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  getInitialsClass(name: string): string {
    const colors = ['initials-blue', 'initials-pink', 'initials-green', 'initials-yellow', 'initials-purple'];
    const index = name.length % colors.length;
    return colors[index];
  }

  approveSelected() {
    const selectedLogs = this.dprLogs.filter(log => log.isSelected);
    if (selectedLogs.length > 0) {
      console.log('Approving logs:', selectedLogs);
      // Implement approval logic here
      selectedLogs.forEach(log => {
        log.status = 'approved';
        log.isSelected = false;
      });
      this.selectAll = false;
    }
  }

  cancelSelection() {
    this.dprLogs.forEach(log => log.isSelected = false);
    this.selectAll = false;
  }
}