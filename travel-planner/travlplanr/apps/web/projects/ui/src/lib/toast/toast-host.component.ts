import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService } from './toast.service';

/** Renders queued `ToastService` messages. Mount once near the app root. */
@Component({
    selector: 'lib-toast-host',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [],
    template: `
    <div
      class="pointer-events-none fixed inset-x-0 bottom-6 z-[1000] flex flex-col items-center gap-2"
      role="region"
      aria-live="polite"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex max-w-sm items-center gap-3 rounded-btn px-4 py-3 text-sm font-medium text-white shadow-card-hover"
          [class.bg-success]="toast.variant === 'success'"
          [class.bg-danger]="toast.variant === 'error'"
          [class.bg-dark]="toast.variant === 'info'"
        >
          <span class="flex-1">{{ toast.message }}</span>
          <button
            type="button"
            class="shrink-0 rounded px-1 text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      }
    </div>
  `
})
export class ToastHostComponent {
  protected toastService = inject(ToastService);
}
