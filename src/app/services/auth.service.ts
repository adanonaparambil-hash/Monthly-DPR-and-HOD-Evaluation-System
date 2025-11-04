import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

export interface UserSession {
  token: string;
  user: any;
  loginTime: number;
  lastActivity: number;
  expiresAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly SESSION_KEY = 'user_session';
  private readonly SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
  private readonly ACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity
  
  private sessionSubject = new BehaviorSubject<UserSession | null>(null);
  public session$ = this.sessionSubject.asObservable();
  
  private activityTimer: any;
  private sessionTimer: any;

  constructor(
    private router: Router,
    private toastr: ToastrService
  ) {
    this.initializeSession();
    this.startActivityMonitoring();
  }

  private initializeSession(): void {
    const sessionData = this.getStoredSession();
    if (sessionData && this.isSessionValid(sessionData)) {
      this.sessionSubject.next(sessionData);
      this.startSessionTimer(sessionData.expiresAt - Date.now());
    } else {
      this.clearSession();
    }
  }

  private getStoredSession(): UserSession | null {
    try {
      const sessionStr = localStorage.getItem(this.SESSION_KEY);
      return sessionStr ? JSON.parse(sessionStr) : null;
    } catch (error) {
      console.error('Error parsing stored session:', error);
      return null;
    }
  }

  private isSessionValid(session: UserSession): boolean {
    const now = Date.now();
    return session.expiresAt > now && (now - session.lastActivity) < this.ACTIVITY_TIMEOUT;
  }

  public login(token: string, userData: any): void {
    const now = Date.now();
    const session: UserSession = {
      token,
      user: userData,
      loginTime: now,
      lastActivity: now,
      expiresAt: now + this.SESSION_TIMEOUT
    };

    this.storeSession(session);
    this.sessionSubject.next(session);
    this.startSessionTimer(this.SESSION_TIMEOUT);
    
    console.log('User logged in successfully');
  }

  private storeSession(session: UserSession): void {
    try {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      // Also store minimal data for backward compatibility
      localStorage.setItem('access_token', session.token);
      localStorage.setItem('current_user', JSON.stringify(session.user));
    } catch (error) {
      console.error('Error storing session:', error);
      this.toastr.error('Unable to store session data');
    }
  }

  public updateActivity(): void {
    const session = this.sessionSubject.value;
    if (session) {
      session.lastActivity = Date.now();
      this.storeSession(session);
      this.sessionSubject.next(session);
    }
  }

  public getToken(): string | null {
    const session = this.sessionSubject.value;
    return session?.token || null;
  }

  public getUser(): any {
    const session = this.sessionSubject.value;
    return session?.user || null;
  }

  public isLoggedIn(): boolean {
    const session = this.sessionSubject.value;
    return session !== null && this.isSessionValid(session);
  }

  public logout(reason: string = 'manual'): void {
    this.clearSession();
    this.clearTimers();
    
    let message = 'You have been logged out successfully';
    let redirectParams: any = {};

    switch (reason) {
      case 'session_expired':
        message = 'Your session has expired. Please login again.';
        redirectParams = { sessionExpired: 'true' };
        this.toastr.warning(message, 'Session Expired');
        break;
      case 'inactivity':
        message = 'You have been logged out due to inactivity.';
        redirectParams = { inactivity: 'true' };
        this.toastr.info(message, 'Logged Out');
        break;
      case 'unauthorized':
        message = 'Access denied. Please login again.';
        redirectParams = { unauthorized: 'true' };
        this.toastr.error(message, 'Access Denied');
        break;
      default:
        this.toastr.success(message, 'Logged Out');
    }

    this.router.navigate(['/login'], { queryParams: redirectParams });
  }

  private clearSession(): void {
    // Clear all session data
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_user');
    
    // Clear any other potential session data
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('session_') || key.startsWith('user_') || key.startsWith('auth_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear session storage as well
    sessionStorage.clear();
    
    this.sessionSubject.next(null);
  }

  private startActivityMonitoring(): void {
    // Monitor user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const activityHandler = () => {
      this.updateActivity();
      this.resetActivityTimer();
    };

    events.forEach(event => {
      document.addEventListener(event, activityHandler, true);
    });

    this.resetActivityTimer();
  }

  private resetActivityTimer(): void {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
    }

    this.activityTimer = setTimeout(() => {
      if (this.isLoggedIn()) {
        this.logout('inactivity');
      }
    }, this.ACTIVITY_TIMEOUT);
  }

  private startSessionTimer(duration: number): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }

    this.sessionTimer = setTimeout(() => {
      if (this.isLoggedIn()) {
        this.logout('session_expired');
      }
    }, duration);
  }

  private clearTimers(): void {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  public getRemainingTime(): number {
    const session = this.sessionSubject.value;
    if (!session) return 0;
    return Math.max(0, session.expiresAt - Date.now());
  }

  public getInactivityTime(): number {
    const session = this.sessionSubject.value;
    if (!session) return 0;
    return Date.now() - session.lastActivity;
  }

  // Clean up URL parameters to prevent 431 errors
  public cleanupUrlParameters(): void {
    const url = new URL(window.location.href);
    const allowedParams = ['returnUrl', 'sessionExpired', 'inactivity', 'unauthorized'];
    
    // Remove all parameters except allowed ones
    const paramsToKeep = new URLSearchParams();
    allowedParams.forEach(param => {
      if (url.searchParams.has(param)) {
        paramsToKeep.set(param, url.searchParams.get(param)!);
      }
    });

    // Update URL if parameters were removed
    if (url.searchParams.toString() !== paramsToKeep.toString()) {
      const newUrl = `${url.pathname}${paramsToKeep.toString() ? '?' + paramsToKeep.toString() : ''}`;
      window.history.replaceState({}, '', newUrl);
    }
  }
}