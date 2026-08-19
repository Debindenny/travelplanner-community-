import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';

export interface CreateReportPayload {
  target_type: 'post' | 'comment' | 'story' | 'user' | 'message';
  target_id: string;
  reason: string;
  details?: string;
}

export interface BlockedUser {
  id: string;
  name: string;
  avatar: string | null;
  blocked_at: string;
}

@Injectable({ providedIn: 'root' })
export class CommunityModerationService {
  private readonly http = inject(HttpClient);

  createReport(payload: CreateReportPayload): Observable<{ status: string; report_id: string }> {
    return this.http.post<{ status: string; report_id: string }>(apiUrl('/community/reports'), payload);
  }

  toggleBlock(customerId: string): Observable<{ status: string; action: string; is_blocked: boolean }> {
    return this.http.post<{ status: string; action: string; is_blocked: boolean }>(
      apiUrl(`/community/users/${customerId}/block`),
      {}
    );
  }

  getBlockedUsers(): Observable<BlockedUser[]> {
    return this.http.get<BlockedUser[]>(apiUrl('/community/blocks'));
  }
}
