import { Component, ElementRef, Injector, afterNextRender, computed, effect, inject, signal } from '@angular/core';

import { DOCUMENT } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from '../../shared/utils/toast.service';
import { ProfileService } from '../../profile/profile.service';
import { ModalShellComponent } from '../circles-trips/features/community-home/components/overlays/modal-shell/modal-shell.component';
import { CreateCircleModalComponent, CreateCirclePayload } from '../circles-trips/features/community-travelcircles/components/create-circle-modal/create-circle-modal.component';
import { CommunityCrewChatModalComponent } from './community-crew-chat-modal.component';
import { CommunityCrewService, CrewInvite, CrewMatch, CrewSampleMember } from '../services/community-crew.service';
import { CommunitySpacesService, SpaceMemberSummary } from '../services/community-spaces.service';
import { ChatCircleContext } from './community-crew-chat.mock';
import { CircleMember } from '../circles-trips/features/community-travelcircles/data/travel-circle-cards.data';

function toCircleMember(m: SpaceMemberSummary): CircleMember {
  return {
    name: m.name,
    customer_id: m.customer_id,
    location: m.location ?? 'Traveler',
    role: m.role === 'admin' ? 'Host' : undefined,
  };
}

function daysUntil(isoDate: string | null): number {
  if (!isoDate) return 0;
  const diffMs = new Date(isoDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function formatDateRange(match: CrewMatch): string {
  if (!match.startDate || !match.endDate) return '';
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(match.startDate)} – ${fmt(match.endDate)}`;
}

@Component({
  selector: 'app-community-crew-widget',
  imports: [TranslatePipe, ModalShellComponent, CreateCircleModalComponent, CommunityCrewChatModalComponent, RouterLink],
  template: `
    @if (primaryMatch() || invite()) {
      <div class="bg-white dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_1px_2px_rgba(11,18,32,0.04),0_8px_24px_rgba(11,18,32,0.05)] overflow-hidden">
        <div class="px-[18px] py-4 border-b border-slate-100 dark:border-gray-700 flex items-center gap-2.5">
          <span class="w-9 h-9 rounded-xl bg-primary-50 text-primary flex items-center justify-center shrink-0">
            <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          </span>
          <div class="flex-1 min-w-0 flex flex-col gap-0.5">
            @if (!personalized()) {
              <div class="flex items-center justify-between gap-2">
                <span class="text-[14.5px] font-bold text-text-primary tracking-tight">{{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_TITLE' | translate }}</span>
                <a routerLink="/community/travel-circles" class="shrink-0 text-[11px] font-extrabold text-primary hover:underline">{{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_SEE_ALL' | translate }}</a>
              </div>
              <span class="text-[12.5px] font-semibold text-text-faint">{{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_NO_TRIPS' | translate }}</span>
            } @else if (primaryMatch(); as match) {
              <div class="flex items-center justify-between gap-2">
                <span class="text-[14.5px] font-bold text-text-primary tracking-tight">{{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_TITLE_DYNAMIC' | translate: { destination: match.destinationName } }}</span>
                <a routerLink="/community/travel-circles" class="shrink-0 text-[11px] font-extrabold text-primary hover:underline">{{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_SEE_ALL' | translate }}</a>
              </div>
              <span class="text-[12.5px] font-semibold text-text-faint">{{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_SUBTITLE' | translate }}</span>
            } @else {
              <div class="flex items-center justify-between gap-2">
                <span class="text-[14.5px] font-bold text-text-primary tracking-tight">{{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_TITLE' | translate }}</span>
                <a routerLink="/community/travel-circles" class="shrink-0 text-[11px] font-extrabold text-primary hover:underline">{{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_SEE_ALL' | translate }}</a>
              </div>
              <span class="text-[12.5px] font-semibold text-text-faint">{{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_SUBTITLE' | translate }}</span>
            }
          </div>
        </div>

        <div class="px-[18px] py-3.5 flex flex-col gap-2.5">
          @if (invite(); as inv) {
            <div class="flex items-center gap-2.5 p-3 rounded-xl border border-primary-subtle/50 bg-primary-50/40">
              <img [src]="inv.sender.avatar || '/assets/images/default-avatar.svg'" class="w-9 h-9 rounded-full shrink-0 bg-slate-100" alt="" />
              <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                <a class="text-[12.5px] font-semibold text-text-primary hover:text-primary hover:underline" [routerLink]="['/community/users', inv.sender.id]">{{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_INVITED_BY' | translate: { name: inv.sender.name } }}</a>
                <span class="text-[11px] font-semibold text-text-faint">{{ inv.spaceName }}{{ inv.dateRange ? ' · ' + inv.dateRange : '' }}</span>
              </div>
            </div>
            <div class="flex gap-2">
              <button (click)="acceptInvite()" class="flex-1 h-[38px] rounded-xl bg-primary hover:bg-primary-hover text-white text-[12.5px] font-semibold transition-colors">
                {{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_ACCEPT' | translate }}
              </button>
              <button (click)="declineInvite()" class="h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-gray-700 text-[12.5px] font-semibold text-text-secondary hover:border-slate-300 transition-colors">
                {{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_DECLINE' | translate }}
              </button>
            </div>
          } @else if (personalized() && primaryMatch(); as match) {
            <div class="flex flex-col gap-2">
              <div class="flex flex-col gap-0.5">
                <h3 class="text-[13.5px] font-bold text-text-primary tracking-tight truncate">
                  {{ match.name }}
                  @if (dateRangeLabel(match); as dateRange) {
                    <span class="font-semibold text-text-faint"> • {{ dateRange }}</span>
                  }
                </h3>
                <p class="text-[11px] font-semibold text-text-secondary">{{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_LOBBY_DYNAMIC' | translate: { count: match.memberCount, destination: match.destinationName } }}</p>
              </div>
              <p class="text-[11.5px] font-medium leading-snug text-text-faint">{{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_NOTE' | translate }}</p>
              <div class="flex items-center justify-between gap-2">
                <span class="flex -space-x-2">
                  @for (member of visibleAvatars(match); track member.name) {
                    <img [src]="member.avatar || '/assets/images/default-avatar.svg'" class="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 object-cover" alt="" />
                  }
                  @if (extraMemberCount(match) > 0) {
                    <span class="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-slate-100 dark:bg-gray-700 flex items-center justify-center text-[9px] font-bold text-text-secondary">+{{ extraMemberCount(match) }}</span>
                  }
                </span>
                @if (match.isJoined) {
                  <button type="button" (click)="openCircleChat(match)" class="shrink-0 h-8 px-4 rounded-full bg-primary-50 hover:bg-primary-100 text-primary text-[12.5px] font-bold whitespace-nowrap transition-colors">
                    {{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_VIEW' | translate }}
                  </button>
                } @else {
                  <button (click)="requestToJoin(match)" class="shrink-0 h-8 px-4 rounded-full bg-primary hover:bg-primary-hover text-white text-[12.5px] font-bold whitespace-nowrap transition-colors">
                    {{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_REQUEST' | translate }}
                  </button>
                }
              </div>
            </div>
            <button type="button" (click)="showCreateCircleModal.set(true)" class="self-center text-[12.5px] font-semibold text-text-primary hover:underline">{{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_START_OWN' | translate }}</button>
          } @else if (!personalized() && matches().length > 0) {
            <!-- No active trips to match against — discover/join a popular
                 crew instead, reusing the same crew Join flow. Capped to a
                 handful so the sidebar never scrolls; "See all" hands off to
                 the full Travel Circles page for the rest. -->
            @for (crew of discoverCrews(); track crew.id) {
              <div class="flex flex-col gap-1.5 p-2.5 rounded-xl border border-slate-100 dark:border-gray-700">
                <div class="flex flex-col gap-0.5">
                  <p class="text-[12px] font-bold text-text-primary truncate">
                    {{ crew.name }}
                    @if (dateRangeLabel(crew); as dateRange) {
                      <span class="font-semibold text-text-faint"> • {{ dateRange }}</span>
                    }
                  </p>
                  <p class="text-[10.5px] font-semibold text-text-faint">{{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_LOBBY_DYNAMIC' | translate: { count: crew.memberCount, destination: crew.destinationName } }}</p>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <span class="flex -space-x-2">
                    @for (member of visibleAvatars(crew); track member.name) {
                      <img [src]="member.avatar || '/assets/images/default-avatar.svg'" class="w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 object-cover" alt="" />
                    }
                    @if (extraMemberCount(crew) > 0) {
                      <span class="w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 bg-slate-100 dark:bg-gray-700 flex items-center justify-center text-[8px] font-bold text-text-secondary">+{{ extraMemberCount(crew) }}</span>
                    }
                  </span>
                  @if (crew.isJoined) {
                    <button type="button" (click)="openCircleChat(crew)" class="shrink-0 h-7 px-3 rounded-full bg-primary-50 hover:bg-primary-100 text-primary text-[10.5px] font-bold whitespace-nowrap transition-colors">
                      {{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_VIEW' | translate }}
                    </button>
                  } @else {
                    <button type="button" (click)="requestToJoin(crew)" class="shrink-0 h-7 px-3 rounded-full bg-primary hover:bg-primary-hover text-white text-[10.5px] font-bold whitespace-nowrap transition-colors">
                      {{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_REQUEST' | translate }}
                    </button>
                  }
                </div>
              </div>
            }
            <button type="button" (click)="showCreateCircleModal.set(true)" class="self-center text-[13px] font-semibold text-text-primary hover:underline">{{ 'COMMUNITY.HOME_SIDEBAR.CIRCLE_START_OWN' | translate }}</button>
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

    @if (showCrewChat() && crewChatContext(); as context) {
      <app-community-crew-chat-modal
        [currentUserName]="profile.profile().name"
        [joinedCircles]="[context]"
        [initialCircleId]="context.id"
        (close)="showCrewChat.set(false)"
        (exitedGroup)="onExitGroup()"
      />
    }

    <!-- Floating launcher for the joined crew's chat, always reachable from the
         Community Home page regardless of scroll position, once the user has
         actually joined a crew (nothing real to open before that). -->
    @if (activeCrewSpace()) {
      <button
        type="button"
        (click)="showCrewChat.set(true)"
        class="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary hover:bg-primary-hover text-white shadow-[0_10px_28px_rgba(0,96,234,0.35)] border-2 border-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 focus:outline-none"
        aria-label="Open circle chat"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 20l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
        </svg>
      </button>
    }
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
  private readonly crewService = inject(CommunityCrewService);
  private readonly spacesService = inject(CommunitySpacesService);
  private readonly elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  readonly profile = inject(ProfileService);

  readonly matches = signal<CrewMatch[]>([]);
  readonly invite = signal<CrewInvite | null>(null);
  /** false once loaded, when the caller has no active trips — matches() then
   * holds popular public crews to discover/join instead of a personal match. */
  readonly personalized = signal(true);
  readonly showCreateCircleModal = signal(false);
  readonly showCrewChat = signal(false);

  /** Whichever joined circle is currently backing the floating launcher/chat —
   * a user can join several circles at once (see `matches()[].isJoined`); this
   * only tracks which one's chat panel is open, defaulting to any already-joined
   * circle found on load or the one most recently joined/viewed. */
  readonly activeCrewSpace = signal<CrewMatch | null>(null);
  readonly crewChatContext = signal<ChatCircleContext | null>(null);

  /** The single crew surfaced in the sidebar card — the soonest-starting match
   * among the user's upcoming trips, if any. */
  readonly primaryMatch = computed<CrewMatch | null>(() => {
    const list = this.matches();
    if (list.length === 0) return null;
    return [...list].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))[0];
  });

  /** Discover-mode crew list, capped to 3 so the sidebar never needs to
   * scroll — "See all" (routed to the Travel Circles page) covers the rest. */
  readonly discoverCrews = computed<CrewMatch[]>(() => this.matches().slice(0, 3));

  /** First 3 real member avatars for a crew's avatar stack — the rest are
   * summarized by extraMemberCount()'s "+N" badge rather than rendered. */
  visibleAvatars(match: CrewMatch): CrewSampleMember[] {
    return match.sampleMembers.slice(0, 3);
  }

  /** How many members beyond the 3 shown avatars, based on the real member
   * count (not just how many sample avatars the backend happened to send). */
  extraMemberCount(match: CrewMatch): number {
    return Math.max(0, match.memberCount - 3);
  }

  /** Compact trip-window label shown inline next to the circle name, e.g. "Sep 25 - Oct 1". */
  dateRangeLabel(match: CrewMatch): string {
    if (!match.startDate || !match.endDate) return '';
    const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmtShort(match.startDate)} - ${fmtShort(match.endDate)}`;
  }

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

    this.loadMatches();
  }

  private loadMatches(): void {
    this.crewService.getMatches().subscribe({
      next: (res) => {
        this.matches.set(res.matches);
        this.invite.set(res.invite);
        this.personalized.set(res.personalized);
        const joinedMatch = res.matches.find((m) => m.isJoined);
        if (joinedMatch) this.activateCrewSpace(joinedMatch);
      },
      error: () => {
        // No crew match today (no upcoming trips, or the lookup failed) — the
        // widget simply stays hidden rather than showing fake content.
      },
    });
  }

  private activateCrewSpace(match: CrewMatch): void {
    this.activeCrewSpace.set(match);
    this.spacesService.getSpaceMembers(match.id).subscribe({
      next: (members) => {
        this.crewChatContext.set({
          id: match.id,
          title: match.name,
          dateRange: formatDateRange(match),
          memberCount: match.memberCount,
          onlineCount: Math.min(match.memberCount, 4),
          endsInDays: daysUntil(match.endDate),
          members: members.map(toCircleMember),
          messages: [],
        });
      },
      error: () => {},
    });
  }

  acceptInvite(): void {
    const inv = this.invite();
    if (!inv) return;
    this.crewService.acceptInvite(inv.id).subscribe({
      next: () => {
        this.invite.set(null);
        this.toast.success(this.translate.instant('COMMUNITY.HOME_SIDEBAR.CIRCLE_TOAST_JOINED'));
        this.loadMatches();
      },
      error: () => this.toast.error('Could not accept the invite — please try again'),
    });
  }

  declineInvite(): void {
    const inv = this.invite();
    if (!inv) return;
    this.crewService.declineInvite(inv.id).subscribe({
      next: () => {
        this.invite.set(null);
        this.toast.success(this.translate.instant('COMMUNITY.HOME_SIDEBAR.CIRCLE_TOAST_DECLINED'));
      },
      error: () => this.toast.error('Could not decline the invite — please try again'),
    });
  }

  requestToJoin(match: CrewMatch): void {
    this.crewService.requestJoin(match.id).subscribe({
      next: (res) => {
        const updated: CrewMatch = { ...match, isJoined: true, memberCount: res.memberCount };
        this.matches.update((list) => list.map((m) => (m.id === match.id ? updated : m)));
        this.toast.success(this.translate.instant('COMMUNITY.HOME_SIDEBAR.CIRCLE_TOAST_REQUESTED'));
        this.openCircleChat(updated);
      },
      error: () => this.toast.error('Could not join — please try again'),
    });
  }

  /** Opens the chat panel for an already-joined circle (reuses the same
   * chat-loading path a fresh join uses). Other joined circles are untouched —
   * only which one's panel is open changes. */
  openCircleChat(match: CrewMatch): void {
    this.activateCrewSpace(match);
    this.showCrewChat.set(true);
  }

  onExitGroup(): void {
    const space = this.activeCrewSpace();
    this.showCrewChat.set(false);
    if (!space) return;
    this.crewService.leave(space.id).subscribe({
      next: (res) => {
        this.matches.update((list) => list.map((m) => (m.id === space.id ? { ...m, isJoined: false, memberCount: res.memberCount } : m)));
        this.activeCrewSpace.set(null);
        this.crewChatContext.set(null);
        // Leaving one joined circle shouldn't drop the launcher if the user is
        // still a member of another — re-activate the next one, if any.
        const stillJoined = this.matches().find((m) => m.isJoined && m.id !== space.id);
        if (stillJoined) this.activateCrewSpace(stillJoined);
      },
      error: () => this.toast.error('Could not leave — please try again'),
    });
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
