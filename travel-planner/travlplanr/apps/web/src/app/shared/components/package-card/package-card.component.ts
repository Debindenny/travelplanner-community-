import { ChangeDetectionStrategy, Component, Input, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { PackageCard } from '../../models/landing.models';
import { humanizePackageTheme } from '../../utils/package-theme.util';

import { TranslatePipe } from '@ngx-translate/core';
import { CurrencyConverterPipe } from '../../utils/currency-converter.pipe';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

@Component({
    selector: 'app-package-card',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterModule, CurrencyConverterPipe, TranslatePipe, ImgFallbackDirective],
    template: `
    <article
      class="group relative flex w-[320px] shrink-0 flex-col overflow-hidden rounded-card border border-border bg-white shadow-sm transition-shadow duration-300 hover:shadow-[0_12px_32px_rgba(15,23,42,0.1)]"
      [class.pointer-events-none]="isPlanning()"
    >
      @if (isPlanning()) {
        <div class="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-card bg-white/80 backdrop-blur-[2px]">
          <div class="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <span class="text-xs font-semibold text-primary">{{ 'SHARED.PREPARING_ITINERARY' | translate }}</span>
        </div>
      }

      <div class="relative h-[200px] shrink-0 overflow-hidden">
        <img
          [src]="package.image"
          [alt]="package.title"
          appImgFallback
          width="320"
          height="200"
          loading="lazy"
          class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent"></div>
        <div class="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span class="rounded-full bg-white/95 px-2.5 py-1 text-2xs font-bold uppercase tracking-wide text-green-700 shadow-sm">
            {{ 'SHARED.INSTANT_BOOK' | translate }}
          </span>
          @if (package.rating != null) {
            <span class="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-2xs font-semibold text-white backdrop-blur-sm">
              <svg class="h-3 w-3 fill-amber-400" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
              {{ package.rating }}
              @if (package.reviewCount) {
                <span class="font-normal text-white/75">({{ package.reviewCount }})</span>
              }
            </span>
          }
        </div>
      </div>

      <div class="flex flex-1 flex-col gap-3 p-4">
        <div class="space-y-1">
          <h3 class="line-clamp-2 min-h-[47px] text-base-plus font-semibold leading-snug text-text-primary">
            {{ package.title }}
          </h3>
          <p class="text-lg font-bold text-text-primary">
            {{ package.price | appCurrency }}<span class="text-xs font-normal text-text-secondary">{{ 'SHARED.PER_PERSON_SUFFIX' | translate }}</span>
          </p>
        </div>

        <div class="flex flex-wrap gap-1.5">
          <span class="rounded-full bg-surface-muted px-2.5 py-1 text-2xs-plus font-medium text-text-secondary">{{ package.days }}</span>
          <span class="rounded-full bg-surface-muted px-2.5 py-1 text-2xs-plus font-medium text-text-secondary">{{ package.group }}</span>
          @if (displayTheme) {
            <span class="rounded-full bg-primary/8 px-2.5 py-1 text-2xs-plus font-medium text-primary">{{ displayTheme }}</span>
          }
        </div>

        <div class="flex items-center gap-3 text-2xs-plus text-text-secondary">
          <span class="inline-flex items-center gap-1"><span aria-hidden="true">✈️</span> {{ 'SHARED.FLIGHTS' | translate }}</span>
          <span class="inline-flex items-center gap-1"><span aria-hidden="true">🏨</span> {{ 'SHARED.HOTEL_STAY' | translate }}</span>
        </div>

        <button
          type="button"
          class="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          (click)="onCardClick($event)"
        >
          {{ 'SHARED.VIEW_ITINERARY' | translate }}
          <svg class="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </article>
  `
})
export class PackageCardComponent {
  @Input({ required: true }) package!: PackageCard;

  private readonly router = inject(Router);

  readonly isPlanning = signal(false);

  get displayTheme(): string {
    return humanizePackageTheme(this.package.theme);
  }

  onCardClick(event?: Event): void {
    event?.stopPropagation();
    if (this.package.id) {
      this.router.navigate(['/packages', this.package.id]);
    }
  }
}
