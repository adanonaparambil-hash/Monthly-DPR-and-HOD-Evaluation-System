import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import { Chart, registerables } from 'chart.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Api } from '../services/api';
import { EmployeeDashboardData } from '../models/dashBoard.model';

Chart.register(...registerables);
gsap.registerPlugin(ScrollTrigger);

interface Particle {
  x: number;
  y: number;
  delay: number;
}

@Component({
  selector: 'app-employee-dashboard',
  imports: [CommonModule],
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
export class EmployeeDashboard implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('hoursChart') hoursChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('performanceChart') performanceChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('skillsChart') skillsChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('taskStatusChart') taskStatusChart!: ElementRef<HTMLCanvasElement>;

  // GSAP ViewChild references
  @ViewChild('statsGrid') statsGrid!: ElementRef;
  @ViewChild('chartsGrid') chartsGrid!: ElementRef;
  @ViewChild('bottomChartsGrid') bottomChartsGrid!: ElementRef;
  @ViewChild('statCard1') statCard1!: ElementRef;
  @ViewChild('statCard2') statCard2!: ElementRef;
  @ViewChild('statCard3') statCard3!: ElementRef;
  @ViewChild('statCard4') statCard4!: ElementRef;
  @ViewChild('chartCard1') chartCard1!: ElementRef;
  @ViewChild('chartCard2') chartCard2!: ElementRef;
  @ViewChild('chartCard3') chartCard3!: ElementRef;
  @ViewChild('chartCard4') chartCard4!: ElementRef;

  currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
  EmployeeID = this.currentUser.empId || this.currentUser.employeeId;

  // Dashboard data
  dashboardData: EmployeeDashboardData = {};

  // Make Math available in template
  Math = Math;

  constructor(private api: Api) {
  }

  animationState = 'in';
  particles: Particle[] = [];
  mouseX: number = 0;
  mouseY: number = 0;

  ngOnInit() {
    this.initializeParticles();
    this.setupParallaxEffects();

    this.loadEmployeeDashBoard();

  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.createHoursChart();
      this.createPerformanceChart();
      this.createSkillsChart();
      this.createTaskStatusChart();
      this.initializeGSAPAnimations();
      this.setupScrollTriggers();
    }, 100);
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
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        delay: Math.random() * 5
      });
    }
  }

  private setupParallaxEffects() {
    // Continuous parallax animation
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

  private initializeGSAPAnimations() {
    // Initial page load animations
    gsap.set(['.gsap-card', '.gsap-chart'], {
      y: 100,
      opacity: 0,
      scale: 0.8
    });

    // Floating shapes animation
    gsap.to('.floating-shape', {
      y: '+=20',
      rotation: '+=360',
      duration: 10,
      ease: 'none',
      repeat: -1,
      yoyo: true,
      stagger: 0.5
    });

    // Particles animation
    gsap.to('.particle', {
      y: '-=100vh',
      opacity: 0,
      duration: 15,
      ease: 'none',
      repeat: -1,
      stagger: 0.2
    });

    // Card glow animation
    gsap.to('.card-glow, .chart-glow', {
      opacity: 0.3,
      scale: 1.1,
      duration: 2,
      ease: 'power2.inOut',
      repeat: -1,
      yoyo: true,
      stagger: 0.3
    });
  }

  private setupScrollTriggers() {
    // Stats cards animation
    gsap.to('.gsap-card', {
      y: 0,
      opacity: 1,
      scale: 1,
      duration: 0.8,
      ease: 'back.out(1.7)',
      stagger: 0.1,
      scrollTrigger: {
        trigger: this.statsGrid.nativeElement,
        start: 'top 80%',
        end: 'bottom 20%',
        toggleActions: 'play none none reverse'
      }
    });

    // Counter animation for stat numbers
    this.animateCounters();

    // Charts animation
    gsap.to('.gsap-chart', {
      y: 0,
      opacity: 1,
      scale: 1,
      duration: 1,
      ease: 'power3.out',
      stagger: 0.2,
      scrollTrigger: {
        trigger: this.chartsGrid.nativeElement,
        start: 'top 80%',
        end: 'bottom 20%',
        toggleActions: 'play none none reverse'
      }
    });

    // Bottom charts animation
    gsap.to(this.bottomChartsGrid.nativeElement.children, {
      y: 0,
      opacity: 1,
      scale: 1,
      duration: 1,
      ease: 'elastic.out(1, 0.5)',
      stagger: 0.15,
      scrollTrigger: {
        trigger: this.bottomChartsGrid.nativeElement,
        start: 'top 80%',
        end: 'bottom 20%',
        toggleActions: 'play none none reverse'
      }
    });

    // Parallax scrolling for background layers
    gsap.to('.bg-layer-1', {
      yPercent: -50,
      ease: 'none',
      scrollTrigger: {
        trigger: '.dashboard-container',
        start: 'top bottom',
        end: 'bottom top',
        scrub: true
      }
    });

    gsap.to('.bg-layer-2', {
      yPercent: -30,
      ease: 'none',
      scrollTrigger: {
        trigger: '.dashboard-container',
        start: 'top bottom',
        end: 'bottom top',
        scrub: true
      }
    });

    gsap.to('.bg-layer-3', {
      yPercent: -20,
      ease: 'none',
      scrollTrigger: {
        trigger: '.dashboard-container',
        start: 'top bottom',
        end: 'bottom top',
        scrub: true
      }
    });
  }

  private animateCounters() {
    const counters = document.querySelectorAll('.counter');

    counters.forEach((counter) => {
      const target = parseFloat(counter.getAttribute('data-target') || '0');

      gsap.to(counter, {
        innerHTML: target,
        duration: 2,
        ease: 'power2.out',
        snap: { innerHTML: target < 10 ? 0.1 : 1 },
        scrollTrigger: {
          trigger: counter,
          start: 'top 80%',
          toggleActions: 'play none none reverse'
        },
        onUpdate: function () {
          const value = parseFloat(this.targets()[0].innerHTML);
          if (target < 10) {
            counter.innerHTML = value.toFixed(1);
          } else {
            counter.innerHTML = Math.round(value).toString();
          }
        }
      });
    });
  }



  private createHoursChart() {
    const ctx = this.hoursChart.nativeElement.getContext('2d');
    if (ctx) {
      // Clear existing chart
      Chart.getChart(ctx)?.destroy();

      // Prepare data from API response
      const hoursData = this.dashboardData.hoursLoggedEstimateGraphs || [];
      const labels: string[] = [];
      const estimatedData: number[] = [];
      const actualData: number[] = [];

      if (hoursData.length > 0) {
        hoursData.forEach(item => {
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthLabel = item.month ? monthNames[item.month - 1] : 'Unknown';
          const yearLabel = item.year || new Date().getFullYear();
          labels.push(`${monthLabel} ${yearLabel}`);
          estimatedData.push(item.estimatedHours || 0);
          actualData.push(item.actualHours || 0);
        });
      }
      // If no data, show empty chart (no fallback values)

      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Estimated',
              data: estimatedData,
              backgroundColor: 'rgba(204, 153, 51, 0.3)',
              borderColor: 'rgba(204, 153, 51, 1)',
              borderWidth: 1
            },
            {
              label: 'Actual',
              data: actualData,
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
              display: true,
              position: 'top'
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
      // Clear existing chart
      Chart.getChart(ctx)?.destroy();

      // Prepare data from API response
      const performanceData = this.dashboardData.monthlyPerformanceTrend || [];
      const labels: string[] = [];
      const performanceScores: number[] = [];

      if (performanceData.length > 0) {
        performanceData.forEach(item => {
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthLabel = item.performanceMonth ? monthNames[item.performanceMonth - 1] : 'Unknown';
          const yearLabel = item.performanceYear || new Date().getFullYear();
          labels.push(`${monthLabel} ${yearLabel}`);
          performanceScores.push(item.performanceScore || 0);
        });
      } else {
        // Fallback data if no API data
        const currentDate = new Date();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonth = monthNames[currentDate.getMonth()];
        const currentYear = currentDate.getFullYear();
        labels.push(`${currentMonth} ${currentYear}`);
        performanceScores.push(this.dashboardData.productivityScore || 0);
      }

      new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Performance',
            data: performanceScores,
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
      // Clear existing chart
      Chart.getChart(ctx)?.destroy();

      // Use actual scores from API (0-100 scale) - no fallback values
      const skillsData = [
        this.dashboardData.qualityScore || 0,
        this.dashboardData.timelinessScore || 0,
        this.dashboardData.initiativeScore || 0,
        this.dashboardData.communicationScore || 0,
        this.dashboardData.teamWorkScore || 0,
        this.dashboardData.problemSolvingScore || 0
      ];

      new Chart(ctx, {
        type: 'radar',
        data: {
          labels: ['Quality', 'Timeliness', 'Initiative', 'Communication', 'Teamwork', 'Problem Solving'],
          datasets: [{
            label: 'Skills (out of 100)',
            data: skillsData,
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
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  return context.dataset.label + ': ' + context.parsed.r + '/100';
                }
              }
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
              },
              ticks: {
                stepSize: 20,
                callback: function (value) {
                  return value + '';
                }
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
      // Clear existing chart
      Chart.getChart(ctx)?.destroy();

      // Use actual task counts from API - no fallback values
      const completed = this.dashboardData.taskCompleted || 0;
      const inProgress = this.dashboardData.progressTasks || 0;
      const pending = this.dashboardData.pendingTasks || 0;

      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Completed', 'In Progress', 'Pending'],
          datasets: [{
            data: [completed, inProgress, pending],
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
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const label = context.label || '';
                  const value = context.parsed;
                  const dataset = context.dataset.data as number[];
                  const total = dataset.reduce((sum, val) => sum + val, 0);
                  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                  return `${label}: ${value} tasks (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
  }


  loadEmployeeDashBoard(): void {
    this.api.GetEmployeeDashBoardDetails(this.EmployeeID).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          console.log("loadEmployeeDashBoard: " + JSON.stringify(response, null, 2));
          this.dashboardData = response.data;

          // Update charts with new data after a short delay to ensure DOM is ready
          setTimeout(() => {
            this.updateChartsWithData();
          }, 200);
        } else {
          console.warn('No dashboard records found or API call failed');
        }
      },
      error: (error) => {
        console.error('Error fetching dashboard list:', error);
      }
    });
  }

  private updateChartsWithData(): void {
    // Recreate charts with actual data
    this.createHoursChart();
    this.createPerformanceChart();
    this.createSkillsChart();
    this.createTaskStatusChart();
  }

  getTaskPercentage(type: 'completed' | 'progress' | 'pending'): number {
    const completed = this.dashboardData.taskCompleted || 0;
    const inProgress = this.dashboardData.progressTasks || 0;
    const pending = this.dashboardData.pendingTasks || 0;

    const total = completed + inProgress + pending;
    if (total === 0) return 0;

    switch (type) {
      case 'completed':
        return Math.round((completed / total) * 100);
      case 'progress':
        return Math.round((inProgress / total) * 100);
      case 'pending':
        return Math.round((pending / total) * 100);
      default:
        return 0;
    }
  }

  getPercentageValue(percentage: number | null | undefined): number {
    // If null or undefined, return 0, otherwise return the actual value
    return percentage ?? 0;
  }

}
