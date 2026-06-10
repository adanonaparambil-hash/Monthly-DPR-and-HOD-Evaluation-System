import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LogAnalyticsGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): Observable<boolean> {
    const session = JSON.parse(localStorage.getItem('current_user') || '{}');
    const userId = session?.userId ?? session?.id ?? session?.empId;

    // Debug logging
    console.log('LogAnalyticsGuard - Access Check:', {
      userId,
      sessionKeys: Object.keys(session),
      hasAccess: userId === 'ITS41'
    });

    // Only allow access for user 'ITS41'
    if (userId === 'ITS41') {
      console.log('LogAnalyticsGuard: Access granted for ITS41');
      return of(true);
    }

    // For all other users, redirect to their appropriate dashboard
    console.log('LogAnalyticsGuard: Access denied for user:', userId);
    this.router.navigate(['/employee-dashboard']);
    return of(false);
  }
}