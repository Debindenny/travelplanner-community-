import { Component, Input, signal, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, map, switchMap, takeUntil } from 'rxjs/operators';
import { CommunityNews, CommunityAd, TrendingHashtag, CommunityProfileService, MyCommunityProfile } from '../services/community-profile.service';
import { CommunityMessagesService } from '../services/community-messages.service';
import { CommunityProfileSummaryComponent } from './community-profile-summary.component';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../shared/utils/toast.service';
import { apiUrl } from '../../shared/utils/api-url';

interface EnrichedMatch {
  customerId: string;
  name: string;
  avatar: string | null;
  matchScore: number;
  preferredDestinations: string[];
  bio: string;
}

@Component({
    selector: 'app-community-sidebar',
    imports: [CommonModule, RouterModule, TranslatePipe, CommunityProfileSummaryComponent],
    template: `
    <!-- Signed-in user profile summary -->
    @if (user()) {
      <app-community-profile-summary class="mb-4" [profile]="myProfile()" [userId]="user()?.id ?? null" />
    }

    <!-- Traveler News -->
    <div class="bg-white/80 dark:bg-gray-800/90 backdrop-blur-md border border-slate-100/80 dark:border-gray-700/80 rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.02)] mb-4 hover:shadow-md transition-all duration-300">
      <div class="flex justify-between items-center mb-4 px-1">
        <h2 class="text-xs font-extrabold text-text-tertiary uppercase tracking-wider">{{ 'COMMUNITY.NEWS_TITLE' | translate }}</h2>
        <svg class="w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V6.75C3 6.129 3.504 5.625 4.125 5.625h9.75c.621 0 1.125.504 1.125 1.125v1.125m-10.5 0h1.5m2-3h7.5" /></svg>
      </div>

      <ul class="space-y-3.5">
        @for (item of displayedNews(); track item.id) {
        <li
          class="group select-none"
          [class.cursor-pointer]="!!item.link"
          (click)="openNewsLink(item)"
        >
          <div class="flex items-start gap-2.5">
            <div class="flex flex-col flex-1">
              <div>
                <span class="inline-block px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider mb-1"
                  [ngClass]="{
                    'bg-red-50 text-red-700 border border-red-100': item.bullet_color === 'bg-red-500',
                    'bg-emerald-50 text-emerald-700 border border-emerald-100': item.bullet_color === 'bg-emerald-500',
                    'bg-amber-50 text-amber-700 border border-amber-100': item.bullet_color === 'bg-amber-500',
                    'bg-blue-50 text-blue-700 border border-blue-100': item.bullet_color === 'bg-blue-500' || !item.bullet_color
                  }"
                >
                  {{ getCategoryName(item.bullet_color) }}
                </span>
              </div>
              <p class="font-bold text-xs text-text-primary line-clamp-2 leading-snug"
                [ngClass]="{ 'group-hover:text-primary': !!item.link, 'group-hover:underline': !!item.link }"
              >{{ item.title }}</p>
              <p class="text-2xs text-text-tertiary mt-1">{{ item.timeframe }} • {{ item.readers | number }} {{ 'COMMUNITY.READERS' | translate }}</p>
            </div>
          </div>
        </li>
        }
        @if (news.length === 0) {
          <li class="text-xs text-text-disabled text-center py-2">{{ 'COMMUNITY.NO_NEWS' | translate }}</li>
        }
      </ul>

      <button (click)="toggleShowAllNews()" class="mt-4 w-full text-xs font-bold text-text-secondary hover:text-primary hover:bg-slate-50 border border-slate-100 rounded-xl py-2 flex items-center justify-center gap-1 transition-colors">
        {{ (showAllNews ? 'COMMUNITY.SHOW_LESS' : 'COMMUNITY.SHOW_MORE') | translate }}
        <svg class="w-3.5 h-3.5 transition-transform" [class.rotate-180]="showAllNews" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
    </div>

    <!-- Trending Hashtags -->
    <div class="bg-white/80 dark:bg-gray-800/90 backdrop-blur-md border border-slate-100/80 dark:border-gray-700/80 rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.02)] mb-4 hover:shadow-md transition-all duration-300">
      <div class="flex justify-between items-center mb-3 px-1">
        <span class="text-[10.5px] font-extrabold tracking-[0.1em] text-text-tertiary uppercase">{{ 'COMMUNITY.TRENDING' | translate }}</span>
      </div>
      @if (isLoadingTags()) {
        <div class="flex flex-col gap-2.5">
          @for (i of [1, 2, 3]; track i) {
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-lg bg-slate-100 animate-pulse shrink-0"></div>
              <div class="flex-1 h-3 bg-slate-100 animate-pulse rounded"></div>
            </div>
          }
        </div>
      } @else if (trendingTags().length === 0) {
        <p class="text-xs text-text-disabled text-center py-2">{{ 'COMMUNITY.SIDEBAR.NO_TRENDING_TOPICS' | translate }}</p>
      } @else {
        <div class="flex flex-col gap-1">
          @for (tag of trendingTags(); track tag.name) {
            <button
              [routerLink]="['/community']"
              [queryParams]="{ mode: 'search', q: tag.name }"
              class="flex items-center gap-2.5 -mx-2 px-2 py-1.5 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors focus:outline-none"
            >
              <span class="w-9 h-9 rounded-lg bg-primary-50 text-primary flex items-center justify-center font-extrabold text-sm shrink-0">#</span>
              <span class="flex-1 min-w-0 flex flex-col">
                <span class="text-[13px] font-bold text-text-primary truncate">#{{ tag.name }}</span>
                <span class="text-[11.5px] font-semibold text-text-faint">{{ formatCount(tag.count) }}</span>
              </span>
            </button>
          }
        </div>
      }
    </div>

    <!-- Events -->
    <a
      routerLink="/community/events"
      class="flex items-center justify-between bg-white/80 dark:bg-gray-800/90 backdrop-blur-md border border-slate-100/80 dark:border-gray-700/80 rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.02)] mb-4 hover:shadow-md transition-all duration-300"
    >
      <span class="flex flex-col">
        <span class="text-[10.5px] font-extrabold tracking-[0.1em] text-text-tertiary uppercase mb-1">{{ 'COMMUNITY.SIDEBAR.EVENTS_LABEL' | translate }}</span>
        <span class="text-[13px] font-bold text-text-primary">{{ 'COMMUNITY.SIDEBAR.EVENTS_CTA' | translate }}</span>
      </span>
      <svg class="w-4 h-4 text-text-disabled shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
    </a>

    <!-- Travel Buddy Matchmaker Widget -->
    <div class="bg-white/80 dark:bg-gray-800/90 backdrop-blur-md border border-slate-100/80 dark:border-gray-700/80 rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.02)] mb-4 hover:shadow-md transition-all duration-300">
      <div class="flex justify-between items-center mb-3 px-1">
        <span class="text-[10.5px] font-extrabold tracking-[0.1em] text-text-tertiary uppercase">{{ 'COMMUNITY.TRAVEL_BUDDIES' | translate }}</span>
        @if (matches().length > 0) {
          <span class="text-[9px] font-black text-primary bg-primary-50 px-2 py-0.5 rounded-full border border-primary-subtle/50">{{ (matches().length === 1 ? 'COMMUNITY.SIDEBAR.MATCH_COUNT' : 'COMMUNITY.SIDEBAR.MATCH_COUNT_PLURAL') | translate: { n: matches().length } }}</span>
        }
      </div>

      @if (isLoadingMatches()) {
        <div class="flex flex-col gap-3">
          @for (i of [1, 2]; track i) {
            <div class="flex items-center gap-2.5 animate-pulse">
              <div class="w-9 h-9 rounded-full bg-slate-200 shrink-0"></div>
              <div class="flex-1 space-y-1.5">
                <div class="h-3 bg-slate-200 rounded w-3/4"></div>
                <div class="h-2.5 bg-slate-200 rounded w-1/2"></div>
              </div>
            </div>
          }
        </div>
      } @else if (matches().length === 0) {
        <div class="text-center py-4">
          <p class="text-2xs-plus text-text-secondary leading-relaxed mb-3">{{ 'COMMUNITY.SIDEBAR.NO_MATCHES_HINT' | translate }}</p>
          <a routerLink="/community/matching" class="inline-block bg-primary hover:bg-primary-hover text-white text-xs font-extrabold px-4 py-2 rounded-full transition-all shadow-sm hover:shadow-md">
            {{ 'COMMUNITY.SIDEBAR.FIND_TRAVEL_BUDDIES' | translate }}
          </a>
        </div>
      } @else {
        <div class="flex flex-col gap-3">
          @for (buddy of matches(); track buddy.customerId) {
            <div class="flex items-center gap-2.5">
              <a [routerLink]="['/community/users', buddy.customerId]" class="shrink-0" [attr.aria-label]="'COMMUNITY.HOME_SIDEBAR.SIMILAR_PROFILE' | translate">
                <img [src]="buddy.avatar || '/assets/images/default-avatar.svg'" class="w-9 h-9 rounded-full object-cover bg-slate-100 shrink-0 hover:opacity-80 transition-opacity" loading="lazy" decoding="async" />
              </a>
              <div class="flex-1 min-w-0 flex flex-col">
                <a [routerLink]="['/community/users', buddy.customerId]" class="text-[13px] font-bold text-text-primary truncate flex items-center gap-1.5 hover:text-primary hover:underline transition-colors">
                  {{ buddy.name || ('COMMUNITY.SIDEBAR.DEFAULT_TRAVELER_NAME' | translate) }}
                  <span class="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded shrink-0">{{ buddy.matchScore }}%</span>
                </a>
                <a [routerLink]="['/community/users', buddy.customerId]" class="text-[11.5px] font-semibold text-text-faint truncate hover:text-primary transition-colors">{{ (buddy.preferredDestinations || []).slice(0, 2).join(', ') || ('COMMUNITY.SIDEBAR.EXPLORING_EVERYWHERE' | translate) }}</a>
              </div>
              <button
                (click)="openBuddyMessage(buddy)"
                class="h-8 px-3.5 rounded-lg text-[11.5px] font-extrabold whitespace-nowrap border border-primary text-primary bg-white dark:bg-gray-800 hover:bg-primary hover:text-white transition-colors focus:outline-none shrink-0"
              >
                {{ 'COMMUNITY.SIDEBAR.CHAT' | translate }}
              </button>
            </div>
          }
        </div>
        <a routerLink="/community/matching" class="mt-3 block text-center text-xs font-bold text-primary hover:underline">{{ 'COMMUNITY.SIDEBAR.VIEW_ALL_MATCHES' | translate }}</a>
      }
    </div>

    <!-- Chat Popup Modal -->
    @if (selectedBuddy()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div class="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-2xl border border-slate-100 dark:border-gray-700 animate-fade-in-up text-slate-900 dark:text-slate-100">
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 pb-3 mb-3">
            <div class="flex items-center gap-2.5">
              <img [src]="selectedBuddy()?.avatar || '/assets/images/default-avatar.svg'" class="w-8 h-8 rounded-full object-cover shrink-0" loading="lazy" decoding="async" />
              <span class="font-extrabold text-sm text-text-primary">{{ 'COMMUNITY.SIDEBAR.CHAT_WITH' | translate: { name: selectedBuddy()?.name || ('COMMUNITY.SIDEBAR.DEFAULT_TRAVELER_NAME' | translate) } }}</span>
            </div>
            <button (click)="selectedBuddy.set(null)" class="text-text-tertiary hover:text-text-primary text-lg focus:outline-none">&times;</button>
          </div>
          <div class="bg-slate-50 dark:bg-gray-700/50 border border-slate-100 dark:border-gray-700 rounded-xl p-3 text-xs text-text-secondary mb-3 leading-normal">
            {{ 'COMMUNITY.SIDEBAR.MATCH_PREFIX' | translate }} <span class="font-extrabold text-emerald-600">{{ 'COMMUNITY.SIDEBAR.MATCH_PCT' | translate: { pct: selectedBuddy()?.matchScore } }}</span> {{ 'COMMUNITY.SIDEBAR.INTERESTED_IN' | translate: { destinations: (selectedBuddy()?.preferredDestinations || []).slice(0,2).join(', ') || ('COMMUNITY.SIDEBAR.TRAVEL_FALLBACK' | translate) } }}
          </div>

          <div class="h-48 overflow-y-auto mb-3 bg-gray-50 dark:bg-gray-700/50 border border-slate-100 dark:border-gray-700 rounded-xl p-3 space-y-2 flex flex-col">
            <p class="text-center text-2xs text-gray-400 font-bold mb-2 uppercase tracking-wide">
              {{ 'COMMUNITY.SIDEBAR.START_CHAT' | translate }}
            </p>
          </div>
          <textarea
            #chatMsg
            class="w-full border border-slate-200 dark:border-gray-600 rounded-xl p-3 text-xs focus:ring-4 focus:ring-primary/10 transition-all mb-3 text-slate-800 dark:text-slate-100 dark:bg-gray-900/40"
            rows="3"
            [placeholder]="'COMMUNITY.SIDEBAR.MESSAGE_PLACEHOLDER' | translate"
          ></textarea>
          <div class="flex justify-end gap-2">
            <button (click)="selectedBuddy.set(null)" class="px-4 py-2 text-xs text-text-secondary hover:bg-slate-100 dark:hover:bg-gray-700 rounded-xl font-bold transition-all">{{ 'COMMUNITY.SIDEBAR.CANCEL' | translate }}</button>
            <button (click)="sendBuddyMessage(chatMsg.value)" [disabled]="isSendingMessage()" class="px-5 py-2 text-xs bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-sm disabled:opacity-50">
              {{ (isSendingMessage() ? 'COMMUNITY.SIDEBAR.SENDING' : 'COMMUNITY.SIDEBAR.SEND_MESSAGE') | translate }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Ad block -->
    @if (currentAd()) {
      <div class="bg-gradient-to-tr from-slate-50 to-indigo-50/30 dark:from-gray-800/90 dark:to-indigo-950/30 border border-indigo-150/40 dark:border-indigo-900/40 backdrop-blur-md rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.01)] text-center mb-4 transition-all duration-500 hover:shadow-md">
        <p class="text-2xs text-text-tertiary font-extrabold flex justify-between items-center px-1 uppercase tracking-wider mb-3">
          <span>{{ 'COMMUNITY.AD_LABEL' | translate }}</span>
          <span class="text-text-disabled">●●●</span>
        </p>
        <p class="text-2xs font-extrabold text-text-tertiary uppercase tracking-wider mb-2 text-left">{{ currentAd()?.tagline }}</p>
        <div class="flex items-center gap-3 bg-white/60 dark:bg-gray-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-gray-700 shadow-sm mb-3 text-left">
          <img [src]="currentAd()?.sponsor_avatar || '/assets/images/default-avatar.svg'" class="w-10 h-10 rounded-xl object-cover border border-white dark:border-gray-700 bg-slate-50 dark:bg-gray-800 shadow-sm shrink-0" loading="lazy" decoding="async" />
          <div class="min-w-0">
            <p class="text-xs font-extrabold text-text-primary truncate">{{ currentAd()?.sponsor_name }}</p>
            <p class="text-2xs text-text-secondary truncate mt-0.5 leading-snug">{{ currentAd()?.body }}</p>
          </div>
        </div>
        <button
          (click)="openAdLink()"
          class="w-full bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-700 text-white rounded-xl py-2 text-xs font-bold shadow-sm hover:shadow-md transition-all"
        >
          {{ currentAd()?.button_text }}
        </button>
      </div>
    }

    <!-- Footer links -->
    <div class="text-center px-2 py-2">
      <div class="flex flex-wrap justify-center gap-x-2.5 gap-y-1 text-2xs-plus font-bold text-text-tertiary">
        <a routerLink="/about" class="hover:underline hover:text-primary transition-colors">{{ 'COMMUNITY.FOOTER_ABOUT' | translate }}</a>
        <span class="text-text-disabled select-none">•</span>
        <a routerLink="/accessibility" class="hover:underline hover:text-primary transition-colors">{{ 'COMMUNITY.FOOTER_ACCESSIBILITY' | translate }}</a>
        <span class="text-text-disabled select-none">•</span>
        <a routerLink="/help" class="hover:underline hover:text-primary transition-colors">{{ 'COMMUNITY.FOOTER_HELP' | translate }}</a>
        <span class="text-text-disabled select-none">•</span>
        <a routerLink="/privacy" class="hover:underline hover:text-primary transition-colors">{{ 'COMMUNITY.FOOTER_PRIVACY' | translate }}</a>
        <span class="text-text-disabled select-none">•</span>
        <a routerLink="/ad-choices" class="hover:underline hover:text-primary transition-colors">{{ 'COMMUNITY.FOOTER_AD_CHOICES' | translate }}</a>
      </div>
      <p class="text-2xs text-text-disabled mt-2 uppercase tracking-wider font-extrabold">{{ 'COMMUNITY.FOOTER_COPYRIGHT' | translate }}</p>
    </div>
  `
})
export class CommunitySidebarComponent implements OnInit, OnDestroy {
  private readonly toast = inject(ToastService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly messagesService = inject(CommunityMessagesService);
  private readonly translate = inject(TranslateService);
  private readonly profileService = inject(CommunityProfileService);
  private readonly auth = inject(AuthService);
  private readonly destroy$ = new Subject<void>();

  readonly user = this.auth.user;
  readonly myProfile = signal<MyCommunityProfile | null>(null);

  @Input() set newsList(val: CommunityNews[]) {
    this.news = val || [];
    this.updateDisplayedNews();
  }

  @Input() set ad(val: CommunityAd | null) {
    this.currentAd.set(val ?? null);
  }

  news: CommunityNews[] = [];
  displayedNews = signal<CommunityNews[]>([]);
  selectedBuddy = signal<EnrichedMatch | null>(null);
  isSendingMessage = signal(false);

  trendingTags = signal<TrendingHashtag[]>([]);
  isLoadingTags = signal(true);

  matches = signal<EnrichedMatch[]>([]);
  isLoadingMatches = signal(true);

  currentAd = signal<CommunityAd | null>(null);
  showAllNews = false;

  ngOnInit() {
    this.loadTrendingTags();
    this.loadMatches();
    if (this.auth.user()) {
      this.profileService.getMyProfile().pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: p => this.myProfile.set(p),
        error: () => {}
      });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTrendingTags() {
    this.http.get<TrendingHashtag[]>(apiUrl('/community/hashtags/trending?limit=8')).pipe(
      catchError(() => of([] as TrendingHashtag[])),
      takeUntil(this.destroy$)
    ).subscribe(tags => {
      this.trendingTags.set(tags);
      this.isLoadingTags.set(false);
    });
  }

  private loadMatches() {
    this.http.get<any[]>(apiUrl('/matching/matches')).pipe(
      switchMap(matches => {
        if (!matches?.length) return of([] as EnrichedMatch[]);
        const top = matches.slice(0, 3);
        return forkJoin(
          top.map(m =>
            this.http.get<any>(apiUrl(`/community/users/${m.customerId}`)).pipe(
              map(profile => ({
                customerId: m.customerId,
                name: profile.name || this.translate.instant('COMMUNITY.SIDEBAR.DEFAULT_TRAVELER_NAME'),
                avatar: profile.avatar ?? null,
                matchScore: Math.round(m.matchScore),
                preferredDestinations: m.preferredDestinations || [],
                bio: m.bio || '',
              })),
              catchError(() => of({
                customerId: m.customerId,
                name: this.translate.instant('COMMUNITY.SIDEBAR.DEFAULT_TRAVELER_NAME'),
                avatar: null,
                matchScore: Math.round(m.matchScore),
                preferredDestinations: m.preferredDestinations || [],
                bio: m.bio || '',
              } as EnrichedMatch))
            )
          )
        );
      }),
      catchError(() => of([] as EnrichedMatch[])),
      takeUntil(this.destroy$)
    ).subscribe(enriched => {
      this.matches.set(enriched);
      this.isLoadingMatches.set(false);
    });
  }

  openBuddyMessage(buddy: EnrichedMatch) {
    this.selectedBuddy.set(buddy);
  }

  sendBuddyMessage(message: string) {
    if (!message.trim()) return;
    const buddy = this.selectedBuddy();
    if (!buddy) return;

    this.isSendingMessage.set(true);
    this.messagesService.sendMessage(buddy.customerId, message.trim()).subscribe({
      next: () => {
        this.isSendingMessage.set(false);
        this.selectedBuddy.set(null);
        this.router.navigate(['/community/messages']);
      },
      error: () => {
        this.isSendingMessage.set(false);
        this.toast.error(this.translate.instant('COMMUNITY.SIDEBAR.SEND_MESSAGE_ERROR'));
      }
    });
  }

  openNewsLink(item: CommunityNews) {
    if (item.link) {
      window.open(item.link, '_blank', 'noopener,noreferrer');
    }
  }

  openAdLink() {
    const url = this.currentAd()?.click_url;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  toggleShowAllNews() {
    this.showAllNews = !this.showAllNews;
    this.updateDisplayedNews();
  }

  getCategoryName(bulletColor: string): string {
    switch (bulletColor) {
      case 'bg-red-500': return this.translate.instant('COMMUNITY.SIDEBAR.CATEGORY_ALERT');
      case 'bg-emerald-500': return this.translate.instant('COMMUNITY.SIDEBAR.CATEGORY_GUIDE');
      case 'bg-amber-500': return this.translate.instant('COMMUNITY.SIDEBAR.CATEGORY_DEAL');
      case 'bg-blue-500': return this.translate.instant('COMMUNITY.SIDEBAR.CATEGORY_TRENDS');
      default: return this.translate.instant('COMMUNITY.SIDEBAR.CATEGORY_NEWS');
    }
  }

  formatCount(count: number): string {
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return String(count);
  }

  private updateDisplayedNews() {
    this.displayedNews.set(this.showAllNews ? this.news : this.news.slice(0, 3));
  }
}
