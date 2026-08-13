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
  readonly title = input<string>('');
  readonly titleIcon = input<string | undefined>(undefined);
  readonly subtitle = input<string>('');
  readonly showHeader = input(true);
  readonly width = input('560px');
  readonly variant = input<'default' | 'violet'>('default');

  readonly close = output<void>();
}
