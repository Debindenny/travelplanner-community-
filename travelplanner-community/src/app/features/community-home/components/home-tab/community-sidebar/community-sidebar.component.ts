import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { TravelersRailCardComponent } from '../sidebar/travelers-rail-card/travelers-rail-card.component';
import { StartCircleCardComponent } from '../sidebar/start-circle-card/start-circle-card.component';
import { TrendingCardComponent } from '../sidebar/trending-card/trending-card.component';
import { UpcomingEventsCardComponent } from '../sidebar/upcoming-events-card/upcoming-events-card.component';
import { SidebarFooterLinksComponent } from '../sidebar/sidebar-footer-links/sidebar-footer-links.component';
import {
  TrendingItem,
  TravelerRailItem,
  UpcomingEvent,
} from '../../../../../core/models/community.models';

@Component({
  selector: 'app-community-sidebar',
  imports: [
    TravelersRailCardComponent,
    StartCircleCardComponent,
    TrendingCardComponent,
    UpcomingEventsCardComponent,
    SidebarFooterLinksComponent,
  ],
  templateUrl: './community-sidebar.component.html',
  styleUrl: './community-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunitySidebarComponent {
  readonly travelersRail = input<TravelerRailItem[]>([]);
  readonly trending = input<TrendingItem[]>([]);
  readonly events = input<UpcomingEvent[]>([]);
  readonly followedIds = input<ReadonlySet<string>>(new Set());
  readonly joinedIds = input<ReadonlySet<string>>(new Set());
  readonly tripDestination = input('Paris');

  readonly toggleFollowTraveler = output<TravelerRailItem>();
  readonly createCircle = output<void>();
  readonly openTrending = output<TrendingItem>();
  readonly toggleJoinEvent = output<UpcomingEvent>();
}
