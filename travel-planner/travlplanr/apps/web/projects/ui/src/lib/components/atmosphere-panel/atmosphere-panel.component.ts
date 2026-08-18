import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type AtmospherePanelSurface = 'solid' | 'elevated' | 'glass';

/** Base surface/glass container primitive — other panels (cards, metrics) compose inside this. */
@Component({
  selector: 'app-atmosphere-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-card p-card" [class]="surfaceClasses[surface]" [class.shadow-orbit]="surface === 'elevated'">
      <ng-content></ng-content>
    </div>
  `
})
export class AtmospherePanelComponent {
  @Input() surface: AtmospherePanelSurface = 'elevated';

  readonly surfaceClasses: Record<AtmospherePanelSurface, string> = {
    solid: 'bg-atmosphere text-white',
    elevated: 'bg-atmosphere-elevated text-white',
    glass: 'atmosphere-panel'
  };
}
