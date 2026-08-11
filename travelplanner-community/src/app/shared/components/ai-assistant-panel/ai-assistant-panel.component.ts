import { ChangeDetectionStrategy, Component, input, model, output, signal } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { AiPrompt } from '../../../core/models/community.models';

@Component({
  selector: 'app-ai-assistant-panel',
  imports: [IconComponent],
  templateUrl: './ai-assistant-panel.component.html',
  styleUrl: './ai-assistant-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAssistantPanelComponent {
  readonly prompts = input<AiPrompt[]>([]);
  readonly open = model(false);

  readonly selectPrompt = output<AiPrompt>();
  readonly ask = output<string>();

  readonly draft = signal('');

  submit(): void {
    const text = this.draft().trim();
    if (!text) {
      return;
    }
    this.ask.emit(text);
    this.draft.set('');
  }
}
