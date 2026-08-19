import { Component, Output, EventEmitter, inject } from '@angular/core';

import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../auth/auth.service';

@Component({
    selector: 'app-community-mobile-nav',
    imports: [RouterLink, RouterLinkActive, TranslatePipe],
    template: `
    <!-- Bottom tab bar (mobile only) -->
    <nav
      class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] safe-area-inset-bottom"
      [attr.aria-label]="'COMMUNITY.MOBILE_NAV.NAV_ARIA' | translate"
    >
      <!-- Horizontal quick-access chips above tabs -->
      <div class="flex gap-2 overflow-x-auto no-scrollbar px-3 pt-2 pb-1 border-b border-slate-100">
        <a routerLink="/community/collections" class="shrink-0 flex items-center gap-1 bg-slate-50 hover:bg-primary-50 hover:text-primary text-text-secondary border border-slate-200/60 text-2xs font-bold px-2.5 py-1 rounded-full transition-all">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
          {{ 'COMMUNITY.MOBILE_NAV.COLLECTIONS' | translate }}
        </a>
        <a routerLink="/community/reels" class="shrink-0 flex items-center gap-1 bg-slate-50 hover:bg-primary-50 hover:text-primary text-text-secondary border border-slate-200/60 text-2xs font-bold px-2.5 py-1 rounded-full transition-all">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          {{ 'COMMUNITY.MOBILE_NAV.REELS' | translate }}
        </a>
        <a routerLink="/community/matching" class="shrink-0 flex items-center gap-1 bg-slate-50 hover:bg-primary-50 hover:text-primary text-text-secondary border border-slate-200/60 text-2xs font-bold px-2.5 py-1 rounded-full transition-all">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          {{ 'COMMUNITY.MOBILE_NAV.BUDDIES' | translate }}
        </a>
        <a routerLink="/community" [queryParams]="{view: 'map'}" class="shrink-0 flex items-center gap-1 bg-slate-50 hover:bg-primary-50 hover:text-primary text-text-secondary border border-slate-200/60 text-2xs font-bold px-2.5 py-1 rounded-full transition-all">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
          {{ 'COMMUNITY.MOBILE_NAV.MAP' | translate }}
        </a>
      </div>

      <!-- Tab buttons -->
      <div class="flex items-center justify-around px-1 py-1.5 pb-[max(env(safe-area-inset-bottom),8px)]">
        <!-- Feed -->
        <a routerLink="/community" [queryParams]="{}" routerLinkActive="text-primary" [routerLinkActiveOptions]="{exact: true}"
          class="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-text-tertiary hover:text-primary transition-colors focus:outline-none"
          [attr.aria-label]="'COMMUNITY.MOBILE_NAV.FEED' | translate"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
          <span class="text-[9px] font-extrabold uppercase tracking-wide">{{ 'COMMUNITY.MOBILE_NAV.FEED' | translate }}</span>
        </a>

        <!-- Map -->
        <a routerLink="/community" [queryParams]="{view: 'map'}"
          class="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-text-tertiary hover:text-primary transition-colors focus:outline-none"
          [attr.aria-label]="'COMMUNITY.MOBILE_NAV.MAP' | translate"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
          <span class="text-[9px] font-extrabold uppercase tracking-wide">{{ 'COMMUNITY.MOBILE_NAV.MAP' | translate }}</span>
        </a>

        <!-- Post (centre CTA) -->
        <button
          (click)="onPost.emit()"
          class="relative -top-3 w-12 h-12 bg-gradient-to-br from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-700 rounded-full text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          [attr.aria-label]="'COMMUNITY.MOBILE_NAV.CREATE_POST' | translate"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        </button>

        <!-- Messages -->
        <a routerLink="/community/messages" routerLinkActive="text-primary"
          class="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-text-tertiary hover:text-primary transition-colors focus:outline-none"
          [attr.aria-label]="'COMMUNITY.MOBILE_NAV.MESSAGES' | translate"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          <span class="text-[9px] font-extrabold uppercase tracking-wide">{{ 'COMMUNITY.MOBILE_NAV.MESSAGES' | translate }}</span>
        </a>

        <!-- Profile -->
        <a [routerLink]="profileRoute()" routerLinkActive="text-primary"
          class="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-text-tertiary hover:text-primary transition-colors focus:outline-none"
          [attr.aria-label]="'COMMUNITY.MOBILE_NAV.PROFILE' | translate"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          <span class="text-[9px] font-extrabold uppercase tracking-wide">{{ 'COMMUNITY.MOBILE_NAV.PROFILE' | translate }}</span>
        </a>
      </div>
    </nav>

    <!-- Bottom padding spacer (prevents content hidden behind nav) -->
    <div class="md:hidden h-28"></div>
  `,
    styles: [`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `]
})
export class CommunityMobileNavComponent {
  @Output() onPost = new EventEmitter<void>();

  private auth = inject(AuthService);
  private router = inject(Router);

  profileRoute() {
    const user = this.auth.user();
    return user ? ['/community/users', user.id] : ['/login'];
  }
}
