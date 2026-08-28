import { Component, ElementRef, Injector, afterNextRender, effect, inject, signal } from '@angular/core';

import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from '../../shared/utils/toast.service';
import { ModalShellComponent } from '../circles-trips/features/community-home/components/overlays/modal-shell/modal-shell.component';
import { CreateCircleModalComponent, CreateCirclePayload } from '../circles-trips/features/community-travelcircles/components/create-circle-modal/create-circle-modal.component';
import { CommunityCrewChatModalComponent } from './community-crew-chat-modal.component';

@Component({
  selector: 'app-community-crew-widget',
  imports: [TranslatePipe, ModalShellComponent, CreateCircleModalComponent, CommunityCrewChatModalComponent],
  template: `
    @if (!joined()) {
      <div class="bg-white dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_1px_2px_rgba(11,18,32,0.04),0_8px_24px_rgba(11,18,32,0.05)] overflow-hidden">
        <div class="px-[18px] py-4 border-b border-slate-100 dark:border-gray-700 flex items-center gap-2.5">
          <span class="w-9 h-9 rounded-xl bg-primary-50 text-primary flex items-center justify-center shrink-0">
            <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          </span>
          <div class="flex-1 min-w-0 flex flex-col gap-0.5">
            <span class="text-[14.5px] font-bold text-text-primary tracking-tight">{{ 'COMMUNITY.HOME_SIDEBAR.CREW_TITLE' | translate }}</span>
            <span class="text-[12.5px] font-semibold text-text-faint">{{ 'COMMUNITY.HOME_SIDEBAR.CREW_SUBTITLE' | translate }}</span>
          </div>
        </div>

        <div class="px-[18px] py-4 flex flex-col gap-3.5">
          @if (hasInvite()) {
            <div class="flex items-center gap-2.5 p-3 rounded-xl border border-primary-subtle/50 bg-primary-50/40">
              <img src="/assets/images/default-avatar.svg" class="w-9 h-9 rounded-full shrink-0 bg-slate-100" alt="" />
              <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                <span class="text-[12.5px] font-semibold text-text-primary">{{ 'COMMUNITY.HOME_SIDEBAR.CREW_INVITED_BY' | translate: { name: inviterName } }}</span>
                <span class="text-[11px] font-semibold text-text-faint">{{ 'COMMUNITY.HOME_SIDEBAR.CREW_INVITE_NOTE' | translate }}</span>
              </div>
            </div>
            <div class="flex gap-2">
              <button (click)="acceptInvite()" class="flex-1 h-[38px] rounded-xl bg-primary hover:bg-primary-hover text-white text-[12.5px] font-semibold transition-colors">
                {{ 'COMMUNITY.HOME_SIDEBAR.CREW_ACCEPT' | translate }}
              </button>
              <button (click)="declineInvite()" class="h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-gray-700 text-[12.5px] font-semibold text-text-secondary hover:border-slate-300 transition-colors">
                {{ 'COMMUNITY.HOME_SIDEBAR.CREW_DECLINE' | translate }}
              </button>
            </div>
          } @else {
            <div class="flex items-center gap-2.5">
              <span class="flex -space-x-2.5">
                @for (face of faces; track face) {
                  <img [src]="face" class="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 object-cover" alt="" />
                }
              </span>
              <span class="text-xs font-semibold text-text-secondary">{{ 'COMMUNITY.HOME_SIDEBAR.CREW_LOBBY' | translate }}</span>
            </div>
            <p class="text-[13px] font-medium leading-relaxed text-text-faint">{{ 'COMMUNITY.HOME_SIDEBAR.CREW_NOTE' | translate }}</p>
            <button (click)="requestToJoin()" class="w-full h-12 rounded-full bg-primary hover:bg-primary-hover text-white text-[14.5px] font-bold transition-colors">
              {{ 'COMMUNITY.HOME_SIDEBAR.CREW_REQUEST' | translate }}
            </button>
            <button type="button" (click)="showCreateCircleModal.set(true)" class="self-center text-[13px] font-semibold text-text-primary hover:underline">{{ 'COMMUNITY.HOME_SIDEBAR.CREW_START_OWN' | translate }}</button>
          }
        </div>
      </div>
    }

    @if (showCreateCircleModal()) {
      <div class="circles-theme-scope">
        <app-modal-shell
          heading="Create a travel circle"
          subtitle="Small groups planning the same kind of travel."
          (close)="onCancelCreateCircle()"
        >
          <app-create-circle-modal (cancel)="onCancelCreateCircle()" (create)="onCircleCreated($event)" />
        </app-modal-shell>
      </div>
    }

    @if (showCrewChat()) {
      <app-community-crew-chat-modal
        (close)="showCrewChat.set(false)"
        (exitedGroup)="onExitGroup()"
      />
    }

    <!-- Floating launcher for the Paris Crew chat, always reachable from the
         Community Home page regardless of scroll position or join state. -->
    <button
      type="button"
      (click)="showCrewChat.set(true)"
      class="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary hover:bg-primary-hover text-white shadow-[0_10px_28px_rgba(0,96,234,0.35)] border-2 border-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 focus:outline-none"
      aria-label="Open Paris Crew chat"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 20l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    </button>
  `,
  styles: [`
    /* Design tokens the reused Travel Circles modal expects — normally supplied by
       circles-trips/_theme.scss, which this widget lives outside of. */
    .circles-theme-scope {
      --accent: #0060ea;
      --accent-deep: #0052c8;
      --surface: #ffffff;
      --text-primary: #0b1220;
      --text-secondary: #1b2637;
      --text-muted: #5a6472;
      --text-faint: #8b94a3;
      --border-soft: #e8ecf2;
      --border: #e2e7ef;
      --border-hover: #cbd6e4;
      /* This reused modal has no dark-mode styles of its own, so its text relies on
         inheriting a dark color here — without it, dark mode's light ambient text
         color makes the heading unreadable against the modal's always-white surface. */
      color: var(--text-primary);
      /* This modal is reparented to <body> once open (see the constructor below),
         which escapes the page's own font-manrope wrapper — so this scope carries
         its own font-family too, instead of falling back to the app-wide Poppins
         default. */
      font-family: Manrope, ui-sans-serif, system-ui, sans-serif;
    }
  `],
})
export class CommunityCrewWidgetComponent {
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  readonly inviterName = 'Maya Kondo';
  readonly faces = [
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80',
    'https://images.unsplash.com/photo-1500614879573-5c11ba8a8e0f?auto=format&fit=crop&w=100&q=80',
  ];

  readonly joined = signal(false);
  readonly hasInvite = signal(false);
  readonly showCreateCircleModal = signal(false);
  readonly showCrewChat = signal(false);

  constructor() {
    /* This widget sits inside the community page's sticky right rail
       (`position: sticky`), which — despite z-index:auto — creates its own
       stacking context in real browsers. That traps the modal's z-index:90
       backdrop locally, so it no longer outranks unrelated page chrome (e.g.
       the stories bar's "add story" button rendered painted on top of it).
       Reparenting the modal root to <body> once it's rendered escapes that
       trap; .circles-theme-scope carries its own CSS custom properties, so
       it doesn't depend on inheriting them from this component's ancestors. */
    effect(() => {
      if (!this.showCreateCircleModal()) return;
      afterNextRender(() => {
        const modalRoot = this.elementRef.nativeElement.querySelector<HTMLElement>('.circles-theme-scope');
        if (modalRoot && modalRoot.parentElement !== this.document.body) {
          this.document.body.appendChild(modalRoot);
        }
      }, { injector: this.injector });
    });
  }

  acceptInvite(): void {
    this.joined.set(true);
    this.toast.success(this.translate.instant('COMMUNITY.HOME_SIDEBAR.CREW_TOAST_JOINED'));
  }

  declineInvite(): void {
    this.hasInvite.set(false);
    this.toast.success(this.translate.instant('COMMUNITY.HOME_SIDEBAR.CREW_TOAST_DECLINED'));
  }

  requestToJoin(): void {
    this.joined.set(true);
    this.toast.success(this.translate.instant('COMMUNITY.HOME_SIDEBAR.CREW_TOAST_REQUESTED'));
    this.showCrewChat.set(true);
  }

  onExitGroup(): void {
    this.joined.set(false);
    this.showCrewChat.set(false);
  }

  onCancelCreateCircle(): void {
    this.showCreateCircleModal.set(false);
  }

  onCircleCreated(payload: CreateCirclePayload): void {
    this.showCreateCircleModal.set(false);
    this.toast.success(`"${payload.name}" created`);
    void this.router.navigate(['/community/travel-circles']);
  }
}
