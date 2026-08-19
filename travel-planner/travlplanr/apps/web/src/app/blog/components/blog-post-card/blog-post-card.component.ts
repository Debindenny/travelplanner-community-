import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { BlogPost } from '../../../shared/models/blog.models';

@Component({
    selector: 'app-blog-post-card',
    imports: [RouterLink, TranslatePipe],
    template: `
    <article class="group relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-white transition-shadow hover:shadow-lg">
      <div class="block overflow-hidden">
        <img
          [src]="post.image"
          alt=""
          class="h-[220px] w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          width="420"
          height="220"
        />
      </div>
      <div class="flex flex-1 flex-col p-6">
        <span class="inline-block w-fit rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary">
          {{ post.categoryLabel }}
        </span>
        <a [routerLink]="['/blog', post.slug]" class="mt-3 no-underline after:absolute after:inset-0">
          <h2 class="text-xl font-semibold leading-snug text-text-primary transition-colors group-hover:text-primary">
            {{ post.title }}
          </h2>
        </a>
        <p class="mt-2 flex-1 text-sm leading-relaxed text-text-secondary">
          {{ post.excerpt }}
        </p>
        <div class="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 text-xs-plus text-text-tertiary">
          <span>{{ post.author }}</span>
          <span>{{ post.publishedAt }} · {{ post.readTime }}</span>
        </div>
        <span class="mt-3 text-sm font-medium text-primary" aria-hidden="true">{{ 'BLOG.READ_ARTICLE' | translate }}</span>
      </div>
    </article>
  `
})
export class BlogPostCardComponent {
  @Input({ required: true }) post!: BlogPost;
}
