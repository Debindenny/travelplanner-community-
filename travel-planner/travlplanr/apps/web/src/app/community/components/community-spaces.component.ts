import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CommunitySpacesService, SpaceListItem } from '../services/community-spaces.service';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-community-spaces',
    imports: [CommonModule, RouterLink, TranslatePipe, FormsModule],
    template: `
    <div class="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <!-- Header -->
      <div class="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-black text-text-primary dark:text-white mb-1">🏘️ Travel Spaces</h1>
          <p class="text-text-secondary dark:text-gray-300 text-sm">Join niche interest groups and plan journeys with fellow travelers.</p>
        </div>
      </div>

      <!-- Search and Quick Create -->
      <div class="mb-6 flex gap-3">
        <div class="flex-1 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl flex items-center px-4 py-3 shadow-inner">
          <span class="text-text-tertiary dark:text-gray-400 mr-2">🔍</span>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search Travel Spaces..."
            class="bg-transparent border-none outline-none text-xs w-full text-text-primary dark:text-white focus:ring-0 placeholder-text-disabled"
          />
        </div>
        <button
          (click)="showCreateModal.set(true)"
          class="bg-primary hover:bg-primary-hover text-white px-5 rounded-2xl text-xs font-extrabold shadow-sm transition-all hover:scale-105 active:scale-95 shrink-0"
        >
          + Create Space
        </button>
      </div>

      <!-- Loading state -->
      @if (isLoading()) {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <div class="bg-white/80 rounded-2xl border border-slate-100 p-5 animate-pulse h-48">
              <div class="w-12 h-12 rounded-xl bg-slate-200 mb-3"></div>
              <div class="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
              <div class="h-3 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div class="h-8 bg-slate-200 rounded"></div>
            </div>
          }
        </div>
      } @else if (error()) {
        <div class="bg-white/80 border border-red-100 rounded-2xl p-12 text-center shadow-sm">
          <span class="text-3xl mb-3 block">⚠️</span>
          <h3 class="font-extrabold text-base text-text-primary mb-1">Couldn't load spaces</h3>
          <p class="text-text-secondary text-xs mb-4">{{ error() }}</p>
          <button
            (click)="loadSpaces()"
            class="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
          >
            Retry
          </button>
        </div>
      } @else {
        <!-- Spaces Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (space of filteredSpaces(); track space.id) {
            <div class="bg-white/80 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl border border-slate-100 dark:border-gray-700/80 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div class="flex items-center justify-between mb-3">
                  <div class="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary/20 border border-primary-subtle/30 flex items-center justify-center text-xl font-extrabold text-primary shadow-sm">
                    {{ space.name.charAt(0).toUpperCase() }}
                  </div>
                </div>

                <h3 class="font-extrabold text-sm text-text-primary dark:text-white mb-1 group-hover:text-primary transition-colors">
                  <a [routerLink]="['/community/spaces', space.id]">{{ space.name }}</a>
                </h3>
                <p class="text-xs text-text-secondary dark:text-gray-300 line-clamp-2 leading-relaxed mb-4">
                  {{ space.description }}
                </p>
              </div>

              <div class="border-t border-slate-100 dark:border-gray-700/50 pt-3.5 mt-auto flex items-center justify-between">
                <div class="text-[10px] text-text-tertiary dark:text-gray-400 font-bold">
                  👥 {{ space.memberCount | number }} members
                </div>
                <button
                  (click)="toggleJoin(space)"
                  class="px-4 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-102 focus:outline-none"
                  [class.bg-slate-100]="space.isJoined"
                  [class.text-text-secondary]="space.isJoined"
                  [class.bg-primary]="!space.isJoined"
                  [class.text-white]="!space.isJoined"
                  [ngClass]="{
                    'dark:bg-gray-700': space.isJoined,
                    'dark:text-gray-300': space.isJoined,
                    'hover:bg-primary-hover': !space.isJoined
                  }"
                >
                  {{ space.isJoined ? 'Joined' : 'Join' }}
                </button>
              </div>
            </div>
          }
          @if (filteredSpaces().length === 0) {
            <div class="col-span-full bg-white/80 border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
              <span class="text-3xl mb-3 block">🏝️</span>
              <h3 class="font-extrabold text-base text-text-primary mb-1">No Spaces Found</h3>
              <p class="text-text-secondary text-xs">Try searching for something else, or create the first one!</p>
            </div>
          }
        </div>
      }

      <!-- Create Space Modal -->
      @if (showCreateModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div class="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl border border-slate-100 dark:border-gray-700 animate-fade-in-up">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 pb-3 mb-4">
              <h3 class="font-extrabold text-base text-text-primary dark:text-white flex items-center gap-2">
                <span>🏘️</span> Create New Space
              </h3>
              <button (click)="showCreateModal.set(false)" class="text-text-tertiary hover:text-text-primary dark:hover:text-white text-lg focus:outline-none">&times;</button>
            </div>

            @if (createError()) {
              <div class="bg-red-50 border border-red-100 text-red-700 text-xs font-bold rounded-xl p-3 mb-4">
                {{ createError() }}
              </div>
            }

            <!-- Form -->
            <div class="space-y-4">
              <div>
                <label class="block text-2xs font-extrabold text-text-tertiary uppercase mb-1.5">Space Name</label>
                <input
                  type="text"
                  [(ngModel)]="newSpaceName"
                  placeholder="e.g. Solo Female Travelers"
                  class="w-full text-xs px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 text-slate-800 dark:text-white font-medium"
                />
              </div>

              <div>
                <label class="block text-2xs font-extrabold text-text-tertiary uppercase mb-1.5">Description</label>
                <textarea
                  [(ngModel)]="newSpaceDesc"
                  rows="3"
                  placeholder="What is this sub-community about?"
                  class="w-full text-xs p-3 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 text-slate-800 dark:text-white resize-none"
                ></textarea>
              </div>
            </div>

            <!-- Footer actions -->
            <div class="mt-6 flex justify-end gap-2 border-t border-slate-100 dark:border-gray-700 pt-4">
              <button
                (click)="showCreateModal.set(false)"
                class="px-4 py-2 text-xs font-bold text-text-secondary hover:bg-slate-100 dark:hover:bg-gray-700 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                (click)="submitCreateSpace()"
                [disabled]="!newSpaceName.trim() || !newSpaceDesc.trim() || isCreating()"
                class="px-5 py-2 text-xs bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
              >
                {{ isCreating() ? 'Creating…' : 'Create Space' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class CommunitySpacesComponent implements OnInit {
  private spacesService = inject(CommunitySpacesService);

  spaces = signal<SpaceListItem[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  searchQuery = '';

  // Create Space Form State
  showCreateModal = signal(false);
  newSpaceName = '';
  newSpaceDesc = '';
  isCreating = signal(false);
  createError = signal<string | null>(null);

  ngOnInit() {
    this.loadSpaces();
  }

  loadSpaces() {
    this.isLoading.set(true);
    this.error.set(null);
    this.spacesService.getSpaces().subscribe({
      next: (data) => {
        this.spaces.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Something went wrong while loading spaces.');
        this.isLoading.set(false);
      }
    });
  }

  toggleJoin(space: SpaceListItem) {
    this.spacesService.toggleJoin(space.id).subscribe(res => {
      space.isJoined = res.isJoined;
      space.memberCount = res.memberCount;
    });
  }

  filteredSpaces(): SpaceListItem[] {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) return this.spaces();
    return this.spaces().filter(s =>
      s.name.toLowerCase().includes(query) ||
      (s.description || '').toLowerCase().includes(query)
    );
  }

  submitCreateSpace() {
    if (!this.newSpaceName.trim() || !this.newSpaceDesc.trim()) return;

    this.isCreating.set(true);
    this.createError.set(null);
    this.spacesService.createSpace({
      name: this.newSpaceName.trim(),
      description: this.newSpaceDesc.trim()
    }).subscribe({
      next: () => {
        this.isCreating.set(false);
        this.showCreateModal.set(false);
        this.loadSpaces();
        this.newSpaceName = '';
        this.newSpaceDesc = '';
      },
      error: () => {
        this.isCreating.set(false);
        this.createError.set('Could not create the space. Please try again.');
      }
    });
  }
}
