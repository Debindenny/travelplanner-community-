import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MotionPolicyService } from '../motion/motion-policy.service';

/**
 * Host wrapper for any 3D/WebGL visualization. Consumers project two
 * ng-content slots: [aero3dScene] (the real, heavy 3D content) and
 * [aero3dFallback] (a static 2D/CSS replacement, always cheap to render).
 *
 * Important: ng-content projects already-instantiated component instances
 * from the parent's template, so wrapping content in <app-aero-3d> alone
 * does NOT lazy-load the 3D module. The consumer must still gate the 3D
 * child's instantiation with its own `@defer (when policy.shouldRender3d())`
 * block — this host only supplies the fallback-swap contract and consistent
 * sizing, not code-splitting.
 */
@Component({
  selector: 'app-aero-3d',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (policy.shouldRender3d()) {
      <ng-content select="[aero3dScene]"></ng-content>
    } @else {
      <ng-content select="[aero3dFallback]"></ng-content>
    }
  `
})
export class Aero3dComponent {
  protected readonly policy = inject(MotionPolicyService);
}
