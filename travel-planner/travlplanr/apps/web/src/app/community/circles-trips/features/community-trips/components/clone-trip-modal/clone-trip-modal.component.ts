import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, input, output, signal } from '@angular/core';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { DestinationTypeaheadComponent } from '../../../../../../shared/components/destination-typeahead/destination-typeahead.component';
import { DestinationListItem } from '../../../../../../shared/utils/destination.util';
import { CommunityTrip } from '../../data/community-trips.data';

export interface CloneTripPayload {
  startingFrom: string;
  arrivalDestination: string;
  startDate: string;
  endDate: string;
  travelers: number;
}

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(isoDate: string, days: number): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  parsed.setDate(parsed.getDate() + days);
  return toLocalIsoDate(parsed);
}

@Component({
  selector: 'app-clone-trip-modal',
  imports: [IconComponent, DestinationTypeaheadComponent],
  templateUrl: './clone-trip-modal.component.html',
  styleUrl: './clone-trip-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloneTripModalComponent {
  @ViewChild('startShell') private startShellRef?: ElementRef<HTMLDivElement>;
  @ViewChild('startTypeahead') private startTypeahead?: DestinationTypeaheadComponent;

  readonly trip = input.required<CommunityTrip>();

  readonly todayIso = toLocalIsoDate(new Date());

  // You're cloning this trip's own route, so the destination is fixed to it —
  // only the traveler's starting point and dates can be customized. Prefer a
  // clean single place name: `destination` can still be an old multi-city
  // list ("Tokyo, Kyoto, Osaka") on data that predates the short-label
  // migration, so fall back to pulling the place out of a "N Days in X"
  // style title before resorting to the raw title itself.
  readonly arrivalDestination = computed(() => {
    const trip = this.trip();
    const destination = (trip.destination || '').trim();
    if (destination && !destination.includes(',')) {
      return destination;
    }
    const titleMatch = /\bin\s+(.+)$/i.exec(trip.title || '');
    if (titleMatch) {
      return titleMatch[1].trim();
    }
    return destination || trip.title;
  });

  readonly startingFrom = signal('');
  readonly startDate = signal('');
  readonly travelers = signal(2);

  readonly startDropdownOpen = signal(false);

  // This itinerary is a fixed N-day route, so the end date isn't independently
  // pickable — it's always start date + (trip length - 1).
  readonly endDate = computed(() => {
    const start = this.startDate();
    if (!start) return '';
    const nights = Math.max((this.trip().days || 1) - 1, 0);
    return addDays(start, nights);
  });

  readonly missingFieldHint = computed(() => {
    if (!this.startingFrom().trim()) {
      return 'Add where you start from';
    }
    if (!this.startDate()) {
      return 'Add your start date';
    }
    if (this.startDate() < this.todayIso) {
      return 'Start date must not be in the past';
    }
    if (!this.endDate()) {
      return 'Add your end date';
    }
    return null;
  });

  readonly canGenerate = computed(() => this.missingFieldHint() === null);

  readonly endDateDisplay = computed(() => {
    const end = this.endDate();
    if (!end) return '';
    const [y, m, d] = end.split('-');
    return `${d}-${m}-${y}`;
  });

  readonly cancel = output<void>();
  readonly build = output<CloneTripPayload>();

  decrementTravelers(): void {
    this.travelers.update((count) => Math.max(1, count - 1));
  }

  incrementTravelers(): void {
    this.travelers.update((count) => Math.min(20, count + 1));
  }

  // ── Starting-from typeahead ──────────────────────────────────────

  onStartingFromInput(value: string): void {
    this.startingFrom.set(value);
    this.startTypeahead?.resetActiveIndex();
    this.startDropdownOpen.set(true);
  }

  onStartingFromFocus(): void {
    this.startDropdownOpen.set(true);
  }

  onStartingFromBlur(): void {
    setTimeout(() => {
      const shell = this.startShellRef?.nativeElement;
      const active = document.activeElement;
      if (shell && active && shell.contains(active)) return;
      this.startDropdownOpen.set(false);
    }, 0);
  }

  onStartingFromKeydown(event: KeyboardEvent): void {
    this.startTypeahead?.handleKeydown(event);
  }

  onStartingFromPicked(item: DestinationListItem): void {
    this.startingFrom.set(item.name);
    this.startDropdownOpen.set(false);
  }

  onBuild(): void {
    if (!this.canGenerate()) {
      return;
    }
    this.build.emit({
      startingFrom: this.startingFrom().trim(),
      arrivalDestination: this.arrivalDestination(),
      startDate: this.startDate(),
      endDate: this.endDate(),
      travelers: this.travelers(),
    });
  }
}
