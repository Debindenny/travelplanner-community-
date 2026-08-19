import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export type SignalChipTone = 'route' | 'glow' | 'orbit' | 'sunrise' | 'neutral';

@Component({
  selector: 'app-signal-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
      [class]="toneClasses[tone]"
    >
      @if (icon) {
        <span class="text-sm leading-none" aria-hidden="true">{{ icon }}</span>
      }
      <span class="truncate">{{ label }}</span>
      @if (dismissible) {
        <button
          type="button"
          class="ml-0.5 -mr-1 rounded-full p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-current"
          [attr.aria-label]="'Dismiss ' + label"
          (click)="dismissed.emit()"
        >
          <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
          </svg>
        </button>
      }
    </span>
  `
})
export class SignalChipComponent {
  @Input() label = '';
  @Input() icon?: string;
  @Input() tone: SignalChipTone = 'route';
  @Input() dismissible = false;
  @Output() dismissed = new EventEmitter<void>();

  readonly toneClasses: Record<SignalChipTone, string> = {
    route: 'border-route/30 bg-route/10 text-route',
    glow: 'border-route-glow/30 bg-route-glow/10 text-route-glow',
    orbit: 'border-route-orbit/30 bg-route-orbit/10 text-route-orbit',
    sunrise: 'border-route-sunrise/30 bg-route-sunrise/10 text-route-sunrise',
    neutral: 'border-border bg-surface-muted text-text-secondary'
  };
}
