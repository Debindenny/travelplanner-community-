import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

export interface Answer {
  id: string;
  authorName: string;
  authorAvatar: string | null;
  authorLevelRank?: number;
  content: string;
  votes: number;
  isAccepted: boolean;
  isUpvotedByUser: boolean;
  createdAt: string;
  replies?: Answer[];
}

@Component({
    selector: 'app-community-qa-thread',
    imports: [CommonModule, TranslatePipe, FormsModule],
    template: `
    <div class="bg-white dark:bg-gray-800/90 rounded-2xl border border-slate-100 dark:border-gray-700/80 p-4 mt-3">
      <div class="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-gray-700 pb-2">
        <h4 class="font-extrabold text-sm text-text-primary dark:text-white flex items-center gap-1.5">
          <span>💬 {{ 'COMMUNITY.QA.ANSWERS_LABEL' | translate }}</span>
          <span class="text-xs font-bold text-text-tertiary">({{ answers().length }})</span>
        </h4>
        <div class="flex items-center gap-2">
          <select 
            [(ngModel)]="sortBy" 
            (change)="sortAnswers()"
            class="text-2xs font-bold bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg px-2 py-1 text-text-secondary dark:text-gray-300 focus:outline-none"
          >
            <option value="votes">{{ 'COMMUNITY.QA.SORT_VOTES' | translate }}</option>
            <option value="recent">{{ 'COMMUNITY.QA.SORT_RECENT' | translate }}</option>
          </select>
        </div>
      </div>

      <!-- Answers List -->
      <div class="space-y-4 max-h-96 overflow-y-auto pr-1">
        @for (ans of answers(); track ans.id) {
          <div
            class="flex gap-3 p-3 rounded-2xl transition-all border"
            [class.border-slate-100]="!ans.isAccepted"
            [ngClass]="{
              'bg-emerald-50/30': ans.isAccepted,
              'border-emerald-200/50': ans.isAccepted,
              'bg-slate-50/50': !ans.isAccepted,
              'dark:bg-gray-800/50': !ans.isAccepted,
              'dark:border-gray-700/50': !ans.isAccepted
            }"
          >
            <!-- Upvote Button Stack -->
            <div class="flex flex-col items-center gap-1">
              <button 
                (click)="upvote(ans.id)"
                class="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-slate-100 dark:hover:bg-gray-700 focus:outline-none"
                [class.text-primary]="ans.isUpvotedByUser"
                [class.text-text-tertiary]="!ans.isUpvotedByUser"
              >
                ▲
              </button>
              <span class="text-xs font-extrabold text-text-secondary dark:text-gray-300">{{ ans.votes }}</span>
            </div>

            <!-- Answer Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2">
                  <span class="font-extrabold text-xs text-text-primary dark:text-white">{{ ans.authorName }}</span>
                  @if (ans.authorLevelRank) {
                    <span class="text-[8px] font-extrabold text-primary bg-primary-50 px-1 py-0.5 rounded">Lv.{{ ans.authorLevelRank }}</span>
                  }
                  @if (ans.isAccepted) {
                    <span class="text-[9px] font-extrabold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      ✓ {{ 'COMMUNITY.QA.ACCEPTED' | translate }}
                    </span>
                  }
                </div>
                <span class="text-[10px] text-text-disabled">{{ formatDate(ans.createdAt) }}</span>
              </div>

              <p class="text-xs text-text-secondary dark:text-gray-300 mt-2 whitespace-pre-wrap leading-relaxed">
                {{ ans.content }}
              </p>

              <!-- Answer Actions -->
              <div class="flex items-center gap-4 mt-3">
                @if (isPostAuthor && !ans.isAccepted) {
                  <button 
                    (click)="acceptAnswer(ans.id)"
                    class="text-[10px] font-extrabold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-0.5"
                  >
                    ✓ {{ 'COMMUNITY.QA.ACCEPT_ACTION' | translate }}
                  </button>
                }
                <button 
                  (click)="showReplyFormId.set(ans.id)"
                  class="text-[10px] font-extrabold text-primary hover:underline"
                >
                  {{ 'COMMUNITY.QA.REPLY' | translate }}
                </button>
              </div>

              <!-- Nested replies -->
              @if (ans.replies && ans.replies.length > 0) {
                <div class="mt-3 pl-4 border-l-2 border-slate-100 dark:border-gray-700 space-y-3">
                  @for (reply of ans.replies; track reply.id) {
                    <div class="flex gap-2">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-extrabold text-[11px] text-text-primary dark:text-white">{{ reply.authorName }}</span>
                          <span class="text-[9px] text-text-disabled">{{ formatDate(reply.createdAt) }}</span>
                        </div>
                        <p class="text-xs text-text-secondary dark:text-gray-300 mt-1">{{ reply.content }}</p>
                      </div>
                    </div>
                  }
                </div>
              }

              <!-- Reply Form -->
              @if (showReplyFormId() === ans.id) {
                <div class="mt-3 flex gap-2">
                  <input 
                    #replyInput
                    type="text" 
                    placeholder="Write a reply..."
                    class="flex-1 text-xs px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 text-slate-800 dark:text-white"
                    (keyup.enter)="submitReply(ans.id, replyInput.value); replyInput.value = ''"
                  />
                  <button 
                    (click)="submitReply(ans.id, replyInput.value); replyInput.value = ''"
                    class="bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  >
                    Reply
                  </button>
                  <button 
                    (click)="showReplyFormId.set(null)"
                    class="text-xs text-text-tertiary hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              }
            </div>
          </div>
        }
        @if (answers().length === 0) {
          <p class="text-xs text-text-disabled text-center py-6">{{ 'COMMUNITY.QA.NO_ANSWERS' | translate }}</p>
        }
      </div>

      <!-- Post Answer Input -->
      <div class="mt-4 pt-3 border-t border-slate-100 dark:border-gray-700 flex gap-2">
        <textarea
          #answerText
          rows="2"
          [placeholder]="'COMMUNITY.QA.POST_ANSWER_PLACEHOLDER' | translate"
          class="flex-1 text-xs p-3 border border-slate-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 text-slate-800 dark:text-white resize-none"
        ></textarea>
        <button 
          (click)="submitAnswer(answerText.value); answerText.value = ''"
          class="bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-700 text-white px-5 rounded-2xl text-xs font-extrabold shadow-sm transition-all shrink-0 h-10 flex items-center justify-center self-end"
        >
          {{ 'COMMUNITY.QA.POST_ANSWER' | translate }}
        </button>
      </div>
    </div>
  `
})
export class CommunityQaThreadComponent implements OnInit {
  @Input({ required: true }) postId!: string;
  @Input() isPostAuthor = false;

  answers = signal<Answer[]>([]);
  sortBy = 'votes';
  showReplyFormId = signal<string | null>(null);

  ngOnInit() {
    this.loadAnswers();
  }

  loadAnswers() {
    // In a real implementation this would fetch from communityPostService.getAnswers(postId)
    // Providing seed/fallback answers for display:
    this.answers.set([
      {
        id: 'ans1',
        authorName: 'Sarah Jenkins',
        authorAvatar: null,
        authorLevelRank: 4,
        content: 'I highly recommend Kyoto in November! The autumn leaves (momiji) are spectacular, especially at Kiyomizu-dera and Tofuku-ji. The weather is cool and perfect for walking around.',
        votes: 14,
        isAccepted: true,
        isUpvotedByUser: false,
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        replies: [
          {
            id: 'rep1',
            authorName: 'John Doe',
            authorAvatar: null,
            content: 'Agreed! Tofuku-ji has the best bridge view for autumn leaves.',
            votes: 2,
            isAccepted: false,
            isUpvotedByUser: false,
            createdAt: new Date(Date.now() - 3600000 * 20).toISOString()
          }
        ]
      },
      {
        id: 'ans2',
        authorName: 'Alex Mercer',
        authorAvatar: null,
        authorLevelRank: 2,
        content: 'Spring is beautiful for cherry blossoms, but it gets extremely crowded. Autumn is slightly less crowded and has gorgeous colors. Summer is very hot and humid, so avoid July/August if possible.',
        votes: 8,
        isAccepted: false,
        isUpvotedByUser: false,
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        replies: []
      }
    ]);
    this.sortAnswers();
  }

  sortAnswers() {
    this.answers.update(ans => {
      const sorted = [...ans];
      if (this.sortBy === 'votes') {
        sorted.sort((a, b) => {
          if (a.isAccepted !== b.isAccepted) return a.isAccepted ? -1 : 1;
          return b.votes - a.votes;
        });
      } else {
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      return sorted;
    });
  }

  upvote(answerId: string) {
    this.answers.update(list => list.map(ans => {
      if (ans.id === answerId) {
        const diff = ans.isUpvotedByUser ? -1 : 1;
        return {
          ...ans,
          isUpvotedByUser: !ans.isUpvotedByUser,
          votes: ans.votes + diff
        };
      }
      return ans;
    }));
    this.sortAnswers();
  }

  acceptAnswer(answerId: string) {
    this.answers.update(list => list.map(ans => ({
      ...ans,
      isAccepted: ans.id === answerId
    })));
    this.sortAnswers();
  }

  submitAnswer(content: string) {
    if (!content.trim()) return;
    const newAnswer: Answer = {
      id: 'ans_' + Math.random().toString(36).substr(2, 9),
      authorName: 'You',
      authorAvatar: null,
      authorLevelRank: 1,
      content: content.trim(),
      votes: 0,
      isAccepted: false,
      isUpvotedByUser: false,
      createdAt: new Date().toISOString(),
      replies: []
    };
    this.answers.update(list => [...list, newAnswer]);
    this.sortAnswers();
  }

  submitReply(answerId: string, content: string) {
    if (!content.trim()) return;
    const newReply: Answer = {
      id: 'rep_' + Math.random().toString(36).substr(2, 9),
      authorName: 'You',
      authorAvatar: null,
      content: content.trim(),
      votes: 0,
      isAccepted: false,
      isUpvotedByUser: false,
      createdAt: new Date().toISOString()
    };

    this.answers.update(list => list.map(ans => {
      if (ans.id === answerId) {
        return {
          ...ans,
          replies: [...(ans.replies || []), newReply]
        };
      }
      return ans;
    }));
    this.showReplyFormId.set(null);
  }

  formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateString;
    }
  }
}
