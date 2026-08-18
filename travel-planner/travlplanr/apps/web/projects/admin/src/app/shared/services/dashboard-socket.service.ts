import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AdminAuthService } from './admin-auth.service';

/**
 * Real-time push for admin dashboard metrics — connects to reporting's
 * `/api/v1/admin/ws` (see services/reporting/app/routers/websocket.py).
 * Reconnects on drop; the dashboard component's existing poll interval
 * stays as a fallback if the socket never connects (e.g. behind a proxy
 * that blocks upgrades).
 */
@Injectable({ providedIn: 'root' })
export class DashboardSocketService implements OnDestroy {
  private socket$: WebSocketSubject<{ type: string }> | null = null;
  private readonly updates = new Subject<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private auth: AdminAuthService) {}

  connect(): void {
    if (this.socket$) return;
    const token = this.auth.getToken();
    if (!token) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${wsProtocol}//${window.location.host}/api/v1/admin/ws?token=${token}`;

    this.socket$ = webSocket({
      url,
      closeObserver: {
        next: () => {
          this.socket$ = null;
          this.reconnectTimer = setTimeout(() => this.connect(), 5000);
        },
      },
    });

    this.socket$.subscribe({
      next: (msg) => this.updates.next(msg.type),
      error: () => {
        this.socket$ = null;
      },
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket$?.complete();
    this.socket$ = null;
  }

  onUpdate() {
    return this.updates.asObservable();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
