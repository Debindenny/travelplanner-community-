import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { IconComponent } from '../../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-start-circle-card',
  imports: [IconComponent],
  templateUrl: './start-circle-card.component.html',
  styleUrl: './start-circle-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartCircleCardComponent {
  readonly createCircle = output<void>();
}
