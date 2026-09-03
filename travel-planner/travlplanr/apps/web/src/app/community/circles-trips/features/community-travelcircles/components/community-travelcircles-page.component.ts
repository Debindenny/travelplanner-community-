import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ModalShellComponent } from '../../community-home/components/overlays/modal-shell/modal-shell.component';
import { CommunityHomeStore } from '../../community-home/store/community-home.store';
import { unsplashUrl } from '../../../shared/utils/unsplash';
import { CircleMember, TravelCircleCard, circleCtaLabel } from '../data/travel-circle-cards.data';
import { CircleDetailModalComponent } from './circle-detail-modal/circle-detail-modal.component';
import { CreateCircleModalComponent, CreateCirclePayload, CircleAudience, CircleVisibility } from './create-circle-modal/create-circle-modal.component';
import { CommunityCrewChatModalComponent } from '../../../../components/community-crew-chat-modal.component';
import { ChatCircleContext, PARIS_CREW_CHAT_MOCK } from '../../../../components/community-crew-chat.mock';
import {
  CommunitySpacesService,
  SpaceAudience,
  SpaceListItem,
  SpaceMemberSummary,
  SpaceVisibility,
} from '../../../../services/community-spaces.service';

const ACCENT_PALETTE: Array<[string, string]> = [
  ['#0060ea', '#2aa98b'],
  ['#8b5cf6', '#c2569b'],
  ['#5b3fa0', '#8b5cf6'],
  ['#2aa98b', '#0060ea'],
];

const NEW_CIRCLE_IMAGE = unsplashUrl('1565099824688-e93eb20fe622', 600);

const VISIBILITY_FROM_WIRE: Record<SpaceVisibility, CircleVisibility> = {
  public: 'Public',
  invite_only: 'Invite only',
  friends: 'Friends',
};
const VISIBILITY_TO_WIRE: Record<CircleVisibility, SpaceVisibility> = {
  'Public': 'public',
  'Invite only': 'invite_only',
  'Friends': 'friends',
};
const AUDIENCE_FROM_WIRE: Record<SpaceAudience, CircleAudience> = {
  everyone: 'Everyone',
  women_only: 'Women only',
  men_only: 'Men only',
};
const AUDIENCE_TO_WIRE: Record<CircleAudience, SpaceAudience> = {
  'Everyone': 'everyone',
  'Women only': 'women_only',
  'Men only': 'men_only',
};

/** "Active now" / "Active Xm ago" / "Active Xh ago" / "Active Xd ago" from an
 * ISO timestamp — the inverse of `minutesSinceActivity` below, which parses
 * this same text back out to drive the "recently active" dot. */
function formatActivity(iso: string | null): string {
  if (!iso) return 'Active recently';
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Active now';
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Active ${days}d ago`;
}

/** Short relative label ("3d", "2w") for a member's "joined ... ago" line. */
function formatRelativeShort(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function toCircleMember(m: SpaceMemberSummary): CircleMember {
  return {
    name: m.name,
    customer_id: m.customer_id,
    location: m.location ?? 'Traveler',
    role: m.role === 'admin' ? 'Host' : undefined,
    joinedLabel: m.joined_at ? `joined ${formatRelativeShort(m.joined_at)} ago` : undefined,
  };
}

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
  private readonly spacesService = inject(CommunitySpacesService);

  readonly goHome = output<void>();

  private readonly _cards = signal<TravelCircleCard[]>([]);
  readonly cards = this._cards.asReadonly();

  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly showCreateModal = signal(false);
  readonly viewedCircleId = signal<string | null>(null);
  readonly openChatCircle = signal<TravelCircleCard | null>(null);
  readonly lastJoinedCircle = signal<TravelCircleCard | null>(null);
  readonly showCrewChat = signal(false);

  private readonly _memberIds = signal<ReadonlySet<string>>(new Set());
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

  constructor() {
    this.loadCircles();
  }

  private async loadCircles(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(null);
    try {
      const spaces = await firstValueFrom(this.spacesService.getSpaces(50, 0));
      const memberLists = await Promise.all(
        spaces.map((space) => firstValueFrom(this.spacesService.getSpaceMembers(space.id)).catch(() => [] as SpaceMemberSummary[])),
      );
      const cards = spaces.map((space, index) => this.toCard(space, memberLists[index], index));
      this._cards.set(cards);
      this._memberIds.set(new Set(spaces.filter((s) => s.isJoined).map((s) => s.id)));
    } catch (e) {
      console.error('Failed to load travel circles', e);
      this.loadError.set('Failed to load travel circles');
      this._cards.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  private toCard(space: SpaceListItem, members: SpaceMemberSummary[], index: number): TravelCircleCard {
    const visibility = VISIBILITY_FROM_WIRE[space.visibility] ?? 'Public';
    const [fallbackAccent, fallbackAccent2] = ACCENT_PALETTE[index % ACCENT_PALETTE.length];
    const initialStatus: TravelCircleCard['initialStatus'] = space.role === 'admin' ? 'owner' : space.isJoined ? 'joined' : undefined;
    return {
      id: space.id,
      title: space.name,
      meta: `${space.memberCount} member${space.memberCount === 1 ? '' : 's'}`,
      visibility,
      description: space.description ?? 'A new circle for planning together.',
      activity: formatActivity(space.lastActivityAt),
      cta: visibility === 'Invite only' ? 'Request' : 'Join',
      accent: space.accent ?? fallbackAccent,
      accent2: space.accent2 ?? fallbackAccent2,
      image: space.coverImage ?? NEW_CIRCLE_IMAGE,
      members: members.map(toCircleMember),
      audience: space.audience ? AUDIENCE_FROM_WIRE[space.audience] : undefined,
      initialStatus,
    };
  }

  private updateCardMemberCount(id: string, memberCount: number): void {
    this._cards.set(
      this._cards().map((c) => (c.id === id ? { ...c, meta: `${memberCount} member${memberCount === 1 ? '' : 's'}` } : c)),
    );
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
    return circleCtaLabel(card, this.isMember(card.id));
  }

  onToggleMembership(card: TravelCircleCard): void {
    if (this.isOwner(card)) {
      this.store.showToast('You created this circle — requests appear on your home feed');
      return;
    }
    if (!this.isMember(card.id) && card.cta === 'Join') {
      void this.joinCircle(card);
      return;
    }
    void this.toggleMembership(card);
  }

  private async joinCircle(card: TravelCircleCard): Promise<void> {
    try {
      const res = await firstValueFrom(this.spacesService.toggleJoin(card.id));
      await this.applyMembership(card.id, res.isJoined, res.memberCount);
      this.lastJoinedCircle.set(card);
      this.openChatCircle.set(card);
    } catch (e) {
      console.error('Failed to join circle', e);
      this.store.showToast('Could not join — please try again');
    }
  }

  private async toggleMembership(card: TravelCircleCard): Promise<void> {
    const wasMember = this.isMember(card.id);
    try {
      const res = await firstValueFrom(this.spacesService.toggleJoin(card.id));
      await this.applyMembership(card.id, res.isJoined, res.memberCount);

      if (card.cta === 'Join') {
        this.store.showToast(wasMember ? `Left ${card.title}` : `Joined ${card.title}`);
      } else {
        this.store.showToast(wasMember ? 'Request withdrawn' : 'Request sent · the creator will review it');
      }
    } catch (e) {
      console.error('Failed to update membership', e);
      this.store.showToast('Could not update membership — please try again');
    }
  }

  private async applyMembership(id: string, isJoined: boolean, memberCount: number): Promise<void> {
    const next = new Set(this._memberIds());
    if (isJoined) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this._memberIds.set(next);
    this.updateCardMemberCount(id, memberCount);

    // Refresh the real member list so the newly joined/left member shows up
    // immediately (including their "You" badge) instead of only after the
    // next full page reload.
    try {
      const members = await firstValueFrom(this.spacesService.getSpaceMembers(id));
      this._cards.set(this._cards().map((c) => (c.id === id ? { ...c, members: members.map(toCircleMember) } : c)));
    } catch (e) {
      console.error('Failed to refresh circle members', e);
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
      void this.joinCircle(card);
      this.showCrewChat.set(false);
      return;
    }
    void this.toggleMembership(card);
  }

  onCloseCircleChat(): void {
    this.openChatCircle.set(null);
  }

  onExitCircleChat(): void {
    const circle = this.openChatCircle();
    this.lastJoinedCircle.set(null);
    this.openChatCircle.set(null);
    if (circle) {
      void this.leaveCircle(circle);
    }
  }

  private async leaveCircle(circle: TravelCircleCard): Promise<void> {
    try {
      const res = await firstValueFrom(this.spacesService.toggleJoin(circle.id));
      await this.applyMembership(circle.id, res.isJoined, res.memberCount);
      this.store.showToast(`You left ${circle.title}.`);
    } catch (e) {
      console.error('Failed to leave circle', e);
      this.store.showToast('Could not leave — please try again');
    }
  }

  onFloatingChatClick(): void {
    const justJoined = this.lastJoinedCircle();
    if (justJoined) {
      this.openChatCircle.set(justJoined);
      return;
    }
    // Real (persisted) membership survives a reload even though
    // `lastJoinedCircle` — set only right when the Join button is clicked —
    // does not, so check it too before falling back to the discovery list.
    const alreadyJoined = this.cards().find((c) => this.isMember(c.id));
    if (alreadyJoined) {
      this.openChatCircle.set(alreadyJoined);
      return;
    }
    this.showCrewChat.set(true);
  }

  onCreateCircle(): void {
    this.showCreateModal.set(true);
  }

  onCancelCreateCircle(): void {
    this.showCreateModal.set(false);
  }

  async onCircleCreated(payload: CreateCirclePayload): Promise<void> {
    const [accent, accent2] = ACCENT_PALETTE[this._cards().length % ACCENT_PALETTE.length];
    try {
      const space = await firstValueFrom(
        this.spacesService.createSpace({
          name: payload.name,
          description: payload.description || undefined,
          coverImage: NEW_CIRCLE_IMAGE,
          visibility: VISIBILITY_TO_WIRE[payload.visibility],
          audience: AUDIENCE_TO_WIRE[payload.audience],
          accent,
          accent2,
        }),
      );
      const ownerMember: SpaceMemberSummary = {
        customer_id: this.store.currentUser.customer_id,
        name: this.store.currentUser.name,
        avatar: null,
        location: null,
        role: 'admin',
        joined_at: space.createdAt,
      };
      const card = this.toCard(space, [ownerMember], this._cards().length);
      this._cards.set([card, ...this._cards()]);
      this._memberIds.set(new Set([...this._memberIds(), card.id]));
      this.showCreateModal.set(false);
      this.store.showToast(`"${payload.name}" created`);
    } catch (e) {
      console.error('Failed to create circle', e);
      this.store.showToast('Could not create circle — please try again');
    }
  }

  onViewCircle(card: TravelCircleCard): void {
    this.viewedCircleId.set(card.id);
  }

  onCloseCircleDetail(): void {
    this.viewedCircleId.set(null);
  }

  async onDeleteCircle(card: TravelCircleCard): Promise<void> {
    if (!window.confirm(`Delete "${card.title}"? This removes it and its chat for everyone. This can't be undone.`)) {
      return;
    }
    try {
      await firstValueFrom(this.spacesService.deleteSpace(card.id));
      this._cards.set(this._cards().filter((c) => c.id !== card.id));
      const next = new Set(this._memberIds());
      next.delete(card.id);
      this._memberIds.set(next);
      if (this.viewedCircleId() === card.id) {
        this.viewedCircleId.set(null);
      }
      if (this.openChatCircle()?.id === card.id) {
        this.openChatCircle.set(null);
      }
      if (this.lastJoinedCircle()?.id === card.id) {
        this.lastJoinedCircle.set(null);
      }
      this.store.showToast(`"${card.title}" deleted`);
    } catch (e) {
      console.error('Failed to delete circle', e);
      this.store.showToast('Could not delete circle — please try again');
    }
  }
}
