import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommunityEventsMockStore } from '../services/community-events-mock.store';
import { CommunityEventCard } from '../services/community-event-view.model';

@Component({
  selector: 'app-community-event-view',
  imports: [RouterLink],
  template: `
    <div class="max-w-5xl mx-auto py-8 px-4 sm:px-6 font-manrope">
      <a
        routerLink="/community/events"
        class="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-sm text-[12.5px] font-bold text-eventText-mid dark:text-gray-300 hover:border-primary hover:text-primary hover:shadow-md transition-all mb-4"
      >
        <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Events
      </a>

      @if (!event) {
        <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-12 text-center shadow-sm">
          <h3 class="font-manrope font-extrabold text-base text-eventText-deep dark:text-white mb-1">Event not found</h3>
          <p class="text-eventText-mid dark:text-gray-300 text-xs mb-4">It may have been removed.</p>
          <a routerLink="/community/events" class="inline-block px-4 py-2 text-xs bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all">
            Back to events
          </a>
        </div>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Main column -->
          <div class="lg:col-span-8 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
            <!-- Hero -->
            <div
              class="relative h-64 sm:h-72 p-5 flex flex-col justify-between bg-cover bg-center"
              [style.background-image]="
                'linear-gradient(180deg, rgba(11,18,32,.15) 0%, rgba(11,18,32,.1) 35%, rgba(11,18,32,.88) 100%), url(' + event.imageUrl + ')'
              "
            >
              <div>
                <span class="px-2.5 py-1 rounded-full bg-white/95 text-[11px] font-extrabold text-primary shrink-0">
                  {{ event.tag }}
                </span>
              </div>

              <div class="text-white">
                <h1 class="font-manrope text-2xl sm:text-3xl font-black leading-tight mb-1.5">{{ event.title }}</h1>
                <p class="text-[12.5px] font-semibold text-white/85 mb-3">
                  {{ event.location }} · {{ event.time }}{{ event.duration ? ' · ' + event.duration : '' }} · {{ event.price }}
                </p>
                <div class="flex items-center gap-3">
                  <span class="w-9 h-9 rounded-full bg-white/15 border border-white/25 shrink-0"></span>
                  <div class="leading-tight">
                    <p class="text-[10.5px] font-semibold text-white/70">Hosted by</p>
                    <p class="text-xs font-bold text-white/95">{{ event.hostName }}</p>
                  </div>
                  <span class="w-px h-8 bg-white/25 shrink-0"></span>
                  <span class="flex items-center gap-1.5 text-xs font-bold text-white/90">
                    <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    {{ event.travelersGoing }}{{ capacityMax(event) ? ' / ' + capacityMax(event) : '' }} Travelers joined
                  </span>
                </div>
              </div>
            </div>

            <div class="px-6 py-6 flex flex-col gap-5">
              <!-- About -->
              <div class="bg-[#FAFBFD] dark:bg-gray-700/30 border border-slate-100 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-4">
                <div>
                  <p class="text-[9.5px] font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">About this event</p>
                  <p class="text-[13.5px] text-eventText-mid dark:text-gray-300 leading-relaxed">{{ event.description }}</p>
                </div>

                @if (event.locationName) {
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <p class="flex items-center gap-1.5 text-[9.5px] font-extrabold text-eventText-soft uppercase tracking-wide mb-1">
                        <svg class="w-3 h-3 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                          <path d="M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                        </svg>
                        Meeting point
                      </p>
                      <p class="text-[12.5px] font-extrabold text-eventText-deep dark:text-white">{{ event.locationName }}</p>
                    </div>
                    @if (event.tag !== 'Online') {
                      <a
                        [href]="directionsUrl(event.locationName)"
                        target="_blank"
                        rel="noopener"
                        class="text-[11px] font-bold text-primary hover:underline shrink-0"
                      >
                        Directions
                      </a>
                    }
                  </div>
                }

                @if (event.locationNote) {
                  <div>
                    <p class="flex items-center gap-1.5 text-[9.5px] font-extrabold text-eventText-soft uppercase tracking-wide mb-1">
                      <svg class="w-3 h-3 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 12h6M9 16h6M9 8h6M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
                      </svg>
                      What to bring
                    </p>
                    <p class="text-[12.5px] font-semibold text-eventText-deep dark:text-white leading-relaxed">{{ event.locationNote }}</p>
                  </div>
                }
              </div>

              <!-- Plan -->
              @if (event.schedule.length) {
                <div>
                  <p class="text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">What happens</p>
                  <div class="rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                    <div class="flex items-center justify-between px-4 py-2.5 bg-primary text-white">
                      <span class="text-[11px] font-extrabold uppercase tracking-wide">The plan</span>
                      <span class="text-[11px] font-extrabold uppercase tracking-wide">{{ event.month }} {{ event.day }}</span>
                    </div>
                    <ul class="divide-y divide-slate-100 dark:divide-gray-700">
                      @for (step of event.schedule; track $index) {
                        <li class="flex items-center justify-between gap-3 px-4 py-3">
                          <div class="min-w-0">
                            <p class="text-xs font-extrabold text-eventText-deep dark:text-white truncate">{{ step.text }}</p>
                            @if (step.time) {
                              <p class="text-[11px] font-semibold text-eventText-soft mt-0.5">Starts {{ step.time }}</p>
                            }
                          </div>
                          <span class="px-2 py-1 rounded-md bg-slate-100 dark:bg-gray-700 text-eventText-soft dark:text-gray-300 text-[10px] font-bold shrink-0">
                            {{ event.price }}
                          </span>
                        </li>
                      }
                    </ul>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Sidebar: Your Ticket -->
          <div class="lg:col-span-4">
            <div class="lg:sticky lg:top-6 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 flex flex-col gap-4">
              <div>
                <h2 class="font-manrope text-base font-black text-eventText-deep dark:text-white">Your Ticket</h2>
                <p class="text-[11.5px] font-semibold text-eventText-soft mt-0.5">Review the details, then join</p>
              </div>

              <div class="flex flex-col divide-y divide-slate-100 dark:divide-gray-700 border-t border-b border-slate-100 dark:border-gray-700">
                <div class="flex items-center justify-between py-2.5">
                  <span class="text-xs font-semibold text-eventText-mid dark:text-gray-300">Ticket</span>
                  <span class="text-xs font-extrabold text-eventText-deep dark:text-white">{{ event.price }}</span>
                </div>
                <div class="flex items-center justify-between py-2.5">
                  <span class="text-xs font-semibold text-eventText-mid dark:text-gray-300">Spots</span>
                  <span class="text-xs font-extrabold text-eventText-deep dark:text-white">
                    {{ event.travelersGoing }}{{ capacityMax(event) ? ' / ' + capacityMax(event) : '' }}
                  </span>
                </div>
                <div class="flex items-center justify-between py-2.5">
                  <span class="text-xs font-bold text-eventText-deep dark:text-white">Total</span>
                  <span class="text-xs font-extrabold text-eventText-deep dark:text-white">{{ event.price }}</span>
                </div>
              </div>

              <button
                type="button"
                (click)="toggleJoin()"
                class="h-11 rounded-xl text-sm font-extrabold transition-colors"
                [class.bg-primary]="!event.joined"
                [class.hover:bg-primary-hover]="!event.joined"
                [class.text-white]="!event.joined"
                [class.bg-primary-50]="event.joined"
                [class.text-primary]="event.joined"
              >
                {{ event.joined ? "You're going" : 'Join this event' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Toast -->
    @if (toastMessage) {
      <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg">
        {{ toastMessage }}
      </div>
    }

  `
})
export class CommunityEventDetailViewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(CommunityEventsMockStore);

  event: CommunityEventCard | null = null;

  toastMessage: string | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.event = id ? this.store.getById(id) : null;
  }

  directionsUrl(place: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
  }

  capacityMax(ev: CommunityEventCard): number | null {
    const match = ev.groupMax.match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  toggleJoin(): void {
    const ev = this.event;
    if (!ev) return;
    const joined = this.store.toggleJoin(ev.id);
    this.event = this.store.getById(ev.id);
    this.showToast(joined ? "You're going!" : `Spot released · ${ev.title}`);
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = null), 2500);
  }
}
