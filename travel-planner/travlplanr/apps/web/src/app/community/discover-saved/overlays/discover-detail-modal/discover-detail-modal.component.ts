import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { DsIconComponent } from '../../icon/icon.component';
import { DiscoverItem } from '../../discover-saved.models';
import { avatarPhotoUrl } from '../../discover-saved.data';

@Component({
  selector: 'app-ds-discover-detail-modal',
  imports: [DsIconComponent],
  templateUrl: './discover-detail-modal.component.html',
  styleUrl: './discover-detail-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DsDiscoverDetailModalComponent {
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
