import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CommunityPostService, TripTemplateDayCity, TripTemplatePlace } from '../../../../../services/community-post.service';
import { CommunityTrip } from '../../data/community-trips.data';

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
  selector: 'app-itinerary-preview-modal',
  imports: [IconComponent],
  templateUrl: './itinerary-preview-modal.component.html',
  styleUrl: './itinerary-preview-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItineraryPreviewModalComponent implements OnInit {
  private readonly communityPostService = inject(CommunityPostService);

  readonly trip = input.required<CommunityTrip>();

  readonly back = output<void>();
  readonly makeVersion = output<void>();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly days = signal<ItineraryDay[]>([]);
  readonly expandedDay = signal<number | null>(null);

  readonly authorInitial = computed(() => this.trip().author?.trim().charAt(0).toUpperCase() || '?');

  ngOnInit(): void {
    this.communityPostService.getTripTemplateDetail(this.trip().id).subscribe({
      next: (detail) => {
        const days = toItineraryDays(detail.dayCities);
        this.days.set(days);
        this.expandedDay.set(days[0]?.day ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  isExpanded(day: number): boolean {
    return this.expandedDay() === day;
  }

  toggleDay(day: number): void {
    this.expandedDay.update((current) => (current === day ? null : day));
  }

  stopCount(day: ItineraryDay): string {
    return `${day.places.length} stop${day.places.length === 1 ? '' : 's'}`;
  }

  onBack(): void {
    this.back.emit();
  }

  onMakeVersion(): void {
    this.makeVersion.emit();
  }
}
