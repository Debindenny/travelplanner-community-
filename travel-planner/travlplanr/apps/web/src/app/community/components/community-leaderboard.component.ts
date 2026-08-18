import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CommunityGamificationService, LeaderboardEntry } from '../services/community-gamification.service';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-community-leaderboard',
    imports: [CommonModule, RouterLink, TranslatePipe, FormsModule],
    template: `
    <div class="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <!-- Header -->
      <div class="mb-8 text-center sm:text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-black text-text-primary dark:text-white mb-1">🏅 Traveler Leaderboards</h1>
          <p class="text-text-secondary dark:text-gray-300 text-sm">Honoring our top guides, writers, and explorers in the community.</p>
        </div>
        
        <!-- Period selectors -->
        <div class="flex items-center justify-center gap-2">
          @for (p of periods; track p.value) {
            <button
              (click)="selectPeriod(p.value)"
              class="px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all focus:outline-none"
              [class.bg-primary]="selectedPeriod() === p.value"
              [class.text-white]="selectedPeriod() === p.value"
              [class.border-primary]="selectedPeriod() === p.value"
              [class.bg-white]="selectedPeriod() !== p.value"
              [class.text-text-secondary]="selectedPeriod() !== p.value"
              [class.border-slate-200]="selectedPeriod() !== p.value"
            >
              {{ p.label }}
            </button>
          }
        </div>
      </div>

      <!-- Podium Top 3 -->
      @if (leaderboard().length >= 3 && !isLoading() && !error()) {
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end mb-10 max-w-2xl mx-auto">
          <!-- Second Place -->
          <div class="order-2 sm:order-1 flex flex-col items-center">
            <div class="relative mb-3 group">
              <div class="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-slate-300 border border-white flex items-center justify-center text-[10px] font-black text-slate-800">2</div>
              <img [src]="leaderboard()[1].avatar || '/assets/images/default-avatar.svg'" class="w-16 h-16 rounded-full object-cover border-4 border-slate-200 shadow-md bg-white" />
            </div>
            <h3 class="font-extrabold text-xs text-text-primary dark:text-white truncate max-w-[120px]">
              {{ leaderboard()[1].name }}
            </h3>
            <span class="text-[9px] font-extrabold text-slate-500 bg-slate-100 dark:bg-gray-800 px-2 py-0.5 rounded-full mt-1">
              {{ leaderboard()[1].xp | number }} XP
            </span>
          </div>

          <!-- First Place -->
          <div class="order-1 sm:order-2 flex flex-col items-center transform scale-110 sm:-translate-y-2">
            <div class="relative mb-3 group">
              <div class="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</div>
              <div class="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-yellow-400 border border-white flex items-center justify-center text-[10px] font-black text-yellow-950">1</div>
              <img [src]="leaderboard()[0].avatar || '/assets/images/default-avatar.svg'" class="w-20 h-20 rounded-full object-cover border-4 border-yellow-400 shadow-lg bg-white" />
            </div>
            <h3 class="font-extrabold text-sm text-text-primary dark:text-white truncate max-w-[140px]">
              {{ leaderboard()[0].name }}
            </h3>
            <span class="text-[10px] font-extrabold text-yellow-700 bg-yellow-100 dark:bg-yellow-950/30 px-2.5 py-0.5 rounded-full mt-1.5 shadow-sm">
              {{ leaderboard()[0].xp | number }} XP
            </span>
          </div>

          <!-- Third Place -->
          <div class="order-3 flex flex-col items-center">
            <div class="relative mb-3 group">
              <div class="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-600 border border-white flex items-center justify-center text-[10px] font-black text-white">3</div>
              <img [src]="leaderboard()[2].avatar || '/assets/images/default-avatar.svg'" class="w-16 h-16 rounded-full object-cover border-4 border-amber-500/30 shadow-md bg-white" />
            </div>
            <h3 class="font-extrabold text-xs text-text-primary dark:text-white truncate max-w-[120px]">
              {{ leaderboard()[2].name }}
            </h3>
            <span class="text-[9px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full mt-1">
              {{ leaderboard()[2].xp | number }} XP
            </span>
          </div>
        </div>
      }

      <!-- Main Leaderboard List -->
      <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
        @if (isLoading()) {
          <div class="p-8 text-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        } @else if (error()) {
          <div class="p-12 text-center">
            <p class="text-sm text-text-tertiary dark:text-gray-400 mb-3">Couldn't load the leaderboard.</p>
            <button (click)="loadLeaderboard()" class="text-xs font-bold text-primary hover:underline">Retry</button>
          </div>
        } @else {
          <div class="divide-y divide-slate-100 dark:divide-gray-700/50">
            @for (entry of leaderboard().slice(podiumOffset()); track entry.customerId; let idx = $index) {
              <div
                class="flex items-center justify-between p-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-gray-700/30"
                [ngClass]="{ 'bg-primary-50/30': entry.isCurrentUser }"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <span class="w-6 text-center text-xs font-black text-text-tertiary dark:text-gray-400">
                    #{{ idx + 1 + podiumOffset() }}
                  </span>
                  
                  <img [src]="entry.avatar || '/assets/images/default-avatar.svg'" class="w-10 h-10 rounded-full object-cover border bg-white shrink-0" />
                  
                  <div class="min-w-0">
                    <h4 class="font-extrabold text-xs text-text-primary dark:text-white truncate flex items-center gap-1.5">
                      {{ entry.name }}
                      @if (entry.isCurrentUser) {
                        <span class="text-[8px] font-extrabold text-primary bg-primary-50 px-1 py-0.5 rounded">YOU</span>
                      }
                    </h4>
                    <p class="text-[10px] text-text-tertiary dark:text-gray-400 flex items-center gap-1 mt-0.5">
                      <span>🎒 {{ entry.countriesVisited }} countries visited</span>
                      <span>•</span>
                      <span>{{ entry.level.name }}</span>
                    </p>
                  </div>
                </div>

                <div class="text-right">
                  <span class="text-xs font-black text-text-primary dark:text-white">
                    {{ entry.xp | number }}
                  </span>
                  <span class="text-[9px] font-bold text-text-tertiary uppercase ml-0.5">XP</span>
                </div>
              </div>
            }
            @if (leaderboard().length === 0) {
              <div class="p-12 text-center text-text-disabled">No leaderboard entries found for this period.</div>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class CommunityLeaderboardComponent implements OnInit {
  private gamificationService = inject(CommunityGamificationService);

  leaderboard = signal<LeaderboardEntry[]>([]);
  isLoading = signal(true);
  error = signal(false);
  selectedPeriod = signal<'weekly' | 'monthly' | 'alltime'>('weekly');

  periods = [
    { label: 'This Week', value: 'weekly' as const },
    { label: 'This Month', value: 'monthly' as const },
    { label: 'All Time', value: 'alltime' as const },
  ];

  ngOnInit() {
    this.loadLeaderboard();
  }

  loadLeaderboard() {
    this.isLoading.set(true);
    this.error.set(false);
    this.gamificationService.getLeaderboard(this.selectedPeriod()).subscribe({
      next: data => {
        this.leaderboard.set(data || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.isLoading.set(false);
      },
    });
  }

  selectPeriod(period: 'weekly' | 'monthly' | 'alltime') {
    this.selectedPeriod.set(period);
    this.loadLeaderboard();
  }

  podiumOffset(): number {
    return this.leaderboard().length >= 3 ? 3 : 0;
  }
}
