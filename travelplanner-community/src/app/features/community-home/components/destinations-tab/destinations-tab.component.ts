import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { DestinationCardComponent } from './destination-card/destination-card.component';
import { CommunityHomeStore } from '../../store/community-home.store';
import { CommunityDestination, DestinationSort } from '../../../../core/models/community.models';

@Component({
  selector: 'app-destinations-tab',
  imports: [IconComponent, DestinationCardComponent],
  templateUrl: './destinations-tab.component.html',
  styleUrl: './destinations-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DestinationsTabComponent {
  readonly store = inject(CommunityHomeStore);

  readonly sorts: DestinationSort[] = ['Popular', 'Near me'];

  isJoined(id: string): boolean {
    return this.store.joinedIds().has(id);
  }

  goHome(): void {
    this.store.selectTab('Home');
  }

  onViewDetails(destination: CommunityDestination): void {
    this.store.openDestinationDetail(destination);
  }

  onToggleJoin(destination: CommunityDestination): void {
    this.store.toggleJoin(destination.id, destination.name);
  }
}
