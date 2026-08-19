import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { catchError, switchMap } from 'rxjs/operators';
import { throwError, from } from 'rxjs';
import { apiUrl } from './utils/api-url';

const CURRENCY_STORAGE_KEY = 'travlplanr_currency';
const SUPPORTED = new Set(['USD', 'EUR', 'INR']);

/** Read display currency without injecting LocaleService (avoids HttpClient ↔ Auth DI cycle). */
function readRequestCurrency(): string {
  try {
    if (typeof localStorage === 'undefined') return 'USD';
    const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored && SUPPORTED.has(stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'USD';
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  // Do not intercept refresh requests themselves
  if (req.url.includes('/auth/refresh')) {
    return next(req);
  }

  // Static assets (i18n JSON) should not carry auth headers or trigger login redirects.
  if (req.url.includes('/assets/')) {
    return next(req);
  }

  authService.clearStaleSession();
  const token = authService.token;
  const currency = readRequestCurrency();

  let headers = req.headers.set('X-Currency', currency);
  if (token) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }
  const newReq = req.clone({ headers });

  return next(newReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Let the chat widget handle its own auth errors — avoid redirecting mid-conversation.
      const isChatRequest = req.url.includes(apiUrl('/chat'));
      if (error.status === 401 && !isChatRequest) {
        return from(authService.refreshToken()).pipe(
          switchMap((success) => {
            if (success) {
              const newToken = authService.token;
              const retriedReq = newReq.clone({
                headers: newReq.headers.set('Authorization', `Bearer ${newToken}`),
              });
              return next(retriedReq);
            }
            authService.logout();
            router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
            return throwError(() => error);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
