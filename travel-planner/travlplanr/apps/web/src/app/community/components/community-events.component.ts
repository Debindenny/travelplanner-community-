import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommunityEventCard, CommunityMockEventsService, TripDayOption, TripOption } from '../services/community-mock-events.service';
import { AddToTripModalComponent } from './add-to-trip-modal.component';

const MONTH_ORDER = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function dayKey(month: string, day: string | number): number {
  return MONTH_ORDER.indexOf(month) * 100 + Number(day);
}

@Component({
  selector: 'app-community-events',
  imports: [CommonModule, RouterLink, AddToTripModalComponent],
  templateUrl: './community-events.component.html'
})
export class CommunityEventsComponent {
  private readonly eventsService = inject(CommunityMockEventsService);

  toastMessage: string | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const pending = this.eventsService.consumePendingToast();
    if (pending) this.showToast(pending);
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

  get events(): CommunityEventCard[] {
    return this.eventsService.events();
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
    ev.joined = true;
    ev.travelersGoing += 1;
    this.tripModalEvent = null;
    this.showToast(`You're going · added to ${payload.trip.name} · ${payload.day.label}, ${payload.day.dateLabel}`);
  }

  private leave(ev: CommunityEventCard): void {
    ev.joined = false;
    ev.travelersGoing -= 1;
    this.showToast(`Spot released · ${ev.title}`);
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = null), 2500);
  }
}
