import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ParisCrewCardComponent } from '../sidebar/paris-crew-card/paris-crew-card.component';
import { TravelersRailCardComponent } from '../sidebar/travelers-rail-card/travelers-rail-card.component';
import { TrendingCardComponent } from '../sidebar/trending-card/trending-card.component';
import { UpcomingEventsCardComponent } from '../sidebar/upcoming-events-card/upcoming-events-card.component';
import { SidebarFooterLinksComponent } from '../sidebar/sidebar-footer-links/sidebar-footer-links.component';
import {
  CrewCardKind,
  CrewMessage,
  TrendingItem,
  TravelerRailItem,
  UpcomingEvent,
} from '../../../../../core/models/community.models';

@Component({
  selector: 'app-community-sidebar',
  imports: [
    ParisCrewCardComponent,
    TravelersRailCardComponent,
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
  readonly openTrending = output<TrendingItem>();
  readonly toggleJoinEvent = output<UpcomingEvent>();

  readonly joinCrew = output<void>();
  readonly startCrewCircle = output<void>();
  readonly crewDraftChange = output<string>();
  readonly sendCrewMessage = output<void>();
  readonly addCrewCard = output<CrewCardKind>();
  readonly voteCrewPoll = output<{ messageId: string; optionId: string }>();
  readonly rsvpCrewMeet = output<string>();
  readonly declineCrewMeet = output<void>();
  readonly settleCrewSplit = output<string>();
  readonly addCrewPlaceToTrip = output<string>();
}
