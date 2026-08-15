import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Api } from '../services/api';

/** Allows /wir-reports only for users whose menu list contains the
 *  app-wir-report entry (same pattern as PurchaseDashboardGuard). */
@Injectable({ providedIn: 'root' })
export class WirReportGuard implements CanActivate {

  constructor(private router: Router, private api: Api) {}

  canActivate(): Observable<boolean> {
    const session = JSON.parse(localStorage.getItem('current_user') || '{}');
    const userId = session?.userId ?? session?.id ?? session?.empId;

    if (!userId) {
      this.router.navigate(['/employee-dashboard']);
      return of(false);
    }

    return this.api.getUserMenus(userId).pipe(
      map((res: any) => {
        const menus: any[] = Array.isArray(res) ? res : (res?.data ?? []);
        const hasAccess = menus.some((m: any) =>
          (m.menuUrl ?? '').toLowerCase().includes('wir-report') &&
          (m.canView ?? 'Y') === 'Y' &&
          (m.isActive ?? 'Y') === 'Y'
        );
        if (!hasAccess) {
          this.router.navigate(['/employee-dashboard']);
        }
        return hasAccess;
      }),
      catchError(() => {
        // On API error, deny access (secure by default)
        this.router.navigate(['/employee-dashboard']);
        return of(false);
      })
    );
  }
}
