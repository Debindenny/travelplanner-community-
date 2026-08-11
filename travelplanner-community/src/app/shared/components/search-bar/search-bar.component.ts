import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { SearchSuggestion } from '../../../core/models/community.models';

@Component({
  selector: 'app-search-bar',
  imports: [IconComponent],
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBarComponent {
  readonly suggestions = input<SearchSuggestion[]>([]);
  readonly selectSuggestion = output<SearchSuggestion>();

  private readonly query = signal('');
  private readonly dismissed = signal(false);

  readonly value = this.query.asReadonly();
  readonly open = computed(() => !this.dismissed() && this.query().trim().length > 0);

  onInput(value: string): void {
    this.query.set(value);
    this.dismissed.set(false);
  }

  onFocus(): void {
    this.dismissed.set(false);
  }

  onSelect(suggestion: SearchSuggestion): void {
    this.query.set('');
    this.dismissed.set(true);
    this.selectSuggestion.emit(suggestion);
  }
}
