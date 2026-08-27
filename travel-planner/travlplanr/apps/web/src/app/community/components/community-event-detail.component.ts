import { Component, OnInit, inject, signal, computed, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CommunityEventsService, CommunityEvent, isEventOnline } from '../services/community-events.service';
import { Subscription } from 'rxjs';

interface MockTripDay {
  day: number;
  dateLabel: string;
  itemsCount: number;
}

interface MockTrip {
  id: string;
  name: string;
  dateRangeLabel: string;
  activitiesCount: number;
  days: MockTripDay[];
}

// No real trip data without a backend — a couple of representative trips so
// "Add to trip" is fully clickable, matching the feature/events design.
const MOCK_TRIPS: MockTrip[] = [
  {
    id: 'trip-1',
    name: 'Paris · Long weekend',
    dateRangeLabel: 'Jun 03 – Jun 06',
    activitiesCount: 4,
    days: [
      { day: 1, dateLabel: 'Jun 03', itemsCount: 2 },
      { day: 2, dateLabel: 'Jun 04', itemsCount: 1 },
      { day: 3, dateLabel: 'Jun 05', itemsCount: 2 },
      { day: 4, dateLabel: 'Jun 06', itemsCount: 1 },
    ],
  },
  {
    id: 'trip-2',
    name: 'Japan 2027',
    dateRangeLabel: 'Apr 04 – Apr 11',
    activitiesCount: 9,
    days: [
      { day: 1, dateLabel: 'Apr 04', itemsCount: 3 },
      { day: 2, dateLabel: 'Apr 05', itemsCount: 2 },
      { day: 3, dateLabel: 'Apr 06', itemsCount: 2 },
      { day: 4, dateLabel: 'Apr 07', itemsCount: 2 },
    ],
  },
];

// Matches the feature/events design reference's face-avatar gradients exactly.
const FACE_GRADIENTS = [
  'linear-gradient(140deg,#F2B872,#D2604B)',
  'linear-gradient(140deg,#0A6E7C,#2AA98B)',
  'linear-gradient(140deg,#6B3FA0,#0060EA)',
  'linear-gradient(140deg,#0060EA,#2AA98B)',
];

@Component({
    selector: 'app-community-event-detail',
    imports: [CommonModule, RouterLink, TranslatePipe],
    template: `
    <div class="min-h-screen bg-slate-100 dark:bg-gray-900 py-10 px-4 font-manrope flex justify-center">
      @if (isLoading()) {
        <div class="w-full max-w-[534px] h-60 bg-slate-200 dark:bg-gray-800 rounded-2xl animate-pulse flex items-center justify-center self-start">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      } @else if (loadError()) {
        <div class="w-full max-w-[534px] bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-2xl p-12 text-center shadow-sm self-start">
          <span class="text-3xl mb-3 block">⚠️</span>
          <h3 class="font-manrope font-extrabold text-base text-eventText-deep dark:text-white mb-1">Couldn't load this event</h3>
          <p class="text-eventText-mid dark:text-gray-300 text-xs mb-4">It may have been removed, or something went wrong.</p>
          <button (click)="retry()" class="px-4 py-2 text-xs bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all">
            Retry
          </button>
        </div>
      } @else {
        @if (event(); as ev) {
          <div class="w-full max-w-[534px] flex flex-col self-start">
            <!-- Back -->
            <a
              routerLink="/community/events"
              class="inline-flex items-center gap-1.5 self-start h-8 pl-2.5 pr-3.5 rounded-full border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold text-eventText-mid dark:text-gray-300 hover:border-primary hover:text-primary transition-colors mb-4"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              Events
            </a>

            <div class="rounded-2xl bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
              <!-- Banner -->
              <div
                class="relative h-[180px] p-4 flex items-start justify-between bg-cover bg-center"
                [style.background-image]="ev.image_url ? 'linear-gradient(180deg, rgba(11,18,32,.28) 0%, rgba(11,18,32,.02) 38%, rgba(11,18,32,.86) 100%), url(' + ev.image_url + ')' : 'linear-gradient(135deg, #0f172a, #1e1b4b)'"
              >
                <div class="w-12 h-12 rounded-lg bg-white shadow flex flex-col items-center justify-center leading-none shrink-0">
                  <span class="text-[9px] font-extrabold uppercase text-eventText-soft">{{ monthLabel(ev.starts_at) }}</span>
                  <span class="text-2xl font-black text-eventText-deep">{{ dayLabel(ev.starts_at) }}</span>
                </div>
                <span class="h-6 px-2.5 rounded-md bg-white/95 text-[9.5px] font-extrabold uppercase tracking-wide text-eventText-deep flex items-center shrink-0">
                  {{ ev.badge ?? 'Meetup' }}
                </span>
              </div>

              <!-- Body -->
              <div class="px-5 pt-4 flex flex-col gap-4">
                <!-- Title + meta + price -->
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <h1 class="text-xl font-black text-eventText-deep dark:text-white leading-snug">{{ ev.title }}</h1>
                    <div class="mt-2 flex flex-col gap-1">
                      <span class="flex items-center gap-1.5 text-xs font-semibold text-eventText-mid dark:text-gray-300">
                        <svg class="w-3.5 h-3.5 text-eventText-soft shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                          <path d="M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                        </svg>
                        {{ ev.location || 'Online' }}
                      </span>
                      <span class="flex items-center gap-1.5 text-xs font-semibold text-eventText-mid dark:text-gray-300">
                        <svg class="w-3.5 h-3.5 text-eventText-soft shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
                        </svg>
                        {{ timeLabel(ev.starts_at) }}{{ durationLabel(ev) ? ' · ' + durationLabel(ev) : '' }}
                      </span>
                    </div>
                  </div>
                  <div
                    class="shrink-0 text-center px-3.5 py-2 rounded-xl"
                    [class.bg-success-50]="isFree(ev)"
                    [class.bg-primary-50]="!isFree(ev)"
                  >
                    <p
                      class="text-[9px] font-extrabold uppercase tracking-wide mb-0.5"
                      [class.text-success]="isFree(ev)"
                      [class.text-primary]="!isFree(ev)"
                    >
                      Price
                    </p>
                    <p
                      class="text-sm font-extrabold"
                      [class.text-success]="isFree(ev)"
                      [class.text-primary]="!isFree(ev)"
                    >
                      {{ ev.cost || 'Free' }}
                    </p>
                  </div>
                </div>

                <!-- Host -->
                <div class="p-3 rounded-[13px] border border-slate-200 dark:border-gray-700 flex flex-col gap-0.5">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[12.5px] font-extrabold text-eventText-deep dark:text-white">{{ ev.organizer.name }}</span>
                    @if (ev.organizer.verified) {
                      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary-50 text-primary text-[9px] font-extrabold uppercase tracking-wide">
                        <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        Verified
                      </span>
                    }
                  </div>
                  <p class="text-[11px] font-semibold text-eventText-soft dark:text-gray-400">{{ hostSubtitle(ev) }}</p>
                </div>

                @if (ev.description) {
                  <p class="text-[13.5px] text-eventText-mid dark:text-gray-300 leading-relaxed">{{ ev.description }}</p>
                }

                <!-- Schedule -->
                @if (ev.schedule?.length) {
                  <div>
                    <p class="text-[11px] font-extrabold text-eventText-mid dark:text-gray-300 uppercase tracking-[0.06em] mb-2.5">The Plan</p>
                    <ul class="flex flex-col gap-2.5">
                      @for (step of ev.schedule; track step.time) {
                        <li class="flex items-start gap-2.5">
                          <span class="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></span>
                          <span class="text-[12.5px] font-semibold text-[#374151] dark:text-white leading-relaxed">{{ step.time ? step.time + ' · ' : '' }}{{ step.text }}</span>
                        </li>
                      }
                    </ul>
                  </div>
                }

                <!-- Platform & join link (online events) -->
                @if (isOnline(ev)) {
                  <div class="rounded-xl border border-slate-200 dark:border-gray-700 p-3.5 flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-0.5">Platform &amp; join link</p>
                      @if (ev.meeting_link) {
                        <p class="text-[13px] font-extrabold text-eventText-deep dark:text-white truncate">{{ ev.meeting_link }}</p>
                      } @else {
                        <p class="text-[12.5px] font-semibold text-eventText-mid dark:text-gray-300">Shared with attendees 30 minutes before it starts</p>
                      }
                    </div>
                    @if (ev.meeting_link) {
                      <a
                        [href]="ev.meeting_link"
                        target="_blank"
                        rel="noopener"
                        class="h-9 px-4 rounded-lg text-xs font-bold border border-slate-200 dark:border-gray-600 text-[#374151] dark:text-gray-200 flex items-center shrink-0"
                      >
                        Join
                      </a>
                    }
                  </div>
                } @else if (ev.location) {
                  <div class="rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                    <div class="relative h-28 bg-[#EDF2FB] dark:bg-gray-700/50">
                      <svg class="absolute inset-0 w-full h-full" viewBox="0 0 400 130" preserveAspectRatio="none">
                        <rect width="400" height="130" fill="#EDF2FB" />
                        <rect x="250" y="10" width="90" height="45" rx="6" fill="#DCEAD9" />
                        <path d="M-20 30 L180 100 L420 60" stroke="#FFFFFF" stroke-width="10" fill="none" />
                        <path d="M60 -10 L140 140" stroke="#FFFFFF" stroke-width="8" fill="none" />
                        <path d="M300 -10 L260 140" stroke="#FFFFFF" stroke-width="6" fill="none" />
                      </svg>
                      <svg class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[85%] w-7 h-7 text-primary drop-shadow" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2c-4.4 0-8 3.6-8 8 0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8Z" />
                        <circle cx="12" cy="10" r="3" fill="white" />
                      </svg>
                      <span class="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-white/90 dark:bg-gray-900/80 text-[9px] font-extrabold uppercase tracking-wide text-eventText-deep dark:text-white">
                        {{ ev.location }}
                      </span>
                    </div>
                    <div class="flex items-center justify-between gap-3 p-3">
                      <div class="min-w-0">
                        <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-0.5">Meeting point</p>
                        <p class="text-[13px] font-extrabold text-eventText-deep dark:text-white truncate">{{ ev.location }}</p>
                      </div>
                      <a
                        [href]="directionsUrl(ev)"
                        target="_blank"
                        rel="noopener"
                        class="h-9 px-4 rounded-lg text-xs font-bold border border-slate-200 dark:border-gray-600 text-[#374151] dark:text-gray-200 flex items-center shrink-0"
                      >
                        Directions
                      </a>
                    </div>
                  </div>
                }

                <!-- Capacity -->
                @if (capacityMax(ev); as max) {
                  <div>
                    <div class="flex items-center justify-between mb-1.5">
                      <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide">Capacity</p>
                      <p class="text-[11.5px] font-bold text-eventText-mid dark:text-gray-300">{{ ev.attendee_count }} of {{ max }} spots filled</p>
                    </div>
                    <div class="h-2 rounded-full bg-slate-100 dark:bg-gray-700 overflow-hidden">
                      <div
                        class="h-full rounded-full"
                        [style.width.%]="capacityPercent(ev, max)"
                        style="background: linear-gradient(90deg, #0060EA, #16A34A);"
                      ></div>
                    </div>
                  </div>
                }

                <!-- Going -->
                <div>
                  <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">Who is going</p>
                  <div class="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-gray-700">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <span class="flex shrink-0">
                        @for (gradient of faceGradients; track $index) {
                          <span class="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 -ml-2 first:ml-0" [style.background]="gradient"></span>
                        }
                      </span>
                      <span class="text-xs font-bold text-eventText-deep dark:text-white truncate">
                        {{ ev.attendee_count }} traveler{{ ev.attendee_count === 1 ? '' : 's' }} going{{ ev.rsvp_status === 'going' ? ' · including you' : '' }}
                      </span>
                    </div>
                    <button type="button" (click)="seeWho(ev)" class="shrink-0 text-xs font-bold text-primary">See all</button>
                  </div>
                </div>

                <!-- What to bring -->
                @if (ev.what_to_bring) {
                  <div>
                    <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">What to bring</p>
                    <p class="text-[13px] font-semibold text-eventText-mid dark:text-gray-300 leading-relaxed">{{ ev.what_to_bring }}</p>
                  </div>
                }

                @if (ev.conflict; as conflict) {
                  @if (!conflictDismissed()) {
                    <div class="pt-4 border-t border-slate-100 dark:border-gray-700">
                      <div class="rounded-xl border border-amber-200/80 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/50 p-3.5 flex flex-col gap-2.5">
                        <div class="flex items-start gap-2.5">
                          <span class="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-800/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                          </span>
                          <p class="text-[12.5px] font-extrabold text-eventText-deep dark:text-white leading-snug pt-1">
                            This event overlaps with your {{ conflict.dayLabel }} plan
                          </p>
                        </div>
                        <p class="text-[11.5px] font-medium text-amber-800/90 dark:text-amber-300/80 leading-relaxed pl-[38px]">{{ conflict.summary }}</p>
                        <div class="flex flex-wrap gap-2 pl-[38px]">
                          <button type="button" (click)="keepItinerary(ev)" class="h-8 px-3.5 rounded-full text-[11.5px] font-bold border border-slate-200 dark:border-gray-600 text-eventText-deep dark:text-gray-200 bg-white dark:bg-transparent hover:bg-slate-50 transition-colors">
                            Keep itinerary
                          </button>
                          <button type="button" (click)="replaceActivity(ev, conflict)" class="h-8 px-3.5 rounded-full text-[11.5px] font-bold border border-slate-200 dark:border-gray-600 text-eventText-deep dark:text-gray-200 bg-white dark:bg-transparent hover:bg-slate-50 transition-colors">
                            Replace activity
                          </button>
                          <button type="button" (click)="joinAnyway(ev)" class="h-8 px-3.5 rounded-full text-[11.5px] font-bold bg-[#8A3324] hover:bg-[#7a2c1f] text-white transition-colors">
                            Join anyway
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                }
              </div>

              <!-- Footer -->
              <div class="px-5 py-3.5 border-t border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/30 flex items-center gap-2">
                <button
                  type="button"
                  (click)="onRsvpButtonClick(ev)"
                  [attr.aria-haspopup]="ev.rsvp_status === 'going' ? 'dialog' : null"
                  class="flex-[1.6] h-[42px] px-4 rounded-full text-[13px] font-extrabold whitespace-nowrap transition-colors flex items-center justify-center gap-1.5"
                  [class.bg-success-50]="ev.rsvp_status === 'going'"
                  [class.text-success]="ev.rsvp_status === 'going'"
                  [class.border]="ev.rsvp_status === 'going'"
                  [class.border-green-200]="ev.rsvp_status === 'going'"
                  [class.bg-primary]="ev.rsvp_status !== 'going'"
                  [class.hover:bg-primary-hover]="ev.rsvp_status !== 'going'"
                  [class.text-white]="ev.rsvp_status !== 'going'"
                  [style.box-shadow]="ev.rsvp_status !== 'going' ? '0 10px 20px -6px rgba(0,96,234,0.4)' : 'none'"
                >
                  @if (ev.rsvp_status === 'going') {
                    <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  }
                  {{ ev.rsvp_status === 'going' ? 'Going' : 'Join Event' }}
                </button>
                <button
                  type="button"
                  (click)="openAddToCalendar(ev)"
                  class="flex-1 h-[42px] px-3 rounded-full text-[11.5px] font-extrabold border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-[#374151] dark:text-gray-200 flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  Add to Calendar
                </button>
                <button
                  type="button"
                  (click)="openAddToTrip()"
                  class="flex-1 h-[42px] px-3 rounded-full text-[11.5px] font-extrabold border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-[#374151] dark:text-gray-200 flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Add to Trip
                </button>
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
                  class="w-full max-w-[560px] rounded-[24px] bg-white dark:bg-gray-800 shadow-2xl overflow-hidden"
                  (click)="$event.stopPropagation()"
                >
                  <!-- Header -->
                  <div class="flex items-start justify-between gap-3 px-[22px] py-[18px] border-b border-[#EEF1F6] dark:border-gray-700">
                    <div>
                      <h2 class="font-manrope text-base font-extrabold text-eventText-deep dark:text-white">Add to trip</h2>
                      <p class="text-xs text-eventText-mid dark:text-gray-300 mt-0.5">Bring this place straight into your itinerary.</p>
                    </div>
                    <button
                      type="button"
                      (click)="closeAddToTrip()"
                      class="w-8 h-8 rounded-[9px] border border-[#E8ECF2] dark:border-gray-700 flex items-center justify-center text-eventText-mid hover:text-eventText-deep shrink-0 focus:outline-none"
                      aria-label="Close"
                    >
                      &times;
                    </button>
                  </div>

                  <!-- Body -->
                  <div class="px-[22px] py-[18px] flex flex-col gap-4">
                    <!-- Event preview -->
                    <div class="flex items-center gap-3 rounded-[13px] bg-[#FAFBFD] dark:bg-gray-700/50 border border-[#E8ECF2] dark:border-gray-700 p-3">
                      <div
                        class="w-12 h-12 rounded-lg bg-cover bg-center bg-slate-200 dark:bg-gray-600 shrink-0"
                        [style.background-image]="ev.image_url ? 'url(' + ev.image_url + ')' : null"
                      ></div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-extrabold text-eventText-deep dark:text-white truncate">{{ ev.title }}</p>
                        <p class="text-[11px] font-semibold text-eventText-soft mt-0.5 truncate">{{ ev.badge ?? 'Meetup' }} · {{ metaLine(ev) }}</p>
                      </div>
                    </div>

                    <!-- Which trip -->
                    <div>
                      <p class="text-[11px] font-extrabold text-eventText-mid dark:text-gray-300 uppercase tracking-[0.06em] mb-2.5">Which trip</p>
                      <div class="space-y-2 max-h-48 overflow-y-auto">
                        @for (trip of mockTrips; track trip.id) {
                          <button
                            type="button"
                            (click)="selectTrip(trip.id)"
                            class="w-full text-left rounded-xl border p-[13px] flex items-center justify-between gap-3 transition-colors"
                            [class.border-primary]="selectedTripId() === trip.id"
                            [class.bg-primary-50]="selectedTripId() === trip.id"
                            [class.border-slate-200]="selectedTripId() !== trip.id"
                            [class.dark:border-gray-700]="selectedTripId() !== trip.id"
                          >
                            <span>
                              <span class="block text-sm font-extrabold text-eventText-deep dark:text-white">{{ trip.name }}</span>
                              <span class="block text-[11px] text-eventText-soft mt-0.5">{{ trip.dateRangeLabel }} · {{ trip.activitiesCount }} activities</span>
                            </span>
                            @if (selectedTripId() === trip.id) {
                              <span class="text-primary font-extrabold text-xs shrink-0">✓</span>
                            }
                          </button>
                        }
                      </div>
                    </div>

                    @if (selectedTripDays().length > 0) {
                      <!-- Which day -->
                      <div>
                        <p class="text-[11px] font-extrabold text-eventText-mid dark:text-gray-300 uppercase tracking-[0.06em] mb-2.5">Which day</p>
                        <div class="flex gap-2">
                          @for (day of selectedTripDays(); track day.day) {
                            <button
                              type="button"
                              (click)="selectedDay.set(day.day)"
                              class="rounded-[14px] border w-[84px] h-[72px] text-center transition-colors"
                              [class.bg-primary]="selectedDay() === day.day"
                              [class.border-primary]="selectedDay() === day.day"
                              [class.border-slate-200]="selectedDay() !== day.day"
                              [class.dark:border-gray-700]="selectedDay() !== day.day"
                              [class.bg-white]="selectedDay() !== day.day"
                              [class.dark:bg-gray-800]="selectedDay() !== day.day"
                            >
                              <span
                                class="block text-[9.5px] font-extrabold uppercase tracking-[0.06em] opacity-70"
                                [class.text-white]="selectedDay() === day.day"
                                [class.text-eventText-soft]="selectedDay() !== day.day"
                                >DAY {{ day.day }}</span
                              >
                              <span
                                class="block text-[13px] font-extrabold mt-1 leading-none"
                                [class.text-white]="selectedDay() === day.day"
                                [class.text-eventText-deep]="selectedDay() !== day.day"
                                >{{ day.dateLabel }}</span
                              >
                              <span
                                class="block text-[9.5px] font-bold mt-1 opacity-65"
                                [class.text-white]="selectedDay() === day.day"
                                [class.text-eventText-soft]="selectedDay() !== day.day"
                                >{{ day.itemsCount }} item{{ day.itemsCount === 1 ? '' : 's' }}</span
                              >
                            </button>
                          }
                        </div>
                      </div>
                    }

                    @if (selectedTrip() && selectedDayInfo()) {
                      <!-- Summary -->
                      <div class="border border-[#E4EDFB] dark:border-gray-700 bg-[#F7FAFF] dark:bg-gray-700/50 rounded-xl px-3.5 py-2 flex items-center gap-2">
                        <svg class="w-3.5 h-3.5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span class="text-xs font-bold text-eventText-deep dark:text-white">Adds to {{ selectedTrip()!.name }} · Day {{ selectedDay() }}, {{ selectedDayInfo()!.dateLabel }}</span>
                      </div>
                    }
                  </div>

                  <!-- Footer -->
                  <div class="px-[22px] py-3.5 border-t border-[#EEF1F6] dark:border-gray-700 bg-[#FAFBFD] dark:bg-gray-700/30 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      (click)="closeAddToTrip()"
                      class="h-[38px] px-4 rounded-xl border border-[#E2E7EF] dark:border-gray-600 text-xs font-bold text-eventText-mid dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      [disabled]="!selectedTripId() || !selectedDay()"
                      (click)="confirmAddToTrip()"
                      class="h-[38px] px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50"
                    >
                      Add to your itinerary
                    </button>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- Add to Calendar Modal -->
          @if (showAddToCalendar()) {
            <div
              class="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
              (click)="closeAddToCalendar()"
            >
              <div class="min-h-full flex items-center justify-center p-4">
                <div
                  class="w-full max-w-[560px] rounded-[24px] bg-white dark:bg-gray-800 shadow-2xl overflow-hidden"
                  (click)="$event.stopPropagation()"
                >
                  <!-- Header -->
                  <div class="flex items-start justify-between gap-3 px-[22px] py-[18px] border-b border-[#EEF1F6] dark:border-gray-700">
                    <div>
                      <h2 class="font-manrope text-base font-extrabold text-eventText-deep dark:text-white">Add to your calendar</h2>
                      <p class="text-xs text-eventText-mid dark:text-gray-300 mt-0.5">{{ ev.title }} · {{ ev.location || 'Online' }}</p>
                    </div>
                    <button
                      type="button"
                      (click)="closeAddToCalendar()"
                      class="w-8 h-8 rounded-[9px] border border-[#E8ECF2] dark:border-gray-700 flex items-center justify-center text-eventText-mid hover:text-eventText-deep shrink-0 focus:outline-none"
                      aria-label="Close"
                    >
                      &times;
                    </button>
                  </div>

                  <!-- Body -->
                  <div class="px-[22px] py-[18px] flex flex-col gap-4">
                    <div class="flex items-center justify-between">
                      <p class="text-sm font-extrabold text-eventText-deep dark:text-white">{{ calendarMonthLabel() }}</p>
                      <div class="flex items-center gap-3 text-[11px] font-semibold text-eventText-mid dark:text-gray-300">
                        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-primary"></span>Event</span>
                        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-success"></span>Your trip</span>
                      </div>
                    </div>

                    <div class="grid grid-cols-7 gap-1">
                      @for (label of weekdayLabels; track $index) {
                        <span class="text-[10px] font-extrabold text-eventText-soft uppercase text-center py-1">{{ label }}</span>
                      }
                      @for (cell of calendarCells(); track $index) {
                        @if (cell) {
                          <div
                            class="relative rounded-lg py-2 text-[12.5px] font-bold flex flex-col items-center gap-0.5"
                            [class.bg-primary]="cell.isEvent"
                            [class.text-white]="cell.isEvent"
                            [class.bg-success-50]="cell.isTrip && !cell.isEvent"
                            [class.text-eventText-deep]="!cell.isEvent"
                            [class.dark:text-white]="!cell.isEvent"
                          >
                            {{ cell.day }}
                            @if (cell.isTrip || cell.isEvent) {
                              <span class="w-1 h-1 rounded-full" [class.bg-white]="cell.isEvent" [class.bg-success]="cell.isTrip && !cell.isEvent"></span>
                            }
                          </div>
                        } @else {
                          <div></div>
                        }
                      }
                    </div>

                    <!-- Event preview -->
                    <div class="flex items-center gap-3 rounded-[13px] bg-[#FAFBFD] dark:bg-gray-700/50 border border-[#E8ECF2] dark:border-gray-700 p-3">
                      <div class="w-11 h-11 rounded-lg bg-primary text-white flex flex-col items-center justify-center leading-none shrink-0">
                        <span class="text-[8px] font-extrabold uppercase">{{ monthLabel(ev.starts_at) }}</span>
                        <span class="text-base font-black">{{ dayLabel(ev.starts_at) }}</span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-extrabold text-eventText-deep dark:text-white truncate">{{ ev.title }}</p>
                        <p class="text-[11px] font-semibold text-eventText-soft mt-0.5">{{ timeLabel(ev.starts_at) }} · {{ ev.cost || 'Free' }}</p>
                      </div>
                    </div>

                    @if (ev.conflict; as conflict) {
                      <div class="rounded-xl border border-amber-200/80 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/50 p-3 flex items-start gap-2">
                        <span class="text-amber-500 shrink-0">⚠</span>
                        <p class="text-[11.5px] font-semibold text-amber-800/90 dark:text-amber-300/80 leading-relaxed">{{ calendarConflictNote(conflict) }}</p>
                      </div>
                    }
                  </div>

                  <!-- Footer -->
                  <div class="px-[22px] py-3.5 border-t border-[#EEF1F6] dark:border-gray-700 bg-[#FAFBFD] dark:bg-gray-700/30 flex items-center justify-between gap-2.5">
                    <p class="text-[11px] font-medium text-eventText-soft">Syncs to the calendar on your device</p>
                    <div class="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        (click)="closeAddToCalendar()"
                        class="h-[38px] px-4 rounded-xl border border-[#E2E7EF] dark:border-gray-600 text-xs font-bold text-eventText-mid dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        (click)="confirmAddToCalendar(ev)"
                        class="h-[38px] px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors"
                      >
                        Add to calendar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- Leave Event confirmation -->
          @if (showLeaveConfirm()) {
            <div
              class="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              (click)="cancelLeaveEvent()"
            >
              <div
                class="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 animate-fade-in-up"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="leave-event-title"
                aria-describedby="leave-event-desc"
                (click)="$event.stopPropagation()"
              >
                <div class="w-11 h-11 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 flex items-center justify-center mb-4">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <h2 id="leave-event-title" class="text-base font-extrabold text-eventText-deep dark:text-white mb-1.5">
                  Leave {{ ev.title }}?
                </h2>
                <p id="leave-event-desc" class="text-sm text-eventText-mid dark:text-gray-300 leading-relaxed mb-6">
                  Are you sure you want to leave {{ ev.title }}? You will no longer be marked as going to this event.
                </p>
                <div class="flex items-center justify-end gap-2.5">
                  <button
                    #cancelLeaveBtn
                    type="button"
                    (click)="cancelLeaveEvent()"
                    class="h-10 px-4 rounded-xl text-sm font-bold border border-slate-200 dark:border-gray-600 text-eventText-mid dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    (click)="confirmLeaveEvent(ev)"
                    class="h-10 px-4 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-colors"
                  >
                    Leave Event
                  </button>
                </div>
              </div>
            </div>
          }
        }
      }

      @if (toastMessage()) {
        <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg">
          {{ toastMessage() }}
        </div>
      }
    </div>
    `
})
export class CommunityEventDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private eventsService = inject(CommunityEventsService);

  event = signal<CommunityEvent | null>(null);
  isLoading = signal(true);
  loadError = signal(false);
  private currentId: string | null = null;

  readonly mockTrips = MOCK_TRIPS;
  readonly faceGradients = FACE_GRADIENTS;
  showAddToTrip = signal(false);
  selectedTripId = signal<string | null>(null);
  selectedDay = signal<number | null>(null);
  selectedTrip = computed(() => this.mockTrips.find(t => t.id === this.selectedTripId()));
  selectedTripDays = computed(() => this.selectedTrip()?.days ?? []);
  selectedDayInfo = computed(() => this.selectedTripDays().find(d => d.day === this.selectedDay()));

  conflictDismissed = signal(false);
  toastMessage = signal<string | null>(null);

  readonly weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  showAddToCalendar = signal(false);
  calendarMonthLabel = signal('');
  calendarCells = signal<({ day: number; isEvent: boolean; isTrip: boolean } | null)[]>([]);

  showLeaveConfirm = signal(false);
  @ViewChild('cancelLeaveBtn') private cancelLeaveBtnRef?: ElementRef<HTMLButtonElement>;

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
    this.conflictDismissed.set(false);
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

  isFree(ev: CommunityEvent): boolean {
    return !ev.cost || /^free$/i.test(ev.cost);
  }

  isOnline(ev: CommunityEvent): boolean {
    return isEventOnline(ev);
  }

  /** Posting the same status you already have toggles it off (un-RSVP). */
  toggleRsvp(ev: CommunityEvent) {
    const wasGoing = ev.rsvp_status === 'going';
    this.eventsService.setRsvp(ev.id, 'going').subscribe(() => {
      this.eventsService.getEvent(ev.id).subscribe(fresh => {
        this.event.set(fresh);
        this.showToast(
          wasGoing
            ? `Left ${ev.title}`
            : `You're going · added to your ${isEventOnline(ev) ? 'calendar' : 'trip itinerary'}`
        );
      });
    });
  }

  /** Leaving an event is destructive enough to confirm first; joining is not. */
  onRsvpButtonClick(ev: CommunityEvent): void {
    if (ev.rsvp_status === 'going') {
      this.showLeaveConfirm.set(true);
      setTimeout(() => this.cancelLeaveBtnRef?.nativeElement.focus());
    } else {
      this.toggleRsvp(ev);
    }
  }

  cancelLeaveEvent(): void {
    this.showLeaveConfirm.set(false);
  }

  confirmLeaveEvent(ev: CommunityEvent): void {
    this.showLeaveConfirm.set(false);
    this.toggleRsvp(ev);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showLeaveConfirm()) this.cancelLeaveEvent();
  }

  metaLine(ev: CommunityEvent): string {
    return `${ev.location || 'Online'} · ${this.timeLabel(ev.starts_at)} · ${ev.cost ?? 'Free'}`;
  }

  hostSubtitle(ev: CommunityEvent): string {
    const firstName = ev.organizer.name.split(' ')[0];
    const parts = [`Hosted by ${firstName}`, ev.organizer.role, ev.organizer.hostStat].filter(Boolean);
    return parts.join(' · ');
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

  durationLabel(ev: CommunityEvent): string {
    if (!ev.ends_at) return '';
    const ms = new Date(ev.ends_at).getTime() - new Date(ev.starts_at).getTime();
    if (!(ms > 0)) return '';
    const totalMinutes = Math.round(ms / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return [hours ? `${hours}h` : '', minutes ? `${minutes}m` : ''].filter(Boolean).join(' ');
  }

  capacityMax(ev: CommunityEvent): number | null {
    if (ev.capacity && ev.capacity > 0) return ev.capacity;
    const parsed = parseInt(ev.group_max ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  capacityPercent(ev: CommunityEvent, max: number): number {
    return Math.min(100, Math.round((ev.attendee_count / max) * 100));
  }

  directionsUrl(ev: CommunityEvent): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location || '')}`;
  }

  seeWho(ev: CommunityEvent): void {
    this.showToast(`Attendee list · ${ev.attendee_count} traveler${ev.attendee_count === 1 ? '' : 's'} going`);
  }

  openAddToCalendar(ev: CommunityEvent): void {
    this.calendarMonthLabel.set(new Date(ev.starts_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    this.calendarCells.set(this.buildCalendarCells(ev));
    this.showAddToCalendar.set(true);
  }

  closeAddToCalendar(): void {
    this.showAddToCalendar.set(false);
  }

  calendarConflictNote(conflict: NonNullable<CommunityEvent['conflict']>): string {
    if (conflict.conflictingActivity && conflict.conflictingTime) {
      return `You already have ${conflict.conflictingActivity} at ${conflict.conflictingTime} that day. Adding this will show both.`;
    }
    return conflict.summary;
  }

  private buildCalendarCells(ev: CommunityEvent): ({ day: number; isEvent: boolean; isTrip: boolean } | null)[] {
    const eventDate = new Date(ev.starts_at);
    const year = eventDate.getFullYear();
    const month = eventDate.getMonth();
    const eventDay = new Date(year, month, eventDate.getDate()).getTime();
    const firstOfMonth = new Date(year, month, 1);
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // week starts Monday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: ({ day: number; isEvent: boolean; isTrip: boolean } | null)[] = Array(leadingBlanks).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const diffDays = Math.round((new Date(year, month, day).getTime() - eventDay) / 86_400_000);
      cells.push({
        day,
        isEvent: diffDays === 0,
        isTrip: diffDays >= -4 && diffDays <= 1 && diffDays !== 0,
      });
    }
    return cells;
  }

  confirmAddToCalendar(ev: CommunityEvent): void {
    this.closeAddToCalendar();
    this.showToast(`Added ${ev.title} to your calendar`);
  }

  keepItinerary(ev: CommunityEvent): void {
    this.conflictDismissed.set(true);
    this.showToast('Kept your original itinerary');
  }

  replaceActivity(ev: CommunityEvent, conflict: { summary: string }): void {
    this.conflictDismissed.set(true);
    this.showToast(`Replaced the conflicting activity with ${ev.title}`);
  }

  joinAnyway(ev: CommunityEvent): void {
    this.conflictDismissed.set(true);
    if (ev.rsvp_status !== 'going') this.toggleRsvp(ev);
  }

  openAddToTrip(): void {
    this.selectTrip('trip-2');
    this.showAddToTrip.set(true);
  }

  closeAddToTrip(): void {
    this.showAddToTrip.set(false);
  }

  selectTrip(tripId: string): void {
    this.selectedTripId.set(tripId);
    const days = this.mockTrips.find(t => t.id === tripId)?.days ?? [];
    this.selectedDay.set(days[0]?.day ?? null);
  }

  confirmAddToTrip(): void {
    const trip = this.selectedTrip();
    const day = this.selectedDay();
    const dayInfo = this.selectedDayInfo();
    if (!trip || day == null || !dayInfo) return;

    this.closeAddToTrip();
    this.showToast(`Added to ${trip.name} · Day ${day}, ${dayInfo.dateLabel}`);
    setTimeout(() => this.router.navigate(['/community/events']), 1200);
  }

  private showToast(message: string) {
    this.toastMessage.set(message);
    setTimeout(() => this.toastMessage.set(null), 3000);
  }
}
