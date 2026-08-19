import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DeviceCapabilityService {
  readonly hasWeakGpu = signal<boolean>(this.detectWeakGpu());

  private detectWeakGpu(): boolean {
    if (typeof navigator === 'undefined') return true;
    const cores = (navigator as any).hardwareConcurrency ?? 4;
    // deviceMemory is Chromium-only; undefined elsewhere means we can't tell, so assume adequate.
    const memory = (navigator as any).deviceMemory ?? 4;
    const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (cores <= 2 || memory <= 2) return true;
    if (isMobileUA && (cores <= 4 || memory <= 4)) return true;
    return !this.canGetWebglContext();
  }

  private canGetWebglContext(): boolean {
    if (typeof document === 'undefined') return false;
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      return false;
    }
  }
}
