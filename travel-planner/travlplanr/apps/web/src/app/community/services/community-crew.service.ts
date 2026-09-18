import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { apiUrl } from '../../shared/utils/api-url';

// NOTE: shapes below mirror the real backend
// (services/planner/app/routers/community_crew.py). A "crew" is a
// CommunitySpace tagged with a destination/date window — matching finds or
// creates one from the caller's own trips; joining/leaving/members/messages
// all reuse the existing Travel Circles (community_spaces) endpoints.

export interface CrewSampleMember {
  name: string;
  avatar: string | null;
}

export interface CrewMatch {
  id: string;
  name: string;
  destinationName: string;
  startDate: string | null;
  endDate: string | null;
  coverImage: string | null;
  accent: string | null;
  accent2: string | null;
  memberCount: number;
  isJoined: boolean;
  role: string | null;
  sampleMembers: CrewSampleMember[];
}

export interface CrewInvite {
  id: string;
  spaceId: string;
  spaceName: string;
  dateRange: string | null;
  sender: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

export interface CrewMatchResponse {
  matches: CrewMatch[];
  invite: CrewInvite | null;
  /** false when the caller has no active trips — `matches` then holds popular
   * public crews to discover/join instead of a personalized match. */
  personalized: boolean;
}

export interface CrewMembershipResult {
  isJoined: boolean;
  memberCount: number;
}

// The backend names an auto-matched crew space "{Destination} Crew" (e.g.
// "Italy Crew") — the two helpers below clean that up for display without
// touching the backend name/field itself.

/** For card/chat titles: swap the word "Crew" for "Circle" in place,
 * e.g. "Italy Crew" -> "Italy Circle". */
function crewNameToCircle(value: string): string {
  return value.replace(/\bcrew\b/i, 'Circle');
}

/** For the destination plugged into "Find your {destination} Circle": drop
 * the "Crew" suffix entirely so that template doesn't double up on "Circle". */
function stripCrewSuffix(value: string): string {
  return value.replace(/\s+crew\s*$/i, '').trim();
}

function fromWireMatch(m: any): CrewMatch {
  return {
    id: m.id,
    name: crewNameToCircle(m.name),
    destinationName: stripCrewSuffix(m.destination_name ?? m.name),
    startDate: m.start_date ?? null,
    endDate: m.end_date ?? null,
    coverImage: m.cover_image ?? null,
    accent: m.accent ?? null,
    accent2: m.accent2 ?? null,
    memberCount: m.member_count ?? 0,
    isJoined: !!m.is_joined,
    role: m.role ?? null,
    sampleMembers: (m.sample_members ?? []).map((s: any) => ({ name: s.name, avatar: s.avatar ?? null })),
  };
}

function fromWireInvite(i: any): CrewInvite | null {
  if (!i) return null;
  return {
    id: i.id,
    spaceId: i.space_id,
    spaceName: crewNameToCircle(i.space_name),
    dateRange: i.date_range ?? null,
    sender: {
      id: i.sender?.id ?? '',
      name: i.sender?.name ?? 'Traveler',
      avatar: i.sender?.avatar ?? null,
    },
  };
}

@Injectable({ providedIn: 'root' })
export class CommunityCrewService {
  private readonly http = inject(HttpClient);

  /** Destination/date-matched crews for the current user's own upcoming trips,
   * plus any pending invite waiting on them. */
  getMatches(): Observable<CrewMatchResponse> {
    return this.http.get<any>(apiUrl('/community/crew/match')).pipe(
      map((res) => ({
        matches: (res.matches ?? []).map(fromWireMatch),
        invite: fromWireInvite(res.invite),
        personalized: res.personalized !== false,
      })),
    );
  }

  /** Join a matched crew immediately (no approval step). */
  requestJoin(crewGroupId: string): Observable<CrewMembershipResult> {
    return this.http.post<any>(apiUrl(`/community/crew/${crewGroupId}/request-join`), {}).pipe(
      map((res) => ({ isJoined: res.action === 'joined', memberCount: res.member_count })),
    );
  }

  /** Leave a crew the user previously joined. */
  leave(crewGroupId: string): Observable<CrewMembershipResult> {
    return this.http.post<any>(apiUrl(`/community/crew/${crewGroupId}/leave`), {}).pipe(
      map((res) => ({ isJoined: res.action !== 'left', memberCount: res.member_count })),
    );
  }

  /** Invite another traveler into a crew the caller has already joined. */
  invite(crewGroupId: string, receiverCustomerId: string): Observable<{ id: string; status: string }> {
    return this.http.post<any>(apiUrl(`/community/crew/${crewGroupId}/invite`), {
      receiver_customer_id: receiverCustomerId,
    });
  }

  acceptInvite(invitationId: string): Observable<{ spaceId: string; memberCount: number }> {
    return this.http.post<any>(apiUrl(`/community/crew/invitations/${invitationId}/accept`), {}).pipe(
      map((res) => ({ spaceId: res.space_id, memberCount: res.member_count })),
    );
  }

  declineInvite(invitationId: string): Observable<void> {
    return this.http.post<void>(apiUrl(`/community/crew/invitations/${invitationId}/decline`), {});
  }
}
