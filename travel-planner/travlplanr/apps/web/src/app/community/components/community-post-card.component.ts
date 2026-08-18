import { Component, Input, Output, EventEmitter, inject, signal, OnDestroy } from '@angular/core';

import { RouterLink, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityPostCarouselComponent } from './community-post-carousel.component';
import { CommunityPostService } from '../services/community-post.service';
import { AuthService } from '../../auth/auth.service';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../shared/utils/toast.service';
import { CommunityLevelBadgeComponent } from './community-level-badge.component';
import { CommunityPollComponent } from './community-poll.component';
import { CommunityQaThreadComponent } from './community-qa-thread.component';
import { CommunityReportModalComponent } from './community-report-modal.component';
import { A11yModule } from '@angular/cdk/a11y';

@Component({
    selector: 'app-community-post-card',
    imports: [RouterLink, CommunityPostCarouselComponent, FormsModule, TranslatePipe, CommunityLevelBadgeComponent, CommunityPollComponent, CommunityQaThreadComponent, CommunityReportModalComponent, A11yModule],
    template: `
    <article class="bg-white/80 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl overflow-hidden border border-slate-100/80 dark:border-gray-700/80 shadow-[inset_0_0_20px_rgba(0,0,0,0.01),0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_40px_rgba(0,96,234,0.06)] hover:scale-[1.005] transition-all duration-300 relative">
    
      <!-- Interactive SVG Route Map Overlay -->
      @if (showRouteMap() && post.destination) {
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
              <text x="110" y="72" font-size="8" class="fill-slate-500">{{ 'COMMUNITY.POST_CARD.ROUTE_LABEL' | translate: { name: post.destination.name } }}</text>
            </svg>
          </div>
        </div>
      }
    
      <!-- Post Header -->
      <div class="flex items-start justify-between p-4">
        <div class="flex items-center gap-3">
          <a [routerLink]="['/community/users', post.author.id]" class="block shrink-0">
            <img [src]="post.author.avatar || '/assets/images/default-avatar.svg'" [alt]="'COMMUNITY.POST_CARD.AUTHOR_AVATAR_ALT' | translate" class="w-12 h-12 rounded-full border border-slate-100 shadow-sm object-cover bg-slate-50" loading="lazy" decoding="async" />
          </a>
          <div class="flex flex-col">
            <a [routerLink]="['/community/users', post.author.id]" class="font-extrabold text-sm text-text-primary hover:text-primary hover:underline flex items-center gap-1.5 flex-wrap">
              {{ post.author.name }}
              @if (post.author.is_verified) {
                <span class="text-primary flex items-center" [title]="'COMMUNITY.VERIFIED_BADGE' | translate">
                  <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L9 10.586l3.293-3.293a1 1 0 111.414 1.414z" clip-rule="evenodd" fill-rule="evenodd"></path></svg>
                </span>
              }
              <app-community-level-badge [xp]="post.author.xp" [levelRank]="post.author.level_rank || post.author.level?.rank" />
              @if (post.author.countries_visited && post.author.countries_visited >= 5) {
                <span class="bg-amber-50 text-amber-800 text-2xs px-2 py-0.5 rounded-full font-bold border border-amber-200/50 flex items-center gap-0.5 shrink-0" [title]="'COMMUNITY.POST_CARD.COUNTRIES_VISITED_TITLE' | translate: { count: post.author.countries_visited }">
                  🎒 {{ post.author.countries_visited }}
                </span>
              }
              @if (post.author.local_in) {
                <span class="bg-emerald-50 text-emerald-800 text-2xs px-2 py-0.5 rounded-full font-bold border border-emerald-200/50 flex items-center gap-0.5 shrink-0" [title]="'COMMUNITY.POST_CARD.LOCAL_IN_TITLE' | translate: { place: post.author.local_in }">
                  📍 {{ post.author.local_in }}
                </span>
              }
            </a>
            <p class="text-xs text-text-secondary flex items-center gap-1.5 flex-wrap mt-0.5">
              @if (!isEditing) {
                {{ post.location }}
              }
              @if (isEditing) {
                <input type="text" [(ngModel)]="editLocation" class="border border-slate-200 rounded px-2 py-1 text-xs" [placeholder]="'COMMUNITY.POST_CARD.LOCATION_PLACEHOLDER' | translate" />
              }
            </p>
            <div class="flex items-center gap-1.5 text-2xs-plus text-text-tertiary mt-1 flex-wrap">
              <span>{{ formatDate(post.created_at) }}</span>
              <span>•</span>
              <svg class="w-3.5 h-3.5 text-text-disabled" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9-9c1.657 0 3 4.03 3 9s-1.343 9-3 9m0-18c-1.657 0-3 4.03-3 9s1.343 9 3 9m-9-9a9 9 0 019-9" /></svg>
              @if (getSoundscape() !== 'none') {
                <span class="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full text-[9px] font-extrabold ml-1" [title]="'COMMUNITY.POST_CARD.AMBIENT_SOUNDSCAPE_TITLE' | translate: { soundscape: getSoundscape() }">
                  <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
                  {{ 'COMMUNITY.POST_CARD.AMBIENT_LABEL' | translate }}
                </span>
              }
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            (click)="onToggleFollow.emit(post)"
            [class.text-primary]="!post.is_following"
            [class.bg-primary-50]="!post.is_following"
            [class.text-text-tertiary]="post.is_following"
            [class.bg-slate-100]="post.is_following"
            class="px-3 py-1 rounded-full text-xs font-bold transition-all hover:scale-102 focus:outline-none"
            >
            {{ (post.is_following ? 'COMMUNITY.FOLLOWING' : 'COMMUNITY.POST_CARD.FOLLOW') | translate }}
          </button>
          <div class="relative">
            <button (click)="toggleOptionsMenu()" class="text-text-tertiary hover:bg-slate-100 p-1.5 rounded-full transition-colors focus:outline-none" [attr.aria-label]="'COMMUNITY.POST_CARD.MORE_OPTIONS_ARIA' | translate">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
            @if (showOptionsMenu) {
              <div class="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-xl shadow-lg z-50 border border-slate-100/80 dark:border-gray-700/80 divide-y divide-slate-50 dark:divide-gray-700 overflow-hidden text-slate-800 dark:text-slate-100">
                @if (isAuthor()) {
                  <button (click)="startEdit()" class="w-full text-left px-4 py-2 text-xs font-bold text-text-secondary hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">{{ 'COMMUNITY.POST_CARD.EDIT_POST' | translate }}</button>
                  <button (click)="deletePost()" class="w-full text-left px-4 py-2 text-xs font-bold text-danger hover:bg-danger-50 dark:hover:bg-danger-900/30 transition-colors">{{ 'COMMUNITY.POST_CARD.DELETE' | translate }}</button>
                } @else {
                  <button (click)="showOptionsMenu = false; showReportModal.set(true)" class="w-full text-left px-4 py-2 text-xs font-bold text-danger hover:bg-danger-50 dark:hover:bg-danger-900/30 transition-colors">🛡️ Report Post</button>
                }
              </div>
            }
          </div>
          <button
            class="text-text-tertiary hover:bg-slate-100 p-1.5 rounded-full transition-colors focus:outline-none"
            [attr.aria-label]="'COMMUNITY.POST_CARD.SAVE_TO_COLLECTION_ARIA' | translate"
            (click)="onSave.emit(post.id)"
            >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
          </button>
        </div>
      </div>
    
      <!-- Destination Banner (above caption) -->
      @if (post.destination && !isEditing) {
        <div class="mx-4 mb-3 bg-gradient-to-r from-primary-50 to-indigo-50/50 border border-primary-subtle/40 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3">
          <a
            [routerLink]="['/destinations', post.destination.id]"
            (mouseenter)="showRouteMap.set(true)"
            (mouseleave)="showRouteMap.set(false)"
            class="flex items-center gap-2 min-w-0 group"
            >
            <span class="bg-primary text-white w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm">
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
            </span>
            <div class="min-w-0">
              <p class="text-2xs font-extrabold text-text-tertiary uppercase tracking-wide leading-none mb-0.5">{{ 'COMMUNITY.POST_CARD.DESTINATION_LABEL' | translate }}</p>
              <p class="text-sm font-extrabold text-primary group-hover:underline truncate">{{ post.destination.name }}</p>
            </div>
          </a>
          <div class="flex items-center gap-1.5 shrink-0">
            <button
              (click)="onSave.emit(post.id)"
              class="flex items-center gap-1 bg-white/80 dark:bg-gray-800/80 hover:bg-primary hover:text-white text-text-secondary border border-slate-200/60 dark:border-gray-700 px-2.5 py-1.5 rounded-lg text-2xs font-bold transition-all hover:border-primary focus:outline-none"
              [attr.aria-label]="'COMMUNITY.POST_CARD.SAVE_TO_BUCKET_LIST_ARIA' | translate"
              >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
              {{ 'COMMUNITY.POST_CARD.SAVE' | translate }}
            </button>
            <a
              [routerLink]="['/destinations', post.destination.id]"
              class="flex items-center gap-1 bg-white/80 dark:bg-gray-800/80 hover:bg-slate-100 dark:hover:bg-gray-700 text-text-secondary border border-slate-200/60 dark:border-gray-700 px-2.5 py-1.5 rounded-lg text-2xs font-bold transition-all focus:outline-none"
              [attr.aria-label]="'COMMUNITY.POST_CARD.VIEW_DESTINATION_ARIA' | translate"
              >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              {{ 'COMMUNITY.POST_CARD.EXPLORE' | translate }}
            </a>
          </div>
        </div>
      }
    
      <!-- Poll display -->
      @if (post.type === 'poll' && post.poll) {
        <div class="px-4 pb-2">
          <app-community-poll [poll]="post.poll" />
        </div>
      }
    
      <!-- Caption -->
      <div class="px-4 pb-3">
        @if (!isEditing) {
          <p class="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
            @for (token of getCaptionTokens(getDisplayCaption()); track $index) {
              @if (token.type === 'hashtag') {
                <span (click)="filterByHashtag(token.value)" class="text-primary font-bold hover:underline cursor-pointer mr-1.5">{{ token.value }}</span>
              } @else {
                <span>{{ token.value }}</span>
              }
            }
          </p>
        }
        @if (isEditing) {
          <textarea [(ngModel)]="editCaption" class="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all" rows="3"></textarea>
          <div class="flex justify-end gap-2 mt-2">
            <button (click)="cancelEdit()" class="px-4 py-1.5 text-xs text-text-secondary hover:bg-slate-100 rounded-full font-bold transition-all">{{ 'COMMUNITY.POST_CARD.CANCEL' | translate }}</button>
            <button (click)="saveEdit()" class="px-4 py-1.5 text-xs bg-primary hover:bg-primary-hover text-white rounded-full font-bold transition-all shadow-sm">{{ 'COMMUNITY.POST_CARD.SAVE' | translate }}</button>
          </div>
        }
      </div>
    
      <!-- Post Images (Carousel) -->
      <div class="border-y border-slate-100/50 relative group">
        <app-community-post-carousel [images]="post.images" />
    
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
    
      <!-- Attached Itinerary Preview (Boarding Pass Design) -->
      @if (post.itinerary) {
        <div class="mx-4 my-4 border border-slate-100 bg-slate-50/50 rounded-2xl flex flex-col p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
    
          <div class="flex items-center gap-4">
            <!-- Ticket notch indicators -->
            <div class="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-7 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 border-l-0 rounded-r-full shadow-inner hidden sm:block"></div>
            <div class="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-7 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 border-r-0 rounded-l-full shadow-inner hidden sm:block"></div>
    
            <img
              [src]="post.itinerary.image || 'assets/images/landing/journey-thailand.jpg'"
              [alt]="'COMMUNITY.POST_CARD.ITINERARY_THUMBNAIL_ALT' | translate"
              class="w-16 h-16 rounded-xl object-cover bg-slate-200 border border-slate-100 shadow-sm shrink-0"
              loading="lazy"
              decoding="async"
              />
            <div class="flex-1 min-w-0">
              <h4 class="font-extrabold text-sm text-text-primary truncate">{{ post.itinerary.title }}</h4>
              <p class="text-xs text-text-secondary mt-1 flex items-center gap-1.5 truncate">
                <svg class="w-3.5 h-3.5 text-text-tertiary" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {{ post.itinerary.destination }}
              </p>
              <p class="text-xs font-bold text-primary mt-1.5 flex items-center gap-2">
                <span class="bg-primary-50 text-primary px-2 py-0.5 rounded-full text-2xs border border-primary-subtle/50 shadow-sm">
                  {{ (getDayCount(post.itinerary) === 1 ? 'COMMUNITY.POST_CARD.DAY_COUNT' : 'COMMUNITY.POST_CARD.DAYS_COUNT') | translate: { count: getDayCount(post.itinerary) } }}
                </span>
                <span class="text-text-tertiary font-normal">•</span>
                <span class="text-text-secondary">
                  {{ 'COMMUNITY.POST_CARD.BUDGET_LABEL' | translate }} <span class="text-text-primary font-bold">{{ getBudgetTierLabel(post.itinerary.budget) }}</span>
                </span>
              </p>
            </div>
    
            <!-- Dashed Ticket Line Divider -->
            <div class="h-14 border-l-2 border-dashed border-slate-200/80 mx-2 hidden sm:block"></div>
    
            <div class="flex flex-col gap-2 shrink-0">
              <button
                (click)="onCloneTrip.emit(post.itinerary.id)"
                class="bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 text-center"
                >
                {{ 'COMMUNITY.POST_CARD.CLONE_TRIP' | translate }}
              </button>
            </div>
          </div>
        </div>
      }
    
      <!-- Post Actions & Stats -->
      <div class="px-4 py-2">
        <div class="flex items-center justify-between text-xs text-text-secondary mb-2 border-b border-slate-100 pb-2">
          <div class="flex items-center gap-2">
            <div class="flex items-center -space-x-1.5">
              @for (react of getTopReactions(post.reactions); track react) {
                <span class="text-xs-plus inline-block bg-white dark:bg-gray-800 border border-slate-150 dark:border-gray-700 rounded-full w-5.5 h-5.5 flex items-center justify-center shadow-sm relative z-10 select-none transform hover:scale-110 transition-transform cursor-help" [title]="react">
                  {{ getReactionEmoji(react) }}
                </span>
              }
            </div>
            <span class="font-bold text-text-primary ml-1.5 hover:text-primary transition-colors cursor-pointer">{{ (post.likes === 1 ? 'COMMUNITY.POST_CARD.REACTION_COUNT' : 'COMMUNITY.POST_CARD.REACTIONS_COUNT') | translate: { count: post.likes } }}</span>
          </div>
          <div class="flex gap-3">
            @if (!isDetailView) {
              <button (click)="onToggleCommentsView.emit(post.id)" class="hover:text-primary font-bold hover:underline focus:outline-none transition-colors">
                {{ (post.comments === 1 ? 'COMMUNITY.POST_CARD.COMMENT_COUNT' : 'COMMUNITY.POST_CARD.COMMENTS_COUNT') | translate: { count: post.comments } }}
              </button>
            }
            @if (isDetailView) {
              <span class="font-bold">{{ (post.comments === 1 ? 'COMMUNITY.POST_CARD.COMMENT_COUNT' : 'COMMUNITY.POST_CARD.COMMENTS_COUNT') | translate: { count: post.comments } }}</span>
            }
          </div>
        </div>
    
        <div class="flex items-center justify-between pb-1">
          <div class="flex items-center gap-1.5 w-full">
            <!-- Reaction Picker -->
            <div
              class="relative"
              (mouseenter)="reactionPickerHovered.set(true)"
              (mouseleave)="reactionPickerHovered.set(false)"
              (focusout)="onReactionGroupFocusOut($event)"
              >
              <button
                (click)="toggleReactionPicker()"
                (focus)="reactionPickerHovered.set(true)"
                class="flex items-center gap-2 px-3 py-2 rounded-xl transition-all focus:outline-none hover:bg-slate-50 font-bold text-xs"
                [class.text-primary]="post.isLiked"
                [class.text-text-secondary]="!post.isLiked"
                >
                @if (post.userReaction) {
                  <span class="text-lg animate-[ping_0.5s_cubic-bezier(0,0,0.2,1)_1]">{{ getReactionEmoji(post.userReaction!) }}</span>
                } @else {
                  <div class="relative">
                    <svg class="w-5 h-5" [attr.fill]="post.isLiked ? 'currentColor' : 'none'" viewBox="0 0 24 24" [attr.stroke]="post.isLiked ? 'none' : 'currentColor'" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                    </svg>
                  </div>
                }
                <span>{{ (post.isLiked ? 'COMMUNITY.POST_CARD.LIKED' : 'COMMUNITY.POST_CARD.LIKE') | translate }}</span>
              </button>
    
              <!-- Reaction Picker Popup -->
              @if (reactionPickerHovered()) {
                <div
                  role="listbox"
                  [attr.aria-label]="'COMMUNITY.POST_CARD.REACTION_PICKER_ARIA' | translate"
                  class="absolute bottom-full left-0 mb-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-full shadow-[0_10px_30px_rgba(0,96,234,0.12)] border border-slate-100/80 dark:border-gray-700/80 flex items-center gap-1 px-2.5 py-1.5 z-30 animate-[fadeInUp_0.2s_ease-out_backwards]"
                  (keydown)="handleReactionKeydown($event)"
                  >
                  <button role="option" (click)="reactPost('wanderlust'); reactionPickerHovered.set(false)" class="w-10 h-10 rounded-full flex items-center justify-center hover:bg-blue-50 hover:scale-130 active:scale-95 transition-all duration-200 text-2xl focus:outline-none focus:ring-2 focus:ring-primary" [attr.aria-label]="'COMMUNITY.POST_CARD.REACTION_WANDERLUST' | translate" [title]="'COMMUNITY.POST_CARD.REACTION_WANDERLUST' | translate">✨</button>
                  <button role="option" (click)="reactPost('been_there'); reactionPickerHovered.set(false)" class="w-10 h-10 rounded-full flex items-center justify-center hover:bg-emerald-50 hover:scale-130 active:scale-95 transition-all duration-200 text-2xl focus:outline-none focus:ring-2 focus:ring-primary" [attr.aria-label]="'COMMUNITY.POST_CARD.REACTION_BEEN_THERE' | translate" [title]="'COMMUNITY.POST_CARD.REACTION_BEEN_THERE' | translate">📍</button>
                  <button role="option" (click)="reactPost('bucket_list'); reactionPickerHovered.set(false)" class="w-10 h-10 rounded-full flex items-center justify-center hover:bg-amber-50 hover:scale-130 active:scale-95 transition-all duration-200 text-2xl focus:outline-none focus:ring-2 focus:ring-primary" [attr.aria-label]="'COMMUNITY.POST_CARD.REACTION_BUCKET_LIST' | translate" [title]="'COMMUNITY.POST_CARD.REACTION_BUCKET_LIST' | translate">📝</button>
                  <button role="option" (click)="reactPost('like'); reactionPickerHovered.set(false)" class="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 hover:scale-130 active:scale-95 transition-all duration-200 text-2xl focus:outline-none focus:ring-2 focus:ring-primary" [attr.aria-label]="'COMMUNITY.POST_CARD.LIKE' | translate" [title]="'COMMUNITY.POST_CARD.LIKE' | translate">👍</button>
                </div>
              }
            </div>
    
            <button
              (click)="isDetailView ? onCommentFocus.emit() : onToggleCommentsView.emit(post.id)"
              class="flex items-center gap-2 px-3 py-2 rounded-xl text-text-secondary hover:bg-slate-50 transition-colors focus:outline-none font-bold text-xs"
              >
              <svg class="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>{{ 'COMMUNITY.POST_CARD.COMMENT' | translate }}</span>
            </button>
            <button
              (click)="sharePost()"
              class="flex items-center gap-2 px-3 py-2 rounded-xl text-text-secondary hover:bg-slate-50 transition-colors focus:outline-none font-bold text-xs"
              >
              <svg class="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>{{ 'COMMUNITY.POST_CARD.SHARE' | translate }}</span>
            </button>
          </div>
        </div>
      </div>
    
      <ng-content></ng-content>
    </article>
    
    @if (postToDelete(); as p) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" [attr.aria-labelledby]="'delete-confirm-title-' + post.id" (keydown.escape)="postToDelete.set(null)">
        <div class="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl" cdkTrapFocus cdkTrapFocusAutoCapture>
          <h2 [id]="'delete-confirm-title-' + post.id" class="text-xl font-bold text-text-primary">{{ 'COMMUNITY.POST_CARD.DELETE_CONFIRM_TITLE' | translate }}</h2>
          <p class="mt-2 text-text-secondary">{{ 'COMMUNITY.POST_CARD.DELETE_CONFIRM_MSG' | translate }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="rounded-btn border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted"
              (click)="postToDelete.set(null)"
              >
              {{ 'COMMUNITY.POST_CARD.CANCEL' | translate }}
            </button>
            <button
              type="button"
              class="rounded-btn bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              (click)="confirmDeletePost()"
              >
              {{ 'COMMUNITY.POST_CARD.DELETE' | translate }}
            </button>
          </div>
        </div>
      </div>
    }
    
    @if (showReportModal()) {
      <app-community-report-modal
        [targetId]="post.id"
        targetType="post"
        (close)="showReportModal.set(false)"
        (submitted)="showReportModal.set(false); toast.success($event)"
        />
    }
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
export class CommunityPostCardComponent implements OnDestroy {
  @Input({ required: true }) post!: any;
  @Input() isDetailView = false;

  @Output() onToggleFollow = new EventEmitter<any>();
  @Output() onSave = new EventEmitter<string>();
  @Output() onToggleCommentsView = new EventEmitter<string>();
  @Output() onCloneTrip = new EventEmitter<string>();
  @Output() onCommentFocus = new EventEmitter<void>();
  @Output() onPostDeleted = new EventEmitter<string>();

  showRouteMap = signal(false);
  isPlayingAudio = signal(false);
  audioElement?: HTMLAudioElement;

  private router = inject(Router);
  toast = inject(ToastService);
  private postService = inject(CommunityPostService);
  private authService = inject(AuthService);
  private translate = inject(TranslateService);

  showOptionsMenu = false;
  isEditing = false;
  editCaption = '';
  editLocation = '';

  readonly postToDelete = signal<any | null>(null);
  readonly mapImageError = signal(false);
  showReportModal = signal(false);

  private static readonly BUDGET_TIERS = ['budget', 'mid', 'luxury'];

  isAuthor(): boolean {
    return this.post.author?.id === this.authService.user()?.id;
  }

  toggleOptionsMenu() {
    this.showOptionsMenu = !this.showOptionsMenu;
  }

  startEdit() {
    this.showOptionsMenu = false;
    this.isEditing = true;
    this.editCaption = this.post.caption || '';
    this.editLocation = this.post.location || '';
  }

  cancelEdit() {
    this.isEditing = false;
  }

  saveEdit() {
    this.postService.updatePost(this.post.id, { caption: this.editCaption, location: this.editLocation }).subscribe({
      next: (res) => {
        this.post.caption = res.caption;
        this.post.location = res.location;
        this.isEditing = false;
        this.toast.success(this.translate.instant('COMMUNITY.POST_CARD.TOAST_POST_UPDATED'));
      },
      error: () => {
        this.toast.error(this.translate.instant('COMMUNITY.POST_CARD.TOAST_UPDATE_ERROR'));
      }
    });
  }

  deletePost() {
    this.showOptionsMenu = false;
    this.postToDelete.set(this.post);
  }

  confirmDeletePost() {
    const post = this.postToDelete();
    if (!post) return;
    this.postToDelete.set(null);
    this.postService.deletePost(post.id).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('COMMUNITY.POST_CARD.TOAST_POST_DELETED'));
        this.onPostDeleted.emit(post.id);
      },
      error: () => {
        this.toast.error(this.translate.instant('COMMUNITY.POST_CARD.TOAST_DELETE_ERROR'));
      }
    });
  }

  readonly reactionPickerHovered = signal(false);

  toggleReactionPicker() {
    this.reactionPickerHovered.set(!this.reactionPickerHovered());
  }

  filterByHashtag(tag: string) {
    const rawTag = tag.startsWith('#') ? tag.slice(1) : tag;
    this.router.navigate(['/community'], { queryParams: { mode: 'search', q: rawTag }});
  }

  getCaptionTokens(caption: string): { type: 'text' | 'hashtag', value: string }[] {
    if (!caption) return [];
    return caption.split(/(\s+)/).map(token => {
      if (token.startsWith('#')) return { type: 'hashtag', value: token };
      return { type: 'text', value: token };
    });
  }

  getReactionEmoji(type: string): string {
    switch (type) {
      case 'wanderlust': return '✨';
      case 'been_there': return '📍';
      case 'bucket_list': return '📝';
      case 'like': return '👍';
      default: return '👍';
    }
  }

  getTopReactions(reactions: Record<string, number> | undefined): string[] {
    if (!reactions) return [];
    return Object.entries(reactions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
  }

  getDayCount(itinerary: { days?: any[] } | null | undefined): number {
    return itinerary?.days?.length || 0;
  }

  getBudgetTierLabel(budget: string | undefined): string {
    if (!budget) return '';
    const normalized = budget.toLowerCase();
    if (!CommunityPostCardComponent.BUDGET_TIERS.includes(normalized)) {
      // Unknown tier value — fall back to displaying it as-is rather than a raw translate key.
      return budget;
    }
    const key = 'COMMUNITY.POST_CARD.BUDGET_TIER_' + normalized.toUpperCase();
    return this.translate.instant(key);
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateString;
    }
  }

  onReactionGroupFocusOut(event: FocusEvent) {
    const container = event.currentTarget as HTMLElement;
    const next = event.relatedTarget as Node | null;
    if (!next || !container.contains(next)) {
      this.reactionPickerHovered.set(false);
    }
  }

  handleReactionKeydown(event: KeyboardEvent) {
    const buttons = (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button');
    const current = document.activeElement as HTMLButtonElement;
    const idx = Array.from(buttons).indexOf(current);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      buttons[(idx + 1) % buttons.length]?.focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      buttons[(idx - 1 + buttons.length) % buttons.length]?.focus();
    } else if (event.key === 'Escape') {
      this.reactionPickerHovered.set(false);
    }
  }

  reactPost(reactionType: string) {
    if (!this.post) return;

    // Optimistic update
    const previousState = {
      isLiked: this.post.isLiked,
      userReaction: this.post.userReaction,
      likes: this.post.likes,
      reactions: { ...this.post.reactions }
    };

    if (!this.post.reactions) this.post.reactions = {};

    if (this.post.userReaction === reactionType) {
      // Toggle off — same reaction clicked again
      this.post.isLiked = false;
      this.post.userReaction = null;
      this.post.likes = Math.max(0, (this.post.likes || 0) - 1);
      this.post.reactions[reactionType] = Math.max(0, (this.post.reactions[reactionType] || 0) - 1);
    } else if (this.post.userReaction) {
      // Switching from one reaction to another — no net change in total likes
      const oldReaction = this.post.userReaction;
      this.post.reactions[oldReaction] = Math.max(0, (this.post.reactions[oldReaction] || 0) - 1);
      this.post.reactions[reactionType] = (this.post.reactions[reactionType] || 0) + 1;
      this.post.userReaction = reactionType;
    } else {
      // New reaction — increment total
      this.post.isLiked = true;
      this.post.userReaction = reactionType;
      this.post.likes = (this.post.likes || 0) + 1;
      this.post.reactions[reactionType] = (this.post.reactions[reactionType] || 0) + 1;
    }

    this.postService.toggleReaction(this.post.id, reactionType).subscribe({
      next: (res) => {
        // Sync with server truth
        this.post.likes = res.likes_count;
        this.post.reactions = res.reactions;
      },
      error: () => {
        // Rollback
        this.post.isLiked = previousState.isLiked;
        this.post.userReaction = previousState.userReaction;
        this.post.likes = previousState.likes;
        this.post.reactions = previousState.reactions;
        this.toast.error(this.translate.instant('COMMUNITY.POST_CARD.TOAST_REACTION_ERROR'));
      }
    });
  }

  sharePost() {
    const url = window.location.origin + '/community/posts/' + this.post.id;
    if (navigator.share) {
      navigator.share({
        title: this.translate.instant('COMMUNITY.POST_CARD.SHARE_TITLE'),
        text: this.post.caption,
        url: url
      }).catch(err => console.error('Error sharing:', err));
    } else {
      navigator.clipboard.writeText(url).then(() => {
        this.toast.success(this.translate.instant('COMMUNITY.POST_CARD.TOAST_LINK_COPIED'));
      });
    }
  }

  getSoundscape(): string {
    const caption = this.post.caption || '';
    const match = caption.match(/\[soundscape:([a-z_]+)\]/);
    return match ? match[1] : 'none';
  }

  getDisplayCaption(): string {
    const caption = this.post.caption || '';
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

  ngOnDestroy() {
    this.stopAudio();
  }
}
