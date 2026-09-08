import { Injectable, inject, signal, effect } from '@angular/core';
import { CommunityMessagesService } from './community-messages.service';
import { AuthService } from '../../auth/auth.service';
import { WebsocketService } from '../../core/services/websocket.service';

@Injectable({ providedIn: 'root' })
export class CommunityMessagesUnreadService {
  private readonly messagesService = inject(CommunityMessagesService);
  private readonly auth = inject(AuthService);
  private readonly wsService = inject(WebsocketService);

  readonly unreadCount = signal(0);

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.refresh();
      } else {
        this.unreadCount.set(0);
      }
    });

    this.wsService.getMessages().subscribe((msg) => {
      if (msg.type === 'direct_message' && this.auth.isLoggedIn()) {
        this.refresh();
      }
    });
  }

  refresh(): void {
    if (!this.auth.isLoggedIn()) {
      this.unreadCount.set(0);
      return;
    }
    this.messagesService.getConversations().subscribe({
      next: (convs) => this.unreadCount.set(convs.reduce((sum, c) => sum + (c.unread_count || 0), 0)),
      error: () => this.unreadCount.set(0),
    });
  }
}
