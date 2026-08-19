import { Injectable, computed, inject } from '@angular/core';
import { ReducedMotionService } from './reduced-motion.service';
import { DeviceCapabilityService } from './device-capability.service';

/** Single source of truth for whether 3D/WebGL content should render. Gate every 3D feature on this. */
@Injectable({ providedIn: 'root' })
export class MotionPolicyService {
  private readonly reducedMotion = inject(ReducedMotionService);
  private readonly deviceCapability = inject(DeviceCapabilityService);

  readonly shouldRender3d = computed(
    () => !this.reducedMotion.prefersReducedMotion() && !this.deviceCapability.hasWeakGpu()
  );
}
