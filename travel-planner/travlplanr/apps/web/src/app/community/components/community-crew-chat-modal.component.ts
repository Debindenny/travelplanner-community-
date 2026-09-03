import { Component, EventEmitter, Output, ViewChild, ElementRef, signal, computed, effect, inject, afterNextRender, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import {
  CrewMessage,
  ChatCircleContext,
  PARIS_CREW_CHAT_MOCK,
} from './community-crew-chat.mock';
import {
  CircleMember,
  TravelCircleCard,
  circleCtaLabel,
} from '../circles-trips/features/community-travelcircles/data/travel-circle-cards.data';
import { MOCK_OWNER } from '../circles-trips/core/data/community-mock-users';
import { ToastService } from '../../shared/utils/toast.service';
import { ProfileService } from '../../profile/profile.service';

/**
 * Crew group-chat preview. UI-only: every interaction below (poll votes, RSVPs,
 * settling an expense, adding a place, sending a message) mutates local
 * component state so the panel feels alive, but nothing is persisted or sent
 * anywhere. `PARIS_CREW_CHAT_MOCK` is the single source of its content —
 * swapping this component onto a real chat service means replacing that one
 * import and the `sendMessage`/quick-compose bodies; the template and layout
 * don't need to change.
 */
@Component({
  selector: 'app-community-crew-chat-modal',
  imports: [FormsModule, A11yModule, RouterLink],
  template: `
    <!-- Transparent click-catcher: closes the panel on an outside click without
         dimming the page behind it, since the panel docks beside the feed
         (not over it) rather than behaving like a centered dialog. -->
    <div
      class="font-manrope fixed inset-0 z-[89]"
      (click)="close.emit()"
      (window:keydown.escape)="onEscapeKey()"
    >
      <!-- resize (native CSS resize:both, drag handle bottom-right of the box) grows
           the panel toward the bottom-left: since it's anchored by top+right (not
           left/bottom), the browser only ever changes width/height, so the top-right
           corner — the panel's actual on-screen position — never moves. -->
      <div
        class="resize fixed top-24 right-6 z-[90] w-[420px] min-w-[320px] max-w-[min(760px,calc(100vw-3rem))] h-[min(700px,calc(100vh-7rem))] min-h-[360px] max-h-[calc(100vh-7rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-in-up"
        cdkTrapFocus
        cdkTrapFocusAutoCapture
        (click)="$event.stopPropagation()"
      >
      @if (discoveryMode()) {
      <!-- Travel Circles discovery — shown by the Travel Circles page's
           floating chatbot when the user hasn't joined a group yet, so the
           default "crew chat" never appears for a circle they aren't in.
           The joined-chat UI below is used when the circles list is empty
           (the Community Home crew widget and any circle's own chat). -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <span class="relative w-9 h-9 rounded-full bg-primary-50 text-primary flex items-center justify-center shrink-0">
          <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M23 21v-2a4 4 0 00-3-3.87" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 3.13a4 4 0 010 7.75" />
          </svg>
        </span>
        <div class="flex-1 min-w-0">
          <p class="text-[13.5px] font-bold text-text-primary truncate">Travel Circles</p>
          <p class="text-[11.5px] font-semibold text-text-faint truncate">Join a circle to start planning together</p>
        </div>
        <button
          type="button"
          (click)="close.emit()"
          class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-text-faint hover:text-text-primary hover:bg-slate-100 transition-colors focus:outline-none"
          aria-label="Close"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Circle list (one per card, reusing the shared TRAVEL_CIRCLE_CARDS
           source so this view and the Travel Circles page can't drift). -->
      <div class="flex-1 overflow-y-auto chat-scroll px-4 py-4 flex flex-col gap-3">
        @for (card of circles(); track card.id) {
          <div class="rounded-2xl border border-slate-200 p-3.5 flex flex-col gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <p class="text-[13.5px] font-bold text-text-primary truncate">{{ card.title }}</p>
              <span
                class="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                [class.bg-emerald-50]="card.visibility === 'Public'"
                [class.text-emerald-700]="card.visibility === 'Public'"
                [class.bg-violet-50]="card.visibility === 'Invite only'"
                [class.text-violet-700]="card.visibility === 'Invite only'"
              >{{ card.visibility }}</span>
            </div>
            <p class="text-[11.5px] font-semibold text-text-faint">{{ card.meta }}</p>
            <p class="text-[12.5px] text-text-secondary leading-relaxed">{{ card.description }}</p>
            <button
              type="button"
              (click)="onCircleAction(card)"
              class="self-start h-8 px-4 rounded-full text-[11.5px] font-bold transition-colors focus:outline-none"
              [class.bg-primary]="!isCircleMember(card) && !isCircleOwner(card)"
              [class.text-white]="!isCircleMember(card) && !isCircleOwner(card)"
              [class.bg-primary-50]="isCircleMember(card)"
              [class.text-primary]="isCircleMember(card)"
              [class.bg-slate-100]="isCircleOwner(card)"
              [class.text-text-faint]="isCircleOwner(card)"
            >{{ circleActionLabel(card) }}</button>
          </div>
        } @empty {
          <p class="text-center text-[12.5px] text-text-faint py-10 px-4 leading-relaxed">No travel circles available yet.<br />Create one from the Travel Circles page to get started.</p>
        }
      </div>
      } @else {
      <!-- Header -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <span class="relative w-9 h-9 rounded-full bg-primary-50 text-primary flex items-center justify-center shrink-0">
          <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 20l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
          <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"></span>
        </span>
        <div class="relative flex-1 min-w-0">
          <button
            type="button"
            (click)="toggleCircleMenu()"
            [class.cursor-default]="!hasCircleMenu()"
            class="max-w-full flex items-center gap-1 text-left focus:outline-none"
          >
            <span class="text-[13.5px] font-bold text-text-primary truncate">{{ activeCircle().title }} · {{ activeCircle().dateRange }}</span>
            @if (hasCircleMenu()) {
              <svg
                class="shrink-0 w-3.5 h-3.5 text-text-faint transition-transform duration-200"
                [class.rotate-180]="circleMenuOpen()"
                fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            }
          </button>
          <p class="text-[11.5px] font-semibold text-emerald-600">{{ activeCircle().onlineCount }} online now</p>

          @if (hasCircleMenu() && circleMenuOpen()) {
            <div class="absolute left-0 top-full mt-2 z-10 w-56 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 animate-fade-in-up">
              <p class="px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">Your circles</p>
              @for (circle of joinedCircles(); track circle.id) {
                <button
                  type="button"
                  (click)="selectCircle(circle)"
                  class="w-full flex items-center justify-between px-3 py-2 text-[12.5px] font-semibold text-text-primary hover:bg-slate-50 transition-colors focus:outline-none"
                >
                  <span class="truncate">{{ circle.title }}</span>
                  @if (circle.id === activeCircle().id) {
                    <svg class="shrink-0 w-4 h-4 text-primary" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  }
                </button>
              }
            </div>
          }
        </div>
        <button
          type="button"
          (click)="onExitGroup()"
          class="shrink-0 h-8 px-3 rounded-lg border border-slate-200 text-[11.5px] font-bold text-text-secondary flex items-center gap-1.5 hover:border-red-500 hover:text-red-500 hover:bg-red-50 active:scale-[0.98] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:border-red-500"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 5v1a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Exit group
        </button>
        <button
          type="button"
          (click)="close.emit()"
          class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-text-faint hover:text-text-primary hover:bg-slate-100 transition-colors focus:outline-none"
          aria-label="Close"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Member count / expiry -->
      <div class="flex items-center justify-between px-4 py-2 border-b border-slate-100">
        <p class="text-[11.5px] font-semibold text-text-faint">{{ activeCircle().memberCount }} members · {{ activeCircle().onlineCount }} online now</p>
        <span class="text-[10.5px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 whitespace-nowrap">
          Ends in {{ activeCircle().endsInDays }}d
        </span>
      </div>

      <!-- Chat / People tabs -->
      <div class="flex items-center gap-1 px-4 py-2 border-b border-slate-100">
        <button
          type="button"
          (click)="activeTab.set('chat')"
          class="flex-1 h-9 rounded-lg text-[12.5px] font-bold transition-colors focus:outline-none"
          [class.bg-primary-50]="activeTab() === 'chat'"
          [class.text-primary]="activeTab() === 'chat'"
          [class.text-text-faint]="activeTab() !== 'chat'"
        >
          Chat
        </button>
        <button
          type="button"
          (click)="activeTab.set('people')"
          class="flex-1 h-9 rounded-lg text-[12.5px] font-bold transition-colors focus:outline-none"
          [class.bg-primary-50]="activeTab() === 'people'"
          [class.text-primary]="activeTab() === 'people'"
          [class.text-text-faint]="activeTab() !== 'people'"
        >
          People
        </button>
      </div>

      @if (activeTab() === 'chat') {
      <!-- Scrollable message feed -->
      <div class="flex-1 overflow-y-auto chat-scroll px-4 py-4 flex flex-col gap-4">
        @for (msg of activeMessages(); track msg.id; let i = $index) {
          @if (isSelfMessage(msg)) {
          <div class="flex flex-col items-end gap-1.5">
            @switch (msg.kind) {
              @case ('text') {
                <div class="bg-primary text-white rounded-2xl px-4 py-2.5 max-w-[85%]">
                  <p class="text-[13px] leading-relaxed">{{ msg.text }}</p>
                </div>
              }
              @case ('expense') {
                <div class="bg-white border border-slate-200 rounded-2xl p-3.5 w-72 flex items-center gap-2.5">
                  <span class="w-9 h-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6M9 8h6M6 3h12a1 1 0 011 1v16l-3-2-3 2-3-2-3 2-3-2-3 2V4a1 1 0 011-1z" />
                    </svg>
                  </span>
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-bold text-text-primary truncate">{{ msg.title }} \u00b7 \u20ac{{ msg.totalAmount }}</p>
                    <p class="text-[11.5px] font-semibold text-text-faint truncate">{{ msg.meta }}</p>
                  </div>
                  <button
                    type="button"
                    (click)="settleExpense(msg.id)"
                    class="shrink-0 h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors focus:outline-none"
                    [class.bg-emerald-500]="!settledExpenses().has(msg.id)"
                    [class.text-white]="!settledExpenses().has(msg.id)"
                    [class.bg-emerald-100]="settledExpenses().has(msg.id)"
                    [class.text-emerald-700]="settledExpenses().has(msg.id)"
                  >
                    {{ settledExpenses().has(msg.id) ? 'Settled' : 'Settle' }}
                  </button>
                </div>
              }
              @case ('place') {
                <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden w-72">
                  <div class="w-full h-32 bg-slate-100">
                    <img [src]="msg.image" class="w-full h-full object-cover" alt="" (error)="onImageError($event)" />
                  </div>
                  <div class="p-3.5 flex flex-col gap-2">
                    <div>
                      <p class="text-[13px] font-bold text-text-primary">{{ msg.title }}</p>
                      <p class="text-[11.5px] font-semibold text-text-faint mt-0.5">{{ msg.meta }}</p>
                    </div>
                    <button
                      type="button"
                      (click)="addPlaceToTrip(msg.id)"
                      class="w-full h-9 rounded-lg text-[12px] font-semibold transition-colors focus:outline-none"
                      [class.bg-primary-50]="!addedPlaces().has(msg.id)"
                      [class.text-primary]="!addedPlaces().has(msg.id)"
                      [class.bg-slate-100]="addedPlaces().has(msg.id)"
                      [class.text-text-faint]="addedPlaces().has(msg.id)"
                    >
                      {{ addedPlaces().has(msg.id) ? 'Added' : msg.ctaLabel }}
                    </button>
                  </div>
                </div>
              }
              @case ('poll') {
                <div class="bg-white border border-slate-200 rounded-2xl p-3.5 w-72 flex flex-col gap-2">
                  <p class="text-[13px] font-bold text-text-primary">{{ msg.question }}</p>
                  @for (opt of msg.options; track opt) {
                    <button
                      type="button"
                      (click)="votePoll(msg.id, opt)"
                      class="w-full text-left px-3.5 py-2.5 rounded-xl border text-[12.5px] font-semibold transition-colors focus:outline-none"
                      [class.border-primary]="pollVotes()[msg.id] === opt"
                      [class.bg-primary-50]="pollVotes()[msg.id] === opt"
                      [class.text-primary]="pollVotes()[msg.id] === opt"
                      [class.border-slate-200]="pollVotes()[msg.id] !== opt"
                      [class.text-text-secondary]="pollVotes()[msg.id] !== opt"
                    >
                      {{ opt }}
                    </button>
                  }
                </div>
              }
              @case ('meetup') {
                <div class="bg-white border border-slate-200 rounded-2xl p-3.5 w-72 flex flex-col gap-3">
                  <div class="flex items-center gap-2.5">
                    <span class="w-9 h-9 rounded-lg bg-primary-50 text-primary flex items-center justify-center shrink-0">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 2v4M16 2v4M3 10h18M21 14V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h7m4-2l2 2 4-4" />
                      </svg>
                    </span>
                    <div class="min-w-0">
                      <p class="text-[13px] font-bold text-text-primary truncate">{{ msg.title }}</p>
                      <p class="text-[11.5px] font-semibold text-text-faint truncate">{{ msg.meta }}</p>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      (click)="rsvpMeetup(msg.id, 'in')"
                      class="flex-1 h-9 rounded-lg text-[12px] font-semibold transition-colors focus:outline-none"
                      [class.bg-primary]="meetupRsvp()[msg.id] !== 'out'"
                      [class.text-white]="meetupRsvp()[msg.id] !== 'out'"
                      [class.bg-slate-100]="meetupRsvp()[msg.id] === 'out'"
                      [class.text-text-secondary]="meetupRsvp()[msg.id] === 'out'"
                    >
                      I'm in
                    </button>
                    <button
                      type="button"
                      (click)="rsvpMeetup(msg.id, 'out')"
                      class="flex-1 h-9 rounded-lg border text-[12px] font-semibold transition-colors focus:outline-none"
                      [class.border-primary]="meetupRsvp()[msg.id] === 'out'"
                      [class.text-primary]="meetupRsvp()[msg.id] === 'out'"
                      [class.border-slate-200]="meetupRsvp()[msg.id] !== 'out'"
                      [class.text-text-secondary]="meetupRsvp()[msg.id] !== 'out'"
                    >
                      Can't make it
                    </button>
                  </div>
                </div>
              }
              @default {}
            }
            @if (showTime(activeMessages(), i)) {
              <p class="text-[10.5px] font-semibold text-text-faint">{{ msg.time }}</p>
            }
          </div>
          } @else {
          <div class="flex flex-col items-start gap-1.5">
            <a class="text-[11.5px] font-bold text-text-faint hover:text-primary hover:underline" [routerLink]="['/community/users', msg.customer_id]">{{ msg.author }}</a>

            @switch (msg.kind) {
              @case ('text') {
                <div class="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 max-w-[85%]">
                  <p class="text-[13px] text-text-primary leading-relaxed">{{ msg.text }}</p>
                </div>
              }
              @case ('poll') {
                <div class="bg-white border border-slate-200 rounded-2xl p-3.5 w-72 flex flex-col gap-2">
                  <p class="text-[13px] font-bold text-text-primary">{{ msg.question }}</p>
                  @for (opt of msg.options; track opt) {
                    <button
                      type="button"
                      (click)="votePoll(msg.id, opt)"
                      class="w-full text-left px-3.5 py-2.5 rounded-xl border text-[12.5px] font-semibold transition-colors focus:outline-none"
                      [class.border-primary]="pollVotes()[msg.id] === opt"
                      [class.bg-primary-50]="pollVotes()[msg.id] === opt"
                      [class.text-primary]="pollVotes()[msg.id] === opt"
                      [class.border-slate-200]="pollVotes()[msg.id] !== opt"
                      [class.text-text-secondary]="pollVotes()[msg.id] !== opt"
                    >
                      {{ opt }}
                    </button>
                  }
                </div>
              }
              @case ('meetup') {
                <div class="bg-white border border-slate-200 rounded-2xl p-3.5 w-72 flex flex-col gap-3">
                  <div class="flex items-center gap-2.5">
                    <span class="w-9 h-9 rounded-lg bg-primary-50 text-primary flex items-center justify-center shrink-0">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 2v4M16 2v4M3 10h18M21 14V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h7m4-2l2 2 4-4" />
                      </svg>
                    </span>
                    <div class="min-w-0">
                      <p class="text-[13px] font-bold text-text-primary truncate">{{ msg.title }}</p>
                      <p class="text-[11.5px] font-semibold text-text-faint truncate">{{ msg.meta }}</p>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      (click)="rsvpMeetup(msg.id, 'in')"
                      class="flex-1 h-9 rounded-lg text-[12px] font-semibold transition-colors focus:outline-none"
                      [class.bg-primary]="meetupRsvp()[msg.id] !== 'out'"
                      [class.text-white]="meetupRsvp()[msg.id] !== 'out'"
                      [class.bg-slate-100]="meetupRsvp()[msg.id] === 'out'"
                      [class.text-text-secondary]="meetupRsvp()[msg.id] === 'out'"
                    >
                      I'm in
                    </button>
                    <button
                      type="button"
                      (click)="rsvpMeetup(msg.id, 'out')"
                      class="flex-1 h-9 rounded-lg border text-[12px] font-semibold transition-colors focus:outline-none"
                      [class.border-primary]="meetupRsvp()[msg.id] === 'out'"
                      [class.text-primary]="meetupRsvp()[msg.id] === 'out'"
                      [class.border-slate-200]="meetupRsvp()[msg.id] !== 'out'"
                      [class.text-text-secondary]="meetupRsvp()[msg.id] !== 'out'"
                    >
                      Can't make it
                    </button>
                  </div>
                </div>
              }
              @case ('expense') {
                <div class="bg-white border border-slate-200 rounded-2xl p-3.5 w-72 flex items-center gap-2.5">
                  <span class="w-9 h-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6M9 8h6M6 3h12a1 1 0 011 1v16l-3-2-3 2-3-2-3 2-3-2-3 2V4a1 1 0 011-1z" />
                    </svg>
                  </span>
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-bold text-text-primary truncate">{{ msg.title }} \u00b7 \u20ac{{ msg.totalAmount }}</p>
                    <p class="text-[11.5px] font-semibold text-text-faint truncate">{{ msg.meta }}</p>
                  </div>
                  <button
                    type="button"
                    (click)="settleExpense(msg.id)"
                    class="shrink-0 h-8 px-3 rounded-lg border text-[12px] font-semibold transition-colors focus:outline-none"
                    [class.border-emerald-500]="!settledExpenses().has(msg.id)"
                    [class.text-emerald-600]="!settledExpenses().has(msg.id)"
                    [class.bg-emerald-100]="settledExpenses().has(msg.id)"
                    [class.text-emerald-700]="settledExpenses().has(msg.id)"
                    [class.border-emerald-200]="settledExpenses().has(msg.id)"
                  >
                    {{ settledExpenses().has(msg.id) ? 'Settled' : 'Settle' }}
                  </button>
                </div>
              }
              @case ('place') {
                <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden w-72">
                  <div class="w-full h-32 bg-slate-100">
                    <img [src]="msg.image" class="w-full h-full object-cover" alt="" (error)="onImageError($event)" />
                  </div>
                  <div class="p-3.5 flex flex-col gap-2">
                    <div>
                      <p class="text-[13px] font-bold text-text-primary">{{ msg.title }}</p>
                      <p class="text-[11.5px] font-semibold text-text-faint mt-0.5">{{ msg.meta }}</p>
                    </div>
                    <button
                      type="button"
                      (click)="addPlaceToTrip(msg.id)"
                      class="w-full h-9 rounded-lg text-[12px] font-semibold transition-colors focus:outline-none"
                      [class.bg-primary-50]="!addedPlaces().has(msg.id)"
                      [class.text-primary]="!addedPlaces().has(msg.id)"
                      [class.bg-slate-100]="addedPlaces().has(msg.id)"
                      [class.text-text-faint]="addedPlaces().has(msg.id)"
                    >
                      {{ addedPlaces().has(msg.id) ? 'Added' : msg.ctaLabel }}
                    </button>
                  </div>
                </div>
              }
            }
            @if (showTime(activeMessages(), i)) {
              <p class="text-[10.5px] font-semibold text-text-faint">{{ msg.time }}</p>
            }
          </div>
          }
        }
      </div>
      } @else {
      <!-- People / members list -->
      <div class="flex-1 overflow-y-auto chat-scroll px-4">
        @for (member of activeMembers(); track member.name) {
          <div class="flex items-center justify-between py-2.5">
            <div class="min-w-0 pr-3">
              <a class="text-[13px] font-bold text-text-primary truncate leading-snug hover:text-primary hover:underline" [routerLink]="['/community/users', member.customer_id]">{{ member.name }}</a>
              <p class="text-[11.5px] font-medium text-text-faint truncate mt-0.5">{{ memberSub(member) }}</p>
            </div>
            @if (isCurrentUser(member.name)) {
              <span class="shrink-0 w-[88px] h-9 rounded-[12px] bg-slate-100 text-text-faint text-sm font-semibold flex items-center justify-center">You</span>
            } @else {
              <button
                type="button"
                (click)="toggleFollow(member.name)"
                class="shrink-0 w-[88px] h-9 rounded-[12px] border border-[#D7DDE8] bg-white text-sm font-semibold text-[#4A5A70] flex items-center justify-center hover:border-[#c5cede] hover:bg-slate-50 active:scale-[0.98] transition-colors focus:outline-none"
              >
                {{ activeFollowingIds().has(member.name) ? 'Unfollow' : 'Follow' }}
              </button>
            }
          </div>
        }
      </div>
      }

      @if (activeTab() === 'chat') {
      <!-- Quick-compose shortcuts + message input -->
      <div class="border-t border-slate-100 px-4 py-3 flex flex-col gap-3">
        <div class="flex items-stretch gap-3">
          <button
            type="button"
            (click)="sendPlace()"
            class="flex-1 h-12 rounded-2xl border border-slate-200 flex items-center justify-center text-text-secondary hover:border-slate-300 hover:bg-slate-50 transition-colors focus:outline-none"
            aria-label="Share a place"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z" />
            </svg>
          </button>
          <button
            type="button"
            (click)="sendPoll()"
            class="flex-1 h-12 rounded-2xl border border-slate-200 flex items-center justify-center text-text-secondary hover:border-slate-300 hover:bg-slate-50 transition-colors focus:outline-none"
            aria-label="Start a poll"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 20V10m4 10V4m4 16v-7" />
            </svg>
          </button>
          <button
            type="button"
            (click)="sendMeetup()"
            class="flex-1 h-12 rounded-2xl border border-slate-200 flex items-center justify-center text-text-secondary hover:border-slate-300 hover:bg-slate-50 transition-colors focus:outline-none"
            aria-label="Plan a meetup"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 2v4M16 2v4M3 10h18M21 14V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h7m4-2l2 2 4-4" />
            </svg>
          </button>
          <button
            type="button"
            (click)="sendExpense()"
            class="flex-1 h-12 rounded-2xl border border-slate-200 flex items-center justify-center text-text-secondary hover:border-slate-300 hover:bg-slate-50 transition-colors focus:outline-none"
            aria-label="Split an expense"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6M9 8h6M6 3h12a1 1 0 011 1v16l-3-2-3 2-3-2-3 2-3-2-3 2V4a1 1 0 011-1z" />
            </svg>
          </button>
        </div>
        <div class="flex items-center gap-2">
          <input
            #draftInput
            type="text"
            [(ngModel)]="draft"
            (keydown.enter)="sendMessage()"
            placeholder="Message the crew…"
            class="flex-1 h-11 rounded-full border border-slate-200 px-4 text-[13px] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-primary transition-colors"
          />
          <button
            type="button"
            (click)="sendMessage()"
            [disabled]="draft.trim().length === 0"
            class="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors focus:outline-none disabled:cursor-not-allowed"
            [class.bg-primary]="draft.trim().length > 0"
            [class.text-white]="draft.trim().length > 0"
            [class.bg-slate-100]="draft.trim().length === 0"
            [class.text-text-faint]="draft.trim().length === 0"
            aria-label="Send message"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
      }
      }
      </div>

      <!-- Split Expense Modal Overlay -->
      @if (showExpenseModal()) {
        <div
          class="fixed inset-0 z-[91] bg-black/30 flex items-center justify-center p-4"
          (click)="closeExpenseModal(); $event.stopPropagation()"
        >
          <div
            class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-fade-in-up"
            (click)="$event.stopPropagation()"
          >
            <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 class="text-[15px] font-bold text-text-primary">Split Expense</h3>
              <button
                type="button"
                (click)="closeExpenseModal()"
                class="w-8 h-8 rounded-full flex items-center justify-center text-text-faint hover:text-text-primary hover:bg-slate-100 transition-colors focus:outline-none"
                aria-label="Close"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="px-5 py-4 flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-[12px] font-bold text-text-faint uppercase tracking-wide">Expense Title</label>
                <input
                  type="text"
                  [value]="expenseTitle()"
                  (input)="expenseTitle.set($any($event.target).value)"
                  placeholder="e.g. Taxi from CDG"
                  class="h-10 rounded-xl border border-slate-200 px-3 text-[13px] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-[12px] font-bold text-text-faint uppercase tracking-wide">Total Amount</label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-text-faint">€</span>
                  <input
                    type="text"
                    [value]="expenseAmount()"
                    (input)="expenseAmount.set($any($event.target).value)"
                    placeholder="0.00"
                    class="h-10 w-full rounded-xl border border-slate-200 pl-7 pr-3 text-[13px] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-[12px] font-bold text-text-faint uppercase tracking-wide">Participants</label>
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    (click)="decrementPeople()"
                    class="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-text-secondary hover:border-slate-300 hover:bg-slate-50 transition-colors focus:outline-none text-lg font-bold"
                  >−</button>
                  <span class="text-[15px] font-bold text-text-primary w-8 text-center">{{ expensePeople() }}</span>
                  <button
                    type="button"
                    (click)="incrementPeople()"
                    class="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-text-secondary hover:border-slate-300 hover:bg-slate-50 transition-colors focus:outline-none text-lg font-bold"
                  >+</button>
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-[12px] font-bold text-text-faint uppercase tracking-wide">Split Type</label>
                <div class="h-10 rounded-xl border border-slate-200 px-3 flex items-center text-[13px] font-semibold text-text-secondary bg-slate-50">
                  Equal split
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-[12px] font-bold text-text-faint uppercase tracking-wide">Notes <span class="font-normal">(optional)</span></label>
                <input
                  type="text"
                  [value]="expenseNotes()"
                  (input)="expenseNotes.set($any($event.target).value)"
                  placeholder="Any additional details..."
                  class="h-10 rounded-xl border border-slate-200 px-3 text-[13px] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div class="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                (click)="closeExpenseModal()"
                class="flex-1 h-10 rounded-xl border border-slate-200 text-[13px] font-bold text-text-secondary hover:bg-slate-50 transition-colors focus:outline-none"
              >Cancel</button>
              <button
                type="button"
                (click)="createExpense()"
                [disabled]="!expenseTitle().trim() || !expenseAmount().trim()"
                class="flex-1 h-10 rounded-xl text-[13px] font-bold text-white transition-colors focus:outline-none disabled:cursor-not-allowed"
                [class.bg-emerald-500]="expenseTitle().trim() && expenseAmount().trim()"
                [class.hover:bg-emerald-600]="expenseTitle().trim() && expenseAmount().trim()"
                [class.bg-slate-200]="!expenseTitle().trim() || !expenseAmount().trim()"
                [class.text-text-faint]="!expenseTitle().trim() || !expenseAmount().trim()"
              >Create Expense</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .chat-scroll { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
    .chat-scroll::-webkit-scrollbar { width: 6px; }
    .chat-scroll::-webkit-scrollbar-track { background: transparent; }
    .chat-scroll::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 9999px; }
    .chat-scroll::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
  `],
})
export class CommunityCrewChatModalComponent {
  @Output() close = new EventEmitter<void>();
  /** Emitted when the current user exits the active circle/group, carrying the
   * exited circle's id (empty for the standalone crew chat). */
  @Output() exitedGroup = new EventEmitter<string>();
  /** Emitted when the user clicks a circle's Join / Request to join button in
   * the Travel Circles discovery view (rendered only when `circles` is set). */
  @Output() circleAction = new EventEmitter<TravelCircleCard>();

  @ViewChild('draftInput') draftInputRef?: ElementRef<HTMLInputElement>;

  private readonly toast = inject(ToastService);
  private readonly hostRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly document = inject(DOCUMENT);

  readonly chat = PARIS_CREW_CHAT_MOCK;
  readonly groupName = input<string>(this.chat.groupName);
  readonly messages = signal<CrewMessage[]>(this.chat.messages);

  readonly members = input<CircleMember[]>([]);
  readonly currentUserName = input<string>('');

  /** Joined circles the current user belongs to, used to power the header's
   * circle dropdown selector. When empty the modal falls back to the single
   * `groupName` / `members` chat. Each entry carries its own members, counts
   * and messages so selecting a circle swaps the Chat and People tab data. */
  readonly joinedCircles = input<ChatCircleContext[]>([]);
  /** Circle id to preselect on open, when `joinedCircles` is provided. */
  readonly initialCircleId = input<string>('');

  /** Travel Circles discovery mode: when a non-empty circle list is provided
   * the modal lists those circles instead of rendering a crew chat. The
   * Travel Circles page uses this from its floating chatbot until the user
   * has joined a group, so the default "Paris Crew" chat is never shown to a
   * non-member. The Community Home crew widget omits this input, keeping the
   * chat-only behaviour unchanged. */
  readonly circles = input<TravelCircleCard[]>([]);
  /** Circle ids the current user belongs to, so discovery buttons can show
   * the Joined / Requested / You created it states live. */
  readonly memberIds = input<ReadonlySet<string>>(new Set());
  readonly activeTab = signal<'chat' | 'people'>('chat');
  readonly followingIds = signal<Set<string>>(new Set());

  /** Selected circle id + dropdown open state for the circle selector. */
  readonly selectedCircleId = signal<string>('');
  readonly circleMenuOpen = signal(false);

  /** Per-circle messages so sending a message only mutates the active circle's
   * feed (falling back to each context's seeded messages). */
  readonly messagesByCircle = signal<Record<string, CrewMessage[]>>({});
  /** Per-circle People "following" state, so it never leaks across circles. */
  readonly followingByCircle = signal<Record<string, Set<string>>>({});

  draft = '';

  readonly pollVotes = signal<Record<string, string>>({});
  readonly meetupRsvp = signal<Record<string, 'in' | 'out'>>({});
  readonly settledExpenses = signal<Set<string>>(new Set());
  readonly addedPlaces = signal<Set<string>>(new Set());

  readonly showExpenseModal = signal(false);
  readonly expenseTitle = signal('');
  readonly expenseAmount = signal('');
  readonly expensePeople = signal(2);
  readonly expenseNotes = signal('');

  /** The chat context currently displayed. When `joinedCircles` is provided
   * this is the selected circle; otherwise it's the single-circle fallback
   * built from the `groupName` / `members` inputs + shared wireframe mock. */
  readonly activeCircle = computed<ChatCircleContext>(() => {
    const list = this.joinedCircles();
    if (list.length > 0) {
      const selected = list.find(c => c.id === this.selectedCircleId());
      return selected ?? list[0];
    }
    return {
      id: '__default__',
      title: this.groupName(),
      dateRange: this.chat.dateRange,
      memberCount: this.chat.memberCount,
      onlineCount: this.chat.onlineCount,
      endsInDays: this.chat.endsInDays,
      members: this.members(),
      messages: this.messages(),
    };
  });

  /** Active circle's members for the People tab. */
  readonly activeMembers = computed<CircleMember[]>(() => this.activeCircle().members);

  /** Active circle's message feed, honouring locally-sent messages. */
  readonly activeMessages = computed<CrewMessage[]>(() =>
    this.messagesByCircle()[this.activeCircle().id] ?? this.activeCircle().messages,
  );

  /** Active circle's People "following" set. */
  readonly activeFollowingIds = computed<Set<string>>(
    () => this.followingByCircle()[this.activeCircle().id] ?? new Set<string>(),
  );

  /** Whether the circle dropdown selector should render (only when the user
   * belongs to more than one circle). */
  readonly hasCircleMenu = computed<boolean>(() => this.joinedCircles().length > 1);

  constructor() {
    /* This modal is only ever opened from the Crew widget, which sits inside
       the community page's sticky right rail (`position: sticky`) — that,
       despite z-index:auto, creates its own stacking context in real
       browsers, trapping this modal's fixed/z-[90] panel locally so it no
       longer outranks unrelated page chrome painted outside that rail (e.g.
       the sticky header). Reparenting the host to <body> once rendered
       escapes that trap; the template is plain Tailwind utility classes with
       no dependency on inherited CSS custom properties, so it's safe to move
       as-is. */
    afterNextRender(() => {
      const host = this.hostRef.nativeElement;
      if (host.parentElement !== this.document.body) {
        this.document.body.appendChild(host);
      }
    });
    /* Preselect the requested (or first) joined circle once circles are known,
     * and keep the selection alive while the popup stays open. */
    effect(() => {
      const list = this.joinedCircles();
      if (list.length === 0) {
        this.selectedCircleId.set('');
        return;
      }
      const current = this.selectedCircleId();
      const stillExists = current && list.some(c => c.id === current);
      if (!stillExists) {
        const requested = this.initialCircleId();
        this.selectedCircleId.set(
          list.some(c => c.id === requested) ? requested : list[0].id,
        );
      }
    });
  }

  votePoll(messageId: string, option: string): void {
    this.pollVotes.update(votes => ({ ...votes, [messageId]: option }));
  }

  rsvpMeetup(messageId: string, status: 'in' | 'out'): void {
    this.meetupRsvp.update(rsvps => ({ ...rsvps, [messageId]: status }));
  }

  settleExpense(messageId: string): void {
    this.settledExpenses.update(set => new Set(set).add(messageId));
  }

  addPlaceToTrip(messageId: string): void {
    this.addedPlaces.update(set => new Set(set).add(messageId));
  }

  /** Hides a place-card photo that failed to load, leaving its slate-100
   * background visible instead of the browser's broken-image icon. */
  onImageError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  quickCompose(prefix: string): void {
    this.draft = this.draft ? `${this.draft} ${prefix} ` : `${prefix} `;
    this.draftInputRef?.nativeElement.focus();
  }

  sendMessage(): void {
    const text = this.draft.trim();
    if (!text) return;
    this.pushMessage({
      id: `local-${Date.now()}`,
      author: this.currentUserName() || 'You',
      customer_id: MOCK_OWNER.customerId,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      kind: 'text',
      text,
    });
    this.draft = '';
  }

  /** Appends a message to the active circle's feed (or the single-circle
   * fallback signal when no `joinedCircles` are set), mirroring the fallback
   * chain `activeMessages` reads from. */
  private pushMessage(message: CrewMessage): void {
    if (this.joinedCircles().length === 0) {
      this.messages.update(list => [...list, message]);
      return;
    }
    const circleId = this.activeCircle().id;
    this.messagesByCircle.update(map => ({
      ...map,
      [circleId]: [...(map[circleId] ?? this.activeCircle().messages), message],
    }));
  }

  /** Whether `msg` was sent by the current (demo) user, so it renders on the
   * right of the feed instead of the left. */
  isSelfMessage(msg: CrewMessage): boolean {
    return msg.customer_id === MOCK_OWNER.customerId;
  }

  /** Timestamps render only at the end of a consecutive run of messages from
   * the same author, not under every bubble. */
  showTime(messages: CrewMessage[], index: number): boolean {
    const next = messages[index + 1];
    return !next || next.author !== messages[index].author;
  }

  sendPlace(): void {
    this.pushMessage({
      id: `local-${Date.now()}`,
      author: this.currentUserName() || 'You',
      customer_id: MOCK_OWNER.customerId,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      kind: 'place',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80',
      title: 'Shared a place',
      meta: 'Tap to view details',
      ctaLabel: 'Add to my trip',
    });
  }

  sendPoll(): void {
    this.pushMessage({
      id: `local-${Date.now()}`,
      author: this.currentUserName() || 'You',
      customer_id: MOCK_OWNER.customerId,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      kind: 'poll',
      question: 'New poll — what do you think?',
      options: ['Yes', 'No', 'Maybe'],
    });
  }

  sendMeetup(): void {
    this.pushMessage({
      id: `local-${Date.now()}`,
      author: this.currentUserName() || 'You',
      customer_id: MOCK_OWNER.customerId,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      kind: 'meetup',
      title: 'New meetup',
      meta: 'Today · TBD',
    });
  }

  sendExpense(): void {
    this.showExpenseModal.set(true);
  }

  closeExpenseModal(): void {
    this.showExpenseModal.set(false);
    this.expenseTitle.set('');
    this.expenseAmount.set('');
    this.expensePeople.set(2);
    this.expenseNotes.set('');
  }

  decrementPeople(): void {
    this.expensePeople.update(n => Math.max(1, n - 1));
  }

  incrementPeople(): void {
    this.expensePeople.update(n => n + 1);
  }

  createExpense(): void {
    const title = this.expenseTitle().trim();
    const amountStr = this.expenseAmount().trim();
    if (!title || !amountStr) return;
    const totalAmount = Number(amountStr) || 0;
    const participantCount = this.expensePeople();
    const perPerson = (totalAmount / participantCount).toFixed(2);
    const notes = this.expenseNotes().trim();
    this.pushMessage({
      id: `local-${Date.now()}`,
      author: this.currentUserName() || 'You',
      customer_id: MOCK_OWNER.customerId,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      kind: 'expense',
      title,
      meta: notes
        ? `€${perPerson} each · ${participantCount} people · ${notes}`
        : `€${perPerson} each · ${participantCount} people`,
      totalAmount,
      participantCount,
      splitType: 'equal',
    });
    this.closeExpenseModal();
  }

  memberSub(member: CircleMember): string {
    const route = member.route ?? member.location;
    return member.dates ? `${route} · ${member.dates}` : route;
  }

  toggleCircleMenu(): void {
    this.circleMenuOpen.update(v => !v);
  }

  selectCircle(circle: ChatCircleContext): void {
    this.selectedCircleId.set(circle.id);
    this.circleMenuOpen.set(false);
  }

  isCurrentUser(name: string): boolean {
    return name === this.currentUserName();
  }

  toggleFollow(name: string): void {
    const circleId = this.activeCircle().id;
    const current = this.followingByCircle()[circleId] ?? new Set<string>();
    const next = new Set(current);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    this.followingIds.set(next);
    this.toast.success(next.has(name) ? `Followed ${name}` : `Unfollowed ${name}`);
  }

  

  onExitGroup(): void {
    this.exitedGroup.emit(this.activeCircle().id);
    this.close.emit();
  }

  onEscapeKey(): void {
    if (this.showExpenseModal()) {
      this.closeExpenseModal();
    } else {
      this.close.emit();
    }
  }

  discoveryMode(): boolean {
    return this.circles().length > 0;
  }

  isCircleMember(card: TravelCircleCard): boolean {
    return this.memberIds().has(card.id);
  }

  isCircleOwner(card: TravelCircleCard): boolean {
    return card.initialStatus === 'owner';
  }

  circleActionLabel(card: TravelCircleCard): string {
    return circleCtaLabel(card, this.isCircleMember(card));
  }

  onCircleAction(card: TravelCircleCard): void {
    this.circleAction.emit(card);
  }
}
