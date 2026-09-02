import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ModalShellComponent } from '../../community-home/components/overlays/modal-shell/modal-shell.component';
import { CommunityHomeStore } from '../../community-home/store/community-home.store';
import { unsplashUrl } from '../../../shared/utils/unsplash';
import { TRAVEL_CIRCLE_CARDS, TravelCircleCard, circleCtaLabel } from '../data/travel-circle-cards.data';
import { CircleDetailModalComponent } from './circle-detail-modal/circle-detail-modal.component';
import { CreateCircleModalComponent, CreateCirclePayload } from './create-circle-modal/create-circle-modal.component';
import { CommunityCrewChatModalComponent } from '../../../../components/community-crew-chat-modal.component';
import { ChatCircleContext, PARIS_CREW_CHAT_MOCK } from '../../../../components/community-crew-chat.mock';

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
  readonly showCrewChat = signal(false);

  private readonly _memberIds = signal<ReadonlySet<string>>(
    new Set(TRAVEL_CIRCLE_CARDS.filter((card) => card.initialStatus === 'joined').map((card) => card.id)),
  );

  readonly memberIds = this._memberIds.asReadonly();

  readonly viewedCircle = () => this.cards().find((card) => card.id === this.viewedCircleId()) ?? null;

  /** Joined circle cards mapped to ChatCircleContext for the crew chat's
   * circle dropdown selector. Only includes cards the user is a member of. */
  readonly joinedCircleContexts = computed<ChatCircleContext[]>(() =>
    this.cards()
      .filter(card => this._memberIds().has(card.id))
      .map(card => ({
        id: card.id,
        title: card.title,
        dateRange: card.members[0]?.dates ?? PARIS_CREW_CHAT_MOCK.dateRange,
        memberCount: card.members.length,
        onlineCount: Math.min(card.members.length, 4),
        endsInDays: PARIS_CREW_CHAT_MOCK.endsInDays,
        members: card.members,
        messages: PARIS_CREW_CHAT_MOCK.messages,
      })),
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
    return circleCtaLabel(card, this.isMember(card.id));
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

  

  closeCrewChat(): void {
    this.showCrewChat.set(false);
  }

  /** CTA clicked inside the chatbot's discovery view — reuse the existing
   * membership flow. Joining a public circle hands off to that circle's
   * group chat; requesting access to an invite-only circle (or an owned
   * circle) stays on the discovery view. */
  onDiscoveryCircleAction(card: TravelCircleCard): void {
    if (this.isOwner(card)) {
      this.store.showToast('You created this circle — requests appear on your home feed');
      return;
    }
    if (!this.isMember(card.id) && card.cta === 'Join') {
      this.joinCircle(card);
      this.showCrewChat.set(false);
      return;
    }
    this.toggleMembership(card);
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
      this.showCrewChat.set(true);
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
      members: [{ name: this.store.currentUser.name, customer_id: this.store.currentUser.customer_id, location: 'You', role: 'Host' }],
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
