import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { DiscoverSavedStore } from './discover-saved.store';
import { DsSavedTabComponent } from './saved-tab/saved-tab.component';
import { DsModalShellComponent } from './overlays/modal-shell/modal-shell.component';
import { DsSavedDetailModalComponent } from './overlays/saved-detail-modal/saved-detail-modal.component';
import { DsAddToTripModalComponent } from './overlays/add-to-trip-modal/add-to-trip-modal.component';
import { CommunityComposerModalComponent } from '../components/community-composer-modal.component';
import { CommunityHomeSubnavComponent } from '../components/community-home-subnav.component';
import { CommunityProfileSummaryComponent } from '../components/community-profile-summary.component';
import { CommunityProfileService, MyCommunityProfile } from '../services/community-profile.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-community-saved-page',
  imports: [
    DsSavedTabComponent,
    DsModalShellComponent,
    DsSavedDetailModalComponent,
    DsAddToTripModalComponent,
    CommunityHomeSubnavComponent,
    CommunityProfileSummaryComponent,
    CommunityComposerModalComponent,
  ],
  templateUrl: './saved-page.component.html',
  styleUrl: './saved-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavedPageComponent {
  readonly store = inject(DiscoverSavedStore);
  readonly showComposerModal = signal(false);

  private readonly auth = inject(AuthService);
  private readonly profileService = inject(CommunityProfileService);
  readonly user = this.auth.user;
  readonly myProfile = signal<MyCommunityProfile | null>(null);

  constructor() {
    this.store.loadSaved();
    if (this.auth.user()) {
      this.profileService.getMyProfile().subscribe({
        next: (p) => this.myProfile.set(p),
        error: () => {},
      });
    }
  }
}
