import { Component, OnInit, inject, signal, OnDestroy, DestroyRef } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FooterSectionComponent } from '../../landing/components/footer-section/footer-section.component';
import { CommunityPostService, CommunityPost as CommunityPostType } from '../services/community-post.service';
import { CommunityPostCarouselComponent } from './community-post-carousel.component';
import { CommunityCommentService, Comment } from '../services/community-comment.service';
import { AuthService } from '../../auth/auth.service';
import { CommunityProfileService } from '../services/community-profile.service';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../shared/utils/toast.service';
import { apiErrorMessage } from '../../shared/utils/api-error.util';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';

const BUDGET_TIERS = ['budget', 'economy', 'standard', 'mid', 'premium', 'luxury'];

@Component({
    selector: 'app-community-post-detail',
    imports: [RouterLink, FooterSectionComponent, CommunityPostCarouselComponent, FormsModule, TranslatePipe, TimeAgoPipe],
    template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/20 flex flex-col">
      <main class="flex-1 flex justify-center py-8 px-4 sm:px-6">
        <div class="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-6 items-start animate-fade-in-up">
    
          <div class="col-span-1 md:col-span-12 space-y-4">
    
            <a routerLink="/community" class="inline-flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-primary transition-colors">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {{ 'COMMUNITY.POST_DETAIL.BACK_TO_COMMUNITY' | translate }}
            </a>
    
            @if (isLoading()) {
              <div class="bg-white/80 backdrop-blur-md border border-slate-100 rounded-2xl p-8 shadow-sm text-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            } @else if (post()) {
              <article class="bg-white/80 backdrop-blur-md border border-slate-100/80 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col md:flex-row hover:shadow-[0_12px_40px_rgba(0,96,234,0.06)] transition-all duration-300 relative">
    
                <!-- Interactive SVG Route Map Overlay -->
                @if (showRouteMap() && post()!.destination) {
                  <div class="absolute inset-x-4 top-16 bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-700/50 z-40 animate-fade-in text-white select-none">
                    <div class="flex justify-between items-center mb-2 px-1">
                      <span class="text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">{{ 'COMMUNITY.POST_CARD.ROUTE_VISUALIZER' | translate }}</span>
                      <span class="text-[9px] font-extrabold text-primary uppercase">{{ 'COMMUNITY.POST_CARD.DIRECT_ROUTE' | translate }}</span>
                    </div>
                    <div class="relative h-20 bg-slate-950/40 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
                      <svg class="w-full h-full" viewBox="0 0 300 80">
                        <path d="M 50 55 Q 150 15 250 55" fill="none" stroke-width="2" stroke-dasharray="5,5" class="stroke-primary animate-[dash_4s_linear_infinite]" />
                        <g class="animate-[planeMove_4s_ease-in-out_infinite]" style="offset-path: path('M 50 55 Q 150 15 250 55'); offset-rotate: auto;">
                          <text x="-6" y="4" font-size="12" class="fill-sky-400">✈️</text>
                        </g>
                        <circle cx="50" cy="55" r="3.5" class="fill-rose-500" />
                        <text x="35" y="70" font-size="8" font-weight="bold" class="fill-slate-400">{{ 'COMMUNITY.POST_CARD.ROUTE_DEP' | translate }}</text>
                        <circle cx="250" cy="55" r="3.5" class="fill-emerald-500" />
                        <text x="235" y="70" font-size="8" font-weight="bold" class="fill-slate-400">{{ 'COMMUNITY.POST_CARD.ROUTE_ARR' | translate }}</text>
                        <text x="110" y="72" font-size="8" class="fill-slate-500">{{ 'COMMUNITY.POST_CARD.ROUTE_LABEL' | translate: { name: post()!.destination!.name } }}</text>
                      </svg>
                    </div>
                  </div>
                }
    
                <!-- Left: Image Carousel -->
                <div class="w-full md:w-[55%] bg-slate-950 flex items-center justify-center border-r border-slate-100/50 relative group">
                  <app-community-post-carousel [images]="post()!.images" class="w-full" />
    
                  <!-- Ambient Soundscape Player Overlay -->
                  @if (getSoundscape() !== 'none') {
                    <button
                      (click)="toggleAudio($event)"
                      class="absolute bottom-4 right-4 z-20 w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95 border border-slate-700/50 focus:outline-none"
                      [title]="(isPlayingAudio() ? 'COMMUNITY.POST_CARD.MUTE_SOUNDSCAPE' : 'COMMUNITY.POST_CARD.LISTEN_SOUNDSCAPE') | translate"
                      >
                      @if (isPlayingAudio()) {
                        <!-- Animated Soundwave bars -->
                        <div class="flex items-end gap-[1.5px] h-3 select-none text-primary">
                          <span class="w-[2px] bg-primary rounded-full animate-[soundwave_0.8s_ease-in-out_infinite_alternate] h-3"></span>
                          <span class="w-[2px] bg-primary rounded-full animate-[soundwave_0.5s_ease-in-out_infinite_alternate_0.15s] h-3"></span>
                          <span class="w-[2px] bg-primary rounded-full animate-[soundwave_1.1s_ease-in-out_infinite_alternate_0.3s] h-3"></span>
                        </div>
                      } @else {
                        <!-- Muted Speaker SVG -->
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                        </svg>
                      }
                    </button>
                  }
                </div>
    
                <!-- Right: Content & Comments -->
                <div class="w-full md:w-[45%] flex flex-col h-[600px] text-slate-900 bg-white/20">
                  <!-- Post Header -->
                  <div class="flex items-start justify-between p-4 border-b border-slate-100 shrink-0">
                    <div class="flex items-center gap-3">
                      <a [routerLink]="['/community/users', post()!.author.id]" class="block shrink-0">
                        <img [src]="post()!.author.avatar || '/assets/images/default-avatar.svg'" class="w-12 h-12 rounded-full object-cover border border-slate-100 shadow-sm" />
                      </a>
                      <div class="min-w-0">
                        <a [routerLink]="['/community/users', post()!.author.id]" class="font-extrabold text-sm text-text-primary hover:text-primary hover:underline flex items-center gap-1.5 flex-wrap">
                          {{ post()!.author.name }}
                          @if (post()!.author.is_verified) {
                            <span class="text-primary flex items-center" [title]="'COMMUNITY.VERIFIED_BADGE' | translate">
                              <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L9 10.586l3.293-3.293a1 1 0 111.414 1.414z" clip-rule="evenodd" fill-rule="evenodd"></path></svg>
                            </span>
                          }
                          @if (post()!.author.countries_visited && post()!.author.countries_visited! >= 5) {
                            <span class="bg-amber-50 text-amber-800 text-2xs px-2 py-0.5 rounded-full font-bold border border-amber-200/50 shrink-0" [title]="'COMMUNITY.POST_DETAIL.COUNTRIES_VISITED_TITLE' | translate: { count: post()!.author.countries_visited }">
                              🎒 {{ post()!.author.countries_visited }}
                            </span>
                          }
                          @if (post()!.author.local_in) {
                            <span class="bg-emerald-50 text-emerald-800 text-2xs px-2 py-0.5 rounded-full font-bold border border-emerald-200/50 shrink-0" [title]="'COMMUNITY.POST_DETAIL.LOCAL_IN_TITLE' | translate: { place: post()!.author.local_in }">
                              📍 {{ post()!.author.local_in }}
                            </span>
                          }
                        </a>
                        <p class="text-xs text-text-secondary flex items-center gap-1.5 flex-wrap mt-0.5">
                          {{ post()!.location }}
                          @if (post()!.destination) {
                            <span
                              (mouseenter)="showRouteMap.set(true)"
                              (mouseleave)="showRouteMap.set(false)"
                              class="inline-flex items-center gap-1.5 bg-primary-50 hover:bg-primary-subtle text-primary border border-primary-subtle/50 px-2.5 py-0.5 rounded-full text-2xs-plus font-bold cursor-pointer transition-all hover:scale-102"
                              [routerLink]="['/destinations', post()!.destination!.id]"
                              >
                              <svg class="w-3 h-3 text-primary fill-current" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                              </svg>
                              @if (post()!.destination!.latitude && post()!.destination!.longitude) {
                                <img
                                  [src]="'https://static-maps.yandex.ru/1.x/?ll=' + post()!.destination!.longitude + ',' + post()!.destination!.latitude + '&z=10&l=map&size=60,60'"
                                  [alt]="'COMMUNITY.MAP_VIEW' | translate"
                                  class="w-4.5 h-4.5 rounded-full object-cover border border-primary-subtle/60 shrink-0"
                                  loading="lazy"
                                  decoding="async"
                                  />
                              }
                              {{ post()!.destination!.name }}
                            </span>
                          }
                        </p>
                      </div>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <button
                        (click)="toggleFollow()"
                        [class.text-primary]="!post()!.is_following"
                        [class.bg-primary-50]="!post()!.is_following"
                        [class.text-text-tertiary]="post()!.is_following"
                        [class.bg-slate-100]="post()!.is_following"
                        class="px-3 py-1 rounded-full text-xs font-bold transition-all hover:scale-102 focus:outline-none"
                        >
                        {{ post()!.is_following ? ('COMMUNITY.FOLLOWING' | translate) : ('COMMUNITY.POST_DETAIL.FOLLOW_BUTTON' | translate) }}
                      </button>
    
                      @if (isAuthor()) {
                        <div class="relative">
                          <button (click)="showOptionsMenu = !showOptionsMenu" class="text-text-tertiary hover:bg-slate-100 p-1.5 rounded-full transition-colors focus:outline-none">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                          </button>
                          @if (showOptionsMenu) {
                            <div class="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-lg z-50 border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                              <button (click)="startEdit()" class="w-full text-left px-4 py-2 text-xs font-bold text-text-secondary hover:bg-slate-50 transition-colors">{{ 'COMMUNITY.POST_DETAIL.EDIT_POST' | translate }}</button>
                              <button (click)="confirmDelete()" class="w-full text-left px-4 py-2 text-xs font-bold text-danger hover:bg-danger-50 transition-colors">{{ 'COMMUNITY.POST_DETAIL.DELETE' | translate }}</button>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
    
                  <!-- Comments Area (Scrollable) -->
                  <div class="flex-1 overflow-y-auto p-4 space-y-4">
                    <!-- Caption as first comment-like block -->
                    <div class="flex gap-3">
                      <img [src]="post()!.author.avatar || '/assets/images/default-avatar.svg'" class="w-9 h-9 rounded-full object-cover border border-slate-100 shrink-0" loading="lazy" decoding="async" />
                      <div class="flex-1 min-w-0">
                        @if (!isEditing) {
                          <span class="text-sm text-text-primary leading-relaxed">
                            <a [routerLink]="['/community/users', post()!.author.id]" class="font-extrabold mr-1.5 hover:underline">{{ post()!.author.name }}</a>
                            @for (token of getCaptionTokens(getDisplayCaption()); track $index) {
                              @if (token.type === 'hashtag') {
                                <span [routerLink]="['/community']" [queryParams]="{mode: 'hashtag-' + token.value.replace('#', '')}" class="text-primary font-bold hover:underline cursor-pointer mr-1.5">{{ token.value }}</span>
                              } @else {
                                <span>{{ token.value }}</span>
                              }
                            }
                          </span>
                          <p class="text-2xs text-text-tertiary mt-1">{{ post()!.timeAgo | timeAgo }}</p>
                        }
                        @if (isEditing) {
                          <textarea [(ngModel)]="editCaption" class="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-4 focus:ring-primary/10" rows="3"></textarea>
                          <input type="text" [(ngModel)]="editLocation" class="w-full border border-slate-200 rounded-xl px-3 py-2 mt-2 text-xs font-semibold focus:ring-4 focus:ring-primary/10" [placeholder]="'COMMUNITY.POST_DETAIL.LOCATION_PLACEHOLDER' | translate" />
                          <div class="flex justify-end gap-2 mt-2">
                            <button (click)="cancelEdit()" class="px-4 py-1.5 text-xs text-text-secondary hover:bg-slate-100 rounded-full font-bold transition-all">{{ 'COMMUNITY.POST_DETAIL.CANCEL' | translate }}</button>
                            <button (click)="saveEdit()" class="px-4 py-1.5 text-xs bg-primary hover:bg-primary-hover text-white rounded-full font-bold transition-all">{{ 'COMMUNITY.POST_DETAIL.SAVE' | translate }}</button>
                          </div>
                        }
                      </div>
                    </div>
    
                    <!-- Attached Itinerary Preview (Boarding Pass Design) -->
                    @if (post()!.itinerary) {
                      <div class="border border-slate-100 bg-slate-50/50 rounded-2xl flex flex-col p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                        <!-- Notch indicators -->
                        <div class="absolute left-0 top-[40%] -translate-y-1/2 w-2.5 h-5 bg-white border border-slate-100 border-l-0 rounded-r-full shadow-inner"></div>
                        <div class="absolute right-0 top-[40%] -translate-y-1/2 w-2.5 h-5 bg-white border border-slate-100 border-r-0 rounded-l-full shadow-inner"></div>
    
                        <div class="flex items-center gap-3">
                          <img
                            [src]="post()!.itinerary!.image || 'assets/images/landing/journey-thailand.jpg'"
                            [alt]="'COMMUNITY.POST_DETAIL.ITINERARY_THUMBNAIL_ALT' | translate"
                            class="w-12 h-12 rounded-xl object-cover bg-slate-200 border border-slate-100 shadow-sm shrink-0"
                            loading="lazy"
                            decoding="async"
                            />
                          <div class="flex-1 min-w-0">
                            <h4 class="font-extrabold text-xs text-text-primary truncate">{{ post()!.itinerary!.title }}</h4>
                            <p class="text-2xs text-text-secondary mt-0.5 truncate">{{ post()!.itinerary!.destination }}</p>
                          </div>
                        </div>
                        <div class="flex justify-between items-center mt-3 pt-2.5 border-t border-dashed border-slate-200">
                          <span class="text-2xs font-bold text-primary flex items-center gap-1.5">
                            <span class="bg-primary-50 px-2 py-0.5 rounded-full border border-primary-subtle/50 shadow-sm">
                              {{ 'COMMUNITY.POST_DETAIL.DAYS_LABEL' | translate: { count: post()!.itinerary!.days.length || 0 } }}
                            </span>
                            <span class="text-text-secondary">
                              {{ 'COMMUNITY.POST_CARD.BUDGET_LABEL' | translate }}
                              @if (getBudgetTierKey(post()!.itinerary!.budget); as tierKey) {
                                <span class="text-text-primary font-bold">{{ tierKey | translate }}</span>
                              } @else {
                                <span class="text-text-primary font-bold">{{ post()!.itinerary!.budget }}</span>
                              }
                            </span>
                          </span>
                          <div class="flex items-center gap-1.5">
                            <button
                              (click)="toggleBudgetBreakdown($event)"
                              class="border border-slate-200 text-text-secondary hover:bg-slate-50 text-[9px] font-bold px-2 py-1.5 rounded-xl transition-all focus:outline-none"
                              >
                              {{ (showBudgetBreakdown() ? 'COMMUNITY.POST_DETAIL.HIDE_SPEND' : 'COMMUNITY.POST_DETAIL.VIEW_SPEND') | translate }}
                            </button>
                            <button
                              (click)="cloneTrip(post()!.itinerary!.id)"
                              class="bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-700 text-white text-2xs font-extrabold px-3 py-1.5 rounded-xl transition-all shadow-sm shrink-0"
                              >
                              {{ 'COMMUNITY.POST_DETAIL.CLONE_TRIP' | translate }}
                            </button>
                          </div>
                        </div>
    
                        <!-- Collapsible budget drawer -->
                        @if (showBudgetBreakdown()) {
                          <div class="mt-4 pt-3 border-t border-slate-100 space-y-3 animate-fade-in-up text-2xs-plus select-none">
                            <div class="flex justify-between font-extrabold text-text-primary">
                              <span>{{ 'COMMUNITY.POST_DETAIL.SPEND_BREAKDOWN' | translate }}</span>
                              <span class="text-primary font-black">{{ 'COMMUNITY.POST_DETAIL.SPEND_SAVED_PCT' | translate: { pct: 25 } }}</span>
                            </div>
                            <div class="space-y-2">
                              <div>
                                <div class="flex justify-between text-[9px] text-text-secondary font-bold mb-0.5">
                                  <span>{{ 'COMMUNITY.POST_DETAIL.SPEND_ACCOMMODATION' | translate }}</span>
                                  <span>{{ 'COMMUNITY.POST_DETAIL.SPEND_VS_AVG' | translate: { amount: '$320', avg: '$450' } }}</span>
                                </div>
                                <div class="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden">
                                  <div class="bg-emerald-500 h-full rounded-full" style="width: 71%"></div>
                                </div>
                              </div>
                              <div>
                                <div class="flex justify-between text-[9px] text-text-secondary font-bold mb-0.5">
                                  <span>{{ 'COMMUNITY.POST_DETAIL.SPEND_TRANSPORT' | translate }}</span>
                                  <span>{{ 'COMMUNITY.POST_DETAIL.SPEND_VS_AVG' | translate: { amount: '$450', avg: '$600' } }}</span>
                                </div>
                                <div class="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden">
                                  <div class="bg-emerald-500 h-full rounded-full" style="width: 75%"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        }
                      </div>
                    }
    
                    <hr class="border-slate-100" />
    
                    @if (isLoadingComments()) {
                      <div class="text-center py-4">
                        <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto"></div>
                      </div>
                    } @else if (comments().length === 0) {
                      <p class="text-sm text-text-tertiary text-center py-4">{{ 'COMMUNITY.NO_COMMENTS_YET' | translate }}</p>
                    } @else {
                      @for (comment of comments(); track comment.id) {
                        <div class="flex gap-2.5 animate-fade-in-up">
                          <img [src]="comment.author_avatar || '/assets/images/default-avatar.svg'" class="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-100" loading="lazy" decoding="async" />
                          <div class="bg-slate-50 border border-slate-100 rounded-bl-xl rounded-r-xl px-3 py-2 flex-1 hover:bg-slate-100/50 transition-colors">
                            <span class="font-extrabold text-xs text-text-primary">{{ comment.author_name }}</span>
                            <p class="text-sm text-text-secondary mt-0.5 leading-relaxed">{{ comment.content }}</p>
                          </div>
                        </div>
                      }
                    }
    
                    <div class="flex items-center gap-4 mb-3 border-t border-slate-100 pt-3">
                      <div class="relative flex items-center">
                        @if (activeReactionPostId() === post()!.id) {
                          <div
                            (mouseleave)="activeReactionPostId.set(null)"
                            class="absolute bottom-full mb-3 left-0 bg-white/90 backdrop-blur-md border border-slate-100/80 rounded-full shadow-[0_10px_30px_rgba(0,96,234,0.12)] px-2.5 py-1.5 flex gap-1 z-35 animate-[fadeInUp_0.2s_ease-out_backwards]"
                            >
                            <button (click)="reactPost('like')" class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 hover:scale-130 active:scale-95 transition-all duration-200 text-xl" [title]="'COMMUNITY.POST_DETAIL.REACTION_LIKE' | translate">👍</button>
                            <button (click)="reactPost('wanderlust')" class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-blue-50 hover:scale-130 active:scale-95 transition-all duration-200 text-xl" [title]="'COMMUNITY.POST_DETAIL.REACTION_WANDERLUST' | translate">😍</button>
                            <button (click)="reactPost('been_there')" class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-emerald-50 hover:scale-130 active:scale-95 transition-all duration-200 text-xl" [title]="'COMMUNITY.POST_DETAIL.REACTION_BEEN_THERE' | translate">🧭</button>
                            <button (click)="reactPost('bucket_list')" class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-amber-50 hover:scale-130 active:scale-95 transition-all duration-200 text-xl" [title]="'COMMUNITY.POST_DETAIL.REACTION_BUCKET_LIST' | translate">🔖</button>
                            <button (click)="reactPost('take_me_here')" class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-indigo-50 hover:scale-130 active:scale-95 transition-all duration-200 text-xl" [title]="'COMMUNITY.POST_DETAIL.REACTION_TAKE_ME_HERE' | translate">✈️</button>
                          </div>
                        }
                        <button
                          (mouseenter)="activeReactionPostId.set(post()!.id)"
                          (click)="toggleLike()"
                          class="flex items-center justify-center p-2 rounded-xl text-text-secondary hover:bg-slate-50 transition-colors focus:outline-none"
                          [class.text-primary]="post()!.isLiked"
                          >
                          @if (post()!.userReaction) {
                            <span class="text-lg animate-[ping_0.5s_cubic-bezier(0,0,0.2,1)_1]">{{ getReactionEmoji(post()!.userReaction!) }}</span>
                          } @else {
                            <svg class="w-5.5 h-5.5" [attr.fill]="post()!.isLiked ? 'currentColor' : 'none'" viewBox="0 0 24 24" [attr.stroke]="post()!.isLiked ? 'none' : 'currentColor'" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                            </svg>
                          }
                        </button>
                      </div>
                      <button class="flex items-center justify-center p-2 rounded-xl text-text-secondary hover:bg-slate-50 transition-colors focus:outline-none">
                        <svg class="w-5.5 h-5.5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </button>
                      <button (click)="sharePost()" class="flex items-center justify-center p-2 rounded-xl text-text-secondary hover:bg-slate-50 transition-colors focus:outline-none">
                        <svg class="w-5.5 h-5.5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                    </div>
    
                    <div class="flex items-center gap-2 mb-3">
                      <div class="flex items-center -space-x-1.5">
                        @for (react of getTopReactions(post()!.reactions); track react) {
                          <span class="text-xs inline-block bg-white border border-slate-150 rounded-full w-5.5 h-5.5 flex items-center justify-center shadow-sm relative z-10 select-none cursor-help" [title]="react">
                            {{ getReactionEmoji(react) }}
                          </span>
                        }
                      </div>
                      <p class="font-bold text-xs text-text-primary ml-1 hover:text-primary transition-colors cursor-pointer">{{ 'COMMUNITY.POST_DETAIL.REACTIONS_COUNT' | translate: { count: post()!.likes } }}</p>
                    </div>
    
                    <!-- Comment Input -->
                    <div class="flex items-center gap-2 mt-2">
                      <div class="flex-1 bg-slate-50 border border-slate-200 rounded-full flex items-center px-4 py-2 focus-within:border-slate-350 transition-colors shadow-sm">
                        <input
                          type="text"
                          [placeholder]="'COMMUNITY.ADD_COMMENT_PLACEHOLDER' | translate"
                          class="flex-1 text-sm bg-transparent border-none outline-none focus:ring-0 placeholder-text-disabled"
                          #commentInput
                          (keyup.enter)="submitComment(commentInput.value, commentInput)"
                          />
                      </div>
                      <button
                        (click)="submitComment(commentInput.value, commentInput)"
                        [disabled]="isSubmittingComment()"
                        class="text-primary font-bold text-xs bg-primary-50 hover:bg-primary-subtle border border-primary-subtle/50 px-4 py-2.5 rounded-full transition-all disabled:opacity-50"
                        >
                        {{ 'COMMUNITY.POST_DETAIL.COMMENT_SUBMIT' | translate }}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            } @else {
              <div class="bg-white border border-gray-200 rounded-xl p-8 shadow-sm text-center">
                <h3 class="text-gray-900 font-semibold mb-1">{{ 'COMMUNITY.POST_DETAIL.POST_NOT_FOUND' | translate }}</h3>
                <p class="text-gray-500 text-sm">{{ 'COMMUNITY.POST_DETAIL.POST_NOT_FOUND_DESC' | translate }}</p>
              </div>
            }
          </div>
        </div>
      </main>
    
      @if (confirmingDelete()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 class="text-xl font-bold text-gray-900">{{ 'COMMUNITY.POST_DETAIL.DELETE_CONFIRM_TITLE' | translate }}</h2>
            <p class="mt-2 text-gray-600">{{ 'COMMUNITY.POST_DETAIL.DELETE_CONFIRM_MESSAGE' | translate }}</p>
            <div class="mt-6 flex justify-end gap-3">
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                (click)="confirmingDelete.set(false)"
                >
                {{ 'COMMUNITY.POST_DETAIL.CANCEL' | translate }}
              </button>
              <button
                type="button"
                class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                (click)="deletePost()"
                >
                {{ 'COMMUNITY.POST_DETAIL.DELETE' | translate }}
              </button>
            </div>
          </div>
        </div>
      }
    
      <app-footer-section />
    </div>
    `,
    styles: [`
    @keyframes soundwave {
      0% { height: 3px; }
      100% { height: 12px; }
    }
    @keyframes dash {
      to { stroke-dashoffset: -20; }
    }
    @keyframes planeMove {
      0% { offset-distance: 0%; }
      100% { offset-distance: 100%; }
    }
  `]
})
export class CommunityPostDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private postService = inject(CommunityPostService);
  private commentService = inject(CommunityCommentService);
  private profileService = inject(CommunityProfileService);
  private router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly user = this.auth.user;
  private destroyRef = inject(DestroyRef);

  showOptionsMenu = false;
  isEditing = false;
  editCaption = '';
  editLocation = '';

  showRouteMap = signal(false);
  showBudgetBreakdown = signal(false);
  isPlayingAudio = signal(false);
  audioElement?: HTMLAudioElement;

  isAuthor(): boolean {
    return this.post()?.author?.id === this.user()?.id;
  }

  postId = signal<string | null>(null);
  post = signal<CommunityPostType | null>(null);
  isLoading = signal<boolean>(true);

  comments = signal<Comment[]>([]);
  isLoadingComments = signal<boolean>(false);
  isSubmittingComment = signal<boolean>(false);

  activeReactionPostId = signal<string | null>(null);
  confirmingDelete = signal<boolean>(false);

  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.postId.set(id);
        this.loadPost(id);
        this.loadComments(id);
      } else {
        this.isLoading.set(false);
      }
    });
  }

  loadPost(id: string) {
    this.isLoading.set(true);
    this.postService.getPostById(id).subscribe({
      next: (found) => {
        this.post.set(found);
        this.isLoading.set(false);
        this.postService.viewPost(id).subscribe({
          next: () => {
            const currentPost = this.post();
            if (currentPost) {
              currentPost.views_count = (currentPost.views_count || 0) + 1;
              this.post.set({...currentPost});
            }
          }
        });
      },
      error: (err) => {
        console.error('Failed to load post', err);
        this.post.set(null);
        this.isLoading.set(false);
      }
    });
  }

  loadComments(id: string) {
    this.isLoadingComments.set(true);
    this.commentService.getComments(id).subscribe({
      next: (data) => {
        this.comments.set(data.comments);
        this.isLoadingComments.set(false);
      },
      error: () => {
        this.isLoadingComments.set(false);
      }
    });
  }

  toggleLike() {
    const currentPost = this.post();
    if (!currentPost) return;

    this.postService.toggleReaction(currentPost.id, 'like').subscribe({
      next: (response) => {
        currentPost.isLiked = response.reaction !== null;
        currentPost.likes = response.likes_count;
        currentPost.reactions = response.reactions;
        currentPost.userReaction = response.reaction;
        this.post.set({...currentPost});
      },
      error: () => {
        currentPost.isLiked = !currentPost.isLiked;
        currentPost.likes += currentPost.isLiked ? 1 : -1;
        this.post.set({...currentPost});
      }
    });

    currentPost.isLiked = !currentPost.isLiked;
    currentPost.likes += currentPost.isLiked ? 1 : -1;
    this.post.set({...currentPost});
  }


  toggleFollow() {
    const currentPost = this.post();
    if (!currentPost || !currentPost.author?.id) return;

    currentPost.is_following = !currentPost.is_following;
    this.post.set({...currentPost});

    this.profileService.toggleFollow(currentPost.author.id).subscribe({
      next: (res) => {
        currentPost.is_following = res.is_following;
        this.post.set({...currentPost});
      },
      error: () => {
        currentPost.is_following = !currentPost.is_following;
        this.post.set({...currentPost});
        this.toast.error(this.translate.instant('COMMUNITY.TOAST_FOLLOW_ERROR'));
      }
    });
  }

  sharePost() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: this.translate.instant('COMMUNITY.POST_DETAIL.SHARE_TITLE'),
        url: url
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url).then(() => {
        this.toast.success(this.translate.instant('COMMUNITY.POST_DETAIL.TOAST_LINK_COPIED'));
      });
    }
  }

  submitComment(content: string, inputElement?: HTMLInputElement) {
    const currentPost = this.post();
    if (!content?.trim() || !currentPost) return;

    this.isSubmittingComment.set(true);
    this.commentService.createComment(currentPost.id, content.trim()).subscribe({
      next: (comment) => {
        this.comments.update(c => [comment, ...c]);

        if (inputElement) {
          inputElement.value = '';
        }

        currentPost.comments++;
        this.post.set({...currentPost});
        this.isSubmittingComment.set(false);
      },
      error: () => {
        this.isSubmittingComment.set(false);
        this.toast.error(this.translate.instant('COMMUNITY.POST_DETAIL.TOAST_COMMENT_ERROR'));
      }
    });
  }

  getCaptionTokens(caption: string): { type: 'text' | 'hashtag', value: string }[] {
    if (!caption) return [];
    const parts = caption.split(/(\s+)/);
    return parts.map(part => {
      if (part.startsWith('#') && part.length > 1) {
        return { type: 'hashtag' as const, value: part };
      }
      return { type: 'text' as const, value: part };
    });
  }

  cloneTrip(tripId: string) {
    this.postService.cloneTrip(tripId).subscribe({
      next: (res) => {
        this.toast.success(this.translate.instant('COMMUNITY.TOAST_CLONE_SUCCESS'));
      },
      error: (err) => {
        console.error('Failed to clone trip:', err);
        this.toast.error(apiErrorMessage(err, this.translate.instant('COMMUNITY.TOAST_CLONE_ERROR')));
      }
    });
  }

  startEdit() {
    this.showOptionsMenu = false;
    this.isEditing = true;
    this.editCaption = this.post()?.caption || '';
    this.editLocation = this.post()?.location || '';
  }

  cancelEdit() {
    this.isEditing = false;
  }

  saveEdit() {
    const p = this.post();
    if (!p) return;
    this.postService.updatePost(p.id, { caption: this.editCaption, location: this.editLocation }).subscribe({
      next: (res) => {
        p.caption = res.caption;
        p.location = res.location;
        this.post.set({...p});
        this.isEditing = false;
        this.toast.success(this.translate.instant('COMMUNITY.POST_DETAIL.TOAST_POST_UPDATED'));
      },
      error: () => {
        this.toast.error(this.translate.instant('COMMUNITY.POST_DETAIL.TOAST_POST_UPDATE_ERROR'));
      }
    });
  }

  confirmDelete() {
    this.showOptionsMenu = false;
    this.confirmingDelete.set(true);
  }

  deletePost() {
    this.confirmingDelete.set(false);
    const p = this.post();
    if (!p) return;
    this.postService.deletePost(p.id).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('COMMUNITY.POST_DETAIL.TOAST_POST_DELETED'));
        this.router.navigate(['/community']);
      },
      error: () => {
        this.toast.error(this.translate.instant('COMMUNITY.POST_DETAIL.TOAST_POST_DELETE_ERROR'));
      }
    });
  }

  reactPost(type: string) {
    const currentPost = this.post();
    if (!currentPost) return;

    this.postService.toggleReaction(currentPost.id, type).subscribe({
      next: (res) => {
        currentPost.isLiked = res.reaction !== null;
        currentPost.likes = res.likes_count;
        currentPost.reactions = res.reactions;
        currentPost.userReaction = res.reaction;
        this.post.set({...currentPost});
        this.activeReactionPostId.set(null);
      },
      error: (err) => {
        console.error('Failed to react:', err);
        this.toast.error(this.translate.instant('COMMUNITY.POST_DETAIL.TOAST_REACTION_ERROR'));
      }
    });
  }

  getReactionEmoji(reaction: string): string {
    const emojis: { [key: string]: string } = {
      'like': '👍',
      'wanderlust': '😍',
      'been_there': '🧭',
      'bucket_list': '🔖',
      'take_me_here': '✈️'
    };
    return emojis[reaction] || '👍';
  }

  getTopReactions(reactions: { [key: string]: number } | undefined): string[] {
    if (!reactions) return [];
    return Object.entries(reactions)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type)
      .slice(0, 3);
  }

  /**
   * `itinerary.budget` is a plan-tier keyword (e.g. "budget"/"mid"/"luxury"), not a price.
   * Returns the translation key for a known tier, or null so the template can fall back
   * to displaying the raw value.
   */
  getBudgetTierKey(budget: string | null | undefined): string | null {
    if (!budget) return null;
    const key = budget.toLowerCase();
    if (!BUDGET_TIERS.includes(key)) return null;
    return `COMMUNITY.POST_DETAIL.BUDGET_TIER_${key.toUpperCase()}`;
  }

  formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return this.translate.instant('COMMUNITY.DATE_JUST_NOW');
    if (diffMins < 60) return this.translate.instant('COMMUNITY.DATE_MINUTES_AGO', { n: diffMins });
    if (diffHours < 24) return this.translate.instant('COMMUNITY.DATE_HOURS_AGO', { n: diffHours });
    if (diffDays < 7) return this.translate.instant('COMMUNITY.DATE_DAYS_AGO', { n: diffDays });

    return date.toLocaleDateString();
  }

  getSoundscape(): string {
    const p = this.post();
    if (!p) return 'none';
    const caption = p.caption || '';
    const match = caption.match(/\[soundscape:([a-z_]+)\]/);
    return match ? match[1] : 'none';
  }

  getDisplayCaption(): string {
    const p = this.post();
    if (!p) return '';
    const caption = p.caption || '';
    return caption.replace(/\[soundscape:[a-z_]+\]/, '').trim();
  }

  toggleAudio(event: Event) {
    event.stopPropagation();
    const sound = this.getSoundscape();
    if (sound === 'none') return;
    
    if (this.isPlayingAudio()) {
      this.stopAudio();
    } else {
      this.playAudio(sound);
    }
  }

  private playAudio(sound: string) {
    this.stopAudio();
    let url = '';
    if (sound === 'kyoto_rain') url = 'https://assets.mixkit.co/active_storage/sfx/2526/2526-84.wav';
    if (sound === 'bali_beach') url = 'https://assets.mixkit.co/active_storage/sfx/1230/1230-84.wav';
    if (sound === 'paris_cafe') url = 'https://assets.mixkit.co/active_storage/sfx/2650/2650-84.wav';
    
    if (!url) return;
    this.audioElement = new Audio(url);
    this.audioElement.loop = true;
    this.audioElement.volume = 0.4;
    this.audioElement.play().catch(e => console.log('Audio autoplay blocked', e));
    this.isPlayingAudio.set(true);
  }

  private stopAudio() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = undefined;
    }
    this.isPlayingAudio.set(false);
  }

  toggleBudgetBreakdown(event: Event) {
    event.stopPropagation();
    this.showBudgetBreakdown.set(!this.showBudgetBreakdown());
  }

  ngOnDestroy() {
    this.stopAudio();
  }
}
