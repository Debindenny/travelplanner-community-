import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { EventListing } from '../../../../../core/models/community.models';

const FACE_GRADIENTS = [
  'linear-gradient(140deg,#F2B872,#D2604B)',
  'linear-gradient(140deg,#0A6E7C,#2AA98B)',
  'linear-gradient(140deg,#6B3FA0,#0060EA)',
  'linear-gradient(140deg,#0060EA,#2AA98B)',
];

@Component({
  selector: 'app-event-detail-modal',
  imports: [IconComponent],
  templateUrl: './event-detail-modal.component.html',
  styleUrl: './event-detail-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventDetailModalComponent {
  readonly event = input.required<EventListing>();
  readonly joined = input(false);
  readonly followed = input(false);

  readonly close = output<void>();
  readonly join = output<void>();
  readonly followHost = output<void>();
  readonly addToTrip = output<void>();
  readonly seeWho = output<void>();

  readonly faceGradients = FACE_GRADIENTS;

  readonly hostInitials = computed(() =>
    this.event()
      .host.name.split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  );

  readonly goingLine = computed(
    () => `${this.event().travelersGoing} travelers going${this.joined() ? ' · including you' : ''}`,
  );

  readonly spacesLeftLine = computed(() => {
    const left = Math.max(0, this.event().spacesLeft - (this.joined() ? 1 : 0));
    return `${left} spaces left`;
  });
}
