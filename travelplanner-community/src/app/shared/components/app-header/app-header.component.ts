import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { PROFILE_MENU_ITEMS } from '../../../core/data/community-mock-data';
import { ProfileMenuItem, SearchSuggestion } from '../../../core/models/community.models';

@Component({
  selector: 'app-header',
  imports: [IconComponent],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  readonly marketingNav = ['Home', 'Explore', 'Transfers', 'About Us', 'Pricing', 'Community'];
  readonly profileMenuItems = PROFILE_MENU_ITEMS;

  readonly suggestions = input<SearchSuggestion[]>([]);

  readonly profileOpen = model<boolean>(false);
  readonly selectMenuItem = output<ProfileMenuItem>();
  readonly selectSuggestion = output<SearchSuggestion>();
  readonly toggleTheme = output<void>();

  toggleProfile(): void {
    this.profileOpen.set(!this.profileOpen());
  }

  onSelectMenuItem(item: ProfileMenuItem): void {
    this.profileOpen.set(false);
    this.selectMenuItem.emit(item);
  }
}
