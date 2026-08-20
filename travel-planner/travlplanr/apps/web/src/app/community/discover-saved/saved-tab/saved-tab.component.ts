import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DsIconComponent } from '../icon/icon.component';
import { DiscoverSavedStore } from '../discover-saved.store';
import { SavedCollectionCard, SavedCollectionItem } from '../discover-saved.models';

@Component({
  selector: 'app-ds-saved-tab',
  imports: [DsIconComponent, RouterLink],
  templateUrl: './saved-tab.component.html',
  styleUrl: './saved-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DsSavedTabComponent {
  readonly store = inject(DiscoverSavedStore);

  onOpen(item: SavedCollectionCard): void {
    this.store.openSavedItem(item);
  }

  onAddToTrip(item: SavedCollectionItem): void {
    this.store.openAddToTrip({ spot: item.title, meta: item.meta, image: item.image });
  }
}
