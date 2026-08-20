import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { DsIconComponent } from '../../icon/icon.component';
import { SavedDetailPayload } from '../../discover-saved.models';

@Component({
  selector: 'app-ds-saved-detail-modal',
  imports: [DsIconComponent],
  templateUrl: './saved-detail-modal.component.html',
  styleUrl: './saved-detail-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DsSavedDetailModalComponent {
  readonly item = input.required<SavedDetailPayload>();
  readonly saved = input(false);

  readonly close = output<void>();
  readonly toggleSave = output<void>();
  readonly addToTrip = output<void>();
}
