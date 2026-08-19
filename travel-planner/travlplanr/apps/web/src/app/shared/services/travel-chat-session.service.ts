import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { filter } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../auth/auth.service';
import { SavedTrip, TripService } from '../../trip/trip.service';
import { ChatApiService } from './chat-api.service';
import { ChatContextService } from './chat-context.service';
import { ChatLearningService } from './chat-learning.service';
import { apiErrorDetail } from '../utils/api-error.util';
import {
  ChatAction,
  ChatApiResponse,
  ChatImage,
  ChatIntent,
  ChatTripSlots,
  ChatWeatherSummary,
  suggestedActionLabel,
  extractDestinationFromMessage,
  extractPlaceFromMessage,
  extractDurationDays,
  extractTravelers,
  inferIntentFromMessage,
} from '../utils/chat-intent.util';

/** Quick duration picks shown under search bars when destination is known. */
export const SEARCH_DURATION_CHIPS: ReadonlyArray<{
  days: number;
  labelKey: string;
  primary?: boolean;
}> = [
  { days: 3, labelKey: 'SHARED.DURATION_CHIP_3' },
  { days: 5, labelKey: 'SHARED.DURATION_CHIP_5', primary: true },
  { days: 7, labelKey: 'SHARED.DURATION_CHIP_7' },
];

export interface TravelChatMessage {
  role: 'user' | 'assistant';
  text: string;
  images?: ChatImage[];
  audio_url?: string;
  weather?: ChatWeatherSummary | null;
  suggestedActions?: ChatAction[];
  /** Classified intent for this assistant turn (see chat-intent.util's
   * intentLabel) — drives the lightweight "mode" badge in the UI. */
  intent?: ChatIntent;
  /** Server learning log id for this assistant turn. */
  interactionId?: string;
  /** Set on error bubbles: the user message to resend via the retry chip. */
  retryText?: string;
  /** Thumbs reaction — persisted locally and sent to POST /chat/feedback when interactionId is set. */
  feedback?: 'up' | 'down';
  /** Marks the synthetic opening bubble from `greeting()` so it can be
   * recomputed against current trip data on load instead of replaying
   * whatever destination was newest when it was first cached. */
  isGreeting?: boolean;
  /** User hit Stop mid-stream — partial text kept; offer Continue/Retry. */
  stopped?: boolean;
  /** True once the user tapped a suggested-action chip on this bubble. */
  suggestedActionsConsumed?: boolean;
}

/** Minimal shape of the browser's Web Speech API — not consistently present
 * in TypeScript's DOM lib across versions, so it's declared locally. */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

@Injectable({ providedIn: 'root' })
export class TravelChatSessionService {
  private static readonly GLOBAL_HISTORY_KEY = 'travlplanr_chat_history';

  private readonly chatApi = inject(ChatApiService);
  private readonly chatContext = inject(ChatContextService);
  private readonly chatLearning = inject(ChatLearningService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly tripService = inject(TripService);

  /** Browser speech-synthesis is a fixed capability of the environment, not
   * something that changes at runtime — checked once rather than per call. */
  readonly ttsSupported = typeof speechSynthesis !== 'undefined';

  /** Falls back to English if translations haven't loaded yet — same
   * defensive pattern as ChatbotPageComponent.greetingMessage. Personalized
   * when TripService already has the user's trips loaded (root singleton, so
   * this is often already populated by the time a fresh chat opens). */
  private greeting(): TravelChatMessage {
    // Prefer the itinerary currently on screen over the newest trip in the list.
    const openDest = this.chatContext.activeTripPage()?.destination?.split(',')[0]?.trim();
    if (openDest) {
      return {
        role: 'assistant',
        isGreeting: true,
        text:
          this.translate.instant('SHARED.GREETING_TRIP_PAGE', { destination: openDest }) ||
          `You're on your ${openDest} itinerary. Ask me to change flights, days, or activities.`,
      };
    }
    const trips = this.tripService.trips();
    if (trips.length) {
      const destination = trips[0].destination?.split(',')[0]?.trim() || trips[0].destination;
      return {
        role: 'assistant',
        isGreeting: true,
        text:
          this.translate.instant('SHARED.GREETING_RETURNING', { destination }) ||
          `Welcome back! Want to plan another trip, or pick up where you left off with your ${destination} trip?`,
      };
    }
    return {
      role: 'assistant',
      isGreeting: true,
      text:
        this.translate.instant('SHARED.GREETING') ||
        "Hi! I'm your Travl Planr assistant. Where would you like to go, or how can I help plan your trip?",
    };
  }

  readonly messages = signal<TravelChatMessage[]>([this.greeting()]);
  readonly sending = signal(false);
  readonly listening = signal(false);
  readonly voiceSupported = signal(false);
  /** Why the mic button is disabled (null when voice is usable) — surfaced as
   * the button tooltip so a blocked mic explains itself instead of failing. */
  readonly voiceUnavailableReason = signal<string | null>(null);
  /** Speak assistant replies aloud for voice-initiated messages. Off by
   * default — replies arrive as text; the chat-header toggle opts back in. */
  readonly voiceRepliesEnabled = signal(false);
  /** True when the browser's built-in speech recognition is available — the
   * preferred voice path since it needs no server-side speech-to-text key
   * and feeds straight into the normal text chat pipeline. */
  readonly speechRecognitionSupported = signal(false);
  /** Live transcript while `listening()` is true via the Web Speech API path —
   * everything finalized so far plus the current interim hypothesis, so the
   * composer can mirror the user's words as real text while they speak. */
  readonly interimTranscript = signal('');
  readonly scrollRequested = signal(0);
  /** Slots the assistant has captured for the trip being discussed right
   * now (see ChatTripSlots) — null once the conversation isn't trip-shaped. */
  readonly tripSlots = signal<ChatTripSlots | null>(null);
  /** One-shot bridge so a trip-slot chip can hand text to whichever input
   * box currently owns composing (hero search bar or floating chat panel)
   * without either component needing a reference to the other. */
  readonly composerPrefillText = signal('');
  readonly composerPrefillVersion = signal(0);

  /** Destination known but duration missing — show under-bar duration chips.
   * Skip on an open itinerary page: that trip already has a length. */
  readonly needsDurationChips = computed(() => {
    if (this.chatContext.activeTripPage()) return false;
    const slots = this.tripSlots();
    return Boolean(slots?.destination && !slots.duration_days);
  });

  /** Destination + duration known, travelers/focus still missing. */
  readonly needsTravelerFocusChips = computed(() => {
    const slots = this.tripSlots();
    if (!slots?.destination || !slots.duration_days) return false;
    if (slots.ready) return false;
    return (slots.missing ?? []).includes('travelers_or_focus') || (!slots.travelers && !(slots.interests?.length));
  });

  /** Compact search-bar planning: collect missing duration without a chat thread. */
  readonly compactPlanning = computed(
    () => this.needsDurationChips() || this.chatContext.isCreatingTrip(),
  );

  readonly durationChipOptions = SEARCH_DURATION_CHIPS;

  prefillComposer(text: string): void {
    this.composerPrefillText.set(text);
    this.composerPrefillVersion.update((n) => n + 1);
  }

  /** Shared entry for hero / Explore / dock: type a trip → plan. */
  async planFromSearchQuery(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    await this.send(trimmed);
  }

  /** Plan a destination; with days, create the trip immediately. */
  async planDestination(name: string, days?: number): Promise<void> {
    const destination = name.trim();
    if (!destination || this.sending()) return;

    if (days && days > 0) {
      this.tripSlots.set({
        destination,
        duration_days: days,
        missing: [],
        ready: true,
      });
      this.chatContext.setCompactSlotCollection(false);
      const action: ChatAction = {
        type: 'create_trip',
        destination,
        durationDays: days,
        confirmed: true,
      };
      try {
        await this.chatContext.runSuggestedAction(
          action,
          `Plan a ${days}-day trip to ${destination}`,
        );
      } catch (err) {
        console.error('planDestination failed', err);
      }
      return;
    }

    // Show duration chips immediately while the assistant confirms the destination.
    // Show duration chips; open chat so the reply sits above the input.
    this.tripSlots.set({
      destination,
      duration_days: null,
      missing: ['duration_days'],
    });
    this.chatContext.setCompactSlotCollection(true);
    this.chatContext.setChatOpen(true);
    await this.send(`Plan a trip to ${destination}`);
  }

  /** Duration chip under the search bar — completes planning when destination is known. */
  async selectDurationDays(days: number): Promise<void> {
    if (!days || this.sending() || this.chatContext.isCreatingTrip()) return;
    const slots = this.tripSlots();
    const destination =
      slots?.destination || this.chatContext.activeDestination() || undefined;
    if (destination) {
      await this.planDestination(destination, days);
      return;
    }
    await this.send(`${days} days`);
  }

  /** Traveler / focus chips after destination + duration are known. */
  async selectTravelersOrFocus(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || this.sending()) return;
    await this.send(trimmed);
  }

  private buildChatContextPayload(message?: string): {
    path?: string;
    trip_id?: string;
    region?: string;
    entity_type?: string;
    entity_id?: string;
    collecting_duration?: boolean;
    locale?: string;
    known_slots?: ChatTripSlots;
  } {
    const page = this.chatContext.pageContext();
    const openTrip = this.chatContext.activeTripPage();
    const slots = this.tripSlots();
    const openDest = openTrip?.destination?.split(',')[0]?.trim() || null;
    const slotsDest = slots?.destination?.split(',')[0]?.trim() || null;
    const messagePlace = message ? extractPlaceFromMessage(message) : null;
    // New place vs open itinerary OR vs sticky "Trip so far" chips (home page).
    const planningNewPlace = Boolean(
      messagePlace &&
        ((openDest && !this.sameDestination(messagePlace, openDest)) ||
          (slotsDest && !this.sameDestination(messagePlace, slotsDest))),
    );

    // Prefer a newly named place over open-itinerary / sticky chips so
    // "plan a trip to Mumbai" does not keep region=Australia.
    const destination = planningNewPlace
      ? messagePlace
      : messagePlace || openDest || page.region || slotsDest || null;

    const known =
      destination || slots?.duration_days || slots?.travelers
        ? {
            destination,
            // When switching destinations, do not reuse the previous trip's
            // duration/travelers as confirmed — that auto-created Australia
            // again from stale chips.
            duration_days: planningNewPlace ? null : (slots?.duration_days ?? null),
            travelers: planningNewPlace ? null : (slots?.travelers ?? null),
            travel_style: planningNewPlace ? null : (slots?.travel_style ?? null),
            budget: planningNewPlace ? null : (slots?.budget ?? null),
            interests: planningNewPlace ? [] : (slots?.interests ?? []),
          }
        : undefined;
    return {
      path: page.path,
      // New destination = new trip; don't bind create/draft to the open itinerary.
      trip_id: planningNewPlace ? undefined : page.tripId,
      region: destination || undefined,
      entity_type: page.entityType,
      entity_id: page.entityId,
      collecting_duration: this.chatContext.compactSlotCollection() || this.needsDurationChips(),
      locale: (typeof this.translate.currentLang === 'function' ? this.translate.currentLang() : this.translate.currentLang) || 'en',
      known_slots: known,
    };
  }

  private historyScope = 'global';
  /** Avoid re-writing chat history on every itinerary re-bind of the same trip. */
  private lastSyncedTripKey: string | null = null;
  private currentSessionId: string | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private abortController: AbortController | null = null;
  private audioChunks: Blob[] = [];
  private recognition: SpeechRecognitionLike | null = null;
  /** Set when Chrome's cloud speech service errored (offline / blocked) so
   * later attempts go straight to the recorder + server transcription path. */
  private preferMediaRecorder = false;
  private vadTimer: ReturnType<typeof setInterval> | null = null;
  private vadAudioContext: AudioContext | null = null;
  private heardSpeech = false;

  constructor() {
    this.initVoiceSupport();
    try {
      this.voiceRepliesEnabled.set(localStorage.getItem('travlplanr_voice_replies') === 'on');
    } catch { /* storage unavailable — keep the default */ }
    this.historyScope = this.chatContext.tripIdFromUrl() ?? 'global';
    const loaded = this.loadPersistedState();
    this.messages.set(loaded.messages);
    this.tripSlots.set(loaded.tripSlots);
    this.chatContext.setCompactSlotCollection(false);
    // Do not force compact on load — that pinned the home hero to the bottom
    // before the user typed. Duration chips still derive from tripSlots when
    // the user is actively chatting.
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.stopSpeaking();
      const tripId = this.chatContext.tripIdFromUrl();
      const scope = tripId ?? 'global';
      if (scope !== this.historyScope) {
        const prevSlots = this.tripSlots();
        const prevScope = this.historyScope;
        this.historyScope = scope;
        this.lastSyncedTripKey = null;
        const next = this.loadPersistedState();
        let messages = next.messages;
        let slots = next.tripSlots;
        // Only hand off global planning chips when they match the open trip.
        // Otherwise "Goa planning" was being bridged onto a Maldives itinerary.
        const openDest = this.chatContext.activeTripPage()?.destination;
        if (
          prevScope === 'global' &&
          scope !== 'global' &&
          prevSlots?.destination &&
          this.sameDestination(prevSlots.destination, openDest)
        ) {
          slots = slots ?? prevSlots;
          const bridge = this.translate.instant('SHARED.CHAT_SCOPE_BRIDGE', {
            destination: prevSlots.destination,
            days: prevSlots.duration_days ? ` ${prevSlots.duration_days}-day` : '',
          });
          if (!messages.some((m) => m.text === bridge)) {
            messages = [...messages, { role: 'assistant', text: bridge }];
          }
        }
        this.messages.set(messages);
        this.tripSlots.set(slots);
        this.chatContext.setCompactSlotCollection(false);
        this.persist();
      }
    });

    // When the itinerary page binds a trip, force chat slots/history onto that trip.
    effect(() => {
      const page = this.chatContext.activeTripPage();
      if (!page?.tripId || !page.destination) return;
      this.syncChatToOpenTrip(page.tripId, page.destination);
    }, { allowSignalWrites: true });
  }

  private sameDestination(a?: string | null, b?: string | null): boolean {
    if (!a || !b) return false;
    const norm = (s: string) => s.split(',')[0].trim().toLowerCase();
    return norm(a) === norm(b);
  }

  private tripDurationDays(trip: SavedTrip | undefined): number | null {
    if (!trip) return null;
    if (trip.days?.length) return trip.days.length;
    if (trip.startDate && trip.endDate) {
      const start = Date.parse(trip.startDate);
      const end = Date.parse(trip.endDate);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
      }
    }
    return null;
  }

  private slotsFromOpenTrip(tripId: string, destination: string): ChatTripSlots {
    const trip = this.tripService.trips().find((t) => t.id === tripId);
    const dest = destination.split(',')[0].trim() || destination;
    return {
      destination: dest,
      duration_days: this.tripDurationDays(trip),
      travelers: trip?.travelers ?? null,
      travel_style: trip?.travelStyle ?? null,
      budget: trip?.budget ?? null,
      interests: trip?.interests ?? [],
      ready: true,
      missing: [],
    };
  }

  /** Keep "Trip so far" + API context aligned with the itinerary on screen. */
  private syncChatToOpenTrip(tripId: string, destination: string): void {
    if (this.chatContext.tripIdFromUrl() && this.chatContext.tripIdFromUrl() !== tripId) {
      return;
    }
    const dest = destination.split(',')[0].trim() || destination;
    const syncKey = `${tripId}::${dest.toLowerCase()}`;
    const slots = this.tripSlots();
    const mismatched = Boolean(slots?.destination && !this.sameDestination(slots.destination, dest));
    if (
      this.lastSyncedTripKey === syncKey &&
      this.sameDestination(slots?.destination, dest)
    ) {
      return;
    }

    const seeded = this.slotsFromOpenTrip(tripId, dest);

    if (!slots || mismatched || !slots.destination) {
      this.tripSlots.set({
        ...seeded,
        // Preserve user-confirmed extras only when destination already matched.
        ...(mismatched || !slots
          ? {}
          : {
              travelers: slots.travelers ?? seeded.travelers,
              travel_style: slots.travel_style ?? seeded.travel_style,
              budget: slots.budget ?? seeded.budget,
              interests: slots.interests?.length ? slots.interests : seeded.interests,
            }),
        destination: dest,
      });
    }

    let messages = this.messages().filter((m) => {
      if (m.role !== 'assistant' || m.isGreeting) return true;
      // Drop bridged "Continuing your Goa plan" lines that don't match this trip.
      if (/continuing your/i.test(m.text) && !m.text.toLowerCase().includes(dest.toLowerCase())) {
        return false;
      }
      return true;
    });

    if (messages[0]?.isGreeting) {
      messages = [this.greeting(), ...messages.slice(1)];
    }

    if (mismatched) {
      const switchNote =
        this.translate.instant('SHARED.CHAT_SCOPE_SWITCH', { destination: dest }) ||
        `You're viewing your ${dest} itinerary — I'll stick with this trip from here.`;
      if (!messages.some((m) => m.text === switchNote)) {
        messages = [...messages, { role: 'assistant', text: switchNote }];
      }
    }

    this.messages.set(messages);
    this.chatContext.activeDestination.set(dest);
    this.lastSyncedTripKey = syncKey;
    this.persist();
  }

  hasConversation(): boolean {
    return this.messages().length > 1;
  }

  actionLabel(action: ChatAction): string {
    return suggestedActionLabel(action);
  }

  requestScroll(): void {
    this.scrollRequested.update((n) => n + 1);
  }

  clearHistory(): void {
    this.stopSpeaking();
    this.messages.set([this.clearedGreeting()]);
    this.tripSlots.set(null);
    this.lastSyncedTripKey = null;
    this.chatContext.setCompactSlotCollection(false);
    this.chatContext.clearBackgroundHint();
    // Re-seed from the open itinerary so "New chat" stays on this trip.
    const open = this.chatContext.activeTripPage();
    if (open?.tripId && open.destination) {
      this.syncChatToOpenTrip(open.tripId, open.destination);
    }
    this.persist();
    this.requestScroll();
  }

  /** Opening bubble after the user explicitly starts a new chat. */
  private clearedGreeting(): TravelChatMessage {
    return {
      role: 'assistant',
      isGreeting: true,
      text:
        this.translate.instant('SHARED.CHAT_CLEARED') ||
        'Chat cleared. Ready when you are for your next adventure!',
    };
  }

  /** Drops the message at `index` and everything after it — used to edit an
   * earlier user message: the caller prefills the composer with the removed
   * text so the user can amend it before resending. */
  truncateTo(index: number): void {
    this.messages.update((m) => m.slice(0, index));
    this.persist();
  }

  setFeedback(msg: TravelChatMessage, feedback: 'up' | 'down'): void {
    const toggled = msg.feedback === feedback ? undefined : feedback;
    this.messages.update((list) =>
      list.map((m) => (m === msg ? { ...m, feedback: toggled } : m)),
    );
    this.persist();
    if (toggled && msg.interactionId) {
      void this.chatLearning.submitFeedback(msg.interactionId, toggled).catch((err) =>
        console.debug('chat feedback submit failed', err),
      );
    }
  }

  /** Build the itinerary page directly from slots gathered in this chat,
   * instead of sending another message that may only get a text reply. */
  async openItineraryFromConversation(): Promise<void> {
    if (this.sending()) return;

    const slots = this.tripSlots();
    let destination = slots?.destination || this.chatContext.activeDestination() || undefined;
    let durationDays = slots?.duration_days ?? undefined;
    let travelers = slots?.travelers ?? undefined;
    let travelStyle = slots?.travel_style ?? undefined;
    let budget = slots?.budget ?? undefined;
    let interests = slots?.interests?.length ? slots.interests : undefined;

    if (!destination || !durationDays) {
      for (const msg of [...this.messages()].reverse()) {
        if (msg.role !== 'user') continue;
        destination ||= extractDestinationFromMessage(msg.text) || undefined;
        durationDays ||= extractDurationDays(msg.text) ?? undefined;
        travelers ||= extractTravelers(msg.text) ?? undefined;
        if (destination && durationDays) break;
      }
    }

    if (!destination || !durationDays) {
      await this.send(this.translate.instant('SHARED.FOLLOWUP_ITINERARY'));
      return;
    }

    const tier = this.chatContext.lastDestinationTier();
    const draft = tier !== 'supported';
    const action: ChatAction = {
      type: draft ? 'create_draft_trip' : 'create_trip',
      destination,
      durationDays,
      travelers,
      travelStyle,
      budget,
      interests,
      coverageTier: draft ? 'draft' : 'full',
      confirmed: true,
    };

    try {
      await this.chatContext.runSuggestedAction(action, '');
    } catch (err) {
      console.error('Open itinerary from chat failed', err);
    }
  }

  async send(text: string, opts?: { spoken?: boolean }): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || this.sending()) return;
    // A new message interrupts any reply still being read out.
    this.stopSpeaking();

    // Natural-language "clear / new chat" — reset locally instead of asking the model.
    if (/^(clear(\s+(chat|conversation|history))?|new\s+chat|start\s+over|reset(\s+chat)?)\s*[!.]?$/i.test(trimmed)) {
      this.clearHistory();
      return;
    }

    const priorMessages = this.messages();
    this.messages.update((m) => [...m, { role: 'user', text: trimmed }]);
    // Optimistically flip "Trip so far" when the user names a new place so
    // sticky chips (e.g. Australia) don't linger while the model replies.
    const namedPlace = extractPlaceFromMessage(trimmed);
    if (namedPlace && !this.sameDestination(namedPlace, this.tripSlots()?.destination)) {
      this.tripSlots.set({
        destination: namedPlace,
        duration_days: null,
        travelers: null,
        travel_style: null,
        budget: null,
        interests: [],
      });
      this.chatContext.activeDestination.set(namedPlace);
    }
    this.persist();
    this.requestScroll();

    this.sending.set(true);
    // Tracks whether the streaming placeholder bubble exists yet, so tokens
    // create it lazily (no empty bubble if the stream dies before content).
    let bubbleLive = false;
    const provisionalIntent = inferIntentFromMessage(trimmed);
    const showText = (t: string) => {
      if (!bubbleLive) {
        bubbleLive = true;
        this.messages.update((m) => [
          ...m,
          { role: 'assistant', text: t, intent: provisionalIntent },
        ]);
      } else {
        this.messages.update((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            text: t,
            intent: copy[copy.length - 1].intent ?? provisionalIntent,
          };
          return copy;
        });
      }
      this.requestScroll();
    };

    try {
      const history = priorMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.text }));
      const payload = {
        message: trimmed,
        history,
        context: this.buildChatContextPayload(trimmed),
      };

      let streamed = '';
      let aborted = false;
      let response: ChatApiResponse | null = null;
      this.abortController = new AbortController();
      try {
        response = await this.chatApi.sendStream(payload, {
          onToken: (chunk) => {
            streamed += chunk;
            showText(streamed);
          },
          onReplace: (full) => {
            streamed = full;
            showText(streamed);
          },
          signal: this.abortController.signal,
        });
      } catch (streamErr) {
        if ((streamErr as DOMException)?.name === 'AbortError') {
          aborted = true;
        } else if (!bubbleLive) {
          // Stream endpoint unavailable and nothing shown yet — fall back
          // to the blocking endpoint transparently.
          response = await this.chatApi.send(payload);
        } else {
          throw streamErr;
        }
      }

      if (aborted) {
        // User hit stop: keep whatever text already arrived, mark partial.
        if (bubbleLive) {
          this.messages.update((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last?.role === 'assistant') {
              copy[copy.length - 1] = {
                ...last,
                stopped: true,
                retryText: trimmed,
              };
            }
            return copy;
          });
        }
        return;
      }

      if (response) {
        // Booking is money-movement — never run it automatically off a chat
        // message; demote it to a chip the user has to tap.
        const isBooking = (a: ChatAction) => a.type === 'book_package' || a.type === 'book_trip';
        const bookActions = (response.actions ?? []).filter(isBooking);
        if (bookActions.length) {
          response = {
            ...response,
            actions: (response.actions ?? []).filter((a) => !isBooking(a)),
            suggested_actions: [...(response.suggested_actions ?? []), ...bookActions],
          };
        }

        let replyText = response.reply || streamed;
        // Safety net: if under-bar chips are collecting duration, drop a
        // trailing "How many days…" ask so the UI doesn't double-prompt.
        if (this.needsDurationChips() || this.chatContext.compactSlotCollection()) {
          replyText = replyText
            .replace(/\s*How many days should I plan for [^?]+\?\s*(For example:[^.]*\.)?/gi, '')
            .trim();
        }
        const finalMsg: TravelChatMessage = {
          role: 'assistant',
          text: replyText,
          images: response.images?.length ? response.images : undefined,
          weather: response.weather ?? undefined,
          suggestedActions: response.suggested_actions?.length ? response.suggested_actions : undefined,
          intent: response.intent,
          interactionId: response.interaction_id ?? undefined,
        };
        if (response.interaction_id) {
          this.chatLearning.setLastInteractionId(response.interaction_id);
        }
        if (bubbleLive) {
          this.messages.update((m) => [...m.slice(0, -1), finalMsg]);
        } else {
          this.messages.update((m) => [...m, finalMsg]);
        }
        const nextSlots = response.trip_slots ?? null;
        if (nextSlots) {
          this.tripSlots.set(nextSlots);
        } else if (!this.tripSlots()?.destination) {
          this.tripSlots.set(null);
        }
        // else keep optimistic destination slots for under-bar duration chips
        if (opts?.spoken) {
          this.speak(finalMsg.text);
        }

        try {
          this.chatContext.applyChatResponse(response, trimmed, this.chatContext.pageContext().tripId);
        } catch (actionErr) {
          console.error('Chat follow-up action failed', actionErr);
        }
      }
    } catch (err) {
      console.error('Chat request failed', err);
      if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
        this.messages.update((m) => [
          ...m,
          {
            role: 'assistant',
            text: this.translate.instant('SHARED.CHAT_SESSION_EXPIRED'),
          },
        ]);
        this.persist();
        this.auth.logout();
      } else {
        this.messages.update((m) => [
          ...m,
          { role: 'assistant', text: this.chatApi.errorMessage(err), retryText: trimmed },
        ]);
      }
    } finally {
      this.abortController = null;
      this.sending.set(false);
      this.persist();
      this.requestScroll();
    }
  }

  /** Abort the in-flight reply, keeping any text already streamed in. */
  stopGenerating(): void {
    this.abortController?.abort();
  }

  /** Resend the user message that produced an error bubble, clearing the
   * retry chip from that bubble so it can't double-fire. */
  async retry(msg: TravelChatMessage): Promise<void> {
    const text = msg.retryText;
    if (!text || this.sending()) return;

    if (text === '__voice_retry__') {
      this.messages.update((list) =>
        list.map((m) =>
          m === msg ? { ...m, retryText: undefined, stopped: undefined } : m,
        ),
      );
      this.persist();
      await this.toggleVoice();
      return;
    }

    // Stopped / error bubbles: replace from the prior user turn instead of
    // appending another copy of the same question.
    const messages = this.messages();
    const msgIndex = messages.indexOf(msg);
    if (msgIndex >= 0) {
      let userIndex = -1;
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user' && messages[i].text === text) {
          userIndex = i;
          break;
        }
      }
      if (userIndex < 0) {
        for (let i = msgIndex - 1; i >= 0; i--) {
          if (messages[i].role === 'user') {
            userIndex = i;
            break;
          }
        }
      }
      if (userIndex >= 0) {
        this.truncateTo(userIndex);
        await this.send(text);
        return;
      }
    }

    this.messages.update((list) =>
      list.map((m) =>
        m === msg ? { ...m, retryText: undefined, stopped: undefined } : m,
      ),
    );
    this.persist();
    await this.send(text);
  }

  /** Replace the assistant reply at `assistantIndex` by truncating back to
   * the prior user message and resending it (ChatGPT-style regenerate). */
  async regenerateAt(assistantIndex: number): Promise<void> {
    if (this.sending()) return;
    const messages = this.messages();
    let userIndex = -1;
    for (let i = assistantIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userIndex = i;
        break;
      }
    }
    if (userIndex < 0) return;
    const text = messages[userIndex].text;
    this.truncateTo(userIndex);
    await this.send(text);
  }

  async onSuggestedAction(action: ChatAction, msg: TravelChatMessage): Promise<void> {
    const msgIndex = this.messages().indexOf(msg);
    const userMsg = this.messages()
      .slice(0, msgIndex >= 0 ? msgIndex : undefined)
      .reverse()
      .find((m) => m.role === 'user')?.text ?? '';

    // Clear by index / interactionId — object identity breaks after reload.
    this.messages.update((list) =>
      list.map((m, i) => {
        const match =
          (msgIndex >= 0 && i === msgIndex) ||
          (!!msg.interactionId && m.interactionId === msg.interactionId);
        return match
          ? { ...m, suggestedActions: undefined, suggestedActionsConsumed: true }
          : m;
      }),
    );
    this.persist();

    try {
      await this.chatContext.runSuggestedAction(action, userMsg);
    } catch (err) {
      console.error('Suggested action failed', err);
    }
  }

  async toggleVoice(): Promise<void> {
    if (this.sending()) return;

    if (this.listening()) {
      if (this.recognition) {
        this.recognition.stop();
      } else {
        this.stopMediaRecorder();
      }
      return;
    }

    // Starting to talk interrupts any reply still being read out — otherwise
    // the mic picks the assistant's own voice back up.
    this.stopSpeaking();

    if (this.speechRecognitionSupported() && !this.preferMediaRecorder) {
      this.startSpeechRecognition();
      return;
    }

    await this.startMediaRecorderFallback();
  }

  stopSpeaking(): void {
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
    }
  }

  toggleVoiceReplies(): void {
    this.voiceRepliesEnabled.update((v) => !v);
    if (!this.voiceRepliesEnabled()) this.stopSpeaking();
    try {
      localStorage.setItem('travlplanr_voice_replies', this.voiceRepliesEnabled() ? 'on' : 'off');
    } catch { /* storage unavailable */ }
  }

  /** Read an assistant reply aloud (voice-initiated messages only, and only
   * while the user hasn't muted spoken replies). On-device via the browser's
   * speechSynthesis — no server TTS provider needed. */
  private speak(text: string): void {
    if (!this.voiceRepliesEnabled() || typeof speechSynthesis === 'undefined') return;
    const plain = text.replace(/[*_`#]/g, '').trim();
    if (!plain) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(plain);
    utterance.lang = navigator.language || 'en-US';
    speechSynthesis.speak(utterance);
  }

  private stopMediaRecorder(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }
    this.listening.set(false);
  }

  /** Preferred voice path: transcribes on-device via the browser, no server
   * round-trip or speech-to-text API key needed, and feeds the result
   * straight through the normal text chat pipeline (full LLM slot-filling,
   * trip actions, everything a typed message gets). */
  private startSpeechRecognition(): void {
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    // Single-utterance mode lets Chrome finalize (and thus submit) at the
    // first short breath mid-sentence; keep the session open and end it on
    // our own silence window instead, mirroring the recorder path's VAD.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognition.maxAlternatives = 1;

    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    const clearSilenceTimer = () => {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
    };
    // (Re)armed on every recognition event that carries words: stop only
    // after the user has been quiet for a beat, or at the hard length cap.
    const armSilenceTimer = (quietMs = 2200) => {
      clearSilenceTimer();
      const remainingToCap = 60000 - (Date.now() - startedAt);
      silenceTimer = setTimeout(() => {
        try { recognition.stop(); } catch { /* already stopped */ }
      }, Math.max(0, Math.min(quietMs, remainingToCap)));
    };

    let finalTranscript = '';
    // Chrome doesn't reliably emit a final result when the user stops the
    // recognizer by hand (mic button mid-sentence) — onend can fire with
    // everything still interim. Keep the last interim hypothesis so a manual
    // stop submits what was heard instead of silently discarding it.
    let pendingInterim = '';
    const joined = (a: string, b: string) => (a && b ? `${a} ${b}` : a + b);

    recognition.onresult = (event) => {
      let interim = '';
      let sawFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
          sawFinal = true;
        } else {
          interim += result[0].transcript;
        }
      }
      // A finalized event absorbs the previous hypothesis; otherwise only a
      // non-empty one replaces it, so a transient empty event can't wipe it.
      if (sawFinal || interim.trim()) {
        pendingInterim = interim;
        armSilenceTimer();
      }
      this.interimTranscript.set(joined(finalTranscript, interim).trim());
    };

    let fallbackAfterEnd = false;

    recognition.onerror = (event) => {
      clearSilenceTimer();
      // An errored session must not submit whatever fragment was captured —
      // the user already gets an explanatory note below.
      finalTranscript = '';
      pendingInterim = '';
      this.listening.set(false);
      this.interimTranscript.set('');
      this.recognition = null;
      const canRecord = !!(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
      if (event.error === 'network' && canRecord) {
        // Chrome's speech recognition transcribes on Google's servers; when
        // they're unreachable (offline, firewalled) fall back to recording +
        // our own server-side transcription for this and future attempts.
        this.preferMediaRecorder = true;
        fallbackAfterEnd = true;
      } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        this.appendAssistantNote(this.translate.instant('SHARED.VOICE_MIC_DENIED'));
      } else if (event.error === 'no-speech') {
        this.appendAssistantNote(this.translate.instant('SHARED.VOICE_NO_SPEECH'));
      } else if (event.error !== 'aborted') {
        this.appendAssistantNote(this.translate.instant('SHARED.VOICE_ERROR'));
      }
    };

    recognition.onend = () => {
      clearSilenceTimer();
      this.listening.set(false);
      this.interimTranscript.set('');
      this.recognition = null;
      if (fallbackAfterEnd) {
        // Restart seamlessly on the recorder path (onend always fires after
        // onerror, so starting here can't be undone by a late onend).
        void this.startMediaRecorderFallback();
        return;
      }
      const transcript = joined(finalTranscript, pendingInterim).trim();
      if (transcript) {
        void this.send(transcript, { spoken: true });
      }
    };

    try {
      recognition.start();
      this.recognition = recognition;
      this.listening.set(true);
      // In continuous mode Chrome won't necessarily end an all-silent
      // session on its own — give up if nothing is heard at all.
      armSilenceTimer(15000);
    } catch (err) {
      console.error('Could not start speech recognition', err);
      this.listening.set(false);
    }
  }

  /** Fallback for browsers without Web Speech API support (e.g. Firefox):
   * records audio and uploads it for server-side transcription. Requires a
   * configured speech-to-text provider on the backend — see sendVoiceMessage. */
  private async startMediaRecorderFallback(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        this.stopSilenceWatch();
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        if (!this.heardSpeech) {
          // Nothing above the noise floor — an upload would only round-trip
          // to a guaranteed-empty transcript.
          this.appendAssistantNote(this.translate.instant('SHARED.VOICE_NO_SPEECH'));
          return;
        }
        await this.sendVoiceMessage(audioBlob);
      };

      this.mediaRecorder.start();
      this.listening.set(true);
      this.startSilenceWatch(stream);
    } catch (err) {
      console.error('Could not start audio recording', err);
      this.listening.set(false);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        this.appendAssistantNote(this.translate.instant('SHARED.VOICE_MIC_DENIED'));
      }
    }
  }

  /** Mirror the Web Speech UX on the recorder path: watch the mic level and
   * auto-stop once the user has spoken and then gone quiet (or hit the length
   * cap), instead of recording until they find the stop button. */
  private startSilenceWatch(stream: MediaStream): void {
    // If level monitoring can't run, err on the side of sending the audio.
    this.heardSpeech = true;
    const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    try {
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const startedAt = Date.now();
      let lastSound = Date.now();
      this.heardSpeech = false;
      this.vadAudioContext = ctx;
      this.vadTimer = setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
          const v = (samples[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / samples.length);
        if (rms > 0.015) {
          this.heardSpeech = true;
          lastSound = Date.now();
        }
        const now = Date.now();
        const doneTalking = this.heardSpeech && now - lastSound > 2200;
        const neverSpoke = !this.heardSpeech && now - startedAt > 15000;
        const hitCap = now - startedAt > 60000;
        if (doneTalking || neverSpoke || hitCap) {
          this.stopMediaRecorder();
        }
      }, 150);
    } catch {
      this.heardSpeech = true;
    }
  }

  private stopSilenceWatch(): void {
    if (this.vadTimer) {
      clearInterval(this.vadTimer);
      this.vadTimer = null;
    }
    void this.vadAudioContext?.close().catch(() => undefined);
    this.vadAudioContext = null;
  }

  private appendAssistantNote(text: string): void {
    this.messages.update((m) => [...m, { role: 'assistant', text }]);
    this.persist();
    this.requestScroll();
  }

  private async sendVoiceMessage(audioBlob: Blob): Promise<void> {
    if (this.sending()) return;

    this.sending.set(true);
    this.requestScroll();

    try {
      const history = this.messages()
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.text }));
      const ctx = this.buildChatContextPayload();
      let response;
      try {
        response = await this.chatApi.sendVoice(audioBlob, {
          ...ctx,
          session_id: this.currentSessionId,
          history,
        });
      } catch (firstErr) {
        const status = firstErr instanceof HttpErrorResponse ? firstErr.status : NaN;
        if (![0, 502, 503, 504].includes(status)) throw firstErr;
        await new Promise((resolve) => setTimeout(resolve, 700));
        response = await this.chatApi.sendVoice(audioBlob, {
          ...ctx,
          session_id: this.currentSessionId,
          history,
        });
      }

      const isBooking = (a: ChatAction) => a.type === 'book_package' || a.type === 'book_trip';
      if (response.actions?.some(isBooking)) {
        response = {
          ...response,
          actions: response.actions.filter((a) => !isBooking(a)),
          suggested_actions: [...(response.suggested_actions ?? []), ...response.actions.filter(isBooking)],
        };
      }

      if (response.session_id) {
        this.currentSessionId = response.session_id;
      }

      if (response.transcript) {
        this.messages.update((m) => [...m, { role: 'user', text: response.transcript! }]);
      } else {
        this.messages.update((m) => [...m, { role: 'user', text: '(Voice Message)' }]);
      }

      this.messages.update((m) => [
        ...m,
        {
          role: 'assistant',
          text: response.reply,
          images: response.images?.length ? response.images : undefined,
          audio_url: response.audio_url,
          weather: response.weather ?? undefined,
          suggestedActions: response.suggested_actions?.length ? response.suggested_actions : undefined,
          intent: response.intent,
          interactionId: response.interaction_id ?? undefined,
        },
      ]);
      this.tripSlots.set(response.trip_slots ?? null);
      if (!response.audio_url && this.voiceRepliesEnabled()) {
        this.speak(response.reply);
      }

      try {
        this.chatContext.applyChatResponse(
          response,
          response.transcript || '',
          this.chatContext.pageContext().tripId,
        );
      } catch (actionErr) {
        console.error('Chat follow-up action failed', actionErr);
      }
      this.persist();
    } catch (err) {
      console.error('Voice chat request failed', err);
      let text = this.chatApi.errorMessage(err);
      if (err instanceof HttpErrorResponse && err.status === 502) {
        const detail = apiErrorDetail(err);
        if (detail) {
          text = `${detail} You can also just type your message instead.`;
        }
      }
      if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
        text = this.translate.instant('SHARED.CHAT_SESSION_EXPIRED');
        this.messages.update((m) => [...m, { role: 'assistant', text }]);
        this.persist();
        this.auth.logout();
      } else {
        this.messages.update((m) => [
          ...m,
          {
            role: 'assistant',
            text,
            retryText: '__voice_retry__',
          },
        ]);
        this.persist();
      }
    } finally {
      this.sending.set(false);
      this.requestScroll();
    }
  }

  private initVoiceSupport(): void {
    // Server-side rendering / prerendering has no window at all — leave the
    // signals at their unsupported defaults; the browser re-runs this.
    if (typeof window === 'undefined') {
      this.speechRecognitionSupported.set(false);
      this.voiceSupported.set(false);
      return;
    }
    // Mic capture only works in a secure context (https or localhost). On a
    // plain-http LAN origin Chrome still *defines* webkitSpeechRecognition,
    // but every start() fails and the permission is hard-blocked with no way
    // to grant it — so disable the button and say why instead of failing.
    if (window.isSecureContext === false) {
      this.speechRecognitionSupported.set(false);
      this.voiceSupported.set(false);
      this.voiceUnavailableReason.set(
        'Voice input needs a secure connection — open the app at http://localhost:4200 or over HTTPS.',
      );
      return;
    }
    const hasSpeechRecognition = !!(
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    );
    this.speechRecognitionSupported.set(hasSpeechRecognition);
    const hasMediaRecorder =
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && typeof MediaRecorder !== 'undefined';
    this.voiceSupported.set(hasSpeechRecognition || hasMediaRecorder);
    if (!hasSpeechRecognition && !hasMediaRecorder) {
      this.voiceUnavailableReason.set('Voice input is not supported in this browser.');
    }
  }

  private historyKey(): string {
    return this.historyScope === 'global'
      ? TravelChatSessionService.GLOBAL_HISTORY_KEY
      : `travlplanr_chat_trip_${this.historyScope}`;
  }

  private slotsKey(): string {
    return `${this.historyKey()}_slots`;
  }

  private loadPersistedState(): { messages: TravelChatMessage[]; tripSlots: ChatTripSlots | null } {
    return {
      messages: this.loadHistory(),
      tripSlots: this.loadTripSlots(),
    };
  }

  private loadHistory(): TravelChatMessage[] {
    try {
      const saved = localStorage.getItem(this.historyKey());
      if (saved) {
        const parsed = JSON.parse(saved) as TravelChatMessage[];
        if (Array.isArray(parsed) && parsed.length) {
          // Drop dead blob: audio URLs and autoplay-prone media on reload.
          const cleaned = parsed.map((m) => {
            const next = { ...m };
            if (next.audio_url?.startsWith('blob:')) {
              delete next.audio_url;
            }
            if (next.suggestedActionsConsumed) {
              delete next.suggestedActions;
            }
            return next;
          });
          // The opening bubble was cached at whatever moment it was first
          // shown, so it can name a trip that's no longer the newest one.
          // Recompute it fresh against current trip data on every load
          // rather than trusting the frozen text.
          if (cleaned[0]?.isGreeting) {
            return [this.greeting(), ...cleaned.slice(1)];
          }
          return cleaned;
        }
      }
    } catch { /* ignore corrupt history */ }
    return [this.greeting()];
  }

  private loadTripSlots(): ChatTripSlots | null {
    try {
      const saved = localStorage.getItem(this.slotsKey());
      if (!saved) return null;
      const parsed = JSON.parse(saved) as ChatTripSlots;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch { /* ignore */ }
    return null;
  }

  private persist(): void {
    try {
      localStorage.setItem(this.historyKey(), JSON.stringify(this.messages().slice(-50)));
      const slots = this.tripSlots();
      if (slots) {
        localStorage.setItem(this.slotsKey(), JSON.stringify(slots));
      } else {
        localStorage.removeItem(this.slotsKey());
      }
    } catch { /* storage full / unavailable */ }
  }
}
