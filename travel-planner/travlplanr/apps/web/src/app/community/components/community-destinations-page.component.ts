import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { CommunityHomeSubnavComponent } from './community-home-subnav.component';
import { CommunityProfileSummaryComponent } from './community-profile-summary.component';
import { CommunityComposerModalComponent } from './community-composer-modal.component';
import { CommunityDestinationCardComponent } from './community-destination-card.component';
import { CommunityDestinationDetailModalComponent } from './community-destination-detail-modal.component';
import { CommunityDestination } from '../circles-trips/core/models/community.models';
import {
  CommunityDestinationService,
  CommunityDestinationSummary,
} from '../services/community-destination.service';
import { CommunityProfileService, MyCommunityProfile } from '../services/community-profile.service';
import { AuthService } from '../../auth/auth.service';

type DestinationFilter = 'popular' | 'nearMe';

/** Maps the real backend destination shape onto the page's existing display model. */
function toCommunityDestination(d: CommunityDestinationSummary): CommunityDestination {
  return {
    id: d.id,
    name: d.name,
    image: d.image,
    members: `${d.been_there_count} been there`,
    livePlanning: '',
    stats: [
      { value: String(d.been_there_count), label: 'Been there' },
      { value: `${d.currency} ${Math.round(d.price)}`, label: 'From' },
      { value: String(d.tags.length), label: 'Tags' },
    ],
    recentPosts: [],
  };
}

@Component({
  selector: 'app-community-destinations-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgClass,
    RouterLink,
    TranslatePipe,
    CommunityHomeSubnavComponent,
    CommunityProfileSummaryComponent,
    CommunityComposerModalComponent,
    CommunityDestinationCardComponent,
    CommunityDestinationDetailModalComponent,
  ],
  template: `
    <div class="font-manrope min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <main class="flex justify-center pt-2 sm:pt-4 lg:pt-8 pb-10 px-3 sm:px-4">
        <div class="w-full max-w-[1280px] grid grid-cols-[minmax(170px,32%)_minmax(0,1fr)] lg:grid-cols-12 gap-3 sm:gap-6 items-start">

          <!-- LEFT COLUMN: same subnav + profile summary as Community Home -->
          <div class="flex flex-col h-[calc(100vh-120px)] lg:col-span-2 sticky top-[92px] gap-3 sm:gap-5">
            <app-community-home-subnav (sharePost)="showComposerModal.set(true)" />
            <app-community-profile-summary class="mt-auto" [profile]="myProfile()" [userId]="user()?.id ?? null" />
          </div>

          <!-- MAIN CONTENT -->
          <div class="lg:col-span-10 flex flex-col gap-6 sm:gap-7">

            <div class="flex items-center gap-3">
              <a
                routerLink="/community"
                aria-label="{{ 'COMMUNITY.DESTINATIONS_PAGE.BACK_TO_COMMUNITY' | translate }}"
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-text-secondary hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
              </a>
              <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-[13px] font-semibold">
                <a routerLink="/community" class="text-text-faint hover:text-primary transition-colors">{{ 'COMMUNITY.DESTINATIONS_PAGE.BREADCRUMB_COMMUNITY' | translate }}</a>
                <span class="text-text-faint">/</span>
                <span class="text-text-primary">{{ 'COMMUNITY.HOME_SUBNAV.DESTINATIONS' | translate }}</span>
              </nav>
            </div>

            <div class="max-w-2xl">
              <h1 class="text-[26px] sm:text-[32px] font-bold text-text-primary dark:text-gray-100 leading-[1.15] tracking-[-0.01em]">
                {{ 'COMMUNITY.DESTINATIONS_PAGE.TITLE' | translate }}
              </h1>
              <p class="mt-2.5 text-[14.5px] leading-relaxed text-text-secondary dark:text-gray-400">
                {{ 'COMMUNITY.DESTINATIONS_PAGE.SUBTITLE' | translate }}
              </p>
            </div>

            <div class="flex items-center gap-2" role="group" aria-label="{{ 'COMMUNITY.DESTINATIONS_PAGE.FILTER_GROUP' | translate }}">
              <button
                type="button"
                (click)="filter.set('popular')"
                [attr.aria-pressed]="filter() === 'popular'"
                class="h-9 px-4 rounded-full border text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                [ngClass]="filter() === 'popular' ? 'border-primary text-primary bg-primary-50' : 'border-slate-200 dark:border-gray-700 text-text-secondary dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700'"
              >
                {{ 'COMMUNITY.DESTINATIONS_PAGE.FILTER_POPULAR' | translate }}
              </button>
              <button
                type="button"
                (click)="filter.set('nearMe')"
                [attr.aria-pressed]="filter() === 'nearMe'"
                class="h-9 px-4 rounded-full border text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                [ngClass]="filter() === 'nearMe' ? 'border-primary text-primary bg-primary-50' : 'border-slate-200 dark:border-gray-700 text-text-secondary dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700'"
              >
                {{ 'COMMUNITY.DESTINATIONS_PAGE.FILTER_NEAR_ME' | translate }}
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              @for (destination of destinations(); track destination.id) {
                <app-community-destination-card
                  [destination]="destination"
                  (viewDetails)="openDetails($event)"
                />
              }
            </div>

          </div>
        </div>
      </main>

      @if (selectedDestination(); as destination) {
        <app-community-destination-detail-modal
          [destination]="destination"
          [joined]="joinedIds().has(destination.id)"
          (close)="selectedDestination.set(null)"
          (joinToggled)="toggleJoin(destination)"
        />
      }

      @if (showComposerModal()) {
        <app-community-composer-modal
          (postCreated)="showComposerModal.set(false)"
          (close)="showComposerModal.set(false)"
        />
      }
    </div>
  `,
})
export class CommunityDestinationsPageComponent implements OnInit {
  private readonly destinationService = inject(CommunityDestinationService);
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(CommunityProfileService);

  readonly filter = signal<DestinationFilter>('popular');
  readonly destinations = signal<CommunityDestination[]>([]);

  readonly joinedIds = signal<ReadonlySet<string>>(new Set());
  readonly selectedDestination = signal<CommunityDestination | null>(null);

  readonly showComposerModal = signal(false);
  readonly user = this.auth.user;
  readonly myProfile = signal<MyCommunityProfile | null>(null);

  ngOnInit(): void {
    this.destinationService.getDestinations().subscribe({
      next: (data) => this.destinations.set(data.map(toCommunityDestination)),
      error: () => this.destinations.set([]),
    });

    this.destinationService.getSavedDestinationIds().subscribe({
      next: (ids) => this.joinedIds.set(new Set(ids)),
      error: () => {},
    });

    if (this.auth.user()) {
      this.profileService.getMyProfile().subscribe({
        next: (p) => this.myProfile.set(p),
        error: () => {},
      });
    }
  }

  openDetails(destination: CommunityDestination): void {
    this.selectedDestination.set(destination);
    this.destinationService.getDestination(destination.id).subscribe({
      next: (detail) => {
        const recentPosts = detail.posts.slice(0, 5).map((post) => ({
          title: (post.caption || 'Untitled post').slice(0, 120),
          author: post.author.name,
          kind: post.type || 'post',
        }));
        this.selectedDestination.update((current) =>
          current && current.id === destination.id ? { ...current, recentPosts } : current
        );
      },
      error: () => {},
    });
  }

  toggleJoin(destination: CommunityDestination): void {
    this.destinationService.toggleSave(destination.id).subscribe({
      next: ({ saved }) => {
        this.joinedIds.update((current) => {
          const next = new Set(current);
          if (saved) {
            next.add(destination.id);
          } else {
            next.delete(destination.id);
          }
          return next;
        });
      },
    });
  }
}
