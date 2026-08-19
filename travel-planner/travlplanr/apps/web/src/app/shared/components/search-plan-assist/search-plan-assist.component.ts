import { Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ChatContextService } from '../../services/chat-context.service';
import { TravelChatSessionService } from '../../services/travel-chat-session.service';

/**
 * Under-bar planning assist: duration chips when destination is known but
 * days are missing, traveler/focus chips next, plus compact status while
 * a trip is being created. Keeps the dock input clean — no full AI reply
 * dumped under the bar.
 */
@Component({
    selector: 'app-search-plan-assist',
    imports: [TranslatePipe],
    template: `
    @if (visible()) {
      <div
        class="search-plan-assist"
        [class.assist-dark]="tone() === 'dark'"
        [class.assist-light]="tone() === 'light'"
        role="group"
        [attr.aria-label]="'SHARED.PLAN_ASSIST_ARIA' | translate"
      >
        @if (statusText(); as status) {
          <p class="plan-status" aria-live="polite">{{ status }}</p>
        }
        @if (chat.needsDurationChips()) {
          <div class="duration-row">
            <span class="duration-label">
              {{ 'SHARED.HOW_MANY_DAYS' | translate }}
              @if (destinationLabel(); as dest) {
                <span class="duration-dest">{{ dest }}</span>
              }
            </span>
            <div class="duration-chips">
              @for (opt of chat.durationChipOptions; track opt.labelKey; let i = $index) {
                <button
                  type="button"
                  class="duration-chip"
                  [class.chip-primary]="opt.primary"
                  [style.animation-delay.ms]="i * 40"
                  [disabled]="chat.sending() || chatContext.isCreatingTrip()"
                  (click)="onSelectDays(opt.days)"
                >
                  {{ opt.labelKey | translate }}
                </button>
              }
            </div>
          </div>
        }
        @if (chat.needsTravelerFocusChips()) {
          <div class="duration-row">
            <span class="duration-label">{{ 'SHARED.WHO_IS_TRAVELING' | translate }}</span>
            <div class="duration-chips">
              @for (opt of travelerFocusOptions; track opt.text; let i = $index) {
                <button
                  type="button"
                  class="duration-chip"
                  [class.chip-primary]="i === 0"
                  [style.animation-delay.ms]="i * 40"
                  [disabled]="chat.sending() || chatContext.isCreatingTrip()"
                  (click)="onTravelerFocus(opt.text)"
                >
                  {{ opt.labelKey | translate }}
                </button>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
    styles: [
        `
      :host {
        display: block;
        width: 100%;
      }
      .search-plan-assist {
        margin: 0 0 0.55rem;
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        padding: 0.7rem 0.85rem;
        border-radius: 20px;
        animation: assistIn 0.32s cubic-bezier(0.4, 0, 0.2, 1);
      }
      @keyframes assistIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes chipIn {
        from { opacity: 0; transform: translateY(4px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .plan-status {
        margin: 0;
        font-size: 0.8125rem;
        font-weight: 600;
        letter-spacing: 0.01em;
      }
      .duration-row {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .duration-label {
        font-size: 0.75rem;
        font-weight: 600;
        opacity: 0.9;
      }
      .duration-dest {
        font-weight: 700;
        margin-left: 0.25rem;
      }
      .duration-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }
      .duration-chip {
        border-radius: 999px;
        border: 1.5px solid transparent;
        color: inherit;
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 0.5rem 1rem;
        min-height: 2.25rem;
        cursor: pointer;
        animation: chipIn 0.28s ease-out both;
        transition:
          background 0.15s ease,
          border-color 0.15s ease,
          color 0.15s ease,
          transform 0.12s ease;
      }
      .duration-chip:active:not(:disabled) {
        transform: scale(0.97);
      }
      .duration-chip:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .assist-dark {
        color: rgba(255, 255, 255, 0.95);
        background: rgba(13, 18, 30, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.28);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
      }
      .assist-dark .duration-chip {
        border-color: rgba(255, 255, 255, 0.28);
        background: rgba(255, 255, 255, 0.12);
        color: #fff;
      }
      .assist-dark .duration-chip:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.4);
      }
      .assist-dark .duration-chip.chip-primary {
        background: #0060ea;
        border-color: #0060ea;
        color: #fff;
        box-shadow: 0 4px 14px rgba(0, 96, 234, 0.4);
      }
      .assist-dark .duration-chip.chip-primary:hover:not(:disabled) {
        background: #0a7cff;
        border-color: #0a7cff;
      }
      .assist-light {
        color: rgba(15, 23, 42, 0.92);
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(15, 23, 42, 0.1);
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
      }
      .assist-light .duration-chip {
        border-color: rgba(15, 23, 42, 0.16);
        background: rgba(15, 23, 42, 0.04);
        color: rgba(15, 23, 42, 0.9);
      }
      .assist-light .duration-chip:hover:not(:disabled) {
        background: rgba(15, 23, 42, 0.08);
        border-color: rgba(15, 23, 42, 0.28);
      }
      .assist-light .duration-chip.chip-primary {
        background: #0060ea;
        border-color: #0060ea;
        color: #fff;
        box-shadow: 0 4px 14px rgba(0, 96, 234, 0.28);
      }
      .assist-light .duration-chip.chip-primary:hover:not(:disabled) {
        background: #0a7cff;
        border-color: #0a7cff;
      }
    `,
    ]
})
export class SearchPlanAssistComponent {
  readonly chat = inject(TravelChatSessionService);
  readonly chatContext = inject(ChatContextService);

  /** Visual tone for hero/dock (dark glass) vs Explore (light surface). */
  readonly tone = input<'dark' | 'light'>('dark');

  readonly travelerFocusOptions = [
    { labelKey: 'SHARED.TRAVELER_CHIP_SOLO', text: 'Just me, sightseeing is fine' },
    { labelKey: 'SHARED.TRAVELER_CHIP_COUPLE', text: '2 travelers, relaxed trip' },
    { labelKey: 'SHARED.TRAVELER_CHIP_FAMILY', text: 'Family trip with kids' },
    { labelKey: 'SHARED.TRAVELER_CHIP_FOOD', text: 'Focus on food and culture' },
  ];

  readonly destinationLabel = computed(
    () => this.chat.tripSlots()?.destination || this.chatContext.activeDestination(),
  );

  readonly statusText = computed(() => {
    if (this.chatContext.isCreatingTrip()) {
      return this.chatContext.backgroundHint() || 'Building your itinerary…';
    }
    return this.chatContext.backgroundHint();
  });

  readonly visible = computed(
    () =>
      this.chat.needsDurationChips() ||
      this.chat.needsTravelerFocusChips() ||
      this.chatContext.isCreatingTrip(),
  );

  onSelectDays(days: number): void {
    void this.chat.selectDurationDays(days);
  }

  onTravelerFocus(text: string): void {
    void this.chat.selectTravelersOrFocus(text);
  }
}
