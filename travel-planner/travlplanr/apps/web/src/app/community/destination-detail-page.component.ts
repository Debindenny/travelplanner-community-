import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';

import { CommunityPost } from './services/community-post.service';
import { DestinationDetail, DestinationService } from './services/destination-detail.service';
import { CommunityPostCardComponent } from './components/community-post-card.component';
import { NavbarComponent } from '../landing/components/navbar/navbar.component';

@Component({
  selector: 'app-destination-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe, CommunityPostCardComponent, NavbarComponent],
  template: `
    <app-navbar variant="default" [showUserActions]="true" />
    <div class="pt-[73px]">
    @if (isLoading()) {
      <div class="min-h-screen bg-white animate-pulse">
        <div class="h-96 bg-gray-200" />
      </div>
    }

    @if (destination()) {
      <!-- Hero photo -->
      <div class="relative w-full h-[40vh] min-h-[320px] overflow-hidden">
        @if (destination()!.image) {
          <img
            [src]="destination()!.image"
            [alt]="destination()!.name"
            class="w-full h-full object-cover"
          />
        } @else {
          <div class="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-600" />
        }
      </div>

      <!-- Info strip -->
      <div class="max-w-5xl mx-auto px-4 sm:px-6 -mt-8 relative z-10">
        <div class="bg-white rounded-t-xl shadow-lg p-6 pb-4">
          <h1 class="text-3xl font-bold text-gray-900">{{ destination()!.name }}</h1>
          @if (destination()!.description) {
            <p class="mt-2 text-sm text-gray-600">{{ destination()!.description }}</p>
          }
          <div class="mt-3 flex flex-wrap items-center gap-4 text-sm">
            @if (destination()!.region) {
              <span class="inline-flex items-center gap-1 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {{ destination()!.region }}
              </span>
            }
            <span class="inline-flex items-center gap-1 text-blue-600 font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {{ 'COMMUNITY.DESTINATION.BEEN_THERE' | translate: { n: destination()!.been_there_count } }}
            </span>
          </div>
        </div>

        <!-- Tag pills -->
        <div class="flex flex-wrap gap-2 pt-4 px-6 bg-white shadow-[0_1px_3px_rgba(0,0,0,.1)]">
          @for (tag of destination()!.tags; track tag) {
            <span class="inline-block bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-xs font-medium">{{ tag }}</span>
          }
        </div>

        <!-- Trips here grid -->
        <section class="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold text-gray-900">{{ 'COMMUNITY.DESTINATION.TRIPS_HERE' | translate }}</h2>

            @if (loadMoreProgress()) {
              <span class="text-sm text-gray-500">{{ 'COMMUNITY.DESTINATION.LOADING_MORE' | translate }}</span>
            }
          </div>

          @if (!isLoading() && destinationPosts().length > 0) {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              @for (post of destinationPosts(); track post.id) {
                <app-community-post-card [post]="post" />
              }
            </div>

            <!-- Load more trigger -->
            @if (hasMore()) {
              <div class="flex justify-center mt-8">
                <button
                  type="button"
                  class="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  (click)="onLoadMore()"
                  [disabled]="loadMoreProgress()"
                >
                  {{ 'COMMUNITY.DESTINATION.SHOW_MORE_TRIPS' | translate }}
                </button>
              </div>
            }
          } @else if (!isLoading() && destinationPosts().length === 0) {
            <div class="text-center py-12">
              <p class="text-gray-400 text-lg">{{ 'COMMUNITY.DESTINATION.NO_TRIPS' | translate }}</p>
              <a
                [routerLink]="['/community']"
                class="mt-4 inline-block text-blue-600 hover:text-blue-700 font-medium"
              >
                {{ 'COMMUNITY.DESTINATION.BROWSE_COMMUNITY' | translate }}
              </a>
            </div>
          }

          <!-- Add to my trip CTA -->
          @if (isAuthenticated()) {
            <div class="mt-10 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 text-center">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ 'COMMUNITY.DESTINATION.START_PLANNING' | translate }}</h3>
              <p class="text-sm text-gray-600 mb-4">{{ 'COMMUNITY.DESTINATION.SAVE_HINT' | translate: { name: destination()!.name } }}</p>
              <a
                [routerLink]="['/wizard']"
                [queryParams]="{ dest: destination()!.name }"
                class="inline-block px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                {{ 'COMMUNITY.DESTINATION.ADD_TO_TRIP' | translate }}
              </a>
            </div>
          }
        </section>
      </div>
    }
    </div>
  `,
  styles: [`
    app-destination-detail-page { display: block; }
  `]
})
export class DestinationDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destService = inject(DestinationService);
  private readonly destroyRef = inject(DestroyRef);

  destination = signal<DestinationDetail | null>(null);
  destinationPosts = signal<CommunityPost[]>([]);
  hasMore = signal(true);
  isLoading = signal(true);
  loadMoreProgress = signal(false);
  isAuthenticated = signal(false);

  private _offset = 0;
  private readonly DEST_PAGE_SIZE = 20;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.loadDestination(id, 0);
  }

  loadDestination(id: string, offset: number): void {
    this.isLoading.set(offset === 0);
    this.destService.getDestination(id, this.DEST_PAGE_SIZE, offset).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (resp) => {
        if (!resp) return;
        if (offset === 0) {
          this.destinationPosts.set(resp.posts || []);
        } else {
          const existing = this.destinationPosts();
          this.destinationPosts.set([...existing, ...(resp.posts || [])]);
        }
        this.destination.set(resp.destination || null);
        this.hasMore.set(!!resp.has_more);
        this._offset += (resp.posts || []).length;
      },
      error: (_err) => {
        this.isLoading.set(false);
      }
    });
  }

  onLoadMore(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || this.loadMoreProgress() || !this.hasMore()) return;
    this.loadMoreProgress.set(true);
    const nextOffset = this.destinationPosts().length;
    this.destService.getDestination(id, this.DEST_PAGE_SIZE, nextOffset).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (resp) => {
        this.isLoading.set(false);
        if (!resp) return;
        const posts = resp.posts || [];
        if (posts.length > 0) {
          const existing = this.destinationPosts();
          this.destinationPosts.set([...existing, ...posts]);
        }
        this.hasMore.set(!!resp.has_more);
        this._offset += posts.length;
      },
      complete: () => {
        this.loadMoreProgress.set(false);
      }
    });
  }
}
