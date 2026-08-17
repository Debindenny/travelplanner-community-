import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { TripPickOption } from '../../../../../core/models/community.models';

@Component({
  selector: 'app-add-to-trip-modal',
  imports: [],
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
  readonly addKinds = input<string[]>([]);
  readonly addKind = input('');
  readonly days = input<{ label: string; date: string; count: string; active: boolean; day: number }[]>([]);
  readonly slots = input<string[]>([]);
  readonly addSlot = input('');
  readonly previewHead = input('');
  readonly previewRows = input<{ time: string; name: string; isNew: boolean }[]>([]);
  readonly targetSummary = input('');

  readonly pickTrip = output<string>();
  readonly pickKind = output<string>();
  readonly pickDay = output<number>();
  readonly pickSlot = output<string>();
  readonly cancel = output<void>();
  readonly confirm = output<void>();
}
