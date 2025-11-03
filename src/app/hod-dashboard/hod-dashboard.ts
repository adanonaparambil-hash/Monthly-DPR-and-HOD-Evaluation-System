import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import { Chart, registerables } from 'chart.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Api } from '../services/api';
import { HODDepartmentDashboard, HODEmployeePerformanceTrend, HODEvaluationSummary, HODDepartmentRanking } from '../models/dashBoard.model';

Chart.register(...registerables);
gsap.registerPlugin(ScrollTrigger);

interface Particle {
  x: number;
  y: number;
  delay: number;
  size: number;
}

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
export class HodDashboard implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('summaryChart') summaryChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('performanceTrendChart') performanceTrendChart!: ElementRef<HTMLCanvasElement>;

  // Parallax and animation properties
  particles: Particle[] = [];
  mouseX: number = 0;
  mouseY: number = 0;

  currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
  EmployeeID = this.currentUser.empId || this.currentUser.employeeId;

  // Dashboard data properties
  dashboardData: HODDepartmentDashboard | null = null;
  isLoading = true;

  // Chart instances
  summaryChartInstance: Chart | null = null;
  performanceTrendChartInstance: Chart | null = null;

  constructor(private api: Api) {

  }


  ngOnInit() {
    this.initializeParticles();
    this.setupParallaxEffects();
    this.loadHODDashBoard();
  }

  // Method to check canvas availability
  private checkCanvasElements(): boolean {
    const summaryCanvas = this.summaryChart?.nativeElement;
    const trendCanvas = this.performanceTrendChart?.nativeElement;
    
    console.log('Canvas elements check:', {
      summaryCanvas: !!summaryCanvas,
      trendCanvas: !!trendCanvas,
      summaryCanvasContext: summaryCanvas ? !!summaryCanvas.getContext('2d') : false,
      trendCanvasContext: trendCanvas ? !!trendCanvas.getContext('2d') : false
    });

    return !!(summaryCanvas && trendCanvas);
  }

  // Helper methods for template
  getMonthName(month: number): string {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[(month || 1) - 1] || 'Unknown';
  }

  getDefaultProfileImage(): string {
    return 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=50&h=50&fit=crop&crop=face&auto=format';
  }

  getDepartmentRankings(): HODDepartmentRanking[] {
    return this.dashboardData?.hodDepartmentRankings || [];
  }

  // Public method for debugging - can be called from browser console
  public debugCharts(): void {
    console.log('=== Chart Debug Info ===');
    console.log('Dashboard Data:', this.dashboardData);
    console.log('Summary Chart Instance:', this.summaryChartInstance);
    console.log('Performance Chart Instance:', this.performanceTrendChartInstance);
    console.log('Canvas Elements Check:', this.checkCanvasElements());
    
    // Force recreation
    this.recreateCharts();
  }

  ngOnDestroy() {
    ScrollTrigger.getAll().forEach((trigger: any) => trigger.kill());
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.mouseX = (event.clientX / window.innerWidth) * 100;
    this.mouseY = (event.clientY / window.innerHeight) * 100;
    this.updateParallaxLayers();
  }

  private initializeParticles() {
    this.particles = [];
    const particleCount = window.innerWidth < 768 ? 15 : 25;

    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        delay: Math.random() * 5,
        size: Math.random() * 6 + 4
      });
    }
  }

  private setupParallaxEffects() {
    const animate = () => {
      this.updateParallaxLayers();
      requestAnimationFrame(animate);
    };
    animate();
  }

  private updateParallaxLayers() {
    const layers = document.querySelectorAll('.parallax-layer');
    const shapes = document.querySelectorAll('.floating-shape');

    layers.forEach((layer, index) => {
      const speed = (index + 1) * 0.3;
      const xOffset = (this.mouseX - 50) * speed * 0.02;
      const yOffset = (this.mouseY - 50) * speed * 0.02;

      (layer as HTMLElement).style.transform =
        `translate3d(${xOffset}px, ${yOffset}px, 0)`;
    });

    shapes.forEach((shape, index) => {
      const speed = (index + 1) * 0.2;
      const xOffset = (this.mouseX - 50) * speed * 0.01;
      const yOffset = (this.mouseY - 50) * speed * 0.01;

      (shape as HTMLElement).style.transform =
        `translate3d(${xOffset}px, ${yOffset}px, 0) rotate(${this.mouseX * 0.1}deg)`;
    });
  }

  ngAfterViewInit() {
    setTimeout(() => {
      if (this.checkCanvasElements()) {
        this.initializeCharts();
        this.initializeGSAPAnimations();
        this.setupScrollTriggers();
      } else {
        console.error('Canvas elements not available, retrying...');
        // Retry after a longer delay
        setTimeout(() => {
          if (this.checkCanvasElements()) {
            this.initializeCharts();
            this.initializeGSAPAnimations();
            this.setupScrollTriggers();
          } else {
            console.error('Canvas elements still not available after retry');
          }
        }, 500);
      }
    }, 200);
  }

  private initializeCharts() {
    try {
      this.createSummaryChart();
      this.createPerformanceTrendChart();
      console.log('Charts initialized successfully');
    } catch (error) {
      console.error('Error initializing charts:', error);
    }
  }

  private initializeGSAPAnimations() {
    // Only animate background elements, not content
    // Floating shapes animation
    gsap.to('.floating-shape', {
      y: '+=30',
      rotation: '+=360',
      duration: 15,
      ease: 'none',
      repeat: -1,
      yoyo: true,
      stagger: 0.5
    });

    // Particles animation
    gsap.to('.particle', {
      y: '-=100vh',
      opacity: 0,
      duration: 20,
      ease: 'none',
      repeat: -1,
      stagger: 0.3
    });

    // Card glow effects (subtle)
    gsap.to('.card-glow', {
      opacity: 0.2,
      scale: 1.02,
      duration: 3,
      ease: 'power2.inOut',
      repeat: -1,
      yoyo: true,
      stagger: 0.5
    });
  }

  private setupScrollTriggers() {
    // Only animate background layers for parallax effect
    gsap.to('.bg-layer-1', {
      yPercent: -30,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hod-dashboard-container',
        start: 'top bottom',
        end: 'bottom top',
        scrub: true
      }
    });

    gsap.to('.bg-layer-2', {
      yPercent: -20,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hod-dashboard-container',
        start: 'top bottom',
        end: 'bottom top',
        scrub: true
      }
    });

    gsap.to('.bg-layer-3', {
      yPercent: -10,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hod-dashboard-container',
        start: 'top bottom',
        end: 'bottom top',
        scrub: true
      }
    });

    // Counter animations (keep this as it's useful)
    this.animateCounters();
  }

  private animateCounters() {
    const counters = document.querySelectorAll('.counter-number');

    counters.forEach((counter) => {
      const target = parseFloat(counter.textContent || '0');

      gsap.to(counter, {
        innerHTML: target,
        duration: 2,
        ease: 'power2.out',
        snap: { innerHTML: 1 },
        scrollTrigger: {
          trigger: counter,
          start: 'top 80%',
          toggleActions: 'play none none reverse'
        },
        onUpdate: function () {
          const value = parseFloat(this.targets()[0].innerHTML);
          counter.innerHTML = Math.round(value).toString();
        }
      });
    });
  }

  private createSummaryChart() {
    try {
      if (!this.summaryChart?.nativeElement) {
        console.error('Summary chart canvas element not found');
        return;
      }

      const ctx = this.summaryChart.nativeElement.getContext('2d');
      if (!ctx) {
        console.error('Could not get 2D context for summary chart');
        return;
      }

      // Destroy existing chart if it exists
      if (this.summaryChartInstance) {
        this.summaryChartInstance.destroy();
      }

      this.summaryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Excellent', 'Good', 'Average', 'Below Average', 'Poor'],
          datasets: [{
            data: [1, 1, 1, 1, 1], // Initial data with small values to show chart
            backgroundColor: [
              '#22c55e',
              '#3b82f6',
              '#f59e0b',
              '#ef4444',
              '#6b7280'
            ],
            borderWidth: 0,
            hoverBorderWidth: 2,
            hoverBorderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const label = context.label || '';
                  const value = context.parsed;
                  const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                  return `${label}: ${value} (${percentage}%)`;
                }
              }
            }
          },
          animation: {
            animateRotate: true,
            duration: 1500,
            easing: 'easeOutQuart'
          },
          layout: {
            padding: 10
          }
        }
      });

      console.log('Summary chart created successfully');
    } catch (error) {
      console.error('Error creating summary chart:', error);
    }
  }

  private updateSummaryChart() {
    try {
      if (!this.summaryChartInstance) {
        console.warn('Summary chart instance not available for update');
        return;
      }

      if (this.dashboardData?.hodEvaluationSummary?.[0]) {
        const summary = this.dashboardData.hodEvaluationSummary[0];
        const data = [
          summary.excellentCount || 0,
          summary.goodCount || 0,
          summary.averageCount || 0,
          summary.belowAverageCount || 0,
          summary.poorCount || 0
        ];

        this.summaryChartInstance.data.datasets[0].data = data;
        this.summaryChartInstance.update();
        console.log('Summary chart updated with data:', data);
      } else {
        console.warn('No evaluation summary data available for chart update');
      }
    } catch (error) {
      console.error('Error updating summary chart:', error);
    }
  }

  private createPerformanceTrendChart() {
    try {
      if (!this.performanceTrendChart?.nativeElement) {
        console.error('Performance trend chart canvas element not found');
        return;
      }

      const ctx = this.performanceTrendChart.nativeElement.getContext('2d');
      if (!ctx) {
        console.error('Could not get 2D context for performance trend chart');
        return;
      }

      // Destroy existing chart if it exists
      if (this.performanceTrendChartInstance) {
        this.performanceTrendChartInstance.destroy();
      }

      this.performanceTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Sep 2025', 'Oct 2025'], // Initial sample data
          datasets: [
            {
              label: 'Initiative',
              data: [3, 3.7],
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
              data: [4, 68],
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
              data: [2, 3.5],
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
              data: [2, 4.6],
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
              min: 0,
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

      console.log('Performance trend chart created successfully');
    } catch (error) {
      console.error('Error creating performance trend chart:', error);
    }
  }

  private updatePerformanceTrendChart() {
    try {
      if (!this.performanceTrendChartInstance) {
        console.warn('Performance trend chart instance not available for update');
        return;
      }

      if (this.dashboardData?.performanceTrends && this.dashboardData.performanceTrends.length > 0) {
        const trends = this.dashboardData.performanceTrends;

        // Create labels from month/year data
        const labels = trends.map(trend => {
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${monthNames[(trend.month || 1) - 1]} ${trend.year}`;
        });

        // Extract data for each metric
        const initiativeData = trends.map(trend => trend.initiative || 0);
        const overallData = trends.map(trend => trend.overallPerformance || 0);
        const qualityData = trends.map(trend => trend.quality || 0);
        const timelinessData = trends.map(trend => trend.timeliness || 0);

        this.performanceTrendChartInstance.data.labels = labels;
        this.performanceTrendChartInstance.data.datasets[0].data = initiativeData;
        this.performanceTrendChartInstance.data.datasets[1].data = overallData;
        this.performanceTrendChartInstance.data.datasets[2].data = qualityData;
        this.performanceTrendChartInstance.data.datasets[3].data = timelinessData;

        this.performanceTrendChartInstance.update();
        console.log('Performance trend chart updated with data:', { labels, initiativeData, overallData, qualityData, timelinessData });
      } else {
        console.warn('No performance trends data available for chart update');
      }
    } catch (error) {
      console.error('Error updating performance trend chart:', error);
    }
  }




  loadHODDashBoard(): void {
    this.isLoading = true;
    this.api.GetHODDashBoardDetails(this.EmployeeID).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          console.log("Dashboard Data: ", JSON.stringify(response.data.hodPendingEvaluations, null, 2));
          this.dashboardData = response.data;
          this.isLoading = false;

          // Update charts with new data after a short delay to ensure DOM is ready
          setTimeout(() => {
            this.updateCharts();
          }, 500);
        } else {
          console.warn('No HOD dashboard records found or API call failed');
          this.setFallbackData();
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('Error fetching dashboard list:', error);
        this.setFallbackData();
        this.isLoading = false;
      }
    });
  }

  private setFallbackData(): void {
    // Set some fallback data for testing
    this.dashboardData = {
      topPerformedMonth: 10,
      topPerformedYear: 2025,
      departmentEmployeeCount: 20,
      pendingMPRs: 19,
      evaluatedMPRs: 1,
      topPerformerEmpid: "ITS44",
      topPerformerEmployeeName: "HARIHARASUDHAN SAKTHIVEL",
      topPerformerDepartment: "IT",
      topPerformerRating: 68,
      topPerformerDprid: 61,
      performanceTrends: [
        {
          month: 9,
          year: 2025,
          initiative: 3,
          quality: 2,
          timeliness: 2,
          overallPerformance: 4
        },
        {
          month: 10,
          year: 2025,
          initiative: 3.7,
          quality: 3.5,
          timeliness: 4.6,
          overallPerformance: 68
        }
      ],
      hodEvaluationSummary: [
        {
          departmentName: "IT",
          excellentCount: 0,
          excellentPercentage: 0,
          goodCount: 1,
          goodPercentage: 100,
          averageCount: 0,
          averagePercentage: 0,
          belowAverageCount: 0,
          belowAveragePercentage: 0,
          poorCount: 0,
          poorPercentage: 0,
          totalEvaluations: 1
        }
      ],
      hodDepartmentRankings: [
        {
          rank: 1,
          employeeId: "ITS44",
          employeeName: "HARIHARASUDHAN SAKTHIVEL",
          department: "IT",
          rating: 68,
          profileImage: undefined,
          profileImageBase64: undefined
        }
      ],
      hodPendingEvaluations: []
    };

    setTimeout(() => {
      this.updateCharts();
    }, 500);
  }

  private updateCharts(): void {
    if (this.dashboardData) {
      // If charts don't exist, create them first
      if (!this.summaryChartInstance || !this.performanceTrendChartInstance) {
        console.log('Charts not initialized, creating them...');
        this.initializeCharts();
        
        // Wait a bit for charts to be created before updating
        setTimeout(() => {
          this.updateSummaryChart();
          this.updatePerformanceTrendChart();
        }, 300);
      } else {
        this.updateSummaryChart();
        this.updatePerformanceTrendChart();
      }

      // Force change detection to ensure UI updates
      setTimeout(() => {
        console.log('Charts updated with data:', this.dashboardData);
      }, 100);
    } else {
      console.warn('No dashboard data available for chart updates');
    }
  }

  // Method to force chart recreation
  private recreateCharts(): void {
    console.log('Recreating charts...');
    
    // Destroy existing charts
    if (this.summaryChartInstance) {
      this.summaryChartInstance.destroy();
      this.summaryChartInstance = null;
    }
    
    if (this.performanceTrendChartInstance) {
      this.performanceTrendChartInstance.destroy();
      this.performanceTrendChartInstance = null;
    }

    // Recreate charts
    setTimeout(() => {
      this.initializeCharts();
      if (this.dashboardData) {
        setTimeout(() => {
          this.updateCharts();
        }, 300);
      }
    }, 100);
  }

}
