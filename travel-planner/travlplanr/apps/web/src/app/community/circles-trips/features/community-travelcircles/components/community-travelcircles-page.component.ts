import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ModalShellComponent } from '../../community-home/components/overlays/modal-shell/modal-shell.component';
import { CommunityHomeStore } from '../../community-home/store/community-home.store';
import { unsplashUrl } from '../../../shared/utils/unsplash';
import { TRAVEL_CIRCLE_CARDS, TravelCircleCard } from '../data/travel-circle-cards.data';
import { CircleDetailModalComponent } from './circle-detail-modal/circle-detail-modal.component';
import { CreateCircleModalComponent, CreateCirclePayload } from './create-circle-modal/create-circle-modal.component';
import { CommunityCrewChatModalComponent } from '../../../../components/community-crew-chat-modal.component';

const ACCENT_PALETTE: Array<[string, string]> = [
  ['#0060ea', '#2aa98b'],
  ['#8b5cf6', '#c2569b'],
  ['#5b3fa0', '#8b5cf6'],
  ['#2aa98b', '#0060ea'],
];

const NEW_CIRCLE_IMAGE = unsplashUrl('1565099824688-e93eb20fe622', 600);

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
  imports: [ModalShellComponent, CreateCircleModalComponent, CircleDetailModalComponent, CommunityCrewChatModalComponent],
  templateUrl: './community-travelcircles-page.component.html',
  styleUrl: './community-travelcircles-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityTravelCirclesComponent {
  readonly store = inject(CommunityHomeStore);
  private readonly router = inject(Router);

  readonly goHome = output<void>();

  private readonly _cards = signal<TravelCircleCard[]>(TRAVEL_CIRCLE_CARDS);
  readonly cards = this._cards.asReadonly();

  readonly showCreateModal = signal(false);
  readonly viewedCircleId = signal<string | null>(null);
  readonly openChatCircle = signal<TravelCircleCard | null>(null);
  readonly lastJoinedCircle = signal<TravelCircleCard | null>(null);

  private readonly _memberIds = signal<ReadonlySet<string>>(
    new Set(TRAVEL_CIRCLE_CARDS.filter((card) => card.initialStatus === 'joined').map((card) => card.id)),
  );

  readonly viewedCircle = () => this.cards().find((card) => card.id === this.viewedCircleId()) ?? null;

  openLogin(): void {
    // Remember where the user came from so login returns to Travel Circles.
    void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
  }

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
    if (!this.isMember(card.id) && card.cta === 'Join') {
      this.joinCircle(card);
      return;
    }
    this.toggleMembership(card);
  }

  private joinCircle(card: TravelCircleCard): void {
    const next = new Set(this._memberIds());
    next.add(card.id);
    this._memberIds.set(next);
    this.lastJoinedCircle.set(card);
    this.openChatCircle.set(card);
  }

  private toggleMembership(card: TravelCircleCard): void {
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

  onCloseCircleChat(): void {
    this.openChatCircle.set(null);
  }

  onExitCircleChat(): void {
    const circle = this.openChatCircle();
    if (circle) {
      const next = new Set(this._memberIds());
      next.delete(circle.id);
      this._memberIds.set(next);
    }
    this.lastJoinedCircle.set(null);
    this.openChatCircle.set(null);
    this.store.showToast(`You left ${circle?.title}.`);
  }

  onFloatingChatClick(): void {
    const joined = this.lastJoinedCircle();
    if (joined) {
      this.openChatCircle.set(joined);
    } else {
      this.openLogin();
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
      image: NEW_CIRCLE_IMAGE,
      members: [{ name: this.store.currentUser.name, location: 'You', role: 'Host' }],
      audience: payload.audience,
      initialStatus: 'owner',
    };

    this._cards.set([newCard, ...this._cards()]);
    this.showCreateModal.set(false);
    this.store.showToast(`"${payload.name}" created`);
  }

  onViewCircle(card: TravelCircleCard): void {
    this.viewedCircleId.set(card.id);
  }

  onCloseCircleDetail(): void {
    this.viewedCircleId.set(null);
  }
}
