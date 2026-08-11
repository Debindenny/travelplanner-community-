import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { JourneyStat } from '../../../../../../core/models/community.models';

@Component({
  selector: 'app-journey-card',
  imports: [],
  templateUrl: './journey-card.component.html',
  styleUrl: './journey-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyCardComponent {
  readonly stats = input<JourneyStat[]>([]);
  readonly xpPercent = input(34);
  readonly level = input('Wanderer');
  readonly levelBadge = input('LV.1');
  readonly xpToNext = input('200 XP to Explorer');
}
