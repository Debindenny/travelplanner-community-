import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { CommunityDestination } from '../../../../../core/models/community.models';

@Component({
  selector: 'app-destination-card',
  imports: [],
  templateUrl: './destination-card.component.html',
  styleUrl: './destination-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DestinationCardComponent {
  readonly destination = input.required<CommunityDestination>();
  readonly joined = input(false);

  readonly viewDetails = output<void>();
  readonly toggleJoin = output<void>();
}
