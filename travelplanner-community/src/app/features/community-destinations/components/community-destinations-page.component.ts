import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';

import { IconComponent } from '../../../shared/components/icon/icon.component';
import { CommunityHomeStore } from '../../community-home/store/community-home.store';
import { DESTINATION_CARDS, DestinationCard } from '../data/destination-cards.data';

type DestinationSort = 'Popular' | 'Near me';

@Component({
  selector: 'app-community-destinations',
  imports: [IconComponent],
  templateUrl: './community-destinations-page.component.html',
  styleUrl: './community-destinations-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityDestinationsPageComponent {
  private readonly store = inject(CommunityHomeStore);

  readonly goHome = output<void>();

  readonly sorts: DestinationSort[] = ['Popular', 'Near me'];

  private readonly _sort = signal<DestinationSort>('Popular');
  readonly sort = this._sort.asReadonly();

  private readonly _joinedIds = signal<ReadonlySet<string>>(new Set());

  readonly sortedCards = computed(() => {
    const cards = [...DESTINATION_CARDS];
    return this._sort() === 'Near me'
      ? cards.sort((a, b) => a.distanceKm - b.distanceKm)
      : cards.sort((a, b) => b.travelerCount - a.travelerCount);
  });

  selectSort(sort: DestinationSort): void {
    this._sort.set(sort);
  }

  isJoined(id: string): boolean {
    return this._joinedIds().has(id);
  }

  joinLabel(card: DestinationCard): string {
    return this.isJoined(card.id) ? 'Joined' : 'Join';
  }

  onToggleJoin(card: DestinationCard): void {
    const wasJoined = this.isJoined(card.id);
    const next = new Set(this._joinedIds());
    if (wasJoined) {
      next.delete(card.id);
    } else {
      next.add(card.id);
    }
    this._joinedIds.set(next);
    this.store.showToast(wasJoined ? `Left ${card.name}` : `Joined ${card.name}`);
  }

  onViewPosts(card: DestinationCard): void {
    this.store.showToast(`Opening ${card.name} community`);
  }
}
