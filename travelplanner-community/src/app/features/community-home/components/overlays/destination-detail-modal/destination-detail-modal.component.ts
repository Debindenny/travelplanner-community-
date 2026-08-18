import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { UpperCasePipe } from '@angular/common';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CommunityDestination, DestinationRecentPost } from '../../../../../core/models/community.models';

@Component({
  selector: 'app-destination-detail-modal',
  imports: [IconComponent, UpperCasePipe],
  templateUrl: './destination-detail-modal.component.html',
  styleUrl: './destination-detail-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DestinationDetailModalComponent {
  readonly destination = input.required<CommunityDestination>();
  readonly joined = input(false);

  readonly close = output<void>();
  readonly toggleJoin = output<void>();
  readonly openPost = output<DestinationRecentPost>();
}
