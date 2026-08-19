import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';

import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ModalShellComponent } from '../../community-home/components/overlays/modal-shell/modal-shell.component';
import { CommunityHomeStore } from '../../community-home/store/community-home.store';
import { COMMUNITY_TRIPS, CommunityTrip } from '../data/community-trips.data';
import { CloneTripModalComponent, CloneTripPayload } from './clone-trip-modal/clone-trip-modal.component';

type TripFilter = 'Popular' | 'Recent' | 'Budget' | 'Luxury';

const RECENCY_UNIT_HOURS: Record<string, number> = {
  d: 24,
  w: 24 * 7,
  m: 24 * 30,
};

function recencyRank(trip: CommunityTrip): number {
  const match = /(\d+)([dwm])/.exec(trip.updated);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }
  const [, amount, unit] = match;
  return Number(amount) * (RECENCY_UNIT_HOURS[unit] ?? 24);
}

@Component({
  selector: 'app-community-trips',
  imports: [IconComponent, ModalShellComponent, CloneTripModalComponent],
  templateUrl: './community-trips-page.component.html',
  styleUrl: './community-trips-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityTripsComponent {
  readonly store = inject(CommunityHomeStore);

  readonly goHome = output<void>();

  readonly filterOptions: TripFilter[] = ['Popular', 'Recent', 'Budget', 'Luxury'];
  readonly filter = signal<TripFilter>('Popular');

  readonly cloningTrip = signal<CommunityTrip | null>(null);

  readonly filteredTrips = computed(() => {
    const filter = this.filter();
    if (filter === 'Budget' || filter === 'Luxury') {
      return COMMUNITY_TRIPS.filter((trip) => trip.tier === filter);
    }
    if (filter === 'Recent') {
      return [...COMMUNITY_TRIPS].sort((a, b) => recencyRank(a) - recencyRank(b));
    }
    return COMMUNITY_TRIPS;
  });

  isSaved(id: string): boolean {
    return this.store.savedIds().has(id);
  }

  onShareTrip(): void {
    this.store.openComposerMenu();
  }

  onViewItinerary(trip: CommunityTrip): void {
    this.store.showToast(`Opening "${trip.title}"`);
  }

  onClone(trip: CommunityTrip): void {
    this.cloningTrip.set(trip);
  }

  onCancelClone(): void {
    this.cloningTrip.set(null);
  }

  onBuildVersion(payload: CloneTripPayload): void {
    const trip = this.cloningTrip();
    if (!trip) {
      return;
    }
    this.cloningTrip.set(null);
    this.store.showToast(`Building your version of "${trip.title}" for ${payload.dates}`);
  }
}
