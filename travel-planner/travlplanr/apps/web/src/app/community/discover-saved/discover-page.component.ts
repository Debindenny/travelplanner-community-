import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { DiscoverSavedStore } from './discover-saved.store';
import { DsDiscoverTabComponent } from './discover-tab/discover-tab.component';
import { DsModalShellComponent } from './overlays/modal-shell/modal-shell.component';
import { DsDiscoverDetailModalComponent } from './overlays/discover-detail-modal/discover-detail-modal.component';
import { DsAddToTripModalComponent } from './overlays/add-to-trip-modal/add-to-trip-modal.component';

@Component({
  selector: 'app-community-discover-page',
  imports: [DsDiscoverTabComponent, DsModalShellComponent, DsDiscoverDetailModalComponent, DsAddToTripModalComponent],
  templateUrl: './discover-page.component.html',
  styleUrl: './discover-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverPageComponent {
  readonly store = inject(DiscoverSavedStore);

  constructor() {
    this.store.loadDiscover();
  }
}
