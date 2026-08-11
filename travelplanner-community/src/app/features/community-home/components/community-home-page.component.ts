import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppHeaderComponent } from '../../../shared/components/app-header/app-header.component';
import { CommunityHomeStore } from '../store/community-home.store';

@Component({
  selector: 'app-community-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AppHeaderComponent],
  templateUrl: './community-home-page.component.html',
  styleUrl: './community-home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityHomePageComponent implements OnInit {
  readonly store = inject(CommunityHomeStore);
  readonly activeTab = computed(() => this.store.activeTab());
  readonly selectedFilter = computed(() => this.store.filter());
  readonly viewMode = computed(() => this.store.viewMode());
  readonly heroHasTrip = computed(() => this.store.heroHasTrip());
  readonly searchQuery = computed(() => this.store.searchQuery());
  readonly searchOpen = computed(() => this.store.searchOpen());
  readonly profileOpen = computed(() => this.store.profileOpen());
  readonly aiOpen = computed(() => this.store.aiOpen());
  readonly modal = computed(() => this.store.modal());
  readonly visiblePosts = computed(() => this.store.visiblePosts());
  readonly loading = computed(() => this.store.loading());
  readonly stories = computed(() => this.store.stories());
  readonly destinations = computed(() => this.store.destinations());
  readonly trips = computed(() => this.store.trips());
  readonly events = computed(() => this.store.events());
  readonly matches = computed(() => this.store.matches());
  readonly travelers = computed(() => this.store.travelers());
  readonly trending = computed(() => this.store.trending());
  readonly journeyStats = computed(() => this.store.journeyStats());
  readonly savedItems = computed(() => this.store.savedItems());
  readonly discoverCards = computed(() => this.store.discoverCards());
  readonly circles = computed(() => this.store.circles());
  readonly followedIds = computed(() => this.store.followedIds());
  readonly savedIds = computed(() => this.store.savedIds());
  readonly joinedIds = computed(() => this.store.joinedIds());
  readonly helpfulIds = computed(() => this.store.helpfulIds());

  readonly filters = ['For You', 'Following', 'Near My Trip', 'Questions', 'Trip Plans', 'Tips', 'Photos'];
  readonly viewModes = ['Feed', 'Map'];
  readonly subTabs = ['Home', 'Discover', 'Destinations', 'Trips', 'Travel Circles', 'Events', 'Saved'];
  readonly discoverTabs = ['All', 'Tips', 'Routes', 'Reels', 'Food', 'Budget'];
  readonly destinationSorts = ['Popular', 'Near me'];
  readonly tripFilters = ['Popular', 'Recent', 'Budget', 'Luxury'];
  readonly eventFilters = ['All', 'Near me', 'Online'];
  readonly savedTabs = ['All', 'Tips', 'Trips', 'Spots'];
  readonly searchSuggestions = [
    { icon: '🗺️', label: 'Japan destination community', kind: 'Destination' },
    { icon: '🧭', label: 'Japan 7-day trips', kind: 'Trips' },
    { icon: '💡', label: 'Japan travel tips', kind: 'Posts' },
  ];
  readonly aiPrompts = [
    'What are travelers recommending in Paris right now?',
    'Build a 3-day itinerary from my saved posts',
    'Find travelers visiting Barcelona around my dates',
  ];

  readonly heroBadge = signal('YOUR NEXT TRIP · IN 18 DAYS');
  readonly planText = signal('');

  ngOnInit(): void {
    void this.store.initialize();
  }

  onSelectTab(tab: string): void {
    this.store.setActiveTab(tab);
  }

  onFilterSelect(filter: string): void {
    this.store.setFilter(filter as never);
  }

  onViewModeSelect(mode: string): void {
    this.store.setViewMode(mode as never);
  }

  toggleProfile(): void {
    this.store.toggleProfile();
  }

  onSearchChange(value: string): void {
    this.store.toggleSearch(value);
  }

  onSearchFocus(): void {
    this.store.toggleSearch(this.searchQuery());
  }

  toggleAI(): void {
    this.store.toggleAiPanel();
  }

  openComposer(): void {
    this.store.openModal('form');
  }

  toggleHeroTrip(): void {
    this.store.toggleHeroTrip();
  }

  toggleFollow(id: string): void {
    this.store.toggleFollow(id);
    this.store.showToast(this.followedIds().includes(id) ? 'Following updated' : 'Following updated');
  }

  toggleSave(id: string): void {
    this.store.toggleSave(id);
    this.store.showToast(this.savedIds().includes(id) ? 'Saved' : 'Removed');
  }

  toggleJoin(id: string): void {
    this.store.toggleJoin(id);
    this.store.showToast(this.joinedIds().includes(id) ? 'Joined' : 'Left');
  }

  toggleHelpful(id: string): void {
    this.store.toggleHelpful(id);
  }

  closeModal(): void {
    this.store.closeModal();
  }

  openModal(type: string): void {
    this.store.openModal(type);
  }

  submitPost(): void {
    this.store.closeModal();
    this.store.showToast('Posted to the community');
  }

  planTrip(): void {
    this.store.showToast(this.planText() ? `Building: ${this.planText()}` : 'Tell TRAVL AI where you’re going');
  }
}
