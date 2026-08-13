import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { TravelCrewCardComponent } from '../sidebar/travel-crew-card/travel-crew-card.component';
import { TravelersRailCardComponent } from '../sidebar/travelers-rail-card/travelers-rail-card.component';
import { StartCircleCardComponent } from '../sidebar/start-circle-card/start-circle-card.component';
import { TrendingCardComponent } from '../sidebar/trending-card/trending-card.component';
import { UpcomingEventsCardComponent } from '../sidebar/upcoming-events-card/upcoming-events-card.component';
import { SidebarFooterLinksComponent } from '../sidebar/sidebar-footer-links/sidebar-footer-links.component';
import {
  CrewMessage,
  CrewMessageKind,
  TrendingItem,
  TravelerRailItem,
  UpcomingEvent,
} from '../../../../../core/models/community.models';

@Component({
  selector: 'app-community-sidebar',
  imports: [
    TravelCrewCardComponent,
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

  readonly inCrew = input(false);
  readonly crewMessages = input<CrewMessage[]>([]);
  readonly crewDraft = input('');
  readonly crewVotes = input<Readonly<Record<string, string>>>({});
  readonly crewRsvpIds = input<ReadonlySet<string>>(new Set());
  readonly crewSettledIds = input<ReadonlySet<string>>(new Set());

  readonly toggleFollowTraveler = output<TravelerRailItem>();
  readonly createCircle = output<void>();
  readonly openTrending = output<TrendingItem>();
  readonly toggleJoinEvent = output<UpcomingEvent>();

  readonly joinCrew = output<void>();
  readonly crewDraftChange = output<string>();
  readonly sendCrew = output<void>();
  readonly addCrewCard = output<CrewMessageKind>();
  readonly voteCrewPoll = output<{ messageId: string; optionId: string }>();
  readonly toggleCrewRsvp = output<string>();
  readonly toggleCrewSettled = output<string>();
}
