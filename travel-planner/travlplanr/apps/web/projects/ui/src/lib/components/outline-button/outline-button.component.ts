import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-outline-button',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, NgClass],
    template: `
    @if (routerLink) {
      <a
        [routerLink]="routerLink"
        class="inline-flex h-12 items-center justify-center rounded-btn border border-white bg-transparent px-6 text-base font-medium text-white no-underline transition-colors hover:bg-white/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        [ngClass]="widthClass"
      >
        <ng-content />
      </a>
    } @else {
      <button
        [type]="type"
        [disabled]="disabled"
        class="inline-flex h-12 items-center justify-center rounded-btn border border-white bg-transparent px-6 text-base font-medium text-white transition-colors hover:bg-white/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
        [ngClass]="widthClass"
      >
        <ng-content />
      </button>
    }
  `
})
export class OutlineButtonComponent {
  @Input() routerLink?: string | string[];
  @Input() type: 'button' | 'submit' = 'button';
  @Input() widthClass = '';
  @Input() disabled = false;
}
