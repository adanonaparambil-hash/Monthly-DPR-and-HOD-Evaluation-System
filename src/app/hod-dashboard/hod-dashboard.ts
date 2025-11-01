import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import { Chart, registerables } from 'chart.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Api } from '../services/api';

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

   EmployeeID = this.currentUser.empId || this.currentUser.employeeId

    constructor(private api: Api) {
    
    }
    

  ngOnInit() {
    this.initializeParticles();
    this.setupParallaxEffects();
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
      this.createSummaryChart();
      this.createPerformanceTrendChart();
      this.initializeGSAPAnimations();
      this.setupScrollTriggers();
    }, 100);
  }

  private initializeGSAPAnimations() {
    // Initial setup for elements
    gsap.set(['.gsap-stat-card', '.gsap-chart-card', '.gsap-evaluation'], { 
      y: 100, 
      opacity: 0, 
      scale: 0.9 
    });

    // Don't hide leaderboard items - let CSS handle the animation

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

    // Card glow effects
    gsap.to('.card-glow', {
      opacity: 0.4,
      scale: 1.05,
      duration: 3,
      ease: 'power2.inOut',
      repeat: -1,
      yoyo: true,
      stagger: 0.5
    });
  }

  private setupScrollTriggers() {
    // Stats cards animation
    gsap.to('.gsap-stat-card', {
      y: 0,
      opacity: 1,
      scale: 1,
      duration: 0.8,
      ease: 'back.out(1.7)',
      stagger: 0.15,
      scrollTrigger: {
        trigger: '.stats-grid',
        start: 'top 80%',
        end: 'bottom 20%',
        toggleActions: 'play none none reverse'
      }
    });

    // Leaderboard uses CSS animations instead of GSAP for better reliability

    // Charts animation
    gsap.to('.gsap-chart-card', {
      y: 0,
      opacity: 1,
      scale: 1,
      duration: 1.2,
      ease: 'elastic.out(1, 0.5)',
      stagger: 0.2,
      scrollTrigger: {
        trigger: '.charts-section',
        start: 'top 80%',
        end: 'bottom 20%',
        toggleActions: 'play none none reverse'
      }
    });

    // Evaluation table animation
    gsap.to('.gsap-evaluation', {
      y: 0,
      opacity: 1,
      scale: 1,
      duration: 0.6,
      ease: 'power2.out',
      stagger: 0.1,
      scrollTrigger: {
        trigger: '.evaluations-section',
        start: 'top 80%',
        end: 'bottom 20%',
        toggleActions: 'play none none reverse'
      }
    });

    // Parallax scrolling for background layers
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

    // Counter animations
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
        onUpdate: function() {
          const value = parseFloat(this.targets()[0].innerHTML);
          counter.innerHTML = Math.round(value).toString();
        }
      });
    });
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
                label: function(context) {
                  const label = context.label || '';
                  const value = context.parsed;
                  const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                  const percentage = Math.round((value / total) * 100);
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
              data: [80, 82, 84, 80, 86, 84],
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
              data: [82, 84, 80, 86, 84, 82],
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
              data: [84, 80, 82, 84, 88, 86],
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
              data: [78, 82, 76, 80, 82, 78],
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
              min: 20,
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




   loadHODDashBoard(): void {
    this.api.GetHODDashBoardDetails(this.EmployeeID).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
         console.log("loadHODDashBoard: " + JSON.stringify(response, null, 2));
        } else {
          console.warn('No HOD dashboard records found or API call failed');
        }
      },
      error: (error) => {
        console.error('Error fetching dashboard list:', error);
      }
    });
  }

}
