/**
 * Auth guard — deny-by-default for protected admin routes.
 * Validates token presence and client-side JWT expiry.
 */
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AdminAuthService } from '../shared/services/admin-auth.service';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AdminAuthService);

  if (auth.hasValidSession()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
