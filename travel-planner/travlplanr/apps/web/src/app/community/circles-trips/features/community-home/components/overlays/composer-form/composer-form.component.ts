import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CommunityHomeStore } from '../../../store/community-home.store';

interface AudienceOption {
  value: string;
  caption: string;
}

const AUDIENCE_OPTIONS: AudienceOption[] = [
  { value: 'Everyone in the community', caption: 'Visible to everyone browsing the community.' },
  { value: 'People going to this place', caption: 'Only travelers with upcoming dates for this destination will see it.' },
  { value: 'My travel circles', caption: 'Only members of your travel circles will see it.' },
];

@Component({
  selector: 'app-composer-form',
  imports: [IconComponent],
  templateUrl: './composer-form.component.html',
  styleUrl: './composer-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComposerFormComponent {
  readonly store = inject(CommunityHomeStore);

  readonly audienceOptions = AUDIENCE_OPTIONS;

  fieldValue(formType: string, key: string): string {
    return this.store.formValues()[`${formType}|${key}`] ?? '';
  }

  onFieldInput(formType: string, key: string, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.store.updateFormField(formType, key, target.value);
  }

  activeAudienceCaption(): string {
    const active = this.store.audience();
    return this.audienceOptions.find((option) => option.value === active)?.caption ?? '';
  }

  onChangeType(): void {
    this.store.backToComposerMenu();
  }

  onCancel(): void {
    this.store.closeModal();
  }

  onSubmit(): void {
    this.store.submitComposerForm();
  }
}
