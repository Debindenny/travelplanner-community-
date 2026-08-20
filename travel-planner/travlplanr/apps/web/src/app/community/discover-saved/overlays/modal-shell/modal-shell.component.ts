import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { DsIconComponent } from '../../icon/icon.component';

@Component({
  selector: 'app-ds-modal-shell',
  imports: [DsIconComponent],
  templateUrl: './modal-shell.component.html',
  styleUrl: './modal-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DsModalShellComponent {
  readonly title = input<string>('');
  readonly titleIcon = input<string | undefined>(undefined);
  readonly subtitle = input<string>('');
  readonly showHeader = input(true);
  readonly width = input('560px');

  readonly close = output<void>();
}
