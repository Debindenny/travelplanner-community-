import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CommunityHomeStore } from '../../store/community-home.store';

@Component({
  selector: 'app-discover-tab',
  imports: [],
  templateUrl: './discover-tab.component.html',
  styleUrl: './discover-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverTabComponent {
  readonly store = inject(CommunityHomeStore);

  onOpen(title: string): void {
    this.store.showToast(`Opening “${title}”`);
  }
}
