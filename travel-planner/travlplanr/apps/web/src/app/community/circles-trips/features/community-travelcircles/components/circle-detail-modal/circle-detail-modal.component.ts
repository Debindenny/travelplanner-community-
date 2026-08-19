import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CircleMember, TravelCircleCard } from '../../data/travel-circle-cards.data';

@Component({
  selector: 'app-circle-detail-modal',
  imports: [IconComponent],
  templateUrl: './circle-detail-modal.component.html',
  styleUrl: './circle-detail-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CircleDetailModalComponent {
  readonly circle = input.required<TravelCircleCard>();
  readonly actionLabel = input.required<string>();
  readonly isMember = input(false);
  readonly isOwner = input(false);
  readonly isRecentlyActive = input(false);

  readonly close = output<void>();
  readonly toggleMembership = output<void>();

  memberSubtext(member: CircleMember): string {
    return member.role === 'Host' ? `Host · ${member.location}` : `${member.location} · ${member.joinedLabel}`;
  }
}
