export class UrlCleanupUtil {
  private static readonly MAX_URL_LENGTH = 2000; // Safe limit for most servers
  private static readonly MAX_PARAM_LENGTH = 500; // Max length for individual parameters
  
  /**
   * Clean up URL parameters to prevent 431 errors
   */
  static cleanupCurrentUrl(): void {
    const url = new URL(window.location.href);
    
    if (url.href.length > this.MAX_URL_LENGTH) {
      this.truncateUrl(url);
    }
    
    this.removeUnnecessaryParams(url);
    this.truncateLongParams(url);
    
    // Update the URL if changes were made
    const newUrl = url.pathname + (url.search || '');
    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, '', newUrl);
    }
  }
  
  /**
   * Truncate URL to safe length
   */
  private static truncateUrl(url: URL): void {
    const params = Array.from(url.searchParams.entries());
    url.search = '';
    
    // Add parameters back until we reach the limit
    let currentLength = url.href.length;
    
    for (const [key, value] of params) {
      const paramString = `${key}=${encodeURIComponent(value)}`;
      if (currentLength + paramString.length + 1 < this.MAX_URL_LENGTH) {
        url.searchParams.set(key, value);
        currentLength += paramString.length + 1; // +1 for & or ?
      } else {
        break;
      }
    }
  }
  
  /**
   * Remove unnecessary parameters that might cause issues
   */
  private static removeUnnecessaryParams(url: URL): void {
    const unnecessaryParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', '_ga', '_gid', 'mc_cid', 'mc_eid',
      'debug', 'test', 'cache', 'timestamp', 'random'
    ];
    
    unnecessaryParams.forEach(param => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
      }
    });
  }
  
  /**
   * Truncate individual parameters that are too long
   */
  private static truncateLongParams(url: URL): void {
    const params = Array.from(url.searchParams.entries());
    
    params.forEach(([key, value]) => {
      if (value.length > this.MAX_PARAM_LENGTH) {
        // Truncate the value and add indicator
        const truncatedValue = value.substring(0, this.MAX_PARAM_LENGTH - 3) + '...';
        url.searchParams.set(key, truncatedValue);
      }
    });
  }
  
  /**
   * Get safe URL for API calls (removes sensitive or large parameters)
   */
  static getSafeUrl(originalUrl: string): string {
    try {
      const url = new URL(originalUrl);
      
      // Remove sensitive parameters
      const sensitiveParams = ['token', 'password', 'secret', 'key', 'auth'];
      sensitiveParams.forEach(param => {
        if (url.searchParams.has(param)) {
          url.searchParams.delete(param);
        }
      });
      
      this.truncateLongParams(url);
      
      return url.href;
    } catch (error) {
      console.error('Error processing URL:', error);
      return originalUrl;
    }
  }
  
  /**
   * Clean up navigation state to prevent memory leaks
   */
  static cleanupNavigationState(): void {
    try {
      // Limit history state size
      if (window.history.state && JSON.stringify(window.history.state).length > 10000) {
        window.history.replaceState({}, '', window.location.href);
      }
    } catch (error) {
      console.error('Error cleaning navigation state:', error);
    }
  }
}