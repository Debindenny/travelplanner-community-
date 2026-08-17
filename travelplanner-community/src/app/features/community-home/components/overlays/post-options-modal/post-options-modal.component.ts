import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

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

  readonly authorName = input('this traveler');
  readonly saved = input(false);

  readonly selectItem = output<PostOptionsMenuItem>();

  itemLabel(item: PostOptionsMenuItem): string {
    switch (item.action) {
      case 'toggleSave':
        return this.saved() ? 'Remove from saved' : 'Save post';
      case 'mute':
        return `Mute ${this.authorName()}`;
      case 'block':
        return `Block ${this.authorName()}`;
      default:
        return item.label;
    }
  }
}
