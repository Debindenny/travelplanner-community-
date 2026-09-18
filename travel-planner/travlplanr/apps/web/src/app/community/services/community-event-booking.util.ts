import { CommunityEventCard, JourneyDay, TransportSegment, eventDateRangeLabel } from './community-event-view.model';

export type JoinMode = 'full' | 'partial';

export interface BookingSelection {
  mode: JoinMode;
  rangeStart: number | null;
  rangeEnd: number | null;
}

/** Static placeholder flight fares shown alongside the journey cost — no flight-booking integration exists yet. */
export const OUTBOUND_FARE = 24500;
export const RETURN_FARE = 21600;
export const HOME_CITY = 'Chennai';

export interface BookingSummary {
  selectedDays: JourneyDay[];
  totalDays: number;
  citiesLabel: string;
  participationLabel: string;
  datesLabel: string;
  nights: number;
  daysBookedLabel: string;
  outboundLabel: string;
  returnLabel: string;
  outboundFare: number;
  returnFare: number;
  journeyPackagePrice: number;
  totalAmount: number;
}

/**
 * Extra charges beyond the base journey package + flights: activities the
 * traveler has actually booked (add-on excursions with their own price) plus
 * any transport segments they've added. Kept separate from BookingSummary
 * since it needs the DB-backed itinerary/transport fetch that only the
 * payment page performs — the review page's total stays journey+flights only.
 */
export function extraChargesFor(days: JourneyDay[], transport: TransportSegment[]): number {
  const bookedActivities = days
    .flatMap((d) => d.activities)
    .filter((a) => a.booked && a.price != null)
    .reduce((sum, a) => sum + (a.price ?? 0), 0);
  const transportCost = transport.reduce((sum, t) => sum + (t.price ?? 0), 0);
  return bookedActivities + transportCost;
}

export function selectedDaysFor(event: CommunityEventCard, selection: BookingSelection): JourneyDay[] {
  const days = event.days ?? [];
  if (selection.mode === 'full' || selection.rangeStart == null || selection.rangeEnd == null) return days;
  return days.filter((d) => d.day >= selection.rangeStart! && d.day <= selection.rangeEnd!);
}

export interface EventCostBreakdown {
  accommodation: number;
  activities: number;
  food: number;
  transport: number;
  serviceCharges: number;
  estimatedTotal: number;
}

const HOTEL_KEYWORDS = ['hotel', 'check-in', 'check-out', 'boutique', 'resort'];
const MEAL_KEYWORDS = ['dinner', 'lunch', 'breakfast', 'dining', 'restaurant', 'meal', 'cuisine'];
const TRANSPORT_KEYWORDS = ['flight', 'train', 'bus', 'shuttle', 'transport', 'transfer', 'arrival', 'departure'];

/** Keyword fallback — only reached for an activity with no `costCategory`
 * (legacy/seeded/backend-loaded events that predate that field). Anything
 * built by EventHostAssistantService.buildItineraryDays() carries its own
 * costCategory and never needs this guess. */
function activityCostBucket(a: { title: string; category: string }): 'accommodation' | 'food' | 'transport' | 'activities' {
  const text = `${a.title} ${a.category}`.toLowerCase();
  if (HOTEL_KEYWORDS.some((k) => text.includes(k))) return 'accommodation';
  if (MEAL_KEYWORDS.some((k) => text.includes(k))) return 'food';
  if (TRANSPORT_KEYWORDS.some((k) => text.includes(k))) return 'transport';
  return 'activities';
}

/**
 * Aggregates an event's Cost Breakdown (Accommodation / Activities / Food /
 * Transport / Service Charges) for the pre-booking Event Summary page.
 *
 * Pure aggregation, not inference: every activity EventHostAssistantService
 * generates already carries a `costCategory` (see
 * event-cost-allocation.util.ts, which resolves the whole category split
 * from the host's budget/explicit overrides + itinerary composition at
 * itinerary-build time) and a real, non-hardcoded `price`. This function
 * only sums what's already tagged — activityCostBucket()'s keyword guess is
 * a fallback for legacy/seeded/backend-loaded activities that predate the
 * field, never the primary path.
 *
 * `baseFee` stays a separate flat add-on folded into `transport` — a host
 * can still set one for guiding/transfers/group logistics on top of
 * whatever the itinerary's own transport items already total; it's 0 for
 * events that don't set one, so it never resurrects the old
 * "transport = baseFee, everything else guessed" behavior.
 *
 * Because `day.price` is itself the sum of that day's own priced items (see
 * buildItineraryDays()), summing over ANY subset of `selectedDays` — a
 * partial-join range, or a multi-city day list — produces a correct
 * proportional breakdown automatically, with no special-casing here.
 */
export function buildEventCostBreakdown(selectedDays: JourneyDay[], baseFee: number): EventCostBreakdown {
  const totals = { accommodation: 0, activities: 0, food: 0, transport: 0 };

  for (const day of selectedDays) {
    for (const a of day.activities) {
      if (a.price == null) continue;
      const bucket = a.costCategory ?? activityCostBucket(a);
      totals[bucket] += a.price;
    }
  }

  const transport = totals.transport + baseFee;
  const subtotal = totals.accommodation + totals.activities + totals.food + transport;
  const serviceCharges = Math.round(subtotal * 0.05);
  const estimatedTotal = subtotal + serviceCharges;

  return { accommodation: totals.accommodation, activities: totals.activities, food: totals.food, transport, serviceCharges, estimatedTotal };
}

export function buildBookingSummary(event: CommunityEventCard, selection: BookingSelection): BookingSummary {
  const selectedDays = selectedDaysFor(event, selection);
  const totalDays = event.days?.length ?? 0;
  const cities = Array.from(new Set(selectedDays.map((d) => d.city)));
  const citiesLabel = cities.length ? cities.join(' → ') : event.cities?.join(' → ') ?? event.location;

  const participationLabel =
    selection.mode === 'full' ? `Full journey · ${selectedDays.length} days` : `Partial · ${selectedDays.length} days`;

  // Full journey: the event's own date range (now always computable via
  // eventDateRangeLabel — real ISO dates when available, a pre-baked label
  // otherwise — never blank just because dateRangeLabel wasn't set).
  // Partial journey: the sub-range of days actually selected.
  let datesLabel = eventDateRangeLabel(event);
  if (selectedDays.length && selection.mode !== 'full') {
    const first = selectedDays[0].dateLabel;
    const last = selectedDays[selectedDays.length - 1].dateLabel;
    datesLabel = first === last ? first : `${first} – ${last}`;
  }

  const nights =
    selection.mode === 'full' && event.nights != null ? event.nights : Math.max(selectedDays.length - 1, 0);

  const daysBookedLabel = selection.mode === 'full' ? `All ${totalDays} days` : `${selectedDays.length} of ${totalDays} days`;

  const firstCity = selectedDays[0]?.city ?? event.location;
  const lastCity = selectedDays[selectedDays.length - 1]?.city ?? event.location;
  const outboundLabel = `${HOME_CITY} → ${firstCity}`;
  const returnLabel = `${lastCity} → ${HOME_CITY}`;

  const subtotal = selectedDays.reduce((sum, d) => sum + d.price, 0);
  const journeyPackagePrice = subtotal + (event.baseFee ?? 0);
  const totalAmount = journeyPackagePrice + OUTBOUND_FARE + RETURN_FARE;

  return {
    selectedDays,
    totalDays,
    citiesLabel,
    participationLabel,
    datesLabel,
    nights,
    daysBookedLabel,
    outboundLabel,
    returnLabel,
    outboundFare: OUTBOUND_FARE,
    returnFare: RETURN_FARE,
    journeyPackagePrice,
    totalAmount
  };
}
