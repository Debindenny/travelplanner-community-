import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type DataMetricTrend = 'up' | 'down' | 'flat';

/** Label + value + trend using font-data (IBM Plex Mono) for airport codes, dates, durations, prices, booking refs. */
@Component({
  selector: 'app-data-metric',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-0.5">
      <span class="data-label">{{ label }}</span>
      <div class="flex items-baseline gap-1.5">
        <span class="font-data text-2xl font-medium text-text-primary">{{ value }}</span>
        @if (trend !== 'flat') {
          <span
            class="font-data text-xs font-medium"
            [class.text-success]="trend === 'up'"
            [class.text-danger]="trend === 'down'"
          >
            {{ trend === 'up' ? '▲' : '▼' }}{{ trendLabel ? ' ' + trendLabel : '' }}
          </span>
        }
      </div>
    </div>
  `
})
export class DataMetricComponent {
  @Input() label = '';
  @Input() value = '';
  @Input() trend: DataMetricTrend = 'flat';
  @Input() trendLabel?: string;
}
