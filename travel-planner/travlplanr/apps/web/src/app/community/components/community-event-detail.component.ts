import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CommunityEventsService, CommunityEvent } from '../services/community-events.service';
import { TripService, DetailActivity } from '../../trip/trip.service';
import { ToastService } from '../../shared/utils/toast.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-community-event-detail',
    imports: [CommonModule, RouterLink, TranslatePipe],
    template: `
    <div class="max-w-4xl mx-auto py-8 px-4 sm:px-6 font-manrope">
      <!-- Breadcrumb -->
      <nav class="flex mb-4 text-[12.5px] font-bold text-eventText-soft gap-2">
        <a routerLink="/community" class="hover:text-primary transition-colors">Community</a>
        <a routerLink="/community/events" class="hover:text-primary transition-colors">Events</a>
        <span class="text-slate-300 dark:text-gray-600">/</span>
        <span class="font-extrabold text-eventText-deep">Details</span>
      </nav>
    
      @if (isLoading()) {
        <div class="h-60 bg-slate-100 dark:bg-gray-800 rounded-2xl animate-pulse flex items-center justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      } @else if (loadError()) {
        <div class="bg-white/80 border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
          <span class="text-3xl mb-3 block">⚠️</span>
          <h3 class="font-manrope font-extrabold text-base text-eventText-deep mb-1">Couldn't load this event</h3>
          <p class="text-eventText-mid text-xs mb-4">It may have been removed, or something went wrong.</p>
          <button (click)="retry()" class="px-4 py-2 text-xs bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all">
            Retry
          </button>
        </div>
      } @else {
        @if (event(); as ev) {
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            <!-- Event Core details column -->
            <div class="col-span-1 lg:col-span-8 space-y-6">
              <!-- Event Hero Card -->
              <div
                class="relative rounded-2xl overflow-hidden bg-gradient-to-tr from-slate-900 to-indigo-950 bg-cover bg-center p-6 sm:p-8 text-white min-h-[220px] flex flex-col justify-between select-none"
                [style.background-image]="ev.image_url ? 'linear-gradient(180deg, rgba(11,18,32,.28) 0%, rgba(11,18,32,.15) 38%, rgba(11,18,32,.9) 100%), url(' + ev.image_url + ')' : null"
                >
                <div class="relative z-10">
                  <div class="w-14 h-14 rounded-lg bg-white shadow flex flex-col items-center justify-center leading-none shrink-0">
                    <span class="text-[10px] font-extrabold uppercase" style="color: #2563eb!important;">{{ monthLabel(ev.starts_at) }}</span>
                    <span class="text-lg font-black text-eventText-deep">{{ dayLabel(ev.starts_at) }}</span>
                  </div>
                </div>

                <div class="relative z-10">
                  <h1 class="font-manrope text-2xl sm:text-3xl font-black mt-2 leading-tight">
                    {{ ev.title }}
                  </h1>
                  <p class="text-xs text-white/80 mt-2 flex items-center gap-1.5 flex-wrap">
                    <span>📅 {{ formatDate(ev.starts_at) }}</span>
                    @if (ev.location) {
                      <span>•</span>
                      <span>📍 {{ ev.location }}</span>
                    }
                  </p>
                </div>

                <div class="relative z-10 border-t border-white/10 pt-4 mt-6 flex justify-between items-center gap-3">
                  <div class="text-xs font-bold text-white/70">
                    👥 {{ ev.attendee_count }} traveler{{ ev.attendee_count === 1 ? '' : 's' }} going{{ ev.rsvp_status === 'going' ? ' · including you' : '' }}
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <button
                      (click)="openAddToTrip()"
                      class="px-4 py-2.5 rounded-xl text-xs font-extrabold border border-white/30 text-white hover:bg-white/10 transition-all hover:scale-105 active:scale-95"
                      >
                      Add to trip
                    </button>
                    <button
                      (click)="toggleRsvp(ev)"
                      class="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all hover:scale-105 active:scale-95 shadow-md"
                      [class.border]="ev.rsvp_status === 'going'"
                      [class.text-white]="ev.rsvp_status === 'going'"
                      [class.bg-white]="ev.rsvp_status !== 'going'"
                      [class.text-indigo-950]="ev.rsvp_status !== 'going'"
                    [ngClass]="{
                      'bg-white/10': ev.rsvp_status === 'going',
                      'border-white/20': ev.rsvp_status === 'going',
                      'hover:bg-white/90': ev.rsvp_status !== 'going'
                    }"
                      >
                      {{ ev.rsvp_status === 'going' ? 'Leave Event' : 'Join Event' }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Description -->
              @if (ev.description) {
                <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-6 shadow-sm">
                  <h3 class="font-manrope font-extrabold text-sm text-eventText-deep dark:text-white mb-3">About this Event</h3>
                  <p class="text-xs text-eventText-mid dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {{ ev.description }}
                  </p>
                </div>
              }

              <!-- Location -->
              @if (ev.location) {
                <div class="bg-[#F7FAFF] dark:bg-gray-700/50 border border-[#E4EDFB] dark:border-gray-700 rounded-2xl p-4 shadow-sm flex items-center gap-2">
                  <svg class="w-3.5 h-3.5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <path d="M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                  </svg>
                  <span class="text-[12.5px] font-extrabold text-eventText-deep dark:text-white">{{ ev.location }}</span>
                </div>
              }
            </div>

            <!-- Sidebar details Column -->
            <div class="col-span-1 lg:col-span-4 space-y-4">
              <!-- Organizer Card -->
              <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-4 shadow-sm">
                <h3 class="font-manrope text-2xs font-extrabold text-eventText-soft uppercase tracking-wider mb-3">Organizer</h3>
                <div class="flex items-center gap-3">
                  <img [src]="ev.organizer.avatar || '/assets/images/default-avatar.svg'" class="w-11 h-11 rounded-full object-cover border bg-slate-50 shrink-0" />
                  <div>
                    <h4 class="font-extrabold text-xs text-eventText-deep dark:text-white">{{ ev.organizer.name }}</h4>
                    <p class="text-[9px] font-bold text-eventText-soft dark:text-gray-400 mt-0.5">Community Host</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Add to Trip Modal -->
          @if (showAddToTrip()) {
            <div
              class="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
              (click)="closeAddToTrip()"
            >
              <div class="min-h-full flex items-center justify-center p-4">
                <div
                  class="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6"
                  (click)="$event.stopPropagation()"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <h2 class="font-manrope text-base font-extrabold text-eventText-deep dark:text-white">Add to trip</h2>
                      <p class="text-xs text-eventText-mid dark:text-gray-300 mt-0.5">Bring this event into your itinerary.</p>
                    </div>
                    <button
                      type="button"
                      (click)="closeAddToTrip()"
                      class="w-7 h-7 rounded-full border border-slate-200 dark:border-gray-700 flex items-center justify-center text-eventText-mid hover:text-eventText-deep shrink-0 focus:outline-none"
                      aria-label="Close"
                    >
                      &times;
                    </button>
                  </div>

                  @if (myTrips().length === 0) {
                    <div class="border-t border-slate-100 dark:border-gray-700 mt-4 pt-4 text-center">
                      <p class="text-xs text-eventText-mid dark:text-gray-300 mb-3">You don't have any trips yet.</p>
                      <a routerLink="/trips" (click)="closeAddToTrip()" class="inline-block bg-primary hover:bg-primary-hover text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors">
                        Create a trip
                      </a>
                    </div>
                  } @else {
                    <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mt-5 mb-2">Which trip</p>
                    <div class="space-y-2 max-h-48 overflow-y-auto">
                      @for (trip of myTrips(); track trip.id) {
                        <button
                          type="button"
                          (click)="selectTrip(trip.id)"
                          class="w-full text-left rounded-xl border p-3 flex items-center justify-between gap-3 transition-colors"
                          [class.border-primary]="selectedTripId() === trip.id"
                          [class.bg-primary-50]="selectedTripId() === trip.id"
                          [class.border-slate-200]="selectedTripId() !== trip.id"
                          [class.dark:border-gray-700]="selectedTripId() !== trip.id"
                        >
                          <span>
                            <span class="block text-xs font-extrabold text-eventText-deep dark:text-white">{{ trip.title }}</span>
                            <span class="block text-[11px] text-eventText-soft mt-0.5">{{ trip.destination }}</span>
                          </span>
                          @if (selectedTripId() === trip.id) {
                            <span class="text-primary font-extrabold shrink-0">✓</span>
                          }
                        </button>
                      }
                    </div>

                    @if (selectedTripDays().length > 0) {
                      <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mt-5 mb-2">Which day</p>
                      <div class="grid grid-cols-4 gap-2">
                        @for (day of selectedTripDays(); track day.day) {
                          <button
                            type="button"
                            (click)="selectedDay.set(day.day)"
                            class="rounded-xl border p-2 text-center transition-colors"
                            [class.bg-primary]="selectedDay() === day.day"
                            [class.border-primary]="selectedDay() === day.day"
                            [class.border-slate-200]="selectedDay() !== day.day"
                            [class.dark:border-gray-700]="selectedDay() !== day.day"
                          >
                            <span
                              class="block text-[9.5px] font-extrabold uppercase tracking-wide opacity-70"
                              [class.text-white]="selectedDay() === day.day"
                              [class.text-eventText-soft]="selectedDay() !== day.day"
                              >Day {{ day.day }}</span
                            >
                          </button>
                        }
                      </div>
                    }

                    <div class="flex items-center justify-end gap-2 mt-5">
                      <button
                        type="button"
                        (click)="closeAddToTrip()"
                        class="h-9 px-4 rounded-lg text-xs font-bold text-eventText-mid dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        [disabled]="!selectedTripId() || !selectedDay() || isSavingToTrip()"
                        (click)="confirmAddToTrip(ev)"
                        class="h-9 px-4 rounded-lg text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50"
                      >
                        {{ isSavingToTrip() ? 'Adding…' : 'Add to itinerary' }}
                      </button>
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        }
      }
    </div>
    `
})
export class CommunityEventDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private eventsService = inject(CommunityEventsService);
  private tripService = inject(TripService);
  private toast = inject(ToastService);

  event = signal<CommunityEvent | null>(null);
  isLoading = signal(true);
  loadError = signal(false);
  private currentId: string | null = null;

  myTrips = this.tripService.trips;
  showAddToTrip = signal(false);
  selectedTripId = signal<string | null>(null);
  selectedDay = signal<number | null>(null);
  isSavingToTrip = signal(false);
  selectedTripDays = computed(() => this.myTrips().find(t => t.id === this.selectedTripId())?.days ?? []);

  private sub?: Subscription;

  ngOnInit() {
    this.sub = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.loadEvent(id);
      }
    });
  }

  loadEvent(id: string) {
    this.currentId = id;
    this.isLoading.set(true);
    this.loadError.set(false);
    this.eventsService.getEvent(id).subscribe({
      next: (ev) => {
        this.event.set(ev);
        this.isLoading.set(false);
      },
      error: () => {
        this.event.set(null);
        this.isLoading.set(false);
        this.loadError.set(true);
      }
    });
  }

  retry() {
    if (this.currentId) this.loadEvent(this.currentId);
  }

  /**
   * Posting the same status the caller already has toggles it off
   * (un-RSVP); the backend upserts otherwise.
   */
  toggleRsvp(ev: CommunityEvent) {
    this.eventsService.setRsvp(ev.id, 'going').subscribe(() => {
      this.eventsService.getEvent(ev.id).subscribe(fresh => this.event.set(fresh));
    });
  }

  formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
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
      return String(new Date(dateString).getDate());
    } catch {
      return '';
    }
  }

  openAddToTrip(): void {
    this.selectedTripId.set(null);
    this.selectedDay.set(null);
    this.showAddToTrip.set(true);
  }

  closeAddToTrip(): void {
    this.showAddToTrip.set(false);
  }

  selectTrip(tripId: string): void {
    this.selectedTripId.set(tripId);
    const days = this.myTrips().find(t => t.id === tripId)?.days ?? [];
    this.selectedDay.set(days[0]?.day ?? null);
  }

  confirmAddToTrip(ev: CommunityEvent): void {
    const tripId = this.selectedTripId();
    const day = this.selectedDay();
    const trip = this.myTrips().find(t => t.id === tripId);
    if (!trip || day == null) return;

    const activity: DetailActivity = {
      day,
      type: 'activity',
      time: this.formatDate(ev.starts_at),
      title: ev.title,
      rating: 0,
      location: ev.location || '',
      refundable: 'Free cancellation',
      image: ev.image_url || '',
      contentOnly: true,
    };

    this.isSavingToTrip.set(true);
    this.tripService
      .saveTrip({ ...trip, segments: [...(trip.segments ?? []), activity] })
      .then(() => {
        this.isSavingToTrip.set(false);
        this.closeAddToTrip();
        this.toast.success(`Added "${ev.title}" to ${trip.title} · Day ${day}`);
      })
      .catch(() => {
        this.isSavingToTrip.set(false);
        this.toast.error('Failed to add this event to your trip.');
      });
  }
}
