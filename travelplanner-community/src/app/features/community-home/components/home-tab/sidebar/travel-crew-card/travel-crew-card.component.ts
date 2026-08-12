import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../../../../../../shared/components/icon/icon.component';
import { avatarPhotoUrl, unsplashUrl } from '../../../../../../shared/utils/unsplash';
import { CrewMessage, CrewMessageKind, CrewPollOption } from '../../../../../../core/models/community.models';

const CREW_FACE_SEEDS = ['crew-a', 'crew-b', 'crew-c', 'crew-d'];

@Component({
  selector: 'app-travel-crew-card',
  imports: [IconComponent],
  templateUrl: './travel-crew-card.component.html',
  styleUrl: './travel-crew-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TravelCrewCardComponent {
  readonly inCrew = input(false);
  readonly messages = input<CrewMessage[]>([]);
  readonly draft = input('');
  readonly votes = input<Readonly<Record<string, string>>>({});
  readonly rsvpIds = input<ReadonlySet<string>>(new Set());
  readonly settledIds = input<ReadonlySet<string>>(new Set());

  readonly join = output<void>();
  readonly createCircle = output<void>();
  readonly draftChange = output<string>();
  readonly send = output<void>();
  readonly addCard = output<CrewMessageKind>();
  readonly vote = output<{ messageId: string; optionId: string }>();
  readonly toggleRsvp = output<string>();
  readonly toggleSettled = output<string>();

  readonly crewFaces = CREW_FACE_SEEDS.map((seed) => avatarPhotoUrl(seed, 56));

  readonly tools: Array<{ kind: CrewMessageKind; icon: string; tip: string }> = [
    { kind: 'place', icon: 'map-pin', tip: 'Share a place' },
    { kind: 'poll', icon: 'bar-chart', tip: 'Start a poll' },
    { kind: 'meet', icon: 'calendar-check', tip: 'Propose a meet-up' },
    { kind: 'split', icon: 'receipt', tip: 'Split a cost' },
  ];

  avatarUrl(author: string): string {
    return avatarPhotoUrl(author, 56);
  }

  mediaUrl(image: string | undefined): string {
    return unsplashUrl(image ?? '1490806843957-31f4c9a91c65', 500);
  }

  isMine(message: CrewMessage): boolean {
    return message.mine === true;
  }

  showAvatarAndName(index: number): boolean {
    const message = this.messages()[index];
    if (this.isMine(message)) {
      return false;
    }
    const previous = this.messages()[index - 1];
    return !previous || previous.author !== message.author;
  }

  votedOptionId(messageId: string): string | undefined {
    return this.votes()[messageId];
  }

  pollOptionPercent(message: CrewMessage, option: CrewPollOption): string {
    const voted = this.votedOptionId(message.id);
    if (!voted) {
      return '';
    }
    return `${option.basePercent + (voted === option.id ? 1 : 0)}%`;
  }

  pollOptionBarWidth(message: CrewMessage, option: CrewPollOption): string {
    return this.votedOptionId(message.id) ? `${option.basePercent}%` : '0%';
  }

  isRsvp(messageId: string): boolean {
    return this.rsvpIds().has(messageId);
  }

  isSettled(messageId: string): boolean {
    return this.settledIds().has(messageId);
  }
}
