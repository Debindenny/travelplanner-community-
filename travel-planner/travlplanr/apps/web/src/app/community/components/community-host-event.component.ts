import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommunityEventsMockStore, CURRENT_USER_ID } from '../services/community-events-mock.store';
import { CommunityEventCard, unsplashUrl } from '../services/community-event-view.model';
import { CommunityPostService } from '../services/community-post.service';
import { HostWizardPrefillService } from '../services/host-wizard-prefill.service';
import { DestinationTypeaheadComponent } from '../../shared/components/destination-typeahead/destination-typeahead.component';
import { DestinationListItem } from '../../shared/utils/destination.util';

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;
type WizardView = 'wizard' | 'success';

interface WizardAnswers {
  route: string[];
  startLocation: string;
  differentEnd: boolean;
  endLocation: string;
  startDate: string;
  endDate: string;
  autoSelectDates: boolean;
  tripType: string;
  travelStyle: string[];
  transportation: string[];
  journeyName: string;
  description: string;
  minimumStayDays: number;
  maxTravelers: number;
  allowPartialParticipation: boolean;
}

interface ReviewRow {
  label: string;
  value: string;
}

interface ReviewSection {
  title: string;
  rows: ReviewRow[];
}

const DRAFT_KEY = 'community-host-event-wizard-draft-v2';

const TRIP_TYPE_OPTIONS = ['Hosted Group Trip', 'Solo Adventure', 'Couples Getaway', 'Family Trip', 'Business Trip'];
const TRAVEL_STYLE_OPTIONS = [
  'Adventure',
  'Cultural',
  'Relaxation',
  'Business',
  'City Exploration',
  'Nature & Wildlife',
  'Foodie',
  'Night Life',
  'Shopping',
];
const TRANSPORT_OPTIONS = ['Rental Car', 'Cab / Ride Service'];

const STEP_META: Record<WizardStep, { label: string; subtitle: string }> = {
  1: { label: 'Step 1 — Destinations', subtitle: 'Choose your destinations and plan your multi-city adventure.' },
  2: { label: 'Step 2 — Start & End Place', subtitle: 'Tell travelers where the journey begins and ends.' },
  3: { label: 'Step 3 — Dates', subtitle: 'Set the window travelers will be joining you for.' },
  4: { label: 'Step 4 — Trip Type & Style', subtitle: 'Set the shape of the trip so the right travelers find it.' },
  5: { label: 'Step 5 — Journey Details', subtitle: 'Name it, size it, and decide how people can join.' },
  6: { label: 'Step 6 — Review & Publish', subtitle: 'Check everything before it goes live.' },
};

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultAnswers(): WizardAnswers {
  return {
    route: [],
    startLocation: '',
    differentEnd: false,
    endLocation: '',
    startDate: '',
    endDate: '',
    autoSelectDates: false,
    tripType: TRIP_TYPE_OPTIONS[0],
    travelStyle: [],
    transportation: [],
    journeyName: '',
    description: '',
    minimumStayDays: 2,
    maxTravelers: 2,
    allowPartialParticipation: false,
  };
}

@Component({
  selector: 'app-community-host-event',
  imports: [CommonModule, RouterLink, FormsModule, DestinationTypeaheadComponent],
  template: `
    <div class="min-h-full bg-slate-50 dark:bg-gray-900 px-4 sm:px-6 pt-10 pb-24 font-manrope">
      <div class="max-w-2xl mx-auto">
        <a
          routerLink="/community/events"
          class="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-xs font-bold text-eventText-deep dark:text-white hover:border-slate-300 transition-colors mb-6"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Events
        </a>

        <ng-container *ngIf="view === 'success'; else wizardView">
          <div class="text-center max-w-md mx-auto">
            <div class="w-14 h-14 mx-auto rounded-full bg-green-100 dark:bg-green-500/15 flex items-center justify-center mb-4">
              <svg class="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 class="text-2xl font-black text-eventText-deep dark:text-white">Your Journey is Live!</h1>
            <p class="mt-2 text-sm text-eventText-mid dark:text-gray-300">
              "{{ publishedCard?.title }}" is now in the Events feed for travelers heading to {{ primaryCity }}.
            </p>

            <div class="mt-6 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden text-left">
              <div class="h-28 bg-cover bg-center" [style.background-image]="'url(' + publishedCard?.imageUrl + ')'"></div>
              <div class="px-5 py-4">
                <p class="text-xs font-bold text-primary">{{ publishedCard?.dateRangeLabel }}</p>
                <p class="text-base font-black text-eventText-deep dark:text-white mt-0.5">{{ publishedCard?.title }}</p>
                <p class="text-xs font-semibold text-eventText-mid dark:text-gray-300 mt-0.5 flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  {{ primaryCity }}
                </p>
                <div class="flex items-center justify-between mt-3">
                  <span class="text-xs font-semibold text-eventText-mid dark:text-gray-300">
                    {{ publishedCard?.travelersMax }} travelers max · {{ publishedCard?.partialJoinAllowed ? 'partial join allowed' : 'full journey only' }}
                  </span>
                  <span class="text-sm font-black text-eventText-deep dark:text-white">{{ publishedCard?.price }}</span>
                </div>
              </div>
            </div>

            <div class="mt-4 flex items-center gap-2 h-11 px-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <span class="flex-1 min-w-0 truncate text-xs font-semibold text-eventText-mid dark:text-gray-300">{{ shareLink }}</span>
              <button type="button" (click)="copyShareLink()" class="h-8 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors shrink-0">
                Copy link
              </button>
            </div>

            <div class="mt-4 px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary/10 text-primary text-xs font-semibold flex items-start gap-2 text-left">
              <svg class="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>A travel circle and group chat were created for this journey. Travelers who join land straight in it.</span>
            </div>

            <div class="mt-5 flex items-center justify-center gap-3">
              <a
                routerLink="/community/events"
                class="h-10 px-5 rounded-xl text-xs font-bold border border-slate-200 dark:border-gray-700 text-eventText-mid dark:text-gray-300 hover:border-slate-300 transition-colors inline-flex items-center"
              >
                Back to Events
              </a>
              <a
                *ngIf="publishedCard"
                [routerLink]="['/community/events', publishedCard.id]"
                class="h-10 px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors inline-flex items-center"
              >
                View journey page
              </a>
            </div>
          </div>
        </ng-container>

        <ng-template #wizardView>
          <div class="text-center mb-7">
            <h1 class="font-manrope text-[28px] sm:text-3xl font-black text-eventText-deep dark:text-white">Travel Plan Wizard</h1>
            <p class="mt-2 text-sm text-eventText-mid dark:text-gray-300">{{ stepMeta.subtitle }}</p>
          </div>

          <div class="mb-5">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[11px] font-extrabold text-primary uppercase tracking-wide">{{ stepMeta.label }}</span>
              <span class="text-xs font-semibold text-eventText-mid dark:text-gray-300">Step {{ currentStep }} of 6</span>
            </div>
            <div class="h-1.5 rounded-full bg-slate-200 dark:bg-gray-700 overflow-hidden">
              <div class="h-full bg-primary rounded-full transition-all duration-300" [style.width.%]="progressPercent"></div>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
            <div class="px-6 sm:px-8 py-7">
              <ng-container [ngSwitch]="currentStep">
                <!-- Step 1 — Destinations -->
                <div *ngSwitchCase="1" class="flex flex-col gap-5">
                  <div>
                    <label class="block text-sm font-bold text-eventText-deep dark:text-white mb-2">
                      Where are you going? <span class="text-red-500">*</span>
                    </label>
                    <div class="relative" #routeSearchShell>
                      <input
                        type="text"
                        [(ngModel)]="routeQuery"
                        (input)="onRouteQueryChange()"
                        (focus)="routeDropdownOpen = true"
                        (blur)="onRouteBlur()"
                        (keydown)="onRouteKeydown($event)"
                        placeholder="Search cities or places…"
                        autocomplete="off"
                        class="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <app-destination-typeahead
                        #routeTypeahead
                        listboxId="wizard-route-listbox"
                        [query]="routeQuery"
                        presentation="dropdown"
                        variant="surface"
                        [open]="routeDropdownOpen"
                        (picked)="onRoutePicked($event)"
                        (dismissed)="routeDropdownOpen = false"
                      />
                    </div>
                  </div>

                  <div>
                    <p class="text-sm font-bold text-eventText-deep dark:text-white mb-1.5">Your route</p>
                    <p *ngIf="!answers.route.length" class="text-xs font-semibold text-eventText-soft">Add at least one city to continue.</p>
                    <div *ngIf="answers.route.length" class="flex flex-wrap gap-2">
                      <span
                        *ngFor="let city of answers.route; let i = index"
                        class="inline-flex items-center gap-1.5 h-9 pl-3.5 pr-2 rounded-full bg-primary-50 dark:bg-primary/10 text-primary text-xs font-bold"
                      >
                        {{ i + 1 }}. {{ city }}
                        <button
                          type="button"
                          (click)="removeRouteCity(city)"
                          aria-label="Remove city"
                          class="w-5 h-5 rounded-full flex items-center justify-center hover:bg-primary/20"
                        >
                          ×
                        </button>
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Step 2 — Start & End Place -->
                <div *ngSwitchCase="2" class="flex flex-col gap-5">
                  <div>
                    <label class="block text-sm font-bold text-eventText-deep dark:text-white mb-2">
                      Trip start place <span class="text-red-500">*</span>
                    </label>
                    <div class="relative" #startLocationShell>
                      <input
                        type="text"
                        [(ngModel)]="answers.startLocation"
                        (input)="onStartLocationInput()"
                        (focus)="startLocationDropdownOpen = true"
                        (blur)="onStartLocationBlur()"
                        (keydown)="onStartLocationKeydown($event)"
                        placeholder="e.g. Chennai"
                        autocomplete="off"
                        class="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <app-destination-typeahead
                        #startLocationTypeahead
                        listboxId="wizard-start-location-listbox"
                        [query]="answers.startLocation"
                        presentation="dropdown"
                        variant="surface"
                        [open]="startLocationDropdownOpen"
                        (picked)="onStartLocationPicked($event)"
                        (dismissed)="startLocationDropdownOpen = false"
                      />
                    </div>
                  </div>

                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm font-bold text-eventText-deep dark:text-white">End trip at a different location</span>
                    <button
                      type="button"
                      role="switch"
                      [attr.aria-checked]="answers.differentEnd"
                      (click)="answers.differentEnd = !answers.differentEnd"
                      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
                      [class.bg-primary]="answers.differentEnd"
                      [class.bg-slate-200]="!answers.differentEnd"
                    >
                      <span
                        class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                        [class.translate-x-6]="answers.differentEnd"
                        [class.translate-x-1]="!answers.differentEnd"
                      ></span>
                    </button>
                  </div>

                  <div *ngIf="answers.differentEnd">
                    <label class="block text-sm font-bold text-eventText-deep dark:text-white mb-2">
                      Trip end place <span class="text-red-500">*</span>
                    </label>
                    <div class="relative" #endLocationShell>
                      <input
                        type="text"
                        [(ngModel)]="answers.endLocation"
                        (input)="onEndLocationInput()"
                        (focus)="endLocationDropdownOpen = true"
                        (blur)="onEndLocationBlur()"
                        (keydown)="onEndLocationKeydown($event)"
                        placeholder="e.g. Kuala Lumpur"
                        autocomplete="off"
                        class="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <app-destination-typeahead
                        #endLocationTypeahead
                        listboxId="wizard-end-location-listbox"
                        [query]="answers.endLocation"
                        presentation="dropdown"
                        variant="surface"
                        [open]="endLocationDropdownOpen"
                        (picked)="onEndLocationPicked($event)"
                        (dismissed)="endLocationDropdownOpen = false"
                      />
                    </div>
                  </div>
                  <div *ngIf="!answers.differentEnd" class="px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary/10 text-primary text-xs font-semibold flex items-start gap-2">
                    <svg class="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 2l1.8 4.6L18 8l-4.2 1.4L12 14l-1.8-4.6L6 8l4.2-1.4L12 2Z" />
                    </svg>
                    <span>The journey ends where it starts. Turn this on if travelers depart from a different city.</span>
                  </div>
                </div>

                <!-- Step 3 — Dates -->
                <div *ngSwitchCase="3" class="flex flex-col gap-5">
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-bold text-eventText-deep dark:text-white mb-2">
                        Start date <span class="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        [ngModel]="answers.startDate"
                        (ngModelChange)="answers.startDate = $event; onStartDateChange()"
                        [attr.min]="todayIso"
                        class="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-bold text-eventText-deep dark:text-white mb-2">
                        End date <span class="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        [(ngModel)]="answers.endDate"
                        [attr.min]="answers.startDate || todayIso"
                        [disabled]="datesLocked"
                        class="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-slate-50 dark:disabled:bg-gray-700/20 disabled:text-eventText-mid disabled:cursor-not-allowed"
                      />
                      <p *ngIf="datesLocked" class="mt-1.5 text-xs font-semibold text-eventText-soft">
                        This itinerary runs {{ templateDaysLabel }} — end date is calculated for you.
                      </p>
                    </div>
                  </div>

                  <div class="flex items-start justify-between gap-3 px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary/10">
                    <div>
                      <p class="text-sm font-bold text-eventText-deep dark:text-white">Auto-select best dates</p>
                      <p class="text-xs font-semibold text-eventText-mid dark:text-gray-300 mt-0.5">
                        Suggests optimal dates based on weather, local events and pricing.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      [attr.aria-checked]="answers.autoSelectDates"
                      (click)="answers.autoSelectDates = !answers.autoSelectDates"
                      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
                      [class.bg-primary]="answers.autoSelectDates"
                      [class.bg-slate-200]="!answers.autoSelectDates"
                    >
                      <span
                        class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                        [class.translate-x-6]="answers.autoSelectDates"
                        [class.translate-x-1]="!answers.autoSelectDates"
                      ></span>
                    </button>
                  </div>

                  <p *ngIf="tripNights" class="text-sm font-bold text-primary">
                    {{ tripNights }} nights · {{ answers.route.length || 1 }} {{ (answers.route.length || 1) === 1 ? 'city' : 'cities' }}
                  </p>
                </div>

                <!-- Step 4 — Trip Type & Style -->
                <div *ngSwitchCase="4" class="flex flex-col gap-6">
                  <div>
                    <p class="text-sm font-bold text-eventText-deep dark:text-white mb-2.5">Trip type <span class="text-red-500">*</span></p>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        *ngFor="let opt of tripTypeOptions"
                        type="button"
                        (click)="answers.tripType = opt"
                        class="h-11 px-4 rounded-xl border text-sm font-bold text-left flex items-center justify-between transition-colors"
                        [class.border-primary]="answers.tripType === opt"
                        [class.bg-primary-50]="answers.tripType === opt"
                        [class.text-primary]="answers.tripType === opt"
                        [class.border-slate-200]="answers.tripType !== opt"
                        [class.text-eventText-deep]="answers.tripType !== opt"
                      >
                        {{ opt }}
                        <svg *ngIf="answers.tripType === opt" class="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p class="text-sm font-bold text-eventText-deep dark:text-white mb-2.5">Travel style</p>
                    <div class="flex flex-wrap gap-2">
                      <button
                        *ngFor="let opt of travelStyleOptions"
                        type="button"
                        (click)="toggleTravelStyle(opt)"
                        class="h-9 px-4 rounded-full border text-xs font-bold transition-colors"
                        [class.border-primary]="hasTravelStyle(opt)"
                        [class.bg-primary-50]="hasTravelStyle(opt)"
                        [class.text-primary]="hasTravelStyle(opt)"
                        [class.border-slate-200]="!hasTravelStyle(opt)"
                        [class.text-eventText-deep]="!hasTravelStyle(opt)"
                      >
                        {{ opt }}
                      </button>
                    </div>
                  </div>

                  <div>
                    <p class="text-sm font-bold text-eventText-deep dark:text-white mb-2.5">City transportation</p>
                    <div class="flex flex-wrap gap-2">
                      <button
                        *ngFor="let opt of transportOptions"
                        type="button"
                        (click)="toggleTransport(opt)"
                        class="h-9 px-4 rounded-full border text-xs font-bold transition-colors"
                        [class.border-primary]="hasTransport(opt)"
                        [class.bg-primary-50]="hasTransport(opt)"
                        [class.text-primary]="hasTransport(opt)"
                        [class.border-slate-200]="!hasTransport(opt)"
                        [class.text-eventText-deep]="!hasTransport(opt)"
                      >
                        {{ opt }}
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Step 5 — Journey Details -->
                <div *ngSwitchCase="5" class="flex flex-col gap-5">
                  <div>
                    <label class="block text-sm font-bold text-eventText-deep dark:text-white mb-2">
                      Journey name <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      [(ngModel)]="answers.journeyName"
                      placeholder="e.g. Bali Sunrise Circuit"
                      autocomplete="off"
                      class="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button type="button" (click)="useSuggestedName()" class="mt-1.5 text-xs font-bold text-primary hover:underline">
                      Use suggested name
                    </button>
                  </div>

                  <div>
                    <label class="block text-sm font-bold text-eventText-deep dark:text-white mb-2">Trip description</label>
                    <textarea
                      rows="3"
                      [(ngModel)]="answers.description"
                      placeholder="What makes this route worth joining?"
                      class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-medium text-eventText-deep dark:text-white dark:bg-gray-700/50 resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                    ></textarea>
                  </div>

                  <div class="grid grid-cols-2 gap-6">
                    <div>
                      <p class="text-sm font-bold text-eventText-deep dark:text-white mb-2">Minimum stay (days)</p>
                      <div class="flex items-center gap-3">
                        <button
                          type="button"
                          (click)="adjustMinimumStay(-1)"
                          class="w-9 h-9 rounded-lg border border-slate-200 dark:border-gray-700 flex items-center justify-center text-eventText-deep dark:text-white hover:border-slate-300 transition-colors"
                        >
                          −
                        </button>
                        <span class="text-sm font-black w-6 text-center">{{ answers.minimumStayDays }}</span>
                        <button
                          type="button"
                          (click)="adjustMinimumStay(1)"
                          class="w-9 h-9 rounded-lg border border-slate-200 dark:border-gray-700 flex items-center justify-center text-eventText-deep dark:text-white hover:border-slate-300 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div>
                      <p class="text-sm font-bold text-eventText-deep dark:text-white mb-2">Maximum travelers</p>
                      <div class="flex items-center gap-3">
                        <button
                          type="button"
                          (click)="adjustMaxTravelers(-1)"
                          class="w-9 h-9 rounded-lg border border-slate-200 dark:border-gray-700 flex items-center justify-center text-eventText-deep dark:text-white hover:border-slate-300 transition-colors"
                        >
                          −
                        </button>
                        <span class="text-sm font-black w-6 text-center">{{ answers.maxTravelers }}</span>
                        <button
                          type="button"
                          (click)="adjustMaxTravelers(1)"
                          class="w-9 h-9 rounded-lg border border-slate-200 dark:border-gray-700 flex items-center justify-center text-eventText-deep dark:text-white hover:border-slate-300 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-start justify-between gap-3 px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary/10">
                    <div>
                      <p class="text-sm font-bold text-eventText-deep dark:text-white">Allow partial participation</p>
                      <p class="text-xs font-semibold text-eventText-mid dark:text-gray-300 mt-0.5">
                        Travelers can join for part of this journey or selected cities.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      [attr.aria-checked]="answers.allowPartialParticipation"
                      (click)="answers.allowPartialParticipation = !answers.allowPartialParticipation"
                      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
                      [class.bg-primary]="answers.allowPartialParticipation"
                      [class.bg-slate-200]="!answers.allowPartialParticipation"
                    >
                      <span
                        class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                        [class.translate-x-6]="answers.allowPartialParticipation"
                        [class.translate-x-1]="!answers.allowPartialParticipation"
                      ></span>
                    </button>
                  </div>
                </div>

                <!-- Step 6 — Review & Publish -->
                <div *ngSwitchCase="6" class="flex flex-col gap-6">
                  <div *ngFor="let section of reviewSections">
                    <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-2">{{ section.title }}</p>
                    <div class="rounded-xl border border-slate-200 dark:border-gray-700 divide-y divide-slate-100 dark:divide-gray-700">
                      <div *ngFor="let row of section.rows" class="px-4 py-2.5 flex items-center justify-between gap-4">
                        <span class="text-xs font-semibold text-eventText-mid dark:text-gray-300">{{ row.label }}</span>
                        <span class="text-xs font-bold text-eventText-deep dark:text-white text-right">{{ row.value }}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-2">City schedule</p>
                    <div class="flex flex-wrap gap-2">
                      <span
                        *ngFor="let chip of citySchedule"
                        class="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary-50 dark:bg-primary/10 text-primary text-xs font-bold"
                      >
                        <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                        {{ chip }}
                      </span>
                    </div>
                  </div>
                </div>
              </ng-container>
            </div>

            <div class="px-6 sm:px-8 py-4 border-t border-slate-100 dark:border-gray-700 flex items-center gap-3 flex-wrap">
              <button
                *ngIf="currentStep > 1"
                type="button"
                (click)="goBack()"
                class="h-10 px-4 rounded-xl text-xs font-bold border border-slate-200 dark:border-gray-700 text-eventText-mid dark:text-gray-300 hover:border-slate-300 transition-colors"
              >
                Back
              </button>
              <span class="flex-1 min-w-0 text-xs font-semibold text-eventText-soft truncate">{{ currentHint }}</span>

              <ng-container *ngIf="currentStep < 6; else publishActions">
                <button
                  type="button"
                  [disabled]="!canContinue"
                  (click)="goNext()"
                  class="h-10 px-6 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </ng-container>
              <ng-template #publishActions>
                <button
                  type="button"
                  (click)="saveDraft()"
                  class="h-10 px-4 rounded-xl text-xs font-bold border border-primary text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors"
                >
                  Save as draft
                </button>
                <button
                  type="button"
                  [disabled]="publishing"
                  (click)="publish()"
                  class="h-10 px-6 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {{ publishing ? 'Generating…' : 'Generate itinerary' }}
                </button>
              </ng-template>
            </div>
          </div>
        </ng-template>
      </div>
    </div>

    <!-- Toast -->
    <div *ngIf="toastMessage" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg">
      {{ toastMessage }}
    </div>
  `,
})
export class CommunityHostEventComponent {
  private readonly store = inject(CommunityEventsMockStore);
  private readonly communityPostService = inject(CommunityPostService);
  private readonly wizardPrefill = inject(HostWizardPrefillService);

  @ViewChild('routeSearchShell') private routeSearchShellRef?: ElementRef<HTMLDivElement>;
  @ViewChild('routeTypeahead') private routeTypeahead?: DestinationTypeaheadComponent;
  @ViewChild('startLocationShell') private startLocationShellRef?: ElementRef<HTMLDivElement>;
  @ViewChild('startLocationTypeahead') private startLocationTypeahead?: DestinationTypeaheadComponent;
  @ViewChild('endLocationShell') private endLocationShellRef?: ElementRef<HTMLDivElement>;
  @ViewChild('endLocationTypeahead') private endLocationTypeahead?: DestinationTypeaheadComponent;

  readonly tripTypeOptions = TRIP_TYPE_OPTIONS;
  readonly travelStyleOptions = TRAVEL_STYLE_OPTIONS;
  readonly transportOptions = TRANSPORT_OPTIONS;
  readonly todayIso = toLocalIsoDate(new Date());

  view: WizardView = 'wizard';
  currentStep: WizardStep = 1;
  answers: WizardAnswers = defaultAnswers();

  routeQuery = '';
  routeDropdownOpen = false;

  startLocationDropdownOpen = false;
  endLocationDropdownOpen = false;

  publishing = false;
  publishedCard: CommunityEventCard | null = null;
  shareLink = '';

  toastMessage: string | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private cloneTripId: string | null = null;
  private templateDays: number | null = null;
  private templateImage: string | null = null;

  constructor() {
    const prefill = this.wizardPrefill.consume();
    // A prefill means the user just arrived from the Trips "Plan your version"
    // flow — start clean rather than layering it onto a stale local draft.
    this.answers = prefill ? defaultAnswers() : this.tryLoadDraft() ?? defaultAnswers();

    if (prefill) {
      this.cloneTripId = prefill.cloneTripId ?? null;
      if (prefill.route?.length) this.answers.route = [...prefill.route];
      if (prefill.startLocation) this.answers.startLocation = prefill.startLocation;
      if (prefill.startDate) this.answers.startDate = prefill.startDate;
      if (prefill.endDate) this.answers.endDate = prefill.endDate;
      if (prefill.days) this.templateDays = prefill.days;
      if (prefill.image) this.templateImage = prefill.image;
      if (prefill.maxTravelers) this.answers.maxTravelers = prefill.maxTravelers;
      if (prefill.journeyName) this.answers.journeyName = prefill.journeyName;
    }

    // Reflect an already-known destination in the search box on first render,
    // so it doesn't look empty when a route came in via prefill or a saved draft.
    if (this.answers.route.length) this.routeQuery = this.answers.route.join(', ');
  }

  get stepMeta() {
    return STEP_META[this.currentStep];
  }

  get progressPercent(): number {
    return Math.round((this.currentStep / 6) * 100);
  }

  get primaryCity(): string {
    return this.answers.route[0] || this.answers.startLocation.trim() || 'your destination';
  }

  get tripNights(): number {
    if (!this.answers.startDate || !this.answers.endDate) {
      return 0;
    }
    const start = new Date(`${this.answers.startDate}T00:00:00`);
    const end = new Date(`${this.answers.endDate}T00:00:00`);
    const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
    return diff > 0 ? diff : 0;
  }

  /** True when cloning a template trip of known length — its route is a
   * fixed, already-built itinerary, so the end date tracks the start date
   * rather than being independently editable. */
  get datesLocked(): boolean {
    return !!this.cloneTripId && !!this.templateDays;
  }

  get templateDaysLabel(): string {
    const days = this.templateDays ?? 0;
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  get canContinue(): boolean {
    switch (this.currentStep) {
      case 1:
        return this.answers.route.length > 0;
      case 2:
        return !!this.answers.startLocation.trim() && (!this.answers.differentEnd || !!this.answers.endLocation.trim());
      case 3:
        return !!this.answers.startDate && !!this.answers.endDate && this.tripNights > 0;
      case 4:
        return !!this.answers.tripType;
      case 5:
        return !!this.answers.journeyName.trim();
      default:
        return true;
    }
  }

  get currentHint(): string {
    if (this.canContinue) {
      return '';
    }
    switch (this.currentStep) {
      case 1:
        return 'Add at least one city to continue.';
      case 2:
        return !this.answers.startLocation.trim() ? 'Add a start place' : 'Add an end place';
      case 3:
        if (!this.answers.startDate) return 'Add a start date';
        if (!this.answers.endDate) return 'Add an end date';
        return 'End date must be after the start date';
      case 5:
        return 'Name this journey to continue';
      default:
        return '';
    }
  }

  get reviewSections(): ReviewSection[] {
    const a = this.answers;
    const nights = this.tripNights;
    return [
      {
        title: 'Trip details',
        rows: [
          { label: 'Journey', value: a.journeyName.trim() || '—' },
          { label: 'Type', value: a.tripType || 'Not set' },
          { label: 'Style', value: a.travelStyle.length ? a.travelStyle.join(', ') : 'Not set' },
        ],
      },
      {
        title: 'Route & transportation',
        rows: [
          { label: 'Cities', value: a.route.length ? a.route.join(', ') : '—' },
          { label: 'Starts', value: a.startLocation.trim() || '—' },
          { label: 'Ends', value: a.differentEnd ? a.endLocation.trim() || '—' : a.startLocation.trim() || '—' },
          { label: 'Transport', value: a.transportation.length ? a.transportation.join(', ') : 'Not set' },
        ],
      },
      {
        title: 'Dates & schedule',
        rows: [
          {
            label: 'Window',
            value: a.startDate && a.endDate ? `${this.formatDateShort(a.startDate)} - ${this.formatDateShort(a.endDate)} (${nights} nights)` : '—',
          },
          { label: 'Nights', value: nights ? String(nights) : '—' },
        ],
      },
      {
        title: 'Group & participation',
        rows: [
          { label: 'Max travelers', value: String(a.maxTravelers) },
          { label: 'Minimum stay', value: a.minimumStayDays > 0 ? `${a.minimumStayDays} day${a.minimumStayDays === 1 ? '' : 's'}` : 'No minimum' },
          { label: 'Participation', value: a.allowPartialParticipation ? 'Partial join allowed' : 'Full journey only' },
        ],
      },
      {
        title: 'Circle connection',
        rows: [
          { label: 'Travel circle', value: `${this.primaryCity} Crew` },
          { label: 'Chat', value: 'Created when you publish' },
        ],
      },
    ];
  }

  get citySchedule(): string[] {
    const cities = this.answers.route.length ? this.answers.route : [this.primaryCity];
    const nights = this.tripNights || cities.length;
    const base = Math.floor(nights / cities.length);
    const remainder = nights % cities.length;
    return cities.map((city, i) => `${city} (${base + (i < remainder ? 1 : 0)}d)`);
  }

  // ── Step navigation ──────────────────────────────────────────────

  goNext(): void {
    if (!this.canContinue) return;
    this.currentStep = Math.min(6, this.currentStep + 1) as WizardStep;
  }

  goBack(): void {
    this.currentStep = Math.max(1, this.currentStep - 1) as WizardStep;
  }

  // ── Step 1: destination route search ─────────────────────────────

  onRouteQueryChange(): void {
    this.routeTypeahead?.resetActiveIndex();
    this.routeDropdownOpen = true;
  }

  onRouteBlur(): void {
    setTimeout(() => {
      const shell = this.routeSearchShellRef?.nativeElement;
      const active = document.activeElement;
      if (shell && active && shell.contains(active)) return;
      this.routeDropdownOpen = false;
    }, 0);
  }

  onRouteKeydown(event: KeyboardEvent): void {
    if (this.routeTypeahead?.handleKeydown(event)) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addRouteCity(this.routeQuery);
    }
  }

  onRoutePicked(item: DestinationListItem): void {
    this.addRouteCity(item.name);
  }

  private addRouteCity(name: string): void {
    const trimmed = name.trim();
    if (!trimmed || this.answers.route.includes(trimmed)) {
      this.routeQuery = '';
      this.routeDropdownOpen = false;
      return;
    }
    this.answers.route = [...this.answers.route, trimmed];
    this.routeQuery = '';
    this.routeDropdownOpen = false;
  }

  removeRouteCity(city: string): void {
    this.answers.route = this.answers.route.filter((c) => c !== city);
  }

  // ── Step 2: start / end place search ──────────────────────────────

  onStartLocationInput(): void {
    this.startLocationTypeahead?.resetActiveIndex();
    this.startLocationDropdownOpen = true;
  }

  onStartLocationBlur(): void {
    setTimeout(() => {
      const shell = this.startLocationShellRef?.nativeElement;
      const active = document.activeElement;
      if (shell && active && shell.contains(active)) return;
      this.startLocationDropdownOpen = false;
    }, 0);
  }

  onStartLocationKeydown(event: KeyboardEvent): void {
    this.startLocationTypeahead?.handleKeydown(event);
  }

  onStartLocationPicked(item: DestinationListItem): void {
    this.answers.startLocation = item.name;
    this.startLocationDropdownOpen = false;
  }

  onEndLocationInput(): void {
    this.endLocationTypeahead?.resetActiveIndex();
    this.endLocationDropdownOpen = true;
  }

  onEndLocationBlur(): void {
    setTimeout(() => {
      const shell = this.endLocationShellRef?.nativeElement;
      const active = document.activeElement;
      if (shell && active && shell.contains(active)) return;
      this.endLocationDropdownOpen = false;
    }, 0);
  }

  onEndLocationKeydown(event: KeyboardEvent): void {
    this.endLocationTypeahead?.handleKeydown(event);
  }

  onEndLocationPicked(item: DestinationListItem): void {
    this.answers.endLocation = item.name;
    this.endLocationDropdownOpen = false;
  }

  // ── Step 3: dates ──────────────────────────────────────────────────

  onStartDateChange(): void {
    if (!this.datesLocked || !this.answers.startDate) return;
    const start = new Date(`${this.answers.startDate}T00:00:00`);
    start.setDate(start.getDate() + (this.templateDays! - 1));
    this.answers.endDate = toLocalIsoDate(start);
  }

  // ── Step 4: multi-select pills ────────────────────────────────────

  hasTravelStyle(option: string): boolean {
    return this.answers.travelStyle.includes(option);
  }

  toggleTravelStyle(option: string): void {
    const i = this.answers.travelStyle.indexOf(option);
    if (i === -1) this.answers.travelStyle.push(option);
    else this.answers.travelStyle.splice(i, 1);
  }

  hasTransport(option: string): boolean {
    return this.answers.transportation.includes(option);
  }

  toggleTransport(option: string): void {
    const i = this.answers.transportation.indexOf(option);
    if (i === -1) this.answers.transportation.push(option);
    else this.answers.transportation.splice(i, 1);
  }

  // ── Step 5: journey details ───────────────────────────────────────

  useSuggestedName(): void {
    this.answers.journeyName = `${this.primaryCity} Journey`;
  }

  adjustMinimumStay(delta: number): void {
    this.answers.minimumStayDays = Math.max(0, Math.min(30, this.answers.minimumStayDays + delta));
  }

  adjustMaxTravelers(delta: number): void {
    this.answers.maxTravelers = Math.max(1, Math.min(50, this.answers.maxTravelers + delta));
  }

  // ── Formatting helpers ────────────────────────────────────────────

  private formatDateShort(iso: string): string {
    if (!iso) return '';
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
  }

  private estimatePricePerPerson(nights: number): string {
    if (!nights) return 'Free';
    const total = nights * 9750;
    return `₹${total.toLocaleString('en-IN')}/pp`;
  }

  private slugify(text: string): string {
    return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'journey';
  }

  // ── Draft persistence (local only, no backend) ───────────────────

  private tryLoadDraft(): WizardAnswers | null {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return { ...defaultAnswers(), ...parsed };
    } catch {
      return null;
    }
  }

  private clearDraft(): void {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* best-effort local persistence only */
    }
  }

  saveDraft(): void {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(this.answers));
      this.showToast("Saved as draft — pick up where you left off anytime from 'Host an event'.");
    } catch {
      this.showToast('Could not save the draft on this device.');
    }
  }

  // ── Publish ───────────────────────────────────────────────────────

  private buildEventCard(): CommunityEventCard {
    const a = this.answers;
    const nights = this.tripNights;
    const start = a.startDate ? new Date(`${a.startDate}T00:00:00`) : new Date();
    const cities = a.route.length ? a.route : [this.primaryCity];
    const endsAt = a.differentEnd ? a.endLocation.trim() || a.startLocation.trim() : a.startLocation.trim();

    const descriptionParts = [
      a.description.trim(),
      a.tripType ? `Trip type: ${a.tripType}` : '',
      a.travelStyle.length ? `Travel style: ${a.travelStyle.join(', ')}` : '',
      a.transportation.length ? `Transportation: ${a.transportation.join(', ')}` : '',
      `Starts from: ${a.startLocation.trim()}`,
      a.differentEnd ? `Ends at: ${endsAt}` : '',
    ].filter(Boolean);

    return {
      id: `evt-${Date.now()}`,
      title: a.journeyName.trim(),
      location: cities.join(', '),
      time: '',
      duration: nights ? (nights === 1 ? '1 night' : `${nights} nights`) : '',
      price: this.estimatePricePerPerson(nights),
      travelersGoing: 0,
      month: start.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: start.getDate().toString().padStart(2, '0'),
      tag: 'Meetup',
      joined: false,
      followed: false,
      imageUrl: this.templateImage || unsplashUrl('1488646953014-85cb44e25828'),
      hostId: CURRENT_USER_ID,
      hostName: 'You',
      hostRole: '',
      reason: '',
      description: descriptionParts.join('\n'),
      groupMax: `${a.maxTravelers} max`,
      schedule: [],
      locationName: a.startLocation.trim() || cities[0],
      locationNote: `Minimum stay: ${a.minimumStayDays > 0 ? a.minimumStayDays + ' day(s)' : 'No minimum'}`,
      cities,
      dateRangeLabel:
        a.startDate && a.endDate ? `${this.formatDateShort(a.startDate).toUpperCase()} - ${this.formatDateShort(a.endDate).toUpperCase()}` : '',
      nights,
      partialJoinAllowed: a.allowPartialParticipation,
      travelersMax: a.maxTravelers,
    };
  }

  publish(): void {
    if (this.publishing) return;
    this.publishing = true;

    const card = this.buildEventCard();
    this.store.addEvent(card);
    this.store.setPendingToast(`"${card.title}" is live — visible to the community`);
    this.clearDraft();

    if (this.cloneTripId) {
      // Best-effort: also seeds a real itinerary from the cloned trip. Failure here
      // shouldn't block the (purely local/mock) event publish above. The user's chosen
      // dates/destination/travelers are forwarded so the clone doesn't inherit the
      // original (often already-completed) template trip's dates.
      this.communityPostService
        .cloneTrip(this.cloneTripId, {
          destination: (this.answers.route.length ? this.answers.route : [this.primaryCity]).join(', '),
          startDate: this.answers.startDate,
          endDate: this.answers.endDate,
          travelers: this.answers.maxTravelers,
        })
        .subscribe({ next: () => {}, error: () => {} });
    }

    this.publishedCard = card;
    this.shareLink = `travlplanr.com/j/${this.slugify(card.title)}`;
    this.publishing = false;
    this.view = 'success';
  }

  copyShareLink(): void {
    navigator.clipboard?.writeText(`https://${this.shareLink}`).then(
      () => this.showToast('Link copied'),
      () => this.showToast('Could not copy link'),
    );
  }

  // ── Misc ────────────────────────────────────────────────────────

  private showToast(message: string): void {
    this.toastMessage = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = null), 3000);
  }
}
