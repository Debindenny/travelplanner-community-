import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { unsplashUrl } from '../../../../../shared/utils/unsplash';

@Component({
  selector: 'app-hero-card',
  imports: [IconComponent],
  templateUrl: './hero-card.component.html',
  styleUrl: './hero-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroCardComponent {
  readonly hasTrip = input.required<boolean>();
  readonly destinationImage = input(unsplashUrl('1502602898657-3e91760cbb34', 1600));

  readonly planText = model('');

  readonly exploreDestination = output<void>();
  readonly findTravelers = output<void>();
  readonly openTrip = output<void>();
  readonly toggleHeroTrip = output<void>();
  readonly buildItinerary = output<void>();
}
