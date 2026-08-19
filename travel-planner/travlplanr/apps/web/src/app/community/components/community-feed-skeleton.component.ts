import { Component } from '@angular/core';


@Component({
    selector: 'app-community-feed-skeleton',
    imports: [],
    template: `
    <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100/80 dark:border-gray-700/80 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-4 animate-pulse mb-4 hover:shadow-md transition-shadow">
      <div class="flex gap-3 items-center mb-4">
        <div class="w-12 h-12 bg-slate-200 dark:bg-gray-700 rounded-full"></div>
        <div class="space-y-2 flex-1">
          <div class="h-4 bg-slate-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div class="h-3 bg-slate-200 dark:bg-gray-700 rounded w-1/3"></div>
        </div>
      </div>
      <div class="h-4 bg-slate-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
      <div class="w-full h-64 bg-slate-200 dark:bg-gray-700 rounded-lg"></div>
    </div>
  `
})
export class CommunityFeedSkeletonComponent {}
