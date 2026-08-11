import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { POST_OPTIONS_MENU_ITEMS } from '../../../../../core/data/community-mock-data';
import { PostOptionsMenuItem } from '../../../../../core/models/community.models';

@Component({
  selector: 'app-post-options-modal',
  imports: [],
  templateUrl: './post-options-modal.component.html',
  styleUrl: './post-options-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostOptionsModalComponent {
  readonly menuItems = POST_OPTIONS_MENU_ITEMS;

  readonly selectItem = output<PostOptionsMenuItem>();
}
