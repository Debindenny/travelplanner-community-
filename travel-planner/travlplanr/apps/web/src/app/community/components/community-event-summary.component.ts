import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommunityEventsMockStore } from '../services/community-events-mock.store';
import { CommunityEventCard, JourneyDay } from '../services/community-event-view.model';
import {
  BookingSelection,
  EventCostBreakdown,
  buildEventCostBreakdown,
  selectedDaysFor,
} from '../services/community-event-booking.util';
import { ItineraryTimelineComponent } from '../../itinerary/components/itinerary-timeline/itinerary-timeline.component';
import type { DetailDay, DetailItem } from '../../itinerary/itinerary-page.component';
import type { DetailActivity } from '../../trip/trip.service';
import { EventDayTab, EventDayTabsComponent } from './event-day-tabs.component';

/**
 * Intermediary informational recap between the Event Detail page and the existing
 * booking/review page — lets the traveler see the full itinerary, inclusions/exclusions
 * and an estimated cost breakdown before committing to "Join Event", which then
 * hands off to the unchanged review → payment → confirmation flow.
 */
@Component({
  selector: 'app-community-event-summary',
  imports: [CommonModule, RouterLink, ItineraryTimelineComponent, EventDayTabsComponent],
  template: `
    @if (!event) {
      <div class="max-w-5xl mx-auto py-8 px-4 sm:px-6 font-manrope">
        <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-12 text-center shadow-sm">
          <h3 class="font-manrope font-extrabold text-base text-eventText-deep dark:text-white mb-1">Event not found</h3>
          <p class="text-eventText-mid dark:text-gray-300 text-xs mb-4">It may have been removed.</p>
          <a routerLink="/community/events" class="inline-block px-4 py-2 text-xs bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all">
            Back to events
          </a>
        </div>
      </div>
    } @else {
      <div class="font-manrope">
        <!-- Breadcrumb -->
        <nav class="w-full bg-slate-50 dark:bg-gray-900 border-b border-slate-100 dark:border-gray-800 flex items-center gap-2 text-xs font-semibold text-eventText-soft dark:text-gray-400 flex-wrap">
          <div class="page-container w-full px-5 xl:px-20 py-3 flex items-center gap-2 flex-wrap">
            <a routerLink="/community" class="hover:text-primary transition-colors">Community</a>
            <span class="text-slate-300 dark:text-gray-600">/</span>
            <a routerLink="/community/events" class="hover:text-primary transition-colors">Hosted Journeys</a>
            <span class="text-slate-300 dark:text-gray-600">/</span>
            <span class="font-extrabold text-eventText-deep dark:text-white">Summary</span>
          </div>
        </nav>

        <!-- Hero -->
        <div class="page-container mx-auto px-5 xl:px-20 pt-6">
          <div
            class="relative w-full h-[240px] sm:h-[300px] rounded-2xl overflow-hidden bg-cover bg-center flex flex-col justify-end p-6 sm:p-8"
            [style.background-image]="
              'linear-gradient(0deg, rgba(11,18,32,.88) 0%, rgba(11,18,32,.2) 45%, rgba(11,18,32,.35) 100%), url(' + event.imageUrl + ')'
            "
          >
            <h1 class="text-white text-2xl sm:text-4xl font-black leading-tight mb-2">{{ event.title }}</h1>

            <div class="flex items-center gap-2 text-white/90 text-xs sm:text-sm font-bold mb-3 flex-wrap">
              <span class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {{ durationLabel() }}
              </span>
              <span class="text-white/50">&bull;</span>
              <span class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><path d="M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                </svg>
                {{ locationLabel() }}
              </span>
            </div>

            <div class="flex items-center gap-3 mb-2">
              <img
                *ngIf="event.hostAvatarUrl; else heroInitials"
                [src]="event.hostAvatarUrl"
                class="w-9 h-9 rounded-full object-cover border-2 border-white/50 shrink-0"
                alt=""
              />
              <ng-template #heroInitials>
                <span class="w-9 h-9 rounded-full bg-white/15 border border-white/40 text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
                  {{ hostInitials() }}
                </span>
              </ng-template>
              <div class="leading-tight">
                <p class="text-[10.5px] font-semibold text-white/70">Hosted by</p>
                <p class="text-xs font-extrabold text-white">{{ event.hostName }}{{ event.hostRole ? ' (' + event.hostRole + ')' : '' }}</p>
              </div>
            </div>

            <span class="text-xs font-extrabold text-white">
              {{ event.travelersGoing }}{{ event.travelersMax ? ' / ' + event.travelersMax : '' }} Travelers Joined
            </span>
          </div>
        </div>

        <!-- Tabs + content + sidebar -->
        <app-event-day-tabs [days]="selectedDays" [activeTab]="activeTab" (tabSelect)="activeTab = $event"></app-event-day-tabs>

        <div class="page-container mx-auto px-5 xl:px-20 pt-6 pb-28">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <!-- Left column: tab content -->
            <div class="lg:col-span-2 flex flex-col gap-5">
              @if (activeTab === 'summary') {
                <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5">
                  <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-2">Event Overview</p>
                  <p class="text-[13.5px] text-eventText-mid dark:text-gray-300 leading-relaxed">{{ event.description }}</p>
                </div>

                <div class="grid gap-5 md:grid-cols-2">
                  <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-xl p-5 shadow-sm">
                    <div class="flex items-center gap-2 mb-3">
                      <span class="w-6 h-6 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-sm shrink-0">&#10003;</span>
                      <p class="text-xs font-extrabold text-eventText-deep dark:text-white">Inclusions</p>
                    </div>
                    <ul class="flex flex-col gap-2">
                      <li *ngFor="let inc of inclusions" class="flex items-start gap-2 text-xs font-semibold text-eventText-mid dark:text-gray-300 leading-relaxed">
                        <span class="text-green-500 shrink-0 select-none">&#10003;</span>
                        {{ inc }}
                      </li>
                    </ul>
                  </div>

                  <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-xl p-5 shadow-sm">
                    <div class="flex items-center gap-2 mb-3">
                      <span class="w-6 h-6 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-sm shrink-0">&#10007;</span>
                      <p class="text-xs font-extrabold text-eventText-deep dark:text-white">Exclusions</p>
                    </div>
                    <ul class="flex flex-col gap-2">
                      <li *ngFor="let exc of exclusions" class="flex items-start gap-2 text-xs font-semibold text-eventText-mid dark:text-gray-300 leading-relaxed">
                        <span class="text-red-400 shrink-0 select-none">&#10007;</span>
                        {{ exc }}
                      </li>
                    </ul>
                  </div>
                </div>

                <div>
                  <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-3">Itinerary Overview</p>
                  <app-itinerary-timeline [displayedDays]="allDetailDays()" [getItemKey]="activityItemKey" [readOnly]="true"></app-itinerary-timeline>
                </div>
              } @else {
                <app-itinerary-timeline [displayedDays]="dayDetailDays(activeTab)" [getItemKey]="activityItemKey" [readOnly]="true"></app-itinerary-timeline>
              }
            </div>

            <!-- Right column: cost breakdown -->
            <aside class="lg:sticky lg:top-6 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5">
              <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-3">Cost Breakdown</p>
              <div class="flex flex-col divide-y divide-slate-100 dark:divide-gray-700 mb-3">
                <div class="flex items-center justify-between py-2 text-xs">
                  <span class="font-semibold text-eventText-mid dark:text-gray-300">Accommodation</span>
                  <span class="font-extrabold text-eventText-deep dark:text-white">&#8377;{{ costs.accommodation | number }}</span>
                </div>
                <div class="flex items-center justify-between py-2 text-xs">
                  <span class="font-semibold text-eventText-mid dark:text-gray-300">Activities</span>
                  <span class="font-extrabold text-eventText-deep dark:text-white">&#8377;{{ costs.activities | number }}</span>
                </div>
                <div class="flex items-center justify-between py-2 text-xs">
                  <span class="font-semibold text-eventText-mid dark:text-gray-300">Food</span>
                  <span class="font-extrabold text-eventText-deep dark:text-white">&#8377;{{ costs.food | number }}</span>
                </div>
                <div class="flex items-center justify-between py-2 text-xs">
                  <span class="font-semibold text-eventText-mid dark:text-gray-300">Transport</span>
                  <span class="font-extrabold text-eventText-deep dark:text-white">&#8377;{{ costs.transport | number }}</span>
                </div>
                <div class="flex items-center justify-between py-2 text-xs">
                  <span class="font-semibold text-eventText-mid dark:text-gray-300">Service Charges</span>
                  <span class="font-extrabold text-eventText-deep dark:text-white">&#8377;{{ costs.serviceCharges | number }}</span>
                </div>
              </div>
              <div class="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-gray-700 mb-5">
                <span class="text-sm font-extrabold text-eventText-deep dark:text-white">Estimated Total</span>
                <span class="text-lg font-extrabold text-primary">&#8377;{{ costs.estimatedTotal | number }}</span>
              </div>

              <button
                type="button"
                (click)="bookFullItinerary()"
                class="w-full h-11 rounded-xl text-sm font-extrabold text-white bg-primary hover:bg-primary-hover transition-colors"
              >
                Join Event
              </button>
            </aside>
          </div>
        </div>
      </div>
    }
  `,
})
export class CommunityEventSummaryComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(CommunityEventsMockStore);

  event: CommunityEventCard | null = null;
  selection: BookingSelection = { mode: 'full', rangeStart: null, rangeEnd: null };
  selectedDays: JourneyDay[] = [];
  costs: EventCostBreakdown = { accommodation: 0, activities: 0, food: 0, transport: 0, serviceCharges: 0, estimatedTotal: 0 };
  activeTab: EventDayTab = 'summary';

  readonly inclusions = ['Accommodation', 'Activities', 'Meals', 'Local Transport', 'Event Access'];
  readonly exclusions = ['Personal Expenses', 'Optional Activities', 'Insurance', 'Additional Purchases'];

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.event = id ? this.store.getById(id) : null;

    const state = history.state as Partial<BookingSelection> | undefined;
    this.selection = {
      mode: state?.mode === 'partial' ? 'partial' : 'full',
      rangeStart: state?.rangeStart ?? null,
      rangeEnd: state?.rangeEnd ?? null,
    };

    if (this.event) {
      this.selectedDays = selectedDaysFor(this.event, this.selection);
      this.costs = buildEventCostBreakdown(this.selectedDays, this.event.baseFee ?? 0);
    }
  }

  durationLabel(): string {
    const ev = this.event;
    if (!ev) return '';
    const totalDays = ev.days?.length ?? 0;
    if (!totalDays) return ev.duration;
    const nights = ev.nights ?? Math.max(totalDays - 1, 0);
    return `${totalDays} Days / ${nights} Nights`;
  }

  locationLabel(): string {
    const ev = this.event;
    if (!ev) return '';
    return ev.cities?.length ? ev.cities.join(' · ') : ev.location;
  }

  hostInitials(): string {
    const ev = this.event;
    if (!ev) return '';
    return ev.hostName
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  /** Maps this journey's day/activity data onto the shared itinerary-timeline component's shape (see itinerary-page.component.ts DetailDay/DetailActivity). */
  private mapDays(days: JourneyDay[]): DetailDay[] {
    return days.map((d) => ({
      day: d.day,
      title: d.city,
      dateStr: d.dateLabel,
      items: d.activities.map((a): DetailActivity => ({
        id: a.id,
        type: 'activity',
        time: a.time,
        title: a.title,
        rating: a.rating,
        location: d.city,
        refundable: a.price != null ? 'Non-refundable' : 'Free cancellation',
        image: a.image,
        price: a.price ?? undefined,
        duration: a.duration || undefined,
      })),
    }));
  }

  allDetailDays(): DetailDay[] {
    return this.mapDays(this.selectedDays);
  }

  dayDetailDays(day: 'summary' | number): DetailDay[] {
    if (day === 'summary') return [];
    const match = this.selectedDays.find((d) => d.day === day);
    return match ? this.mapDays([match]) : [];
  }

  readonly activityItemKey = (item: DetailItem): string => {
    const activity = item as DetailActivity;
    return activity.id || activity.title;
  };

  /** Hands off to the event's full Detail page, where the traveler picks Full/Partial join and
   * continues into the existing booking/review flow. */
  bookFullItinerary(): void {
    const ev = this.event;
    if (!ev) return;
    this.router.navigate(['/community/events', ev.id]);
  }
}
