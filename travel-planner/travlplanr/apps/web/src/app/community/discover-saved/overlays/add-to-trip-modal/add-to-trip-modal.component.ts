import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { DsIconComponent } from '../../icon/icon.component';
import { TripPickOption } from '../../discover-saved.models';

@Component({
  selector: 'app-ds-add-to-trip-modal',
  imports: [DsIconComponent],
  templateUrl: './add-to-trip-modal.component.html',
  styleUrl: './add-to-trip-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DsAddToTripModalComponent {
  readonly spot = input('');
  readonly spotMeta = input('');
  readonly spotImage = input('');
  readonly trips = input<TripPickOption[]>([]);
  readonly tripPick = input('');
  readonly days = input<{ label: string; date: string; count: string; active: boolean; day: number }[]>([]);
  readonly confirmationLine = input('');

  readonly pickTrip = output<string>();
  readonly pickDay = output<number>();
  readonly cancel = output<void>();
  readonly confirm = output<void>();
}
