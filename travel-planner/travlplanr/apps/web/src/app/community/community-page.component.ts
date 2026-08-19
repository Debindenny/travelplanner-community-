import { Component, OnInit, inject, signal, ViewChild, ElementRef, AfterViewInit, OnDestroy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommunityStoriesBarComponent } from './components/community-stories-bar.component';
import { CommunitySidebarComponent } from './components/community-sidebar.component';
import { CommunityFeedSkeletonComponent } from './components/community-feed-skeleton.component';
import { CommunityPostCommentsComponent } from './components/community-post-comments.component';
import { CommunityPostService, CommunityPost as CommunityPostType } from './services/community-post.service';
import { CommunityCreatePostComponent } from './components/community-create-post.component';
import { CommunityPostCardComponent } from './components/community-post-card.component';
import { CommunitySaveModalComponent } from './components/community-save-modal.component';
import { CommunityMapComponent } from './components/community-map.component';
import { CommunityHeroComponent } from './components/community-hero.component';
import { apiErrorMessage } from '../shared/utils/api-error.util';
import { CommunityMobileNavComponent } from './components/community-mobile-nav.component';
import { CommunityCollectionService, CommunityCollection } from './services/community-collection.service';
import { CommunityAnalyticsService } from './services/community-analytics.service';
import { CommunityOnboardingComponent } from './components/community-onboarding.component';
import { AuthService } from '../auth/auth.service';
import { CommunityProfileService, MyCommunityProfile, CommunityNews, CommunityAd, CommunityShortcut } from './services/community-profile.service';
import { CommunityNotificationsService } from './services/community-notifications.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ThemeService } from 'ui';
import { CommunityAchievementsComponent } from './components/community-achievements.component';
import { CommunityQaThreadComponent } from './components/community-qa-thread.component';

@Component({
    selector: 'app-community-page',
    imports: [CommonModule, RouterLink, CommunityCreatePostComponent, CommunityStoriesBarComponent, CommunityPostCardComponent, CommunitySaveModalComponent, CommunityMapComponent, CommunityHeroComponent, CommunityMobileNavComponent, CommunityOnboardingComponent, TranslatePipe, CommunitySidebarComponent, CommunityFeedSkeletonComponent, CommunityPostCommentsComponent, CommunityAchievementsComponent, CommunityQaThreadComponent],
    template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 flex flex-col pb-0 md:pb-0">
      <app-community-mobile-nav (onPost)="scrollToCreatePost()" />
      <!-- Dark mode is currently rolled out to community + itinerary map only (see DESIGN_ENHANCEMENT_PLAN.md). -->
      <button
        type="button"
        (click)="theme.toggle()"
        class="fixed top-20 right-4 z-40 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-slate-200/80 dark:border-gray-700 shadow-sm flex items-center justify-center text-text-secondary dark:text-gray-300 hover:text-primary transition-colors"
        [attr.aria-label]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
      >
        @if (theme.isDark()) {
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
        } @else {
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
        }
      </button>
      <main class="flex-1 flex justify-center py-8 px-4 sm:px-6">
        <div class="w-full max-w-6xl grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-6 items-start">
          
          <!-- LEFT COLUMN (Profile & Shortcuts) -->
          <div class="hidden md:block md:col-span-1 lg:col-span-3 space-y-4 sticky top-[92px]">
            <!-- Profile Card -->
            <div class="bg-white/80 dark:bg-gray-800/90 backdrop-blur-md border border-slate-100/80 dark:border-gray-700/80 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative text-center">
              <div class="h-20 bg-gradient-to-tr from-indigo-600 via-purple-500 to-pink-500"></div>
              <div class="px-4 pb-4">
                <a [routerLink]="myProfile()?.customer_id ? ['/community/users', myProfile()!.customer_id] : null" class="mx-auto w-20 h-20 rounded-full border-4 border-white dark:border-gray-800 -mt-10 overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center shadow-md relative group block">
                  <img [src]="myProfile()?.avatar || '/assets/images/default-avatar.svg'" [alt]="'COMMUNITY.AVATAR_ALT' | translate" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </a>
                <h2 [routerLink]="myProfile()?.customer_id ? ['/community/users', myProfile()!.customer_id] : null" class="mt-3 text-sm-plus font-extrabold text-text-primary leading-tight flex items-center justify-center gap-1.5 flex-wrap cursor-pointer hover:text-primary transition-colors">
                  {{ myProfile()?.name || user()?.email?.split('@')?.[0] || ('COMMUNITY.DEFAULT_NAME' | translate) }}
                  @if (myProfile()?.is_verified) {
                    <span class="text-primary cursor-help flex items-center" [title]="'COMMUNITY.VERIFIED_BADGE' | translate">
                      <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L9 10.586l3.293-3.293a1 1 0 111.414 1.414z" clip-rule="evenodd" fill-rule="evenodd"></path>
                      </svg>
                    </span>
                  }
                </h2>
                <p class="text-xs text-text-secondary mt-1.5 line-clamp-2 px-2">{{ myProfile()?.bio || ('COMMUNITY.DEFAULT_BIO' | translate) }}</p>
                @if (myProfile()?.countries_visited) {
                  <div class="mt-2.5">
                    <span class="inline-block bg-amber-50 text-amber-750 text-2xs px-2.5 py-0.5 rounded-full font-bold border border-amber-200/50 shadow-sm transition-all hover:scale-105 active:scale-95 duration-200 cursor-default select-none animate-[pulse_2s_infinite]">
                      🎒 {{ 'COMMUNITY.COUNTRIES_VISITED' | translate: { count: animatedCountriesVisited() } }}
                    </span>
                  </div>
                }
              </div>
              
              <div class="border-t border-slate-100/80 dark:border-gray-700/80 py-2 text-left space-y-0.5 px-1.5">
                <a [routerLink]="myProfile()?.customer_id ? ['/community/users', myProfile()!.customer_id] : null" class="px-3 py-2 flex justify-between items-center text-xs font-semibold text-text-secondary hover:bg-slate-50/50 rounded-lg transition-colors cursor-pointer">
                  <span class="flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-text-tertiary" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    {{ 'COMMUNITY.PROFILE_VIEWERS' | translate }}
                  </span>
                  <span class="text-primary font-bold transition-all duration-300">{{ animatedProfileViews() }}</span>
                </a>
                <a [routerLink]="myProfile()?.customer_id ? ['/community/users', myProfile()!.customer_id] : null" class="px-3 py-2 flex justify-between items-center text-xs font-semibold text-text-secondary hover:bg-slate-50/50 rounded-lg transition-colors cursor-pointer">
                  <span class="flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-text-tertiary" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                    {{ 'COMMUNITY.FOLLOWERS' | translate }}
                  </span>
                  <span class="text-primary font-bold transition-all duration-300">{{ animatedFollowers() }}</span>
                </a>
              </div>
              
              <div class="border-t border-slate-100/80 dark:border-gray-700/80 p-3">
                <a routerLink="/community/collections" class="flex items-center justify-between text-xs font-bold text-text-secondary hover:text-primary transition-colors mb-2">
                  <span class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                    {{ 'COMMUNITY.SAVED_ITEMS' | translate }}
                    @if (collectionsPreview().length) {
                      <span class="bg-primary-50 text-primary text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-primary-subtle/40">{{ collectionsPreview().length }}</span>
                    }
                  </span>
                  <svg class="w-3.5 h-3.5 text-text-disabled" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                </a>
                @if (collectionsPreview().length) {
                  <div class="flex gap-1.5">
                    @for (col of collectionsPreview(); track col.id) {
                      <a [routerLink]="['/community/collections', col.id]" class="relative flex-1 h-12 rounded-lg overflow-hidden border border-slate-100 hover:border-primary/40 transition-colors group">
                        @if (col.cover_image) {
                          <img [src]="col.cover_image" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="" loading="lazy" decoding="async" />
                        } @else {
                          <div class="w-full h-full bg-gradient-to-br from-primary-50 to-indigo-50 flex items-center justify-center">
                            <svg class="w-4 h-4 text-primary/40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                          </div>
                        }
                        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                          <p class="text-[8px] text-white font-bold truncate">{{ col.name }}</p>
                        </div>
                      </a>
                    }
                  </div>
                }
              </div>
              
              <div routerLink="/community/reels" class="border-t border-slate-100/80 dark:border-gray-700/80 p-3 text-left hover:bg-slate-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer flex items-center justify-between group">
                <div class="flex items-center gap-2.5 text-xs font-bold text-text-secondary group-hover:text-primary transition-colors">
                  <svg class="w-4 h-4 text-text-tertiary group-hover:text-primary transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  {{ 'COMMUNITY.WATCH_REELS' | translate }}
                </div>
                <svg class="w-3.5 h-3.5 text-text-disabled group-hover:text-primary transition-all translate-x-0 group-hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              </div>
              
              <div routerLink="/community/travel-circles" class="border-t border-slate-100/80 dark:border-gray-700/80 p-3 text-left hover:bg-slate-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer flex items-center justify-between group">
                <div class="flex items-center gap-2.5 text-xs font-bold text-text-secondary group-hover:text-primary transition-colors">
                  <svg class="w-4 h-4 text-text-tertiary group-hover:text-primary transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                  Travel Circles
                </div>
                <svg class="w-3.5 h-3.5 text-text-disabled group-hover:text-primary transition-all translate-x-0 group-hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              </div>

              <div routerLink="/community/spaces" class="border-t border-slate-100/80 dark:border-gray-700/80 p-3 text-left hover:bg-slate-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer flex items-center justify-between group">
                <div class="flex items-center gap-2.5 text-xs font-bold text-text-secondary group-hover:text-primary transition-colors">
                  <span class="w-4 text-center">🏘️</span>
                  <span>Travel Spaces</span>
                </div>
                <svg class="w-3.5 h-3.5 text-text-disabled group-hover:text-primary transition-all translate-x-0 group-hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              </div>

              <div routerLink="/community/events" class="border-t border-slate-100/80 dark:border-gray-700/80 p-3 text-left hover:bg-slate-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer flex items-center justify-between group">
                <div class="flex items-center gap-2.5 text-xs font-bold text-text-secondary group-hover:text-primary transition-colors">
                  <span class="w-4 text-center">📅</span>
                  <span>Events & Meetups</span>
                </div>
                <svg class="w-3.5 h-3.5 text-text-disabled group-hover:text-primary transition-all translate-x-0 group-hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              </div>

              <div routerLink="/community/trips" class="border-t border-slate-100/80 dark:border-gray-700/80 p-3 text-left hover:bg-slate-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer flex items-center justify-between group">
                <div class="flex items-center gap-2.5 text-xs font-bold text-text-secondary group-hover:text-primary transition-colors">
                  <span class="w-4 text-center">🧳</span>
                  <span>Trips</span>
                </div>
                <svg class="w-3.5 h-3.5 text-text-disabled group-hover:text-primary transition-all translate-x-0 group-hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              </div>

              <div routerLink="/community/leaderboard" class="border-t border-slate-100/80 dark:border-gray-700/80 p-3 text-left hover:bg-slate-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer flex items-center justify-between group">
                <div class="flex items-center gap-2.5 text-xs font-bold text-text-secondary group-hover:text-primary transition-colors">
                  <span class="w-4 text-center">🏅</span>
                  <span>Leaderboard</span>
                </div>
                <svg class="w-3.5 h-3.5 text-text-disabled group-hover:text-primary transition-all translate-x-0 group-hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              </div>

              <div routerLink="/community/guidelines" class="border-t border-slate-100/80 dark:border-gray-700/80 p-3 text-left hover:bg-slate-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer flex items-center justify-between group">
                <div class="flex items-center gap-2.5 text-xs font-bold text-text-secondary group-hover:text-primary transition-colors">
                  <span class="w-4 text-center">🛡️</span>
                  <span>Guidelines</span>
                </div>
                <svg class="w-3.5 h-3.5 text-text-disabled group-hover:text-primary transition-all translate-x-0 group-hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              </div>

              <div routerLink="/community/notification-preferences" class="border-t border-slate-100/80 dark:border-gray-700/80 p-3 text-left hover:bg-slate-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer flex items-center justify-between group">
                <div class="flex items-center gap-2.5 text-xs font-bold text-text-secondary group-hover:text-primary transition-colors">
                  <span class="w-4 text-center">⚙️</span>
                  <span>Notification Settings</span>
                </div>
                <svg class="w-3.5 h-3.5 text-text-disabled group-hover:text-primary transition-all translate-x-0 group-hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              </div>
            </div>

            <!-- Achievements & Challenges checklist -->
            @if (user()) {
              <app-community-achievements />
            }

            <!-- Onboarding checklist (logged-in users only) -->
            @if (user()) {
              <app-community-onboarding [onPostClick]="scrollToCreatePost.bind(this)" />
            }

            <!-- Shortcuts Card -->
            <div class="bg-white/80 dark:bg-gray-800/90 backdrop-blur-md border border-slate-100/80 dark:border-gray-700/80 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-4 hidden lg:block">
              <h3 class="text-2xs font-extrabold text-text-tertiary uppercase tracking-wider mb-3 px-1">{{ 'COMMUNITY.SHORTCUTS_LABEL' | translate }}</h3>
              <div class="space-y-1">
                @for (shortcut of shortcuts(); track shortcut.id) {
                  <a [routerLink]="shortcut.url" class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-text-secondary hover:text-primary hover:bg-primary-50/50 transition-all">
                    <span class="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0"></span>
                    <span class="truncate">{{ shortcut.title }}</span>
                  </a>
                }
                @if (shortcuts().length === 0) {
                  <div class="text-xs text-text-disabled text-center py-2">{{ 'COMMUNITY.NO_SHORTCUTS' | translate }}</div>
                }
              </div>
            </div>
          </div>

          <!-- CENTER COLUMN (Feed) -->
          <div class="col-span-1 md:col-span-3 lg:col-span-6 space-y-5">

            <!-- Hero band -->
            <app-community-hero
              (onPost)="scrollToCreatePost()"
              (onMap)="setViewMode('map')"
            />

            <!-- Stories (edge-to-edge, no extra card wrapper) -->
            <div class="bg-white/80 dark:bg-gray-800/90 backdrop-blur-md border border-slate-100/80 dark:border-gray-700/80 rounded-2xl px-2 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <app-community-stories-bar />
            </div>

            <!-- Create a Post -->
            <div #createPostAnchor>
              <app-community-create-post
                [userAvatar]="myProfile()?.avatar ?? undefined"
                (postCreated)="onPostCreated($event)"
              />
            </div>

            <!-- Feed Filter Chips + View Toggle -->
            <div class="flex items-center gap-2 flex-wrap">
              <!-- Feed mode chips -->
              <button
                (click)="setFeedMode('following')"
                class="px-3 py-1.5 rounded-full text-xs font-bold transition-all focus:outline-none border"
                [ngClass]="feedMode() === 'following' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-200 dark:border-gray-700'"
              >{{ 'COMMUNITY.FOLLOWING' | translate }}</button>
              <button
                (click)="setFeedMode('discover')"
                class="px-3 py-1.5 rounded-full text-xs font-bold transition-all focus:outline-none border"
                [ngClass]="feedMode() === 'discover' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-200 dark:border-gray-700'"
              >{{ 'COMMUNITY.DISCOVER' | translate }}</button>
              @for (tag of followedTags(); track tag) {
                <button
                  (click)="setFeedMode('hashtag-' + tag)"
                  class="px-3 py-1.5 rounded-full text-xs font-bold transition-all focus:outline-none border"
                  [ngClass]="feedMode() === 'hashtag-' + tag ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-200 dark:border-gray-700'"
                >#{{ tag }}</button>
              }
              <!-- Spacer -->
              <div class="flex-1"></div>
              <!-- View mode toggle -->
              <div class="relative flex bg-slate-100/80 dark:bg-gray-800/80 p-0.5 rounded-full border border-slate-200/50 dark:border-gray-700/50 shadow-inner">
                <div
                  class="absolute top-0.5 bottom-0.5 rounded-full bg-primary shadow-sm transition-all duration-300 ease-out"
                  [style.width]="'50%'"
                  [style.left]="viewMode === 'feed' ? '2px' : 'calc(50% - 2px)'"
                ></div>
                <button
                  (click)="setViewMode('feed')"
                  class="relative z-10 px-3 py-1 text-2xs-plus font-bold uppercase tracking-wide rounded-full transition-colors duration-200 focus:outline-none"
                  [class.text-white]="viewMode === 'feed'"
                  [class.text-text-secondary]="viewMode !== 'feed'"
                >{{ 'COMMUNITY.FEED' | translate }}</button>
                <button
                  (click)="setViewMode('map')"
                  class="relative z-10 px-3 py-1 text-2xs-plus font-bold uppercase tracking-wide rounded-full transition-colors duration-200 focus:outline-none"
                  [class.text-white]="viewMode === 'map'"
                  [class.text-text-secondary]="viewMode !== 'map'"
                >{{ 'COMMUNITY.MAP_VIEW' | translate }}</button>
              </div>
            </div>

            @if (viewMode === 'feed') {
              
              @if (feedMode().startsWith('hashtag-') && !followedTags().includes(feedMode().replace('hashtag-', ''))) {
                <div class="flex items-center justify-between bg-primary-50 border border-primary-subtle/50 px-4 py-3 rounded-xl text-sm shadow-sm animate-fade-in-up">
                  <span class="text-primary font-semibold">{{ 'COMMUNITY.FILTERING_BY' | translate: { tag: feedMode().replace('hashtag-', '') } }}</span>
                  <button (click)="clearHashtagFilter()" class="text-primary hover:text-primary-hover font-bold text-xs bg-white dark:bg-gray-800 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-gray-700 shadow-sm transition-all hover:scale-105 active:scale-95">{{ 'COMMUNITY.CLEAR' | translate }}</button>
                </div>
              }

              <!-- Live Feed Updates Pill -->
              @if (newPostsCount() > 0) {
                <div class="fixed top-[100px] left-1/2 transform -translate-x-1/2 z-40">
                  <button (click)="loadNewPosts()" class="bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-700 text-white font-bold py-2.5 px-6 rounded-full shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95">
                    <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    {{ (newPostsCount() === 1 ? 'COMMUNITY.NEW_POST' : 'COMMUNITY.NEW_POSTS') | translate: { n: newPostsCount() } }}
                  </button>
                </div>
              }
              
              <!-- Feed Skeletons -->
              @if (isLoadingFeed) {
                @for (i of [1, 2, 3]; track i) {
                  <app-community-feed-skeleton />
                }
              }

              @if (errorLoadingFeed) {
                <div class="bg-danger-50 border border-red-200 rounded-2xl p-8 shadow-sm text-center mb-4 transition-all animate-fade-in-up">
                  <svg class="w-12 h-12 text-danger-500/80 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 class="text-red-950 font-bold mb-1">{{ 'COMMUNITY.FEED_ERROR_TITLE' | translate }}</h3>
                  <p class="text-danger text-sm mb-4">{{ 'COMMUNITY.FEED_ERROR_BODY' | translate }}</p>
                  <button (click)="loadPosts(false)" class="bg-red-100 hover:bg-red-200 text-danger hover:text-danger-hover font-semibold py-2 px-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-400">
                    {{ 'COMMUNITY.RETRY' | translate }}
                  </button>
                </div>
              }
              
              @if (posts.length === 0 && !isLoadingFeed && !errorLoadingFeed) {
                @if (feedMode() === 'following') {
                  <!-- Following empty: suggest switching to Discover -->
                  <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-8 shadow-sm text-center animate-fade-in-up">
                    <div class="w-14 h-14 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg class="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </div>
                    <h3 class="text-text-primary font-extrabold mb-1 text-base">{{ 'COMMUNITY.EMPTY_FOLLOWING_TITLE' | translate }}</h3>
                    <p class="text-text-tertiary text-sm mb-4">{{ 'COMMUNITY.EMPTY_FOLLOWING_BODY' | translate }}</p>
                    <button (click)="setFeedMode('discover')" class="inline-block bg-primary hover:bg-primary-hover text-white font-bold px-5 py-2 rounded-full transition-colors text-sm shadow-sm">
                      {{ 'COMMUNITY.DISCOVER_TRAVELERS' | translate }}
                    </button>
                  </div>
                } @else if (feedMode() === 'discover') {
                  <!-- Discover empty: trending destinations -->
                  <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-8 shadow-sm text-center animate-fade-in-up">
                    <div class="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg class="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"/></svg>
                    </div>
                    <h3 class="text-text-primary font-extrabold mb-1 text-base">{{ 'COMMUNITY.EMPTY_DISCOVER_TITLE' | translate }}</h3>
                    <p class="text-text-tertiary text-sm mb-4">{{ 'COMMUNITY.EMPTY_DISCOVER_BODY' | translate }}</p>
                    <button (click)="scrollToCreatePost()" class="inline-block bg-primary hover:bg-primary-hover text-white font-bold px-5 py-2 rounded-full transition-colors text-sm shadow-sm">
                      {{ 'COMMUNITY.SHARE_YOUR_JOURNEY' | translate }}
                    </button>
                  </div>
                } @else {
                  <!-- Hashtag empty -->
                  <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-8 shadow-sm text-center animate-fade-in-up">
                    <div class="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span class="text-2xl font-black text-primary">#</span>
                    </div>
                    <h3 class="text-text-primary font-extrabold mb-1 text-base">{{ 'COMMUNITY.EMPTY_HASHTAG_TITLE' | translate: { tag: feedMode().replace('hashtag-', '') } }}</h3>
                    <p class="text-text-tertiary text-sm mb-4">{{ 'COMMUNITY.EMPTY_HASHTAG_BODY' | translate }}</p>
                    <button (click)="scrollToCreatePost()" class="inline-block bg-primary hover:bg-primary-hover text-white font-bold px-5 py-2 rounded-full transition-colors text-sm shadow-sm">
                      {{ 'COMMUNITY.CREATE_A_POST' | translate }}
                    </button>
                  </div>
                }
              }

              <!-- Posts -->
              @for (post of posts; track post.id; let i = $index) {
                <div class="animate-fade-in-up" [style.animation-delay]="getPostAnimationDelay(i)">
                  <app-community-post-card 
                    [post]="post"
                    (onToggleFollow)="toggleFollow($event)"
                    (onSave)="openSaveModal($event)"
                    (onToggleCommentsView)="toggleCommentsView($event)"
                    (onCloneTrip)="cloneTrip($event)"
                    (onPostDeleted)="removePost($event)"
                  >
                    <!-- Comments Section -->
                    @if (expandedComments.has(post.id)) {
                      @if (post.type === 'qa') {
                        <app-community-qa-thread 
                          [postId]="post.id"
                          [isPostAuthor]="post.author?.id === auth.user()?.id"
                        />
                      } @else {
                        <app-community-post-comments 
                          [postId]="post.id" 
                          [myAvatar]="myProfile()?.avatar || null"
                          (commentAdded)="onCommentAdded(post.id)"
                        />
                      }
                    }
                  </app-community-post-card>
                </div>
              }

              <!-- Infinite Scroll Sentinel -->
              @if (isLoadingFeed) {
                <div class="flex justify-center py-6">
                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              } @else {
                <div #scrollSentinel class="h-4"></div>
              }
            } @else {
              <!-- Map View -->
              <div class="animate-fade-in-up">
                <app-community-map [posts]="posts" />
              </div>
            }
          </div>

          <!-- RIGHT COLUMN (News & Ads) -->
          <div class="hidden lg:block lg:col-span-3 space-y-4 sticky top-[92px]">
            <app-community-sidebar [newsList]="news()" [ad]="ads()" />
          </div>

        </div>
      </main>



      @if (savePostId) {
        <app-community-save-modal
          [postId]="savePostId"
          (closed)="savePostId = null"
          (saved)="onPostSaved($event)"
          (error)="onPostSaved($event)"
        />
      }

      @if (toastMessage()) {
        <div class="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded shadow-lg transition-opacity z-50">
          {{ toastMessage() }}
        </div>
      }

      <footer class="py-6 text-center">
        <div class="flex flex-wrap justify-center gap-x-4 gap-y-1 text-2xs-plus font-bold text-text-tertiary">
          <a routerLink="/about" class="hover:text-primary hover:underline transition-colors">{{ 'COMMUNITY.FOOTER_ABOUT' | translate }}</a>
          <a routerLink="/help" class="hover:text-primary hover:underline transition-colors">{{ 'COMMUNITY.FOOTER_HELP' | translate }}</a>
          <a routerLink="/privacy" class="hover:text-primary hover:underline transition-colors">{{ 'COMMUNITY.FOOTER_PRIVACY' | translate }}</a>
          <a routerLink="/terms" class="hover:text-primary hover:underline transition-colors">{{ 'COMMUNITY.FOOTER_TERMS' | translate }}</a>
        </div>
        <p class="text-2xs text-text-disabled mt-1.5 uppercase tracking-wider font-bold">{{ 'COMMUNITY.FOOTER_COPYRIGHT' | translate }}</p>
      </footer>
    </div>
  `,
    styles: []
})
export class CommunityPageComponent implements OnInit, AfterViewInit, OnDestroy {
  myProfile = signal<MyCommunityProfile | null>(null);
  animatedProfileViews = signal<number>(0);
  animatedFollowers = signal<number>(0);
  animatedCountriesVisited = signal<number>(0);
  news = signal<CommunityNews[]>([]);
  ads = signal<CommunityAd | null>(null);
  shortcuts = signal<CommunityShortcut[]>([]);
  profileService = inject(CommunityProfileService);
  notificationsService = inject(CommunityNotificationsService);
  posts: CommunityPostType[] = [];
  showCreatePostModal = false;
  isLoadingFeed = false;
  errorLoadingFeed = false;
  viewMode: 'feed' | 'map' = 'feed';
  savePostId: string | null = null;

  toastMessage = signal<string | null>(null);

  expandedComments = new Set<string>();
  newPostsCount = signal<number>(0);

  readonly auth = inject(AuthService);
  readonly user = this.auth.user;

  feedMode = signal<string>('following');
  followedTags = signal<string[]>([]);
  collectionsPreview = signal<CommunityCollection[]>([]);
  activeReactionPostId = signal<string | null>(null);

  @ViewChild('scrollSentinel') scrollSentinel?: ElementRef;
  @ViewChild('createPostAnchor') createPostAnchor?: ElementRef;
  private observer: IntersectionObserver | null = null;
  private statAnimationTimers: ReturnType<typeof setInterval>[] = [];
  nextCursor?: string;
  hasMorePosts = true;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private wsSub?: Subscription;
  private destroyRef = inject(DestroyRef);
  /** Avoid re-navigating when applying state from the URL (back/forward). */
  private syncingFromUrl = false;

  private readonly translate = inject(TranslateService);
  readonly theme = inject(ThemeService);

  constructor(
    private postService: CommunityPostService,
    private collectionService: CommunityCollectionService,
    private analytics: CommunityAnalyticsService
  ) {}

  ngOnInit() {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      if (!this.syncingFromUrl) {
        this.applyStateFromQueryParams(params);
      }
      this.loadPosts(true);
      this.loadWidgets();
    });

    // Connect WebSocket
    const activeUser = this.auth.user();
    if (activeUser) {
      this.wsSub = this.notificationsService.wsMessages$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (msg) => {
          if (msg.type === 'notification') {
            this.showToast(this.translate.instant('COMMUNITY.TOAST_NEW_NOTIFICATION', { message: msg.payload?.message }));
            this.loadWidgets(); // refresh counts
          } else if (msg.type === 'message') {
            this.showToast(this.translate.instant('COMMUNITY.TOAST_NEW_DM', { content: msg.payload?.content }));
          } else if (msg.type === 'new_post') {
            this.newPostsCount.update(c => c + 1);
          }
        }
      });
    }
  }

  ngAfterViewInit() {
    this.setupIntersectionObserver();
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.wsSub) {
      this.wsSub.unsubscribe();
    }
    this.statAnimationTimers.forEach(timer => clearInterval(timer));
    this.statAnimationTimers = [];
  }

  setupIntersectionObserver() {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !this.isLoadingFeed && this.hasMorePosts && this.posts.length > 0) {
        this.loadPosts(false);
      }
    }, { rootMargin: '200px' });
    
    setTimeout(() => {
      if (this.scrollSentinel?.nativeElement) {
        this.observer?.observe(this.scrollSentinel.nativeElement);
      }
    }, 500);
  }

  setFeedMode(mode: string) {
    const queryParams: Record<string, string | null> = { ...this.route.snapshot.queryParams };
    if (mode.startsWith('hashtag-')) {
      queryParams['mode'] = 'search';
      queryParams['q'] = mode.replace('hashtag-', '');
      queryParams['feed'] = null;
    } else {
      queryParams['feed'] = mode;
      queryParams['mode'] = null;
      queryParams['q'] = null;
    }
    this.syncingFromUrl = true;
    void this.router.navigate([], { relativeTo: this.route, queryParams }).finally(() => {
      this.syncingFromUrl = false;
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  setViewMode(mode: 'feed' | 'map') {
    if (this.viewMode === mode) return;
    const queryParams = { ...this.route.snapshot.queryParams, view: mode };
    this.syncingFromUrl = true;
    void this.router.navigate([], { relativeTo: this.route, queryParams }).finally(() => {
      this.syncingFromUrl = false;
    });
  }

  private applyStateFromQueryParams(params: Record<string, string>): void {
    if (params['mode'] === 'search' && params['q']) {
      this.feedMode.set('hashtag-' + params['q']);
    } else if (params['feed']) {
      this.feedMode.set(params['feed']);
    } else if (!params['mode'] && !params['q']) {
      this.feedMode.set('following');
    }
    this.viewMode = params['view'] === 'map' ? 'map' : 'feed';
  }

  loadWidgets() {
    if (this.auth.user()) {
      this.profileService.getMyProfile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ 
        next: p => {
          this.myProfile.set(p);
          if (p) {
            this.animateStats(p);
          }
        }, 
        error: () => {} 
      });
    }
    this.profileService.getNews().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: n => this.news.set(n || []), error: () => {} });
    this.profileService.getAd().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: a => this.ads.set(a), error: () => {} });
    this.profileService.getShortcuts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: s => this.shortcuts.set(s || []), error: () => {} });
    if (this.auth.user()) {
      this.profileService.getFollowedHashtags().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: tags => this.followedTags.set(tags || []), error: () => {} });
      this.collectionService.getCollections().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: c => this.collectionsPreview.set((c || []).slice(0, 3)), error: () => {} });
    }
  }

  private animateStats(profile: MyCommunityProfile) {
    this.animateValue(0, profile.profile_views || 0, 800, (v) => this.animatedProfileViews.set(v));
    this.animateValue(0, profile.followers_count || 0, 800, (v) => this.animatedFollowers.set(v));
    this.animateValue(0, profile.countries_visited || 0, 800, (v) => this.animatedCountriesVisited.set(v));
  }

  private animateValue(start: number, end: number, duration: number, callback: (v: number) => void) {
    if (start === end) {
      callback(end);
      return;
    }
    const range = end - start;
    let current = start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.max(Math.floor(duration / Math.abs(range || 1)), 15);
    const timer = setInterval(() => {
      const step = Math.max(1, Math.floor(Math.abs(range) / (duration / stepTime)));
      current += increment * step;
      if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
        current = end;
        clearInterval(timer);
        this.statAnimationTimers = this.statAnimationTimers.filter(t => t !== timer);
      }
      callback(current);
    }, stepTime);
    this.statAnimationTimers.push(timer);
  }

  loadNewPosts() {
    this.newPostsCount.set(0);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    this.loadPosts(true);
  }

  loadPosts(reset = false) {
    if (this.isLoadingFeed || (!reset && !this.hasMorePosts)) return;

    if (reset) {
      this.nextCursor = undefined;
      this.hasMorePosts = true;
      this.posts = [];
    }

    this.isLoadingFeed = true;
    this.errorLoadingFeed = false;
    const limit = 10;
    
    const mode = this.feedMode();
    let request;
    if (mode === 'following') {
      request = this.postService.getFeed(limit, this.nextCursor);
    } else if (mode === 'discover') {
      request = this.postService.getExploreFeed(limit, this.nextCursor);
    } else if (mode.startsWith('hashtag-')) {
      const cleanTag = mode.replace('hashtag-', '');
      request = this.postService.getPostsByHashtag(cleanTag, limit, this.nextCursor);
    } else {
      request = this.postService.getFeed(limit, this.nextCursor);
    }
      
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        const newPosts = response?.posts || [];
        this.nextCursor = response?.nextCursor;
        if (!this.nextCursor || newPosts.length < limit) {
          this.hasMorePosts = false;
        }
        
        if (reset) {
          this.posts = newPosts;
        } else {
          this.posts = [...this.posts, ...newPosts];
        }
        
        this.isLoadingFeed = false;

        // Re-observe after DOM update
        setTimeout(() => {
          if (this.scrollSentinel?.nativeElement && this.observer) {
            this.observer.disconnect();
            this.observer.observe(this.scrollSentinel.nativeElement);
          }
        }, 100);
      },
      error: (err) => {
        console.error('Failed to load feed', err);
        this.isLoadingFeed = false;
        this.errorLoadingFeed = true;
      }
    });
  }

  showToast(message: string) {
    this.toastMessage.set(message);
    setTimeout(() => this.toastMessage.set(null), 3000);
  }

  toggleFollow(post: CommunityPostType) {
    if (!post.author?.id) return;
    
    post.is_following = !post.is_following;
    
    this.profileService.toggleFollow(post.author.id).subscribe({
      next: (res) => {
        post.is_following = res.is_following;
      },
      error: () => {
        post.is_following = !post.is_following;
        this.showToast(this.translate.instant('COMMUNITY.TOAST_FOLLOW_ERROR'));
      }
    });
  }

  // Code migrated to CommunityPostCardComponent

  openSaveModal(postId: string) {
    this.savePostId = postId;
    this.analytics.track('collection_save', { post_id: postId });
  }

  onPostSaved(message: string) {
    this.showToast(message);
    this.savePostId = null;
  }

  onPostCreated(newPost: CommunityPostType) {
    this.posts.unshift(newPost);
    this.analytics.track('post_create', { post_id: newPost.id });
  }

  // Itinerary Cloning logic
  cloneTrip(tripId: string) {
    this.analytics.track('trip_clone', { trip_id: tripId });
    this.postService.cloneTrip(tripId).subscribe({
      next: () => {
        this.showToast(this.translate.instant('COMMUNITY.TOAST_CLONE_SUCCESS'));
      },
      error: (err) => {
        console.error('Failed to clone trip:', err);
        this.showToast(apiErrorMessage(err, this.translate.instant('COMMUNITY.TOAST_CLONE_ERROR')));
      }
    });
  }

  // Hashtag parsing migrated to CommunityPostCardComponent

  filterByHashtag(tag: string) {
    const cleanTag = tag.replace('#', '').trim().toLowerCase();
    this.setFeedMode('hashtag-' + cleanTag);
  }

  clearHashtagFilter() {
    this.setFeedMode('discover');
  }

  toggleCommentsView(postId: string) {
    if (this.expandedComments.has(postId)) {
      this.expandedComments.delete(postId);
    } else {
      this.expandedComments.add(postId);
    }
  }

  onCommentAdded(postId: string) {
    const post = this.posts.find(p => p.id === postId);
    if (post) {
      post.comments++;
    }
  }

  removePost(postId: string) {
    this.posts = this.posts.filter(p => p.id !== postId);
  }

  scrollToCreatePost() {
    if (typeof window === 'undefined') return;
    this.createPostAnchor?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  getPostAnimationDelay(index: number): string {
    return `${Math.min(index * 50, 300)}ms`;
  }
}
