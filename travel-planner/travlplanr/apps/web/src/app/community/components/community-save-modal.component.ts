import { Component, EventEmitter, Input, OnInit, Output, HostListener } from '@angular/core';

import { CommunityCollection, CommunityCollectionService } from '../services/community-collection.service';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { A11yModule } from '@angular/cdk/a11y';

@Component({
    selector: 'app-community-save-modal',
    imports: [FormsModule, TranslatePipe, A11yModule],
    template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-4" (click)="closeModal()">
      <div 
        class="bg-white rounded-xl max-w-sm w-full shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabindex="-1"
        cdkTrapFocus
        cdkTrapFocusAutoCapture
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="border-b border-gray-100 p-4 flex items-center justify-between">
          <h2 id="modal-title" class="text-lg font-bold text-gray-900">{{ 'COMMUNITY.SAVE_MODAL.TITLE' | translate }}</h2>
          <button
            (click)="closeModal()"
            class="text-gray-400 hover:text-gray-600 focus:outline-none p-1"
            [attr.aria-label]="'COMMUNITY.SAVE_MODAL.CLOSE' | translate"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Collections List -->
        <div class="max-h-60 overflow-y-auto p-2">
          @if (isLoading) {
            <div class="flex justify-center p-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          } @else if (collections.length === 0) {
            <div class="text-center p-4">
              <p class="text-sm text-gray-500 mb-2">{{ 'COMMUNITY.SAVE_MODAL.EMPTY_STATE' | translate }}</p>
            </div>
          } @else {
            <ul class="space-y-1">
              @for (collection of collections; track collection.id) {
                <li>
                  <button 
                    (click)="saveToCollection(collection.id)"
                    class="w-full text-left px-3 py-3 hover:bg-gray-50 rounded-lg flex items-center gap-3 transition-colors focus:outline-none"
                    [disabled]="isSaving"
                  >
                    <div class="w-10 h-10 rounded bg-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      @if (collection.cover_image) {
                        <img [src]="collection.cover_image" class="w-full h-full object-cover" loading="lazy" decoding="async" />
                      } @else {
                        <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
                      }
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-gray-900 truncate">{{ collection.name }}</p>
                      <p class="text-xs text-gray-500">{{ 'COMMUNITY.COLLECTIONS.ITEMS_COUNT' | translate:{n: collection.item_count} }}</p>
                    </div>
                    @if (collection.is_private) {
                      <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" /></svg>
                    }
                  </button>
                </li>
              }
            </ul>
          }
        </div>

        <!-- Create New -->
        <div class="border-t border-gray-100 p-4 bg-gray-50">
          @if (!showCreateForm) {
            <button 
              (click)="showCreateForm = true"
              class="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors focus:outline-none"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
              {{ 'COMMUNITY.SAVE_MODAL.CREATE_NEW' | translate }}
            </button>
          } @else {
            <div class="space-y-3">
              <input 
                type="text" 
                [(ngModel)]="newCollectionName"
                [placeholder]="'COMMUNITY.SAVE_MODAL.NAME_PLACEHOLDER' | translate"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                (keyup.enter)="createCollection()"
              />
              <div class="flex items-center gap-2 px-1">
                <input type="checkbox" id="private-check" [(ngModel)]="newCollectionPrivate" class="rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                <label for="private-check" class="text-xs text-gray-700 cursor-pointer flex items-center gap-1">
                  <svg class="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" /></svg>
                  {{ 'COMMUNITY.SAVE_MODAL.KEEP_PRIVATE' | translate }}
                </label>
              </div>
              <div class="flex gap-2">
                <button 
                  (click)="showCreateForm = false; newCollectionName = ''"
                  class="flex-1 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded hover:bg-gray-100"
                >
                  {{ 'COMMUNITY.SAVE_MODAL.CANCEL' | translate }}
                </button>
                <button
                  (click)="createCollection()"
                  [disabled]="!newCollectionName.trim() || isCreating"
                  class="flex-1 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {{ 'COMMUNITY.SAVE_MODAL.CREATE' | translate }}
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class CommunitySaveModalComponent implements OnInit {
  @Input({ required: true }) postId!: string;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<string>();
  @Output() error = new EventEmitter<string>();

  collections: CommunityCollection[] = [];
  isLoading = true;
  isSaving = false;
  isCreating = false;

  showCreateForm = false;
  newCollectionName = '';
  newCollectionPrivate = false;

  constructor(
    private collectionService: CommunityCollectionService,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    this.loadCollections();
  }

  loadCollections() {
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

  saveToCollection(collectionId: string) {
    if (this.isSaving) return;
    this.isSaving = true;

    this.collectionService.savePostToCollection(collectionId, this.postId).subscribe({
      next: () => {
        this.saved.emit(this.translate.instant('COMMUNITY.SAVE_MODAL.SAVE_SUCCESS'));
        this.closeModal();
      },
      error: () => {
        this.isSaving = false;
        this.error.emit(this.translate.instant('COMMUNITY.SAVE_MODAL.SAVE_ERROR'));
        this.closeModal();
      }
    });
  }

  createCollection() {
    if (!this.newCollectionName.trim() || this.isCreating) return;
    
    this.isCreating = true;
    this.collectionService.createCollection({
      name: this.newCollectionName.trim(),
      is_private: this.newCollectionPrivate
    }).subscribe({
      next: (newCollection) => {
        this.collections.unshift(newCollection);
        this.isCreating = false;
        this.showCreateForm = false;
        this.newCollectionName = '';
        
        // Auto-save to the newly created collection
        this.saveToCollection(newCollection.id);
      },
      error: () => {
        this.isCreating = false;
      }
    });
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(_event?: Event) {
    this.closeModal();
  }

  closeModal() {
    this.closed.emit();
  }
}
