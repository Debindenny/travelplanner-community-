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
            subtitle: t.subtitle,
            tier: t.tier as CommunityTrip['tier'],
            saves: t.savesLabel,
            image: t.image,
            author: t.author,
            customer_id: t.authorId,
            updated: t.updatedLabel,
            days: t.days,
            cities: t.cities,
            activities: t.activities,
            perPerson: t.perPerson,
            isSaved: t.isSaved,
          })),
        ),
      error: () => this.store.showToast('Could not load trips right now'),
    });
  }

  readonly filteredTrips = computed(() => {
    const filter = this.filter();
    const trips = this.trips();
    if (filter === 'Budget' || filter === 'Luxury') {
      return trips.filter((trip) => trip.tier === filter);
    }
    if (filter === 'Recent') {
      return [...trips].sort((a, b) => recencyRank(a) - recencyRank(b));
    }
    return trips;
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
      maxTravelers: payload.travelers,
      journeyName: trip.title,
      cloneTripId: trip.id,
    });
    this.router.navigate(['/community/events/host']);
  }
}
