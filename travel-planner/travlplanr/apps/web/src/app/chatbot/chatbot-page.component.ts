import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TravelChatSessionService } from '../shared/services/travel-chat-session.service';
import { TravelChatMessagesComponent } from '../shared/components/travel-chat-messages/travel-chat-messages.component';
import { SearchPlanAssistComponent } from '../shared/components/search-plan-assist/search-plan-assist.component';
import { TripSlotsRowComponent } from '../shared/components/trip-slots-row/trip-slots-row.component';

/**
 * Full-page chat surface — reuses the same session + message list as the
 * floating dock so history, streaming, chips, and voice stay in sync.
 */
@Component({
  selector: 'app-chatbot-page',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    TravelChatMessagesComponent,
    SearchPlanAssistComponent,
    TripSlotsRowComponent,
  ],
  template: `
    <div class="section-container flex h-[calc(100vh-68px)] max-w-[800px] flex-col py-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 class="text-3xl font-semibold text-text-primary">{{ 'CHATBOT.TITLE' | translate }}</h1>
          <p class="text-sm text-text-secondary">{{ 'CHATBOT.SUBTITLE' | translate }}</p>
        </div>
        <div class="flex items-center gap-3">
          @if (chat.hasConversation()) {
            <button
              type="button"
              class="text-sm text-text-secondary hover:text-text-primary"
              (click)="chat.clearHistory()"
            >
              {{ 'SHARED.NEW_CHAT' | translate }}
            </button>
          }
          <a routerLink="/" class="text-sm text-primary no-underline hover:underline">← {{ 'CHATBOT.HOME' | translate }}</a>
        </div>
      </div>

      <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-white">
        <div class="min-h-0 flex-1 overflow-y-auto p-4">
          <app-travel-chat-messages variant="panel" [threadVisible]="true" />
        </div>

        <div class="border-t border-border px-4 pt-3">
          <app-trip-slots-row tone="light" />
          <app-search-plan-assist tone="light" />
        </div>

        <form class="flex gap-3 px-4 pb-4" (submit)="send($event)">
          <input
            #pageInput
            type="text"
            [placeholder]="'CHATBOT.PLACEHOLDER' | translate"
            class="h-12 min-w-0 flex-1 rounded-btn border border-border px-4 text-base outline-none focus:border-primary"
            [disabled]="chat.sending()"
            [readonly]="chat.listening()"
            [class.italic]="chat.listening()"
            (input)="onInput()"
          />
          <button
            type="button"
            class="rounded-btn border border-border px-3 text-sm disabled:opacity-50"
            [disabled]="chat.sending() || !chat.voiceSupported()"
            (click)="chat.toggleVoice()"
            [attr.aria-label]="(chat.listening() ? 'SHARED.STOP_VOICE_INPUT' : 'SHARED.VOICE_INPUT') | translate"
          >
            {{ chat.listening() ? '⏹' : '🎤' }}
          </button>
          <button
            type="submit"
            class="rounded-btn bg-primary px-6 text-base font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            [disabled]="!chat.sending() && !inputValue().trim()"
            (click)="chat.sending() ? onStop($event) : null"
          >
            {{ (chat.sending() ? 'SHARED.STOP' : 'CHATBOT.SEND') | translate }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class ChatbotPageComponent {
  readonly chat = inject(TravelChatSessionService);
  private readonly pageInput = viewChild<ElementRef<HTMLInputElement>>('pageInput');

  readonly inputValue = signal('');

  constructor() {
    const initialPrefillVersion = this.chat.composerPrefillVersion();
    effect(() => {
      const version = this.chat.composerPrefillVersion();
      if (version <= initialPrefillVersion) return;
      const text = this.chat.composerPrefillText();
      const input = this.pageInput()?.nativeElement;
      if (input) {
        input.value = text;
        input.focus();
      }
      this.inputValue.set(text);
    });

    let wasListening = false;
    effect(() => {
      const listening = this.chat.listening();
      const live = this.chat.interimTranscript();
      const input = this.pageInput()?.nativeElement;
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
  }

  onInput(): void {
    this.inputValue.set(this.pageInput()?.nativeElement.value ?? '');
  }

  onStop(event: Event): void {
    event.preventDefault();
    this.chat.stopGenerating();
  }

  async send(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.chat.sending()) return;
    const text = this.inputValue().trim();
    if (!text) return;
    const input = this.pageInput()?.nativeElement;
    if (input) input.value = '';
    this.inputValue.set('');
    await this.chat.send(text);
    queueMicrotask(() => this.pageInput()?.nativeElement?.focus());
  }
}
