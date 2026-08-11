import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { UpcomingEvent } from '../../../../../../core/models/community.models';

@Component({
  selector: 'app-upcoming-events-card',
  imports: [],
  templateUrl: './upcoming-events-card.component.html',
  styleUrl: './upcoming-events-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpcomingEventsCardComponent {
  readonly events = input<UpcomingEvent[]>([]);
  readonly joinedIds = input<ReadonlySet<string>>(new Set());

  readonly toggleJoin = output<UpcomingEvent>();
}
