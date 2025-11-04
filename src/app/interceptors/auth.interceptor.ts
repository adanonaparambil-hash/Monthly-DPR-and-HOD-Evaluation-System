import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private authService: AuthService,
    private toastr: ToastrService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Update user activity on each request
    this.authService.updateActivity();
    
    // Clean up URL parameters to prevent 431 errors
    this.authService.cleanupUrlParameters();

    // Get token from auth service
    const token = this.authService.getToken();
    let authReq = req;
    
    // Add authorization header if token exists
    if (token) {
      authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
    }

    // Optimize headers to prevent 431 errors
    authReq = this.optimizeHeaders(authReq);

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        this.handleHttpError(error);
        return throwError(() => error);
      }),
      finalize(() => {
        // Clean up any temporary data after request
        this.cleanupAfterRequest();
      })
    );
  }

  private optimizeHeaders(req: HttpRequest<any>): HttpRequest<any> {
    // Remove unnecessary headers that might cause 431 errors
    let headers = req.headers;
    
    // Remove large or unnecessary headers
    const headersToRemove = [
      'X-Requested-With',
      'Cache-Control',
      'Pragma'
    ];

    headersToRemove.forEach(header => {
      if (headers.has(header)) {
        headers = headers.delete(header);
      }
    });

    // Ensure Content-Type is set appropriately
    if (!headers.has('Content-Type') && req.body) {
      headers = headers.set('Content-Type', 'application/json');
    }

    return req.clone({ headers });
  }

  private handleHttpError(error: HttpErrorResponse): void {
    console.error('HTTP Error:', error.status, error.message);

    switch (error.status) {
      case 401:
        console.log('Unauthorized - Session expired');
        this.authService.logout('unauthorized');
        break;

      case 403:
        console.log('Forbidden - Access denied');
        this.toastr.error('You do not have permission to access this resource', 'Access Denied');
        break;

      case 431:
        console.log('Request Header Fields Too Large - Cleaning up session');
        this.handle431Error();
        break;

      case 500:
        this.toastr.error('Server error occurred. Please try again later.', 'Server Error');
        break;

      case 503:
        this.toastr.error('Service temporarily unavailable. Please try again later.', 'Service Unavailable');
        break;

      case 0:
        // Network error
        this.toastr.error('Network connection error. Please check your internet connection.', 'Connection Error');
        break;

      default:
        if (error.status >= 400 && error.status < 500) {
          this.toastr.error('Client error occurred. Please try again.', 'Error');
        }
    }
  }

  private handle431Error(): void {
    console.log('Handling 431 error - Request headers too large');
    
    // Clear all storage to reduce header size
    this.clearAllStorage();
    
    // Clean up URL parameters
    this.authService.cleanupUrlParameters();
    
    // Show user-friendly message
    this.toastr.warning(
      'Session data has been cleared due to size limits. Please login again.',
      'Session Reset Required'
    );
    
    // Force logout and redirect
    this.authService.logout('session_expired');
  }

  private clearAllStorage(): void {
    try {
      // Clear localStorage
      const localStorageKeys = Object.keys(localStorage);
      localStorageKeys.forEach(key => {
        // Keep only essential keys
        if (!['theme', 'language', 'user_preferences'].includes(key)) {
          localStorage.removeItem(key);
        }
      });

      // Clear sessionStorage completely
      sessionStorage.clear();

      // Clear any cookies that might be too large
      this.clearLargeCookies();

      console.log('Storage cleared to resolve 431 error');
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  private clearLargeCookies(): void {
    try {
      // Get all cookies
      const cookies = document.cookie.split(';');
      
      cookies.forEach(cookie => {
        const [name] = cookie.split('=');
        const cookieName = name.trim();
        
        // Clear cookies that might be large (except essential ones)
        if (!['XSRF-TOKEN', 'session-id'].includes(cookieName)) {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      });
    } catch (error) {
      console.error('Error clearing cookies:', error);
    }
  }

  private cleanupAfterRequest(): void {
    // Perform any cleanup after each request to prevent accumulation
    // This helps prevent 431 errors from building up over time
    
    // Clean up any temporary variables or cached data
    if (typeof window !== 'undefined') {
      // Clear any temporary DOM elements or event listeners
      const tempElements = document.querySelectorAll('[data-temp="true"]');
      tempElements.forEach(el => el.remove());
    }
  }
}