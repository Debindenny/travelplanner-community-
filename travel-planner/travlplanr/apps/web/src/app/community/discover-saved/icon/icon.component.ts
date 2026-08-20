import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'compass'
  | 'map-pin'
  | 'bookmark'
  | 'search'
  | 'check'
  | 'x'
  | 'bar-chart'
  | 'chevron-down'
  | 'trash'
  | 'utensils'
  | 'bed'
  | 'bus'
  | 'plane';

@Component({
  selector: 'app-ds-icon',
  imports: [],
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      @switch (name()) {
        @case ('compass') {
          <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" /><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z" />
        }
        @case ('map-pin') {
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><path d="M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        }
        @case ('bookmark') {
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" />
        }
        @case ('check') {
          <path d="M20 6 9 17l-5-5" />
        }
        @case ('x') {
          <path d="M18 6 6 18" /><path d="m6 6 12 12" />
        }
        @case ('bar-chart') {
          <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
        }
        @case ('chevron-down') {
          <path d="m6 9 6 6 6-6" />
        }
        @case ('trash') {
          <path d="M3 6h18" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        }
        @case ('utensils') {
          <path d="M3 2v7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7" />
        }
        @case ('bed') {
          <path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /><path d="M6 8v9" />
        }
        @case ('bus') {
          <path d="M8 6v6" /><path d="M15 6v6" /><path d="M2 12h19.6" /><path d="M18 18h3a1 1 0 0 0 1-1V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v9a1 1 0 0 0 1 1h3" /><circle cx="7" cy="18" r="2" /><path d="M9 18h6" /><circle cx="16" cy="18" r="2" />
        }
        @case ('plane') {
          <path d="M17.8 19.2 16 11l3.5-3.5c1.5-1.5 2-3.5 1.5-4.5-1-.5-3 0-4.5 1.5L13 8 4.8 6.2a.9.9 0 0 0-1.1.5l-.3.5a.9.9 0 0 0 .4 1.4L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3a.9.9 0 0 0 1.4.4l.5-.3a.9.9 0 0 0 .5-1.1Z" />
        }
      }
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DsIconComponent {
  readonly name = input.required<IconName | string>();
  readonly size = input<number>(16);
  readonly strokeWidth = input<number>(2);
}
