import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';

export type SpaceMessageKind = 'text' | 'poll' | 'meetup' | 'expense' | 'place';

export interface SpaceMessage {
  id: string;
  space_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  kind: SpaceMessageKind;
  created_at: string;
  // text
  text?: string;
  // poll
  question?: string;
  options?: string[];
  votes?: Record<string, number>;
  my_vote?: string | null;
  // meetup / expense / place share title + meta
  title?: string;
  meta?: string;
  // meetup
  rsvp_counts?: { in: number; out: number };
  my_rsvp?: 'in' | 'out' | null;
  // expense
  total_amount?: number;
  participant_count?: number;
  notes?: string | null;
  settled_count?: number;
  is_settled_by_me?: boolean;
  // place
  image?: string;
  cta_label?: string;
  added_count?: number;
  is_added_by_me?: boolean;
}

export interface CreateSpaceMessageRequest {
  kind: SpaceMessageKind;
  text?: string;
  question?: string;
  options?: string[];
  title?: string;
  meta?: string;
  total_amount?: number;
  participant_count?: number;
  notes?: string;
  image?: string;
  cta_label?: string;
}

export interface PollVoteResult {
  message_id: string;
  votes: Record<string, number>;
  customer_id: string;
}

export interface MeetupRsvpResult {
  message_id: string;
  rsvp_counts: { in: number; out: number };
  customer_id: string;
  status: 'in' | 'out';
}

export interface ExpenseSettleResult {
  message_id: string;
  settled_count: number;
  customer_id: string;
}

export interface PlaceAddResult {
  message_id: string;
  added_count: number;
  customer_id: string;
}

@Injectable({ providedIn: 'root' })
export class CommunitySpaceMessagesService {
  private readonly http = inject(HttpClient);

  getMessages(spaceId: string, limit = 50, offset = 0): Observable<SpaceMessage[]> {
    return this.http.get<SpaceMessage[]>(apiUrl(`/community/spaces/${spaceId}/messages?limit=${limit}&offset=${offset}`));
  }

  sendMessage(spaceId: string, data: CreateSpaceMessageRequest): Observable<SpaceMessage> {
    return this.http.post<SpaceMessage>(apiUrl(`/community/spaces/${spaceId}/messages`), data);
  }

  votePoll(spaceId: string, messageId: string, option: string): Observable<PollVoteResult> {
    return this.http.post<PollVoteResult>(apiUrl(`/community/spaces/${spaceId}/messages/${messageId}/vote`), { option });
  }

  rsvpMeetup(spaceId: string, messageId: string, status: 'in' | 'out'): Observable<MeetupRsvpResult> {
    return this.http.post<MeetupRsvpResult>(apiUrl(`/community/spaces/${spaceId}/messages/${messageId}/rsvp`), { status });
  }

  settleExpense(spaceId: string, messageId: string): Observable<ExpenseSettleResult> {
    return this.http.post<ExpenseSettleResult>(apiUrl(`/community/spaces/${spaceId}/messages/${messageId}/settle`), {});
  }

  addPlaceToTrip(spaceId: string, messageId: string): Observable<PlaceAddResult> {
    return this.http.post<PlaceAddResult>(apiUrl(`/community/spaces/${spaceId}/messages/${messageId}/add-place`), {});
  }
}
