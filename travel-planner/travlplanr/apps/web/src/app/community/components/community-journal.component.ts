import { Component, OnInit, inject, signal } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CommunityJournalService, JournalListItem } from '../services/community-journal.service';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-community-journal',
    imports: [RouterLink, TranslatePipe, FormsModule],
    template: `
    <div class="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <!-- Header -->
      <div class="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-black text-text-primary dark:text-white mb-1">📔 Travel Journals & Logs</h1>
          <p class="text-text-secondary dark:text-gray-300 text-sm">Read full travel memories, daily logs, and route journals shared by explorers.</p>
        </div>
    
        <button
          [routerLink]="['/community/journals/new']"
          class="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-sm transition-all hover:scale-105 active:scale-95 shrink-0 self-start md:self-auto"
          >
          Write Journal
        </button>
      </div>
    
      <!-- Loading skeleton -->
      @if (isLoading()) {
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          @for (i of [1, 2]; track i) {
            <div class="bg-white/80 rounded-2xl border border-slate-100 p-5 animate-pulse h-60">
              <div class="h-32 bg-slate-200 rounded-xl mb-3"></div>
              <div class="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
              <div class="h-3 bg-slate-200 rounded w-3/4"></div>
            </div>
          }
        </div>
      } @else if (error()) {
        <div class="bg-white/80 border border-red-100 rounded-2xl p-12 text-center shadow-sm">
          <span class="text-3xl mb-3 block">⚠️</span>
          <h3 class="font-extrabold text-base text-text-primary mb-1">Couldn't load journals</h3>
          <p class="text-text-secondary text-xs mb-4">{{ error() }}</p>
          <button
            (click)="loadJournals()"
            class="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
            >
            Retry
          </button>
        </div>
      } @else {
        <!-- Journals Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          @for (journal of journals(); track journal.id) {
            <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-md transition-all duration-300 flex flex-col group">
    
              <!-- Cover visual -->
              <div class="h-40 bg-gradient-to-tr from-slate-900 to-indigo-950 flex items-center justify-center relative overflow-hidden select-none">
                @if (journal.coverImage) {
                  <img [src]="journal.coverImage" class="w-full h-full object-cover opacity-45 group-hover:scale-105 transition-transform duration-500" />
                }
                <span class="text-4xl relative z-10">📔</span>
              </div>
    
              <!-- Card body -->
              <div class="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 class="font-extrabold text-sm text-text-primary dark:text-white leading-snug mb-2 group-hover:text-primary transition-colors">
                    <a [routerLink]="['/community/journals', journal.id]">{{ journal.title }}</a>
                  </h3>
                  <p class="text-xs text-text-secondary dark:text-gray-300 line-clamp-3 leading-relaxed mb-4">
                    {{ journal.content }}
                  </p>
                </div>
    
                <div class="border-t border-slate-100 dark:border-gray-700/50 pt-3.5 mt-auto flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <img [src]="journal.author.avatar || '/assets/images/default-avatar.svg'" class="w-7 h-7 rounded-full object-cover border shrink-0 bg-slate-50" />
                    <span class="text-2xs font-extrabold text-text-secondary dark:text-gray-300 truncate max-w-[120px]">{{ journal.author.name }}</span>
                  </div>
                </div>
              </div>
            </div>
          }
          @if (journals().length === 0) {
            <div class="col-span-full bg-white/80 border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
              <span class="text-3xl mb-3 block">📔</span>
              <h3 class="font-extrabold text-base text-text-primary mb-1">No Journals Found</h3>
              <p class="text-text-secondary text-xs">Be the first to publish a travel log or daily memories book!</p>
            </div>
          }
        </div>
      }
    </div>
    `
})
export class CommunityJournalComponent implements OnInit {
  private journalService = inject(CommunityJournalService);

  journals = signal<JournalListItem[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.loadJournals();
  }

  loadJournals() {
    this.isLoading.set(true);
    this.error.set(null);
    this.journalService.getJournals().subscribe({
      next: (journals) => {
        this.journals.set(journals);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Something went wrong while loading journals.');
        this.isLoading.set(false);
      }
    });
  }
}
