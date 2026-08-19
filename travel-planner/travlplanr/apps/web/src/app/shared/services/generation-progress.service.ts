import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { WebsocketService } from '../../core/services/websocket.service';

export type GenerationStatus = 'started' | 'completed' | 'failed';

export interface GenerationProgressPayload {
  trip_id: string;
  status: GenerationStatus;
  reason?: string;
}

/**
 * Tracks the most recent generation.progress event per trip, pushed over the
 * existing `/ws` socket by `services/planner/app/consumers/ai_worker_consumer.py`.
 * Backed by a signal so the itinerary page can show a live progress banner
 * instead of silently polling for the trip to leave the "generating" state.
 */
@Injectable({ providedIn: 'root' })
export class GenerationProgressService {
  private ws = inject(WebsocketService);
  private readonly byTripId = signal<Record<string, GenerationProgressPayload>>({});
  private readonly statusSignals = new Map<string, Signal<GenerationStatus | null>>();

  constructor() {
    this.ws.getMessagesOfType<GenerationProgressPayload>('generation.progress').subscribe((payload) => {
      if (!payload?.trip_id) return;
      this.byTripId.update((map) => ({ ...map, [payload.trip_id]: payload }));
    });
  }

  statusFor(tripId: string): Signal<GenerationStatus | null> {
    const existing = this.statusSignals.get(tripId);
    if (existing) return existing;

    const signalForTrip = computed(() => this.byTripId()[tripId]?.status ?? null);
    this.statusSignals.set(tripId, signalForTrip);
    return signalForTrip;
  }

  reasonFor(tripId: string): string | undefined {
    return this.byTripId()[tripId]?.reason;
  }
}
