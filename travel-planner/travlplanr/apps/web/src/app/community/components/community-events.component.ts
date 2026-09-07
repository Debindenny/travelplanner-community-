import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommunityEventsService } from '../services/community-events.service';
import { CommunityEventCard, toEventCard } from '../services/community-event-view.model';
import { AddToTripModalComponent, TripDayOption, TripOption } from './add-to-trip-modal.component';
import { CommunityHomeSubnavComponent } from './community-home-subnav.component';
import { CommunityComposerModalComponent } from './community-composer-modal.component';
import { CommunityProfileService, MyCommunityProfile } from '../services/community-profile.service';
import { AuthService } from '../../auth/auth.service';
import { EventHostAssistantService } from '../../shared/services/event-host-assistant.service';
import { ChatContextService } from '../../shared/services/chat-context.service';

export type EventsTab = 'all' | 'hosted' | 'joined';

@Component({
  selector: 'app-community-events',
  imports: [
    CommonModule,
    RouterLink,
    AddToTripModalComponent,
    CommunityHomeSubnavComponent,
    CommunityComposerModalComponent
  ],
  templateUrl: './community-events.component.html',
  styleUrl: './community-events.component.scss'
})
export class CommunityEventsComponent {
  private readonly eventsService = inject(CommunityEventsService);
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(CommunityProfileService);
  private readonly eventHost = inject(EventHostAssistantService);
  private readonly chatContext = inject(ChatContextService);

  readonly user = this.auth.user;
  readonly myProfile = signal<MyCommunityProfile | null>(null);
  readonly showComposerModal = signal(false);

  events: CommunityEventCard[] = [];
  loading = true;
  loadError = false;

  toastMessage: string | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Router state set by the host wizard right before it navigates back here.
    const pending = (history.state as { toast?: string } | null)?.toast;
    if (pending) this.showToast(pending);

    this.loadEvents();

    if (this.auth.user()) {
      this.profileService.getMyProfile().subscribe({
        next: (p) => this.myProfile.set(p),
        error: () => {}
      });
    }
  }

  /** Blurs this page and opens the global AI chat dock, running the Event
   * Hosting Assistant as turns in it — no navigation away from Events.
   * Stops propagation so this same click isn't seen by the dock's global
   * "click outside closes it" listener (the button itself is outside the
   * dock element) and doesn't instantly close what it just opened. */
  hostEvent(event: Event): void {
    event.stopPropagation();
    this.eventHost.start();
    this.chatContext.setChatOpen(true);
  }

  loadEvents(): void {
    this.loading = true;
    this.loadError = false;
    this.eventsService.getEvents(50, 0).subscribe({
      next: (res) => {
        this.events = res.meetups.map(toEventCard);
        this.loading = false;
      },
      error: () => {
        this.loadError = true;
        this.loading = false;
      }
    });
  }

  activeTab: EventsTab = 'all';

  setTab(tab: EventsTab): void {
    this.activeTab = tab;
  }

  get visibleEvents(): CommunityEventCard[] {
    if (this.activeTab === 'hosted') {
      const uid = this.user()?.id;
      return this.events.filter((ev) => ev.hostId === uid);
    }
    if (this.activeTab === 'joined') {
      return this.events.filter((ev) => ev.joined);
    }
    return this.events;
  }

  /** Location + price chips shown at the bottom of an event card. */
  tagsFor(ev: CommunityEventCard): string[] {
    const parts = ev.location.split(',').map((p) => p.trim()).filter(Boolean);
    return [...parts, ev.price];
  }

  // "Join & add to itinerary" — joining opens the trip/day picker; leaving is instant.
  tripModalEvent: CommunityEventCard | null = null;

  onJoinClick(ev: CommunityEventCard): void {
    if (ev.joined) {
      this.leave(ev);
    } else {
      this.tripModalEvent = ev;
    }
  }

  closeTripModal(): void {
    this.tripModalEvent = null;
  }

  confirmTripModal(payload: { trip: TripOption; day: TripDayOption }): void {
    const ev = this.tripModalEvent;
    if (!ev) return;
    this.tripModalEvent = null;
    this.eventsService.setRsvp(ev.id, 'going').subscribe({
      next: () => {
        ev.joined = true;
        ev.travelersGoing += 1;
        this.showToast(`You're going · added to ${payload.trip.name} · ${payload.day.label}, ${payload.day.dateLabel}`);
      },
      error: (err) => {
        this.showToast(err?.status === 401 ? 'Log in to join this event' : "Couldn't join — try again");
      }
    });
  }

  private leave(ev: CommunityEventCard): void {
    // Backend semantics: posting the same RSVP status you already have removes it.
    this.eventsService.setRsvp(ev.id, 'going').subscribe({
      next: () => {
        ev.joined = false;
        ev.travelersGoing -= 1;
        this.showToast(`Spot released · ${ev.title}`);
      },
      error: () => this.showToast("Couldn't update your RSVP — try again")
    });
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = null), 2500);
  }
}
