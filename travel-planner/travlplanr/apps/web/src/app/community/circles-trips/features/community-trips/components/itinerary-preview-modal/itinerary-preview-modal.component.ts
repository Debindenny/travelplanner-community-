import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CommunityPostService, TripTemplateDayCity } from '../../../../../services/community-post.service';
import { CommunityTrip } from '../../data/community-trips.data';

interface ItineraryDayGroup {
  startDay: number;
  endDay: number;
  city: string;
  highlights: string[];
}

function groupDayCities(dayCities: TripTemplateDayCity[]): ItineraryDayGroup[] {
  const groups: ItineraryDayGroup[] = [];
  for (const entry of dayCities) {
    const last = groups[groups.length - 1];
    if (last && last.city === entry.city && last.endDay === entry.day - 1) {
      last.endDay = entry.day;
      continue;
    }
    const highlights = entry.places.slice(0, 2).map((p) => p.title);
    groups.push({
      startDay: entry.day,
      endDay: entry.day,
      city: entry.city,
      highlights: highlights.length ? highlights : [`Free day to explore ${entry.city}`],
    });
  }
  return groups;
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

  readonly makeVersion = output<void>();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly dayGroups = signal<ItineraryDayGroup[]>([]);

  readonly authorInitial = computed(() => this.trip().author?.trim().charAt(0).toUpperCase() || '?');

  ngOnInit(): void {
    this.communityPostService.getTripTemplateDetail(this.trip().id).subscribe({
      next: (detail) => {
        this.dayGroups.set(groupDayCities(detail.dayCities));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  dayLabel(group: ItineraryDayGroup): string {
    return group.startDay === group.endDay ? `Day ${group.startDay}` : `Day ${group.startDay}-${group.endDay}`;
  }

  onMakeVersion(): void {
    this.makeVersion.emit();
  }
}
