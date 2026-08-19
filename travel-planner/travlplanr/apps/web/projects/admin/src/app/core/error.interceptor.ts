/**
 * Error interceptor — central error normalization.
 * 401 → clear session, redirect to /login.
 * Maps errors to typed ApiError and rethrows.
 */
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export interface ApiError {
  status: number;
  message: string;
  correlationId?: string;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const isAuthRequest =
    req.url.includes('/auth/admin/login') ||
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/signup') ||
    req.url.includes('/auth/otp/');

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let apiError: ApiError;

      if (error.status === 401) {
        // Do not redirect or clear session on failed login — that reloads the login page.
        if (!isAuthRequest) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_staff');
          router.navigate(['/login']);
          apiError = { status: 401, message: 'Session expired. Please log in again.' };
        } else {
          apiError = {
            status: 401,
            message: error.error?.detail || 'Invalid email or password.',
          };
        }
      } else if (error.status === 403) {
        apiError = { status: 403, message: 'You do not have permission to perform this action.' };
      } else if (error.status === 404) {
        apiError = { status: 404, message: 'Resource not found.' };
      } else if (error.status === 409) {
        apiError = { status: 409, message: error.error?.detail || 'Conflict — resource already exists.' };
      } else if (error.status >= 500) {
        apiError = { status: error.status, message: "Couldn't load data. Please try again." };
      } else if (error.status === 0) {
        // Network error
        apiError = { status: 0, message: "Couldn't connect to the server." };
      } else {
        apiError = {
          status: error.status,
          message: error.error?.detail || error.message || 'An unexpected error occurred.',
        };
      }

      return throwError(() => apiError);
    })
  );
};
