import { Component, Input, OnInit, inject, signal } from '@angular/core';

import { CommunityGamificationService, TravelerLevel, TRAVELER_LEVELS } from '../services/community-gamification.service';

@Component({
    selector: 'app-community-level-badge',
    imports: [],
    template: `
    @if (level(); as lv) {
      <span
        class="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border transition-all hover:scale-105 cursor-help select-none"
        [class]="getBadgeClasses(lv)"
        [title]="'Level ' + lv.rank + ' — ' + lv.name"
      >
        <span>{{ lv.icon }}</span>
        @if (showName) {
          <span>{{ lv.name }}</span>
        } @else {
          <span>Lv.{{ lv.rank }}</span>
        }
      </span>
    }
  `
})
export class CommunityLevelBadgeComponent implements OnInit {
  @Input() xp?: number;
  @Input() levelRank?: number;
  @Input() showName = false;

  private gamificationService = inject(CommunityGamificationService);
  level = signal<TravelerLevel | null>(null);

  ngOnInit() {
    if (this.levelRank) {
      const found = TRAVELER_LEVELS.find(l => l.rank === this.levelRank);
      if (found) this.level.set(found);
    } else if (this.xp !== undefined) {
      this.level.set(this.gamificationService.getLevelForXp(this.xp));
    }
  }

  getBadgeClasses(lv: TravelerLevel): string {
    const colorMap: Record<number, string> = {
      1: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
      2: 'bg-blue-50 text-blue-700 border-blue-200/50',
      3: 'bg-indigo-50 text-indigo-700 border-indigo-200/50',
      4: 'bg-purple-50 text-purple-700 border-purple-200/50',
      5: 'bg-amber-50 text-amber-700 border-amber-200/50',
      6: 'bg-rose-50 text-rose-700 border-rose-200/50',
    };
    return colorMap[lv.rank] || colorMap[1];
  }
}
