import { Component, OnInit, inject, signal, ViewChild, ElementRef, AfterViewInit, OnDestroy, DestroyRef, EventEmitter, Output,computed, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommunityFeedSkeletonComponent } from './components/community-feed-skeleton.component';
import { CommunityPostCommentsComponent } from './components/community-post-comments.component';
import { CommunityPostService, CommunityPost as CommunityPostType } from './services/community-post.service';
import { CommunityPostCardComponent } from './components/community-post-card.component';
import { CommunitySaveModalComponent } from './components/community-save-modal.component';
import { CommunityMapComponent } from './components/community-map.component';
import { apiErrorMessage } from '../shared/utils/api-error.util';
import { CommunityAnalyticsService } from './services/community-analytics.service';
import { AuthService } from '../auth/auth.service';
import { CommunityProfileService, MyCommunityProfile } from './services/community-profile.service';
import { CommunityNotificationsService } from './services/community-notifications.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityQaThreadComponent } from './components/community-qa-thread.component';
import { CommunityHomeSubnavComponent } from './components/community-home-subnav.component';
import { CommunityCrewWidgetComponent } from './components/community-crew-widget.component';
import { CommunityTravelersRailComponent } from './components/community-travelers-rail.component';
import { CommunityDestinationTrendingComponent } from './components/community-destination-trending.component';
import { CommunityUpcomingEventsWidgetComponent } from './components/community-upcoming-events-widget.component';
import { CommunitySimilarTravelersComponent } from './components/community-similar-travelers.component';
import { CommunityComposerModalComponent } from './components/community-composer-modal.component';
import { CommunityJoinRequestsComponent } from './components/community-join-requests.component';
import { HttpClient } from '@angular/common/http';
import { SavedTrip, TripService } from '../trip/trip.service';
import { CommunityCollectionService } from './services/community-collection.service';
import { apiUrl } from '../shared/utils/api-url';
import { catchError,of } from 'rxjs';
import { CommunityStoryService, StoryGroup, Story } from './services/community-story.service';
import { CommunityStoryPreviewModalComponent } from './components/community-story-preview-modal.component';
import { CommunityCreateStoryComponent } from './components/community-create-story.component';
import { PreviewStoryDetail, PREVIEW_STORY_DETAILS } from './components/community-story-preview.mock';
import { A11yModule } from '@angular/cdk/a11y';




type PostCategory = 'forYou' | 'following' | 'nearTrip' | 'questions' | 'tripPlans' | 'tips' | 'photos';

interface HeroDestination {
  name: string;
  image: string;
}
const SEEN_STORIES_KEY = 'community_seen_stories';

@Component({
    selector: 'app-community-page',
    imports: [
      CommonModule,
      RouterLink,
      CommunityPostCardComponent,
      CommunitySaveModalComponent,
      CommunityMapComponent,
      TranslatePipe,
      CommunityFeedSkeletonComponent,
      CommunityPostCommentsComponent,
      CommunityQaThreadComponent,
      CommunityHomeSubnavComponent,          
      CommunityCrewWidgetComponent,
      CommunityTravelersRailComponent,
      CommunityDestinationTrendingComponent,
      CommunityUpcomingEventsWidgetComponent,
      CommunitySimilarTravelersComponent,
      CommunityComposerModalComponent,
      CommunityJoinRequestsComponent,
      CommunityStoryPreviewModalComponent,
      CommunityCreateStoryComponent,
      A11yModule,
    ],
    template: `
    <!-- font-manrope: the app-wide default (Poppins) is a rounded geometric face that
         reads visibly larger/heavier than this feature's reference design at the same
         px size. Manrope is already loaded at every weight this page uses (unlike Inter,
         which this project only has at 400/900) and is the same face the sibling
         Travel Circles/Trips island already uses for this lighter, tighter look. -->
    <div class="font-manrope min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 flex flex-col pb-0 md:pb-0">
    
      <main class="flex-1 flex justify-center pt-2 sm:pt-4 lg:pt-8 pb-4 sm:pb-6 lg:pb-8 px-3 sm:px-4">
        <div class="w-full max-w-[1280px] grid grid-cols-[minmax(170px,32%)_minmax(0,1fr)] lg:grid-cols-12 gap-3 sm:gap-6 items-start">

          <!-- LEFT COLUMN (Subnav + Journey). Spans every content row (Hero, Feed, Right
               rail) and stays sticky at every width — previously it only spanned row 1
               (paired with the Hero), so once the Feed/Right-rail's col-span-2 carried
               them under its column for their own full-width rows, the sidebar had
               already scrolled out of view with nothing left to stick against.
               Height is capped to one viewport (not stretched to the row-span, which
               spans the entire feed and could be thousands of px tall) so the profile
               card pinned to its bottom via mt-auto stays visible alongside the nav
               links instead of only appearing once you scroll to the very end of the
               page. -->

          <div class="flex flex-col h-[calc(100vh-120px)] row-span-3 lg:col-span-2 lg:row-span-2 sticky top-[92px] gap-3 sm:gap-5">
         
            <app-community-home-subnav />

           
          </div>

          <!-- TOP ROW: Hero + Stories, paired with the left nav at every width -->
          <div class="lg:col-span-10 space-y-3 sm:space-y-5">
            <!-- Hero band -->
           
            <!---------------------- Hero ----------------->
            
    @if (nextTrip(); as trip) {
      <!-- Personalized next-trip card, shown when the signed-in user has a real upcoming trip -->
      <div class="relative rounded-[22px] overflow-hidden mb-5 select-none font-[inherit]">
        <div
          class="absolute inset-0 bg-cover bg-center"
          [style.backgroundImage]="trip.image ? 'url(' + trip.image + ')' : null"
        ></div>
        <div class="absolute inset-0 community-hero-overlay"></div>
        <div class="relative flex flex-col justify-end min-h-[210px] sm:min-h-64 p-5 sm:p-7 max-w-[650px]">
          <div class="flex items-center gap-[9px] mb-3">
            <span class="w-[7px] h-[7px] rounded-full community-badge-dot"></span>
            <p class="text-[10.5px] font-semibold text-white/70 uppercase tracking-[0.14em]">
              {{ 'COMMUNITY.HERO.NEXT_TRIP_BADGE' | translate }} · {{ 'COMMUNITY.HERO.DAYS_AWAY' | translate: { count: daysAway(trip) } }}
            </p>
          </div>
          <h2 class="text-[28px] sm:text-[34px] font-bold text-white leading-[1.08] tracking-[-0.025em] mb-2.5 max-w-lg">{{ trip.destination }}</h2>
          <p class="text-[13px] font-semibold text-white/75 mb-[22px]">
            {{ formatDateRange(trip) }} <span class="opacity-45">·</span> {{ (nightsCount(trip) === 1 ? 'COMMUNITY.HERO.NIGHT_COUNT' : 'COMMUNITY.HERO.NIGHTS_COUNT') | translate: { count: nightsCount(trip) } }}
            @if (savedSpots() !== null) {
              <span class="opacity-45">·</span> {{ (savedSpots() === 1 ? 'COMMUNITY.HERO.SAVED_SPOT_COUNT' : 'COMMUNITY.HERO.SAVED_SPOTS_COUNT') | translate: { count: savedSpots() } }}
            }
          </p>
          <div class="flex items-center gap-2 flex-wrap">
            <a
              routerLink="/explore"
              [queryParams]="{ q: cityName(trip) }"
              class="h-10 inline-flex items-center px-[18px] bg-white text-[13px] font-semibold rounded-[11px] transition-colors whitespace-nowrap community-hero-btn-solid"
            >
              {{ 'COMMUNITY.HERO.EXPLORE_DESTINATION' | translate: { name: cityName(trip) } }}
            </a>
            <a
              routerLink="/community/matching"
              class="h-10 inline-flex items-center px-[18px] bg-white/[0.16] hover:bg-white/[0.28] text-white text-[13px] font-semibold rounded-[11px] transition-colors whitespace-nowrap"
            >
              {{ 'COMMUNITY.HERO.FIND_TRAVELERS' | translate }}
            </a>
            <a [routerLink]="['/itinerary', trip.id]" class="h-10 inline-flex items-center px-3.5 text-white/80 hover:text-white text-[13px] font-semibold transition-colors whitespace-nowrap">
              {{ 'COMMUNITY.HERO.OPEN_TRIP' | translate }} →
            </a>
          </div>
        </div>
      </div>
    } @else {
      <!-- Hero for signed-out users / users without an upcoming trip. Shows a rotating
           photo carousel once real destinations load from the API; the card, heading
           and buttons below always render regardless — only the photo layer and the
           place-name badge are conditional on real data being available, so there is
           no fake photo/name shown while loading or if that API call fails. -->
      <div class="relative rounded-[22px] overflow-hidden mb-5 select-none font-[inherit]">
        @if (destinations().length > 0) {
          <div
            class="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
            [style.backgroundImage]="'url(' + destinations()[currentIndex()].image + ')'"
            [class.opacity-100]="!transitioning()"
            [class.opacity-0]="transitioning()"
          ></div>
        }
        <div class="absolute inset-0 community-hero-overlay"></div>
        @if (destinations().length > 0) {
          <div class="absolute bottom-4 right-4 flex gap-1.5 z-10">
            @for (d of destinations(); track d.name; let i = $index) {
              <button
                (click)="goTo(i)"
                class="w-1.5 h-1.5 rounded-full transition-all focus:outline-none bg-white"
                [class.opacity-40]="i !== currentIndex()"
              ></button>
            }
          </div>
        }
        <div class="relative flex flex-col justify-end min-h-[210px] sm:min-h-64 p-5 sm:p-7 max-w-[650px]">

          @if (destinations().length > 0) {
            <div class="flex items-center gap-[9px] mb-3">
              <span class="w-[7px] h-[7px] rounded-full community-badge-dot"></span>
              <p class="text-[10.5px] font-semibold text-white/70 uppercase tracking-[0.14em]">📍 {{ destinations()[currentIndex()].name }}</p>
            </div>
          }

          <h2 class="text-[28px] sm:text-[34px] font-bold text-white leading-[1.08] tracking-[-0.025em] mb-[22px] max-w-lg"> <br class="sm:hidden" /> {{ 'COMMUNITY.HERO.TITLE_LINE2' | translate }}</h2>
          <div class="flex items-center gap-2 flex-wrap">
            <button
              (click)="onMap.emit()"
              class="h-10 inline-flex items-center gap-1.5 px-[18px] bg-white/[0.16] hover:bg-white/[0.28] text-white text-[13px] font-semibold rounded-[11px] transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
              {{ 'COMMUNITY.HERO.EXPLORE_MAP' | translate }}
            </button>
            <a
              routerLink="/community/matching"
              class="h-10 inline-flex items-center gap-1.5 px-[18px] bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold rounded-[11px] transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
              {{ 'COMMUNITY.HERO.FIND_TRAVELERS' | translate }}
            </a>
          </div>
        </div>
      </div>
    }

           
  
            <!-- Stories (edge-to-edge, no card wrapper) -->
            <!-- ............................... Stories Bar .............................................. -->
     
             <div class="flex gap-4 overflow-x-auto no-scrollbar items-start max-w-2xl py-2 px-1">

      <!-- Add Story -->
      <button
        type="button"
        (click)="showCreateModal.set(true)"
        class="group flex flex-col items-center gap-1.5 w-[72px] shrink-0 focus:outline-none"
      >
        <span class="relative w-16 h-16 rounded-full border-2 border-dashed border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
          <img
            [src]="myAvatar() || '/assets/images/default-avatar.svg'"
            class="absolute inset-0 w-full h-full object-cover opacity-40"
          />
          <span class="relative z-10 w-7 h-7 rounded-full bg-primary group-hover:bg-primary-hover text-white flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-md transition-transform group-hover:scale-110">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3.5" d="M12 4v16m8-8H4" />
            </svg>
          </span>
        </span>
        <span class="text-2xs font-semibold text-text-tertiary truncate max-w-full">{{ 'COMMUNITY.STORIES_BAR.YOUR_STORY' | translate }}</span>
      </button>

      <!-- Skeletons (when loading) -->
      @if (isLoading()) {
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="flex flex-col items-center gap-1.5 w-[72px] shrink-0">
            <div class="w-16 h-16 rounded-full bg-slate-200/60 dark:bg-gray-700 animate-pulse"></div>
            <div class="h-2 w-10 rounded bg-slate-200/60 dark:bg-gray-700 animate-pulse"></div>
          </div>
        }
      }

      <!-- Story rings -->
      @for (group of feed(); track group.author.id; let i = $index) {
        <button
          type="button"
          (click)="openStory(i, group)"
          class="group flex flex-col items-center gap-1.5 w-[72px] shrink-0 text-center focus:outline-none"
          [attr.aria-label]="'COMMUNITY.STORIES_BAR.VIEW_STORY_ARIA' | translate"
        >
          <!-- Gradient ring if unseen, grey ring if seen -->
          <span
            class="relative w-16 h-16 rounded-full p-[2.5px] transition-transform duration-300 group-hover:scale-105 group-active:scale-95"
            [class.bg-gradient-to-tr]="!isGroupSeen(group)"
            [class.from-amber-400]="!isGroupSeen(group)"
            [class.via-pink-500]="!isGroupSeen(group)"
            [class.to-fuchsia-600]="!isGroupSeen(group)"
            [class.bg-slate-300]="isGroupSeen(group)"
            [class.dark:bg-gray-600]="isGroupSeen(group)"
          >
            <span class="block w-full h-full rounded-full border-2 border-white dark:border-gray-800 overflow-hidden bg-slate-100 dark:bg-gray-700">
              <img [src]="group.stories[0].media_url" class="w-full h-full object-cover" alt="" />
            </span>

            <!-- Seen check overlay -->
            @if (isGroupSeen(group)) {
              <span class="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-sm border border-slate-100 dark:border-gray-700">
                <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              </span>
            }
          </span>

          <!-- Author name -->
          <span class="text-2xs font-semibold text-text-primary truncate max-w-full">{{ group.author.name }}</span>
        </button>
      }

      <!-- Preview stories (shown only while the real feed is empty) -->
      @if (!isLoading() && feed().length === 0) {
        @for (story of previewStories; track story.name) {
          <button
            type="button"
            (click)="openPreviewStory(story)"
            class="group flex flex-col items-center gap-1.5 w-[72px] shrink-0 text-center focus:outline-none"
          >
            <span
              class="relative w-16 h-16 rounded-full p-[2.5px] transition-transform duration-300 group-hover:scale-105 group-active:scale-95"
              [style.background]="ringGradient(story.status)"
            >
              <span class="block w-full h-full rounded-full border-2 border-white dark:border-gray-800 overflow-hidden bg-slate-100 dark:bg-gray-700">
                <img [src]="story.image" class="w-full h-full object-cover" alt="" />
              </span>
            </span>
            <span class="text-2xs font-semibold text-text-primary truncate max-w-full">{{ story.name }}</span>
          </button>
        }
      }

    </div>

    @if (showStoryModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
           (click)="closeStoryModal()"
           (window:keydown.escape)="closeStoryModal()">
        <button
          (click)="closeStoryModal(); $event.stopPropagation()"
          class="absolute top-4 right-4 text-white hover:text-gray-300 z-[60] focus:outline-none"
          [attr.aria-label]="'COMMUNITY.STORY_MODAL.CLOSE' | translate"
        >
          <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div class="relative w-full max-w-md h-[80vh] sm:h-[90vh] bg-black rounded-xl overflow-hidden flex flex-col"
             cdkTrapFocus
             cdkTrapFocusAutoCapture
             (click)="$event.stopPropagation()">
          <!-- Progress Bars -->
          <div class="absolute top-0 inset-x-0 p-4 flex gap-1 z-10 bg-gradient-to-b from-black/60 to-transparent">
            @for (story of activeGroup?.stories; track story.id; let i = $index) {
              <div class="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  [id]="'story-progress-' + i"
                  class="h-full bg-white transition-all duration-100 ease-linear"
                  [style.width.%]="getProgressWidth(i)"
                ></div>
              </div>
            }
          </div>

          <!-- Header -->
          <div class="absolute top-6 inset-x-0 px-4 flex items-center gap-3 z-10">
            <img
              [src]="activeGroup?.author?.avatar || '/assets/images/default-avatar.svg'"
              class="w-10 h-10 rounded-full border border-white/50"
            />
            <span class="text-white font-semibold shadow-sm">{{ activeGroup?.author?.name }}</span>
          </div>

          <!-- Media -->
          <div class="flex-1 relative flex items-center justify-center">
            <img
              [src]="currentStory?.media_url"
              class="w-full h-full object-contain"
              (click)="handleTap($event)"
            />

            @if (currentStory?.caption) {
              <div class="absolute bottom-10 inset-x-0 text-center px-6 z-10">
                <p class="text-white bg-black/50 backdrop-blur-md px-4 py-2 rounded-xl inline-block text-sm">
                  {{ currentStory?.caption }}
                </p>
              </div>
            }
          </div>

          <!-- Navigation invisible zones -->
          <div class="absolute inset-y-0 left-0 w-1/3 cursor-pointer z-0" (click)="prevStory()"></div>
          <div class="absolute inset-y-0 right-0 w-1/3 cursor-pointer z-0" (click)="nextStory()"></div>
        </div>
      </div>
    }

    @if (showCreateModal()) {
      <app-community-create-story
        (close)="showCreateModal.set(false)"
        (created)="loadFeed()"
      />
    }

    @if (activePreviewStory(); as story) {
      <app-community-story-preview-modal
        [story]="story"
        (close)="activePreviewStory.set(null)"
      />
    }

            </div>

          <!-- CENTER COLUMN (Feed). No base col-span: it stays in the second grid
               column (beside the now row-spanning sidebar) instead of spanning both
               columns, which would have fought the sidebar for column 1. -->
          <div class="lg:col-span-7 space-y-3 sm:space-y-5">

            <!-- Feed Filter Chips. Scroll horizontally instead of wrapping: with
                 flex-wrap, chips used to wrap onto a second line on phones/tablets
                 once they ran out of room. -->
            <div class="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 sm:mx-0 sm:px-0">
              <!-- Category chips (client-side filters over the loaded feed) -->
              @for (cat of postCategories; track cat.key) {
                <button
                  (click)="setPostCategory(cat.key)"
                  class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all focus:outline-none border whitespace-nowrap"
                  [ngClass]="postCategory() === cat.key ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-200 dark:border-gray-700'"
                >{{ cat.labelKey | translate }}</button>
              }
              @for (tag of followedTags(); track tag) {
                <button
                  (click)="setFeedMode('hashtag-' + tag)"
                  class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all focus:outline-none border whitespace-nowrap"
                  [ngClass]="feedMode() === 'hashtag-' + tag ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-200 dark:border-gray-700'"
                >#{{ tag }}</button>
}
            </div>

            @if (viewMode === 'feed') {
              
              @if (feedMode().startsWith('hashtag-') && !followedTags().includes(feedMode().replace('hashtag-', ''))) {
                <div class="flex items-center justify-between gap-3 bg-primary-50 border border-primary-subtle/50 px-4 py-3 rounded-xl text-sm shadow-sm animate-fade-in-up">
                  <span class="text-primary font-semibold min-w-0 truncate">{{ 'COMMUNITY.FILTERING_BY' | translate: { tag: feedMode().replace('hashtag-', '') } }}</span>
                  <button (click)="clearHashtagFilter()" class="shrink-0 text-primary hover:text-primary-hover font-semibold text-xs bg-white dark:bg-gray-800 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-gray-700 shadow-sm transition-all hover:scale-105 active:scale-95">{{ 'COMMUNITY.CLEAR' | translate }}</button>
                </div>
              }

              <!-- Live Feed Updates Pill -->
              @if (newPostsCount() > 0) {
                <div class="fixed top-[100px] left-1/2 transform -translate-x-1/2 z-40">
                  <button (click)="loadNewPosts()" class="bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-700 text-white font-semibold py-2.5 px-6 rounded-full shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95">
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
                  <h3 class="text-red-950 font-semibold mb-1">{{ 'COMMUNITY.FEED_ERROR_TITLE' | translate }}</h3>
                  <p class="text-danger text-sm mb-4">{{ 'COMMUNITY.FEED_ERROR_BODY' | translate }}</p>
                  <button (click)="loadPosts(false)" class="bg-red-100 hover:bg-red-200 text-danger hover:text-danger-hover font-semibold py-2 px-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-400">
                    {{ 'COMMUNITY.RETRY' | translate }}
                  </button>
                </div>
              }
              
              @if (posts.length > 0 && visiblePosts().length === 0 && !isLoadingFeed && !errorLoadingFeed) {
                <!-- Category filter empty: real posts loaded, none match this category -->
                <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-8 shadow-sm text-center animate-fade-in-up">
                  <div class="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-7 h-7 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <h3 class="text-text-primary font-semibold mb-1 text-base">{{ 'COMMUNITY.EMPTY_CATEGORY_TITLE' | translate }}</h3>
                  <p class="text-text-tertiary text-sm mb-4">{{ 'COMMUNITY.EMPTY_CATEGORY_BODY' | translate }}</p>
                  <button (click)="setPostCategory('forYou')" class="inline-block bg-primary hover:bg-primary-hover text-white font-semibold px-5 py-2 rounded-full transition-colors text-sm shadow-sm">
                    {{ 'COMMUNITY.EMPTY_CATEGORY_RESET' | translate }}
                  </button>
                </div>
              } @else if (posts.length === 0 && !isLoadingFeed && !errorLoadingFeed) {
                @if (feedMode() === 'following') {
                  <!-- Following empty: suggest switching to Discover -->
                  <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-8 shadow-sm text-center animate-fade-in-up">
                    <div class="w-14 h-14 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg class="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </div>
                    <h3 class="text-text-primary font-semibold mb-1 text-base">{{ 'COMMUNITY.EMPTY_FOLLOWING_TITLE' | translate }}</h3>
                    <p class="text-text-tertiary text-sm mb-4">{{ 'COMMUNITY.EMPTY_FOLLOWING_BODY' | translate }}</p>
                    <button (click)="setFeedMode('discover')" class="inline-block bg-primary hover:bg-primary-hover text-white font-semibold px-5 py-2 rounded-full transition-colors text-sm shadow-sm">
                      {{ 'COMMUNITY.DISCOVER_TRAVELERS' | translate }}
                    </button>
                  </div>
                } @else if (feedMode() === 'discover') {
                  <!-- Discover empty: trending destinations -->
                  <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-8 shadow-sm text-center animate-fade-in-up">
                    <div class="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg class="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"/></svg>
                    </div>
                    <h3 class="text-text-primary font-semibold mb-1 text-base">{{ 'COMMUNITY.EMPTY_DISCOVER_TITLE' | translate }}</h3>
                    <p class="text-text-tertiary text-sm mb-4">{{ 'COMMUNITY.EMPTY_DISCOVER_BODY' | translate }}</p>
                    <button (click)="showComposerModal.set(true)" class="inline-block bg-primary hover:bg-primary-hover text-white font-semibold px-5 py-2 rounded-full transition-colors text-sm shadow-sm">
                      {{ 'COMMUNITY.SHARE_YOUR_JOURNEY' | translate }}
                    </button>
                  </div>
                } @else {
                  <!-- Hashtag empty -->
                  <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-8 shadow-sm text-center animate-fade-in-up">
                    <div class="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span class="text-2xl font-black text-primary">#</span>
                    </div>
                    <h3 class="text-text-primary font-semibold mb-1 text-base">{{ 'COMMUNITY.EMPTY_HASHTAG_TITLE' | translate: { tag: feedMode().replace('hashtag-', '') } }}</h3>
                    <p class="text-text-tertiary text-sm mb-4">{{ 'COMMUNITY.EMPTY_HASHTAG_BODY' | translate }}</p>
                    <button (click)="showComposerModal.set(true)" class="inline-block bg-primary hover:bg-primary-hover text-white font-semibold px-5 py-2 rounded-full transition-colors text-sm shadow-sm">
                      {{ 'COMMUNITY.CREATE_A_POST' | translate }}
                    </button>
                  </div>
                }
              }

              <!-- Posts -->
              @for (post of visiblePosts(); track post.id; let i = $index) {
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
                        app-community-qa-thread 
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

              @if (postCategory() === 'forYou' && !feedMode().startsWith('hashtag-') && !isLoadingFeed) {
                <app-community-similar-travelers />
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

          <!-- RIGHT COLUMN (Crew, requests, travelers, circle CTA, trending, events, footer).
               Previously "hidden lg:flex" made this whole column — including Crew, Join
               requests, Travelers rail, Trending and Events — disappear below 1024px with
               no way to reach it. It now stays in the second grid column (beside the
               sticky sidebar) below the Feed on mobile/tablet, and becomes the separate
               sticky right rail at lg+ (unchanged from before).
               No z-index here: "sticky + z-60" made this whole card outrank the sticky
               header (z-50) once stuck, so its top edge visually painted over/behind the
               header instead of scrolling under it. That z-60 was added only so the
               Crew widget's fixed-fullscreen "create circle" modal could out-rank the
               header — but that modal already sets its own z-index:90 on a
               position:fixed backdrop (modal-shell.component.scss), independent of this
               column, so it doesn't need this column elevated too. -->
          <div class="flex flex-col gap-4 lg:col-span-3 lg:sticky lg:top-[92px]">
            <app-community-crew-widget />
            <app-community-join-requests />
            <app-community-travelers-rail />
            <app-community-destination-trending />
            <app-community-upcoming-events-widget />           
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

      @if (showComposerModal()) {
        <app-community-composer-modal
          [userAvatar]="myProfile()?.avatar ?? undefined"
          (postCreated)="onPostCreated($event); showComposerModal.set(false)"
          (close)="showComposerModal.set(false)"
        />
      }

      @if (toastMessage()) {
        <div class="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded shadow-lg transition-opacity z-50">
          {{ toastMessage() }}
        </div>
      }      
    </div>
 `,
    styles: [`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
 ` ]
})
export class CommunityPageComponent implements OnInit, AfterViewInit, OnDestroy {
 @Output() onPost = new EventEmitter<void>();
  @Output() onMap = new EventEmitter<void>(); 
 
  myProfile = signal<MyCommunityProfile | null>(null);
  profileService = inject(CommunityProfileService);
  notificationsService = inject(CommunityNotificationsService);
  posts: CommunityPostType[] = [];
  showComposerModal = signal(false);
  isLoadingFeed = false;
  errorLoadingFeed = false;
  viewMode: 'feed' | 'map' = 'feed';
  savePostId: string | null = null;

  toastMessage = signal<string | null>(null);

  expandedComments = new Set<string>();
  newPostsCount = signal<number>(0);
  
    feed = signal<StoryGroup[]>([]);
    showStoryModal = signal(false);
    showCreateModal = signal(false);
    activeStoryIndex = 0;
    activePreviewStory = signal<PreviewStoryDetail | null>(null);

     isLoading = signal(true);
     myAvatar = signal<string | null>(null);
     private seenIds = new Set<string>(this.loadSeenIds());

     readonly previewStories = PREVIEW_STORY_DETAILS;

    // Story viewer modal state (formerly CommunityStoryModalComponent)
    currentGroupIndex = 0;
    currentStoryIndex = 0;
    progress = 0; // 0 to 100
    private storyTimer: any;
    private readonly STORY_DURATION_MS = 5000;
    private readonly UPDATE_INTERVAL_MS = 50;
    private ngZone = inject(NgZone);


  feedMode = signal<string>('following');
  followedTags = signal<string[]>([]);
  activeReactionPostId = signal<string | null>(null);

  readonly postCategories: { key: PostCategory; labelKey: string }[] = [
    { key: 'forYou', labelKey: 'COMMUNITY.CATEGORY_FOR_YOU' },
    { key: 'following', labelKey: 'COMMUNITY.FOLLOWING' },
    { key: 'nearTrip', labelKey: 'COMMUNITY.CATEGORY_NEAR_TRIP' },
    { key: 'questions', labelKey: 'COMMUNITY.CATEGORY_QUESTIONS' },
    { key: 'tripPlans', labelKey: 'COMMUNITY.CATEGORY_TRIP_PLANS' },
    { key: 'tips', labelKey: 'COMMUNITY.CATEGORY_TIPS' },
    { key: 'photos', labelKey: 'COMMUNITY.CATEGORY_PHOTOS' },
  ];
  postCategory = signal<PostCategory>('forYou');

  @ViewChild('scrollSentinel') scrollSentinel?: ElementRef;
  private observer: IntersectionObserver | null = null;
  nextCursor?: string;
  hasMorePosts = true;
  private http = inject(HttpClient);
  private tripService = inject(TripService);
  private collectionService = inject(CommunityCollectionService);
  private auth = inject(AuthService);
  readonly user = this.auth.user;
  private storyService = inject(CommunityStoryService);
  

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private wsSub?: Subscription;
  private destroyRef = inject(DestroyRef);
  /** Avoid re-navigating when applying state from the URL (back/forward). */
  private syncingFromUrl = false;

  readonly savedSpots = signal<number | null>(null); 
  
  /** The soonest real upcoming trip, if the signed-in user has one. */
  readonly nextTrip = computed(() => {
    const now = Date.now();
    const upcoming = this.tripService.trips()
      .filter(t => t.status !== 'cancelled' && !!t.startDate && new Date(t.startDate).getTime() >= now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    return upcoming[0] ?? null;
  });



  private readonly translate = inject(TranslateService);

   destinations = signal<HeroDestination[]>([]);
  currentIndex = signal(0);
  transitioning = signal(false);
  private rotateInterval?: ReturnType<typeof setInterval>;

  constructor(
    private postService: CommunityPostService,
    private analytics: CommunityAnalyticsService
  ) {}

  ngOnInit() {

     this.loadDestinations();
    this.startRotation();
    if (this.auth.user()) {
      this.collectionService.getCollections().subscribe({
        next: (collections) => this.savedSpots.set(collections.reduce((sum, c) => sum + (c.item_count || 0), 0)),
        error: () => {}
      });
    }
      this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      if (!this.syncingFromUrl) {
        this.applyStateFromQueryParams(params);
      }      
       this.loadFeed();
       this.loadMyAvatar();

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
     if (this.rotateInterval) clearInterval(this.rotateInterval);
     this.stopTimer();
  }

  private loadDestinations() {
    this.http.get<any[]>(apiUrl('/destinations?limit=6&has_image=true')).pipe(
      catchError(() => of(null))
    ).subscribe(data => {
      if (data?.length) {
        const mapped = data
          .filter((d: any) => d.image || d.images?.[0])
          .slice(0, 5)
          .map((d: any) => ({ name: d.name, image: d.image || d.images[0] }));
        if (mapped.length >= 2) {
          this.destinations.set(mapped);
        }
      }
    });
  }

  private startRotation() {
    this.rotateInterval = setInterval(() => {
      if (this.destinations().length < 2) return;
      this.transitioning.set(true);
      setTimeout(() => {
        this.currentIndex.update(i => (i + 1) % this.destinations().length);
        this.transitioning.set(false);
      }, 500);
    }, 5000);
  }

  goTo(i: number) {
    if (i === this.currentIndex()) return;
    this.transitioning.set(true);
    setTimeout(() => {
      this.currentIndex.set(i);
      this.transitioning.set(false);
    }, 300);
  }

  daysAway(trip: SavedTrip): number {
    return Math.max(0, Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / 86400000));
  }

  nightsCount(trip: SavedTrip): number {
    return Math.max(1, Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000));
  }

  cityName(trip: SavedTrip): string {
    return (trip.destination || '').split(',')[0].trim();
  }

  formatDateRange(trip: SavedTrip): string {
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const start = new Date(trip.startDate).toLocaleDateString('en-US', opts);
    const end = new Date(trip.endDate).toLocaleDateString('en-US', opts);
    return `${start} – ${end}`;
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

   private loadSeenIds(): string[] {
      if (typeof localStorage === 'undefined') return [];
      try {
        return JSON.parse(localStorage.getItem(SEEN_STORIES_KEY) || '[]');
      } catch {
        return [];
      }
    }
  
    isGroupSeen(group: StoryGroup): boolean {
      return group.stories.every(s => this.seenIds.has(s.id));
    }
  
    markGroupSeen(group: StoryGroup) {
      group.stories.forEach(s => this.seenIds.add(s.id));
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(SEEN_STORIES_KEY, JSON.stringify([...this.seenIds]));
        } catch {}
      }
    }
  
    loadFeed() {
      this.isLoading.set(true);
      this.storyService.getFeed().subscribe({
        next: (res) => {
          this.feed.set(res.feed);
          this.isLoading.set(false);
        },
        error: () => {
          this.feed.set([]);
          this.isLoading.set(false);
        }
      });
    }
  
    loadMyAvatar() {
      this.profileService.getMyProfile().subscribe({
        next: (p) => this.myAvatar.set(p.avatar),
        error: () => {}
      });
    }
  
    openStory(index: number, group: StoryGroup) {
      this.activeStoryIndex = index;
      this.showStoryModal.set(true);
      this.markGroupSeen(group);
      // Formerly CommunityStoryModalComponent.ngOnInit — the modal used to be
      // (re)created by the @if block, which reset this state each time it opened.
      this.currentGroupIndex = index;
      this.currentStoryIndex = 0;
      this.startTimer();
    }

    ringGradient(status: PreviewStoryDetail['status']): string {
      if (status === 'there') return 'linear-gradient(140deg,#0F9D58,#2AA98B)';
      if (status === 'soon') return 'linear-gradient(140deg,#0060EA,#7A4FA3)';
      return '#E2E7EF';
    }

    openPreviewStory(story: PreviewStoryDetail): void {
      this.activePreviewStory.set(story);
    }

    // --- Story viewer modal (formerly CommunityStoryModalComponent) ---

    get activeGroup(): StoryGroup | undefined {
      return this.feed()[this.currentGroupIndex];
    }

    get currentStory(): Story | undefined {
      return this.activeGroup?.stories[this.currentStoryIndex];
    }

    closeStoryModal() {
      this.stopTimer();
      this.showStoryModal.set(false);
    }

    getProgressWidth(index: number): number {
      if (index < this.currentStoryIndex) return 100;
      if (index === this.currentStoryIndex) return this.progress;
      return 0;
    }

    handleTap(event: MouseEvent) {
      const width = (event.target as HTMLElement).offsetWidth;
      const clickX = event.offsetX;

      if (clickX < width / 3) {
        this.prevStory();
      } else {
        this.nextStory();
      }
    }

    prevStory() {
      this.stopTimer();
      this.progress = 0;

      if (this.currentStoryIndex > 0) {
        this.currentStoryIndex--;
        this.startTimer();
      } else if (this.currentGroupIndex > 0) {
        this.currentGroupIndex--;
        this.currentStoryIndex = this.activeGroup!.stories.length - 1;
        this.startTimer();
      } else {
        // Loop or just stay at beginning, let's just restart
        this.startTimer();
      }
    }

    nextStory() {
      this.stopTimer();
      this.progress = 0;

      if (this.activeGroup && this.currentStoryIndex < this.activeGroup.stories.length - 1) {
        this.currentStoryIndex++;
        this.startTimer();
      } else if (this.currentGroupIndex < this.feed().length - 1) {
        this.currentGroupIndex++;
        this.currentStoryIndex = 0;
        this.startTimer();
      } else {
        this.closeStoryModal();
      }
    }

    private startTimer() {
      this.progress = 0;
      this.ngZone.runOutsideAngular(() => {
        this.storyTimer = setInterval(() => {
          this.progress += (100 / (this.STORY_DURATION_MS / this.UPDATE_INTERVAL_MS));

          // Update DOM directly to avoid triggering Angular change detection
          const element = document.getElementById('story-progress-' + this.currentStoryIndex);
          if (element) {
            element.style.width = `${this.progress}%`;
          }

          if (this.progress >= 100) {
            this.ngZone.run(() => {
              this.nextStory();
            });
          }
        }, this.UPDATE_INTERVAL_MS);
      });
    }

    private stopTimer() {
      if (this.storyTimer) {
        clearInterval(this.storyTimer);
      }
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

  setPostCategory(category: PostCategory): void {
    this.postCategory.set(category);
  }

  /** Client-side filter over the already-loaded feed — the backend only exposes feed/explore/hashtag endpoints, not per-category ones. */
  visiblePosts(): CommunityPostType[] {
    switch (this.postCategory()) {
      case 'following':
        return this.posts.filter(p => p.is_following);
      case 'nearTrip':
        return this.posts.filter(p => !!p.destination);
      case 'questions':
        return this.posts.filter(p => p.type === 'qa');
      case 'tripPlans':
        return this.posts.filter(p => !!p.itinerary);
      case 'tips':
        return this.posts.filter(p => !p.itinerary && p.type !== 'qa' && p.type !== 'poll' && !(p.images?.length));
      case 'photos':
        return this.posts.filter(p => !!p.images?.length && !p.itinerary);
      default:
        return this.posts;
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
        next: p => this.myProfile.set(p),
        error: () => {}
      });
      this.profileService.getFollowedHashtags().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: tags => this.followedTags.set(tags || []), error: () => {} });
    }
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

  getPostAnimationDelay(index: number): string {
    return `${Math.min(index * 50, 300)}ms`;
  }
}
