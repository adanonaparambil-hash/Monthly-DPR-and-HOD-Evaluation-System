import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-hod-dashboard',
  imports: [CommonModule],
  templateUrl: './hod-dashboard.html',
  styleUrl: './hod-dashboard.css',
  animations: [
    trigger('slideInDown', [
      transition(':enter', [
        style({ transform: 'translateY(-30px)', opacity: 0 }),
        animate('0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)', style({ transform: 'translateY(0)', opacity: 1 }))
      ])
    ]),
    trigger('slideInUp', [
      transition(':enter', [
        style({ transform: 'translateY(30px)', opacity: 0 }),
        animate('0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)', style({ transform: 'translateY(0)', opacity: 1 }))
      ])
    ]),
    trigger('slideInLeft', [
      transition(':enter', [
        style({ transform: 'translateX(-30px)', opacity: 0 }),
        animate('0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)', style({ transform: 'translateX(0)', opacity: 1 }))
      ])
    ]),
    trigger('slideInRight', [
      transition(':enter', [
        style({ transform: 'translateX(30px)', opacity: 0 }),
        animate('0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)', style({ transform: 'translateX(0)', opacity: 1 }))
      ])
    ]),
    trigger('fadeInUp', [
      transition(':enter', [
        style({ transform: 'translateY(20px)', opacity: 0 }),
        animate('0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)', style({ transform: 'translateY(0)', opacity: 1 }))
      ])
    ]),
    trigger('staggerIn', [
      transition(':enter', [
        query(':enter', [
          style({ transform: 'translateY(30px)', opacity: 0 }),
          stagger(100, animate('0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)', style({ transform: 'translateY(0)', opacity: 1 })))
        ], { optional: true })
      ])
    ])
  ]
})
export class HodDashboard implements OnInit, AfterViewInit {
  @ViewChild('summaryChart') summaryChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('performanceTrendChart') performanceTrendChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('departmentChart') departmentChart!: ElementRef<HTMLCanvasElement>;

  ngOnInit() {
    // Component initialization
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.createSummaryChart();
      this.createPerformanceTrendChart();
      this.createDepartmentChart();
    }, 100);
  }

  private createSummaryChart() {
    const ctx = this.summaryChart.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Excellent', 'Good', 'Average', 'Below Average', 'Poor'],
          datasets: [{
            data: [52, 30, 14, 3, 0],
            backgroundColor: [
              '#22c55e',
              '#3b82f6',
              '#f59e0b',
              '#ef4444',
              '#6b7280'
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

  private createPerformanceTrendChart() {
    const ctx = this.performanceTrendChart.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [
            {
              label: 'Initiative',
              data: [4.0, 4.1, 4.2, 4.0, 4.3, 4.2],
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              borderWidth: 3,
              fill: false,
              tension: 0.4,
              pointBackgroundColor: '#f59e0b',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              pointRadius: 6
            },
            {
              label: 'Overall Performance',
              data: [4.1, 4.2, 4.0, 4.3, 4.2, 4.1],
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderWidth: 3,
              fill: false,
              tension: 0.4,
              pointBackgroundColor: '#3b82f6',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              pointRadius: 6
            },
            {
              label: 'Quality',
              data: [4.2, 4.0, 4.1, 4.2, 4.4, 4.3],
              borderColor: '#8b5cf6',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              borderWidth: 3,
              fill: false,
              tension: 0.4,
              pointBackgroundColor: '#8b5cf6',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              pointRadius: 6
            },
            {
              label: 'Timeliness',
              data: [3.9, 4.1, 3.8, 4.0, 4.1, 3.9],
              borderColor: '#22c55e',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              borderWidth: 3,
              fill: false,
              tension: 0.4,
              pointBackgroundColor: '#22c55e',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              pointRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                usePointStyle: true,
                padding: 20
              }
            }
          },
          scales: {
            y: {
              beginAtZero: false,
              min: 2.5,
              max: 5,
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

  private createDepartmentChart() {
    const ctx = this.departmentChart.nativeElement.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['HR', 'Sales', 'IT', 'Marketing', 'Finance', 'Operations'],
          datasets: [
            {
              label: 'Initiative',
              data: [220, 240, 200, 230, 210, 220],
              backgroundColor: '#3b82f6',
              borderRadius: 4
            },
            {
              label: 'Quality',
              data: [180, 200, 160, 190, 170, 180],
              backgroundColor: '#22c55e',
              borderRadius: 4
            },
            {
              label: 'Timeliness',
              data: [80, 90, 70, 85, 75, 80],
              backgroundColor: '#f59e0b',
              borderRadius: 4
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
            x: {
              stacked: true,
              grid: {
                display: false
              }
            },
            y: {
              stacked: true,
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            }
          }
        }
      });
    }
  }
}
