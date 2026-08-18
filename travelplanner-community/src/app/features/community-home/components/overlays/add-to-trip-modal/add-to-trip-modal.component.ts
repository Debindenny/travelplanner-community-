import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { AddDayOption, AddKindOption, AddPreview, AddTimeSlot, TripPickOption } from '../../../../../core/models/community.models';

const TIME_SLOTS: AddTimeSlot[] = ['Morning', 'Afternoon', 'Evening', 'Anytime'];

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
  readonly addKinds = input<AddKindOption[]>([]);
  readonly addKind = input('');
  readonly days = input<AddDayOption[]>([]);
  readonly addDay = input(1);
  readonly addSlot = input<AddTimeSlot>('Anytime');
  readonly preview = input<AddPreview | null>(null);
  readonly targetSummary = input('');

  readonly pickTrip = output<string>();
  readonly pickKind = output<string>();
  readonly pickDay = output<number>();
  readonly pickSlot = output<AddTimeSlot>();
  readonly cancel = output<void>();
  readonly confirm = output<void>();

  readonly timeSlots = TIME_SLOTS;
}
