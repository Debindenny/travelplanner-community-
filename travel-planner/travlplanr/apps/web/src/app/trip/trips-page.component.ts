import { Component, computed, DestroyRef, inject, OnInit, signal, Input } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../auth/auth.service';
import { FooterSectionComponent } from '../landing/components/footer-section/footer-section.component';
import { PrimaryButtonComponent } from 'ui';
import { SearchFieldComponent } from '../shared/components/search-field/search-field.component';
import { ToastService } from '../shared/utils/toast.service';
import { isListedInMyTrips, SavedTrip, TripService } from './trip.service';
import { MyTripsListable } from './trip-listing.util';
import { filterTripsForTab } from './my-trips-filter.util';

type TripTab = 'upcoming' | 'recent' | 'saved';


@Component({
    selector: 'app-trips-page',
    imports: [RouterLink, PrimaryButtonComponent, FooterSectionComponent, TranslatePipe, SearchFieldComponent],
    template: `
    <div [class.min-h-screen]="!embedded" [class.bg-surface-muted]="!embedded" class="font-[Poppins,sans-serif]">
      <div [class.bg-surface-muted]="!embedded">
        <div [class.page-container]="!embedded" [class.px-5]="!embedded" [class.pb-10]="!embedded" [class.pt-8]="!embedded" [class.xl:px-[80px]]="!embedded">
          @if (isLoading()) {
            <div class="py-10">
              <div class="mb-8 space-y-3">
                <div class="h-8 w-48 animate-pulse rounded bg-border-light"></div>
                <div class="h-4 w-64 animate-pulse rounded bg-border-light"></div>
              </div>
              <div class="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" role="status" [attr.aria-label]="'TRIPS.LOADING_TRIPS' | translate">
                @for (item of skeletonCards; track item) {
                  <div class="overflow-hidden rounded-btn bg-white" aria-hidden="true">
                    <div class="h-[241px] animate-pulse bg-border-light"></div>
                    <div class="space-y-4 p-5">
                      <div class="h-4 w-28 animate-pulse rounded bg-border-light"></div>
                      <div class="h-5 w-4/5 animate-pulse rounded bg-border-light"></div>
                      <div class="h-4 w-2/3 animate-pulse rounded bg-border-light"></div>
                    </div>
                  </div>
                }
              </div>
            </div>
          } @else if (loadError()) {
            <div class="flex flex-col items-center px-4 py-10 text-center sm:py-16">
              <p class="text-xl font-[600] text-text-primary">{{ 'TRIPS.LOAD_ERROR_TITLE' | translate }}</p>
              <p class="mt-2 max-w-[480px] text-base text-text-secondary">{{ loadError() }}</p>
              <app-primary-button widthClass="mt-8" (click)="retry()">{{ 'TRIPS.TRY_AGAIN' | translate }}</app-primary-button>
            </div>
          } @else if (isEmptyWishlist()) {
            <div class="flex flex-col items-center px-4 py-10 sm:py-16">
              <div class="mb-10 flex h-[200px] w-[200px] items-center justify-center">
                <img
                  src="assets/images/trips/suitcase.png"
                  alt=""
                  class="h-full w-full object-contain"
                  aria-hidden="true"
                />
              </div>

              <p class="max-w-[655px] text-center text-3xl font-[500] leading-[1.5] text-text-primary">
                {{ 'TRIPS.EMPTY_WISHLIST' | translate }}
              </p>

              <app-primary-button routerLink="/explore" widthClass="mt-10">
                {{ 'TRIPS.START_PLANNING' | translate }}
              </app-primary-button>
            </div>
          } @else {
            @if (!embedded) {
              <div class="flex flex-col gap-2">
                <h1 class="text-[clamp(2rem,4vw,48px)] font-[600] leading-tight text-text-primary">{{ 'TRIPS.TITLE' | translate }}</h1>
                <p class="text-base font-[500] text-text-secondary">{{ 'TRIPS.SUBTITLE' | translate }}</p>
              </div>
            }

            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between" [class.mt-8]="!embedded">
              <div class="flex flex-wrap items-center gap-6" role="tablist" [attr.aria-label]="'TRIPS.FILTERS_ARIA_LABEL' | translate">
                @for (tab of tabs; track tab.id) {
                  <button
                    type="button"
                    (click)="selectTab(tab.id)"
                    role="tab"
                    class="rounded-[56px] border px-6 py-3 text-sm font-[400] transition-colors"
                    [attr.aria-selected]="activeTab() === tab.id"
                    [attr.aria-pressed]="activeTab() === tab.id"
                    [class.border-border]="activeTab() !== tab.id"
                    [class.text-text-primary]="activeTab() !== tab.id"
                    [class.bg-dark-footer]="activeTab() === tab.id"
                    [class.border-[#141414]]="activeTab() === tab.id"
                    [class.text-white]="activeTab() === tab.id"
                  >
                    {{ tab.labelKey | translate }}
                  </button>
                }
              </div>

              <app-search-field
                class="w-full shrink-0 lg:w-80"
                [value]="searchQuery()"
                (valueChange)="searchQuery.set($event)"
                [placeholder]="'TRIPS.SEARCH_PLACEHOLDER' | translate"
                [ariaLabel]="'TRIPS.SEARCH_PLACEHOLDER' | translate"
                variant="inline"
                size="md"
                prefixIcon="search"
                [debounceMs]="150"
              />
            </div>

            @if (filteredTrips().length === 0) {
              <div class="mt-12 rounded-btn border border-dashed border-border bg-white px-8 py-16 text-center">
                <p class="text-lg font-[600] text-text-primary">{{ 'TRIPS.NO_TRIPS_FOUND' | translate }}</p>
                <p class="mt-2 text-sm text-text-secondary">
                  @if (searchQuery()) {
                    {{ 'TRIPS.NO_TRIPS_SEARCH_HINT' | translate }}
                  } @else if (activeTab() === 'upcoming') {
                    {{ 'TRIPS.NO_UPCOMING_TRIPS' | translate }}
                  } @else {
                    {{ 'TRIPS.NO_RECENT_TRIPS' | translate }}
                  }
                </p>
              </div>
            } @else {
              <div class="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                @for (trip of filteredTrips(); track trip.id) {
                  <article class="group relative overflow-hidden rounded-btn bg-white">
                    <a [routerLink]="['/itinerary', trip.id]" class="block h-[241px] overflow-hidden">
                      <img [src]="trip.image" [alt]="trip.title" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    </a>
                    <div class="absolute right-3 top-3 z-10 flex gap-2">
                      <button
                        type="button"
                        class="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-text-primary shadow-sm hover:bg-white"
                        [attr.aria-label]="'TRIPS.SHARE_TRIP_ARIA' | translate: { title: tripCardTitle(trip) }"
                        (click)="shareTrip(trip)"
                      >
                        {{ 'TRIPS.SHARE' | translate }}
                      </button>
                      <button
                        type="button"
                        class="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-white"
                        [attr.aria-label]="'TRIPS.DELETE_TRIP_ARIA' | translate: { title: tripCardTitle(trip) }"
                        (click)="tripToDelete.set(trip)"
                      >
                        {{ 'TRIPS.DELETE' | translate }}
                      </button>
                    </div>
                    <div class="flex flex-col gap-4 p-5">
                      <div class="flex flex-col gap-1">
                        <p class="text-sm tabular-nums text-text-secondary">{{ 'TRIPS.DAYS_ITINERARY' | translate: { count: tripDayCount(trip) } }}</p>
                        <a [routerLink]="['/itinerary', trip.id]" class="text-base font-[600] leading-snug text-text-primary no-underline hover:text-primary">{{ tripCardTitle(trip) }}</a>
                        <p class="text-sm text-text-secondary">{{ dateLabel(trip) }} {{ formatTripDate(trip) }}</p>
                      </div>
                      <a
                        [routerLink]="['/itinerary', trip.id]"
                        class="text-sm font-[500] text-primary no-underline hover:underline"
                      >
                        {{ 'TRIPS.VIEW_ITINERARY' | translate }}
                      </a>
                    </div>
                  </article>
                }
              </div>
            }
          }
        </div>
      </div>

      @if (tripToDelete(); as trip) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 class="text-xl font-bold text-text-primary">{{ 'TRIPS.CONFIRM_DELETE_TITLE' | translate: { title: tripCardTitle(trip) } }}</h2>
            <p class="mt-2 text-text-secondary">{{ 'TRIPS.CONFIRM_DELETE_MSG' | translate }}</p>
            <div class="mt-6 flex justify-end gap-3">
              <button
                type="button"
                class="rounded-btn border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted"
                (click)="tripToDelete.set(null)"
              >
                {{ 'TRIPS.CANCEL' | translate }}
              </button>
              <button
                type="button"
                class="rounded-btn bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                (click)="confirmDeleteTrip()"
              >
                {{ 'TRIPS.DELETE' | translate }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (!embedded) {
        <app-footer-section />
      }
    </div>
  `
})
export class TripsPageComponent implements OnInit {
  @Input() embedded = false;
  private readonly tripService = inject(TripService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);

  ngOnInit(): void {
    if (this.embedded) return;
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tab = params['tab'] as TripTab | undefined;
      if (tab === 'upcoming' || tab === 'recent' || tab === 'saved') {
        this.activeTab.set(tab);
      } else if (!tab) {
        this.activeTab.set('upcoming');
      }
    });
  }

  selectTab(tab: TripTab): void {
    if (this.embedded) {
      this.activeTab.set(tab);
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'upcoming' ? null : tab },
      queryParamsHandling: 'merge',
    });
  }

  readonly tabs: { id: TripTab; labelKey: string }[] = [
    { id: 'upcoming', labelKey: 'TRIPS.TAB_UPCOMING' },
    { id: 'recent', labelKey: 'TRIPS.TAB_RECENT' },
    { id: 'saved', labelKey: 'TRIPS.TAB_SAVED' },
  ];

  readonly activeTab = signal<TripTab>('upcoming');
  readonly searchQuery = signal('');
  readonly skeletonCards = [1, 2, 3];
  readonly tripToDelete = signal<SavedTrip | null>(null);

  readonly isLoading = this.tripService.isLoading;
  readonly loadError = this.tripService.loadError;
  readonly isEmptyWishlist = computed(
    () => this.tripService.trips().filter((t) => isListedInMyTrips(t as MyTripsListable)).length === 0,
  );

  retry(): void {
    this.tripService.refreshTrips();
  }

  readonly filteredTrips = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    let list = filterTripsForTab(this.tripService.trips(), this.activeTab()) as SavedTrip[];

    if (!query) return list;

    return list.filter(
      (trip) =>
        trip.title.toLowerCase().includes(query) ||
        trip.destination.toLowerCase().includes(query),
    );
  });

  tripDayCount(trip: SavedTrip): string {
    const days = trip.days?.length
      || (trip.cityDays ? trip.cityDays.reduce((sum, city) => sum + city.nights, 0) + 1 : 0)
      || Math.max(
        1,
        Math.floor(
          (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24),
        ) + 1,
      );
    return days.toString().padStart(2, '0');
  }

  tripCardTitle(trip: SavedTrip): string {
    const owner = this.ownerName();
    const destination = trip.destination || trip.title;
    return this.translate.instant('TRIPS.TRIP_CARD_TITLE', { owner, destination });
  }

  dateLabel(trip: SavedTrip): string {
    if (this.activeTab() === 'upcoming') return this.translate.instant('TRIPS.DATE_LABEL_UPCOMING');
    if (this.activeTab() === 'recent') return this.translate.instant('TRIPS.DATE_LABEL_RECENT');
    return this.translate.instant('TRIPS.DATE_LABEL_SAVED');
  }

  formatTripDate(trip: SavedTrip): string {
    const isoDate =
      this.activeTab() === 'upcoming'
        ? trip.startDate
        : this.activeTab() === 'recent'
          ? trip.endDate
          : trip.createdAt;
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  async confirmDeleteTrip(): Promise<void> {
    const trip = this.tripToDelete();
    if (!trip) return;
    this.tripToDelete.set(null);
    try {
      await this.tripService.deleteTrip(trip.id);
      this.toast.success(this.translate.instant('TRIPS.TOAST_TRIP_DELETED'));
    } catch {
      this.toast.error(this.translate.instant('TRIPS.DELETE_ERROR'));
    }
  }

  async shareTrip(trip: SavedTrip): Promise<void> {
    const url = new URL(`/itinerary/${trip.id}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      this.toast.success(this.translate.instant('TRIPS.TOAST_LINK_COPIED'));
    } catch {
      this.toast.info(url);
    }
  }

  private ownerName(): string {
    const email = this.auth.user()?.email;
    const fallback = this.translate.instant('TRIPS.DEFAULT_OWNER_NAME');
    if (!email) return fallback;
    const local = email.split('@')[0] ?? fallback;
    const parts = local.replace(/[._-]/g, ' ').split(' ').filter(Boolean);
    if (!parts.length) return fallback;
    return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }
}
