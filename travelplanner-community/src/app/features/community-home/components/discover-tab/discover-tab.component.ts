import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CommunityHomeStore } from '../../store/community-home.store';
import { DiscoverDetailPayload } from '../../../../core/models/community.models';

@Component({
  selector: 'app-discover-tab',
  imports: [],
  templateUrl: './discover-tab.component.html',
  styleUrl: './discover-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverTabComponent {
  readonly store = inject(CommunityHomeStore);

  onOpen(item: DiscoverDetailPayload): void {
    this.store.openDiscoverItem(item);
  }

  goHome(): void {
    this.store.selectTab('Home');
  }
}
