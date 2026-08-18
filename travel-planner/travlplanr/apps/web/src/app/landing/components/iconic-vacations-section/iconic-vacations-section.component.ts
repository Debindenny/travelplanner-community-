import { Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DestinationGridSectionComponent } from '../destination-grid-section/destination-grid-section.component';
import { BEYOND_TOURIST_TRAIL } from '../../../shared/data/landing.data';

@Component({
  selector: 'app-iconic-vacations-section',
  standalone: true,
  imports: [DestinationGridSectionComponent, TranslatePipe],
  template: `
    <app-destination-grid-section
      [title]="'LANDING.ICONIC.TITLE' | translate"
      [watermark]="'LANDING.ICONIC.TITLE' | translate"
      [subtitle]="'LANDING.ICONIC.SUBTITLE' | translate"
      bentoClass="bento-iconic"
      [destinations]="destinations"
    />
  `,
})
export class IconicVacationsSectionComponent {
  @Input() destinations: any[] = BEYOND_TOURIST_TRAIL;
}
