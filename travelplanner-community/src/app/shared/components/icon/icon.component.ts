import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'house'
  | 'compass'
  | 'map-pin'
  | 'route'
  | 'users'
  | 'calendar-check'
  | 'bookmark'
  | 'plus'
  | 'sparkles'
  | 'search'
  | 'bell'
  | 'mail'
  | 'thumbs-up'
  | 'message-circle'
  | 'more-horizontal'
  | 'check'
  | 'corner-down-right'
  | 'play'
  | 'x'
  | 'user'
  | 'lock'
  | 'book'
  | 'bar-chart'
  | 'user-plus'
  | 'chevron-right'
  | 'trash';

@Component({
  selector: 'app-icon',
  imports: [],
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      @switch (name()) {
        @case ('house') {
          <path d="M15 21v-8H9v8" /><path d="M3 10.2V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8.8a2 2 0 0 0-.7-1.5l-7-6a2 2 0 0 0-2.6 0l-7 6a2 2 0 0 0-.7 1.5Z" />
        }
        @case ('compass') {
          <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" /><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z" />
        }
        @case ('map-pin') {
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><path d="M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        }
        @case ('route') {
          <path d="M6.5 6.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /><path d="M17.5 22.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /><path d="M6.5 6.5h7a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8h8" />
        }
        @case ('users') {
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        }
        @case ('calendar-check') {
          <path d="M8 2v4" /><path d="M16 2v4" /><path d="M3 10h18" /><path d="M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7" /><path d="m16 20 2 2 4-4" />
        }
        @case ('bookmark') {
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        }
        @case ('plus') {
          <path d="M5 12h14" /><path d="M12 5v14" />
        }
        @case ('sparkles') {
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" />
        }
        @case ('bell') {
          <path d="M21 11.5a8.4 8.4 0 01-9 8.5 9.7 9.7 0 01-2.8-.4L3 21l1.4-4.2A8.4 8.4 0 0121 11.5z" />
        }
        @case ('mail') {
          <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 01-3.4 0" />
        }
        @case ('thumbs-up') {
          <path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
        }
        @case ('message-circle') {
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        }
        @case ('more-horizontal') {
          <path d="M12 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z" /><path d="M19 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z" /><path d="M5 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z" />
        }
        @case ('check') {
          <path d="M20 6 9 17l-5-5" />
        }
        @case ('corner-down-right') {
          <path d="m15 10 5 5-5 5" /><path d="M4 4v7a4 4 0 0 0 4 4h12" />
        }
        @case ('play') {
          <path d="M6 3.5 20 12 6 20.5Z" />
        }
        @case ('x') {
          <path d="M18 6 6 18" /><path d="m6 6 12 12" />
        }
        @case ('user') {
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        }
        @case ('lock') {
          <path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Z" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        }
        @case ('book') {
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        }
        @case ('bar-chart') {
          <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
        }
        @case ('user-plus') {
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M19 8v6" /><path d="M22 11h-6" />
        }
        @case ('chevron-right') {
          <path d="m9 6 6 6-6 6" />
        }
        @case ('trash') {
          <path d="M3 6h18" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        }
      }
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<IconName | string>();
  readonly size = input<number>(16);
}
