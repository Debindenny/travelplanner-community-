import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-use-as-inspiration-modal',
  imports: [],
  templateUrl: './use-as-inspiration-modal.component.html',
  styleUrl: './use-as-inspiration-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UseAsInspirationModalComponent {
  readonly authorName = input('');
  readonly dates = input('');
  readonly travelers = input('');
  readonly paces = input<string[]>([]);
  readonly pace = input('');
  readonly interestOptions = input<string[]>([]);
  readonly interests = input<ReadonlySet<string>>(new Set());

  readonly datesChange = output<string>();
  readonly travelersChange = output<string>();
  readonly pickPace = output<string>();
  readonly toggleInterest = output<string>();
  readonly cancel = output<void>();
  readonly confirm = output<void>();
}
