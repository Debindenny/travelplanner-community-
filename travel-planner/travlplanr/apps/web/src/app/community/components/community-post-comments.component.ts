import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityCommentService, Comment } from '../services/community-comment.service';

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
