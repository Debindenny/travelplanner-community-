import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommunityEventsMockStore } from '../services/community-events-mock.store';
import { CommunityEventCard, JourneyActivity, JourneyDay, TransportSegment } from '../services/community-event-view.model';
import { EventItineraryService } from '../services/event-itinerary.service';
import { AuthService } from '../../auth/auth.service';
import { ItineraryTimelineComponent } from '../../itinerary/components/itinerary-timeline/itinerary-timeline.component';
import type { DetailDay, DetailItem } from '../../itinerary/itinerary-page.component';
import type { DetailActivity } from '../../trip/trip.service';

type JoinMode = 'full' | 'partial';

@Component({
  selector: 'app-community-event-view',
  imports: [CommonModule, RouterLink, FormsModule, ItineraryTimelineComponent],
  styles: [
    `
    .trip-slider {
      -webkit-appearance: none;
      appearance: none;
      height: 6px;
      border-radius: 9999px;
      outline: none;
      cursor: pointer;
    }
    .trip-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #ffffff;
      border: 5px solid #0060ea;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
      cursor: pointer;
    }
    .trip-slider::-moz-range-thumb {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #ffffff;
      border: 5px solid #0060ea;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
      cursor: pointer;
    }
    .trip-slider::-moz-range-track {
      height: 6px;
      border-radius: 9999px;
      background: transparent;
    }
    `,
  ],
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
      @if (!showChangeActivityView) {
        <!-- Breadcrumb -->
        <nav class="w-full bg-slate-50 dark:bg-gray-900 border-b border-slate-100 dark:border-gray-800 flex items-center gap-2 text-xs font-semibold text-eventText-soft dark:text-gray-400 flex-wrap">
          <div class="page-container w-full px-5 xl:px-20 py-3 flex items-center gap-2 flex-wrap">
            <a routerLink="/community" class="hover:text-primary transition-colors">Community</a>
            <span class="text-slate-300 dark:text-gray-600">/</span>
            <a routerLink="/community/events" class="hover:text-primary transition-colors">Hosted Journeys</a>
            <span class="text-slate-300 dark:text-gray-600">/</span>
            <a [routerLink]="['/community/events', event.id, 'summary']" class="hover:text-primary transition-colors">Summary</a>
            <span class="text-slate-300 dark:text-gray-600">/</span>
            <span class="font-extrabold text-eventText-deep dark:text-white">{{ event.title }}</span>
          </div>
        </nav>

        <!-- Hero -->
        <div class="page-container mx-auto px-5 xl:px-20 pt-6">
        <div
          class="relative w-full h-[280px] sm:h-[340px] rounded-2xl overflow-hidden bg-cover bg-center flex flex-col justify-end p-6 sm:p-10"
          [style.background-image]="
            'linear-gradient(0deg, rgba(11,18,32,.88) 0%, rgba(11,18,32,.2) 45%, rgba(11,18,32,.35) 100%), url(' + event.imageUrl + ')'
          "
        >
          <div class="flex items-center gap-2 mb-4">
            <span class="px-3 py-1.5 rounded-lg bg-white text-[11px] font-extrabold text-primary shrink-0">Hosted Trip</span>
            <span *ngIf="event.partialJoinAllowed" class="px-3 py-1.5 rounded-lg bg-white text-[11px] font-extrabold text-orange-500 shrink-0">
              Partial Join Allowed
            </span>
          </div>

          <h1 class="text-white text-3xl sm:text-5xl font-black leading-tight mb-3">{{ event.title }}</h1>

          <div class="flex items-center gap-2 text-white/90 text-xs sm:text-sm font-bold mb-4 flex-wrap">
            <span class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              {{ dateRangeFor(event) }}<ng-container *ngIf="event.nights"> ({{ event.nights }} Nights)</ng-container>
            </span>
            <span class="text-white/50">&bull;</span>
            <span class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><path d="M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
              </svg>
              {{ citiesLabel(event) }}
            </span>
          </div>

          <div class="flex items-center gap-3 mb-3">
            <img
              *ngIf="event.hostAvatarUrl; else heroInitials"
              [src]="event.hostAvatarUrl"
              class="w-9 h-9 rounded-full object-cover border-2 border-white/50 shrink-0"
              alt=""
            />
            <ng-template #heroInitials>
              <span class="w-9 h-9 rounded-full bg-white/15 border border-white/40 text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
                {{ hostInitials(event) }}
              </span>
            </ng-template>
            <div class="leading-tight">
              <p class="text-[10.5px] font-semibold text-white/70">Hosted by</p>
              <p class="text-xs font-extrabold text-white">{{ event.hostName }}{{ event.hostRole ? ' (' + event.hostRole + ')' : '' }}</p>
            </div>
          </div>

          <div class="flex items-center gap-2.5">
            <div class="flex -space-x-2" *ngIf="event.travelerAvatars?.length">
              <img
                *ngFor="let avatar of event.travelerAvatars"
                [src]="avatar"
                class="w-7 h-7 rounded-full object-cover border-2 border-white"
                alt=""
              />
            </div>
            <span class="text-xs font-extrabold text-white">
              {{ event.travelersGoing }}{{ event.travelersMax ? ' / ' + event.travelersMax : '' }} Travelers Joined
            </span>
          </div>
        </div>
        </div>

        <!-- Below hero -->
        <!-- Extra bottom padding (pb-28) keeps the last itinerary/summary buttons clear of the floating chat dock (~75px fixed at the viewport bottom on every page — see floating-chatbot.component.ts's .global-dock-wrap), which otherwise sits on top of and swallows clicks on whatever content scrolls to rest behind it. -->
        <div class="page-container mx-auto px-5 xl:px-20 pt-6 pb-28">
          <!-- Title row -->
          <div class="flex items-start justify-between flex-wrap gap-4 pb-6 mb-6 border-b border-slate-100 dark:border-gray-700">
            <div>
              <h2 class="font-manrope text-xl font-extrabold text-eventText-deep dark:text-white">
                {{ event.subtitle || event.title }}
              </h2>
              <div class="flex items-center gap-1.5 mt-1.5" *ngIf="event.rating">
                <span class="flex items-center gap-0.5">
                  <span *ngFor="let i of stars" class="text-sm" [class.text-amber-400]="i < roundedRating(event)" [class.text-slate-300]="i >= roundedRating(event)">★</span>
                </span>
                <span class="text-xs font-extrabold text-eventText-deep dark:text-white">{{ event.rating.toFixed(1) }}</span>
                <span class="text-xs font-semibold text-eventText-soft" *ngIf="event.reviewCount">({{ event.reviewCount }} reviews)</span>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                (click)="toggleFollow()"
                class="w-9 h-9 rounded-full border border-slate-200 dark:border-gray-700 flex items-center justify-center text-eventText-mid dark:text-gray-300 hover:border-primary hover:text-primary transition-colors"
                aria-label="Save"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" [attr.fill]="event.followed ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
                </svg>
              </button>
              <button
                type="button"
                class="w-9 h-9 rounded-full border border-slate-200 dark:border-gray-700 flex items-center justify-center text-eventText-mid dark:text-gray-300 hover:border-primary hover:text-primary transition-colors"
                aria-label="Share"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <path d="M8.6 10.5 15.4 6.5M8.6 13.5l6.8 4" />
                </svg>
              </button>
              <button
                type="button"
                (click)="toggleJoin()"
                class="h-9 px-5 rounded-lg text-xs font-extrabold transition-colors"
                [class.bg-primary]="!event.joined"
                [class.hover:bg-primary-hover]="!event.joined"
                [class.text-white]="!event.joined"
                [class.bg-primary-50]="event.joined"
                [class.text-primary]="event.joined"
              >
                {{ event.joined ? "You're going" : 'Join a Circle' }}
              </button>
            </div>
          </div>

          @if (event.days?.length) {
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <!-- Itinerary Timeline -->
              <div class="lg:col-span-2 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5">
                <h3 class="font-manrope text-base font-extrabold text-eventText-deep dark:text-white mb-4">Itinerary Timeline</h3>

                <app-itinerary-timeline
                  [displayedDays]="detailDays()"
                  [highlightedDays]="highlightedDaySet()"
                  [getItemKey]="activityItemKey"
                  [transportModeOptions]="transportModeOptions"
                  [bookedItemKeys]="bookedActivityKeys()"
                  (dayHeaderClick)="onDayHeaderClick($event)"
                  (book)="onBookActivity($event)"
                  (activitySwap)="onActivitySwap($event)"
                  (transportAdd)="addTransport($event.day, $event.type)"
                ></app-itinerary-timeline>

                @if (transport.length) {
                  <div class="mt-4 pt-4 border-t border-slate-100 dark:border-gray-700">
                    <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-2">Your added transport</p>
                    <div class="flex flex-col gap-2">
                      <div *ngFor="let t of transport" class="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-gray-700/40">
                        <svg class="w-4 h-4 text-eventText-soft shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 6V4h10v2M7 18v2M17 18v2" />
                        </svg>
                        <div class="min-w-0 flex-1">
                          <p class="text-xs font-extrabold text-eventText-deep dark:text-white truncate">After Day {{ t.afterDay }} · {{ t.title }}</p>
                          <p class="text-[11px] font-semibold text-eventText-soft">{{ t.mode }}<span *ngIf="t.time"> · {{ t.time }}</span><span *ngIf="t.price"> · ₹{{ t.price | number }}</span></p>
                        </div>
                        <button type="button" (click)="removeTransportSegment(t)" class="text-[11px] font-bold text-red-500 hover:underline shrink-0">Remove</button>
                      </div>
                    </div>
                  </div>
                }
              </div>

              <!-- Trip Summary -->
              <div class="lg:sticky lg:top-6 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5">
                <div class="flex items-start justify-between gap-2">
                  <h3 class="font-manrope text-xl font-black text-eventText-deep dark:text-white">Your Trip Summary</h3>
                  <button
                    *ngIf="joinMode === 'partial'"
                    type="button"
                    (click)="openEditDaysModal()"
                    class="shrink-0 flex items-center gap-1 text-primary text-xs font-bold hover:underline"
                  >
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                    Edit days
                  </button>
                </div>
                <p class="text-[11.5px] font-semibold text-eventText-soft mt-0.5 mb-4">Choose dates and build your custom package</p>

                <div class="grid grid-cols-2 gap-2 mb-4">
                  <button
                    type="button"
                    (click)="setMode('full')"
                    class="h-9 rounded-lg text-xs font-bold transition-colors"
                    [class.bg-primary]="joinMode === 'full'"
                    [class.text-white]="joinMode === 'full'"
                    [class.bg-slate-100]="joinMode !== 'full'"
                    [class.dark:bg-gray-700]="joinMode !== 'full'"
                    [class.text-eventText-mid]="joinMode !== 'full'"
                    [class.dark:text-gray-300]="joinMode !== 'full'"
                  >
                    Full Journey
                  </button>
                  <button
                    type="button"
                    (click)="setMode('partial')"
                    [disabled]="!event.partialJoinAllowed"
                    class="h-9 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    [class.bg-primary]="joinMode === 'partial'"
                    [class.text-white]="joinMode === 'partial'"
                    [class.bg-slate-100]="joinMode !== 'partial'"
                    [class.dark:bg-gray-700]="joinMode !== 'partial'"
                    [class.text-eventText-mid]="joinMode !== 'partial'"
                    [class.dark:text-gray-300]="joinMode !== 'partial'"
                  >
                    Partial
                    <span
                      *ngIf="joinMode === 'partial' && rangeLength() > 0"
                      class="w-4 h-4 rounded-full bg-white text-primary text-[10px] font-extrabold flex items-center justify-center shrink-0"
                    >
                      {{ rangeLength() }}
                    </span>
                  </button>
                </div>

                @if (joinMode === 'full') {
                  <div class="flex flex-col divide-y divide-slate-100 dark:divide-gray-700 border-t border-b border-slate-100 dark:border-gray-700 mb-3">
                    <div *ngFor="let d of event.days" class="flex items-center gap-2.5 py-2 text-xs">
                      <span class="w-4 h-4 rounded bg-primary flex items-center justify-center shrink-0">
                        <svg class="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      <span class="font-bold text-eventText-deep dark:text-white flex-1 min-w-0 truncate">
                        Day {{ d.day }} - {{ d.city }} <span class="font-semibold text-eventText-soft">({{ d.dateLabel }})</span>
                      </span>
                      <span class="font-extrabold text-eventText-deep dark:text-white shrink-0">₹{{ d.price | number }}</span>
                    </div>
                  </div>

                  <div class="flex flex-col divide-y divide-slate-100 dark:divide-gray-700 border-b border-slate-100 dark:border-gray-700 mb-3">
                    <div class="flex items-center justify-between py-2 text-xs">
                      <span class="font-semibold text-eventText-mid dark:text-gray-300">Selected Days</span>
                      <span class="font-extrabold text-eventText-deep dark:text-white">{{ totalDays() }} of {{ totalDays() }} days</span>
                    </div>
                    <div class="flex items-center justify-between py-2 text-xs">
                      <span class="font-semibold text-eventText-mid dark:text-gray-300">Subtotal</span>
                      <span class="font-extrabold text-eventText-deep dark:text-white">₹{{ subtotalFull() | number }}</span>
                    </div>
                  </div>

                  <div class="flex items-center justify-between mb-1">
                    <span class="text-sm font-extrabold text-eventText-deep dark:text-white">Total</span>
                    <span class="text-lg font-extrabold text-primary">₹{{ totalFull() | number }}<span class="text-xs font-bold">/pp</span></span>
                  </div>
                  <p class="text-[11px] font-semibold text-eventText-soft mb-4">Minimum stay: {{ minConsecutiveDays() }} days</p>

                  <button
                    type="button"
                    (click)="joinFullJourney()"
                    class="w-full h-11 rounded-xl text-sm font-extrabold transition-colors"
                    [class.bg-primary]="!event.joined"
                    [class.hover:bg-primary-hover]="!event.joined"
                    [class.text-white]="!event.joined"
                    [class.bg-primary-50]="event.joined"
                    [class.text-primary]="event.joined"
                  >
                    {{ event.joined ? "You're going" : 'Continue' }}
                  </button>
                } @else {
                  <!-- Day rows -->
                  <div class="flex flex-col gap-1.5 mb-3">
                    <button
                      *ngFor="let d of event.days"
                      type="button"
                      (click)="selectDay(d.day)"
                      class="flex items-center justify-between gap-2 rounded-lg pr-3 pl-2.5 py-2 text-left border-l-4 transition-colors"
                      [class.bg-primary-50]="isDayInRange(d.day)"
                      [class.dark:bg-primary/10]="isDayInRange(d.day)"
                      [class.border-l-primary]="isDayInRange(d.day)"
                      [class.border-l-transparent]="!isDayInRange(d.day)"
                    >
                      <span class="flex items-center gap-2.5 min-w-0">
                        <span
                          class="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                          [class.bg-primary]="isDayInRange(d.day)"
                          [class.border-primary]="isDayInRange(d.day)"
                          [class.border-slate-300]="!isDayInRange(d.day)"
                          [class.dark:border-gray-600]="!isDayInRange(d.day)"
                        >
                          <svg *ngIf="isDayInRange(d.day)" class="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        <span class="min-w-0">
                          <span
                            class="block text-xs font-extrabold"
                            [class.text-eventText-deep]="isDayInRange(d.day)"
                            [class.dark:text-white]="isDayInRange(d.day)"
                            [class.text-slate-400]="!isDayInRange(d.day)"
                          >
                            Day {{ d.day }}
                          </span>
                          <span
                            class="block text-[11px] font-semibold"
                            [class.text-eventText-soft]="isDayInRange(d.day)"
                            [class.text-slate-300]="!isDayInRange(d.day)"
                          >
                            {{ d.dateLabel }}
                          </span>
                        </span>
                      </span>
                      <span
                        class="px-2.5 py-1 rounded-full text-[11px] font-extrabold shrink-0"
                        [class.bg-white]="isDayInRange(d.day)"
                        [class.dark:bg-gray-800]="isDayInRange(d.day)"
                        [class.text-primary]="isDayInRange(d.day)"
                        [class.bg-slate-100]="!isDayInRange(d.day)"
                        [class.dark:bg-gray-700]="!isDayInRange(d.day)"
                        [class.text-slate-400]="!isDayInRange(d.day)"
                      >
                        {{ d.city }}
                      </span>
                    </button>
                  </div>

                  <div class="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-gray-700/40 p-2.5 mb-3">
                    <svg class="w-4 h-4 text-eventText-soft shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <p class="text-[11px] font-semibold text-eventText-soft leading-relaxed">
                      This trip requires {{ minConsecutiveDays() }}-{{ maxConsecutiveDays() }} consecutive days. The host has set this to ensure a complete experience.
                    </p>
                  </div>

                  <div *ngIf="rangeLength() > 0" class="flex flex-col divide-y divide-slate-100 dark:divide-gray-700 border-t border-slate-100 dark:border-gray-700 mb-3">
                    <div *ngFor="let d of selectedDaysList()" class="flex items-center justify-between py-2 text-xs">
                      <span class="font-semibold text-eventText-mid dark:text-gray-300 truncate">
                        Day {{ d.day }} - {{ d.city }} <span class="text-eventText-soft">({{ d.activities.length }} activities)</span>
                      </span>
                      <span class="font-extrabold text-eventText-deep dark:text-white shrink-0">₹{{ d.price | number }}</span>
                    </div>
                  </div>

                  <div class="flex items-center justify-between py-2 text-xs border-b border-slate-100 dark:border-gray-700 mb-3">
                    <span class="font-semibold text-eventText-mid dark:text-gray-300">Subtotal</span>
                    <span class="font-extrabold text-eventText-deep dark:text-white">₹{{ subtotalPartial() | number }}</span>
                  </div>

                  <div *ngIf="savings() > 0" class="rounded-lg bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 text-[11px] font-bold text-center py-2 px-3 mb-3">
                    🎉 You save ₹{{ savings() | number }} vs Full Journey
                  </div>

                  <div class="flex items-center justify-between mb-3">
                    <span class="text-sm font-extrabold text-eventText-deep dark:text-white">Total</span>
                    <span class="text-lg font-extrabold text-primary">₹{{ totalPartial() | number }}<span class="text-xs font-bold">/pp</span></span>
                  </div>

                  <button
                    type="button"
                    [disabled]="!canContinuePartial()"
                    (click)="continuePartial()"
                    class="w-full h-11 rounded-xl text-sm font-extrabold text-white bg-primary hover:bg-primary-hover transition-colors disabled:bg-slate-300 disabled:dark:bg-gray-600 disabled:text-white/80 disabled:cursor-not-allowed disabled:hover:bg-slate-300"
                  >
                    {{ event.joined ? "You're going" : 'Continue' }}
                  </button>
                  <p *ngIf="!canContinuePartial()" class="text-[11px] font-bold text-red-500 text-center mt-2">
                    {{ validationMessage() }}
                  </p>
                }
              </div>
            </div>
          } @else {
            <!-- Fallback for events without a day-by-day itinerary -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div class="lg:col-span-2 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5 flex flex-col gap-4">
                <div>
                  <p class="text-[9.5px] font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">About this event</p>
                  <p class="text-[13.5px] text-eventText-mid dark:text-gray-300 leading-relaxed">{{ event.description }}</p>
                </div>
                <div *ngIf="event.schedule.length">
                  <p class="text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">What happens</p>
                  <ul class="divide-y divide-slate-100 dark:divide-gray-700 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                    <li *ngFor="let step of event.schedule" class="px-4 py-3">
                      <p class="text-xs font-extrabold text-eventText-deep dark:text-white">{{ step.text }}</p>
                    </li>
                  </ul>
                </div>
              </div>

              <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5 flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-eventText-mid dark:text-gray-300">Price</span>
                  <span class="text-xs font-extrabold text-eventText-deep dark:text-white">{{ event.price }}</span>
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
          }
        </div>
      } @else {
        <!-- Change Activity full-page picker (replaces the event view, same pattern as the main itinerary's swap-activity screen) -->
        <div class="bg-surface-muted dark:bg-gray-900 min-h-screen">
          <div class="bg-white dark:bg-gray-800 border-b border-slate-100 dark:border-gray-700">
            <div class="page-container mx-auto px-5 xl:px-20 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex flex-wrap items-center gap-2 min-w-0">
                <span class="text-xs font-semibold text-eventText-soft shrink-0">Plan Update:</span>
                <span class="text-sm font-extrabold text-eventText-deep dark:text-white truncate">{{ changeTargetActivity?.title }}</span>
              </div>
              <button
                type="button"
                (click)="closeChangeActivityView()"
                class="flex shrink-0 items-center gap-2 text-sm font-bold text-eventText-deep dark:text-white hover:text-primary transition-colors"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                <span>Back to Plan</span>
              </button>
            </div>
          </div>

          <div class="page-container mx-auto px-5 xl:px-20 py-6 pb-28">
            <h2 class="font-manrope text-lg font-extrabold text-eventText-deep dark:text-white mb-1">Change Activity</h2>
            <p class="text-xs font-semibold text-eventText-soft mb-6">Replace the selected activity with another activity from the same event.</p>

            @if (changeModalLoading) {
              <div class="flex flex-col items-center justify-center py-16 gap-3">
                <div class="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></div>
                <p class="text-xs font-semibold text-eventText-soft">Finding alternative activities…</p>
              </div>
            } @else if (changeModalError) {
              <div class="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <p class="text-xs font-bold text-red-500">{{ changeModalError }}</p>
                <button type="button" (click)="changeActivity(changeTargetActivity!)" class="text-xs font-bold text-primary hover:underline">Try again</button>
              </div>
            } @else if (!changeCandidates.length) {
              <div class="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <p class="text-xs font-semibold text-eventText-soft">No other activities available on this day yet.</p>
              </div>
            } @else {
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  *ngFor="let c of changeCandidates"
                  type="button"
                  (click)="selectChangeCandidate(c)"
                  class="text-left rounded-2xl border-2 bg-white dark:bg-gray-800 overflow-hidden transition-colors"
                  [class.border-primary]="selectedCandidateId === c.id"
                  [class.bg-primary-50]="selectedCandidateId === c.id"
                  [class.border-slate-100]="selectedCandidateId !== c.id"
                  [class.dark:border-gray-700]="selectedCandidateId !== c.id"
                  [class.hover:border-primary/50]="selectedCandidateId !== c.id"
                >
                  <div class="relative w-full h-32">
                    <img [src]="c.image" alt="" class="w-full h-full object-cover" />
                    <span
                      class="absolute top-2 right-2 w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center bg-white/90"
                      [class.border-primary]="selectedCandidateId === c.id"
                      [class.bg-primary]="selectedCandidateId === c.id"
                      [class.border-slate-300]="selectedCandidateId !== c.id"
                    >
                      <svg *ngIf="selectedCandidateId === c.id" class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  </div>
                  <div class="p-3.5">
                    <p class="text-sm font-extrabold text-eventText-deep dark:text-white truncate">{{ c.title }}</p>
                    <p class="text-[11.5px] font-semibold text-eventText-soft mt-1">
                      {{ c.time }}<span *ngIf="c.category"> • {{ c.category }}</span><span *ngIf="c.duration"> • {{ c.duration }}</span>
                    </p>
                    <p class="text-sm font-extrabold text-eventText-deep dark:text-white mt-2">{{ c.price !== null ? ('₹' + (c.price | number)) : 'Free' }}</p>
                  </div>
                </button>
              </div>

              <p *ngIf="changeModalReplaceError" class="text-[11px] font-bold text-red-500 text-center mt-5">{{ changeModalReplaceError }}</p>

              <div class="flex items-center justify-end gap-3 mt-8 pt-5 border-t border-slate-100 dark:border-gray-700">
                <button
                  type="button"
                  (click)="closeChangeActivityView()"
                  class="h-11 px-5 rounded-xl text-sm font-extrabold text-eventText-deep dark:text-white border border-slate-200 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  [disabled]="!selectedCandidateId || isReplacingActivity"
                  (click)="confirmReplaceActivity()"
                  class="h-11 px-6 rounded-xl text-sm font-extrabold text-white bg-primary hover:bg-primary-hover transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {{ isReplacingActivity ? 'Replacing…' : 'Replace Activity' }}
                </button>
              </div>
            }
          </div>
        </div>
      }
      </div>

      <!-- Edit days modal -->
      @if (showEditDaysModal) {
        <div
          class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          (click)="closeEditDaysModal()"
        >
          <div class="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6" (click)="$event.stopPropagation()">
            <p class="text-center text-5xl font-black text-primary leading-none">{{ tempCount }}</p>
            <p class="text-center text-sm font-semibold text-eventText-soft mt-1.5 mb-6">days selected</p>

            <div class="flex items-center gap-3 mb-6">
              <span class="text-xs font-bold text-eventText-soft shrink-0">1</span>
              <input
                type="range"
                class="trip-slider flex-1"
                min="1"
                [max]="totalDays()"
                [value]="tempCount"
                [style.background]="sliderTrackBackground()"
                (input)="onSliderInput($event)"
              />
              <span class="text-xs font-bold text-eventText-soft shrink-0">{{ totalDays() }}</span>
            </div>

            <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-2">Selected Days</p>
            <div class="flex flex-col gap-2 mb-5 max-h-40 overflow-y-auto">
              <div *ngFor="let d of tempSelectedDays()" class="flex items-center gap-2 rounded-lg bg-primary-50 dark:bg-primary/10 px-3 py-2.5">
                <svg class="w-4 h-4 text-green-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span class="text-xs font-extrabold text-eventText-deep dark:text-white">Day {{ d.day }} — {{ d.city }}</span>
              </div>
            </div>

            <p *ngIf="tempCount < minConsecutiveDays() || tempCount > maxConsecutiveDays()" class="text-[11px] font-bold text-red-500 text-center mb-3">
              Pick between {{ minConsecutiveDays() }} and {{ maxConsecutiveDays() }} consecutive days
            </p>

            <button
              type="button"
              [disabled]="tempCount < minConsecutiveDays() || tempCount > maxConsecutiveDays()"
              (click)="applyEditDays()"
              class="w-full h-12 rounded-xl text-sm font-extrabold text-white bg-primary hover:bg-primary-hover transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed mb-3"
            >
              Apply Selection
            </button>
            <button type="button" (click)="closeEditDaysModal()" class="w-full text-center text-sm font-bold text-primary hover:underline">
              Cancel
            </button>
          </div>
        </div>
      }

      <!-- Add transport modal -->
      @if (showTransportModal) {
        <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" (click)="closeTransportModal()">
          <div class="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6" (click)="$event.stopPropagation()">
            <h3 class="font-manrope text-base font-extrabold text-eventText-deep dark:text-white mb-4">Add transport after Day {{ transportAfterDay }}</h3>

            <label class="block text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-1">Mode</label>
            <select [(ngModel)]="transportForm.mode" class="w-full h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold px-3 mb-3">
              <option value="train">Train</option>
              <option value="flight">Flight</option>
              <option value="car">Car</option>
              <option value="bus">Bus</option>
              <option value="ferry">Ferry</option>
            </select>

            <label class="block text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-1">Title</label>
            <input
              [(ngModel)]="transportForm.title"
              type="text"
              placeholder="e.g. Paris → Barcelona express"
              class="w-full h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold px-3 mb-3"
            />

            <div class="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label class="block text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-1">Time</label>
                <input [(ngModel)]="transportForm.time" type="text" placeholder="08:00" class="w-full h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold px-3" />
              </div>
              <div>
                <label class="block text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-1">Price (₹)</label>
                <input [(ngModel)]="transportForm.price" type="number" min="0" placeholder="0" class="w-full h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold px-3" />
              </div>
            </div>

            <label class="block text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-1">Notes</label>
            <textarea
              [(ngModel)]="transportForm.notes"
              rows="2"
              placeholder="Optional notes"
              class="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold px-3 py-2 mb-4"
            ></textarea>

            <button
              type="button"
              [disabled]="!transportForm.title.trim()"
              (click)="submitTransport()"
              class="w-full h-11 rounded-xl text-sm font-extrabold text-white bg-primary hover:bg-primary-hover transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed mb-3"
            >
              Add transport
            </button>
            <button type="button" (click)="closeTransportModal()" class="w-full text-center text-sm font-bold text-primary hover:underline">
              Cancel
            </button>
          </div>
        </div>
      }
    }

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
  private readonly router = inject(Router);
  private readonly store = inject(CommunityEventsMockStore);
  private readonly auth = inject(AuthService);
  private readonly itineraryService = inject(EventItineraryService);

  event: CommunityEventCard | null = null;

  readonly stars = [0, 1, 2, 3, 4];

  joinMode: JoinMode = 'full';
  /** Inclusive day-number range currently picked in Partial mode — always contiguous, no gaps. */
  rangeStart: number | null = null;
  rangeEnd: number | null = null;

  /** "Edit days" modal — a draft range, only committed to rangeStart/rangeEnd on Apply. */
  showEditDaysModal = false;
  tempStart = 1;
  tempCount = 1;

  /** This traveler's personal transport additions, keyed by the day they follow. */
  transport: TransportSegment[] = [];
  /** activity.id currently mid-request (book) — disables the button so a slow tap can't double-fire. */
  activityActionInFlight: string | null = null;

  /** "Change activity" full-page picker (replaces the event view, same pattern as the main itinerary's swap-activity screen). */
  showChangeActivityView = false;
  changeTargetActivity: JourneyActivity | null = null;
  changeCandidates: JourneyActivity[] = [];
  selectedCandidateId: string | null = null;
  changeModalLoading = false;
  changeModalError: string | null = null;
  changeModalReplaceError: string | null = null;
  isReplacingActivity = false;

  /** "Add transport" form modal. */
  showTransportModal = false;
  transportAfterDay: number | null = null;
  transportForm: { mode: string; title: string; time: string; notes: string; price: number | null } = {
    mode: 'train', title: '', time: '', notes: '', price: null
  };

  /** Quick-add buttons rendered in the shared itinerary timeline's "Add to Day" panel. */
  readonly transportModeOptions: { id: 'flight' | 'train' | 'bus' | 'car'; labelKey: string }[] = [
    { id: 'train', labelKey: 'Add Train' },
    { id: 'flight', labelKey: 'Add Flight' },
    { id: 'bus', labelKey: 'Add Bus' },
    { id: 'car', labelKey: 'Add Car' }
  ];

  toastMessage: string | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.event = id ? this.store.getById(id) : null;
    this.loadItinerary();
  }

  /** Replaces the mock day/activity list with the DB-backed one (with ids + this traveler's selection/booking/transport state). */
  private async loadItinerary(): Promise<void> {
    const ev = this.event;
    if (!ev) return;
    try {
      const res = await this.itineraryService.getItinerary(ev.id);
      if (res.days.length) {
        ev.days = res.days;
      }
      this.transport = res.transport;
    } catch (err) {
      console.error('Failed to load event itinerary', err);
    }
  }

  dateRangeFor(ev: CommunityEventCard): string {
    return ev.dateRangeLabel || `${ev.month} ${ev.day}`;
  }

  citiesLabel(ev: CommunityEventCard): string {
    return ev.cities?.length ? ev.cities.join(' · ') : ev.location;
  }

  hostInitials(ev: CommunityEventCard): string {
    return ev.hostName
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  roundedRating(ev: CommunityEventCard): number {
    return Math.round(ev.rating ?? 0);
  }

  setMode(mode: JoinMode): void {
    if (mode === 'partial' && !this.event?.partialJoinAllowed) return;
    this.joinMode = mode;
  }

  openEditDaysModal(): void {
    const total = this.totalDays();
    this.tempCount = this.rangeLength() > 0 ? this.rangeLength() : Math.min(this.minConsecutiveDays(), total);
    this.tempStart = this.rangeStart ?? 1;
    const maxStart = Math.max(1, total - this.tempCount + 1);
    if (this.tempStart > maxStart) this.tempStart = maxStart;
    this.showEditDaysModal = true;
  }

  closeEditDaysModal(): void {
    this.showEditDaysModal = false;
  }

  onSliderInput(event: Event): void {
    this.tempCount = Number((event.target as HTMLInputElement).value);
    const maxStart = Math.max(1, this.totalDays() - this.tempCount + 1);
    if (this.tempStart > maxStart) this.tempStart = maxStart;
  }

  tempSelectedDays(): JourneyDay[] {
    const start = this.tempStart;
    const end = this.tempStart + this.tempCount - 1;
    return (this.event?.days ?? []).filter((d) => d.day >= start && d.day <= end);
  }

  sliderTrackBackground(): string {
    const total = this.totalDays();
    const percent = total > 1 ? ((this.tempCount - 1) / (total - 1)) * 100 : 100;
    return `linear-gradient(to right, #0060EA 0%, #0060EA ${percent}%, #E2E8F0 ${percent}%, #E2E8F0 100%)`;
  }

  applyEditDays(): void {
    if (this.tempCount < this.minConsecutiveDays() || this.tempCount > this.maxConsecutiveDays()) return;
    this.rangeStart = this.tempStart;
    this.rangeEnd = this.tempStart + this.tempCount - 1;
    this.showEditDaysModal = false;
  }

  totalDays(): number {
    return this.event?.days?.length ?? 0;
  }

  minConsecutiveDays(): number {
    return this.event?.minConsecutiveDays ?? 2;
  }

  maxConsecutiveDays(): number {
    return this.event?.maxConsecutiveDays ?? this.totalDays();
  }

  rangeLength(): number {
    if (this.rangeStart == null || this.rangeEnd == null) return 0;
    return this.rangeEnd - this.rangeStart + 1;
  }

  isDayInRange(day: number): boolean {
    return this.rangeStart != null && this.rangeEnd != null && day >= this.rangeStart && day <= this.rangeEnd;
  }

  /** Maps this journey's day/activity data onto the shared itinerary-timeline component's shape (see itinerary-page.component.ts DetailDay/DetailActivity). */
  detailDays(): DetailDay[] {
    return (this.event?.days ?? []).map((d) => ({
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
        duration: a.duration || undefined
      }))
    }));
  }

  /** Stable per-item tracking for the shared timeline's `@for` loop. */
  readonly activityItemKey = (item: DetailItem): string => {
    const activity = item as DetailActivity;
    return activity.id || activity.title;
  };

  /** `null` in Full mode (nothing dimmed — everything's included); the picked day-number range in Partial mode. */
  highlightedDaySet(): Set<number> | null {
    if (this.joinMode === 'full') return null;
    const set = new Set<number>();
    if (this.rangeStart != null && this.rangeEnd != null) {
      for (let day = this.rangeStart; day <= this.rangeEnd; day++) set.add(day);
    }
    return set;
  }

  onDayHeaderClick(day: number): void {
    if (this.joinMode === 'partial') this.selectDay(day);
  }

  /** Maps the shared timeline's generic "Book" click back onto the underlying JourneyActivity by id. */
  onBookActivity(item: DetailItem): void {
    const activity = this.findActivityById((item as DetailActivity).id);
    if (activity) {
      this.bookActivity(activity);
    } else {
      console.error('Book Activity: no matching JourneyActivity for item', item);
      this.showToast("Couldn't book this activity — please refresh and try again.");
    }
  }

  /** Maps the shared timeline's "Change" click (day + index within that day) back onto the underlying JourneyActivity. */
  onActivitySwap(event: { day: number; index: number }): void {
    const day = (this.event?.days ?? []).find((d) => d.day === event.day);
    const activity = day?.activities[event.index];
    if (activity) {
      this.changeActivity(activity);
    } else {
      console.error('Change activity: could not resolve activity for', event);
      this.showToast("Couldn't open the change picker — please refresh and try again.");
    }
  }

  /** Which activities this traveler currently has an active booking on — drives the shared timeline's persistent "Booked" button state. */
  bookedActivityKeys(): Set<string> {
    return new Set(
      (this.event?.days ?? [])
        .flatMap((d) => d.activities)
        .filter((a) => a.booked && a.id)
        .map((a) => a.id!)
    );
  }

  private findActivityById(id: string | undefined): JourneyActivity | undefined {
    if (!id) return undefined;
    return (this.event?.days ?? []).flatMap((d) => d.activities).find((a) => a.id === id);
  }

  /** Opens the "Change Activity" picker, pre-loaded with other activities from this event ranked by how closely they match the one being replaced. */
  changeActivity(activity: JourneyActivity): void {
    const ev = this.event;
    if (!activity.id || !ev) return;
    const day = (ev.days ?? []).find((d) => d.activities.includes(activity));
    if (!day) return;

    this.changeTargetActivity = activity;
    this.selectedCandidateId = null;
    this.changeModalError = null;
    this.changeModalReplaceError = null;
    this.changeModalLoading = true;
    this.showChangeActivityView = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      this.changeCandidates = this.findChangeCandidates(activity, day);
    } catch {
      this.changeCandidates = [];
      this.changeModalError = 'Could not load alternative activities — please try again.';
    } finally {
      this.changeModalLoading = false;
    }
  }

  /** Other activities on the same day (same event, same location, same day) — the backend's
   * /change endpoint rejects a swap across two activities with different day_id, so the pool
   * must stay within `day`. Ranked by matching category/type and time slot. */
  private findChangeCandidates(activity: JourneyActivity, day: JourneyDay): JourneyActivity[] {
    return day.activities
      .filter((a) => a.id && a.id !== activity.id)
      .sort((a, b) => {
        const score = (a: JourneyActivity) => (a.category === activity.category ? 2 : 0) + (a.time === activity.time ? 1 : 0);
        return score(b) - score(a);
      });
  }

  closeChangeActivityView(): void {
    this.showChangeActivityView = false;
    this.changeTargetActivity = null;
    this.changeCandidates = [];
    this.selectedCandidateId = null;
    this.changeModalLoading = false;
    this.changeModalError = null;
    this.changeModalReplaceError = null;
    this.isReplacingActivity = false;
  }

  /** Highlights a candidate; the swap itself only happens once "Replace Activity" is confirmed. */
  selectChangeCandidate(candidate: JourneyActivity): void {
    if (!candidate.id) return;
    this.selectedCandidateId = candidate.id;
    this.changeModalReplaceError = null;
  }

  async confirmReplaceActivity(): Promise<void> {
    const ev = this.event;
    const old = this.changeTargetActivity;
    const candidate = this.changeCandidates.find((c) => c.id === this.selectedCandidateId);
    if (!ev || !old?.id || !candidate?.id || this.isReplacingActivity) return;

    this.isReplacingActivity = true;
    this.changeModalReplaceError = null;
    try {
      await this.itineraryService.changeActivity(ev.id, old.id, candidate.id);
      old.included = false;
      candidate.included = true;
      this.showToast(`Replaced "${old.title}" with "${candidate.title}"`);
      this.closeChangeActivityView();
    } catch (err) {
      this.changeModalReplaceError = 'Could not replace this activity — please try again.';
    } finally {
      this.isReplacingActivity = false;
    }
  }

  /** Toggle-booking idiom: tapping "Book Activity" again cancels the reservation. */
  async bookActivity(activity: JourneyActivity): Promise<void> {
    const ev = this.event;
    if (!ev || !activity.id || this.activityActionInFlight) return;
    this.activityActionInFlight = activity.id;
    try {
      const res = await this.itineraryService.bookActivity(ev.id, activity.id);
      activity.booked = res.booked;
      activity.bookedCount = res.bookedCount;
      activity.capacity = res.capacity;
      this.showToast(res.booked ? `Booked "${activity.title}"` : `Cancelled your booking for "${activity.title}"`);
    } catch (err: any) {
      this.showToast(err?.error?.detail || 'Could not book this activity — please try again.');
    } finally {
      this.activityActionInFlight = null;
    }
  }

  addTransport(afterDay: number, mode = 'train'): void {
    this.transportAfterDay = afterDay;
    this.transportForm = { mode, title: '', time: '', notes: '', price: null };
    this.showTransportModal = true;
  }

  closeTransportModal(): void {
    this.showTransportModal = false;
    this.transportAfterDay = null;
  }

  async submitTransport(): Promise<void> {
    const ev = this.event;
    if (!ev || this.transportAfterDay == null || !this.transportForm.title.trim()) return;
    try {
      const segment = await this.itineraryService.addTransport(ev.id, {
        afterDay: this.transportAfterDay,
        mode: this.transportForm.mode,
        title: this.transportForm.title.trim(),
        time: this.transportForm.time || undefined,
        notes: this.transportForm.notes || undefined,
        price: this.transportForm.price ?? undefined
      });
      this.transport = [...this.transport, segment];
      this.closeTransportModal();
    } catch (err) {
      this.showToast('Could not add transport — please try again.');
    }
  }

  async removeTransportSegment(segment: TransportSegment): Promise<void> {
    const ev = this.event;
    if (!ev) return;
    try {
      await this.itineraryService.removeTransport(ev.id, segment.id);
      this.transport = this.transport.filter((t) => t.id !== segment.id);
    } catch (err) {
      this.showToast('Could not remove that transport segment — please try again.');
    }
  }

  /** Range picking: first tap starts a single-day selection, a second tap spans to it (clamped to the max), tapping a completed range starts over. */
  selectDay(day: number): void {
    const max = this.maxConsecutiveDays();
    if (this.rangeStart == null || this.rangeEnd == null) {
      this.rangeStart = day;
      this.rangeEnd = day;
      return;
    }
    if (this.rangeStart === this.rangeEnd) {
      if (day === this.rangeStart) {
        this.rangeStart = null;
        this.rangeEnd = null;
        return;
      }
      let start = Math.min(this.rangeStart, day);
      let end = Math.max(this.rangeStart, day);
      if (end - start + 1 > max) end = start + max - 1;
      this.rangeStart = start;
      this.rangeEnd = end;
      return;
    }
    this.rangeStart = day;
    this.rangeEnd = day;
  }

  subtotalFull(): number {
    return (this.event?.days ?? []).reduce((sum, d) => sum + d.price, 0);
  }

  selectedDaysList(): JourneyDay[] {
    return (this.event?.days ?? []).filter((d) => this.isDayInRange(d.day));
  }

  subtotalPartial(): number {
    return this.selectedDaysList().reduce((sum, d) => sum + d.price, 0);
  }

  totalFull(): number {
    return this.subtotalFull() + (this.event?.baseFee ?? 0);
  }

  totalPartial(): number {
    return this.subtotalPartial() + (this.event?.baseFee ?? 0);
  }

  /** How much cheaper the current partial selection is than booking the full journey — 0 once nothing/everything is picked. */
  savings(): number {
    return Math.max(0, this.subtotalFull() - this.subtotalPartial());
  }

  canContinuePartial(): boolean {
    return this.rangeLength() >= this.minConsecutiveDays();
  }

  validationMessage(): string | null {
    if (this.rangeLength() === 0) return 'Pick the days you want to join';
    if (this.rangeLength() < this.minConsecutiveDays()) return `Select at least ${this.minConsecutiveDays()} consecutive days`;
    return null;
  }

  selectionSummaryTitle(): string {
    if (this.rangeStart == null || this.rangeEnd == null) return 'No days picked yet';
    if (this.rangeStart === this.rangeEnd) return `Day ${this.rangeStart}`;
    return `Day ${this.rangeStart} – Day ${this.rangeEnd} (${this.rangeLength()} days)`;
  }

  /** "Continue" in Full Journey mode — hands off to the booking review page before the trip is created. */
  joinFullJourney(): void {
    const ev = this.event;
    if (!ev?.days?.length) return;
    this.goToReview('full');
  }

  /** "Continue" in Partial mode — hands off to the booking review page before the trip is created. */
  continuePartial(): void {
    if (!this.canContinuePartial()) return;
    this.goToReview('partial');
  }

  /** Sends the traveler to /community/events/:id/review with the day selection so they can confirm before paying.
   * The traveler already saw the Event Summary page on the way in (events list → Summary → this Detail page), so
   * Continue here goes straight into the existing review/payment flow rather than back through Summary. */
  private async goToReview(mode: JoinMode): Promise<void> {
    const ev = this.event;
    if (!ev) return;

    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    try {
      await this.itineraryService.startParticipation(ev.id, mode, this.rangeStart, this.rangeEnd);
    } catch (err) {
      console.error('Failed to persist journey participation', err);
    }

    this.router.navigate(['/community/events', ev.id, 'review'], {
      state: { mode, rangeStart: this.rangeStart, rangeEnd: this.rangeEnd }
    });
  }

  toggleJoin(): void {
    const ev = this.event;
    if (!ev) return;
    const joined = this.store.toggleJoin(ev.id);
    this.event = this.store.getById(ev.id);
    this.showToast(joined ? "You're going!" : `Spot released · ${ev.title}`);
  }

  toggleFollow(): void {
    const ev = this.event;
    if (!ev) return;
    this.store.toggleFollow(ev.id);
    this.event = this.store.getById(ev.id);
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = null), 2500);
  }
}
