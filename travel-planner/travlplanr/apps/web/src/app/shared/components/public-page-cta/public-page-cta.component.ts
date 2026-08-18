import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PrimaryButtonComponent } from 'ui';

/**
 * Shared closing CTA for footer-linked public pages (About, How It Works,
 * Blog list) — three-tier hierarchy: start planning, view pricing, contact us.
 */
@Component({
    selector: 'app-public-page-cta',
    imports: [RouterLink, TranslatePipe, PrimaryButtonComponent],
    template: `
    <section class="section-container py-16">
      <div class="rounded-card border border-border bg-surface-muted p-10 text-center sm:p-14">
        <h2 class="text-3xl font-semibold text-text-primary">{{ 'PUBLIC_PAGE_CTA.TITLE' | translate }}</h2>
        <p class="mx-auto mt-2 max-w-lg text-base text-text-secondary">
          {{ 'PUBLIC_PAGE_CTA.SUBTITLE' | translate }}
        </p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-4">
          <app-primary-button routerLink="/wizard">
            {{ 'PUBLIC_PAGE_CTA.PRIMARY' | translate }}
          </app-primary-button>
          <a
            routerLink="/pricing"
            class="inline-flex h-12 items-center justify-center rounded-btn border border-border px-6 text-base font-medium text-text-primary no-underline transition-colors hover:bg-white"
          >
            {{ 'PUBLIC_PAGE_CTA.SECONDARY' | translate }}
          </a>
          <a
            routerLink="/contact"
            class="text-base font-medium text-primary no-underline hover:underline"
          >
            {{ 'PUBLIC_PAGE_CTA.TERTIARY' | translate }}
          </a>
        </div>
      </div>
    </section>
  `
})
export class PublicPageCtaComponent {}
