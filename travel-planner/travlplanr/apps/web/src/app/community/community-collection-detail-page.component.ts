import { Component, OnInit, inject, signal } from '@angular/core';

import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiUrl } from '../shared/utils/api-url';

interface CollectionItem {
  id: string;
  item_type: string;
  item_id: string;
  created_at: string;
  post?: {
    id: string;
    caption: string | null;
    images: string[];
    location: string | null;
    author_name: string;
    author_avatar: string | null;
  };
}

interface CollectionDetail {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  items: CollectionItem[];
}

@Component({
    selector: 'app-community-collection-detail-page',
    imports: [RouterLink, TranslatePipe],
    template: `
    <div class="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div class="mb-6 flex items-center gap-3">
        <a routerLink="/community/collections" class="text-text-tertiary hover:text-primary transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </a>
        <div>
          <h1 class="text-2xl font-extrabold text-text-primary">{{ collection()?.name }}</h1>
          @if (collection()?.description) {
            <p class="text-sm text-text-secondary mt-0.5">{{ collection()?.description }}</p>
          }
        </div>
      </div>

      @if (isLoading()) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <div class="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
              <div class="h-44 bg-slate-200"></div>
              <div class="p-3 space-y-2">
                <div class="h-3 bg-slate-200 rounded w-3/4"></div>
                <div class="h-3 bg-slate-200 rounded w-1/2"></div>
              </div>
            </div>
          }
        </div>
      } @else if (error()) {
        <div class="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <p class="text-danger font-semibold">{{ error() }}</p>
          <a routerLink="/community/collections" class="mt-4 inline-block text-sm text-primary hover:underline">{{ 'COMMUNITY.COLLECTION_DETAIL.BACK_TO_COLLECTIONS' | translate }}</a>
        </div>
      } @else if (!collection()?.items?.length) {
        <div class="bg-white/80 border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
          <svg class="w-12 h-12 text-text-disabled mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
          <h3 class="text-text-primary font-bold mb-1">{{ 'COMMUNITY.COLLECTION_DETAIL.EMPTY_TITLE' | translate }}</h3>
          <p class="text-text-tertiary text-sm">{{ 'COMMUNITY.COLLECTION_DETAIL.EMPTY_BODY' | translate }}</p>
          <a routerLink="/community" class="mt-4 inline-block bg-primary hover:bg-primary-hover text-white font-bold px-5 py-2 rounded-full transition-colors text-sm">{{ 'COMMUNITY.COLLECTION_DETAIL.BROWSE_FEED' | translate }}</a>
        </div>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (item of collection()!.items; track item.id) {
            @if (item.item_type === 'post' && item.post) {
              <a [routerLink]="['/community/posts', item.post.id]" class="group bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100/80 overflow-hidden shadow-sm hover:shadow-md hover:scale-[1.01] transition-all">
                @if (item.post.images?.length) {
                  <div class="h-44 overflow-hidden">
                    <img [src]="item.post.images[0]" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" loading="lazy" />
                  </div>
                } @else {
                  <div class="h-44 bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
                    <svg class="w-10 h-10 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  </div>
                }
                <div class="p-3">
                  <div class="flex items-center gap-2 mb-1.5">
                    <img [src]="item.post.author_avatar || '/assets/images/default-avatar.svg'" class="w-6 h-6 rounded-full object-cover border border-slate-100" alt="" loading="lazy" decoding="async" />
                    <span class="text-xs font-bold text-text-secondary truncate">{{ item.post.author_name }}</span>
                  </div>
                  @if (item.post.caption) {
                    <p class="text-xs text-text-primary line-clamp-2 leading-relaxed">{{ item.post.caption }}</p>
                  }
                  @if (item.post.location) {
                    <p class="text-2xs text-text-tertiary mt-1.5 flex items-center gap-1">
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
                      {{ item.post.location }}
                    </p>
                  }
                </div>
              </a>
            } @else {
              <div class="bg-white/80 rounded-2xl border border-slate-100/80 p-4 shadow-sm flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <svg class="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                </div>
                <div>
                  <p class="text-xs font-bold text-text-primary capitalize">{{ item.item_type }}</p>
                  <p class="text-2xs text-text-tertiary mt-0.5">{{ 'COMMUNITY.COLLECTION_DETAIL.SAVED_ITEM' | translate }}</p>
                </div>
              </div>
            }
          }
        </div>
      }
    </div>
  `
})
export class CommunityCollectionDetailPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private translate = inject(TranslateService);

  collection = signal<CollectionDetail | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set(this.translate.instant('COMMUNITY.COLLECTION_DETAIL.NOT_FOUND'));
      this.isLoading.set(false);
      return;
    }
    this.http.get<CollectionDetail>(apiUrl(`/community/collections/${id}`)).subscribe({
      next: (data) => {
        this.collection.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set(this.translate.instant('COMMUNITY.COLLECTION_DETAIL.LOAD_ERROR'));
        this.isLoading.set(false);
      }
    });
  }
}
