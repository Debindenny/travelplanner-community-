import { NgClass, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Params, RouterLink } from '@angular/router';

@Component({
    selector: 'app-primary-button',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, NgClass, NgTemplateOutlet],
    template: `
    @if (routerLink) {
      <a
        [routerLink]="routerLink"
        [queryParams]="queryParams"
        class="btn-shine relative inline-flex h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-btn bg-primary px-6 text-base font-medium text-white no-underline transition-colors hover:bg-primary-hover active:bg-primary-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        [ngClass]="widthClass"
      >
        <ng-container [ngTemplateOutlet]="label" />
      </a>
    } @else {
      <button
        [type]="type"
        [disabled]="disabled || loading"
        [attr.aria-busy]="loading || null"
        class="btn-shine relative inline-flex h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-btn bg-primary px-6 text-base font-medium text-white transition-colors hover:bg-primary-hover active:bg-primary-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
        [ngClass]="widthClass"
      >
        @if (loading) {
          <span
            class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            aria-hidden="true"
          ></span>
        }
        <ng-container [ngTemplateOutlet]="label" />
      </button>
    }
    <!-- Single projection slot reused by both branches. Two bare <ng-content>
         slots only project into one, leaving the other branch's label blank. -->
    <ng-template #label><ng-content /></ng-template>
  `
})
export class PrimaryButtonComponent {
  @Input() routerLink?: string | string[];
  @Input() queryParams?: Params;
  @Input() type: 'button' | 'submit' = 'button';
  @Input() widthClass = '';
  @Input() disabled = false;
  /** Shows an inline spinner, disables the button and sets aria-busy. */
  @Input() loading = false;
}
