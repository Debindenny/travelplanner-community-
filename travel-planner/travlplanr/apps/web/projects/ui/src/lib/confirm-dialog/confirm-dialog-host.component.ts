import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ConfirmDialogService } from './confirm-dialog.service';

/** Renders the pending `ConfirmDialogService` request, if any. Mount once near the app root. */
@Component({
    selector: 'lib-confirm-dialog-host',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [],
    template: `
    @if (dialog.request(); as req) {
      <div
        class="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        (click)="dialog.respond(false)"
      >
        <div class="max-w-sm rounded-2xl bg-white p-6 shadow-card-hover dark:bg-gray-800" (click)="$event.stopPropagation()">
          <div class="mb-4 flex items-start gap-4">
            <div
              [class]="req.data.danger
                ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30'
                : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30'"
            >
              @if (req.data.danger) {
                <svg class="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              } @else {
                <svg class="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              }
            </div>
            <div>
              <h3 class="mb-1 text-base font-bold text-gray-900 dark:text-white">{{ req.data.title }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ req.data.message }}</p>
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              (click)="dialog.respond(false)"
            >
              {{ req.data.cancelLabel || 'Cancel' }}
            </button>
            <button
              type="button"
              [class]="req.data.danger
                ? 'rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700'
                : 'rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover'"
              (click)="dialog.respond(true)"
            >
              {{ req.data.confirmLabel || 'Confirm' }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmDialogHostComponent {
  protected dialog = inject(ConfirmDialogService);
}
