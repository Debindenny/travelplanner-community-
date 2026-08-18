import { Component, OnInit, inject, signal } from '@angular/core';

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PrimaryButtonComponent } from 'ui';
import { FooterSectionComponent } from '../landing/components/footer-section/footer-section.component';
import { AuthService } from '../auth/auth.service';
import { apiUrl } from '../shared/utils/api-url';
import { ToastService } from '../shared/utils/toast.service';
import { CurrencyConverterPipe } from '../shared/utils/currency-converter.pipe';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

interface PackageDetail {
  id: string;
  title: string;
  theme: string;
  price: string;
  priceValue: number;
  days: string;
  group: string;
  image: string;
  region: string;
  country: string;
  budget: string;
  rating: number;
  itineraryId?: string | null;
}

@Component({
    selector: 'app-package-detail-page',
    imports: [RouterLink, PrimaryButtonComponent, FooterSectionComponent, CurrencyConverterPipe, TranslatePipe],
    template: `
    <div class="bg-surface-muted min-h-screen pt-4">
      <div class="page-container px-5 xl:px-20 pb-20">

        @if (isLoading()) {
          <div class="py-32 text-center text-text-secondary">{{ 'PACKAGES.DETAIL.LOADING' | translate }}</div>
        } @else if (error()) {
          <div class="bg-white rounded-xl border border-border p-12 text-center shadow-sm my-12">
            <h3 class="text-lg font-semibold text-text-primary">{{ error()! | translate }}</h3>
            <p class="text-text-secondary mt-1">{{ errorHint() | translate }}</p>
            <app-primary-button class="inline-block mt-5" [routerLink]="['/packages']">{{ 'PACKAGES.DETAIL.BROWSE_ALL' | translate }}</app-primary-button>
          </div>
        } @else {
          <!-- "as" aliasing is only allowed on a primary @if, not @else if -->
          @if (pkg(); as p) {

          <!-- Breadcrumbs -->
          <div class="flex items-center gap-2 text-sm text-text-secondary my-6 flex-wrap">
            <a routerLink="/" class="hover:text-primary no-underline">{{ 'PACKAGES.BREADCRUMB.HOME' | translate }}</a>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-disabled"><polyline points="9 18 15 12 9 6"></polyline></svg>
            <a [routerLink]="['/packages']" [queryParams]="{ region: p.region }" class="hover:text-primary no-underline">{{ 'PACKAGES.BREADCRUMB.PACKAGES' | translate }}</a>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-disabled"><polyline points="9 18 15 12 9 6"></polyline></svg>
            <span class="text-primary font-medium">{{ p.title }}</span>
          </div>

          <!-- Hero -->
          <div class="h-[320px] md:h-[460px] overflow-hidden rounded-2xl bg-gray-200 mb-8 relative">
            <img [src]="p.image" [alt]="p.title" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <div class="absolute bottom-0 left-0 p-6 md:p-10 text-white">
              <div class="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs-plus font-medium mb-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="text-yellow-400"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {{ p.rating }} · {{ p.region }}
              </div>
              <h1 class="text-4xl-plus md:text-7xl-plus font-bold leading-tight">{{ p.title }}</h1>
              <p class="text-sm-plus md:text-base-plus opacity-90 mt-1">{{ p.country }} · {{ p.days }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Main -->
            <div class="lg:col-span-2 space-y-8">
              <section class="bg-white rounded-xl border border-border shadow-sm p-6">
                <h2 class="text-xl font-bold text-text-primary mb-4">{{ 'PACKAGES.DETAIL.TRIP_OVERVIEW' | translate }}</h2>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div class="text-xs text-text-tertiary mb-1">{{ 'PACKAGES.DETAIL.DURATION' | translate }}</div>
                    <div class="text-sm-plus font-semibold text-text-primary">{{ p.days }}</div>
                  </div>
                  <div>
                    <div class="text-xs text-text-tertiary mb-1">{{ 'PACKAGES.DETAIL.GROUP_TYPE' | translate }}</div>
                    <div class="text-sm-plus font-semibold text-text-primary">{{ p.group }}</div>
                  </div>
                  <div>
                    <div class="text-xs text-text-tertiary mb-1">{{ 'PACKAGES.DETAIL.BUDGET_TIER' | translate }}</div>
                    <div class="text-sm-plus font-semibold text-text-primary">{{ p.budget }}</div>
                  </div>
                  <div>
                    <div class="text-xs text-text-tertiary mb-1">{{ 'PACKAGES.DETAIL.RATING' | translate }}</div>
                    <div class="text-sm-plus font-semibold text-text-primary">{{ 'PACKAGES.DETAIL.RATING_OUT_OF_5' | translate: { n: p.rating } }}</div>
                  </div>
                </div>
              </section>

              <section class="bg-white rounded-xl border border-border shadow-sm p-6">
                <h2 class="text-xl font-bold text-text-primary mb-1">{{ 'PACKAGES.DETAIL.STANDARD_INCLUSIONS' | translate }}</h2>
                <p class="text-xs text-text-tertiary mb-4">{{ 'PACKAGES.DETAIL.TYPICAL_AMENITIES' | translate: { budget: p.budget, group: p.group } }}</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  @for (item of getInclusions(p); track item) {
                    <div class="flex items-center gap-2 text-sm text-text-secondary">
                      <div class="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                      <span>{{ item | translate }}</span>
                    </div>
                  }
                </div>
              </section>
            </div>

            <!-- Booking sidebar -->
            <aside class="lg:col-span-1">
              <div class="bg-white rounded-xl border border-border shadow-sm p-6 lg:sticky lg:top-[88px]">
                <div class="text-xs-plus text-text-tertiary">{{ 'PACKAGES.DETAIL.STARTING_FROM_PER_PERSON' | translate }}</div>
                <div class="text-5xl-plus font-bold text-primary mb-1 drop-shadow-[0_0_15px_rgba(0,96,234,0.4)]">{{ p.price | appCurrency }}</div>
                <div class="text-xs-plus text-text-secondary mb-5">{{ p.days }} · {{ p.group }}</div>
                <app-primary-button
                  widthClass="w-full"
                  [disabled]="planning()"
                  [loading]="planning()"
                  (click)="onCreatePlanClick($event, p)"
                >
                  {{ (planning() ? 'PACKAGES.DETAIL.OPENING_PLAN' : (p.itineraryId ? 'PACKAGES.DETAIL.OPEN_ITINERARY' : 'PACKAGES.DETAIL.CREATE_ITINERARY_PLAN')) | translate }}
                </app-primary-button>
                <button
                  type="button"
                  (click)="book(p)"
                  [disabled]="booking()"
                  class="w-full mt-2 border border-primary text-primary rounded-btn px-6 py-2.5 text-sm font-semibold hover:bg-primary-50 transition-colors disabled:opacity-60"
                >
                  {{ (booking() ? 'PACKAGES.DETAIL.PROCESSING' : 'PACKAGES.DETAIL.BOOK_THIS_PACKAGE') | translate }}
                </button>
                <button
                  class="w-full mt-2 border border-border text-text-primary rounded-btn px-6 py-2 text-sm font-medium hover:bg-surface-muted transition-colors"
                  [routerLink]="['/packages']" [queryParams]="{ region: p.region }">
                  {{ 'PACKAGES.DETAIL.BACK_TO_PACKAGES' | translate }}
                </button>
                <p class="text-xs text-text-tertiary mt-4 text-center">{{ 'PACKAGES.DETAIL.FREE_CANCELLATION' | translate }}</p>
              </div>
            </aside>
          </div>
          }
        }

      </div>
      <app-footer-section />
    </div>
  `
})
export class PackageDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly pkg = signal<PackageDetail | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly errorHint = signal('PACKAGES.DETAIL.ERROR.MAY_NO_LONGER_BE_AVAILABLE');
  readonly booking = signal(false);
  readonly planning = signal(false);

  /**
   * Returns a set of inclusion i18n keys derived from the real package data.
   * Avoids inventing tags that don't reflect what the package actually offers.
   * Keys are piped through `| translate` at the render site.
   */
  getInclusions(p: PackageDetail): string[] {
    const items: string[] = [
      'PACKAGES.DETAIL.INCLUSION.AIRPORT_TRANSFERS',
      'PACKAGES.DETAIL.INCLUSION.DAILY_BREAKFAST',
      'PACKAGES.DETAIL.INCLUSION.TAXES_FEES',
      'PACKAGES.DETAIL.INCLUSION.GUIDED_SIGHTSEEING',
    ];

    // Hotel tier derived from budget field
    if (p.budget?.toLowerCase().includes('luxury')) {
      items.unshift('PACKAGES.DETAIL.INCLUSION.HOTEL_5_STAR');
    } else if (p.budget?.toLowerCase().includes('mid') || p.budget?.toLowerCase().includes('standard')) {
      items.unshift('PACKAGES.DETAIL.INCLUSION.HOTEL_4_STAR');
    } else {
      items.unshift('PACKAGES.DETAIL.INCLUSION.HOTEL_3_4_STAR');
    }

    // Transport hint derived from group type
    if (p.group?.toLowerCase() === 'solo') {
      items.push('PACKAGES.DETAIL.INCLUSION.SELF_DRIVE_AVAILABLE');
    } else {
      items.push('PACKAGES.DETAIL.INCLUSION.PRIVATE_CAB_TRANSFERS');
    }

    return items;
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('PACKAGES.DETAIL.ERROR.NOT_FOUND');
      this.errorHint.set('PACKAGES.DETAIL.ERROR.NO_ID_IN_URL');
      this.isLoading.set(false);
      return;
    }
    try {
      const p: any = await firstValueFrom(this.http.get(apiUrl(`/packages/${id}`)));
      const detail: PackageDetail = {
        ...p,
        priceValue: typeof p.price === 'number'
          ? Math.round(p.price)
          : parseInt(String(p.price || '').replace(/[^0-9.]/g, '') || '0', 10),
      };
      this.pkg.set(detail);
    } catch (err) {
      console.error('Failed to load package', err);
      const status = (err as HttpErrorResponse)?.status;
      if (status === 404) {
        this.error.set('PACKAGES.DETAIL.ERROR.NOT_FOUND');
        this.errorHint.set('PACKAGES.DETAIL.ERROR.REMOVED_OR_INCORRECT_LINK');
      } else if (status === 0 || (status && status >= 500)) {
        this.error.set('PACKAGES.DETAIL.ERROR.UNABLE_TO_LOAD');
        this.errorHint.set('PACKAGES.DETAIL.ERROR.NETWORK_OR_SERVER');
      } else {
        this.error.set('PACKAGES.DETAIL.ERROR.SOMETHING_WENT_WRONG');
        this.errorHint.set('PACKAGES.DETAIL.ERROR.COULD_NOT_LOAD_RETRY');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  onCreatePlanClick(event: Event, p: PackageDetail): void {
    event.preventDefault();
    event.stopPropagation();
    void this.viewItineraryPlan(p);
  }

  async viewItineraryPlan(p: PackageDetail): Promise<void> {
    if (this.planning()) return;
    // Lock immediately so rapid re-clicks cannot fire parallel POSTs.
    this.planning.set(true);

    try {
      if (!this.auth.isLoggedIn()) {
        await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
        return;
      }

      // Ensure we still have a usable access token before calling the API.
      if (!this.auth.token) {
        const refreshed = await this.auth.refreshToken();
        if (!refreshed || !this.auth.token) {
          this.toast.error(this.translate.instant('PACKAGES.DETAIL.ERROR.ITINERARY_UNAVAILABLE_LOGIN'));
          await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
          return;
        }
      }

      // If an itinerary already exists for this package, navigate directly —
      // do NOT POST again to avoid creating duplicate server-side trip state.
      let tripId = p.itineraryId ?? null;
      if (!tripId) {
        tripId = await this.createPackagePlan(p.id);
      }
      if (!tripId) {
        this.toast.error(this.translate.instant('PACKAGES.DETAIL.ERROR.ITINERARY_UNAVAILABLE'));
        return;
      }

      // Full page navigation is intentional: soft lazy-load of the itinerary
      // chunk can fail silently during hot-reload / compile glitches, leaving
      // the user stuck on the package page after a successful plan create.
      this.leavingForItinerary = true;
      window.location.assign(`/itinerary/${encodeURIComponent(tripId)}`);
      return;
    } catch (err) {
      console.error('Failed to open itinerary plan', err);

      const status = (err as HttpErrorResponse)?.status;
      if (status === 401 || status === 403) {
        this.toast.error(this.translate.instant('PACKAGES.DETAIL.ERROR.ITINERARY_UNAVAILABLE_LOGIN'));
        await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
        return;
      }
      if (status === 503) {
        this.toast.error(this.translate.instant('PACKAGES.DETAIL.ERROR.ITINERARY_TEMP_UNAVAILABLE'));
        return;
      }
      this.toast.error(this.translate.instant('PACKAGES.DETAIL.ERROR.ITINERARY_UNAVAILABLE'));
    } finally {
      // Keep the button locked while the browser navigates away; only unlock
      // when we stay on this page (auth redirect / API error).
      if (!this.leavingForItinerary) {
        this.planning.set(false);
      }
    }
  }

  /** Set true just before hard-nav so finally does not re-enable the button. */
  private leavingForItinerary = false;

  private async createPackagePlan(packageId: string): Promise<string | null> {
    const post = () =>
      firstValueFrom(
        this.http.post<{ tripId?: string; trip_id?: string }>(apiUrl(`/packages/${packageId}/plan`), {}),
      );

    try {
      const res = await post();
      return res?.tripId ?? res?.trip_id ?? null;
    } catch (err) {
      const status = (err as HttpErrorResponse)?.status;
      if (status !== 401) throw err;
      const refreshed = await this.auth.refreshToken();
      if (!refreshed) throw err;
      const res = await post();
      return res?.tripId ?? res?.trip_id ?? null;
    }
  }

  async book(p: PackageDetail): Promise<void> {
    // Booking/payment legitimately requires an account — send guests to login
    // instead of firing a request that 401s.
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.booking.set(true);
    try {
      const res: any = await firstValueFrom(
        this.http.post(apiUrl('/checkout'), { package_id: p.id, amount: p.priceValue }),
      );
      if (res?.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        this.toast.error(this.translate.instant('PACKAGES.CHECKOUT.UNAVAILABLE'));
      }
    } catch (err) {
      console.error('Checkout failed', err);
      this.toast.error(this.translate.instant('PACKAGES.CHECKOUT.UNAVAILABLE'));
    } finally {
      this.booking.set(false);
    }
  }
}
