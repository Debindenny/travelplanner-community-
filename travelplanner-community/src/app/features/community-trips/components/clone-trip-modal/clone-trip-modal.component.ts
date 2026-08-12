import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CommunityTrip } from '../../data/community-trips.data';

export interface CloneTripPayload {
  dates: string;
  travelers: string;
  pace: string;
  interests: string[];
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

  readonly authorFirstName = computed(() => this.trip().author.split(' ')[0]);

  readonly paceOptions = ['Slow', 'Balanced', 'Packed'];
  readonly interestOptions = ['Food', 'Museums', 'Nature', 'Nightlife', 'Photography', 'Shopping'];

  readonly dates = signal('Oct 12 - Oct 19');
  readonly travelers = signal('2 adults');
  readonly pace = signal('Balanced');
  readonly interests = signal<ReadonlySet<string>>(new Set(['Food', 'Museums']));

  readonly cancel = output<void>();
  readonly build = output<CloneTripPayload>();

  toggleInterest(option: string): void {
    const next = new Set(this.interests());
    if (next.has(option)) {
      next.delete(option);
    } else {
      next.add(option);
    }
    this.interests.set(next);
  }

  onBuild(): void {
    this.build.emit({
      dates: this.dates().trim(),
      travelers: this.travelers().trim(),
      pace: this.pace(),
      interests: Array.from(this.interests()),
    });
  }
}
