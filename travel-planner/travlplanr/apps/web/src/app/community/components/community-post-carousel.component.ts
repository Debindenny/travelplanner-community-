import { Component, Input, signal, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'app-community-post-carousel',
    imports: [CommonModule, TranslatePipe],
    template: `
    @if (images.length > 0) {
      <div
        class="relative w-full aspect-[4/5] bg-gray-900 group"
        (touchstart)="onTouchStart($event)"
        (touchend)="onTouchEnd($event)"
        >
        <!-- Main Image -->
        <img
          [src]="images[currentIndex()]"
          class="w-full h-full object-cover transition-opacity duration-300 cursor-pointer"
          (click)="openLightbox()"
          loading="lazy"
          decoding="async"
          [attr.alt]="'COMMUNITY.CAROUSEL.IMAGE_ALT' | translate"
          />
    
        <!-- Navigation Arrows -->
        @if (images.length > 1) {
          @if (currentIndex() > 0) {
            <button
              (click)="prev($event)"
              class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
              [attr.aria-label]="'COMMUNITY.CAROUSEL.PREVIOUS' | translate"
              >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          }
    
          @if (currentIndex() < images.length - 1) {
            <button
              (click)="next($event)"
              class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
              [attr.aria-label]="'COMMUNITY.CAROUSEL.NEXT' | translate"
              >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          }
    
          <!-- Dots -->
          <div class="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
            @for (img of images; track idx; let idx = $index) {
              <button (click)="goTo(idx, $event)" class="w-1.5 h-1.5 rounded-full transition-all focus:outline-none" [ngClass]="{'bg-white scale-125': currentIndex() === idx, 'bg-white/50': currentIndex() !== idx}" [attr.aria-label]="'COMMUNITY.CAROUSEL.GO_TO_IMAGE' | translate:{n: idx + 1}"></button>
            }
          </div>
        }
      </div>
    }
    
    <!-- Lightbox -->
    @if (isLightboxOpen()) {
      <div
        class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center backdrop-blur-sm"
        (click)="closeLightbox()"
        (touchstart)="onTouchStart($event)"
        (touchend)="onTouchEnd($event)"
        >
        <!-- Close Button -->
        <button
          class="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors focus:outline-none"
          (click)="closeLightbox()"
          [attr.aria-label]="'COMMUNITY.CAROUSEL.CLOSE_LIGHTBOX' | translate"
          >
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
    
        <img
          [src]="images[currentIndex()]"
          class="max-w-full max-h-[90vh] object-contain"
          (click)="$event.stopPropagation()"
          loading="lazy"
          decoding="async"
          [attr.alt]="'COMMUNITY.CAROUSEL.IMAGE_FULL_ALT' | translate"
          />
    
        @if (images.length > 1) {
          @if (currentIndex() > 0) {
            <button
              (click)="prev($event)"
              class="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors focus:outline-none"
              [attr.aria-label]="'COMMUNITY.CAROUSEL.PREVIOUS' | translate"
              >
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          }
    
          @if (currentIndex() < images.length - 1) {
            <button
              (click)="next($event)"
              class="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors focus:outline-none"
              [attr.aria-label]="'COMMUNITY.CAROUSEL.NEXT' | translate"
              >
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          }
        }
      </div>
    }
    `,
    styles: []
})
export class CommunityPostCarouselComponent implements OnDestroy {
  @Input({ required: true }) images: string[] = [];
  
  currentIndex = signal<number>(0);
  isLightboxOpen = signal<boolean>(false);

  private touchStartX = 0;
  private touchEndX = 0;
  
  private keydownListener = (event: KeyboardEvent) => {
    if (!this.isLightboxOpen()) return;
    
    if (event.key === 'Escape') {
      this.closeLightbox();
    } else if (event.key === 'ArrowRight') {
      this.next();
    } else if (event.key === 'ArrowLeft') {
      this.prev();
    }
  };

  ngOnDestroy() {
    if (this.isLightboxOpen()) {
      this.closeLightbox();
    }
  }

  next(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (this.currentIndex() < this.images.length - 1) {
      this.currentIndex.update(v => v + 1);
    }
  }

  prev(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (this.currentIndex() > 0) {
      this.currentIndex.update(v => v - 1);
    }
  }

  goTo(index: number, event: Event) {
    event.stopPropagation();
    this.currentIndex.set(index);
  }

  openLightbox() {
    this.isLightboxOpen.set(true);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', this.keydownListener);
  }

  closeLightbox() {
    this.isLightboxOpen.set(false);
    document.body.style.overflow = '';
    document.removeEventListener('keydown', this.keydownListener);
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  private handleSwipe() {
    const swipeThreshold = 50;
    const diff = this.touchStartX - this.touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swiped left, go next
        this.next();
      } else {
        // Swiped right, go prev
        this.prev();
      }
    }
  }
}
