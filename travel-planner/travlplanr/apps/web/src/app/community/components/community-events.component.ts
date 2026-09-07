import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommunityEventsMockStore, CURRENT_USER_ID } from '../services/community-events-mock.store';
import { CommunityEventCard } from '../services/community-event-view.model';
import { CommunityHomeSubnavComponent } from './community-home-subnav.component';
import { CommunityComposerModalComponent } from './community-composer-modal.component';

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

  readonly showComposerModal = signal(false);
  readonly currentUserId = CURRENT_USER_ID;

  toastMessage: string | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Set by the host wizard right before it navigates back here.
    const pending = this.store.consumePendingToast();
    if (pending) this.showToast(pending);
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

  /** Location + price chips shown at the bottom of an event card. */
  tagsFor(ev: CommunityEventCard): string[] {
    const parts = ev.location.split(',').map((p) => p.trim()).filter(Boolean);
    return [...parts, ev.price];
  }

  // ── Advanced filters ─────────────────────────────────────────────
  readonly filterDefs = FILTER_DEFS;

  openFilter: FilterKey | null = null;

  private readonly selected: Record<FilterKey, Set<string>> = {
    destination: new Set(),
    date: new Set(),
    style: new Set(),
    duration: new Set(),
    budget: new Set(),
    spots: new Set()
  };

  toggleFilterPanel(key: FilterKey): void {
    this.openFilter = this.openFilter === key ? null : key;
  }

  closeFilterPanel(): void {
    this.openFilter = null;
  }

  toggleOption(key: FilterKey, option: string): void {
    const set = this.selected[key];
    if (set.has(option)) {
      set.delete(option);
    } else {
      set.add(option);
    }
  }

  isSelected(key: FilterKey, option: string): boolean {
    return this.selected[key].has(option);
  }

  selectedCount(key: FilterKey): number {
    return this.selected[key].size;
  }

  clearFilter(key: FilterKey, event?: Event): void {
    event?.stopPropagation();
    this.selected[key].clear();
  }

  get hasActiveFilters(): boolean {
    return this.filterDefs.some((f) => this.selectedCount(f.key) > 0);
  }

  clearAllFilters(): void {
    for (const f of this.filterDefs) this.selected[f.key].clear();
  }

  private matchesFilters(ev: CommunityEventCard): boolean {
    return (
      this.matchesGroup(this.selected.destination, (opt) => this.matchesDestination(ev, opt)) &&
      this.matchesGroup(this.selected.date, (opt) => this.matchesDate(ev, opt)) &&
      this.matchesGroup(this.selected.style, (opt) => this.styleFor(ev) === opt) &&
      this.matchesGroup(this.selected.duration, (opt) => this.matchesDuration(ev, opt)) &&
      this.matchesGroup(this.selected.budget, (opt) => (opt === 'Free' ? ev.price === 'Free' : ev.price !== 'Free')) &&
      this.matchesGroup(this.selected.spots, (opt) => this.matchesSpots(ev, opt))
    );
  }

  /** Empty selection = no filtering on this category; otherwise any selected option matching is enough (OR). */
  private matchesGroup(selected: Set<string>, predicate: (option: string) => boolean): boolean {
    if (selected.size === 0) return true;
    return [...selected].some(predicate);
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
