import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-community-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="card" [attr.aria-label]="title()">
      <div class="card__media" [style.background-image]="image()"></div>
      <div class="card__body">
        <div class="card__meta" *ngIf="meta()">{{ meta() }}</div>
        <h3 class="card__title">{{ title() }}</h3>
        <p class="card__copy" *ngIf="copy()">{{ copy() }}</p>
        <div class="card__actions">
          <ng-content></ng-content>
        </div>
      </div>
    </article>
  `,
  styleUrl: './community-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityCardComponent {
  readonly title = input.required<string>();
  readonly meta = input<string>('');
  readonly copy = input<string>('');
  readonly image = input<string>('');
  readonly action = output<void>();
}
