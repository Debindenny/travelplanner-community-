import { Component, OnInit, inject, signal } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { CommunityNotificationsService } from '../services/community-notifications.service';
import { ToastService } from '../../shared/utils/toast.service';

@Component({
    selector: 'app-community-notification-preferences',
    imports: [RouterLink, TranslatePipe, FormsModule],
    template: `
    <div class="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      <!-- Breadcrumb -->
      <nav class="flex mb-4 text-xs font-bold text-text-tertiary uppercase tracking-wider gap-2">
        <a routerLink="/community" class="hover:text-primary transition-colors">Community</a>
        <span class="text-text-primary">Settings</span>
      </nav>

      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-black text-text-primary dark:text-white mb-1">🔔 Notification Preferences</h1>
        <p class="text-text-secondary dark:text-gray-300 text-sm">Manage how and when you want to receive updates from the travel community.</p>
      </div>

      <!-- Settings Cards -->
      <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-6 shadow-sm space-y-6">

        <!-- Push Settings -->
        <div>
          <h3 class="text-xs font-extrabold text-text-primary dark:text-white uppercase tracking-wider mb-4 pb-1.5 border-b border-slate-100 dark:border-gray-700">Notifications</h3>

          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-extrabold text-text-primary dark:text-white">Direct Messages</h4>
                <p class="text-[10px] text-text-secondary dark:text-gray-400 mt-0.5">When someone sends you a message</p>
              </div>
              <input type="checkbox" [(ngModel)]="prefMessages" [disabled]="isLoading()" class="w-4 h-4 text-primary rounded" />
            </div>

            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-extrabold text-text-primary dark:text-white">New Followers</h4>
                <p class="text-[10px] text-text-secondary dark:text-gray-400 mt-0.5">When someone starts following you</p>
              </div>
              <input type="checkbox" [(ngModel)]="prefFollows" [disabled]="isLoading()" class="w-4 h-4 text-primary rounded" />
            </div>

            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-extrabold text-text-primary dark:text-white">Reactions</h4>
                <p class="text-[10px] text-text-secondary dark:text-gray-400 mt-0.5">When someone likes your post</p>
              </div>
              <input type="checkbox" [(ngModel)]="prefLikes" [disabled]="isLoading()" class="w-4 h-4 text-primary rounded" />
            </div>

            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-extrabold text-text-primary dark:text-white">Comments</h4>
                <p class="text-[10px] text-text-secondary dark:text-gray-400 mt-0.5">When someone comments on your post</p>
              </div>
              <input type="checkbox" [(ngModel)]="prefComments" [disabled]="isLoading()" class="w-4 h-4 text-primary rounded" />
            </div>
          </div>
        </div>

        <!-- Email Settings -->
        <div>
          <h3 class="text-xs font-extrabold text-text-primary dark:text-white uppercase tracking-wider mb-4 pb-1.5 border-b border-slate-100 dark:border-gray-700">Email Digest</h3>

          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-extrabold text-text-primary dark:text-white">Weekly Highlights</h4>
                <p class="text-[10px] text-text-secondary dark:text-gray-400 mt-0.5">Top itineraries, trending journals, and active meetups</p>
              </div>
              <input type="checkbox" [(ngModel)]="prefWeeklyDigest" [disabled]="isLoading()" class="w-4 h-4 text-primary rounded" />
            </div>
          </div>
        </div>

        <!-- Save Button -->
        <div class="flex justify-end pt-4 border-t border-slate-100 dark:border-gray-700 mt-6">
          <button
            (click)="saveSettings()"
            [disabled]="isSaving() || isLoading()"
            class="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            @if (isSaving()) {
              <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            }
            Save Settings
          </button>
        </div>
      </div>
    </div>
  `
})
export class CommunityNotificationPreferencesComponent implements OnInit {
  private notificationsService = inject(CommunityNotificationsService);
  private toast = inject(ToastService);

  prefMessages = true;
  prefFollows = true;
  prefLikes = true;
  prefComments = true;
  prefWeeklyDigest = true;

  isLoading = signal(true);
  isSaving = signal(false);

  ngOnInit() {
    this.notificationsService.getPreferences().subscribe({
      next: (prefs) => {
        this.prefMessages = prefs.messages;
        this.prefFollows = prefs.follows;
        this.prefLikes = prefs.likes;
        this.prefComments = prefs.comments;
        this.prefWeeklyDigest = prefs.weekly_digest;
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.error('Failed to load notification preferences');
      }
    });
  }

  saveSettings() {
    this.isSaving.set(true);
    this.notificationsService.updatePreferences({
      messages: this.prefMessages,
      follows: this.prefFollows,
      likes: this.prefLikes,
      comments: this.prefComments,
      weekly_digest: this.prefWeeklyDigest
    }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toast.success('Preferences updated successfully!');
      },
      error: () => {
        this.isSaving.set(false);
        this.toast.error('Failed to update preferences');
      }
    });
  }
}
