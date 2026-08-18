import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  OnDestroy
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DestinationTypeaheadComponent } from '../destination-typeahead/destination-typeahead.component';
import { SearchPlanAssistComponent } from '../search-plan-assist/search-plan-assist.component';
import { TripSlotsRowComponent } from '../trip-slots-row/trip-slots-row.component';
import { ChatContextService } from '../../services/chat-context.service';
import { DestinationSearchService } from '../../services/destination-search.service';
import { TravelChatSessionService } from '../../services/travel-chat-session.service';
import { TravelChatMessagesComponent } from '../travel-chat-messages/travel-chat-messages.component';
import { DestinationListItem } from '../../utils/destination.util';

/**
 * The same docked search/chat bar used on the landing hero, rendered
 * globally (see AppComponent) so it's available to assist on every page.
 * It stays hidden on the landing route while the hero's own copy is on
 * screen (see ChatContextService.showFloatingChatbot) to avoid duplicates.
 */
@Component({
    selector: 'app-floating-chatbot',
    imports: [
        TravelChatMessagesComponent,
        DestinationTypeaheadComponent,
        SearchPlanAssistComponent,
        TripSlotsRowComponent,
        TranslatePipe,
    ],
    template: `
    @if (chatContext.showFloatingChatbot()) {
      <div
        class="dock-scrim"
        [class.visible]="showChatThread()"
        aria-hidden="true"
        (click)="onScrimClick()"
      ></div>
      <div
        #dockEl
        class="global-dock-wrap"
        [class.chat-active]="showChatThread()"
        (mousedown)="$event.stopPropagation()"
      >
        <div class="chat-thread" [class.visible]="showChatThread()">
          <div class="chat-thread-inner">
            <app-travel-chat-messages variant="hero" [threadVisible]="showChatThread()" />
          </div>
        </div>

        <div class="dock-composer">
          @if (showChatThread()) {
            <app-trip-slots-row tone="dark" />
            <app-search-plan-assist tone="dark" />
          }

          <form
            class="dock-search flex w-full items-center gap-2 px-2 py-2 sm:px-3"
            (submit)="send($event)"
            role="search"
          >
          @if (chat.sending()) {
            <span class="ml-1 dock-spinner"></span>
          } @else {
            <button
              type="button"
              class="dock-tool-btn ml-1"
              [class.listening]="chat.listening()"
              (click)="chat.toggleVoice()"
              [disabled]="chat.sending() || !chat.voiceSupported()"
              [attr.aria-label]="(chat.listening() ? 'SHARED.STOP_VOICE_INPUT' : 'SHARED.VOICE_INPUT') | translate"
              [attr.title]="chat.voiceSupported() ? ((chat.listening() ? 'SHARED.STOP_RECORDING' : 'SHARED.TALK_TO_PLAN_TRIP') | translate) : (chat.voiceUnavailableReason() || ('SHARED.VOICE_NOT_SUPPORTED' | translate))"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"/>
                <path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke-linecap="round"/>
              </svg>
            </button>
          }

          @if (showChatThread() && chat.hasConversation() && !chat.listening()) {
            <button
              type="button"
              class="dock-tool-btn"
              (click)="onNewChat()"
              [attr.aria-label]="'SHARED.NEW_CHAT' | translate"
              [attr.title]="'SHARED.NEW_CHAT' | translate"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
              </svg>
            </button>
          }

          @if (showChatThread() && chat.ttsSupported && !chat.listening()) {
            <button
              type="button"
              class="dock-tool-btn"
              [class.active-toggle]="chat.voiceRepliesEnabled()"
              (click)="chat.toggleVoiceReplies()"
              [attr.aria-label]="(chat.voiceRepliesEnabled() ? 'SHARED.VOICE_REPLIES_ON' : 'SHARED.VOICE_REPLIES_OFF') | translate"
              [attr.title]="(chat.voiceRepliesEnabled() ? 'SHARED.VOICE_REPLIES_ON' : 'SHARED.VOICE_REPLIES_OFF') | translate"
            >
              @if (chat.voiceRepliesEnabled()) {
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M4 9v6h3.5l4.5 4V5l-4.5 4H4Z" stroke-linejoin="round"/>
                  <path d="M16 9.5c1 1 1 4 0 5M18.5 7.5c2 2 2 7 0 9" stroke-linecap="round"/>
                </svg>
              } @else {
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M4 9v6h3.5l4.5 4V5l-4.5 4H4Z" stroke-linejoin="round"/>
                  <path d="M16.5 9.5l4 4M20.5 9.5l-4 4" stroke-linecap="round"/>
                </svg>
              }
            </button>
          }

          <input
            #dockInput
            type="text"
            [placeholder]="chatInputPlaceholder() | translate"
            class="min-w-0 flex-1 py-1 text-sm-plus font-medium"
            [class.italic]="chat.listening()"
            [attr.aria-label]="'SHARED.DESCRIBE_YOUR_TRIP' | translate"
            role="combobox"
            aria-autocomplete="list"
            [attr.aria-expanded]="typeaheadExpanded()"
            aria-controls="dock-dest-listbox"
            [attr.aria-activedescendant]="dockTypeahead()?.activeOptionId() ?? null"
            [disabled]="chat.sending()"
            [readonly]="chat.listening()"
            (input)="onInputChange()"
            (focus)="onInputFocus()"
            (keydown)="onSearchKeydown($event)"
          />

          @if (inputValue().trim() && !chat.sending() && !chat.listening()) {
            <button
              type="button"
              class="dock-tool-btn"
              (mousedown)="$event.preventDefault()"
              (click)="clearInput()"
              [attr.aria-label]="'HERO.CLEAR_SEARCH' | translate"
              [attr.title]="'HERO.CLEAR_SEARCH' | translate"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/>
              </svg>
            </button>
          }

          <button
            type="submit"
            class="dock-send-btn"
            [disabled]="!chat.sending() && !inputValue().trim()"
            (click)="chat.sending() ? onStopGenerating($event) : null"
            [attr.aria-label]="(chat.sending() ? 'SHARED.STOP_GENERATING' : 'SHARED.SEND_MESSAGE') | translate"
          >
            @if (chat.sending()) {
              ◼ {{ 'SHARED.STOP' | translate }}
            } @else {
              {{ (showChatThread() ? 'SHARED.SEND' : 'SHARED.PLAN_TRIP') | translate }}
              <svg class="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                @if (showChatThread()) {
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                } @else {
                  <path d="M3 11L11 3M11 3H5.5M11 3V8.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                }
              </svg>
            }
          </button>
          </form>

          <app-destination-typeahead
            listboxId="dock-dest-listbox"
            [query]="inputValue()"
            [enabled]="typeaheadEnabled()"
            presentation="chips"
            variant="dark"
            (picked)="onTypeaheadPicked($event)"
          />
        </div>

        <p class="dock-footer-note" [class.visible]="showChatThread()">
          {{ 'SHARED.CHAT_FOOTER_NOTE' | translate }}
        </p>
      </div>
    }
  `,
    styles: [
        `
      :host {
        display: contents;
      }

      .dock-scrim {
        /* Only cover the lower band — a full-viewport hit target (even with a
           transparent top) was swallowing itinerary/navbar button clicks. */
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        height: min(42vh, 420px);
        z-index: 10040;
        background: linear-gradient(
          180deg,
          rgba(15, 23, 42, 0) 0%,
          rgba(15, 23, 42, 0.06) 35%,
          rgba(15, 23, 42, 0.14) 70%,
          rgba(15, 23, 42, 0.22) 100%
        );
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .dock-scrim.visible {
        opacity: 1;
        pointer-events: auto;
      }

      .global-dock-wrap {
        position: fixed;
        left: 50%;
        bottom: max(1.25rem, env(safe-area-inset-bottom, 0px) + 0.75rem);
        transform: translateX(-50%);
        width: min(640px, calc(100vw - 2rem));
        max-width: min(640px, calc(100vw - 2rem));
        z-index: 10050;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        --hero-chat-max: min(58dvh, calc(100dvh - 8rem));
        will-change: transform, opacity;
        transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .global-dock-wrap.chat-active {
        width: min(800px, calc(100vw - 2rem));
        max-width: min(800px, calc(100vw - 2rem));
      }

      .chat-thread {
        width: 100%;
        opacity: 0;
        pointer-events: none;
        margin-bottom: 0;
        max-height: 0;
        overflow: hidden;
        flex: 0 0 auto;
        transition:
          max-height 0.55s cubic-bezier(0.4, 0, 0.2, 1),
          opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1),
          margin-bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .chat-thread.visible {
        opacity: 1;
        margin-bottom: 0.45rem;
        pointer-events: auto;
        /* Content-sized: don't reserve full 58dvh for one bubble. */
        height: auto;
        max-height: var(--hero-chat-max);
        overflow: hidden;
      }
      .chat-thread-inner {
        height: auto;
        min-height: 0;
        max-height: var(--hero-chat-max);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        overscroll-behavior: contain;
      }
      /* Soft top edge only — never fully transparent, or scrolled messages vanish. */
      .chat-thread.visible .chat-thread-inner {
        -webkit-mask-image: linear-gradient(
          180deg,
          rgba(0, 0, 0, 0.55) 0%,
          #000 12px,
          #000 100%
        );
        mask-image: linear-gradient(
          180deg,
          rgba(0, 0, 0, 0.55) 0%,
          #000 12px,
          #000 100%
        );
      }

      .dock-composer {
        position: relative;
        width: 100%;
      }

      .dock-search {
        background: rgba(13, 18, 30, 0.92);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 999px;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.28);
        transition: background 0.2s ease, border-color 0.2s ease;
      }
      .dock-search:focus-within {
        background: rgba(13, 18, 30, 0.96);
        border-color: rgba(255, 255, 255, 0.24);
      }
      .dock-search input {
        background: transparent;
        color: #fff;
        outline: none;
        width: 100%;
      }
      .dock-search input::placeholder {
        color: rgba(255, 255, 255, 0.5);
      }
      .dock-search input:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }

      .dock-tool-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.85);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
      }
      .dock-tool-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.3);
      }
      .dock-tool-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .dock-tool-btn.listening {
        background: rgba(239, 68, 68, 0.25);
        border-color: rgba(252, 165, 165, 0.6);
        color: #fecaca;
        animation: dockPulse 1.5s infinite;
      }
      .dock-tool-btn.active-toggle {
        background: rgba(0, 96, 234, 0.5);
        border-color: rgba(147, 197, 253, 0.6);
        color: #fff;
      }
      @keyframes dockPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }

      .dock-send-btn {
        background: #0060ea;
        color: #fff;
        border: none;
        border-radius: 999px;
        font-weight: 600;
        font-size: 14px;
        padding: 8px 20px;
        white-space: nowrap;
        cursor: pointer;
        transition: background 0.15s ease, transform 0.1s ease, opacity 0.15s ease;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .dock-send-btn:hover:not(:disabled) {
        background: #0052c9;
        transform: scale(1.02);
      }
      .dock-send-btn:active:not(:disabled) { transform: scale(0.98); }
      .dock-send-btn:disabled { opacity: 0.6; cursor: not-allowed; }

      @keyframes dockSpin { to { transform: rotate(360deg); } }
      .dock-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.25);
        border-top-color: #fff;
        border-radius: 50%;
        animation: dockSpin 0.7s linear infinite;
        flex-shrink: 0;
      }

      .dock-footer-note {
        margin-top: 0;
        max-height: 0;
        opacity: 0;
        overflow: hidden;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        text-align: center;
        transition:
          max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
          opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
          margin-top 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .dock-footer-note.visible {
        margin-top: 8px;
        max-height: 2.5rem;
        opacity: 1;
      }

      @media (max-width: 480px) {
        .global-dock-wrap,
        .global-dock-wrap.chat-active {
          width: calc(100vw - 1.5rem);
          max-width: calc(100vw - 1.5rem);
        }
      }
    `,
    ]
})
export class FloatingChatbotComponent implements OnDestroy {
  private readonly dockEl = viewChild<ElementRef<HTMLElement>>('dockEl');
  private readonly dockInput = viewChild<ElementRef<HTMLInputElement>>('dockInput');
  readonly dockTypeahead = viewChild(DestinationTypeaheadComponent);

  ngOnDestroy(): void {
    if (this.chat.listening()) {
      this.chat.toggleVoice();
    }
    if (this.chat.sending()) {
      this.chat.stopGenerating();
    }
  }

  readonly chatContext = inject(ChatContextService);
  readonly chat = inject(TravelChatSessionService);
  private readonly destinationSearch = inject(DestinationSearchService);

  readonly inputValue = signal('');
  private ignoreOutsideClickUntil = 0;

  readonly typeaheadEnabled = computed(
    () =>
      this.chatContext.showFloatingChatbot() &&
      !this.chat.sending() &&
      !this.chat.listening() &&
      // Allow destination picks mid-chat when the user is typing a place name.
      (!this.chat.hasConversation() || this.inputValue().trim().length >= 2),
  );

  readonly typeaheadExpanded = computed(
    () => this.typeaheadEnabled() && (this.dockTypeahead()?.isOpen() ?? false),
  );

  /** The dock expands when the user opened chat, or while a reply/voice turn
   * is in flight. Closing (scrim / outside click / Escape) always collapses
   * the thread — slot chips may still show under the bar without trapping it open. */
  readonly showChatThread = computed(
    () =>
      this.chatContext.chatOpen() ||
      this.chat.sending() ||
      this.chat.listening(),
  );

  readonly chatInputPlaceholder = computed(() => {
    // While dictating, the live transcript is mirrored into the input itself
    // (see the effect in the constructor), so the placeholder only covers the
    // moment before any words arrive. Returns a translation key; the template
    // pipes it through | translate.
    if (this.chat.listening()) {
      return 'SHARED.LISTENING';
    }
    return this.showChatThread() ? 'SHARED.CHAT_PLACEHOLDER_OPEN' : 'SHARED.CHAT_PLACEHOLDER';
  });

  constructor() {
    // TravelChatSessionService is a root singleton, so composerPrefillVersion
    // outlives this component — baseline against whatever value already
    // existed at construction time (see the matching comment in
    // HeroSectionComponent) rather than the literal 0.
    const initialPrefillVersion = this.chat.composerPrefillVersion();

    // Mirror the live transcript into the input while dictating.
    let wasListening = false;
    effect(() => {
      const listening = this.chat.listening();
      const live = this.chat.interimTranscript();
      const input = this.dockInput()?.nativeElement;
      if (listening) {
        wasListening = true;
        if (input && live) {
          input.value = live;
          this.inputValue.set(live);
        }
      } else if (wasListening) {
        wasListening = false;
        if (input) input.value = '';
        this.inputValue.set('');
      }
    });

    effect(() => {
      const version = this.chat.composerPrefillVersion();
      if (version <= initialPrefillVersion) return;
      const text = this.chat.composerPrefillText();
      this.openChat();
      const input = this.dockInput()?.nativeElement;
      if (input) {
        input.value = text;
        input.focus();
        input.setSelectionRange(text.length, text.length);
      }
      this.inputValue.set(text);
    }, { allowSignalWrites: true });
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.chatContext.showFloatingChatbot()) return;
    if (event.key === 'Escape' && this.showChatThread()) {
      event.preventDefault();
      this.closeChat();
      return;
    }
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
    event.preventDefault();
    this.dockInput()?.nativeElement.focus();
  }

  onSearchKeydown(event: KeyboardEvent): void {
    this.dockTypeahead()?.handleKeydown(event);
  }

  onTypeaheadPicked(item: DestinationListItem): void {
    const input = this.dockInput()?.nativeElement;
    if (input) input.value = '';
    this.inputValue.set('');
    this.openChat();
    void this.chat.planDestination(item.name);
  }

  clearInput(): void {
    const input = this.dockInput()?.nativeElement;
    if (input) {
      input.value = '';
      input.focus();
    }
    this.inputValue.set('');
    this.dockTypeahead()?.resetActiveIndex();
    if (!this.chat.hasConversation() && !this.chat.sending() && !this.chat.listening()) {
      this.chatContext.setChatOpen(false);
    }
  }

  onScrimClick(): void {
    // Never trap the page: stop in-flight work, then dismiss the dock.
    if (this.chat.listening()) {
      void this.chat.toggleVoice();
    }
    if (this.chat.sending()) {
      this.chat.stopGenerating();
    }
    this.ignoreOutsideClickUntil = Date.now() + 300;
    this.chatContext.setChatOpen(false);
    this.chatContext.setCompactSlotCollection(false);
    this.dockInput()?.nativeElement?.blur();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (Date.now() < this.ignoreOutsideClickUntil) return;
    if (!this.showChatThread() || this.chat.sending() || this.chat.listening()) return;

    const dock = this.dockEl()?.nativeElement;
    const target = event.target as Node | null;
    if (dock && target && !dock.contains(target)) {
      this.closeChat();
    }
  }

  onInputFocus(): void {
    this.destinationSearch.load();
    if (
      this.chat.hasConversation() ||
      this.inputValue().trim().length > 0 ||
      this.chat.needsDurationChips() ||
      this.chat.needsTravelerFocusChips()
    ) {
      this.openChat();
    }
  }

  onInputChange(): void {
    const query = this.dockInput()?.nativeElement.value ?? '';
    this.inputValue.set(query);
    this.dockTypeahead()?.resetActiveIndex();
    if (query.trim().length > 0) {
      this.openChat();
    }
  }

  onStopGenerating(event: Event): void {
    event.preventDefault();
    this.chat.stopGenerating();
  }

  onNewChat(): void {
    this.chat.clearHistory();
    const input = this.dockInput()?.nativeElement;
    if (input) {
      input.value = '';
      input.focus();
    }
    this.inputValue.set('');
  }

  async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.chat.listening()) {
      // Submitting mid-dictation stops the recognizer; its onend handler
      // sends the full transcript, so sending here too would double-submit.
      await this.chat.toggleVoice();
      return;
    }
    const query = this.dockInput()?.nativeElement.value.trim();
    if (!query || this.chat.sending()) return;

    this.openChat();
    const input = this.dockInput()?.nativeElement;
    if (input) input.value = '';
    this.inputValue.set('');

    await this.chat.planFromSearchQuery(query);
    queueMicrotask(() => this.dockInput()?.nativeElement?.focus());
  }

  private openChat(): void {
    this.ignoreOutsideClickUntil = Date.now() + 300;
    this.chatContext.setChatOpen(true);
    this.chat.requestScroll();
  }

  private closeChat(): void {
    if (this.chat.sending() || this.chat.listening()) return;
    this.ignoreOutsideClickUntil = Date.now() + 300;
    this.chatContext.setChatOpen(false);
    this.chatContext.setCompactSlotCollection(false);
    // Keep in-progress drafts (including slot-chip prefills) so closing the
    // thread doesn't wipe what the user was about to send.
    const input = this.dockInput()?.nativeElement;
    input?.blur();
  }
}
