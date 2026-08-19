import { Component, OnInit, inject, signal } from '@angular/core';

import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PrimaryButtonComponent } from 'ui';
import { BookingService, BookingDetail } from '../booking/booking.service';
import { TripService } from '../trip/trip.service';

const PENDING_CHECKOUT_TRIP_KEY = 'travlplanr_pending_checkout_trip_id';

@Component({
    selector: 'app-checkout-success-page',
    imports: [RouterLink, TranslatePipe, PrimaryButtonComponent],
    template: `
    <div class="min-h-[70vh] flex items-center justify-center bg-surface-muted px-4 py-16">
      <div class="max-w-md w-full bg-white rounded-2xl border border-border p-8 shadow-xl text-center transform transition-all scale-100 duration-300">
        <div class="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-emerald-50 border-4 border-emerald-100 text-emerald-600 mb-6">
          <svg class="h-10 w-10 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 class="text-3xl font-extrabold text-text-primary tracking-tight mb-2">
          {{ 'CHECKOUT.SUCCESS.TITLE' | translate }}
        </h1>

        <p class="text-text-secondary text-base mb-6 leading-relaxed">
          {{ 'CHECKOUT.SUCCESS.SUBTITLE' | translate }}
        </p>

        @if (confirmingBooking()) {
          <div class="bg-surface-muted rounded-xl p-4 mb-8 border border-border text-sm text-text-secondary">
            {{ 'CHECKOUT.SUCCESS.CONFIRMING_BOOKING' | translate }}
          </div>
        }

        @if (booking()?.pnr) {
          <div class="bg-surface-muted rounded-xl p-4 mb-8 border border-border text-left">
            <span class="block text-2xs font-extrabold uppercase tracking-wider text-text-disabled mb-1">
              {{ 'CHECKOUT.SUCCESS.BOOKING_REFERENCE' | translate }}
            </span>
            <code class="text-lg text-text-primary font-mono font-bold tracking-widest block select-all bg-white px-2.5 py-1.5 rounded-lg border border-border-light">
              {{ booking()?.pnr }}
            </code>
          </div>
        }

        @if (sessionId()) {
          <div class="bg-surface-muted rounded-xl p-4 mb-8 border border-border text-left">
            <span class="block text-2xs font-extrabold uppercase tracking-wider text-text-disabled mb-1">
              {{ 'CHECKOUT.SUCCESS.SESSION_ID' | translate }}
            </span>
            <code class="text-xs text-text-secondary font-mono break-all block select-all bg-white px-2.5 py-1.5 rounded-lg border border-border-light">
              {{ sessionId() }}
            </code>
          </div>
        }

        <div class="flex flex-col gap-3">
          <app-primary-button routerLink="/trips" widthClass="w-full">
            {{ 'CHECKOUT.SUCCESS.GO_TO_TRIPS' | translate }}
          </app-primary-button>

          <a routerLink="/" class="text-sm font-bold text-primary hover:text-primary-hover hover:underline transition-colors mt-2">
            {{ 'CHECKOUT.SUCCESS.BACK_HOME' | translate }}
          </a>
        </div>
      </div>
    </div>
  `
})
export class CheckoutSuccessPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private bookingService = inject(BookingService);
  private tripService = inject(TripService);

  sessionId = signal<string | null>(null);
  confirmingBooking = signal(false);
  booking = signal<BookingDetail | null>(null);

  ngOnInit() {
    this.sessionId.set(this.route.snapshot.queryParamMap.get('session_id'));

    const tripId = localStorage.getItem(PENDING_CHECKOUT_TRIP_KEY);
    if (tripId) {
      localStorage.removeItem(PENDING_CHECKOUT_TRIP_KEY);
      void this.confirmBooking(tripId);
    }
  }

  private async confirmBooking(tripId: string): Promise<void> {
    this.confirmingBooking.set(true);
    try {
      const summary = await this.bookingService.waitForBookingConfirmation(tripId);
      if (!summary) return;

      const trip = await this.tripService.getTripFromBackend(tripId);
      const passengers = (trip?.customizations?.['passengers'] as any[] | undefined) || [];
      const flights = Object.values((trip?.customizations?.['bookingFlights'] as Record<string, any>) || {});
      const hotels = Object.values((trip?.customizations?.['bookingHotels'] as Record<string, any>) || {});

      const saves: Promise<void>[] = [];
      if (passengers.length > 0) {
        saves.push(this.bookingService.savePassengers(summary.bookingId, passengers as any));
      }
      if (flights.length > 0) {
        saves.push(this.bookingService.saveFlightSegments(summary.bookingId, flights));
      }
      if (hotels.length > 0) {
        saves.push(this.bookingService.saveHotelStays(summary.bookingId, hotels));
      }
      const results = await Promise.allSettled(saves);
      for (const result of results) {
        if (result.status === 'rejected') {
          console.error('Failed to persist booking details', result.reason);
        }
      }

      const detail = await this.bookingService.getBookingDetail(summary.bookingId);
      this.booking.set(detail ?? null);
    } catch (error) {
      console.error('Failed to confirm booking', error);
    } finally {
      this.confirmingBooking.set(false);
    }
  }
}
