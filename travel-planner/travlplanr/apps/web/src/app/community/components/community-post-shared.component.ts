import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { CommunityPostService, CommunityPost } from '../services/community-post.service';
import { CommunityCommentService, Comment } from '../services/community-comment.service';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../shared/utils/toast.service';
import { apiUrl } from '../../shared/utils/api-url';
import { apiErrorMessage } from '../../shared/utils/api-error.util';
import { DestinationSearchService } from '../../shared/services/destination-search.service';
import { DestinationListItem } from '../../shared/utils/destination.util';
import { CommunityLevelBadgeComponent } from './community-level-badge.component';
import { CommunityQaThreadComponent } from './community-qa-thread.component';
import { CommunityReportModalComponent } from './community-report-modal.component';

interface DestinationOption {
  id: string;
  name: string;
  country: string;
  image: string;
}

const FOLLOWING_BUTTON_VISIBLE_MS = 60 * 60 * 1000;

/** The "Following" button is only shown for an hour after the follow action; past that
    the user is still followed server-side, but the button disappears (neither Follow nor
    Following is shown) rather than reverting to an actionable "Follow" state. */
export function getFollowButtonState(post: { is_following?: boolean; followed_at?: string | null }): 'follow' | 'following' | 'hidden' {
  if (!post.is_following) return 'follow';
  if (!post.followed_at) return 'following';
  const followedAtMs = new Date(post.followed_at).getTime();
  if (isNaN(followedAtMs)) return 'following';
  return Date.now() - followedAtMs < FOLLOWING_BUTTON_VISIBLE_MS ? 'following' : 'hidden';
}

@Component({
    selector: 'app-community-post-carousel',
    imports: [CommonModule, TranslatePipe],
    template: `
    @if (images.length > 0) {
      <div
        class="relative w-full aspect-[4/5] bg-gray-900 group"
        (touchstart)="onTouchStart($event)"
        (touchend)="onTouchEnd($event)"
        >
        <!-- Main Image -->
        <img
          [src]="images[currentIndex()]"
          class="w-full h-full object-cover transition-opacity duration-300 cursor-pointer"
          (click)="openLightbox()"
          loading="lazy"
          decoding="async"
          [attr.alt]="'COMMUNITY.CAROUSEL.IMAGE_ALT' | translate"
          />

        <!-- Navigation Arrows -->
        @if (images.length > 1) {
          @if (currentIndex() > 0) {
            <button
              (click)="prev($event)"
              class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
              [attr.aria-label]="'COMMUNITY.CAROUSEL.PREVIOUS' | translate"
              >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          }

          @if (currentIndex() < images.length - 1) {
            <button
              (click)="next($event)"
              class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
              [attr.aria-label]="'COMMUNITY.CAROUSEL.NEXT' | translate"
              >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          }

          <!-- Dots -->
          <div class="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
            @for (img of images; track idx; let idx = $index) {
              <button (click)="goTo(idx, $event)" class="w-1.5 h-1.5 rounded-full transition-all focus:outline-none" [ngClass]="{'bg-white scale-125': currentIndex() === idx, 'bg-white/50': currentIndex() !== idx}" [attr.aria-label]="'COMMUNITY.CAROUSEL.GO_TO_IMAGE' | translate:{n: idx + 1}"></button>
            }
          </div>
        }
      </div>
    }

    <!-- Lightbox -->
    @if (isLightboxOpen()) {
      <div
        class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center backdrop-blur-sm"
        (click)="closeLightbox()"
        (touchstart)="onTouchStart($event)"
        (touchend)="onTouchEnd($event)"
        >
        <!-- Close Button -->
        <button
          class="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors focus:outline-none"
          (click)="closeLightbox()"
          [attr.aria-label]="'COMMUNITY.CAROUSEL.CLOSE_LIGHTBOX' | translate"
          >
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <img
          [src]="images[currentIndex()]"
          class="max-w-full max-h-[90vh] object-contain"
          (click)="$event.stopPropagation()"
          loading="lazy"
          decoding="async"
          [attr.alt]="'COMMUNITY.CAROUSEL.IMAGE_FULL_ALT' | translate"
          />

        @if (images.length > 1) {
          @if (currentIndex() > 0) {
            <button
              (click)="prev($event)"
              class="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors focus:outline-none"
              [attr.aria-label]="'COMMUNITY.CAROUSEL.PREVIOUS' | translate"
              >
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          }

          @if (currentIndex() < images.length - 1) {
            <button
              (click)="next($event)"
              class="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors focus:outline-none"
              [attr.aria-label]="'COMMUNITY.CAROUSEL.NEXT' | translate"
              >
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          }
        }
      </div>
    }
    `,
    styles: []
})
export class CommunityPostCarouselComponent implements OnDestroy {
  @Input({ required: true }) images: string[] = [];

  currentIndex = signal<number>(0);
  isLightboxOpen = signal<boolean>(false);

  private touchStartX = 0;
  private touchEndX = 0;

  private keydownListener = (event: KeyboardEvent) => {
    if (!this.isLightboxOpen()) return;

    if (event.key === 'Escape') {
      this.closeLightbox();
    } else if (event.key === 'ArrowRight') {
      this.next();
    } else if (event.key === 'ArrowLeft') {
      this.prev();
    }
  };

  ngOnDestroy() {
    if (this.isLightboxOpen()) {
      this.closeLightbox();
    }
  }

  next(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (this.currentIndex() < this.images.length - 1) {
      this.currentIndex.update(v => v + 1);
    }
  }

  prev(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (this.currentIndex() > 0) {
      this.currentIndex.update(v => v - 1);
    }
  }

  goTo(index: number, event: Event) {
    event.stopPropagation();
    this.currentIndex.set(index);
  }

  openLightbox() {
    this.isLightboxOpen.set(true);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', this.keydownListener);
  }

  closeLightbox() {
    this.isLightboxOpen.set(false);
    document.body.style.overflow = '';
    document.removeEventListener('keydown', this.keydownListener);
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  private handleSwipe() {
    const swipeThreshold = 50;
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swiped left, go next
        this.next();
      } else {
        // Swiped right, go prev
        this.prev();
      }
    }
  }
}

@Component({
    selector: 'app-community-post-card',
    imports: [RouterLink, CommunityPostCarouselComponent, FormsModule, TranslatePipe, CommunityLevelBadgeComponent, CommunityQaThreadComponent, CommunityReportModalComponent, A11yModule],
    template: `
    <article class="bg-white dark:bg-gray-800/90 backdrop-blur-md rounded-2xl overflow-hidden border border-slate-100 dark:border-gray-700/80 shadow-[0_1px_2px_rgba(11,18,32,0.03),0_10px_30px_rgba(11,18,32,0.055)] hover:shadow-[0_2px_4px_rgba(11,18,32,0.04),0_18px_44px_rgba(11,18,32,0.09)] transition-shadow duration-200 relative">

      <!-- Post Header -->
      <div class="flex items-start justify-between gap-3 p-4">
        <div class="flex items-center gap-3 min-w-0">
          <a [routerLink]="['/community/users', post.author.id]" class="block shrink-0">
            @if (post.author.avatar) {
              <img [src]="post.author.avatar" [alt]="'COMMUNITY.POST_CARD.AUTHOR_AVATAR_ALT' | translate" class="w-12 h-12 rounded-full shadow-[0_0_0_1px_rgba(11,18,32,0.06)] object-cover bg-slate-50" loading="lazy" decoding="async" />
            } @else {
              <span class="w-12 h-12 rounded-full shadow-[0_0_0_1px_rgba(11,18,32,0.06)] flex items-center justify-center text-white font-semibold text-sm" [style.background]="authorColor()">{{ authorInitial() }}</span>
            }
          </a>
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <a [routerLink]="['/community/users', post.author.id]" class="font-semibold text-sm text-text-primary hover:text-primary hover:underline tracking-tight flex items-center gap-1.5">
                {{ post.author.name }}
                @if (post.author.is_verified) {
                  <span class="text-primary flex items-center" [title]="'COMMUNITY.VERIFIED_BADGE' | translate">
                    <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L9 10.586l3.293-3.293a1 1 0 111.414 1.414z" clip-rule="evenodd" fill-rule="evenodd"></path></svg>
                  </span>
                }
              </a>
              <app-community-level-badge [xp]="post.author.xp" [levelRank]="post.author.level_rank || post.author.level?.rank" />
              @if (kindLabel() !== 'INSIGHT') {
                <span
                  class="h-[21px] px-2.5 rounded-md text-[9.5px] font-semibold tracking-wide flex items-center whitespace-nowrap"
                  [class.text-amber-700]="kindLabel() === 'QUESTION'"
                  [class.bg-amber-50]="kindLabel() === 'QUESTION'"
                >{{ kindLabel() }}</span>
              }
              @if (post.tag) {
                <span class="h-[21px] px-2.5 rounded-md text-[9.5px] font-semibold tracking-wide flex items-center whitespace-nowrap bg-slate-100 dark:bg-gray-700 text-text-secondary">{{ post.tag }}</span>
              }
            </div>
            <p class="text-xs font-semibold text-text-faint mt-0.5 truncate">
              {{ formatDate(post.created_at) }}
              @if (post.location && !isEditing) {
                <span> · {{ post.location }}</span>
              }
            </p>
            @if (post.authorLine) {
              <p class="text-xs text-text-faint mt-0.5 truncate">{{ post.authorLine }}</p>
            }
            @if (isEditing) {
              <input type="text" [(ngModel)]="editLocation" class="mt-1 border border-slate-200 rounded px-2 py-1 text-xs" [placeholder]="'COMMUNITY.POST_CARD.LOCATION_PLACEHOLDER' | translate" />
            }
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          @if (isAuthor()) {
            <button (click)="deletePost()" class="h-8 px-3.5 rounded-lg text-[11.5px] font-semibold whitespace-nowrap border border-slate-200 dark:border-gray-700 text-text-faint bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors focus:outline-none">
              {{ 'COMMUNITY.POST_CARD.DELETE' | translate }}
            </button>
          } @else if (followButtonState() !== 'hidden') {
            <button
              (click)="onToggleFollow.emit(post)"
              class="h-8 px-3.5 rounded-lg text-[11.5px] font-semibold whitespace-nowrap border transition-colors focus:outline-none"
              [class.border-primary]="followButtonState() === 'follow'"
              [class.text-primary]="followButtonState() === 'follow'"
              [class.bg-white]="followButtonState() === 'follow'"
              [class.dark:bg-gray-800]="followButtonState() === 'follow'"
              [class.border-slate-200]="followButtonState() === 'following'"
              [class.dark:border-gray-700]="followButtonState() === 'following'"
              [class.bg-slate-50]="followButtonState() === 'following'"
              [class.dark:bg-gray-700]="followButtonState() === 'following'"
              [class.text-text-faint]="followButtonState() === 'following'"
              >
              {{ (followButtonState() === 'following' ? 'COMMUNITY.FOLLOWING' : 'COMMUNITY.POST_CARD.FOLLOW') | translate }}
            </button>
          }
          <div class="relative">
            <button (click)="toggleOptionsMenu()" class="w-8 h-8 rounded-lg flex items-center justify-center text-text-faint hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors focus:outline-none" [attr.aria-label]="'COMMUNITY.POST_CARD.MORE_OPTIONS_ARIA' | translate">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
            @if (showOptionsMenu) {
              <div class="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-xl shadow-lg z-50 border border-slate-100 dark:border-gray-700/80 divide-y divide-slate-50 dark:divide-gray-700 overflow-hidden text-slate-800 dark:text-slate-100">
                @if (isAuthor()) {
                  <button (click)="startEdit()" class="w-full text-left px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">{{ 'COMMUNITY.POST_CARD.EDIT_POST' | translate }}</button>
                  <button (click)="deletePost()" class="w-full text-left px-4 py-2 text-xs font-semibold text-danger hover:bg-danger-50 dark:hover:bg-danger-900/30 transition-colors">{{ 'COMMUNITY.POST_CARD.DELETE' | translate }}</button>
                } @else {
                  <button (click)="showOptionsMenu = false; showReportModal.set(true)" class="w-full text-left px-4 py-2 text-xs font-semibold text-danger hover:bg-danger-50 dark:hover:bg-danger-900/30 transition-colors">🛡️ Report Post</button>
                }
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Caption -->
      <div class="px-4 pb-3">
        @if (!isEditing) {
          @if (captionHeadline()) {
            <p class="text-[17px] font-bold leading-snug tracking-tight text-text-primary mb-1">{{ captionHeadline() }}</p>
          }
          <p class="text-[13.5px] font-normal leading-[1.65] text-text-muted whitespace-pre-wrap">
            @for (token of getCaptionTokens(captionRest()); track $index) {
              @if (token.type === 'hashtag') {
                <span (click)="filterByHashtag(token.value)" class="text-primary font-semibold hover:underline cursor-pointer mr-1.5">{{ token.value }}</span>
              } @else {
                <span>{{ token.value }}</span>
              }
            }
          </p>
        }
        @if (isEditing) {
          <textarea [(ngModel)]="editCaption" class="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all" rows="3"></textarea>
          <div class="flex justify-end gap-2 mt-2">
            <button (click)="cancelEdit()" class="px-4 py-1.5 text-xs text-text-secondary hover:bg-slate-100 rounded-full font-semibold transition-all">{{ 'COMMUNITY.POST_CARD.CANCEL' | translate }}</button>
            <button (click)="saveEdit()" class="px-4 py-1.5 text-xs bg-primary hover:bg-primary-hover text-white rounded-full font-semibold transition-all shadow-sm">{{ 'COMMUNITY.POST_CARD.SAVE' | translate }}</button>
          </div>
        }

        @if (post.facts?.length) {
          <div class="grid gap-2 mt-3" [style.grid-template-columns]="'repeat(' + post.facts!.length + ', 1fr)'">
            @for (fact of post.facts; track fact.label) {
              <span class="flex flex-col gap-0.5 rounded-lg border border-slate-100 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/30 px-2.5 py-2">
                <span class="text-[9.5px] font-bold tracking-wide text-text-faint">{{ fact.label }}</span>
                <span class="text-xs font-bold text-text-primary">{{ fact.value }}</span>
              </span>
            }
          </div>
        }

        @if (post.points?.length) {
          <div class="flex flex-col gap-1 mt-3">
            @for (point of post.points; track point) {
              <span class="flex items-start gap-1.5 text-xs text-text-secondary">
                <span class="mt-1.5 w-1 h-1 rounded-full bg-text-faint shrink-0"></span>
                <span>{{ point }}</span>
              </span>
            }
          </div>
        }
      </div>

      <!-- Destination badge (inline pill only when there's no image to overlay it on) -->
      @if (post.destination && !isEditing && !post.images?.length) {
        <div class="px-4 pb-3">
          <a [routerLink]="['/destinations', post.destination.id]" class="inline-flex items-center gap-1.5 bg-primary-50 border border-primary-subtle/40 rounded-full px-3 py-1 hover:bg-primary-100 transition-colors">
            <svg class="w-3 h-3 text-primary fill-current" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
            <span class="text-xs font-semibold text-primary">{{ post.destination.name }}</span>
          </a>
        </div>
      }

      <!-- Post Images -->
      @if (post.images?.length) {
        <div class="relative border-y border-slate-100 dark:border-gray-700/70">
          <app-community-post-carousel [images]="post.images" />
          @if (post.destination && !isEditing) {
            <a
              [routerLink]="['/destinations', post.destination.id]"
              class="absolute left-3.5 bottom-3.5 z-10 inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full bg-black/55 backdrop-blur-sm text-white text-[11px] font-semibold hover:bg-black/70 transition-colors"
            >
              <svg class="w-3 h-3 fill-current" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
              {{ post.destination.name }}
            </a>
          }
        </div>
      }

      <!-- Attached Itinerary -->
      @if (post.itinerary) {
        <div class="mx-4 my-4 border border-slate-100 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/30 rounded-2xl p-3.5 flex items-center gap-3.5">
          <img
            [src]="post.itinerary.image || 'assets/images/landing/journey-thailand.jpg'"
            [alt]="'COMMUNITY.POST_CARD.ITINERARY_THUMBNAIL_ALT' | translate"
            class="w-14 h-14 rounded-xl object-cover bg-slate-200 shrink-0"
            loading="lazy"
            decoding="async"
            />
          <div class="flex-1 min-w-0">
            <h4 class="font-semibold text-sm text-text-primary truncate">{{ post.itinerary.title }}</h4>
            <p class="text-xs text-text-secondary truncate mt-0.5">{{ post.itinerary.destination }}</p>
            <p class="text-xs font-semibold text-primary mt-1 flex items-center gap-2">
              <span class="bg-primary-50 text-primary px-2 py-0.5 rounded-full text-2xs border border-primary-subtle/50">
                {{ (getDayCount(post.itinerary) === 1 ? 'COMMUNITY.POST_CARD.DAY_COUNT' : 'COMMUNITY.POST_CARD.DAYS_COUNT') | translate: { count: getDayCount(post.itinerary) } }}
              </span>
              <span class="text-text-tertiary font-normal">·</span>
              <span class="text-text-secondary font-normal">{{ getBudgetTierLabel(post.itinerary.budget) }}</span>
            </p>
          </div>
          <button
            (click)="onCloneTrip.emit(post.itinerary.id)"
            class="shrink-0 bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
            {{ 'COMMUNITY.POST_CARD.CLONE_TRIP' | translate }}
          </button>
        </div>
      }

      <!-- Social line -->
      <div class="px-4 pt-3 text-[11.5px] font-semibold text-text-faint">
        {{ (post.likes === 1 ? 'COMMUNITY.POST_CARD.HELPFUL_COUNT' : 'COMMUNITY.POST_CARD.HELPFUL_COUNT_PLURAL') | translate: { count: post.likes } }}
        ·
        @if (!isDetailView) {
          <button (click)="onToggleCommentsView.emit(post.id)" class="hover:text-primary hover:underline focus:outline-none transition-colors">{{ (post.comments === 1 ? 'COMMUNITY.POST_CARD.COMMENT_COUNT' : 'COMMUNITY.POST_CARD.COMMENTS_COUNT') | translate: { count: post.comments } }}</button>
        } @else {
          {{ (post.comments === 1 ? 'COMMUNITY.POST_CARD.COMMENT_COUNT' : 'COMMUNITY.POST_CARD.COMMENTS_COUNT') | translate: { count: post.comments } }}
        }
      </div>

      @if (post.views_count || post.saveCount || post.usedLabel) {
        <div class="px-4 pt-1.5 text-[11.5px] font-semibold text-text-faint">
          @if (post.usedLabel) {
            {{ post.usedLabel }}
          } @else {
            @if (post.views_count) {
              {{ 'COMMUNITY.POST_CARD.VIEWED_BY_COUNT' | translate: { count: post.views_count } }}
            }
            @if (post.views_count && post.saveCount) {
              ·
            }
            @if (post.saveCount) {
              {{ 'COMMUNITY.POST_CARD.SAVED_BY_COUNT' | translate: { count: post.saveCount } }}
            }
          }
        </div>
      }

      <!-- Actions -->
      <div class="flex items-center gap-2 mx-4 mt-3 mb-4 pt-3 border-t border-slate-100 dark:border-gray-700 flex-wrap">
        <button
          (click)="toggleSavePost()"
          class="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-xs font-semibold border transition-colors focus:outline-none"
          [class.border-primary]="post.isSaved"
          [class.bg-primary-50]="post.isSaved"
          [class.text-primary]="post.isSaved"
          [class.border-slate-200]="!post.isSaved"
          [class.dark:border-gray-700]="!post.isSaved"
          [class.bg-white]="!post.isSaved"
          [class.dark:bg-gray-800]="!post.isSaved"
          [class.text-text-secondary]="!post.isSaved"
          >
          <svg class="w-4 h-4" [attr.fill]="post.isSaved ? 'currentColor' : 'none'" viewBox="0 0 24 24" [attr.stroke]="post.isSaved ? 'none' : 'currentColor'" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
          </svg>
          {{ (post.isSaved ? 'COMMUNITY.POST_CARD.SAVED' : 'COMMUNITY.POST_CARD.SAVE') | translate }}
        </button>
        <button
          (click)="reactPost()"
          class="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-xs font-semibold border transition-colors focus:outline-none"
          [class.border-primary]="post.isLiked"
          [class.bg-primary-50]="post.isLiked"
          [class.text-primary]="post.isLiked"
          [class.border-slate-200]="!post.isLiked"
          [class.dark:border-gray-700]="!post.isLiked"
          [class.bg-white]="!post.isLiked"
          [class.dark:bg-gray-800]="!post.isLiked"
          [class.text-text-secondary]="!post.isLiked"
          >
          <svg class="w-4 h-4" [attr.fill]="post.isLiked ? 'currentColor' : 'none'" viewBox="0 0 24 24" [attr.stroke]="post.isLiked ? 'none' : 'currentColor'" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
          </svg>
          {{ 'COMMUNITY.POST_CARD.HELPFUL' | translate }} · {{ post.likes }}
        </button>
        <button
          (click)="isDetailView ? onCommentFocus.emit() : onToggleCommentsView.emit(post.id)"
          class="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-xs font-semibold border transition-colors focus:outline-none"
          [class.border-primary]="commentsOpen"
          [class.text-primary]="commentsOpen"
          [class.bg-primary-50]="commentsOpen"
          [class.border-slate-200]="!commentsOpen"
          [class.dark:border-gray-700]="!commentsOpen"
          [class.bg-white]="!commentsOpen"
          [class.dark:bg-gray-800]="!commentsOpen"
          [class.text-text-secondary]="!commentsOpen"
          >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          {{ 'COMMUNITY.POST_CARD.DISCUSS' | translate }}
        </button>
        @if (!post.itinerary) {
          <span class="flex-1"></span>
          <button
            (click)="onSave.emit(post.id)"
            class="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover text-white transition-colors focus:outline-none"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            {{ 'COMMUNITY.POST_CARD.ADD_TO_TRIP' | translate }}
          </button>
        }
      </div>

      <ng-content></ng-content>
    </article>

    @if (postToDelete(); as p) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" [attr.aria-labelledby]="'delete-confirm-title-' + post.id" (keydown.escape)="postToDelete.set(null)">
        <div class="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl" cdkTrapFocus cdkTrapFocusAutoCapture>
          <h2 [id]="'delete-confirm-title-' + post.id" class="text-xl font-semibold text-text-primary">{{ 'COMMUNITY.POST_CARD.DELETE_CONFIRM_TITLE' | translate }}</h2>
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
})
export class CommunityPostCardComponent {
  @Input({ required: true }) post!: any;
  @Input() isDetailView = false;
  @Input() commentsOpen = false;

  @Output() onToggleFollow = new EventEmitter<any>();
  @Output() onSave = new EventEmitter<string>();
  @Output() onToggleCommentsView = new EventEmitter<string>();
  @Output() onCloneTrip = new EventEmitter<string>();
  @Output() onCommentFocus = new EventEmitter<void>();
  @Output() onPostDeleted = new EventEmitter<string>();

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
  showReportModal = signal(false);

  private static readonly BUDGET_TIERS = ['budget', 'mid', 'luxury'];

  isAuthor(): boolean {
    return this.post.author?.id === this.authService.user()?.id;
  }

  followButtonState(): 'follow' | 'following' | 'hidden' {
    return getFollowButtonState(this.post);
  }

  kindLabel(): string {
    if (this.post.type === 'qa') return 'QUESTION';
    return 'INSIGHT';
  }

  private static readonly AVATAR_COLORS = ['#0060EA', '#0F9D58', '#D2604B', '#6B3FA0', '#2AA98B', '#E5734E'];

  authorInitial(): string {
    return (this.post.author?.name || '?').trim().charAt(0).toUpperCase();
  }

  authorColor(): string {
    const name: string = this.post.author?.name || '';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = CommunityPostCardComponent.AVATAR_COLORS;
    return colors[Math.abs(hash) % colors.length];
  }

  /** First line reads as a bold headline when the caption spans multiple lines; otherwise it's shown plain. */
  captionHeadline(): string {
    const caption = this.getDisplayCaption();
    const newlineIndex = caption.indexOf('\n');
    return newlineIndex === -1 ? '' : caption.slice(0, newlineIndex).trim();
  }

  captionRest(): string {
    const caption = this.getDisplayCaption();
    const newlineIndex = caption.indexOf('\n');
    return newlineIndex === -1 ? caption : caption.slice(newlineIndex + 1).trim();
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

  toggleSavePost() {
    if (!this.post) return;

    const previousState = { isSaved: this.post.isSaved, saveCount: this.post.saveCount };
    const wasSaved = !!this.post.isSaved;
    this.post.isSaved = !wasSaved;
    this.post.saveCount = Math.max(0, (this.post.saveCount || 0) + (wasSaved ? -1 : 1));

    this.postService.toggleSave(this.post.id).subscribe({
      next: ({ saved }) => {
        this.post.isSaved = saved;
      },
      error: () => {
        this.post.isSaved = previousState.isSaved;
        this.post.saveCount = previousState.saveCount;
        this.toast.error(this.translate.instant('COMMUNITY.POST_CARD.TOAST_SAVE_ERROR'));
      }
    });
  }

  reactPost() {
    if (!this.post) return;

    const reactionType = 'like';
    const previousState = {
      isLiked: this.post.isLiked,
      userReaction: this.post.userReaction,
      likes: this.post.likes,
      reactions: { ...this.post.reactions }
    };

    if (!this.post.reactions) this.post.reactions = {};

    if (this.post.isLiked) {
      this.post.isLiked = false;
      this.post.userReaction = null;
      this.post.likes = Math.max(0, (this.post.likes || 0) - 1);
      this.post.reactions[reactionType] = Math.max(0, (this.post.reactions[reactionType] || 0) - 1);
    } else {
      this.post.isLiked = true;
      this.post.userReaction = reactionType;
      this.post.likes = (this.post.likes || 0) + 1;
      this.post.reactions[reactionType] = (this.post.reactions[reactionType] || 0) + 1;
    }

    this.postService.toggleReaction(this.post.id, reactionType).subscribe({
      next: (res) => {
        this.post.likes = res.likes_count;
        this.post.reactions = res.reactions;
      },
      error: () => {
        this.post.isLiked = previousState.isLiked;
        this.post.userReaction = previousState.userReaction;
        this.post.likes = previousState.likes;
        this.post.reactions = previousState.reactions;
        this.toast.error(this.translate.instant('COMMUNITY.POST_CARD.TOAST_REACTION_ERROR'));
      }
    });
  }

  getDisplayCaption(): string {
    const caption = this.post.caption || '';
    return caption.replace(/\[soundscape:[a-z_]+\]/, '').trim();
  }
}

@Component({
    selector: 'app-community-post-comments',
    imports: [TranslatePipe],
    template: `
    <div class="px-4 pt-4 pb-4 bg-slate-50/60 dark:bg-gray-900/30 border-t border-slate-100 dark:border-gray-700">

      <!-- Comments List -->
      <div class="max-h-80 overflow-y-auto flex flex-col gap-2.5 mb-3">
        @if (loadingComments()) {
          <div class="flex justify-center py-4">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        } @else if (comments().length > 0) {
          @for (comment of comments(); track comment.id) {
            <div class="flex gap-2.5">
              <img [src]="comment.author_avatar || '/assets/images/default-avatar.svg'" class="w-8 h-8 rounded-full object-cover shrink-0 bg-slate-100" loading="lazy" decoding="async" />
              <div class="flex flex-col gap-1 min-w-0">
                <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-2xl rounded-tl-md px-3.5 py-2.5">
                  <span class="block text-[12.5px] font-extrabold text-text-primary">{{ comment.author_name }}</span>
                  <span class="block text-[13px] font-medium leading-relaxed text-text-muted mt-0.5">{{ comment.content }}</span>
                </div>
                <span class="text-[11px] font-semibold text-text-faint pl-3.5">{{ formatDate(comment.created_at) }}</span>
              </div>
            </div>
          }
        } @else {
          <p class="text-xs font-semibold text-text-faint text-center py-4">{{ 'COMMUNITY.NO_COMMENTS_YET' | translate }}</p>
        }
      </div>

      <!-- Comment Composer -->
      <div class="flex items-center gap-2.5">
        <img [src]="myAvatar || '/assets/images/default-avatar.svg'" [attr.alt]="'COMMUNITY.AVATAR_ALT' | translate" class="w-8 h-8 rounded-full object-cover shrink-0 bg-slate-100" />
        <div class="flex-1 flex items-center bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-full px-3.5 focus-within:border-primary transition-colors">
          <input
            type="text"
            [attr.placeholder]="'COMMUNITY.ADD_COMMENT_PLACEHOLDER' | translate"
            class="flex-1 h-10 text-[13px] bg-transparent border-none outline-none focus:ring-0 placeholder:text-text-faint"
            #commentInput
            (keyup.enter)="submitComment(commentInput)"
            [disabled]="loadingSubmit()"
          />
          @if (loadingSubmit()) {
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          }
        </div>
        <button
          type="button"
          (click)="submitComment(commentInput)"
          [disabled]="!commentInput.value.trim() || loadingSubmit()"
          class="shrink-0 h-10 px-4 rounded-full text-xs font-semibold bg-primary hover:bg-primary-hover text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none"
        >
          {{ 'COMMUNITY.POST_COMMENT_BUTTON' | translate }}
        </button>
      </div>
    </div>
  `
})
export class CommunityPostCommentsComponent implements OnInit {
  @Input({ required: true }) postId!: string;
  @Input() myAvatar: string | null = null;
  @Output() commentAdded = new EventEmitter<void>();

  comments = signal<Comment[]>([]);
  loadingComments = signal<boolean>(false);
  loadingSubmit = signal<boolean>(false);

  constructor(
    private commentService: CommunityCommentService,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    this.loadComments();
  }

  loadComments() {
    this.loadingComments.set(true);
    this.commentService.getComments(this.postId).subscribe({
      next: (data) => {
        this.comments.set(data.comments);
        this.loadingComments.set(false);
      },
      error: (err) => {
        console.error('Failed to load comments:', err);
        this.loadingComments.set(false);
      }
    });
  }

  submitComment(inputElement: HTMLInputElement) {
    const content = inputElement.value.trim();
    if (!content || this.loadingSubmit()) return;

    this.loadingSubmit.set(true);
    this.commentService.createComment(this.postId, content).subscribe({
      next: (comment) => {
        this.comments.update(curr => [comment, ...curr]);
        inputElement.value = '';
        this.commentAdded.emit();
        this.loadingSubmit.set(false);
      },
      error: (err) => {
        console.error('Failed to create comment:', err);
        this.loadingSubmit.set(false);
      }
    });
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
}

@Component({
    selector: 'app-community-create-post',
    imports: [CommonModule, TranslatePipe],
    template: `
    <div class="w-full bg-white/80 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100/80 dark:border-gray-700/80 transition-all duration-300">
      <!-- Post type chips -->
      <div class="flex gap-2 px-4 pt-3 pb-0 overflow-x-auto no-scrollbar">
        @for (type of postTypes; track type.value) {
          <button
            type="button"
            (click)="setPostType(type.value)"
            class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-2xs-plus font-bold border transition-all focus:outline-none"
            [ngClass]="selectedPostType === type.value ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-200 dark:border-gray-700'"
          >
            <span>{{ type.emoji }}</span> {{ type.label }}
          </button>
        }
      </div>
      <div class="p-4 flex gap-3.5">
        <!-- Avatar -->
        <img [src]="userAvatar || '/assets/images/default-avatar.svg'" [attr.alt]="'COMMUNITY.AVATAR_ALT' | translate" class="w-11 h-11 rounded-full object-cover bg-slate-50 dark:bg-gray-700 border border-slate-100 dark:border-gray-700 shadow-sm shrink-0" />

        <div class="flex-1 space-y-4">
          <!-- Caption -->
          <div class="relative">
            <textarea
              #captionInput
            (focus)="expandForm()"
            [attr.placeholder]="getPlaceholder()"
              class="w-full px-4 py-3 bg-slate-50/60 dark:bg-gray-900/40 border border-slate-200/60 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-gray-900/60 transition-all resize-none text-text-primary placeholder-text-disabled text-sm font-medium"
              [class.h-11]="!isExpanded"
              [class.h-28]="isExpanded"
              maxlength="2000"
            ></textarea>
            @if (isExpanded) {
              <div class="absolute bottom-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-md bg-white/80 dark:bg-gray-800/80 backdrop-blur border border-slate-100 dark:border-gray-700 shadow-sm text-text-tertiary select-none">
                {{ captionInput.value.length }}/2000
              </div>
            }
          </div>

          @if (isExpanded) {
            <div class="space-y-4 animate-fade-in-up">
              <!-- Media Previews -->
              @if (previewImages.length > 0 || videoPreviewUrl) {
                <div class="space-y-4">
                  <!-- Image Previews -->
                  @if (previewImages.length > 0) {
                    <div class="grid grid-cols-3 gap-3">
                      @for (image of previewImages; track image.url; let i = $index) {
                        <div class="relative aspect-square group/item rounded-xl overflow-hidden shadow-sm border border-slate-200/50">
                          <img [src]="image.url" [attr.alt]="'COMMUNITY.CREATE_POST.PREVIEW_ALT' | translate" class="w-full h-full object-cover transition-transform duration-300 group-hover/item:scale-105" loading="lazy" decoding="async" />
                          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              (click)="removeImage($event, i)"
                              class="bg-red-500 hover:bg-red-600 text-white rounded-full p-2 focus:outline-none transform hover:scale-110 transition-transform shadow-md"
                            >
                              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  }

                  <!-- Video Preview -->
                  @if (videoPreviewUrl) {
                    <div class="relative group rounded-xl overflow-hidden shadow-sm bg-black border border-slate-200/50 max-w-sm mx-auto">
                      <video [src]="videoPreviewUrl" controls class="w-full max-h-60"></video>
                      <button
                        type="button"
                        (click)="removeVideo()"
                        class="absolute top-2.5 right-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 focus:outline-none transform hover:scale-110 transition-all shadow-md"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p class="text-2xs font-extrabold text-text-tertiary mt-1.5 uppercase tracking-wider text-center">{{ 'COMMUNITY.CREATE_POST.REEL_NOTICE' | translate }}</p>
                  }
                </div>
              }

              <!-- Hidden File Inputs -->
              <input
                #fileInput
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                (change)="onImageSelect($event)"
              />
              <input
                #videoInput
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                class="hidden"
                (change)="onVideoSelect($event)"
              />

              <!-- Location/Destination -->
              @if (showLocationInput || showTripInput) {
                <div class="grid grid-cols-1 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  @if (showLocationInput) {
                    <div class="space-y-2">
                      <label class="block text-2xs font-extrabold text-text-tertiary uppercase tracking-wider">{{ 'COMMUNITY.CREATE_POST.TAG_DESTINATION' | translate }}</label>
                      <div class="relative">
                        <input
                          #destinationInput
                          type="text"
                          role="combobox"
                          aria-autocomplete="list"
                          [attr.aria-expanded]="showDestinationsDropdown && destinationOptions.length > 0"
                          aria-controls="community-destination-listbox"
                          [attr.aria-activedescendant]="activeDestinationIndex >= 0 ? 'community-dest-option-' + activeDestinationIndex : null"
                          [attr.placeholder]="'COMMUNITY.CREATE_POST.SEARCH_DESTINATIONS' | translate"
                          class="w-full px-4 py-2.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-semibold text-text-primary shadow-sm"
                          (input)="onDestinationSearch($event)"
                          (keydown)="onDestinationKeydown($event)"
                          [value]="selectedDestination?.name || destinationQuery"
                        />
                        @if (showDestinationsDropdown && destinationOptions.length > 0) {
                          <ul
                            id="community-destination-listbox"
                            class="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] max-h-60 overflow-auto divide-y divide-slate-50 dark:divide-gray-700"
                            role="listbox"
                            [attr.aria-label]="'COMMUNITY.CREATE_POST.SEARCH_DESTINATIONS' | translate"
                          >
                            @for (dest of destinationOptions; track dest.id; let i = $index) {
                              <li>
                                <button
                                  type="button"
                                  [id]="'community-dest-option-' + i"
                                  class="w-full px-4 py-3 hover:bg-primary-50/50 cursor-pointer flex items-center gap-3 transition-colors text-left"
                                  [class.bg-primary-50]="activeDestinationIndex === i"
                                  role="option"
                                  [attr.aria-selected]="activeDestinationIndex === i"
                                  (mousedown)="$event.preventDefault()"
                                  (click)="selectDestination(dest)"
                                >
                                  <img [src]="dest.image || 'assets/images/placeholder.jpg'" class="w-10 h-10 rounded-lg object-cover shadow-sm shrink-0 border border-slate-100" alt="" loading="lazy" decoding="async" />
                                  <div>
                                    <p class="text-xs font-bold text-text-primary">{{ dest.name }}</p>
                                    <p class="text-[9px] font-extrabold text-text-tertiary uppercase tracking-wider">{{ dest.country }}</p>
                                  </div>
                                </button>
                              </li>
                            }
                          </ul>
                        }
                      </div>
                    </div>
                  }

                  @if (showTripInput) {
                    <div class="space-y-2">
                      <label class="block text-2xs font-extrabold text-text-tertiary uppercase tracking-wider">{{ 'COMMUNITY.CREATE_POST.ATTACH_ITINERARY' | translate }}</label>
                      <div class="relative">
                        <select
                          (change)="onTripSelect($event)"
                          class="w-full px-4 py-2.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-semibold text-text-primary appearance-none cursor-pointer shadow-sm"
                        >
                          <option value="">{{ 'COMMUNITY.CREATE_POST.NO_ITINERARY' | translate }}</option>
                          @for (trip of trips; track trip.id) {
                            <option [value]="trip.id">{{ trip.title }} ({{ trip.destination }})</option>
                          }
                        </select>
                        <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none text-text-tertiary">
                          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }

              <!-- Soundscape Selector Dropdown -->
              @if (showSoundscapeDropdown) {
                <div class="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-2 animate-fade-in-up">
                  <label class="block text-2xs font-extrabold text-text-tertiary uppercase tracking-wider">{{ 'COMMUNITY.CREATE_POST.SOUNDSCAPE_LABEL' | translate }}</label>
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button type="button" (click)="selectSoundscape('none')" class="px-3 py-2 rounded-xl border text-xs font-bold transition-all text-center" [class]="selectedSoundscape === 'none' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'">{{ 'COMMUNITY.CREATE_POST.SOUNDSCAPE_NONE' | translate }}</button>
                    <button type="button" (click)="selectSoundscape('kyoto_rain')" class="px-3 py-2 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5" [class]="selectedSoundscape === 'kyoto_rain' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'">🌧️ {{ 'COMMUNITY.CREATE_POST.SOUNDSCAPE_KYOTO_RAIN' | translate }}</button>
                    <button type="button" (click)="selectSoundscape('bali_beach')" class="px-3 py-2 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5" [class]="selectedSoundscape === 'bali_beach' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'">🌊 {{ 'COMMUNITY.CREATE_POST.SOUNDSCAPE_BALI_BEACH' | translate }}</button>
                    <button type="button" (click)="selectSoundscape('paris_cafe')" class="px-3 py-2 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5" [class]="selectedSoundscape === 'paris_cafe' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'">☕ {{ 'COMMUNITY.CREATE_POST.SOUNDSCAPE_PARIS_CAFE' | translate }}</button>
                  </div>
                </div>
              }

              <!-- Soundwave Visualizer -->
              @if (selectedSoundscape !== 'none') {
                <div class="flex items-center justify-center gap-1 h-8 bg-slate-50 rounded-lg border border-slate-100 px-4">
                  @for (i of [1,2,3,4,5,6,7,8,9,10,11,12]; track i) {
                    <div class="w-1 bg-primary/40 rounded-full animate-[soundwave_1s_ease-in-out_infinite]" [style.animation-delay]="(i * 0.1) + 's'"></div>
                  }
                </div>
              }

              <!-- Action Toolbar -->
              <div class="flex items-center justify-between pt-1">
                <div class="flex items-center gap-1.5 text-primary">
                  <button type="button" (click)="fileInput.click()" class="p-2 hover:bg-primary-50 rounded-full transition-colors focus:outline-none" [title]="'COMMUNITY.CREATE_POST.ATTACH_PHOTOS_TITLE' | translate" [attr.aria-label]="'COMMUNITY.CREATE_POST.ATTACH_PHOTOS_TITLE' | translate">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button type="button" (click)="videoInput.click()" class="p-2 hover:bg-primary-50 rounded-full transition-colors focus:outline-none" [title]="'COMMUNITY.CREATE_POST.ATTACH_VIDEO_TITLE' | translate" [attr.aria-label]="'COMMUNITY.CREATE_POST.ATTACH_VIDEO_TITLE' | translate">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button type="button" (click)="showLocationInput = !showLocationInput" class="p-2 rounded-full transition-colors focus:outline-none" [class]="showLocationInput ? 'bg-primary-50 text-primary' : 'hover:bg-primary-50'" [title]="'COMMUNITY.CREATE_POST.TAG_DESTINATION' | translate" [attr.aria-label]="'COMMUNITY.CREATE_POST.TAG_DESTINATION' | translate">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button type="button" (click)="showTripInput = !showTripInput" class="p-2 rounded-full transition-colors focus:outline-none" [class]="showTripInput ? 'bg-primary-50 text-primary' : 'hover:bg-primary-50'" [title]="'COMMUNITY.CREATE_POST.ATTACH_ITINERARY' | translate" [attr.aria-label]="'COMMUNITY.CREATE_POST.ATTACH_ITINERARY' | translate">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </button>
                  <button type="button" (click)="toggleSoundscapeDropdown()" class="p-2 rounded-full transition-colors focus:outline-none" [class]="selectedSoundscape !== 'none' ? 'bg-primary-50 text-primary' : 'hover:bg-primary-50'" [title]="'COMMUNITY.CREATE_POST.ATTACH_SOUNDSCAPE_TITLE' | translate" [attr.aria-label]="'COMMUNITY.CREATE_POST.ATTACH_SOUNDSCAPE_TITLE' | translate">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </button>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    (click)="collapseForm()"
                    class="px-4 py-1.5 text-xs text-text-secondary hover:bg-slate-100 rounded-full font-bold transition-all focus:outline-none"
                  >
                    {{ 'COMMUNITY.CREATE_POST.CANCEL' | translate }}
                  </button>
                  <button
                    (click)="submitPost(captionInput.value, '')"
                    [disabled]="!captionInput.value.trim() || isLoading"
                    class="px-6 py-1.5 text-xs bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-700 text-white rounded-full shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-bold transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    @if (isLoading) {
                      <svg class="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    }
                    {{ isLoading ? ('COMMUNITY.CREATE_POST.POSTING' | translate) : ('COMMUNITY.CREATE_POST.POST' | translate) }}
                  </button>
                </div>
              </div>

              @if (error) {
                <div class="bg-danger-50 border border-red-200 text-danger px-3 py-2.5 rounded-xl text-xs font-semibold shadow-sm animate-fade-in-up">
                  {{ error }}
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
    styles: [`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    @keyframes soundwave {
      0% { height: 3px; }
      100% { height: 12px; }
    }
  `]
})
export class CommunityCreatePostComponent implements OnInit, OnDestroy {
  @Input() userAvatar?: string;
  @Input() initialType?: string;
  @Output() postCreated = new EventEmitter<CommunityPost>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('captionInput') captionInputRef!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('destinationInput') destinationInputRef?: ElementRef<HTMLInputElement>;

  private readonly destinationSearch = inject(DestinationSearchService);

  postTypes = [
    { value: 'photo', label: 'Photo', emoji: '📸' },
    { value: 'trip_share', label: 'Trip Share', emoji: '✈️' },
    { value: 'buddy_request', label: 'Find Buddy', emoji: '🤝' },
    { value: 'qa', label: 'Q&A Thread', emoji: '💬' },
  ];
  selectedPostType = 'photo';

  isExpanded = false;
  showLocationInput = false;
  showTripInput = false;
  selectedSoundscape = 'none';
  showSoundscapeDropdown = false;

  previewImages: { file: File, url: string }[] = [];
  videoFile: File | null = null;
  videoPreviewUrl: string | null = null;
  isLoading = false;
  error: string | null = null;

  destinationOptions: DestinationOption[] = [];
  selectedDestination: DestinationOption | null = null;
  destinationQuery = '';
  showDestinationsDropdown = false;
  activeDestinationIndex = -1;
  private searchSubject = new Subject<string>();
  private searchSubscription = this.searchSubject
    .pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query) => {
        if (!query) return of<DestinationListItem[]>([]);
        return this.destinationSearch.search(query, 5);
      }),
    )
    .subscribe((rows) => {
      this.destinationOptions = rows.map((item) => this.toDestinationOption(item));
      this.showDestinationsDropdown = this.destinationOptions.length > 0;
      this.activeDestinationIndex = -1;
    });

  trips: any[] = [];
  selectedTripId: string | null = null;

  constructor(
    private postService: CommunityPostService,
    private http: HttpClient,
    private translate: TranslateService
  ) {}

  setPostType(type: string) {
    this.selectedPostType = type;
    if (type === 'buddy_request') {
      this.showLocationInput = true;
      this.expandForm();
    } else if (type === 'trip_share') {
      this.showTripInput = true;
      this.expandForm();
    }
  }

  getPlaceholder(): string {
    switch (this.selectedPostType) {
      case 'trip_share': return 'Share your trip story…';
      case 'buddy_request': return 'Looking for a travel buddy? Describe your trip plans…';
      default: return this.translate.instant('COMMUNITY.CREATE_POST.CAPTION_PLACEHOLDER');
    }
  }

  ngOnInit() {
    if (this.initialType && this.postTypes.some(t => t.value === this.initialType)) {
      this.setPostType(this.initialType);
      this.expandForm();
    }

    this.destinationSearch.load();

    this.http.get<any>(apiUrl('/trips')).subscribe({
      next: (res) => {
        this.trips = res.items || [];
      },
      error: (err) => console.error('Failed to load trips', err)
    });
  }

  onTripSelect(event: Event) {
    this.selectedTripId = (event.target as HTMLSelectElement).value || null;
  }

  ngOnDestroy(): void {
    this.searchSubscription.unsubscribe();
  }

  onDestinationSearch(event: Event) {
    const query = (event.target as HTMLInputElement).value.trim();
    this.destinationQuery = (event.target as HTMLInputElement).value;

    // Allow clearing
    if (!query) {
      this.selectedDestination = null;
      this.showDestinationsDropdown = false;
      this.activeDestinationIndex = -1;
      this.searchSubject.next('');
      return;
    }

    if (this.selectedDestination && query !== this.selectedDestination.name) {
      this.selectedDestination = null;
    }

    this.searchSubject.next(query);
  }

  onDestinationKeydown(event: KeyboardEvent): void {
    if (!this.showDestinationsDropdown || !this.destinationOptions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeDestinationIndex = (this.activeDestinationIndex + 1) % this.destinationOptions.length;
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeDestinationIndex =
        this.activeDestinationIndex <= 0
          ? this.destinationOptions.length - 1
          : this.activeDestinationIndex - 1;
      return;
    }
    if (event.key === 'Enter' && this.activeDestinationIndex >= 0) {
      event.preventDefault();
      this.selectDestination(this.destinationOptions[this.activeDestinationIndex]!);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.showDestinationsDropdown = false;
      this.activeDestinationIndex = -1;
    }
  }

  selectDestination(dest: DestinationOption) {
    this.selectedDestination = dest;
    this.destinationQuery = dest.name;
    this.showDestinationsDropdown = false;
    this.activeDestinationIndex = -1;
    if (this.destinationInputRef) {
      this.destinationInputRef.nativeElement.value = dest.name;
    }
  }

  private toDestinationOption(item: DestinationListItem): DestinationOption {
    return {
      id: item.id ?? item.name,
      name: item.name,
      country:
        item.country ||
        item.region ||
        this.translate.instant('COMMUNITY.CREATE_POST.UNKNOWN_COUNTRY'),
      image: item.image || '',
    };
  }

  onImageSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      Array.from(input.files).forEach(file => {
        this.previewImages.push({
          file,
          url: URL.createObjectURL(file)
        });
      });
    }
  }

  removeImage(event: Event, index: number) {
    event.stopPropagation();
    const item = this.previewImages[index];
    if (item) {
      URL.revokeObjectURL(item.url);
      this.previewImages.splice(index, 1);
    }
  }

  onVideoSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      this.error = this.translate.instant('COMMUNITY.CREATE_POST.VIDEO_TOO_LARGE');
      return;
    }
    if (this.videoPreviewUrl) URL.revokeObjectURL(this.videoPreviewUrl);
    this.videoFile = file;
    this.videoPreviewUrl = URL.createObjectURL(file);
    this.error = null;
  }

  removeVideo() {
    if (this.videoPreviewUrl) URL.revokeObjectURL(this.videoPreviewUrl);
    this.videoFile = null;
    this.videoPreviewUrl = null;
  }

  submitPost(caption: string, location: string) {
    if (!caption.trim()) {
      this.error = this.translate.instant('COMMUNITY.CREATE_POST.CAPTION_REQUIRED');
      return;
    }

    this.isLoading = true;
    this.error = null;

    const imageUploads = this.previewImages.map(img =>
      this.postService.uploadImage(img.file).pipe(
        catchError(err => {
          console.error('Upload failed for file', img.file.name, err);
          throw err;
        })
      )
    );
    const videoUpload = this.videoFile ? this.postService.uploadImage(this.videoFile) : of(null);

    // Object form avoids forkJoin([]) never-emitting when there are no images.
    forkJoin({
      images: imageUploads.length ? forkJoin(imageUploads) : of([] as { url: string }[]),
      video: videoUpload
    }).subscribe({
      next: ({ images, video }) => {
        const imageUrls = (images as { url: string }[]).map(res => res.url);
        const videoUrl = video ? (video as { url: string }).url : undefined;

        let finalCaption = caption.trim();
        if (this.selectedSoundscape !== 'none') {
          finalCaption = finalCaption + ' [soundscape:' + this.selectedSoundscape + ']';
        }

        this.postService.createPost({
          caption: finalCaption,
          location: location.trim() || undefined,
          destination_id: this.selectedDestination?.id,
          images: imageUrls,
          itinerary_id: this.selectedTripId || undefined,
          video_url: videoUrl,
          is_reel: !!videoUrl
        }).subscribe({
          next: (post) => {
            this.postCreated.emit(post);
            this.closeModal();
          },
          error: (err) => {
            console.error('Failed to create post:', err);
            this.error = apiErrorMessage(err, this.translate.instant('COMMUNITY.CREATE_POST.CREATE_FAILED'));
            this.isLoading = false;
          }
        });
      },
      error: (err) => {
        this.error = this.translate.instant('COMMUNITY.CREATE_POST.UPLOAD_FAILED');
        this.isLoading = false;
      }
    });
  }

  toggleSoundscapeDropdown() {
    this.showSoundscapeDropdown = !this.showSoundscapeDropdown;
  }

  selectSoundscape(type: string) {
    this.selectedSoundscape = type;
    this.showSoundscapeDropdown = false;
  }

  expandForm() {
    this.isExpanded = true;
  }

  collapseForm() {
    if (this.previewImages.length > 0 || this.videoFile || this.captionInputRef?.nativeElement.value) {
      if (!window.confirm(this.translate.instant('COMMUNITY.CREATE_POST.DISCARD_CONFIRM'))) {
        return;
      }
    }

    this.previewImages.forEach(img => URL.revokeObjectURL(img.url));
    if (this.videoPreviewUrl) URL.revokeObjectURL(this.videoPreviewUrl);

    this.previewImages = [];
    this.videoFile = null;
    this.videoPreviewUrl = null;
    if (this.captionInputRef) this.captionInputRef.nativeElement.value = '';
    this.selectedDestination = null;
    this.selectedTripId = null;
    this.destinationQuery = '';
    this.activeDestinationIndex = -1;

    this.showLocationInput = false;
    this.showTripInput = false;
    this.selectedSoundscape = 'none';
    this.showSoundscapeDropdown = false;
    this.isExpanded = false;
    this.closed.emit();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event) {
    if (this.showDestinationsDropdown) {
      this.showDestinationsDropdown = false;
      this.activeDestinationIndex = -1;
      return;
    }
    if (this.isExpanded) {
      this.collapseForm();
    }
  }

  closeModal() {
    this.collapseForm();
  }
}
