import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { DiscoverDetailPayload } from '../../../../../core/models/community.models';

@Component({
  selector: 'app-discover-detail-modal',
  imports: [IconComponent],
  templateUrl: './discover-detail-modal.component.html',
  styleUrl: './discover-detail-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverDetailModalComponent {
  readonly item = input.required<DiscoverDetailPayload>();

  readonly close = output<void>();
  readonly addToTrip = output<void>();

  readonly description = computed(() => {
    const tag = this.item().tag.toLowerCase();
    return `Shared with the community as a ${tag} and used by travelers planning a similar trip. Save it or add it straight into your itinerary.`;
  });
}
