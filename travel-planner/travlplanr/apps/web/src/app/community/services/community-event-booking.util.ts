import { CommunityEventCard, JourneyDay, TransportSegment } from './community-event-view.model';

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

const HOTEL_KEYWORDS = ['hotel', 'check-in', 'boutique', 'resort'];
const MEAL_KEYWORDS = ['dinner', 'lunch', 'breakfast', 'dining', 'restaurant', 'meal', 'cuisine'];

function activityCostBucket(a: { title: string; category: string }): 'accommodation' | 'food' | 'activities' {
  const text = `${a.title} ${a.category}`.toLowerCase();
  if (HOTEL_KEYWORDS.some((k) => text.includes(k))) return 'accommodation';
  if (MEAL_KEYWORDS.some((k) => text.includes(k))) return 'food';
  return 'activities';
}

/**
 * Approximates an event package's cost by category (Accommodation / Activities / Food /
 * Transport / Service Charges) for the pre-booking Event Summary page. There's no backend field
 * that itemizes a day's flat rate this way, so each priced activity is bucketed by keyword and
 * a day's un-itemized balance (its flat price minus what its own activities already account for)
 * folds into Accommodation, since that remainder is mostly lodging/logistics baked into the day
 * rate. `transport` is the event's flat local-transport/event-access allowance (`baseFee`).
 */
export function buildEventCostBreakdown(selectedDays: JourneyDay[], baseFee: number): EventCostBreakdown {
  let accommodation = 0;
  let food = 0;
  let activities = 0;

  for (const day of selectedDays) {
    let itemized = 0;
    for (const a of day.activities) {
      if (a.price == null) continue;
      itemized += a.price;
      const bucket = activityCostBucket(a);
      if (bucket === 'accommodation') accommodation += a.price;
      else if (bucket === 'food') food += a.price;
      else activities += a.price;
    }
    accommodation += Math.max(0, day.price - itemized);
  }

  const transport = baseFee;
  const subtotal = accommodation + activities + food + transport;
  const serviceCharges = Math.round(subtotal * 0.05);
  const estimatedTotal = subtotal + serviceCharges;

  return { accommodation, activities, food, transport, serviceCharges, estimatedTotal };
}

export function buildBookingSummary(event: CommunityEventCard, selection: BookingSelection): BookingSummary {
  const selectedDays = selectedDaysFor(event, selection);
  const totalDays = event.days?.length ?? 0;
  const cities = Array.from(new Set(selectedDays.map((d) => d.city)));
  const citiesLabel = cities.length ? cities.join(' → ') : event.cities?.join(' → ') ?? event.location;

  const participationLabel =
    selection.mode === 'full' ? `Full journey · ${selectedDays.length} days` : `Partial · ${selectedDays.length} days`;

  let datesLabel = event.dateRangeLabel ?? '';
  if (selectedDays.length) {
    if (selection.mode === 'full' && event.dateRangeLabel) {
      datesLabel = event.dateRangeLabel;
    } else {
      const first = selectedDays[0].dateLabel;
      const last = selectedDays[selectedDays.length - 1].dateLabel;
      datesLabel = first === last ? first : `${first} – ${last}`;
    }
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
