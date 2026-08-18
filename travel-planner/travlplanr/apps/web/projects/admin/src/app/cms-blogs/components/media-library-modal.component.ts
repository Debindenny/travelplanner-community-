import { Component, EventEmitter, Output, inject, OnInit, signal } from '@angular/core';

import { CmsService } from '../../shared/services/cms.service';

@Component({
    selector: 'app-media-library-modal',
    imports: [],
    template: `
    <div class="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
    
        <!-- Header -->
        <div class="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Media Library</h2>
          <button (click)="onClose()" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
    
        <!-- Tabs -->
        <div class="flex border-b border-gray-200 dark:border-gray-800">
          <button (click)="activeTab.set('library')" [class.border-primary]="activeTab() === 'library'" [class.text-primary]="activeTab() === 'library'" class="px-6 py-3 font-medium text-sm border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            Media Library
          </button>
          <button (click)="activeTab.set('upload')" [class.border-primary]="activeTab() === 'upload'" [class.text-primary]="activeTab() === 'upload'" class="px-6 py-3 font-medium text-sm border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            Upload New
          </button>
        </div>
    
        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900/50">
    
          <!-- Library Tab -->
          @if (activeTab() === 'library') {
            <div class="h-full">
              @if (loading()) {
                <div class="flex items-center justify-center h-full">
                  <svg class="animate-spin w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </div>
              }
              @if (!loading() && media().length === 0) {
                <div class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <svg class="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  <p>No media files found.</p>
                  <button (click)="activeTab.set('upload')" class="mt-4 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Upload an image</button>
                </div>
              }
              @if (!loading() && media().length > 0) {
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  @for (file of media(); track file) {
                    <div
                      (click)="selectedFile.set(file.url)"
                      [class.ring-2]="selectedFile() === file.url"
                      [class.ring-primary]="selectedFile() === file.url"
                      class="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer bg-white dark:bg-gray-800 hover:opacity-90 transition-all group">
                      <img [src]="file.url" [alt]="file.name" class="w-full h-full object-cover">
                      <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p class="text-white text-xs truncate">{{ file.name }}</p>
                      </div>
                      @if (selectedFile() === file.url) {
                        <div class="absolute top-2 right-2 bg-primary text-white rounded-full p-1">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
    
          <!-- Upload Tab -->
          @if (activeTab() === 'upload') {
            <div class="h-full flex flex-col items-center justify-center">
              <div class="w-full max-w-lg border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center hover:border-primary dark:hover:border-primary transition-colors bg-white dark:bg-gray-800 cursor-pointer"
                (click)="fileInput.click()">
                <svg class="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-1">Click to upload</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">SVG, PNG, JPG or GIF (max. 5MB)</p>
              </div>
              <input #fileInput type="file" accept="image/*" class="hidden" (change)="onFileSelected($event)">
              @if (uploading()) {
                <div class="mt-6 flex items-center text-primary">
                  <svg class="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Uploading image...
                </div>
              }
            </div>
          }
        </div>
    
        <!-- Footer -->
        <div class="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-3">
          <button (click)="onClose()" class="px-5 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button (click)="onInsert()" [disabled]="!selectedFile()" class="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            Insert Image
          </button>
        </div>
      </div>
    </div>
    `
})
export class MediaLibraryModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() insert = new EventEmitter<string>();

  private cms = inject(CmsService);

  activeTab = signal<'library' | 'upload'>('library');
  media = signal<{url: string, name: string}[]>([]);
  loading = signal(true);
  uploading = signal(false);
  selectedFile = signal<string | null>(null);

  ngOnInit() {
    this.loadMedia();
  }

  loadMedia() {
    this.loading.set(true);
    this.cms.getMedia().subscribe({
      next: (files) => {
        // Sort newest first or something, but backend order is fine
        this.media.set(files);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.uploading.set(true);
      this.cms.uploadImage(file).subscribe({
        next: (res) => {
          this.uploading.set(false);
          this.selectedFile.set(res.url);
          this.loadMedia(); // refresh library
          this.activeTab.set('library'); // switch back to library
        },
        error: (err) => {
          alert('Upload failed: ' + (err.error?.detail || err.message));
          this.uploading.set(false);
        }
      });
    }
  }

  onClose() {
    this.close.emit();
  }

  onInsert() {
    const file = this.selectedFile();
    if (file) {
      this.insert.emit(file);
    }
  }
}
