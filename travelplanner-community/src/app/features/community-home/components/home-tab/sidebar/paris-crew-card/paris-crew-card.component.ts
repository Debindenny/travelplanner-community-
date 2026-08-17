import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent, IconName } from '../../../../../../shared/components/icon/icon.component';
import { avatarPhotoUrl } from '../../../../../../shared/utils/unsplash';
import { CrewCardKind, CrewMessage } from '../../../../../../core/models/community.models';

interface CrewTool {
  kind: CrewCardKind;
  icon: IconName;
  tip: string;
}

const CREW_TOOLS: CrewTool[] = [
  { kind: 'place', icon: 'map-pin', tip: 'Share a place' },
  { kind: 'poll', icon: 'bar-chart', tip: 'Start a poll' },
  { kind: 'meet', icon: 'calendar-check', tip: 'Propose a meet-up' },
  { kind: 'split', icon: 'receipt', tip: 'Split a cost' },
];

// Chosen so each name's avatarPhotoUrl hash lands on a different stock photo — avoids repeats.
const CREW_FACE_NAMES = ['Priya Nair', 'Emma Ross', 'Tom Becker', 'Iker Solano'];

@Component({
  selector: 'app-paris-crew-card',
  imports: [IconComponent],
  templateUrl: './paris-crew-card.component.html',
  styleUrl: './paris-crew-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParisCrewCardComponent {
  readonly inCrew = input(false);
  readonly hasInvite = input(false);
  readonly inviterName = input('Priya Nair');
  readonly messages = input<CrewMessage[]>([]);
  readonly draft = input('');
  readonly votes = input<Readonly<Record<string, string>>>({});
  readonly rsvpIds = input<ReadonlySet<string>>(new Set());
  readonly settledIds = input<ReadonlySet<string>>(new Set());
  readonly currentUserName = input('Ava Reyes');
  readonly onlineCount = input(4);

  readonly join = output<void>();
  readonly acceptInvite = output<void>();
  readonly declineInvite = output<void>();
  readonly draftChange = output<string>();
  readonly send = output<void>();
  readonly addCard = output<CrewCardKind>();
  readonly votePoll = output<{ messageId: string; optionId: string }>();
  readonly rsvp = output<string>();
  readonly decline = output<void>();
  readonly settle = output<string>();
  readonly addPlaceToTrip = output<string>();
  readonly minimizeChat = output<void>();
  readonly closeChat = output<void>();
  readonly startCircle = output<void>();

  readonly tools = CREW_TOOLS;
  readonly faceNames = CREW_FACE_NAMES;

  faceAvatar(name: string): string {
    return avatarPhotoUrl(name, 64);
  }

  isMine(message: CrewMessage): boolean {
    return message.author === this.currentUserName();
  }

  showAvatar(index: number): boolean {
    const message = this.messages()[index];
    if (this.isMine(message)) {
      return false;
    }
    const previous = this.messages()[index - 1];
    return !previous || previous.author !== message.author;
  }

  avatarFor(message: CrewMessage): string {
    return avatarPhotoUrl(message.author, 64);
  }

  get inviterAvatar(): string {
    return avatarPhotoUrl(this.inviterName(), 64);
  }

  votedOptionFor(messageId: string): string | undefined {
    return this.votes()[messageId];
  }

  pollPercent(messageId: string, optionId: string, basePercent: number): string {
    const voted = this.votedOptionFor(messageId);
    if (!voted) {
      return '';
    }
    return `${basePercent + (voted === optionId ? 1 : 0)}%`;
  }

  pollBarWidth(messageId: string, optionId: string, basePercent: number): string {
    const voted = this.votedOptionFor(messageId);
    return voted ? `${basePercent + (voted === optionId ? 1 : 0)}%` : '0%';
  }

  isGoing(messageId: string): boolean {
    return this.rsvpIds().has(messageId);
  }

  isSettled(messageId: string): boolean {
    return this.settledIds().has(messageId);
  }

  onDraftInput(event: Event): void {
    this.draftChange.emit((event.target as HTMLInputElement).value);
  }

  onDraftKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.send.emit();
    }
  }
}
