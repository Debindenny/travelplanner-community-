import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export type JourneyEmptyStatePreset = 'no-trips' | 'no-results' | 'no-community-posts';

interface PresetConfig {
  icon: 'search' | 'users' | 'map' | 'inbox';
  title: string;
  subtitle: string;
}

/** Themed preset wrapper around the shared EmptyStateComponent for journey/trip contexts. */
@Component({
    selector: 'app-journey-empty-state',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [EmptyStateComponent],
    template: `
    <div class="rounded-card border border-atmosphere/10 bg-atmosphere-elevated/[0.03] py-2">
      <app-empty-state
        [icon]="presetConfig[preset].icon"
        [title]="title ?? presetConfig[preset].title"
        [subtitle]="subtitle ?? presetConfig[preset].subtitle"
      >
        <ng-content></ng-content>
      </app-empty-state>
    </div>
  `
})
export class JourneyEmptyStateComponent {
  @Input() preset: JourneyEmptyStatePreset = 'no-results';
  @Input() title?: string;
  @Input() subtitle?: string;

  readonly presetConfig: Record<JourneyEmptyStatePreset, PresetConfig> = {
    'no-trips': { icon: 'map', title: 'No trips yet', subtitle: 'Plan your first journey to see it here.' },
    'no-results': { icon: 'search', title: 'No results found', subtitle: 'Try adjusting your search or filters.' },
    'no-community-posts': { icon: 'users', title: 'Nothing shared yet', subtitle: 'Be the first to post in this community.' }
  };
}
