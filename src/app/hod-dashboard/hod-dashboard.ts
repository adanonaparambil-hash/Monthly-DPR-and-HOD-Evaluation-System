import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
  imports: [CommonModule, FormsModule],
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
  @ViewChild('dashboardHeader') dashboardHeader!: ElementRef;

  // Parallax and animation properties
  particles: Particle[] = [];
  mouseX: number = 0;
  mouseY: number = 0;

  currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
  EmployeeID = this.currentUser.empId || this.currentUser.employeeId;

  // Dashboard data properties
  dashboardData: HODDepartmentDashboard | null = null;
  isLoading = true;

  // Pending evaluations properties
  pendingEvaluations: any[] = [];
  filteredPendingEvaluations: any[] = [];
  searchTerm: string = '';
  totalCount: number = 0;

  // Chart instances
  summaryChartInstance: Chart | null = null;
  performanceTrendChartInstance: Chart | null = null;

  // Month/Year selection
  selectedMonth: number = 0;
  selectedYear: number = 0;

  months = [
    { value: 1, name: 'January' },
    { value: 2, name: 'February' },
    { value: 3, name: 'March' },
    { value: 4, name: 'April' },
    { value: 5, name: 'May' },
    { value: 6, name: 'June' },
    { value: 7, name: 'July' },
    { value: 8, name: 'August' },
    { value: 9, name: 'September' },
    { value: 10, name: 'October' },
    { value: 11, name: 'November' },
    { value: 12, name: 'December' }
  ];

  years = [2026, 2025, 2024, 2023, 2022];

  // Quote of the Day
  quoteOfTheDay = {
    text: 'Leadership is not about being in charge. It is about taking care of those in your charge.',
    author: 'Simon Sinek'
  };

  // All quotes from API
  allQuotes: Array<{ text: string; author: string }> = [];
  currentQuoteIndex: number = 0;
  quoteInterval: any;

  // Today's Birthdays
  todaysBirthdays: Array<{
    id: string;
    name: string;
    department: string;
    profileImage: string;
  }> = [];

  currentBirthdayIndex: number = 0;
  birthdayInterval: any;

  constructor(private api: Api, private router: Router) {

  }


  ngOnInit() {
    this.initializeParticles();
    this.setupParallaxEffects();
    this.initializeDefaultMonthYear();
    this.loadHODDashBoard();
    this.loadQuoteOfTheDay();
    this.loadTodaysBirthdays();
  }

  private initializeDefaultMonthYear() {
    const currentDate = new Date();
    // Set to previous month by default
    const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);

    this.selectedMonth = previousMonth.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
    this.selectedYear = previousMonth.getFullYear();

    console.log(`Default selection: Month ${this.selectedMonth}, Year ${this.selectedYear}`);
  }

  onMonthYearChange() {
    console.log(`Month/Year changed to: ${this.selectedMonth}/${this.selectedYear}`);
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

  // Format date to show only date part
  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  // Get profile image with fallback
  getProfileImage(employee: any): string {
    return employee?.profileImageBase64 || employee?.profileImage || this.getDefaultProfileImage();
  }

  // Search functionality for pending evaluations
  onSearchChange(event: any): void {
    this.searchTerm = event.target.value.toLowerCase();
    this.filterPendingEvaluations();
  }

  private filterPendingEvaluations(): void {
    if (!this.searchTerm) {
      this.filteredPendingEvaluations = [...this.pendingEvaluations];
    } else {
      this.filteredPendingEvaluations = this.pendingEvaluations.filter(evaluation =>
        evaluation.employeeName?.toLowerCase().includes(this.searchTerm) ||
        evaluation.department?.toLowerCase().includes(this.searchTerm) ||
        evaluation.employeeId?.toLowerCase().includes(this.searchTerm)
      );
    }
  }

  // Navigate to monthly DPR entry listing
  evaluateEmployee(dprid: number): void {
    if (dprid) {
      console.log('Navigating to evaluate employee with DPRID:', dprid);

      // Navigate to monthly DPR entry listing with the dprid
      // Adjust the route path based on your actual routing structure
      try {

        this.router.navigate(['/monthly-dpr', dprid], {
          queryParams: {
            readonly: '1',
            from: 'past-reports'
          }
        });

      } catch (error) {
        console.error('Navigation error:', error);
        // Fallback to window.location if router navigation fails
        window.location.href = `/monthly-dpr-listing?dprid=${dprid}`;
      }
    }
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
    if (this.birthdayInterval) {
      clearInterval(this.birthdayInterval);
    }
    if (this.quoteInterval) {
      clearInterval(this.quoteInterval);
    }
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
            data: [0, 0, 0, 0, 0], // Initial empty data - will be updated with actual data
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
          labels: [], // Empty initial data - will be updated with actual data
          datasets: [
            {
              label: 'Initiative',
              data: [],
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              borderWidth: 3,
              fill: false,
              tension: 0.4,
              pointBackgroundColor: '#f59e0b',
              pointBorderColor: '#fff',
              pointBorderWidth: 3,
              pointRadius: 8,
              pointHoverRadius: 10
            },
            {
              label: 'Overall Performance',
              data: [],
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderWidth: 3,
              fill: false,
              tension: 0.4,
              pointBackgroundColor: '#3b82f6',
              pointBorderColor: '#fff',
              pointBorderWidth: 3,
              pointRadius: 8,
              pointHoverRadius: 10
            },
            {
              label: 'Quality',
              data: [],
              borderColor: '#8b5cf6',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              borderWidth: 3,
              fill: false,
              tension: 0.4,
              pointBackgroundColor: '#8b5cf6',
              pointBorderColor: '#fff',
              pointBorderWidth: 3,
              pointRadius: 8,
              pointHoverRadius: 10
            },
            {
              label: 'Timeliness',
              data: [],
              borderColor: '#22c55e',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              borderWidth: 3,
              fill: false,
              tension: 0.4,
              pointBackgroundColor: '#22c55e',
              pointBorderColor: '#fff',
              pointBorderWidth: 3,
              pointRadius: 8,
              pointHoverRadius: 10
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
                padding: 20,
                font: {
                  size: 12,
                  weight: 'bold'
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const label = context.dataset.label || '';
                  const value = context.parsed.y;
                  return `${label}: ${value.toFixed(1)}`;
                }
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
              },
              ticks: {
                callback: function (value) {
                  return value + '%';
                }
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
        console.log("trends" + trends);
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
    if (this.selectedMonth === 0 || this.selectedYear === 0) {
      console.warn('Month or Year not selected');
      return;
    }

    this.isLoading = true;
    this.api.GetHODDashBoardDetails(this.EmployeeID, this.selectedMonth, this.selectedYear).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          console.log("Dashboard Data: ", JSON.stringify(response.data.hodPendingEvaluations, null, 2));
          this.dashboardData = response.data;

          // Set pending evaluations data
          this.pendingEvaluations = response.data.hodPendingEvaluations || [];
          this.filteredPendingEvaluations = [...this.pendingEvaluations];
          this.totalCount = this.pendingEvaluations.length > 0 ? (this.pendingEvaluations[0]?.totalCount || this.pendingEvaluations.length) : 0;

          this.isLoading = false;

          // Update charts with new data after a short delay to ensure DOM is ready
          setTimeout(() => {
            this.updateCharts();
          }, 500);
        } else {
          console.warn('No HOD dashboard records found or API call failed');
          //this.setFallbackData();
          this.isLoading = false;
        }
      },
      error: (error: any) => {
        console.error('Error fetching dashboard list:', error);
        //this.setFallbackData();
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
      pendingMPRs: 1,
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
      hodPendingEvaluations: [
        {
          dprid: 142,
          employeeId: "ITS48",
          employeeName: "ADAN ONAPARAMBIL",
          department: "IT",
          submissionDate: "2025-10-30T14:42:17.289",
          actionStatus: "Submitted",
          profileImage: undefined,
          profileImageBase64: undefined,
          totalCount: 1
        }
      ]
    };

    // Set pending evaluations data for fallback
    this.pendingEvaluations = this.dashboardData.hodPendingEvaluations || [];
    this.filteredPendingEvaluations = [...this.pendingEvaluations];
    this.totalCount = this.pendingEvaluations.length > 0 ? (this.pendingEvaluations[0]?.totalCount || this.pendingEvaluations.length) : 0;

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

  // Load Quote of the Day and Birthdays from API
  private loadQuoteOfTheDay(): void {
    this.api.GetTodaysBirthdaysAndQuotes().subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          // Load all quotes
          if (response.data.quotes && response.data.quotes.length > 0) {
            this.allQuotes = response.data.quotes.map((q: any) => ({
              text: q.quoteText,
              author: q.author
            }));
            
            // Display first quote
            this.currentQuoteIndex = 0;
            this.quoteOfTheDay = this.allQuotes[0];
            
            // Start rotating quotes if more than one
            if (this.allQuotes.length > 1) {
              this.startQuoteRotation();
            }
          }
        }
      },
      error: (error: any) => {
        console.error('Error fetching quotes:', error);
        // Keep default quote on error
      }
    });
  }

  // Start Quote Rotation
  private startQuoteRotation(): void {
    this.quoteInterval = setInterval(() => {
      this.nextQuote();
    }, 10000); // Change quote every 10 seconds
  }

  // Navigate to next quote
  private nextQuote(): void {
    if (this.allQuotes.length > 0) {
      this.currentQuoteIndex = (this.currentQuoteIndex + 1) % this.allQuotes.length;
      this.quoteOfTheDay = this.allQuotes[this.currentQuoteIndex];
    }
  }

  // Load Today's Birthdays from API
  private loadTodaysBirthdays(): void {
    this.api.GetTodaysBirthdaysAndQuotes().subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          // Load birthdays
          if (response.data.employees && response.data.employees.length > 0) {
            this.todaysBirthdays = response.data.employees.map((emp: any, index: number) => {
              // Handle base64 image - ensure it has proper data URI prefix
              let profileImage = 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face&auto=format';
              
              if (emp.profileImageBase64) {
                // Check if it already has data URI prefix
                if (emp.profileImageBase64.startsWith('data:image')) {
                  profileImage = emp.profileImageBase64;
                } else {
                  // Add data URI prefix
                  profileImage = `data:image/jpeg;base64,${emp.profileImageBase64}`;
                }
              }
              
              return {
                id: index.toString(),
                name: emp.employeeName,
                department: emp.department,
                profileImage: profileImage
              };
            });
            
            // Start carousel after birthdays are loaded
            console.log(`Loaded ${this.todaysBirthdays.length} birthdays`);
            this.startBirthdayCarousel();
          } else {
            this.todaysBirthdays = [];
          }
        }
      },
      error: (error: any) => {
        console.error('Error fetching birthdays:', error);
        this.todaysBirthdays = [];
      }
    });
  }

  // Start Birthday Carousel Auto-slide
  private startBirthdayCarousel(): void {
    console.log(`Starting birthday carousel with ${this.todaysBirthdays.length} birthdays`);
    if (this.todaysBirthdays.length > 1) {
      // Clear any existing interval
      if (this.birthdayInterval) {
        clearInterval(this.birthdayInterval);
      }
      
      this.birthdayInterval = setInterval(() => {
        this.nextBirthday();
        console.log(`Birthday carousel moved to index: ${this.currentBirthdayIndex}`);
      }, 4000); // Change slide every 4 seconds
    }
  }

  // Navigate to next birthday
  nextBirthday(): void {
    if (this.todaysBirthdays.length > 0) {
      this.currentBirthdayIndex = (this.currentBirthdayIndex + 1) % this.todaysBirthdays.length;
    }
  }

  // Navigate to specific birthday
  goToBirthday(index: number): void {
    this.currentBirthdayIndex = index;
    if (this.birthdayInterval) {
      clearInterval(this.birthdayInterval);
      this.startBirthdayCarousel();
    }
  }

}
