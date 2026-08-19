import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ChatAction,
  ChatApiResponse,
  ChatImage,
  ChatIntent,
  DestinationTier,
  ItineraryEditPayload,
  buildClientActions,
  inferIntentFromMessage,
  extractDestinationFromMessage,
  extractPlaceFromMessage,
  extractDepartureCity,
} from '../utils/chat-intent.util';
import { WizardStore } from '../../wizard/wizard.store';
import { TripService } from '../../trip/trip.service';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../utils/toast.service';
import { apiUrl } from '../utils/api-url';

const PENDING_CHAT_TRIP_KEY = 'travlplanr_pending_chat_trip';

interface PendingChatTrip {
  destination: string;
  durationDays: number;
  travelers?: number;
  travelStyle?: string;
  coverageTier: 'full' | 'draft';
  departureLocation?: string;
  arrivalLocation?: string;
  budget?: string;
  interests?: string[];
}

@Injectable({ providedIn: 'root' })
export class ChatContextService {
  private readonly router = inject(Router);
  private readonly wizardStore = inject(WizardStore);
  private readonly tripService = inject(TripService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly http = inject(HttpClient);

  // Starts collapsed on every fresh load. A persisted "open" flag must not
  // auto-raise the dock's full-page backdrop on unrelated pages (it would swallow
  // all clicks); the open state survives in-session SPA navigation via this signal.
  readonly chatOpen = signal(false);
  /** True while the landing hero search bar is in full-screen chat mode. */
  readonly heroChatActive = signal(false);
  /** True while the landing hero search bar is visible in the viewport. */
  readonly heroSearchInView = signal(false);
  /** True while the landing hero video section is visible in the viewport. */
  readonly heroViewportInView = signal(true);
  /** True while the hero search bar is pinned to the bottom of the viewport. */
  readonly heroDockPinned = signal(false);

  private readonly currentPath = signal('');

  /** Landing home owns the hero dock — never mount the global floating bar there
   * (doing so while the hero dock is still pinned causes scroll flicker). */
  private readonly onHomeLanding = computed(() => {
    const path = (this.currentPath().split('?')[0].split('#')[0] || '/').replace(/\/+$/, '') || '/';
    return path === '/' || path === '';
  });

  constructor() {
    this.currentPath.set(this.router.url || '/');
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe((e: any) => this.currentPath.set(e.urlAfterRedirects as string));
  }

  /** Global floating dock: hidden on home (hero dock), while hero search is
   * visible/pinned/open, on /login, and on full-page /chatbot. */
  readonly showFloatingChatbot = computed(
    () =>
      !this.onHomeLanding() &&
      !this.heroChatActive() &&
      !this.heroSearchInView() &&
      !this.heroDockPinned() &&
      !this.currentPath().startsWith('/login') &&
      !this.currentPath().startsWith('/chatbot'),
  );

  /** True when a chat composer scrim/backdrop is dimming the page behind the dock. */
  readonly pageBackdropActive = computed(
    () => this.chatOpen() || this.heroChatActive() || this.heroDockPinned(),
  );

  readonly activeDestination = signal<string | null>(null);
  readonly activeIntent = signal<ChatIntent>('general');
  readonly backgroundHint = signal<string | null>(null);
  readonly itineraryRebuildRequested = signal(0);
  readonly itineraryRegenerateRequested = signal(0);
  readonly packageDurationDays = signal<number | null>(null);
  readonly packageSortOrder = signal<'price_asc' | 'price_desc' | null>(null);
  readonly packageMaxBudget = signal<number | null>(null);
  readonly itineraryEditVersion = signal(0);
  readonly chatImages = signal<ChatImage[]>([]);
  readonly tripNoteVersion = signal(0);
  readonly lastSuggestedActions = signal<ChatAction[]>([]);
  readonly lastDestinationTier = signal<DestinationTier | null>(null);
  /** True while search-bar planning is waiting on duration chips (no chat thread). */
  readonly compactSlotCollection = signal(false);
  /** True while createTripFromChat is in flight — drives under-bar status. */
  readonly isCreatingTrip = signal(false);

  readonly activeTripPage = signal<{ tripId: string; destination: string } | null>(null);

  setCompactSlotCollection(active: boolean): void {
    this.compactSlotCollection.set(active);
  }

  setTripPageContext(tripId: string, destination: string): void {
    this.activeTripPage.set({ tripId, destination });
  }

  clearTripPageContext(): void {
    this.activeTripPage.set(null);
  }

  private readonly itineraryEditQueue: ItineraryEditPayload[] = [];
  private readonly tripNoteQueue: Array<{ note: string; day?: number; tripId?: string }> = [];
  private hintTimer: ReturnType<typeof setTimeout> | null = null;

  setChatOpen(open: boolean): void {
    this.chatOpen.set(open);
    try {
      sessionStorage.setItem('travlplanr_chat_open', open ? '1' : '0');
    } catch { /* ignore */ }
    if (!open) this.clearHintSoon();
  }

  setHeroSearchInView(inView: boolean): void {
    this.heroSearchInView.set(inView);
    if (inView && this.chatOpen()) {
      this.setChatOpen(false);
    }
  }

  setHeroViewportInView(inView: boolean): void {
    this.heroViewportInView.set(inView);
  }

  setHeroDockPinned(pinned: boolean): void {
    this.heroDockPinned.set(pinned);
  }

  setHeroChatActive(active: boolean): void {
    this.heroChatActive.set(active);
    if (active && this.chatOpen()) {
      this.setChatOpen(false);
    }
  }

  openFloatingChatIfAllowed(): void {
    if (this.showFloatingChatbot()) {
      this.setChatOpen(true);
    }
  }

  drainItineraryEdits(): ItineraryEditPayload[] {
    if (!this.itineraryEditQueue.length) return [];
    const edits = [...this.itineraryEditQueue];
    this.itineraryEditQueue.length = 0;
    return edits;
  }

  drainTripNotes(): Array<{ note: string; day?: number; tripId?: string }> {
    if (!this.tripNoteQueue.length) return [];
    const notes = [...this.tripNoteQueue];
    this.tripNoteQueue.length = 0;
    return notes;
  }

  applyChatResponse(response: ChatApiResponse, userMessage: string, tripId?: string | null): void {
    const page = this.pageContext();
    const departureOnly = extractDepartureCity(userMessage);
    const messagePlace = departureOnly ? null : extractPlaceFromMessage(userMessage);
    const destination =
      messagePlace ||
      response.destination ||
      page.region ||
      null;
    const intent = response.intent || inferIntentFromMessage(userMessage);
    // Pass message-resolved place as region so client create actions never
    // fall back to a sticky open-trip / activeDestination (e.g. Australia).
    const clientActions = buildClientActions(
      userMessage,
      tripId ?? page.tripId,
      messagePlace || page.region,
    );
    const serverActions = response.actions ?? [];
    const suggested = response.suggested_actions ?? [];
    const tier = response.destination_tier ?? null;
    const merged = [...serverActions];
    for (const clientAction of clientActions) {
      if (clientAction.type === 'create_trip' || clientAction.type === 'create_draft_trip') {
        if (tier && tier !== 'supported') continue;
        if (merged.some((a) => a.type === 'create_trip' || a.type === 'create_draft_trip')) continue;
        if (!clientAction.destination) continue;
        if (serverActions.length === 0) merged.push(clientAction);
        continue;
      }
      if (clientAction.type !== 'itinerary_edit') {
        // Never navigate away from an open trip when regenerating origin/route.
        if (
          clientAction.type === 'navigate_packages' &&
          (departureOnly ||
            merged.some(
              (a) => a.type === 'regenerate_itinerary' || a.type === 'rebuild_itinerary',
            ))
        ) {
          continue;
        }
        if (
          clientAction.type === 'navigate_packages' &&
          clientAction.destination &&
          !merged.some((a) => a.type === 'navigate_packages')
        ) {
          merged.push(clientAction);
        }
        if (
          clientAction.type === 'regenerate_itinerary' &&
          !merged.some((a) => a.type === 'regenerate_itinerary' || a.type === 'rebuild_itinerary')
        ) {
          merged.push(clientAction);
        }
        continue;
      }
      const duplicateIdx = merged.findIndex(
        (a) => a.type === 'itinerary_edit' && a.edit === clientAction.edit,
      );
      if (duplicateIdx === -1) {
        merged.push(clientAction);
        continue;
      }
      if (
        clientAction.edit === 'swap_transport' &&
        clientAction.fromTitleMatch &&
        merged[duplicateIdx].fromTitleMatch?.toLowerCase().includes('day ')
      ) {
        merged[duplicateIdx] = { ...merged[duplicateIdx], ...clientAction };
      }
    }
    const actions = merged.length ? merged : clientActions.filter(
      (a) => a.type !== 'create_trip' && a.type !== 'create_draft_trip',
    );

    this.lastSuggestedActions.set(suggested);
    this.lastDestinationTier.set(tier);

    if (response.images?.length) {
      this.chatImages.set(response.images);
    } else {
      const imgAction = actions.find((a) => a.type === 'show_images' && a.images?.length);
      if (imgAction?.images) this.chatImages.set(imgAction.images);
    }

    this.activeDestination.set(destination);
    this.activeIntent.set(intent);

    const slots = response.trip_slots;
    const awaitingDuration = Boolean(slots?.destination && !slots?.duration_days);
    this.compactSlotCollection.set(awaitingDuration);

    // Prefer under-bar duration chips over opening a chat thread when only days are missing.
    if (!awaitingDuration) {
      this.openFloatingChatIfAllowed();
    }
    void this.executeActions(actions, destination, intent, userMessage).catch((err) => {
      console.error('Chat action execution failed', err);
      this.toast.error('Something went wrong applying that request. Please try again.');
    });
  }

  async runSuggestedAction(action: ChatAction, userMessage = ''): Promise<void> {
    const destination =
      action.destination ||
      extractDestinationFromMessage(userMessage) ||
      this.activeDestination();
    const intent = this.activeIntent();
    // A chip tap is an explicit user decision — that's what authorizes
    // money-movement actions the auto-execution path refuses to run.
    await this.executeActions([{ ...action, confirmed: true }], destination, intent, userMessage);
  }

  private async executeActions(
    actions: ChatAction[],
    destination: string | null,
    intent: ChatIntent,
    userMessage = '',
  ): Promise<void> {
    for (const action of actions) {
      try {
      if (action.auto === false) continue;
      if ((action.type === 'book_package' || action.type === 'book_trip') && !action.confirmed) continue;

      if (action.type === 'navigate_packages' && action.destination) {
        // Don't yank the page away while under-bar chips are still collecting days.
        if (this.compactSlotCollection()) {
          this.activeDestination.set(action.destination);
          continue;
        }
        this.activeDestination.set(action.destination);
        this.showHint(`Showing packages for ${action.destination}`);
        this.router.navigate(['/packages'], { queryParams: { region: action.destination } });
        continue;
      }

      if (action.type === 'start_wizard' && action.destination) {
        this.wizardStore.setDestinations([action.destination]);
        // Carry over any other slots the chat already captured, so the wizard
        // opens pre-filled instead of asking the user to repeat themselves.
        if (action.travelers) {
          this.wizardStore.setTravelers(action.travelers);
        }
        const travelStyle = action.travelStyle as 'solo' | 'couple' | 'family' | 'friends' | undefined;
        if (travelStyle && ['solo', 'couple', 'family', 'friends'].includes(travelStyle)) {
          this.wizardStore.setTravelStyle(travelStyle);
        }
        const budget = action.budget as 'budget' | 'mid' | 'luxury' | undefined;
        if (budget && ['budget', 'mid', 'luxury'].includes(budget)) {
          this.wizardStore.setBudget(budget);
        }
        if (action.interests?.length) {
          for (const interest of action.interests) {
            this.wizardStore.toggleInterest(interest);
          }
        }
        if (action.departureLocation) {
          this.wizardStore.setDepartureInfo(
            action.departureLocation,
            Boolean(action.arrivalLocation),
            action.arrivalLocation || ''
          );
        }
        this.wizardStore.setStep(2);
        this.showHint(`Starting a plan for ${action.destination}`);
        this.router.navigate(['/wizard']);
        continue;
      }

      if (action.type === 'filter_packages' && action.durationDays) {
        this.packageDurationDays.set(action.durationDays);
        this.showHint(`Showing ${action.durationDays}-day packages`);
        await this.ensurePackagesRegion(destination);
        continue;
      }

      if (action.type === 'sort_packages') {
        this.packageSortOrder.set(action.sortBy || 'price_asc');
        if (action.durationDays) this.packageDurationDays.set(action.durationDays);
        this.showHint('Sorting packages by price');
        await this.ensurePackagesRegion(action.destination || destination);
        continue;
      }

      if (action.type === 'filter_budget' && action.maxBudget) {
        this.packageMaxBudget.set(action.maxBudget);
        if (action.durationDays) this.packageDurationDays.set(action.durationDays);
        this.showHint(`Filtering packages under ₹${action.maxBudget.toLocaleString()}`);
        await this.ensurePackagesRegion(action.destination || destination);
        continue;
      }

      if (action.type === 'create_trip') {
        const tripDestination = action.destination || destination;
        if (!tripDestination) {
          this.toast.error("I couldn't tell which destination you meant — try naming a specific city or country.");
          continue;
        }
        if (!action.durationDays) continue;
        await this.createTripFromChat(
          tripDestination,
          action.durationDays,
          action.travelers,
          action.travelStyle,
          action.coverageTier ?? 'full',
          action.departureLocation,
          action.arrivalLocation,
          action.budget,
          action.interests,
        );
        continue;
      }

      if (action.type === 'create_draft_trip') {
        const tripDestination = action.destination || destination;
        if (!tripDestination) {
          this.toast.error("I couldn't tell which destination you meant — try naming a specific city or country.");
          continue;
        }
        if (!action.durationDays) continue;
        await this.createTripFromChat(
          tripDestination,
          action.durationDays,
          action.travelers,
          action.travelStyle,
          'draft',
          action.departureLocation,
          action.arrivalLocation,
          action.budget,
          action.interests,
        );
        continue;
      }

      if (action.type === 'open_itinerary') {
        const targetTripId = action.tripId || this.tripIdFromUrl();
        if (targetTripId) {
          this.showHint('Opening your itinerary…');
          await this.router.navigate(['/itinerary', targetTripId]);
        } else {
          this.toast.error('No itinerary found yet — describe a trip first.');
        }
        continue;
      }

      if (action.type === 'show_similar_destinations') {
        const dest = action.similar?.[0] || action.destination || destination;
        if (dest) {
          this.showHint(`Showing packages for ${dest}`);
          this.router.navigate(['/packages'], { queryParams: { region: dest } });
        } else {
          this.router.navigate(['/packages']);
        }
        continue;
      }

      if (action.type === 'request_destination') {
        const place = action.destination || destination;
        if (!place) {
          this.toast.error('Which destination should we add?');
          continue;
        }
        try {
          await firstValueFrom(
            this.http.post(apiUrl('/destinations/requests'), {
              placeName: place,
              sourceMessage: userMessage || undefined,
            }),
          );
          this.toast.success(`Thanks — we logged your interest in ${place}.`);
        } catch {
          this.toast.error('Could not submit your request right now. Try again later.');
        }
        continue;
      }

      if (action.type === 'create_multi_city_trip' && action.destinations?.length) {
        await this.createMultiCityTripFromChat(action);
        continue;
      }

      if (action.type === 'itinerary_edit') {
        await this.queueItineraryEdit({
          edit: action.edit ?? 'add_activity',
          day: action.day,
          title: action.title,
          titleMatch: action.titleMatch,
          itemType: action.itemType,
          transportType: action.transportType,
          fromType: action.fromType,
          toType: action.toType,
          fromTitleMatch: action.fromTitleMatch,
          tripId: action.tripId,
        });
        continue;
      }

      if (action.type === 'rebuild_itinerary') {
        this.showHint('Refreshing your itinerary…');
        const targetTripId = action.tripId || this.tripIdFromUrl();
        if (targetTripId) {
          if (this.tripIdFromUrl() === targetTripId) {
            this.itineraryRebuildRequested.update((n) => n + 1);
          } else {
            await this.router.navigate(['/itinerary', targetTripId]);
            this.itineraryRebuildRequested.update((n) => n + 1);
          }
        } else {
          this.router.navigate(['/trips']);
        }
        continue;
      }

      if (action.type === 'regenerate_itinerary') {
        await this.regenerateItineraryFromChat(action);
        continue;
      }

      if (action.type === 'save_trip_note' && action.note) {
        await this.queueTripNote(action.note, action.day, action.tripId);
        continue;
      }

      if (action.type === 'book_package') {
        await this.bookPackageFromChat(action);
        continue;
      }

      if (action.type === 'book_trip') {
        await this.bookTripFromChat(action.tripId);
        continue;
      }

      if (action.type === 'show_images' && action.images?.length) {
        this.chatImages.set(action.images);
        continue;
      }
      } catch (err) {
        console.error('Chat action failed', action, err);
      }
    }

    if (!actions.length && destination && intent === 'browse_packages') {
      this.router.navigate(['/packages'], { queryParams: { region: destination } });
      this.showHint(`Showing packages for ${destination}`);
    }
  }

  async resumePendingChatTripIfAny(): Promise<boolean> {
    if (!this.auth.isLoggedIn()) return false;
    let pending: PendingChatTrip | null = null;
    try {
      const raw = sessionStorage.getItem(PENDING_CHAT_TRIP_KEY);
      if (!raw) return false;
      sessionStorage.removeItem(PENDING_CHAT_TRIP_KEY);
      pending = JSON.parse(raw) as PendingChatTrip;
    } catch {
      return false;
    }
    if (!pending?.destination || !pending.durationDays) return false;
    await this.createTripFromChat(
      pending.destination,
      pending.durationDays,
      pending.travelers,
      pending.travelStyle,
      pending.coverageTier,
      pending.departureLocation,
      pending.arrivalLocation,
      pending.budget,
      pending.interests,
    );
    return true;
  }

  private stashPendingChatTrip(params: PendingChatTrip): void {
    try {
      sessionStorage.setItem(PENDING_CHAT_TRIP_KEY, JSON.stringify(params));
    } catch { /* storage unavailable */ }
  }

  private async requireLoginForTripCreation(): Promise<boolean> {
    if (this.auth.isLoggedIn()) return true;
    this.toast.error('Log in to open your itinerary on the planner page.');
    await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
    return false;
  }

  private async createTripFromChat(
    destination: string,
    durationDays: number,
    travelers?: number,
    travelStyle?: string,
    coverageTier: 'full' | 'draft' = 'full',
    departureLocation?: string,
    arrivalLocation?: string,
    budget?: string,
    interests?: string[],
  ): Promise<void> {
    if (this.isCreatingTrip()) {
      this.toast.error('Already building a trip — one moment.');
      return;
    }

    const pending: PendingChatTrip = {
      destination,
      durationDays,
      travelers,
      travelStyle,
      coverageTier,
      departureLocation,
      arrivalLocation,
      budget,
      interests,
    };

    if (!this.auth.isLoggedIn()) {
      this.stashPendingChatTrip(pending);
      await this.requireLoginForTripCreation();
      return;
    }

    this.isCreatingTrip.set(true);
    this.compactSlotCollection.set(false);
    const count = travelers || 1;
    const hint =
      coverageTier === 'draft'
        ? `Searching the web for ${destination} and building your draft itinerary…`
        : `Building your ${durationDays}-day ${destination} trip…`;
    this.showHint(hint);

    try {
      const nights = Math.max(durationDays - 1, 1);
      const now = new Date();
      const startDate = now.toISOString().split('T')[0];
      const end = new Date(now);
      end.setDate(end.getDate() + nights);

      const tripId = await this.tripService.createFromWizard({
        destinations: [destination],
        startDate,
        endDate: end.toISOString().split('T')[0],
        aiDates: true,
        cityDays: [{ city: destination, nights }],
        travelers: count,
        travelStyle: travelStyle || (count > 2 ? 'friends' : count === 2 ? 'couple' : 'solo'),
        travelMethod: 'cab_taxi',
        budget: budget || 'standard',
        interests: interests?.length ? interests : ['sightseeing'],
        foodPreferences: interests?.includes('food') ? ['local cuisine'] : [],
        coverageTier,
        departureLocation,
        arrivalLocation: arrivalLocation || destination,
      });

      await this.router.navigate(['/itinerary', tripId]);
      const trip = await this.tripService.waitForTripReady(tripId);
      if (trip && (trip.segments?.length ?? 0) > 0) {
        if (this.auth.isLoggedIn()) this.auth.incrementPlansUsed();
        this.itineraryRebuildRequested.update((n) => n + 1);
        this.showHint(`Your ${durationDays}-day ${destination} itinerary is ready`);
      } else {
        this.toast.error('Trip created but still generating — refresh in a moment.');
      }
    } catch (err: any) {
      console.error('Chat create trip failed', err);
      if (err?.status === 401 || err?.status === 403) {
        this.stashPendingChatTrip(pending);
        await this.requireLoginForTripCreation();
      } else {
        this.toast.error('Could not create the trip. Please try again.');
      }
    } finally {
      this.isCreatingTrip.set(false);
    }
  }

  private async createMultiCityTripFromChat(action: ChatAction): Promise<void> {
    if (this.isCreatingTrip()) {
      this.toast.error('Already building a trip — one moment.');
      return;
    }
    this.isCreatingTrip.set(true);
    this.compactSlotCollection.set(false);
    const cities = action.destinations || [];
    const cityDays = action.cityDays || cities.map((c) => ({ city: c, nights: 2 }));
    const totalNights = cityDays.reduce((sum, c) => sum + c.nights, 0);
    const durationDays = action.durationDays || totalNights + 1;
    const route = cities.join(' → ');
    this.showHint(`Building your ${durationDays}-day trip: ${route}`);

    try {
      const now = new Date();
      const startDate = now.toISOString().split('T')[0];
      const end = new Date(now);
      end.setDate(end.getDate() + totalNights);
      const travelers = action.travelers || 1;

      const tripId = await this.tripService.createFromWizard({
        destinations: cities,
        startDate,
        endDate: end.toISOString().split('T')[0],
        aiDates: true,
        cityDays,
        travelers,
        travelStyle: travelers > 2 ? 'friends' : travelers === 2 ? 'couple' : 'solo',
        travelMethod: 'mixed',
        budget: 'standard',
        interests: ['sightseeing', 'culture'],
        foodPreferences: [],
      });

      await this.router.navigate(['/itinerary', tripId]);
      const trip = await this.tripService.waitForTripReady(tripId);
      if (trip?.segments?.length) {
        if (this.auth.isLoggedIn()) this.auth.incrementPlansUsed();
        this.showHint(`Your multi-city itinerary is ready`);
      }
    } catch (err) {
      console.error('Multi-city trip failed', err);
      this.toast.error('Could not create the multi-city trip.');
    } finally {
      this.isCreatingTrip.set(false);
    }
  }

  private async regenerateItineraryFromChat(action: ChatAction): Promise<void> {
    const targetTripId = action.tripId || this.tripIdFromUrl();
    if (!targetTripId) {
      this.toast.error('Open a trip itinerary first.');
      return;
    }
    if (this.tripIdFromUrl() !== targetTripId) {
      await this.router.navigate(['/itinerary', targetTripId]);
    }
    const routeOnly = Boolean(action.departureLocation || action.arrivalLocation) && !action.day;
    this.showHint(
      routeOnly && action.departureLocation
        ? `Updating flights to depart from ${action.departureLocation}…`
        : 'Regenerating your itinerary with AI…',
    );
    try {
      const trip = await this.tripService.regenerateTrip(targetTripId, action.day, action.style, {
        departureLocation: action.departureLocation,
        arrivalLocation: action.arrivalLocation,
      });
      this.itineraryRegenerateRequested.update((n) => n + 1);
      if (!trip) {
        this.toast.error('Could not update the itinerary.');
        return;
      }
      if (routeOnly && action.departureLocation) {
        this.showHint(`Flights updated — now departing from ${action.departureLocation}.`);
        this.toast.success(`Flights now depart from ${action.departureLocation}.`);
      }
    } catch (err) {
      console.error('Regenerate from chat failed', err);
      this.toast.error('Could not update the flight route for this itinerary.');
    }
  }

  private async queueTripNote(note: string, day?: number, tripId?: string): Promise<void> {
    const targetTripId = tripId || this.tripIdFromUrl();
    if (!targetTripId) {
      this.toast.error('Open a trip itinerary to save notes.');
      return;
    }
    this.tripNoteQueue.push({ note, day, tripId: targetTripId });
    if (this.tripIdFromUrl() !== targetTripId) {
      await this.router.navigate(['/itinerary', targetTripId]);
    }
    this.tripNoteVersion.update((n) => n + 1);
    this.showHint('Note saved on your itinerary');
  }

  private async bookPackageFromChat(action: ChatAction): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/packages' } });
      return;
    }
    const dest = action.destination || 'Europe';
    if (!this.router.url.includes('/packages')) {
      await this.router.navigate(['/packages'], { queryParams: { region: dest } });
    }
    try {
      const pkgs: any[] = await firstValueFrom(
        this.http.get<any[]>(apiUrl('/packages'), { params: { region: dest } }),
      );
      const title = (action.packageTitle || '').toLowerCase().trim();
      if (!title) {
        this.toast.error('Pick a package on the page to book — I need a specific package name.');
        return;
      }
      const match = pkgs.find(
        (p) =>
          p.title?.toLowerCase().includes(title) ||
          title.includes(p.title?.toLowerCase() || ''),
      );
      if (!match) {
        this.toast.error(`No package matching "${action.packageTitle}" — browse the list and book from there.`);
        return;
      }
      const price = parseInt(String(match.price || '').replace(/[^0-9]/g, '') || '0', 10);
      const label = match.title || action.packageTitle;
      const priceLabel = price ? `₹${price.toLocaleString()}` : 'listed price';
      if (
        typeof window !== 'undefined' &&
        !window.confirm(`Book "${label}" for ${priceLabel}? You'll continue to checkout.`)
      ) {
        return;
      }
      const response = await firstValueFrom(
        this.http.post<any>(apiUrl('/checkout'), { package_id: match.id, amount: price }),
      );
      if (response?.checkout_url) {
        window.location.href = response.checkout_url;
      } else {
        this.toast.error('Checkout unavailable right now.');
      }
    } catch {
      this.toast.error('Could not start checkout.');
    }
  }

  private async bookTripFromChat(tripId?: string): Promise<void> {
    const targetId = tripId || this.tripIdFromUrl();
    if (!targetId) {
      this.toast.error('Open your itinerary first to book.');
      return;
    }
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Start checkout for this trip?')
    ) {
      return;
    }
    if (this.tripIdFromUrl() !== targetId) {
      await this.router.navigate(['/itinerary', targetId]);
    }
    this.showHint('Starting checkout…');
    this.bookTripRequested.update((n) => n + 1);
  }

  readonly bookTripRequested = signal(0);

  private async queueItineraryEdit(edit: ItineraryEditPayload): Promise<void> {
    const targetTripId = edit.tripId || this.tripIdFromUrl();
    if (!targetTripId) {
      this.toast.error('Open a trip itinerary first, then ask me to add or remove items.');
      this.router.navigate(['/trips']);
      return;
    }
    this.itineraryEditQueue.push({ ...edit, tripId: targetTripId });
    if (this.tripIdFromUrl() !== targetTripId) {
      await this.router.navigate(['/itinerary', targetTripId]);
    }
    this.itineraryEditVersion.update((n) => n + 1);
    this.showHint('Updating your itinerary…');
  }

  tripIdFromUrl(): string | null {
    const match = this.router.url.match(/\/itinerary\/([^/?]+)/);
    return match?.[1] ?? null;
  }

  pageContext(): {
    path: string;
    tripId?: string;
    region?: string;
    entityType?: 'package' | 'blog';
    entityId?: string;
  } {
    const path = this.router.url;
    const tripId = this.tripIdFromUrl() || this.activeTripPage()?.tripId || undefined;
    const tripDest = this.activeTripPage()?.destination;
    const regionMatch = path.match(/[?&]region=([^&]+)/);
    const onItinerary = path.includes('/itinerary/');
    const region =
      (onItinerary && tripDest ? tripDest : undefined) ||
      (regionMatch ? decodeURIComponent(regionMatch[1]) : undefined) ||
      tripDest ||
      this.activeDestination() ||
      undefined;

    // So the AI bar can answer questions about the exact package/post the
    // user is currently looking at, not just its region.
    const packageMatch = path.match(/^\/packages\/([^/?]+)/);
    const blogMatch = path.match(/^\/blog\/([^/?]+)/);
    const entityType = packageMatch ? 'package' : blogMatch ? 'blog' : undefined;
    const entityId = packageMatch?.[1] || blogMatch?.[1] || undefined;

    return { path, tripId, region, entityType, entityId };
  }

  private async ensurePackagesRegion(region: string | null | undefined): Promise<void> {
    const target = region?.trim();
    if (!target) {
      if (!this.router.url.includes('/packages')) {
        await this.router.navigate(['/packages'], { queryParams: { region: 'Europe' } });
      }
      return;
    }
    const currentMatch = this.router.url.match(/[?&]region=([^&]+)/);
    const current = currentMatch ? decodeURIComponent(currentMatch[1]) : null;
    if (
      current &&
      current.toLowerCase().replace(/[^a-z0-9]/g, '') === target.toLowerCase().replace(/[^a-z0-9]/g, '')
    ) {
      return;
    }
    await this.router.navigate(['/packages'], { queryParams: { region: target } });
  }

  private showHint(message: string): void {
    this.backgroundHint.set(message);
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.backgroundHint.set(null), 5000);
  }

  /** Immediately clear the top status pill (e.g. on new chat). */
  clearBackgroundHint(): void {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = null;
    this.backgroundHint.set(null);
  }

  private clearHintSoon(): void {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.backgroundHint.set(null), 2000);
  }
}
