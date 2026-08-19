import { Injectable, OnDestroy, effect } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from '../../auth/auth.service';
import { environment } from '../../../environments/environment';

export interface WsMessage<T = any> {
  type: string;
  payload: T;
}



@Injectable({
  providedIn: 'root'
})
export class WebsocketService implements OnDestroy {
  private socket$: WebSocketSubject<WsMessage> | null = null;
  private messageSubject = new Subject<WsMessage>();
  private reconnectInterval = 3000;
  private isConnecting = false;

  constructor(private auth: AuthService) {
    // Auto-connect on login, auto-disconnect on logout. connect()/disconnect()
    // remain public so callers can still manage the socket explicitly.
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  ngOnDestroy() {
    this.disconnect();
  }

  public connect() {
    if (this.socket$ || this.isConnecting) return;
    
    this.isConnecting = true;
    const token = this.auth.token;
    if (!token) {
      this.isConnecting = false;
      return;
    }
    
    // Derive WS URL properly to support wss:// on HTTPS and handle relative apiBase.
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const base = environment.apiBase || '';
    const baseUrl = new URL(base || '/', window.location.origin);
    baseUrl.protocol = wsProtocol;

    let wsUrl = baseUrl.toString();
    if (!wsUrl.endsWith('/')) {
      wsUrl += '/';
    }
    wsUrl += 'api/v1/ws';

    this.socket$ = webSocket<WsMessage>({
      url: wsUrl,
      protocol: `access_token.${token}`,
      openObserver: {
        next: () => {
          console.log('[WebSocket] Connected');
          this.isConnecting = false;
        }
      },
      closeObserver: {
        next: (event) => {
          console.log('[WebSocket] Disconnected', event);
          this.socket$ = null;
          this.isConnecting = false;
          // Reconnect logic
          if (this.auth.isLoggedIn()) {
            setTimeout(() => this.connect(), this.reconnectInterval);
          }
        }
      }
    });

    this.socket$.subscribe({
      next: (msg) => this.messageSubject.next(msg),
      error: (err) => {
        console.error('[WebSocket] Error', err);
        // The closeObserver will handle reconnect
      }
    });
  }

  public disconnect() {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
    }
    this.isConnecting = false;
  }

  public getMessages(): Observable<WsMessage> {
    return this.messageSubject.asObservable();
  }
  
  public getMessagesOfType<T>(type: string): Observable<T> {
    return new Observable<T>(subscriber => {
      return this.messageSubject.subscribe(msg => {
        if (msg.type === type) {
          subscriber.next(msg.payload as T);
        }
      });
    });
  }

  public sendMessage(type: string, payload: any) {
    if (this.socket$) {
      this.socket$.next({ type, payload });
    }
  }
}
