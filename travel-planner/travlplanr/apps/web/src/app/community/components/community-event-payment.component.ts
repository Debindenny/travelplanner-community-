import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommunityEventsMockStore } from '../services/community-events-mock.store';
import { CommunityEventCard } from '../services/community-event-view.model';
import {
  BookingSelection, BookingSummary, buildBookingSummary, extraChargesFor
} from '../services/community-event-booking.util';
import { EventItineraryService } from '../services/event-itinerary.service';

export type PaymentMethod = 'upi' | 'card' | 'wallet';

@Component({
  selector: 'app-community-event-payment',
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
            <span class="font-extrabold text-eventText-deep dark:text-white">Payment</span>
          </div>
        </nav>

        <div class="max-w-md mx-auto px-5 py-8">
          <h1 class="font-manrope text-2xl font-black text-eventText-deep dark:text-white mb-1">Payment</h1>
          <p class="text-eventText-soft text-sm font-semibold mb-6">Simulated payment — no card or bank details are sent anywhere.</p>

          <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5 mb-4">
            <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-3">Order summary</p>
            <div class="flex flex-col divide-y divide-slate-100 dark:divide-gray-700 mb-3">
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-mid dark:text-gray-300">Journey package</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">₹{{ summary.journeyPackagePrice | number }}</span>
              </div>
              <div class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-mid dark:text-gray-300">Outbound + return flights</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">₹{{ (summary.outboundFare + summary.returnFare) | number }}</span>
              </div>
              <div *ngIf="extraCharges > 0" class="flex items-center justify-between py-2 text-xs">
                <span class="font-semibold text-eventText-mid dark:text-gray-300">Booked activities &amp; transport</span>
                <span class="font-extrabold text-eventText-deep dark:text-white">₹{{ extraCharges | number }}</span>
              </div>
            </div>
            <div class="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-gray-700">
              <span class="text-sm font-extrabold text-eventText-deep dark:text-white">Total to pay</span>
              <span class="text-lg font-extrabold text-primary">₹{{ totalDue | number }}</span>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5 mb-6">
            <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-3">Payment method</p>
            <div class="flex flex-col gap-2">
              <label
                *ngFor="let m of methods"
                class="flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors"
                [class.border-primary]="paymentMethod === m.value"
                [class.bg-primary-50]="paymentMethod === m.value"
                [class.dark:bg-primary/10]="paymentMethod === m.value"
                [class.border-slate-200]="paymentMethod !== m.value"
                [class.dark:border-gray-700]="paymentMethod !== m.value"
              >
                <input type="radio" name="paymentMethod" [value]="m.value" [checked]="paymentMethod === m.value" (change)="paymentMethod = m.value" class="accent-primary" />
                <span class="text-xs font-extrabold text-eventText-deep dark:text-white">{{ m.label }}</span>
              </label>
            </div>
          </div>

          <button
            type="button"
            [disabled]="processing"
            (click)="pay()"
            class="w-full h-12 rounded-xl text-sm font-extrabold text-white bg-primary hover:bg-primary-hover transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {{ processing ? 'Processing…' : ('Pay ₹' + (totalDue | number) + ' now') }}
          </button>
          <a [routerLink]="['/community/events', event.id, 'review']" class="block text-center text-sm font-bold text-primary hover:underline mt-4">
            Back to review
          </a>
        </div>
      </div>
    }

    @if (toastMessage) {
      <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg">
        {{ toastMessage }}
      </div>
    }
  `
})
export class CommunityEventPaymentComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(CommunityEventsMockStore);
  private readonly itineraryService = inject(EventItineraryService);

  event: CommunityEventCard | null = null;
  selection: BookingSelection = { mode: 'full', rangeStart: null, rangeEnd: null };
  summary!: BookingSummary;
  extraCharges = 0;
  totalDue = 0;

  readonly methods: { value: PaymentMethod; label: string }[] = [
    { value: 'upi', label: 'UPI' },
    { value: 'card', label: 'Credit / Debit Card' },
    { value: 'wallet', label: 'Wallet' }
  ];
  paymentMethod: PaymentMethod = 'upi';

  processing = false;

  toastMessage: string | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;

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
    this.totalDue = this.summary?.totalAmount ?? 0;

    this.loadExtraCharges();
  }

  private async loadExtraCharges(): Promise<void> {
    const ev = this.event;
    if (!ev) return;
    try {
      const res = await this.itineraryService.getItinerary(ev.id);
      this.extraCharges = extraChargesFor(res.days, res.transport);
      this.totalDue = this.summary.totalAmount + this.extraCharges;
    } catch (err) {
      console.error('Failed to load booked extras for payment total', err);
    }
  }

  /** Simulated payment confirmation — writes payment_status='paid' + a booking reference server-side, no external gateway involved. */
  async pay(): Promise<void> {
    const ev = this.event;
    if (!ev || this.processing) return;
    this.processing = true;
    try {
      const result = await this.itineraryService.payParticipation(ev.id, this.totalDue);
      this.router.navigate(['/community/events', ev.id, 'success'], {
        state: {
          ...this.selection,
          totalDue: this.totalDue,
          paymentMethod: this.paymentMethod,
          bookingReference: result.bookingReference,
          paidAt: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error('Failed to record payment', err);
      this.showToast("Couldn't process payment — please try again.");
    } finally {
      this.processing = false;
    }
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = null), 2500);
  }
}
