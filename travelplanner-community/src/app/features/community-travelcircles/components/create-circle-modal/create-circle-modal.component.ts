import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';

export type CircleVisibility = 'Public' | 'Invite only' | 'Friends';

export interface CreateCirclePayload {
  name: string;
  description: string;
  visibility: CircleVisibility;
}

const VISIBILITY_HINTS: Record<CircleVisibility, string> = {
  Public: 'Anyone can find and join instantly.',
  'Invite only': 'People can request to join and you approve them.',
  Friends: 'Only travelers you follow can join.',
};

@Component({
  selector: 'app-create-circle-modal',
  imports: [],
  templateUrl: './create-circle-modal.component.html',
  styleUrl: './create-circle-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateCircleModalComponent {
  readonly visibilityOptions: CircleVisibility[] = ['Public', 'Invite only', 'Friends'];

  readonly name = signal('');
  readonly description = signal('');
  readonly visibility = signal<CircleVisibility>('Invite only');

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
    });
  }
}
