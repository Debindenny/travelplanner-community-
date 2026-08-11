import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { POST_TYPE_OPTIONS } from '../../../../../core/data/community-mock-data';

@Component({
  selector: 'app-composer-type-menu',
  imports: [IconComponent],
  templateUrl: './composer-type-menu.component.html',
  styleUrl: './composer-type-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComposerTypeMenuComponent {
  readonly postTypes = POST_TYPE_OPTIONS;

  readonly selectType = output<string>();
}
