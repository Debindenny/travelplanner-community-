import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';

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
              <span
                class="h-[21px] px-2.5 rounded-md text-[9.5px] font-semibold tracking-wide flex items-center whitespace-nowrap"
                [class.text-primary]="kindLabel() === 'INSIGHT'"
                [class.bg-primary-50]="kindLabel() === 'INSIGHT'"
                [class.text-purple-700]="kindLabel() === 'POLL'"
                [class.bg-purple-50]="kindLabel() === 'POLL'"
                [class.text-amber-700]="kindLabel() === 'QUESTION'"
                [class.bg-amber-50]="kindLabel() === 'QUESTION'"
              >{{ kindLabel() }}</span>
            </div>
            <p class="text-xs font-semibold text-text-faint mt-0.5 truncate">
              {{ formatDate(post.created_at) }}
              @if (post.location && !isEditing) {
                <span> · {{ post.location }}</span>
              }
            </p>
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
          } @else {
            <button
              (click)="onToggleFollow.emit(post)"
              class="h-8 px-3.5 rounded-lg text-[11.5px] font-semibold whitespace-nowrap border transition-colors focus:outline-none"
              [class.border-primary]="!post.is_following"
              [class.text-primary]="!post.is_following"
              [class.bg-white]="!post.is_following"
              [class.dark:bg-gray-800]="!post.is_following"
              [class.border-slate-200]="post.is_following"
              [class.dark:border-gray-700]="post.is_following"
              [class.bg-slate-50]="post.is_following"
              [class.dark:bg-gray-700]="post.is_following"
              [class.text-text-faint]="post.is_following"
              >
              {{ (post.is_following ? 'COMMUNITY.FOLLOWING' : 'COMMUNITY.POST_CARD.FOLLOW') | translate }}
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

      <!-- Poll -->
      @if (post.type === 'poll' && post.poll) {
        <div class="px-4 pb-3">
          <app-community-poll [poll]="post.poll" />
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

      <!-- Actions -->
      <div class="flex items-center gap-2 mx-4 mt-3 mb-4 pt-3 border-t border-slate-100 dark:border-gray-700 flex-wrap">
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
          {{ 'COMMUNITY.POST_CARD.COMMENT' | translate }} · {{ post.comments }}
        </button>
        <button
          (click)="sharePost()"
          class="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-text-secondary hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors focus:outline-none"
          >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          {{ 'COMMUNITY.POST_CARD.SHARE' | translate }}
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

  kindLabel(): string {
    if (this.post.type === 'poll') return 'POLL';
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

  getDisplayCaption(): string {
    const caption = this.post.caption || '';
    return caption.replace(/\[soundscape:[a-z_]+\]/, '').trim();
  }
}
