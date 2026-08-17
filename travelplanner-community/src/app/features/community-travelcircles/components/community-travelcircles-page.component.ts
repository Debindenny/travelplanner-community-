import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';

import { ModalShellComponent } from '../../community-home/components/overlays/modal-shell/modal-shell.component';
import { CommunityHomeStore } from '../../community-home/store/community-home.store';
import { TRAVEL_CIRCLE_CARDS, TravelCircleCard } from '../data/travel-circle-cards.data';
import { CreateCircleModalComponent, CreateCirclePayload } from './create-circle-modal/create-circle-modal.component';

const ACCENT_PALETTE: Array<[string, string]> = [
  ['#0060ea', '#2aa98b'],
  ['#8b5cf6', '#c2569b'],
  ['#5b3fa0', '#8b5cf6'],
  ['#2aa98b', '#0060ea'],
];

function minutesSinceActivity(activity: string): number {
  const text = activity.toLowerCase();
  if (text.includes('now')) {
    return 0;
  }
  const match = text.match(/(\d+)\s*(m|h|d)\b/);
  if (!match) {
    return Number.POSITIVE_INFINITY;
  }
  const value = Number(match[1]);
  switch (match[2]) {
    case 'm':
      return value;
    case 'h':
      return value * 60;
    case 'd':
      return value * 60 * 24;
    default:
      return Number.POSITIVE_INFINITY;
  }
}

@Component({
  selector: 'app-community-travelcircles',
  imports: [ModalShellComponent, CreateCircleModalComponent],
  templateUrl: './community-travelcircles-page.component.html',
  styleUrl: './community-travelcircles-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityTravelCirclesComponent {
  private readonly store = inject(CommunityHomeStore);

  readonly goHome = output<void>();

  private readonly _cards = signal<TravelCircleCard[]>(TRAVEL_CIRCLE_CARDS);
  readonly cards = this._cards.asReadonly();

  readonly showCreateModal = signal(false);

  private readonly _memberIds = signal<ReadonlySet<string>>(
    new Set(TRAVEL_CIRCLE_CARDS.filter((card) => card.initialStatus === 'joined').map((card) => card.id)),
  );

  isMember(id: string): boolean {
    return this._memberIds().has(id);
  }

  isOwner(card: TravelCircleCard): boolean {
    return card.initialStatus === 'owner';
  }

  isRecentlyActive(card: TravelCircleCard): boolean {
    return minutesSinceActivity(card.activity) < 60;
  }

  buttonLabel(card: TravelCircleCard): string {
    if (this.isOwner(card)) {
      return 'You created it';
    }
    if (this.isMember(card.id)) {
      return card.cta === 'Join' ? 'Joined' : 'Requested';
    }
    return card.cta === 'Join' ? 'Join' : 'Request to join';
  }

  onToggleMembership(card: TravelCircleCard): void {
    if (this.isOwner(card)) {
      this.store.showToast('You created this circle — requests appear on your home feed');
      return;
    }
    const wasMember = this.isMember(card.id);
    const next = new Set(this._memberIds());
    if (wasMember) {
      next.delete(card.id);
    } else {
      next.add(card.id);
    }
    this._memberIds.set(next);

    if (card.cta === 'Join') {
      this.store.showToast(wasMember ? `Left ${card.title}` : `Joined ${card.title}`);
    } else {
      this.store.showToast(wasMember ? 'Request withdrawn' : 'Request sent · the creator will review it');
    }
  }

  onCreateCircle(): void {
    this.showCreateModal.set(true);
  }

  onCancelCreateCircle(): void {
    this.showCreateModal.set(false);
  }

  onCircleCreated(payload: CreateCirclePayload): void {
    const [accent, accent2] = ACCENT_PALETTE[this._cards().length % ACCENT_PALETTE.length];

    const newCard: TravelCircleCard = {
      id: `tc-${this._cards().length}-${payload.name.toLowerCase().replace(/\s+/g, '-')}`,
      title: payload.name,
      meta: '1 member · just created',
      visibility: payload.visibility,
      description: payload.description || 'A new circle for planning together.',
      activity: 'Active now',
      cta: payload.visibility === 'Invite only' ? 'Request' : 'Join',
      accent,
      accent2,
      audience: payload.audience,
    };

    this._cards.set([newCard, ...this._cards()]);
    this.showCreateModal.set(false);
    this.store.showToast(`"${payload.name}" created`);
  }
}
