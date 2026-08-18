import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import * as Sentry from '@sentry/angular';

import { environment } from './environments/environment';

if (environment.production && environment.sentry?.dsn && !environment.sentry.dsn.includes("examplePublicKey")) {
  Sentry.init({
    dsn: environment.sentry.dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: environment.sentry.tracesSampleRate,
    replaysSessionSampleRate: environment.sentry.replaysSessionSampleRate,
    replaysOnErrorSampleRate: environment.sentry.replaysOnErrorSampleRate,
  });
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
