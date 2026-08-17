import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CommunityHomeStore } from '../../store/community-home.store';
import { SavedCollectionCard, SavedCollectionItem } from '../../../../core/models/community.models';

@Component({
  selector: 'app-saved-tab',
  imports: [IconComponent],
  templateUrl: './saved-tab.component.html',
  styleUrl: './saved-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavedTabComponent {
  readonly store = inject(CommunityHomeStore);

  onOpen(item: SavedCollectionCard): void {
    this.store.openSavedItem(item);
  }

  onAddToTrip(item: SavedCollectionItem): void {
    this.store.openAddToTrip({ spot: item.title, meta: item.meta, image: item.image });
  }
}
