import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityCommentService, Comment } from '../services/community-comment.service';

@Component({
    selector: 'app-community-post-comments',
    imports: [TranslatePipe],
    template: `
    <!-- Comment Input -->
    <div class="px-4 py-3 flex items-start gap-2 bg-gray-50 transition-all">
      <img [src]="myAvatar || '/assets/images/default-avatar.svg'" [attr.alt]="'COMMUNITY.AVATAR_ALT' | translate" class="w-10 h-10 rounded-full object-cover shrink-0 bg-gray-50" />
      <div class="flex-1 bg-white border border-gray-300 rounded-full flex items-center px-4 py-2 focus-within:border-gray-500 transition-colors">
        <input
          type="text"
          [attr.placeholder]="'COMMUNITY.ADD_COMMENT_PLACEHOLDER' | translate"
          class="flex-1 text-sm bg-transparent border-none outline-none focus:ring-0 placeholder-gray-500"
          #commentInput
          (keyup.enter)="submitComment(commentInput)"
          [disabled]="loadingSubmit()"
        />
        @if (loadingSubmit()) {
          <div class="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        }
      </div>
    </div>

    <!-- Comments List -->
    <div class="px-4 pb-4 max-h-80 overflow-y-auto bg-gray-50 space-y-4">
      @if (loadingComments()) {
        <div class="flex justify-center py-4">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      } @else if (comments().length > 0) {
        @for (comment of comments(); track comment.id) {
          <div class="flex gap-2 group transition-all">
            <img [src]="comment.author_avatar || '/assets/images/default-avatar.svg'" class="w-10 h-10 rounded-full object-cover shrink-0 bg-gray-50" loading="lazy" decoding="async" />
            <div class="bg-gray-100 rounded-bl-xl rounded-r-xl p-3 flex-1 group-hover:bg-gray-200 transition-colors">
              <div class="flex justify-between items-start">
                <span class="font-bold text-sm text-gray-900">{{ comment.author_name }}</span>
                <span class="text-xs text-gray-500">{{ formatDate(comment.created_at) }}</span>
              </div>
              <p class="text-sm text-gray-800 mt-1">{{ comment.content }}</p>
            </div>
          </div>
        }
      } @else {
        <p class="text-sm text-gray-500 text-center py-4">{{ 'COMMUNITY.NO_COMMENTS_YET' | translate }}</p>
      }
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
