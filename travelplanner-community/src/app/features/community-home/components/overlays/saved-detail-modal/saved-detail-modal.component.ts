import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { SavedDetailPayload } from '../../../../../core/models/community.models';

@Component({
  selector: 'app-saved-detail-modal',
  imports: [IconComponent],
  templateUrl: './saved-detail-modal.component.html',
  styleUrl: './saved-detail-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavedDetailModalComponent {
  readonly item = input.required<SavedDetailPayload>();

  readonly close = output<void>();
  readonly addToTrip = output<void>();
}
