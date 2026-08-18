import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';

export type CommunityEvent =
  | 'post_create'
  | 'post_share'
  | 'post_view'
  | 'trip_clone'
  | 'collection_save'
  | 'map_pin_click'
  | 'reaction_type'
  | 'story_view'
  | 'buddy_message_sent';

@Injectable({ providedIn: 'root' })
export class CommunityAnalyticsService {
  private readonly http = inject(HttpClient);

  track(event: CommunityEvent, payload?: Record<string, unknown>) {
    this.http.post(apiUrl('/community/events'), { event, payload: payload ?? {} }).pipe(
      catchError(() => of(null))
    ).subscribe();
  }
}
