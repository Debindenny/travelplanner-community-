import { Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TravelChatSessionService } from '../../services/travel-chat-session.service';
import { ChatTripSlots } from '../../utils/chat-intent.util';

type SlotKind = 'destination' | 'duration' | 'travelers' | 'budget' | 'interests';

const SLOT_EDIT_PROMPTS: Record<SlotKind, { filled: string; empty: string }> = {
  destination: { filled: 'SHARED.SLOT_PROMPT_DESTINATION_FILLED', empty: 'SHARED.SLOT_PROMPT_DESTINATION_EMPTY' },
  duration: { filled: 'SHARED.SLOT_PROMPT_DURATION_FILLED', empty: 'SHARED.SLOT_PROMPT_DURATION_EMPTY' },
  travelers: { filled: 'SHARED.SLOT_PROMPT_TRAVELERS_FILLED', empty: 'SHARED.SLOT_PROMPT_TRAVELERS_EMPTY' },
  budget: { filled: 'SHARED.SLOT_PROMPT_BUDGET_FILLED', empty: 'SHARED.SLOT_PROMPT_BUDGET_EMPTY' },
  interests: { filled: 'SHARED.SLOT_PROMPT_INTERESTS_FILLED', empty: 'SHARED.SLOT_PROMPT_INTERESTS_EMPTY' },
};

/**
 * Dock chrome row for confirmed trip slots. Lives between the message thread
 * and the search bar — not inside the scrolled message list — so it doesn't
 * float under bubbles. Hidden while duration chips are collecting days
 * (one planning strip at a time).
 */
@Component({
    selector: 'app-trip-slots-row',
    imports: [TranslatePipe],
    template: `
    @if (visible(); as slots) {
      <div
        class="trip-slots-row"
        [class.trip-slots-hero]="tone() === 'dark'"
        [class.trip-slots-panel]="tone() === 'light'"
        role="group"
        [attr.aria-label]="'SHARED.TRIP_SO_FAR' | translate"
      >
        <span class="trip-slots-label">{{ 'SHARED.TRIP_SO_FAR' | translate }}</span>
        <button type="button" class="trip-slot-chip" [class.slot-filled]="!!slots.destination" (click)="onEditSlot('destination', slots)">
          📍 {{ slots.destination || ('SHARED.ADD_DESTINATION' | translate) }}
        </button>
        <button type="button" class="trip-slot-chip" [class.slot-filled]="!!slots.duration_days" (click)="onEditSlot('duration', slots)">
          🗓 {{ slots.duration_days ? ((slots.duration_days === 1 ? 'SHARED.DAY_COUNT' : 'SHARED.DAYS_COUNT') | translate:{ n: slots.duration_days }) : ('SHARED.ADD_DURATION' | translate) }}
        </button>
        <button type="button" class="trip-slot-chip" [class.slot-filled]="!!slots.travelers || !!slots.travel_style" (click)="onEditSlot('travelers', slots)">
          👥 {{ travelersLabel(slots) }}
        </button>
        <button type="button" class="trip-slot-chip" [class.slot-filled]="!!slots.budget" (click)="onEditSlot('budget', slots)">
          💰 {{ slots.budget ? budgetLabel(slots.budget) : ('SHARED.BUDGET_STANDARD_ASSUMED' | translate) }}
        </button>
        @if (slots.interests?.length) {
          @for (interest of slots.interests; track interest) {
            <span class="trip-slot-chip slot-filled slot-static">✓ {{ interest }}</span>
          }
        } @else {
          <button type="button" class="trip-slot-chip" (click)="onEditSlot('interests', slots)">
            ✨ {{ 'SHARED.ADD_FOCUS' | translate }}
          </button>
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
      .trip-slots-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        padding: 0.55rem 0.75rem;
        margin: 0 0 0.55rem;
        border-radius: 20px;
      }
      .trip-slots-label {
        font-size: 10.5px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-right: 2px;
      }
      .trip-slot-chip {
        font-size: 12px;
        font-weight: 500;
        padding: 5px 11px;
        border-radius: 999px;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
      }
      .trip-slot-chip.slot-static {
        cursor: default;
      }

      .trip-slots-panel {
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(15, 23, 42, 0.1);
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
      }
      .trip-slots-panel .trip-slots-label { color: #64748b; }
      .trip-slots-panel .trip-slot-chip {
        border: 1px solid #cbd5e1;
        background: white;
        color: #475569;
        opacity: 0.75;
      }
      .trip-slots-panel .trip-slot-chip.slot-filled {
        border-color: #93c5fd;
        background: #eff6ff;
        color: #0060ea;
        opacity: 1;
      }
      .trip-slots-panel .trip-slot-chip:hover:not(.slot-static) {
        border-color: #0060ea;
        opacity: 1;
      }

      .trip-slots-hero {
        background: rgba(13, 18, 30, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.28);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-radius: 20px;
      }
      .trip-slots-hero .trip-slots-label { color: rgba(191, 219, 254, 0.85); }
      .trip-slots-hero .trip-slot-chip {
        border: 1px solid rgba(96, 165, 250, 0.28);
        background: rgba(12, 48, 104, 0.72);
        color: rgba(255, 255, 255, 0.92);
        opacity: 0.95;
      }
      .trip-slots-hero .trip-slot-chip.slot-filled {
        border-color: rgba(147, 197, 253, 0.42);
        background: rgba(0, 96, 234, 0.62);
        color: #fff;
        opacity: 1;
      }
      .trip-slots-hero .trip-slot-chip:hover:not(.slot-static) {
        border-color: rgba(147, 197, 253, 0.55);
        background: rgba(0, 96, 234, 0.78);
        opacity: 1;
      }
    `,
    ]
})
export class TripSlotsRowComponent {
  readonly chat = inject(TravelChatSessionService);
  private readonly translate = inject(TranslateService);

  /** Visual tone for hero/dock (dark) vs full-page chat (light). */
  readonly tone = input<'dark' | 'light'>('dark');

  /** Hide while duration chips own the planning strip. */
  readonly visible = computed(() => {
    const slots = this.chat.tripSlots();
    if (!slots) return null;
    if (this.chat.needsDurationChips()) return null;
    return slots;
  });

  budgetLabel(budget: string): string {
    return budget.charAt(0).toUpperCase() + budget.slice(1);
  }

  travelersLabel(slots: ChatTripSlots): string {
    if (slots.travelers) {
      const key = slots.travelers === 1 ? 'SHARED.TRAVELER_COUNT' : 'SHARED.TRAVELERS_COUNT';
      return this.translate.instant(key, { n: slots.travelers });
    }
    if (slots.travel_style === 'couple') {
      return this.translate.instant('SHARED.TRAVELER_CHIP_COUPLE');
    }
    if (slots.travel_style === 'family') {
      return this.translate.instant('SHARED.TRAVELER_CHIP_FAMILY');
    }
    if (slots.travel_style === 'friends') {
      return this.translate.instant('SHARED.TRAVELER_CHIP_FRIENDS');
    }
    return this.translate.instant('SHARED.TRAVELERS_ASSUMED');
  }

  onEditSlot(kind: SlotKind, slots: ChatTripSlots): void {
    const isFilled = kind === 'destination'
      ? !!slots.destination
      : kind === 'duration'
        ? !!slots.duration_days
        : kind === 'travelers'
          ? !!slots.travelers || !!slots.travel_style
          : kind === 'budget'
            ? !!slots.budget
            : !!slots.interests?.length;
    const prompt = SLOT_EDIT_PROMPTS[kind];
    const key = isFilled ? prompt.filled : prompt.empty;
    this.chat.prefillComposer(key ? this.translate.instant(key) : '');
  }
}
