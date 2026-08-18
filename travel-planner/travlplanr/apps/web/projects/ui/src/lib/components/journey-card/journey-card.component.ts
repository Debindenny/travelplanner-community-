import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Generic slotted card shell. Destination/Package/Trip/Community/Admin cards
 * compose this rather than each defining their own card chrome — keeps card
 * treatments consistent as new surfaces adopt the Aero Cartography system.
 */
@Component({
  selector: 'app-journey-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="journey-card group"
      [class.cursor-pointer]="interactive"
    >
      @if (hasImage) {
        <div class="relative aspect-[16/10] w-full overflow-hidden">
          <ng-content select="[journeyCardImage]"></ng-content>
        </div>
      }
      <div class="flex flex-col gap-2 p-card">
        <ng-content select="[journeyCardHeader]"></ng-content>
        <ng-content select="[journeyCardBody]"></ng-content>
        <ng-content select="[journeyCardFooter]"></ng-content>
      </div>
    </article>
  `
})
export class JourneyCardComponent {
  /** Reserves the image slot's box even before content projects in (avoids layout shift). */
  @Input() hasImage = false;
  @Input() interactive = true;
}
