/**
 * Auth interceptor — attaches Authorization: Bearer from AdminAuthService.
 * Skips auth endpoints; drops expired tokens via getToken().
 */
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AdminAuthService } from '../shared/services/admin-auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/admin/login') ||
    req.url.includes('/auth/otp/') ||
    req.url.includes('/auth/signup')
  ) {
    return next(req);
  }

  const token = inject(AdminAuthService).getToken();
  if (token) {
    return next(
      req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      }),
    );
  }

  return next(req);
};
