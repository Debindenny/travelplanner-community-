import { Component, effect, inject, OnInit, signal, DOCUMENT } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';

import { filter } from 'rxjs/operators';
import { WebsocketService } from './core/services/websocket.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FloatingChatbotComponent } from './shared/components/floating-chatbot/floating-chatbot.component';
import { CommandPaletteComponent } from './shared/components/command-palette/command-palette.component';
import { ChatContextService } from './shared/services/chat-context.service';
import { EventHostAssistantService } from './shared/services/event-host-assistant.service';
import { ToastHostComponent } from 'ui';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, FloatingChatbotComponent, CommandPaletteComponent, ToastHostComponent],
    template: `
    <a class="skip-link" href="#main-content">Skip to main content</a>
    @if (chatContext.backgroundHint(); as hint) {
      <div class="chat-bg-hint" role="status" aria-live="polite">{{ hint }}</div>
    }
    <main
      id="main-content"
      tabindex="-1"
      class="outline-none"
      [class.chat-driving-bg]="chatContext.chatOpen() && chatContext.activeDestination()"
      [class.event-host-blur]="eventHost.active() && chatContext.chatOpen()"
    >
      <router-outlet></router-outlet>
    </main>
    @defer (on idle) {
      @if (!hideFloatingChat() || eventHost.active()) {
        <app-floating-chatbot />
      }
    }
    <app-command-palette />
    <lib-toast-host />
  `,
    styles: [`
    .chat-bg-hint {
      position: fixed;
      top: 72px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9990;
      background: rgba(0, 96, 234, 0.95);
      color: white;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 20px rgba(0, 96, 234, 0.35);
      animation: hintIn 0.3s ease;
      pointer-events: none;
    }
    @keyframes hintIn {
      from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    main.chat-driving-bg {
      transition: filter 0.35s ease;
    }
    main.event-host-blur {
      filter: blur(6px) brightness(0.94);
      transition: filter 0.35s ease;
      pointer-events: none;
      user-select: none;
    }
  `]
})
export class AppComponent implements OnInit {
  readonly chatContext = inject(ChatContextService);
  readonly eventHost = inject(EventHostAssistantService);
  title = 'Travl Planr';

  private readonly document = inject(DOCUMENT);
  /** Pathname only — query/hash updates must not steal focus from inputs. */
  private lastFocusedPath = '';

  // The floating "Describe your trip" chat widget doesn't belong on the
  // Discover/Saved/Trips/Travel Circles pages — they have their own focused UI.
  // Events keeps it: it's also the entry point for the Host Event assistant.
  private static readonly HIDE_FLOATING_CHAT_ON = [
    '/community/discover',
    '/community/saved',
    '/community/trips',
    '/community/travel-circles',
  ];
  // The main community feed has its own composer — exact match only.
  private static readonly HIDE_FLOATING_CHAT_EXACT = ['/community'];
  // Review → Payment → Confirmation each have their own single focused CTA (Proceed to
  // Payment / Pay Now) that the floating dock would otherwise sit on top of. Event Detail
  // and Event Summary (the planning/browsing stages before this) deliberately keep it.
  private static readonly HIDE_FLOATING_CHAT_PATTERN = /^\/community\/events\/[^/]+\/(review|payment|success)(\/|$)/;
  readonly hideFloatingChat = signal(false);

  constructor(private router: Router, private ws: WebsocketService) {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed()
    ).subscribe((event) => {
      const path = event.urlAfterRedirects.split('?')[0].split('#')[0];
      this.hideFloatingChat.set(
        AppComponent.HIDE_FLOATING_CHAT_EXACT.includes(path) ||
        AppComponent.HIDE_FLOATING_CHAT_ON.some((route) => path.startsWith(route)) ||
        AppComponent.HIDE_FLOATING_CHAT_PATTERN.test(path)
      );
      if (path === this.lastFocusedPath) return;
      this.lastFocusedPath = path;
      setTimeout(() => {
        const h1 = this.document.querySelector('h1');
        if (h1) {
          h1.setAttribute('tabindex', '-1');
          h1.focus();
        } else {
          this.document.getElementById('main-content')?.focus();
        }
      }, 50);
    });

    // Keep wheel/trackpad scroll inside the chat thread while a chat dock is open.
    effect(() => {
      const lock = this.chatContext.chatOpen() || this.chatContext.heroChatActive();
      const body = this.document.body;
      if (!body) return;
      body.style.overflow = lock ? 'hidden' : '';
    });
  }

  ngOnInit(): void {}
}
