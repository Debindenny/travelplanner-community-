import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { FeedFilter } from '../../../../../core/models/community.models';

@Component({
  selector: 'app-feed-filter-bar',
  imports: [IconComponent],
  templateUrl: './feed-filter-bar.component.html',
  styleUrl: './feed-filter-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedFilterBarComponent {
  readonly filters: FeedFilter[] = ['For You', 'Following', 'Near My Trip', 'Questions', 'Trip Plans', 'Tips', 'Photos'];

  readonly activeFilter = input.required<FeedFilter>();
  readonly destinationFilter = input.required<string>();

  readonly selectFilter = output<FeedFilter>();
  readonly cycleDestination = output<void>();
}
