import { Injectable, inject, signal } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { environment } from '../../../environments/environment';

export interface WebSocketEvent<T = any> {
  type: 'message' | 'notification' | 'typing' | 'read_receipt';
  /** Server sends this key; `payload` is kept as an alias for older callers. */
  data: T;
  payload: T;
  message_id?: string;
}

/** Backoff schedule (ms) for reconnect attempts; the last value repeats. */
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

@Injectable({ providedIn: 'root' })
export class CommunityWebSocketService {
  private readonly auth = inject(AuthService);
  private socket: WebSocket | null = null;
  private readonly eventSubject = new Subject<WebSocketEvent>();

  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private seenMessageIds = new Set<string>();

  readonly isConnected = signal<boolean>(false);
  readonly events$: Observable<WebSocketEvent> = this.eventSubject.asObservable();

  /**
   * The server route is `/api/v1/community/ws/{customer_id}`, and it authenticates
   * via the `access_token.<jwt>` WebSocket subprotocol — a `?token=` query param is
   * only honored in dev environments, and is logged by proxies in production.
   */
  private buildUrl(customerId: string): string {
    const base = environment.apiBase || '';
    if (base) {
      const url = new URL(base, window.location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.pathname = `${url.pathname.replace(/\/$/, '')}/api/v1/community/ws/${customerId}`;
      return url.toString();
    }
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${window.location.host}/api/v1/community/ws/${customerId}`;
  }

  connect(url?: string): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = this.auth?.token;
    // AuthUser.id is populated from the JWT's `customer_id` claim, which is what
    // the endpoint's path segment is matched against server-side.
    const customerId = this.auth?.user()?.id;
    if (!token || !customerId) {
      // Unauthenticated: the endpoint would reject the handshake anyway.
      this.isConnected.set(false);
      return;
    }

    this.manuallyClosed = false;
    const wsUrl = url || this.buildUrl(customerId);

    try {
      this.socket = new WebSocket(wsUrl, [`access_token.${token}`]);

      this.socket.onopen = () => {
        this.reconnectAttempt = 0;
        this.isConnected.set(true);
      };

      this.socket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          // The server tags every broadcast with a message_id so the same event
          // arriving over both the socket and pubsub is only surfaced once.
          if (raw?.message_id) {
            if (this.seenMessageIds.has(raw.message_id)) {
              return;
            }
            this.seenMessageIds.add(raw.message_id);
            if (this.seenMessageIds.size > 500) {
              this.seenMessageIds = new Set([...this.seenMessageIds].slice(-250));
            }
          }
          const data = raw?.data ?? raw?.payload;
          this.eventSubject.next({ ...raw, data, payload: data });
        } catch {
          // Non-JSON message payload fallback
        }
      };

      this.socket.onclose = () => {
        this.isConnected.set(false);
        this.socket = null;
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnected.set(false);
      };
    } catch {
      this.isConnected.set(false);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.manuallyClosed || this.reconnectTimer) {
      return;
    }
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  send(type: string, payload: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload }));
    }
  }

  disconnect(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = 0;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected.set(false);
  }
}
