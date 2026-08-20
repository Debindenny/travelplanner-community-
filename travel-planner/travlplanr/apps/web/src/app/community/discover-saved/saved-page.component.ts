import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { DiscoverSavedStore } from './discover-saved.store';
import { DsSavedTabComponent } from './saved-tab/saved-tab.component';
import { DsModalShellComponent } from './overlays/modal-shell/modal-shell.component';
import { DsSavedDetailModalComponent } from './overlays/saved-detail-modal/saved-detail-modal.component';
import { DsAddToTripModalComponent } from './overlays/add-to-trip-modal/add-to-trip-modal.component';

@Component({
  selector: 'app-community-saved-page',
  imports: [DsSavedTabComponent, DsModalShellComponent, DsSavedDetailModalComponent, DsAddToTripModalComponent],
  templateUrl: './saved-page.component.html',
  styleUrl: './saved-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavedPageComponent {
  readonly store = inject(DiscoverSavedStore);

  constructor() {
    this.store.loadSaved();
  }
}
