import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { avatarPhotoUrl } from '../../../../../shared/utils/unsplash';
import { TravelMatch } from '../../../../../core/models/community.models';

@Component({
  selector: 'app-similar-travelers',
  imports: [],
  templateUrl: './similar-travelers.component.html',
  styleUrl: './similar-travelers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimilarTravelersComponent {
  readonly matches = input<TravelMatch[]>([]);
  readonly followedIds = input<ReadonlySet<string>>(new Set());

  readonly seeAll = output<void>();
  readonly viewProfile = output<TravelMatch>();
  readonly toggleFollow = output<TravelMatch>();

  avatarFor(match: TravelMatch): string {
    return avatarPhotoUrl(match.name, 92);
  }
}
