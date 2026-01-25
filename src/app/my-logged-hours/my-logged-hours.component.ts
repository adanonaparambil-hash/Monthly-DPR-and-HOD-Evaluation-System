import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface LoggedHour {
  id: string;
  taskId: string;
  title: string;
  description: string;
  category: string;
  priority?: string;
  duration: string;
  date: string;
  project: string;
}

@Component({
  selector: 'app-my-logged-hours',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-logged-hours.component.html',
  styleUrls: ['./my-logged-hours.component.css']
})
export class MyLoggedHoursComponent implements OnInit {
  // Filter properties
  fromDate = '2023-10-23';
  toDate = '2023-10-29';
  selectedProject = 'all';
  selectedCategory = 'all';

  // Sample data
  loggedHours: LoggedHour[] = [
    // Today's records
    {
      id: '1',
      taskId: 'TSK-204',
      title: 'Implement OAuth2 Authentication Flow',
      description: 'Refactored the token exchange logic and integrated PKCE for better security.',
      category: 'Security Enhancement',
      duration: '04:20',
      date: '2023-10-26',
      project: 'internal'
    },
    {
      id: '2',
      taskId: 'TSK-189',
      title: 'Database Schema Migration',
      description: 'Finalized the user metadata expansion script and tested on staging.',
      category: 'Back-end',
      duration: '01:52',
      date: '2023-10-26',
      project: 'internal'
    },
    {
      id: '3',
      taskId: 'TSK-205',
      title: 'Team Standup',
      description: 'Daily sync with engineering team.',
      category: 'Meeting',
      duration: '00:30',
      date: '2023-10-26',
      project: 'internal'
    },
    // Yesterday's records
    {
      id: '4',
      taskId: 'TSK-210',
      title: 'UI Polish - Dashboard Widgets',
      description: 'Adjusted spacing and added empty state illustrations for the analytics tab.',
      category: 'Feature Development',
      duration: '08:15',
      date: '2023-10-25',
      project: 'client'
    },
    {
      id: '5',
      taskId: 'TSK-211',
      title: 'Code Review: PR #405',
      description: 'Reviewing the new notification system implementation.',
      category: 'Code Review',
      duration: '01:15',
      date: '2023-10-25',
      project: 'internal'
    },
    // Tuesday's records
    {
      id: '6',
      taskId: 'TSK-202',
      title: 'Critical Bug: Data Export Failure',
      description: 'Hotfix deployed to production. Memory leak during large CSV generation was resolved.',
      category: 'Bug Fix',
      priority: 'High Priority',
      duration: '07:30',
      date: '2023-10-24',
      project: 'client'
    }
  ];

  ngOnInit() {
    // Initialize component
  }

  getTodayRecords(): LoggedHour[] {
    return this.loggedHours.filter(record => record.date === '2023-10-26');
  }

  getYesterdayRecords(): LoggedHour[] {
    return this.loggedHours.filter(record => record.date === '2023-10-25');
  }

  getTuesdayRecords(): LoggedHour[] {
    return this.loggedHours.filter(record => record.date === '2023-10-24');
  }

  getCategoryClass(category: string): string {
    const categoryMap: { [key: string]: string } = {
      'Security Enhancement': 'security',
      'Back-end': 'backend',
      'Meeting': 'meeting',
      'Feature Development': 'feature',
      'Code Review': 'review',
      'Bug Fix': 'bug'
    };
    return categoryMap[category] || 'default';
  }

  getPriorityClass(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      'High Priority': 'high',
      'Medium Priority': 'medium',
      'Low Priority': 'low'
    };
    return priorityMap[priority] || 'default';
  }

  exportReport() {
    // Implement export functionality
    console.log('Exporting report from', this.fromDate, 'to', this.toDate);
  }

  logNewHours() {
    // Implement add new hours functionality
    console.log('Opening add new hours modal...');
  }
}