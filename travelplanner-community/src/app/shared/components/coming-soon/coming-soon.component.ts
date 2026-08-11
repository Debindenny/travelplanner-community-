import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { CommunityTab } from '../../../core/models/community.models';

@Component({
  selector: 'app-coming-soon',
  imports: [IconComponent],
  templateUrl: './coming-soon.component.html',
  styleUrl: './coming-soon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoonComponent {
  readonly tab = input.required<CommunityTab>();

  readonly goHome = output<void>();
}
