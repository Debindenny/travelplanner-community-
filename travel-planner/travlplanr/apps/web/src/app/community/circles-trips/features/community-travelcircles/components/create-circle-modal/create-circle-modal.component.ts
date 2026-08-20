import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';

import { IconComponent, IconName } from '../../../../shared/components/icon/icon.component';

export type CircleVisibility = 'Public' | 'Invite only' | 'Friends';
export type CircleAudience = 'Everyone' | 'Women only' | 'Men only';

export interface CreateCirclePayload {
  name: string;
  description: string;
  visibility: CircleVisibility;
  audience: CircleAudience;
}

interface AudienceOption {
  value: CircleAudience;
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
  { value: 'Women only', label: 'Women only', description: 'Verified women travelers', icon: 'shield', iconBg: '#fdecf1', iconColor: '#d1497a' },
  { value: 'Men only', label: 'Men only', description: 'Verified men travelers', icon: 'shield', iconBg: '#eaf3f6', iconColor: '#3f7c93' },
];

@Component({
  selector: 'app-create-circle-modal',
  imports: [IconComponent],
  templateUrl: './create-circle-modal.component.html',
  styleUrl: './create-circle-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateCircleModalComponent {
  readonly visibilityOptions: CircleVisibility[] = ['Public', 'Invite only', 'Friends'];
  readonly audienceOptions = AUDIENCE_OPTIONS;

  readonly name = signal('');
  readonly description = signal('');
  readonly visibility = signal<CircleVisibility>('Invite only');
  readonly audience = signal<CircleAudience>('Everyone');

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

  onCreate(): void {
    if (!this.ready()) {
      return;
    }
    this.create.emit({
      name: this.name().trim(),
      description: this.description().trim(),
      visibility: this.visibility(),
      audience: this.audience(),
    });
  }
}
