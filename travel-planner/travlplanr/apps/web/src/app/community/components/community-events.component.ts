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

const MONTH_ORDER = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function dayKey(month: string, day: string | number): number {
  return MONTH_ORDER.indexOf(month) * 100 + Number(day);
}

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

  /** The traveler's next upcoming trip — drives the "during your trip" filter toggle. */
  readonly myTrip = {
    destination: 'Paris',
    dateRangeLabel: 'Jun 03 – Jun 08',
    startKey: dayKey('JUN', 3),
    endKey: dayKey('JUN', 8)
  };

  tripFilterOn = false;

  toggleTripFilter(): void {
    this.tripFilterOn = !this.tripFilterOn;
  }

  get visibleEvents(): CommunityEventCard[] {
    if (!this.tripFilterOn) return this.events;
    return this.events.filter((ev) => {
      const key = dayKey(ev.month, ev.day);
      return key >= this.myTrip.startKey && key <= this.myTrip.endKey;
    });
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
