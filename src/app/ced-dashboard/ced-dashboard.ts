import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-ced-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './ced-dashboard.html',
  styleUrl: './ced-dashboard.css',
  animations: [
    trigger('slideInUp', [
      state('in', style({ transform: 'translateY(0)', opacity: 1 })),
      transition('void => *', [
        style({ transform: 'translateY(30px)', opacity: 0 }),
        animate('0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)'),
      ]),
    ]),
    trigger('fadeInUp', [
      state('in', style({ transform: 'translateY(0)', opacity: 1 })),
      transition('void => *', [
        style({ transform: 'translateY(20px)', opacity: 0 }),
        animate('0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)'),
      ]),
    ]),
    trigger('scaleIn', [
      transition(':enter', [
        style({ transform: 'scale(0.8)', opacity: 0 }),
        animate(
          '0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          style({ transform: 'scale(1)', opacity: 1 })
        ),
      ]),
    ]),
    trigger('slideInLeft', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate('0.6s ease-out', style({ transform: 'translateX(0)', opacity: 1 })),
      ]),
    ]),
    trigger('slideInRight', [
      state('in', style({ transform: 'translateX(0)', opacity: 1 })),
      state('out', style({ transform: 'translateX(100%)', opacity: 0 })),
      transition('out => in', [animate('0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)')]),
      transition('in => out', [animate('0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)')]),
    ]),
  ],
})
export class CedDashboard implements OnInit, AfterViewInit {
  @ViewChild('productivityGauge') productivityGauge!: ElementRef<HTMLCanvasElement>;
  @ViewChild('qualityDonut') qualityDonut!: ElementRef<HTMLCanvasElement>;
  @ViewChild('timelinessDonut') timelinessDonut!: ElementRef<HTMLCanvasElement>;
  @ViewChild('departmentSunburst') departmentSunburst!: ElementRef<HTMLCanvasElement>;
  @ViewChild('hodRadar') hodRadar!: ElementRef<HTMLCanvasElement>;
  @ViewChild('evaluationStacked') evaluationStacked!: ElementRef<HTMLCanvasElement>;
  @ViewChild('heatmapChart') heatmapChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('taskTimeline') taskTimeline!: ElementRef<HTMLCanvasElement>;
  @ViewChild('achievementsBubble') achievementsBubble!: ElementRef<HTMLCanvasElement>;
  @ViewChild('topPerformersBar') topPerformersBar!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  animationState = 'in';
  selectedMonth = 'October';
  selectedDepartment = 'All Departments';
  showProfile = false;

  // User Profile Data
  userProfile = {
    name: 'John Smith',
    email: 'john.smith@company.com',
    department: 'Executive',
    position: 'Chief Executive Director',
    phone: '+1 (555) 123-4567',
    bio: 'Experienced executive leader with over 15 years in strategic management and organizational development.',
    avatar:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face&auto=format',
  };

  originalProfile = { ...this.userProfile };

  // KPI Data
  kpiData = {
    productivity: 87,
    quality: 92,
    timeliness: 78,
  };

  // Department Data
  departments = [
    { name: 'Engineering', productivity: 89, quality: 94, timeliness: 82, employees: 45 },
    { name: 'Marketing', productivity: 85, quality: 88, timeliness: 76, employees: 23 },
    { name: 'Sales', productivity: 91, quality: 87, timeliness: 85, employees: 32 },
    { name: 'HR', productivity: 83, quality: 95, timeliness: 79, employees: 12 },
    { name: 'Finance', productivity: 88, quality: 92, timeliness: 88, employees: 18 },
  ];

  // Top Performers
  topPerformers = [
    {
      name: 'Sarah Johnson',
      department: 'Engineering',
      score: 96,
      avatar:
        'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=60&h=60&fit=crop&crop=face&auto=format',
    },
    {
      name: 'Michael Chen',
      department: 'Sales',
      score: 94,
      avatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face&auto=format',
    },
    {
      name: 'Emily Davis',
      department: 'Marketing',
      score: 92,
      avatar:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face&auto=format',
    },
    {
      name: 'Robert Taylor',
      department: 'Engineering',
      score: 91,
      avatar:
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop&crop=face&auto=format',
    },
    {
      name: 'Lisa Anderson',
      department: 'Finance',
      score: 89,
      avatar:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=60&h=60&fit=crop&crop=face&auto=format',
    },
  ];

  // Achievements Data
  achievements = [
    'Project Delivery Excellence',
    'Innovation Leadership',
    'Team Collaboration',
    'Quality Improvement',
    'Customer Satisfaction',
    'Process Optimization',
  ];

  // Quick Insights
  insights = [
    { type: 'success', message: 'Engineering department exceeded productivity targets by 12%' },
    { type: 'warning', message: 'Marketing team needs support with timeliness metrics' },
    { type: 'info', message: '15 new recognition suggestions submitted this month' },
    { type: 'success', message: 'Overall company performance improved by 8% from last month' },
  ];

  currentInsightIndex = 0;

  constructor() {}

  ngOnInit() {
    // Start insight rotation
    this.rotateInsights();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.createProductivityGauge();
      this.createQualityDonut();
      this.createTimelinessDonut();
      this.createDepartmentChart();
      this.createHODRadar();
      this.createEvaluationStacked();
      this.createTaskTimeline();
      this.createAchievementsBubble();
      this.createTopPerformersBar();
    }, 100);
  }

  private createProductivityGauge() {
    const ctx = this.productivityGauge.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          datasets: [
            {
              data: [this.kpiData.productivity, 100 - this.kpiData.productivity],
              backgroundColor: ['#cc9933', '#e5e7eb'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '75%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          animation: {
            animateRotate: true,
            duration: 2000,
          },
        },
      });
    }
  }

  private createQualityDonut() {
    const ctx = this.qualityDonut.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          datasets: [
            {
              data: [this.kpiData.quality, 100 - this.kpiData.quality],
              backgroundColor: ['#2f4f2f', '#e5e7eb'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          animation: {
            animateRotate: true,
            duration: 2000,
            delay: 500,
          },
        },
      });
    }
  }

  private createTimelinessDonut() {
    const ctx = this.timelinessDonut.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          datasets: [
            {
              data: [this.kpiData.timeliness, 100 - this.kpiData.timeliness],
              backgroundColor: ['#b8860b', '#e5e7eb'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          animation: {
            animateRotate: true,
            duration: 2000,
            delay: 1000,
          },
        },
      });
    }
  }

  private createDepartmentChart() {
    const ctx = this.departmentSunburst.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: this.departments.map((d) => d.name),
          datasets: [
            {
              label: 'Productivity',
              data: this.departments.map((d) => d.productivity),
              backgroundColor: 'rgba(204, 153, 51, 0.8)',
              borderColor: 'rgba(204, 153, 51, 1)',
              borderWidth: 1,
            },
            {
              label: 'Quality',
              data: this.departments.map((d) => d.quality),
              backgroundColor: 'rgba(47, 79, 47, 0.8)',
              borderColor: 'rgba(47, 79, 47, 1)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
          },
          scales: {
            y: { beginAtZero: true, max: 100 },
          },
          animation: {
            duration: 2000,
            delay: (context) => context.dataIndex * 200,
          },
        },
      });
    }
  }

  private createHODRadar() {
    const ctx = this.hodRadar.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'radar',
        data: {
          labels: [
            'Quality',
            'Timeliness',
            'Initiative',
            'Communication',
            'Leadership',
            'Innovation',
          ],
          datasets: [
            {
              label: 'Average HOD Ratings',
              data: [88, 82, 85, 90, 87, 83],
              borderColor: 'rgba(204, 153, 51, 1)',
              backgroundColor: 'rgba(204, 153, 51, 0.2)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(204, 153, 51, 1)',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            r: {
              beginAtZero: true,
              max: 100,
              grid: { color: 'rgba(0, 0, 0, 0.1)' },
              angleLines: { color: 'rgba(0, 0, 0, 0.1)' },
            },
          },
          animation: {
            duration: 2000,
          },
        },
      });
    }
  }

  private createEvaluationStacked() {
    const ctx = this.evaluationStacked.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: this.departments.map((d) => d.name),
          datasets: [
            {
              label: 'Excellent',
              data: [25, 18, 22, 8, 12],
              backgroundColor: '#22c55e',
            },
            {
              label: 'Good',
              data: [15, 12, 18, 8, 10],
              backgroundColor: '#cc9933',
            },
            {
              label: 'Average',
              data: [5, 8, 6, 2, 4],
              backgroundColor: '#f59e0b',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true },
          },
          plugins: {
            legend: { position: 'top' },
          },
          animation: {
            duration: 2000,
          },
        },
      });
    }
  }

  private createTaskTimeline() {
    const ctx = this.taskTimeline.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
          datasets: [
            {
              label: 'Estimated Hours',
              data: [160, 165, 158, 170],
              borderColor: 'rgba(204, 153, 51, 1)',
              backgroundColor: 'rgba(204, 153, 51, 0.1)',
              borderWidth: 3,
              fill: true,
              tension: 0.4,
            },
            {
              label: 'Actual Hours',
              data: [155, 172, 163, 168],
              borderColor: 'rgba(47, 79, 47, 1)',
              backgroundColor: 'rgba(47, 79, 47, 0.1)',
              borderWidth: 3,
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
          },
          scales: {
            y: { beginAtZero: true },
          },
          animation: {
            duration: 2000,
          },
        },
      });
    }
  }

  private createAchievementsBubble() {
    const ctx = this.achievementsBubble.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'Department Achievements',
              data: [
                { x: 89, y: 94, r: 15 }, // Engineering
                { x: 85, y: 88, r: 10 }, // Marketing
                { x: 91, y: 87, r: 12 }, // Sales
                { x: 83, y: 95, r: 8 }, // HR
                { x: 88, y: 92, r: 9 }, // Finance
              ],
              backgroundColor: [
                'rgba(204, 153, 51, 0.6)',
                'rgba(47, 79, 47, 0.6)',
                'rgba(184, 134, 11, 0.6)',
                'rgba(34, 197, 94, 0.6)',
                'rgba(59, 130, 246, 0.6)',
              ],
              borderColor: [
                'rgba(204, 153, 51, 1)',
                'rgba(47, 79, 47, 1)',
                'rgba(184, 134, 11, 1)',
                'rgba(34, 197, 94, 1)',
                'rgba(59, 130, 246, 1)',
              ],
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: { title: { display: true, text: 'Productivity %' } },
            y: { title: { display: true, text: 'Quality %' } },
          },
          animation: {
            duration: 2000,
          },
        },
      });
    }
  }

  private createTopPerformersBar() {
    const ctx = this.topPerformersBar.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: this.topPerformers.map((p) => p.name),
          datasets: [
            {
              label: 'Performance Score',
              data: this.topPerformers.map((p) => p.score),
              backgroundColor: 'rgba(204, 153, 51, 0.8)',
              borderColor: 'rgba(204, 153, 51, 1)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: { beginAtZero: true, max: 100 },
          },
          animation: {
            duration: 2000,
            delay: (context) => context.dataIndex * 300,
          },
        },
      });
    }
  }

  rotateInsights() {
    setInterval(() => {
      this.currentInsightIndex = (this.currentInsightIndex + 1) % this.insights.length;
    }, 4000);
  }

  getCurrentInsight() {
    return this.insights[this.currentInsightIndex];
  }

  getInsightIcon(type: string): string {
    switch (type) {
      case 'success':
        return 'fas fa-check-circle';
      case 'warning':
        return 'fas fa-exclamation-triangle';
      case 'info':
        return 'fas fa-info-circle';
      default:
        return 'fas fa-lightbulb';
    }
  }

  getInsightClass(type: string): string {
    switch (type) {
      case 'success':
        return 'insight-success';
      case 'warning':
        return 'insight-warning';
      case 'info':
        return 'insight-info';
      default:
        return 'insight-default';
    }
  }

  // Profile Management Methods
  toggleProfile() {
    this.showProfile = !this.showProfile;
  }

  triggerFileUpload() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.userProfile.avatar = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  saveProfile() {
    // Here you would typically save to a service/API
    console.log('Saving profile:', this.userProfile);
    this.originalProfile = { ...this.userProfile };

    // Show success message (you can implement a toast service)
    alert('Profile saved successfully!');
    this.showProfile = false;
  }

  resetProfile() {
    this.userProfile = { ...this.originalProfile };
  }
}
