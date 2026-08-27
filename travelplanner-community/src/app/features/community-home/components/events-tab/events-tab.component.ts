import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { EventCardComponent } from './event-card/event-card.component';
import { EventFilterBarComponent } from './event-filter-bar/event-filter-bar.component';
import { CommunityHomeStore } from '../../store/community-home.store';
import { EventListing, EventsFilter } from '../../../../core/models/community.models';

@Component({
  selector: 'app-events-tab',
  imports: [EventCardComponent, EventFilterBarComponent],
  templateUrl: './events-tab.component.html',
  styleUrl: './events-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventsTabComponent {
  readonly store = inject(CommunityHomeStore);

  isJoined(id: string): boolean {
    return this.store.joinedIds().has(id);
  }

  onSelectFilter(filter: EventsFilter): void {
    this.store.selectEventsFilter(filter);
  }

  onJoinEvent(event: EventListing): void {
    this.store.toggleJoin(event.id, event.title);
  }

  onShowDetails(event: EventListing): void {
    this.store.showToast(`Opening “${event.title}”`);
  }
}
