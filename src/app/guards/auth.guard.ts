import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    
    // Check if user is logged in
    if (this.authService.isLoggedIn()) {
      // Update activity timestamp
      this.authService.updateActivity();
      return true;
    }

    // Not logged in - redirect to login
    console.log('Unauthorized access attempt - redirecting to login');
    this.authService.logout('unauthorized');
    return false;
  }
}