import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CircleMember, TravelCircleCard } from '../../data/travel-circle-cards.data';

@Component({
  selector: 'app-circle-detail-modal',
  imports: [IconComponent, RouterLink],
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
  /** Name of the signed-in user, so their own row in the member list can be marked "You". */
  readonly currentUserName = input<string>('');

  readonly close = output<void>();
  readonly toggleMembership = output<void>();
  readonly deleteCircle = output<void>();

  memberSubtext(member: CircleMember): string {
    return member.role === 'Host' ? `Host · ${member.location}` : `${member.location} · ${member.joinedLabel}`;
  }

  isCurrentUser(member: CircleMember): boolean {
    return !!this.currentUserName() && member.name === this.currentUserName();
  }
}
