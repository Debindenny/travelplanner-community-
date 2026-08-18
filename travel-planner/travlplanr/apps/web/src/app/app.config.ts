import { ApplicationConfig, APP_INITIALIZER, ErrorHandler, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withViewTransitions, withPreloading, NoPreloading } from '@angular/router';
import { provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './shared/auth.interceptor';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { firstValueFrom } from 'rxjs';

import * as Sentry from '@sentry/angular';

/** Bump when translation JSON changes so clients reload locale files. */
export const I18N_VERSION = '10';

export function initTranslations(translate: TranslateService) {
  return () => {
    const lang =
      typeof localStorage !== 'undefined'
        ? (localStorage.getItem('travlplanr_lang') as string) || 'en'
        : 'en';
    const supported = ['en', 'es', 'fr'].includes(lang) ? lang : 'en';

    return firstValueFrom(translate.use(supported))
      .then(() => {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('travlplanr_i18n_version', I18N_VERSION);
        }
      })
      .catch(() => firstValueFrom(translate.use('en')));
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler({
        showDialog: false,
      }),
    },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withPreloading(NoPreloading),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
      withViewTransitions(),
    ),
    provideHttpClient(withInterceptors([authInterceptor]), withInterceptorsFromDi()),
    provideTranslateService({
      fallbackLang: 'en',
    }),
    provideTranslateHttpLoader({
      prefix: '/assets/i18n/',
      suffix: `.json?v=${I18N_VERSION}`
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: initTranslations,
      deps: [TranslateService],
      multi: true,
    },
  ],
};
