import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { CommunityEventsMockStore, CURRENT_USER_ID } from '../services/community-events-mock.store';
import { CommunityEventCard } from '../services/community-event-view.model';
import { CommunityHomeSubnavComponent } from './community-home-subnav.component';
import { CommunityComposerModalComponent } from './community-composer-modal.component';
import { AuthService } from '../../auth/auth.service';
import { apiUrl } from '../../shared/utils/api-url';

export type EventsTab = 'all' | 'hosted' | 'joined';

type FilterKey = 'destination' | 'date' | 'style' | 'duration' | 'budget' | 'spots';

interface FilterDef {
  key: FilterKey;
  label: string;
  options: string[];
}

const FILTER_DEFS: FilterDef[] = [
  { key: 'destination', label: 'Destination', options: ['Paris', 'Tokyo', 'Lisbon', 'Online'] },
  { key: 'date', label: 'Date', options: ['This Week', 'This Month', 'On My Trip Dates'] },
  { key: 'style', label: 'Travel Style', options: ['Photography', 'Food', 'Culture', 'Nature'] },
  { key: 'duration', label: 'Duration', options: ['Under 2 Hours', '2-4 Hours', 'Half Day'] },
  { key: 'budget', label: 'Budget', options: ['Free', 'Paid'] },
  { key: 'spots', label: 'Available Spots', options: ['Spots Left', 'Almost Full'] }
];

@Component({
  selector: 'app-community-events',
  imports: [
    CommonModule,
    RouterLink,
    CommunityHomeSubnavComponent,
    CommunityComposerModalComponent
  ],
  templateUrl: './community-events.component.html',
  styleUrl: './community-events.component.scss'
})
export class CommunityEventsComponent {
  private readonly store = inject(CommunityEventsMockStore);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly showComposerModal = signal(false);
  readonly currentUserId = CURRENT_USER_ID;

  toastMessage: string | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;

  /** event ids currently in the customer's Saved collection — reused from the same
   * generic Save/Bookmark mechanism posts/tips/destinations already use. */
  savedEventIds = new Set<string>();
  savePendingIds = new Set<string>();

  constructor() {
    // Set by the host wizard right before it navigates back here.
    const pending = this.store.consumePendingToast();
    if (pending) this.showToast(pending);

    // Anonymous visitors can still browse the list freely — only check saved
    // state (an authenticated call) once we know someone's actually logged in.
    if (this.auth.isLoggedIn()) {
      this.loadSavedEvents();
    }
  }

  private loadSavedEvents(): void {
    this.http.get<{ items: { item_type: string; item_id: string }[] }>(apiUrl('/community/saved')).subscribe({
      next: ({ items }) => {
        this.savedEventIds = new Set(items.filter((i) => i.item_type === 'event').map((i) => i.item_id));
      },
      error: (err) => console.error('Failed to load saved events', err),
    });
  }

  isEventSaved(ev: CommunityEventCard): boolean {
    return this.savedEventIds.has(ev.id);
  }

  /** Toggles this event's Save/Bookmark state — persisted server-side via the same
   * /community/saved/toggle endpoint (CommunityCollectionItem, item_type 'event') used
   * for posts/tips/destinations, so it survives refresh, login/logout and device changes. */
  toggleSaveEvent(ev: CommunityEventCard, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.savePendingIds.has(ev.id)) return;
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.savePendingIds.add(ev.id);
    this.http.post<{ saved: boolean }>(apiUrl('/community/saved/toggle'), { item_type: 'event', item_id: ev.id }).subscribe({
      next: ({ saved }) => {
        this.savePendingIds.delete(ev.id);
        if (saved) this.savedEventIds.add(ev.id);
        else this.savedEventIds.delete(ev.id);
        this.showToast(saved ? 'Saved to your collection' : 'Removed from saved');
      },
      error: (err) => {
        this.savePendingIds.delete(ev.id);
        console.error('Save toggle failed', err);
        this.showToast('Could not update saved status — please try again.');
      },
    });
  }

  get events(): CommunityEventCard[] {
    return this.store.events();
  }

  activeTab: EventsTab = 'all';

  setTab(tab: EventsTab): void {
    this.activeTab = tab;
  }

  get visibleEvents(): CommunityEventCard[] {
    let list = this.events;
    if (this.activeTab === 'hosted') {
      list = list.filter((ev) => ev.hostId === this.currentUserId);
    } else if (this.activeTab === 'joined') {
      list = list.filter((ev) => ev.joined);
    }
    return list.filter((ev) => this.matchesFilters(ev));
  }

  /** Destination + price chips shown at the bottom of an event card — always exactly 2. */
  tagsFor(ev: CommunityEventCard): string[] {
    const parts = ev.location.split(',').map((p) => p.trim()).filter(Boolean);
    const destination = parts[parts.length - 1] || ev.location;
    return [destination, ev.price];
  }

  /** Multi-city route for a hosted journey card; falls back to the single `location`. */
  citiesFor(ev: CommunityEventCard): string[] {
    if (ev.cities?.length) return ev.cities;
    const parts = ev.location.split(',').map((p) => p.trim()).filter(Boolean);
    return parts.length ? [parts[parts.length - 1]] : [];
  }

  /** Trip-window label shown in blue at the top of the card, e.g. "03 - 12 JUN". */
  dateRangeFor(ev: CommunityEventCard): string {
    return ev.dateRangeLabel || `${ev.month} ${ev.day}`;
  }

  /** Interest/theme chips at the bottom of a journey card; falls back to destination + price. */
  interestTagsFor(ev: CommunityEventCard): string[] {
    return ev.interestTags?.length ? ev.interestTags : this.tagsFor(ev);
  }

  /** Initials shown when a host has no avatar photo. */
  hostInitials(ev: CommunityEventCard): string {
    return ev.hostName
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  // ── Advanced filters ─────────────────────────────────────────────
  // Single-select per category: each FilterKey holds at most one chosen
  // value (or null for "no filter on this category"), while every category
  // can be active at the same time — e.g. destination=Tokyo AND budget=Paid.
  readonly filterDefs = FILTER_DEFS;

  openFilter: FilterKey | null = null;

  private readonly selected: Record<FilterKey, string | null> = {
    destination: null,
    date: null,
    style: null,
    duration: null,
    budget: null,
    spots: null
  };

  toggleFilterPanel(key: FilterKey): void {
    this.openFilter = this.openFilter === key ? null : key;
  }

  closeFilterPanel(): void {
    this.openFilter = null;
  }

  /** Picking an option replaces whatever was selected for this filter; picking the same option again clears it. */
  toggleOption(key: FilterKey, option: string): void {
    this.selected[key] = this.selected[key] === option ? null : option;
    this.openFilter = null;
  }

  isSelected(key: FilterKey, option: string): boolean {
    return this.selected[key] === option;
  }

  selectedValue(key: FilterKey): string | null {
    return this.selected[key];
  }

  selectedCount(key: FilterKey): number {
    return this.selected[key] ? 1 : 0;
  }

  clearFilter(key: FilterKey, event?: Event): void {
    event?.stopPropagation();
    this.selected[key] = null;
  }

  get hasActiveFilters(): boolean {
    return this.filterDefs.some((f) => this.selected[f.key] !== null);
  }

  clearAllFilters(): void {
    for (const f of this.filterDefs) this.selected[f.key] = null;
  }

  /**
   * The current filter selection in the shape an API request would send —
   * one value (or null) per category. This page has no backend of its own
   * yet (CommunityEventsMockStore is in-memory), but any future
   * `/community/events?...` call should be built from exactly this object
   * rather than re-deriving query params elsewhere.
   */
  get filterQueryParams(): {
    destination: string | null;
    date: string | null;
    travelStyle: string | null;
    duration: string | null;
    budget: string | null;
    availableSpots: string | null;
  } {
    return {
      destination: this.selected.destination,
      date: this.selected.date,
      travelStyle: this.selected.style,
      duration: this.selected.duration,
      budget: this.selected.budget,
      availableSpots: this.selected.spots
    };
  }

  private matchesFilters(ev: CommunityEventCard): boolean {
    return (
      this.matchesOption(this.selected.destination, (opt) => this.matchesDestination(ev, opt)) &&
      this.matchesOption(this.selected.date, (opt) => this.matchesDate(ev, opt)) &&
      this.matchesOption(this.selected.style, (opt) => this.styleFor(ev) === opt) &&
      this.matchesOption(this.selected.duration, (opt) => this.matchesDuration(ev, opt)) &&
      this.matchesOption(this.selected.budget, (opt) => (opt === 'Free' ? ev.price === 'Free' : ev.price !== 'Free')) &&
      this.matchesOption(this.selected.spots, (opt) => this.matchesSpots(ev, opt))
    );
  }

  /** null = no filtering on this category; otherwise the event must match the single selected option. */
  private matchesOption(selected: string | null, predicate: (option: string) => boolean): boolean {
    if (selected === null) return true;
    return predicate(selected);
  }

  private matchesDestination(ev: CommunityEventCard, option: string): boolean {
    if (option === 'Online') return ev.tag === 'Online';
    return ev.location.toLowerCase().includes(option.toLowerCase());
  }

  private eventDate(ev: CommunityEventCard): Date {
    const year = new Date().getFullYear();
    const time = ev.time.match(/\d{1,2}:\d{2}/)?.[0] ?? '00:00';
    let d = new Date(`${ev.month} ${ev.day}, ${year} ${time}`);
    if (isNaN(d.getTime())) return new Date(NaN);
    if (d.getTime() < Date.now() - 86400000) d = new Date(`${ev.month} ${ev.day}, ${year + 1} ${time}`);
    return d;
  }

  private matchesDate(ev: CommunityEventCard, option: string): boolean {
    const d = this.eventDate(ev);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    if (option === 'This Week') {
      const diff = d.getTime() - now.getTime();
      return diff >= -86400000 && diff <= 7 * 86400000;
    }
    if (option === 'This Month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (option === 'On My Trip Dates') {
      // Mock: matches the sample "Paris · Long weekend" trip window (Jun 03–Jun 08).
      return d.getMonth() === 5 && d.getDate() >= 3 && d.getDate() <= 8;
    }
    return false;
  }

  /** Simple keyword classification over mock event copy — there's no dedicated travel-style field. */
  private styleFor(ev: CommunityEventCard): string {
    const text = `${ev.title} ${ev.description}`.toLowerCase();
    if (ev.tag === 'Food' || /food|ramen|eat|drink|cuisine|meal/.test(text)) return 'Food';
    if (/photo|camera/.test(text)) return 'Photography';
    if (/sunset|nature|hike|trail|garden|outdoor|viewpoint|miradouro/.test(text)) return 'Nature';
    return 'Culture';
  }

  private durationMinutes(ev: CommunityEventCard): number {
    const hours = Number(ev.duration.match(/(\d+)h/)?.[1] ?? 0);
    const mins = Number(ev.duration.match(/(\d+)m/)?.[1] ?? 0);
    return hours * 60 + mins;
  }

  private matchesDuration(ev: CommunityEventCard, option: string): boolean {
    const mins = this.durationMinutes(ev);
    if (mins <= 0) return false;
    if (option === 'Under 2 Hours') return mins < 120;
    if (option === '2-4 Hours') return mins >= 120 && mins <= 240;
    if (option === 'Half Day') return mins > 240;
    return false;
  }

  private capacityMax(ev: CommunityEventCard): number | null {
    const match = ev.groupMax.match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  private matchesSpots(ev: CommunityEventCard, option: string): boolean {
    const max = this.capacityMax(ev);
    if (!max) return option === 'Spots Left';
    const remaining = max - ev.travelersGoing;
    const almostFullThreshold = Math.max(1, Math.round(max * 0.15));
    if (option === 'Almost Full') return remaining > 0 && remaining <= almostFullThreshold;
    if (option === 'Spots Left') return remaining > almostFullThreshold;
    return false;
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = null), 2500);
  }
}
