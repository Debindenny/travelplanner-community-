import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { JourneyCardComponent } from '../../../features/community-home/components/home-tab/sidebar/journey-card/journey-card.component';
import { CommunityTab, JourneyStat } from '../../../core/models/community.models';

interface SubnavItem {
  tab: CommunityTab;
  icon: string;
  count?: number;
}

@Component({
  selector: 'app-sidebar-nav',
  imports: [IconComponent, JourneyCardComponent],
  templateUrl: './sidebar-nav.component.html',
  styleUrl: './sidebar-nav.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarNavComponent {
  readonly subnavItems: SubnavItem[] = [
    { tab: 'Home', icon: 'house' },
    { tab: 'Discover', icon: 'compass' },
    { tab: 'Destinations', icon: 'map-pin' },
    { tab: 'Trips', icon: 'route' },
    { tab: 'Travel Circles', icon: 'users', count: 3 },
    { tab: 'Events', icon: 'calendar-check', count: 2 },
    { tab: 'Saved', icon: 'bookmark', count: 5 },
  ];

  readonly activeTab = input.required<CommunityTab>();
  readonly journeyStats = input<JourneyStat[]>([]);

  readonly selectTab = output<CommunityTab>();
  readonly share = output<void>();
}
