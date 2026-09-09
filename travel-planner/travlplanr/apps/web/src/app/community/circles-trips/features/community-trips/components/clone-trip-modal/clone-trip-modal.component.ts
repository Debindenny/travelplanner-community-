import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CommunityTrip } from '../../data/community-trips.data';

export interface CloneTripPayload {
  startingFrom: string;
  arrivalDestination: string;
  startDate: string;
  endDate: string;
  travelers: number;
}

@Component({
  selector: 'app-clone-trip-modal',
  imports: [IconComponent],
  templateUrl: './clone-trip-modal.component.html',
  styleUrl: './clone-trip-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloneTripModalComponent {
  readonly trip = input.required<CommunityTrip>();

  readonly destinationPlaceholder = computed(() => `e.g. ${this.trip().title}`);

  readonly startingFrom = signal('');
  readonly arrivalDestination = signal('');
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly travelers = signal(2);

  readonly missingFieldHint = computed(() => {
    if (!this.startingFrom().trim()) {
      return 'Add where you start from';
    }
    if (!this.arrivalDestination().trim()) {
      return 'Add your arrival destination';
    }
    if (!this.startDate()) {
      return 'Add your start date';
    }
    if (!this.endDate()) {
      return 'Add your end date';
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

  onBuild(): void {
    if (!this.canGenerate()) {
      return;
    }
    this.build.emit({
      startingFrom: this.startingFrom().trim(),
      arrivalDestination: this.arrivalDestination().trim(),
      startDate: this.startDate(),
      endDate: this.endDate(),
      travelers: this.travelers(),
    });
  }
}
