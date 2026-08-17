import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CommunityHomeStore } from '../../store/community-home.store';
import { DiscoverItem } from '../../../../core/models/community.models';
import { avatarPhotoUrl } from '../../../../shared/utils/unsplash';

@Component({
  selector: 'app-discover-tab',
  imports: [IconComponent],
  templateUrl: './discover-tab.component.html',
  styleUrl: './discover-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverTabComponent {
  readonly store = inject(CommunityHomeStore);

  authorAvatar(item: DiscoverItem): string {
    return avatarPhotoUrl(item.author, 48);
  }

  isSaved(item: DiscoverItem): boolean {
    return this.store.savedIds().has(item.id);
  }

  onQueryInput(value: string): void {
    this.store.setDiscoverQuery(value);
  }

  onOpen(item: DiscoverItem): void {
    this.store.openDiscoverItem(item);
  }

  onToggleSave(item: DiscoverItem): void {
    this.store.toggleSave(item.id);
  }

  onAddToTrip(item: DiscoverItem): void {
    this.store.openAddToTrip({ spot: item.title, meta: `${item.tag} · ${item.place}`, image: item.image });
  }

  goHome(): void {
    this.store.selectTab('Home');
  }
}
