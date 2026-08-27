import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommunityEventCard, CommunityMockEventsService, unsplashUrl } from '../services/community-mock-events.service';
import { PlaceSuggestion, PlaceSuggestionsService } from '../services/place-suggestions.service';
import { DestinationTypeaheadComponent } from '../../shared/components/destination-typeahead/destination-typeahead.component';
import { DestinationListItem } from '../../shared/utils/destination.util';

type WizardStep = 1 | 2 | 3;

type HostCategory = 'Meetup' | 'Food';

interface CategoryOption {
  tag: HostCategory;
  label: string;
  description: string;
  icon: 'users' | 'utensils';
}

interface TripDayPick {
  id: string;
  weekday: string;
  day: string;
  iso: string;
}

@Component({
  selector: 'app-community-host-event',
  imports: [CommonModule, RouterLink, FormsModule, DestinationTypeaheadComponent],
  template: `
    <div class="max-w-3xl mx-auto py-8 px-4 sm:px-6 font-manrope">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 mb-5 text-[12.5px] font-bold text-eventText-soft">
        <a routerLink="/community/events" class="hover:text-primary transition-colors">Events</a>
        <span class="text-slate-300 dark:text-gray-600">/</span>
        <span class="font-extrabold text-eventText-deep dark:text-white">Host an event</span>
      </nav>

      <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <!-- Header -->
        <div class="px-6 sm:px-8 pt-7 pb-5">
          <h1 class="font-manrope text-2xl font-black text-eventText-deep dark:text-white mb-1.5">Host an event</h1>
          <p class="text-sm text-eventText-mid dark:text-gray-300">Travelers going where you are will see it in their feed.</p>

          <!-- Stepper -->
          <div class="flex items-center mt-6">
            <ng-container *ngFor="let s of steps; let last = last">
              <div class="flex items-center gap-2 shrink-0">
                <span
                  class="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 transition-colors"
                  [class.bg-primary]="s.id === step"
                  [class.text-white]="s.id === step"
                  [class.bg-green-100]="s.id < step"
                  [class.dark:bg-green-500/15]="s.id < step"
                  [class.text-green-600]="s.id < step"
                  [class.bg-slate-100]="s.id > step"
                  [class.dark:bg-gray-700]="s.id > step"
                  [class.text-eventText-soft]="s.id > step"
                >
                  <svg *ngIf="s.id < step" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <ng-container *ngIf="s.id >= step">{{ s.id }}</ng-container>
                </span>
                <span
                  class="text-xs font-bold whitespace-nowrap"
                  [class.text-eventText-deep]="s.id === step"
                  [class.dark:text-white]="s.id === step"
                  [class.text-eventText-soft]="s.id !== step"
                >
                  {{ s.label }}
                </span>
              </div>
              <div *ngIf="!last" class="flex-1 h-px mx-3" [class.bg-green-300]="s.id < step" [class.dark:bg-green-700]="s.id < step" [class.bg-slate-200]="s.id >= step" [class.dark:bg-gray-700]="s.id >= step"></div>
            </ng-container>
          </div>
        </div>

        <div class="h-px bg-slate-100 dark:bg-gray-700"></div>

        <!-- Step 1: Basics -->
        <div *ngIf="step === 1" class="px-6 sm:px-8 py-6 flex flex-col gap-5">
          <div>
            <label class="block text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">Event title</label>
            <input
              type="text"
              [(ngModel)]="form.title"
              placeholder="e.g. Montmartre photography walk"
              class="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label class="block text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">Destination</label>
            <div class="relative">
              <svg class="w-4 h-4 text-eventText-soft absolute left-3.5 top-1/2 -translate-y-1/2 z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <path d="M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
              </svg>
              <input
                type="text"
                [ngModel]="form.destination"
                (ngModelChange)="onDestinationInput($event)"
                (focus)="destinationPanelOpen = true"
                
                
                placeholder="Search destinations..."
                autocomplete="off"
                class="w-full h-11 pl-10 pr-3.5 rounded-xl border text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
                [class.border-red-300]="destinationHasText && !destinationValidated"
                [class.border-slate-200]="!(destinationHasText && !destinationValidated)"
                [class.dark:border-gray-700]="!(destinationHasText && !destinationValidated)"
              />
              <app-destination-typeahead
                #destinationTypeahead
                listboxId="host-dest-listbox"
                [query]="form.destination"
                [enabled]="true"
                presentation="dropdown"
                variant="surface"
                [open]="destinationPanelOpen"
                (picked)="onDestinationPicked($event)"
                (dismissed)="destinationPanelOpen = false"
              />
            </div>
            <p *ngIf="destinationHasText && !destinationValidated" class="mt-1.5 text-[11px] font-semibold text-red-500">
              Pick a destination from the list so we can suggest real spots there.
            </p>
          </div>

          <div>
            <label class="block text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">Category</label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                *ngFor="let c of categories"
                type="button"
                (click)="selectCategory(c.tag)"
                class="text-left rounded-xl border p-4 transition-colors"
                [class.border-primary]="form.category === c.tag"
                [class.bg-primary-50]="form.category === c.tag"
                [class.dark:bg-primary/10]="form.category === c.tag"
                [class.border-slate-200]="form.category !== c.tag"
                [class.dark:border-gray-700]="form.category !== c.tag"
              >
                <span
                  class="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5"
                  [class.text-primary]="form.category === c.tag"
                  [class.text-eventText-soft]="form.category !== c.tag"
                >
                  <svg *ngIf="c.icon === 'users'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <svg *ngIf="c.icon === 'utensils'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 2v7c0 1.1.9 2 2 2h1a2 2 0 0 0 2-2V2" />
                    <path d="M7 2v20" />
                    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                  </svg>
                </span>
                <span class="block text-sm font-extrabold text-eventText-deep dark:text-white">{{ c.label }}</span>
                <span class="block text-[11.5px] font-semibold text-eventText-soft mt-0.5">{{ c.description }}</span>
              </button>
            </div>
          </div>

          <!-- Destination-aware category suggestions -->
          <div *ngIf="destinationValidated">
            <p class="text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">
              Suggested {{ categoryLabel(form.category) }} Spots in {{ selectedDestination }}
            </p>

            <div *ngIf="suggestionsLoading" class="flex items-center gap-2 py-4 text-xs font-semibold text-eventText-soft">
              <span class="w-3.5 h-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0"></span>
              Finding {{ categoryLabel(form.category) | lowercase }} spots in {{ selectedDestination }}…
            </div>

            <div *ngIf="!suggestionsLoading && suggestions.length === 0" class="py-4 text-xs font-semibold text-eventText-soft">
              No recommendations available for this destination.
            </div>

            <div *ngIf="!suggestionsLoading && suggestions.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div *ngFor="let s of suggestions" class="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-gray-700 p-2.5">
                <span class="w-9 h-9 rounded-lg bg-slate-100 dark:bg-gray-700 bg-cover bg-center shrink-0" [style.background-image]="s.imageUrl ? 'url(' + s.imageUrl + ')' : null"></span>
                <span class="min-w-0">
                  <span class="block text-xs font-extrabold text-eventText-deep dark:text-white truncate">{{ s.name }}</span>
                  <span class="block text-[10.5px] font-semibold text-eventText-soft truncate">
                    {{ s.rating ? '★ ' + s.rating + (s.address ? ' · ' : '') : '' }}{{ s.address }}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: When & where -->
        <div *ngIf="step === 2" class="px-6 sm:px-8 py-6 flex flex-col gap-5">
          <div>
            <label class="block text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">Pick a day from your trip</label>
            <div class="grid grid-cols-6 gap-1.5">
              <button
                *ngFor="let d of tripDays"
                type="button"
                (click)="pickTripDay(d)"
                class="rounded-lg border py-1.5 text-center transition-colors"
                [ngClass]="form.date === d.iso ? 'bg-primary border-primary' : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700'"
              >
                <span class="block text-[11px] font-semibold leading-tight" [class.text-white]="form.date === d.iso" [class.text-eventText-soft]="form.date !== d.iso">{{ d.weekday }}</span>
                <span class="block text-[15px] font-extrabold leading-tight" [class.text-white]="form.date === d.iso" [class.text-eventText-deep]="form.date !== d.iso">{{ d.day }}</span>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">Date</label>
              <input
                type="date"
                [(ngModel)]="form.date"
                class="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label class="block text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">Start</label>
              <input
                type="time"
                [(ngModel)]="form.time"
                class="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label class="block text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">Duration</label>
              <select
                [(ngModel)]="form.duration"
                class="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary appearance-none bg-no-repeat bg-[right_0.9rem_center] bg-[length:12px]"
                style="background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235A6472%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')"
              >
                <option *ngFor="let opt of durationOptions" [value]="opt">{{ opt }}</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">Meeting point</label>
            <div class="rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
              <div
                class="relative h-[180px] bg-[#EAF1FE] dark:bg-gray-700/50 overflow-hidden cursor-crosshair"
                (click)="dropPin($event)"
              >
                <svg class="absolute inset-0 w-full h-full" viewBox="0 0 600 180" preserveAspectRatio="none">
                  <rect width="600" height="180" fill="#EAF1FE" />
                  <rect x="40" y="25" width="130" height="55" rx="4" fill="#D9E6FC" />
                  <rect x="400" y="90" width="160" height="60" rx="4" fill="#D9E6FC" />
                  <rect x="230" y="20" width="90" height="40" rx="4" fill="#DCEFE0" />
                  <path d="M0 70 H600" stroke="#C7D8F5" stroke-width="3" />
                  <path d="M0 125 H600" stroke="#C7D8F5" stroke-width="3" />
                  <path d="M195 0 V180" stroke="#C7D8F5" stroke-width="3" />
                  <path d="M380 0 V180" stroke="#C7D8F5" stroke-width="3" />
                </svg>

                <span
                  *ngIf="!pinPlaced"
                  class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-8 px-3.5 rounded-full bg-white text-eventText-deep text-[11.5px] font-extrabold shadow flex items-center whitespace-nowrap pointer-events-none"
                >
                  Tap the map to drop a pin
                </span>

                <span
                  *ngIf="pinPlaced"
                  class="absolute flex items-center justify-center pointer-events-none"
                  [style.left.%]="pinPos.x"
                  [style.top.%]="pinPos.y"
                  style="transform: translate(-50%, -100%)"
                >
                  <svg class="w-7 h-7 text-primary drop-shadow" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Z" />
                    <circle cx="12" cy="9" r="2.5" fill="white" />
                  </svg>
                </span>
              </div>
              <input
                type="text"
                [(ngModel)]="form.meetingPoint"
                placeholder="Street address or landmark"
                class="w-full h-11 px-3.5 border-t border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">Capacity</label>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="toggleCapacityLimited()"
                  class="h-11 px-4 rounded-xl border-2 border-primary text-primary text-sm font-extrabold whitespace-nowrap shrink-0 transition-colors hover:bg-primary-50"
                >
                  {{ form.capacityLimited ? 'Limited to' : 'No limit' }}
                </button>
                <input
                  *ngIf="form.capacityLimited"
                  type="text"
                  [(ngModel)]="form.groupMax"
                  placeholder="20"
                  class="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label class="block text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">Price</label>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="togglePricePaid()"
                  class="h-11 px-4 rounded-xl border-2 border-primary text-primary text-sm font-extrabold whitespace-nowrap shrink-0 transition-colors hover:bg-primary-50"
                >
                  {{ form.pricePaid ? 'Costs' : 'Free' }}
                </button>
                <input
                  *ngIf="form.pricePaid"
                  type="text"
                  [(ngModel)]="form.price"
                  placeholder="e.g. €25"
                  class="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: Details -->
        <div *ngIf="step === 3" class="px-6 sm:px-8 py-6 flex flex-col gap-5">
          <div>
            <label class="block text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">Description</label>
            <textarea
              [(ngModel)]="form.description"
              rows="3"
              placeholder="What happens, in the order it happens. Write it the way you would tell a friend."
              class="w-full px-3.5 py-3 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-medium text-eventText-deep dark:text-white dark:bg-gray-700/50 resize-y focus:outline-none focus:ring-2 focus:ring-primary"
            ></textarea>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em]">The plan</label>
              <span class="text-[11px] font-semibold text-eventText-soft">Optional · shows as a timeline</span>
            </div>
            <div class="flex flex-col gap-2">
              <div *ngFor="let s of form.scheduleSteps; let i = index" class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-slate-100 dark:bg-gray-700 text-eventText-soft text-[11px] font-extrabold flex items-center justify-center shrink-0">{{ i + 1 }}</span>
                <input
                  type="text"
                  [(ngModel)]="form.scheduleSteps[i]"
                  placeholder="e.g. Meet at the funicular, 09:00"
                  class="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  *ngIf="form.scheduleSteps.length > 1"
                  type="button"
                  (click)="removeScheduleStep(i)"
                  class="w-8 h-8 rounded-lg text-eventText-soft hover:text-red-500 hover:bg-red-50 flex items-center justify-center shrink-0 transition-colors"
                  aria-label="Remove step"
                >
                  &times;
                </button>
              </div>
            </div>
            <button
              type="button"
              (click)="addScheduleStep()"
              class="mt-2.5 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-primary text-primary text-xs font-bold hover:bg-primary-50 transition-colors w-fit"
            >
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add a step
            </button>
          </div>

          <div>
            <label class="block text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">What to bring</label>
            <input
              type="text"
              [(ngModel)]="form.note"
              placeholder="e.g. A camera — phones are fine. Comfortable shoes."
              class="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label class="block text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">Cover photo</label>
            <input #coverInput type="file" accept="image/jpeg,image/png" class="hidden" (change)="onCoverFileSelected($event)" />
            <button
              type="button"
              (click)="coverInput.click()"
              class="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-gray-700 hover:border-primary transition-colors overflow-hidden"
            >
              <div *ngIf="!coverPreviewUrl" class="py-8 flex flex-col items-center gap-1.5">
                <svg class="w-6 h-6 text-eventText-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span class="text-sm font-extrabold text-eventText-deep dark:text-white">Add a cover photo</span>
                <span class="text-[11px] font-semibold text-eventText-soft">Landscape works best · JPG or PNG</span>
              </div>
              <div *ngIf="coverPreviewUrl" class="relative h-32 bg-cover bg-center" [style.background-image]="'url(' + coverPreviewUrl + ')'">
                <span class="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-xs font-extrabold opacity-0 hover:opacity-100 transition-opacity">Change photo</span>
              </div>
            </button>
          </div>

          <div>
            <label class="block text-[11px] font-extrabold text-eventText-mid uppercase tracking-[0.06em] mb-2">How it will look in the feed</label>
            <div class="max-w-[260px] rounded-2xl border border-slate-100 dark:border-gray-700/80 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <div
                class="relative h-[110px] p-2.5 bg-cover bg-center"
                [style.background-image]="previewImageStyle"
              >
                <div class="flex items-start justify-between">
                  <div class="w-9 h-9 rounded-md bg-white shadow flex flex-col items-center justify-center leading-none shrink-0">
                    <span class="text-[7px] font-extrabold uppercase text-eventText-soft">{{ previewMonth }}</span>
                    <span class="text-sm font-black text-eventText-deep">{{ previewDay }}</span>
                  </div>
                  <span class="px-2 py-1 rounded-full bg-white/95 text-[9.5px] font-extrabold" [class.text-rose-600]="form.category === 'Food'" [class.text-primary]="form.category === 'Meetup'">
                    {{ form.category }}
                  </span>
                </div>
              </div>
              <div class="p-2.5">
                <p class="text-xs font-extrabold text-eventText-deep dark:text-white truncate">{{ form.title || 'Your event title' }}</p>
                <p class="text-[10.5px] font-semibold text-eventText-soft mt-0.5 truncate">{{ form.destination || 'Destination' }}{{ form.time ? ' · ' + form.time : '' }}</p>
                <div class="flex items-center gap-2 mt-2">
                  <span
                    class="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold"
                    [class.bg-green-50]="!form.pricePaid"
                    [class.text-green-700]="!form.pricePaid"
                    [class.bg-slate-100]="form.pricePaid"
                    [class.text-eventText-deep]="form.pricePaid"
                  >
                    {{ form.pricePaid && form.price.trim() ? form.price.trim() : 'Free' }}
                  </span>
                  <span class="text-[10px] font-bold text-eventText-soft">
                    {{ form.capacityLimited && form.groupMax.trim() ? form.groupMax.trim() + ' spots' : 'No limit on spots' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 sm:px-8 py-4 border-t border-slate-100 dark:border-gray-700 flex items-center gap-3">
          <button
            *ngIf="step > 1"
            type="button"
            (click)="back()"
            class="h-10 px-4 rounded-xl text-xs font-bold border border-slate-200 dark:border-gray-700 text-eventText-mid dark:text-gray-300 hover:border-slate-300 transition-colors shrink-0"
          >
            Back
          </button>
          <span class="text-xs font-semibold text-eventText-soft">
            {{ step < 3 ? (stepValid ? 'Looks good' : 'Fill the highlighted fields to continue') : 'Ready to publish' }}
          </span>
          <div class="flex-1"></div>
          <button
            *ngIf="step < 3"
            type="button"
            (click)="next()"
            [disabled]="!stepValid"
            class="h-10 px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            Continue
          </button>
          <button
            *ngIf="step === 3"
            type="button"
            (click)="publish()"
            class="h-10 px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors shrink-0"
          >
            Publish event
          </button>
        </div>
      </div>
    </div>

    <!-- Popup: invalid destination -->
    <div *ngIf="errorMessage" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg">
      {{ errorMessage }}
    </div>
  `
})
export class CommunityHostEventComponent {
  private readonly eventsService = inject(CommunityMockEventsService);
  private readonly router = inject(Router);
  private readonly placeSuggestions = inject(PlaceSuggestionsService);

  readonly steps: { id: WizardStep; label: string }[] = [
    { id: 1, label: 'Basics' },
    { id: 2, label: 'When & where' },
    { id: 3, label: 'Details' }
  ];

  readonly categories: CategoryOption[] = [
    { tag: 'Meetup', label: 'Meetup', description: 'Walks, crawls, anything in person', icon: 'users' },
    { tag: 'Food', label: 'Food', description: 'Eating and drinking together', icon: 'utensils' }
  ];

  /** Mirrors the "Paris · Long weekend" trip from the events list/Add-to-trip picker. */
  readonly tripDays: TripDayPick[] = [
    { id: 'd1', weekday: 'Wed', day: '03', iso: '2026-06-03' },
    { id: 'd2', weekday: 'Thu', day: '04', iso: '2026-06-04' },
    { id: 'd3', weekday: 'Fri', day: '05', iso: '2026-06-05' },
    { id: 'd4', weekday: 'Sat', day: '06', iso: '2026-06-06' },
    { id: 'd5', weekday: 'Sun', day: '07', iso: '2026-06-07' },
    { id: 'd6', weekday: 'Mon', day: '08', iso: '2026-06-08' }
  ];

  readonly durationOptions = ['30m', '1h', '1h 30m', '2h', '2h 30m', '3h', '3h 30m', '4h+'];

  step: WizardStep = 1;
  pinPlaced = false;
  pinPos = { x: 50, y: 50 };

  form = {
    title: '',
    category: 'Meetup' as HostCategory,
    destination: '',
    date: '',
    time: '',
    duration: '2h 30m',
    meetingPoint: '',
    note: '',
    description: '',
    scheduleSteps: [''] as string[],
    pricePaid: false,
    price: '',
    capacityLimited: false,
    groupMax: ''
  };

  coverPreviewUrl: string | null = null;

  // Destination validation + category-aware place suggestions.
  destinationPanelOpen = false;
  /** Set only from a real typeahead pick — the source of truth for "is this destination valid". */
  selectedDestination: string | null = null;
  suggestions: PlaceSuggestion[] = [];
  suggestionsLoading = false;
  errorMessage: string | null = null;
  private errorTimer?: ReturnType<typeof setTimeout>;
  private suggestionsRequestId = 0;

  get destinationHasText(): boolean {
    return !!this.form.destination.trim();
  }

  get destinationValidated(): boolean {
    return !!this.selectedDestination && this.selectedDestination === this.form.destination.trim();
  }

  get stepValid(): boolean {
    if (this.step === 1) {
      return !!(this.form.title.trim() && this.destinationValidated);
    }
    if (this.step === 2) {
      return !!(this.form.date && this.form.time && this.form.meetingPoint.trim());
    }
    return true;
  }

  categoryLabel(tag: HostCategory): string {
    return this.categories.find((c) => c.tag === tag)?.label ?? tag;
  }

  onDestinationInput(value: string): void {
    this.form.destination = value;
    if (!this.destinationValidated) {
      this.suggestions = [];
    }
  }

  onDestinationPicked(item: DestinationListItem): void {
    const display = [item.name, item.region || item.country].filter(Boolean).join(', ');
    this.form.destination = display;
    this.selectedDestination = display;
    this.destinationPanelOpen = false;
    this.suggestions = [];
    this.fetchSuggestions();
  }

  selectCategory(tag: HostCategory): void {
    this.form.category = tag;
    if (this.destinationHasText && !this.destinationValidated) {
      this.showError('Invalid location. Please enter a valid destination.');
      this.suggestions = [];
      return;
    }
    if (this.destinationValidated) {
      this.fetchSuggestions();
    }
  }

  private fetchSuggestions(): void {
    if (!this.destinationValidated) return;
    const location = this.selectedDestination!;
    const category = this.form.category === 'Food' ? 'food' : 'meetup';
    const requestId = ++this.suggestionsRequestId;
    this.suggestionsLoading = true;
    this.placeSuggestions.getSuggestions(location, category, 5).subscribe({
      next: (items) => {
        if (requestId !== this.suggestionsRequestId) return; // destination/category changed since this request was sent
        this.suggestions = items;
        this.suggestionsLoading = false;
      },
      error: () => {
        if (requestId !== this.suggestionsRequestId) return;
        this.suggestions = [];
        this.suggestionsLoading = false;
      }
    });
  }

  private showError(message: string): void {
    this.errorMessage = message;
    clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => (this.errorMessage = null), 3000);
  }

  pickTripDay(d: TripDayPick): void {
    this.form.date = d.iso;
  }

  toggleCapacityLimited(): void {
    this.form.capacityLimited = !this.form.capacityLimited;
  }

  togglePricePaid(): void {
    this.form.pricePaid = !this.form.pricePaid;
  }

  addScheduleStep(): void {
    this.form.scheduleSteps.push('');
  }

  removeScheduleStep(index: number): void {
    this.form.scheduleSteps.splice(index, 1);
  }

  onCoverFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (this.coverPreviewUrl) URL.revokeObjectURL(this.coverPreviewUrl);
    this.coverPreviewUrl = URL.createObjectURL(file);
  }

  get previewMonth(): string {
    if (!this.form.date) return '—';
    return new Date(`${this.form.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  }

  get previewDay(): string {
    if (!this.form.date) return '—';
    return new Date(`${this.form.date}T00:00:00`).getDate().toString().padStart(2, '0');
  }

  get previewImageStyle(): string {
    const overlay = 'linear-gradient(180deg, rgba(11,18,32,.05) 40%, rgba(11,18,32,.55) 100%)';
    return this.coverPreviewUrl
      ? `${overlay}, url(${this.coverPreviewUrl})`
      : `${overlay}, linear-gradient(#E2E8F0, #E2E8F0)`;
  }

  dropPin(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.pinPos = {
      x: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100))
    };
    this.pinPlaced = true;
  }

  next(): void {
    if (this.step === 1 && this.destinationHasText && !this.destinationValidated) {
      this.showError('Invalid location. Please enter a valid destination.');
      return;
    }
    if (!this.stepValid || this.step >= 3) return;
    this.step = (this.step + 1) as WizardStep;
  }

  back(): void {
    if (this.step <= 1) return;
    this.step = (this.step - 1) as WizardStep;
  }

  publish(): void {
    if (!this.stepValid) return;
    const startDate = new Date(`${this.form.date}T${this.form.time}`);
    const price = this.form.pricePaid && this.form.price.trim() ? this.form.price.trim() : 'Free';
    const groupMax = this.form.capacityLimited && this.form.groupMax.trim() ? `${this.form.groupMax.trim()} max` : 'No limit';
    const title = this.form.title.trim();

    const created: CommunityEventCard = {
      id: `evt-${Date.now()}`,
      title,
      location: this.form.destination.trim(),
      time: startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      duration: this.form.duration,
      price,
      travelersGoing: 1,
      month: startDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: startDate.getDate().toString().padStart(2, '0'),
      tag: this.form.category,
      joined: true,
      followed: false,
      imageUrl: this.coverPreviewUrl || unsplashUrl('1488646953014-85cb44e25828'),
      hostName: 'You',
      hostRole: 'Event host',
      reason: 'Hosted by you',
      description: this.form.description.trim() || 'Details coming soon — edit this meetup to add a description.',
      groupMax,
      spacesLeftBase: 999,
      schedule: this.form.scheduleSteps
        .map((s) => s.trim())
        .filter(Boolean)
        .map((text) => ({ time: '', text })),
      locationName: this.form.meetingPoint.trim(),
      locationNote: this.form.note.trim()
    };

    this.eventsService.addEvent(created);
    this.eventsService.setPendingToast(`"${created.title}" is live — visible to the community`);
    this.router.navigateByUrl('/community/events');
  }
}
