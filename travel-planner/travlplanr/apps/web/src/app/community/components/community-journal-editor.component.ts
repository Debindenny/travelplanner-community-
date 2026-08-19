import { Component, inject, signal } from '@angular/core';

import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CommunityJournalService, CreateJournalPayload } from '../services/community-journal.service';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-community-journal-editor',
    imports: [RouterLink, TranslatePipe, FormsModule],
    template: `
    <div class="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      <!-- Breadcrumb -->
      <nav class="flex mb-4 text-xs font-bold text-text-tertiary uppercase tracking-wider gap-2">
        <a routerLink="/community" class="hover:text-primary transition-colors">Community</a>
        <a routerLink="/community/journals" class="hover:text-primary transition-colors">Journals</a>
        <span>/</span>
        <span class="text-text-primary">New Journal</span>
      </nav>

      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-black text-text-primary dark:text-white mb-1">📔 Create Travel Journal</h1>
        <p class="text-text-secondary dark:text-gray-300 text-sm">Write up your trip highlights, route overview, and tips for other travelers.</p>
      </div>

      <!-- Editor Card -->
      <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-6 shadow-sm space-y-4">
        @if (error()) {
          <div class="bg-red-50 border border-red-100 text-red-700 text-xs font-bold rounded-xl p-3">
            {{ error() }}
          </div>
        }

        <div>
          <label class="block text-2xs font-extrabold text-text-tertiary uppercase mb-1.5">Journal / Trip Title</label>
          <input
            type="text"
            [(ngModel)]="title"
            placeholder="e.g. 2 Weeks in Southern Italy & Amalfi Coast"
            class="w-full text-xs px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 text-slate-800 dark:text-white font-medium"
          />
        </div>

        <div>
          <label class="block text-2xs font-extrabold text-text-tertiary uppercase mb-1.5">Journal Content</label>
          <textarea
            [(ngModel)]="content"
            rows="8"
            placeholder="Write your trip log, day-by-day highlights, and tips for other travelers..."
            class="w-full text-xs p-3 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 text-slate-800 dark:text-white resize-none"
          ></textarea>
        </div>

        <div class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50">
          <input
            type="checkbox"
            [(ngModel)]="isPublic"
            id="isPublic"
            class="w-4 h-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 rounded"
          />
          <label for="isPublic" class="text-xs font-bold text-text-secondary dark:text-gray-300 cursor-pointer select-none">
            Publish this journal publicly in the Community Feed
          </label>
        </div>

        <div class="flex justify-end gap-2 border-t border-slate-100 dark:border-gray-700 pt-4 mt-6">
          <button
            routerLink="/community/journals"
            class="px-4 py-2 text-xs font-bold text-text-secondary hover:bg-slate-100 dark:hover:bg-gray-700 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            (click)="submitJournal()"
            [disabled]="!title.trim() || isSaving()"
            class="px-6 py-2 text-xs bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
          >
            {{ isSaving() ? 'Saving…' : 'Save Journal' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class CommunityJournalEditorComponent {
  private journalService = inject(CommunityJournalService);
  private router = inject(Router);

  title = '';
  content = '';
  isPublic = true;
  isSaving = signal(false);
  error = signal<string | null>(null);

  submitJournal() {
    if (!this.title.trim()) return;

    const payload: CreateJournalPayload = {
      title: this.title.trim(),
      content: this.content.trim() || undefined,
      isPublic: this.isPublic
    };

    this.isSaving.set(true);
    this.error.set(null);
    this.journalService.createJournal(payload).subscribe({
      next: () => {
        this.router.navigate(['/community/journals']);
      },
      error: () => {
        this.isSaving.set(false);
        this.error.set('Could not save your journal. Please try again.');
      }
    });
  }
}
