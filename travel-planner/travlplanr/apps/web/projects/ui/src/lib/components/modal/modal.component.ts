import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-modal',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule],
    template: `
    @if (isOpen) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10"
        role="dialog"
        aria-modal="true"
        >
        <!-- Backdrop with blur -->
        <div
          class="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity"
          (click)="onClose()"
        ></div>
        <!-- Modal Card -->
        <div
          class="relative w-full max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-3xl shadow-2xl transition-all overflow-hidden transform scale-100"
        [ngClass]="{
          'max-w-sm': size === 'sm',
          'max-w-md': size === 'md',
          'max-w-lg': size === 'lg',
          'max-w-2xl': size === 'xl',
          'max-w-4xl': size === '2xl'
        }"
          >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-gray-800 shrink-0">
            <h3 class="text-base font-bold text-text-primary dark:text-white uppercase tracking-wider">
              {{ title }}
            </h3>
            <button
              type="button"
              class="text-text-disabled hover:text-text-secondary dark:hover:text-gray-300 transition-colors p-1 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800"
              (click)="onClose()"
              aria-label="Close modal"
              >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Body -->
          <div class="px-6 py-6 overflow-y-auto flex-1 text-sm text-text-secondary dark:text-gray-300">
            <ng-content></ng-content>
          </div>
          <!-- Footer -->
          @if (showFooter) {
            <div class="px-6 py-4 bg-slate-50/50 dark:bg-gray-900/50 border-t border-slate-100 dark:border-gray-800 flex items-center justify-end gap-3 shrink-0">
              <ng-content select="[footer]"></ng-content>
            </div>
          }
        </div>
      </div>
    }
    `
})
export class ModalComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'md';
  @Input() showFooter = false;

  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }
}
