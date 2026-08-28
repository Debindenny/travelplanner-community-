import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { apiUrl } from '../../../../../shared/utils/api-url';

export type SpaceVisibility = 'public' | 'private';

export interface CommunitySpace {
  id: string;
  name: string;
  description: string | null;
  cover_image: string | null;
  visibility: SpaceVisibility;
  created_at: string | null;
  created_by: { id: string; name: string; avatar: string | null };
  member_count: number;
  is_joined: boolean;
  role: 'owner' | 'admin' | 'member' | null;
}

export interface SpaceMemberSummary {
  customer_id: string;
  name: string;
  avatar: string | null;
  role: 'owner' | 'admin' | 'member';
  joined_at: string | null;
}

export interface CreateSpacePayload {
  name: string;
  description?: string;
  cover_image?: string;
  visibility: SpaceVisibility;
}

@Injectable({ providedIn: 'root' })
export class CommunitySpacesService {
  private readonly http = inject(HttpClient);

  private readonly spacesSignal = signal<CommunitySpace[]>([]);
  private readonly loadingSignal = signal<boolean>(true);
  private readonly loadErrorSignal = signal<string | null>(null);

  readonly spaces = this.spacesSignal.asReadonly();
  readonly isLoading = this.loadingSignal.asReadonly();
  readonly loadError = this.loadErrorSignal.asReadonly();

  constructor() {
    this.refreshSpaces();
  }

  /** Load (or retry loading) all community spaces; surfaces failures via loadError. */
  refreshSpaces(): void {
    this.loadingSignal.set(true);
    this.loadErrorSignal.set(null);
    this.loadSpaces()
      .then((spaces) => {
        this.spacesSignal.set(spaces);
        this.loadingSignal.set(false);
      })
      .catch((e) => {
        console.error('Failed to load community spaces from API', e);
        this.spacesSignal.set([]);
        this.loadErrorSignal.set('Failed to load travel circles');
        this.loadingSignal.set(false);
      });
  }

  private async loadSpaces(): Promise<CommunitySpace[]> {
    const res: any = await firstValueFrom(this.http.get(apiUrl('/community/spaces')));
    return Array.isArray(res) ? (res as CommunitySpace[]) : [];
  }

  async createSpace(payload: CreateSpacePayload): Promise<CommunitySpace> {
    const space = await firstValueFrom(
      this.http.post<CommunitySpace>(apiUrl('/community/spaces'), payload),
    );
    this.spacesSignal.set([space, ...this.spacesSignal()]);
    return space;
  }

  /** Toggles the current user's membership (join if not a member, leave if they are). */
  async toggleJoin(spaceId: string): Promise<{ action: 'joined' | 'left'; member_count: number }> {
    const res = await firstValueFrom(
      this.http.post<{ status: string; action: 'joined' | 'left'; member_count: number }>(
        apiUrl(`/community/spaces/${spaceId}/join`),
        {},
      ),
    );
    this.spacesSignal.set(
      this.spacesSignal().map((s) =>
        s.id === spaceId
          ? { ...s, is_joined: res.action === 'joined', role: res.action === 'joined' ? 'member' : null, member_count: res.member_count }
          : s,
      ),
    );
    return res;
  }

  async getMembers(spaceId: string): Promise<SpaceMemberSummary[]> {
    try {
      const res: any = await firstValueFrom(this.http.get(apiUrl(`/community/spaces/${spaceId}/members`)));
      return Array.isArray(res) ? (res as SpaceMemberSummary[]) : [];
    } catch (e) {
      console.error('Failed to load circle members', e);
      return [];
    }
  }
}
