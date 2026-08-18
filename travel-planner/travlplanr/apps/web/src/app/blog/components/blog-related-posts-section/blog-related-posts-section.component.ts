import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';
import { BlogPost } from '../../../shared/models/blog.models';

@Component({
    selector: 'app-blog-related-posts-section',
    imports: [RouterLink, SectionHeaderComponent, TranslatePipe],
    template: `
    <section class="bg-white py-[80px]">
      <div class="section-container section-gap">
        <div class="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <app-section-header
            [title]="'BLOG.RELATED.TITLE' | translate"
            [subtitle]="'BLOG.RELATED.SUBTITLE' | translate"
            [watermark]="'BLOG.RELATED.TITLE' | translate"
            [narrow]="false"
            class="flex-1"
          />
          <div class="hidden shrink-0 gap-8 lg:flex">
            <button
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-primary"
              [attr.aria-label]="'BLOG.RELATED.SCROLL_LEFT' | translate"
              (click)="scroll(-1)"
            >
              <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
            <button
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-primary"
              [attr.aria-label]="'BLOG.RELATED.SCROLL_RIGHT' | translate"
              (click)="scroll(1)"
            >
              <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div
          #scroller
          class="hide-scrollbar -mx-5 flex gap-6 overflow-x-auto px-5 pb-2 lg:-mx-0 lg:px-0"
        >
          @for (post of posts; track post.slug) {
            <article class="group relative w-[302px] shrink-0 overflow-hidden rounded-lg border border-border bg-white">
              <div class="block overflow-hidden">
                <img
                  [src]="post.image"
                  alt=""
                  class="h-[180px] w-full object-cover transition-transform duration-500 hover:scale-105"
                  loading="lazy"
                  width="302"
                  height="180"
                />
              </div>
              <div class="p-5">
                <span class="text-xs font-medium text-primary">{{ post.categoryLabel }}</span>
                <a [routerLink]="['/blog', post.slug]" class="mt-2 block no-underline after:absolute after:inset-0">
                  <h3 class="text-lg font-semibold leading-snug text-text-primary hover:text-primary">
                    {{ post.title }}
                  </h3>
                </a>
                <p class="mt-2 line-clamp-2 text-sm text-text-secondary">{{ post.excerpt }}</p>
                <p class="mt-3 text-xs-plus text-text-tertiary">{{ post.publishedAt }} · {{ post.readTime }}</p>
                <span class="mt-3 inline-block text-sm font-medium text-primary" aria-hidden="true">{{ 'BLOG.READ_ARTICLE' | translate }}</span>
              </div>
            </article>
          }
        </div>
      </div>
    </section>
  `
})
export class BlogRelatedPostsSectionComponent {
  @Input({ required: true }) posts!: BlogPost[];

  @ViewChild('scroller') scroller?: ElementRef<HTMLDivElement>;

  scroll(direction: -1 | 1): void {
    const el = this.scroller?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direction * 326, behavior: 'smooth' });
  }
}
