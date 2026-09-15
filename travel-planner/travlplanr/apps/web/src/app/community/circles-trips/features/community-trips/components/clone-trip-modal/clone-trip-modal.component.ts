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

  // Free-typed text isn't a real place until it's picked from the
  // typeahead — this flips false on every keystroke and back to true
  // only when `onStartingFromPicked` fires, so "Generate itinerary" can't
  // be reached with an unresolved location like "wafewdfw".
  readonly startingFromValid = signal(false);

  // End date defaults to start date + (trip length - 1) so most travelers
  // never have to touch it, but it's just a starting point — `endDateOverride`
  // holds a value the traveler typed in directly, and wins over the default
  // until the start date changes (a new start invalidates the old override).
  private readonly endDateOverride = signal<string | null>(null);

  readonly endDate = computed(() => {
    const override = this.endDateOverride();
    if (override) return override;
    const start = this.startDate();
    if (!start) return '';
    const nights = Math.max((this.trip().days || 1) - 1, 0);
    return addDays(start, nights);
  });

  readonly missingFieldHint = computed(() => {
    if (!this.startingFrom().trim()) {
      return 'Add where you start from';
    }
    if (!this.startingFromValid()) {
      return 'Pick your starting city from the suggestions';
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
    if (this.endDate() < this.startDate()) {
      return 'End date must be on or after the start date';
    }
    return null;
  });

  readonly canGenerate = computed(() => this.missingFieldHint() === null);

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
    this.startingFromValid.set(false);
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
    this.startingFromValid.set(true);
    this.startDropdownOpen.set(false);
  }

  // ── Dates ─────────────────────────────────────────────────────────

  onStartDateInput(value: string): void {
    this.startDate.set(value);
    this.endDateOverride.set(null);
  }

  onEndDateInput(value: string): void {
    this.endDateOverride.set(value);
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
