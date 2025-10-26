import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private sessionService: SessionService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    
    // Check if session is valid
    if (this.sessionService.validateSession()) {
      // Check if session is expired based on time
      if (this.sessionService.isSessionExpired()) {
        console.log('Session expired based on time - redirecting to login');
        this.sessionService.handleSessionExpiry();
        return false;
      }
      
      // Refresh session on successful validation
      this.sessionService.refreshSession();
      return true;
    }

    // Session is invalid - redirect to login
    console.log('Invalid session - redirecting to login');
    this.router.navigate(['/login'], {
      queryParams: { 
        sessionExpired: 'true',
        returnUrl: state.url 
      }
    });
    return false;
  }
}