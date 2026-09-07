import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TravelChatSessionService } from './travel-chat-session.service';
import { CommunityEventsService, CreateEventPayload } from '../../community/services/community-events.service';

export interface EventHostForm {
  eventName: string;
  description: string;
  tripType: string;
  travelStyle: string;
  startingPlace: string;
  destination: string;
  endLocationDiffers: boolean;
  endLocation: string;
  startDate: string;
  endDate: string;
  minStayDuration: string;
  transportation: string;
  specialRequirements: string;
  maxTravelers: number | null;
  additionalNotes: string;
}

const EMPTY_FORM: EventHostForm = {
  eventName: '',
  description: '',
  tripType: '',
  travelStyle: '',
  startingPlace: '',
  destination: '',
  endLocationDiffers: false,
  endLocation: '',
  startDate: '',
  endDate: '',
  minStayDuration: '',
  transportation: '',
  specialRequirements: '',
  maxTravelers: null,
  additionalNotes: ''
};

type ParseResult = { ok: true; value: unknown } | { ok: false; error: string };
type Parser = (raw: string, form: EventHostForm) => ParseResult;

interface FieldDef {
  key: keyof EventHostForm;
  step: 1 | 2 | 3 | 4 | 5;
  stepTitle: string;
  question: (form: EventHostForm) => string;
  parse: Parser;
  skip?: (form: EventHostForm) => boolean;
}

const TRIP_TYPES = ['Adventure', 'Leisure', 'Business', 'Family', 'Solo', 'Group'];
const TRAVEL_STYLES = ['Budget', 'Standard', 'Luxury'];
const TRANSPORT_OPTIONS = ['Public Transport', 'Rental Car', 'Taxi', 'Private Vehicle', 'Walking', 'Mixed'];

function requiredText(errorMsg: string): Parser {
  return (raw) => {
    const v = raw.trim();
    return v ? { ok: true, value: v } : { ok: false, error: errorMsg };
  };
}

function optionalText(): Parser {
  return (raw) => {
    const v = raw.trim();
    if (!v || /^(skip|none|n\/a|na)$/i.test(v)) return { ok: true, value: '' };
    return { ok: true, value: v };
  };
}

function choice(options: string[]): Parser {
  return (raw) => {
    const v = raw.trim().toLowerCase();
    const match = options.find((o) => o.toLowerCase() === v || o.toLowerCase().startsWith(v));
    return match ? { ok: true, value: match } : { ok: false, error: `I didn't catch that — pick one of: ${options.join(', ')}.` };
  };
}

function yesNo(): Parser {
  return (raw) => {
    const v = raw.trim().toLowerCase();
    if (/^y(es)?$/.test(v)) return { ok: true, value: true };
    if (/^n(o)?$/.test(v)) return { ok: true, value: false };
    return { ok: false, error: 'Just answer yes or no.' };
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

const FIELDS: FieldDef[] = [
  { key: 'eventName', step: 1, stepTitle: 'Event Information', question: () => "What's the event called?", parse: requiredText("Give it a name so travelers recognize it — what's it called?") },
  { key: 'description', step: 1, stepTitle: 'Event Information', question: () => "Nice! Now describe it — what's it about, and who should join?", parse: requiredText('A short description helps travelers decide to join — try again?') },
  { key: 'tripType', step: 1, stepTitle: 'Event Information', question: () => `What kind of trip is this — ${TRIP_TYPES.join(', ')}?`, parse: choice(TRIP_TYPES) },
  { key: 'travelStyle', step: 1, stepTitle: 'Event Information', question: () => `What travel style — ${TRAVEL_STYLES.join(', ')}?`, parse: choice(TRAVEL_STYLES) },

  { key: 'startingPlace', step: 2, stepTitle: 'Route & Destinations', question: () => 'Where does the journey start?', parse: requiredText('Tell me the starting place.') },
  { key: 'destination', step: 2, stepTitle: 'Route & Destinations', question: () => 'And where are you headed — the destination?', parse: requiredText('Tell me the destination.') },
  { key: 'endLocationDiffers', step: 2, stepTitle: 'Route & Destinations', question: () => 'Does it end somewhere different from where it starts? (yes/no)', parse: yesNo() },
  {
    key: 'endLocation',
    step: 2,
    stepTitle: 'Route & Destinations',
    question: () => 'Where does it end?',
    parse: requiredText('Tell me the end location.'),
    skip: (f) => !f.endLocationDiffers
  },

  { key: 'startDate', step: 3, stepTitle: 'Schedule', question: () => 'What\'s the start date? (YYYY-MM-DD)', parse: date() },
  { key: 'endDate', step: 3, stepTitle: 'Schedule', question: (f) => `And the end date? (YYYY-MM-DD, on or after ${f.startDate})`, parse: endDate() },
  { key: 'minStayDuration', step: 3, stepTitle: 'Schedule', question: () => 'What\'s the minimum stay? (e.g. "3 nights")', parse: requiredText('Give me a minimum stay, e.g. "3 nights".') },

  { key: 'transportation', step: 4, stepTitle: 'Travel Preferences', question: () => `How will the group get around the city — ${TRANSPORT_OPTIONS.join(', ')}?`, parse: choice(TRANSPORT_OPTIONS) },
  { key: 'specialRequirements', step: 4, stepTitle: 'Travel Preferences', question: () => 'Any special travel requirements? (accessibility, pace, dietary — or type "skip")', parse: optionalText() },

  { key: 'maxTravelers', step: 5, stepTitle: 'Capacity & Participation', question: () => "What's the maximum number of travelers?", parse: positiveInt() },
  { key: 'additionalNotes', step: 5, stepTitle: 'Capacity & Participation', question: () => 'Anything else travelers should know? (or type "skip")', parse: optionalText() }
];

/**
 * Drives the "host an event" conversation as plain turns inside the existing
 * AI Travel Planner chat thread (TravelChatSessionService.messages) — no
 * separate page or panel. hero-section.component.ts routes composer submits
 * here instead of to the real chat backend while `active()` is true.
 */
@Injectable({ providedIn: 'root' })
export class EventHostAssistantService {
  private readonly chat = inject(TravelChatSessionService);
  private readonly eventsService = inject(CommunityEventsService);
  private readonly router = inject(Router);

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
    this.askCurrent();
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
      this.pushAssistant("We're at the very first question already — what's the event called?");
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
    const isFirstOfStep = this.fieldPointer === 0 || FIELDS[this.fieldPointer - 1].step !== field.step;
    const tag = isFirstOfStep ? `**Step ${field.step} of 5 — ${field.stepTitle}**\n\n` : '';
    const prefix = isRedo ? "Sure — let's redo this one.\n\n" : '';
    this.pushAssistant(prefix + tag + field.question(this.form()));
  }

  private showSummary(): void {
    this.awaitingConfirmation = true;
    const f = this.form();
    const lines = [
      `**Event Name:** ${f.eventName}`,
      `**Description:** ${f.description}`,
      `**Trip Type:** ${f.tripType}`,
      `**Travel Style:** ${f.travelStyle}`,
      `**Starting Place:** ${f.startingPlace}`,
      `**Destination:** ${f.destination}`,
      `**End Location:** ${f.endLocationDiffers ? f.endLocation : 'Same as starting place'}`,
      `**Start Date:** ${f.startDate}`,
      `**End Date:** ${f.endDate}`,
      `**Minimum Stay:** ${f.minStayDuration}`,
      `**Transportation:** ${f.transportation}`,
      `**Maximum Travelers:** ${f.maxTravelers}`,
      ...(f.additionalNotes ? [`**Additional Notes:** ${f.additionalNotes}`] : [])
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

  private createEvent(): void {
    this.pushAssistant('Creating your event…');
    this.eventsService.createEvent(this.buildPayload(this.form())).subscribe({
      next: (created) => {
        this.active.set(false);
        this.pushAssistant(`🎉 "${created.title}" is live! Taking you to your event…`);
        setTimeout(() => this.router.navigateByUrl(`/community/events/${created.id}`), 1400);
      },
      error: (err) => {
        this.pushAssistant(
          err?.status === 401
            ? 'Please log in to host an event, then type **confirm** again.'
            : err?.error?.detail || 'Something went wrong creating the event — type **confirm** to try again.'
        );
      }
    });
  }

  private buildPayload(f: EventHostForm): CreateEventPayload {
    const details: [string, string][] = [
      ['Trip Type', f.tripType],
      ['Travel Style', f.travelStyle],
      ['Starting Place', f.startingPlace],
      ['End Location', f.endLocationDiffers ? f.endLocation : 'Same as starting place'],
      ['Minimum Stay', f.minStayDuration],
      ['Transportation', f.transportation]
    ];
    if (f.specialRequirements) details.push(['Special Requirements', f.specialRequirements]);
    details.push(['Maximum Travelers', String(f.maxTravelers)]);
    if (f.additionalNotes) details.push(['Additional Notes', f.additionalNotes]);

    const description = `${f.description}\n\nEVENT DETAILS:\n${details.map(([k, v]) => `${k}: ${v}`).join('\n')}`;

    return {
      title: f.eventName,
      description,
      location: f.destination,
      starts_at: new Date(`${f.startDate}T09:00:00`).toISOString(),
      ends_at: f.endDate ? new Date(`${f.endDate}T18:00:00`).toISOString() : undefined
    };
  }

  private pushAssistant(text: string): void {
    this.chat.messages.update((m) => [...m, { role: 'assistant', text }]);
    this.chat.requestScroll();
  }

  private pushUser(text: string): void {
    this.chat.messages.update((m) => [...m, { role: 'user', text }]);
  }
}
