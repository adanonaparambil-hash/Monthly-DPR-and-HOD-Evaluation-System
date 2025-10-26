import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private sessionValidSubject = new BehaviorSubject<boolean>(this.hasValidSession());
  public sessionValid$ = this.sessionValidSubject.asObservable();

  constructor(private router: Router) {
    // Check session validity on service initialization
    this.validateSession();
  }

  // Check if user has a valid session
  hasValidSession(): boolean {
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('current_user');
    
    if (!token || !user) {
      return false;
    }

    try {
      // Parse user data to ensure it's valid JSON
      JSON.parse(user);
      return true;
    } catch (error) {
      console.error('Invalid user data in localStorage:', error);
      return false;
    }
  }

  // Validate current session
  validateSession(): boolean {
    const isValid = this.hasValidSession();
    this.sessionValidSubject.next(isValid);
    
    if (!isValid) {
      this.handleSessionExpiry();
    }
    
    return isValid;
  }

  // Handle session expiry
  handleSessionExpiry(): void {
    console.log('Session expired or invalid - redirecting to login');
    
    // Clear all session data
    this.clearSession();
    
    // Update session state
    this.sessionValidSubject.next(false);
    
    // Redirect to login with current URL as return URL
    const currentUrl = this.router.url;
    this.router.navigate(['/login'], { 
      queryParams: { 
        sessionExpired: 'true',
        returnUrl: currentUrl !== '/login' ? currentUrl : '/'
      } 
    });
  }

  // Clear all session data
  clearSession(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_user');
    localStorage.clear();
    sessionStorage.clear();
  }

  // Get current user from session
  getCurrentUser(): any {
    try {
      const user = localStorage.getItem('current_user');
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error('Error parsing current user:', error);
      return null;
    }
  }

  // Set session data
  setSession(token: string, user: any): void {
    localStorage.setItem('access_token', token);
    localStorage.setItem('current_user', JSON.stringify(user));
    this.sessionValidSubject.next(true);
  }

  // Check if session is expired based on timestamp (if available)
  isSessionExpired(): boolean {
    const user = this.getCurrentUser();
    if (!user || !user.loginTime) {
      return true;
    }

    // Check if session is older than 8 hours (configurable)
    const sessionDuration = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
    const loginTime = new Date(user.loginTime).getTime();
    const currentTime = new Date().getTime();
    
    return (currentTime - loginTime) > sessionDuration;
  }

  // Refresh session (extend session time)
  refreshSession(): void {
    const user = this.getCurrentUser();
    if (user) {
      user.loginTime = new Date().toISOString();
      localStorage.setItem('current_user', JSON.stringify(user));
    }
  }
}