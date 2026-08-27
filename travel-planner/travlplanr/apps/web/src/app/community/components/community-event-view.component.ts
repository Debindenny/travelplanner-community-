import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommunityEventCard, CommunityMockEventsService } from '../services/community-mock-events.service';

@Component({
  selector: 'app-community-event-view',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-2xl mx-auto py-8 px-4 sm:px-6 font-manrope">
      <a
        routerLink="/community/events"
        class="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full border border-slate-200 dark:border-gray-700 text-[12.5px] font-bold text-eventText-mid dark:text-gray-300 hover:border-primary hover:text-primary transition-colors mb-4"
      >
        <span aria-hidden="true">←</span> Events
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
        <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
          <!-- Banner -->
          <div
            class="relative h-[160px] p-4 bg-cover bg-center"
            [style.background-image]="
              'linear-gradient(180deg, rgba(11,18,32,.05) 40%, rgba(11,18,32,.55) 100%), url(' + event.imageUrl + ')'
            "
          >
            <div class="w-12 h-12 rounded-lg bg-white shadow flex flex-col items-center justify-center leading-none shrink-0">
              <span class="text-[9px] font-extrabold uppercase text-blue-500">{{ event.month }}</span>
              <span class="text-2xl font-black text-eventText-deep">{{ event.day }}</span>
            </div>
          </div>

          <div class="px-6 py-6 flex flex-col gap-5">
            <div>
              <h1 class="font-manrope text-2xl font-black text-eventText-deep dark:text-white mb-3">{{ event.title }}</h1>

              <div class="flex items-start justify-between gap-4">
                <div class="flex flex-col gap-1.5">
                  <span class="flex items-center gap-1.5 text-[13px] font-semibold text-eventText-mid dark:text-gray-300">
                    <svg class="w-3.5 h-3.5 text-eventText-soft shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <path d="M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                    </svg>
                    {{ event.location }}
                  </span>
                  <span class="flex items-center gap-1.5 text-[13px] font-semibold text-eventText-mid dark:text-gray-300">
                    <svg class="w-3.5 h-3.5 text-eventText-soft shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 3" />
                    </svg>
                    {{ event.time }}{{ event.duration ? ' · ' + event.duration : '' }}
                  </span>
                </div>

                <div class="text-right shrink-0">
                  <p class="text-[9.5px] font-extrabold text-eventText-soft uppercase tracking-wide mb-1">Price</p>
                  <span
                    class="inline-block px-3 py-1.5 rounded-lg text-sm font-extrabold"
                    [class.bg-green-50]="event.price === 'Free'"
                    [class.text-green-700]="event.price === 'Free'"
                    [class.dark:bg-green-500/10]="event.price === 'Free'"
                    [class.dark:text-green-400]="event.price === 'Free'"
                    [class.bg-slate-100]="event.price !== 'Free'"
                    [class.text-green-600]="event.price !== 'Free'"
                    [class.dark:bg-gray-700]="event.price !== 'Free'"
                    [class.dark:text-green-400]="event.price !== 'Free'"
                  >
                    {{ event.price }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Host -->
            <div class="flex items-center gap-3 border border-slate-200 dark:border-gray-700 rounded-2xl p-4">
              <span class="w-9 h-9 rounded-full bg-primary-50 dark:bg-primary/10 text-primary flex items-center justify-center text-xs font-extrabold shrink-0">
                {{ initials(event.hostName) }}
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-extrabold text-eventText-deep dark:text-white flex items-center gap-1.5">
                  {{ event.hostName }}
                  <span class="inline-flex items-center gap-0.5 text-[9.5px] font-extrabold text-primary bg-primary-50 dark:bg-primary/10 rounded-full px-1.5 py-0.5">
                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 14.9 4.6 18.8 4.2 19.6 8 23 9.8 21 13.2 22 17 18.3 17.9 16.9 21.5 13 20.5 9.1 21.5 7.7 17.9 4 17 5 13.2 3 9.8 6.4 8 7.2 4.2 11.1 4.6 12 2Z" opacity=".18"/><path d="m9 12 2 2 4-4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
                    Verified
                  </span>
                </p>
                <p class="text-[11px] font-semibold text-eventText-soft mt-0.5">Hosted by {{ firstName(event.hostName) }} · {{ event.hostRole }}</p>
              </div>
              <button
                type="button"
                (click)="toggleFollow()"
                class="h-8 px-3.5 rounded-lg text-xs font-bold border transition-colors shrink-0"
                [class.border-primary]="!event.followed"
                [class.text-primary]="!event.followed"
                [class.hover:bg-primary]="!event.followed"
                [class.hover:text-white]="!event.followed"
                [class.bg-primary-50]="event.followed"
                [class.border-primary-subtle]="event.followed"
                [class.text-eventText-mid]="event.followed"
              >
                {{ event.followed ? 'Following' : 'Follow' }}
              </button>
            </div>

            <p class="text-[13.5px] text-eventText-mid dark:text-gray-300 leading-relaxed">{{ event.description }}</p>

            <!-- Plan -->
            @if (event.schedule.length) {
              <div>
                <p class="text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">The plan</p>
                <ul class="space-y-2">
                  @for (step of event.schedule; track $index) {
                    <li class="flex items-start gap-2 text-xs font-semibold text-[#374151] dark:text-white">
                      <span class="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></span>
                      <span>{{ step.time ? step.time + ' · ' : '' }}{{ step.text }}</span>
                    </li>
                  }
                </ul>
              </div>
            }

            <!-- Map + meeting point -->
            @if (event.locationName) {
              <div class="rounded-xl border border-[#E4EDFB] dark:border-gray-700 overflow-hidden">
                <div class="relative h-[140px] bg-[#EAF1FE] dark:bg-gray-700/50 overflow-hidden">
                  <svg class="absolute inset-0 w-full h-full" viewBox="0 0 400 140" preserveAspectRatio="none">
                    <rect width="400" height="140" fill="#EAF1FE" />
                    <rect x="30" y="20" width="90" height="40" rx="4" fill="#D9E6FC" />
                    <rect x="260" y="70" width="110" height="45" rx="4" fill="#D9E6FC" />
                    <rect x="150" y="15" width="60" height="30" rx="4" fill="#DCEFE0" />
                    <path d="M0 55 H400" stroke="#C7D8F5" stroke-width="3" />
                    <path d="M0 95 H400" stroke="#C7D8F5" stroke-width="3" />
                    <path d="M130 0 V140" stroke="#C7D8F5" stroke-width="3" />
                    <path d="M250 0 V140" stroke="#C7D8F5" stroke-width="3" />
                  </svg>
                  <span class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full flex flex-col items-center">
                    <span class="w-8 h-8 rounded-full bg-primary border-2 border-white shadow-[0_2px_10px_rgba(37,99,235,0.5)] flex items-center justify-center shrink-0">
                      <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10Z" />
                        <circle cx="12" cy="11" r="2" fill="#2563EB" />
                      </svg>
                    </span>
                    <span class="w-0.5 h-2.5 bg-primary/70"></span>
                  </span>
                  <span class="absolute left-3 bottom-2.5 text-[9.5px] font-extrabold uppercase tracking-wide text-eventText-mid bg-white/85 rounded px-1.5 py-0.5">
                    {{ event.location }}
                  </span>
                </div>
                <div class="p-3.5 bg-[#F7FAFF] dark:bg-gray-700/50 flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-[9.5px] font-extrabold text-eventText-soft uppercase tracking-wide mb-1">Meeting point</p>
                    <p class="text-[12.5px] font-extrabold text-eventText-deep dark:text-white truncate">{{ event.locationName }}</p>
                  </div>
                  <a
                    [href]="directionsUrl(event.locationName)"
                    target="_blank"
                    rel="noopener"
                    class="h-9 px-4 rounded-lg text-xs font-bold border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-eventText-mid dark:text-gray-300 hover:border-slate-300 transition-colors shrink-0"
                  >
                    Directions
                  </a>
                </div>
              </div>
            }

            <!-- Capacity -->
            @if (capacityMax(event); as max) {
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <p class="text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em]">Capacity</p>
                  <p class="text-xs font-bold text-eventText-mid dark:text-gray-300">{{ event.travelersGoing }} of {{ max }} spots filled</p>
                </div>
                <div class="h-2 rounded-full bg-slate-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    class="h-full rounded-full"
                    style="background: linear-gradient(90deg, #3B82F6, #22C55E)"
                    [style.width.%]="capacityPercent(event, max)"
                  ></div>
                </div>
              </div>
            }

            <!-- Who is going -->
            <div>
              <p class="text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">Who is going</p>
              <div class="flex items-center justify-between border border-slate-200 dark:border-gray-700 rounded-xl px-4 py-3">
                <span class="text-xs font-bold text-eventText-mid dark:text-gray-300">
                  {{ event.travelersGoing }} traveler{{ event.travelersGoing === 1 ? '' : 's' }} going{{ event.joined ? ' · including you' : '' }}
                </span>
                <button type="button" (click)="seeWho()" class="text-xs font-bold text-primary hover:underline shrink-0">See all</button>
              </div>
            </div>

            <!-- What to bring -->
            @if (event.locationNote) {
              <div>
                <p class="text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">What to bring</p>
                <p class="text-xs font-medium text-eventText-mid dark:text-gray-400 leading-relaxed">{{ event.locationNote }}</p>
              </div>
            }
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
  private readonly eventsService = inject(CommunityMockEventsService);

  event: CommunityEventCard | null = null;

  toastMessage: string | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.event = this.eventsService.events().find((e) => e.id === id) ?? null;
  }

  initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  firstName(name: string): string {
    return name.split(' ')[0] ?? name;
  }

  directionsUrl(place: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
  }

  capacityMax(ev: CommunityEventCard): number | null {
    const match = ev.groupMax.match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  capacityPercent(ev: CommunityEventCard, max: number): number {
    return Math.min(100, Math.round((ev.travelersGoing / max) * 100));
  }

  toggleFollow(): void {
    const ev = this.event;
    if (!ev) return;
    ev.followed = !ev.followed;
    this.showToast(ev.followed ? `Following ${ev.hostName}` : `Unfollowed ${ev.hostName}`);
  }

  seeWho(): void {
    const ev = this.event;
    if (!ev) return;
    const label = ev.travelersGoing === 1 ? 'traveler' : 'travelers';
    this.showToast(`Attendee list · ${ev.travelersGoing} ${label} going`);
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = null), 2500);
  }
}
