import { Component, OnInit, inject, signal } from '@angular/core';

import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiUrl } from '../../shared/utils/api-url';
import { AuthService } from '../../auth/auth.service';
import { CommunityProfileService } from '../services/community-profile.service';
import { ToastService } from '../../shared/utils/toast.service';

interface SimilarTraveler {
  customerId: string;
  name: string;
  avatar: string | null;
  matchScore: number;
  preferredDestinations: string[];
}

@Component({
  selector: 'app-community-similar-travelers',
  imports: [RouterLink, TranslatePipe],
  template: `
    @if (travelers().length > 0) {
      <article class="bg-white dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_1px_2px_rgba(11,18,32,0.04),0_8px_24px_rgba(11,18,32,0.05)] p-[18px]">
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-[15.5px] font-extrabold text-text-primary">{{ 'COMMUNITY.HOME_SIDEBAR.SIMILAR_TITLE' | translate }}</h3>
          <a routerLink="/community/matching" class="text-[12.5px] font-bold text-primary hover:underline">{{ 'COMMUNITY.HOME_SIDEBAR.SIMILAR_SEE_ALL' | translate }}</a>
        </div>
        <p class="text-[12.5px] font-medium text-text-faint mb-3.5">{{ 'COMMUNITY.HOME_SIDEBAR.SIMILAR_LEAD' | translate }}</p>

        <div class="flex flex-col">
          @for (traveler of travelers(); track traveler.customerId) {
            <div class="flex items-center gap-3.5 py-3.5 border-t border-slate-100 dark:border-gray-700 first:border-t-0">
              <img [src]="traveler.avatar || '/assets/images/default-avatar.svg'" class="w-11 h-11 rounded-full object-cover shrink-0 bg-slate-100" loading="lazy" decoding="async" />
              <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-extrabold text-text-primary tracking-tight truncate">{{ traveler.name }}</span>
                  <span class="text-[10.5px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap">{{ traveler.matchScore }}% match</span>
                </div>
                <span class="text-xs font-semibold text-text-faint truncate">{{ traveler.preferredDestinations.slice(0, 2).join(' · ') || ('COMMUNITY.SIDEBAR.EXPLORING_EVERYWHERE' | translate) }}</span>
              </div>
              <div class="flex gap-2 shrink-0">
                <a [routerLink]="['/community/users', traveler.customerId]" class="h-8 px-3 rounded-lg border border-slate-200 dark:border-gray-700 text-[11.5px] font-extrabold text-text-secondary hover:border-slate-300 transition-colors flex items-center">
                  {{ 'COMMUNITY.HOME_SIDEBAR.SIMILAR_PROFILE' | translate }}
                </a>
                <button
                  (click)="toggleFollow(traveler)"
                  class="h-8 px-3 rounded-lg text-[11.5px] font-extrabold whitespace-nowrap border transition-colors"
                  [class.border-primary]="!followedIds().has(traveler.customerId)"
                  [class.text-primary]="!followedIds().has(traveler.customerId)"
                  [class.bg-white]="!followedIds().has(traveler.customerId)"
                  [class.border-slate-200]="followedIds().has(traveler.customerId)"
                  [class.dark:border-gray-700]="followedIds().has(traveler.customerId)"
                  [class.bg-slate-50]="followedIds().has(traveler.customerId)"
                  [class.text-text-faint]="followedIds().has(traveler.customerId)"
                >
                  {{ (followedIds().has(traveler.customerId) ? 'COMMUNITY.FOLLOWING' : 'COMMUNITY.POST_CARD.FOLLOW') | translate }}
                </button>
              </div>
            </div>
          }
        </div>
      </article>
    }
  `,
})
export class CommunitySimilarTravelersComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(CommunityProfileService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly travelers = signal<SimilarTraveler[]>([]);
  readonly followedIds = signal<ReadonlySet<string>>(new Set());

  ngOnInit(): void {
    if (!this.auth.user()) {
      return;
    }
    this.http.get<any[]>(apiUrl('/matching/matches')).pipe(
      switchMap(matches => {
        if (!matches?.length) return of([] as SimilarTraveler[]);
        const top = matches.slice(0, 3);
        return forkJoin(
          top.map(m =>
            this.http.get<any>(apiUrl(`/community/users/${m.customerId}`)).pipe(
              map(profile => ({
                customerId: m.customerId,
                name: profile.name || this.translate.instant('COMMUNITY.SIDEBAR.DEFAULT_TRAVELER_NAME'),
                avatar: profile.avatar ?? null,
                matchScore: Math.round(m.matchScore),
                preferredDestinations: m.preferredDestinations || [],
              })),
              catchError(() => of({
                customerId: m.customerId,
                name: this.translate.instant('COMMUNITY.SIDEBAR.DEFAULT_TRAVELER_NAME'),
                avatar: null,
                matchScore: Math.round(m.matchScore),
                preferredDestinations: m.preferredDestinations || [],
              } as SimilarTraveler))
            )
          )
        );
      }),
      catchError(() => of([] as SimilarTraveler[])),
    ).subscribe(enriched => this.travelers.set(enriched));
  }

  toggleFollow(traveler: SimilarTraveler): void {
    const next = new Set(this.followedIds());
    const wasFollowing = next.has(traveler.customerId);
    wasFollowing ? next.delete(traveler.customerId) : next.add(traveler.customerId);
    this.followedIds.set(next);

    this.profileService.toggleFollow(traveler.customerId).subscribe({
      error: () => {
        const reverted = new Set(this.followedIds());
        wasFollowing ? reverted.add(traveler.customerId) : reverted.delete(traveler.customerId);
        this.followedIds.set(reverted);
        this.toast.error(this.translate.instant('COMMUNITY.TOAST_FOLLOW_ERROR'));
      },
    });
  }
}
