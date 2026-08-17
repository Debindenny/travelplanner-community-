import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { DiscoverItem } from '../../../../../core/models/community.models';
import { avatarPhotoUrl } from '../../../../../shared/utils/unsplash';

@Component({
  selector: 'app-discover-detail-modal',
  imports: [IconComponent],
  templateUrl: './discover-detail-modal.component.html',
  styleUrl: './discover-detail-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverDetailModalComponent {
  readonly item = input.required<DiscoverItem>();
  readonly saved = input(false);
  readonly following = input(false);

  readonly close = output<void>();
  readonly addToTrip = output<void>();
  readonly toggleSave = output<void>();
  readonly toggleFollow = output<void>();

  authorAvatar(): string {
    return avatarPhotoUrl(this.item().author, 76);
  }
}
