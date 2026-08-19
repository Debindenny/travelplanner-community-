import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { SignalChipComponent, TiltOnHoverDirective } from 'ui';
import { DestinationListItem } from '../../shared/utils/destination.util';
import { CurrencyConverterPipe } from '../../shared/utils/currency-converter.pipe';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';

/**
 * Full-bleed photo card with a bottom gradient overlay — matches Explore's
 * editorial/image-led density role. Reuses spring easing, glassmorphism tags,
 * and font-display typography for high-end visual polish.
 */
@Component({
    selector: 'app-destination-card',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TitleCasePipe, TranslatePipe, CurrencyConverterPipe, SignalChipComponent, TiltOnHoverDirective, ImgFallbackDirective],
    template: `
    <div
      appTiltOnHover
      (click)="onCardClick()"
      class="journey-card group relative block h-[380px] w-full cursor-pointer overflow-hidden rounded-2xl border border-white/10 shadow-md transition-all duration-500 ease-out hover:shadow-2xl hover:-translate-y-1"
    >
      @if (destination.image) {
        <img
          [src]="destination.image"
          [alt]="destination.name"
          appImgFallback
          class="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          loading="lazy"
        />
      } @else {
        <div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950">
          <span class="text-6xl animate-pulse">🌍</span>
        </div>
      }

      <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/5 opacity-85 transition-opacity duration-300 group-hover:opacity-95"></div>

      <div class="absolute right-3.5 top-3.5 z-10">
        <app-signal-chip [label]="'EXPLORE.LOOKING_COUNT' | translate: { n: lookingCount }" icon="🔥" tone="sunrise" />
      </div>

      <div class="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end p-5">
        <h3 class="font-display mb-1 text-2xl font-extrabold tracking-tight text-white transition-colors duration-300 group-hover:text-primary-200">{{ destination.name }}</h3>

        <div class="flex items-center justify-between gap-2">
          <div class="flex max-w-[70%] flex-wrap gap-1.5">
            @for (tag of (destination.tags ?? []).slice(0, 2); track tag) {
              <span class="rounded-full bg-white/15 px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-white border border-white/20 shadow-sm backdrop-blur-md">
                {{ tag.split('_').join(' ') | titlecase }}
              </span>
            }
          </div>
          @if (destination.price) {
            <div class="text-right">
              <p class="text-[9px] font-bold uppercase tracking-widest text-white/70">{{ 'EXPLORE.FROM' | translate }}</p>
              <p class="font-data text-lg font-extrabold text-white drop-shadow-sm">{{ destination.price | appCurrency }}</p>
            </div>
          }
        </div>

        <div class="mt-0 flex h-0 gap-2 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:mt-4 group-hover:h-[46px]">
          <button (click)="onQuickPlan(3, $event)" class="flex-1 rounded-xl bg-white/95 py-2 text-center text-xs font-bold text-gray-900 shadow-sm transition-all duration-200 hover:bg-white active:scale-95">
            {{ 'EXPLORE.DAYS_COUNT' | translate: { n: 3 } }}
          </button>
          <button (click)="onQuickPlan(5, $event)" class="flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 py-2 text-center text-xs font-bold text-white shadow-md shadow-primary/30 transition-all duration-200 hover:brightness-110 active:scale-95">
            {{ 'EXPLORE.DAYS_COUNT' | translate: { n: 5 } }}
          </button>
          <button (click)="onQuickPlan(7, $event)" class="flex-1 rounded-xl bg-white/95 py-2 text-center text-xs font-bold text-gray-900 shadow-sm transition-all duration-200 hover:bg-white active:scale-95">
            {{ 'EXPLORE.DAYS_COUNT' | translate: { n: 7 } }}
          </button>
        </div>
        <button
          type="button"
          class="mt-2 text-2xs font-semibold text-white/80 underline-offset-4 opacity-0 transition-all duration-200 hover:text-white hover:underline group-hover:opacity-100"
          (click)="onViewPackages($event)"
        >
          {{ 'EXPLORE.BROWSE_PACKAGES' | translate }}
        </button>
      </div>
    </div>
  `
})
export class DestinationCardComponent {
  @Input({ required: true }) destination!: DestinationListItem;

  @Output() planRequested = new EventEmitter<string>();
  @Output() quickPlanRequested = new EventEmitter<{ destination: string; days: number }>();
  @Output() packagesRequested = new EventEmitter<string>();

  /** Stable per-destination count so CD does not thrash (NG0100). */
  get lookingCount(): number {
    const name = this.destination?.name ?? '';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    return 200 + (Math.abs(hash) % 800);
  }

  onCardClick(): void {
    if (this.destination?.name) this.planRequested.emit(this.destination.name);
  }

  onQuickPlan(days: number, event: Event): void {
    event.stopPropagation();
    if (this.destination?.name) this.quickPlanRequested.emit({ destination: this.destination.name, days });
  }

  onViewPackages(event: Event): void {
    event.stopPropagation();
    if (this.destination?.name) this.packagesRequested.emit(this.destination.name);
  }
}
