import { computed, Injectable, signal } from '@angular/core';

import { CommunityApiService } from '../../../core/services/api.service';
import {
  CommunityCircle,
  CommunityDestination,
  CommunityDiscoverCard,
  CommunityEvent,
  CommunityHomePayload,
  CommunityJourneyStat,
  CommunityMatch,
  CommunityPost,
  CommunitySavedItem,
  CommunityStory,
  CommunityTraveler,
  CommunityTrendingItem,
  CommunityTrip,
  FeedFilter,
  ViewMode,
} from '../../../core/models/community.models';

@Injectable({ providedIn: 'root' })
export class CommunityHomeStore {
  private readonly _stories = signal<CommunityStory[]>([]);
  private readonly _posts = signal<CommunityPost[]>([]);
  private readonly _destinations = signal<CommunityDestination[]>([]);
  private readonly _trips = signal<CommunityTrip[]>([]);
  private readonly _events = signal<CommunityEvent[]>([]);
  private readonly _matches = signal<CommunityMatch[]>([]);
  private readonly _travelers = signal<CommunityTraveler[]>([]);
  private readonly _trending = signal<CommunityTrendingItem[]>([]);
  private readonly _journeyStats = signal<CommunityJourneyStat[]>([]);
  private readonly _savedItems = signal<CommunitySavedItem[]>([]);
  private readonly _discoverCards = signal<CommunityDiscoverCard[]>([]);
  private readonly _circles = signal<CommunityCircle[]>([]);
  private readonly _activeTab = signal('Home');
  private readonly _filter = signal<FeedFilter>('For You');
  private readonly _viewMode = signal<ViewMode>('Feed');
  private readonly _profileOpen = signal(false);
  private readonly _searchOpen = signal(false);
  private readonly _aiOpen = signal(false);
  private readonly _modal = signal<string | null>(null);
  private readonly _heroHasTrip = signal(true);
  private readonly _searchQuery = signal('');
  private readonly _toast = signal<string | null>(null);
  private readonly _followedIds = signal<string[]>([]);
  private readonly _savedIds = signal<string[]>([]);
  private readonly _joinedIds = signal<string[]>([]);
  private readonly _helpfulIds = signal<string[]>([]);
  private readonly _loading = signal(false);

  readonly stories = this._stories.asReadonly();
  readonly posts = this._posts.asReadonly();
  readonly destinations = this._destinations.asReadonly();
  readonly trips = this._trips.asReadonly();
  readonly events = this._events.asReadonly();
  readonly matches = this._matches.asReadonly();
  readonly travelers = this._travelers.asReadonly();
  readonly trending = this._trending.asReadonly();
  readonly journeyStats = this._journeyStats.asReadonly();
  readonly savedItems = this._savedItems.asReadonly();
  readonly discoverCards = this._discoverCards.asReadonly();
  readonly circles = this._circles.asReadonly();
  readonly activeTab = this._activeTab.asReadonly();
  readonly filter = this._filter.asReadonly();
  readonly viewMode = this._viewMode.asReadonly();
  readonly profileOpen = this._profileOpen.asReadonly();
  readonly searchOpen = this._searchOpen.asReadonly();
  readonly aiOpen = this._aiOpen.asReadonly();
  readonly modal = this._modal.asReadonly();
  readonly heroHasTrip = this._heroHasTrip.asReadonly();
  readonly searchQuery = this._searchQuery.asReadonly();
  readonly toast = this._toast.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly followedIds = this._followedIds.asReadonly();
  readonly savedIds = this._savedIds.asReadonly();
  readonly joinedIds = this._joinedIds.asReadonly();
  readonly helpfulIds = this._helpfulIds.asReadonly();

  readonly visiblePosts = computed(() => this._posts().filter((post) => {
    const filter = this._filter();
    if (filter === 'For You') {
      return true;
    }
    if (filter === 'Following') {
      return ['Tip', 'Trip', 'Journal'].includes(post.kind);
    }
    if (filter === 'Questions') {
      return post.kind === 'Question';
    }
    if (filter === 'Trip Plans') {
      return post.kind === 'Trip';
    }
    if (filter === 'Tips') {
      return post.kind === 'Tip';
    }
    return post.kind === 'Photo';
  }));

  readonly savedCount = computed(() => this._savedItems().length);

  constructor(private readonly apiService: CommunityApiService) {}

  async initialize(): Promise<void> {
    this._loading.set(true);
    try {
      const payload = await this.apiService.getCommunityHomePayload();
      this.setPayload(payload);
    } finally {
      this._loading.set(false);
    }
  }

  setActiveTab(tab: string): void {
    this._activeTab.set(tab);
    this._modal.set(null);
  }

  setFilter(filter: FeedFilter): void {
    this._filter.set(filter);
  }

  setViewMode(viewMode: ViewMode): void {
    this._viewMode.set(viewMode);
  }

  toggleProfile(): void {
    this._profileOpen.set(!this._profileOpen());
  }

  toggleSearch(query: string): void {
    this._searchQuery.set(query);
    this._searchOpen.set(query.length > 0);
  }

  closeSearch(): void {
    this._searchOpen.set(false);
  }

  toggleAiPanel(): void {
    this._aiOpen.set(!this._aiOpen());
  }

  openModal(modal: string | null): void {
    this._modal.set(modal);
  }

  closeModal(): void {
    this._modal.set(null);
  }

  toggleHeroTrip(): void {
    this._heroHasTrip.set(!this._heroHasTrip());
  }

  toggleFollow(id: string): void {
    this._followedIds.set(this._followedIds().includes(id) ? this._followedIds().filter((item) => item !== id) : [...this._followedIds(), id]);
  }

  toggleSave(id: string): void {
    this._savedIds.set(this._savedIds().includes(id) ? this._savedIds().filter((item) => item !== id) : [...this._savedIds(), id]);
  }

  toggleJoin(id: string): void {
    this._joinedIds.set(this._joinedIds().includes(id) ? this._joinedIds().filter((item) => item !== id) : [...this._joinedIds(), id]);
  }

  toggleHelpful(id: string): void {
    this._helpfulIds.set(this._helpfulIds().includes(id) ? this._helpfulIds().filter((item) => item !== id) : [...this._helpfulIds(), id]);
  }

  showToast(message: string): void {
    this._toast.set(message);
    window.setTimeout(() => this._toast.set(null), 2200);
  }

  private setPayload(payload: CommunityHomePayload): void {
    this._stories.set(payload.stories);
    this._posts.set(payload.posts);
    this._destinations.set(payload.destinations);
    this._trips.set(payload.trips);
    this._events.set(payload.events);
    this._matches.set(payload.matches);
    this._travelers.set(payload.travelers);
    this._trending.set(payload.trending);
    this._journeyStats.set(payload.journeyStats);
    this._savedItems.set(payload.savedItems);
    this._discoverCards.set(payload.discoverCards);
    this._circles.set(payload.circles);
  }
}
