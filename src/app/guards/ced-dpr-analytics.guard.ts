import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Restricts the CED DPR Analytics dashboard to CED users (isHOD === 'C') only. */
@Injectable({ providedIn: 'root' })
export class CedDprAnalyticsGuard implements CanActivate {

  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    const user = this.auth.getUser();
    const code = (user?.isHOD || user?.role || user?.userType || '').toString().toUpperCase();

    if (code === 'C') {
      return true;
    }

    this.router.navigate(['/dashboard']);
    return false;
  }
}
