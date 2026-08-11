import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { avatarPhotoUrl } from '../../../../../../shared/utils/unsplash';
import { TravelerRailItem } from '../../../../../../core/models/community.models';

@Component({
  selector: 'app-travelers-rail-card',
  imports: [],
  templateUrl: './travelers-rail-card.component.html',
  styleUrl: './travelers-rail-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TravelersRailCardComponent {
  readonly travelers = input<TravelerRailItem[]>([]);
  readonly followedIds = input<ReadonlySet<string>>(new Set());

  readonly toggleFollow = output<TravelerRailItem>();

  avatarFor(traveler: TravelerRailItem): string {
    return avatarPhotoUrl(traveler.name, 72);
  }
}
