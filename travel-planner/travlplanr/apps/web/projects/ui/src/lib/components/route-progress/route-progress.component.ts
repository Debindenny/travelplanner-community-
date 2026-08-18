import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export interface RouteProgressStep {
  label: string;
  state: 'done' | 'current' | 'upcoming';
}

@Component({
  selector: 'app-route-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="flex w-full items-center" [attr.aria-label]="ariaLabel">
      @for (step of steps; track step.label; let last = $last) {
        <li class="flex flex-1 items-center gap-2">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-bold"
            [class.bg-route]="step.state !== 'upcoming'"
            [class.text-white]="step.state !== 'upcoming'"
            [class.bg-border-light]="step.state === 'upcoming'"
            [class.text-text-tertiary]="step.state === 'upcoming'"
            [class.ring-2]="step.state === 'current'"
            [class.ring-route-glow]="step.state === 'current'"
          >
            {{ $index + 1 }}
          </span>
          <span class="hidden truncate text-xs font-medium text-text-secondary sm:inline">{{ step.label }}</span>
          @if (!last) {
            <span
              class="h-px flex-1"
              [class.bg-route]="step.state === 'done'"
              [class.bg-border-light]="step.state !== 'done'"
            ></span>
          }
        </li>
      }
    </ol>
  `
})
export class RouteProgressComponent {
  @Input() steps: RouteProgressStep[] = [];
  @Input() ariaLabel = 'Progress';
}
