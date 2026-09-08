import { Component, Input, Output, EventEmitter } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';
import { CommunityPoll } from '../services/community-post.service';

@Component({
    selector: 'app-community-poll',
    imports: [TranslatePipe],
    template: `
    <div class="space-y-2">
      @for (option of poll.options; track option.id) {
        <button
          type="button"
          (click)="vote(option.id)"
          [disabled]="voting"
          class="relative w-full overflow-hidden rounded-xl border text-left transition-colors focus:outline-none disabled:cursor-default"
          [class.border-primary]="poll.userVotedOptionId === option.id"
          [class.bg-primary-50]="poll.userVotedOptionId === option.id"
          [class.dark:bg-primary-900/20]="poll.userVotedOptionId === option.id"
          [class.border-slate-200]="poll.userVotedOptionId !== option.id"
          [class.dark:border-gray-700]="poll.userVotedOptionId !== option.id"
          [class.hover:border-primary-subtle]="!poll.userVotedOptionId"
        >
          @if (poll.userVotedOptionId) {
            <!-- Vote share fill, only shown once the viewer has voted. -->
            <div
              class="absolute inset-y-0 left-0 bg-primary/15 dark:bg-primary/25 transition-all duration-500 ease-out"
              [style.width.%]="getPercentage(option.votes)"
            ></div>
          }
          <span class="relative flex items-center justify-between gap-3 px-4 py-3">
            <span class="text-sm font-semibold text-text-primary dark:text-white">{{ option.text }}</span>
            @if (poll.userVotedOptionId) {
              <span class="text-sm font-bold text-primary shrink-0">{{ getPercentage(option.votes) }}%</span>
            }
          </span>
        </button>
      }
    </div>

    <p class="mt-2.5 text-xs font-medium text-text-faint">
      {{ (poll.totalVotes === 1 ? 'COMMUNITY.POLL.VOTE_COUNT' : 'COMMUNITY.POLL.VOTES_COUNT') | translate: { n: poll.totalVotes } }}
      @if (poll.userVotedOptionId) {
        · {{ 'COMMUNITY.POLL.YOU_VOTED' | translate }}
      }
    </p>
  `
})
export class CommunityPollComponent {
  @Input({ required: true }) poll!: CommunityPoll;
  /** True while this poll's vote request is in flight — the parent owns this (it
      also owns the postService call), so it can clear it once the real, server-
      computed counts come back in the `poll` input. */
  @Input() voting = false;
  @Output() onVote = new EventEmitter<{ pollId: string; optionId: string }>();

  getPercentage(votes: number): number {
    if (!this.poll.totalVotes) return 0;
    return Math.round((votes / this.poll.totalVotes) * 100);
  }

  vote(optionId: string): void {
    if (this.voting || this.poll.userVotedOptionId === optionId) return;
    this.onVote.emit({ pollId: this.poll.id, optionId });
  }
}
