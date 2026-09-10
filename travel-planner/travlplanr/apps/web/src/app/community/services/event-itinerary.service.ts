import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';
import { JourneyDay, TransportSegment } from './community-event-view.model';

export interface EventItineraryResponse {
  days: JourneyDay[];
  transport: TransportSegment[];
}

export interface ParticipationState {
  eventId: string;
  mode: 'full' | 'partial';
  rangeStart: number | null;
  rangeEnd: number | null;
  paymentStatus: 'pending' | 'paid';
  amountPaid: number | null;
  bookingReference: string | null;
  tripId: string | null;
}

/**
 * Backend-persisted itinerary interactions for a hosted-journey event: the
 * day/activity catalog plus the current traveler's selection, bookings,
 * transport additions and join/payment participation state. See
 * services/planner/app/routers/event_itinerary.py.
 */
@Injectable({ providedIn: 'root' })
export class EventItineraryService {
  private readonly http = inject(HttpClient);

  getItinerary(eventId: string): Promise<EventItineraryResponse> {
    return firstValueFrom(
      this.http.get<EventItineraryResponse>(apiUrl(`/community/meetups/${eventId}/itinerary`))
    );
  }

  setSelection(eventId: string, activityId: string, included: boolean): Promise<{ activityId: string; included: boolean }> {
    return firstValueFrom(
      this.http.put<{ activityId: string; included: boolean }>(
        apiUrl(`/community/meetups/${eventId}/activities/${activityId}/selection`),
        { included }
      )
    );
  }

  bookActivity(eventId: string, activityId: string): Promise<{ activityId: string; booked: boolean; bookedCount: number; capacity: number | null }> {
    return firstValueFrom(
      this.http.post<{ activityId: string; booked: boolean; bookedCount: number; capacity: number | null }>(
        apiUrl(`/community/meetups/${eventId}/activities/${activityId}/book`),
        {}
      )
    );
  }

  changeActivity(eventId: string, activityId: string, newActivityId: string): Promise<{ old: { activityId: string; included: boolean }; new: { activityId: string; included: boolean } }> {
    return firstValueFrom(
      this.http.post<{ old: { activityId: string; included: boolean }; new: { activityId: string; included: boolean } }>(
        apiUrl(`/community/meetups/${eventId}/activities/${activityId}/change`),
        { newActivityId }
      )
    );
  }

  addTransport(
    eventId: string,
    payload: { afterDay: number; mode: string; title: string; time?: string; notes?: string; price?: number }
  ): Promise<TransportSegment> {
    return firstValueFrom(
      this.http.post<TransportSegment>(apiUrl(`/community/meetups/${eventId}/transport`), payload)
    );
  }

  removeTransport(eventId: string, transportId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(apiUrl(`/community/meetups/${eventId}/transport/${transportId}`))
    );
  }

  startParticipation(eventId: string, mode: 'full' | 'partial', rangeStart: number | null, rangeEnd: number | null): Promise<ParticipationState> {
    return firstValueFrom(
      this.http.post<ParticipationState>(apiUrl(`/community/meetups/${eventId}/participation`), {
        mode, rangeStart, rangeEnd
      })
    );
  }

  getParticipation(eventId: string): Promise<ParticipationState> {
    return firstValueFrom(
      this.http.get<ParticipationState>(apiUrl(`/community/meetups/${eventId}/participation`))
    );
  }

  payParticipation(eventId: string, amount: number): Promise<ParticipationState> {
    return firstValueFrom(
      this.http.post<ParticipationState>(apiUrl(`/community/meetups/${eventId}/participation/pay`), { amount })
    );
  }

  linkTrip(eventId: string, tripId: string): Promise<ParticipationState> {
    return firstValueFrom(
      this.http.patch<ParticipationState>(apiUrl(`/community/meetups/${eventId}/participation/trip`), { tripId })
    );
  }
}
