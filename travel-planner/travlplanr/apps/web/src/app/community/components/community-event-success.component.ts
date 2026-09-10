import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { CommunityEventsMockStore } from '../services/community-events-mock.store';
import { CommunityEventCard, JourneyDay } from '../services/community-event-view.model';
import { BookingSelection, BookingSummary, buildBookingSummary, selectedDaysFor } from '../services/community-event-booking.util';
import { EventItineraryService } from '../services/event-itinerary.service';
import { PaymentMethod } from './community-event-payment.component';
import { ItineraryTimelineComponent } from '../../itinerary/components/itinerary-timeline/itinerary-timeline.component';
import { EventDayTab, EventDayTabsComponent } from './event-day-tabs.component';
import { ItineraryPdfService } from '../../itinerary/itinerary-pdf.service';
import { ItineraryPdfTemplateComponent } from '../../itinerary/itinerary-pdf-template.component';
import type { ItineraryPdfData, ItineraryPdfItem } from '../../itinerary/itinerary-pdf.models';
import { PARTNER_LOGOS } from '../../shared/data/landing.data';
import type { DetailDay, DetailItem } from '../../itinerary/itinerary-page.component';
import type { DetailActivity } from '../../trip/trip.service';

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

/**
 * The traveler's booked itinerary — reuses the same day-tabs + itinerary-timeline
 * furniture as the Event Summary/Detail pages (which already match the main
 * Itinerary page's tab/timeline design), so a confirmed booking looks like the
 * standard itinerary experience everywhere, with the booking-specific info kept
 * in its own right-hand sidebar rather than folded into the timeline itself.
 */
@Component({
  selector: 'app-community-event-success',
  imports: [CommonModule, RouterLink, ItineraryTimelineComponent, EventDayTabsComponent, ItineraryPdfTemplateComponent],
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

        <!-- Success banner -->
        <div class="page-container mx-auto px-5 xl:px-20 pt-6">
          <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-8 text-center">
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
        </div>

        <!-- Same sticky Summary/Day tab bar used on the Event Summary/Detail pages -->
        @if (selectedDays.length) {
          <app-event-day-tabs [days]="selectedDays" [activeTab]="activeTab" (tabSelect)="activeTab = $event"></app-event-day-tabs>
        }

        <div class="page-container mx-auto px-5 xl:px-20 pt-6 pb-28">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <!-- Left: booked itinerary — same components/layout as the Event Summary page -->
            <div class="lg:col-span-2 flex flex-col gap-5">
              @if (selectedDays.length) {
                @if (activeTab === 'summary') {
                  <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5">
                    <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-2">Event Overview</p>
                    <p class="text-[13.5px] text-eventText-mid dark:text-gray-300 leading-relaxed">{{ event.description }}</p>
                  </div>

                  <div class="grid gap-5 md:grid-cols-2">
                    <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-xl p-5 shadow-sm">
                      <div class="flex items-center gap-2 mb-3">
                        <span class="w-6 h-6 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-sm shrink-0">&#10003;</span>
                        <p class="text-xs font-extrabold text-eventText-deep dark:text-white">Inclusions</p>
                      </div>
                      <ul class="flex flex-col gap-2">
                        <li *ngFor="let inc of inclusions" class="flex items-start gap-2 text-xs font-semibold text-eventText-mid dark:text-gray-300 leading-relaxed">
                          <span class="text-green-500 shrink-0 select-none">&#10003;</span>
                          {{ inc }}
                        </li>
                      </ul>
                    </div>

                    <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-xl p-5 shadow-sm">
                      <div class="flex items-center gap-2 mb-3">
                        <span class="w-6 h-6 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-sm shrink-0">&#10007;</span>
                        <p class="text-xs font-extrabold text-eventText-deep dark:text-white">Exclusions</p>
                      </div>
                      <ul class="flex flex-col gap-2">
                        <li *ngFor="let exc of exclusions" class="flex items-start gap-2 text-xs font-semibold text-eventText-mid dark:text-gray-300 leading-relaxed">
                          <span class="text-red-400 shrink-0 select-none">&#10007;</span>
                          {{ exc }}
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-3">Itinerary Overview</p>
                    <app-itinerary-timeline [displayedDays]="allDetailDays()" [getItemKey]="activityItemKey" [readOnly]="true"></app-itinerary-timeline>
                  </div>
                } @else {
                  <app-itinerary-timeline [displayedDays]="dayDetailDays(activeTab)" [getItemKey]="activityItemKey" [readOnly]="true"></app-itinerary-timeline>
                }
              }
            </div>

            <!-- Right: booking-specific sidebar — unchanged content, restyled into sticky cards -->
            <aside class="flex flex-col gap-4 lg:sticky lg:top-6">
              <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5">
                <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-3">Booking Summary</p>
                <div class="flex flex-col divide-y divide-slate-100 dark:divide-gray-700">
                  <div class="flex items-center justify-between py-2 text-xs">
                    <span class="font-semibold text-eventText-soft">Plan type</span>
                    <span class="font-extrabold text-eventText-deep dark:text-white">{{ summary.participationLabel }}</span>
                  </div>
                  <div class="flex items-center justify-between py-2 text-xs">
                    <span class="font-semibold text-eventText-soft">Days</span>
                    <span class="font-extrabold text-eventText-deep dark:text-white">{{ summary.daysBookedLabel }}</span>
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
              </div>

              <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5">
                <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-3">Cost Breakdown</p>
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
                  <span class="text-sm font-extrabold text-eventText-deep dark:text-white">Paid amount</span>
                  <span class="text-lg font-extrabold text-primary">₹{{ totalDue | number }}</span>
                </div>
              </div>

              <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5 flex flex-col gap-2">
                <button
                  type="button"
                  (click)="downloadItinerary()"
                  [disabled]="pdfDownloading"
                  class="w-full h-11 rounded-xl text-sm font-extrabold text-white bg-primary hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" /></svg>
                  {{ pdfDownloading ? 'Preparing PDF…' : 'Download Itinerary' }}
                </button>
                <button
                  type="button"
                  (click)="shareItinerary()"
                  class="w-full h-11 rounded-xl text-sm font-extrabold text-primary border border-primary/30 hover:bg-primary-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                    <path d="M8.6 10.5 15.4 6.5M8.6 13.5l6.8 4" />
                  </svg>
                  Share Itinerary
                </button>
              </div>

              <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5">
                <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-2">Need help?</p>
                <p class="text-xs text-eventText-mid dark:text-gray-300 mb-3">Questions about your booking, payment or the trip itself — we're here.</p>
                <div class="flex flex-col gap-2">
                  <a routerLink="/contact" class="text-xs font-bold text-primary hover:underline">Contact support</a>
                  <a routerLink="/faq" class="text-xs font-bold text-primary hover:underline">Visit FAQ</a>
                </div>
              </div>

              <a routerLink="/community/events" class="text-center text-xs font-bold text-eventText-soft hover:text-primary hover:underline transition-colors">
                Back to Hosted Journeys
              </a>
            </aside>
          </div>
        </div>

        @if (toastMessage) {
          <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg">
            {{ toastMessage }}
          </div>
        }

        <!-- Hidden print layout — the exact same branded PDF template the main Itinerary
             page renders into a PDF via ItineraryPdfService, just fed event/booking data. -->
        <div class="fixed -left-[10000px] top-0 pointer-events-none" aria-hidden="true">
          <div #pdfExportRoot>
            <app-itinerary-pdf-template [data]="pdfExportData()" />
          </div>
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
  private readonly pdfService = inject(ItineraryPdfService);
  private readonly translate = inject(TranslateService);

  private readonly pdfExportRoot = viewChild<ElementRef<HTMLElement>>('pdfExportRoot');
  readonly pdfExportData = signal<ItineraryPdfData | null>(null);

  event: CommunityEventCard | null = null;
  selection: BookingSelection = { mode: 'full', rangeStart: null, rangeEnd: null };
  summary!: BookingSummary;
  selectedDays: JourneyDay[] = [];
  activeTab: EventDayTab = 'summary';
  totalDue = 0;
  paymentMethod: PaymentMethod = 'upi';
  bookingReference: string | null = null;
  paidAtLabel = '';
  pdfDownloading = false;
  toastMessage: string | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly inclusions = ['Accommodation', 'Activities', 'Meals', 'Local Transport', 'Event Access'];
  readonly exclusions = ['Personal Expenses', 'Optional Activities', 'Insurance', 'Additional Purchases'];

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
    this.selectedDays = selectedDaysFor(this.event, this.selection);
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

  /** Maps this journey's day/activity data onto the shared itinerary-timeline component's shape (see itinerary-page.component.ts DetailDay/DetailActivity). */
  private mapDays(days: JourneyDay[]): DetailDay[] {
    return days.map((d) => ({
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
        duration: a.duration || undefined,
      })),
    }));
  }

  allDetailDays(): DetailDay[] {
    return this.mapDays(this.selectedDays);
  }

  dayDetailDays(day: EventDayTab): DetailDay[] {
    if (day === 'summary') return [];
    const match = this.selectedDays.find((d) => d.day === day);
    return match ? this.mapDays([match]) : [];
  }

  readonly activityItemKey = (item: DetailItem): string => {
    const activity = item as DetailActivity;
    return activity.id || activity.title;
  };

  /** Snapshots the visible booked-itinerary column into a PDF — same ItineraryPdfService
   * used by the main Itinerary page's "Download Itinerary" button, just pointed at this
   * page's own DOM instead of the trip-planner's hidden print template. */
  /** Renders the same branded PDF layout the main Itinerary page uses (app-itinerary-pdf-template,
   * ItineraryPdfService) into a hidden off-screen node, then snapshots that instead of the visible
   * page — same mechanism as itinerary-page.component.ts's downloadItineraryPdf(), just fed data
   * built from this booking instead of a SavedTrip. */
  async downloadItinerary(): Promise<void> {
    const ev = this.event;
    if (!ev || this.pdfDownloading) return;
    this.pdfDownloading = true;
    try {
      const data = this.buildEventPdfData(ev);
      this.pdfExportData.set(data);
      await this.waitForPdfTemplateRender();
      const root = this.pdfExportRoot()?.nativeElement.querySelector('.pdf-root') as HTMLElement | null;
      if (!root) return;
      await this.pdfService.download(root, this.pdfService.buildFilename(data));
    } catch (err) {
      console.error('Itinerary PDF download failed', err);
      this.showToast('Could not generate the PDF — please try again.');
    } finally {
      this.pdfDownloading = false;
    }
  }

  private async waitForPdfTemplateRender(): Promise<void> {
    await Promise.resolve();
    if (typeof window === 'undefined') return;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  private buildEventPdfData(ev: CommunityEventCard): ItineraryPdfData {
    const days = this.selectedDays;
    const activityCount = days.reduce((sum, d) => sum + d.activities.length, 0);
    const inclusion = `2 Flights, Hotel, ${activityCount} ${activityCount === 1 ? 'Activity' : 'Activities'}`;

    const pdfDays = days.map((d, idx) => {
      const items: ItineraryPdfItem[] = [];
      if (idx === 0) {
        items.push({ kind: 'flight', title: `Flight to ${d.city}`, cost: `₹${this.summary.outboundFare.toLocaleString('en-IN')}` });
      }
      items.push(
        ...d.activities.map((a): ItineraryPdfItem => ({
          kind: 'activity',
          title: a.title,
          time: a.time,
          location: d.city,
          refundable: a.price != null ? 'Non-refundable' : 'Free cancellation',
          imageUrl: a.image,
          cost: a.price != null ? `₹${a.price.toLocaleString('en-IN')}` : undefined,
        })),
      );
      if (idx === days.length - 1) {
        items.push({ kind: 'flight', title: 'Return flight home', cost: `₹${this.summary.returnFare.toLocaleString('en-IN')}` });
      }
      return { day: d.day, title: d.city, dateStr: d.dateLabel, items };
    });

    return {
      variant: 'post-booking',
      tripTitle: `${this.summary.nights + 1}-Day ${ev.title}`,
      dateRange: this.summary.datesLabel,
      destinations: this.summary.citiesLabel,
      duration: `${days.length} Days, ${this.summary.nights} Nights`,
      travellers: '1 Traveller',
      inclusion,
      price: `₹${this.totalDue.toLocaleString('en-IN')}`,
      departureReturn: `${this.summary.outboundLabel} · ${this.summary.returnLabel}`,
      days: pdfDays,
      partners: PARTNER_LOGOS.map((p) => p.name),
      summarySections: [
        { title: 'Inclusions', items: this.inclusions },
        { title: 'Exclusions', items: this.exclusions },
      ],
      faqItems: [1, 2, 3, 4, 5].map((n) => ({
        question: this.translate.instant(`ITINERARY.PDF.FAQ_Q${n}_QUESTION`),
        answer: this.translate.instant(`ITINERARY.PDF.FAQ_Q${n}_ANSWER`),
      })),
    };
  }

  /** Same Web Share API + clipboard-copy fallback already used elsewhere in the event flow. */
  shareItinerary(): void {
    const ev = this.event;
    if (!ev) return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: `${ev.title} — Itinerary`, url }).catch(() => { /* user cancelled the share sheet — not an error */ });
    } else {
      navigator.clipboard.writeText(url).then(() => this.showToast('Link copied to clipboard'));
    }
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = null), 2500);
  }
}
