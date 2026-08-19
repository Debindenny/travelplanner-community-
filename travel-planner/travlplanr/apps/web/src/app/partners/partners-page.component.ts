import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AnimatedLinkComponent } from '../shared/components/animated-link/animated-link.component';
import { FooterSectionComponent } from '../landing/components/footer-section/footer-section.component';
import { NavbarComponent } from '../landing/components/navbar/navbar.component';
import { PrimaryButtonComponent } from 'ui';
import { SeoService } from '../shared/services/seo.service';

@Component({
    selector: 'app-partners-page',
    imports: [RouterLink, TranslatePipe, AnimatedLinkComponent, FooterSectionComponent, NavbarComponent, PrimaryButtonComponent],
    template: `
    <div class="min-h-screen bg-surface-muted">
      <div class="bg-primary" aria-hidden="true">
        <div class="h-[70px]"></div>
      </div>

      <div class="-mt-[70px]">
        <app-navbar variant="default" [showUserActions]="true" />
      </div>

      <div class="pt-[73px]">
        <section class="section-container py-16">
          <div class="mx-auto max-w-[760px] text-center">
            <h1 class="text-[clamp(3rem,12vw,6rem)] font-bold leading-none text-text-primary">{{ 'PARTNERS.TITLE' | translate }}</h1>
            <p class="mt-4 text-lg text-text-secondary">
              {{ 'PARTNERS.SUBTITLE' | translate }}
            </p>
          </div>

          <div class="mx-auto mt-12 grid max-w-[980px] gap-6 md:grid-cols-[1fr_0.8fr]">
            <div class="rounded-card border border-border bg-white p-8">
              <h2 class="text-2xl font-semibold text-text-primary">{{ 'PARTNERS.PLAN_TITLE' | translate }}</h2>
              <ul class="mt-6 space-y-4 text-base text-text-secondary">
                @for (item of partnerBenefits; track item) {
                  <li class="flex gap-3"><span class="text-primary" aria-hidden="true">✓</span>{{ item | translate }}</li>
                }
              </ul>
            </div>

            <aside class="rounded-card border border-primary/20 bg-primary p-8 text-white">
              <h2 class="text-2xl font-semibold">{{ 'PARTNERS.SALES.TITLE' | translate }}</h2>
              <p class="mt-3 text-white/85">
                {{ 'PARTNERS.SALES.TEXT' | translate }}
              </p>
              <app-primary-button
                routerLink="/contact"
                [queryParams]="{ subject: 'Partnership / B2B' }"
                widthClass="mt-8 w-full !bg-white !text-primary hover:!bg-primary-50"
              >
                {{ 'PARTNERS.SALES.CTA' | translate }}
              </app-primary-button>
              <p class="mt-5 text-sm text-white/75">
                {{ 'PARTNERS.SALES.EMAIL_PREFIX' | translate }}
                <a href="mailto:partnerships@travlplanr.com" class="font-medium text-white hover:underline">partnerships&#64;travlplanr.com</a>.
              </p>
            </aside>
          </div>

          <p class="mt-10 flex justify-center">
            <app-animated-link variant="underline-sweep" routerLink="/pricing" class="text-sm text-primary">
              {{ 'PARTNERS.VIEW_PRICING' | translate }}
            </app-animated-link>
          </p>
        </section>
      </div>

      <app-footer-section />
    </div>
  `
})
export class PartnersPageComponent implements OnInit {
  private readonly seo = inject(SeoService);

  readonly partnerBenefits = [
    'PARTNERS.BENEFITS.EMBED',
    'PARTNERS.BENEFITS.VOLUME',
    'PARTNERS.BENEFITS.AFFILIATE',
    'PARTNERS.BENEFITS.API',
  ];

  ngOnInit(): void {
    this.seo.set({
      title: 'Travel Partners | TRAVL PLANR',
      description:
        'Partner with TRAVL PLANR to bring AI-powered itinerary planning into travel agencies, hotels, and B2B travel workflows.',
    });
  }
}
