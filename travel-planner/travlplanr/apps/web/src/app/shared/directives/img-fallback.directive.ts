import { Directive, ElementRef, HostListener, Input } from '@angular/core';

const DEFAULT_FALLBACK = 'assets/images/landing/journey-thailand.jpg';

@Directive({
  selector: 'img[appImgFallback]',
  standalone: true
})
export class ImgFallbackDirective {
  /**
   * Written as a bare attribute at most call sites (`<img appImgFallback>`), which
   * Angular binds as the empty string — so an empty value must fall back to the
   * default rather than being used as a URL. Setting `src=''` resolves to the
   * document URL, which fails to decode and re-fires `error` forever.
   */
  @Input()
  set appImgFallback(value: string | undefined | null) {
    this.fallback = value?.trim() || DEFAULT_FALLBACK;
  }

  private fallback = DEFAULT_FALLBACK;

  /** Guards against a loop when the fallback image itself fails to load. */
  private applied = false;

  constructor(private el: ElementRef<HTMLImageElement>) {}

  @HostListener('error')
  onError(): void {
    if (this.applied) {
      return;
    }
    this.applied = true;

    // Compare resolved URLs: element.src is absolute, while `fallback` is a
    // relative asset path, so a raw !== comparison is always true and would let
    // a broken fallback retrigger this handler indefinitely.
    const element = this.el.nativeElement;
    const resolvedFallback = new URL(this.fallback, document.baseURI).href;
    if (element.src !== resolvedFallback) {
      element.src = this.fallback;
    }
  }
}
