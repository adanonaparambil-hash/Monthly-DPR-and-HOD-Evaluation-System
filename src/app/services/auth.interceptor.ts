import { HttpInterceptorFn } from '@angular/common/http';

function getTokenFromStorage(): string | null {
  try {
    return localStorage.getItem('access_token');
  } catch {
    return null;
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = getTokenFromStorage();
  if (token) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(authReq);
  }
  return next(req);
};


