import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ModalShellComponent } from '../../community-home/components/overlays/modal-shell/modal-shell.component';
import { CommunityHomeStore } from '../../community-home/store/community-home.store';
import { CommunityPostService } from '../../../../services/community-post.service';
import { HostWizardPrefillService } from '../../../../services/host-wizard-prefill.service';
import { CommunityTrip } from '../data/community-trips.data';
import { CloneTripModalComponent, CloneTripPayload } from './clone-trip-modal/clone-trip-modal.component';
import { ItineraryPreviewModalComponent } from './itinerary-preview-modal/itinerary-preview-modal.component';

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

/** Ascending/descending by converted price, with trips lacking one (no
 * structured amount/currency on the template) always sorted to the end. */
function comparePrice(a: CommunityTrip, b: CommunityTrip, direction: 'asc' | 'desc'): number {
  const priceA = a.perPersonAmountInr;
  const priceB = b.perPersonAmountInr;
  if (priceA == null && priceB == null) return 0;
  if (priceA == null) return 1;
  if (priceB == null) return -1;
  return direction === 'asc' ? priceA - priceB : priceB - priceA;
}

@Component({
  selector: 'app-community-trips',
  imports: [IconComponent, ModalShellComponent, CloneTripModalComponent, ItineraryPreviewModalComponent, RouterLink],
  templateUrl: './community-trips-page.component.html',
  styleUrl: './community-trips-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityTripsComponent {
  readonly store = inject(CommunityHomeStore);
  private readonly communityPostService = inject(CommunityPostService);
  private readonly wizardPrefill = inject(HostWizardPrefillService);
  private readonly router = inject(Router);

  readonly goHome = output<void>();

  readonly filterOptions: TripFilter[] = ['Popular', 'Recent', 'Budget', 'Luxury'];
  readonly filter = signal<TripFilter>('Popular');

  readonly cloningTrip = signal<CommunityTrip | null>(null);
  readonly previewingTrip = signal<CommunityTrip | null>(null);

  private readonly trips = signal<CommunityTrip[]>([]);

  constructor() {
    this.communityPostService.getTripTemplates().subscribe({
      next: ({ items }) =>
        this.trips.set(
          items.map((t) => ({
            id: t.id,
            title: t.title,
            destination: t.destination,
            subtitle: t.subtitle,
            tier: t.tier as CommunityTrip['tier'],
            saves: t.savesLabel,
            savesCount: t.savesCount,
            image: t.image,
            author: t.author,
            customer_id: t.authorId,
            updated: t.updatedLabel,
            days: t.days,
            cities: t.cities,
            activities: t.activities,
            perPerson: t.perPerson,
            perPersonAmountInr: t.perPersonAmountInr,
            isSaved: t.isSaved,
          })),
        ),
      error: () => this.store.showToast('Could not load trips right now'),
    });
  }

  // All four pills SORT the full list rather than hiding trips — every trip
  // stays visible in every tab, just reordered. Budget/Luxury compare prices
  // via `perPersonAmountInr` (already converted server-side to a common
  // currency), not the trip's display `tier`, so a trip is ranked by what it
  // actually costs rather than a coarse category label.
  readonly filteredTrips = computed(() => {
    const filter = this.filter();
    const trips = [...this.trips()];
    switch (filter) {
      case 'Recent':
        return trips.sort((a, b) => recencyRank(a) - recencyRank(b));
      case 'Budget':
        return trips.sort((a, b) => comparePrice(a, b, 'asc'));
      case 'Luxury':
        return trips.sort((a, b) => comparePrice(a, b, 'desc'));
      case 'Popular':
      default:
        return trips.sort((a, b) => b.savesCount - a.savesCount);
    }
  });

  onShareTrip(): void {
    this.store.openComposerMenu();
  }

  onViewItinerary(trip: CommunityTrip): void {
    this.previewingTrip.set(trip);
  }

  onClosePreview(): void {
    this.previewingTrip.set(null);
  }

  onMakeVersionFromPreview(): void {
    const trip = this.previewingTrip();
    if (!trip) {
      return;
    }
    this.previewingTrip.set(null);
    this.cloningTrip.set(trip);
  }

  isSaved(trip: CommunityTrip): boolean {
    return trip.isSaved;
  }

  onToggleSave(trip: CommunityTrip): void {
    this.communityPostService.toggleSaveItinerary(trip.id).subscribe({
      next: ({ saved }) => {
        this.trips.update((all) => all.map((t) => (t.id === trip.id ? { ...t, isSaved: saved } : t)));
        this.store.showToast(saved ? `Saved "${trip.title}"` : `Removed "${trip.title}" from saved`);
      },
      error: () => this.store.showToast('Could not update saved status'),
    });
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
    this.wizardPrefill.set({
      route: [payload.arrivalDestination || trip.title],
      startLocation: payload.startingFrom,
      startDate: payload.startDate,
      endDate: payload.endDate,
      days: trip.days,
      maxTravelers: payload.travelers,
      journeyName: trip.title,
      cloneTripId: trip.id,
      image: trip.image,
    });
    this.router.navigate(['/community/events/host']);
  }
}
