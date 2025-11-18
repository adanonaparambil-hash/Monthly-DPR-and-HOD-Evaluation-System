import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UrlUtil {
  
  /**
   * Gets the full application URL including protocol, domain, and base href
   * @returns Full base URL (e.g., https://adraklive.com/AdrakMPRUI)
   */
  getBaseUrl(): string {
    if (environment.production) {
      // Production: Use the production domain with base href
      return 'https://adraklive.com/AdrakMPRUI';
    } else {
      // Development: Use localhost
      return 'http://localhost:4200';
    }
  }

  /**
   * Gets the current full URL
   * @returns Current full URL
   */
  getCurrentFullUrl(): string {
    return window.location.href;
  }

  /**
   * Generates a full URL for a given route path
   * @param routePath - The route path (e.g., 'monthly-dpr/143')
   * @returns Full URL (e.g., https://adraklive.com/AdrakMPRUI/monthly-dpr/143)
   */
  getFullUrl(routePath: string): string {
    const baseUrl = this.getBaseUrl();
    // Remove leading slash if present
    const cleanPath = routePath.startsWith('/') ? routePath.substring(1) : routePath;
    return `${baseUrl}/${cleanPath}`;
  }

  /**
   * Gets the full URL for the current route
   * @returns Full URL for current route
   */
  getCurrentRouteFullUrl(): string {
    const baseUrl = this.getBaseUrl();
    const currentPath = window.location.pathname;
    
    if (environment.production) {
      // In production, remove the base href from the path if it exists
      const baseHref = '/AdrakMPRUI';
      const cleanPath = currentPath.startsWith(baseHref) 
        ? currentPath.substring(baseHref.length) 
        : currentPath;
      return `${baseUrl}${cleanPath}`;
    } else {
      // In development, use the path as is
      return `${baseUrl}${currentPath}`;
    }
  }

  /**
   * Generates a full URL for monthly DPR with ID
   * @param dprId - The DPR ID
   * @returns Full URL (e.g., https://adraklive.com/AdrakMPRUI/monthly-dpr/143)
   */
  getMonthlyDprUrl(dprId: number | string): string {
    return this.getFullUrl(`monthly-dpr/${dprId}`);
  }

  /**
   * Generates a full URL for past reports with optional DPR ID
   * @param dprId - Optional DPR ID
   * @returns Full URL
   */
  getPastReportsUrl(dprId?: number | string): string {
    if (dprId) {
      return this.getFullUrl(`past-reports?dprid=${dprId}`);
    }
    return this.getFullUrl('past-reports');
  }

  /**
   * Generates a full URL for employee dashboard
   * @returns Full URL
   */
  getEmployeeDashboardUrl(): string {
    return this.getFullUrl('employee-dashboard');
  }

  /**
   * Generates a full URL for HOD dashboard
   * @returns Full URL
   */
  getHodDashboardUrl(): string {
    return this.getFullUrl('hod-dashboard');
  }

  /**
   * Generates a full URL for CED dashboard
   * @returns Full URL
   */
  getCedDashboardUrl(): string {
    return this.getFullUrl('ced-dashboard');
  }

  /**
   * Extracts the relative path from a full URL
   * @param fullUrl - The full URL
   * @returns Relative path
   */
  getRelativePath(fullUrl: string): string {
    try {
      const url = new URL(fullUrl);
      let path = url.pathname;
      
      if (environment.production) {
        // Remove base href from path
        const baseHref = '/AdrakMPRUI';
        if (path.startsWith(baseHref)) {
          path = path.substring(baseHref.length);
        }
      }
      
      // Remove leading slash
      return path.startsWith('/') ? path.substring(1) : path;
    } catch (error) {
      console.error('Error parsing URL:', error);
      return fullUrl;
    }
  }
}
