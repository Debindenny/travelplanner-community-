import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
    selector: 'app-section-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgClass],
    template: `
    <div
      class="mx-auto w-full scroll-mt-[7.75rem] text-center"
      [ngClass]="{ 'max-w-[846px]': narrow }"
    >
      <div class="relative inline-block">
        @if (watermark) {
          <p
            class="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap bg-gradient-to-t from-transparent from-[24%] to-border/50 bg-clip-text font-[Inter,sans-serif] font-black leading-none text-transparent"
            [ngClass]="subtleWatermark
              ? 'text-[clamp(1.5rem,3.5vw,40px)] opacity-35'
              : 'text-[clamp(2rem,5vw,64px)]'"
            aria-hidden="true"
          >
            {{ watermark }}
          </p>
        }
        <h2
          class="relative text-[clamp(2rem,4vw,48px)] font-bold leading-tight text-text-primary"
          [ngClass]="watermark ? 'pt-6' : 'pt-2'"
        >
          {{ title }}
        </h2>
      </div>
      @if (subtitle) {
        <p class="section-subheading mt-3">{{ subtitle }}</p>
      }
    </div>
  `
})
export class SectionHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle = '';
  @Input() watermark = '';
  @Input() narrow = true;
  /** Softer watermark for mid-page sections so titles stay readable. */
  @Input() subtleWatermark = false;
}
