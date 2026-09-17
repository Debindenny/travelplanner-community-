import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CommunityPostService, TripTemplateDayCity, TripTemplateDetail, TripTemplatePlace } from '../../../../../services/community-post.service';
import { CommunityHomeStore } from '../../../community-home/store/community-home.store';
import { ModalShellComponent } from '../../../community-home/components/overlays/modal-shell/modal-shell.component';
import { CommunityTrip } from '../../data/community-trips.data';
import { CloneTripModalComponent, CloneTripPayload } from '../clone-trip-modal/clone-trip-modal.component';

interface ItineraryDay {
  day: number;
  city: string;
  places: TripTemplatePlace[];
  highlights: string[];
}

function toItineraryDays(dayCities: TripTemplateDayCity[]): ItineraryDay[] {
  return dayCities.map((entry) => {
    const highlights = entry.places.slice(0, 2).map((p) => p.title);
    return {
      day: entry.day,
      city: entry.city,
      places: entry.places,
      highlights: highlights.length ? highlights : [`Free day to explore ${entry.city}`],
    };
  });
}

@Component({
  selector: 'app-trip-template-preview',
  imports: [IconComponent, ModalShellComponent, CloneTripModalComponent],
  templateUrl: './trip-template-preview.component.html',
  styleUrl: './trip-template-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripTemplatePreviewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly communityPostService = inject(CommunityPostService);
  private readonly store = inject(CommunityHomeStore);

  readonly trip = signal<TripTemplateDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly expandedDay = signal<number | null>(1);
  readonly allExpanded = signal(false);

  readonly cloning = signal(false);

  readonly days = computed<ItineraryDay[]>(() => {
    const t = this.trip();
    return t ? toItineraryDays(t.dayCities) : [];
  });

  // The clone modal expects the browse-page card's shape — this detail
  // response is a superset of it, just with different field names.
  readonly asCommunityTrip = computed<CommunityTrip | null>(() => {
    const t = this.trip();
    if (!t) return null;
    return {
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
    };
  });

  readonly tags = computed<string[]>(() => {
    const t = this.trip();
    if (!t) return [];
    const fromSubtitle = (t.subtitle || '').split('·').map((s) => s.trim()).filter(Boolean);
    return [t.destination, ...fromSubtitle].filter((tag, i, all) => tag && all.indexOf(tag) === i);
  });

  constructor() {
    const tripId = this.route.snapshot.paramMap.get('id');
    if (!tripId) {
      this.loading.set(false);
      this.error.set(true);
      return;
    }
    this.communityPostService.getTripTemplateDetail(tripId).subscribe({
      next: (trip) => {
        this.trip.set(trip);
        this.expandedDay.set(trip.dayCities[0]?.day ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  goBack(): void {
    this.location.back();
  }

  isExpanded(day: number): boolean {
    return this.allExpanded() || this.expandedDay() === day;
  }

  toggleDay(day: number): void {
    if (this.allExpanded()) {
      this.allExpanded.set(false);
      this.expandedDay.set(day);
      return;
    }
    this.expandedDay.update((current) => (current === day ? null : day));
  }

  toggleExpandAll(): void {
    this.allExpanded.update((v) => !v);
  }

  stopCount(count: number): string {
    return `${count} stop${count === 1 ? '' : 's'}`;
  }

  onToggleSave(): void {
    const trip = this.trip();
    if (!trip) return;
    this.communityPostService.toggleSaveItinerary(trip.id).subscribe({
      next: ({ saved }) => {
        this.trip.update((current) => (current ? { ...current, isSaved: saved } : current));
        this.store.showToast(saved ? `Saved "${trip.title}"` : `Removed "${trip.title}" from saved`);
      },
      error: () => this.store.showToast('Could not update saved status'),
    });
  }

  onCloneClick(): void {
    this.cloning.set(true);
  }

  onCancelClone(): void {
    this.cloning.set(false);
  }

  onBuildVersion(payload: CloneTripPayload): void {
    const trip = this.trip();
    if (!trip) return;
    this.cloning.set(false);
    this.communityPostService
      .cloneTrip(trip.id, {
        destination: payload.arrivalDestination || trip.title,
        startDate: payload.startDate,
        endDate: payload.endDate,
        travelers: payload.travelers,
      })
      .subscribe({
        next: ({ tripId }) => this.router.navigate(['/itinerary', tripId]),
        error: () => this.store.showToast('Could not generate the itinerary — please try again'),
      });
  }
}
