import { Component, Input, Output, EventEmitter, signal } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  votedBy: string[];
}

export interface PollData {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  userVotedOptionId: string | null;
  expiresAt: string;
}

@Component({
    selector: 'app-community-poll',
    imports: [TranslatePipe],
    template: `
    <div class="bg-slate-50 dark:bg-gray-800/40 border border-slate-100 dark:border-gray-700/50 rounded-2xl p-4 my-3">
      <h4 class="font-extrabold text-sm text-text-primary dark:text-white mb-3">📊 {{ poll.question }}</h4>
      
      <div class="space-y-2.5">
        @for (option of poll.options; track option.id) {
          <div class="relative overflow-hidden rounded-xl border border-slate-200/60 dark:border-gray-700">
            <!-- Background progress bar -->
            <div 
              class="absolute top-0 bottom-0 left-0 bg-primary/10 dark:bg-primary/20 transition-all duration-500 ease-out"
              [style.width.%]="getPercentage(option.votes)"
            ></div>

            <!-- Content row -->
            <button
              (click)="vote(option.id)"
              [disabled]="isExpired()"
              class="relative w-full text-left px-4 py-3 text-xs font-bold text-text-secondary dark:text-gray-300 flex items-center justify-between hover:text-primary dark:hover:text-white transition-colors"
            >
              <span class="flex items-center gap-2">
                @if (poll.userVotedOptionId === option.id) {
                  <span class="text-primary text-sm">✓</span>
                }
                {{ option.text }}
              </span>
              <span class="text-text-tertiary dark:text-gray-400">
                {{ getPercentage(option.votes) }}% ({{ option.votes }})
              </span>
            </button>
          </div>
        }
      </div>

      <div class="flex justify-between items-center mt-3 text-[10px] text-text-tertiary dark:text-gray-500 font-bold uppercase tracking-wider">
        <span>{{ poll.totalVotes }} votes</span>
        @if (isExpired()) {
          <span class="text-red-500">Poll Ended</span>
        } @else {
          <span>Ends: {{ formatDate(poll.expiresAt) }}</span>
        }
      </div>
    </div>
  `
})
export class CommunityPollComponent {
  @Input({ required: true }) poll!: PollData;
  @Output() onVote = new EventEmitter<{ pollId: string; optionId: string }>();

  getPercentage(votes: number): number {
    if (this.poll.totalVotes === 0) return 0;
    return Math.round((votes / this.poll.totalVotes) * 100);
  }

  isExpired(): boolean {
    if (!this.poll.expiresAt) return false;
    return new Date(this.poll.expiresAt).getTime() < new Date().getTime();
  }

  vote(optionId: string) {
    if (this.isExpired()) return;
    
    // Update local state optimistically
    if (this.poll.userVotedOptionId === optionId) {
      // Toggle off
      this.poll.userVotedOptionId = null;
      const opt = this.poll.options.find(o => o.id === optionId);
      if (opt) {
        opt.votes = Math.max(0, opt.votes - 1);
        this.poll.totalVotes = Math.max(0, this.poll.totalVotes - 1);
      }
    } else {
      // Toggle on / switch
      if (this.poll.userVotedOptionId) {
        const oldOpt = this.poll.options.find(o => o.id === this.poll.userVotedOptionId);
        if (oldOpt) oldOpt.votes = Math.max(0, oldOpt.votes - 1);
        this.poll.totalVotes = Math.max(0, this.poll.totalVotes - 1);
      }
      this.poll.userVotedOptionId = optionId;
      const opt = this.poll.options.find(o => o.id === optionId);
      if (opt) {
        opt.votes += 1;
        this.poll.totalVotes += 1;
      }
    }

    this.onVote.emit({ pollId: this.poll.id, optionId });
  }

  formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateString;
    }
  }
}
