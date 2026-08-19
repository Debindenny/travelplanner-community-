import { Component, Input, OnDestroy, OnInit, signal } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'app-loading-overlay',
    imports: [TranslatePipe],
    template: `
    <div
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
      role="status"
      aria-live="polite"
      [attr.aria-label]="message | translate"
    >
      <div class="flex flex-col items-center px-6">
        <div class="relative mb-8 flex w-full max-w-[520px] items-center justify-center">
          <div class="absolute left-0 right-0 top-1/2 h-px border-t border-dashed border-[#B3D4FF]"></div>

          <div
            class="relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-primary bg-[#F5F9FF] shadow-[0_4px_24px_rgba(0,96,234,0.12)]"
          >
            @for (icon of icons; track icon.src; let i = $index) {
              <img
                [src]="icon.src"
                [alt]="icon.alt | translate"
                class="absolute h-10 w-10 object-contain transition-all duration-300"
                [class.opacity-100]="activeIndex() === i"
                [class.scale-100]="activeIndex() === i"
                [class.opacity-0]="activeIndex() !== i"
                [class.scale-75]="activeIndex() !== i"
              />
            }
          </div>
        </div>

        <p class="text-base font-normal text-primary">{{ message | translate }}</p>
      </div>
    </div>
  `
})
export class LoadingOverlayComponent implements OnInit, OnDestroy {
  // Translation key by default; callers may still pass literal text — the
  // template's | translate pipe passes unknown keys through unchanged.
  @Input() message = 'SHARED.FETCHING_FOR_YOU';

  readonly icons = [
    { src: 'assets/icons/passport.svg', alt: 'SHARED.ICON_PASSPORT' },
    { src: 'assets/icons/location.svg', alt: 'SHARED.ICON_DESTINATION' },
    { src: 'assets/icons/plane.svg', alt: 'SHARED.ICON_FLIGHT' },
    { src: 'assets/icons/car.svg', alt: 'SHARED.ICON_CAR' },
    { src: 'assets/icons/cab.svg', alt: 'SHARED.ICON_TRANSPORT' },
    { src: 'assets/icons/rental-car.svg', alt: 'SHARED.ICON_RENTAL_CAR' },
    { src: 'assets/icons/trip.svg', alt: 'SHARED.ICON_TRIP' },
  ];

  readonly activeIndex = signal(0);

  private intervalId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.intervalId = setInterval(() => {
      this.activeIndex.update((index) => (index + 1) % this.icons.length);
    }, 700);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
