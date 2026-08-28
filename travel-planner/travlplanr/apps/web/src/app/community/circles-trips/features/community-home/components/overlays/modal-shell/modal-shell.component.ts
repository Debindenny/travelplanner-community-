import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-modal-shell',
  imports: [IconComponent],
  templateUrl: './modal-shell.component.html',
  styleUrl: './modal-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalShellComponent {
  /* Named "heading", not "title": a static `title="..."` attribute on a custom
     element also sets the native HTML `title` attribute, which makes the browser
     show its own tooltip over the whole modal on hover. */
  readonly heading = input<string>('');
  readonly titleIcon = input<string | undefined>(undefined);
  readonly subtitle = input<string>('');
  readonly showHeader = input(true);
  readonly width = input('560px');
  readonly maxHeight = input('640px');
  readonly variant = input<'default' | 'violet'>('default');
  readonly backdrop = input<'dark' | 'light'>('dark');

  readonly close = output<void>();
}
