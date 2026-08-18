import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TravelChatSessionService, TravelChatMessage } from '../../services/travel-chat-session.service';
import { ChatContextService } from '../../services/chat-context.service';
import { ChatAction, ChatIntent, intentLabel as intentLabelFor } from '../../utils/chat-intent.util';
import { formatChatHtml } from '../../utils/chat-markdown.util';
import { TripService } from '../../../trip/trip.service';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

type StarterPrompt = { key: string; params?: Record<string, unknown> };

// Base pool used as a fallback for all seasons.
const STARTER_PROMPT_POOL_BASE = [
  'SHARED.STARTER_BALI',
  'SHARED.STARTER_WEEKEND',
  'SHARED.STARTER_DUBAI',
  'SHARED.STARTER_BEACH',
  'SHARED.STARTER_HONEYMOON',
  'SHARED.STARTER_SOLO',
  'SHARED.STARTER_ADVENTURE',
  'SHARED.STARTER_BUDGET_EUROPE',
  'SHARED.STARTER_FOOD',
  'SHARED.STARTER_LONG_WEEKEND',
];

// Seasonal overrides — keys in these arrays are boosted to the front of the
// pool so they appear in the random 4-chip selection more often.  This is a
// simple month-bucket approach; no external data needed.
const SEASONAL_BOOSTS: Record<'winter' | 'spring' | 'summer' | 'fall', string[]> = {
  // Dec–Feb: ski resorts, warm-escape winter sun
  winter: ['SHARED.STARTER_LONG_WEEKEND', 'SHARED.STARTER_BEACH'],
  // Mar–May: Europe spring, blossom season
  spring: ['SHARED.STARTER_BUDGET_EUROPE', 'SHARED.STARTER_FOOD'],
  // Jun–Aug: beach, adventure, outdoor
  summer: ['SHARED.STARTER_BEACH', 'SHARED.STARTER_ADVENTURE', 'SHARED.STARTER_BALI'],
  // Sep–Nov: fall foliage travel, food & wine
  fall: ['SHARED.STARTER_FOOD', 'SHARED.STARTER_BUDGET_EUROPE', 'SHARED.STARTER_SOLO'],
};

function currentSeason(): 'winter' | 'spring' | 'summer' | 'fall' {
  const m = new Date().getMonth(); // 0-indexed
  if (m <= 1 || m === 11) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'fall';
}

/** Returns a deduplicated pool with season-relevant prompts prepended. */
function seasonalPool(): string[] {
  const boosts = SEASONAL_BOOSTS[currentSeason()];
  const rest = STARTER_PROMPT_POOL_BASE.filter((k) => !boosts.includes(k));
  return [...boosts, ...rest];
}

// Keep the original export name used by the rest of the file.
const STARTER_PROMPT_POOL = seasonalPool();

function pickRandom<T>(pool: T[], count: number): T[] {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

const THINKING_PHRASES = [
  'SHARED.THINKING_1',
  'SHARED.THINKING_2',
  'SHARED.THINKING_3',
  'SHARED.THINKING_4',
];

@Component({
    selector: 'app-travel-chat-messages',
    imports: [TranslatePipe, ImgFallbackDirective],
    host: {
        '[class.hero-messages-host]': 'variant() === "hero"',
    },
    template: `
    <div
      class="chat-messages"
      [class.chat-messages-hero]="variant() === 'hero'"
      [class.chat-messages-panel]="variant() === 'panel'"
      #messagesContainer
    >
      @for (msg of chat.messages(); track $index) {
        <div class="chat-bubble-row" [class.user-row]="msg.role === 'user'">
          @if (msg.role === 'assistant') {
            <div class="chat-avatar" [class.chat-avatar-sm]="variant() === 'panel'">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 2.5c-4.97 0-9 3.13-9 7 0 2.01.94 3.83 2.5 5.15L4.5 19.5l4.35-1.15a9.2 9.2 0 0 0 3.15.55c4.97 0 9-3.13 9-7s-4.03-7-9-7Z"
                  fill="currentColor" fill-opacity="0.3"
                  stroke="currentColor" stroke-width="1.5"
                />
                <path d="M8.25 10.5h7.5M8.25 13.25h4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </div>
          }
          <div
            class="chat-bubble"
            [class.user-bubble]="msg.role === 'user'"
            [class.assistant-bubble]="msg.role === 'assistant'"
          >
            @if (msg.role === 'assistant') {
              @if (intentLabel(msg.intent); as badge) {
                <div class="chat-intent-badge">{{ badge }}</div>
              }
              <div class="chat-md" [innerHTML]="renderMarkdown(msg.text)"></div>
            } @else {
              {{ msg.text }}
            }
            @if (msg.role === 'user' && $index === lastUserIndex() && !chat.sending()) {
              <div class="chat-action-chips">
                <button type="button" class="chat-action-chip" (click)="onEditMessage($index)">
                  ✎ {{ 'SHARED.EDIT' | translate }}
                </button>
              </div>
            }
            @if (msg.images?.length) {
              <div class="chat-images">
                @for (img of msg.images; track img.url) {
                  <img [src]="img.url" [alt]="img.alt" appImgFallback class="chat-inline-image" loading="lazy" />
                }
              </div>
            }
            @if (msg.audio_url) {
              <audio [src]="msg.audio_url" controls class="chat-audio"></audio>
            }
            @if (msg.weather; as weather) {
              <div class="weather-card">
                <div class="weather-current">
                  <span class="weather-icon">{{ weatherEmoji(weather.currentCode) }}</span>
                  <span class="weather-temp">{{ round(weather.currentTempC) }}°C</span>
                  @if (weather.destination) {
                    <span class="weather-dest">{{ weather.destination }}</span>
                  }
                </div>
                @if (weather.forecast?.length) {
                  <div class="weather-forecast">
                    @for (day of (weather.forecast ?? []).slice(0, 5); track day.day) {
                      <div class="weather-day">
                        <span>{{ weatherEmoji(day.weatherCode) }}</span>
                        <span class="weather-day-temps">{{ round(day.tempMinC) }}°–{{ round(day.tempMaxC) }}°</span>
                      </div>
                    }
                  </div>
                }
              </div>
            }
            @if (msg.suggestedActions?.length && !msg.suggestedActionsConsumed) {
              <div class="chat-action-chips">
                @for (action of visibleActions(msg); track $index) {
                  <button
                    type="button"
                    class="chat-action-chip"
                    [class.chip-primary]="$index === 0"
                    [disabled]="chat.sending()"
                    [attr.title]="chat.actionLabel(action)"
                    (click)="onAction(action, msg)"
                  >
                    {{ shortActionLabel(action) }}
                  </button>
                }
                @if (hiddenActionCount(msg) > 0 && !actionsExpanded()) {
                  <button
                    type="button"
                    class="chat-action-chip chip-more"
                    (click)="actionsExpanded.set(true)"
                  >
                    {{ 'SHARED.SHOW_MORE_ACTIONS' | translate:{ n: hiddenActionCount(msg) } }}
                  </button>
                }
              </div>
            }
            @if (msg.retryText) {
              <div class="chat-action-chips">
                <button
                  type="button"
                  class="chat-action-chip chip-primary"
                  [disabled]="chat.sending()"
                  (click)="onRetry(msg)"
                >
                  ↻ {{ (msg.stopped ? 'SHARED.CONTINUE' : 'SHARED.TRY_AGAIN') | translate }}
                </button>
              </div>
            }
            @if ($last && msg.role === 'assistant' && !msg.isGreeting && !msg.retryText && !msg.suggestedActions?.length && !msg.suggestedActionsConsumed && chat.hasConversation() && !chat.sending()) {
              <div class="chat-action-chips">
                @for (followUp of visibleFollowUpsLimited(msg); track followUp.key; let i = $index) {
                  <button
                    type="button"
                    class="chat-action-chip"
                    [class.chip-primary]="i === 0"
                    (click)="onStarter(followUp)"
                  >
                    {{ followUp.key | translate }}
                  </button>
                }
                @if (hiddenFollowUpCount(msg) > 0 && !followUpsExpanded()) {
                  <button
                    type="button"
                    class="chat-action-chip chip-more"
                    (click)="followUpsExpanded.set(true)"
                  >
                    {{ 'SHARED.SHOW_MORE_ACTIONS' | translate:{ n: hiddenFollowUpCount(msg) } }}
                  </button>
                }
              </div>
            }
            @if (msg.role === 'assistant' && msg.text && !msg.isGreeting && !chat.sending()) {
              <div class="msg-utility-row">
                @if ($last && !msg.retryText && chat.hasConversation()) {
                  <button
                    type="button"
                    class="utility-btn"
                    (click)="onRegenerate($index)"
                    [attr.aria-label]="'SHARED.REGENERATE' | translate"
                    [attr.title]="'SHARED.REGENERATE' | translate"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 12a8 8 0 0 1 13.66-5.66M20 4v5h-5" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M20 12a8 8 0 0 1-13.66 5.66M4 20v-5h5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                }
                <button
                  type="button"
                  class="utility-btn"
                  [class.active]="msg.feedback === 'up'"
                  (click)="onFeedback(msg, 'up')"
                  [attr.aria-label]="'SHARED.FEEDBACK_UP' | translate"
                  [attr.title]="'SHARED.FEEDBACK_UP' | translate"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm0 0 4.5-8a2 2 0 0 1 3.6 1.5L14 9h5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H10a3 3 0 0 1-3-3v-6Z" stroke-linejoin="round"/>
                  </svg>
                </button>
                <button
                  type="button"
                  class="utility-btn"
                  [class.active]="msg.feedback === 'down'"
                  (click)="onFeedback(msg, 'down')"
                  [attr.aria-label]="'SHARED.FEEDBACK_DOWN' | translate"
                  [attr.title]="'SHARED.FEEDBACK_DOWN' | translate"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3Zm0 0-4.5 8a2 2 0 0 1-3.6-1.5L10 15H5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.2 4H14a3 3 0 0 1 3 3v6Z" stroke-linejoin="round"/>
                  </svg>
                </button>
                <button
                  type="button"
                  class="utility-btn"
                  (click)="onCopy(msg.text, $index)"
                  [attr.aria-label]="'SHARED.COPY' | translate"
                  [attr.title]="'SHARED.COPY' | translate"
                >
                  @if (isCopied($index)) {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 12.5 9.5 18 20 6" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  } @else {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="8" y="8" width="12" height="12" rx="2"/>
                      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke-linecap="round"/>
                    </svg>
                  }
                </button>
              </div>
            }
          </div>
        </div>
      }
      @if (!chat.hasConversation() && !chat.sending()) {
        <div class="chat-action-chips starter-chips">
          @for (starter of visibleStarters(); track starter.key; let i = $index) {
            <button
              type="button"
              class="chat-action-chip"
              [class.chip-primary]="i === 0"
              (click)="onStarter(starter)"
            >
              {{ starter.key | translate: starter.params }}
            </button>
          }
        </div>
      }
      @if (chat.sending()) {
        <div class="chat-bubble-row">
          <div class="chat-avatar" [class.chat-avatar-sm]="variant() === 'panel'">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 2.5c-4.97 0-9 3.13-9 7 0 2.01.94 3.83 2.5 5.15L4.5 19.5l4.35-1.15a9.2 9.2 0 0 0 3.15.55c4.97 0 9-3.13 9-7s-4.03-7-9-7Z"
                fill="currentColor" fill-opacity="0.3"
                stroke="currentColor" stroke-width="1.5"
              />
            </svg>
          </div>
          <div class="chat-bubble assistant-bubble typing-indicator">
            <p class="thinking-text">{{ thinkingPhrase() | translate }}</p>
            <div class="typing-dots" aria-hidden="true">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
          </div>
        </div>
      }
      <div #bottomAnchor class="chat-scroll-anchor" aria-hidden="true"></div>
    </div>
    <!-- Screen-reader live region: announces streamed tokens and thinking phrases.
         Visually hidden; SR reads each update without interrupting page focus. -->
    <div class="sr-only" aria-live="polite" aria-atomic="false">
      @if (chat.sending()) {
        {{ thinkingPhrase() | translate }}
      } @else {
        {{ liveAnnouncement() }}
      }
    </div>
  `,
    styles: [
        `
      :host.hero-messages-host {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        width: 100%;
        height: auto;
        min-height: 0;
        max-height: var(--hero-chat-max, 100%);
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.28) transparent;
        overflow-anchor: none;
      }
      :host.hero-messages-host::-webkit-scrollbar {
        width: 5px;
      }
      :host.hero-messages-host::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.28);
        border-radius: 999px;
      }
      :host.hero-messages-host::-webkit-scrollbar-track {
        background: transparent;
      }

      .chat-scroll-anchor {
        width: 100%;
        height: 1px;
        flex-shrink: 0;
        pointer-events: none;
      }

      .chat-messages {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
        overflow-y: auto;
        scrollbar-width: thin;
      }

      .chat-messages-panel {
        flex: 1;
        padding: 16px;
        min-height: 200px;
        max-height: 380px;
      }

      .chat-messages-hero {
        flex: 0 0 auto;
        width: 100%;
        height: auto;
        max-height: none;
        margin-top: auto;
        padding: 4px 2px 10px;
        text-align: left;
        overflow: visible;
        overflow-y: visible;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .chat-messages-hero .chat-bubble {
        max-width: min(74%, calc(var(--hero-dock-chat-width, 75vw) * 0.74));
      }
      .chat-messages-hero .user-bubble {
        max-width: min(58%, calc(var(--hero-dock-chat-width, 75vw) * 0.58));
      }

      .chat-bubble-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
      }
      .user-row { flex-direction: row-reverse; }

      .chat-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .chat-avatar svg { width: 16px; height: 16px; color: #fff; }
      .chat-avatar-sm { width: 28px; height: 28px; }
      .chat-avatar-sm svg { width: 14px; height: 14px; }

      .chat-messages-panel .chat-avatar {
        background: rgba(0, 96, 234, 0.15);
        color: #0060ea;
      }
      .chat-messages-panel .chat-avatar svg { color: #0060ea; }

      .chat-messages-hero .chat-avatar {
        background: rgba(0, 96, 234, 0.9);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.32);
      }

      .chat-bubble {
        max-width: min(78%, 520px);
        padding: 10px 14px;
        border-radius: 14px;
        font-size: 14px;
        line-height: 1.5;
        word-break: break-word;
      }

      .chat-intent-badge {
        display: inline-block;
        margin-bottom: 6px;
        padding: 2px 9px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.01em;
        background: rgba(127, 127, 127, 0.16);
        color: inherit;
        opacity: 0.75;
      }

      .chat-md p { margin: 0 0 6px; }
      .chat-md p:last-child { margin-bottom: 0; }
      .chat-md ul, .chat-md ol { margin: 4px 0 8px; padding-left: 20px; }
      .chat-md li { margin: 2px 0; }
      .chat-md code {
        font-size: 12.5px;
        padding: 1px 5px;
        border-radius: 5px;
        background: rgba(127, 127, 127, 0.18);
      }
      .chat-md a { text-decoration: underline; color: inherit; }

      .chat-messages-panel .user-bubble {
        background: #0060ea;
        color: white;
        border-bottom-right-radius: 4px;
      }
      .chat-messages-panel .assistant-bubble {
        background: #f1f5f9;
        color: #1e293b;
        border-bottom-left-radius: 4px;
      }

      .chat-messages-hero .user-bubble {
        background: linear-gradient(155deg, #0a7cff 0%, #0052c7 100%);
        color: #fff;
        border: 1px solid rgba(147, 197, 253, 0.38);
        border-bottom-right-radius: 5px;
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        box-shadow:
          0 6px 22px rgba(0, 82, 199, 0.38),
          0 2px 6px rgba(0, 0, 0, 0.2);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
      }
      .chat-messages-hero .assistant-bubble {
        background: linear-gradient(155deg, rgba(12, 48, 104, 0.94) 0%, rgba(8, 32, 72, 0.96) 100%);
        border: 1px solid rgba(96, 165, 250, 0.32);
        color: rgba(255, 255, 255, 0.97);
        border-bottom-left-radius: 5px;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        box-shadow:
          0 8px 24px rgba(8, 32, 72, 0.38),
          0 1px 0 rgba(147, 197, 253, 0.12);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.22);
      }
      .chat-messages-hero .assistant-bubble .chat-md code {
        background: rgba(147, 197, 253, 0.18);
        color: rgba(255, 255, 255, 0.95);
      }

      .msg-utility-row {
        display: flex;
        gap: 4px;
        margin-top: 8px;
        opacity: 0.72;
        transition: opacity 0.15s ease;
      }
      .chat-bubble:hover .msg-utility-row { opacity: 1; }
      .utility-btn {
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        cursor: pointer;
        background: transparent;
        border: none;
        padding: 0;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .utility-btn svg { width: 13px; height: 13px; }
      .chat-messages-panel .utility-btn { color: #64748b; }
      .chat-messages-panel .utility-btn:hover { background: rgba(100, 116, 139, 0.14); }
      .chat-messages-panel .utility-btn.active { color: #0060ea; }
      .chat-messages-hero .utility-btn { color: rgba(255, 255, 255, 0.78); }
      .chat-messages-hero .utility-btn:hover { background: rgba(255, 255, 255, 0.18); }
      .chat-messages-hero .utility-btn.active { color: #fff; }

      .weather-card {
        margin-top: 8px;
        padding: 8px 10px;
        border-radius: 10px;
      }
      .chat-messages-panel .weather-card { background: #eff6ff; border: 1px solid #bfdbfe; }
      .chat-messages-hero .weather-card {
        background: rgba(12, 48, 104, 0.72);
        border: 1px solid rgba(96, 165, 250, 0.28);
        color: rgba(255, 255, 255, 0.95);
      }
      .weather-current {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        font-size: 13px;
      }
      .weather-icon { font-size: 16px; }
      .weather-dest {
        font-weight: 500;
        font-size: 11.5px;
        opacity: 0.75;
      }
      .weather-forecast {
        display: flex;
        gap: 10px;
        margin-top: 6px;
        overflow-x: auto;
      }
      .weather-day {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        font-size: 11px;
        flex-shrink: 0;
      }
      .weather-day-temps { white-space: nowrap; opacity: 0.85; }

      .chat-messages-hero .typing-indicator {
        max-width: min(74%, calc(var(--hero-dock-chat-width, 75vw) * 0.74));
      }

      .typing-indicator {
        display: inline-flex;
        flex-direction: row;
        flex-wrap: nowrap;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        width: fit-content;
        max-width: min(78%, 520px);
        word-break: normal;
        overflow: visible;
      }
      .typing-indicator .thinking-text {
        display: inline-block;
        width: auto !important;
        height: auto !important;
        min-width: 0;
        max-width: none;
        margin: 0;
        padding: 0;
        font-size: 12px;
        font-weight: 500;
        line-height: 1.4;
        white-space: nowrap;
        flex: 0 0 auto;
        border-radius: 0 !important;
        animation: none !important;
        background: transparent !important;
      }
      .chat-messages-panel .thinking-text { color: #64748b; }
      .chat-messages-hero .thinking-text { color: rgba(255, 255, 255, 0.9); }
      .typing-dots {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        flex: 0 0 auto;
      }
      .typing-dots .typing-dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
        animation: pulse-dot 1.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
      }
      .chat-messages-panel .typing-dots .typing-dot { background: var(--text-muted, currentColor); }
      .chat-messages-hero .typing-dots .typing-dot { background: rgba(255, 255, 255, 0.78); }
      .typing-dots .typing-dot:nth-child(1) { animation-delay: 0s; }
      .typing-dots .typing-dot:nth-child(2) { animation-delay: 0.15s; }
      .typing-dots .typing-dot:nth-child(3) { animation-delay: 0.3s; }

      @keyframes pulse-dot {
        0%, 100% { transform: scale(0.85); opacity: 0.5; }
        50% { transform: scale(1.25); opacity: 1; }
      }

      .chat-images {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .chat-inline-image {
        width: 100%;
        max-width: 140px;
        border-radius: 8px;
        object-fit: cover;
        aspect-ratio: 4/3;
      }
      .chat-audio {
        margin-top: 8px;
        width: 100%;
        max-width: 200px;
        height: 32px;
      }

      .chat-action-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
      }
      .chat-action-chip {
        font-size: 12px;
        font-weight: 600;
        padding: 7px 12px;
        border-radius: 999px;
        cursor: pointer;
        text-align: left;
        line-height: 1.3;
        max-width: 100%;
        transition:
          background 0.15s ease,
          border-color 0.15s ease,
          color 0.15s ease,
          transform 0.12s ease;
      }
      .chat-action-chip:active:not(:disabled) {
        transform: scale(0.97);
      }
      .chat-messages-panel .chat-action-chip {
        border: 1.5px solid #cbd5e1;
        background: white;
        color: #334155;
      }
      .chat-messages-panel .chat-action-chip:hover:not(:disabled) {
        background: #f8fafc;
        border-color: #94a3b8;
      }
      .chat-messages-panel .chat-action-chip.chip-primary {
        background: #0060ea;
        border-color: #0060ea;
        color: #fff;
      }
      .chat-messages-panel .chat-action-chip.chip-primary:hover:not(:disabled) {
        background: #0a7cff;
        border-color: #0a7cff;
      }
      .chat-messages-panel .chat-action-chip.chip-more {
        border-style: dashed;
        color: #64748b;
        font-weight: 500;
      }
      .chat-messages-hero .chat-action-chip {
        border: 1.5px solid rgba(255, 255, 255, 0.28);
        background: rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.95);
        box-shadow: none;
        text-shadow: none;
      }
      .chat-messages-hero .chat-action-chip:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.4);
        color: #fff;
      }
      .chat-messages-hero .chat-action-chip.chip-primary {
        background: #0060ea;
        border-color: #0060ea;
        color: #fff;
        box-shadow: 0 4px 14px rgba(0, 96, 234, 0.35);
      }
      .chat-messages-hero .chat-action-chip.chip-primary:hover:not(:disabled) {
        background: #0a7cff;
        border-color: #0a7cff;
      }
      .chat-messages-hero .chat-action-chip.chip-more {
        border-style: dashed;
        background: transparent;
        font-weight: 500;
        opacity: 0.85;
      }
      .chat-action-chip:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* ---- Dark-mode overrides for chat-messages-panel.
         These pierce Angular's encapsulation so panels stay correct on light or dark pages. */
      :host ::ng-deep html.dark .chat-messages-panel {
        /* Assistant / bot bubble — swap #f1f5f9 slate-100 for dark surface */
        .assistant-bubble {
          background: #1e293b;
          color: #f8fafc !important;
        }

        /* Utility button icons — bright white on dark surface */
        .utility-btn {
          color: #e2e8f0 !important;
        }
        :host ::ng-deep html.dark .chat-messages-panel .utility-btn:hover,
        :host ::ng-deep html.dark .chat-messages-panel .utility-btn.active {
          background: rgba(148, 163, 184, 0.2) !important;
          color: #fff !important;
        }

        /* Weather card — darken light-blue surface to navy */
        .weather-card {
          background: #0f172a;
          border-color: rgba(96, 165, 250, 0.3);
          color: #f8fafc !important;
        }

        /* Thinking / status text — lighter gray */
        .thinking-text {
          color: #94a3b8 !important;
        }
      }

      .starter-chips {
        margin-top: 2px;
        padding-left: 40px;
      }
    `,
    ]
})
export class TravelChatMessagesComponent implements OnDestroy {
  readonly variant = input<'hero' | 'panel'>('panel');
  /** When the hero thread panel opens, parent toggles this so we re-anchor scroll. */
  readonly threadVisible = input(false);
  readonly chat = inject(TravelChatSessionService);
  readonly chatContext = inject(ChatContextService);
  private readonly translate = inject(TranslateService);
  private readonly tripService = inject(TripService);
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly messagesContainer = viewChild<ElementRef<HTMLDivElement>>('messagesContainer');
  private readonly bottomAnchor = viewChild<ElementRef<HTMLDivElement>>('bottomAnchor');

  private thinkingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly thinkingIndex = signal(0);
  readonly thinkingPhrase = () => THINKING_PHRASES[this.thinkingIndex()];

  /** Expand overflow action / follow-up chips past the default 3. */
  readonly actionsExpanded = signal(false);
  readonly followUpsExpanded = signal(false);
  private static readonly MAX_VISIBLE_CHIPS = 3;
  private static readonly ACTION_LABEL_MAX = 28;

  /** The most recent user-authored turn — only that one gets an "Edit"
   * affordance, since editing an older turn would need to explain that
   * everything after it gets dropped too. */
  readonly lastUserIndex = computed(() => {
    const list = this.chat.messages();
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].role === 'user') return i;
    }
    return -1;
  });

  /**
   * The plain text of the latest assistant message — fed into the aria-live
   * region so screen readers hear streamed content as it arrives.  Intentionally
   * strips markdown symbols so assistive technology doesn't read `**` aloud.
   */
  readonly liveAnnouncement = computed(() => {
    if (this.chat.sending()) return '';
    const msgs = this.chat.messages();
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') {
        return msgs[i].text.replace(/[*_`#>]/g, '').trim();
      }
    }
    return '';
  });

  private readonly copiedIndex = signal<number | null>(null);
  private resizeObserver: ResizeObserver | null = null;
  private scrollAfterTransitionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => this.bindScrollObserver());

    effect(() => {
      this.chat.messages().length;
      this.chat.sending();
      this.chat.scrollRequested();
      this.actionsExpanded.set(false);
      this.followUpsExpanded.set(false);
      this.scheduleScrollToBottom(true);
    }, { allowSignalWrites: true });

    effect(() => {
      if (this.variant() === 'hero' && this.threadVisible()) {
        this.scheduleScrollToBottom(true);
      }
    });

    // Cycle a short status line while a reply streams in, so a long wait
    // reads as an assistant working rather than a stalled request.
    effect(() => {
      if (this.chat.sending()) {
        this.thinkingIndex.set(0);
        this.thinkingTimer = setInterval(() => {
          this.thinkingIndex.update((i) => (i + 1) % THINKING_PHRASES.length);
        }, 1700);
      } else if (this.thinkingTimer) {
        clearInterval(this.thinkingTimer);
        this.thinkingTimer = null;
      }
    }, { allowSignalWrites: true });

    // Snapshot once at open time rather than a reactive computed() — trips()
    // can update in the background (e.g. another tab saves a trip) and we
    // don't want the cold-start chips reshuffling under the user.
    const trips = this.tripService.trips();
    // If a previous conversation captured trip slots (destination), prepend a
    // context-aware "continue your {destination} trip" chip so the session
    // feels continuous.  Otherwise fall back to the "returning user" chip when
    // trips exist, or pure seasonal starters when cold-starting.
    const slots = this.chat.tripSlots();
    const contextDest = slots?.destination || (trips.length ? trips[0].destination : null);
    const baseCount = contextDest ? 3 : trips.length ? 3 : 4;
    const pool = pickRandom(STARTER_PROMPT_POOL, baseCount).map((key) => ({ key }));
    if (contextDest) {
      this.starterPrompts = [
        { key: 'SHARED.STARTER_AGAIN', params: { destination: contextDest } },
        ...pool,
      ];
    } else if (trips.length) {
      this.starterPrompts = [
        { key: 'SHARED.STARTER_AGAIN', params: { destination: trips[0].destination } },
        ...pool,
      ];
    } else {
      this.starterPrompts = pool;
    }
  }

  ngOnDestroy(): void {
    if (this.thinkingTimer) clearInterval(this.thinkingTimer);
    this.resizeObserver?.disconnect();
    if (this.scrollAfterTransitionTimer) clearTimeout(this.scrollAfterTransitionTimer);
  }

  onAction(action: ChatAction, msg: TravelChatMessage): void {
    void this.chat.onSuggestedAction(action, msg);
  }

  onRetry(msg: TravelChatMessage): void {
    void this.chat.retry(msg);
  }

  /** Resends the user message that led to the assistant reply at `index`,
   * replacing that turn instead of appending a duplicate. */
  onRegenerate(index: number): void {
    void this.chat.regenerateAt(index);
  }

  /** Drops this message and anything after it, then hands the removed text
   * to the composer so the user can amend it before resending. */
  onEditMessage(index: number): void {
    const msg = this.chat.messages()[index];
    if (!msg || msg.role !== 'user') return;
    this.chat.truncateTo(index);
    this.chat.prefillComposer(msg.text);
  }

  onFeedback(msg: TravelChatMessage, feedback: 'up' | 'down'): void {
    this.chat.setFeedback(msg, feedback);
  }

  onCopy(text: string, index: number): void {
    navigator.clipboard?.writeText(text).then(() => {
      this.copiedIndex.set(index);
      setTimeout(() => {
        if (this.copiedIndex() === index) this.copiedIndex.set(null);
      }, 1500);
    }).catch(() => undefined);
  }

  isCopied(index: number): boolean {
    return this.copiedIndex() === index;
  }

  // Assigned once in the constructor from a point-in-time snapshot of
  // TripService — see the comment there.
  readonly starterPrompts: StarterPrompt[];

  readonly tripStarterPrompts: StarterPrompt[] = [
    { key: 'SHARED.TRIP_STARTER_ADD_ACTIVITIES' },
    { key: 'SHARED.TRIP_STARTER_FIX_FLIGHTS' },
    { key: 'SHARED.TRIP_STARTER_REGENERATE_DAY' },
    { key: 'SHARED.TRIP_STARTER_ADD_TRANSPORT' },
  ];

  readonly followUpPrompts: StarterPrompt[] = [
    { key: 'SHARED.FOLLOWUP_ITINERARY' },
    { key: 'SHARED.FOLLOWUP_BEST_TIME' },
    { key: 'SHARED.FOLLOWUP_BUDGET' },
  ];

  shortActionLabel(action: ChatAction): string {
    const full = this.chat.actionLabel(action);
    const max = TravelChatMessagesComponent.ACTION_LABEL_MAX;
    if (full.length <= max) return full;
    return `${full.slice(0, max - 1).trimEnd()}…`;
  }

  visibleActions(msg: TravelChatMessage): ChatAction[] {
    const all = msg.suggestedActions ?? [];
    if (this.actionsExpanded()) return all;
    return all.slice(0, TravelChatMessagesComponent.MAX_VISIBLE_CHIPS);
  }

  hiddenActionCount(msg: TravelChatMessage): number {
    const total = msg.suggestedActions?.length ?? 0;
    if (this.actionsExpanded() || total <= TravelChatMessagesComponent.MAX_VISIBLE_CHIPS) return 0;
    return total - TravelChatMessagesComponent.MAX_VISIBLE_CHIPS;
  }

  visibleFollowUpsLimited(msg: TravelChatMessage): StarterPrompt[] {
    const all = this.visibleFollowUps(msg);
    if (this.followUpsExpanded()) return all;
    return all.slice(0, TravelChatMessagesComponent.MAX_VISIBLE_CHIPS);
  }

  hiddenFollowUpCount(msg: TravelChatMessage): number {
    const total = this.visibleFollowUps(msg).length;
    if (this.followUpsExpanded() || total <= TravelChatMessagesComponent.MAX_VISIBLE_CHIPS) return 0;
    return total - TravelChatMessagesComponent.MAX_VISIBLE_CHIPS;
  }

  visibleStarters(): StarterPrompt[] {
    const all = this.chatContext.activeTripPage()
      ? this.tripStarterPrompts
      : this.starterPrompts;
    return all.slice(0, TravelChatMessagesComponent.MAX_VISIBLE_CHIPS);
  }

  /** Patterns that mean the user already asked what this chip would send. */
  private static readonly FOLLOWUP_ALREADY_ASKED: Record<string, RegExp> = {
    'SHARED.FOLLOWUP_BEST_TIME':
      /\b(best\s+time(?:\s+to\s+visit)?|when\s+to\s+visit|weather|climate|season)\b/i,
    'SHARED.FOLLOWUP_BUDGET':
      /\b(budget[- ]?friendly|cheap(?:er)?|affordable|budget\s+options?)\b/i,
    'SHARED.FOLLOWUP_ITINERARY':
      /\b(turn\s+this\s+into|full\s+itinerary|show\s+(?:me\s+)?(?:the\s+)?(?:full\s+)?itinerary)\b/i,
  };

  /** Drop chips that repeat a question the user already asked, that this
   * assistant turn already answered, or that don't fit current trip slots. */
  visibleFollowUps(msg: TravelChatMessage): StarterPrompt[] {
    const messages = this.chat.messages();
    const recentUserTexts = messages
      .filter((m) => m.role === 'user')
      .slice(-8)
      .map((m) => m.text);
    const recentAssistantTexts = messages
      .filter((m) => m.role === 'assistant')
      .slice(-4)
      .map((m) => m.text);
    const onTripPage = !!this.chatContext.activeTripPage();

    // On an open itinerary page, show trip-edit starters mid-conversation.
    if (onTripPage) {
      return this.tripStarterPrompts;
    }

    return this.followUpPrompts.filter((prompt) => {
      if (
        prompt.key === 'SHARED.FOLLOWUP_BEST_TIME' &&
        (msg.intent === 'weather_query' ||
          !!msg.weather ||
          recentAssistantTexts.some((t) =>
            /\b(best\s+time|october|november|december|january|february|march|monsoon|climate|season)\b/i.test(t),
          ))
      ) {
        return false;
      }
      if (
        prompt.key === 'SHARED.FOLLOWUP_BUDGET' &&
        (msg.intent === 'budget_filter' ||
          recentAssistantTexts.some((t) =>
            /\b(budget|affordable|cheap(?:er)?|under\s*₹|under\s*\$)\b/i.test(t),
          ))
      ) {
        return false;
      }
      if (
        prompt.key === 'SHARED.FOLLOWUP_ITINERARY' &&
        (msg.intent === 'show_itinerary' ||
          msg.intent === 'create_trip' ||
          msg.intent === 'multi_city_trip')
      ) {
        return false;
      }

      const alreadyAsked = TravelChatMessagesComponent.FOLLOWUP_ALREADY_ASKED[prompt.key];
      if (alreadyAsked && recentUserTexts.some((t) => alreadyAsked.test(t))) {
        return false;
      }

      const label = this.normalizePromptText(
        this.translate.instant(prompt.key, prompt.params),
      );
      if (!label) return true;
      return !recentUserTexts.some((t) => {
        const normalized = this.normalizePromptText(t);
        return normalized === label || normalized.includes(label) || label.includes(normalized);
      });
    });
  }

  private normalizePromptText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  onStarter(prompt: StarterPrompt): void {
    if (prompt.key === 'SHARED.FOLLOWUP_ITINERARY') {
      void this.chat.openItineraryFromConversation();
      return;
    }
    void this.chat.send(this.translate.instant(prompt.key, prompt.params));
  }

  intentLabel(intent: ChatIntent | undefined): string | null {
    return intentLabelFor(intent);
  }

  /** Open-Meteo WMO weather codes, collapsed to a small emoji set. */
  weatherEmoji(code?: number | null): string {
    if (code === null || code === undefined) return '🌡️';
    if (code === 0) return '☀️';
    if ([1, 2, 3].includes(code)) return '⛅';
    if ([45, 48].includes(code)) return '🌫️';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
    if ([95, 96, 99].includes(code)) return '⛈️';
    return '🌡️';
  }

  round(n?: number | null): string {
    return n === null || n === undefined ? '--' : Math.round(n).toString();
  }

  /** Cached because the template calls this on every change-detection pass
   * for every bubble, including each streaming token append. */
  private mdCache = new Map<string, string>();
  renderMarkdown(text: string): string {
    let html = this.mdCache.get(text);
    if (html === undefined) {
      html = formatChatHtml(text);
      if (this.mdCache.size > 200) this.mdCache.clear();
      this.mdCache.set(text, html);
    }
    return html;
  }

  private bindScrollObserver(): void {
    const scrollEl = this.getScrollElement();
    const contentEl = this.messagesContainer()?.nativeElement;
    if (!scrollEl || typeof ResizeObserver === 'undefined') return;

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      // Respect near-bottom check so upward scroll isn't yanked back down.
      if (this.variant() === 'hero') this.scheduleScrollToBottom(false);
    });
    this.resizeObserver.observe(scrollEl);
    if (contentEl && contentEl !== scrollEl) {
      this.resizeObserver.observe(contentEl);
    }
    this.scheduleScrollToBottom(true);
  }

  private getScrollElement(): HTMLElement | null {
    if (this.variant() === 'hero') {
      return this.hostRef.nativeElement;
    }
    return this.messagesContainer()?.nativeElement ?? null;
  }

  private shouldAutoScroll(): boolean {
    const el = this.getScrollElement();
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  }

  private scheduleScrollToBottom(force = false): void {
    if (this.variant() !== 'hero') {
      queueMicrotask(() => this.scrollToBottom(force));
      return;
    }

    queueMicrotask(() => this.scrollToBottom(force));
    requestAnimationFrame(() => {
      this.scrollToBottom(force);
      requestAnimationFrame(() => this.scrollToBottom(force));
    });

    if (force) {
      if (this.scrollAfterTransitionTimer) clearTimeout(this.scrollAfterTransitionTimer);
      this.scrollAfterTransitionTimer = setTimeout(() => {
        this.scrollToBottom(true);
        requestAnimationFrame(() => this.scrollToBottom(true));
      }, 580);
      setTimeout(() => this.scrollToBottom(true), 720);
    }
  }

  private scrollToBottom(force = false): void {
    try {
      const scrollEl = this.getScrollElement();
      if (!scrollEl) return;
      if (!force && !this.shouldAutoScroll()) return;
      const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
      scrollEl.scrollTop = maxScroll;
    } catch { /* noop */ }
  }
}
