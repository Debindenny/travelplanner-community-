import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';
import { JourneyActivity, JourneyDay, TransportSegment } from './community-event-view.model';

/** Packs a JourneyActivity's flat kind-specific fields (carrier, flightNo,
 * amenities, etc.) into the single `extra` object the backend's
 * EventItineraryActivity.extra (JSONB) column expects — `null` for a plain
 * activity, which has no kind-specific fields to carry. */
function activityExtraFields(a: JourneyActivity): Record<string, unknown> | null {
  if (a.kind === 'flight') {
    return {
      carrier: a.carrier, flightNo: a.flightNo, flightClass: a.flightClass, refundable: a.refundable,
      status: a.status, depDate: a.depDate, depCode: a.depCode, arrDate: a.arrDate, arrTime: a.arrTime,
      arrCode: a.arrCode, stops: a.stops
    };
  }
  if (a.kind === 'hotel') {
    return { amenities: a.amenities, hotelDates: a.hotelDates, roomType: a.roomType, cancellation: a.cancellation };
  }
  if (a.kind === 'bus' || a.kind === 'train') {
    return {
      carrier: a.carrier, route: a.route, depDate: a.depDate, depLocation: a.depLocation,
      arrDate: a.arrDate, arrTime: a.arrTime, arrLocation: a.arrLocation, stops: a.stops
    };
  }
  return null;
}

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

  /** Host publishes (or republishes) the day-by-day itinerary — see
   * EventHostAssistantService.createEvent(). Replaces whatever was there
   * before for this event id. */
  createItinerary(eventId: string, days: JourneyDay[]): Promise<{ eventId: string; days: number }> {
    const body = {
      days: days.map((d) => ({
        day: d.day,
        city: d.city,
        dateLabel: d.dateLabel,
        price: d.price,
        activities: d.activities.map((a) => ({
          title: a.title,
          time: a.time,
          category: a.category,
          duration: a.duration,
          rating: a.rating,
          image: a.image,
          price: a.price,
          capacity: a.capacity ?? null,
          included: a.included,
          kind: a.kind ?? null,
          extra: activityExtraFields(a)
        }))
      }))
    };
    return firstValueFrom(
      this.http.post<{ eventId: string; days: number }>(apiUrl(`/community/meetups/${eventId}/itinerary`), body)
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
