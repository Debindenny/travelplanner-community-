import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { TrendingItem } from '../../../../../../core/models/community.models';

@Component({
  selector: 'app-trending-card',
  imports: [],
  templateUrl: './trending-card.component.html',
  styleUrl: './trending-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrendingCardComponent {
  readonly trending = input<TrendingItem[]>([]);
  readonly destination = input('Paris');

  readonly open = output<TrendingItem>();
}
