import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommunityEventsMockStore } from '../services/community-events-mock.store';
import { CommunityEventCard } from '../services/community-event-view.model';
import { BookingSelection, BookingSummary, buildBookingSummary } from '../services/community-event-booking.util';

@Component({
  selector: 'app-community-event-review',
  imports: [CommonModule, RouterLink],
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
        <!-- Breadcrumb -->
        <nav class="w-full bg-slate-50 dark:bg-gray-900 border-b border-slate-100 dark:border-gray-800 flex items-center gap-2 text-xs font-semibold text-eventText-soft dark:text-gray-400 flex-wrap">
          <div class="page-container w-full px-5 xl:px-20 py-3 flex items-center gap-2 flex-wrap">
            <a routerLink="/community" class="hover:text-primary transition-colors">Community</a>
            <span class="text-slate-300 dark:text-gray-600">/</span>
            <a routerLink="/community/events" class="hover:text-primary transition-colors">Hosted Journeys</a>
            <span class="text-slate-300 dark:text-gray-600">/</span>
            <a [routerLink]="['/community/events', event.id, 'summary']" class="hover:text-primary transition-colors">Summary</a>
            <span class="text-slate-300 dark:text-gray-600">/</span>
            <a [routerLink]="['/community/events', event.id]" class="hover:text-primary transition-colors">{{ event.title }}</a>
            <span class="text-slate-300 dark:text-gray-600">/</span>
            <span class="font-extrabold text-eventText-deep dark:text-white">Review</span>
          </div>
        </nav>

        <div class="max-w-2xl mx-auto px-5 py-8">
          <h1 class="font-manrope text-2xl font-black text-eventText-deep dark:text-white mb-1">Review Your Booking</h1>
          <p class="text-eventText-soft text-sm font-semibold mb-6">Confirm your trip details before proceeding to payment.</p>

          <!-- Journey details -->
          <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5 mb-4">
            <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-3">Journey Details</p>
            <div class="flex flex-col divide-y divide-slate-100 dark:divide-gray-700">
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-soft">Journey</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">{{ event.title }}</span>
              </div>
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-soft">Participation</span>
                <a [routerLink]="['/community/events', event.id]" class="font-extrabold text-primary hover:underline">{{ summary.participationLabel }}</a>
              </div>
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-soft">Dates</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">{{ summary.datesLabel }}</span>
              </div>
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-soft">Nights</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">{{ summary.nights }} nights</span>
              </div>
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-soft">Days booked</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">{{ summary.daysBookedLabel }}</span>
              </div>
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-soft">Cities</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">{{ summary.citiesLabel }}</span>
              </div>
            </div>
          </div>

          <!-- Travel arrangements -->
          <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5 mb-4">
            <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-3">Your Travel Arrangements</p>
            <div class="flex flex-col divide-y divide-slate-100 dark:divide-gray-700">
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-soft">Outbound</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">{{ summary.outboundLabel }}</span>
              </div>
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-soft">Fare</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">₹{{ summary.outboundFare | number }}</span>
              </div>
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-soft">Return</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">{{ summary.returnLabel }}</span>
              </div>
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-soft">Fare</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">₹{{ summary.returnFare | number }}</span>
              </div>
            </div>
          </div>

          <!-- Cost summary -->
          <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5 mb-4">
            <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-3">Cost Summary</p>
            <div class="flex flex-col divide-y divide-slate-100 dark:divide-gray-700 mb-3">
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-mid dark:text-gray-300">Journey package</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">₹{{ summary.journeyPackagePrice | number }}</span>
              </div>
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-mid dark:text-gray-300">Outbound flight</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">₹{{ summary.outboundFare | number }}</span>
              </div>
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-mid dark:text-gray-300">Return flight</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">₹{{ summary.returnFare | number }}</span>
              </div>
            </div>
            <div class="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-gray-700">
              <span class="text-sm font-extrabold text-eventText-deep dark:text-white">Total amount</span>
              <span class="text-lg font-extrabold text-primary">₹{{ summary.totalAmount | number }}</span>
            </div>
          </div>

          <div class="flex items-start gap-2 rounded-xl bg-green-50 dark:bg-green-500/10 p-3.5 mb-6">
            <svg class="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <p class="text-[11px] font-semibold text-green-700 dark:text-green-400 leading-relaxed">
              Free cancellation until 7 days before departure. After that, 50% is refundable.
            </p>
          </div>

          <div class="flex items-center gap-3">
            <a
              [routerLink]="['/community/events', event.id]"
              class="h-11 px-6 rounded-xl text-sm font-extrabold text-eventText-deep dark:text-white border border-slate-200 dark:border-gray-700 flex items-center justify-center hover:border-primary hover:text-primary transition-colors"
            >
              Back
            </a>
            <button
              type="button"
              (click)="proceedToPayment()"
              class="flex-1 h-11 rounded-xl text-sm font-extrabold text-white bg-primary hover:bg-primary-hover transition-colors"
            >
              Proceed to payment
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class CommunityEventReviewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(CommunityEventsMockStore);

  event: CommunityEventCard | null = null;
  selection: BookingSelection = { mode: 'full', rangeStart: null, rangeEnd: null };
  summary!: BookingSummary;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.event = id ? this.store.getById(id) : null;

    const state = history.state as Partial<BookingSelection> | undefined;
    this.selection = {
      mode: state?.mode === 'partial' ? 'partial' : 'full',
      rangeStart: state?.rangeStart ?? null,
      rangeEnd: state?.rangeEnd ?? null
    };

    this.summary = this.event ? buildBookingSummary(this.event, this.selection) : (null as unknown as BookingSummary);
  }

  /** Hands off to the (simulated, no gateway) payment page — trip creation happens there, after payment succeeds. */
  proceedToPayment(): void {
    const ev = this.event;
    if (!ev) return;
    this.router.navigate(['/community/events', ev.id, 'payment'], { state: this.selection });
  }
}
