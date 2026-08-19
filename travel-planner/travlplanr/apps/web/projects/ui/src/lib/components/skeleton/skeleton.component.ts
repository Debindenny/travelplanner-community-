import { Component, Input } from '@angular/core';


@Component({
    selector: 'app-skeleton',
    imports: [],
    template: `
    @if (variant === 'card') {
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-border-light dark:border-gray-700 shadow-sm h-[140px] animate-pulse">
        <div class="flex justify-between items-start">
          <div class="space-y-2 flex-1">
            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
            <div class="h-7 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
          </div>
          <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>
    }
    
    @if (variant === 'table-row') {
      <div class="flex items-center gap-4 py-3 animate-pulse">
        <div class="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-16"></div>
      </div>
    }
    
    @if (variant === 'chart') {
      <div class="animate-pulse">
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
        <div class="h-full bg-gray-100 dark:bg-gray-700/50 rounded-xl" [style.height]="height"></div>
      </div>
    }
    
    @if (variant === 'text') {
      <div class="animate-pulse">
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded" [style.width]="width"></div>
      </div>
    }
    `
})
export class SkeletonComponent {
  @Input() variant: 'card' | 'table-row' | 'chart' | 'text' = 'text';
  @Input() width = '100%';
  @Input() height = '300px';
}
