import { Component, EventEmitter, Output, ViewChild, ElementRef, signal, inject, afterNextRender } from '@angular/core';

import { DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import {
  CrewMessage,
  PARIS_CREW_CHAT_MOCK,
} from './community-crew-chat.mock';
import { ToastService } from '../../shared/utils/toast.service';

/**
 * Crew group-chat preview. UI-only: every interaction below (poll votes, RSVPs,
 * settling an expense, adding a place, sending a message) mutates local
 * component state so the panel feels alive, but nothing is persisted or sent
 * anywhere. `PARIS_CREW_CHAT_MOCK` is the single source of its content —
 * swapping this component onto a real chat service means replacing that one
 * import and the `sendMessage`/quick-compose bodies; the template and layout
 * don't need to change.
 */
@Component({
  selector: 'app-community-crew-chat-modal',
  imports: [FormsModule, A11yModule],
  template: `
    <!-- Transparent click-catcher: closes the panel on an outside click without
         dimming the page behind it, since the panel docks beside the feed
         (not over it) rather than behaving like a centered dialog. -->
    <div
      class="font-manrope fixed inset-0 z-[89]"
      (click)="close.emit()"
      (window:keydown.escape)="close.emit()"
    >
      <!-- resize (native CSS resize:both, drag handle bottom-right of the box) grows
           the panel toward the bottom-left: since it's anchored by top+right (not
           left/bottom), the browser only ever changes width/height, so the top-right
           corner — the panel's actual on-screen position — never moves. -->
      <div
        class="resize fixed top-24 right-6 z-[90] w-[420px] min-w-[320px] max-w-[min(760px,calc(100vw-3rem))] h-[min(700px,calc(100vh-7rem))] min-h-[360px] max-h-[calc(100vh-7rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-in-up"
        cdkTrapFocus
        cdkTrapFocusAutoCapture
        (click)="$event.stopPropagation()"
      >
      <!-- Header -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <span class="relative w-9 h-9 rounded-full bg-primary-50 text-primary flex items-center justify-center shrink-0">
          <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 20l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
          <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"></span>
        </span>
        <div class="flex-1 min-w-0">
          <p class="text-[13.5px] font-bold text-text-primary truncate">{{ chat.groupName }} · {{ chat.dateRange }}</p>
          <p class="text-[11.5px] font-semibold text-emerald-600">{{ chat.onlineCount }} online now</p>
        </div>
        <button
          type="button"
          (click)="onExitGroup()"
          class="shrink-0 h-8 px-3 rounded-full border border-slate-200 text-[11.5px] font-bold text-text-secondary flex items-center gap-1.5 hover:border-slate-300 transition-colors focus:outline-none"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 5v1a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Exit group
        </button>
        <button
          type="button"
          (click)="close.emit()"
          class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-text-faint hover:text-text-primary hover:bg-slate-100 transition-colors focus:outline-none"
          aria-label="Close"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Member count / expiry -->
      <div class="flex items-center justify-between px-4 py-2 border-b border-slate-100">
        <p class="text-[11.5px] font-semibold text-text-faint">{{ chat.memberCount }} members · {{ chat.onlineCount }} online now</p>
        <span class="text-[10.5px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 whitespace-nowrap">
          Ends in {{ chat.endsInDays }}d
        </span>
      </div>

      <!-- Scrollable message feed -->
      <div class="flex-1 overflow-y-auto chat-scroll px-4 py-4 flex flex-col gap-4">
        @for (msg of messages(); track msg.id) {
          <div class="flex flex-col items-start gap-1.5">
            <p class="text-[11.5px] font-bold text-text-faint">{{ msg.author }}</p>

            @switch (msg.kind) {
              @case ('text') {
                <div class="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 max-w-[85%]">
                  <p class="text-[13px] text-text-primary leading-relaxed">{{ msg.text }}</p>
                </div>
              }
              @case ('poll') {
                <div class="bg-white border border-slate-200 rounded-2xl p-3.5 w-72 flex flex-col gap-2">
                  <p class="text-[13px] font-bold text-text-primary">{{ msg.question }}</p>
                  @for (opt of msg.options; track opt) {
                    <button
                      type="button"
                      (click)="votePoll(msg.id, opt)"
                      class="w-full text-left px-3.5 py-2.5 rounded-xl border text-[12.5px] font-semibold transition-colors focus:outline-none"
                      [class.border-primary]="pollVotes()[msg.id] === opt"
                      [class.bg-primary-50]="pollVotes()[msg.id] === opt"
                      [class.text-primary]="pollVotes()[msg.id] === opt"
                      [class.border-slate-200]="pollVotes()[msg.id] !== opt"
                      [class.text-text-secondary]="pollVotes()[msg.id] !== opt"
                    >
                      {{ opt }}
                    </button>
                  }
                </div>
              }
              @case ('meetup') {
                <div class="bg-white border border-slate-200 rounded-2xl p-3.5 w-72 flex flex-col gap-3">
                  <div class="flex items-center gap-2.5">
                    <span class="w-9 h-9 rounded-lg bg-primary-50 text-primary flex items-center justify-center shrink-0">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 2v4M16 2v4M3 10h18M21 14V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h7m4-2l2 2 4-4" />
                      </svg>
                    </span>
                    <div class="min-w-0">
                      <p class="text-[13px] font-bold text-text-primary truncate">{{ msg.title }}</p>
                      <p class="text-[11.5px] font-semibold text-text-faint truncate">{{ msg.meta }}</p>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      (click)="rsvpMeetup(msg.id, 'in')"
                      class="flex-1 h-9 rounded-lg text-[12px] font-semibold transition-colors focus:outline-none"
                      [class.bg-primary]="meetupRsvp()[msg.id] !== 'out'"
                      [class.text-white]="meetupRsvp()[msg.id] !== 'out'"
                      [class.bg-slate-100]="meetupRsvp()[msg.id] === 'out'"
                      [class.text-text-secondary]="meetupRsvp()[msg.id] === 'out'"
                    >
                      I'm in
                    </button>
                    <button
                      type="button"
                      (click)="rsvpMeetup(msg.id, 'out')"
                      class="flex-1 h-9 rounded-lg border text-[12px] font-semibold transition-colors focus:outline-none"
                      [class.border-primary]="meetupRsvp()[msg.id] === 'out'"
                      [class.text-primary]="meetupRsvp()[msg.id] === 'out'"
                      [class.border-slate-200]="meetupRsvp()[msg.id] !== 'out'"
                      [class.text-text-secondary]="meetupRsvp()[msg.id] !== 'out'"
                    >
                      Can't make it
                    </button>
                  </div>
                </div>
              }
              @case ('expense') {
                <div class="bg-white border border-slate-200 rounded-2xl p-3.5 w-72 flex items-center gap-2.5">
                  <span class="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6M9 8h6M6 3h12a1 1 0 011 1v16l-3-2-3 2-3-2-3 2-3-2-3 2V4a1 1 0 011-1z" />
                    </svg>
                  </span>
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-bold text-text-primary truncate">{{ msg.title }}</p>
                    <p class="text-[11.5px] font-semibold text-text-faint truncate">{{ msg.meta }}</p>
                  </div>
                  <button
                    type="button"
                    (click)="settleExpense(msg.id)"
                    class="shrink-0 h-8 px-3 rounded-lg border text-[12px] font-semibold transition-colors focus:outline-none"
                    [class.border-primary]="!settledExpenses().has(msg.id)"
                    [class.text-primary]="!settledExpenses().has(msg.id)"
                    [class.border-slate-200]="settledExpenses().has(msg.id)"
                    [class.text-text-faint]="settledExpenses().has(msg.id)"
                  >
                    {{ settledExpenses().has(msg.id) ? 'Settled' : 'Settle' }}
                  </button>
                </div>
              }
              @case ('place') {
                <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden w-72">
                  <div class="w-full h-32 bg-slate-100">
                    <img [src]="msg.image" class="w-full h-full object-cover" alt="" (error)="onImageError($event)" />
                  </div>
                  <div class="p-3.5 flex flex-col gap-2">
                    <div>
                      <p class="text-[13px] font-bold text-text-primary">{{ msg.title }}</p>
                      <p class="text-[11.5px] font-semibold text-text-faint mt-0.5">{{ msg.meta }}</p>
                    </div>
                    <button
                      type="button"
                      (click)="addPlaceToTrip(msg.id)"
                      class="w-full h-9 rounded-lg text-[12px] font-semibold transition-colors focus:outline-none"
                      [class.bg-primary-50]="!addedPlaces().has(msg.id)"
                      [class.text-primary]="!addedPlaces().has(msg.id)"
                      [class.bg-slate-100]="addedPlaces().has(msg.id)"
                      [class.text-text-faint]="addedPlaces().has(msg.id)"
                    >
                      {{ addedPlaces().has(msg.id) ? 'Added' : msg.ctaLabel }}
                    </button>
                  </div>
                </div>
              }
            }

            <p class="text-[10.5px] font-semibold text-text-faint">{{ msg.time }}</p>
          </div>
        }
      </div>

      <!-- Quick-compose shortcuts + message input -->
      <div class="border-t border-slate-100 px-4 py-3 flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="quickCompose('📍')"
            class="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-text-secondary hover:border-slate-300 transition-colors focus:outline-none"
            aria-label="Share a place"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z" />
            </svg>
          </button>
          <button
            type="button"
            (click)="quickCompose('📊')"
            class="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-text-secondary hover:border-slate-300 transition-colors focus:outline-none"
            aria-label="Start a poll"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 20V10m4 10V4m4 16v-7" />
            </svg>
          </button>
          <button
            type="button"
            (click)="quickCompose('📅')"
            class="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-text-secondary hover:border-slate-300 transition-colors focus:outline-none"
            aria-label="Plan a meetup"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 2v4M16 2v4M3 10h18M21 14V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h7m4-2l2 2 4-4" />
            </svg>
          </button>
          <button
            type="button"
            (click)="quickCompose('🧾')"
            class="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-text-secondary hover:border-slate-300 transition-colors focus:outline-none"
            aria-label="Split an expense"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6M9 8h6M6 3h12a1 1 0 011 1v16l-3-2-3 2-3-2-3 2-3-2-3 2V4a1 1 0 011-1z" />
            </svg>
          </button>
        </div>
        <div class="flex items-center gap-2">
          <input
            #draftInput
            type="text"
            [(ngModel)]="draft"
            (keydown.enter)="sendMessage()"
            placeholder="Message the crew…"
            class="flex-1 h-11 rounded-full border border-slate-200 px-4 text-[13px] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-primary transition-colors"
          />
          <button
            type="button"
            (click)="sendMessage()"
            [disabled]="draft.trim().length === 0"
            class="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors focus:outline-none disabled:cursor-not-allowed"
            [class.bg-primary]="draft.trim().length > 0"
            [class.text-white]="draft.trim().length > 0"
            [class.bg-slate-100]="draft.trim().length === 0"
            [class.text-text-faint]="draft.trim().length === 0"
            aria-label="Send message"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-scroll { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
    .chat-scroll::-webkit-scrollbar { width: 6px; }
    .chat-scroll::-webkit-scrollbar-track { background: transparent; }
    .chat-scroll::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 9999px; }
    .chat-scroll::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
  `],
})
export class CommunityCrewChatModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() exitedGroup = new EventEmitter<void>();

  @ViewChild('draftInput') draftInputRef?: ElementRef<HTMLInputElement>;

  private readonly toast = inject(ToastService);
  private readonly hostRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly document = inject(DOCUMENT);

  readonly chat = PARIS_CREW_CHAT_MOCK;
  readonly messages = signal<CrewMessage[]>(this.chat.messages);

  draft = '';

  readonly pollVotes = signal<Record<string, string>>({});
  readonly meetupRsvp = signal<Record<string, 'in' | 'out'>>({});
  readonly settledExpenses = signal<Set<string>>(new Set());
  readonly addedPlaces = signal<Set<string>>(new Set());

  constructor() {
    /* This modal is only ever opened from the Crew widget, which sits inside
       the community page's sticky right rail (`position: sticky`) — that,
       despite z-index:auto, creates its own stacking context in real
       browsers, trapping this modal's fixed/z-[90] panel locally so it no
       longer outranks unrelated page chrome painted outside that rail (e.g.
       the sticky header). Reparenting the host to <body> once rendered
       escapes that trap; the template is plain Tailwind utility classes with
       no dependency on inherited CSS custom properties, so it's safe to move
       as-is. */
    afterNextRender(() => {
      const host = this.hostRef.nativeElement;
      if (host.parentElement !== this.document.body) {
        this.document.body.appendChild(host);
      }
    });
  }

  votePoll(messageId: string, option: string): void {
    this.pollVotes.update(votes => ({ ...votes, [messageId]: option }));
  }

  rsvpMeetup(messageId: string, status: 'in' | 'out'): void {
    this.meetupRsvp.update(rsvps => ({ ...rsvps, [messageId]: status }));
  }

  settleExpense(messageId: string): void {
    this.settledExpenses.update(set => new Set(set).add(messageId));
  }

  addPlaceToTrip(messageId: string): void {
    this.addedPlaces.update(set => new Set(set).add(messageId));
  }

  /** Hides a place-card photo that failed to load, leaving its slate-100
   * background visible instead of the browser's broken-image icon. */
  onImageError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  quickCompose(prefix: string): void {
    this.draft = this.draft ? `${this.draft} ${prefix} ` : `${prefix} `;
    this.draftInputRef?.nativeElement.focus();
  }

  sendMessage(): void {
    const text = this.draft.trim();
    if (!text) return;
    this.messages.update(list => [
      ...list,
      {
        id: `local-${Date.now()}`,
        author: 'You',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        kind: 'text',
        text,
      },
    ]);
    this.draft = '';
  }

  onExitGroup(): void {
    this.exitedGroup.emit();
    this.toast.success('You left Paris Crew.');
    this.close.emit();
  }
}
