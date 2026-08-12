import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { EventsFilter } from '../../../../../core/models/community.models';

@Component({
  selector: 'app-event-filter-bar',
  imports: [],
  templateUrl: './event-filter-bar.component.html',
  styleUrl: './event-filter-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventFilterBarComponent {
  readonly filters: EventsFilter[] = ['All', 'Near me', 'Online'];

  readonly activeFilter = input.required<EventsFilter>();

  readonly selectFilter = output<EventsFilter>();
}
