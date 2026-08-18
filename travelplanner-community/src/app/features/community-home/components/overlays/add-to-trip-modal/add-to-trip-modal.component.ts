import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { AddDayOption, TripPickOption } from '../../../../../core/models/community.models';

@Component({
  selector: 'app-add-to-trip-modal',
  imports: [IconComponent],
  templateUrl: './add-to-trip-modal.component.html',
  styleUrl: './add-to-trip-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddToTripModalComponent {
  readonly spot = input('');
  readonly spotMeta = input('');
  readonly spotImage = input('');
  readonly trips = input<TripPickOption[]>([]);
  readonly tripPick = input('');
  readonly days = input<AddDayOption[]>([]);
  readonly addDay = input(1);
  readonly confirmationText = input('');

  readonly pickTrip = output<string>();
  readonly pickDay = output<number>();
  readonly cancel = output<void>();
  readonly confirm = output<void>();
}
