import { Component, effect, inject, OnInit, signal, DOCUMENT } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';

import { filter } from 'rxjs/operators';
import { WebsocketService } from './core/services/websocket.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FloatingChatbotComponent } from './shared/components/floating-chatbot/floating-chatbot.component';
import { CommandPaletteComponent } from './shared/components/command-palette/command-palette.component';
import { ChatContextService } from './shared/services/chat-context.service';
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
    >
      <router-outlet></router-outlet>
    </main>
    @defer (on idle) {
      @if (!hideFloatingChat()) {
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
  `]
})
export class AppComponent implements OnInit {
  readonly chatContext = inject(ChatContextService);
  title = 'Travl Planr';

  private readonly document = inject(DOCUMENT);
  /** Pathname only — query/hash updates must not steal focus from inputs. */
  private lastFocusedPath = '';

  // The floating "Describe your trip" chat widget doesn't belong on the
  // Discover/Saved pages — they have their own focused UI.
  private static readonly HIDE_FLOATING_CHAT_ON = ['/community/discover', '/community/saved', '/community/events'];
  readonly hideFloatingChat = signal(false);

  constructor(private router: Router, private ws: WebsocketService) {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed()
    ).subscribe((event) => {
      const path = event.urlAfterRedirects.split('?')[0].split('#')[0];
      this.hideFloatingChat.set(AppComponent.HIDE_FLOATING_CHAT_ON.some((route) => path.startsWith(route)));
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
