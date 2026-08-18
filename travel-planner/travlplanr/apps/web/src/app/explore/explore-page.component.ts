import { Component, inject, signal, computed, effect, OnInit, OnDestroy, NgZone, ElementRef, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { DecimalPipe, NgClass } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  DESTINATION_FILTERS,
  DestinationFilter,
} from '../shared/data/destinations.data';
import { NavbarComponent } from '../landing/components/navbar/navbar.component';
import { DestinationTypeaheadComponent } from '../shared/components/destination-typeahead/destination-typeahead.component';
import { SearchFieldComponent } from '../shared/components/search-field/search-field.component';
import { SearchPlanAssistComponent } from '../shared/components/search-plan-assist/search-plan-assist.component';
import { TripSlotsRowComponent } from '../shared/components/trip-slots-row/trip-slots-row.component';
import { SeoService } from '../shared/services/seo.service';
import { DestinationSearchService } from '../shared/services/destination-search.service';
import { TravelChatSessionService } from '../shared/services/travel-chat-session.service';
import { DestinationListItem } from '../shared/utils/destination.util';
import { ExploreMapComponent } from './components/explore-map.component';
import { FooterSectionComponent } from '../landing/components/footer-section/footer-section.component';
import { DestinationCardComponent } from './components/destination-card.component';
import { AtmospherePanelComponent } from 'ui';
import { LocaleService } from '../core/services/locale.service';

@Component({
    selector: 'app-explore-page',
    imports: [NavbarComponent, DecimalPipe, TranslatePipe, NgClass, ExploreMapComponent, FooterSectionComponent, SearchFieldComponent, DestinationTypeaheadComponent, SearchPlanAssistComponent, TripSlotsRowComponent, DestinationCardComponent, AtmospherePanelComponent],
    template: `
    <div class="min-h-screen bg-surface-muted pt-[73px]">
      <app-navbar variant="solid" [showUserActions]="true" />

      <!-- Hero Header & Ambient Glow Container -->
      <div class="relative overflow-hidden bg-gradient-to-b from-white via-surface-muted/60 to-surface-muted pt-10 pb-8 px-4 lg:px-8 border-b border-border/40">
        
        <!-- Ambient Radial Glow background effect -->
        <div class="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[850px] h-[360px] bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.12),transparent_70%)] blur-2xl"></div>

        <div class="relative max-w-7xl mx-auto">
          
          <!-- Hero Header -->
          <header class="mb-8 max-w-3xl animate-fade-in-up">
            <div class="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-2xs font-bold uppercase tracking-[0.2em] text-primary border border-primary/20 shadow-[0_0_12px_rgba(59,130,246,0.12)]">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Travel Radar
            </div>
            <h1 class="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-none text-text-primary">
              Where will you <span class="bg-gradient-to-r from-primary via-indigo-600 to-blue-500 bg-clip-text text-transparent">go next?</span>
            </h1>
            <p class="mt-3.5 text-base sm:text-lg text-text-secondary font-normal leading-relaxed max-w-2xl">
              {{ 'EXPLORE.HEADER_SUBTITLE' | translate }}
            </p>
          </header>

          <!-- Double-Bezel Command Shell (Doppelrand Architecture) -->
          <div class="rounded-[2.25rem] bg-white/90 backdrop-blur-xl border border-border/80 p-3.5 md:p-4 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_20px_48px_-12px_rgba(0,0,0,0.09)]">
            <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
              
              <!-- Magic Search Core Input Shell -->
              <div #searchShell class="relative w-full min-w-0 flex-1">
                <app-trip-slots-row tone="light" />
                <app-search-plan-assist tone="light" />
                <app-search-field
                  [value]="queryText()"
                  (valueChange)="onQueryChange($event)"
                  (focused)="onSearchFocus()"
                  (blurred)="onSearchBlur()"
                  (keydown)="onSearchKeydown($event)"
                  [placeholder]="'EXPLORE.MAGIC_SEARCH_PLACEHOLDER' | translate"
                  [ariaLabel]="'EXPLORE.SEARCH_ARIA' | translate"
                  prefixIcon="sparkle"
                  variant="surface"
                  [debounceMs]="0"
                  [combobox]="true"
                  listboxId="explore-dest-listbox"
                  [ariaExpanded]="typeaheadPanelOpen()"
                  [ariaActiveDescendant]="exploreTypeahead()?.activeOptionId() ?? null"
                />
                <app-destination-typeahead
                  listboxId="explore-dest-listbox"
                  [query]="queryText()"
                  [enabled]="true"
                  presentation="dropdown"
                  variant="surface"
                  [open]="typeaheadPanelOpen()"
                  [loadingLabel]="'EXPLORE.SEARCHING' | translate"
                  [emptyLabel]="'EXPLORE.NO_TYPEAHEAD_RESULTS' | translate"
                  (picked)="onTypeaheadPicked($event)"
                  (dismissed)="closeTypeahead()"
                />
              </div>

              <!-- Control & Filter Bar -->
              <div class="flex flex-wrap md:flex-nowrap items-center justify-between gap-3">
                
                <!-- View Mode Segmented Pill -->
                <div class="flex items-center bg-surface-muted/90 rounded-full border border-border/70 p-1 shrink-0 shadow-inner">
                  <button
                    type="button"
                    (click)="viewMode.set('grid')"
                    class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer active:scale-95 group"
                    [class]="viewMode() === 'grid' ? 'bg-primary text-white shadow-md shadow-primary/25 scale-[1.02]' : 'text-text-secondary hover:text-text-primary'"
                    [title]="'EXPLORE.VIEW_GRID' | translate"
                  >
                    <svg class="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7" rx="2" fill="currentColor" fill-opacity="0.2"/>
                      <rect x="14" y="3" width="7" height="7" rx="2" fill="currentColor" fill-opacity="0.2"/>
                      <rect x="14" y="14" width="7" height="7" rx="2" fill="currentColor" fill-opacity="0.2"/>
                      <rect x="3" y="14" width="7" height="7" rx="2" fill="currentColor" fill-opacity="0.2"/>
                    </svg>
                    Grid
                  </button>
                  <button
                    type="button"
                    (click)="viewMode.set('map')"
                    class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer active:scale-95 group"
                    [class]="viewMode() === 'map' ? 'bg-primary text-white shadow-md shadow-primary/25 scale-[1.02]' : 'text-text-secondary hover:text-text-primary'"
                    [title]="'EXPLORE.VIEW_MAP' | translate"
                  >
                    <svg class="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                    </svg>
                    Map
                  </button>
                </div>

                <div class="hidden md:block w-px h-6 bg-border/60 shrink-0"></div>

                <!-- Precision Vector Filter Pill Strip -->
                <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 max-w-full">
                  @for (filter of filters; track filter.id) {
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ease-out active:scale-95 cursor-pointer group"
                      [class]="activeFilters().has(filter.id) 
                        ? 'border-primary/40 bg-primary/10 text-primary font-bold shadow-sm shadow-primary/15 ring-1 ring-primary/20 scale-[1.02]' 
                        : 'border-border/80 bg-white text-text-secondary hover:border-gray-300 hover:text-text-primary hover:bg-surface-muted/50'"
                      [attr.aria-pressed]="activeFilters().has(filter.id)"
                      (click)="toggleFilter(filter.id)"
                    >
                      <!-- Precision Vector SVG Icons -->
                      @switch (filter.id) {
                        @case ('in-season') {
                          <svg class="w-3.5 h-3.5 text-amber-500 group-hover:rotate-45 transition-transform duration-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="4" fill="currentColor" fill-opacity="0.25"/>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.071-7.071l-1.414 1.414M6.343 17.657l-1.414 1.414m12.728 0l-1.414-1.414M6.343 6.343L4.929 4.929"/>
                          </svg>
                        }
                        @case ('honeymoon') {
                          <svg class="w-3.5 h-3.5 text-rose-500 group-hover:scale-110 transition-transform duration-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.684a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" fill="currentColor" fill-opacity="0.25"/>
                          </svg>
                        }
                        @case ('trending') {
                          <svg class="w-3.5 h-3.5 text-orange-500 group-hover:scale-110 transition-transform duration-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" fill="currentColor" fill-opacity="0.2"/>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                          </svg>
                        }
                        @case ('budget') {
                          <svg class="w-3.5 h-3.5 text-emerald-500 group-hover:scale-110 transition-transform duration-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" fill="currentColor" fill-opacity="0.2"/>
                          </svg>
                        }
                        @case ('family') {
                          <svg class="w-3.5 h-3.5 text-indigo-500 group-hover:scale-110 transition-transform duration-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" fill="currentColor" fill-opacity="0.2"/>
                          </svg>
                        }
                        @case ('popular') {
                          <svg class="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform duration-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" fill="currentColor" fill-opacity="0.3"/>
                          </svg>
                        }
                      }
                      <span>{{ 'EXPLORE.FILTERS.' + filter.id | translate }}</span>
                    </button>
                  }
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      <div class="w-full px-4 lg:px-8 pb-20 pt-8 max-w-7xl mx-auto">

        <!-- Loading / Error -->
        @if (isLoading()) {
          <div class="py-20 flex justify-center">
            <div class="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
          </div>
        } @else if (error()) {
          <div class="py-20 text-center text-red-500">
            <p>{{ error()! | translate }}</p>
            <button class="mt-4 px-6 py-2 bg-primary text-white rounded-full font-semibold" (click)="loadDestinations()">{{ 'EXPLORE.RETRY' | translate }}</button>
          </div>
        } @else {
          
          <!-- If Map Mode is active -->
          @if (viewMode() === 'map') {
            <div class="mb-6 text-sm font-semibold text-text-secondary">
              {{ 'EXPLORE.MAPPING_COUNT' | translate: { n: filteredDestinations().length } }}
            </div>
            <div class="relative">
              <app-explore-map
                [destinations]="filteredDestinations()"
                [selectedDestinationName]="selectedDestination()?.name ?? null"
                (destinationSelected)="selectedDestination.set($event)"
              />
              @if (selectedDestination(); as selected) {
                <div class="pointer-events-none absolute inset-y-4 right-4 z-[1000] flex w-full max-w-xs items-start md:max-w-sm">
                  <div class="pointer-events-auto w-full">
                    <app-atmosphere-panel surface="glass">
                      <div class="mb-2 flex items-center justify-between">
                        <span class="route-signal">{{ 'EXPLORE.SELECTED' | translate }}</span>
                        <button
                          type="button"
                          class="rounded-full p-1 text-white/70 hover:text-white"
                          [attr.aria-label]="'EXPLORE.MAP.CLOSE_SELECTED' | translate"
                          (click)="selectedDestination.set(null)"
                        >
                          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
                          </svg>
                        </button>
                      </div>
                      <app-destination-card
                        [destination]="selected"
                        (planRequested)="onPlanDestination($event)"
                        (quickPlanRequested)="quickPlan($event.destination, $event.days)"
                        (packagesRequested)="viewPackages($event)"
                      />
                    </app-atmosphere-panel>
                  </div>
                </div>
              }
            </div>
          } @else {
            <!-- If Searching, show grid. Otherwise, show curated rows. -->
            @if (queryText() || activeFilters().size) {
            <div class="mb-6 text-sm font-semibold text-text-secondary" aria-live="polite">
              {{ 'EXPLORE.FOUND_COUNT' | translate: { n: filteredDestinations().length } }}
            </div>
            @if (filteredDestinations().length) {
              <ul class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                @for (dest of filteredDestinations(); track dest.name) {
                  <app-destination-card
                    [destination]="dest"
                    (planRequested)="onPlanDestination($event)"
                    (quickPlanRequested)="quickPlan($event.destination, $event.days)"
                    (packagesRequested)="viewPackages($event)"
                  />
                }
              </ul>
            } @else {
              <div class="py-16 text-center">
                <p class="text-text-secondary mb-4">{{ 'EXPLORE.NO_RESULTS' | translate }}</p>
                <div class="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    class="px-6 py-2 bg-primary text-white rounded-full font-semibold"
                    (click)="planWithAssistant()"
                  >
                    {{ 'EXPLORE.PLAN_TRIP' | translate }}
                  </button>
                  <button
                    type="button"
                    class="px-6 py-2 bg-white border border-border text-text-primary rounded-full font-semibold"
                    (click)="viewPackages(queryText())"
                  >
                    {{ 'EXPLORE.BROWSE_PACKAGES' | translate }}
                  </button>
                </div>
              </div>
            }
          } @else {
            <div class="flex flex-col gap-12">
              
              <!-- Trending Row -->
              <section>
                <div class="flex items-center gap-2 mb-4">
                  <span class="p-1.5 rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/20">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" fill="currentColor" fill-opacity="0.2"/>
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                  </span>
                  <h2 class="text-2xl font-bold text-text-primary tracking-tight">{{ 'EXPLORE.TRENDING_NOW' | translate }}</h2>
                </div>
                <div class="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
                  @for (dest of trendingDestinations(); track dest.name) {
                    <div class="w-[280px] shrink-0 snap-start">
                      <app-destination-card
                        [destination]="dest"
                        (planRequested)="onPlanDestination($event)"
                        (quickPlanRequested)="quickPlan($event.destination, $event.days)"
                        (packagesRequested)="viewPackages($event)"
                      />
                    </div>
                  }
                </div>
              </section>

              <!-- Weekend Getaways Row -->
              <section>
                <div class="flex items-center gap-2 mb-4">
                  <span class="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" fill="currentColor" fill-opacity="0.15"/>
                    </svg>
                  </span>
                  <h2 class="text-2xl font-bold text-text-primary tracking-tight">{{ 'EXPLORE.WEEKEND_GETAWAYS' | translate }}</h2>
                </div>
                <div class="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
                  @for (dest of weekendDestinations(); track dest.name) {
                    <div class="w-[280px] shrink-0 snap-start">
                      <app-destination-card
                        [destination]="dest"
                        (planRequested)="onPlanDestination($event)"
                        (quickPlanRequested)="quickPlan($event.destination, $event.days)"
                        (packagesRequested)="viewPackages($event)"
                      />
                    </div>
                  }
                </div>
              </section>

              <!-- Budget Friendly Row -->
              <section>
                <div class="flex items-center gap-2 mb-4">
                  <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" fill="currentColor" fill-opacity="0.2"/>
                    </svg>
                  </span>
                  <h2 class="text-2xl font-bold text-text-primary tracking-tight">{{ 'EXPLORE.BUDGET_FRIENDLY' | translate }}</h2>
                </div>
                <div class="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
                  @for (dest of budgetDestinations(); track dest.name) {
                    <div class="w-[280px] shrink-0 snap-start">
                      <app-destination-card
                        [destination]="dest"
                        (planRequested)="onPlanDestination($event)"
                        (quickPlanRequested)="quickPlan($event.destination, $event.days)"
                        (packagesRequested)="viewPackages($event)"
                      />
                    </div>
                  }
                </div>
              </section>
            </div>
          }
        }
        }
      </div>
      <app-footer-section />
    </div>
  `,
    styles: [`
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `]
})
export class ExplorePageComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly translate = inject(TranslateService);
  private readonly destinationSearch = inject(DestinationSearchService);
  private readonly chat = inject(TravelChatSessionService);
  private readonly ngZone = inject(NgZone);
  private readonly locale = inject(LocaleService);
  private lastCurrencyEpoch = 0;
  readonly exploreTypeahead = viewChild(DestinationTypeaheadComponent);
  private readonly searchShell = viewChild<ElementRef<HTMLElement>>('searchShell');

  readonly filters = DESTINATION_FILTERS;

  readonly viewMode = signal<'grid' | 'map'>('grid');
  /** Map View only — set on pin click, opens the connected destination panel. */
  readonly selectedDestination = signal<DestinationListItem | null>(null);
  readonly queryText = signal('');
  /** Parent-owned open flag for the explore search dropdown. */
  readonly typeaheadPanelOpen = signal(false);
  private readonly debouncedQueryText = toSignal(
    toObservable(this.queryText).pipe(debounceTime(200)),
    { initialValue: '' },
  );
  readonly activeFilters = signal<Set<DestinationFilter>>(new Set());

  readonly isLoading = this.destinationSearch.isLoading;
  readonly error = computed(() => (this.destinationSearch.error() ? 'EXPLORE.LOAD_ERROR' : null));
  readonly destinations = this.destinationSearch.all;

  // Derived Collections
  readonly trendingDestinations = computed(() => this.destinations().slice(0, 8));
  readonly weekendDestinations = computed(() => this.destinations().filter(d => d.tags?.some(t => /beach|city break/i.test(t))).slice(0, 8));
  readonly budgetDestinations = computed(() => this.destinations().filter(d => Number(d.price || 99999) < 25000).slice(0, 8));

  readonly filteredDestinations = computed(() => {
    const q = this.debouncedQueryText();
    const activeFilters = this.activeFilters();
    if (!q && !activeFilters.size) return this.destinations();
    return this.destinationSearch.filter(q, activeFilters);
  });

  constructor() {
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('pointerdown', this.onDocPointerDown, true);
      window.addEventListener('scroll', this.onDocScroll, true);
    });

    effect(() => {
      const q = this.debouncedQueryText().trim();
      if (q.length >= 2 && this.filteredDestinations().length === 0) {
        this.destinationSearch.search(q, 24).subscribe();
      }
    });

    // Debounced URL sync so typing does not fire a NavigationEnd per keystroke.
    effect(() => {
      const q = this.debouncedQueryText();
      const current = this.route.snapshot.queryParamMap.get('q') ?? '';
      if (q === current) return;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { q: q || null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });

    effect(() => {
      const epoch = this.locale.currencyEpoch();
      if (epoch <= this.lastCurrencyEpoch) return;
      this.lastCurrencyEpoch = epoch;
      this.loadDestinations();
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.seo.set({
      title: this.translate.instant('EXPLORE.SEO_TITLE'),
      description: this.translate.instant('EXPLORE.SEO_DESCRIPTION'),
    });
    const q = this.route.snapshot.queryParamMap.get('q');
    if (q) {
      this.queryText.set(q);
    }
    this.loadDestinations();
  }

  ngOnDestroy(): void {
    document.removeEventListener('pointerdown', this.onDocPointerDown, true);
    window.removeEventListener('scroll', this.onDocScroll, true);
  }

  loadDestinations() {
    this.destinationSearch.load();
  }

  closeTypeahead(): void {
    if (!this.typeaheadPanelOpen()) return;
    this.typeaheadPanelOpen.set(false);
    this.exploreTypeahead()?.resetActiveIndex();
  }

  private readonly onDocPointerDown = (event: Event) => {
    if (!this.typeaheadPanelOpen()) return;
    const shell = this.searchShell()?.nativeElement;
    const target = event.target;
    if (shell && target instanceof Node && shell.contains(target)) return;
    this.ngZone.run(() => this.closeTypeahead());
  };

  private readonly onDocScroll = (event: Event) => {
    if (!this.typeaheadPanelOpen()) return;
    const typeahead = this.exploreTypeahead();
    // Keep open only when scrolling inside the dropdown list itself.
    if (typeahead?.containsTarget(event.target)) return;
    this.ngZone.run(() => this.closeTypeahead());
  };

  onQueryChange(value: string): void {
    this.queryText.set(value);
    this.exploreTypeahead()?.resetActiveIndex();
    this.typeaheadPanelOpen.set(true);
  }

  onSearchFocus(): void {
    this.destinationSearch.load();
    this.typeaheadPanelOpen.set(true);
  }

  onSearchBlur(): void {
    // Option rows call preventDefault on mousedown so blur does not fire when picking.
    setTimeout(() => {
      if (!this.typeaheadPanelOpen()) return;
      const shell = this.searchShell()?.nativeElement;
      const active = document.activeElement;
      if (shell && active && shell.contains(active)) return;
      this.closeTypeahead();
    }, 0);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (this.exploreTypeahead()?.handleKeydown(event)) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      void this.submitSearchPlan();
    }
  }

  onTypeaheadPicked(item: DestinationListItem): void {
    this.closeTypeahead();
    this.queryText.set(item.name);
    void this.chat.planDestination(item.name);
  }

  toggleFilter(filter: DestinationFilter): void {
    this.activeFilters.update((current) => {
      const next = new Set(current);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  }

  async submitSearchPlan(): Promise<void> {
    const query = this.queryText().trim();
    if (!query || this.chat.sending()) return;
    this.closeTypeahead();
    await this.chat.planFromSearchQuery(query);
  }

  planWithAssistant(): void {
    const query = this.queryText().trim();
    void this.chat.planFromSearchQuery(
      query || this.translate.instant('SHARED.STARTER_WEEKEND'),
    );
  }

  onPlanDestination(destination: string): void {
    if (!destination) return;
    void this.chat.planDestination(destination);
  }

  quickPlan(destination: string, days: number): void {
    if (!destination) return;
    void this.chat.planDestination(destination, days);
  }

  viewPackages(destination: string): void {
    if (!destination) return;
    this.router.navigate(['/packages'], { queryParams: { region: destination } });
  }
}
