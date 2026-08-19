import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CommunitySpacesService, Space } from '../services/community-spaces.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-community-space-detail',
    imports: [CommonModule, RouterLink, TranslatePipe],
    template: `
    <div class="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      @if (isLoadingSpace()) {
        <div class="h-60 bg-slate-100 dark:bg-gray-800 rounded-2xl animate-pulse flex items-center justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      } @else if (error()) {
        <div class="bg-white/80 border border-red-100 rounded-2xl p-12 text-center shadow-sm">
          <span class="text-3xl mb-3 block">⚠️</span>
          <h3 class="font-extrabold text-base text-text-primary mb-1">Couldn't load this space</h3>
          <p class="text-text-secondary text-xs mb-4">{{ error() }}</p>
          <a routerLink="/community/spaces" class="text-xs font-bold text-primary hover:underline">Back to Spaces</a>
        </div>
      } @else {
        @if (space(); as sp) {
          <!-- Cover and Info Banner -->
          <div class="relative rounded-2xl overflow-hidden mb-6 bg-gradient-to-tr from-slate-900 to-indigo-950 p-6 sm:p-8 text-white select-none">
            @if (sp.coverImage) {
              <div class="absolute inset-0 bg-cover bg-center opacity-30" [style.backgroundImage]="'url(' + sp.coverImage + ')'"></div>
            }
    
            <div class="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div class="flex items-start gap-4">
                <div class="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-2xl font-extrabold shadow-sm shrink-0">
                  {{ sp.name.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <h1 class="text-2xl font-black leading-tight flex items-center gap-2">
                    {{ sp.name }}
                  </h1>
                  <p class="text-xs text-white/80 mt-1 max-w-xl leading-relaxed">
                    {{ sp.description }}
                  </p>
                  <div class="flex items-center gap-3 text-[10px] text-white/60 font-bold mt-2 uppercase tracking-wide">
                    <span>👥 {{ sp.memberCount | number }} members</span>
                  </div>
                </div>
              </div>
    
              <button
                (click)="toggleJoin(sp)"
                [disabled]="isToggling()"
                class="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all hover:scale-105 active:scale-95 shrink-0 self-start sm:self-center disabled:opacity-60"
                [class.border]="sp.isJoined"
                [class.text-white]="sp.isJoined"
                [class.bg-white]="!sp.isJoined"
                [class.text-indigo-950]="!sp.isJoined"
              [ngClass]="{
                'bg-white/10': sp.isJoined,
                'border-white/20': sp.isJoined,
                'hover:bg-white/90': !sp.isJoined
              }"
                >
                {{ sp.isJoined ? 'Joined' : 'Join Space' }}
              </button>
            </div>
          </div>
    
          @if (joinError()) {
            <div class="bg-red-50 border border-red-100 text-red-700 text-xs font-bold rounded-xl p-3 mb-4">
              {{ joinError() }}
            </div>
          }
    
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- Main Feed Column -->
            <div class="col-span-1 lg:col-span-8 space-y-5">
              @if (!sp.isJoined) {
                <div class="bg-indigo-50/50 border border-primary-subtle/30 rounded-2xl p-5 text-center shadow-inner">
                  <p class="text-xs text-text-secondary mb-2">Join this Space to participate in discussions with fellow travelers!</p>
                  <button (click)="toggleJoin(sp)" class="bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm">
                    Join Space
                  </button>
                </div>
              }
    
              <!-- Feed Mode Toggle / Filters -->
              <div class="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 pb-3">
                <h2 class="text-xs font-extrabold text-text-tertiary uppercase tracking-wider">Discussion Feed</h2>
              </div>
    
              <!-- Feed list: space-scoped posts are not implemented on the backend yet,
              so this always renders the honest empty state below. -->
              <div class="bg-white/80 border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
                <span class="text-3xl mb-3 block">💬</span>
                <h3 class="font-extrabold text-base text-text-primary mb-1">No Posts Yet</h3>
                <p class="text-text-secondary text-xs">Space discussions are coming soon!</p>
              </div>
            </div>
    
            <!-- Sidebar Info Column -->
            <div class="col-span-1 lg:col-span-4 space-y-4">
              <!-- Moderator Card -->
              <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <img [src]="sp.createdBy.avatar || '/assets/images/default-avatar.svg'" class="w-10 h-10 rounded-full object-cover shrink-0" />
                  <div>
                    <h4 class="font-extrabold text-xs text-text-primary dark:text-white">{{ sp.createdBy.name }}</h4>
                    <p class="text-[9px] font-bold text-primary uppercase">Space Admin</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      }
    </div>
    `
})
export class CommunitySpaceDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private spacesService = inject(CommunitySpacesService);

  space = signal<Space | null>(null);
  isLoadingSpace = signal(true);
  error = signal<string | null>(null);
  isToggling = signal(false);
  joinError = signal<string | null>(null);

  private sub?: Subscription;

  ngOnInit() {
    this.sub = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.loadSpaceDetails(id);
      }
    });
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
  }

  loadSpaceDetails(id: string) {
    this.isLoadingSpace.set(true);
    this.error.set(null);
    this.spacesService.getSpace(id).subscribe({
      next: (sp) => {
        this.space.set(sp);
        this.isLoadingSpace.set(false);
      },
      error: () => {
        this.error.set('This space could not be found.');
        this.isLoadingSpace.set(false);
      }
    });
  }

  toggleJoin(sp: Space) {
    this.isToggling.set(true);
    this.joinError.set(null);
    this.spacesService.toggleJoin(sp.id).subscribe({
      next: (res) => {
        this.isToggling.set(false);
        this.space.update(curr => curr ? { ...curr, isJoined: res.isJoined, memberCount: res.memberCount } : curr);
      },
      error: (err) => {
        this.isToggling.set(false);
        this.joinError.set(err?.error?.detail || 'Could not update your membership. Please try again.');
      }
    });
  }
}
