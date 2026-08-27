import { ChangeDetectionStrategy, Component, computed, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CommunityEventsService } from '../services/community-events.service';
import { CommunityPostService } from '../services/community-post.service';
import { apiErrorMessage } from '../../shared/utils/api-error.util';

type HostStep = 1 | 2 | 3;
type EventCategory = 'meetup' | 'food' | 'online';
type CapacityMode = 'open' | 'limited';
type PriceMode = 'free' | 'paid';

interface StepMeta {
  num: HostStep;
  label: string;
}

const STEPS: StepMeta[] = [
  { num: 1, label: 'Basics' },
  { num: 2, label: 'When & where' },
  { num: 3, label: 'Details' },
];

/** Parses freeform durations like "2h 30m", "90m", "1.5h" or "all day" into minutes. */
function parseDurationMinutes(input: string): number {
  const s = input.trim().toLowerCase();
  if (!s) return 0;
  if (s.includes('all day')) return 24 * 60;

  const hours = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const minutes = s.match(/(\d+)\s*m/);
  if (hours || minutes) {
    return (hours ? parseFloat(hours[1]) * 60 : 0) + (minutes ? parseInt(minutes[1], 10) : 0);
  }
  const bareNumber = parseFloat(s);
  return isNaN(bareNumber) ? 0 : bareNumber * 60;
}

@Component({
  selector: 'app-community-event-host',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-100 dark:bg-gray-900 py-10 px-4 font-manrope flex flex-col items-center">
      <!-- Breadcrumb -->
      <nav class="w-full max-w-2xl flex items-center gap-2 mb-4 text-[12.5px] font-bold text-eventText-soft">
        <a routerLink="/community/events" class="hover:text-primary transition-colors">Events</a>
        <span class="text-slate-300 dark:text-gray-600">/</span>
        <span class="font-extrabold text-eventText-deep dark:text-white">Host an event</span>
      </nav>

      <div class="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
        <div class="px-6 sm:px-8 pt-6 sm:pt-7">
          <h1 class="font-manrope text-2xl font-black text-eventText-deep dark:text-white mb-1">Host an event</h1>
          <p class="text-eventText-mid dark:text-gray-300 text-sm mb-6">Travelers going where you are will see it in their feed.</p>

          <!-- Stepper -->
          <div class="flex items-center mb-6">
            @for (s of steps; track s.num) {
              <div class="flex items-center" [class.flex-1]="s.num !== steps.length">
                <div class="flex items-center gap-2 shrink-0">
                  @if (currentStep() > s.num) {
                    <span class="w-5 h-5 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span class="text-xs font-semibold whitespace-nowrap text-eventText-soft">{{ s.label }}</span>
                  } @else if (currentStep() === s.num) {
                    <span class="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-extrabold shrink-0">{{ s.num }}</span>
                    <span class="text-xs font-extrabold whitespace-nowrap text-eventText-deep dark:text-white">{{ s.label }}</span>
                  } @else {
                    <span class="w-6 h-6 rounded-full bg-slate-100 dark:bg-gray-700 text-eventText-soft flex items-center justify-center text-[11px] font-extrabold shrink-0">{{ s.num }}</span>
                    <span class="text-xs font-bold whitespace-nowrap text-eventText-soft">{{ s.label }}</span>
                  }
                </div>
                @if (s.num !== steps.length) {
                  <span class="flex-1 h-px mx-3" [class.bg-primary]="currentStep() > s.num" [class.bg-slate-200]="currentStep() <= s.num" [class.dark:bg-gray-700]="currentStep() <= s.num"></span>
                }
              </div>
            }
          </div>
        </div>

        <div class="border-t border-slate-100 dark:border-gray-700"></div>

        <!-- Step content -->
        <div class="px-6 sm:px-8 py-6 flex flex-col gap-5 min-h-[280px]">
          @if (currentStep() === 1) {
            <div>
              <label class="block text-2xs font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">Event Title</label>
              <input
                type="text"
                [value]="title()"
                (input)="title.set($any($event.target).value)"
                placeholder="e.g. Kyoto Food Crawl"
                class="w-full text-sm px-3.5 py-2.5 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-900/40 text-eventText-deep dark:text-white font-medium"
              />
            </div>

            <div>
              <label class="block text-2xs font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">Destination</label>
              <div class="relative">
                <svg class="w-4 h-4 text-eventText-soft absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <path d="M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                </svg>
                <input
                  type="text"
                  [value]="destination()"
                  (input)="destination.set($any($event.target).value)"
                  placeholder="Search destinations..."
                  class="w-full text-sm pl-10 pr-3.5 py-2.5 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-900/40 text-eventText-deep dark:text-white font-medium"
                />
              </div>
            </div>

            <div>
              <label class="block text-2xs font-extrabold text-eventText-soft uppercase tracking-wide mb-2">Category</label>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Category">
                <button
                  #meetupBtn
                  type="button"
                  role="radio"
                  [attr.aria-checked]="category() === 'meetup'"
                  [attr.tabindex]="category() === 'meetup' || !category() ? 0 : -1"
                  (click)="category.set('meetup')"
                  (keydown)="onCategoryKeydown($event, 'meetup')"
                  class="text-left p-3.5 rounded-xl border-2 transition-all duration-200"
                  [class.border-slate-200]="category() !== 'meetup'"
                  [class.dark:border-gray-700]="category() !== 'meetup'"
                  [style.border-color]="category() === 'meetup' ? '#0060EA' : null"
                  [style.background-color]="category() === 'meetup' ? '#F0F7FF' : null"
                  [style.box-shadow]="category() === 'meetup' ? '0 4px 14px rgba(0,96,234,0.15)' : 'none'"
                >
                  <span class="flex items-center gap-1.5 mb-1 transition-colors duration-200" [style.color]="category() === 'meetup' ? '#0060EA' : '#5A6472'">
                    <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                      <circle cx="10" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span class="text-sm font-extrabold text-[#111827] dark:text-white">Meetup</span>
                  </span>
                  <span class="text-[11px] text-[#94A3B8] leading-snug block">Walks, crawls, anything in person</span>
                </button>

                <button
                  #foodBtn
                  type="button"
                  role="radio"
                  [attr.aria-checked]="category() === 'food'"
                  [attr.tabindex]="category() === 'food' ? 0 : -1"
                  (click)="category.set('food')"
                  (keydown)="onCategoryKeydown($event, 'food')"
                  class="text-left p-3.5 rounded-xl border-2 transition-all duration-200"
                  [class.border-slate-200]="category() !== 'food'"
                  [class.dark:border-gray-700]="category() !== 'food'"
                  [style.border-color]="category() === 'food' ? '#F97316' : null"
                  [style.background-color]="category() === 'food' ? '#FFF7ED' : null"
                  [style.box-shadow]="category() === 'food' ? '0 4px 14px rgba(249,115,22,0.15)' : 'none'"
                >
                  <span class="flex items-center gap-1.5 mb-1 transition-colors duration-200" [style.color]="category() === 'food' ? '#F97316' : '#5A6472'">
                    <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 2v9a2 2 0 0 1-2 2h-1v9" />
                      <path d="M7 2v6a1 1 0 0 0 1 1h0a1 1 0 0 0 1-1V2" />
                      <path d="M11 2v6a1 1 0 0 1-1 1h0a1 1 0 0 1-1-1V2" />
                      <path d="M8 9v13" />
                    </svg>
                    <span class="text-sm font-extrabold text-[#111827] dark:text-white">Food</span>
                  </span>
                  <span class="text-[11px] text-[#94A3B8] leading-snug block">Eating and drinking together</span>
                </button>

                <button
                  #onlineBtn
                  type="button"
                  role="radio"
                  [attr.aria-checked]="category() === 'online'"
                  [attr.tabindex]="category() === 'online' ? 0 : -1"
                  (click)="category.set('online')"
                  (keydown)="onCategoryKeydown($event, 'online')"
                  class="text-left p-3.5 rounded-xl border-2 transition-all duration-200"
                  [class.border-slate-200]="category() !== 'online'"
                  [class.dark:border-gray-700]="category() !== 'online'"
                  [style.border-color]="category() === 'online' ? '#8B5CF6' : null"
                  [style.background-color]="category() === 'online' ? '#F5F3FF' : null"
                  [style.box-shadow]="category() === 'online' ? '0 4px 14px rgba(139,92,246,0.15)' : 'none'"
                >
                  <span class="flex items-center gap-1.5 mb-1 transition-colors duration-200" [style.color]="category() === 'online' ? '#8B5CF6' : '#5A6472'">
                    <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="4" width="20" height="13" rx="2" />
                      <path d="M8 21h8" />
                      <path d="M12 17v4" />
                    </svg>
                    <span class="text-sm font-extrabold text-[#111827] dark:text-white">Online</span>
                  </span>
                  <span class="text-[11px] text-[#94A3B8] leading-snug block">Live sessions, no location</span>
                </button>
              </div>
            </div>
          }

          @if (currentStep() === 2) {
            <div class="grid grid-cols-3 gap-2.5">
              <div>
                <label class="block text-2xs font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">Date</label>
                <input
                  type="date"
                  [value]="date()"
                  (input)="date.set($any($event.target).value)"
                  class="w-full text-sm px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-900/40 text-eventText-deep dark:text-white font-medium"
                />
              </div>
              <div>
                <label class="block text-2xs font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">Start</label>
                <input
                  type="time"
                  [value]="time()"
                  (input)="time.set($any($event.target).value)"
                  class="w-full text-sm px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-900/40 text-eventText-deep dark:text-white font-medium"
                />
              </div>
              <div>
                <label class="block text-2xs font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">Duration</label>
                <input
                  type="text"
                  [value]="duration()"
                  (input)="duration.set($any($event.target).value)"
                  placeholder="e.g. 2h 30m"
                  class="w-full text-sm px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-900/40 text-eventText-deep dark:text-white font-medium"
                />
              </div>
            </div>

            @if (dateTimeSummary()) {
              <p class="flex items-center gap-1.5 text-xs font-semibold text-success">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {{ dateTimeSummary() }}
              </p>
            }

            @if (category() === 'online') {
              <div class="animate-field-reveal">
                <label for="meetingLinkInput" class="block text-2xs font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">Platform &amp; join link</label>
                <input
                  id="meetingLinkInput"
                  type="text"
                  [value]="meetingLink()"
                  (input)="meetingLink.set($any($event.target).value)"
                  (blur)="meetingLinkTouched.set(true)"
                  placeholder="Zoom, Meet or a link travelers can open"
                  [attr.aria-invalid]="showMeetingLinkError() ? 'true' : null"
                  [attr.aria-describedby]="showMeetingLinkError() ? 'meetingLinkError' : 'meetingLinkHint'"
                  class="w-full h-12 text-sm px-3.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-900/40 text-eventText-deep dark:text-white font-medium placeholder-slate-400"
                  [class.border-slate-200]="!showMeetingLinkError()"
                  [class.dark:border-gray-700]="!showMeetingLinkError()"
                  [class.border-red-400]="showMeetingLinkError()"
                />
                @if (showMeetingLinkError()) {
                  <p id="meetingLinkError" class="text-[11px] font-semibold text-red-500 mt-1.5" role="alert">Platform &amp; join link is required</p>
                } @else {
                  <p id="meetingLinkHint" class="text-[11px] font-medium text-slate-400 mt-1.5">Shared with attendees 30 minutes before it starts, not publicly.</p>
                }
              </div>
            } @else {
              <div>
                <label class="block text-2xs font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">Meeting point</label>
                <input
                  type="text"
                  [value]="venue()"
                  (input)="venue.set($any($event.target).value)"
                  placeholder="e.g. Montmartre, near Sacré-Cœur"
                  class="w-full text-sm px-3.5 py-2.5 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-900/40 text-eventText-deep dark:text-white font-medium"
                />
              </div>
            }

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-2xs font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">Capacity</label>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    (click)="toggleCapacityMode()"
                    class="h-9 px-3.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap"
                    [class.border-primary]="capacityMode() === 'limited'"
                    [class.text-primary]="capacityMode() === 'limited'"
                    [class.bg-primary-50]="capacityMode() === 'limited'"
                    [class.border-slate-200]="capacityMode() === 'open'"
                    [class.dark:border-gray-700]="capacityMode() === 'open'"
                    [class.text-eventText-deep]="capacityMode() === 'open'"
                    [class.dark:text-white]="capacityMode() === 'open'"
                  >
                    {{ capacityMode() === 'open' ? 'No limit' : 'Limited to' }}
                  </button>
                  @if (capacityMode() === 'limited') {
                    <input
                      type="text"
                      inputmode="numeric"
                      [value]="capacityCount()"
                      (input)="capacityCount.set($any($event.target).value)"
                      placeholder="12"
                      class="w-16 text-sm px-2.5 py-2 border border-slate-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-900/40 text-eventText-deep dark:text-white font-medium"
                    />
                  }
                </div>
              </div>

              <div>
                <label class="block text-2xs font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">Price</label>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    (click)="togglePriceMode()"
                    class="h-9 px-3.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap"
                    [class.border-success]="priceMode() === 'free'"
                    [class.text-success]="priceMode() === 'free'"
                    [class.bg-success-50]="priceMode() === 'free'"
                    [class.border-primary]="priceMode() === 'paid'"
                    [class.text-primary]="priceMode() === 'paid'"
                    [class.bg-primary-50]="priceMode() === 'paid'"
                  >
                    {{ priceMode() === 'free' ? 'Free' : 'Paid' }}
                  </button>
                  @if (priceMode() === 'paid') {
                    <input
                      type="text"
                      [value]="priceAmount()"
                      (input)="priceAmount.set($any($event.target).value)"
                      placeholder="e.g. ¥3000"
                      class="flex-1 min-w-0 text-sm px-2.5 py-2 border border-slate-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-900/40 text-eventText-deep dark:text-white font-medium"
                    />
                  }
                </div>
              </div>
            </div>
          }

          @if (currentStep() === 3) {
            <div>
              <label class="block text-2xs font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">Description</label>
              <textarea
                [value]="description()"
                (input)="description.set($any($event.target).value)"
                rows="4"
                placeholder="What happens, in the order it happens. Write it the way you would tell a friend."
                class="w-full text-sm p-3.5 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-900/40 text-eventText-deep dark:text-white resize-none"
              ></textarea>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-2xs font-extrabold text-eventText-soft uppercase tracking-wide">The Plan</label>
                <span class="text-[11px] font-medium text-eventText-soft">Optional · shows as a timeline</span>
              </div>
              <div class="flex flex-col gap-2">
                @for (step of scheduleSteps(); track $index) {
                  <div class="flex items-center gap-2">
                    <span class="w-6 h-6 rounded-full bg-slate-100 dark:bg-gray-700 text-eventText-soft flex items-center justify-center text-[11px] font-extrabold shrink-0">{{ $index + 1 }}</span>
                    <input
                      type="text"
                      [value]="step"
                      (input)="updateScheduleStep($index, $any($event.target).value)"
                      placeholder="What happens next?"
                      class="flex-1 min-w-0 text-sm px-3.5 py-2.5 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-900/40 text-eventText-deep dark:text-white font-medium"
                    />
                    <button
                      type="button"
                      (click)="removeScheduleStep($index)"
                      aria-label="Remove step"
                      class="w-9 h-9 rounded-lg border border-slate-200 dark:border-gray-700 text-eventText-soft hover:text-red-500 hover:border-red-200 flex items-center justify-center shrink-0 transition-colors"
                    >
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                }
              </div>
              <button
                type="button"
                (click)="addScheduleStep()"
                class="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary-hover transition-colors"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add a step
              </button>
            </div>

            <div>
              <label class="block text-2xs font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">What to bring</label>
              <input
                type="text"
                [value]="whatToBring()"
                (input)="whatToBring.set($any($event.target).value)"
                placeholder="e.g. A camera — phones are fine. Comfortable shoes."
                class="w-full text-sm px-3.5 py-2.5 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-900/40 text-eventText-deep dark:text-white font-medium"
              />
            </div>

            <div>
              <label class="block text-2xs font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">Cover photo</label>
              @if (!coverPhotoPreviewUrl()) {
                <button
                  type="button"
                  (click)="coverInput.click()"
                  class="w-full flex flex-col items-center justify-center gap-1.5 py-8 rounded-xl border-2 border-dashed border-slate-200 dark:border-gray-700 hover:border-primary-subtle hover:bg-primary-50/30 transition-colors text-center"
                >
                  <svg class="w-5 h-5 text-eventText-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span class="text-sm font-extrabold text-eventText-deep dark:text-white">Add a cover photo</span>
                  <span class="text-[11px] font-medium text-eventText-soft">Landscape works best · JPG or PNG</span>
                </button>
              } @else {
                <div class="rounded-xl border-2 border-primary h-40 p-4 flex flex-col justify-end bg-white dark:bg-gray-900/40">
                  <div class="flex items-center justify-between gap-3">
                    <span class="flex items-center gap-1.5 min-w-0">
                      @if (isUploadingCover()) {
                        <span class="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-primary animate-spin shrink-0"></span>
                        <span class="text-sm font-bold text-eventText-mid dark:text-gray-300">Uploading…</span>
                      } @else {
                        <svg class="w-3.5 h-3.5 text-success shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span class="text-sm font-bold text-eventText-deep dark:text-white truncate">{{ coverPhotoFileName() }}</span>
                      }
                    </span>
                    <button type="button" (click)="coverInput.click()" class="text-sm font-bold text-primary hover:underline shrink-0">Replace</button>
                  </div>
                </div>
              }
              <input #coverInput type="file" accept="image/*" class="hidden" (change)="onCoverPhotoSelect($event)" />
            </div>

            <div>
              <label class="block text-2xs font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">How it will look in the feed</label>
              <div class="max-w-xs rounded-2xl border border-slate-100 dark:border-gray-700/80 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
                <div
                  class="relative h-[140px] p-3 flex flex-col justify-between bg-cover bg-center"
                  [style.background-image]="previewBackground()"
                >
                  <div class="flex items-start justify-between">
                    <div class="w-10 h-10 rounded-lg bg-white shadow flex flex-col items-center justify-center leading-none shrink-0">
                      <span class="text-[8px] font-extrabold uppercase text-eventText-soft">{{ previewMonthLabel() }}</span>
                      <span class="text-lg font-black text-eventText-deep">{{ previewDayLabel() }}</span>
                    </div>
                    <span
                      class="px-2.5 py-1 rounded-full border text-[10px] font-extrabold shrink-0"
                      [class.bg-eventTag-blueBg]="!isOnline()"
                      [class.border-eventTag-blueBorder]="!isOnline()"
                      [class.text-primary]="!isOnline()"
                      [class.bg-eventTag-purpleBg]="isOnline()"
                      [class.border-eventTag-purpleBorder]="isOnline()"
                      [class.text-eventTag-purpleText]="isOnline()"
                    >
                      {{ previewBadge() }}
                    </span>
                  </div>
                  <div>
                    <h3 class="text-sm font-extrabold text-white leading-tight [text-shadow:0_1px_8px_rgba(0,0,0,0.35)] truncate">{{ title() || 'Your event title' }}</h3>
                    <p class="text-[11px] font-semibold text-white/85 mt-0.5 [text-shadow:0_1px_8px_rgba(0,0,0,0.35)] truncate">{{ previewMetaLine() }}</p>
                  </div>
                </div>
                <div class="p-3 flex items-center justify-between gap-2">
                  <span class="text-xs font-extrabold" [class.text-success]="priceMode() === 'free'" [class.text-primary]="priceMode() === 'paid'">
                    {{ previewCostLabel() }}
                  </span>
                  <span class="text-[11px] font-bold text-eventText-mid dark:text-gray-300 whitespace-nowrap">
                    {{ previewSpotsLabel() }}
                  </span>
                </div>
              </div>
            </div>

            @if (error()) {
              <p class="text-xs font-bold text-danger">{{ error() }}</p>
            }
          }
        </div>

        <!-- Footer -->
        <div class="px-6 sm:px-8 py-4 border-t border-slate-100 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-700/20 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            @if (currentStep() > 1) {
              <button
                type="button"
                (click)="back()"
                class="h-9 px-4 rounded-lg text-xs font-bold border border-slate-200 dark:border-gray-700 text-eventText-mid dark:text-gray-300 hover:border-slate-300 transition-colors shrink-0"
              >
                Back
              </button>
            }
            <p class="text-xs font-medium" [class.text-success]="canContinue()" [class.text-eventText-soft]="!canContinue()">
              {{ canContinue() ? 'Looks good' : 'Fill the highlighted fields to continue' }}
            </p>
          </div>
          @if (currentStep() < 3) {
            <button
              type="button"
              [disabled]="!canContinue()"
              (click)="continue()"
              class="h-9 px-5 rounded-lg text-xs font-bold bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors shrink-0"
            >
              Continue
            </button>
          } @else {
            <button
              type="button"
              [disabled]="!canContinue() || isLoading()"
              (click)="publish()"
              class="h-9 px-5 rounded-lg text-xs font-bold bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors shrink-0"
            >
              {{ isLoading() ? 'Publishing…' : 'Publish event' }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityEventHostComponent {
  private readonly eventsService = inject(CommunityEventsService);
  private readonly postService = inject(CommunityPostService);
  private readonly router = inject(Router);

  readonly steps = STEPS;
  currentStep = signal<HostStep>(1);

  title = signal('');
  destination = signal('');
  category = signal<EventCategory | null>(null);
  private readonly categoryOrder: EventCategory[] = ['meetup', 'food', 'online'];
  @ViewChild('meetupBtn') private meetupBtnRef?: ElementRef<HTMLButtonElement>;
  @ViewChild('foodBtn') private foodBtnRef?: ElementRef<HTMLButtonElement>;
  @ViewChild('onlineBtn') private onlineBtnRef?: ElementRef<HTMLButtonElement>;

  date = signal('');
  time = signal('');
  duration = signal('');
  venue = signal('');
  meetingLink = signal('');
  meetingLinkTouched = signal(false);
  capacityMode = signal<CapacityMode>('open');
  capacityCount = signal('');
  priceMode = signal<PriceMode>('free');
  priceAmount = signal('');

  description = signal('');
  scheduleSteps = signal<string[]>([]);
  whatToBring = signal('');
  coverPhotoPreviewUrl = signal<string | null>(null);
  coverPhotoUrl = signal<string | null>(null);
  coverPhotoFileName = signal<string | null>(null);
  isUploadingCover = signal(false);

  isLoading = signal(false);
  error = signal<string | null>(null);

  readonly isOnline = computed(() => this.category() === 'online');
  readonly showMeetingLinkError = computed(() =>
    this.isOnline() && this.meetingLinkTouched() && this.meetingLink().trim().length === 0
  );
  readonly dateTimeSummary = computed(() => {
    if (!this.date().trim() || !this.time().trim() || !this.duration().trim()) return '';
    const parsed = new Date(`${this.date()}T${this.time()}`);
    if (isNaN(parsed.getTime())) return '';
    const dateLabel = parsed.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    return `${dateLabel} · ${this.time()} · ${this.duration().trim()}`;
  });
  private readonly resolvedLocation = computed(() => {
    if (this.isOnline()) return undefined;
    return this.venue().trim()
      ? `${this.venue().trim()}, ${this.destination().trim()}`
      : this.destination().trim() || undefined;
  });

  canContinue = computed(() => {
    switch (this.currentStep()) {
      case 1:
        return this.title().trim().length > 0 && !!this.category() && (this.isOnline() || this.destination().trim().length > 0);
      case 2:
        return this.date().trim().length > 0 && this.time().trim().length > 0 && this.duration().length > 0
          && (this.isOnline() ? this.meetingLink().trim().length > 0 : this.venue().trim().length > 0)
          && (this.capacityMode() === 'open' || this.capacityCount().trim().length > 0)
          && (this.priceMode() === 'free' || this.priceAmount().trim().length > 0);
      case 3:
        return this.description().trim().length > 0;
      default:
        return false;
    }
  });

  continue(): void {
    if (!this.canContinue()) return;
    this.currentStep.set((this.currentStep() + 1) as HostStep);
  }

  back(): void {
    this.currentStep.set((this.currentStep() - 1) as HostStep);
  }

  /** Standard ARIA radiogroup arrow-key behavior: moves selection and focus together. */
  onCategoryKeydown(event: KeyboardEvent, current: EventCategory): void {
    const order = this.categoryOrder;
    const currentIndex = order.indexOf(current);
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % order.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + order.length) % order.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = order.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const next = order[nextIndex];
    this.category.set(next);
    this.focusCategoryButton(next);
  }

  private focusCategoryButton(value: EventCategory): void {
    const refs: Record<EventCategory, ElementRef<HTMLButtonElement> | undefined> = {
      meetup: this.meetupBtnRef,
      food: this.foodBtnRef,
      online: this.onlineBtnRef,
    };
    refs[value]?.nativeElement.focus();
  }

  toggleCapacityMode(): void {
    this.capacityMode.set(this.capacityMode() === 'open' ? 'limited' : 'open');
  }

  togglePriceMode(): void {
    this.priceMode.set(this.priceMode() === 'free' ? 'paid' : 'free');
  }

  addScheduleStep(): void {
    this.scheduleSteps.update(steps => [...steps, '']);
  }

  updateScheduleStep(index: number, value: string): void {
    this.scheduleSteps.update(steps => steps.map((s, i) => (i === index ? value : s)));
  }

  removeScheduleStep(index: number): void {
    this.scheduleSteps.update(steps => steps.filter((_, i) => i !== index));
  }

  onCoverPhotoSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const previousUrl = this.coverPhotoPreviewUrl();
    if (previousUrl) URL.revokeObjectURL(previousUrl);

    this.coverPhotoPreviewUrl.set(URL.createObjectURL(file));
    this.coverPhotoFileName.set(file.name);
    this.coverPhotoUrl.set(null);
    this.isUploadingCover.set(true);
    this.postService.uploadImage(file).subscribe({
      next: (res) => {
        this.coverPhotoUrl.set(res.url);
        this.isUploadingCover.set(false);
      },
      error: () => {
        this.isUploadingCover.set(false);
      },
    });
    input.value = '';
  }

  previewBackground(): string {
    const overlay = 'linear-gradient(180deg, rgba(11,18,32,.05) 40%, rgba(11,18,32,.85) 100%)';
    const url = this.coverPhotoPreviewUrl();
    return url ? `${overlay}, url(${url})` : `linear-gradient(135deg, #0f172a, #1e1b4b)`;
  }

  private previewDate(): Date {
    const parsed = this.date() ? new Date(`${this.date()}T${this.time() || '00:00'}`) : null;
    return parsed && !isNaN(parsed.getTime()) ? parsed : new Date();
  }

  previewMonthLabel(): string {
    return this.previewDate().toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  }

  previewDayLabel(): string {
    return String(this.previewDate().getDate()).padStart(2, '0');
  }

  previewBadge(): string {
    if (this.category() === 'food') return 'Food';
    return this.isOnline() ? 'Online' : 'Meetup';
  }

  previewMetaLine(): string {
    const location = this.isOnline() ? 'Online' : (this.resolvedLocation() || 'Location TBD');
    return `${location} · ${this.time() || '--:--'}`;
  }

  previewCostLabel(): string {
    return this.priceMode() === 'free' ? 'Free' : (this.priceAmount().trim() || 'Paid');
  }

  previewSpotsLabel(): string {
    return this.capacityMode() === 'limited' && this.capacityCount().trim()
      ? `0 of ${this.capacityCount().trim()} spots filled`
      : '0 going';
  }

  publish(): void {
    if (!this.canContinue() || this.isLoading()) return;
    this.isLoading.set(true);
    this.error.set(null);

    const startsAt = new Date(`${this.date()}T${this.time()}`);
    const durationMinutes = parseDurationMinutes(this.duration());
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

    const meetingLink = this.isOnline() && this.meetingLink().trim() ? this.meetingLink().trim() : undefined;
    const capacity = this.capacityMode() === 'limited' && this.capacityCount().trim()
      ? parseInt(this.capacityCount().trim(), 10)
      : undefined;
    const steps = this.scheduleSteps().map(s => s.trim()).filter(Boolean);
    const schedule = steps.length ? steps.map(text => ({ time: '', text })) : undefined;
    const whatToBring = this.whatToBring().trim() || undefined;
    const cost = this.priceMode() === 'free' ? 'Free' : this.priceAmount().trim();

    this.eventsService.createEvent({
      title: this.title().trim(),
      description: this.description().trim(),
      location: this.resolvedLocation(),
      image_url: this.coverPhotoUrl() ?? undefined,
      cost,
      capacity: Number.isFinite(capacity) ? capacity : undefined,
      schedule,
      what_to_bring: whatToBring,
      category: this.category() ?? undefined,
      meeting_link: meetingLink,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    }).subscribe({
      next: (ev) => {
        this.isLoading.set(false);
        this.router.navigate(['/community/events', ev.id]);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(apiErrorMessage(err, "Couldn't publish this event. Please check the details and try again."));
      },
    });
  }
}
