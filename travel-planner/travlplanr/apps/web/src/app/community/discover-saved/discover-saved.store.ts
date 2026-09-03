import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastService } from 'ui';

import { apiUrl } from '../../shared/utils/api-url';
import { TRIP_ITINERARIES, TRIP_PICK_OPTIONS } from './discover-saved.data';
import {
  AddToTripPayload,
  DiscoverFilters,
  DiscoverItem,
  DiscoverPlaceOption,
  ModalState,
  SavedCollectionCard,
  SavedCollectionTab,
  SavedDetailPayload,
} from './discover-saved.models';

const EMPTY_FILTERS: DiscoverFilters = {
  categories: ['All'],
  places: [{ label: 'All places', count: 0 }],
  sorts: ['Most used'],
};

/** Keeps "All places" pinned first, then ranks the rest by count so the most-used
 * place (e.g. Paris) shows at the top of the dropdown instead of insertion order. */
function sortPlacesByCount(places: DiscoverPlaceOption[]): DiscoverPlaceOption[] {
  const allPlaces = places.find((p) => p.label === 'All places');
  const rest = places
    .filter((p) => p.label !== 'All places')
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return allPlaces ? [allPlaces, ...rest] : rest;
}

@Injectable({ providedIn: 'root' })
export class DiscoverSavedStore {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);

  private readonly _modal = signal<ModalState | null>(null);
  private readonly _followedIds = signal<ReadonlySet<string>>(new Set());

  private readonly _discoverCategory = signal('All');
  private readonly _discoverQuery = signal('');
  private readonly _discoverPlace = signal('All places');
  private readonly _discoverSort = signal('Most used');
  private readonly _discoverPlaceOpen = signal(false);
  private readonly _discoverSortOpen = signal(false);
  private readonly _discoverFilters = signal<DiscoverFilters>(EMPTY_FILTERS);
  private readonly _discoverItems = signal<DiscoverItem[]>([]);
  private readonly _discoverLoading = signal(false);
  private discoverQueryDebounce?: ReturnType<typeof setTimeout>;

  private readonly _savedCollectionTab = signal<SavedCollectionTab>('All');
  private readonly _savedItems = signal<SavedCollectionCard[]>([]);
  private readonly _savedLoading = signal(false);

  private readonly _tripPick = signal('t1');
  private readonly _addDay = signal(1);

  readonly modal = this._modal.asReadonly();
  readonly followedIds = this._followedIds.asReadonly();

  readonly savedCollectionTab = this._savedCollectionTab.asReadonly();
  readonly savedCollectionTabs: SavedCollectionTab[] = ['All', 'Tips', 'Trips', 'Spots'];

  readonly discoverCategory = this._discoverCategory.asReadonly();
  readonly discoverQuery = this._discoverQuery.asReadonly();
  readonly discoverPlace = this._discoverPlace.asReadonly();
  readonly discoverSort = this._discoverSort.asReadonly();
  readonly discoverPlaceOpen = this._discoverPlaceOpen.asReadonly();
  readonly discoverSortOpen = this._discoverSortOpen.asReadonly();
  readonly discoverLoading = this._discoverLoading.asReadonly();
  readonly savedLoading = this._savedLoading.asReadonly();

  readonly tripPick = this._tripPick.asReadonly();
  readonly addDay = this._addDay.asReadonly();
  readonly tripPickOptions = TRIP_PICK_OPTIONS;

  // Decorative flavor text — there's no real "who's browsing now" backend concept.
  readonly discoverLiveCount = '1,284 travelers browsing now';

  get discoverCategories(): string[] {
    return this._discoverFilters().categories;
  }

  get discoverPlaces(): string[] {
    return this._discoverFilters().places.map((place) => place.label);
  }

  readonly activeAddToTripPayload = computed(() => this._modal()?.addToTrip ?? null);
  readonly activeDiscoverItem = computed(() => this._modal()?.discoverItem ?? null);
  readonly activeSavedItem = computed(() => this._modal()?.savedItem ?? null);

  readonly discoverShown = computed(() => this._discoverItems());

  readonly savedIds = computed(() => new Set(this._discoverItems().filter((item) => item.isSaved).map((item) => item.id)));

  readonly discoverPlaceOptions = computed(() => {
    const selected = this._discoverPlace();
    return this._discoverFilters().places.map((place) => ({ ...place, active: place.label === selected }));
  });

  readonly discoverSortOptions = computed(() => {
    const selected = this._discoverSort();
    return this._discoverFilters().sorts.map((sort) => ({ label: sort, active: sort === selected }));
  });

  readonly discoverResultLine = computed(() => {
    const count = this.discoverShown().length;
    const place = this._discoverPlace();
    const suffix = place !== 'All places' ? ` in ${place}` : '';
    return `${count} ${count === 1 ? 'result' : 'results'}${suffix}`;
  });

  readonly discoverFiltersActive = computed(
    () => !!this._discoverQuery() || this._discoverPlace() !== 'All places' || this._discoverCategory() !== 'All',
  );

  readonly discoverEmpty = computed(() => !this._discoverLoading() && this.discoverShown().length === 0);

  readonly discoverEmptyTitle = computed(() => {
    const query = this._discoverQuery().trim();
    return query ? `Nothing matches "${query}"` : 'Nothing matches those filters';
  });

  readonly savedCollectionItems = computed(() => {
    const tab = this._savedCollectionTab();
    return this._savedItems().filter((item) => tab === 'All' || `${item.kind}s` === tab);
  });

  readonly savedCollectionEmpty = computed(() => !this._savedLoading() && this.savedCollectionItems().length === 0);

  readonly savedCollectionCount = computed(() => {
    const count = this.savedCollectionItems().length;
    return `${count} ${count === 1 ? 'item saved' : 'items saved'}`;
  });

  /** Total saved items regardless of the currently-selected tab filter — used by the sidebar badge. */
  readonly savedItemCount = computed(() => this._savedItems().length);

  private readonly activeItinerary = computed(() => TRIP_ITINERARIES[this._tripPick()] ?? []);

  readonly addDays = computed(() =>
    this.activeItinerary().map((day, index) => ({
      label: `DAY ${index + 1}`,
      date: day.date,
      count: `${day.items.length} ${day.items.length === 1 ? 'item' : 'items'}`,
      active: this._addDay() === index + 1,
      day: index + 1,
    })),
  );

  readonly addConfirmationLine = computed(() => {
    const trip = this.tripPickOptions.find((option) => option.id === this._tripPick());
    const date = this.activeItinerary()[this._addDay() - 1]?.date ?? '';
    return `Adds to ${trip?.name ?? 'your trip'} · Day ${this._addDay()}, ${date}`;
  });

  /** Call once when the Discover page mounts — loads filter options + the first result page. */
  loadDiscover(): void {
    this.http.get<DiscoverFilters>(apiUrl('/community/discover/filters')).subscribe({
      next: (filters) => this._discoverFilters.set({
        ...filters,
        places: sortPlacesByCount(filters.places),
      }),
      error: () => this.toast.info('Could not load Discover filters'),
    });
    this.fetchDiscoverList();
  }


  /** Call each time the Saved page mounts — the collection can change while away from it. */
  loadSaved(): void {
    this._savedLoading.set(true);
    this.http.get<{ items: SavedCollectionCard[] }>(apiUrl('/community/saved')).subscribe({
      next: ({ items }) => {
        this._savedItems.set(items);
        this._savedLoading.set(false);
      },
      error: () => {
        this._savedLoading.set(false);
        this.toast.info('Could not load your saved items');
      },
    });
  }

  private fetchDiscoverList(): void {
    this._discoverLoading.set(true);
    const params: Record<string, string> = {
      category: this._discoverCategory(),
      place: this._discoverPlace(),
      sort: this._discoverSort(),
    };
    const query = this._discoverQuery().trim();
    if (query) {
      params['q'] = query;
    }
    this.http.get<{ items: DiscoverItem[] }>(apiUrl('/community/discover'), { params }).subscribe({
      next: ({ items }) => {
        this._discoverItems.set(items);
        this._discoverLoading.set(false);
      },
      error: () => {
        this._discoverItems.set([]);
        this._discoverLoading.set(false);
        this.toast.info('Could not load Discover results');
      },
    });
  }

  selectDiscoverCategory(category: string): void {
    this._discoverCategory.set(category);
    this.fetchDiscoverList();
  }

  setDiscoverQuery(query: string): void {
    this._discoverQuery.set(query);
    clearTimeout(this.discoverQueryDebounce);
    this.discoverQueryDebounce = setTimeout(() => this.fetchDiscoverList(), 300);
  }

  toggleDiscoverPlaceMenu(): void {
    this._discoverPlaceOpen.set(!this._discoverPlaceOpen());
    this._discoverSortOpen.set(false);
  }

  pickDiscoverPlace(place: string): void {
    this._discoverPlace.set(place);
    this._discoverPlaceOpen.set(false);
    this.fetchDiscoverList();
  }

  toggleDiscoverSortMenu(): void {
    this._discoverSortOpen.set(!this._discoverSortOpen());
    this._discoverPlaceOpen.set(false);
  }

  pickDiscoverSort(sort: string): void {
    this._discoverSort.set(sort);
    this._discoverSortOpen.set(false);
    this.fetchDiscoverList();
  }

  clearDiscoverFilters(): void {
    this._discoverQuery.set('');
    this._discoverPlace.set('All places');
    this._discoverCategory.set('All');
    this._discoverSort.set('Most used');
    this.toast.info('Filters cleared');
    this.fetchDiscoverList();
  }

  toggleFollow(id: string, name: string): void {
    // Discover tips are editorial content, not real customer profiles — this
    // stays a local, decorative toggle (no backend "follow a tip author" endpoint).
    const wasFollowing = this._followedIds().has(id);
    this._followedIds.set(this.toggledSet(this._followedIds(), id));
    this.toast.info(wasFollowing ? `Unfollowed ${name}` : `Followed ${name}`);
  }

  toggleSave(id: string): void {
    this.http.post<{ saved: boolean }>(apiUrl('/community/saved/toggle'), { item_type: 'tip', item_id: id }).subscribe({
      next: ({ saved }) => {
        this._discoverItems.update((items) => items.map((item) => (item.id === id ? { ...item, isSaved: saved } : item)));
        this.toast.info(saved ? 'Saved to your collection' : 'Removed from saved');
        // Refresh the saved list so the sidebar count and Saved page reflect this immediately,
        // without needing to navigate to Saved first.
        this.loadSaved();
      },
      error: () => this.toast.info('Could not update saved status'),
    });
  }

  selectSavedCollectionTab(tab: SavedCollectionTab): void {
    this._savedCollectionTab.set(tab);
  }

  /** Removes a Saved-page item by its collection-item id (not the underlying tip/post id). */
  removeSavedCollectionItem(id: string): void {
    this.http.delete(apiUrl(`/community/saved/items/${id}`)).subscribe({
      next: () => {
        this._savedItems.update((items) => items.filter((item) => item.id !== id));
        this.toast.info('Removed from saved');
      },
      error: () => this.toast.info('Could not remove saved item'),
    });
  }

  openDiscoverItem(item: DiscoverItem): void {
    this._modal.set({ kind: 'discoverDetail', discoverItem: item });
  }

  openSavedItem(item: SavedCollectionCard): void {
    const [place, used] = item.meta.split('·').map((part) => part.trim());
    const savedUsed = used || 'Recently';
    const payload: SavedDetailPayload = {
      id: item.id,
      tag: item.kind.toUpperCase(),
      place: place || 'Saved',
      title: item.title,
      image: item.image,
      used: savedUsed.charAt(0).toUpperCase() + savedUsed.slice(1),
      facts: [
        { label: 'TYPE', value: item.kind },
        { label: 'SAVED', value: savedUsed.replace(/^saved\s+/i, '') },
      ],
    };
    this._modal.set({ kind: 'savedDetail', savedItem: payload });
  }

  openAddToTrip(payload: AddToTripPayload): void {
    this._tripPick.set('t1');
    this._addDay.set(1);
    this._modal.set({ kind: 'addToTrip', addToTrip: payload });
  }

  pickTrip(tripId: string): void {
    this._tripPick.set(tripId);
    this._addDay.set(1);
  }

  pickAddDay(day: number): void {
    this._addDay.set(day);
  }

  confirmAddToTrip(): void {
    const trip = this.tripPickOptions.find((option) => option.id === this._tripPick());
    const date = this.activeItinerary()[this._addDay() - 1]?.date ?? '';
    this._modal.set(null);
    this.toast.info(`Added to ${trip?.name ?? 'your trip'} · Day ${this._addDay()}, ${date}`);
  }

  closeModal(): void {
    this._modal.set(null);
  }

  private toggledSet<T>(source: ReadonlySet<T>, value: T, forceOn?: boolean): Set<T> {
    const next = new Set(source);
    const shouldHave = forceOn ?? !next.has(value);
    if (shouldHave) {
      next.add(value);
    } else {
      next.delete(value);
    }
    return next;
  }
}
