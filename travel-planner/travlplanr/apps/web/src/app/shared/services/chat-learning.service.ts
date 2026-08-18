import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../utils/api-url';
import { SuggestedActivity } from '../utils/activity-suggestions.util';

export type ActivityOutcomeEvent = 'suggested' | 'kept' | 'removed' | 'swapped' | 'booked';

export interface ActivityOutcomePayload {
  city: string;
  activity_title: string;
  event_type: ActivityOutcomeEvent;
  budget_tier?: string;
  day_number?: number;
  source?: string;
  interaction_id?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ChatLearningService {
  private readonly http = inject(HttpClient);

  /** Last server-recorded chat turn — used to link activity outcomes to the prompt that caused them. */
  readonly lastInteractionId = signal<string | null>(null);

  setLastInteractionId(id: string | null): void {
    this.lastInteractionId.set(id);
  }

  async submitFeedback(interactionId: string, feedback: 'up' | 'down', note?: string): Promise<void> {
    await firstValueFrom(
      this.http.post(apiUrl('/chat/feedback'), {
        interaction_id: interactionId,
        feedback,
        note: note ?? null,
      }),
    );
  }

  async recordOutcomes(tripId: string | null, outcomes: ActivityOutcomePayload[]): Promise<void> {
    if (!outcomes.length) return;
    const interactionId = this.lastInteractionId();
    const enriched = outcomes.map((o) => ({
      ...o,
      interaction_id: o.interaction_id ?? interactionId,
    }));
    await firstValueFrom(
      this.http.post(apiUrl('/chat/outcomes'), {
        trip_id: tripId,
        outcomes: enriched,
      }),
    );
  }

  async fetchRankedSuggestions(params: {
    tripId: string;
    day: number;
    count: number;
    existingTitles: string[];
    curatedCandidates: SuggestedActivity[];
  }): Promise<SuggestedActivity[]> {
    const res = await firstValueFrom(
      this.http.post<{ suggestions: SuggestedActivity[] }>(apiUrl('/chat/activity-suggestions'), {
        trip_id: params.tripId,
        day: params.day,
        count: params.count,
        existing_titles: params.existingTitles,
        curated_candidates: params.curatedCandidates,
      }),
    );
    return res.suggestions ?? [];
  }

  /** Fire-and-forget outcome — never blocks the UI on learning telemetry. */
  trackOutcome(tripId: string | null, outcome: ActivityOutcomePayload): void {
    void this.recordOutcomes(tripId, [outcome]).catch((err) =>
      console.debug('activity outcome telemetry failed', err),
    );
  }
}
