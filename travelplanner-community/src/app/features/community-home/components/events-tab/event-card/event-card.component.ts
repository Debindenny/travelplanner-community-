import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { EventListing } from '../../../../../core/models/community.models';

@Component({
  selector: 'app-event-card',
  imports: [],
  templateUrl: './event-card.component.html',
  styleUrl: './event-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventCardComponent {
  readonly event = input.required<EventListing>();
  readonly joined = input(false);

  readonly join = output<EventListing>();
  readonly details = output<EventListing>();
}
