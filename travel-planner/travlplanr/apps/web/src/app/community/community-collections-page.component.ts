import { Component, OnInit, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CommunityCollectionService, CommunityCollection } from './services/community-collection.service';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from '../shared/utils/toast.service';

@Component({
    selector: 'app-community-collections-page',
    imports: [FormsModule, RouterLink, TranslatePipe],
    template: `
    <div class="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">{{ 'COMMUNITY.COLLECTIONS.TITLE' | translate }}</h1>
          <p class="text-gray-500 mt-1">{{ 'COMMUNITY.COLLECTIONS.SUBTITLE' | translate }}</p>
        </div>
        <button
          type="button"
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          (click)="openCreateModal()"
        >
          {{ 'COMMUNITY.COLLECTIONS.NEW_COLLECTION' | translate }}
        </button>
      </div>

      @if (isLoading) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (i of [1,2,3]; track i) {
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-pulse">
              <div class="h-48 bg-gray-200"></div>
              <div class="p-4 space-y-3">
                <div class="h-5 bg-gray-200 rounded w-1/2"></div>
                <div class="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          }
        </div>
      } @else if (collections.length === 0) {
        <div class="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <div class="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">{{ 'COMMUNITY.COLLECTIONS.EMPTY_TITLE' | translate }}</h3>
          <p class="text-gray-500 mb-6 max-w-sm mx-auto">{{ 'COMMUNITY.COLLECTIONS.EMPTY_BODY' | translate }}</p>
          <a routerLink="/community" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-full transition-colors">
            {{ 'COMMUNITY.COLLECTIONS.EXPLORE' | translate }}
          </a>
        </div>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (collection of collections; track collection.id) {
            <div [routerLink]="['/community/collections', collection.id]" class="group bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer relative">
              <div class="h-48 bg-gray-100 relative overflow-hidden">
                @if (collection.cover_image) {
                  <img [src]="collection.cover_image" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" />
                } @else {
                  <div class="w-full h-full flex items-center justify-center text-gray-400">
                    <svg class="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
                  </div>
                }

                @if (collection.is_private) {
                  <div class="absolute top-3 left-3 bg-gray-900/70 backdrop-blur text-white text-xs px-2 py-1 rounded flex items-center gap-1 font-medium">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" /></svg>
                    {{ 'COMMUNITY.COLLECTIONS.PRIVATE' | translate }}
                  </div>
                }
              </div>
              <div class="p-4">
                <h3 class="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">{{ collection.name }}</h3>
                <p class="text-sm text-gray-500 mt-1">{{ 'COMMUNITY.COLLECTIONS.ITEMS_COUNT' | translate:{n: collection.item_count} }}</p>
              </div>
            </div>
          }
        </div>
      }
    </div>

    @if (isCreateModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h2 class="text-xl font-bold text-gray-900">{{ 'COMMUNITY.COLLECTIONS.CREATE_MODAL_TITLE' | translate }}</h2>

          <div class="mt-4">
            <label for="collection-name" class="block text-sm font-medium text-gray-700">
              {{ 'COMMUNITY.COLLECTIONS.NAME_LABEL' | translate }}
            </label>
            <input
              id="collection-name"
              type="text"
              [(ngModel)]="newCollectionName"
              [attr.placeholder]="'COMMUNITY.COLLECTIONS.NAME_PLACEHOLDER' | translate"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <label class="mt-4 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" [(ngModel)]="newCollectionIsPrivate" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            {{ 'COMMUNITY.COLLECTIONS.KEEP_PRIVATE_LABEL' | translate }}
          </label>

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              (click)="closeCreateModal()"
            >
              {{ 'COMMUNITY.COLLECTIONS.CANCEL' | translate }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              [disabled]="!newCollectionName.trim() || isCreating()"
              (click)="submitCreateCollection()"
            >
              {{ 'COMMUNITY.COLLECTIONS.CREATE' | translate }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class CommunityCollectionsPageComponent implements OnInit {
  private readonly collectionService = inject(CommunityCollectionService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  collections: CommunityCollection[] = [];
  isLoading = true;

  readonly isCreateModalOpen = signal(false);
  readonly isCreating = signal(false);
  newCollectionName = '';
  newCollectionIsPrivate = false;

  ngOnInit() {
    this.loadCollections();
  }

  private loadCollections() {
    this.isLoading = true;
    this.collectionService.getCollections().subscribe({
      next: (data) => {
        this.collections = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  openCreateModal(): void {
    this.newCollectionName = '';
    this.newCollectionIsPrivate = false;
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  submitCreateCollection(): void {
    const name = this.newCollectionName.trim();
    if (!name || this.isCreating()) return;

    this.isCreating.set(true);
    this.collectionService.createCollection({
      name,
      is_private: this.newCollectionIsPrivate
    }).subscribe({
      next: () => {
        this.isCreating.set(false);
        this.isCreateModalOpen.set(false);
        this.loadCollections();
        this.toast.success(this.translate.instant('COMMUNITY.COLLECTIONS.CREATE_SUCCESS'));
      },
      error: () => {
        this.isCreating.set(false);
        this.toast.error(this.translate.instant('COMMUNITY.COLLECTIONS.CREATE_ERROR'));
      }
    });
  }
}
