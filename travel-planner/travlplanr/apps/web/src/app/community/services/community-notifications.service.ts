import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';

export interface Notification {
  id: string;
  type: string;
  actor_id?: string | null;
  message: string;
  link_url?: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  messages: boolean;
  weekly_digest: boolean;
}

import { WebsocketService } from '../../core/services/websocket.service';

@Injectable({ providedIn: 'root' })
export class CommunityNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebsocketService);
  
  // Expose messages directly from the core service
  readonly wsMessages$ = this.wsService.getMessages();

  getNotifications(limit: number = 20, offset: number = 0): Observable<Notification[]> {
    return this.http.get<Notification[]>(apiUrl(`/community/notifications?limit=${limit}&offset=${offset}`));
  }

  getUnreadCount(): Observable<{ unread_count: number }> {
    return this.http.get<{ unread_count: number }>(apiUrl('/community/notifications/unread-count'));
  }

  markAsRead(notificationId: string): Observable<{ status: string }> {
    return this.http.patch<{ status: string }>(apiUrl(`/community/notifications/${notificationId}/read`), {});
  }

  markAllAsRead(): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(apiUrl('/community/notifications/read-all'), {});
  }

  getPreferences(): Observable<NotificationPreferences> {
    return this.http.get<NotificationPreferences>(apiUrl('/community/notifications/preferences'));
  }

  updatePreferences(data: Partial<NotificationPreferences>): Observable<NotificationPreferences> {
    return this.http.put<NotificationPreferences>(apiUrl('/community/notifications/preferences'), data);
  }

  // Backwards compatibility methods - core service handles auto-connect now
  connectWebSocket() {
    this.wsService.connect();
  }

  disconnectWebSocket() {
    this.wsService.disconnect();
  }
}
