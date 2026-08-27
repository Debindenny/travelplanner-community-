import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CommunityEventsService, CommunityEvent, isEventOnline } from '../services/community-events.service';

type EventsFilter = 'All' | 'Near me' | 'Online';

@Component({
    selector: 'app-community-events',
    imports: [CommonModule, RouterLink, TranslatePipe],
    template: `
    <div class="max-w-6xl mx-auto py-8 px-4 sm:px-6 font-manrope">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 mb-4 text-[12.5px] font-bold text-eventText-soft">
        <a
          routerLink="/community"
          class="w-7 h-7 rounded-full border border-slate-200 dark:border-gray-700 flex items-center justify-center hover:border-primary hover:text-primary transition-colors"
          aria-label="Back to Community"
          >←</a
        >
        <a routerLink="/community" class="hover:text-primary transition-colors">Community</a>
        <span class="text-slate-300 dark:text-gray-600">/</span>
        <span class="font-extrabold text-eventText-deep dark:text-white">Events</span>
      </nav>

      <!-- Header -->
      <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p class="text-[11px] font-extrabold text-eventText-soft uppercase tracking-[0.12em] mb-1.5">Events &amp; Meetups</p>
          <h1 class="font-manrope text-2xl sm:text-3xl font-black text-eventText-deep dark:text-white mb-1">Meet travelers in person</h1>
          <p class="text-eventText-mid dark:text-gray-300 text-sm">Photo walks, food crawls and live planning sessions — hosted by travelers, not brands.</p>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <!-- Filter segmented control -->
          <div class="flex items-center gap-0.5 p-1 rounded-xl bg-slate-100 dark:bg-gray-800" role="group" aria-label="Filter events">
            @for (f of filters; track f) {
              <button
                type="button"
                (click)="activeFilter.set(f)"
                [attr.aria-pressed]="activeFilter() === f"
                class="h-8 px-4 rounded-lg text-xs font-bold transition-colors"
                [class.bg-white]="activeFilter() === f"
                [class.dark:bg-gray-700]="activeFilter() === f"
                [class.text-eventText-deep]="activeFilter() === f"
                [class.dark:text-white]="activeFilter() === f"
                [class.shadow-sm]="activeFilter() === f"
                [class.text-eventText-soft]="activeFilter() !== f"
                [class.hover:text-eventText-mid]="activeFilter() !== f"
              >
                {{ f }}
              </button>
            }
          </div>

          <a
            routerLink="/community/events/host"
            class="h-9 pl-3.5 pr-4 rounded-lg text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Host an event
          </a>
        </div>
      </div>

      <!-- Loading skeleton -->
      @if (isLoading()) {
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="bg-white/80 dark:bg-gray-800/90 rounded-2xl border border-slate-100 dark:border-gray-700/80 overflow-hidden animate-pulse">
              <div class="h-[180px] bg-slate-200 dark:bg-gray-700"></div>
              <div class="p-4">
                <div class="h-3 bg-slate-200 dark:bg-gray-700 rounded w-1/3"></div>
              </div>
            </div>
          }
        </div>
      } @else if (loadError()) {
        <div class="bg-white/80 border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
          <span class="text-3xl mb-3 block">⚠️</span>
          <h3 class="font-manrope font-extrabold text-base text-eventText-deep mb-1">Couldn't load meetups</h3>
          <p class="text-eventText-mid text-xs mb-4">Something went wrong while fetching events.</p>
          <button (click)="loadEvents()" class="px-4 py-2 text-xs bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all">
            Retry
          </button>
        </div>
      } @else {
        <!-- Events grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          @for (ev of visibleEvents(); track ev.id) {
            <article
              class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col group"
            >
              <!-- Banner: date chip + category badge -->
              <div
                class="relative h-[180px] p-4 flex flex-col justify-between bg-cover bg-center"
                [style.background-image]="cardBackground(ev)"
              >
                <div class="flex items-start justify-between">
                  <div class="w-12 h-12 rounded-lg bg-white shadow flex flex-col items-center justify-center leading-none shrink-0">
                    <span class="text-[9px] font-extrabold uppercase text-eventText-soft">{{ monthLabel(ev.starts_at) }}</span>
                    <span class="text-2xl font-black text-eventText-deep">{{ dayLabel(ev.starts_at) }}</span>
                  </div>

                  <span
                    class="px-3 py-1.5 rounded-md border text-[11.5px] font-extrabold shrink-0"
                    [class.bg-eventTag-blueBg]="!isOnline(ev)"
                    [class.border-eventTag-blueBorder]="!isOnline(ev)"
                    [class.text-primary]="!isOnline(ev)"
                    [class.bg-eventTag-purpleBg]="isOnline(ev)"
                    [class.border-eventTag-purpleBorder]="isOnline(ev)"
                    [class.text-eventTag-purpleText]="isOnline(ev)"
                  >
                    {{ ev.badge ?? (isOnline(ev) ? 'Online' : 'Meetup') }}
                  </span>
                </div>

                <div>
                  <h3 class="font-manrope text-lg font-extrabold text-white leading-tight [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]">
                    <a [routerLink]="['/community/events', ev.id]">{{ ev.title }}</a>
                  </h3>
                  <p class="text-xs font-semibold text-white/85 mt-1 [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]">
                    {{ ev.location || 'Online' }} · {{ timeLabel(ev.starts_at) }}
                  </p>
                </div>
              </div>

              <!-- Content -->
              <div class="p-4 flex flex-col gap-3">
                <span class="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary/10 text-primary text-2xs-plus font-bold">
                  <svg class="text-primary shrink-0" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M8 1C8.6 5.2 8.8 6.6 12.5 8C8.8 9.4 8.6 10.8 8 15C7.4 10.8 7.2 9.4 3.5 8C7.2 6.6 7.4 5.2 8 1Z"
                      stroke="currentColor"
                      stroke-width="1.75"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  {{ personalizationReason(ev) }}
                </span>

                <div class="flex items-center justify-between">
                  <span
                    class="inline-block px-3 py-1 rounded-lg text-sm font-extrabold"
                    [class.bg-success-50]="isFree(ev)"
                    [class.text-success]="isFree(ev)"
                    [class.bg-primary-50]="!isFree(ev)"
                    [class.text-primary]="!isFree(ev)"
                  >
                    {{ ev.cost || 'Free' }}
                  </span>
                  <span class="text-xs font-bold text-eventText-mid dark:text-gray-300">
                    {{ ev.attendee_count }} going
                  </span>
                </div>

                <div class="flex items-center gap-2">
                  <a
                    [routerLink]="['/community/events', ev.id]"
                    class="h-9 px-4 rounded-lg text-xs font-bold border border-slate-200 dark:border-gray-700 text-eventText-mid dark:text-gray-300 hover:border-slate-300 transition-colors flex items-center justify-center"
                  >
                    Details
                  </a>
                  <button
                    type="button"
                    (click)="toggleRsvp(ev)"
                    class="h-9 flex-1 rounded-lg text-xs font-bold transition-colors"
                    [class.bg-primary-50]="ev.rsvp_status === 'going'"
                    [class.text-primary]="ev.rsvp_status === 'going'"
                    [class.bg-primary]="ev.rsvp_status !== 'going'"
                    [class.text-white]="ev.rsvp_status !== 'going'"
                    [class.hover:bg-primary-hover]="ev.rsvp_status !== 'going'"
                  >
                    {{ ev.rsvp_status === 'going' ? 'Going' : 'Join' }}
                  </button>
                </div>
              </div>
            </article>
          }
          @if (visibleEvents().length === 0) {
            <div class="col-span-full bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-12 text-center shadow-sm">
              <span class="text-3xl mb-3 block">📅</span>
              <h3 class="font-manrope font-extrabold text-base text-eventText-deep dark:text-white mb-1">No events match this filter</h3>
              <p class="text-eventText-mid dark:text-gray-300 text-xs">Check back soon, or host one yourself.</p>
            </div>
          }
        </div>
      }

      @if (toastMessage()) {
        <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg">
          {{ toastMessage() }}
        </div>
      }
    </div>
    `
})
export class CommunityEventsComponent implements OnInit {
  private eventsService = inject(CommunityEventsService);

  events = signal<CommunityEvent[]>([]);
  isLoading = signal(true);
  loadError = signal(false);

  readonly filters: EventsFilter[] = ['All', 'Near me', 'Online'];
  activeFilter = signal<EventsFilter>('All');
  visibleEvents = computed(() => {
    const filter = this.activeFilter();
    if (filter === 'All') return this.events();
    return this.events().filter(ev => (filter === 'Online') === this.isOnline(ev));
  });

  toastMessage = signal<string | null>(null);

  ngOnInit() {
    this.loadEvents();
  }

  isOnline(ev: CommunityEvent): boolean {
    return isEventOnline(ev);
  }

  cardBackground(ev: CommunityEvent): string {
    const overlay = 'linear-gradient(180deg, rgba(11,18,32,.05) 40%, rgba(11,18,32,.85) 100%)';
    return ev.image_url ? `${overlay}, url(${ev.image_url})` : `linear-gradient(135deg, #0f172a, #1e1b4b)`;
  }

  monthLabel(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    } catch {
      return '';
    }
  }

  dayLabel(dateString: string): string {
    try {
      return String(new Date(dateString).getDate()).padStart(2, '0');
    } catch {
      return '';
    }
  }

  timeLabel(dateString: string): string {
    try {
      return new Date(dateString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateString;
    }
  }

  isFree(ev: CommunityEvent): boolean {
    return !ev.cost || /^free$/i.test(ev.cost);
  }

  /** Surfaces the strongest available signal for why this meetup is worth a look. */
  personalizationReason(ev: CommunityEvent): string {
    if (ev.attendee_count >= 50) return 'Popular with travelers like you';
    if (ev.badge === 'Food') return 'Matches your interest in food';
    if (!this.isOnline(ev) && ev.location) return `Because you're exploring ${ev.location.split(',')[0].trim()}`;
    return `Hosted by ${ev.organizer.name}`;
  }

  loadEvents() {
    this.isLoading.set(true);
    this.loadError.set(false);
    this.eventsService.getEvents().subscribe({
      next: (data) => {
        this.events.set(data.meetups);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.loadError.set(true);
      }
    });
  }

  /**
   * Posting the same status the caller already has toggles it off
   * (un-RSVP); the backend upserts otherwise. Re-fetch afterwards to get
   * an authoritative attendee_count rather than guessing at the delta.
   */
  toggleRsvp(ev: CommunityEvent) {
    const wasGoing = ev.rsvp_status === 'going';
    this.eventsService.setRsvp(ev.id, 'going').subscribe(() => {
      this.eventsService.getEvent(ev.id).subscribe(fresh => {
        Object.assign(ev, fresh);
        this.showToast(
          wasGoing
            ? `Spot released · ${ev.title}`
            : `You're going · added to your ${isEventOnline(ev) ? 'calendar' : 'trip itinerary'}`
        );
      });
    });
  }

  private showToast(message: string) {
    this.toastMessage.set(message);
    setTimeout(() => this.toastMessage.set(null), 3000);
  }
}
