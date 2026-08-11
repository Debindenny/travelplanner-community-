import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { ComposerFormDef } from '../../../../../core/models/community.models';

const AUDIENCES = ['Everyone in the community', 'People going to this place', 'My travel circles'];

const AUDIENCE_HINTS: Record<string, string> = {
  'Everyone in the community': 'Anyone browsing this destination can see and save it.',
  'People going to this place': 'Only travelers with upcoming dates for this destination will see it.',
  'My travel circles': 'Shared privately with the circles you belong to.',
};

@Component({
  selector: 'app-composer-form',
  imports: [IconComponent],
  templateUrl: './composer-form.component.html',
  styleUrl: './composer-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComposerFormComponent {
  readonly form = input.required<ComposerFormDef>();
  readonly values = input<Readonly<Record<string, string>>>({});
  readonly chips = input<ReadonlySet<string>>(new Set());
  readonly mediaAttached = input(false);
  readonly audience = input('Everyone in the community');
  readonly ready = input(false);

  readonly audiences = AUDIENCES;

  readonly back = output<void>();
  readonly fieldChange = output<{ key: string; value: string }>();
  readonly toggleChip = output<string>();
  readonly setAudience = output<string>();
  readonly toggleMedia = output<void>();
  readonly cancel = output<void>();
  readonly submit = output<void>();

  fieldValue(key: string): string {
    return this.values()[`${this.form().formType}|${key}`] ?? '';
  }

  audienceHint(): string {
    return AUDIENCE_HINTS[this.audience()] ?? '';
  }
}
