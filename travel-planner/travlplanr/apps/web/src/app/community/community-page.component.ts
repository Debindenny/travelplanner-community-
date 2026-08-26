import { Component, OnInit, inject, signal, ViewChild, ElementRef, AfterViewInit, OnDestroy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommunityStoriesBarComponent } from './components/community-stories-bar.component';
import { CommunityFeedSkeletonComponent } from './components/community-feed-skeleton.component';
import { CommunityPostCommentsComponent } from './components/community-post-comments.component';
import { CommunityPostService, CommunityPost as CommunityPostType } from './services/community-post.service';
import { CommunityPostCardComponent } from './components/community-post-card.component';
import { CommunitySaveModalComponent } from './components/community-save-modal.component';
import { CommunityMapComponent } from './components/community-map.component';
import { CommunityHeroComponent } from './components/community-hero.component';
import { apiErrorMessage } from '../shared/utils/api-error.util';
import { CommunityMobileNavComponent } from './components/community-mobile-nav.component';
import { CommunityAnalyticsService } from './services/community-analytics.service';
import { AuthService } from '../auth/auth.service';
import { CommunityProfileService, MyCommunityProfile } from './services/community-profile.service';
import { CommunityNotificationsService } from './services/community-notifications.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityQaThreadComponent } from './components/community-qa-thread.component';
import { CommunityHomeSubnavComponent } from './components/community-home-subnav.component';
import { CommunityJourneyStatsComponent } from './components/community-journey-stats.component';
import { CommunityCrewWidgetComponent } from './components/community-crew-widget.component';
import { CommunityJoinRequestsComponent } from './components/community-join-requests.component';
import { CommunityTravelersRailComponent } from './components/community-travelers-rail.component';
import { CommunityDestinationTrendingComponent } from './components/community-destination-trending.component';
import { CommunityUpcomingEventsWidgetComponent } from './components/community-upcoming-events-widget.component';
import { CommunitySimilarTravelersComponent } from './components/community-similar-travelers.component';
import { CommunityComposerModalComponent } from './components/community-composer-modal.component';

type PostCategory = 'forYou' | 'following' | 'nearTrip' | 'questions' | 'tripPlans' | 'tips' | 'photos';

@Component({
    selector: 'app-community-page',
    imports: [
      CommonModule,
      RouterLink,
      CommunityStoriesBarComponent,
      CommunityPostCardComponent,
      CommunitySaveModalComponent,
      CommunityMapComponent,
      CommunityHeroComponent,
      CommunityMobileNavComponent,
      TranslatePipe,
      CommunityFeedSkeletonComponent,
      CommunityPostCommentsComponent,
      CommunityQaThreadComponent,
      CommunityHomeSubnavComponent,
      CommunityJourneyStatsComponent,
      CommunityCrewWidgetComponent,
      CommunityJoinRequestsComponent,
      CommunityTravelersRailComponent,
      CommunityDestinationTrendingComponent,
      CommunityUpcomingEventsWidgetComponent,
      CommunitySimilarTravelersComponent,
      CommunityComposerModalComponent,
    ],
    template: `
    <!-- font-manrope: the app-wide default (Poppins) is a rounded geometric face that
         reads visibly larger/heavier than this feature's reference design at the same
         px size. Manrope is already loaded at every weight this page uses (unlike Inter,
         which this project only has at 400/900) and is the same face the sibling
         Travel Circles/Trips island already uses for this lighter, tighter look. -->
    <div class="font-manrope min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 flex flex-col pb-0 md:pb-0">
      <app-community-mobile-nav (onPost)="showComposerModal.set(true)" />
      <main class="flex-1 flex justify-center pt-2 sm:pt-4 lg:pt-8 pb-4 sm:pb-6 lg:pb-8 px-4 sm:px-6">
        <div class="w-full max-w-[1400px] grid grid-cols-[minmax(170px,32%)_minmax(0,1fr)] lg:grid-cols-12 gap-3 sm:gap-6 items-start">

          <!-- LEFT COLUMN (Subnav + Journey). Spans every content row (Hero, Feed, Right
               rail) and stays sticky at every width — previously it only spanned row 1
               (paired with the Hero), so once the Feed/Right-rail's col-span-2 carried
               them under its column for their own full-width rows, the sidebar had
               already scrolled out of view with nothing left to stick against. -->
          <div class="flex flex-col row-span-3 lg:col-span-2 lg:row-span-2 sticky top-[92px] gap-3 sm:gap-5">
            <app-community-home-subnav (sharePost)="showComposerModal.set(true)" />
            <app-community-journey-stats />
          </div>

          <!-- TOP ROW: Hero + Stories, paired with the left nav at every width -->
          <div class="lg:col-span-10 space-y-3 sm:space-y-5">
            <!-- Hero band -->
            <app-community-hero
              (onPost)="showComposerModal.set(true)"
              (onMap)="setViewMode('map')"
            />

            <!-- Stories (edge-to-edge, no card wrapper) -->
            <app-community-stories-bar />
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

            <!-- The page already has a dedicated <footer> below for narrow layouts;
                 this compact inline footer is the lg+ sticky-rail variant only. -->
            <div class="hidden lg:block text-[11.5px] font-semibold text-text-faint leading-relaxed px-1">
              <div class="flex flex-wrap gap-x-3 gap-y-1">
                <a routerLink="/about" class="hover:text-primary hover:underline transition-colors">{{ 'COMMUNITY.FOOTER_ABOUT' | translate }}</a>
                <a routerLink="/help" class="hover:text-primary hover:underline transition-colors">{{ 'COMMUNITY.FOOTER_HELP' | translate }}</a>
                <a routerLink="/privacy" class="hover:text-primary hover:underline transition-colors">{{ 'COMMUNITY.FOOTER_PRIVACY' | translate }}</a>
                <a routerLink="/terms" class="hover:text-primary hover:underline transition-colors">{{ 'COMMUNITY.FOOTER_TERMS' | translate }}</a>
              </div>
              <p class="mt-1.5 text-[10.5px] font-semibold tracking-wide text-text-disabled">{{ 'COMMUNITY.FOOTER_COPYRIGHT' | translate }}</p>
            </div>
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

      <footer class="py-6 text-center">
        <div class="flex flex-wrap justify-center gap-x-4 gap-y-1 text-2xs-plus font-semibold text-text-tertiary">
          <a routerLink="/about" class="hover:text-primary hover:underline transition-colors">{{ 'COMMUNITY.FOOTER_ABOUT' | translate }}</a>
          <a routerLink="/help" class="hover:text-primary hover:underline transition-colors">{{ 'COMMUNITY.FOOTER_HELP' | translate }}</a>
          <a routerLink="/privacy" class="hover:text-primary hover:underline transition-colors">{{ 'COMMUNITY.FOOTER_PRIVACY' | translate }}</a>
          <a routerLink="/terms" class="hover:text-primary hover:underline transition-colors">{{ 'COMMUNITY.FOOTER_TERMS' | translate }}</a>
        </div>
        <p class="text-2xs text-text-disabled mt-1.5 uppercase tracking-wider font-semibold">{{ 'COMMUNITY.FOOTER_COPYRIGHT' | translate }}</p>
      </footer>
    </div>
  `,
    styles: [`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `]
})
export class CommunityPageComponent implements OnInit, AfterViewInit, OnDestroy {
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

  readonly auth = inject(AuthService);
  readonly user = this.auth.user;

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

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private wsSub?: Subscription;
  private destroyRef = inject(DestroyRef);
  /** Avoid re-navigating when applying state from the URL (back/forward). */
  private syncingFromUrl = false;

  private readonly translate = inject(TranslateService);

  constructor(
    private postService: CommunityPostService,
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
