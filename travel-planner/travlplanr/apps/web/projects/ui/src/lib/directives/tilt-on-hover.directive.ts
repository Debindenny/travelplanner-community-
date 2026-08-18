import { Directive, ElementRef, HostListener, inject } from '@angular/core';

const MAX_TILT_DEG = 6;

/**
 * CSS-transform-only 3D tilt on pointer hover. Desktop-only by design: attaches
 * its pointermove listener only when `(hover: hover) and (pointer: fine)`
 * matches, so touch devices never pay for (or see) the effect. Not gated by
 * MotionPolicyService — that gate is reserved for actual WebGL/3D content;
 * this is a standard CSS transform, same tier as any other hover transition.
 */
@Directive({
  selector: '[appTiltOnHover]',
  standalone: true
})
export class TiltOnHoverDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly enabled =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
      : false;

  @HostListener('pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (!this.enabled) return;
    const rect = this.el.nativeElement.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    const rotateY = px * MAX_TILT_DEG * 2;
    const rotateX = -py * MAX_TILT_DEG * 2;
    this.el.nativeElement.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }

  @HostListener('pointerleave')
  onPointerLeave(): void {
    if (!this.enabled) return;
    this.el.nativeElement.style.transform = '';
  }
}
