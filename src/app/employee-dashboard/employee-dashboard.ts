import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-employee-dashboard',
  imports: [],
  templateUrl: './employee-dashboard.html',
  styleUrl: './employee-dashboard.css',
  animations: [
    trigger('slideInUp', [
      state('in', style({ transform: 'translateY(0)', opacity: 1 })),
      transition('void => *', [
        style({ transform: 'translateY(30px)', opacity: 0 }),
        animate('0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)')
      ])
    ]),
    trigger('fadeInUp', [
      state('in', style({ transform: 'translateY(0)', opacity: 1 })),
      transition('void => *', [
        style({ transform: 'translateY(20px)', opacity: 0 }),
        animate('0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)')
      ])
    ])
  ]
})
export class EmployeeDashboard implements OnInit, AfterViewInit {
  @ViewChild('hoursChart') hoursChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('performanceChart') performanceChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('skillsChart') skillsChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('taskStatusChart') taskStatusChart!: ElementRef<HTMLCanvasElement>;

  animationState = 'in';

  ngOnInit() {
    // Component initialization
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.createHoursChart();
      this.createPerformanceChart();
      this.createSkillsChart();
      this.createTaskStatusChart();
    }, 100);
  }

  private createHoursChart() {
    const ctx = this.hoursChart.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [
            {
              label: 'Estimated',
              data: [140, 160, 150, 170, 155, 165],
              backgroundColor: 'rgba(204, 153, 51, 0.3)',
              borderColor: 'rgba(204, 153, 51, 1)',
              borderWidth: 1
            },
            {
              label: 'Actual',
              data: [145, 175, 165, 185, 160, 190],
              backgroundColor: 'rgba(47, 79, 47, 0.8)',
              borderColor: 'rgba(47, 79, 47, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    }
  }

  private createPerformanceChart() {
    const ctx = this.performanceChart.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [{
            label: 'Performance',
            data: [75, 82, 85, 88, 86, 92],
            borderColor: 'rgba(204, 153, 51, 1)',
            backgroundColor: 'rgba(204, 153, 51, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: 'rgba(204, 153, 51, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    }
  }

  private createSkillsChart() {
    const ctx = this.skillsChart.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'radar',
        data: {
          labels: ['Quality', 'Timeliness', 'Initiative', 'Communication', 'Teamwork', 'Problem Solving'],
          datasets: [{
            label: 'Skills',
            data: [85, 90, 75, 80, 88, 82],
            borderColor: 'rgba(47, 79, 47, 1)',
            backgroundColor: 'rgba(47, 79, 47, 0.2)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(47, 79, 47, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            r: {
              beginAtZero: true,
              max: 100,
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              },
              angleLines: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            }
          }
        }
      });
    }
  }

  private createTaskStatusChart() {
    const ctx = this.taskStatusChart.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Completed', 'In Progress', 'Pending'],
          datasets: [{
            data: [65, 25, 10],
            backgroundColor: [
              'rgba(204, 153, 51, 1)',
              'rgba(47, 79, 47, 1)',
              'rgba(184, 134, 11, 1)'
            ],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    }
  }
}
