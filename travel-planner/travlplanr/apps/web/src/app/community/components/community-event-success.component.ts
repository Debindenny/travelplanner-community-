import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommunityEventsMockStore } from '../services/community-events-mock.store';
import { CommunityEventCard } from '../services/community-event-view.model';
import { BookingSelection, BookingSummary, buildBookingSummary } from '../services/community-event-booking.util';
import { EventItineraryService } from '../services/event-itinerary.service';
import { PaymentMethod } from './community-event-payment.component';

interface SuccessNavState extends Partial<BookingSelection> {
  totalDue?: number;
  paymentMethod?: PaymentMethod;
  bookingReference?: string | null;
  paidAt?: string;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  upi: 'UPI',
  card: 'Credit / Debit Card',
  wallet: 'Wallet'
};

@Component({
  selector: 'app-community-event-success',
  imports: [CommonModule, RouterLink],
  template: `
    @if (!event || !ready) {
      <div class="max-w-5xl mx-auto py-8 px-4 sm:px-6 font-manrope">
        <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-12 text-center shadow-sm">
          <h3 class="font-manrope font-extrabold text-base text-eventText-deep dark:text-white mb-1">
            {{ event ? 'Loading your confirmation…' : 'Event not found' }}
          </h3>
          @if (!event) {
            <p class="text-eventText-mid dark:text-gray-300 text-xs mb-4">It may have been removed.</p>
            <a routerLink="/community/events" class="inline-block px-4 py-2 text-xs bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all">
              Back to events
            </a>
          }
        </div>
      </div>
    } @else {
      <div class="font-manrope">
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
            <span class="font-extrabold text-eventText-deep dark:text-white">Confirmation</span>
          </div>
        </nav>

        <div class="max-w-md mx-auto px-5 py-8">
          <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-8 text-center mb-4">
            <div class="w-14 h-14 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <svg class="w-7 h-7 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 class="font-manrope text-xl font-black text-eventText-deep dark:text-white mb-1">Payment successful</h2>
            <p class="text-eventText-soft text-sm font-semibold mb-4">₹{{ totalDue | number }} paid for {{ event.title }}.</p>

            @if (bookingReference) {
              <div class="inline-flex items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary-50 dark:bg-primary/10 px-4 py-2">
                <span class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide">Booking reference</span>
                <span class="text-sm font-black text-primary tracking-wide">{{ bookingReference }}</span>
              </div>
            }
          </div>

          <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5 mb-6">
            <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-3">Payment summary</p>
            <div class="flex flex-col divide-y divide-slate-100 dark:divide-gray-700">
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-soft">Participation</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">{{ summary.participationLabel }}</span>
              </div>
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-soft">Dates</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">{{ summary.datesLabel }}</span>
              </div>
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-soft">Cities</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">{{ summary.citiesLabel }}</span>
              </div>
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-soft">Payment method</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">{{ paymentMethodLabel }}</span>
              </div>
              @if (paidAtLabel) {
                <div class="flex items-center justify-between py-2 text-xs">
                  <span class="font-semibold text-eventText-soft">Paid on</span>
                  <span class="font-extrabold text-eventText-deep dark:text-white">{{ paidAtLabel }}</span>
                </div>
              }
            </div>
            <div class="flex items-center justify-between pt-3 mt-1 border-t border-slate-100 dark:border-gray-700">
              <span class="text-sm font-extrabold text-eventText-deep dark:text-white">Amount paid</span>
              <span class="text-lg font-extrabold text-primary">₹{{ totalDue | number }}</span>
            </div>
          </div>

          <a
            [routerLink]="['/community/events', event.id]"
            class="w-full h-12 rounded-xl text-sm font-extrabold text-white bg-primary hover:bg-primary-hover transition-colors flex items-center justify-center"
          >
            View itinerary timeline
          </a>
          <a routerLink="/community/events" class="block text-center text-sm font-bold text-primary hover:underline mt-4">
            Back to Hosted Journeys
          </a>
        </div>
      </div>
    }
  `
})
export class CommunityEventSuccessComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(CommunityEventsMockStore);
  private readonly itineraryService = inject(EventItineraryService);

  event: CommunityEventCard | null = null;
  selection: BookingSelection = { mode: 'full', rangeStart: null, rangeEnd: null };
  summary!: BookingSummary;
  totalDue = 0;
  paymentMethod: PaymentMethod = 'upi';
  bookingReference: string | null = null;
  paidAtLabel = '';

  ready = false;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.event = id ? this.store.getById(id) : null;
    if (this.event) {
      this.load(this.event.id, id!);
    }
  }

  private async load(eventId: string, routeId: string): Promise<void> {
    const state = history.state as SuccessNavState | undefined;

    if (state?.bookingReference) {
      this.selection = {
        mode: state.mode === 'partial' ? 'partial' : 'full',
        rangeStart: state.rangeStart ?? null,
        rangeEnd: state.rangeEnd ?? null
      };
      this.totalDue = state.totalDue ?? 0;
      this.paymentMethod = state.paymentMethod ?? 'upi';
      this.bookingReference = state.bookingReference;
      this.paidAtLabel = state.paidAt ? this.formatPaidAt(state.paidAt) : '';
      this.finishLoading(eventId);
      return;
    }

    // Refresh-safety fallback: no router state (e.g. the page was reloaded) — recover from the server.
    try {
      const participation = await this.itineraryService.getParticipation(eventId);
      if (participation.paymentStatus !== 'paid') {
        this.router.navigate(['/community/events', routeId]);
        return;
      }
      this.selection = {
        mode: participation.mode === 'partial' ? 'partial' : 'full',
        rangeStart: participation.rangeStart ?? null,
        rangeEnd: participation.rangeEnd ?? null
      };
      this.totalDue = participation.amountPaid ?? 0;
      this.bookingReference = participation.bookingReference;
      this.finishLoading(eventId);
    } catch (err) {
      console.error('Failed to load participation for confirmation page', err);
      this.router.navigate(['/community/events', routeId]);
    }
  }

  /** Payment succeeded — the traveler has now genuinely joined the journey. */
  private finishLoading(eventId: string): void {
    if (!this.event) return;
    this.summary = buildBookingSummary(this.event, this.selection);
    this.store.markJoined(eventId);
    this.ready = true;
  }

  get paymentMethodLabel(): string {
    return METHOD_LABELS[this.paymentMethod];
  }

  private formatPaidAt(iso: string): string {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
