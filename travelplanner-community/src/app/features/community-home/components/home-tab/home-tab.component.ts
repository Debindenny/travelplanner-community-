import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { HeroCardComponent } from './hero-card/hero-card.component';
import { StoryRailComponent } from './story-rail/story-rail.component';
import { FeedFilterBarComponent } from './feed-filter-bar/feed-filter-bar.component';
import { PostCardComponent } from './post-card/post-card.component';
import { SimilarTravelersComponent } from './similar-travelers/similar-travelers.component';
import { CommunitySidebarComponent } from './community-sidebar/community-sidebar.component';
import { CommunityHomeStore } from '../../store/community-home.store';
import { CommunityStory, PostComment, TravelMatch, TravelerRailItem, TrendingItem, UpcomingEvent } from '../../../../core/models/community.models';

interface MapPin {
  label: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-home-tab',
  imports: [
    IconComponent,
    HeroCardComponent,
    StoryRailComponent,
    FeedFilterBarComponent,
    PostCardComponent,
    SimilarTravelersComponent,
    CommunitySidebarComponent,
  ],
  templateUrl: './home-tab.component.html',
  styleUrl: './home-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeTabComponent {
  readonly store = inject(CommunityHomeStore);

  readonly mapPins: MapPin[] = [
    { label: 'Shibuya Sky · 12 tips', x: 20, y: 28 },
    { label: 'Montmartre · 18 saves', x: 56, y: 18 },
    { label: 'Louvre · 31 posts', x: 38, y: 56 },
    { label: 'Lisbon route · 9 trips', x: 68, y: 64 },
  ];

  isFollowed(id: string): boolean {
    return this.store.followedIds().has(id);
  }

  isSaved(id: string): boolean {
    return this.store.savedIds().has(id);
  }

  isHelpfulOn(id: string): boolean {
    return this.store.helpfulOnIds().has(id);
  }

  isJoined(id: string): boolean {
    return this.store.joinedIds().has(id);
  }

  isCommentsOpen(id: string): boolean {
    return this.store.openCommentPostIds().has(id);
  }

  draftFor(id: string): string {
    return this.store.commentDrafts()[id] ?? '';
  }

  onOpenStory(story: CommunityStory): void {
    this.store.openStoryViewer(story);
  }

  onToggleFollowTraveler(item: TravelMatch | TravelerRailItem): void {
    this.store.toggleFollow(item.id, item.name);
  }

  onReply(postId: string, comment: PostComment): void {
    this.store.replyToComment(postId, comment.author.split(' ')[0]);
  }

  onOpenTrending(item: TrendingItem): void {
    this.store.showToast(`Opening “${item.title}”`);
  }

  onToggleJoinEvent(event: UpcomingEvent): void {
    this.store.toggleJoin(event.id, event.name);
  }
}
