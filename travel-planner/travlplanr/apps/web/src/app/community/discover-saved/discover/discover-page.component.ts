import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { DiscoverSavedStore } from '../discover-saved.store';
import { DiscoverItem } from '../discover-saved.models';
import { avatarPhotoUrl } from '../discover-saved.data';

import { DsIconComponent } from '../icon/icon.component';

import { DsModalShellComponent } from '../overlays/modal-shell/modal-shell.component';
import { DsDiscoverDetailModalComponent } from '../overlays/discover-detail-modal/discover-detail-modal.component';
import { DsAddToTripModalComponent } from '../overlays/add-to-trip-modal/add-to-trip-modal.component';

import { CommunityComposerModalComponent } from '../../components/community-composer-modal.component';
import { CommunityHomeSubnavComponent } from '../../components/community-home-subnav.component';
import { CommunityProfileSummaryComponent } from '../../components/community-profile-summary.component';

import {
  CommunityProfileService,
  MyCommunityProfile,
} from '../../services/community-profile.service';

import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-community-discover-page',
  imports: [
    RouterLink,
    DsIconComponent,

    DsModalShellComponent,
    DsDiscoverDetailModalComponent,
    DsAddToTripModalComponent,

    CommunityHomeSubnavComponent,
    CommunityProfileSummaryComponent,
    CommunityComposerModalComponent,
  ],
  templateUrl: './discover-page.component.html',
  styleUrl: './discover-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverPageComponent {
  readonly store = inject(DiscoverSavedStore);
  readonly showComposerModal = signal(false);

  private readonly auth = inject(AuthService);
  private readonly profileService = inject(CommunityProfileService);

  readonly user = this.auth.user;
  readonly myProfile = signal<MyCommunityProfile | null>(null);

  constructor() {
    this.store.loadDiscover();

    if (this.auth.user()) {
      this.profileService.getMyProfile().subscribe({
        next: (profile) => this.myProfile.set(profile),
        error: () => {},
      });
    }
  }

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
    this.store.openAddToTrip({
      spot: item.title,
      meta: `${item.tag} · ${item.place}`,
      image: item.image,
    });
  }
}