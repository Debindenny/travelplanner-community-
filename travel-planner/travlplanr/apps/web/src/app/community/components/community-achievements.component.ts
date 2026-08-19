import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CommunityGamificationService, GamificationProfile, Challenge, TRAVELER_LEVELS, ALL_BADGES } from '../services/community-gamification.service';

@Component({
    selector: 'app-community-achievements',
    imports: [CommonModule, RouterLink, TranslatePipe],
    template: `
    <div class="bg-white/80 dark:bg-gray-800/90 backdrop-blur-md border border-slate-100/80 dark:border-gray-700/80 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-md transition-all duration-300">
      @if (error()) {
        <div class="p-6 text-center">
          <p class="text-xs text-text-tertiary dark:text-gray-400 mb-2">Couldn't load your journey.</p>
          <button (click)="load()" class="text-xs font-bold text-primary hover:underline">Retry</button>
        </div>
      } @else {
      <!-- Level & XP Header -->
      <div class="p-4 pb-3">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-2xs font-extrabold text-text-tertiary uppercase tracking-wider">Your Journey</h3>
          @if (profile()?.streak?.current && profile()!.streak!.current > 1) {
            <span class="flex items-center gap-1 text-[9px] font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50">
              🔥 {{ profile()!.streak!.current }}-day streak
            </span>
          }
        </div>

        <!-- Level Display -->
        @if (profile(); as p) {
          <div class="flex items-center gap-3 mb-3">
            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-xl shadow-sm border border-slate-100 dark:border-gray-600">
              {{ p.level.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-extrabold text-text-primary dark:text-white">{{ p.level.name }}</span>
                <span class="text-[9px] font-extrabold text-primary bg-primary-50 dark:bg-primary/20 px-1.5 py-0.5 rounded-full">Lv.{{ p.level.rank }}</span>
              </div>
              <div class="flex items-center gap-2 mt-1">
                <div class="flex-1 h-1.5 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-700 ease-out"
                    [style.width.%]="p.progressPercent"
                  ></div>
                </div>
                <span class="text-[9px] font-bold text-text-tertiary dark:text-gray-400 shrink-0">{{ p.xp }} XP</span>
              </div>
              @if (p.nextLevel) {
                <p class="text-[9px] text-text-disabled dark:text-gray-500 mt-0.5">{{ p.xpToNext }} XP to {{ p.nextLevel.name }} {{ p.nextLevel.icon }}</p>
              }
            </div>
          </div>
        }
      </div>

      <!-- Active Challenges -->
      @if (challenges().length > 0) {
        <div class="border-t border-slate-100/80 dark:border-gray-700/50 p-4 pt-3">
          <h4 class="text-[9px] font-extrabold text-text-tertiary uppercase tracking-wider mb-2">Active Challenges</h4>
          <div class="space-y-2">
            @for (ch of challenges().slice(0, 3); track ch.id) {
              <div class="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/60 dark:bg-gray-700/50 border border-slate-100/60 dark:border-gray-600/50 transition-all hover:bg-slate-50 dark:hover:bg-gray-700">
                <span class="text-base shrink-0">{{ ch.icon }}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-2xs font-bold text-text-primary dark:text-white truncate">{{ ch.title }}</p>
                  <div class="flex items-center gap-2 mt-1">
                    <div class="flex-1 h-1 bg-slate-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all duration-500"
                        [class.bg-primary]="!ch.completed"
                        [class.bg-emerald-500]="ch.completed"
                        [style.width.%]="(ch.progress / ch.target) * 100"
                      ></div>
                    </div>
                    <span class="text-[8px] font-bold shrink-0" [class.text-text-tertiary]="!ch.completed" [class.text-emerald-600]="ch.completed">
                      {{ ch.completed ? '✓' : ch.progress + '/' + ch.target }}
                    </span>
                  </div>
                </div>
                <span class="text-[8px] font-extrabold text-primary bg-primary-50 dark:bg-primary/20 px-1.5 py-0.5 rounded-full shrink-0">+{{ ch.xpReward }}</span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Recent Badges -->
      @if (profile()?.badges?.length) {
        <div class="border-t border-slate-100/80 dark:border-gray-700/50 p-4 pt-3">
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-[9px] font-extrabold text-text-tertiary uppercase tracking-wider">Badges</h4>
            <span class="text-[9px] font-bold text-primary">{{ earnedCount() }}/{{ totalBadges }}</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            @for (badge of profile()!.badges.slice(0, 8); track badge.id) {
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all cursor-help border"
                [class.bg-gradient-to-br]="badge.earned"
                [class.from-amber-50]="badge.earned"
                [class.to-yellow-50]="badge.earned"
                [class.shadow-sm]="badge.earned"
                [class.bg-slate-50]="!badge.earned"
                [class.border-slate-100]="!badge.earned"
                [class.grayscale]="!badge.earned"
                [class.opacity-40]="!badge.earned"
                [ngClass]="{
                  'border-amber-200/50': badge.earned,
                  'hover:scale-110': badge.earned,
                  'dark:bg-gray-700': !badge.earned,
                  'dark:border-gray-600': !badge.earned
                }"
                [title]="badge.name + (badge.earned ? ' ✓' : ' — ' + (badge.requirement || badge.description))"
              >
                {{ badge.icon }}
              </div>
            }
            @if (profile()!.badges.length > 8) {
              <a routerLink="/community/achievements" class="w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-bold text-text-tertiary bg-slate-50 dark:bg-gray-700 border border-slate-100 dark:border-gray-600 hover:text-primary hover:border-primary/40 transition-all">
                +{{ profile()!.badges.length - 8 }}
              </a>
            }
          </div>
        </div>
      }

      @if (!profile() && !error()) {
        <div class="p-6 text-center text-xs text-text-tertiary dark:text-gray-400">Loading your journey…</div>
      }
      }
    </div>
  `
})
export class CommunityAchievementsComponent implements OnInit {
  private gamificationService = inject(CommunityGamificationService);

  profile = signal<GamificationProfile | null>(null);
  challenges = signal<Challenge[]>([]);
  error = signal(false);
  totalBadges = ALL_BADGES.length;

  ngOnInit() {
    this.load();
  }

  load() {
    this.error.set(false);
    this.gamificationService.getProfile().subscribe({
      next: p => this.profile.set(p),
      error: () => this.error.set(true),
    });
    this.gamificationService.getChallenges().subscribe({
      next: c => this.challenges.set(c),
      error: () => { /* challenges are supplementary; leave the list empty on failure */ },
    });
  }

  earnedCount(): number {
    return this.profile()?.badges?.length ?? 0;
  }
}
