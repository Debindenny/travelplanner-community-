import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CommunityStory } from '../../../../../core/models/community.models';

@Component({
  selector: 'app-story-rail',
  imports: [IconComponent],
  templateUrl: './story-rail.component.html',
  styleUrl: './story-rail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryRailComponent {
  readonly stories = input<CommunityStory[]>([]);

  readonly openStory = output<CommunityStory>();
  readonly addStory = output<void>();
}
