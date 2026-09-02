import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'app-floating-chat-button',
  templateUrl: './floating-chat-button.component.html',
  styleUrl: './floating-chat-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatingChatButtonComponent {
  readonly ariaLabel = input<string>('Open chat');

  readonly clicked = output<void>();
}
