import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';

import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, firstValueFrom, of, combineLatest } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PrimaryButtonComponent } from 'ui';
import { FooterSectionComponent } from '../landing/components/footer-section/footer-section.component';
import { AuthService } from '../auth/auth.service';
import { apiUrl } from '../shared/utils/api-url';
import { SeoService } from '../shared/services/seo.service';
import { ToastService } from '../shared/utils/toast.service';
import { ChatContextService } from '../shared/services/chat-context.service';
import { parsePackageDurationDays } from '../shared/utils/package-duration.util';
import { CurrencyConverterPipe } from '../shared/utils/currency-converter.pipe';
import { SearchFieldComponent } from '../shared/components/search-field/search-field.component';
import { LocaleService } from '../core/services/locale.service';

interface PackageCard {
  id?: string;
  image: string;
  duration: string;
  title: string;
  cities: string;
  tags: string[];
  price: string | number;
  priceValue: number;
  stars: number;
  itineraryId?: string;
  group?: string;
  theme?: string;
}

interface RecommendedPackage {
  image: string;
  title: string;
  priceText: string;
}

interface PageData {
  pageTitle: string;
  pageSubtitle: string;
  heroImages: string[];
  packages: PackageCard[];
  recommended: RecommendedPackage[];
}

@Component({
    selector: 'app-packages-page',
    imports: [RouterLink, PrimaryButtonComponent, FooterSectionComponent, TranslatePipe, CurrencyConverterPipe, SearchFieldComponent],
    template: `
    @if (pageData) {
      <div class="bg-surface-muted min-h-screen pt-4">
        <div class="page-container px-5 xl:px-20 pb-20">
    
          <!-- Hero Grid - Masonry style with expansions -->
          <div class="flex h-[400px] md:h-[500px] gap-2 md:gap-4 mb-8">
            <div class="flex-1 overflow-hidden rounded-xl bg-gray-200 transition-all duration-700 ease-in-out hover:flex-[1.5] relative group">
              <img [src]="pageData.heroImages[0]" [alt]="pageData.pageTitle" class="w-full h-full object-cover">
              <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            </div>
            <div class="flex-1 flex flex-col gap-2 md:gap-4 transition-all duration-700 ease-in-out hover:flex-[1.5]">
              <div class="flex-1 overflow-hidden rounded-xl bg-gray-200 relative group">
                <img [src]="pageData.heroImages[1]" [attr.alt]="'PACKAGES.HERO.GALLERY_ALT' | translate: { n: 1 }" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
              </div>
              <div class="flex-1 overflow-hidden rounded-xl bg-gray-200 relative group">
                <img [src]="pageData.heroImages[2]" [attr.alt]="'PACKAGES.HERO.GALLERY_ALT' | translate: { n: 2 }" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
              </div>
            </div>
            <div class="flex-1 flex flex-col gap-2 md:gap-4 transition-all duration-700 ease-in-out hover:flex-[1.5]">
              <div class="flex-1 overflow-hidden rounded-xl bg-gray-200 relative group">
                <img [src]="pageData.heroImages[3]" [attr.alt]="'PACKAGES.HERO.GALLERY_ALT' | translate: { n: 3 }" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
              </div>
              <div class="flex-1 overflow-hidden rounded-xl bg-gray-200 relative group">
                <img [src]="pageData.heroImages[4]" [attr.alt]="'PACKAGES.HERO.GALLERY_ALT' | translate: { n: 4 }" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
              </div>
            </div>
          </div>
    
          <!-- Breadcrumbs & Header -->
          <div class="mb-8">
            <div class="flex items-center gap-2 text-sm text-text-secondary mb-4 flex-wrap">
              <span class="hover:text-primary cursor-pointer" routerLink="/">{{ 'PACKAGES.BREADCRUMB.HOME' | translate }}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-disabled"><polyline points="9 18 15 12 9 6"></polyline></svg>
              <a class="hover:text-primary cursor-pointer no-underline text-text-secondary" [routerLink]="['/packages']">{{ 'PACKAGES.BREADCRUMB.PACKAGES' | translate }}</a>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-disabled"><polyline points="9 18 15 12 9 6"></polyline></svg>
              <span class="text-primary font-medium">{{ pageData.pageTitle }}</span>
            </div>
    
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h1 class="text-5xl md:text-7xl font-bold text-text-primary mb-1">{{ pageData.pageTitle }}</h1>
                <p class="text-base text-text-secondary">{{ pageData.pageSubtitle }}</p>
              </div>
    
              <!-- Sort & View Switcher Container -->
              <div class="flex items-center gap-3 shrink-0 relative h-[42px]">
    
                <!-- Custom Sort Dropdown select -->
                <div class="relative h-full">
                  <button
                    (click)="isSortDropdownOpen.set(!isSortDropdownOpen())"
                    class="flex items-center justify-between gap-2 bg-surface-muted border border-border text-xs-plus font-bold text-text-primary px-3.5 h-full rounded-lg hover:bg-gray-50/80 transition-colors cursor-pointer select-none whitespace-nowrap"
                    >
                    <span>{{ 'PACKAGES.SORT.LABEL' | translate }} {{ getSelectedSortLabel() | translate }}</span>
                    <svg
                      class="w-3.5 h-3.5 text-text-secondary transition-transform duration-200"
                      [class.rotate-180]="isSortDropdownOpen()"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      viewBox="0 0 24 24"
                      >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
                    </svg>
                  </button>
    
                  <!-- Backdrop overlay to dismiss menu on clicking outside -->
                  @if (isSortDropdownOpen()) {
                    <div
                      (click)="isSortDropdownOpen.set(false)"
                      class="fixed inset-0 z-20"
                    ></div>
                  }
    
                  @if (isSortDropdownOpen()) {
                    <div
                      class="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-white shadow-[0_12px_30px_rgb(0,0,0,0.1)] py-1 z-30 animate-spring-pop origin-top-right"
                      >
                      @for (opt of sortOptions; track opt) {
                        <button
                          (click)="selectSort(opt.value)"
                          class="w-full flex items-center justify-between px-4 py-2.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors text-left font-semibold"
                          [class.text-primary]="activeSort() === opt.value"
                          [class.bg-surface-muted]="activeSort() === opt.value"
                          >
                          <span>{{ opt.labelKey | translate }}</span>
                          @if (activeSort() === opt.value) {
                            <svg class="w-3.5 h-3.5 text-primary fill-current" viewBox="0 0 20 20">
                              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                            </svg>
                          }
                        </button>
                      }
                    </div>
                  }
                </div>
    
                <!-- View Switcher (Icons Only) -->
                <div class="flex items-center bg-surface-muted rounded-lg p-1 border border-border h-full">
                  <button
                    (click)="viewMode.set('list')"
                    class="w-[32px] h-[32px] rounded transition-all flex items-center justify-center"
                    [class.bg-white]="viewMode() === 'list'"
                    [class.text-primary]="viewMode() === 'list'"
                    [class.shadow-sm]="viewMode() === 'list'"
                    [class.text-text-secondary]="viewMode() !== 'list'"
                    [attr.title]="'PACKAGES.VIEW.LIST' | translate"
                    >
                    <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                    </svg>
                  </button>
                  <button
                    (click)="viewMode.set('grid')"
                    class="w-[32px] h-[32px] rounded transition-all flex items-center justify-center"
                    [class.bg-white]="viewMode() === 'grid'"
                    [class.text-primary]="viewMode() === 'grid'"
                    [class.shadow-sm]="viewMode() === 'grid'"
                    [class.text-text-secondary]="viewMode() !== 'grid'"
                    [attr.title]="'PACKAGES.VIEW.GRID' | translate"
                    >
                    <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
    
          <div class="flex flex-col lg:flex-row gap-8">
    
            <!-- Filters Sidebar -->
            <aside class="w-full lg:w-[280px] shrink-0">
              <div class="bg-white rounded-xl border border-border p-6 shadow-sm sticky top-24 max-h-[85vh] overflow-y-auto hide-scrollbar">
    
                <div class="mb-6">
                  <h3 class="text-base font-semibold text-text-primary mb-3">{{ 'PACKAGES.FILTERS.SEARCH_LABEL' | translate }}</h3>
                  <app-search-field
                    [value]="searchQuery()"
                    (valueChange)="onSearchChange($event)"
                    [placeholder]="'PACKAGES.FILTERS.SEARCH_PLACEHOLDER' | translate"
                    [ariaLabel]="'PACKAGES.FILTERS.SEARCH_PLACEHOLDER' | translate"
                    variant="filled"
                    size="md"
                    prefixIcon="search"
                    [debounceMs]="150"
                    />
                </div>
    
                <!-- Travel Style Filter -->
                <div class="mb-6">
                  <h3 class="text-base font-semibold text-text-primary mb-3">{{ 'PACKAGES.FILTERS.TRAVEL_STYLE' | translate }}</h3>
                  <div class="flex flex-col gap-2.5">
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleGroup('couple', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.GROUP.COUPLE' | translate }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleGroup('family', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.GROUP.FAMILY' | translate }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleGroup('solo', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.GROUP.SOLO' | translate }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleGroup('friends', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.GROUP.FRIENDS' | translate }}</span>
                    </label>
                  </div>
                </div>
    
                <!-- Holiday Theme Filter -->
                <div class="mb-6">
                  <h3 class="text-base font-semibold text-text-primary mb-3">{{ 'PACKAGES.FILTERS.HOLIDAY_THEME' | translate }}</h3>
                  <div class="flex flex-col gap-2.5">
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleTheme('nature', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.THEME.NATURE' | translate }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleTheme('adventure', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.THEME.ADVENTURE' | translate }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleTheme('culture', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.THEME.CULTURE' | translate }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleTheme('leisure', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.THEME.LEISURE' | translate }}</span>
                    </label>
                  </div>
                </div>
    
                <!-- Duration Filter -->
                <div class="mb-6">
                  <h3 class="text-base font-semibold text-text-primary mb-3">{{ 'PACKAGES.FILTERS.DURATION' | translate }}</h3>
                  <div class="flex flex-col gap-2.5">
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleDuration('short', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.DURATION_OPT.SHORT' | translate }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleDuration('medium', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.DURATION_OPT.MEDIUM' | translate }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleDuration('long', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.DURATION_OPT.LONG' | translate }}</span>
                    </label>
                  </div>
                </div>
    
                <!-- Package Inclusions Filter -->
                <div class="mb-6">
                  <h3 class="text-base font-semibold text-text-primary mb-3">{{ 'PACKAGES.FILTERS.INCLUSIONS' | translate }}</h3>
                  <div class="flex flex-col gap-2.5">
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleInclusion('flights', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.INCLUSION.FLIGHTS' | translate }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleInclusion('land', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.INCLUSION.LAND' | translate }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleInclusion('transfers', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.INCLUSION.TRANSFERS' | translate }}</span>
                    </label>
                  </div>
                </div>
    
                <!-- Transit & Commute Filter -->
                <div class="mb-6">
                  <h3 class="text-base font-semibold text-text-primary mb-3">{{ 'PACKAGES.FILTERS.TRANSPORT_STYLE' | translate }}</h3>
                  <div class="flex flex-col gap-2.5">
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleTransport('cab', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.TRANSPORT_OPT.CAB' | translate }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleTransport('self', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.TRANSPORT_OPT.SELF' | translate }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleTransport('rail', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.TRANSPORT_OPT.RAIL' | translate }}</span>
                    </label>
                  </div>
                </div>
    
                <!-- Budget Filter -->
                <div class="mb-6">
                  <h3 class="text-base font-semibold text-text-primary mb-3">{{ 'PACKAGES.FILTERS.BUDGET' | translate }}</h3>
                  <div class="flex flex-col gap-3">
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleBudget('below50k', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ ('PACKAGES.FILTERS.BUDGET_OPT.BELOW_50K' | translate) | appCurrency }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleBudget('50k_75k', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ ('PACKAGES.FILTERS.BUDGET_OPT.RANGE_50K_75K' | translate) | appCurrency }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleBudget('75k_1l', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ ('PACKAGES.FILTERS.BUDGET_OPT.RANGE_75K_1L' | translate) | appCurrency }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleBudget('1l_15l', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ ('PACKAGES.FILTERS.BUDGET_OPT.RANGE_1L_15L' | translate) | appCurrency }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleBudget('15l_2l', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ ('PACKAGES.FILTERS.BUDGET_OPT.RANGE_15L_2L' | translate) | appCurrency }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleBudget('2l_25l', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ ('PACKAGES.FILTERS.BUDGET_OPT.RANGE_2L_25L' | translate) | appCurrency }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleBudget('25l_3l', $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ ('PACKAGES.FILTERS.BUDGET_OPT.RANGE_25L_3L' | translate) | appCurrency }}</span>
                    </label>
                  </div>
                </div>
    
                <!-- Stars Filter -->
                <div>
                  <h3 class="text-base font-semibold text-text-primary mb-3">{{ 'PACKAGES.FILTERS.HOTEL_RATINGS' | translate }}</h3>
                  <div class="flex flex-col gap-3">
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleStar(5, $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.STAR_OPT.FIVE' | translate }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleStar(4, $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.STAR_OPT.FOUR' | translate }}</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" (change)="toggleStar(3, $event)" class="w-5 h-5 rounded border-border text-primary focus:ring-primary">
                      <span class="text-sm-plus text-text-secondary group-hover:text-text-primary">{{ 'PACKAGES.FILTERS.STAR_OPT.THREE' | translate }}</span>
                    </label>
                  </div>
                </div>
    
              </div>
            </aside>
    
            <!-- Package Cards Container -->
            <div class="flex-1 flex flex-col">
    
              <!-- Layout Toolbar -->
              <div class="text-sm text-text-secondary font-medium mb-4">
                {{ 'PACKAGES.RESULTS.SHOWING' | translate }} <span class="text-text-primary font-bold">{{ filteredPackages().length }}</span> {{ 'PACKAGES.RESULTS.PACKAGES_LABEL' | translate }}
              </div>
    
              @if (isLoading()) {
                <div class="py-12 flex justify-center">
                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              } @else if (error()) {
                <div class="py-12 text-center text-red-500">
                  <p>{{ error()! | translate }}</p>
                </div>
              } @else if (filteredPackages().length === 0 && !isLoading()) {
                <div class="bg-white rounded-xl border border-border p-12 text-center shadow-sm">
                  <svg class="w-12 h-12 text-text-disabled mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12h8" />
                  </svg>
                  <h3 class="text-lg font-semibold text-text-primary">{{ 'PACKAGES.EMPTY.TITLE' | translate }}</h3>
                  <p class="text-text-secondary mt-1">{{ 'PACKAGES.EMPTY.SUBTITLE' | translate }}</p>
                </div>
              } @else {
    
                <!-- Conditional Grid or List render -->
                @if (viewMode() === 'grid') {
                  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    @for (pkg of filteredPackages(); track trackByPackage(pkg)) {
                      <article
                        class="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col h-[510px] group hover:shadow-md transition-shadow cursor-pointer relative"
                        [routerLink]="pkg.id ? ['/packages', pkg.id] : ['/packages']"
                        >
                        <!-- Fixed height thumbnail image -->
                        <div class="h-[200px] overflow-hidden bg-gray-100 shrink-0">
                          <img [src]="pkg.image" [alt]="pkg.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                        </div>
    
                        <!-- Flex locked dimensions -->
                        <div class="p-5 flex-1 flex flex-col justify-between min-h-0">
                          <div class="flex flex-col gap-2">
                            <div class="flex items-center justify-between text-2xs-plus font-bold text-text-tertiary">
                              <span>{{ pkg.duration }}</span>
                              <span class="text-green-500 uppercase tracking-wide animate-pulse drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]">{{ 'PACKAGES.CARD.INSTANT_BOOK' | translate }}</span>
                            </div>
                            <h2 class="text-base font-bold text-text-primary leading-snug line-clamp-2 h-[44px]">{{ pkg.title }}</h2>
                            <p class="text-xs text-text-secondary line-clamp-2 h-[32px]">{{ pkg.cities }}</p>
                          </div>
    
                          <!-- Grid Inclusion Pills -->
                          <div class="flex flex-wrap gap-1.5 py-1">
                            <span class="bg-surface-muted border border-gray-100 rounded px-2 py-1 text-2xs font-medium text-text-secondary flex items-center gap-1 select-none">✈️ {{ 'PACKAGES.CARD.PILL_FLIGHTS' | translate }}</span>
                            <span class="bg-surface-muted border border-gray-100 rounded px-2 py-1 text-2xs font-medium text-text-secondary flex items-center gap-1 select-none">🏨 {{ 'PACKAGES.CARD.PILL_STAY' | translate }}</span>
                            <span class="bg-surface-muted border border-gray-100 rounded px-2 py-1 text-2xs font-medium text-text-secondary flex items-center gap-1 select-none">🎟️ {{ 'PACKAGES.CARD.PILL_TOURS' | translate }}</span>
                          </div>
    
                          <!-- Foot Details -->
                          <div class="flex items-center justify-between pt-3 border-t border-border mt-2">
                            <div>
                              <div class="text-[9px] text-text-tertiary uppercase font-bold tracking-wider">{{ 'PACKAGES.CARD.PER_PERSON' | translate }}</div>
                              <div class="text-xl font-extrabold text-primary leading-none drop-shadow-[0_0_10px_rgba(0,96,234,0.4)]">{{ pkg.price | appCurrency }}</div>
                            </div>
                            <div class="flex items-center text-xs font-bold text-primary gap-1 group-hover:translate-x-1 transition-transform">
                              {{ 'PACKAGES.CARD.VIEW_PLAN' | translate }} ➔
                            </div>
                          </div>
                        </div>
                      </article>
                    }
                  </div>
                } @else {
                  <div class="flex flex-col gap-6">
                    @for (pkg of filteredPackages(); track trackByPackage(pkg)) {
                      <article class="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col md:flex-row md:h-[240px] group hover:shadow-md transition-shadow cursor-pointer" [routerLink]="pkg.id ? ['/packages', pkg.id] : ['/packages']">
                        <div class="w-full md:w-[280px] h-[200px] md:h-full shrink-0 overflow-hidden bg-gray-100">
                          <img [src]="pkg.image" [alt]="pkg.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                        </div>
                        <div class="p-6 flex-1 flex flex-col justify-between min-h-0">
                          <div class="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                            <div>
                              <div class="text-xs-plus font-medium text-text-tertiary mb-2">{{ pkg.duration }}</div>
                              <h2 class="text-xl font-bold text-text-primary mb-1">{{ pkg.title }}</h2>
                              <div class="text-sm text-text-secondary">{{ pkg.cities }}</div>
                            </div>
                            <div class="text-left md:text-right shrink-0">
                              <div class="text-xs text-text-tertiary mb-1">{{ 'PACKAGES.CARD.PER_PERSON' | translate }}</div>
                              <div class="text-3xl font-extrabold text-primary drop-shadow-[0_0_15px_rgba(0,96,234,0.4)]">{{ pkg.price | appCurrency }}</div>
                            </div>
                          </div>
                          <div class="flex flex-col md:flex-row justify-between items-end gap-6 mt-4">
                            <div class="grid grid-cols-2 gap-x-6 gap-y-3 flex-1">
                              @for (tag of pkg.tags; track tag) {
                                <div class="flex items-center gap-2 text-sm text-text-secondary">
                                  @if (tag.includes('★') || tag.includes('Star')) {
                                    <div class="w-5 h-5 rounded-full bg-yellow-50 flex items-center justify-center shrink-0">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="text-yellow-500"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                    </div>
                                  } @else {
                                    <div class="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="text-success dark:text-success/90" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </div>
                                  }
                                  <span class="truncate">{{ tag | translate }}</span>
                                </div>
                              }
                            </div>
                            <div class="flex flex-col sm:flex-row items-stretch gap-2 shrink-0">
                              <app-primary-button widthClass="w-full sm:w-auto" [routerLink]="pkg.id ? ['/packages', pkg.id] : ['/packages']">{{ 'PACKAGES.CARD.VIEW_DETAILS' | translate }}</app-primary-button>
                              <button class="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white rounded-btn px-6 py-2 text-sm font-medium transition-colors" (click)="$event.stopPropagation(); checkout(pkg)">{{ 'PACKAGES.CARD.BOOK_NOW' | translate }}</button>
                            </div>
                          </div>
                        </div>
                      </article>
                    }
                  </div>
                }
    
              }
            </div>
          </div>
    
          <!-- Recommended -->
          <div class="mt-16">
            <h2 class="text-3xl font-bold text-text-primary mb-6">{{ 'PACKAGES.RECOMMENDED.TITLE' | translate }}</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              @for (rec of pageData.recommended; track rec.title) {
                <article class="bg-white rounded-xl border border-border shadow-sm overflow-hidden group cursor-pointer"
                  [routerLink]="['/packages']" [queryParams]="{ region: extractRegion(rec.title) }">
                  <div class="h-[180px] overflow-hidden bg-gray-100">
                    <img [src]="rec.image" [alt]="rec.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                  </div>
                  <div class="p-5">
                    <h3 class="text-base font-bold text-text-primary mb-1">{{ rec.title }}</h3>
                    <p class="text-sm text-text-secondary">{{ 'PACKAGES.RECOMMENDED.TICKETS_FROM' | translate: { price: (extractPriceAmount(rec.priceText) | appCurrency) } }}</p>
                  </div>
                </article>
              }
            </div>
          </div>
    
        </div>
        <app-footer-section />
      </div>
    }
    `,
    styles: [`
    @keyframes spring-pop {
      0% { opacity: 0; transform: scale(0.95) translateY(-10px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    .animate-spring-pop {
      animation: spring-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
  `]
})
export class PackagesPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly chatContext = inject(ChatContextService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LocaleService);
  private readonly currencyEpoch$ = toObservable(this.locale.currencyEpoch);
  private sub?: Subscription;

  // Active filter state — all signals so computed() can track them
  readonly selectedBudgets = signal<string[]>([]);
  readonly selectedStars = signal<number[]>([]);

  readonly viewMode = signal<'grid' | 'list'>('list');
  readonly searchQuery = signal<string>('');
  readonly selectedDurations = signal<string[]>([]);
  readonly selectedGroups = signal<string[]>([]);
  readonly selectedThemes = signal<string[]>([]);
  readonly selectedInclusions = signal<string[]>([]);
  readonly selectedTransports = signal<string[]>([]);
  readonly activeSort = signal<string>('default');
  readonly isSortDropdownOpen = signal(false);

  readonly sortOptions = [
    { value: 'default', labelKey: 'PACKAGES.SORT.DEFAULT' },
    { value: 'price_asc', labelKey: 'PACKAGES.SORT.PRICE_ASC' },
    { value: 'price_desc', labelKey: 'PACKAGES.SORT.PRICE_DESC' },
    { value: 'days_asc', labelKey: 'PACKAGES.SORT.DAYS_ASC' },
    { value: 'days_desc', labelKey: 'PACKAGES.SORT.DAYS_DESC' },
    { value: 'rating_desc', labelKey: 'PACKAGES.SORT.RATING_DESC' },
  ];

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  /** Raw packages from the API — signal so filteredPackages computed() can track it. */
  readonly packages = signal<PackageCard[]>([]);

  // Initialized synchronously in ngOnInit before first render
  pageData!: PageData;

  constructor() {
    // Sync chat-driven sort order into the activeSort signal so computed() picks it up.
    effect(() => {
      const chatSort = this.chatContext.packageSortOrder();
      if (chatSort) this.activeSort.set(chatSort);
    }, { allowSignalWrites: true });
  }

  /** Memoised — only recomputes when any filter signal, packages, or chat-context signals change. */
  readonly filteredPackages = computed(() => {
    if (!this.pageData) return [];

    const queryVal = this.searchQuery().toLowerCase().trim();
    const activeDurations = this.selectedDurations();
    const activeGroups = this.selectedGroups();
    const activeThemes = this.selectedThemes();
    const activeInclusions = this.selectedInclusions();
    const activeTransports = this.selectedTransports();
    const budgets = this.selectedBudgets();
    const stars = this.selectedStars();
    const chatDays = this.chatContext.packageDurationDays();
    const maxBudget = this.chatContext.packageMaxBudget();

    let list = this.packages().filter(pkg => {
      // 1. Text Search
      if (queryVal) {
        if (!pkg.title.toLowerCase().includes(queryVal) && !pkg.cities.toLowerCase().includes(queryVal)) return false;
      }

      // 2. Duration
      if (activeDurations.length > 0) {
        const pkgDays = parsePackageDurationDays(pkg.duration) || 6;
        const matchDuration = activeDurations.some(dur =>
          (dur === 'short' && pkgDays >= 5 && pkgDays <= 7) ||
          (dur === 'medium' && pkgDays >= 8 && pkgDays <= 10) ||
          (dur === 'long' && pkgDays >= 11)
        );
        if (!matchDuration) return false;
      }

      // 3. Travel Style / Group
      if (activeGroups.length > 0) {
        const pkgGroup = (pkg.group || '').toLowerCase().trim();
        if (!activeGroups.includes(pkgGroup)) return false;
      }

      // 4. Holiday Theme
      if (activeThemes.length > 0) {
        const pkgTheme = (pkg.theme || '').toLowerCase().trim();
        if (!activeThemes.some(t => pkgTheme.includes(t))) return false;
      }

      // 5. Inclusions
      if (activeInclusions.length > 0) {
        const matchInc = activeInclusions.some(inc =>
          (inc === 'flights' && pkg.tags.includes('PACKAGES.TAGS.FLIGHTS_INCLUDED')) ||
          (inc === 'land' && pkg.tags.includes('PACKAGES.TAGS.LAND_ONLY')) ||
          (inc === 'transfers' && pkg.tags.includes('PACKAGES.TAGS.PRIVATE_CAB'))
        );
        if (!matchInc) return false;
      }

      // 6. Transport
      if (activeTransports.length > 0) {
        const matchTrans = activeTransports.some(trans =>
          (trans === 'cab' && pkg.tags.includes('PACKAGES.TAGS.PRIVATE_CAB')) ||
          (trans === 'self' && pkg.tags.includes('PACKAGES.TAGS.SELF_DRIVE')) ||
          (trans === 'rail' && !pkg.tags.includes('PACKAGES.TAGS.PRIVATE_CAB') && !pkg.tags.includes('PACKAGES.TAGS.SELF_DRIVE'))
        );
        if (!matchTrans) return false;
      }

      // 7. Budget tier
      if (budgets.length > 0) {
        const ok = budgets.some(t =>
          (t === 'below50k' && pkg.priceValue < 50000) ||
          (t === '50k_75k' && pkg.priceValue >= 50000 && pkg.priceValue <= 75000) ||
          (t === '75k_1l' && pkg.priceValue > 75000 && pkg.priceValue <= 100000) ||
          (t === '1l_15l' && pkg.priceValue > 100000 && pkg.priceValue <= 150000) ||
          (t === '15l_2l' && pkg.priceValue > 150000 && pkg.priceValue <= 200000) ||
          (t === '2l_25l' && pkg.priceValue > 200000 && pkg.priceValue <= 250000) ||
          (t === '25l_3l' && pkg.priceValue > 250000 && pkg.priceValue <= 300000)
        );
        if (!ok) return false;
      }

      // 8. Hotel stars
      if (stars.length > 0 && !stars.includes(pkg.stars)) return false;

      // 9. Chat-driven duration filter
      if (chatDays != null) {
        const pkgDays = parsePackageDurationDays(pkg.duration);
        if (pkgDays == null || pkgDays !== chatDays) return false;
      }

      // 10. Chat-driven max budget
      if (maxBudget != null && pkg.priceValue > maxBudget) return false;

      return true;
    });

    // Sorting
    const sortVal = this.activeSort();
    if (sortVal === 'price_asc') list = [...list].sort((a, b) => a.priceValue - b.priceValue);
    else if (sortVal === 'price_desc') list = [...list].sort((a, b) => b.priceValue - a.priceValue);
    else if (sortVal === 'days_asc') {
      list = [...list].sort((a, b) => (parsePackageDurationDays(a.duration) || 0) - (parsePackageDurationDays(b.duration) || 0));
    } else if (sortVal === 'days_desc') {
      list = [...list].sort((a, b) => (parsePackageDurationDays(b.duration) || 0) - (parsePackageDurationDays(a.duration) || 0));
    } else if (sortVal === 'rating_desc') {
      list = [...list].sort((a, b) => (b.stars || 0) - (a.stars || 0));
    }

    return list;
  });

  /** Plain method instead of an inline `pkg.id ?? pkg.title` track expression —
   * Angular's `@for` track codegen can reference an undefined temp variable
   * when the tracked expression uses `??` inside deeply nested control flow. */
  trackByPackage(pkg: PackageCard): string {
    return pkg.id ?? pkg.title;
  }

  ngOnInit(): void {
    this.sub = combineLatest([this.route.queryParams, this.currencyEpoch$]).pipe(
      switchMap(([params]) => {
        const hasFilter = !!(params['region'] || params['country']);
        const dest = params['region'] || params['country'] || 'All';
        this.pageData = this.buildPageData(dest);
        this.selectedBudgets.set([]);
        this.selectedStars.set([]);
        this.packages.set([]);

        this.seo.set({
          title: `${this.pageData.pageTitle} — Travl Planr`,
          description:
            `${this.pageData.pageTitle}: curated holiday packages with hotels, transfers, and activities. ${this.pageData.pageSubtitle}`,
          ogImage: this.pageData.heroImages[0],
        });

        this.isLoading.set(true);
        this.error.set(null);

        const regionParam = this.resolveApiRegion(dest);
          return this.http.get<any[]>(apiUrl('/packages'), {
          params: {
            ...(regionParam ? { region: regionParam } : {}),
            ...(this.chatContext.packageSortOrder() ? { sort_by: this.chatContext.packageSortOrder()! } : {}),
            ...(this.chatContext.packageMaxBudget() ? { max_budget: String(this.chatContext.packageMaxBudget()) } : {}),
          },
        }).pipe(
          switchMap((pkgs) => of({ pkgs, failed: false })),
          catchError((err) => {
            console.error('Failed to fetch packages from backend', err);
            return of({ pkgs: [] as any[], failed: true });
          }),
        );
      }),
    ).subscribe(({ pkgs, failed }) => {
      this.isLoading.set(false);
      const mapped = (pkgs ?? []).map((p) => {
        const priceNum = typeof p.price === 'number'
          ? Math.round(p.price)
          : parseInt(String(p.price || '').replace(/[^0-9.]/g, '') || '0', 10);

        // Build tags from real API fields — do not invent '4 ★ Hotel' etc.
        // Tags are i18n keys; the template pipes them through | translate.
        const tags: string[] = [];
        if (priceNum > 80000) tags.push('PACKAGES.TAGS.FLIGHTS_INCLUDED'); else tags.push('PACKAGES.TAGS.LAND_ONLY');
        if (p.group === 'Couple' || p.group === 'Family') tags.push('PACKAGES.TAGS.PRIVATE_CAB');
        else if (p.group === 'Solo') tags.push('PACKAGES.TAGS.SELF_DRIVE');
        else tags.push('PACKAGES.TAGS.SHARED_TRANSFERS');

        return {
          id: p.id,
          image: p.image || 'assets/images/placeholder.jpg',
          duration: p.days || '7 Days',
          title: p.title,
          cities: p.theme || '',
          tags,
          price: p.price,
          priceValue: priceNum,
          stars: p.rating || 4,
          itineraryId: p.itineraryId,
          group: p.group || 'Couple',
          theme: p.theme || 'Leisure',
        };
      });

      this.packages.set(mapped);
      // Show an error banner on fetch failure but still render any cached packages
      this.error.set(failed ? 'PACKAGES.LOAD_ERROR' : null);
      this.emitPackagesJsonLd();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private emitPackagesJsonLd(): void {
    const packages = this.packages();
    if (packages.length === 0) return;
    this.seo.setJsonLd({
      '@type': 'ItemList',
      name: this.pageData.pageTitle,
      itemListElement: packages.map((pkg, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          name: pkg.title,
          image: pkg.image,
          description: pkg.cities || this.pageData.pageSubtitle,
          ...(pkg.priceValue > 0
            ? {
                offers: {
                  '@type': 'Offer',
                  price: pkg.priceValue,
                  priceCurrency: 'INR',
                  availability: 'https://schema.org/InStock',
                },
              }
            : {}),
        },
      })),
    });
  }

  toggleBudget(tier: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.selectedBudgets.update(prev => [...prev, tier]);
    else this.selectedBudgets.update(prev => prev.filter(t => t !== tier));
  }

  toggleStar(star: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.selectedStars.update(prev => [...prev, star]);
    else this.selectedStars.update(prev => prev.filter(s => s !== star));
  }

  toggleDuration(dur: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedDurations.update((prev) => [...prev, dur]);
    } else {
      this.selectedDurations.update((prev) => prev.filter((d) => d !== dur));
    }
  }

  toggleGroup(group: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedGroups.update((prev) => [...prev, group]);
    } else {
      this.selectedGroups.update((prev) => prev.filter((g) => g !== group));
    }
  }

  toggleTheme(theme: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedThemes.update((prev) => [...prev, theme]);
    } else {
      this.selectedThemes.update((prev) => prev.filter((t) => t !== theme));
    }
  }

  toggleInclusion(inc: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedInclusions.update((prev) => [...prev, inc]);
    } else {
      this.selectedInclusions.update((prev) => prev.filter((i) => i !== inc));
    }
  }

  toggleTransport(trans: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedTransports.update((prev) => [...prev, trans]);
    } else {
      this.selectedTransports.update((prev) => prev.filter((t) => t !== trans));
    }
  }

  getSelectedSortLabel(): string {
    const active = this.activeSort();
    const opt = this.sortOptions.find((o) => o.value === active);
    return opt ? opt.labelKey : 'PACKAGES.SORT.DEFAULT';
  }

  selectSort(value: string): void {
    this.activeSort.set(value);
    this.isSortDropdownOpen.set(false);
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value || '');
  }

  /**
   * Extracts a region name from a recommended-package title like
   * "Switzerland Tour Package" → "Switzerland", used as a queryParam
   * so the link lands on the correct filtered packages page.
   */
  extractRegion(title: string): string {
    return title.replace(/\s*Tour\s*Package.*$/i, '').trim();
  }

  /**
   * The recommended-package price data is stored as a full English sentence
   * ("Tickets from ₹ 59,999/person"). Strip the "Tickets from" / "/person"
   * scaffolding so the template can translate the sentence around a
   * currency-converted amount without duplicating that text.
   */
  extractPriceAmount(priceText: string): string {
    return priceText.replace(/^Tickets from\s*/i, '').replace(/\/person\s*$/i, '').trim();
  }

  async checkout(pkg: PackageCard) {
    // Booking/payment legitimately requires an account — send guests to login
    // (the OTP flow) instead of firing a request that just 401s.
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    try {
      const id = pkg.id || pkg.itineraryId || pkg.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const response = await firstValueFrom(this.http.post<any>(apiUrl('/checkout'), {
        package_id: id,
        amount: pkg.priceValue
      }));

      if (response && response.checkout_url) {
        window.location.href = response.checkout_url;
      } else {
        this.toast.error(this.translate.instant('PACKAGES.CHECKOUT.UNAVAILABLE'));
      }
    } catch (err) {
      console.error('Checkout failed', err);
      this.toast.error(this.translate.instant('PACKAGES.CHECKOUT.UNAVAILABLE'));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Core: Build full page data from destination name
  // ─────────────────────────────────────────────────────────────────────────────
  private buildPageData(destination: string): PageData {
    const d = destination.trim();
    const norm = d.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (norm === 'all') {
      return {
        pageTitle: `All Tour Packages`,
        pageSubtitle: `Explore our most popular curated escapes across the globe, with hotels, flights, and activities included.`,
        heroImages: [
          'assets/images/packages/hero-main.png',
          'assets/images/packages/hero-extra.png',
          'assets/images/packages/hero-ireland.png',
          'assets/images/packages/hero-bottom-left.png',
          'assets/images/packages/hero-top-right.png',
        ],
        packages: [],
        recommended: [],
      };
    }

    const displayName = this.toTitleCase(d);

    // Pick the region group
    const region = this.resolveRegion(norm);

    // Get region-level data
    const regionData = this.REGIONS[region];

    // Override title & subtitle with destination-specific copy
    const subtitle = this.DESTINATION_SUBTITLES[norm]
      || this.DESTINATION_SUBTITLES[d.toLowerCase()]
      || regionData.defaultSubtitle;

    return {
      pageTitle: `${displayName} Tour Packages`,
      pageSubtitle: subtitle,
      heroImages: regionData.heroImages,
      packages: regionData.packages,
      recommended: regionData.recommended,
    };
  }

  private toTitleCase(s: string): string {
    return s.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
  }

  /** Map city/country labels from chat or links to the best API region filter. */
  private resolveApiRegion(destination: string): string | null {
    const norm = destination.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (norm === 'all') return null;
    const apiRegions: Record<string, string> = {
      dubai: 'Dubai',
      uae: 'UAE',
      unitedarabemirates: 'UAE',
      abudhabi: 'Abu Dhabi',
      doha: 'Qatar',
      qatar: 'Qatar',
      bahrain: 'Bahrain',
      muscat: 'Oman',
      kuwait: 'Kuwait',
      riyadh: 'Saudi Arabia',
      alula: 'AlUla',
      middleeast: 'Middle East',
      usa: 'USA',
      unitedstates: 'USA',
      unitedstateamerica: 'USA',
      america: 'USA',
      eastcoast: 'USA',
      westcoast: 'USA',
      newyork: 'USA',
      orlando: 'USA',
      losangeles: 'USA',
    };
    return apiRegions[norm] || destination;
  }

  private resolveRegion(norm: string): string {
    if (norm.includes('switzerland') || norm.includes('swiss')) return 'switzerland';
    if (norm.includes('malaysia') || norm.includes('kualalumpur') || norm.includes('langkawi') || norm.includes('penang')) return 'malaysia';
    if (norm.includes('maldives') || norm.includes('seychelles') || norm.includes('fiji')) return 'maldives';
    if (norm.includes('usa') || norm.includes('unitedstate') || norm.includes('america') ||
        norm.includes('newyork') || norm.includes('orlando') || norm.includes('losangeles') ||
        norm.includes('eastcoast') || norm.includes('westcoast') || norm.includes('lasvegas') ||
        norm.includes('sanfrancisco') || norm.includes('boston') || norm.includes('washington')) return 'usa';
    if (norm.includes('dubai') || norm.includes('abudhabi') || norm.includes('bahrain') ||
        norm.includes('qatar') || norm.includes('alula') || norm.includes('saudi') ||
        norm.includes('kuwait') || norm.includes('muscat') || norm.includes('doha') ||
        norm.includes('morocco') || norm.includes('egypt') || norm.includes('middleeast') ||
        norm.includes('unitedarab') || norm.includes('uae') || norm.includes('emirates')) return 'middleeast';
    if (norm.includes('singapore') || norm.includes('thailand') || norm.includes('bali') ||
        norm.includes('japan') || norm.includes('china') || norm.includes('australia') ||
        norm.includes('queensland') || norm.includes('perth') || norm.includes('philippines') ||
        norm.includes('srilanka') || norm.includes('goa') || norm.includes('kenya') ||
        norm.includes('india') || norm.includes('asia') || norm.includes('southeast') ||
        norm.includes('vietnam') || norm.includes('mauritius') || norm.includes('phuket') ||
        norm.includes('bangkok')) return 'asia';
    // Europe is the default (Belgium, Austria, London, Norway, Greece, Spain, Finland, Italy, France etc.)
    return 'europe';
  }

  // Destination-specific subtitles
  private readonly DESTINATION_SUBTITLES: Record<string, string> = {
    // Europe cities
    'belgium': 'The Capital of Europe — cobblestone streets and world-class chocolate',
    'austria': 'Modern Charm meets imperial grandeur',
    'london': 'The Heartbeat of the British Isles',
    'norway': "Scandinavia's Green Soul — fjords, aurora and midnight sun",
    'greece': 'Where History Breathes — from Athens to Santorini',
    'spain': 'Art, Energy, and Seaside Spirit',
    'finland': 'Nordic Cool, Urban Calm',
    'italy': 'The Eternal City of Passion',
    'france': 'Romance, cuisine, and timeless art',
    'europe': 'Old world Charm Country On earth',
    // Switzerland
    'switzerland': 'Scenic railways, snow peaks, and lakes of gold!',
    // Popular destinations
    'malaysia': 'Modern skylines, cultural heritage, and islands!',
    'maldives': 'Luxury overwater villas and pristine lagoons!',
    'seychelles': 'Pristine beaches and turquoise coral reefs',
    'singapore': 'The Lion City — futuristic gardens and diverse culture',
    'thailand': 'The Kingdom of Thailand — temples, beaches, and street food',
    // Middle East
    'dubai': 'The City of Life — where the future meets the desert',
    'abu dhabi': 'A step back in time through Arabian heritage',
    'abudhabi': 'A step back in time through Arabian heritage',
    'bahrain': 'Island Life Pearls of the Arabian Gulf',
    'qatar': 'Land of Luxury and rich history',
    'alula': 'The ancient wonders of Arabia',
    'saudi arabia': 'Kingdom of Contrast — desert, culture and modernity',
    'saudiarabia': 'Kingdom of Contrast — desert, culture and modernity',
    'kuwait': 'Pearl of the Gulf',
    'muscat': 'Vibrant port city of Oman',
    'doha': 'The shining jewel of Qatar',
    'morocco': 'Culture, desert, and ancient medinas',
    'egypt': 'History, Desert, and the eternal Nile',
    'middleeast': 'Futuristic architecture, desert safaris, and luxury escapes!',
    'unitedarabemirates': 'Futuristic architecture, desert safaris, and luxury escapes!',
    'uae': 'Futuristic architecture, desert safaris, and luxury escapes!',
    // USA
    'orlando': 'World theme park capital — magic and adventure await!',
    'newyork': 'The City of Skyscrapers — energy, culture and skyline',
    'new york': 'The City of Skyscrapers — energy, culture and skyline',
    'eastcoast': 'Explore along the Atlantic — history meets coastline',
    'east coast': 'Explore along the Atlantic — history meets coastline',
    'westcoast': 'Explore along the Pacific — beaches, redwoods and tech',
    'west coast': 'Explore along the Pacific — beaches, redwoods and tech',
    'losangeles': 'City of Angels — Hollywood, beaches and sunshine',
    'los angeles': 'City of Angels — Hollywood, beaches and sunshine',
    'unitedstateamerica': 'Bustling cities, theme parks, and scenic coasts!',
    'usa': 'Bustling cities, theme parks, and scenic coasts!',
    'america': 'Bustling cities, theme parks, and scenic coasts!',
    // Asia / Oceania
    'bali': 'The Island of the Gods — wellness, rice terraces, and surf',
    'japan': 'Land of the Rising Sun — cherry blossoms and ancient temples',
    'china': 'Middle Kingdom — the Great Wall to modern Shanghai',
    'australia': 'The Great Southern Land — outback, reef, and vibrant cities',
    'india': 'Incredible India — diverse culture, heritage, and spice',
    'kenya': 'Wildlife & Adventure — the Big Five await',
    'fiji': 'Luxury, Honeymoon & Island Adventure',
    'queensland': 'Nature, Reef Diving & Family Travel',
    'perth': 'Coastal City Life, Wine & Activities',
    'philippines': 'The Pearl of the Orient — 7,000 islands of beauty',
    'srilanka': 'Teardrop of India — beaches, tea hills, and ancient ruins',
    'sri lanka': 'Teardrop of India — beaches, tea hills, and ancient ruins',
    'goa': 'Beach, Nightlife & Coastal Relaxation',
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // REGION DATA
  // ─────────────────────────────────────────────────────────────────────────────
  private readonly REGIONS: Record<string, {
    defaultSubtitle: string;
    heroImages: string[];
    packages: PackageCard[];
    recommended: RecommendedPackage[];
  }> = {
    europe: {
      defaultSubtitle: 'Old world Charm Country On earth',
      heroImages: [
        'assets/images/packages/hero-extra.png',
        'assets/images/packages/hero-ireland.png',
        'assets/images/packages/hero-main.png',
        'assets/images/packages/hero-bottom-left.png',
        'assets/images/packages/hero-top-right.png',
      ],
      packages: [],
      recommended: [
        { image: 'assets/images/packages/rec_swiss.png', title: 'Switzerland Tour Package', priceText: 'Tickets from ₹ 59,999/person' },
        { image: 'assets/images/packages/rec_poland.png', title: 'Poland Tour Package', priceText: 'Tickets from ₹ 55,000/person' },
        { image: 'assets/images/packages/rec_denmark.png', title: 'Denmark Tour Package', priceText: 'Tickets from ₹ 64,000/person' },
        { image: 'assets/images/packages/rec_rome.png', title: 'Rome Tour Package', priceText: 'Tickets from ₹ 71,000/person' },
        { image: 'assets/images/packages/rec_greece.png', title: 'Greece Tour Package', priceText: 'Tickets from ₹ 58,999/person' },
      ],
    },

    switzerland: {
      defaultSubtitle: 'Scenic railways, snow peaks, and lakes of gold!',
      heroImages: [
        'assets/images/landing/package-swiss.jpg',
        'assets/images/landing/iconic-switzerland.jpg',
        'assets/images/packages/hero-bottom-left.png',
        'assets/images/landing/europe-austria.jpg',
        'assets/images/landing/europe-norway.jpg',
      ],
      packages: [],
      recommended: [
        { image: 'assets/images/landing/europe-austria.jpg', title: 'Austria Tour Package', priceText: 'Tickets from ₹ 62,000/person' },
        { image: 'assets/images/landing/europe-norway.jpg', title: 'Norway Tour Package', priceText: 'Tickets from ₹ 89,000/person' },
        { image: 'assets/images/packages/rec_rome.png', title: 'Rome Tour Package', priceText: 'Tickets from ₹ 71,000/person' },
      ],
    },

    malaysia: {
      defaultSubtitle: 'Modern skylines, cultural heritage, and islands!',
      heroImages: [
        'assets/images/landing/malaysia.jpg',
        'assets/images/landing/journey-thailand.jpg',
        'assets/images/landing/journey-philippines.jpg',
        'assets/images/landing/package-bali.jpg',
        'assets/images/landing/singapore.jpg',
      ],
      packages: [],
      recommended: [
        { image: 'assets/images/landing/singapore.jpg', title: 'Singapore Tour Package', priceText: 'Tickets from ₹ 68,000/person' },
        { image: 'assets/images/landing/thailand.jpg', title: 'Thailand Tour Package', priceText: 'Tickets from ₹ 56,000/person' },
        { image: 'assets/images/landing/package-bali.jpg', title: 'Bali Tour Package', priceText: 'Tickets from ₹ 59,999/person' },
      ],
    },

    maldives: {
      defaultSubtitle: 'Luxury overwater villas and pristine lagoons!',
      heroImages: [
        'assets/images/landing/maldives.jpg',
        'assets/images/landing/package-maldives.jpg',
        'assets/images/landing/seychelles.jpg',
        'assets/images/landing/journey-philippines.jpg',
        'assets/images/landing/journey-thailand.jpg',
      ],
      packages: [],
      recommended: [
        { image: 'assets/images/landing/seychelles.jpg', title: 'Seychelles Tour Package', priceText: 'Tickets from ₹ 75,300/person' },
        { image: 'assets/images/landing/package-bali.jpg', title: 'Bali Tour Package', priceText: 'Tickets from ₹ 59,999/person' },
      ],
    },

    usa: {
      defaultSubtitle: 'Bustling cities, theme parks, and scenic coasts!',
      heroImages: [
        'assets/images/landing/iconic-usa.jpg',
        'assets/images/landing/category-family.jpg',
        'assets/images/landing/category-friends.jpg',
        'assets/images/landing/journey-philippines.jpg',
        'assets/images/landing/package-japan.jpg',
      ],
      packages: [],
      recommended: [
        { image: 'assets/images/landing/iconic-australia.jpg', title: 'Australia Tour Package', priceText: 'Tickets from ₹ 1,05,999/person' },
        { image: 'assets/images/landing/package-japan.jpg', title: 'Japan Tour Package', priceText: 'Tickets from ₹ 84,000/person' },
      ],
    },

    middleeast: {
      defaultSubtitle: 'Futuristic architecture, desert safaris, and luxury escapes!',
      heroImages: [
        'assets/images/landing/iconic-uae.jpg',
        'assets/images/landing/journey-abudhabi.jpg',
        'assets/images/landing/journey-singapore.jpg',
        'assets/images/landing/journey-kenya.jpg',
        'assets/images/landing/package-maldives.jpg',
      ],
      packages: [],
      recommended: [
        { image: 'assets/images/landing/maldives.jpg', title: 'Maldives Resort Package', priceText: 'Tickets from ₹ 85,000/person' },
        { image: 'assets/images/landing/journey-kenya.jpg', title: 'Kenya Safari Package', priceText: 'Tickets from ₹ 95,000/person' },
      ],
    },

    asia: {
      defaultSubtitle: 'Ancient temples, tropical escapes, and cultural wonders!',
      heroImages: [
        'assets/images/landing/malaysia.jpg',
        'assets/images/landing/journey-thailand.jpg',
        'assets/images/landing/journey-philippines.jpg',
        'assets/images/landing/package-bali.jpg',
        'assets/images/landing/singapore.jpg',
      ],
      packages: [],
      recommended: [
        { image: 'assets/images/landing/package-japan.jpg', title: 'Japan Tour Package', priceText: 'Tickets from ₹ 84,000/person' },
        { image: 'assets/images/landing/journey-china.jpg', title: 'China Tour Package', priceText: 'Tickets from ₹ 78,000/person' },
        { image: 'assets/images/landing/iconic-australia.jpg', title: 'Australia Tour Package', priceText: 'Tickets from ₹ 1,05,999/person' },
      ],
    },
  };
}

