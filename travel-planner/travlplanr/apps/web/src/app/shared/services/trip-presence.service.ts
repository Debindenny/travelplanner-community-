import { Injectable, inject, signal } from '@angular/core';
import { WebsocketService } from '../../core/services/websocket.service';

export interface TripViewer {
  user_id: string;
  name: string;
}

interface TripPresencePayload {
  trip_id: string;
  viewers: TripViewer[];
}

/**
 * Live "who's viewing this trip" presence, pushed by
 * services/planner/app/routers/websocket.py over the existing `/ws` socket.
 * Purely in-memory on the backend — rebuilt as clients (re)join, so this
 * is best-effort, not a durable record.
 */
@Injectable({ providedIn: 'root' })
export class TripPresenceService {
  private ws = inject(WebsocketService);
  private readonly byTripId = signal<Record<string, TripViewer[]>>({});
  private joinedTripId: string | null = null;

  constructor() {
    this.ws.getMessagesOfType<TripPresencePayload>('trip_presence').subscribe((payload) => {
      if (!payload?.trip_id) return;
      this.byTripId.update((map) => ({ ...map, [payload.trip_id]: payload.viewers }));
    });
  }

  join(tripId: string, name: string): void {
    if (this.joinedTripId === tripId) return;
    if (this.joinedTripId) this.leave(this.joinedTripId);
    this.joinedTripId = tripId;
    this.ws.sendMessage('presence_join', { trip_id: tripId, name });
  }

  leave(tripId: string): void {
    if (this.joinedTripId === tripId) this.joinedTripId = null;
    this.ws.sendMessage('presence_leave', { trip_id: tripId });
    this.byTripId.update((map) => {
      const { [tripId]: _removed, ...rest } = map;
      return rest;
    });
  }

  viewersFor(tripId: string | null | undefined): TripViewer[] {
    if (!tripId) return [];
    return this.byTripId()[tripId] ?? [];
  }
}
