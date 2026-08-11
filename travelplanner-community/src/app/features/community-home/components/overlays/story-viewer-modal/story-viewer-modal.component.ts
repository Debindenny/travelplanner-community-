import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { StoryViewerPayload } from '../../../../../core/models/community.models';

@Component({
  selector: 'app-story-viewer-modal',
  imports: [IconComponent],
  templateUrl: './story-viewer-modal.component.html',
  styleUrl: './story-viewer-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryViewerModalComponent {
  readonly story = input.required<StoryViewerPayload>();
  readonly followed = input(false);
  readonly saved = input(false);

  readonly close = output<void>();
  readonly toggleFollow = output<void>();
  readonly openTrip = output<void>();
  readonly message = output<void>();
  readonly toggleSave = output<void>();

  readonly note = computed(() => {
    const story = this.story();
    if (story.status === 'There now') {
      return `${story.name} is in ${story.place} right now and sharing as they go. Destination-level only — exact location is never shown.`;
    }
    if (story.status === 'Going soon') {
      return `${story.name} is heading to ${story.place} soon. Follow to see notes and plans as the trip gets closer.`;
    }
    return `${story.name} recently travelled to ${story.place}. Their notes and itinerary are open to the community.`;
  });
}
