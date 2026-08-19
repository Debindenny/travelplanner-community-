import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';

export interface Conversation {
  id: string;
  other_user: {
    id: string;
    name: string;
    avatar: string | null;
  };
  last_message_at: string;
  unread_count: number;
  last_message_preview?: string;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  conversation_id: string;
}

import { CommunityWebSocketService } from './community-websocket.service';

@Injectable({ providedIn: 'root' })
export class CommunityMessagesService {
  private readonly http = inject(HttpClient);
  private readonly ws = inject(CommunityWebSocketService);

  readonly realTimeEvents$ = this.ws.events$;

  connectRealTime(): void {
    this.ws.connect();
  }

  getConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(apiUrl('/community/messages/conversations'));
  }

  getMessages(conversationId: string): Observable<DirectMessage[]> {
    return this.http.get<DirectMessage[]>(apiUrl(`/community/messages/${conversationId}`));
  }

  sendMessage(recipientId: string, content: string): Observable<DirectMessage> {
    // Sent over HTTP only. The community WebSocket endpoint is receive-only —
    // it discards inbound frames — so also pushing the message through the socket
    // would either be a no-op or, once the server handles frames, a duplicate send.
    return this.http.post<DirectMessage>(apiUrl('/community/messages'), {
      recipient_id: recipientId,
      content
    });
  }
}
