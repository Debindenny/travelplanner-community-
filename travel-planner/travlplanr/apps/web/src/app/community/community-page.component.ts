import { Component, OnInit, inject, signal, ViewChild, ElementRef, AfterViewInit, OnDestroy, DestroyRef, EventEmitter, Output,computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommunityStoriesBarComponent } from './components/community-stories-bar.component';
import { CommunityPostService, CommunityPost as CommunityPostType } from './services/community-post.service';
import { CommunityPostCardComponent, CommunityPostCommentsComponent } from './components/community-post-shared.component';
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
import { CommunityJoinRequestsComponent } from './components/community-join-requests.component';
import { HttpClient } from '@angular/common/http';
import { SavedTrip, TripService } from '../trip/trip.service';
import { CommunityCollectionService } from './services/community-collection.service';
import { apiUrl } from '../shared/utils/api-url';
import { catchError,of,forkJoin } from 'rxjs';
type PostCategory = 'forYou' | 'following' | 'nearTrip' | 'questions' | 'tripPlans' | 'tips' | 'photos';

interface HeroDestination {
  name: string;
  image: string;
}

interface FeedComposerTypeMeta {
  labelKey: string;
  placeholderKey: string;
  icon: string;
}

/** Inline feed composer type metadata (badge label, textarea placeholder, icon) — keyed by the
    same post `type` values CommunityPostService posts already use elsewhere in the community feature. */
const FEED_COMPOSER_TYPE_META: Record<string, FeedComposerTypeMeta> = {
  tip: {
    labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_TIP',
    placeholderKey: 'COMMUNITY.FEED_COMPOSER_PLACEHOLDER_TIP',
    icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z',
  },
  photo: {
    labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_PHOTO',
    placeholderKey: 'COMMUNITY.FEED_COMPOSER_PLACEHOLDER_PHOTO',
    icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  trip_share: {
    labelKey: 'COMMUNITY.COMPOSER_MODAL.TYPE_TRIP',
    placeholderKey: 'COMMUNITY.FEED_COMPOSER_PLACEHOLDER_TRIP',
    icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  },
};

/** Static suggestion list for the feed composer's location field — filtered client-side as the
    user types. Free text is always allowed too; this never blocks a custom location. */
const FEED_LOCATION_SUGGESTIONS: string[] = [
  'Singapore',
  'Dubai, UAE',
  'Paris, France',
  'Tokyo, Japan',
  'London, UK',
];

@Component({
    selector: 'app-community-page',
    imports: [
      CommonModule,
      RouterLink,
      CommunityStoriesBarComponent,
      CommunityPostCardComponent,
      CommunitySaveModalComponent,
      CommunityMapComponent,
      TranslatePipe,
      CommunityPostCommentsComponent,
      CommunityQaThreadComponent,
      CommunityHomeSubnavComponent,
      CommunityCrewWidgetComponent,
      CommunityTravelersRailComponent,
      CommunityDestinationTrendingComponent,
      CommunityUpcomingEventsWidgetComponent,
      CommunitySimilarTravelersComponent,
      CommunityJoinRequestsComponent,
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
            <app-community-stories-bar />

            </div>


          <!-- CENTER COLUMN (Feed). No base col-span: it stays in the second grid
               column (beside the now row-spanning sidebar) instead of spanning both
               columns, which would have fought the sidebar for column 1. -->
          <div class="lg:col-span-7 space-y-3 sm:space-y-5">

            @if (viewMode === 'feed') {

              <!-- Feed composer: fully inline, no modal. Picking a type swaps this card to a
                   single caption field for that type; Post reuses the same
                   CommunityPostService.createPost() / onPostCreated() pipeline every other
                   post-creation entry point already uses. -->
              <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-4 shadow-sm">
                @if (composerMeta(); as meta) {
                  <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 text-primary text-xs font-bold mb-3">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="meta.icon"/></svg>
                    {{ meta.labelKey | translate }}
                  </div>

                  <textarea
                    [value]="composerText()"
                    (input)="composerText.set($any($event.target).value)"
                    [attr.placeholder]="meta.placeholderKey | translate"
                    maxlength="500"
                    class="w-full h-16 sm:h-20 px-4 py-3 bg-slate-50 dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-medium text-text-primary resize-none mb-3"
                  ></textarea>

                  <!-- Location: free text with a filtered suggestion list — selecting a suggestion
                       just fills the same field, it isn't a separate structured value. -->
                  <div class="relative mb-3">
                    <div class="relative">
                      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-faint pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      <input
                        type="text"
                        role="combobox"
                        aria-autocomplete="list"
                        [attr.aria-expanded]="composerShowLocationSuggestions()"
                        aria-controls="feed-composer-location-listbox"
                        [value]="composerLocation()"
                        (input)="onComposerLocationInput($any($event.target).value)"
                        (focus)="composerShowLocationSuggestions.set(true)"
                        (blur)="composerShowLocationSuggestions.set(false)"
                        [attr.placeholder]="'COMMUNITY.FEED_COMPOSER_LOCATION_PLACEHOLDER' | translate"
                        maxlength="120"
                        class="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-medium text-text-primary"
                      />
                    </div>
                    @if (composerShowLocationSuggestions() && composerLocationSuggestions().length > 0) {
                      <ul
                        id="feed-composer-location-listbox"
                        role="listbox"
                        class="absolute z-50 w-full mt-1.5 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] max-h-56 overflow-auto divide-y divide-slate-50 dark:divide-gray-700"
                      >
                        @for (loc of composerLocationSuggestions(); track loc) {
                          <li role="option">
                            <button
                              type="button"
                              (mousedown)="$event.preventDefault()"
                              (click)="selectComposerLocation(loc)"
                              class="w-full text-left px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-primary-50/60 dark:hover:bg-gray-700 transition-colors"
                            >{{ loc }}</button>
                          </li>
                        }
                      </ul>
                    }
                  </div>

                  @if (composerType() === 'photo') {
                    <!-- Photo is the only type that requires media; Tip/Trip post from text alone. -->
                    <div class="mb-3">
                      @if (composerImages().length === 0 && !composerVideoPreviewUrl()) {
                        <button
                          type="button"
                          (click)="composerFileInput.click()"
                          class="w-full flex flex-col items-center justify-center gap-1 py-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-gray-700 hover:border-primary-subtle hover:bg-primary-50/30 transition-colors text-center"
                        >
                          <svg class="w-5 h-5 text-text-faint" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                          <span class="text-xs font-extrabold text-text-primary">{{ 'COMMUNITY.COMPOSER_MODAL.PHOTO_DROPZONE_TITLE' | translate }}</span>
                          <span class="text-[11px] font-medium text-text-faint">{{ 'COMMUNITY.COMPOSER_MODAL.PHOTO_DROPZONE_SUBTITLE' | translate }}</span>
                        </button>
                      } @else {
                        <div class="space-y-2">
                          @if (composerImages().length > 0) {
                            <div class="grid grid-cols-4 gap-1.5">
                              @for (image of composerImages(); track image.url; let i = $index) {
                                <div class="relative aspect-square rounded-lg overflow-hidden border border-slate-200/60 group">
                                  <img [src]="image.url" class="w-full h-full object-cover" alt="" />
                                  <button
                                    type="button"
                                    (click)="removeComposerImage(i)"
                                    [attr.aria-label]="'COMMUNITY.COMPOSER_MODAL.PHOTO_DROPZONE_REMOVE_ARIA' | translate"
                                    class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                                  >
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                  </button>
                                </div>
                              }
                            </div>
                          }
                          @if (composerVideoPreviewUrl(); as videoUrl) {
                            <div class="relative rounded-lg overflow-hidden border border-slate-200/60 bg-black">
                              <video [src]="videoUrl" controls class="w-full max-h-44"></video>
                              <button
                                type="button"
                                (click)="removeComposerVideo()"
                                [attr.aria-label]="'COMMUNITY.COMPOSER_MODAL.PHOTO_DROPZONE_REMOVE_ARIA' | translate"
                                class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                              >
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>
                            </div>
                          }
                          <button type="button" (click)="composerFileInput.click()" class="text-[11px] font-bold text-primary hover:underline">
                            {{ 'COMMUNITY.COMPOSER_MODAL.PHOTO_DROPZONE_TITLE' | translate }}
                          </button>
                        </div>
                      }
                      <input #composerFileInput type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple class="hidden" (change)="onComposerFileSelect($event)" />
                    </div>
                  }

                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <div class="flex items-center gap-1 -ml-1.5">
                      @for (emoji of composerEmojis; track emoji) {
                        <button
                          type="button"
                          (click)="insertComposerEmoji(emoji)"
                          class="w-8 h-8 flex items-center justify-center rounded-lg text-base hover:bg-slate-50 dark:hover:bg-gray-900/40 transition-colors"
                        >{{ emoji }}</button>
                      }
                    </div>
                    <div class="flex items-center gap-2 ml-auto">
                      <button
                        type="button"
                        (click)="closeFeedComposer()"
                        class="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-gray-600 text-xs font-bold text-text-secondary hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
                      >{{ 'COMMUNITY.CREATE_POST.CANCEL' | translate }}</button>
                      <button
                        type="button"
                        [disabled]="!canSubmitComposer()"
                        (click)="submitFeedComposer()"
                        class="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
                      >{{ 'COMMUNITY.CREATE_POST.POST' | translate }}</button>
                    </div>
                  </div>

                  @if (composerType() === 'photo' && !composerHasMedia()) {
                    <p class="text-[11px] font-semibold text-danger mt-2">{{ 'COMMUNITY.FEED_COMPOSER_MEDIA_REQUIRED' | translate }}</p>
                  }
                } @else {
                  <button
                    type="button"
                    (click)="openFeedComposer('tip')"
                    class="w-full text-left text-sm text-text-tertiary bg-slate-50 dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-xl px-4 py-3 mb-3 hover:bg-slate-100 dark:hover:bg-gray-900/60 transition-colors"
                  >{{ 'COMMUNITY.FEED_COMPOSER_PLACEHOLDER' | translate }}</button>

                  <div class="flex items-center justify-between gap-1">
                    <button type="button" (click)="openFeedComposer('tip')" class="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:bg-slate-50 dark:hover:bg-gray-900/40 transition-colors">
                      <svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
                      {{ 'COMMUNITY.FEED_COMPOSER_TIP' | translate }}
                    </button>
                    <button type="button" (click)="openFeedComposer('photo')" class="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:bg-slate-50 dark:hover:bg-gray-900/40 transition-colors">
                      <svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      {{ 'COMMUNITY.FEED_COMPOSER_PHOTO' | translate }}
                    </button>
                    <button type="button" (click)="showTripModal.set(true)" class="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:bg-slate-50 dark:hover:bg-gray-900/40 transition-colors">
                      <svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      {{ 'COMMUNITY.FEED_COMPOSER_TRIP' | translate }}
                    </button>
                                     </div>
                }
              </div>


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

      @if (showTripModal()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trip-share-modal-title"
          (click)="closeTripModal()"
        >
          <div
            class="no-scrollbar w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-2xl"
            (click)="$event.stopPropagation()"
          >
            <div class="sticky top-0 z-10 rounded-t-2xl bg-white dark:bg-gray-800 flex items-start justify-between gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-gray-700">
              <div class="flex items-center gap-2 min-w-0">
                @if (tripToShare()) {
                  <button
                    type="button"
                    (click)="backToTripPicker()"
                    class="w-7 h-7 rounded-lg border border-slate-200 dark:border-gray-600 flex items-center justify-center text-text-faint hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shrink-0"
                    [attr.aria-label]="'COMMUNITY.COMPOSER_MODAL.BACK_ARIA' | translate"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                  </button>
                }
                <h2 id="trip-share-modal-title" class="text-base font-extrabold text-text-primary truncate">{{ 'COMMUNITY.COMPOSER_MODAL.TYPE_TRIP' | translate }}</h2>
              </div>
              <button
                type="button"
                (click)="closeTripModal()"
                class="w-7 h-7 rounded-lg border border-slate-200 dark:border-gray-600 flex items-center justify-center text-text-faint hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shrink-0"
                [attr.aria-label]="'COMMUNITY.COMPOSER_MODAL.CLOSE_ARIA' | translate"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            @if (tripToShare(); as trip) {
              <div class="p-4 flex flex-col gap-3">
                <div class="flex items-center gap-3 p-2.5 rounded-xl bg-primary-50/50 border border-primary-subtle/40">
                  <div class="w-12 h-12 rounded-lg bg-cover bg-center shrink-0 bg-slate-100" [style.backgroundImage]="trip.image ? 'url(' + trip.image + ')' : null"></div>
                  <div class="min-w-0">
                    <p class="text-xs font-extrabold text-text-primary truncate">{{ trip.title }}</p>
                    <p class="text-[11px] font-medium text-text-faint truncate">{{ trip.destination }}@if (trip.days) { · {{ trip.days }}d }</p>
                  </div>
                </div>

                <textarea
                  [value]="tripShareCaption()"
                  (input)="tripShareCaption.set($any($event.target).value)"
                  [attr.placeholder]="'COMMUNITY.COMPOSER_MODAL.TRIP_STORY_PLACEHOLDER' | translate"
                  maxlength="500"
                  class="w-full h-24 px-3 py-2 bg-slate-50 dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-lg focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-medium text-text-primary resize-none"
                ></textarea>
              </div>

              <div class="sticky bottom-0 z-10 rounded-b-2xl bg-white dark:bg-gray-800 flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-100 dark:border-gray-700">
                <button
                  type="button"
                  (click)="closeTripModal()"
                  class="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-gray-600 text-xs font-bold text-text-secondary hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
                >{{ 'COMMUNITY.COMPOSER_MODAL.CANCEL' | translate }}</button>
                <button
                  type="button"
                  [disabled]="!tripShareCaption().trim() || tripShareSubmitting()"
                  (click)="submitTripShare()"
                  class="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
                >{{ 'COMMUNITY.COMPOSER_MODAL.SHARE_ITINERARY' | translate }}</button>
              </div>
            } @else {
              <div class="p-4 flex flex-col gap-2">
                @if (tripService.trips().length === 0) {
                  <p class="text-sm text-text-faint text-center py-8">{{ 'COMMUNITY.COMPOSER_MODAL.NO_TRIPS_TO_SHARE' | translate }}</p>
                }
                @for (trip of tripService.trips(); track trip.id) {
                  <button
                    type="button"
                    (click)="onTripPicked(trip)"
                    class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-gray-700 hover:border-primary-subtle/60 hover:bg-primary-50/40 dark:hover:bg-gray-700/40 transition-colors text-left focus:outline-none"
                  >
                    <div class="w-11 h-11 rounded-lg bg-cover bg-center shrink-0 bg-slate-100" [style.backgroundImage]="trip.image ? 'url(' + trip.image + ')' : null"></div>
                    <span class="flex-1 min-w-0">
                      <span class="block text-sm font-extrabold text-text-primary truncate">{{ trip.title }}</span>
                      <span class="block text-xs font-medium text-text-faint truncate">{{ trip.destination }}@if (trip.days) { · {{ trip.days }}d }</span>
                    </span>
                    <svg class="w-3.5 h-3.5 text-text-disabled shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                }
              </div>
            }
          </div>
        </div>
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

  // Inline feed composer (no modal): composerType is the selected type ('tip' | 'photo')
  // or null while the type-picker row is shown. Trip skips this entirely and opens the
  // existing composer modal directly (see showTripModal / openFeedComposer's caller).
  composerType = signal<string | null>(null);
  composerText = signal('');
  composerLocation = signal('');
  composerShowLocationSuggestions = signal(false);
  composerSubmitting = signal(false);
  // Trip picks from the user's OWN trips only (TripService.trips(), the same signal the
  // hero "next trip" card already reads — no public/community trips, no Clone/View
  // Itinerary actions, no free-text form, no location field), then adds a caption.
  showTripModal = signal(false);
  tripToShare = signal<SavedTrip | null>(null);
  tripShareCaption = signal('');
  tripShareSubmitting = signal(false);
  // Media state: only the 'photo' type uses these — Tip never reads them.
  composerImages = signal<{ file: File; url: string }[]>([]);
  composerVideoFile = signal<File | null>(null);
  composerVideoPreviewUrl = signal<string | null>(null);
  readonly composerEmojis = ['✨', '❤️', '🤩', '🌍', '📷', '🌞'];
  readonly composerMeta = computed(() => {
    const type = this.composerType();
    return type ? FEED_COMPOSER_TYPE_META[type] ?? null : null;
  });
  readonly composerHasMedia = computed(() => this.composerImages().length > 0 || !!this.composerVideoFile());
  readonly composerLocationSuggestions = computed(() => {
    const query = this.composerLocation().trim().toLowerCase();
    if (!query) return FEED_LOCATION_SUGGESTIONS;
    return FEED_LOCATION_SUGGESTIONS.filter(loc => loc.toLowerCase().includes(query));
  });
  readonly canSubmitComposer = computed(() => {
    if (this.composerSubmitting() || this.composerText().trim().length === 0) return false;
    const type = this.composerType();
    if (type === 'photo') return this.composerHasMedia();
    return true;
  });

  isLoadingFeed = false;
  errorLoadingFeed = false;
  viewMode: 'feed' | 'map' = 'feed';
  savePostId: string | null = null;

  toastMessage = signal<string | null>(null);

  expandedComments = new Set<string>();
  newPostsCount = signal<number>(0);

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
  tripService = inject(TripService);
  private collectionService = inject(CommunityCollectionService);
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  readonly user = this.auth.user;

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

  onTripPicked(trip: SavedTrip) {
    this.tripToShare.set(trip);
  }

  backToTripPicker() {
    this.tripToShare.set(null);
    this.tripShareCaption.set('');
  }

  closeTripModal() {
    this.showTripModal.set(false);
    this.tripToShare.set(null);
    this.tripShareCaption.set('');
  }

  submitTripShare() {
    const trip = this.tripToShare();
    const caption = this.tripShareCaption().trim();
    if (!trip || !caption || this.tripShareSubmitting()) return;

    this.tripShareSubmitting.set(true);
    this.postService.createPost({ caption, images: [], itinerary_id: trip.id }).subscribe({
      next: (post) => {
        this.tripShareSubmitting.set(false);
        this.onPostCreated(post);
        this.closeTripModal();
      },
      error: (err) => {
        this.tripShareSubmitting.set(false);
        this.showToast(apiErrorMessage(err, this.translate.instant('COMMUNITY.CREATE_POST.CREATE_FAILED')));
      },
    });
  }

  openFeedComposer(type: string) {
    this.composerType.set(type);
    this.composerText.set('');
    this.composerLocation.set('');
    this.composerShowLocationSuggestions.set(false);
    this.clearComposerMedia();
  }

  closeFeedComposer() {
    this.composerType.set(null);
    this.composerText.set('');
    this.composerLocation.set('');
    this.composerShowLocationSuggestions.set(false);
    this.clearComposerMedia();
  }

  insertComposerEmoji(emoji: string) {
    this.composerText.update(text => text + emoji);
  }

  onComposerLocationInput(value: string) {
    this.composerLocation.set(value);
    this.composerShowLocationSuggestions.set(true);
  }

  selectComposerLocation(location: string) {
    this.composerLocation.set(location);
    this.composerShowLocationSuggestions.set(false);
  }

  onComposerFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    Array.from(input.files).forEach(file => {
      if (file.type.startsWith('video/')) {
        const prevUrl = this.composerVideoPreviewUrl();
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        this.composerVideoFile.set(file);
        this.composerVideoPreviewUrl.set(URL.createObjectURL(file));
      } else {
        this.composerImages.update(imgs => [...imgs, { file, url: URL.createObjectURL(file) }]);
      }
    });
    input.value = '';
  }

  removeComposerImage(index: number): void {
    const imgs = this.composerImages();
    const removed = imgs[index];
    if (removed) URL.revokeObjectURL(removed.url);
    this.composerImages.set(imgs.filter((_, i) => i !== index));
  }

  removeComposerVideo(): void {
    const url = this.composerVideoPreviewUrl();
    if (url) URL.revokeObjectURL(url);
    this.composerVideoFile.set(null);
    this.composerVideoPreviewUrl.set(null);
  }

  private clearComposerMedia(): void {
    this.composerImages().forEach(img => URL.revokeObjectURL(img.url));
    this.composerImages.set([]);
    const videoUrl = this.composerVideoPreviewUrl();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    this.composerVideoFile.set(null);
    this.composerVideoPreviewUrl.set(null);
  }

  submitFeedComposer() {
    if (!this.canSubmitComposer()) return;

    const caption = this.composerText().trim();
    this.composerSubmitting.set(true);

    if (this.composerType() === 'photo') {
      const imageUploads = this.composerImages().map(img => this.postService.uploadImage(img.file));
      const video = this.composerVideoFile();
      const videoUpload = video ? this.postService.uploadImage(video) : of(null);

      forkJoin({
        images: imageUploads.length ? forkJoin(imageUploads) : of([] as { url: string }[]),
        video: videoUpload,
      }).subscribe({
        next: ({ images, video }) => {
          this.postService.createPost({
            caption,
            images: images.map(i => i.url),
            video_url: video?.url,
            is_reel: !!video,
          }).subscribe({
            next: (post) => {
              this.composerSubmitting.set(false);
              this.onPostCreated(post);
              this.closeFeedComposer();
            },
            error: (err) => {
              this.composerSubmitting.set(false);
              this.showToast(apiErrorMessage(err, this.translate.instant('COMMUNITY.CREATE_POST.CREATE_FAILED')));
            },
          });
        },
        error: () => {
          this.composerSubmitting.set(false);
          this.showToast(this.translate.instant('COMMUNITY.CREATE_POST.UPLOAD_FAILED'));
        },
      });
      return;
    }

    this.postService.createPost({ caption, images: [] }).subscribe({
      next: (post) => {
        this.composerSubmitting.set(false);
        this.onPostCreated(post);
        this.closeFeedComposer();
      },
      error: (err) => {
        this.composerSubmitting.set(false);
        this.showToast(apiErrorMessage(err, this.translate.instant('COMMUNITY.CREATE_POST.CREATE_FAILED')));
      },
    });
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
        return this.posts.filter(p => !p.itinerary && p.type !== 'qa' && !(p.images?.length));
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

    const prevFollowing = post.is_following;
    const prevFollowedAt = post.followed_at;
    post.is_following = !prevFollowing;
    post.followed_at = post.is_following ? new Date().toISOString() : null;

    this.profileService.toggleFollow(post.author.id).subscribe({
      next: (res) => {
        post.is_following = res.is_following;
        post.followed_at = res.followed_at ?? null;
      },
      error: () => {
        post.is_following = prevFollowing;
        post.followed_at = prevFollowedAt;
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
