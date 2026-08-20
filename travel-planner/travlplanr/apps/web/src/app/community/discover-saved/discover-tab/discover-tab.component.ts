import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DsIconComponent } from '../icon/icon.component';
import { DiscoverSavedStore } from '../discover-saved.store';
import { DiscoverItem } from '../discover-saved.models';
import { avatarPhotoUrl } from '../discover-saved.data';

@Component({
  selector: 'app-ds-discover-tab',
  imports: [DsIconComponent, RouterLink],
  templateUrl: './discover-tab.component.html',
  styleUrl: './discover-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DsDiscoverTabComponent {
  readonly store = inject(DiscoverSavedStore);

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
}
