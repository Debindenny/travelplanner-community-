import { Component, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-trust-strip',
  standalone: true,
  imports: [TranslatePipe],
  styles: [
    `
      :host { display: block; width: 100%; }

      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .trust-item {
        animation: fadeUp 0.5s ease both;
      }
      .trust-item:nth-child(1) { animation-delay: 0.05s; }
      .trust-item:nth-child(2) { animation-delay: 0.15s; }
      .trust-item:nth-child(3) { animation-delay: 0.25s; }
      .trust-item:nth-child(4) { animation-delay: 0.35s; }

      .star-fill { color: #FBBF24; }

      .divider {
        width: 1px;
        height: 36px;
        background: rgba(0,0,0,0.1);
      }
    `,
  ],
  template: `
    <div #strip class="bg-white border-b border-gray-100 shadow-sm">
      <div class="mx-auto max-w-[1280px] px-5 py-4">
        <div class="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 lg:gap-x-12">

          <!-- Star Rating -->
          <div class="trust-item flex items-center gap-2.5">
            <div class="flex gap-0.5">
              @for (s of [1,2,3,4,5]; track s) {
                <svg class="star-fill h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              }
            </div>
            <span class="text-sm font-semibold text-gray-800">4.8</span>
            <span class="text-sm text-gray-500">{{ 'LANDING.TRUST.RATED_LABEL' | translate }}</span>
          </div>

          <div class="divider hidden lg:block"></div>

          <!-- Trips Planned -->
          <div class="trust-item flex items-center gap-2">
            <span class="text-xl font-bold text-gray-900">{{ displayTrips }}</span>
            <span class="text-sm text-gray-500">{{ 'LANDING.TRUST.ITINERARIES_LABEL' | translate }}</span>
          </div>

          <div class="divider hidden lg:block"></div>

          <!-- Destinations -->
          <div class="trust-item flex items-center gap-2">
            <span class="text-xl font-bold text-gray-900">{{ displayDest }}</span>
            <span class="text-sm text-gray-500">{{ 'LANDING.TRUST.DESTINATIONS_LABEL' | translate }}</span>
          </div>

          <div class="divider hidden lg:block"></div>

          <!-- Happy Travellers -->
          <div class="trust-item flex items-center gap-2">
            <span class="text-xl font-bold text-gray-900">{{ displayTravellers }}</span>
            <span class="text-sm text-gray-500">{{ 'LANDING.TRUST.TRAVELLERS_LABEL' | translate }}</span>
          </div>

        </div>
      </div>
    </div>
  `,
})
export class TrustStripComponent implements AfterViewInit {
  @ViewChild('strip') strip!: ElementRef<HTMLDivElement>;

  displayTrips = '0';
  displayDest = '0';
  displayTravellers = '0';

  private animated = false;

  ngAfterViewInit(): void {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.animated) {
          this.animated = true;
          this.animateCount(12400, 'trips', 1200);
          this.animateCount(190, 'dest', 1000);
          this.animateCount(9800, 'travellers', 1400);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(this.strip.nativeElement);
  }

  private animateCount(target: number, field: 'trips' | 'dest' | 'travellers', duration: number): void {
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = Math.floor(eased * target);
      const formatted = value >= 1000
        ? (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1) + 'K+'
        : value + '+';
      if (field === 'trips') this.displayTrips = formatted;
      if (field === 'dest') this.displayDest = value + '+';
      if (field === 'travellers') this.displayTravellers = formatted;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
