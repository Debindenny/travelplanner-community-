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

  whoIsItFor(): string {
    const audience = this.circle().audience;
    if (audience === 'Women only') return 'Women only';
    if (audience === 'Men only') return 'Men only';
    return 'Open to everyone';
  }

  whoCanJoin(): string {
    const visibility = this.circle().visibility;
    if (visibility === 'Invite only') return 'Approval needed';
    if (visibility === 'Friends') return 'Friends only';
    return 'Anyone can join';
  }

  /** No real category field on a circle yet — invite-only circles are small
   * crews planning one trip together (a destination); public circles are
   * ongoing topic communities (an interest). Same heuristic the Travel
   * Circles page's filter pills use. */
  focus(): string {
    return this.circle().visibility === 'Invite only' ? 'Destination circle' : 'Interest circle';
  }

  capacityPercent(): number {
    const capacity = this.circle().capacity;
    if (!capacity) return 0;
    return Math.min(100, Math.round((this.circle().memberCount / capacity) * 100));
  }

  membersShownLabel(): string {
    return `Showing ${this.circle().members.length} of ${this.circle().memberCount}`;
  }
}
