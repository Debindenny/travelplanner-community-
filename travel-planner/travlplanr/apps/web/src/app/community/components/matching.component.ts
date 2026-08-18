import { Component, inject, OnInit, signal } from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { RouterLink, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { apiUrl } from '../../shared/utils/api-url';
import { ToastService } from '../../shared/utils/toast.service';
import { CommunityMessagesService } from '../services/community-messages.service';
import { apiErrorMessage } from '../../shared/utils/api-error.util';

interface Match {
  customerId: string;
  bio: string;
  travelStyles: string[];
  preferredDestinations: string[];
  languages: string[];
  matchScore: number;
}

interface EnrichedMatch extends Match {
  name: string;
  avatar: string | null;
  is_verified: boolean;
  countries_visited: number;
}

@Component({
    selector: 'app-community-matching',
    imports: [RouterLink, TranslatePipe],
    template: `
    <div class="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-extrabold text-text-primary mb-1">{{ 'COMMUNITY.MATCHING.TITLE' | translate }}</h1>
        <p class="text-text-secondary text-sm">{{ 'COMMUNITY.MATCHING.SUBTITLE' | translate }}</p>
      </div>

      @if (isLoading()) {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <div class="bg-white/80 rounded-2xl border border-slate-100 p-5 animate-pulse">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 rounded-full bg-slate-200 shrink-0"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-3 bg-slate-200 rounded w-3/4"></div>
                  <div class="h-2.5 bg-slate-200 rounded w-1/2"></div>
                </div>
              </div>
              <div class="space-y-2">
                <div class="h-2.5 bg-slate-200 rounded"></div>
                <div class="h-2.5 bg-slate-200 rounded w-4/5"></div>
              </div>
            </div>
          }
        </div>
      } @else if (matches().length === 0) {
        <div class="bg-white/80 border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
          <div class="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          </div>
          <h3 class="text-text-primary font-extrabold text-xl mb-2">{{ 'COMMUNITY.MATCHING.EMPTY_TITLE' | translate }}</h3>
          <p class="text-text-secondary text-sm mb-6 max-w-xs mx-auto">{{ 'COMMUNITY.MATCHING.EMPTY_HINT' | translate }}</p>
          <a routerLink="/community" class="inline-block bg-primary hover:bg-primary-hover text-white font-bold px-6 py-2.5 rounded-full transition-colors shadow-sm">
            {{ 'COMMUNITY.MATCHING.BROWSE_COMMUNITY' | translate }}
          </a>
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (match of matches(); track match.customerId) {
            <div class="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100/80 p-5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group">
              <!-- Header: avatar + name + score -->
              <div class="flex items-start gap-3 mb-3">
                <a [routerLink]="['/community/users', match.customerId]" class="shrink-0">
                  <img [src]="match.avatar || '/assets/images/default-avatar.svg'" class="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" alt="" loading="lazy" decoding="async" />
                </a>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <a [routerLink]="['/community/users', match.customerId]" class="font-extrabold text-sm text-text-primary hover:text-primary hover:underline transition-colors truncate">
                      {{ match.name }}
                    </a>
                    @if (match.is_verified) {
                      <svg class="w-4 h-4 text-primary fill-current shrink-0" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L9 10.586l3.293-3.293a1 1 0 111.414 1.414z" clip-rule="evenodd" fill-rule="evenodd"></path></svg>
                    }
                  </div>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-2xs font-extrabold px-2 py-0.5 rounded-full">
                      <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                      {{ 'COMMUNITY.MATCHING.MATCH_PCT' | translate: { pct: match.matchScore } }}
                    </span>
                    @if (match.countries_visited >= 5) {
                      <span class="text-2xs text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full font-bold">🎒 {{ match.countries_visited }}</span>
                    }
                  </div>
                </div>
              </div>

              <!-- Bio -->
              <p class="text-text-secondary text-xs mb-3 line-clamp-2 leading-relaxed">{{ match.bio || ('COMMUNITY.MATCHING.DEFAULT_BIO' | translate) }}</p>

              <!-- Destinations -->
              @if (match.preferredDestinations?.length) {
                <div class="flex flex-wrap gap-1.5 mb-3">
                  @for (dest of match.preferredDestinations.slice(0, 3); track dest) {
                    <span class="bg-primary-50 text-primary border border-primary-subtle/30 text-2xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
                      {{ dest }}
                    </span>
                  }
                  @if (match.preferredDestinations.length > 3) {
                    <span class="text-2xs text-text-tertiary font-bold px-1.5 py-0.5">+{{ match.preferredDestinations.length - 3 }}</span>
                  }
                </div>
              }

              <!-- Travel styles -->
              @if (match.travelStyles?.length) {
                <div class="flex flex-wrap gap-1.5 mb-3">
                  @for (style of match.travelStyles.slice(0, 3); track style) {
                    <span class="bg-slate-50 text-text-secondary border border-slate-200/60 text-2xs font-bold px-2 py-0.5 rounded-full">{{ style }}</span>
                  }
                </div>
              }

              <!-- Actions -->
              <div class="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                <button
                  (click)="connectWithMatch(match)"
                  [disabled]="sendingIds.has(match.customerId)"
                  class="flex-1 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-extrabold rounded-xl transition-colors shadow-sm disabled:opacity-50 focus:outline-none"
                >
                  {{ (sendingIds.has(match.customerId) ? 'COMMUNITY.MATCHING.SENDING' : 'COMMUNITY.MATCHING.CONNECT') | translate }}
                </button>
                <a [routerLink]="['/community/users', match.customerId]" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-text-secondary text-xs font-bold rounded-xl transition-colors focus:outline-none">{{ 'COMMUNITY.MATCHING.VIEW' | translate }}</a>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class MatchingComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private messagesService = inject(CommunityMessagesService);

  matches = signal<EnrichedMatch[]>([]);
  isLoading = signal(true);
  sendingIds = new Set<string>();

  ngOnInit() {
    this.loadMatches();
  }

  loadMatches() {
    this.http.get<Match[]>(apiUrl('/matching/matches')).pipe(
      switchMap(data => {
        if (!data?.length) return of([] as EnrichedMatch[]);
        return forkJoin(
          data.map(m =>
            this.http.get<any>(apiUrl(`/community/users/${m.customerId}`)).pipe(
              map(profile => ({
                ...m,
                name: profile.name || this.translate.instant('COMMUNITY.MATCHING.TRAVELER'),
                avatar: profile.avatar ?? null,
                is_verified: profile.is_verified ?? false,
                countries_visited: profile.countries_visited ?? 0,
              })),
              catchError(() => of({
                ...m,
                name: this.translate.instant('COMMUNITY.MATCHING.TRAVELER'),
                avatar: null,
                is_verified: false,
                countries_visited: 0,
              } as EnrichedMatch))
            )
          )
        );
      }),
      catchError(() => of([] as EnrichedMatch[]))
    ).subscribe({
      next: data => {
        this.matches.set(data);
        this.isLoading.set(false);
      }
    });
  }

  connectWithMatch(match: EnrichedMatch) {
    this.sendingIds.add(match.customerId);
    const intro = this.translate.instant('COMMUNITY.MATCHING.REQUEST_MESSAGE');
    this.messagesService.sendMessage(match.customerId, intro).subscribe({
      next: () => {
        this.sendingIds.delete(match.customerId);
        this.toast.success(this.translate.instant('COMMUNITY.MATCHING.REQUEST_SENT'));
        this.router.navigate(['/community/messages']);
      },
      error: (err) => {
        this.sendingIds.delete(match.customerId);
        this.http.post(apiUrl('/matching/requests'), {
          receiver_id: match.customerId,
          message: intro
        }).subscribe({
          next: () => this.toast.success(this.translate.instant('COMMUNITY.MATCHING.REQUEST_SENT')),
          error: (e) => this.toast.error(apiErrorMessage(e, this.translate.instant('COMMUNITY.MATCHING.REQUEST_FAILED')))
        });
      }
    });
  }
}
