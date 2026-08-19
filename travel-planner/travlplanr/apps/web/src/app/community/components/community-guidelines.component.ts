import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'app-community-guidelines',
    imports: [RouterLink, TranslatePipe],
    template: `
    <div class="max-w-3xl mx-auto py-10 px-4 sm:px-6">
      <!-- Breadcrumb -->
      <nav class="flex mb-4 text-xs font-bold text-text-tertiary uppercase tracking-wider gap-2">
        <a routerLink="/community" class="hover:text-primary transition-colors">Community</a>
        <span>/</span>
        <span class="text-text-primary">Guidelines</span>
      </nav>

      <!-- Header -->
      <div class="mb-8 text-center sm:text-left">
        <h1 class="text-3xl font-black text-text-primary mb-2 flex items-center justify-center sm:justify-start gap-2.5">
          <span>🛡️</span> Community Guidelines
        </h1>
        <p class="text-text-secondary text-sm">Our rules for keeping the Travl community safe, authentic, and inspiring for everyone.</p>
      </div>

      <!-- Content -->
      <div class="space-y-6">
        <!-- Rule 1 -->
        <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5 shadow-sm">
          <h2 class="text-base font-extrabold text-text-primary dark:text-white flex items-center gap-2 mb-2">
            <span class="text-emerald-500">1.</span> Be Real, Share Authentically
          </h2>
          <p class="text-xs text-text-secondary dark:text-gray-300 leading-relaxed">
            Travl is built on trust and honest trip experiences. Only share photos, videos, and stories that are yours or that you have permission to post. Avoid posting overly curated, fake, or AI-generated travel itineraries masquerading as real journeys.
          </p>
        </div>

        <!-- Rule 2 -->
        <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5 shadow-sm">
          <h2 class="text-base font-extrabold text-text-primary dark:text-white flex items-center gap-2 mb-2">
            <span class="text-blue-500">2.</span> Respect and Support Other Travelers
          </h2>
          <p class="text-xs text-text-secondary dark:text-gray-300 leading-relaxed">
            Travelers come from all backgrounds, cultures, and identities. We do not tolerate harassment, hate speech, bullying, or discrimination of any kind. Keep discussions supportive, constructive, and friendly.
          </p>
        </div>

        <!-- Rule 3 -->
        <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5 shadow-sm">
          <h2 class="text-base font-extrabold text-text-primary dark:text-white flex items-center gap-2 mb-2">
            <span class="text-indigo-500">3.</span> Prioritize Safety and Respect Locals
          </h2>
          <p class="text-xs text-text-secondary dark:text-gray-300 leading-relaxed">
            Respect the local laws, regulations, and customs of the destinations you visit. Avoid detailing or encouraging illegal actions, dangerous stunts, trespassing, or exploitative behavior towards local communities and wildlife.
          </p>
        </div>

        <!-- Rule 4 -->
        <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-5 shadow-sm">
          <h2 class="text-base font-extrabold text-text-primary dark:text-white flex items-center gap-2 mb-2">
            <span class="text-purple-500">4.</span> No Spam or Commercial Solicitation
          </h2>
          <p class="text-xs text-text-secondary dark:text-gray-300 leading-relaxed">
            Do not spam the feeds with ads, affiliate links, self-promotion, or repetitive posts. Sponsored content must be clearly flagged and adhere to our advertiser policies.
          </p>
        </div>

        <!-- Reporting Section -->
        <div class="bg-gradient-to-br from-indigo-50/50 to-primary-50/30 border border-primary-subtle/30 rounded-2xl p-6 text-center shadow-inner mt-8">
          <h3 class="font-extrabold text-sm text-text-primary mb-2">See Something Violating Our Guidelines?</h3>
          <p class="text-xs text-text-secondary mb-4 max-w-lg mx-auto leading-relaxed">
            Help us maintain a safe community by reporting posts, comments, or users that violate these guidelines. Simply click the three dots button on any post and select "Report".
          </p>
          <a routerLink="/community" class="inline-block bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-full text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95">
            Back to Community
          </a>
        </div>
      </div>
    </div>
  `
})
export class CommunityGuidelinesComponent {}
