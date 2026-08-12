import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';

import { IconComponent } from '../../../shared/components/icon/icon.component';
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

interface Star {
  x: number;
  y: number;
  r: number;
  delay: number;
}

interface CardTilt {
  rx: number;
  ry: number;
  mx: number;
  my: number;
}

const DEFAULT_TILT: CardTilt = { rx: 0, ry: 0, mx: 50, my: 50 };

@Component({
  selector: 'app-community-travelcircles',
  imports: [IconComponent, ModalShellComponent, CreateCircleModalComponent],
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

  readonly flightPath = 'M60,80 Q 420,10 600,110 T 1140,55';

  readonly stars: Star[] = [
    { x: 90, y: 60, r: 1.6, delay: 0 },
    { x: 220, y: 40, r: 1.2, delay: 0.6 },
    { x: 340, y: 90, r: 1.8, delay: 1.2 },
    { x: 470, y: 35, r: 1.3, delay: 1.8 },
    { x: 150, y: 130, r: 1.4, delay: 2.4 },
    { x: 610, y: 45, r: 1.6, delay: 0.3 },
    { x: 40, y: 150, r: 1.2, delay: 1.5 },
    { x: 280, y: 150, r: 1.5, delay: 2.1 },
  ];

  private readonly _heroX = signal(0);
  private readonly _heroY = signal(0);
  readonly heroX = this._heroX.asReadonly();
  readonly heroY = this._heroY.asReadonly();

  private readonly _memberIds = signal<ReadonlySet<string>>(new Set());
  private readonly _tilt = signal<Readonly<Record<string, CardTilt>>>({});

  onHeroMouseMove(event: MouseEvent): void {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    this._heroX.set(((event.clientX - rect.left) / rect.width - 0.5) * 2);
    this._heroY.set(((event.clientY - rect.top) / rect.height - 0.5) * 2);
  }

  onHeroMouseLeave(): void {
    this._heroX.set(0);
    this._heroY.set(0);
  }

  onCardMouseMove(event: MouseEvent, card: TravelCircleCard): void {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    this._tilt.set({
      ...this._tilt(),
      [card.id]: {
        rx: (0.5 - py) * 12,
        ry: (px - 0.5) * 12,
        mx: px * 100,
        my: py * 100,
      },
    });
  }

  onCardMouseLeave(card: TravelCircleCard): void {
    this._tilt.set({ ...this._tilt(), [card.id]: DEFAULT_TILT });
  }

  tiltFor(id: string): CardTilt {
    return this._tilt()[id] ?? DEFAULT_TILT;
  }

  cardTransform(id: string): string {
    const tilt = this.tiltFor(id);
    return `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`;
  }

  isMember(id: string): boolean {
    return this._memberIds().has(id);
  }

  buttonLabel(card: TravelCircleCard): string {
    const isMember = this.isMember(card.id);
    if (card.cta === 'Join') {
      return isMember ? 'Joined' : 'Join';
    }
    return isMember ? 'Requested' : 'Request';
  }

  onToggleMembership(card: TravelCircleCard): void {
    const wasMember = this.isMember(card.id);
    const next = new Set(this._memberIds());
    if (wasMember) {
      next.delete(card.id);
    } else {
      next.add(card.id);
    }
    this._memberIds.set(next);

    const verb = card.cta === 'Join' ? (wasMember ? 'Left' : 'Joined') : wasMember ? 'Cancelled request to join' : 'Requested to join';
    this.store.showToast(`${verb} ${card.title}`);
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
      live: true,
      cta: payload.visibility === 'Invite only' ? 'Request' : 'Join',
      accent,
      accent2,
    };

    this._cards.set([newCard, ...this._cards()]);
    this.showCreateModal.set(false);
    this.store.showToast(`"${payload.name}" created`);
  }
}
