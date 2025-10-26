import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Add authorization header if token exists
    const token = localStorage.getItem('access_token');
    let authReq = req;
    
    if (token) {
      authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Handle session expiry (401 Unauthorized)
        if (error.status === 401) {
          console.log('Session expired - redirecting to login');
          this.handleSessionExpiry();
        }
        
        // Handle other authentication/authorization errors
        if (error.status === 403) {
          console.log('Access forbidden - insufficient permissions');
        }

        return throwError(() => error);
      })
    );
  }

  private handleSessionExpiry(): void {
    // Clear all session data
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_user');
    localStorage.clear();
    sessionStorage.clear();

    // Redirect to login page
    this.router.navigate(['/login'], { 
      queryParams: { 
        sessionExpired: 'true',
        returnUrl: this.router.url 
      } 
    });
  }
}