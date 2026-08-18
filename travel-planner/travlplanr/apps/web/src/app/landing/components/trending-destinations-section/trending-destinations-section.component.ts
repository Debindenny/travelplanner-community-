import { Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DestinationGridSectionComponent } from '../destination-grid-section/destination-grid-section.component';
import { POPULAR_DESTINATIONS } from '../../../shared/data/landing.data';

@Component({
    selector: 'app-trending-destinations-section',
    imports: [DestinationGridSectionComponent, TranslatePipe],
    template: `
    <app-destination-grid-section
      sectionId="destinations"
      [title]="'LANDING.TRENDING.TITLE' | translate"
      [watermark]="'LANDING.TRENDING.WATERMARK' | translate"
      [subtitle]="'LANDING.TRENDING.SUBTITLE' | translate"
      bentoClass="bento-trending"
      [destinations]="destinations"
      [loading]="loading"
      background="white"
    />
  `
})
export class TrendingDestinationsSectionComponent {
  @Input() destinations: any[] = POPULAR_DESTINATIONS;
  @Input() loading = false;
}
