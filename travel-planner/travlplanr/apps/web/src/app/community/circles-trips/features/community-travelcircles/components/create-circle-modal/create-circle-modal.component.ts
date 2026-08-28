import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';

import { IconComponent, IconName } from '../../../../shared/components/icon/icon.component';

export type CircleVisibility = 'Public' | 'Invite only' | 'Friends';
export type CircleAudience = 'Everyone' | 'Women only' | 'Men only';

export interface CreateCirclePayload {
  name: string;
  description: string;
  visibility: CircleVisibility;
  audience: CircleAudience;
  groupSize: number;
}

interface AudienceOption {
  value: CircleAudience;
  label: string;
  description: string;
  icon: IconName;
  iconBg: string;
  iconColor: string;
}

interface VisibilityOption {
  value: CircleVisibility;
  label: string;
  description: string;
  icon: IconName;
  iconBg: string;
  iconColor: string;
}

const VISIBILITY_HINTS: Record<CircleVisibility, string> = {
  Public: 'Anyone can find and join instantly.',
  'Invite only': 'People can request to join and you approve them.',
  Friends: 'Only travelers you follow can join.',
};

const AUDIENCE_OPTIONS: AudienceOption[] = [
  { value: 'Everyone', label: 'Open to everyone', description: 'Any traveler can join', icon: 'users', iconBg: '#e9f1ff', iconColor: '#2563eb' },
  { value: 'Women only', label: 'Women only', description: 'Verified women', icon: 'shield', iconBg: '#fdecf1', iconColor: '#d1497a' },
  { value: 'Men only', label: 'Men only', description: 'Verified men', icon: 'shield', iconBg: '#eaf3f6', iconColor: '#3f7c93' },
];

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  { value: 'Public', label: 'Public', description: 'Anyone can join instantly', icon: 'compass', iconBg: '#f1f3f6', iconColor: '#5a6472' },
  { value: 'Invite only', label: 'Invite only', description: 'Request, then you approve', icon: 'user-plus', iconBg: '#e9f1ff', iconColor: '#2563eb' },
  { value: 'Friends', label: 'Friends', description: 'Mutual followers only', icon: 'users', iconBg: '#f1f3f6', iconColor: '#5a6472' },
];

const MIN_GROUP_SIZE = 2;
const MAX_GROUP_SIZE = 30;

@Component({
  selector: 'app-create-circle-modal',
  imports: [IconComponent],
  templateUrl: './create-circle-modal.component.html',
  styleUrl: './create-circle-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateCircleModalComponent {
  readonly audienceOptions = AUDIENCE_OPTIONS;
  readonly visibilityOptions = VISIBILITY_OPTIONS;

  readonly name = signal('');
  readonly description = signal('');
  readonly visibility = signal<CircleVisibility>('Invite only');
  readonly audience = signal<CircleAudience>('Everyone');
  readonly groupSize = signal(8);

  readonly ready = computed(() => this.name().trim().length > 0);
  readonly visibilityHint = computed(() => VISIBILITY_HINTS[this.visibility()]);

  readonly cancel = output<void>();
  readonly create = output<CreateCirclePayload>();

  onNameInput(value: string): void {
    this.name.set(value);
  }

  onDescriptionInput(value: string): void {
    this.description.set(value);
  }

  decrementGroupSize(): void {
    this.groupSize.update((size) => Math.max(MIN_GROUP_SIZE, size - 1));
  }

  incrementGroupSize(): void {
    this.groupSize.update((size) => Math.min(MAX_GROUP_SIZE, size + 1));
  }

  canDecrementGroupSize(): boolean {
    return this.groupSize() > MIN_GROUP_SIZE;
  }

  canIncrementGroupSize(): boolean {
    return this.groupSize() < MAX_GROUP_SIZE;
  }

  onCreate(): void {
    if (!this.ready()) {
      return;
    }
    this.create.emit({
      name: this.name().trim(),
      description: this.description().trim(),
      visibility: this.visibility(),
      audience: this.audience(),
      groupSize: this.groupSize(),
    });
  }
}
