import { Component, EventEmitter, Input, Output, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import type { DetailDay, DetailItem } from '../../itinerary-page.component';
import { CurrencyConverterPipe } from '../../../shared/utils/currency-converter.pipe';
import { formatUsdCost } from '../../../shared/utils/price-to-usd';
import { localizeKnownPhrase, localizeTimeLabel } from '../../itinerary-i18n.util';

type TransportType = 'flight' | 'train' | 'bus' | 'car';

/** Fixed transportation/accommodation reservation milestones — the trip's
 * schedule depends on these, so "Change"/reorder/drag is locked for them
 * (activities, restaurants, attractions, tours etc. stay freely changeable).
 * Matches the exact milestone titles regardless of what else the title says
 * (e.g. "Hotel Check-in: Le Marais Boutique Hotel" still matches). */
const LOCKED_RESERVATION_TITLE_RE =
  /\b(hotel\s+check-?in|hotel\s+check-?out|flight\s+check-?in|flight\s+check-?out|flight\s+departure|flight\s+arrival|train\s+check-?in|train\s+check-?out|train\s+departure|train\s+arrival|bus\s+check-?in|bus\s+check-?out|bus\s+departure|bus\s+arrival)\b/i;

/** Catches generic reservation wording that doesn't fit the exact milestone
 * phrases above — "Airport Transfer Booking", "Train Reservation", etc. */
const LOCKED_RESERVATION_KEYWORD_RE =
  /\b(flight|train|bus|transport|transportation|transfer|hotel|accommodation|stay)\b.*\b(booking|reservation)\b/i;

/** Bare "Arrival"/"Departure" transport-milestone titles with no mode word —
 * used throughout seeded itinerary data (e.g. day activities titled just
 * "Arrival" or "Departure") to mark the day's transfer in/out. Matched as a
 * leading word followed by a separator or end-of-string, so a real activity
 * that merely starts with "Departure" as a description ("Departure Lounge
 * Spa Experience") does not get swept up. */
const LOCKED_STANDALONE_TRANSIT_TITLE_RE = /^(arrival|departure)\s*(?:[—\-:]|$)/i;

/** A title that IS a flight or names a specific hotel property — "Flight to
 * Teronoh", "Hotel Teronoh Central" — rather than an activity/tour that
 * merely mentions one in passing. Leading word only, so "Hotel Rooftop Bar
 * Experience" (an activity hosted at a hotel) isn't caught by this. */
const LOCKED_LEADING_MODE_TITLE_RE = /^(flight|hotel)\b/i;

/** Airport/bus/train transfer or shuttle services — booked ground transport,
 * not a sightseeing bus/train tour (a real "Bus Tour of the Old Town" or
 * "Scenic Train Ride" activity has none of these trigger words). */
const LOCKED_TRANSFER_TITLE_RE =
  /\bairport\b.*\b(shuttle|transfer|express|taxi|pickup|drop-?off)\b|\b(bus|train)\b.*\b(transfer|shuttle|express|departure|arrival|check-?in|check-?out|reservation|booking)\b/i;

export const LOCKED_RESERVATION_TOOLTIP =
  'This booking is fixed and cannot be modified individually.';

@Component({
    selector: 'app-itinerary-timeline',
    imports: [CommonModule, TranslatePipe, DragDropModule, CurrencyConverterPipe],
    templateUrl: './itinerary-timeline.component.html'
})
export class ItineraryTimelineComponent {
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  /** Forces template re-eval after language files load (instant() is not pipe-reactive). */
  private readonly langTick = signal(0);

  @Input() displayedDays: DetailDay[] = [];
  @Input() getItemKey: (item: DetailItem) => string = () => '';
  /** When set, dims any day not in the set and switches its badge to a neutral color — used by read-only day-selection previews. `null` (default) leaves every day looking included, matching the original always-bg-primary look. */
  @Input() highlightedDays: ReadonlySet<number> | null = null;
  /** Hides per-item action rows, the "Add to Day" panel, drag-and-drop and the comments button — for previewing an itinerary without editing it. */
  @Input() readOnly = false;
  @Input() getFlightLogoUrl: (item: any) => string | undefined = () => undefined;
  @Input() getAirlineIataCode: (carrier: string) => string = () => '';
  @Input() cityNameForAirport: (code: string) => string = () => '';
  @Input() getCarImageUrl: (item: any) => string = () => '';
  @Input() getActivityImageUrl: (item: any) => string = (item) => item?.image || '';
  @Input() getTrainImageUrl: (item: any) => string = () => '';
  @Input() getBusImageUrl: (item: any) => string = () => '';
  @Input() isTransferDay: (dayDay: number) => boolean = () => false;
  @Input() transportModeOptions: { id: TransportType; labelKey: string }[] = [];
  /** Keys (via `getItemKey`) of items already booked — shows a persistent "Booked" state on that item's Book button instead of relying on a transient toast. `null`/empty leaves every Book button in its default state. */
  @Input() bookedItemKeys: ReadonlySet<string> | null = null;

  @Output() itemDropped = new EventEmitter<CdkDragDrop<{ day: number; items: DetailItem[] }>>();
  @Output() moveUp = new EventEmitter<{ day: number; index: number }>();
  @Output() moveDown = new EventEmitter<{ day: number; index: number }>();
  @Output() flightSwap = new EventEmitter<{ day: number; index: number }>();
  @Output() carSwap = new EventEmitter<{ day: number; index: number }>();
  @Output() hotelSwap = new EventEmitter<{ day: number; index: number }>();
  @Output() activitySwap = new EventEmitter<{ day: number; index: number }>();
  @Output() trainSwap = new EventEmitter<{ day: number; index: number }>();
  @Output() busSwap = new EventEmitter<{ day: number; index: number }>();
  @Output() activityAdd = new EventEmitter<number>();
  @Output() eventAdd = new EventEmitter<number>();
  @Output() cruiseAdd = new EventEmitter<number>();
  @Output() hotelAdd = new EventEmitter<number>();
  @Output() holidayAdd = new EventEmitter<number>();
  @Output() transferAdd = new EventEmitter<number>();
  @Output() transportAdd = new EventEmitter<{ day: number; type: TransportType }>();
  @Output() openComments = new EventEmitter<number>();
  @Output() dayHeaderClick = new EventEmitter<number>();
  @Output() book = new EventEmitter<DetailItem>();

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => {
      this.langTick.update((n) => n + 1);
      this.cdr.markForCheck();
    });
  }

  protected readonly lockedReservationTooltip = LOCKED_RESERVATION_TOOLTIP;

  /** Hotel/flight/train/bus check-in/out and departure/arrival milestones are
   * fixed reservations — this locks their "Change" button (see LOCKED_RESERVATION_TITLE_RE). */
  protected isLockedReservation(title: string | null | undefined): boolean {
    if (!title) return false;
    const trimmed = title.trim();
    return (
      LOCKED_RESERVATION_TITLE_RE.test(trimmed) ||
      LOCKED_RESERVATION_KEYWORD_RE.test(trimmed) ||
      LOCKED_STANDALONE_TRANSIT_TITLE_RE.test(trimmed) ||
      LOCKED_LEADING_MODE_TITLE_RE.test(trimmed) ||
      LOCKED_TRANSFER_TITLE_RE.test(trimmed)
    );
  }

  /** Every flight/hotel/train/bus card IS a fixed, time-dependent reservation
   * by definition — Change, reorder, and drag are locked unconditionally for
   * those types. Rental cars and generic activities stay changeable unless
   * their own title reads as a reservation milestone (see isLockedReservation). */
  protected isLocked(item: DetailItem): boolean {
    const anyItem = item as { type?: string; title?: string; model?: string };
    if (anyItem.type === 'flight' || anyItem.type === 'hotel' || anyItem.type === 'train' || anyItem.type === 'bus') {
      return true;
    }
    return this.isLockedReservation(anyItem.title ?? anyItem.model);
  }

  /** Fare display — prices arrive already converted for the active currency. */
  protected fareCost(item: { price?: number; currency?: string; provider?: string; type?: string; cost?: string }): string {
    return formatUsdCost(item) ?? item.cost ?? '';
  }

  protected localizePhrase(value: string | null | undefined): string {
    this.langTick();
    return localizeKnownPhrase(value, (key, params) => this.translate.instant(key, params));
  }

  protected localizeTime(value: string | null | undefined): string {
    this.langTick();
    return localizeTimeLabel(value, (key, params) => this.translate.instant(key, params));
  }
}
