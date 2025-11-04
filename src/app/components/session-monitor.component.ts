import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { Subscription, interval } from 'rxjs';

@Component({
    selector: 'app-session-monitor',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div *ngIf="showWarning" class="session-warning">
      <div class="warning-content">
        <i class="fas fa-exclamation-triangle"></i>
        <span>Your session will expire in {{ formatTime(remainingTime) }}. Click to extend.</span>
        <button (click)="extendSession()" class="extend-btn">Extend Session</button>
        <button (click)="dismissWarning()" class="dismiss-btn">×</button>
      </div>
    </div>
  `,
    styles: [`
    .session-warning {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      background: linear-gradient(135deg, #ff6b35, #f7931e);
      color: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      animation: slideIn 0.3s ease-out;
      max-width: 400px;
      font-family: 'Roboto', sans-serif !important;
    }

    .warning-content {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
    }

    .extend-btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.3s ease;
    }

    .extend-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .dismiss-btn {
      background: none;
      border: none;
      color: white;
      font-size: 1.2rem;
      cursor: pointer;
      padding: 0;
      margin-left: auto;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @media (max-width: 768px) {
      .session-warning {
        top: 10px;
        right: 10px;
        left: 10px;
        max-width: none;
      }
    }
  `]
})
export class SessionMonitorComponent implements OnInit, OnDestroy {
    showWarning = false;
    remainingTime = 0;
    private subscription = new Subscription();
    private readonly WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    constructor(
        private authService: AuthService,
        private toastr: ToastrService
    ) { }

    ngOnInit(): void {
        // Monitor session every 30 seconds
        this.subscription.add(
            interval(30000).subscribe(() => {
                this.checkSession();
            })
        );

        // Initial check
        this.checkSession();
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
    }

    private checkSession(): void {
        if (!this.authService.isLoggedIn()) {
            this.showWarning = false;
            return;
        }

        this.remainingTime = this.authService.getRemainingTime();

        // Show warning if session is about to expire
        if (this.remainingTime <= this.WARNING_THRESHOLD && this.remainingTime > 0) {
            this.showWarning = true;
        } else {
            this.showWarning = false;
        }
    }

    extendSession(): void {
        // Update activity to extend session
        this.authService.updateActivity();
        this.showWarning = false;
        this.toastr.success('Session extended successfully', 'Session Extended');
    }

    dismissWarning(): void {
        this.showWarning = false;
    }

    formatTime(milliseconds: number): string {
        const minutes = Math.floor(milliseconds / 60000);
        const seconds = Math.floor((milliseconds % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}