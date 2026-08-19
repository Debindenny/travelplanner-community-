import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FooterSectionComponent } from '../landing/components/footer-section/footer-section.component';
import { PrimaryButtonComponent, ToastService } from 'ui';
import { PRICING_PLANS, PricingPlan } from '../shared/data/pricing.data';
import { SeoService } from '../shared/services/seo.service';
import { NavbarComponent } from '../landing/components/navbar/navbar.component';
import { apiUrl } from '../shared/utils/api-url';
import { AuthService } from '../auth/auth.service';

/** Plans with a self-serve Stripe checkout. Others (free, travel_partner) route elsewhere. */
const SELF_SERVE_PLANS = new Set(['individual']);

@Component({
    selector: 'app-pricing-page',
    imports: [RouterLink, TranslatePipe, FooterSectionComponent, PrimaryButtonComponent, NavbarComponent],
    template: `
    <div class="min-h-screen bg-surface-muted pt-[73px]">
      <app-navbar variant="default" [showUserActions]="true" />
      <div class="pt-8">
        <section class="page-container px-5 py-16 xl:px-20">
          <div class="mx-auto max-w-[640px] text-center">
            <h1 class="text-[clamp(3rem,12vw,6rem)] font-bold leading-none text-text-primary">{{ 'PRICING.TITLE' | translate }}</h1>
            <p class="mt-4 text-lg text-text-secondary">
              {{ 'PRICING.SUBTITLE' | translate }}
            </p>
            <div class="mt-8 inline-flex rounded-full border border-border bg-white p-1 text-sm font-medium text-text-secondary">
              <span class="rounded-full bg-primary px-4 py-2 text-white">{{ 'PRICING.MONTHLY' | translate }}</span>
              <span class="px-4 py-2 text-text-tertiary" aria-disabled="true">{{ 'PRICING.ANNUAL_SOON' | translate }}</span>
            </div>
          </div>

          <div class="mt-14 grid gap-6 lg:grid-cols-3">
            @for (plan of plans; track plan.id) {
              <article
                class="flex flex-col rounded-btn border bg-white p-8"
                [class.border-primary]="plan.highlighted"
                [class.shadow-lg]="plan.highlighted"
                [class.border-border]="!plan.highlighted"
              >
                @if (plan.highlighted) {
                  <span class="mb-4 inline-block w-fit rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
                    {{ 'PRICING.MOST_POPULAR' | translate }}
                  </span>
                }
                <h2 class="text-3xl font-semibold text-text-primary">{{ planKey(plan.id) + '.NAME' | translate }}</h2>
                <p class="mt-2">
                  <span class="text-7xl font-bold tabular-nums text-text-primary">₹{{ plan.price }}</span>
                  <span class="text-base text-text-secondary">{{ planKey(plan.id) + '.PERIOD' | translate }}</span>
                </p>
                <p class="mt-1 text-sm text-text-secondary">{{ 'PRICING.PLANS_PER_MONTH' | translate:{ n: plan.plansPerMonth } }}</p>
                <ul class="mt-6 flex-1 space-y-3">
                  @for (featureKey of featureKeys(plan); track featureKey) {
                    <li class="flex items-start gap-2 text-sm text-text-secondary">
                      <span class="mt-0.5 text-primary">✓</span>
                      {{ featureKey | translate }}
                    </li>
                  }
                </ul>
                @if (isSelfServe(plan.id)) {
                  <app-primary-button
                    widthClass="mt-8 w-full"
                    [loading]="checkingOutPlan() === plan.id"
                    [disabled]="checkingOutPlan() !== null"
                    (click)="startPlanCheckout(plan.id)"
                  >
                    {{ planKey(plan.id) + '.CTA' | translate }}
                  </app-primary-button>
                } @else {
                  <app-primary-button
                    [routerLink]="ctaRoute(plan.id)"
                    [queryParams]="ctaQueryParams(plan.id)"
                    widthClass="mt-8 w-full"
                  >
                    {{ planKey(plan.id) + '.CTA' | translate }}
                  </app-primary-button>
                }
              </article>
            }
          </div>

          <div class="mt-12 overflow-hidden rounded-card border border-border bg-white">
            <div class="grid grid-cols-3 border-b border-border bg-surface-muted px-4 py-3 text-sm font-medium text-text-primary">
              <span>{{ 'PRICING.TABLE.PLAN' | translate }}</span>
              <span>{{ 'PRICING.TABLE.INCLUDED' | translate }}</span>
              <span>{{ 'PRICING.TABLE.BEST_FOR' | translate }}</span>
            </div>
            @for (plan of plans; track plan.id) {
              <div class="grid grid-cols-3 gap-3 border-b border-border px-4 py-4 text-sm text-text-secondary last:border-b-0">
                <span class="font-medium text-text-primary">{{ planKey(plan.id) + '.NAME' | translate }}</span>
                <span>{{ 'PRICING.TABLE.PER_MONTH' | translate:{ n: plan.plansPerMonth } }}</span>
                <span>{{ planBestFor[plan.id] | translate }}</span>
              </div>
            }
          </div>

          <div class="mt-10 flex flex-col items-center justify-center gap-3 text-center sm:flex-row">
            <a routerLink="/faq" class="text-sm font-medium text-primary no-underline hover:underline">
              {{ 'PRICING.FAQ_LINK' | translate }}
            </a>
            <span class="hidden text-text-tertiary sm:inline" aria-hidden="true">•</span>
            <a routerLink="/contact" [queryParams]="{ subject: 'Billing & Payments' }" class="text-sm font-medium text-primary no-underline hover:underline">
              {{ 'PRICING.BILLING_LINK' | translate }}
            </a>
          </div>
        </section>
      </div>

      <app-footer-section />
    </div>
  `
})
export class PricingPageComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly translate = inject(TranslateService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly plans = PRICING_PLANS;
  readonly checkingOutPlan = signal<string | null>(null);
  readonly planBestFor = {
    free: 'PRICING.PLANS.FREE.BEST_FOR',
    individual: 'PRICING.PLANS.INDIVIDUAL.BEST_FOR',
    travel_partner: 'PRICING.PLANS.TRAVEL_PARTNER.BEST_FOR',
  };

  planKey(planId: 'free' | 'individual' | 'travel_partner'): string {
    return `PRICING.PLANS.${planId.toUpperCase()}`;
  }

  featureKeys(plan: PricingPlan): string[] {
    return plan.features.map((_, index) => `${this.planKey(plan.id)}.FEATURE_${index + 1}`);
  }

  ngOnInit(): void {
    this.seo.set({
      title: this.translate.instant('PRICING.SEO_TITLE'),
      description: this.translate.instant('PRICING.SEO_DESCRIPTION'),
    });
  }

  isSelfServe(planId: 'free' | 'individual' | 'travel_partner'): boolean {
    return SELF_SERVE_PLANS.has(planId);
  }

  async startPlanCheckout(planId: 'free' | 'individual' | 'travel_partner'): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.checkingOutPlan.set(planId);
    try {
      const res: any = await firstValueFrom(
        this.http.post(apiUrl('/checkout/subscription'), { plan_code: planId })
      );
      if (res?.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        this.toast.error(this.translate.instant('PRICING.CHECKOUT.UNAVAILABLE'));
      }
    } catch (err) {
      console.error('Failed to start plan checkout', err);
      this.toast.error(this.translate.instant('PRICING.CHECKOUT.ERROR'));
    } finally {
      this.checkingOutPlan.set(null);
    }
  }

  ctaRoute(planId: 'free' | 'individual' | 'travel_partner'): string {
    if (planId === 'free') return '/explore';
    if (planId === 'individual') return '/contact';
    return '/contact';
  }

  ctaQueryParams(planId: 'free' | 'individual' | 'travel_partner'): { subject?: string } | undefined {
    if (planId === 'individual') return { subject: 'Billing & Payments' };
    if (planId === 'travel_partner') return { subject: 'Partnership / B2B' };
    return undefined;
  }
}
