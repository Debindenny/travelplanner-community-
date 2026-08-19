import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  // Not logged in: send to the email+OTP login, remembering where the user was
  // headed so we return them there automatically after verification (e.g. an
  // itinerary deep-link loads straight away once they've signed in).
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
