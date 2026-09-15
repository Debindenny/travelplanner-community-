import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TravelChatSessionService } from './travel-chat-session.service';
import { CommunityEventsMockStore, CURRENT_USER_ID } from '../../community/services/community-events-mock.store';
import {
  CommunityEventCard,
  EventScheduleStep,
  JourneyActivity,
  JourneyDay,
  journeyActivityToTripSegment,
  unsplashUrl
} from '../../community/services/community-event-view.model';
import { TripDay, TripService } from '../../trip/trip.service';

export type EventJoinOption = 'full' | 'partial' | 'both';

export interface EventHostForm {
  title: string;
  eventType: string;
  travelStyle: string[];
  startLocation: string;
  viaLocations: string[];
  destination: string;
  startDate: string;
  endDate: string;
  participantLimit: number | null;
  budget: string;
  description: string;
  activities: string[];
  accommodation: string;
  transportation: string;
  joinOption: EventJoinOption;
  /** Shortest/longest consecutive stretch a partial-join traveler may pick.
   * null means "no limit configured" — clamped to the real day count later. */
  joinRange: { min: number; max: number } | null;
}

const EMPTY_FORM: EventHostForm = {
  title: '',
  eventType: '',
  travelStyle: [],
  startLocation: '',
  viaLocations: [],
  destination: '',
  startDate: '',
  endDate: '',
  participantLimit: null,
  budget: '',
  description: '',
  activities: [],
  accommodation: '',
  transportation: '',
  joinOption: 'full',
  joinRange: null
};

function dateLabel(d: Date): string {
  return `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}`;
}

const EVENT_ACTIVITY_TIMES = ['09:00', '14:00', '19:00'];

/** Small pool of generic travel-themed thumbnails for host-authored activities
 * (no real photo per activity exists — these are decorative, not unique). */
const EVENT_ACTIVITY_IMAGE_IDS = [
  '1499856871958-5b9627545d1a', // old-town street
  '1499425543974-31970c11ecd8', // museum interior
  '1502602898657-3e91760cbb34', // landmark
  '1470337458703-46ad1756a187', // rooftop bar
  '1507525428034-b723cf961d3e', // beach
  '1512453979798-5ea266f8880c'  // culture/show
];

const HOTEL_IMAGE_ID = '1566073771259-6a8506099945';
const TRANSPORT_IMAGE_ID = '1474487548417-781cb71495f3';

const WELCOME_MESSAGE =
  "Hi! 👋 I'm your Event Hosting Assistant.\nI'll help you create and publish your event.\nLet's get started.\nWhat type of event would you like to host?";

type ParseResult = { ok: true; value: unknown } | { ok: false; error: string };
type Parser = (raw: string, form: EventHostForm) => ParseResult;

interface FieldDef {
  key: keyof EventHostForm;
  question: (form: EventHostForm) => string;
  parse: Parser;
  skip?: (form: EventHostForm) => boolean;
}

function requiredText(errorMsg: string): Parser {
  return (raw) => {
    const v = raw.trim();
    return v ? { ok: true, value: v } : { ok: false, error: errorMsg };
  };
}

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function date(): Parser {
  return (raw) => {
    const v = raw.trim();
    const d = ISO_DATE.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
    if (isNaN(d.getTime())) return { ok: false, error: "I couldn't read that date — try YYYY-MM-DD, e.g. 2026-09-10." };
    return { ok: true, value: localDateString(d) };
  };
}

function endDate(): Parser {
  const base = date();
  return (raw, form) => {
    const result = base(raw, form);
    if (!result.ok) return result;
    if (form.startDate && (result.value as string) < form.startDate) {
      return { ok: false, error: "The end date can't be before the start date — try again." };
    }
    return result;
  };
}

function positiveInt(): Parser {
  return (raw) => {
    const n = parseInt(raw.trim(), 10);
    return Number.isFinite(n) && n > 0 ? { ok: true, value: n } : { ok: false, error: 'Give me a number greater than 0.' };
  };
}

function activityList(): Parser {
  return (raw) => {
    const items = raw
      .split(/,|\band\b/i)
      .map((s) => s.trim())
      .filter(Boolean);
    return items.length
      ? { ok: true, value: items }
      : { ok: false, error: 'List at least one activity — separate multiple with commas.' };
  };
}

/** Optional comma-separated list — "skip"/"none"/blank all mean "no stops". */
function optionalList(): Parser {
  return (raw) => {
    const v = raw.trim();
    if (!v || /^(skip|none|n\/a|na)$/i.test(v)) return { ok: true, value: [] };
    const items = v.split(',').map((s) => s.trim()).filter(Boolean);
    return { ok: true, value: items };
  };
}

function choice(options: string[]): Parser {
  return (raw) => {
    const v = raw.trim().toLowerCase();
    const match = options.find((o) => o.toLowerCase() === v || o.toLowerCase().startsWith(v));
    return match
      ? { ok: true, value: match.toLowerCase() }
      : { ok: false, error: `Please answer one of: ${options.join(', ')}.` };
  };
}

/** "2 to 4" / "2-4" → { min: 2, max: 4 }; "any"/"skip"/"none" → no limit. */
function dayRange(): Parser {
  return (raw) => {
    const text = raw.trim().toLowerCase();
    if (/^(any|skip|none|no limit)$/.test(text)) return { ok: true, value: null };
    const m = text.match(/(\d+)\s*(?:-|to|–)\s*(\d+)/);
    if (!m) {
      return { ok: false, error: 'Give me a day range like "2 to 4", or type "any" for no limit.' };
    }
    const min = parseInt(m[1], 10);
    const max = parseInt(m[2], 10);
    if (!(min > 0) || max < min) {
      return { ok: false, error: 'The range should go from a smaller day number to a larger one, e.g. "2 to 4".' };
    }
    return { ok: true, value: { min, max } };
  };
}

/** Detects a flight/train/bus mode from the free-text transportation answer so
 * the arrival/departure activity title matches ItineraryTimelineComponent's
 * locked-reservation pattern (Hotel Check-in/out, Flight/Train/Bus
 * Departure/Arrival). Car and unrecognized/self-arranged transportation stay
 * generic — those aren't in the locked list, matching the business rule that
 * only these four reservation types are fixed. */
function transportModeLabel(transportation: string): 'Flight' | 'Train' | 'Bus' | null {
  const t = transportation.toLowerCase();
  if (/\b(flight|fly|flying|plane|air)\b/.test(t)) return 'Flight';
  if (/\btrain\b/.test(t)) return 'Train';
  if (/\bbus\b/.test(t)) return 'Bus';
  return null;
}

/** Parses "$500", "₹20000", "2k", "1.5L", "Free" into a rough numeric amount
 * (0 when unparseable) — used to spread a whole-trip budget across days. */
function parseBudgetAmount(raw: string): number {
  const text = raw.toLowerCase().replace(/,/g, '');
  if (/\bfree\b/.test(text)) return 0;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(k|l|lac|lakh)?/);
  if (!match) return 0;
  const n = parseFloat(match[1]);
  if (!Number.isFinite(n)) return 0;
  const unit = match[2];
  if (unit === 'k') return Math.round(n * 1_000);
  if (unit === 'l' || unit === 'lac' || unit === 'lakh') return Math.round(n * 100_000);
  return Math.round(n);
}

const FIELDS: FieldDef[] = [
  { key: 'eventType', question: () => "What type of event would you like to host?", parse: requiredText('What type of event is this — tell me in a few words.') },
  { key: 'title', question: () => "Got it! What should we call this event?", parse: requiredText("Give it a title so travelers recognize it — what's it called?") },
  { key: 'startLocation', question: () => 'Where does the journey start from?', parse: requiredText('Tell me the starting location.') },
  { key: 'viaLocations', question: () => 'Any stops along the way? (comma-separated, or type "skip")', parse: optionalList() },
  { key: 'destination', question: () => 'Where will this event take place — the final destination?', parse: requiredText('Tell me the destination.') },
  { key: 'travelStyle', question: () => 'What travel styles describe this trip? (e.g. Adventure, Nature, Trekking — comma-separated)', parse: activityList() },
  { key: 'startDate', question: () => "When does it start? (YYYY-MM-DD)", parse: date() },
  { key: 'endDate', question: (f) => `And when does it end? (YYYY-MM-DD, on or after ${f.startDate})`, parse: endDate() },
  { key: 'participantLimit', question: () => "What's the maximum number of participants?", parse: positiveInt() },
  { key: 'budget', question: () => "What's the budget for this event?", parse: requiredText('Give me a budget, e.g. "$500" or "Free".') },
  { key: 'description', question: () => "Describe the event — what's it about, and who should join?", parse: requiredText('A short description helps travelers decide to join — try again?') },
  { key: 'activities', question: () => 'What activities are planned? (separate multiple with commas)', parse: activityList() },
  { key: 'accommodation', question: () => 'Any accommodation preferences?', parse: requiredText('Tell me the accommodation preference — e.g. "hotel", "hostel", or "not needed".') },
  { key: 'transportation', question: () => 'What are the transportation requirements?', parse: requiredText('Tell me the transportation requirement — e.g. "flights included" or "self-arranged".') },
  {
    key: 'joinOption',
    question: () =>
      'How can participants join this event — reply "full" (full journey only), "partial" (partial journey only), or "both"?',
    parse: choice(['full', 'partial', 'both'])
  },
  {
    key: 'joinRange',
    question: () => "What's the shortest and longest stretch of days someone can join? (e.g. \"2 to 4\", or \"any\" for no limit)",
    parse: dayRange(),
    skip: (f) => f.joinOption === 'full'
  }
];

/**
 * Drives the "host an event" conversation as plain turns inside the existing
 * AI chatbot's thread (TravelChatSessionService.messages) — no separate page,
 * panel, or component. floating-chatbot.component.ts and hero-section.component.ts
 * route composer submits here instead of to the real chat backend while
 * `active()` is true, and tag every bubble with the 'event_host' chat intent so
 * the existing mode-badge UI marks this as a distinct assistant mode.
 */
@Injectable({ providedIn: 'root' })
export class EventHostAssistantService {
  private readonly chat = inject(TravelChatSessionService);
  private readonly store = inject(CommunityEventsMockStore);
  private readonly router = inject(Router);
  private readonly tripService = inject(TripService);

  readonly active = signal(false);
  private readonly form = signal<EventHostForm>({ ...EMPTY_FORM });
  private fieldPointer = 0;
  private awaitingConfirmation = false;

  start(): void {
    if (this.active()) return;
    this.active.set(true);
    this.form.set({ ...EMPTY_FORM });
    this.fieldPointer = 0;
    this.awaitingConfirmation = false;
    this.pushAssistant(WELCOME_MESSAGE);
  }

  submitAnswer(raw: string): void {
    if (!this.active()) return;
    const text = raw.trim();
    if (!text) return;
    this.pushUser(text);

    if (/^cancel$/i.test(text)) {
      this.active.set(false);
      this.pushAssistant('No problem — cancelled hosting setup. Ask me anything else to keep planning your own trip.');
      return;
    }

    if (this.awaitingConfirmation) {
      this.handleConfirmationReply(text);
      return;
    }

    if (/^(back|edit)$/i.test(text)) {
      this.stepBack();
      return;
    }

    const field = this.currentField();
    if (!field) return;
    const result = field.parse(text, this.form());
    if (!result.ok) {
      this.pushAssistant(result.error);
      return;
    }
    const key = field.key;
    this.form.update((f) => ({ ...f, [key]: result.value }) as EventHostForm);
    this.advance();
  }

  private currentField(): FieldDef | null {
    return FIELDS[this.fieldPointer] ?? null;
  }

  private advance(): void {
    let next = this.fieldPointer + 1;
    while (next < FIELDS.length && FIELDS[next].skip?.(this.form())) next++;
    this.fieldPointer = next;
    if (next >= FIELDS.length) {
      this.showSummary();
      return;
    }
    this.askCurrent();
  }

  private stepBack(): void {
    if (this.fieldPointer === 0) {
      this.pushAssistant("We're at the very first question already — what type of event would you like to host?");
      return;
    }
    this.awaitingConfirmation = false;
    this.fieldPointer -= 1;
    while (this.fieldPointer > 0 && FIELDS[this.fieldPointer].skip?.(this.form())) this.fieldPointer--;
    this.askCurrent(true);
  }

  private askCurrent(isRedo = false): void {
    const field = this.currentField();
    if (!field) {
      this.showSummary();
      return;
    }
    const prefix = isRedo ? "Sure — let's redo this one.\n\n" : '';
    this.pushAssistant(prefix + field.question(this.form()));
  }

  private showSummary(): void {
    this.awaitingConfirmation = true;
    const f = this.form();
    const joinLabel =
      f.joinOption === 'full'
        ? 'Full journey only'
        : f.joinOption === 'partial'
          ? 'Partial journey only'
          : 'Full or partial journey';
    const lines = [
      `**Event Title:** ${f.title}`,
      `**Event Type:** ${f.eventType}`,
      `**Start Location:** ${f.startLocation}`,
      ...(f.viaLocations.length ? [`**Via:** ${f.viaLocations.join(', ')}`] : []),
      `**Destination:** ${f.destination}`,
      `**Travel Style:** ${f.travelStyle.join(', ')}`,
      `**Start Date:** ${f.startDate}`,
      `**End Date:** ${f.endDate}`,
      `**Participant Limit:** ${f.participantLimit}`,
      `**Budget:** ${f.budget}`,
      `**Description:** ${f.description}`,
      `**Planned Activities:** ${f.activities.join(', ')}`,
      `**Accommodation Preferences:** ${f.accommodation}`,
      `**Transportation Requirements:** ${f.transportation}`,
      `**Participation:** ${joinLabel}`,
      ...(f.joinOption !== 'full' && f.joinRange
        ? [`**Joinable Range:** ${f.joinRange.min}-${f.joinRange.max} consecutive days`]
        : [])
    ];
    this.pushAssistant(
      `Here's everything for your event:\n\n${lines.join('\n')}\n\nType **confirm** to create it, or **edit** to go back and change something.`
    );
  }

  private handleConfirmationReply(text: string): void {
    if (/^confirm$/i.test(text)) {
      this.createEvent();
      return;
    }
    if (/^(edit|back)$/i.test(text)) {
      this.stepBack();
      return;
    }
    this.pushAssistant('Type **confirm** to create the event, or **edit** to change an answer.');
  }

  /** Publishes the event and, whenever possible, turns its itinerary into a
   * real Trip via TripService.createFromContent() — the same backend path
   * used to make a joined hosted journey "a real, editable itinerary" — so
   * viewing/editing it happens on the actual /itinerary/:id page (same
   * component, same cards, same lock rules) instead of a lookalike. Falls
   * back to the community event list if that call fails (e.g. offline, or
   * the host isn't logged in) so publishing never silently breaks. */
  private async createEvent(): Promise<void> {
    const f = this.form();
    const card = this.buildEventCard(f);
    this.store.addEvent(card);

    try {
      const days: TripDay[] = (card.days ?? []).map((d) => ({
        day: d.day,
        title: d.city,
        activities: d.activities.map((a) => a.title)
      }));
      const segments = (card.days ?? []).flatMap((d) => d.activities.map((a) => journeyActivityToTripSegment(a, d)));
      const tripId = await this.tripService.createFromContent({
        title: card.title,
        destination: f.destination,
        startDate: f.startDate,
        endDate: f.endDate,
        travelers: 1,
        budget: f.budget,
        image: card.imageUrl,
        days,
        segments,
        customizations: { eventId: card.id, hostedEvent: true }
      });
      card.tripId = tripId;
      this.store.setPendingToast(`"${card.title}" is live — visible to the community`);
      this.active.set(false);
      this.pushAssistant(`🎉 "${card.title}" is live! Taking you to your itinerary…`);
      setTimeout(() => this.router.navigateByUrl(`/itinerary/${tripId}`), 1200);
    } catch (err) {
      console.error('Could not publish this event as a real trip — falling back to the community listing', err);
      this.store.setPendingToast(`"${card.title}" is live — visible to the community`);
      this.active.set(false);
      this.pushAssistant(`🎉 "${card.title}" is live! Taking you to your event…`);
      setTimeout(() => this.router.navigateByUrl('/community/events'), 1400);
    }
  }

  private buildEventCard(f: EventHostForm): CommunityEventCard {
    const start = f.startDate ? new Date(`${f.startDate}T00:00:00`) : new Date();
    const end = f.endDate ? new Date(`${f.endDate}T00:00:00`) : start;
    const days = this.buildItineraryDays(f);
    const dayCount = days.length;
    const description = f.eventType ? `${f.description}\n\nEvent type: ${f.eventType}` : f.description;

    const partialJoinAllowed = f.joinOption !== 'full';
    const fullJoinAllowed = f.joinOption !== 'partial';
    // Clamp the host's requested range to the trip's actual length — a range
    // configured before the dates were final could otherwise exceed it.
    const minConsecutiveDays = partialJoinAllowed
      ? Math.max(1, Math.min(f.joinRange?.min ?? 1, dayCount || 1))
      : undefined;
    const maxConsecutiveDays = partialJoinAllowed
      ? Math.max(minConsecutiveDays ?? 1, Math.min(f.joinRange?.max ?? dayCount, dayCount || 1))
      : undefined;

    return {
      id: `evt-${Date.now()}`,
      title: f.title,
      subtitle: `${f.eventType || 'Community'} in ${f.destination}`,
      location: f.destination,
      time: '',
      duration: this.tripDurationLabel(f),
      price: f.budget || 'Free',
      travelersGoing: 1,
      travelersMax: f.participantLimit ?? undefined,
      month: start.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: start.getDate().toString().padStart(2, '0'),
      dateRangeLabel: `${dateLabel(start)} - ${dateLabel(end)}`,
      nights: Math.max(0, dayCount - 1),
      partialJoinAllowed,
      fullJoinAllowed,
      minConsecutiveDays,
      maxConsecutiveDays,
      tag: 'Meetup',
      joined: false,
      followed: false,
      imageUrl: unsplashUrl('1488646953014-85cb44e25828'),
      hostId: CURRENT_USER_ID,
      hostName: 'You',
      hostRole: '',
      reason: '',
      description,
      groupMax: f.participantLimit ? `${f.participantLimit} max` : '',
      schedule: this.buildScheduleSteps(f),
      locationName: f.destination,
      locationNote: f.participantLimit ? `Max participants: ${f.participantLimit}` : '',
      // Route trail (Start → Via → Destination) — same field seeded multi-city
      // journeys use for their city-chip trail on the card and detail page.
      cities: [f.startLocation, ...f.viaLocations, f.destination].filter(Boolean),
      // Real collected travel styles — takes over the card's theme chips so it
      // never falls back to showing the raw location/budget as pseudo-tags.
      interestTags: f.travelStyle,
      days: dayCount ? days : undefined
    };
  }

  /** Builds a day-by-day itinerary that reuses the SAME flight/hotel/bus/train
   * cards a real trip's itinerary shows (see ItineraryTimelineComponent) —
   * not generic activity cards with a descriptive title. Day 1 gets the
   * arrival transit leg (+ an airport-shuttle bus leg when arriving by
   * flight) and the hotel stay; the last day (if the trip is more than one
   * day) gets only the departure transit leg, mirroring how a real itinerary
   * has no new activities planned on the travel-home day. Everything in
   * between gets one activity from the collected pool per day. Flight/hotel/
   * bus/train items are always non-editable (see ItineraryTimelineComponent.
   * isLocked) — that's what actually enforces "reservations can't be
   * changed", not the title text. */
  private buildItineraryDays(f: EventHostForm): JourneyDay[] {
    if (!f.startDate || !f.endDate) return [];
    const start = new Date(`${f.startDate}T00:00:00`);
    const end = new Date(`${f.endDate}T00:00:00`);
    const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const pool = f.activities.length ? f.activities : ['Free time to explore'];
    const totalBudget = parseBudgetAmount(f.budget);
    const perDayPrice = dayCount ? Math.round(totalBudget / dayCount) : 0;
    const mode = transportModeLabel(f.transportation);
    // No activities are planned on a pure departure day — matches a real itinerary.
    const activityDayCount = dayCount > 1 ? dayCount - 1 : 1;
    let idSeq = 0;
    const nextId = () => `evt-item-${++idSeq}`;

    const days: JourneyDay[] = [];
    for (let dayNum = 1; dayNum <= dayCount; dayNum++) {
      const date = new Date(start);
      date.setDate(start.getDate() + (dayNum - 1));
      const isDepartureOnlyDay = dayCount > 1 && dayNum === dayCount;
      const items: JourneyActivity[] = [];

      if (dayNum === 1) {
        items.push(this.buildTransitLeg(f, nextId(), mode, 'arrival', date));
        if (mode === 'Flight') {
          items.push(this.buildAirportShuttle(f, nextId(), 'arrival', date));
        }
        items.push(this.buildHotelStay(f, nextId(), start, end));
      }

      if (!isDepartureOnlyDay) {
        const titles =
          activityDayCount >= pool.length
            ? [pool[(dayNum - 1) % pool.length]]
            : pool.slice(
                Math.floor(((dayNum - 1) * pool.length) / activityDayCount),
                Math.floor((dayNum * pool.length) / activityDayCount),
              );
        for (const [i, title] of (titles.length ? titles : [pool[0]]).entries()) {
          items.push({
            id: nextId(),
            title: title.replace(/\b\w/g, (c) => c.toUpperCase()),
            time: EVENT_ACTIVITY_TIMES[i % EVENT_ACTIVITY_TIMES.length],
            category: 'Planned Activity',
            duration: '',
            rating: 4.5,
            image: unsplashUrl(EVENT_ACTIVITY_IMAGE_IDS[(dayNum + i) % EVENT_ACTIVITY_IMAGE_IDS.length], 400),
            price: null,
            included: true
          });
        }
      } else {
        // Mirrors the real itinerary page's last-day sequence: check out of
        // the hotel, transfer back to the airport/station, then depart.
        items.push(this.buildHotelCheckout(f, nextId()));
        if (mode === 'Flight') {
          items.push(this.buildAirportShuttle(f, nextId(), 'departure', date));
        }
        items.push(this.buildTransitLeg(f, nextId(), mode, 'departure', date));
      }

      days.push({
        day: dayNum,
        city: f.destination,
        dateLabel: dateLabel(date),
        price: perDayPrice,
        activities: items
      });
    }
    return days;
  }

  /** A flight/train/bus card for the arrival or departure leg. Falls back to a
   * plain (unlocked) generic activity when the transportation answer doesn't
   * name a recognized mode (e.g. "self-arranged", "rental car") — there's no
   * real reservation to render a fixed card for in that case. */
  private buildTransitLeg(
    f: EventHostForm,
    id: string,
    mode: 'Flight' | 'Train' | 'Bus' | null,
    direction: 'arrival' | 'departure',
    legDate: Date,
  ): JourneyActivity {
    if (!mode) {
      return {
        id,
        title: direction === 'arrival' ? `Arrival — ${f.transportation}` : `Departure — ${f.transportation}`,
        time: direction === 'arrival' ? '09:00' : '16:00',
        category: 'Transportation',
        duration: '',
        rating: 0,
        image: unsplashUrl(TRANSPORT_IMAGE_ID, 400),
        price: null,
        included: true
      };
    }
    const from = direction === 'arrival' ? f.startLocation : f.destination;
    const to = direction === 'arrival' ? f.destination : f.startLocation;
    const depTime = direction === 'arrival' ? '09:00' : '14:00';
    const arrTime = direction === 'arrival' ? '11:15' : '16:30';
    const label = dateLabel(legDate);
    const title = mode === 'Flight' ? `Flight to ${to}` : `${mode} to ${to}`;

    if (mode === 'Flight') {
      return {
        id,
        title,
        time: depTime,
        category: 'Transportation',
        duration: '2h 15m',
        rating: 0,
        image: unsplashUrl(TRANSPORT_IMAGE_ID, 400),
        price: null,
        included: true,
        kind: 'flight',
        carrier: 'TravlAir',
        flightNo: this.fabricateCode('TA', to),
        flightClass: 'Economy',
        refundable: 'Partially Refundable',
        depDate: label,
        depCode: from,
        arrDate: label,
        arrTime,
        arrCode: to,
        stops: 'Direct',
        // Nothing has actually been booked against a real airline yet.
        status: 'Pending'
      };
    }
    return {
      id,
      title,
      time: depTime,
      category: 'Transportation',
      duration: '2h 15m',
      rating: 0,
      image: unsplashUrl(TRANSPORT_IMAGE_ID, 400),
      price: null,
      included: true,
      kind: mode === 'Train' ? 'train' : 'bus',
      carrier: mode === 'Train' ? 'InterCity Rail' : 'RoadLink Express',
      route: `${from} → ${to}`,
      depDate: label,
      depLocation: from,
      arrDate: label,
      arrTime,
      arrLocation: to,
      stops: 'Direct'
    };
  }

  /** After landing, a flight doesn't drop travelers at the door — an airport
   * shuttle bus leg to/from the hotel is added only around flight legs
   * (train/bus arrivals already end at an in-town station/stop, and a car/
   * self-arranged traveler supplies their own ground transport). */
  private buildAirportShuttle(f: EventHostForm, id: string, direction: 'arrival' | 'departure', legDate: Date): JourneyActivity {
    const label = dateLabel(legDate);
    const airport = `${f.destination} Airport`;
    const downtown = `Downtown ${f.destination}`;
    const from = direction === 'arrival' ? airport : downtown;
    const to = direction === 'arrival' ? downtown : airport;
    const depTime = direction === 'arrival' ? '11:45' : '10:30';
    const arrTime = direction === 'arrival' ? '12:45' : '11:30';
    return {
      id,
      title: 'Airport Express Shuttle',
      time: depTime,
      category: 'Transportation',
      duration: '1h 00m',
      rating: 0,
      image: unsplashUrl(TRANSPORT_IMAGE_ID, 400),
      price: null,
      included: true,
      kind: 'bus',
      carrier: 'Airport Express',
      route: `${from} → ${to}`,
      depDate: label,
      depLocation: from,
      arrDate: label,
      arrTime,
      arrLocation: to,
      stops: 'Direct'
    };
  }

  /** Locked checkout marker on the last day — the hotel stay itself is the
   * single spanning card built by buildHotelStay() on day 1; this just marks
   * the checkout milestone in the day's sequence (matches
   * ItineraryTimelineComponent's "Hotel Check-out" lock pattern). */
  private buildHotelCheckout(f: EventHostForm, id: string): JourneyActivity {
    return {
      id,
      title: `Hotel Check-out: ${f.accommodation}`,
      time: '10:00',
      category: 'Check-out',
      duration: '',
      rating: 0,
      image: unsplashUrl(HOTEL_IMAGE_ID, 400),
      price: null,
      included: true
    };
  }

  /** One hotel card spanning the whole stay (rather than separate check-in/
   * check-out fragments) — matches how a real itinerary shows a single
   * reserved-stay card with its full date range. */
  private buildHotelStay(f: EventHostForm, id: string, start: Date, end: Date): JourneyActivity {
    return {
      id,
      title: f.accommodation,
      time: '14:00',
      category: 'Accommodation',
      duration: '',
      rating: 4.2,
      image: unsplashUrl(HOTEL_IMAGE_ID, 400),
      price: null,
      included: true,
      kind: 'hotel',
      amenities: ['Free WiFi', 'Breakfast', 'Airport Shuttle'],
      hotelDates: `${dateLabel(start)} – ${dateLabel(end)}`,
      cancellation: 'Free cancellation until 48h'
    };
  }

  /** Deterministic pseudo flight/train number so re-rendering the same event
   * doesn't produce a different number each time. */
  private fabricateCode(prefix: string, seed: string): string {
    let hash = 0;
    for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `${prefix}${100 + (hash % 900)}`;
  }

  private buildScheduleSteps(f: EventHostForm): EventScheduleStep[] {
    const route = [f.startLocation, ...f.viaLocations, f.destination].filter(Boolean).join(' → ');
    const steps: EventScheduleStep[] = [
      { time: '', text: `Route: ${route}` },
      { time: '', text: `Arrival in ${f.destination} — transportation: ${f.transportation}` }
    ];
    if (f.accommodation) {
      steps.push({ time: '', text: `Accommodation: ${f.accommodation}` });
    }
    steps.push({ time: '', text: `Departure from ${f.destination}` });
    return steps;
  }

  private tripDurationLabel(f: EventHostForm): string {
    if (!f.startDate || !f.endDate) return '';
    const start = new Date(`${f.startDate}T00:00:00`);
    const end = new Date(`${f.endDate}T00:00:00`);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    return days === 1 ? '1 day' : `${days} days`;
  }

  private pushAssistant(text: string): void {
    this.chat.messages.update((m) => [...m, { role: 'assistant', text, intent: 'event_host' }]);
    this.chat.requestScroll();
  }

  private pushUser(text: string): void {
    this.chat.messages.update((m) => [...m, { role: 'user', text }]);
  }
}
