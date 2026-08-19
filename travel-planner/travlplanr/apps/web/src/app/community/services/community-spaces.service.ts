import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { apiUrl } from '../../shared/utils/api-url';

/* ── Types ────────────────────────────────────────────── */
// NOTE: shapes below mirror the real backend (services/planner/app/routers/community_spaces.py).
// The CommunitySpace/SpaceMember tables have no slug/icon/category/rules/pinnedPostIds/postCount
// columns, so those fake fields were removed rather than fabricated.

export interface SpaceAuthor {
  id: string;
  name: string;
  avatar: string | null;
}

export interface SpaceListItem {
  id: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  memberCount: number;
  isJoined: boolean;
  role: string | null;
  createdBy: SpaceAuthor;
  createdAt: string;
}

export type Space = SpaceListItem;

export interface CreateSpacePayload {
  name: string;
  description?: string;
  coverImage?: string;
}

/* ── Wire <-> model mapping ───────────────────────────── */

function fromWire(s: any): Space {
  return {
    id: s.id,
    name: s.name,
    description: s.description ?? null,
    coverImage: s.cover_image ?? null,
    memberCount: s.member_count ?? 0,
    isJoined: !!s.is_joined,
    role: s.role ?? null,
    createdBy: {
      id: s.created_by?.id ?? '',
      name: s.created_by?.name ?? 'Traveler',
      avatar: s.created_by?.avatar ?? null,
    },
    createdAt: s.created_at,
  };
}

/* ── Service ──────────────────────────────────────────── */

@Injectable({ providedIn: 'root' })
export class CommunitySpacesService {
  private readonly http = inject(HttpClient);

  /** List all spaces. */
  getSpaces(limit = 30, offset = 0): Observable<SpaceListItem[]> {
    return this.http
      .get<any[]>(apiUrl(`/community/spaces?limit=${limit}&offset=${offset}`))
      .pipe(map((list) => list.map(fromWire)));
  }

  /** Get single space details. */
  getSpace(id: string): Observable<Space> {
    return this.http.get<any>(apiUrl(`/community/spaces/${id}`)).pipe(map(fromWire));
  }

  /** Create a new space. */
  createSpace(payload: CreateSpacePayload): Observable<Space> {
    const wire = {
      name: payload.name,
      description: payload.description,
      cover_image: payload.coverImage,
    };
    return this.http.post<any>(apiUrl('/community/spaces'), wire).pipe(map(fromWire));
  }

  /** Join or leave a space. Returns the new membership state. */
  toggleJoin(spaceId: string): Observable<{ isJoined: boolean; memberCount: number }> {
    return this.http.post<any>(apiUrl(`/community/spaces/${spaceId}/join`), {}).pipe(
      map((res) => ({ isJoined: res.action === 'joined', memberCount: res.member_count }))
    );
  }

  /**
   * Posts scoped to a Space are not implemented on the backend — CommunityPost has no
   * space_id column, so there is nothing real to fetch here. Rather than fabricate content,
   * this honestly reports an empty feed; the space-detail component renders its existing
   * "No Posts Yet" empty state for this case.
   */
  getSpacePosts(_spaceId: string, _limit = 10, _cursor?: string): Observable<{ posts: any[]; nextCursor?: string }> {
    return of({ posts: [], nextCursor: undefined });
  }

  /** Get my joined spaces. */
  getMySpaces(): Observable<SpaceListItem[]> {
    return this.http
      .get<any[]>(apiUrl('/community/spaces/mine'))
      .pipe(map((list) => list.map(fromWire)));
  }

  /** List members of a space. */
  getSpaceMembers(spaceId: string, limit = 50, offset = 0): Observable<any[]> {
    return this.http.get<any[]>(apiUrl(`/community/spaces/${spaceId}/members?limit=${limit}&offset=${offset}`));
  }
}
