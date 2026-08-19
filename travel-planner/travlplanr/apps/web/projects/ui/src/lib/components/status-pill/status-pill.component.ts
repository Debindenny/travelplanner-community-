import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type StatusPillVariant = 'success' | 'warning' | 'info' | 'generating';

@Component({
  selector: 'app-status-pill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-bold uppercase tracking-wide"
      [class]="variantClasses[variant]"
    >
      @if (variant === 'generating') {
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-current"></span>
      }
      {{ label }}
    </span>
  `
})
export class StatusPillComponent {
  @Input() label = '';
  @Input() variant: StatusPillVariant = 'info';

  readonly variantClasses: Record<StatusPillVariant, string> = {
    success: 'bg-success-50 text-success',
    warning: 'bg-warning-50 text-warning',
    info: 'bg-primary-50 text-primary',
    generating: 'bg-route/10 text-route'
  };
}
